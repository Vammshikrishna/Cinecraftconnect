import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { Button } from '@/components/ui/button';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Grid, List as ListIcon, Heart } from 'lucide-react';
import { LazyImage } from '@/components/performance/LazyImage';

interface SharedWishlistItem {
    id: string;
    listing_id: string;
    title: string;
    description: string;
    price_per_day: number;
    images: string[];
    user_id: string;
    owner_profile_id: string;
}

const SharedWishlist = () => {
    const { token } = useParams<{ token: string }>();
    const { goBack, push } = useAppNavigation();
    
    const [items, setItems] = useState<SharedWishlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [userName, setUserName] = useState<string>('User');

    useEffect(() => {
        if (token) {
            fetchSharedWishlist();
        }
    }, [token]);

    const fetchSharedWishlist = async () => {
        if (!token) return;
        try {
            setLoading(true);
            
            // Call the RPC function we created in the migration
            const { data, error } = await (supabase.rpc as any)('get_shared_wishlist', { p_token: token });
            
            if (error) throw error;
            
            const wishlistItems = data as unknown as SharedWishlistItem[];
            setItems(wishlistItems);

            // Fetch the user's name if we got any wishlist items using the owner user_id from items
            if (wishlistItems && wishlistItems.length > 0) {
                const ownerId = wishlistItems[0].user_id;
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name, username')
                    .eq('id', ownerId)
                    .single();
                    
                if (profileData) {
                    setUserName(profileData.full_name || profileData.username || 'User');
                }
            }
        } catch (err: any) {
            console.error('Error fetching shared wishlist:', err);
            setError('Could not load this wishlist. The link may be invalid or expired.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-20 pb-40">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <EnhancedSkeleton className="h-20 w-full mb-8 rounded-2xl" />
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <EnhancedSkeleton key={i} className="h-80 rounded-3xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background pt-32 px-4 flex flex-col items-center">
                <Heart size={48} className="text-muted-foreground/30 mb-6" />
                <h2 className="text-2xl font-black mb-2">Wishlist Unavailable</h2>
                <p className="text-muted-foreground mb-8">{error}</p>
                <Button onClick={() => push('/marketplace')}>Browse Marketplace</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pt-20 pb-40">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <PageHeader
                    title={`${userName}'s Gear Wishlist`}
                    subtitle="Shared equipment list"
                    onBack={() => goBack()}
                />

                <div className="mt-8 flex justify-end items-center mb-6">
                    <div className="flex bg-secondary/30 rounded-xl p-1 border border-border/50">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className={`rounded-lg h-8 w-8 ${viewMode === 'grid' ? 'shadow-sm' : ''}`}
                            onClick={() => setViewMode('grid')}
                        >
                            <Grid size={14} />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            className={`rounded-lg h-8 w-8 ${viewMode === 'list' ? 'shadow-sm' : ''}`}
                            onClick={() => setViewMode('list')}
                        >
                            <ListIcon size={14} />
                        </Button>
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="text-center py-20 bg-secondary/10 rounded-3xl border border-border/50 mt-8">
                        <h3 className="text-xl font-bold text-foreground">This wishlist is empty</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                            The user hasn't saved any gear to their wishlist yet.
                        </p>
                    </div>
                ) : (
                    <div className={
                        viewMode === 'grid'
                            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            : "flex flex-col gap-4"
                    }>
                        {items.map((item) => (
                            <Link 
                                to={`/marketplace/${item.listing_id}`} 
                                key={item.id} 
                                className="no-underline block group h-full cursor-pointer"
                            >
                                <div className="glass-card-premium h-full flex flex-col transition-transform duration-500 hover:-translate-y-2">
                                    <div className="relative aspect-video overflow-hidden bg-muted flex-shrink-0">
                                        {item.images && item.images.length > 0 ? (
                                            <LazyImage
                                                src={item.images[0]}
                                                alt={item.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-secondary/20 text-muted-foreground/50 text-xs font-bold uppercase tracking-widest">
                                                No Image
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-5 flex flex-col flex-1 gap-2">
                                        <h3 className="font-black text-lg tracking-tight text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {item.description}
                                        </p>
                                        <div className="mt-auto pt-4 flex items-baseline gap-1 text-primary">
                                            <span className="text-sm font-bold">₹</span>
                                            <span className="text-xl font-black">{item.price_per_day}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">/ day</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SharedWishlist;
