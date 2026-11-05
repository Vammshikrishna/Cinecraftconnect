/**
 * Search and Explore for web and mobile: one place that knows what is searched, how a query is cleaned, how results are
 * ranked and how pages are fetched, so both apps behave the same. The Supabase client is passed in (core has no
 * dependency on it). See docs/SEARCH_EXPLORE.md.
 */

export type SearchItemType = 'project' | 'user' | 'discussion' | 'post' | 'announcement' | 'vendor' | 'marketplace' | 'company' | 'job' | 'pitch';
export type SearchCategoryId = 'all' | 'projects' | 'people' | 'discussions' | 'posts' | 'jobs' | 'pitches' | 'vendors' | 'marketplace' | 'companies';

export const SEARCH_CATEGORIES: { id: SearchCategoryId; label: string; type?: SearchItemType }[] = [
  { id: 'all', label: 'All' },
  { id: 'projects', label: 'Projects', type: 'project' },
  { id: 'people', label: 'People', type: 'user' },
  { id: 'discussions', label: 'Discussions', type: 'discussion' },
  { id: 'posts', label: 'Posts', type: 'post' },
  { id: 'jobs', label: 'Jobs', type: 'job' },
  { id: 'pitches', label: 'Pitch calls', type: 'pitch' },
  { id: 'vendors', label: 'Vendors', type: 'vendor' },
  { id: 'marketplace', label: 'Marketplace', type: 'marketplace' },
  { id: 'companies', label: 'Companies', type: 'company' },
];

export const SEARCH_TYPE_LABEL: Record<SearchItemType, string> = {
  project: 'Projects', user: 'People', discussion: 'Discussions', post: 'Posts', announcement: 'Announcements',
  vendor: 'Vendors', marketplace: 'Marketplace', company: 'Companies', job: 'Jobs', pitch: 'Pitch calls',
};

/** Fans only see people, discussions, posts and announcements. */
const FAN_TYPES: SearchItemType[] = ['user', 'discussion', 'post', 'announcement'];
const ALL_TYPES: SearchItemType[] = ['project', 'user', 'discussion', 'post', 'job', 'pitch', 'announcement', 'vendor', 'marketplace', 'company'];

export const searchTypesFor = (isFan: boolean): SearchItemType[] => (isFan ? FAN_TYPES : ALL_TYPES);
export const visibleSearchCategories = (isFan: boolean) =>
  SEARCH_CATEGORIES.filter((c) => c.id === 'all' || (c.type && searchTypesFor(isFan).includes(c.type)));

export const MIN_QUERY_LENGTH = 2;

// ── query cleaning ─────────────────────────────────────────────────────────────────────────────────────────────

export interface ParsedQuery {
  /** what the person typed, trimmed and with repeated spaces collapsed */
  text: string;
  /** safe to put inside a PostgREST `.or('col.ilike.%term%')` string (structural characters removed) */
  orText: string;
  /** safe for `.ilike(col, '%' + like + '%')`: `%`, `_` and `\` match literally */
  like: string;
  isTag: boolean;
  tag: string;
}

