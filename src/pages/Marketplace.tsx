import { useState } from 'react';
import { useMarketplaceListings } from '@/hooks/useMarketplace';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Search, Camera, Home, Plus, LayoutGrid } from 'lucide-react';
import { ListingType } from '@/types/marketplace';
import { ListingCreationModal } from '@/components/marketplace/ListingCreationModal';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { MarketplaceFilters } from '@/components/marketplace/MarketplaceFilters';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

import { PageHeader } from '@/components/common/PageHeader';

import { useAccountType } from '@/hooks/useAccountType';
import { useNavigate } from 'react-router-dom';

const Marketplace = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { isFan } = useAccountType();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<ListingType | 'all'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Redirect fans
    useState(() => {
        if (isFan) {
            navigate('/pricing');
        }
    });


    const [filters, setFilters] = useState<{
        minPrice?: number;
        maxPrice?: number;
        location?: string;
        category?: string;
    }>({});

    const { data: listings = [], isLoading: loading } = useMarketplaceListings({
        searchQuery,
        activeTab,
        filters
    });

    const handleListingCreated = () => {
        setShowCreateModal(false);
        queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
        toast({
            title: 'Success',
            description: 'Your listing has been created successfully!'
        });
    };

    return (
        <div className="min-h-screen bg-background">
            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <PageHeader 
                  title="Marketplace" 
                  subtitle="Discover and rent professional equipment and cinematic locations from verified community members." 
                  Icon={LayoutGrid}
                  actions={
                    <Button onClick={() => setShowCreateModal(true)} className="gap-2.5 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform h-12 px-6 shrink-0">
                        <Plus size={20} strokeWidth={3} />
                        <span className="font-bold tracking-wide">Create Listing</span>
                    </Button>
                  }
                />

                {/* Search & Filter Container */}
                <div className="bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[28px] p-2 md:p-3 mb-8 shadow-sm dark:shadow-none">
                    <div className="flex flex-row gap-2 md:gap-3">
                        <div className="relative flex-grow h-12 md:h-14">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={20} />
                            <Input
                                placeholder="Search marketplace..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 h-full bg-background/50 border-white/5 rounded-2xl text-base focus-visible:ring-primary/20 shadow-inner dark:shadow-none"
                            />
                        </div>
                        <div className="shrink-0 h-12 md:h-14 flex items-center">
                            <MarketplaceFilters filters={filters} onFiltersChange={setFilters} />
                        </div>
                    </div>
                </div>

                {/* Active Filters Display */}
                {(filters.location || filters.minPrice || filters.maxPrice || filters.category) && (
                    <div className="flex flex-wrap gap-2 mb-8 animate-in fade-in slide-in-from-left-4">
                        {filters.location && (
                            <div className="bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                                <span className="opacity-60">Loc:</span> {filters.location}
                                <button onClick={() => setFilters({ ...filters, location: undefined })} className="hover:text-primary/80 hover:bg-primary/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors">×</button>
                            </div>
                        )}
                        {(filters.minPrice || filters.maxPrice) && (
                            <div className="bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                                <span className="opacity-60">Price:</span> ₹{filters.minPrice || 0} - ₹{filters.maxPrice || 'Any'}
                                <button onClick={() => setFilters({ ...filters, minPrice: undefined, maxPrice: undefined })} className="hover:text-primary/80 hover:bg-primary/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors">×</button>
                            </div>
                        )}
                        {filters.category && (
                            <div className="bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                                <span className="opacity-60">Cat:</span> {filters.category}
                                <button onClick={() => setFilters({ ...filters, category: undefined })} className="hover:text-primary/80 hover:bg-primary/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors">×</button>
                            </div>
                        )}
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ListingType | 'all')} className="w-full">
                    <div className="w-full mb-8 flex justify-center">
                        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex p-1.5 h-auto rounded-2xl bg-muted/50 border border-white/5 gap-1 sm:gap-0">
                            <TabsTrigger value="all" className="gap-1 sm:gap-2.5 px-1 sm:px-6 py-3 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-sm tracking-wide data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all flex flex-col sm:flex-row items-center justify-center h-auto">
                                <LayoutGrid size={18} className="shrink-0 mb-1 sm:mb-0" />
                                <span className="hidden sm:inline">All Listings</span>
                                <span className="sm:hidden">All</span>
                            </TabsTrigger>
                            <TabsTrigger value="equipment" className="gap-1 sm:gap-2.5 px-1 sm:px-6 py-3 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-sm tracking-wide data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all flex flex-col sm:flex-row items-center justify-center h-auto">
                                <Camera size={18} className="shrink-0 mb-1 sm:mb-0" />
                                Equipment
                            </TabsTrigger>
                            <TabsTrigger value="location" className="gap-1 sm:gap-2.5 px-1 sm:px-6 py-3 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-sm tracking-wide data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all flex flex-col sm:flex-row items-center justify-center h-auto">
                                <Home size={18} className="shrink-0 mb-1 sm:mb-0" />
                                Locations
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="all" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <EnhancedSkeleton key={i} className="h-[400px] rounded-[28px]" />
                                ))}
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="py-24 bg-card/20 rounded-[32px] border inset-border/5 text-center mt-8">
                                <EmptyState
                                    icon={<LayoutGrid size={64} className="mx-auto text-muted-foreground/30 mb-6 drop-shadow-sm" />}
                                    title="No listings found"
                                    description="Be the first to create a listing!"
                                    action={{ label: 'Create Listing', onClick: () => setShowCreateModal(true) }}
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in overflow-hidden pb-4">
                                {listings.map((listing) => (
                                    <div key={listing.id} className="animate-in zoom-in-95 fill-mode-both duration-500" style={{ animationDelay: `${Math.random() * 200}ms` }}>
                                        <ListingCard listing={listing} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="equipment" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                         {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <EnhancedSkeleton key={i} className="h-[400px] rounded-[28px]" />
                                ))}
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="py-24 bg-card/20 rounded-[32px] border inset-border/5 text-center mt-8">
                                <EmptyState
                                    icon={<Camera size={64} className="mx-auto text-muted-foreground/30 mb-6 drop-shadow-sm" />}
                                    title="No equipment found"
                                    description="Be the first to list your gear for rent!"
                                    action={{ label: 'Rent Equipment', onClick: () => setShowCreateModal(true) }}
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in overflow-hidden pb-4">
                                {listings.map((listing) => (
                                    <div key={listing.id} className="animate-in zoom-in-95 fill-mode-both duration-500" style={{ animationDelay: `${Math.random() * 200}ms` }}>
                                        <ListingCard listing={listing} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="location" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                         {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <EnhancedSkeleton key={i} className="h-[400px] rounded-[28px]" />
                                ))}
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="py-24 bg-card/20 rounded-[32px] border inset-border/5 text-center mt-8">
                                <EmptyState
                                    icon={<Home size={64} className="mx-auto text-muted-foreground/30 mb-6 drop-shadow-sm" />}
                                    title="No locations found"
                                    description="List your property as a production set!"
                                    action={{ label: 'List Location', onClick: () => setShowCreateModal(true) }}
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in overflow-hidden pb-4">
                                {listings.map((listing) => (
                                    <div key={listing.id} className="animate-in zoom-in-95 fill-mode-both duration-500" style={{ animationDelay: `${Math.random() * 200}ms` }}>
                                        <ListingCard listing={listing} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </main>



            {/* Create Listing Modal */}
            <ListingCreationModal
                open={showCreateModal}
                onOpenChange={setShowCreateModal}
                onSuccess={handleListingCreated}
            />
        </div>
    );
};

export default Marketplace;
