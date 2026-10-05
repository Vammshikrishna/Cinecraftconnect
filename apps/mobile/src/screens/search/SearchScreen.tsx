import { orTerm } from '../../utils/postgrest';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { ExploreCard, ExploreItem, ExploreItemType } from '../../components/search/ExploreCard';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useResponsive } from '../../hooks/useResponsive';
import { useAccountType } from '../../hooks/useAccountType';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const CATEGORIES: { id: string; label: string; type?: ExploreItemType }[] = [
  { id: 'all', label: 'All' },
  { id: 'projects', label: 'Projects', type: 'project' },
  { id: 'people', label: 'People', type: 'user' },
  { id: 'discussions', label: 'Discussions', type: 'discussion' },
  { id: 'posts', label: 'Posts', type: 'post' },
  { id: 'vendors', label: 'Vendors', type: 'vendor' },
  { id: 'marketplace', label: 'Marketplace', type: 'marketplace' },
  { id: 'companies', label: 'Companies', type: 'company' },
];

export const SearchScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isFan } = useAccountType();
  const { width, isTablet, isLandscape } = useResponsive();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [exploreItems, setExploreItems] = useState<ExploreItem[]>([]);
  const [searchResults, setSearchResults] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const visibleCategories = useMemo(() => {
    return CATEGORIES.filter((c) => {
      if (isFan && ['projects', 'vendors', 'marketplace', 'companies'].includes(c.id)) {
        return false;
      }
      return true;
    });
  }, [isFan]);

  const fetchExploreItems = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      const promises = [
        ((supabase as any).from('projects') as any)
          .select('id, title, description, status, location, genre, image_url')
          .limit(12),
        ((supabase as any).from('profiles') as any)
          .select('id, username, full_name, avatar_url, is_verified, craft, bio')
          .limit(12),
        ((supabase as any).from('discussion_rooms') as any)
          .select('id, title, description')
          .limit(12),
        ((supabase as any).from('posts') as any)
          .select(
            'id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name, is_verified)'
          )
          .order('created_at', { ascending: false })
          .limit(20),
        ((supabase as any).from('vendors') as any)
          .select('id, business_name, description, logo_url, city, location, category')
          .limit(12),
        ((supabase as any).from('marketplace_listings') as any)
          .select('id, title, description, images, price_per_day, listing_type, location')
          .limit(12),
        ((supabase as any).from('company_pages') as any)
          .select('id, name, description, tagline, headquarters, logo_url, cover_image_url')
          .limit(12),
      ];

      const resList = await Promise.allSettled(promises);

      const items: ExploreItem[] = [];

      const getData = (res: any) => {
        if (res.status === 'fulfilled' && res.value?.data) return res.value.data;
        return null;
      };

      const projects = getData(resList[0]);
      const users = getData(resList[1]);
      const discussions = getData(resList[2]);
      const posts = getData(resList[3]);
      const vendors = getData(resList[4]);
      const marketplace = getData(resList[5]);
      const companies = getData(resList[6]);

      if (projects)
        items.push(
          ...projects.map((p: any) => ({
            id: p.id,
            type: 'project' as const,
            title: p.title,
            name: p.title,
            description: p.description,
            location: p.location,
            status: p.status,
            image_url: p.image_url,
          }))
        );

      if (users)
        items.push(
          ...users.map((u: any) => ({
            id: u.id,
            type: 'user' as const,
            username: u.username,
            full_name: u.full_name,
            avatar_url: u.avatar_url,
            is_verified: u.is_verified,
            craft: u.craft,
            description: u.bio,
          }))
        );

      if (discussions)
        items.push(
          ...discussions.map((d: any) => ({
            id: d.id,
            type: 'discussion' as const,
            title: d.title,
            description: d.description,
          }))
        );

      if (posts)
        items.push(
          ...posts.map((p: any) => ({
            id: p.id,
            type: 'post' as const,
            content: p.content,
            image_url: p.media_type === 'image' ? p.media_url : undefined,
            video_url: p.media_type === 'video' ? p.media_url : undefined,
            like_count: p.like_count || 0,
            comment_count: p.comment_count || 0,
            author: Array.isArray(p.author) ? p.author[0] : p.author,
          }))
        );

      if (vendors)
        items.push(
          ...vendors.map((v: any) => ({
            id: v.id,
            type: 'vendor' as const,
            business_name: v.business_name,
            description: v.description,
            logo_url: v.logo_url,
            category: v.category,
            city: v.city || v.location,
          }))
        );

      if (marketplace)
        items.push(
          ...marketplace.map((m: any) => ({
            id: m.id,
            type: 'marketplace' as const,
            title: m.title,
            description: m.description,
            image_url: m.images?.[0],
            price_per_day: m.price_per_day,
            listing_type: m.listing_type,
            location: m.location,
          }))
        );

      if (companies)
        items.push(
          ...companies.map((c: any) => ({
            id: c.id,
            type: 'company' as const,
            name: c.name,
            description: c.description || c.tagline,
            logo_url: c.logo_url,
            location: c.headquarters,
          }))
        );

      setExploreItems(items.sort(() => Math.random() - 0.5));
    } catch (e) {
      console.warn('Fetch explore items error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const safe = searchQuery.trim();

      const promises = [
        ((supabase as any).from('projects') as any)
          .select('id, title, description, status, location, image_url')
          .or(`title.ilike.%${orTerm(safe)}%,description.ilike.%${orTerm(safe)}%`)
          .limit(10),
        ((supabase as any).from('profiles') as any)
          .select('id, username, full_name, avatar_url, is_verified, craft, bio')
          .or(`full_name.ilike.%${orTerm(safe)}%,username.ilike.%${orTerm(safe)}%,craft.ilike.%${orTerm(safe)}%`)
          .limit(10),
        ((supabase as any).from('discussion_rooms') as any)
          .select('id, title, description')
          .or(`title.ilike.%${orTerm(safe)}%,description.ilike.%${orTerm(safe)}%`)
          .limit(10),
        ((supabase as any).from('posts') as any)
          .select(
            'id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name, is_verified)'
          )
          .ilike('content', `%${safe}%`)
          .limit(10),
        ((supabase as any).from('vendors') as any)
          .select('id, business_name, description, logo_url, city, location, category')
          .or(`business_name.ilike.%${orTerm(safe)}%,description.ilike.%${orTerm(safe)}%`)
          .limit(10),
        ((supabase as any).from('marketplace_listings') as any)
          .select('id, title, description, images, price_per_day, listing_type, location')
          .or(`title.ilike.%${orTerm(safe)}%,description.ilike.%${orTerm(safe)}%`)
          .limit(10),
        ((supabase as any).from('company_pages') as any)
          .select('id, name, description, tagline, headquarters, logo_url, cover_image_url')
          .or(`name.ilike.%${orTerm(safe)}%,tagline.ilike.%${orTerm(safe)}%`)
          .limit(10),
      ];

      const resList = await Promise.allSettled(promises);
      const items: ExploreItem[] = [];

      const getData = (res: any) => {
        if (res.status === 'fulfilled' && res.value?.data) return res.value.data;
        return null;
      };

      const projects = getData(resList[0]);
      const users = getData(resList[1]);
      const discussions = getData(resList[2]);
      const posts = getData(resList[3]);
      const vendors = getData(resList[4]);
      const marketplace = getData(resList[5]);
      const companies = getData(resList[6]);

      if (projects)
        items.push(
          ...projects.map((p: any) => ({
            id: p.id,
            type: 'project' as const,
            title: p.title,
            description: p.description,
            location: p.location,
            status: p.status,
            image_url: p.image_url,
          }))
        );

      if (users)
        items.push(
          ...users.map((u: any) => ({
            id: u.id,
            type: 'user' as const,
            username: u.username,
            full_name: u.full_name,
            avatar_url: u.avatar_url,
            is_verified: u.is_verified,
            craft: u.craft,
            description: u.bio,
          }))
        );

      if (discussions)
        items.push(
          ...discussions.map((d: any) => ({
            id: d.id,
            type: 'discussion' as const,
            title: d.title,
            description: d.description,
          }))
        );

      if (posts)
        items.push(
          ...posts.map((p: any) => ({
            id: p.id,
            type: 'post' as const,
            content: p.content,
            image_url: p.media_type === 'image' ? p.media_url : undefined,
            video_url: p.media_type === 'video' ? p.media_url : undefined,
            like_count: p.like_count || 0,
            comment_count: p.comment_count || 0,
            author: Array.isArray(p.author) ? p.author[0] : p.author,
          }))
        );

      if (vendors)
        items.push(
          ...vendors.map((v: any) => ({
            id: v.id,
            type: 'vendor' as const,
            business_name: v.business_name,
            description: v.description,
            logo_url: v.logo_url,
            category: v.category,
            city: v.city || v.location,
          }))
        );

      if (marketplace)
        items.push(
          ...marketplace.map((m: any) => ({
            id: m.id,
            type: 'marketplace' as const,
            title: m.title,
            description: m.description,
            image_url: m.images?.[0],
            price_per_day: m.price_per_day,
            listing_type: m.listing_type,
            location: m.location,
          }))
        );

      if (companies)
        items.push(
          ...companies.map((c: any) => ({
            id: c.id,
            type: 'company' as const,
            name: c.name,
            description: c.description || c.tagline,
            logo_url: c.logo_url,
            location: c.headquarters,
          }))
        );

      setSearchResults(items);
    } catch (e) {
      console.warn('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchExploreItems();
      });
      return () => {
        task.cancel();
      };
    }, [fetchExploreItems])
  );

  useEffect(() => {
    const delayFn = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query);
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayFn);
  }, [query, performSearch]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (query.trim().length >= 2) {
      await performSearch(query);
    } else {
      await fetchExploreItems();
    }
    setRefreshing(false);
  };

  const rawList = query.trim().length >= 2 ? searchResults : exploreItems;

  const targetType = useMemo(() => {
    return CATEGORIES.find((c) => c.id === activeCategory)?.type;
  }, [activeCategory]);

  const filteredList = useMemo(() => {
    return activeCategory === 'all'
      ? rawList
      : rawList.filter((item) => item.type === targetType);
  }, [activeCategory, rawList, targetType]);

  const maxContainerWidth = 1280;
  const effectiveWidth = Math.min(width, maxContainerWidth);
  const numCols = isTablet ? (isLandscape ? 4 : 3) : 2;
  const horizontalPadding = isTablet ? (isLandscape ? 24 : 20) : 16;
  const gridGap = isTablet ? (isLandscape ? 16 : 14) : 12;
  const cardHeight = isTablet ? (isLandscape ? 245 : 235) : 225;

  const renderExploreCard = useCallback(({ item }: { item: ExploreItem }) => {
    return (
      <View style={{ flex: 1, padding: gridGap / 2 }}>
        <ExploreCard
          item={item}
          navigation={navigation}
          cardWidth="100%"
          cardHeight={cardHeight}
        />
      </View>
    );
  }, [navigation, gridGap, cardHeight]);

  const listHeader = useMemo(() => (
    <View style={[styles.mainWrapper, isTablet && { maxWidth: maxContainerWidth, width: '100%', alignSelf: 'center' }]}>
      {/* Search Input Bar */}
      <View
        style={[
          styles.searchBarBox,
          {
            backgroundColor: themeColors.inputBg,
            borderColor: themeColors.border,
            marginHorizontal: horizontalPadding,
            height: isTablet ? 48 : 44,
            borderRadius: isTablet ? 14 : 12,
          },
        ]}
      >
        <Icon name="search" size={isTablet ? 20 : 18} color={themeColors.textMuted} />
        <TextInput
          style={[styles.input, { color: themeColors.textPrimary, fontSize: isTablet ? 14.5 : 13.5 }]}
          placeholder={isFan ? "Search people, posts, discussions..." : "Search creators, films, crew jobs, gear, companies..."}
          placeholderTextColor={themeColors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Icon name="x" size={16} color={themeColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Chips Scroll */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipsScroll, { paddingHorizontal: horizontalPadding }]}
        >
          {visibleCategories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.chip,
                  { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                  isTablet && styles.chipTablet,
                  isActive && styles.chipActive,
                ]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: themeColors.textSecondary },
                    isTablet && styles.chipTextTablet,
                    isActive && styles.chipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  ), [
    isTablet,
    maxContainerWidth,
    themeColors,
    horizontalPadding,
    isFan,
    query,
    visibleCategories,
    activeCategory,
  ]);

  const listEmpty = useMemo(() => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Searching ecosystem...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyCenter}>
        <Icon name="compass" size={44} color={themeColors.textMuted} />
        <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>
          {query ? `No results for "${query}"` : 'No Explore Items'}
        </Text>
        <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
          {query
            ? 'Try a different search query or select another category.'
            : 'Refresh or explore other content categories.'}
        </Text>
      </View>
    );
  }, [loading, refreshing, themeColors, query]);

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      header={
        <Header
          title="Explore & Discover"
          showLogo={false}
          showNotifications={false}
          showMessages={false}
          onBack={() => navigation.goBack()}
        />
      }
    >
      <FlashListAny
        key={`explore-grid-${numCols}`}
        data={filteredList}
        renderItem={renderExploreCard}
        keyExtractor={(item: ExploreItem) => `${item.type}-${item.id}`}
        numColumns={numCols}
        estimatedItemSize={235}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding - gridGap / 2,
          paddingBottom: 30,
        }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} />}
      />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  input: {
    flex: 1,
    color: INK,
    fontSize: 13.5,
    padding: 0,
  },
  chipsContainer: {
    marginBottom: 10,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  chipTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  chipActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  chipText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  chipTextTablet: {
    fontSize: 13,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  gridContent: {
    paddingBottom: 40,
  },
  loadingCenter: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  emptyCenter: {
    paddingVertical: 80,
    alignItems: 'center',
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
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
});

export default SearchScreen;
