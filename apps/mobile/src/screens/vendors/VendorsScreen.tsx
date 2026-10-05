import { orTerm } from '../../utils/postgrest';
import { CachedImage } from '../../components/common/CachedImage';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Modal,
  Switch,
  Alert,
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
import { RegisterVendorModal } from '../../components/modals/RegisterVendorModal';
import { VendorCard } from '../../components/vendors/VendorCard';
import { fetchWithCache, getCache } from '../../services/offlineCache';
import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

// ── Memoized Service Card (Native thread recycling) ──────────────────────────
interface VendorServiceCardItemProps {
  item: any;
  themeColors: any;
  isTablet: boolean;
  navigation: any;
}

const VendorServiceCardItem = React.memo(({ item, themeColors, isTablet, navigation }: VendorServiceCardItemProps) => {
  const vendorName = item.vendors?.business_name || 'Verified Vendor';
  const image = item.images?.[0] || item.vendors?.logo_url || null;
  const type = Array.isArray(item.production_types) && item.production_types.length ? String(item.production_types[0]) : 'Service';

  return (
    <TouchableOpacity
      style={[
        styles.svcCard,
        { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        isTablet && { marginHorizontal: 0, marginBottom: 0, width: '100%' },
      ]}
      activeOpacity={0.92}
      onPress={() =>
        navigation.navigate('VendorServiceDetail', {
          serviceId: item.id,
          serviceTitle: item.title,
          vendorId: item.vendor_id,
        })
      }
    >
      {/* Cover image with badges */}
      <View style={[styles.svcImageWrap, { backgroundColor: themeColors.chipBg }]}>
        {image ? <CachedImage uri={image} style={styles.svcImage} resizeMode="cover" /> : null}
        <View style={styles.svcBadgesRow}>
          {item.vendors?.is_verified ? (
            <View style={[styles.svcBadge, { backgroundColor: ORANGE }]}>
              <Text style={styles.svcBadgeText}>VERIFIED</Text>
            </View>
          ) : null}
          <View style={styles.svcBadge}>
            <Text style={styles.svcBadgeText}>{type.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Body */}
      <View style={styles.svcBody}>
        <Text style={[styles.svcTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={[styles.svcDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.svcMetaRow}>
          {item.coverage_area ? (
            <View style={[styles.svcMono, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
              <Text style={[styles.svcMonoText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                LOC // {item.coverage_area}
              </Text>
            </View>
          ) : null}
          <View style={[styles.svcMono, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
            <Text style={[styles.svcMonoText, { color: themeColors.textSecondary }]} numberOfLines={1}>
              VENDOR // {vendorName}
            </Text>
          </View>
          {item.crew_capacity ? (
            <View style={[styles.svcMono, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
              <Text style={[styles.svcMonoText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                CREW // UP TO {item.crew_capacity}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.svcFooter, { borderTopColor: themeColors.divider }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.svcCurrency}>₹</Text>
            <Text style={styles.svcPrice}>{item.day_rate ? item.day_rate.toLocaleString() : '0'}</Text>
            <Text style={[styles.svcPerDay, { color: themeColors.textSecondary }]}>/ Day</Text>
          </View>
          {item.min_booking_days && item.min_booking_days > 1 ? (
            <View style={styles.svcMin}>
              <Text style={styles.svcMinText}>Min {item.min_booking_days} days</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export const VendorsScreen = ({ navigation, embedded = false }: { navigation: any; embedded?: boolean }) => {
  const isOffline = useIsOffline();
  const { isTablet, isLandscape } = useResponsive();
  const { themeColors, isDark } = useUserSettings();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const [activeTab, setActiveTab] = useState<'vendors' | 'services'>('vendors');
  const [vendors, setVendors] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Filter state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [filterProductionType, setFilterProductionType] = useState<string>('all');
  const [filterMinCapacity, setFilterMinCapacity] = useState<string>('');

  const productionTypes = ['Feature Film', 'Commercial', 'Web Series', 'Documentary', 'Short Film'];

  const fetchVendors = useCallback(async () => {
    const cacheKey = `vendors_${filterVerifiedOnly}`;
    const cached = await getCache<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      setVendors(cached);
      setLoading(false);
    }

    try {
      await fetchWithCache(
        cacheKey,
        async () => {
          const supabase = getSupabaseClient();
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user;
          if (user) {
            setCurrentUserId(user.id);
          }

          let query = ((supabase as any).from('vendors') as any).select('*');
          if (filterVerifiedOnly) {
            query = query.eq('is_verified', true);
          }
          const { data, error } = await query.order('created_at', { ascending: false }).limit(25);

          return !error && data ? data : [];
        },
        {
          timeoutMs: 2500,
          onCacheHit: (data) => {
            if (data) setVendors(data);
          },
          onFreshData: (data) => {
            if (data && data.length > 0) setVendors(data);
          },
        }
      );
    } catch (e) {
      console.warn('[Vendors] Error fetching vendors:', e);
    } finally {
      setLoading(false);
    }
  }, [filterVerifiedOnly]);

  const fetchServices = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      let query = ((supabase as any).from('vendor_services') as any)
        .select(`
          *,
          vendors:vendor_id (
            id,
            business_name,
            logo_url,
            location,
            owner_id,
            is_verified
          )
        `)
        .eq('is_active', true);

      if (searchQuery) {
        query = query.or(`title.ilike.%${orTerm(searchQuery)}%,description.ilike.%${orTerm(searchQuery)}%`);
      }

      if (filterMinCapacity) {
        const minCap = parseInt(filterMinCapacity);
        if (!isNaN(minCap)) {
          query = query.gte('crew_capacity', minCap);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(25);
      if (!error && data) {
        setServices(data);
      }
    } catch (e) {
      console.warn('[Vendors] Error fetching services:', e);
    }
  }, [searchQuery, filterMinCapacity]);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (activeTab === 'vendors') {
      await fetchVendors();
    } else {
      await fetchServices();
    }
    setLoading(false);
  }, [activeTab, fetchVendors, fetchServices]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadData();
      });
      return () => task.cancel();
    }, [loadData])
  );

  useEffect(() => {

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('vendors-screen-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendors' },
        () => fetchVendors()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendor_services' },
        () => fetchServices()
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [loadData, fetchVendors, fetchServices]);

  useAutoRefreshOnReconnect(loadData);

  const handleDeleteVendor = (vendorId: string, ownerId: string) => {
    if (ownerId !== currentUserId) {
      Alert.alert('Permission Denied', 'You can only delete your own vendor profile.');
      return;
    }

    Alert.alert('Delete Vendor Profile', 'Are you sure you want to delete this vendor profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error } = await ((supabase as any).from('vendors') as any)
              .delete()
              .eq('id', vendorId);

            if (error) throw error;
            setVendors((prev) => prev.filter((v) => v.id !== vendorId));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete vendor.');
          }
        },
      },
    ]);
  };

  const filteredVendors = React.useMemo(() => {
    return vendors.filter((v) => {
      const query = searchQuery.toLowerCase();
      const matchesQuery =
        !query ||
        (v.business_name || '').toLowerCase().includes(query) ||
        (v.location || '').toLowerCase().includes(query) ||
        (v.description || '').toLowerCase().includes(query);

      return matchesQuery;
    });
  }, [vendors, searchQuery]);

  const filteredServices = React.useMemo(() => {
    return services.filter((s) => {
      if (filterProductionType !== 'all') {
        const prodTypes = Array.isArray(s.production_types)
          ? s.production_types
          : typeof s.production_types === 'string'
          ? [s.production_types]
          : [];
        if (!prodTypes.includes(filterProductionType)) return false;
      }
      return true;
    });
  }, [services, filterProductionType]);

  const renderServiceItem = useCallback(({ item: s }: { item: any }) => (
    <View style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}>
      <VendorServiceCardItem
        item={s}
        themeColors={themeColors}
        isTablet={isTablet}
        navigation={navigation}
      />
    </View>
  ), [isTablet, isLandscape, themeColors, navigation]);

  const renderVendorItem = useCallback(({ item: v }: { item: any }) => (
    <View style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}>
      <VendorCard
        vendor={v}
        style={isTablet && { marginHorizontal: 0, marginBottom: 0, width: '100%' }}
        canManage={v.owner_id === currentUserId}
        onDelete={() => handleDeleteVendor(v.id, v.owner_id)}
        onPress={() =>
          navigation.navigate('VendorDetail', {
            vendorId: v.id,
            vendorName: v.business_name,
            category: v.category,
            location: v.location,
            imageUrl: v.logo_url || v.images?.[0],
          })
        }
      />
    </View>
  ), [isTablet, isLandscape, currentUserId, navigation, handleDeleteVendor]);

  const hasActiveFilters =
    activeTab === 'vendors'
      ? filterVerifiedOnly
      : filterProductionType !== 'all' || !!filterMinCapacity;

  const renderHeader = useCallback(() => (
    <View style={styles.pageHeaderSection}>
      <View style={styles.pageHeaderRow}>
        {embedded ? (
          <View style={{ flex: 1 }} />
        ) : (
          <View style={styles.pageTitleGroup}>
            <Icon name="vendor" size={26} color={themeColors.textPrimary} />
            <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Vendor Directory</Text>
          </View>
        )}

        {!isFan && !isInternal && (
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => setRegisterModalVisible(true)}
            accessibilityLabel="Register Business"
          >
            <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      {!embedded && (
      <>
      <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
        Find film equipment rentals, studios, DI suites, and production services.
      </Text>

      {/* Shortcuts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, backgroundColor: themeColors.bgCard, borderColor: themeColors.border }}
            onPress={() => navigation.navigate('MyQuotes')}
          >
            <Icon name="file-text" size={13} color={themeColors.textSecondary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>Quotes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, backgroundColor: themeColors.bgCard, borderColor: themeColors.border }}
            onPress={() => navigation.navigate('SellerHub')}
          >
            <Icon name="shopping-bag" size={13} color={themeColors.textSecondary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>Seller Hub</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </>
      )}


      {isFan && (
        <View style={{ backgroundColor: isDark ? 'rgba(255, 75, 51, 0.1)' : '#FFF0ED', borderRadius: 8, padding: 10, marginTop: 8, marginBottom: 12, borderWidth: 1, borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="eye" size={14} color={ORANGE} />
          <Text style={{ flex: 1, fontSize: 11.5, color: themeColors.textSecondary }}>
            <Text style={{ fontWeight: '700', color: ORANGE }}>Fan Account (Viewer Mode):</Text> Vendor directory is available for browsing. Registering a rental business requires a Creator or Studio account.
          </Text>
        </View>
      )}

      {/* Web Underline Tabs Row */}
      <View style={[styles.tabUnderlineRow, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={[styles.tabUnderlineBtn, activeTab === 'vendors' && styles.tabUnderlineBtnActive]}
          onPress={() => setActiveTab('vendors')}
        >
          <Text
            style={[
              styles.tabUnderlineText,
              { color: activeTab === 'vendors' ? ORANGE : themeColors.textSecondary },
              activeTab === 'vendors' && styles.tabUnderlineTextActive,
            ]}
          >
            VENDOR DIRECTORY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabUnderlineBtn, activeTab === 'services' && styles.tabUnderlineBtnActive]}
          onPress={() => setActiveTab('services')}
        >
          <Text
            style={[
              styles.tabUnderlineText,
              { color: activeTab === 'services' ? ORANGE : themeColors.textSecondary },
              activeTab === 'services' && styles.tabUnderlineTextActive,
            ]}
          >
            SERVICE PACKAGES
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchFilterRow}>
        <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <Icon name="search" size={16} color={themeColors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
            placeholder={
              activeTab === 'vendors'
                ? 'Search equipment, services, or locations...'
                : 'Search service packages...'
            }
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

      {/* Web Industry Directory Section Title */}
      {activeTab === 'vendors' && (
        <View style={styles.sectionHeaderRow}>
          <Icon name="vendor" size={22} color={ORANGE} />
          <Text style={[styles.sectionHeaderTitle, { color: themeColors.textPrimary }]}>INDUSTRY DIRECTORY</Text>
        </View>
      )}
    </View>
  ), [themeColors, isFan, isInternal, isDark, activeTab, searchQuery, hasActiveFilters, navigation, embedded]);

  const numColumns = isTablet ? (isLandscape ? 3 : 2) : 1;

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      header={embedded ? undefined : (
        <Header
          showLogo={true}
          onSearchPress={() => navigation.navigate('Search')}
          onMessagesPress={() => navigation.navigate('Messages')}
          onNotificationPress={() => navigation.navigate('Notifications')}
          onProfilePress={() => navigation.navigate('Profile')}
        />
      )}
    >
      {loading ? (
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
      ) : activeTab === 'vendors' ? (
        <FlashListAny
          key={`vendors-list-${numColumns}`}
          data={filteredVendors}
          keyExtractor={(item: any) => item.id}
          renderItem={renderVendorItem}
          estimatedItemSize={280}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : (
              <View style={styles.emptyState}>
                <Icon name="truck" size={40} color={themeColors.textMuted} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Vendors Found</Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>Be the first to list your production rental house!</Text>
                {!isFan && (
                  <TouchableOpacity
                    style={styles.emptyRegisterBtn}
                    onPress={() => setRegisterModalVisible(true)}
                  >
                    <Text style={styles.emptyRegisterBtnText}>Register Business</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
        />
      ) : (
        <FlashListAny
          key={`services-list-${numColumns}`}
          data={filteredServices}
          keyExtractor={(item: any) => item.id}
          renderItem={renderServiceItem}
          estimatedItemSize={240}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : (
              <View style={styles.emptyState}>
                <Icon name="package" size={40} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No Service Packages</Text>
                <Text style={styles.emptySub}>No active service packages match your filter criteria.</Text>
              </View>
            )
          }
        />
      )}

      {/* Register Business Modal */}
      <RegisterVendorModal
        visible={registerModalVisible}
        onClose={() => setRegisterModalVisible(false)}
        onRegistered={loadData}
      />

      {/* Filter Modal */}
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
              <Text style={[styles.filterTitle, { color: themeColors.textPrimary }]}>
                Filter {activeTab === 'vendors' ? 'Vendors' : 'Service Packages'}
              </Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Icon name="x" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {activeTab === 'vendors' ? (
              <View style={[styles.switchRow, { borderBottomColor: themeColors.divider }]}>
                <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Verified Professionals Only</Text>
                <Switch
                  value={filterVerifiedOnly}
                  onValueChange={setFilterVerifiedOnly}
                  trackColor={{ false: themeColors.border, true: ORANGE }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>PRODUCTION TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.prodScroll}>
                  <TouchableOpacity
                    style={[
                      styles.prodChip,
                      { backgroundColor: themeColors.chipBg },
                      filterProductionType === 'all' && styles.prodChipActive,
                    ]}
                    onPress={() => setFilterProductionType('all')}
                  >
                    <Text
                      style={[
                        styles.prodChipText,
                        { color: themeColors.textSecondary },
                        filterProductionType === 'all' && styles.prodChipTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {productionTypes.map((pt) => (
                    <TouchableOpacity
                      key={pt}
                      style={[
                        styles.prodChip,
                        { backgroundColor: themeColors.chipBg },
                        filterProductionType === pt && styles.prodChipActive,
                      ]}
                      onPress={() => setFilterProductionType(pt)}
                    >
                      <Text
                        style={[
                          styles.prodChipText,
                          { color: themeColors.textSecondary },
                          filterProductionType === pt && styles.prodChipTextActive,
                        ]}
                      >
                        {pt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>MIN CREW CAPACITY</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="e.g. 20"
                  placeholderTextColor={themeColors.textMuted}
                  keyboardType="numeric"
                  value={filterMinCapacity}
                  onChangeText={setFilterMinCapacity}
                />
              </ScrollView>
            )}

            <View style={styles.filterBtnRow}>
              <TouchableOpacity
                style={[styles.resetFilterBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border, borderWidth: 1 }]}
                onPress={() => {
                  setFilterVerifiedOnly(false);
                  setFilterProductionType('all');
                  setFilterMinCapacity('');
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
  svcCard: { borderRadius: 20, marginHorizontal: 16, marginBottom: 14, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  svcImageWrap: { width: '100%', height: 180, position: 'relative' },
  svcImage: { width: '100%', height: '100%' },
  svcBadgesRow: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  svcBadge: { backgroundColor: 'rgba(13,13,13,0.75)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  svcBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
  svcBody: { padding: 14 },
  svcTitle: { fontSize: 14, fontWeight: '900', fontFamily: 'Lora-Bold', lineHeight: 18, marginBottom: 4 },
  svcDesc: { fontSize: 11.5, lineHeight: 16, marginBottom: 8 },
  svcMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  svcMono: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' },
  svcMonoText: { fontSize: 10, fontWeight: '800' },
  svcFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 8 },
  svcCurrency: { color: ORANGE, fontSize: 13, fontWeight: '800' },
  svcPrice: { color: ORANGE, fontSize: 18, fontWeight: '900', marginHorizontal: 1 },
  svcPerDay: { fontSize: 10, fontWeight: '700', marginLeft: 3 },
  svcMin: { backgroundColor: '#FFF7F5', borderWidth: 1, borderColor: '#FFE5DF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  svcMinText: { color: ORANGE, fontSize: 10, fontWeight: '800' },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
    marginBottom: 14,
  },
  registerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  registerBtnText: {
    display: 'none',
  },
  tabUnderlineRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 14,
    gap: 16,
  },
  tabUnderlineBtn: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabUnderlineBtnActive: {
    borderBottomColor: ORANGE,
  },
  tabUnderlineText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tabUnderlineTextActive: {
    color: ORANGE,
  },
  searchFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    letterSpacing: -0.2,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  serviceVendorName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  dayRateBadge: {
    alignItems: 'flex-end',
  },
  dayRateNum: {
    fontSize: 18,
    fontWeight: '900',
    color: ORANGE,
  },
  dayRateLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  serviceDesc: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 10,
  },
  servicePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  servicePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: ORANGE,
  },
  serviceFooterBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceFooterBtnText: {
    color: INK,
    fontSize: 12.5,
    fontWeight: '800',
  },
  emptyState: {
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
  emptyRegisterBtn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 10,
  },
  emptyRegisterBtnText: {
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
    maxHeight: 350,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
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
  prodScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  prodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  prodChipActive: {
    backgroundColor: ORANGE,
  },
  prodChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  prodChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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

export default VendorsScreen;
