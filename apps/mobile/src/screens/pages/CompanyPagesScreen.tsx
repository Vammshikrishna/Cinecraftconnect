import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Switch,
  InteractionManager,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { CardSkeleton } from '../../components/common/Skeleton';
import { CreateCompanyPageModal } from '../../components/modals/CreateCompanyPageModal';
import { CompanyPageCard } from '../../components/pages/CompanyPageCard';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const CompanyPagesScreen = ({ navigation }: { navigation: any }) => {
  const isOffline = useIsOffline();
  const { isTablet, isLandscape } = useResponsive();
  const { themeColors, isDark } = useUserSettings();
  const { isStudio, isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const [pages, setPages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  // Filter state
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [filterCompanySize, setFilterCompanySize] = useState<string>('');

  const companySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      let query = ((supabase as any).from('company_pages') as any).select('*');
      if (filterVerifiedOnly) {
        query = query.eq('is_verified', true);
      }
      if (filterCompanySize) {
        query = query.eq('company_size', filterCompanySize);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(25);

      if (!error && data) {
        setPages(data);
      }
    } catch (e) {
      console.warn('[CompanyPages] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [filterVerifiedOnly, filterCompanySize]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchPages();
      });
      return () => task.cancel();
    }, [fetchPages])
  );

  useEffect(() => {

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('company-pages-screen-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'company_pages' },
        () => fetchPages()
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [fetchPages]);

  const filteredPages = React.useMemo(() => {
    return pages.filter((p) => {
      if (!p) return false;
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      const name = (p.name || '').toLowerCase();
      const tagline = (p.tagline || '').toLowerCase();
      const headquarters = (p.headquarters || '').toLowerCase();
      let industryStr = '';
      if (Array.isArray(p.industry)) {
        industryStr = p.industry.join(' ').toLowerCase();
      } else if (typeof p.industry === 'string') {
        industryStr = p.industry.toLowerCase();
      }

      return (
        name.includes(query) ||
        tagline.includes(query) ||
        headquarters.includes(query) ||
        industryStr.includes(query)
      );
    });
  }, [pages, searchQuery]);

  const hasActiveFilters = filterVerifiedOnly || !!filterCompanySize;

  const renderPageItem = useCallback(({ item: p }: { item: any }) => (
    <View style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}>
      <CompanyPageCard
        page={p}
        style={isTablet && { marginHorizontal: 0, marginBottom: 0, width: '100%' }}
        onPress={() =>
          navigation.navigate('CompanyPageDetail', {
            pageId: p.id,
            pageSlug: p.slug,
            pageName: p.name,
          })
        }
      />
    </View>
  ), [isTablet, isLandscape, navigation]);

  const renderHeader = useCallback(() => (
    <View style={styles.pageHeaderSection}>
      <View style={styles.pageHeaderRow}>
        <View style={styles.pageTitleGroup}>
          <Icon name="company" size={26} color={themeColors.textPrimary} />
          <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>Companies</Text>
        </View>

        {isStudio && !isInternal && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setCreateModalVisible(true)}
            accessibilityLabel="Create a Page"
          >
            <Icon name="plus" size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
        Explore film studios, production houses, and equipment rentals.
      </Text>

      {/* Search & Filter Bar */}
      <View style={styles.searchFilterRow}>
        <View style={[styles.searchBox, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
          <Icon name="search" size={16} color={themeColors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
            placeholder="Search pages by name, location, or industry..."
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

      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <Icon name="company" size={22} color={ORANGE} />
        <Text style={[styles.sectionHeaderTitle, { color: themeColors.textPrimary }]}>
          {searchQuery ? `Results for "${searchQuery}"` : 'INDUSTRY DIRECTORY'}
        </Text>
      </View>
    </View>
  ), [themeColors, isStudio, isInternal, searchQuery, hasActiveFilters]);

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
      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          {renderHeader()}
          <View style={isTablet ? styles.tabletGridContainer : { paddingHorizontal: 16, gap: 14 }}>
            <View style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}><CardSkeleton /></View>
            <View style={isTablet ? (isLandscape ? styles.tabletCardWrapper3Col : styles.tabletCardWrapper) : undefined}><CardSkeleton /></View>
            {isTablet && isLandscape && (
              <View style={styles.tabletCardWrapper3Col}><CardSkeleton /></View>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlashListAny
          key={`company-pages-${numColumns}`}
          data={filteredPages}
          keyExtractor={(item: any) => item.id}
          renderItem={renderPageItem}
          estimatedItemSize={140}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : (
              <View style={styles.emptyState}>
                <Icon name="company" size={40} color={themeColors.textMuted} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
                  {searchQuery ? 'No Pages Match Search' : 'No Company Pages Yet'}
                </Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                  {searchQuery
                    ? 'Try a different search query or reset active filters.'
                    : 'Establish your organization’s presence in our production ecosystem!'}
                </Text>
                {isStudio && !searchQuery && (
                  <TouchableOpacity
                    style={styles.emptyCreateBtn}
                    onPress={() => setCreateModalVisible(true)}
                  >
                    <Text style={styles.emptyCreateBtnText}>Create a Page</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
        />
      )}

      {/* Create Company Page Modal */}
      <CreateCompanyPageModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={fetchPages}
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
              <Text style={[styles.filterTitle, { color: themeColors.textPrimary }]}>Filter Companies</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Icon name="x" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.switchRow, { borderBottomColor: themeColors.divider }]}>
                <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Verified Only</Text>
                <Switch
                  value={filterVerifiedOnly}
                  onValueChange={setFilterVerifiedOnly}
                  trackColor={{ false: themeColors.border, true: ORANGE }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <Text style={[styles.filterLabel, { color: themeColors.textSecondary }]}>COMPANY SIZE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity
                  style={[
                    styles.sizeChip,
                    { backgroundColor: themeColors.chipBg },
                    !filterCompanySize && styles.sizeChipActive,
                  ]}
                  onPress={() => setFilterCompanySize('')}
                >
                  <Text style={[styles.sizeChipText, { color: themeColors.textSecondary }, !filterCompanySize && styles.sizeChipTextActive]}>
                    Any Size
                  </Text>
                </TouchableOpacity>
                {companySizes.map((sz) => (
                  <TouchableOpacity
                    key={sz}
                    style={[
                      styles.sizeChip,
                      { backgroundColor: themeColors.chipBg },
                      filterCompanySize === sz && styles.sizeChipActive,
                    ]}
                    onPress={() => setFilterCompanySize(sz)}
                  >
                    <Text style={[styles.sizeChipText, { color: themeColors.textSecondary }, filterCompanySize === sz && styles.sizeChipTextActive]}>
                      {sz}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            <View style={styles.filterBtnRow}>
              <TouchableOpacity
                style={[styles.resetFilterBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border, borderWidth: 1 }]}
                onPress={() => {
                  setFilterVerifiedOnly(false);
                  setFilterCompanySize('');
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
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  createBtnText: {
    display: 'none',
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
    maxHeight: 300,
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
    paddingVertical: 10,
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
    marginTop: 10,
    marginBottom: 6,
  },
  chipScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  sizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  sizeChipActive: {
    backgroundColor: ORANGE,
  },
  sizeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  sizeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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

export default CompanyPagesScreen;
