import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass, Search, X, Clock, SearchX, AlertTriangle, BadgeCheck, Bookmark, BookmarkPlus, User, Briefcase, Building2, Film, MessageSquare } from 'lucide-react';
import {
  SEARCH_TYPE_LABEL,
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
  type SearchCategoryId,
  type SearchSection,
  type SearchSort,
} from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { ExploreGrid } from '@/components/search/ExploreGrid';
import type { ExploreItem } from '@/components/search/ExploreCard';
import { cn } from '@/lib/utils';
import { friendlyError } from '@cinecraft/core';

const PAGE_SIZE = 24;
const DEBOUNCE_MS = 350;

const recentKey = (userId?: string) => `recent_searches_${userId || 'guest'}`;
const readRecents = (userId?: string): string[] => {
  try { return JSON.parse(localStorage.getItem(recentKey(userId)) || '[]'); } catch { return []; }
};
const writeRecents = (userId: string | undefined, list: string[]) => {
  try { localStorage.setItem(recentKey(userId), JSON.stringify(list)); } catch { /* storage unavailable */ }
};

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { isFan } = useAccountType();
  const { push } = useAppNavigation();

  const categories = useMemo(() => visibleSearchCategories(isFan), [isFan]);
  const urlCategory = (searchParams.get('category') || 'all') as SearchCategoryId;

  const [input, setInput] = useState(searchParams.get('q') || '');
  const [term, setTerm] = useState(searchParams.get('q') || ''); // the debounced input: what we actually search
  const [category, setCategory] = useState<SearchCategoryId>(urlCategory);
  const [sort, setSort] = useState<SearchSort>('relevance');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [craft, setCraft] = useState('');
  const [listingType, setListingType] = useState<'' | 'equipment' | 'location'>('');
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [savedUnavailable, setSavedUnavailable] = useState(false);

  const [sections, setSections] = useState<SearchSection[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);

  const [recents, setRecents] = useState<string[]>(() => readRecents(user?.id));
  const [focused, setFocused] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  useEffect(() => { setActiveSuggestion(-1); }, [suggestions]);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const lastWrittenQ = useRef<string | null>(searchParams.get('q'));

  const searching = isSearchable(term);
  const effectiveTerm = searching ? term : ''; // below two characters we show Explore, and typing one letter must not reload it
  const tooShort = input.trim().length > 0 && !isSearchable(input);

  // debounce what is typed into what is searched
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(input), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [input]);

  // the address bar follows the search without piling up history entries; a link to /search?q=… (a hashtag) fills the box
  useEffect(() => {
    const urlQ = searchParams.get('q') || '';
    if (urlQ !== (lastWrittenQ.current ?? '')) {
      lastWrittenQ.current = urlQ;
      setInput(urlQ);
      setTerm(urlQ);
    }
    const urlCat = (searchParams.get('category') || 'all') as SearchCategoryId;
    if (urlCat !== category) setCategory(urlCat);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params: Record<string, string> = {};
    if (term) params.q = term;
    if (category !== 'all') params.category = category;
    lastWrittenQ.current = term;
    setSearchParams(params, { replace: true });
  }, [term, category]); // eslint-disable-line react-hooks/exhaustive-deps

  // filters that belong to one tab must not stay active (invisibly) when the tab changes
  useEffect(() => {
    if (category !== 'people' && craft) setCraft('');
    if (category !== 'marketplace' && listingType) setListingType('');
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  // a category that a fan cannot see must not stay selected
  useEffect(() => {
    if (!categories.some((c) => c.id === category)) setCategory('all');
  }, [categories, category]);

  const load = useCallback(async (offset: number) => {
    const id = ++requestId.current;
    if (offset === 0) setLoading(true); else setLoadingMore(true);
    try {
      const out = await runSearch({
        client: supabase,
        query: effectiveTerm,
        category,
        isFan,
        meId: user?.id,
        sort,
        verifiedOnly,
        craft: craft || undefined,
        listingType: listingType || undefined,
        limit: PAGE_SIZE,
        offset,
        perTypeLimit: searching ? 6 : 8,
      });
      if (id !== requestId.current) return; // a newer search started: ignore this late answer
      if (offset === 0) {
        setSections(out.sections);
        setItems(category === 'all' && !searching ? interleaveSections(out.sections) : out.items);
      } else {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => `${p.type}-${p.id}`));
          return [...prev, ...out.items.filter((i) => !seen.has(`${i.type}-${i.id}`))];
        });
      }
      setHasMore(out.hasMore);
      setFailed(out.failed);
    } catch (e) {
      if (id !== requestId.current) return;
      console.error('Search failed:', e);
      setFailed(['post']);
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [effectiveTerm, searching, category, isFan, user?.id, sort, verifiedOnly, craft, listingType]);

  // wait for the profile so a fan is not briefly treated as a creator (that caused a second load)
  useEffect(() => {
    if (!profile) return;
    load(0);
  }, [load, profile, retry]);

  // remember searches that were actually used
  useEffect(() => {
    if (!searching || loading) return;
    setRecents((prev) => {
      const next = pushRecentSearch(prev, term);
      if (next !== prev) writeRecents(user?.id, next);
      return next;
    });
  }, [searching, loading, term]); // eslint-disable-line react-hooks/exhaustive-deps

  // a few suggestions while typing (names that start with what was typed)
  useEffect(() => {
    if (!focused || !isSearchable(input)) { setSuggestions([]); return; }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const list = await suggest(supabase, input, isFan);
      if (!cancelled) setSuggestions(list);
    }, 220);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [input, focused, isFan]);

  const refreshSaved = useCallback(async () => {
    const out = await listSavedSearches(supabase, user?.id);
    setSaved(out.items);
    setSavedUnavailable(out.unavailable);
  }, [user?.id]);
  useEffect(() => { refreshSaved(); }, [refreshSaved]);

  const saveCurrent = async () => {
    if (!user || !searching) return;
    try {
      await saveSearch(supabase, user.id, { name: term, query: term, category, filters: { sort, verifiedOnly, craft: craft || undefined, listingType: listingType || undefined } });
      toast({ title: 'Search saved', description: 'Find it under Saved when you click the search box.' });
      refreshSaved();
    } catch (e: any) {
      toast({ title: 'Could not save this search', description: friendlyError(e), variant: 'destructive' });
    }
  };
  const runSaved = (s: SavedSearch) => {
    setCategory(s.category);
    setSort(s.filters.sort || 'relevance');
    setVerifiedOnly(!!s.filters.verifiedOnly);
    setCraft(s.filters.craft || '');
    setListingType(s.filters.listingType || '');
    setInput(s.query); setTerm(s.query); setFocused(false);
  };
  const removeSaved = async (id: string) => {
    try { await deleteSavedSearch(supabase, id); setSaved((prev) => prev.filter((x) => x.id !== id)); }
    catch (e: any) { toast({ title: 'Could not remove', description: friendlyError(e), variant: 'destructive' }); }
  };
  const pickSuggestion = (sg: SearchSuggestion) => { setInput(sg.label); setTerm(sg.label); setFocused(false); };
  const alreadySaved = saved.some((x) => x.query.toLowerCase() === term.toLowerCase() && x.category === category);

  // "/" focuses the box, like most sites
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const chooseCategory = (id: SearchCategoryId) => setCategory(category === id ? 'all' : id);
  const clearInput = () => { setInput(''); setTerm(''); inputRef.current?.focus(); };
  const useRecent = (q: string) => { setInput(q); setTerm(q); setFocused(false); };
  const removeRecent = (q: string) => { const next = recents.filter((r) => r !== q); setRecents(next); writeRecents(user?.id, next); };

  const showFilters = searching || category === 'people' || category === 'vendors' || category === 'marketplace';
  const showSections = searching && category === 'all';
  const resultCount = items.length;

  return (
    <div className="min-h-dvh bg-background selection:bg-primary/30 overflow-x-hidden w-full max-w-full">
      <main className="max-w-[1560px] mx-auto pt-20 pb-40 w-full">
        <div className="px-4 md:px-8">
          <PageHeader
            title="Search"
            subtitle="Find people, projects, posts, gear and companies."
            Icon={Compass}
            onBack={() => push('/feed', { noScroll: true })}
          />
        </div>

        {/* search box */}
        <div className="relative max-w-2xl mx-auto mt-2 mb-6 px-4 md:px-8">
          <Search className="absolute left-8 md:left-12 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={20} aria-hidden="true" />
          <Input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Search"
            placeholder={isFan ? 'Search people, posts, discussions…' : 'Search projects, people, posts, gear…'}
            className="pl-12 pr-12 h-12 text-base rounded-2xl bg-card border-border/60 shadow-sm [&::-webkit-search-cancel-button]:hidden"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            aria-controls="search-suggestions"
            aria-activedescendant={focused && input && activeSuggestion >= 0 && suggestions[activeSuggestion] ? `search-suggestion-${activeSuggestion}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { clearInput(); (e.target as HTMLElement).blur(); return; }
              if (focused && input && suggestions.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSuggestion((i) => (i + 1) % suggestions.length); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
                else if (e.key === 'Enter' && activeSuggestion >= 0 && suggestions[activeSuggestion]) { e.preventDefault(); pickSuggestion(suggestions[activeSuggestion]); }
              }
            }}
          />
          {input && (
            <button type="button" onClick={clearInput} aria-label="Clear search" className="absolute right-5 md:right-9 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          )}

          {/* suggestions while typing */}
          {focused && input && suggestions.length > 0 && (
            <div className="absolute left-4 right-4 md:left-8 md:right-8 top-full mt-2 z-20 rounded-2xl border bg-popover shadow-xl p-2" role="listbox" id="search-suggestions" aria-label="Suggestions">
              {suggestions.map((sg, idx) => {
                const Icon = sg.type === 'user' ? User : sg.type === 'job' ? Briefcase : sg.type === 'company' ? Building2 : sg.type === 'project' ? Film : MessageSquare;
                return (
                  <button key={`${sg.type}-${sg.id}`} id={`search-suggestion-${idx}`} type="button" role="option" aria-selected={idx === activeSuggestion} onMouseDown={(e) => e.preventDefault()} onClick={() => pickSuggestion(sg)} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted min-h-[44px]", idx === activeSuggestion && "bg-muted")}>
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{sg.label}</span>
                      {sg.sublabel && <span className="block text-xs text-muted-foreground truncate">{sg.sublabel}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* saved and recent searches */}
          {focused && !input && (saved.length > 0 || recents.length > 0) && (
            <div className="absolute left-4 right-4 md:left-8 md:right-8 top-full mt-2 z-20 rounded-2xl border bg-popover shadow-xl p-2" role="listbox" aria-label="Saved and recent searches">
              {saved.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">Saved</div>
                  {saved.map((sv) => (
                    <div key={sv.id} className="flex items-center rounded-xl hover:bg-muted">
                      <button type="button" role="option" aria-selected="false" onMouseDown={(e) => e.preventDefault()} onClick={() => runSaved(sv)} className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left text-sm min-w-0">
                        <Bookmark className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{sv.name}</span>
                        {sv.category !== 'all' && <span className="text-xs text-muted-foreground shrink-0">{sv.category}</span>}
                      </button>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => removeSaved(sv.id)} aria-label={`Remove saved search ${sv.name}`} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {recents.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Recent</span>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setRecents([]); writeRecents(user?.id, []); }} className="text-xs text-primary">Clear all</button>
                  </div>
                  {recents.map((rc) => (
                    <div key={rc} className="flex items-center rounded-xl hover:bg-muted">
                      <button type="button" role="option" aria-selected="false" onMouseDown={(e) => e.preventDefault()} onClick={() => useRecent(rc)} className="flex-1 flex items-center gap-3 px-3 py-2.5 text-left text-sm min-w-0">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{rc}</span>
                      </button>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => removeRecent(rc)} aria-label={`Remove ${rc}`} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
          {tooShort && <p className="text-sm text-muted-foreground mt-2 px-1" role="status">Type at least 2 characters to search.</p>}
        </div>

        {/* categories */}
        <div className="flex gap-2 overflow-x-auto py-2 mb-2 no-scrollbar justify-start md:justify-center px-4 md:px-8" role="group" aria-label="Search categories">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => chooseCategory(c.id)}
              aria-pressed={category === c.id}
              className={cn(
                'px-5 min-h-[44px] rounded-full text-sm font-semibold whitespace-nowrap border transition-[transform,color,background-color,border-color] duration-150 active:scale-[0.97]',
                category === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-primary/40',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 px-4 md:px-8 mb-6 max-w-[1560px] mx-auto md:justify-center">
            {searching && (
              <div className="inline-flex rounded-full border border-border/60 bg-card p-0.5" role="group" aria-label="Sort results">
                {([['relevance', 'Most relevant'], ['recent', 'Newest']] as [SearchSort, string][]).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={cn('px-4 min-h-11 md:min-h-9 rounded-full text-xs font-semibold', sort === k ? 'bg-foreground text-background' : 'text-muted-foreground')}>{label}</button>
                ))}
              </div>
            )}
            {category === 'marketplace' && (
              <div className="inline-flex rounded-full border border-border/60 bg-card p-0.5" role="group" aria-label="Listing type">
                {([['', 'All'], ['equipment', 'Gear'], ['location', 'Locations']] as ['' | 'equipment' | 'location', string][]).map(([k, label]) => (
                  <button key={k || 'all'} type="button" aria-pressed={listingType === k} onClick={() => setListingType(k)} className={cn('px-4 min-h-11 md:min-h-9 rounded-full text-xs font-semibold', listingType === k ? 'bg-foreground text-background' : 'text-muted-foreground')}>{label}</button>
                ))}
              </div>
            )}
            {searching && !savedUnavailable && (
              <button type="button" onClick={saveCurrent} disabled={alreadySaved} className="inline-flex items-center gap-1.5 px-4 min-h-11 md:min-h-9 rounded-full text-xs font-semibold border bg-card text-muted-foreground border-border/60 disabled:opacity-60">
                <BookmarkPlus className="h-3.5 w-3.5" /> {alreadySaved ? 'Saved' : 'Save search'}
              </button>
            )}
            <button
              type="button"
              aria-pressed={verifiedOnly}
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={cn('inline-flex items-center gap-1.5 px-4 min-h-11 md:min-h-9 rounded-full text-xs font-semibold border', verifiedOnly ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border/60')}
            >
              <BadgeCheck className="h-3.5 w-3.5" /> Verified only
            </button>
          </div>
        )}

        {category === 'people' && (
          <div className="flex gap-2 overflow-x-auto pb-4 px-4 md:px-8 no-scrollbar md:justify-center" role="group" aria-label="Filter by craft">
            {SEARCH_CRAFTS.map((c) => (
              <button key={c} type="button" aria-pressed={craft === c} onClick={() => setCraft(craft === c ? '' : c)} className={cn('px-4 min-h-11 md:min-h-9 rounded-full text-xs font-semibold whitespace-nowrap border', craft === c ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border/60')}>{c}</button>
            ))}
          </div>
        )}

        {/* some types failed */}
        {!loading && failed.length > 0 && (
          <div className="mx-4 md:mx-8 mb-6 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 text-sm">
              Some results could not be loaded ({failed.map((t) => SEARCH_TYPE_LABEL[t as keyof typeof SEARCH_TYPE_LABEL] || t).join(', ')}). What you see may be incomplete.
            </p>
            <Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>Try again</Button>
          </div>
        )}

        <div aria-live="polite" className="sr-only" role="status">
          {!loading && (searching ? `${resultCount} results for ${term}` : '')}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 px-4 md:px-8" aria-busy="true" aria-label="Loading results">
            {[...Array(15)].map((_, i) => <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse motion-reduce:animate-none" />)}
          </div>
        ) : resultCount === 0 ? (
          <div className="text-center py-20 px-6">
            <SearchX className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-semibold">{searching ? `No results for “${term}”` : 'Nothing to show yet'}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {searching
                ? 'Check the spelling, try fewer words, or search by a #tag. You can also switch category or turn off “Verified only”.'
                : 'Try searching for a name, a project, a skill or a #tag.'}
            </p>
            {(category !== 'all' || verifiedOnly || craft || listingType) && (
              <Button variant="outline" className="mt-4" onClick={() => { setCategory('all'); setVerifiedOnly(false); setCraft(''); setListingType(''); }}>Reset filters</Button>
            )}
          </div>
        ) : showSections ? (
          <div className="space-y-10">
            {sections.map((s) => (
              <section key={s.type} aria-label={SEARCH_TYPE_LABEL[s.type]}>
                <div className="flex items-center justify-between px-4 md:px-8 mb-3">
                  <h2 className="text-lg font-bold">{SEARCH_TYPE_LABEL[s.type]}</h2>
                  {s.hasMore && categoriesFor(s.type) !== 'all' && (
                    <Button variant="ghost" size="sm" className="text-primary" onClick={() => setCategory(categoriesFor(s.type))}>
                      See all
                    </Button>
                  )}
                </div>
                <div className="px-0.5 md:px-8"><ExploreGrid items={s.items as ExploreItem[]} compact /></div>
              </section>
            ))}
          </div>
        ) : (
          <div className="px-0.5 md:px-8">
            {searching && <p className="px-4 md:px-0 mb-3 text-sm text-muted-foreground">{resultCount}{hasMore ? '+' : ''} results for “{term}”</p>}
            <ExploreGrid items={items as ExploreItem[]} compact />
            {hasMore && (
              <div className="flex justify-center py-8">
                <Button variant="outline" disabled={loadingMore} onClick={() => load(items.length)}>{loadingMore ? 'Loading…' : 'Load more'}</Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

/** the chip id for an item type (used by the "See all" button) */
const categoriesFor = (type: string): SearchCategoryId => {
  const map: Record<string, SearchCategoryId> = {
    project: 'projects', user: 'people', discussion: 'discussions', post: 'posts', job: 'jobs', pitch: 'pitches', vendor: 'vendors', marketplace: 'marketplace', company: 'companies',
  };
  return map[type] || 'all';
};

export default SearchPage;
