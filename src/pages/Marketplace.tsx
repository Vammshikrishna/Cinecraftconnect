import { useState } from 'react';
import { useMarketplaceListings } from '@/hooks/useMarketplace';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    Search,
    Camera,
    Home,
    Plus,
    LayoutGrid
} from 'lucide-react';
import { ListingType } from '@/types/marketplace';
import { ListingCreationModal } from '@/components/marketplace/ListingCreationModal';
import { ListingCard } from '@/components/marketplace/ListingCard';
import { MarketplaceFilters } from '@/components/marketplace/MarketplaceFilters';

const Marketplace = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<ListingType | 'all'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
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
            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
                        <p className="text-gray-400">
                            Rent equipment and locations from fellow professionals
                        </p>
                    </div>
                    <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                        <Plus size={18} />
                        Create Listing
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="glass-card rounded-xl p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <Input
                                placeholder="Search marketplace..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-input border-border"
                            />
                        </div>
                        <MarketplaceFilters filters={filters} onFiltersChange={setFilters} />
                    </div>
                </div>

                {/* Active Filters Display */}
                {(filters.location || filters.minPrice || filters.maxPrice || filters.category) && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {filters.location && (
                            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                Location: {filters.location}
                                <button onClick={() => setFilters({ ...filters, location: undefined })} className="hover:text-primary/80">×</button>
                            </div>
                        )}
                        {(filters.minPrice || filters.maxPrice) && (
                            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                Price: ₹{filters.minPrice || 0} - ₹{filters.maxPrice || 'Any'}
                                <button onClick={() => setFilters({ ...filters, minPrice: undefined, maxPrice: undefined })} className="hover:text-primary/80">×</button>
                            </div>
                        )}
                        {filters.category && (
                            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                Category: {filters.category}
                                <button onClick={() => setFilters({ ...filters, category: undefined })} className="hover:text-primary/80">×</button>
                            </div>
                        )}
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ListingType | 'all')}>
                    <TabsList className="mb-6">
                        <TabsTrigger value="all" className="gap-2">
                            <LayoutGrid size={18} />
                            All
                        </TabsTrigger>
                        <TabsTrigger value="equipment" className="gap-2">
                            <Camera size={18} />
                            Equipment
                        </TabsTrigger>
                        <TabsTrigger value="location" className="gap-2">
                            <Home size={18} />
                            Locations
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="all">
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                                        <div className="aspect-video bg-gray-700 rounded-lg mb-4"></div>
                                        <div className="h-6 bg-gray-700 rounded mb-2"></div>
                                        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                                    </div>
                                ))}
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="text-center py-16">
                                <LayoutGrid size={48} className="mx-auto text-gray-500 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No listings found</h3>
                                <p className="text-gray-400 mb-4">
                                    Be the first to create a listing!
                                </p>
                                <Button onClick={() => setShowCreateModal(true)}>
                                    Create Listing
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {listings.map((listing) => (
                                    <ListingCard key={listing.id} listing={listing} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="equipment">
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                                        <div className="aspect-video bg-gray-700 rounded-lg mb-4"></div>
                                        <div className="h-6 bg-gray-700 rounded mb-2"></div>
                                        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                                    </div>
                                ))}
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="text-center py-16">
                                <Camera size={48} className="mx-auto text-gray-500 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No equipment listings found</h3>
                                <p className="text-gray-400 mb-4">
                                    Be the first to list your equipment for rent!
                                </p>
                                <Button onClick={() => setShowCreateModal(true)}>
                                    Create Listing
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {listings.map((listing) => (
                                    <ListingCard key={listing.id} listing={listing} />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="location">
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                                        <div className="aspect-video bg-gray-700 rounded-lg mb-4"></div>
                                        <div className="h-6 bg-gray-700 rounded mb-2"></div>
                                        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                                    </div>
                                ))}
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="text-center py-16">
                                <Home size={48} className="mx-auto text-gray-500 mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No location listings found</h3>
                                <p className="text-gray-400 mb-4">
                                    List your property as a film location!
                                </p>
                                <Button onClick={() => setShowCreateModal(true)}>
                                    Create Listing
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {listings.map((listing) => (
                                    <ListingCard key={listing.id} listing={listing} />
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
