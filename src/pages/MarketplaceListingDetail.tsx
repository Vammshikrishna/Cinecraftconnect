
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MarketplaceListing } from '@/types/marketplace';
import { Button } from '@/components/ui/button';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
    MessageSquare,
    Share2,
    Edit,
    Trash2,
    Flag
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MarketplaceShareSheet } from '@/components/marketplace/MarketplaceShareSheet';
import { ListingCreationModal } from '@/components/marketplace/ListingCreationModal';
import { PageHeader } from '@/components/common/PageHeader';
import ReportDialog from '@/components/common/ReportDialog';

const MarketplaceListingDetail = () => {
    const { listingId } = useParams<{ listingId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const [listing, setListing] = useState<MarketplaceListing | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);

    const isOwner = user && listing && user.id === listing.user_id;

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
            navigate(`/messages/${(listing.profiles as any).id}`);
        }
    };

    const handleDelete = async () => {
        if (!listingId) return;
        if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) return;

        try {
            const { error } = await supabase
                .from('marketplace_listings')
                .delete()
                .eq('id', listingId);

            if (error) throw error;

            toast({
                title: 'Listing deleted',
                description: 'Your listing has been removed successfully.'
            });
            navigate('/marketplace');
        } catch (error) {
            console.error('Error deleting listing:', error);
            toast({
                title: 'Error',
                description: 'Failed to delete listing',
                variant: 'destructive'
            });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-24 px-4 flex justify-center">
                <div className="w-full max-w-6xl gap-8 lg:gap-12 grid grid-cols-1 lg:grid-cols-2">
                    <div className="space-y-4">
                        <EnhancedSkeleton className="aspect-video rounded-3xl" />
                        <div className="grid grid-cols-5 gap-3">
                           {[1, 2, 3].map(i => <EnhancedSkeleton key={i} className="aspect-square rounded-2xl" />)}
                        </div>
                    </div>
                    <div className="space-y-6">
                        <EnhancedSkeleton className="h-14 w-3/4 rounded-2xl" />
                        <EnhancedSkeleton className="h-8 w-1/3 rounded-xl" />
                        <EnhancedSkeleton className="h-40 w-full rounded-3xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!listing) return null;

    return (
        <div className="min-h-screen bg-background pt-20 pb-40">
            <div className="max-w-6xl mx-auto px-4 md:px-8">
                <PageHeader
                    title={listing.title}
                    subtitle={`Marketplace Listing in ${listing.location}`}
                    onBack={() => navigate(-1)}
                    actions={
                        <div className="flex gap-2">
                            {isOwner ? (
                                <>
                                    <Button variant="outline" size="icon" className="rounded-xl border-border/50" onClick={() => setIsEditModalOpen(true)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="destructive" size="icon" className="rounded-xl shadow-lg shadow-red-500/20" onClick={handleDelete}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : user && (
                                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setIsReportOpen(true)}>
                                    <Flag className="h-4 w-4" />
                                </Button>
                            )}
                            <Button variant="outline" size="icon" className="rounded-xl border-border/50" onClick={() => setShowShareSheet(true)}>
                                <Share2 className="h-4 w-4" />
                            </Button>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 pt-4">
                    {/* Left Column: Images */}
                    <div className="space-y-4">
                        <div className="aspect-video bg-zinc-950 dark:bg-black rounded-[32px] overflow-hidden border border-black/5 dark:border-white/5 relative group shadow-2xl">
                            <img
                                src={listing.images?.[activeImageIndex] || '/placeholder-image.jpg'}
                                alt={listing.title}
                                className="w-full h-full object-contain backdrop-blur-xl"
                            />
                            {/* Subtle Lighting */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/5 pointer-events-none" />
                        </div>

                        {listing.images && listing.images.length > 1 && (
                            <div className="grid grid-cols-5 gap-3">
                                {listing.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImageIndex(idx)}
                                        className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 ${activeImageIndex === idx ? 'border-primary scale-105 shadow-xl shadow-primary/20' : 'border-transparent hover:border-primary/50 opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Details */}
                    <div className="space-y-8 flex flex-col">
                             <div className="p-8 bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[32px] space-y-6 mt-6 shadow-xl relative overflow-hidden group">
                                 <MarketplaceShareSheet
                                     isOpen={showShareSheet}
                                     onOpenChange={setShowShareSheet}
                                     listingId={listing!.id}
                                 />
                                 <ListingCreationModal
                                     open={isEditModalOpen}
                                     onOpenChange={setIsEditModalOpen}
                                     onSuccess={fetchListingDetails}
                                     initialData={listing}
                                     mode="edit"
                                 />
                                {/* Atmospheric gradient inside pricing block */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />
                                
                                <div className="relative z-10 flex items-end gap-3 pb-6 border-b border-black/5 dark:border-white/10">
                                    <span className="text-4xl tracking-tighter font-black text-primary flex items-start leading-[0.8]">
                                        <span className="text-2xl mr-1.5 opacity-60 mt-1.5">₹</span>
                                        {listing.price_per_day}
                                    </span>
                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest pb-1 opacity-60">/ Day</span>
                                </div>

                                {listing.price_per_week && (
                                    <div className="relative z-10 text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                                        Weekly Rate: <span className="text-foreground tracking-tight ml-1">₹{listing.price_per_week}</span> / Week
                                    </div>
                                )}

                                <div className="pt-2 flex gap-4 relative z-10">
                                    <Button className="flex-1 gap-2.5 h-14 rounded-2xl text-base shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all" onClick={handleContactSeller}>
                                        <MessageSquare className="h-5 w-5" />
                                        <span className="font-bold tracking-wide">Contact Seller</span>
                                    </Button>
                                    {/* <Button variant="outline" className="flex-1 gap-2.5 h-14 rounded-2xl border-white/10 text-base">
                                        <Calendar className="h-5 w-5" />
                                        <span className="font-bold tracking-wide">Availability</span>
                                    </Button> */}
                                </div>
                            </div>

                        <div className="space-y-5">
                            <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest pl-1">Description</h3>
                            <p className="text-foreground/90 leading-loose whitespace-pre-wrap font-medium bg-secondary/10 p-6 rounded-3xl border border-white/5 shadow-inner">
                                {listing.description}
                            </p>
                        </div>

                        {listing.specifications && Object.keys(listing.specifications).length > 0 && (
                            <div className="space-y-5">
                                <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest pl-1">Specifications</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {Object.entries(listing.specifications).map(([key, value]) => (
                                        <div key={key} className="flex justify-between items-center p-4 bg-secondary/10 rounded-2xl border border-white/5 transition-all hover:bg-secondary/20">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
                                            <span className="font-black text-sm tracking-tight">{value as string}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-8 mt-auto">
                            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Listed by Community Member</h3>
                            <div className="flex items-center gap-4 bg-card/40 backdrop-blur-md p-4 rounded-[24px] border border-white/5 hover:border-primary/20 transition-all cursor-pointer group">
                                <Avatar className="h-14 w-14 border-2 border-background shadow-md">
                                    <AvatarImage src={listing.profiles?.avatar_url || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-xl">
                                        {listing.profiles?.full_name?.[0] || listing.profiles?.username?.[0] || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-black text-lg tracking-tight group-hover:text-primary transition-colors">
                                        {listing.profiles?.full_name || listing.profiles?.username || 'Anonymous User'}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                        Verified Owner
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {listing && (
                <ReportDialog
                    open={isReportOpen}
                    onOpenChange={setIsReportOpen}
                    targetType="listing"
                    targetId={listing.id}
                />
            )}
        </div>
    );
};


export default MarketplaceListingDetail;
