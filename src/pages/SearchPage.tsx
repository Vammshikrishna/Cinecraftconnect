
import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Compass } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { ExploreGrid } from '@/components/search/ExploreGrid';
import { ExploreItem, ExploreItemType } from '@/components/search/ExploreCard';
import { PageHeader } from '@/components/common/PageHeader';
import { motion } from 'framer-motion';
import { useAccountType } from '@/hooks/useAccountType';

// Basic type definitions for search results
interface ProjectResult {
    id: string;
    title: string;
    description: string;
    type: 'project';
}

interface UserResult {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | undefined;
    is_verified?: boolean;
    type: 'user';
}

interface DiscussionResult {
    id: string;
    title: string;
    description: string;
    type: 'discussion';
}

interface PostResult {
    id: string;
    content: string;
    image_url?: string;
    video_url?: string;
    like_count?: number;
    comment_count?: number;
    author: {
        username: string;
        full_name: string;
        is_verified?: boolean;
    } | null;
    type: 'post';
}

interface AnnouncementResult {
    id: string;
    title: string;
    content: string;
    type: 'announcement';
}

interface VendorResult {
    id: string;
    business_name: string;
    description: string;
    logo_url: string | undefined;
    city: string | undefined;
    category: string | undefined;
    phone: string | undefined;
    email: string | undefined;
    type: 'vendor';
}

interface MarketplaceResult {
    id: string;
    title: string;
    description: string;
    image_url?: string;
    price_per_day: number;
    listing_type: 'equipment' | 'location';
    average_rating: number;
    review_count: number;
    type: 'marketplace';
}

interface CompanyResult {
    id: string;
    name: string;
    description: string;
    logo_url: string | undefined;
    industry: string | undefined;
    location: string | undefined;
    type: 'company';
}

type SearchResult = ProjectResult | UserResult | DiscussionResult | PostResult | AnnouncementResult | VendorResult | MarketplaceResult | CompanyResult;

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

const SearchPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const initialCategory = searchParams.get('category') || 'all';

    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [exploreItems, setExploreItems] = useState<ExploreItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState(initialCategory);
    const { push } = useAppNavigation();
    const { isFan } = useAccountType();

    const availableCategories = CATEGORIES.filter(c => {
        if (!isFan) return true;
        return ['all', 'people', 'discussions', 'posts'].includes(c.id);
    });

    const fetchExploreItems = useCallback(async () => {
        setLoading(true);
        try {
            const promises = [
                isFan ? Promise.resolve({ data: null, error: null }) : supabase.from('projects').select('id, title, description, status, location, genre, image_url').limit(12),
                supabase.from('profiles').select('id, username, full_name, avatar_url, is_verified, craft, bio').limit(12),
                supabase.from('discussion_rooms').select('id, title, description').limit(12),
                supabase.from('posts').select('id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name, is_verified)').order('created_at', { ascending: false }).limit(32),
                isFan ? Promise.resolve({ data: null, error: null }) : supabase.rpc('search_vendors', { search_query: '', filter_category: undefined, filter_location: undefined, verified_only: false }).limit(12),
                isFan ? Promise.resolve({ data: null, error: null }) : supabase.rpc('search_marketplace_listings', { search_query: '', filter_type: undefined, filter_category: undefined, filter_location: undefined, min_price: undefined, max_price: undefined }).limit(12),
                isFan ? Promise.resolve({ data: null, error: null }) : supabase.from('company_pages').select('id, name, description, tagline, industry, headquarters, logo_url').limit(12)
            ];

            const results = await Promise.allSettled(promises as any[]);

            const items: ExploreItem[] = [];

            const getData = (result: any): any[] | null => {
                if (result.status === 'fulfilled' && result.value?.data) return result.value.data as any[];
                return null;
            };

            const projects = getData(results[0]);
            const users = getData(results[1]);
            const discussions = getData(results[2]);
            const posts = getData(results[3]);
            const vendors = getData(results[4]);
            const marketplace = getData(results[5]);
            const companies = getData(results[6]);

            if (projects) items.push(...projects.map((p: any) => ({ ...p, title: p.title, name: p.title, description: p.description || undefined, location: p.location, genre: p.genre, status: p.status, image_url: p.image_url, type: 'project' as const })));
            if (users) items.push(...users.map((u: any) => ({ ...u, id: u.id, username: u.username || '', full_name: u.full_name || '', avatar_url: u.avatar_url || undefined, is_verified: u.is_verified, craft: u.craft, description: u.bio || undefined, type: 'user' as const })));
            if (discussions) items.push(...discussions.map((d: any) => ({ ...d, description: d.description || undefined, type: 'discussion' as const })));
            if (posts) items.push(...posts.map((p: any) => ({
                id: p.id,
                content: p.content,
                image_url: p.media_type === 'image' ? p.media_url : undefined,
                video_url: p.media_type === 'video' ? p.media_url : undefined,
                like_count: p.like_count || 0,
                comment_count: p.comment_count || 0,
                author: p.author ? (Array.isArray(p.author) ? p.author[0] : p.author) : null,
                type: 'post' as const
            })));
            if (vendors) items.push(...vendors.map((v: any) => ({
                ...v,
                description: v.description || undefined,
                logo_url: v.logo_url || undefined,
                category: v.category || v.specialization,
                city: v.city || v.location,
                phone: v.phone,
                email: v.email,
                type: 'vendor' as const
            })));
            if (marketplace) items.push(...marketplace.map((m: any) => ({
                ...m,
                description: m.description || undefined,
                image_url: m.image_url || (m.images?.[0]) || (m.listing_images?.[0]),
                listing_type: m.listing_type as 'equipment' | 'location',
                type: 'marketplace' as const
            })));
            if (companies) items.push(...companies.map((c: any) => ({
                ...c,
                description: c.description || c.tagline || undefined,
                location: c.headquarters,
                industry: Array.isArray(c.industry) ? c.industry[0] : c.industry,
                type: 'company' as const
            })));

            setExploreItems(items.sort(() => Math.random() - 0.5));
        } catch (error) {
            console.error('Error fetching explore items:', error);
        } finally {
            setLoading(false);
        }
    }, [isFan]);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const { data: skillMatches } = await (supabase
              .from('user_skills' as any)
              .select('user_id')
              .ilike('skill_name', `%${searchQuery}%`) as any);
            
            const matchingIds = skillMatches ? skillMatches.map((m: any) => m.user_id) : [];
            let profilesFilter = `username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`;
            if (matchingIds.length > 0) {
              profilesFilter += `,id.in.(${matchingIds.join(',')})`;
            }

            const promises = [
                isFan ? Promise.resolve({ data: null, error: null }) : supabase.from('projects').select('id, title, description, status, location, genre, image_url').or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`).limit(10),
                supabase.from('profiles').select('id, username, full_name, avatar_url, is_verified, craft, bio').or(profilesFilter).limit(10),
                supabase.from('discussion_rooms').select('id, title, description').or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`).limit(10),
                (() => {
                    let q = supabase
                        .from('posts')
                        .select('id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name, is_verified)');
                    
                    if (searchQuery.startsWith('#')) {
                        const cleanTag = searchQuery.substring(1).toLowerCase();
                        return q.or(`tags.cs.{${cleanTag}},content.ilike.%${searchQuery}%`).limit(24);
                    }
                    return q.ilike('content', `%${searchQuery}%`).limit(24);
                })(),
                supabase.from('announcements').select('id, title, content').or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`).limit(10),
                isFan ? Promise.resolve({ data: null, error: null }) : supabase.rpc('search_vendors', { search_query: searchQuery, filter_category: undefined, filter_location: undefined, verified_only: false }).limit(10),
                isFan ? Promise.resolve({ data: null, error: null }) : supabase.rpc('search_marketplace_listings', { search_query: searchQuery, filter_category: undefined, filter_location: undefined, min_price: undefined, max_price: undefined }).limit(10),
                isFan ? Promise.resolve({ data: null, error: null }) : supabase.from('company_pages').select('id, name, description, tagline, industry, headquarters, logo_url').or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,tagline.ilike.%${searchQuery}%`).limit(10)
            ];

            const results = await Promise.allSettled(promises as any[]);

            const getData = (result: any): any[] | null => {
                if (result.status === 'fulfilled' && result.value?.data) return result.value.data as any[];
                return null;
            };

            const projectsData = getData(results[0]);
            const usersData = getData(results[1]);
            const discussionsData = getData(results[2]);
            const postsData = getData(results[3]);
            const announcementsData = getData(results[4]);
            const vendorsData = getData(results[5]);
            const marketplaceData = getData(results[6]);
            const companiesData = getData(results[7]);

            const projects = (projectsData || []).map((p: any) => ({ ...p, id: p.id, title: p.title, description: p.description || '', location: p.location, genre: p.genre, status: p.status, image_url: p.image_url, type: 'project' as const }));
            const users = (usersData || []).map((u: any) => ({ ...u, id: u.id, username: u.username || '', full_name: u.full_name || '', avatar_url: u.avatar_url || undefined, is_verified: u.is_verified, craft: u.craft, description: u.bio || undefined, type: 'user' as const }));
            const discussions = (discussionsData || []).map((d: any) => ({ ...d, id: d.id, title: d.title, name: d.title, description: d.description || '', type: 'discussion' as const }));
            const posts = (postsData || []).map((p: any) => ({ id: p.id, content: p.content, image_url: p.media_type === 'image' ? p.media_url : undefined, video_url: p.media_type === 'video' ? p.media_url : undefined, like_count: p.like_count || 0, comment_count: p.comment_count || 0, author: p.author ? (Array.isArray(p.author) ? p.author[0] : p.author) : null, type: 'post' as const }));
            const announcements = (announcementsData || []).map((a: any) => ({ id: a.id, title: a.title, content: a.content, type: 'announcement' as const }));
            const vendors = (vendorsData || []).map((v: any) => ({ ...v, id: v.id, business_name: v.business_name, logo_url: v.logo_url || undefined, category: v.category || v.specialization, city: v.city || v.location, type: 'vendor' as const }));
            const marketplace = (marketplaceData || []).map((m: any) => ({ ...m, id: m.id, title: m.title, description: m.description, image_url: m.image_url || (m.images?.[0]) || (m.listing_images?.[0]), price_per_day: m.price_per_day, listing_type: m.listing_type as 'equipment' | 'location', type: 'marketplace' as const }));
            const companies = (companiesData || []).map((c: any) => ({ ...c, id: c.id, name: c.name, description: c.description || c.tagline || '', industry: Array.isArray(c.industry) ? c.industry[0] : c.industry, location: c.headquarters, logo_url: c.logo_url || undefined, type: 'company' as const }));

            setResults([...projects, ...users, ...discussions, ...posts, ...announcements, ...vendors, ...marketplace, ...companies]);
        } catch (error) {
            console.error('Error during search:', error);
        } finally {
            setLoading(false);
        }
    }, [isFan]);

    useEffect(() => {
        if (initialQuery) performSearch(initialQuery);
        else fetchExploreItems();

        if (initialCategory !== activeCategory) {
            setActiveCategory(initialCategory);
        }
    }, [initialQuery, initialCategory, performSearch, fetchExploreItems]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setQuery(newQuery);
        const params: Record<string, string> = {};
        if (newQuery) params.q = newQuery;
        if (activeCategory !== 'all') params.category = activeCategory;
        setSearchParams(params);

        if (newQuery) performSearch(newQuery);
        else fetchExploreItems();
    };

    const handleCategoryChange = (catId: string) => {
        const newCategory = activeCategory === catId ? 'all' : catId;
        setActiveCategory(newCategory);
        const params: Record<string, string> = {};
        if (query) params.q = query;
        if (newCategory !== 'all') params.category = newCategory;
        setSearchParams(params);
    };

    const filteredExploreItems = activeCategory === 'all' ? exploreItems : exploreItems.filter(item => item.type === CATEGORIES.find(c => c.id === activeCategory)?.type);
    const filteredSearchResults = activeCategory === 'all' ? results : results.filter(result => result.type === CATEGORIES.find(c => c.id === activeCategory)?.type);

    return (
        <div className="min-h-screen bg-background selection:bg-primary/30">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[120px]" />
            </div>

            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-40 relative z-10">
                <PageHeader
                    title="Discovery"
                    subtitle="Global content grid synchronization engine. Find production partners, projects, and gear."
                    Icon={Compass}
                    onBack={() => push('/feed', { noScroll: true })}
                    actions={
                        <Compass className="text-primary/20 animate-spin-slow hidden md:block" size={48} />
                    }
                />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative max-w-2xl mx-auto mt-6 mb-8 group"
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                    <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/60 group-focus-within:text-primary transition-colors duration-300" size={20} />
                        <Input
                            type="search"
                            placeholder={isFan ? "Search people, posts, discussions..." : "Search projects, people, posts..."}
                            className="pl-14 pr-6 py-6 text-base w-full bg-card/60 backdrop-blur-xl border border-border/50 focus:border-primary/50 rounded-2xl transition-all shadow-xl font-medium tracking-tight placeholder:text-muted-foreground/40 focus:ring-4 focus:ring-primary/5"
                            value={query}
                            onChange={handleSearch}
                            autoFocus={!query}
                        />
                    </div>
                </motion.div>

                <div className="flex gap-3 overflow-x-auto py-4 mb-8 max-w-full mx-auto no-scrollbar justify-start md:justify-center px-4">
                    {availableCategories.map(category => (
                        <button
                            key={category.id}
                            onClick={() => handleCategoryChange(category.id)}
                            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${activeCategory === category.id
                                    ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] scale-105'
                                    : 'bg-card/40 backdrop-blur-md border border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                                }`}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    {loading && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-w-7xl mx-auto">
                            {[...Array(18)].map((_, i) => (
                                <div key={i} className={`aspect-[4/5] bg-card/40 border border-border/50 animate-pulse rounded-2xl ${i % 10 === 0 ? 'col-span-2 row-span-2' : ''}`} />
                            ))}
                        </div>
                    )}

                    {!loading && !query && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="flex items-center gap-3 mb-10 border-b border-border/20 pb-6">
                                <Compass className="text-primary" size={28} />
                                <h2 className="text-2xl font-black uppercase tracking-tight">Synchronized Discovery Feed</h2>
                            </div>
                            <ExploreGrid items={filteredExploreItems} />
                        </div>
                    )}

                    {!loading && query.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="flex items-center justify-between mb-10 border-b border-border/20 pb-6">
                                <div className="flex items-center gap-3">
                                    <Search className="text-primary" size={28} />
                                    <h2 className="text-2xl font-black uppercase tracking-tight">Matches for "{query}"</h2>
                                </div>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-5 py-2.5 rounded-full border border-border/50 backdrop-blur-md">
                                    {filteredSearchResults.length} Results Found
                                </span>
                            </div>
                            <ExploreGrid items={filteredSearchResults} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );

};

export default SearchPage;
