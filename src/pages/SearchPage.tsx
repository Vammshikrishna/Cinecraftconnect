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
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [exploreItems, setExploreItems] = useState<ExploreItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const navigate = useNavigate();

    const fetchExploreItems = useCallback(async () => {
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                supabase.from('projects').select('id, title, description').limit(6),
                supabase.from('discussion_rooms').select('id, title, description').limit(6),
                supabase.from('posts').select('id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name)').limit(18),
                supabase.rpc('search_vendors', { search_query: '', filter_category: undefined, filter_location: undefined, verified_only: false }).limit(6),
                supabase.rpc('search_marketplace_listings', { search_query: '', filter_type: undefined, filter_category: undefined, filter_location: undefined, min_price: undefined, max_price: undefined }).limit(6)
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

            if (projects) items.push(...projects.map((p: any) => ({ ...p, title: p.title, name: p.title, description: p.description || undefined, type: 'project' as const })));
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
                supabase.from('projects').select('id, title, description').or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`).limit(5),
                supabase.from('profiles').select('id, username, full_name, avatar_url').or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`).limit(5),
                supabase.from('discussion_rooms').select('id, title, description').or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`).limit(5),
                supabase.from('posts').select('id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name)').ilike('content', `%${searchQuery}%`).limit(18),
                supabase.from('announcements').select('id, title, content').or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`).limit(5),
                supabase.rpc('search_vendors', { search_query: searchQuery, filter_category: undefined, filter_location: undefined, verified_only: false }).limit(5),
                supabase.rpc('search_marketplace_listings', { search_query: searchQuery, filter_type: undefined, filter_category: undefined, filter_location: undefined, min_price: undefined, max_price: undefined }).limit(5)
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

            const projects = (projectsData || []).map((p: any) => ({ id: p.id, title: p.title, description: p.description || '', type: 'project' as const }));
            const users = (usersData || []).map((u: any) => ({ id: u.id, username: u.username || '', full_name: u.full_name || '', avatar_url: u.avatar_url || undefined, type: 'user' as const }));
            const discussions = (discussionsData || []).map((d: any) => ({ id: d.id, title: d.title, description: d.description || '', type: 'discussion' as const }));
            const posts = (postsData || []).map((p: any) => ({ id: p.id, content: p.content, image_url: p.media_type === 'image' ? p.media_url : undefined, video_url: p.media_type === 'video' ? p.media_url : undefined, like_count: p.like_count || 0, comment_count: p.comment_count || 0, author: p.author ? (Array.isArray(p.author) ? p.author[0] : p.author) : null, type: 'post' as const }));
            const announcements = (announcementsData || []).map((a: any) => ({ id: a.id, title: a.title, content: a.content, type: 'announcement' as const }));
            const vendors = (vendorsData || []).map((v: any) => ({ ...v, id: v.id, business_name: v.business_name, logo_url: v.logo_url || undefined, category: v.category || v.specialization, city: v.city || v.location, type: 'vendor' as const }));
            const marketplace = (marketplaceData || []).map((m: any) => ({ id: m.id, title: m.title, description: m.description, image_url: m.image_url || (m.images?.[0]) || (m.listing_images?.[0]), price_per_day: m.price_per_day, listing_type: m.listing_type as 'equipment' | 'location', type: 'marketplace' as const }));

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
    }, [initialQuery, performSearch, fetchExploreItems]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setQuery(newQuery);
        setSearchParams(newQuery ? { q: newQuery } : {});
        if (newQuery) performSearch(newQuery);
        else fetchExploreItems();
    };

    const filteredExploreItems = activeCategory === 'all' ? exploreItems : exploreItems.filter(item => item.type === CATEGORIES.find(c => c.id === activeCategory)?.type);
    const filteredSearchResults = activeCategory === 'all' ? results : results.filter(result => result.type === CATEGORIES.find(c => c.id === activeCategory)?.type);

    return (
        <div className="min-h-screen bg-background pt-24 pb-24 px-4 md:px-8 lg:px-12">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6" /></Button>
                    <h1 className="text-2xl font-bold">Search & Explore</h1>
                </div>

                <div className="relative max-w-3xl mx-auto mt-8 mb-8">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <Input type="search" placeholder="Search..." className="pl-12 pr-4 py-6 text-lg w-full bg-card border-border rounded-xl focus:ring-1 focus:ring-primary/50 transition-all shadow-sm" value={query} onChange={handleSearch} autoFocus={!query} />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-4 mb-8 max-w-3xl mx-auto no-scrollbar px-1">
                    {CATEGORIES.map(category => (
                        <button key={category.id} onClick={() => setActiveCategory(category.id)} className={`px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${activeCategory === category.id ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{category.label}</button>
                    ))}
                </div>

                <div className="space-y-4">
                    {loading && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-w-7xl mx-auto font-black uppercase">
                            {[...Array(8)].map((_, i) => (<div key={i} className="aspect-[4/5] bg-white/5 animate-pulse rounded-3xl" />))}
                        </div>
                    )}

                    {!loading && !query && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 mb-6"><Compass className="text-primary" size={24} /><h2 className="text-xl font-semibold uppercase tracking-tighter">Explore</h2></div>
                            <ExploreGrid items={filteredExploreItems} />
                        </div>
                    )}

                    {!loading && query.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 mb-6"><Search className="text-primary" size={24} /><h2 className="text-xl font-semibold uppercase tracking-tighter">Results for "{query}"</h2></div>
                            <ExploreGrid items={filteredSearchResults} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchPage;
