import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SEARCH_CRAFTS,
  suggest,
  listSavedSearches,
  saveSearch,
  deleteSavedSearch,
  type SavedSearch,
  type SearchSuggestion,
  interleaveSections,
  isSearchable,
  pushRecentSearch,
  runSearch,
  visibleSearchCategories,
  SEARCH_TYPE_LABEL,
  type SearchCategoryId,
  type SearchSort,
} from '@cinecraft/core';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { ExploreCard, ExploreItem } from '../../components/search/ExploreCard';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useResponsive } from '../../hooks/useResponsive';
import { useAccountType } from '../../hooks/useAccountType';
import { getCurrentUserIdSync, resolveCurrentUserId } from '../../services/offlineCache';
import { FlashList } from '@shopify/flash-list';
import { friendlyError } from '@cinecraft/core';
const FlashListAny = FlashList as any;

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';
const PAGE_SIZE = 24;
const DEBOUNCE_MS = 350;

const recentKey = (userId: string | null) => `recent_searches_${userId || 'guest'}`;

export const SearchScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isFan, loading: accountLoading } = useAccountType();
  const { width, isTablet, isLandscape } = useResponsive();

  const initialQuery: string = route?.params?.query || route?.params?.q || '';
  const [input, setInput] = useState(initialQuery);
  const [term, setTerm] = useState(initialQuery); // the debounced input: what is actually searched
  const [activeCategory, setActiveCategory] = useState<SearchCategoryId>((route?.params?.category as SearchCategoryId) || 'all');
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [craft, setCraft] = useState('');
  const [listingType, setListingType] = useState<'' | 'equipment' | 'location'>('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [savedUnavailable, setSavedUnavailable] = useState(false);

  const [items, setItems] = useState<ExploreItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retry, setRetry] = useState(0);

  const [userId, setUserId] = useState<string | null>(getCurrentUserIdSync());
  const [recents, setRecents] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const requestId = useRef(0);

  const searching = isSearchable(term);
  const effectiveTerm = searching ? term : '';
  const tooShort = input.trim().length > 0 && !isSearchable(input);

  // another screen can open Search with a term (a #tag, a location, an @mention) even while it is already open
  const paramQuery: string | undefined = route?.params?.query || route?.params?.q;
  useEffect(() => {
    if (paramQuery) { setInput(paramQuery); setTerm(paramQuery); }
  }, [paramQuery]);

  const visibleCategories = useMemo(() => visibleSearchCategories(isFan), [isFan]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = userId || (await resolveCurrentUserId());
      if (!alive) return;
      setUserId(id);
      const raw = await AsyncStorage.getItem(recentKey(id)).catch(() => null);
      if (alive && raw) { try { setRecents(JSON.parse(raw)); } catch { /* ignore a corrupt value */ } }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // debounce: what is typed becomes what is searched
  useEffect(() => {
    const t = setTimeout(() => setTerm(input), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  // a category a fan cannot see must not stay selected
  useEffect(() => {
    if (!visibleCategories.some((c) => c.id === activeCategory)) setActiveCategory('all');
  }, [visibleCategories, activeCategory]);

  const load = useCallback(async (offset: number, mode: 'initial' | 'more' | 'refresh' = 'initial') => {
    const id = ++requestId.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'more') setLoadingMore(true);
    try {
      const out = await runSearch({
        client: getSupabaseClient(),
        query: effectiveTerm,
        category: activeCategory,
        isFan,
        meId: userId,
        sort,
        verifiedOnly,
        craft: craft || undefined,
        listingType: listingType || undefined,
        limit: PAGE_SIZE,
        offset,
        perTypeLimit: searching ? 6 : 8,
      });
      if (id !== requestId.current) return; // a newer search started: ignore this late answer
      const list = (activeCategory === 'all' && !searching ? interleaveSections(out.sections) : out.items) as ExploreItem[];
      if (offset === 0) setItems(list);
      else setItems((prev) => {
        const seen = new Set(prev.map((p) => `${p.type}-${p.id}`));
        return [...prev, ...list.filter((i) => !seen.has(`${i.type}-${i.id}`))];
      });
      setHasMore(out.hasMore);
      setFailed(out.failed);
    } catch (e) {
      if (id !== requestId.current) return;
      console.warn('[Search] failed:', e);
      setFailed(['post']);
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false); setRefreshing(false); }
    }
  }, [effectiveTerm, searching, activeCategory, isFan, userId, sort, verifiedOnly, craft, listingType]);

  // wait for the account type so a fan is not briefly treated as a creator (that caused a second load)
  useEffect(() => {
    if (accountLoading) return;
    load(0);
  }, [load, accountLoading, retry]);

  // remember searches that were actually used
  useEffect(() => {
    if (!searching || loading) return;
    setRecents((prev) => {
      const next = pushRecentSearch(prev, term);
      if (next !== prev) AsyncStorage.setItem(recentKey(userId), JSON.stringify(next)).catch(() => { });
      return next;
    });
  }, [searching, loading, term]); // eslint-disable-line react-hooks/exhaustive-deps

  // filters that belong to one tab must not stay active (invisibly) when the tab changes
  useEffect(() => {
    if (activeCategory !== 'people' && craft) setCraft('');
    if (activeCategory !== 'marketplace' && listingType) setListingType('');
  }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // a few suggestions while typing (names that start with what was typed)
  useEffect(() => {
    if (!focused || !isSearchable(input)) { setSuggestions([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const list = await suggest(getSupabaseClient(), input, isFan);
      if (!cancelled) setSuggestions(list);
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [input, focused, isFan]);

  const refreshSaved = useCallback(async () => {
    const out = await listSavedSearches(getSupabaseClient(), userId);
    setSaved(out.items);
    setSavedUnavailable(out.unavailable);
  }, [userId]);
  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  const alreadySaved = saved.some((x) => x.query.toLowerCase() === term.toLowerCase() && x.category === activeCategory);
  const saveCurrent = async () => {
    if (!userId || !searching) return;
    try {
      await saveSearch(getSupabaseClient(), userId, { name: term, query: term, category: activeCategory, filters: { sort, verifiedOnly, craft: craft || undefined, listingType: listingType || undefined } });
      refreshSaved();
      Alert.alert('Search saved', 'Find it under Saved when you tap the search box.');
    } catch (e: any) {
      Alert.alert('Could not save this search', friendlyError(e, 'Please try again.'));
    }
  };
  const runSaved = (sv: SavedSearch) => {
    setActiveCategory(sv.category);
    setSort(sv.filters.sort || 'relevance');
    setVerifiedOnly(!!sv.filters.verifiedOnly);
    setCraft(sv.filters.craft || '');
    setListingType(sv.filters.listingType || '');
    setInput(sv.query); setTerm(sv.query); setFocused(false); Keyboard.dismiss();
  };
  const removeSaved = async (id: string) => {
    try { await deleteSavedSearch(getSupabaseClient(), id); setSaved((prev) => prev.filter((x) => x.id !== id)); }
    catch (e: any) { Alert.alert('Could not remove', friendlyError(e, 'Please try again.')); }
  };
  const pickSuggestion = (sg: SearchSuggestion) => { setInput(sg.label); setTerm(sg.label); setFocused(false); Keyboard.dismiss(); };

  const onRefresh = () => { setRefreshing(true); load(0, 'refresh'); };
  const onEndReached = () => { if (hasMore && !loading && !loadingMore && activeCategory !== 'all') load(items.length, 'more'); };

  const clearInput = () => { setInput(''); setTerm(''); };
  const pickRecent = (q: string) => { setInput(q); setTerm(q); setFocused(false); Keyboard.dismiss(); };
  const removeRecent = (q: string) => {
    const next = recents.filter((r) => r !== q);
    setRecents(next);
    AsyncStorage.setItem(recentKey(userId), JSON.stringify(next)).catch(() => { });
  };
  const clearRecents = () => { setRecents([]); AsyncStorage.removeItem(recentKey(userId)).catch(() => { }); };

  const maxContainerWidth = 1280;
  const numCols = isTablet ? (isLandscape ? 4 : 3) : 2;
  const horizontalPadding = isTablet ? (isLandscape ? 24 : 20) : 16;
  const gridGap = isTablet ? (isLandscape ? 16 : 14) : 12;
  const cardHeight = isTablet ? (isLandscape ? 245 : 235) : 225;

  const renderExploreCard = useCallback(({ item }: { item: ExploreItem }) => (
    <View style={{ flex: 1, padding: gridGap / 2 }}>
      <ExploreCard item={item} navigation={navigation} cardWidth="100%" cardHeight={cardHeight} />
    </View>
  ), [navigation, gridGap, cardHeight]);

  const showFilters = searching || activeCategory === 'people' || activeCategory === 'vendors' || activeCategory === 'marketplace';
  const mutedBorder = themeColors.border;

  const listHeader = (
    <View style={[styles.mainWrapper, isTablet && { maxWidth: maxContainerWidth, width: '100%', alignSelf: 'center' }]}>
      <View
        style={[
          styles.searchBarBox,
          { backgroundColor: themeColors.inputBg, borderColor: mutedBorder, marginHorizontal: horizontalPadding, height: isTablet ? 48 : 46, borderRadius: isTablet ? 14 : 12 },
          isTablet && { maxWidth: 672, width: '100%', alignSelf: 'center' },
        ]}
      >
        <Icon name="search" size={isTablet ? 20 : 18} color={themeColors.iconMuted} />
        <TextInput
          style={[styles.input, { color: themeColors.textPrimary, fontSize: isTablet ? 15 : 14.5 }]}
          placeholder={isFan ? 'Search people, posts, discussions…' : 'Search creators, projects, gear, companies…'}
          placeholderTextColor={themeColors.textMuted}
          value={input}
          onChangeText={setInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search"
        />
        {input.length > 0 && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={clearInput}>
            <Icon name="x" size={16} color={themeColors.iconSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {tooShort && (
        <Text style={[styles.hint, { color: themeColors.textSecondary, marginHorizontal: horizontalPadding }]}>Type at least 2 characters to search.</Text>
      )}

      {focused && !!input && suggestions.length > 0 && (
        <View style={[styles.recentBox, { backgroundColor: themeColors.bgCard, borderColor: mutedBorder, marginHorizontal: horizontalPadding }]}>
          {suggestions.map((sg) => (
            <TouchableOpacity key={`${sg.type}-${sg.id}`} style={styles.recentMain} onPress={() => pickSuggestion(sg)} accessibilityRole="button" accessibilityLabel={`Search ${sg.label}`}>
              <Icon name={sg.type === 'user' ? 'user' : sg.type === 'job' || sg.type === 'company' ? 'briefcase' : sg.type === 'project' ? 'film' : 'search'} size={14} color={themeColors.iconMuted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{sg.label}</Text>
                {!!sg.sublabel && <Text style={{ color: themeColors.textMuted, fontSize: 12 }} numberOfLines={1}>{sg.sublabel}</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {focused && !input && saved.length > 0 && (
        <View style={[styles.recentBox, { backgroundColor: themeColors.bgCard, borderColor: mutedBorder, marginHorizontal: horizontalPadding }]}>
          <View style={styles.recentHeader}><Text style={[styles.recentTitle, { color: themeColors.textSecondary }]}>Saved</Text></View>
          {saved.map((sv) => (
            <View key={sv.id} style={styles.recentRow}>
              <TouchableOpacity style={styles.recentMain} onPress={() => runSaved(sv)} accessibilityRole="button" accessibilityLabel={`Run saved search ${sv.name}`}>
                <Icon name="bookmark" size={14} color={ORANGE} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 14, flex: 1 }} numberOfLines={1}>{sv.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeSaved(sv.id)} accessibilityRole="button" accessibilityLabel={`Remove saved search ${sv.name}`} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.recentRemove}>
                <Icon name="x" size={14} color={themeColors.iconMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {focused && !input && recents.length > 0 && (
        <View style={[styles.recentBox, { backgroundColor: themeColors.bgCard, borderColor: mutedBorder, marginHorizontal: horizontalPadding }]}>
          <View style={styles.recentHeader}>
            <Text style={[styles.recentTitle, { color: themeColors.textSecondary }]}>Recent</Text>
            <TouchableOpacity onPress={clearRecents} accessibilityRole="button" accessibilityLabel="Clear all recent searches" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '700' }}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recents.map((r) => (
            <View key={r} style={styles.recentRow}>
              <TouchableOpacity style={styles.recentMain} onPress={() => pickRecent(r)} accessibilityRole="button" accessibilityLabel={`Search ${r}`}>
                <Icon name="clock" size={14} color={themeColors.iconMuted} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 14, flex: 1 }} numberOfLines={1}>{r}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeRecent(r)} accessibilityRole="button" accessibilityLabel={`Remove ${r}`} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.recentRemove}>
                <Icon name="x" size={14} color={themeColors.iconMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipsScroll, { paddingHorizontal: horizontalPadding }, isTablet && { flexGrow: 1, justifyContent: 'center' }]}>
          {visibleCategories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, { backgroundColor: themeColors.bgCard, borderColor: mutedBorder }, isTablet && styles.chipTablet, isActive && styles.chipActive]}
                onPress={() => setActiveCategory(isActive && cat.id !== 'all' ? 'all' : cat.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${cat.label}${isActive ? ', selected' : ''}`}
              >
                <Text style={[styles.chipText, { color: themeColors.textSecondary }, isTablet && styles.chipTextTablet, isActive && styles.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {showFilters && (
        <View style={[styles.filterRow, { paddingHorizontal: horizontalPadding }]}>
          {searching && (
            <View style={[styles.segment, { borderColor: mutedBorder, backgroundColor: themeColors.bgCard }]}>
              {([['relevance', 'Most relevant'], ['recent', 'Newest']] as [SearchSort, string][]).map(([k, label]) => (
                <TouchableOpacity
                  key={k}
                  onPress={() => setSort(k)}
                  style={[styles.segmentBtn, sort === k && { backgroundColor: isDark ? '#FFFFFF' : INK }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === k }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: sort === k ? (isDark ? INK : '#FFFFFF') : themeColors.textSecondary }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {activeCategory === 'marketplace' && (
            <View style={[styles.segment, { borderColor: mutedBorder, backgroundColor: themeColors.bgCard }]}>
              {([['', 'All'], ['equipment', 'Gear'], ['location', 'Locations']] as ['' | 'equipment' | 'location', string][]).map(([k, label]) => (
                <TouchableOpacity key={k || 'all'} onPress={() => setListingType(k)} style={[styles.segmentBtn, listingType === k && { backgroundColor: isDark ? '#FFFFFF' : INK }]} accessibilityRole="button" accessibilityState={{ selected: listingType === k }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: listingType === k ? (isDark ? INK : '#FFFFFF') : themeColors.textSecondary }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {searching && !savedUnavailable && !!userId && (
            <TouchableOpacity
              onPress={saveCurrent}
              disabled={alreadySaved}
              style={[styles.toggleChip, { borderColor: mutedBorder, backgroundColor: themeColors.bgCard, opacity: alreadySaved ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={alreadySaved ? 'Search saved' : 'Save this search'}
            >
              <Icon name="bookmark" size={13} color={themeColors.iconSecondary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: themeColors.textSecondary }}>{alreadySaved ? 'Saved' : 'Save search'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setVerifiedOnly(!verifiedOnly)}
            style={[styles.toggleChip, { borderColor: verifiedOnly ? ORANGE : mutedBorder, backgroundColor: verifiedOnly ? ORANGE : themeColors.bgCard }]}
            accessibilityRole="button"
            accessibilityState={{ selected: verifiedOnly }}
            accessibilityLabel="Verified only"
          >
            <Icon name="check-circle" size={13} color={verifiedOnly ? '#FFFFFF' : themeColors.textSecondary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: verifiedOnly ? '#FFFFFF' : themeColors.textSecondary }}>Verified only</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeCategory === 'people' && (
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipsScroll, { paddingHorizontal: horizontalPadding }, isTablet && { flexGrow: 1, justifyContent: 'center' }]}>
            {SEARCH_CRAFTS.map((c) => {
              const on = craft === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCraft(on ? '' : c)}
                  style={[styles.toggleChip, { marginRight: 8, borderColor: on ? ORANGE : mutedBorder, backgroundColor: on ? ORANGE : themeColors.bgCard }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: on ? '#FFFFFF' : themeColors.textSecondary }}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!loading && failed.length > 0 && (
        <View style={[styles.errorBox, { marginHorizontal: horizontalPadding }]} accessibilityRole="alert">
          <Icon name="info" size={16} color="#D97706" />
          <Text style={[styles.errorText, { color: themeColors.textPrimary }]}>
            Some results could not be loaded ({failed.map((t) => SEARCH_TYPE_LABEL[t as keyof typeof SEARCH_TYPE_LABEL] || t).join(', ')}).
          </Text>
          <TouchableOpacity onPress={() => setRetry((n) => n + 1)} accessibilityRole="button" accessibilityLabel="Try again" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 13 }}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const listEmpty = loading && !refreshing ? (
    <View style={styles.loadingCenter}>
      <ActivityIndicator size="large" color={ORANGE} />
      <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>{searching ? 'Searching…' : 'Loading…'}</Text>
    </View>
  ) : (
    <View style={styles.emptyCenter}>
      <Icon name="search" size={44} color={themeColors.iconMuted} />
      <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{searching ? `No results for "${term}"` : 'Nothing to show yet'}</Text>
      <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
        {searching
          ? 'Check the spelling, try fewer words, or search by a #tag. You can also switch category or turn off Verified only.'
          : 'Try searching for a name, a project, a skill or a #tag.'}
      </Text>
      {(activeCategory !== 'all' || verifiedOnly || !!craft || !!listingType) && (
        <TouchableOpacity style={[styles.resetBtn, { borderColor: mutedBorder }]} onPress={() => { setActiveCategory('all'); setVerifiedOnly(false); setCraft(''); setListingType(''); }} accessibilityRole="button">
          <Text style={{ color: themeColors.textPrimary, fontWeight: '700', fontSize: 13 }}>Reset filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      header={<Header title="Search" showLogo={false} showNotifications={false} showMessages={false} onBack={() => navigation.goBack()} />}
    >
      <FlashListAny
        key={`explore-grid-${numCols}`}
        data={loading ? [] : items}
        renderItem={renderExploreCard}
        keyExtractor={(item: ExploreItem) => `${item.type}-${item.id}`}
        numColumns={numCols}
        estimatedItemSize={235}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: horizontalPadding - gridGap / 2, paddingBottom: 30 }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} color={ORANGE} /> : null}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ORANGE]} />}
      />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  hint: { fontSize: 12, marginBottom: 6 },
  recentBox: { borderWidth: 1, borderRadius: 14, padding: 8, marginBottom: 10 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  recentTitle: { fontSize: 12, fontWeight: '700' },
  recentRow: { flexDirection: 'row', alignItems: 'center' },
  recentMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, minHeight: 44 },
  recentRemove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 18, padding: 2 },
  segmentBtn: { paddingHorizontal: 12, minHeight: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  toggleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 44, borderRadius: 18, borderWidth: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F59E0B1A', borderWidth: 1, borderColor: '#F59E0B55', borderRadius: 14, padding: 12, marginBottom: 10 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17 },
  resetBtn: { marginTop: 10, borderWidth: 1, borderRadius: 18, paddingHorizontal: 18, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
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
    fontSize: 14,
    padding: 0,
  },
  chipsContainer: {
    marginBottom: 10,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 16,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
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
    fontWeight: '700',
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
    fontWeight: '700',
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
