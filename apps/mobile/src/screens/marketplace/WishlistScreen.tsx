import { CachedImage } from '../../components/common/CachedImage';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  InteractionManager,
  Share,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { friendlyError } from '@cinecraft/core';
import { TabletColumn } from '../../components/common/TabletContainer';
import { useResponsive } from '../../hooks/useResponsive';
import { isTabletDevice } from '../../utils/pageType';
const FlashListAny = FlashList as any;
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { Card } from '../../components/Card';
import { CardSkeleton } from '../../components/common/Skeleton';
import { LoadErrorState } from '../../components/common/LoadErrorState';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useToast } from '../../contexts/ToastContext';

const ORANGE = '#FF4B33';

interface WishlistItemCardProps {
  item: any;
  navigation: any;
  onRemove: (id: string) => void;
}

const WishlistItemCard = React.memo(({ item, navigation, onRemove }: WishlistItemCardProps) => {
  const { themeColors: T } = useUserSettings();
  return (
  <Card
    style={styles.card}
    glass={true}
    onPress={() =>
      navigation.navigate('MarketplaceDetail', {
        listingId: item.listingId,
        listingTitle: item.title,
        price: item.price,
        location: item.location,
        imageUrl: item.image_url,
      })
    }
  >
    <CachedImage uri={item.image_url} style={styles.img} resizeMode="cover" />

    <View style={styles.meta}>
      <Text style={[styles.title, { color: T.textPrimary }]}>{item.title}</Text>
      <Text style={styles.price}>{item.price}</Text>
      <View style={styles.locationRow}>
        <Icon name="map-pin" size={12} color={T.iconMuted} />
        <Text style={[styles.loc, { color: T.textSecondary }]}>{item.location}</Text>
      </View>

      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => onRemove(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.title} from wishlist`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="x" size={12} color="#DC2626" strokeWidth={2.5} />
        <Text style={styles.removeText}>Remove from Wishlist</Text>
      </TouchableOpacity>
    </View>
  </Card>
  );
});

export const WishlistScreen = ({ navigation }: { navigation: any }) => {
  const { showToast } = useToast();
  const { isTablet, isLandscape } = useResponsive();
  const { themeColors: T } = useUserSettings();
  const [loadError, setLoadError] = useState(false);
  const numColumns = isTablet ? (isLandscape ? 3 : 2) : 1;
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWishlist = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('marketplace_wishlists' as any)
        .select(`
          id,
          user_id,
          listing_id,
          created_at,
          marketplace_listings (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const enriched = data.map((item: any) => ({
          id: item.id,
          listingId: item.listing_id,
          title: item.marketplace_listings?.title || 'Unknown Item',
          // the listings table stores price_per_day (a number) and images (a list)
          price: item.marketplace_listings?.price_per_day != null ? `₹${item.marketplace_listings.price_per_day}/day` : 'Price on request',
          location: item.marketplace_listings?.location || 'Unknown Location',
          image_url: item.marketplace_listings?.images?.[0] || null,
        }));
        setWishlist(enriched);
      }
      setLoadError(false);
    } catch (e: any) {
      console.warn('[Wishlist] Fetch error:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchWishlist();
    });
    return () => task.cancel();
  }, [fetchWishlist]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWishlist();
    setRefreshing(false);
  };

  const handleShareWishlist = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // The share token is private (not on the public profile): the server hands out the caller's own.
      const { data: token, error: tokenError } = await (supabase as any).rpc('get_my_wishlist_token');
      if (tokenError || !token) throw tokenError || new Error('Could not create a share link.');
      await Share.share({
        message: `Check out my CineCraft gear wishlist: https://cinecraftconnect.com/marketplace/wishlist/shared/${token}`,
      });
    } catch (e: any) {
      Alert.alert('Could not share', friendlyError(e, 'Please try again.'));
    }
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    const removed = wishlist.find((w) => w.id === id);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('marketplace_wishlists' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWishlist((prev) => prev.filter((item) => item.id !== id));
      showToast({
        type: 'success',
        message: 'Removed from wishlist',
        duration: 5000,
        action: {
          label: 'Undo',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user || !removed) return;
              const { error: undoError } = await (supabase.from('marketplace_wishlists' as any) as any)
                .insert({ listing_id: removed.listingId, user_id: user.id });
              if (undoError) throw undoError;
              fetchWishlist();
            } catch (undoErr: any) {
              Alert.alert('Error', friendlyError(undoErr, 'Could not restore the item.'));
            }
          },
        },
      });
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'Could not remove item.'));
    }
  }, [showToast, wishlist, fetchWishlist]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <View style={isTablet ? { paddingHorizontal: 6 } : undefined}>
      <WishlistItemCard
        item={item}
        navigation={navigation}
        onRemove={handleRemove}
      />
    </View>
  ), [navigation, handleRemove, isTablet]);

  return (
    <View style={[styles.container, { backgroundColor: T.bgScreen }]}>
      <Header
        title="Saved Gear & Wishlist"
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share" onPress={handleShareWishlist} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="share" size={18} color={T.textPrimary} />
          </TouchableOpacity>
        }
      />
      <TabletColumn maxWidth="content">

      {loading ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </ScrollView>
      ) : loadError && wishlist.length === 0 ? (
        <LoadErrorState onRetry={() => { setLoading(true); setLoadError(false); fetchWishlist(); }} />
      ) : (
        <FlashListAny
          key={`wishlist-${numColumns}`}
          numColumns={numColumns}
          showsVerticalScrollIndicator={false}
          data={wishlist}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id}
          estimatedItemSize={160}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ORANGE}
              colors={[ORANGE]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="bookmark" size={32} color={T.iconMuted} />
              <Text style={[styles.emptyTitle, { color: T.textPrimary }]}>Your Wishlist is Empty</Text>
              <Text style={[styles.emptySub, { color: T.textSecondary }]}>Bookmark gear packages and locations from the Marketplace.</Text>
            </View>
          }
        />
      )}
      </TabletColumn>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: isTabletDevice ? 20 : 14,
    paddingBottom: 72,
  },
  card: {
    marginBottom: 12,
  },
  img: {
    width: '100%',
    ...(isTabletDevice ? { aspectRatio: 16 / 10 } : { height: 160 }),
    backgroundColor: '#0D0D0D',
  },
  meta: {
    padding: 14,
  },
  title: {
    color: '#0D0D0D',
    fontSize: isTabletDevice ? 17 : 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  price: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  loc: {
    color: '#64748B',
    fontSize: 12,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    marginTop: 4,
  },
  removeText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
  },
});

export default WishlistScreen;
