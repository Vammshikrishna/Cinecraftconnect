import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MarketplaceListing, MarketplaceWishlist } from '@/types/marketplace';
import { PageHeader } from '@/components/common/PageHeader';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ListingSkeleton } from '@/components/ui/enhanced-skeleton';
import { Grid, List as ListIcon, Loader2, CheckSquare, Heart } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { BulkAddToProjectModal } from '@/components/marketplace/BulkAddToProjectModal';
import { LoadError } from '@/components/settings/LoadError';
import { Checkbox } from '@/components/ui/checkbox';
import { ShareIcon } from '@/components/icons/ShareIcon';

const Wishlist = () => {
    const { user, profile } = useAuth();
    const { goBack, push } = useAppNavigation();
    const { toast } = useToast();
    
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showShare, setShowShare] = useState(false);
    const [shareToken, setShareToken] = useState('');
    const [showBulkAdd, setShowBulkAdd] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const { data: wishlist, isLoading, isError, refetch } = useQuery({
        queryKey: ['marketplace_wishlist', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('marketplace_wishlists' as any)
                .select(`
                    id,
                    user_id,
                    listing_id,
                    created_at,
                    marketplace_listings (*)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as any[]; // casting to any to handle the join type
        },
        enabled: !!user
    });

    const toggleSelection = (listingId: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(listingId)) {
            newSet.delete(listingId);
        } else {
            newSet.add(listingId);
        }
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (wishlist && selectedIds.size === wishlist.length) {
            setSelectedIds(new Set());
        } else if (wishlist) {
            setSelectedIds(new Set(wishlist.map(w => w.listing_id)));
        }
    };

    const generateShareToken = async () => {
        if (!user) return;
        // The share token is private (not on the public profile): the server hands out the caller's own.
        const { data, error } = await (supabase as any).rpc('get_my_wishlist_token');
        if (error || !data) {
            toast({ title: 'Error', description: 'Could not generate share token', variant: 'destructive' });
            return;
        }
        setShareToken(data as string);
        setShowShare(true);
    };

    return (
        <div className="min-h-dvh bg-background pt-20 pb-40">
            <div className="max-w-[1560px] mx-auto px-4 md:px-8">
                <PageHeader
                    title="My Gear Wishlist"
                    subtitle="Saved equipment and bundles"
                    onBack={() => goBack()}
                    actions={
                        <div className="flex gap-2">
                            <Button variant="outline" className="rounded-xl border-border/50 gap-2" onClick={generateShareToken}>
                                <ShareIcon className="h-4 w-4" />
                                <span className="hidden md:inline">Share</span>
                            </Button>
                        </div>
                    }
                />

                <UniversalShareSheet 
                    isOpen={showShare} 
                    onOpenChange={setShowShare} 
                    shareType="wishlist"
                    shareId={shareToken}
                    shareData={{
                        title: `${profile?.full_name || 'User'}'s Gear Wishlist`,
                        subtitle: 'Shared equipment list from CineCraft Connect'
                    }}
                />

                <BulkAddToProjectModal 
                    isOpen={showBulkAdd} 
                    onOpenChange={setShowBulkAdd}
                    selectedListings={wishlist?.filter(w => selectedIds.has(w.listing_id)).map(w => w.marketplace_listings) || []}
                    onSuccess={() => setSelectedIds(new Set())}
                />

                <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        {(wishlist?.length ?? 0) > 0 && (
                        <Button variant="ghost" onClick={toggleAll} className="gap-2">
                            <CheckSquare className="h-4 w-4" />
                            {selectedIds.size === wishlist?.length && wishlist?.length > 0 ? 'Deselect All' : 'Select All'}
                        </Button>
                        )}
                        
                        {selectedIds.size > 0 && (
                            <Button onClick={() => setShowBulkAdd(true)} className="gap-2 shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
                                Add {selectedIds.size} to Project
                            </Button>
                        )}
                    </div>

                    <div className="flex bg-secondary/30 rounded-xl p-1 border border-border/50">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className={`rounded-lg h-10 w-10 ${viewMode === 'grid' ? 'shadow-sm' : ''}`}
                            onClick={() => setViewMode('grid')}
                            aria-label="Grid view"
                            aria-pressed={viewMode === 'grid'}
                        >
                            <Grid size={14} />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            className={`rounded-lg h-10 w-10 ${viewMode === 'list' ? 'shadow-sm' : ''}`}
                            onClick={() => setViewMode('list')}
                            aria-label="List view"
                            aria-pressed={viewMode === 'list'}
                        >
                            <ListIcon size={14} />
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <ListingSkeleton key={i} />
                        ))}
                    </div>
                ) : isError || !wishlist ? (
                    <LoadError className="mt-8" title="Could not load your wishlist" onRetry={() => refetch()} />
                ) : wishlist.length === 0 ? (
                    <div className="text-center py-20 bg-secondary/10 rounded-3xl border border-border/50 mt-8">
                        <Heart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-xl font-bold text-foreground">Your wishlist is empty</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                            Browse the marketplace and click the heart icon to save gear for your upcoming projects.
                        </p>
                        <Button className="mt-5 rounded-xl" onClick={() => push('/marketplace')}>Browse marketplace</Button>
                    </div>
                ) : (
                    <div className={
                        viewMode === 'grid'
                            ? "grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-6"
                            : "flex flex-col gap-4"
                    }>
                        {wishlist?.map((item) => (
                            <div key={item.id} className="relative group">
                                <div className={`absolute top-1.5 left-1.5 z-40 bg-background/80 backdrop-blur-md rounded-lg p-2.5 border border-border/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${selectedIds.size > 0 ? "md:opacity-100" : ""}`}>
                                    <Checkbox 
                                        aria-label={`Select ${item.marketplace_listings?.title || 'item'}`}
                                        checked={selectedIds.has(item.listing_id)} 
                                        onCheckedChange={() => toggleSelection(item.listing_id)}
                                    />
                                </div>
                                <div className={selectedIds.has(item.listing_id) ? "ring-2 ring-primary rounded-3xl transition-shadow" : "transition-shadow"}>
                                    {item.marketplace_listings && (
                                        <ListingCard listing={item.marketplace_listings} />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Wishlist;
