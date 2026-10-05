import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { CardSkeleton } from '../../components/common/Skeleton';
import { CreateListingModal } from '../../components/modals/CreateListingModal';
import { GearAlertsModal } from '../../components/marketplace/MarketplaceModals';
import { VendorsScreen } from '../vendors/VendorsScreen';
import { VendorCard } from '../../components/vendors/VendorCard';
import { fetchWithCache, getCache } from '../../services/offlineCache';
import { CachedImage } from '../../components/common/CachedImage';
import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const getConditionColor = (grade?: string) => {
  switch (grade) {
    case 'Mint':
      return '#10B981';
    case 'Excellent':
      return '#3B82F6';
    case 'Good':
      return '#F59E0B';
    case 'Fair':
      return '#F97316';
    default:
      return '#64748B';
  }
};

// ── Memoized Listing Card (Native thread recycling) ──────────────────────────
interface MarketplaceListingCardItemProps {
  item: any;
  themeColors: any;
  isTablet: boolean;
  isSaved: boolean;
  isOwner: boolean;
  navigation: any;
  onToggleWishlist: (id: string) => void;
  onDeleteListing: (id: string, userId: string) => void;
}

const MarketplaceListingCardItem = React.memo(({
  item,
  themeColors,
  isTablet,
  isSaved,
  isOwner,
  navigation,
  onToggleWishlist,
  onDeleteListing,
}: MarketplaceListingCardItemProps) => {
  const displayImage =
    item.images && item.images.length > 0
      ? item.images[0]
      : 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800';

  const sellerName = item.profiles?.full_name || item.profiles?.username || 'CineCraft Member';

  return (
    <TouchableOpacity
      style={[styles.webMarketCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }, isTablet && styles.webMarketCardTablet]}
      activeOpacity={0.92}
      onPress={() =>
        navigation.navigate('MarketplaceDetail', {
          listingId: item.id,
          listingTitle: item.title,
          price: item.price_per_day ? `₹${item.price_per_day.toLocaleString()} / day` : 'Negotiable',
          location: item.location,
          imageUrl: displayImage,
          owner: sellerName,
        })
      }
    >
      {/* Cover Image Header with Badges */}
      <View style={[styles.cardImageWrapper, { backgroundColor: themeColors.chipBg }]}>
        <CachedImage uri={displayImage} style={styles.cardImage} resizeMode="cover" />

        {/* Badges Row */}
        <View style={styles.cardImageBadgesRow}>
          {item.is_bundle && (
            <View style={styles.bundleBadge}>
              <Text style={styles.bundleBadgeText}>📦 BUNDLE</Text>
            </View>
          )}

          {item.condition_grade && (
            <View style={[styles.conditionBadge, { backgroundColor: getConditionColor(item.condition_grade) }]}>
              <Text style={styles.conditionBadgeText}>{item.condition_grade.toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{(item.category || 'GEAR').toUpperCase()}</Text>
          </View>
        </View>

        {/* Wishlist Heart Button */}
        <TouchableOpacity
          style={styles.wishlistHeartBtn}
          onPress={() => onToggleWishlist(item.id)}
        >
          <Icon
            name="heart"
            size={15}
            color={isSaved ? '#EF4444' : '#FFFFFF'}
            fill={isSaved ? '#EF4444' : 'transparent'}
          />
        </TouchableOpacity>

        {/* Delete Option if Owner */}
        {isOwner && (
          <TouchableOpacity
            style={[styles.ownerDeleteBtn, { backgroundColor: themeColors.bgCard }]}
            onPress={() => onDeleteListing(item.id, item.user_id)}
          >
            <Icon name="trash-2" size={14} color="#DC2626" />
          </TouchableOpacity>
        )}
      </View>

      {/* Card Body */}
      <View style={styles.cardBody}>
        <View style={styles.titleRatingRow}>
          <Text style={[styles.listingTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.review_count > 0 && (
            <View style={styles.ratingBadge}>
              <Icon name="star" size={10} color="#F59E0B" />
              <Text style={styles.ratingText}>{(item.average_rating || 0).toFixed(1)}</Text>
            </View>
          )}
        </View>

        {item.description ? (
          <Text style={[styles.listingDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Mono Meta Row */}
        <View style={styles.monoMetaRow}>
          <View style={[styles.monoPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
            <Text style={[styles.monoPillText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              LOC // {item.location || 'Pan-India'}
            </Text>
          </View>
          <View style={[styles.monoPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
            <Text style={[styles.monoPillText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              USER // {sellerName}
            </Text>
          </View>
        </View>

        {/* Price Footer */}
        <View style={[styles.priceFooterRow, { borderTopColor: themeColors.divider }]}>
          <View style={styles.priceContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.priceNumber}>
              {item.price_per_day ? item.price_per_day.toLocaleString() : '0'}
            </Text>
            <Text style={[styles.perDayText, { color: themeColors.textSecondary }]}>/ Day</Text>
          </View>

          {item.price_per_week ? (
            <View style={styles.weeklyBadge}>
              <Text style={styles.weeklyBadgeText}>₹{item.price_per_week.toLocaleString()} / Wk</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const MarketplaceScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const isOffline = useIsOffline();
  const { isTablet, isLandscape } = useResponsive();
  const { themeColors, isDark } = useUserSettings();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const [listings, setListings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'equipment' | 'location' | 'services'>(route?.params?.tab === 'services' ? 'services' : 'all');

  // other screens (feed "see all", old vendor links) open the Marketplace straight on Services
  useEffect(() => {
    if (route?.params?.tab === 'services') {
      setActiveTab('services');
      navigation.setParams?.({ tab: undefined });
    }
  }, [route?.params?.tab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allVendors, setAllVendors] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Filters state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<{
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    category?: string;
  }>({});

  // Wishlist set
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  const fetchListings = useCallback(async () => {
    const cached = await getCache<any[]>('marketplace_listings');
    if (cached && cached.length > 0) {
      setListings(cached);
      setLoading(false);
    }

    try {
      await fetchWithCache(
        'marketplace_listings',
        async () => {
          const supabase = getSupabaseClient();
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user;
          if (user) {
            setCurrentUserId(user.id);

            const { data: wishData } = await ((supabase as any).from('marketplace_wishlists') as any)
              .select('listing_id')
              .eq('user_id', user.id)
              .limit(50);
            if (wishData) {
              setWishlistIds(new Set(wishData.map((w: any) => w.listing_id)));
            }
          }

          const { data, error } = await (supabase.from('marketplace_listings') as any)
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                avatar_url,
                username
              )
            `)
            .order('created_at', { ascending: false })
            .limit(25);

          return !error && data ? data : [];
        },
        {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) setListings(data);
          },
          onFreshData: (data) => {
            if (data && data.length > 0) setListings(data);
          },
        }
      );
    } catch (e) {
      console.warn('[Marketplace] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchListings();
      });
      return () => task.cancel();
    }, [fetchListings])
  );

  useEffect(() => {

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('marketplace-listings-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketplace_listings' },
        () => {
          fetchListings();
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [fetchListings]);

  useAutoRefreshOnReconnect(fetchListings);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  };

  const toggleWishlist = async (listingId: string) => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to save items to your wishlist.');
      return;
    }

    const isSaved = wishlistIds.has(listingId);
    setWishlistIds((prev) => {
      const updated = new Set(prev);
      if (isSaved) updated.delete(listingId);
      else updated.add(listingId);
      return updated;
    });

    try {
      const supabase = getSupabaseClient();
      if (isSaved) {
        await ((supabase as any).from('marketplace_wishlists') as any)
          .delete()
          .eq('listing_id', listingId)
          .eq('user_id', currentUserId);
      } else {
        await ((supabase as any).from('marketplace_wishlists') as any).insert({
          listing_id: listingId,
          user_id: currentUserId,
        });
      }
    } catch (e) {
      console.warn('Wishlist toggle error:', e);
    }
  };

  const handleDeleteListing = (listingId: string, ownerId: string) => {
    if (ownerId !== currentUserId) {
      Alert.alert('Permission Denied', 'You can only delete your own listings.');
      return;
    }

    Alert.alert('Delete Listing', 'Are you sure you want to delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error } = await (supabase.from('marketplace_listings') as any)
              .delete()
              .eq('id', listingId);

            if (error) throw error;
            setListings((prev) => prev.filter((item) => item.id !== listingId));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not delete listing.');
          }
        },
      },
    ]);
  };

  // Filter listings based on tab, query, and advanced filters
  // "All" also shows vendors (newest 40 are loaded; they are filtered and capped at 20 below)
  useEffect(() => {
    if (activeTab !== 'all') return;
    let active = true;
    ((getSupabaseClient() as any).from('vendors') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }: any) => active && setAllVendors(data || []));
    return () => {
      active = false;
    };
  }, [activeTab]);

  const filteredListings = React.useMemo(() => {
    const gear = listings.filter((item) => {
      const itemType = (item.listing_type || 'equipment').toLowerCase();
      const matchesTab = activeTab === 'all' || itemType === activeTab;

      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        (item.title || '').toLowerCase().includes(query) ||
        (item.location || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query);

      const matchesLocation =
        !filters.location || (item.location || '').toLowerCase().includes(filters.location.toLowerCase());

      const matchesCategory =
        !filters.category || (item.category || '').toLowerCase().includes(filters.category.toLowerCase());

      const price = item.price_per_day || 0;
      const matchesMinPrice = filters.minPrice === undefined || price >= filters.minPrice;
      const matchesMaxPrice = filters.maxPrice === undefined || price <= filters.maxPrice;

      return matchesTab && matchesSearch && matchesLocation && matchesCategory && matchesMinPrice && matchesMaxPrice;
    });
    if (activeTab !== 'all') return gear;

    // vendors have no daily price, so a price filter leaves them out; search, location and category apply to both
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) return gear;
    const q = searchQuery.toLowerCase();
    const vendors = allVendors
      .filter((v) => {
        const cats = Array.isArray(v.category) ? v.category : [];
        const text = [v.business_name, v.description, v.location, ...cats].join(' ').toLowerCase();
        return (
          (!q || text.includes(q)) &&
          (!filters.location || (v.location || '').toLowerCase().includes(filters.location.toLowerCase())) &&
          (!filters.category || cats.some((c: string) => c.toLowerCase().includes(filters.category!.toLowerCase())))
        );
      })
      .slice(0, 20)
      .map((v) => ({ ...v, _kind: 'vendor' }));
    return [...gear, ...vendors].sort((a: any, b: any) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0));
  }, [listings, allVendors, activeTab, searchQuery, filters]);

  const hasActiveFilters = !!(filters.location || filters.minPrice || filters.maxPrice || filters.category);

  const renderListingItem = useCallback(({ item }: { item: any }) => (
    <View style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}>
      {item._kind === 'vendor' ? (
        <VendorCard
          vendor={item}
          style={isTablet && { marginHorizontal: 0, marginBottom: 0, width: '100%' }}
          canManage={false}
          onPress={() => navigation.navigate('VendorDetail', { vendorId: item.id, vendorName: item.business_name })}
        />
      ) : (
      <MarketplaceListingCardItem
        item={item}
        themeColors={themeColors}
        isTablet={isTablet}
        isSaved={wishlistIds.has(item.id)}
        isOwner={item.user_id === currentUserId}
        navigation={navigation}
        onToggleWishlist={toggleWishlist}
        onDeleteListing={handleDeleteListing}
      />
      )}
    </View>
  ), [isTablet, isLandscape, themeColors, wishlistIds, currentUserId, navigation, toggleWishlist, handleDeleteListing]);

  const renderShortcuts = () => (
    <>
      {/* Shortcuts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, backgroundColor: themeColors.bgCard, borderColor: themeColors.border }}
            onPress={() => navigation.navigate('MyBookings')}
          >
            <Icon name="calendar" size={13} color={themeColors.textSecondary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, backgroundColor: themeColors.bgCard, borderColor: themeColors.border }}
            onPress={() => navigation.navigate('SellerHub')}
          >
            <Icon name="shopping-bag" size={13} color={themeColors.textSecondary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>Seller Hub</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, backgroundColor: themeColors.bgCard, borderColor: themeColors.border }}
            onPress={() => navigation.navigate('Wishlist')}
          >
            <Icon name="heart" size={13} color={themeColors.textSecondary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>Wishlist</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, backgroundColor: themeColors.bgCard, borderColor: themeColors.border }}
            onPress={() => setAlertsOpen(true)}
          >
            <Icon name="bell" size={13} color={themeColors.textSecondary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>Alerts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );

  const renderTabs = () => (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsRow, { backgroundColor: themeColors.chipBg }]}
        contentContainerStyle={{ gap: 4, flexGrow: 1 }}
      >
        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'all' && styles.tabChipActive]}
          onPress={() => setActiveTab('all')}
        >
          <Icon name="grid" size={14} color={activeTab === 'all' ? '#FFFFFF' : themeColors.textSecondary} />
          <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'all' && styles.tabChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'equipment' && styles.tabChipActive]}
          onPress={() => setActiveTab('equipment')}
        >
          <Icon name="camera" size={14} color={activeTab === 'equipment' ? '#FFFFFF' : themeColors.textSecondary} />
          <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'equipment' && styles.tabChipTextActive]}>
            Equipment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'location' && styles.tabChipActive]}
          onPress={() => setActiveTab('location')}
        >
          <Icon name="home" size={14} color={activeTab === 'location' ? '#FFFFFF' : themeColors.textSecondary} />
          <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'location' && styles.tabChipTextActive]}>
            Locations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'services' && styles.tabChipActive]}
          onPress={() => setActiveTab('services')}
        >
          <Icon name="vendor" size={14} color={activeTab === 'services' ? '#FFFFFF' : themeColors.textSecondary} />
          <Text style={[styles.tabChipText, { color: themeColors.textSecondary }, activeTab === 'services' && styles.tabChipTextActive]}>
            Vendor Services
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );

  const renderHeader = useCallback(() => (
    <View style={styles.pageHeaderSection}>
      <View style={styles.pageHeaderRow}>
        <View style={styles.pageTitleGroup}>
          <Icon name="shopping-bag" size={22} color={ORANGE} strokeWidth={2.2} />
          <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Marketplace</Text>
        </View>

        {!isFan && !isInternal && (
          <TouchableOpacity
            style={styles.createListingBtn}
            onPress={() => setCreateModalVisible(true)}
            accessibilityLabel="Create Listing"
          >
            <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
        Rent gear and locations, or hire production services from fellow creators.
      </Text>
      {renderShortcuts()}

      {isFan && (
        <View style={{ backgroundColor: isDark ? 'rgba(255, 75, 51, 0.1)' : '#FFF0ED', borderRadius: 8, padding: 10, marginTop: 8, marginBottom: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="eye" size={14} color={ORANGE} />
          <Text style={{ flex: 1, fontSize: 11.5, color: themeColors.textSecondary }}>
            <Text style={{ fontWeight: '700', color: ORANGE }}>Fan Account (Viewer Mode):</Text> Gear browsing is active. Listing equipment or booking is reserved for Creator & Studio accounts.
          </Text>
        </View>
      )}

      {/* Search & Filter Bar */}
      <View style={styles.searchFilterRow}>
        <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <Icon name="search" size={16} color={themeColors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
            placeholder="Search equipment, cameras, lenses, studios..."
            placeholderTextColor={themeColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x" size={16} color={themeColors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            { backgroundColor: hasActiveFilters ? ORANGE : themeColors.inputBg, borderColor: hasActiveFilters ? ORANGE : themeColors.border },
            hasActiveFilters && styles.filterBtnActive,
          ]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Icon name="filter" size={16} color={hasActiveFilters ? '#FFFFFF' : themeColors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <View style={styles.activeFiltersRow}>
          {filters.location && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Loc: {filters.location}</Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, location: undefined }))}>
                <Icon name="x" size={12} color={ORANGE} />
              </TouchableOpacity>
            </View>
          )}
          {filters.category && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Cat: {filters.category}</Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, category: undefined }))}>
                <Icon name="x" size={12} color={ORANGE} />
              </TouchableOpacity>
            </View>
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Price: ₹{filters.minPrice || 0} - ₹{filters.maxPrice || 'Any'}
              </Text>
              <TouchableOpacity
                onPress={() => setFilters((f) => ({ ...f, minPrice: undefined, maxPrice: undefined }))}
              >
                <Icon name="x" size={12} color={ORANGE} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {renderTabs()}
    </View>
  ), [themeColors, isFan, isInternal, isDark, searchQuery, hasActiveFilters, filters, activeTab, navigation]);

  const numColumns = isTablet ? (isLandscape ? 3 : 2) : 1;

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      header={
        <Header
          showLogo={true}
          onSearchPress={() => navigation.navigate('Search')}
          onMessagesPress={() => navigation.navigate('Messages')}
          onNotificationPress={() => navigation.navigate('Notifications')}
          onProfilePress={() => navigation.navigate('Profile')}
        />
      }
    >
      {activeTab === 'services' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.pageHeaderSection}>
            <View style={styles.pageHeaderRow}>
              <View style={styles.pageTitleGroup}>
                <Icon name="shopping-bag" size={22} color={ORANGE} strokeWidth={2.2} />
                <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Marketplace</Text>
              </View>
            </View>
            {renderShortcuts()}
            {renderTabs()}
          </View>
          <View style={{ flex: 1 }}>
            <VendorsScreen navigation={navigation} embedded />
          </View>
        </View>
      ) : loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {renderHeader()}
          <View style={isTablet ? styles.tabletGridContainer : { paddingHorizontal: 16 }}>
            <View style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}>
              <CardSkeleton />
            </View>
            <View style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}>
              <CardSkeleton />
            </View>
            {isTablet && isLandscape && (
              <View style={styles.tabletCardWrapper3Col}>
                <CardSkeleton />
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlashListAny
          key={`marketplace-${numColumns}`}
          data={filteredListings}
          keyExtractor={(item: any) => item.id}
          renderItem={renderListingItem}
          estimatedItemSize={320}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ORANGE}
              colors={[ORANGE]}
            />
          }
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : (
              <View style={styles.emptyStateContainer}>
                <Icon name="shopping-bag" size={40} color={themeColors.textMuted} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Listings Found</Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                  Be the first to list equipment or production locations for rent!
                </Text>
                {!isFan && (
                  <TouchableOpacity
                    style={styles.emptyCreateBtn}
                    onPress={() => setCreateModalVisible(true)}
                  >
                    <Text style={styles.emptyCreateBtnText}>Create Listing</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
        />
      )}

      <GearAlertsModal visible={alertsOpen} onClose={() => setAlertsOpen(false)} />

      {/* Create Listing Modal */}
      <CreateListingModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={fetchListings}
      />

      {/* Advanced Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={[styles.filterModalContent, { backgroundColor: themeColors.bgCard }]}>
            <View style={styles.filterHeaderRow}>
              <Text style={[styles.filterTitle, { color: themeColors.textPrimary }]}>Filter Listings</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Icon name="x" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>LOCATION / CITY</Text>
              <TextInput
                style={[styles.filterInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                placeholder="e.g. Hyderabad, Mumbai, Bangalore"
                placeholderTextColor={themeColors.textMuted}
                value={filters.location || ''}
                onChangeText={(text) => setFilters((f) => ({ ...f, location: text || undefined }))}
              />

              <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>CATEGORY</Text>
              <TextInput
                style={[styles.filterInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                placeholder="e.g. Camera, Optics, Lighting, Stage"
                placeholderTextColor={themeColors.textMuted}
                value={filters.category || ''}
                onChangeText={(text) => setFilters((f) => ({ ...f, category: text || undefined }))}
              />

              <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>PRICE RANGE (PER DAY)</Text>
              <View style={styles.priceInputRow}>
                <TextInput
                  style={[styles.filterInput, { flex: 1, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="Min ₹"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={filters.minPrice?.toString() || ''}
                  onChangeText={(text) =>
                    setFilters((f) => ({ ...f, minPrice: text ? parseFloat(text) : undefined }))
                  }
                />
                <Text style={{ color: themeColors.textSecondary }}>-</Text>
                <TextInput
                  style={[styles.filterInput, { flex: 1, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="Max ₹"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={filters.maxPrice?.toString() || ''}
                  onChangeText={(text) =>
                    setFilters((f) => ({ ...f, maxPrice: text ? parseFloat(text) : undefined }))
                  }
                />
              </View>
            </ScrollView>

            <View style={styles.filterBtnRow}>
              <TouchableOpacity
                style={[styles.resetFilterBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border, borderWidth: 1 }]}
                onPress={() => {
                  setFilters({});
                  setFilterModalVisible(false);
                }}
              >
                <Text style={[styles.resetFilterBtnText, { color: themeColors.textPrimary }]}>Reset All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyFilterBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.applyFilterBtnText}>Apply Filters →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  listContent: {
    paddingBottom: 40,
  },
  pageHeaderSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pageTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    color: INK,
    fontSize: 18.5,
    fontWeight: '900',
    fontFamily: 'Lora-Bold',
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 12,
  },
  createListingBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  createListingBtnText: {
    display: 'none',
  },
  searchFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: INK,
    fontSize: 13.5,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: ORANGE,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    gap: 4,
  },
  tabChip: {
    flexGrow: 1,
    flexShrink: 0,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  tabChipActive: {
    backgroundColor: ORANGE,
  },
  tabChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  tabChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabletGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
  },
  tabletCardWrapper: {
    width: '48.5%',
  },
  tabletCardWrapper3Col: {
    width: '32%',
  },
  webMarketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  webMarketCardTablet: {
    marginHorizontal: 0,
    marginBottom: 0,
    width: '100%',
  },
  cardImageWrapper: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageBadgesRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bundleBadge: {
    backgroundColor: '#9333EA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bundleBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  conditionBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  conditionBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  categoryBadge: {
    backgroundColor: 'rgba(13,13,13,0.75)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  wishlistHeartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(13,13,13,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerDeleteBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  cardBody: {
    padding: 14,
  },
  titleRatingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  listingTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    lineHeight: 18,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  ratingText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#D97706',
  },
  listingDesc: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  monoMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  monoPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  monoPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  priceFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '800',
  },
  priceNumber: {
    color: ORANGE,
    fontSize: 18,
    fontWeight: '900',
    marginHorizontal: 1,
  },
  perDayText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
  weeklyBadge: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  weeklyBadgeText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '800',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  emptyCreateBtn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 10,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: 400,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 6,
  },
  filterInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: INK,
    marginBottom: 8,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  resetFilterBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetFilterBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
  },
  applyFilterBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default MarketplaceScreen;
