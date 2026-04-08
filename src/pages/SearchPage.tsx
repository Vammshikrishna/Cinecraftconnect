import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft, Compass } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ExploreGrid } from '@/components/search/ExploreGrid';
import { ExploreItem, ExploreItemType } from '@/components/search/ExploreCard';

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

type SearchResult = ProjectResult | UserResult | DiscussionResult | PostResult | AnnouncementResult | VendorResult | MarketplaceResult;

const CATEGORIES: { id: string; label: string; type?: ExploreItemType }[] = [
    { id: 'all', label: 'All' },
    { id: 'projects', label: 'Projects', type: 'project' },
    { id: 'people', label: 'People', type: 'user' },
    { id: 'discussions', label: 'Discussions', type: 'discussion' },
    { id: 'posts', label: 'Posts', type: 'post' },
    { id: 'vendors', label: 'Vendors', type: 'vendor' },
    { id: 'marketplace', label: 'Marketplace', type: 'marketplace' },
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
    const navigate = useNavigate();

    const fetchExploreItems = useCallback(async () => {
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                supabase.from('projects').select('id, title, description, status, location, genre, image_url').limit(12),
                supabase.from('discussion_rooms').select('id, title, description, name').limit(12),
                supabase.from('posts').select('id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name)').order('created_at', { ascending: false }).limit(32),
                supabase.rpc('search_vendors', { search_query: '', filter_category: undefined, filter_location: undefined, verified_only: false }).limit(12),
                supabase.rpc('search_marketplace_listings', { search_query: '', filter_type: undefined, filter_category: undefined, filter_location: undefined, min_price: undefined, max_price: undefined }).limit(12)
            ]);

            const items: ExploreItem[] = [];

            const getData = <T,>(result: PromiseSettledResult<{ data: T | null, error: any }>) => {
                if (result.status === 'fulfilled' && result.value.data) return result.value.data;
                return null;
            };

            const projects = getData(results[0]);
            const discussions = getData(results[1]);
            const posts = getData(results[2]);
            const vendors = getData(results[3]);
            const marketplace = getData(results[4]);

            if (projects) items.push(...projects.map((p: any) => ({ ...p, title: p.title, name: p.title, description: p.description || undefined, location: p.location, genre: p.genre, status: p.status, image_url: p.image_url, type: 'project' as const })));
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

            setExploreItems(items.sort(() => Math.random() - 0.5));
        } catch (error) {
            console.error('Error fetching explore items:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                supabase.from('projects').select('id, title, description, status, location, genre, image_url').or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`).limit(10),
                supabase.from('profiles').select('id, username, full_name, avatar_url').or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`).limit(10),
                supabase.from('discussion_rooms').select('id, title, description, name').or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`).limit(10),
                supabase.from('posts').select('id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name)').ilike('content', `%${searchQuery}%`).limit(24),
                supabase.from('announcements').select('id, title, content').or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`).limit(10),
                supabase.rpc('search_vendors', { search_query: searchQuery, filter_category: undefined, filter_location: undefined, verified_only: false }).limit(10),
                supabase.rpc('search_marketplace_listings', { search_query: searchQuery, filter_type: undefined, filter_category: undefined, filter_location: undefined, min_price: undefined, max_price: undefined }).limit(10)
            ]);

            const getData = <T,>(result: PromiseSettledResult<{ data: T | null, error: any }>) => {
                if (result.status === 'fulfilled' && result.value.data) return result.value.data;
                return null;
            };

            const projectsData = getData(results[0]);
            const usersData = getData(results[1]);
            const discussionsData = getData(results[2]);
            const postsData = getData(results[3]);
            const announcementsData = getData(results[4]);
            const vendorsData = getData(results[5]);
            const marketplaceData = getData(results[6]);

            const projects = (projectsData || []).map((p: any) => ({ ...p, id: p.id, title: p.title, description: p.description || '', location: p.location, genre: p.genre, status: p.status, image_url: p.image_url, type: 'project' as const }));
            const users = (usersData || []).map((u: any) => ({ ...u, id: u.id, username: u.username || '', full_name: u.full_name || '', avatar_url: u.avatar_url || undefined, type: 'user' as const }));
            const discussions = (discussionsData || []).map((d: any) => ({ ...d, id: d.id, title: d.title, name: d.name, description: d.description || '', type: 'discussion' as const }));
            const posts = (postsData || []).map((p: any) => ({ id: p.id, content: p.content, image_url: p.media_type === 'image' ? p.media_url : undefined, video_url: p.media_type === 'video' ? p.media_url : undefined, like_count: p.like_count || 0, comment_count: p.comment_count || 0, author: p.author ? (Array.isArray(p.author) ? p.author[0] : p.author) : null, type: 'post' as const }));
            const announcements = (announcementsData || []).map((a: any) => ({ id: a.id, title: a.title, content: a.content, type: 'announcement' as const }));
            const vendors = (vendorsData || []).map((v: any) => ({ ...v, id: v.id, business_name: v.business_name, logo_url: v.logo_url || undefined, category: v.category || v.specialization, city: v.city || v.location, type: 'vendor' as const }));
            const marketplace = (marketplaceData || []).map((m: any) => ({ ...m, id: m.id, title: m.title, description: m.description, image_url: m.image_url || (m.images?.[0]) || (m.listing_images?.[0]), price_per_day: m.price_per_day, listing_type: m.listing_type as 'equipment' | 'location', type: 'marketplace' as const }));

            setResults([...projects, ...users, ...discussions, ...posts, ...announcements, ...vendors, ...marketplace]);
        } catch (error) {
            console.error('Error during search:', error);
        } finally {
            setLoading(false);
        }
    }, []);


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
        <div className="min-h-screen bg-background pt-24 pb-24 px-4 md:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-primary/10 transition-colors">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Discovery</h1>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1 ml-0.5 opacity-70">Global Content Grid</p>
                        </div>
                    </div>
                    <Compass className="text-primary/20 animate-spin-slow" size={32} />
                </div>

                <div className="relative max-w-2xl mx-auto mt-8 mb-4">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary" size={24} />
                    <Input 
                        type="search" 
                        placeholder="SEARCH PROJECTS, PEOPLE, POSTS..." 
                        className="pl-16 pr-6 py-8 text-xl w-full bg-card border-2 border-white/5 focus:border-primary/50 rounded-[2rem] transition-all shadow-2xl font-black uppercase tracking-tighter" 
                        value={query} 
                        onChange={handleSearch} 
                        autoFocus={!query} 
                    />
                </div>

                <div className="flex gap-3 overflow-x-auto py-4 mb-2 max-w-full mx-auto no-scrollbar justify-start md:justify-center px-4">
                    {CATEGORIES.map(category => (
                        <button 
                            key={category.id} 
                            onClick={() => handleCategoryChange(category.id)} 
                            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${
                                activeCategory === category.id 
                                ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] scale-105' 
                                : 'bg-card border border-white/5 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                            }`}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    {loading && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-w-7xl mx-auto">
                            {[...Array(18)].map((_, i) => (
                                <div key={i} className={`aspect-[4/5] bg-white/5 animate-pulse rounded-xl ${i % 10 === 0 ? 'col-span-2 row-span-2' : ''}`} />
                            ))}
                        </div>
                    )}

                    {!loading && !query && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                                <Compass className="text-primary" size={28} />
                                <h2 className="text-2xl font-black uppercase tracking-tight">Featured Discovery</h2>
                            </div>
                            <ExploreGrid items={filteredExploreItems} />
                        </div>
                    )}

                    {!loading && query.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <Search className="text-primary" size={28} />
                                    <h2 className="text-2xl font-black uppercase tracking-tight">Results for "{query}"</h2>
                                </div>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-4 py-2 rounded-full">
                                    {filteredSearchResults.length} Matches
                                </span>
                            </div>
                            <ExploreGrid items={filteredSearchResults} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

};

export default SearchPage;
