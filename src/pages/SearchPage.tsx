import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft, MessageSquare, FileText, Megaphone, Building2, ShoppingBag, Star, Compass } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ExploreGrid } from '@/components/search/ExploreGrid';
import { ExploreItem, ExploreItemType } from '@/components/search/ExploreCard';

// Basic type definitions for search results
interface ProjectResult {
    id: string;
    name: string;
    description: string;
    type: 'project';
}

interface UserResult {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
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
    logo_url: string | null;
    location: string;
    average_rating: number;
    review_count: number;
    type: 'vendor';
}

interface MarketplaceResult {
    id: string;
    title: string;
    description: string;
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
            // Fetch a mix of recent content for the explore page
            const results = await Promise.allSettled([
                supabase.from('project_spaces').select('id, name, description').limit(6),
                supabase.from('discussion_rooms').select('id, title, description').limit(6),
                supabase.from('posts').select('id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name)').limit(18),
                supabase.rpc('search_vendors', { search_query: '', filter_category: undefined, filter_location: undefined, verified_only: false }).limit(6),
                supabase.rpc('search_marketplace_listings', { search_query: '', filter_type: undefined, filter_category: undefined, filter_location: undefined, min_price: undefined, max_price: undefined }).limit(6)
            ]);

            const items: ExploreItem[] = [];

            // Helper to get data from settled promise
            const getData = <T,>(result: PromiseSettledResult<{ data: T | null, error: any }>) => {
                if (result.status === 'fulfilled' && result.value.data) {
                    return result.value.data;
                }
                if (result.status === 'rejected') {
                    console.error('Error in explore fetch:', result.reason);
                } else if (result.status === 'fulfilled' && result.value.error) {
                    console.error('Error in explore fetch (supabase):', result.value.error);
                }
                return null;
            };

            const projects = getData(results[0]);
            const discussions = getData(results[1]);
            const posts = getData(results[2]);
            const vendors = getData(results[3]);
            const marketplace = getData(results[4]);

            if (projects) items.push(...projects.map((p: any) => ({ ...p, description: p.description || undefined, type: 'project' as const })));
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
            if (vendors) items.push(...vendors.map((v: any) => ({ ...v, description: v.description || undefined, logo_url: v.logo_url || undefined, type: 'vendor' as const })));
            if (marketplace) items.push(...marketplace.map((m: any) => ({ ...m, description: m.description || undefined, listing_type: m.listing_type as 'equipment' | 'location', type: 'marketplace' as const })));

