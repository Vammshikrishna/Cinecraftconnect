import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Search,
    Filter,
    MapPin,
    DollarSign,
    Camera,
    Home,
    Plus,
    Star
} from 'lucide-react';
import { MarketplaceListing, ListingType } from '@/types/marketplace';
import { ListingCreationModal } from '@/components/marketplace/ListingCreationModal';
import { ListingCard } from '@/components/marketplace/ListingCard';
import Footer from '@/components/Footer';

const Marketplace = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [listings, setListings] = useState<MarketplaceListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<ListingType>('equipment');
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchListings();
    }, [activeTab, searchQuery]);

    const fetchListings = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .rpc('search_marketplace_listings', {
                    search_query: searchQuery || null,
                    filter_type: activeTab,
                    filter_category: null,
                    filter_location: null,
                    min_price: null,
                    max_price: null
                });

            if (error) throw error;

            // Fetch user profiles for listings
            const listingsWithProfiles = await Promise.all(
                (data || []).map(async (listing) => {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username, avatar_url, full_name')
                        .eq('id', listing.user_id)
                        .single();

                    return {
                        ...listing,
                        profiles: profile
                    };
                })
            );

            setListings(listingsWithProfiles);
        } catch (error: any) {
            console.error('Error fetching listings:', error);
            toast({
                title: 'Error',
                description: 'Failed to load marketplace listings',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleListingCreated = () => {
        setShowCreateModal(false);
        fetchListings();
        toast({
            title: 'Success',
            description: 'Your listing has been created successfully!'
        });
    };

    return (
        <div className="min-h-screen bg-background">
            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-16">
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
                        <Button variant="outline" className="border-border gap-2">
                            <Filter size={18} />
                            Filters
                        </Button>
                    </div>
                </div>

                {/* Tabs for Equipment and Locations */}
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ListingType)}>
                    <TabsList className="mb-6">
                        <TabsTrigger value="equipment" className="gap-2">
                            <Camera size={18} />
                            Equipment
                        </TabsTrigger>
                        <TabsTrigger value="location" className="gap-2">
                            <Home size={18} />
                            Locations
                        </TabsTrigger>
                    </TabsList>

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

            <Footer />

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
