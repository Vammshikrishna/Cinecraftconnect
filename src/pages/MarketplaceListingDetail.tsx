
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MarketplaceListing } from '@/types/marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
    MapPin,
    ArrowLeft,
    MessageSquare,
    Share2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MarketplaceListingDetail = () => {
    const { listingId } = useParams<{ listingId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const [listing, setListing] = useState<MarketplaceListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    useEffect(() => {
        if (listingId) {
            fetchListingDetails();
        }
    }, [listingId]);

    const fetchListingDetails = async () => {
        if (!listingId) return;
        try {
            setLoading(true);
            // 1. Fetch the listing details first
            const { data: listingData, error: listingError } = await supabase
                .from('marketplace_listings')
                .select('*')
                .eq('id', listingId)
                .single();

            if (listingError) throw listingError;

            // 2. Fetch the seller's profile using the user_id from the listing
            let profileData = null;
            if (listingData.user_id) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, username, full_name, avatar_url')
                    .eq('id', listingData.user_id)
                    .single();

                if (!profileError) {
                    profileData = profile;
                }
            }

            // 3. Combine the data
            setListing({
                ...listingData,
                profiles: profileData
            } as any);

        } catch (error: any) {
            console.error('Error fetching listing details:', error);
            toast({
                title: 'Error',
                description: 'Failed to load listing details',
                variant: 'destructive'
            });
            navigate('/marketplace');
        } finally {
            setLoading(false);
        }
    };

    const handleContactSeller = () => {
        if (!user) {
            toast({
                title: 'Sign in required',
                description: 'Please sign in to contact the seller',
                variant: 'destructive'
            });
            return;
        }

        if (listing && listing.profiles && (listing.profiles as any).id) {
            // Navigate to chat with this user
            navigate(`/messages/${(listing.profiles as any).id}`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-24 px-4 flex justify-center">
                <div className="animate-pulse space-y-8 w-full max-w-6xl">
                    <div className="h-8 bg-gray-800 rounded w-1/4"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="aspect-video bg-gray-800 rounded-xl"></div>
                        <div className="space-y-4">
                            <div className="h-10 bg-gray-800 rounded w-3/4"></div>
                            <div className="h-6 bg-gray-800 rounded w-1/2"></div>
                            <div className="h-32 bg-gray-800 rounded w-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!listing) return null;

    return (
        <div className="min-h-screen bg-background pt-24 pb-12">
            <div className="max-w-6xl mx-auto px-4 md:px-8">
                {/* Back Button */}
                <Button
                    variant="ghost"
                    className="mb-6 pl-0 hover:pl-2 transition-all"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Marketplace
                </Button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    {/* Left Column: Images */}
                    <div className="space-y-4">
                        <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-800 relative group">
                            <img
                                src={listing.images?.[activeImageIndex] || '/placeholder-image.jpg'}
                                alt={listing.title}
                                className="w-full h-full object-contain"
                            />
                        </div>

                        {listing.images && listing.images.length > 1 && (
                            <div className="grid grid-cols-5 gap-2">
                                {listing.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImageIndex(idx)}
                                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-primary' : 'border-transparent hover:border-gray-700'
                                            }`}
                                    >
                                        <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Details */}
                    <div className="space-y-8">
                        <div>
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div>
                                    <Badge variant="secondary" className="mb-3 capitalize">
                                        {listing.category}
                                    </Badge>
                                    <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                                        {listing.title}
                                    </h1>
                                    <div className="flex items-center text-muted-foreground">
                                        <MapPin className="h-4 w-4 mr-1" />
                                        {listing.location}
                                    </div>
                                </div>
                                <Button variant="outline" size="icon">
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="p-6 bg-card border border-border rounded-xl space-y-4">
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold text-primary flex items-center">
                                        <span className="mr-1">₹</span>
                                        {listing.price_per_day}
                                    </span>
                                    <span className="text-muted-foreground mb-1">/ day</span>
                                </div>

                                {listing.price_per_week && (
                                    <div className="text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">₹{listing.price_per_week}</span> / week
                                    </div>
                                )}

                                <div className="pt-4 flex gap-3">
                                    <Button className="flex-1 gap-2" onClick={handleContactSeller}>
                                        <MessageSquare className="h-4 w-4" />
                                        Contact Seller
                                    </Button>
                                    {/* <Button variant="outline" className="flex-1 gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Check Availability
                                    </Button> */}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold">Description</h3>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {listing.description}
                            </p>
                        </div>

                        {listing.specifications && Object.keys(listing.specifications).length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold">Specifications</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {Object.entries(listing.specifications).map(([key, value]) => (
                                        <div key={key} className="flex justify-between p-3 bg-secondary/20 rounded-lg">
                                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                                            <span className="font-medium">{value as string}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-6 border-t border-border">
                            <h3 className="text-sm font-medium text-muted-foreground mb-4">Listed by</h3>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={listing.profiles?.avatar_url || undefined} />
                                    <AvatarFallback>
                                        {listing.profiles?.full_name?.[0] || listing.profiles?.username?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-semibold text-lg">
                                        {listing.profiles?.full_name || listing.profiles?.username || 'Anonymous User'}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Member since {new Date().getFullYear()} {/* Placeholder for join date if not available */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarketplaceListingDetail;