            // Shuffle items for a "discovery" feel
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
                supabase.from('project_spaces')
                    .select('id, name, description')
                    .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
                    .limit(5),
                supabase.from('profiles')
                    .select('id, username, full_name, avatar_url')
                    .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
                    .limit(5),
                supabase.from('discussion_rooms')
                    .select('id, title, description')
                    .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
                    .limit(5),
                supabase.from('posts')
                    .select('id, content, media_url, media_type, like_count, comment_count, author:profiles(username, full_name)')
                    .ilike('content', `%${searchQuery}%`)
                    .limit(18),
                supabase.from('announcements')
                    .select('id, title, content')
                    .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
                    .limit(5),
                supabase.rpc('search_vendors', {
                    search_query: searchQuery,
                    filter_category: undefined,
                    filter_location: undefined,
                    verified_only: false
                }).limit(5),
                supabase.rpc('search_marketplace_listings', {
                    search_query: searchQuery,
                    filter_type: undefined,
                    filter_category: undefined,
                    filter_location: undefined,
                    min_price: undefined,
                    max_price: undefined
                }).limit(5)
            ]);

            // Helper to get data from settled promise
            const getData = <T,>(result: PromiseSettledResult<{ data: T | null, error: any }>) => {
                if (result.status === 'fulfilled' && result.value.data) {
                    return result.value.data;
                }
                if (result.status === 'rejected') {
                    console.error('Error in search fetch:', result.reason);
                } else if (result.status === 'fulfilled' && result.value.error) {
                    console.error('Error in search fetch (supabase):', result.value.error);
                }
                return null;
            };

            const projectsData = getData(results[0]);
            const usersData = getData(results[1]);
            const discussionsData = getData(results[2]);
            const postsData = getData(results[3]);
            const announcementsData = getData(results[4]);
            const vendorsData = getData(results[5]);
            const marketplaceData = getData(results[6]);

            const projects = (projectsData || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description || '',
                type: 'project' as const
            }));

            const users = (usersData || []).map((u: any) => ({
                id: u.id,
                username: u.username || '',
                full_name: u.full_name || '',
                avatar_url: u.avatar_url || '',
                type: 'user' as const
            }));

            const discussions = (discussionsData || []).map((d: any) => ({
                id: d.id,
                title: d.title,
                description: d.description || '',
                type: 'discussion' as const
            }));

            const posts = (postsData || []).map((p: any) => ({
                id: p.id,
                content: p.content,
                image_url: p.media_type === 'image' ? p.media_url : undefined,
                video_url: p.media_type === 'video' ? p.media_url : undefined,
                like_count: p.like_count || 0,
                comment_count: p.comment_count || 0,
                author: p.author ? (Array.isArray(p.author) ? p.author[0] : p.author) : null,
                type: 'post' as const
            }));

            const announcements = (announcementsData || []).map((a: any) => ({
                id: a.id,
                title: a.title,
                content: a.content,
                type: 'announcement' as const
            }));

            const vendors = (vendorsData || []).map((v: any) => ({
                id: v.id,
                business_name: v.business_name,
                description: v.description,
                logo_url: v.logo_url,
                location: v.location,
                average_rating: v.average_rating || 0,
                review_count: v.review_count || 0,
                type: 'vendor' as const
            }));

            const marketplace = (marketplaceData || []).map((m: any) => ({
                id: m.id,
                title: m.title,
                description: m.description,
                price_per_day: m.price_per_day,
                listing_type: m.listing_type as 'equipment' | 'location',
                average_rating: m.average_rating || 0,
                review_count: m.review_count || 0,
                type: 'marketplace' as const
            }));

            setResults([...projects, ...users, ...discussions, ...posts, ...announcements, ...vendors, ...marketplace]);
        } catch (error) {
            console.error('Error during search:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialQuery) {
            performSearch(initialQuery);
        } else {
            fetchExploreItems();
        }
    }, [initialQuery, performSearch, fetchExploreItems]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setQuery(newQuery);
        setSearchParams(newQuery ? { q: newQuery } : {});
        if (newQuery) {
            performSearch(newQuery);
        } else {
            fetchExploreItems();
        }
    };

    const filteredExploreItems = activeCategory === 'all'
        ? exploreItems
        : exploreItems.filter(item => item.type === CATEGORIES.find(c => c.id === activeCategory)?.type);

    const filteredSearchResults = activeCategory === 'all'
        ? results
        : results.filter(result => result.type === CATEGORIES.find(c => c.id === activeCategory)?.type);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-2xl font-bold">Search & Explore</h1>
                </div>

                <div className="relative max-w-3xl mx-auto">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <Input
                        type="search"
                        placeholder="Search for projects, people, discussions, vendors..."
                        className="pl-12 pr-4 py-6 text-lg w-full bg-card border-border rounded-xl focus:ring-2 focus:ring-primary/50 transition-all"
                        value={query}
                        onChange={handleSearch}
                        autoFocus={!query}
                    />
                </div>

                {/* Category Pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 max-w-3xl mx-auto no-scrollbar">
                    {CATEGORIES.map(category => (
                        <button
                            key={category.id}
                            onClick={() => setActiveCategory(category.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeCategory === category.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    {loading && <div className="text-center py-8 text-muted-foreground">Loading...</div>}

                    {!loading && !query && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 mb-6">
                                <Compass className="text-primary" size={24} />
                                <h2 className="text-xl font-semibold">Explore</h2>
                            </div>
                            <ExploreGrid items={filteredExploreItems} />
                        </div>
                    )}

                    {!loading && query.length > 1 && filteredSearchResults.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">No results found for "{query}"</div>
                    )}

                    {!loading && query.length > 0 && (
                        <div className="grid gap-4 max-w-3xl mx-auto">
                            {filteredSearchResults.map(result => (
                                <div key={`${result.type}-${result.id}`} className="glass-card p-4 rounded-xl hover:bg-accent/5 transition-colors">
                                    {result.type === 'project' && (
                                        <Link to={`/projects/${result.id}/space`} className="block">
                                            <div className="flex items-start gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                    <Search size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{result.name}</h3>
                                                    <p className="text-muted-foreground line-clamp-2">{result.description}</p>
                                                    <span className="inline-block mt-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Project</span>
                                                </div>
                                            </div>
                                        </Link>
                                    )}

                                    {result.type === 'user' && (
                                        <Link to={`/profile/${result.id}`} className="block">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-12 w-12">
                                                    <AvatarImage src={result.avatar_url} />
                                                    <AvatarFallback>{result.username?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{result.full_name || result.username}</h3>
                                                    <p className="text-muted-foreground">@{result.username}</p>
                                                    <span className="inline-block mt-2 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">User</span>
                                                </div>
                                            </div>
                                        </Link>
                                    )}

                                    {result.type === 'discussion' && (
                                        <Link to={`/discussion-rooms/${result.id}`} className="block">
                                            <div className="flex items-start gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                                                    <MessageSquare size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{result.title}</h3>
                                                    <p className="text-muted-foreground line-clamp-2">{result.description}</p>
                                                    <span className="inline-block mt-2 text-xs bg-purple-500/10 text-purple-500 px-2 py-1 rounded-full">Discussion Room</span>
                                                </div>
                                            </div>
                                        </Link>
                                    )}

                                    {result.type === 'post' && (
                                        <Link to={`/feed?highlight=${result.id}`} className="block">
                                            <div className="flex items-start gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0 overflow-hidden">
                                                    {result.video_url ? (
                                                        <video src={result.video_url} className="w-full h-full object-cover" muted />
                                                    ) : result.image_url ? (
                                                        <img src={result.image_url} alt="Post content" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileText size={24} />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium line-clamp-2">{result.content}</p>
                                                    {result.author && (
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            By {result.author.full_name || result.author.username}
                                                        </p>
                                                    )}
                                                    <span className="inline-block mt-2 text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded-full">Post</span>
                                                </div>
                                            </div>
                                        </Link>
                                    )}

                                    {result.type === 'announcement' && (
                                        <div className="flex items-start gap-4">
                                            <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                                                <Megaphone size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg">{result.title}</h3>
                                                <p className="text-muted-foreground line-clamp-2">{result.content}</p>
                                                <span className="inline-block mt-2 text-xs bg-orange-500/10 text-orange-500 px-2 py-1 rounded-full">Announcement</span>
                                            </div>
                                        </div>
                                    )}

                                    {result.type === 'vendor' && (
                                        <Link to="/vendors" className="block">
                                            <div className="flex items-start gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 overflow-hidden">
                                                    {result.logo_url ? (
                                                        <img src={result.logo_url} alt={result.business_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Building2 size={24} />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{result.business_name}</h3>
                                                    <p className="text-muted-foreground line-clamp-2">{result.description}</p>
                                                    <div className="flex items-center gap-4 mt-2">
                                                        <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-full">Vendor</span>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Building2 size={10} /> {result.location}
                                                        </span>
                                                        {result.average_rating > 0 && (
                                                            <span className="text-xs text-yellow-500 flex items-center gap-1">
                                                                <Star size={10} fill="currentColor" /> {result.average_rating.toFixed(1)} ({result.review_count})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    )}

                                    {result.type === 'marketplace' && (
                                        <Link to="/marketplace" className="block">
                                            <div className="flex items-start gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0">
                                                    <ShoppingBag size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{result.title}</h3>
                                                    <p className="text-muted-foreground line-clamp-2">{result.description}</p>
                                                    <div className="flex items-center gap-4 mt-2">
                                                        <span className="text-xs bg-pink-500/10 text-pink-500 px-2 py-1 rounded-full capitalize">{result.listing_type}</span>
                                                        <span className="text-xs font-medium text-foreground">${result.price_per_day}/day</span>
                                                        {result.average_rating > 0 && (
                                                            <span className="text-xs text-yellow-500 flex items-center gap-1">
                                                                <Star size={10} fill="currentColor" /> {result.average_rating.toFixed(1)} ({result.review_count})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchPage;
