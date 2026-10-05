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
const FlashListAny = FlashList as any;
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { Card } from '../../components/Card';
import { CardSkeleton } from '../../components/common/Skeleton';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

interface WishlistItemCardProps {
  item: any;
  navigation: any;
  onRemove: (id: string) => void;
}

const WishlistItemCard = React.memo(({ item, navigation, onRemove }: WishlistItemCardProps) => (
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
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.price}>{item.price}</Text>
      <View style={styles.locationRow}>
        <Icon name="map-pin" size={12} color="#6B7280" />
        <Text style={styles.loc}>{item.location}</Text>
      </View>

      <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(item.id)}>
        <Icon name="x" size={12} color="#DC2626" strokeWidth={2.5} />
        <Text style={styles.removeText}>Remove from Wishlist</Text>
      </TouchableOpacity>
    </View>
  </Card>
));

export const WishlistScreen = ({ navigation }: { navigation: any }) => {
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
          price: item.marketplace_listings?.price || 'Negotiable',
          location: item.marketplace_listings?.location || 'Unknown Location',
          image_url: item.marketplace_listings?.image_url || 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop&q=80',
        }));
        setWishlist(enriched);
      }
    } catch (e: any) {
      console.warn('[Wishlist] Fetch error:', e);
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
      Alert.alert('Could not share', e?.message || 'Please try again.');
    }
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('marketplace_wishlists' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWishlist((prev) => prev.filter((item) => item.id !== id));
      Alert.alert('Success', 'Item removed from wishlist.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not remove item.');
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <WishlistItemCard
      item={item}
      navigation={navigation}
      onRemove={handleRemove}
    />
  ), [navigation, handleRemove]);

  return (
    <View style={styles.container}>
      <Header
        title="Saved Gear & Wishlist"
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={handleShareWishlist} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="share" size={18} color={INK} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <ScrollView contentContainerStyle={styles.list}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </ScrollView>
      ) : (
        <FlashListAny
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
              <Icon name="bookmark" size={32} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
              <Text style={styles.emptySub}>Bookmark gear packages and locations from the Marketplace.</Text>
            </View>
          }
        />
      )}
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
    padding: 14,
  },
  card: {
    marginBottom: 12,
  },
  img: {
    width: '100%',
    height: 160,
    backgroundColor: '#0D0D0D',
  },
  meta: {
    padding: 14,
  },
  title: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  price: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  loc: {
    color: '#6B7280',
    fontSize: 12,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeText: {
    color: '#DC2626',
    fontSize: 11.5,
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
    fontWeight: '800',
  },
  emptySub: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
  },
});

export default WishlistScreen;