/** Makes `%`, `_` and `\` match literally in an ILIKE pattern. */
export const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`);

// `_` stays: usernames contain it (cct_studio_ab12), it is not structural in a PostgREST or() string, and as an ILIKE wildcard it still matches itself
const orSafe = (value: string): string => value.replace(/[,()"'*%:\\]/g, ' ').replace(/\s+/g, ' ').trim();

export const parseQuery = (raw: string | null | undefined): ParsedQuery => {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  const isTag = text.startsWith('#') && text.length > 1;
  const tag = isTag ? text.slice(1).toLowerCase().replace(/[^\p{L}\p{M}\p{N}_]/gu, '') : '';
  // @sam searches people by username: the @ is not part of the name
  const body = isTag ? text.slice(1) : text.startsWith('@') ? text.slice(1).trim() : text;
  return { text: isTag ? text : body, orText: orSafe(body), like: escapeLike(body), isTag, tag };
};

/** A query is searchable once it has at least two real characters (a lone "#" does not count). */
export const isSearchable = (raw: string | null | undefined): boolean => {
  const p = parseQuery(raw);
  return (p.isTag ? p.tag.length : p.text.length) >= MIN_QUERY_LENGTH;
};

// ── ranking ────────────────────────────────────────────────────────────────────────────────────────────────────

const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Higher is better: exact, then starts-with, then a word starts with it, then contains. Verified accounts get a small lift. */
export const scoreItem = (item: any, q: string): number => {
  const query = norm(q);
  if (!query) return 0;
  const fields: string[] = [item.username, item.full_name, item.business_name, item.name, item.title, item.craft]
    .map(norm)
    .filter(Boolean);
  let best = 0;
  for (const f of fields) {
    if (f === query) best = Math.max(best, 100);
    else if (f.startsWith(query)) best = Math.max(best, 70);
    else if (f.split(/[\s_\-.]+/).some((w) => w.startsWith(query))) best = Math.max(best, 50);
    else if (f.includes(query)) best = Math.max(best, 30);
  }
  if (best === 0 && norm(item.description || item.content || item.bio).includes(query)) best = 10;
  if (item.is_verified) best += 8;
  return best;
};

// ── fetching ───────────────────────────────────────────────────────────────────────────────────────────────────

export type SearchSort = 'relevance' | 'recent';

export interface SearchParams {
  client: any;
  query: string;
  category: SearchCategoryId;
  isFan: boolean;
  /** the signed-in person: people they blocked are left out */
  meId?: string | null;
  sort?: SearchSort;
  verifiedOnly?: boolean;
  /** people: only this craft (e.g. Editor) */
  craft?: string;
  /** marketplace: gear or locations */
  listingType?: 'equipment' | 'location';
  /** single category: page size and offset. In "all" each type shows `perTypeLimit` items */
  limit?: number;
  offset?: number;
  perTypeLimit?: number;
}

export interface SearchSection {
  type: SearchItemType;
  items: any[];
  /** there are more of this type than shown */
  hasMore: boolean;
}

export interface SearchOutput {
  sections: SearchSection[];
  /** every section's items in display order (ranked) */
  items: any[];
  /** single category only: another page exists */
  hasMore: boolean;
  /** types whose request failed, so the screen can say "some results could not load" instead of "no results" */
  failed: SearchItemType[];
}

const asArray = (v: any): any[] => (Array.isArray(v) ? v : []);
const firstOf = (v: any) => (Array.isArray(v) ? v[0] : v);

const normalize = (type: SearchItemType, r: any): any => {
  switch (type) {
    case 'project':
      return { ...r, type, name: r.title, description: r.description || undefined, image_url: r.image_url };
    case 'user':
      return { ...r, type, username: r.username || '', full_name: r.full_name || '', avatar_url: r.avatar_url || undefined, description: r.bio || undefined };
    case 'discussion':
      return { ...r, type, name: r.title, description: r.description || undefined };
    case 'post':
      return {
        id: r.id, type, content: r.content,
        image_url: r.media_type === 'image' ? r.media_url : undefined,
        video_url: r.media_type === 'video' ? r.media_url : undefined,
        like_count: r.like_count || 0, comment_count: r.comment_count || 0,
        author_id: r.author_id, created_at: r.created_at,
        author: r.author ? firstOf(r.author) : null,
      };
    case 'announcement':
      return { id: r.id, type, title: r.title, content: r.content };
    case 'vendor':
      return {
        ...r, type, description: r.description || undefined, logo_url: r.logo_url || undefined,
        category: Array.isArray(r.category) ? r.category[0] : r.category,
        city: r.location, location: r.location,
      };
    case 'marketplace':
      return {
        ...r, type, description: r.description || undefined,
        image_url: r.image_url || asArray(r.images)[0] || asArray(r.listing_images)[0],
      };
    case 'job': {
      const page = firstOf(r.company_pages);
      return {
        id: r.id, type, title: r.title, description: r.description || undefined,
        company: page?.name || r.company, location: r.location, job_type: r.type, experience_level: r.experience_level,
        logo_url: page?.logo_url || undefined, salary_min: r.salary_min, salary_max: r.salary_max,
      };
    }
    case 'pitch':
      return {
        id: r.id, type, title: r.title, description: r.requirement_description || undefined,
        genre: r.genre, project_type: r.project_type, budget_range: r.budget_range, deadline: r.deadline, status: r.status,
      };
    case 'company':
      return {
        ...r, type, description: r.description || r.tagline || undefined,
        location: r.headquarters, industry: Array.isArray(r.industry) ? r.industry[0] : r.industry,
        logo_url: r.logo_url || undefined, image_url: r.cover_image_url || r.image_url,
      };
  }
};

interface Ctx {
  client: any;
  q: ParsedQuery;
  sort: SearchSort;
  verifiedOnly: boolean;
  craft?: string;
  listingType?: 'equipment' | 'location';
}

/** Fetches `limit + 1` rows (the extra one only tells us whether another page exists). */
const fetchType = async (type: SearchItemType, ctx: Ctx, limit: number, offset: number): Promise<{ rows: any[]; hasMore: boolean }> => {
  const { client, q } = ctx;
  const from = offset;
  const to = offset + limit; // inclusive: one extra row
  const has = !!q.text;
  let res: any;

  switch (type) {
    case 'project': {
      let b = client.from('projects').select('id, title, description, status, location, genre, image_url');
      if (has) b = b.or(`title.ilike.%${q.orText}%,description.ilike.%${q.orText}%,location.ilike.%${q.orText}%`);
      res = await b.order('created_at', { ascending: false }).range(from, to);
      break;
    }
    case 'user': {
      const select = 'id, username, full_name, avatar_url, is_verified, craft, bio, account_type';
      let b = client.from('profiles').select(select);
      if (has) b = b.or(`username.ilike.%${q.orText}%,full_name.ilike.%${q.orText}%,craft.ilike.%${q.orText}%`);
      if (ctx.verifiedOnly) b = b.eq('is_verified', true);
      if (ctx.craft) b = b.ilike('craft', `%${escapeLike(ctx.craft)}%`);
      if (!has) b = b.order('is_verified', { ascending: false });
      res = await b.order('updated_at', { ascending: false }).range(from, to);
      // remember if there is another page before skill matches are added below
      const baseRows = asArray(res.data);
      const usersHasMore = baseRows.length > limit;
      res = { ...res, data: baseRows.slice(0, limit), hasMoreOverride: usersHasMore };
      // people who list the searched skill (a short, separate lookup: never put long id lists in the URL)
      if (has && !res.error && from === 0 && !q.isTag) {
        const skills = await client.from('user_skills').select('user_id').ilike('skill_name', `%${q.like}%`).limit(40);
        const ids: string[] = asArray(skills?.data).map((s: any) => s.user_id).filter(Boolean);
        if (ids.length > 0) {
          let sb = client.from('profiles').select(select).in('id', ids);
          if (ctx.verifiedOnly) sb = sb.eq('is_verified', true);
          if (ctx.craft) sb = sb.ilike('craft', `%${escapeLike(ctx.craft)}%`);
          const extra = await sb.limit(20);
          const seen = new Set(asArray(res.data).map((r: any) => r.id));
          res = { ...res, data: [...asArray(res.data), ...asArray(extra?.data).filter((r: any) => !seen.has(r.id))] };
        }
      }
      break;
    }
    case 'discussion': {
      let b = client.from('discussion_rooms').select('id, title, description');
      if (has) b = b.or(`title.ilike.%${q.orText}%,description.ilike.%${q.orText}%`);
      res = await b.order('created_at', { ascending: false }).range(from, to);
      break;
    }
    case 'post': {
      let b = client
        .from('posts')
        .select('id, content, media_url, media_type, like_count, comment_count, created_at, author_id, author:author_id(username, full_name, is_verified)');
      if (q.isTag) b = b.or(`tags.cs.{${q.tag}},content.ilike.%${q.orText}%`);
      else if (has) b = b.ilike('content', `%${q.like}%`);
      res = await b.order('created_at', { ascending: false }).range(from, to);
      break;
    }
    case 'announcement': {
      let b = client.from('announcements').select('id, title, content');
      if (has) b = b.or(`title.ilike.%${q.orText}%,content.ilike.%${q.orText}%`);
      res = await b.order('posted_at', { ascending: false }).range(from, to);
      break;
    }
    case 'job': {
      let b = client
        .from('jobs')
        .select('id, title, description, company, location, type, experience_level, salary_min, salary_max, page_id, company_pages:page_id(name, logo_url)')
        .eq('is_active', true)
        .eq('is_draft', false);
      if (has) b = b.or(`title.ilike.%${q.orText}%,description.ilike.%${q.orText}%,company.ilike.%${q.orText}%,location.ilike.%${q.orText}%`);
      res = await b.order('created_at', { ascending: false }).range(from, to);
      break;
    }
    case 'pitch': {
      let b = client
        .from('pitch_calls')
        .select('id, title, requirement_description, genre, project_type, budget_range, deadline, status')
        .eq('is_published', true)
        .eq('status', 'open');
      if (has) b = b.or(`title.ilike.%${q.orText}%,requirement_description.ilike.%${q.orText}%,project_type.ilike.%${q.orText}%`);
      res = await b.order('created_at', { ascending: false }).range(from, to);
      break;
    }
    case 'vendor': {
      res = await client
        .rpc('search_vendors', { search_query: has ? q.like : undefined, filter_category: undefined, filter_location: undefined, verified_only: ctx.verifiedOnly })
        .range(from, to);
      break;
    }
    case 'marketplace': {
      res = await client
        .rpc('search_marketplace_listings', { search_query: has ? q.like : undefined, filter_type: ctx.listingType, filter_category: undefined, filter_location: undefined, min_price: undefined, max_price: undefined })
        .range(from, to);
      break;
    }
    case 'company': {
      let b = client.from('company_pages').select('id, name, description, tagline, industry, headquarters, logo_url, cover_image_url');
      if (has) b = b.or(`name.ilike.%${q.orText}%,description.ilike.%${q.orText}%,tagline.ilike.%${q.orText}%`);
      res = await b.order('created_at', { ascending: false }).range(from, to);
      break;
    }
  }

  if (res?.error) throw res.error;
  const rows = asArray(res?.data);
  if (res && typeof res.hasMoreOverride === 'boolean') return { rows, hasMore: res.hasMoreOverride };
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
};

const loadBlocked = async (client: any, meId?: string | null): Promise<Set<string>> => {
  if (!meId) return new Set();
  try {
    const { data } = await client.from('blocked_users').select('blocked_user_id').eq('user_id', meId);
    return new Set(asArray(data).map((r: any) => r.blocked_user_id));
  } catch {
    return new Set();
  }
};

/**
 * Search (or, with an empty query, Explore). One call returns the ranked sections for the chosen category.
 * Failing types are reported in `failed` instead of silently looking like "no results".
 */
export const runSearch = async (p: SearchParams): Promise<SearchOutput> => {
  const q = parseQuery(p.query);
  const sort = p.sort ?? 'relevance';
  const ctx: Ctx = { client: p.client, q, sort, verifiedOnly: !!p.verifiedOnly, craft: p.craft?.trim() || undefined, listingType: p.listingType };
  const allowed = searchTypesFor(p.isFan);
  const single = SEARCH_CATEGORIES.find((c) => c.id === p.category)?.type;
  const types = single ? (allowed.includes(single) ? [single] : []) : allowed;
  const perType = single ? (p.limit ?? 24) : (p.perTypeLimit ?? 6);
  const offset = single ? (p.offset ?? 0) : 0;

  const blocked = await loadBlocked(p.client, p.meId);
  const failed: SearchItemType[] = [];

  const settled = await Promise.all(
    types.map(async (type) => {
      try {
        const { rows, hasMore } = await fetchType(type, ctx, perType, offset);
        let items = rows.map((r) => normalize(type, r));
        if (blocked.size > 0) items = items.filter((i) => !(i.type === 'user' && blocked.has(i.id)) && !(i.type === 'post' && blocked.has(i.author_id)));
        if (q.text && sort === 'relevance' && type !== 'post') items = items.map((it, idx) => ({ it, idx, s: scoreItem(it, q.text) })).sort((a, b) => b.s - a.s || a.idx - b.idx).map((x) => x.it);
        return { type, items, hasMore } as SearchSection;
      } catch (e) {
        failed.push(type);
        return { type, items: [], hasMore: false } as SearchSection;
      }
    }),
  );

  const sections = settled.filter((s) => s.items.length > 0);
  return {
    sections,
    items: sections.flatMap((s) => s.items),
    hasMore: single ? sections.some((s) => s.hasMore) : false,
    failed,
  };
};

/**
 * Explore with no query: a stable, mixed feed (one item from each type in turn) instead of a random shuffle,
 * so the grid does not reorder itself on every reload.
 */
export const interleaveSections = (sections: SearchSection[]): any[] => {
  const out: any[] = [];
  const max = Math.max(0, ...sections.map((s) => s.items.length));
  for (let i = 0; i < max; i++) for (const s of sections) if (s.items[i]) out.push(s.items[i]);
  return out;
};

// ── recent searches (storage is per app: pass the get/set) ─────────────────────────────────────────────────────

export const MAX_RECENT_SEARCHES = 8;

export const pushRecentSearch = (list: string[], term: string): string[] => {
  const t = term.replace(/\s+/g, ' ').trim();
  if (!isSearchable(t)) return list;
  return [t, ...list.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
};

// ── typeahead suggestions ──────────────────────────────────────────────────────────────────────────────────────

export interface SearchSuggestion {
  type: SearchItemType;
  id: string;
  label: string;
  sublabel?: string;
}

/**
 * A few names that START with what was typed (people, projects, rooms, companies, jobs), for the dropdown under the box.
 * Cheap on purpose: prefix matches only, three of each, failures are ignored.
 */
export const suggest = async (client: any, raw: string, isFan: boolean): Promise<SearchSuggestion[]> => {
  const q = parseQuery(raw);
  if (q.isTag || !isSearchable(raw)) return [];
  const t = q.orText;
  if (t.length < MIN_QUERY_LENGTH) return [];
  const run = async (fn: () => Promise<any>): Promise<any[]> => {
    try {
      const { data, error } = await fn();
      return error ? [] : asArray(data);
    } catch {
      return [];
    }
  };
  const [people, rooms, projects, companies, jobs] = await Promise.all([
    run(() => client.from('profiles').select('id, username, full_name, craft').or(`username.ilike.${t}%,full_name.ilike.${t}%`).limit(3)),
    run(() => client.from('discussion_rooms').select('id, title').ilike('title', `${q.like}%`).limit(3)),
    isFan ? Promise.resolve([]) : run(() => client.from('projects').select('id, title').ilike('title', `${q.like}%`).limit(3)),
    isFan ? Promise.resolve([]) : run(() => client.from('company_pages').select('id, name').ilike('name', `${q.like}%`).limit(3)),
    isFan ? Promise.resolve([]) : run(() => client.from('jobs').select('id, title, company').eq('is_active', true).eq('is_draft', false).ilike('title', `${q.like}%`).limit(3)),
  ]);
  return [
    ...people.map((p: any) => ({ type: 'user' as const, id: p.id, label: p.full_name || p.username, sublabel: p.craft || (p.username ? `@${p.username}` : undefined) })),
    ...projects.map((p: any) => ({ type: 'project' as const, id: p.id, label: p.title, sublabel: 'Project' })),
    ...companies.map((p: any) => ({ type: 'company' as const, id: p.id, label: p.name, sublabel: 'Company' })),
    ...jobs.map((p: any) => ({ type: 'job' as const, id: p.id, label: p.title, sublabel: p.company || 'Job' })),
    ...rooms.map((p: any) => ({ type: 'discussion' as const, id: p.id, label: p.title, sublabel: 'Discussion' })),
  ].filter((x) => x.label).slice(0, 8);
};

// ── saved searches (table: saved_searches, part AP) ────────────────────────────────────────────────────────────

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  category: SearchCategoryId;
  filters: { sort?: SearchSort; verifiedOnly?: boolean; craft?: string; listingType?: 'equipment' | 'location' };
}

/** `unavailable` is true until the SQL has been run, so the screens can simply hide the feature. */
export const listSavedSearches = async (client: any, meId: string | null | undefined): Promise<{ items: SavedSearch[]; unavailable: boolean }> => {
  if (!meId) return { items: [], unavailable: false };
  try {
    const { data, error } = await client.from('saved_searches').select('id, name, query, category, filters').eq('user_id', meId).order('created_at', { ascending: false }).limit(20);
    if (error) return { items: [], unavailable: true };
    return { items: asArray(data) as SavedSearch[], unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
};

export const saveSearch = async (client: any, meId: string, s: Omit<SavedSearch, 'id'>): Promise<SavedSearch> => {
  const name = s.name.replace(/\s+/g, ' ').trim().slice(0, 60);
  const { data, error } = await client
    .from('saved_searches')
    .insert({ user_id: meId, name, query: s.query.slice(0, 120), category: s.category, filters: s.filters })
    .select('id, name, query, category, filters')
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new Error('You already saved a search with this name.');
    throw new Error(error.message || 'Could not save this search.');
  }
  return data as SavedSearch;
};

export const deleteSavedSearch = async (client: any, id: string): Promise<void> => {
  const { error } = await client.from('saved_searches').delete().eq('id', id);
  if (error) throw new Error(error.message || 'Could not remove this search.');
};

/** Crafts offered as a filter on the People tab (the same list people choose from when they sign up). */
export const SEARCH_CRAFTS = [
  'Director', 'Producer', 'Actor', 'Cinematographer', 'Editor', 'Writer', 'Sound Designer', 'Production Designer',
  'Costume Designer', 'Makeup Artist', 'VFX Artist', 'Composer', 'Gaffer', 'Grip',
];
