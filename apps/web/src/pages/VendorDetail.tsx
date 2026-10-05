import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { Vendor, VendorService } from '@/types/marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ServicePackageModal } from '@/components/vendors/ServicePackageModal';
import { QuoteRequestDialog } from '@/components/vendors/QuoteRequestDialog';
import { VendorVerificationDialog } from '@/components/vendors/VendorVerificationDialog';
import { LeaveReviewModal } from '@/components/marketplace/LeaveReviewModal';
import ReportDialog from '@/components/common/ReportDialog';
import {
    MapPin,
    MessageSquare,
    Share2,
    Globe,
    Phone,
    Mail,
    Building2,
    Star,
    FileText,
    Flag
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { PageHeader } from '@/components/common/PageHeader';
import { useAppRole } from '@/hooks/useAppRole';
import { Trash2, Plus, BadgeCheck } from 'lucide-react';

const VendorDetail = () => {
    const { id } = useParams<{ id: string }>();
    const { push, goBack } = useAppNavigation();
    const { toast } = useToast();
    const { user } = useAuth();
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [services, setServices] = useState<VendorService[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const { isInternal } = useAppRole();
    const [quoteOpen, setQuoteOpen] = useState(false);
    const [verifyOpen, setVerifyOpen] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);

    const requireSignIn = (action: () => void) => {
        if (!user) {
            toast({ title: 'Sign in required', description: 'Redirecting to sign in page...', variant: 'destructive' });
            push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
            return;
        }
        action();
    };

    const isOwner = user && vendor && user.id === vendor.owner_id;

    useEffect(() => {
        if (id) {
            fetchVendorDetails();
        }
    }, [id]);

    const fetchVendorDetails = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const { data, error } = await supabase
                .rpc('get_vendor_with_rating', { vendor_uuid: id });

            if (error) throw error;

            if (data && data.length > 0) {
                setVendor(data[0] as Vendor);
                
                // Fetch services
                const { data: servicesData } = await supabase
                    .from('vendor_services' as any)
                    .select('*')
                    .eq('vendor_id', id)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                    
                if (servicesData) {
                    setServices(servicesData as unknown as VendorService[]);
                }
            } else {
                // If RPC returns null/empty (e.g. invalid ID), handle as not found
                toast({
                    title: 'Error',
                    description: 'Vendor not found',
                    variant: 'destructive'
                });
                goBack();
            }
        } catch (error: any) {
            console.error('Error fetching vendor details:', error);
            toast({
                title: 'Error',
                description: 'Failed to load vendor details',
                variant: 'destructive'
            });
            goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleContactVendor = () => {
        if (!user) {
            toast({
                title: 'Sign in required',
                description: 'Redirecting to sign in page...',
                variant: 'destructive'
            });
            push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
            return;
        }

        if (vendor && vendor.owner_id) {
            push(`/messages/${vendor.owner_id}`);
        } else {
            toast({
                title: 'Error',
                description: 'Cannot contact this vendor directly.',
                variant: 'destructive'
            });
        }
    };
    
    const handleDeleteVendor = async () => {
        if (!vendor) return;
        if (!confirm('Are you sure you want to delete this vendor profile? This action cannot be undone.')) return;
        try {
            const { error } = await supabase.from('vendors').delete().eq('id', vendor.id);
            if (error) throw error;
            toast({ title: "Vendor Deleted", description: "The vendor profile has been successfully removed." });
            goBack();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
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

    if (!vendor) return null;

    return (
        <div className="min-h-screen bg-background pt-20 pb-40">
            <div className="max-w-6xl mx-auto px-4 md:px-8">
                <PageHeader
                    title={vendor.business_name}
                    subtitle={
                        <div className="flex items-center gap-2">
                            <span>Service provider{vendor.location ? ` in ${vendor.location}` : ''}</span>
                            {vendor.is_verified && (
                                <Badge variant="outline" className="border-primary/40 text-primary font-black uppercase tracking-widest text-[10px] py-0.5 px-2 bg-primary/5 gap-1">
                                    <BadgeCheck className="h-3 w-3" /> Verified
                                </Badge>
                            )}
                            {isInternal && (
                                <Badge variant="outline" className="border-orange-500/50 text-orange-500 font-black uppercase tracking-widest text-[10px] py-0.5 px-2 bg-orange-500/5">
                                    Staff Observer
                                </Badge>
                            )}
                        </div>
                    }
                    onBack={() => goBack()}
                    actions={
                        <div className="flex gap-2">
                            <Button variant="outline" size="icon" className="rounded-xl border-border/50" onClick={() => setShowShareSheet(true)}>
                                <Share2 className="h-4 w-4" />
                            </Button>
                            {isInternal && (
                                <Button variant="ghost" size="icon" className="rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-none" onClick={handleDeleteVendor}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    }
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                    {/* Left Column: Visuals */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Hero Image/Gallery */}
                        <div className="aspect-video bg-zinc-950 dark:bg-black rounded-[32px] overflow-hidden border border-black/5 dark:border-white/5 relative group shadow-2xl">
                            {vendor.images && vendor.images.length > 0 ? (
                                <img loading="lazy" decoding="async"
                                    src={vendor.images[activeImageIndex]}
                                    alt={vendor.business_name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                    <Building2 className="h-20 w-20 text-muted-foreground opacity-20" />
                                </div>
                            )}
                        </div>

                        {vendor.images && vendor.images.length > 1 && (
                            <div className="grid grid-cols-5 gap-3">
                                {vendor.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImageIndex(idx)}
                                        className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 ${activeImageIndex === idx ? 'border-primary scale-105 shadow-xl shadow-primary/20' : 'border-transparent hover:border-primary/50 opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <img loading="lazy" decoding="async" src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Description */}
                        <div className="space-y-4 p-8 bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[32px] shadow-xl">
                            <h3 className="text-xl font-black tracking-tight">About Us</h3>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {vendor.description}
                            </p>
                        </div>

                        {/* Services */}
                        {vendor.services_offered && vendor.services_offered.length > 0 && (
                            <div className="space-y-4 p-8 bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[32px] shadow-xl">
                                <h3 className="text-xl font-black tracking-tight">Services Offered</h3>
                                <div className="flex flex-wrap gap-2">
                                    {vendor.services_offered.map((service, idx) => (
                                        <Badge key={idx} variant="secondary" className="px-3 py-1">
                                            {service}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Service Packages */}
                        <div className="space-y-4 pt-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black tracking-tight">Service Packages</h3>
                                {isOwner && (
                                    <Button size="sm" onClick={() => setIsServiceModalOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Package
                                    </Button>
                                )}
                            </div>
                            
                            {services.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {services.map(service => (
                                        <div key={service.id} className="p-5 bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-3xl space-y-3 cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all shadow-sm" onClick={() => push(`/vendors/services/${service.id}`)}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-lg">{service.title}</h4>
                                                    <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                                                </div>
                                                <div className="text-right shrink-0 ml-4">
                                                    <div className="font-black text-primary text-lg">₹{service.day_rate}</div>
                                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">/ Day</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {service.production_types.slice(0, 3).map(pt => (
                                                    <Badge key={pt} variant="outline" className="text-xs bg-secondary/10">
                                                        {pt}
                                                    </Badge>
                                                ))}
                                                {service.production_types.length > 3 && (
                                                    <Badge variant="outline" className="text-xs bg-secondary/10">+{service.production_types.length - 3}</Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-muted/30 rounded-3xl border border-dashed border-border">
                                    <p className="text-muted-foreground">No service packages listed yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Info & Actions */}
                    <div className="space-y-8">
                        <div className="p-8 bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[32px] space-y-6 sticky top-24 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none opacity-50" />
                            {/* Header Info */}
                            <div className="relative z-10 flex items-start gap-4">
                                <Avatar className="h-16 w-16 rounded-2xl border-2 border-border">
                                    <AvatarImage src={vendor.logo_url || undefined} className="object-cover" />
                                    <AvatarFallback className="rounded-2xl"><Building2 /></AvatarFallback>
                                </Avatar>
                                 <div className="min-w-0">
                                     <h2 className="font-black text-xl leading-tight tracking-tight flex items-center gap-1.5">
                                         <span className="truncate">{vendor.business_name}</span>
                                         {vendor.is_verified && <BadgeCheck className="h-5 w-5 text-primary shrink-0" />}
                                     </h2>
                                     <div className="flex flex-wrap gap-2 mt-2">
                                         {vendor.category?.map((cat, idx) => (
                                             <Badge key={idx} variant="outline" className="text-xs">
                                                 {cat}
                                             </Badge>
                                         ))}
                                     </div>
                                     {vendor.average_rating && vendor.average_rating > 0 && (
                                         <div className="flex items-center gap-1 mt-2 text-sm font-medium">
                                             <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                                             <span>{vendor.average_rating.toFixed(1)}</span>
                                             <span className="text-muted-foreground">
                                                 ({vendor.review_count || 0} reviews)
                                             </span>
                                         </div>
                                     )}
                                 </div>
                            </div>

                            {/* Contact Actions */}
                            <div className="relative z-10 flex flex-col gap-3">
                                {!isInternal && !isOwner && (
                                    <Button className="w-full gap-2.5 h-14 rounded-2xl text-base shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all" onClick={() => requireSignIn(() => setQuoteOpen(true))}>
                                        <FileText className="h-5 w-5" />
                                        <span className="font-bold tracking-wide">Request a quote</span>
                                    </Button>
                                )}
                                {!isInternal && (
                                    <Button variant="outline" className="w-full gap-2.5 h-12 rounded-xl text-sm font-bold" onClick={handleContactVendor}>
                                        <MessageSquare className="h-4 w-4" />
                                        Chat with Vendor
                                    </Button>
                                )}
                                {!isInternal && !isOwner && (
                                    <div className="flex gap-3">
                                        <Button variant="outline" className="flex-1 h-12 rounded-xl text-sm font-bold" onClick={() => requireSignIn(() => setReviewOpen(true))}>
                                            <Star className="h-4 w-4 mr-2" />
                                            Review
                                        </Button>
                                        <Button variant="ghost" className="flex-1 h-12 rounded-xl text-sm font-bold text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => requireSignIn(() => setReportOpen(true))}>
                                            <Flag className="h-4 w-4 mr-2" />
                                            Report
                                        </Button>
                                    </div>
                                )}
                                {isOwner && (
                                    <>
                                        <Button className="w-full gap-2.5 h-14 rounded-2xl text-base shadow-lg shadow-primary/25" onClick={() => push('/marketplace/quotes')}>
                                            <FileText className="h-5 w-5" />
                                            <span className="font-bold tracking-wide">View quote requests</span>
                                        </Button>
                                        {!vendor.is_verified && (
                                            <Button variant="outline" className="w-full h-12 rounded-xl text-sm font-bold gap-2" onClick={() => setVerifyOpen(true)}>
                                                <BadgeCheck className="h-4 w-4" /> Get verified
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>

                            <UniversalShareSheet
                                isOpen={showShareSheet}
                                onOpenChange={setShowShareSheet}
                                shareType="vendor"
                                shareId={vendor.id}
                                shareData={{
                                    vendorId: vendor.id,
                                    name: vendor.business_name,
                                    logoUrl: vendor.logo_url,
                                    category: vendor.category,
                                    location: vendor.location,
                                    description: vendor.description
                                }}
                            />

                            <hr className="border-border" />

                            {/* Contact Details */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm text-muted-foreground">Contact Information</h3>

                                {vendor.location && (
                                    <div className="flex items-start gap-3 text-sm">
                                        <MapPin className="h-4 w-4 text-primary mt-0.5" />
                                        <span>{vendor.location}</span>
                                    </div>
                                )}

                                {vendor.address && (
                                    <div className="flex items-start gap-3 text-sm">
                                        <MapPin className="h-4 w-4 text-primary mt-0.5" />
                                        <span>{vendor.address}</span>
                                    </div>
                                )}

                                {vendor.phone && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Phone className="h-4 w-4 text-primary" />
                                        <span>{vendor.phone}</span>
                                    </div>
                                )}

                                {vendor.email && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Mail className="h-4 w-4 text-primary" />
                                        <a href={`mailto:${vendor.email}`} className="hover:text-primary transition-colors">
                                            {vendor.email}
                                        </a>
                                    </div>
                                )}

                                {vendor.website && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Globe className="h-4 w-4 text-primary" />
                                        <a
                                            href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-primary transition-colors truncate"
                                        >
                                            {vendor.website}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {vendor && !isOwner && (
                <>
                    <QuoteRequestDialog open={quoteOpen} onOpenChange={setQuoteOpen} vendorId={vendor.id} vendorName={vendor.business_name} onRequested={() => push('/marketplace/quotes')} />
                    <LeaveReviewModal open={reviewOpen} onOpenChange={setReviewOpen} vendorId={vendor.id} onSuccess={fetchVendorDetails} />
                    {/* the business owner is the reportable "user" (moderation can act on accounts) */}
                    <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={vendor.owner_id} />
                </>
            )}
            {isOwner && vendor && (
                <VendorVerificationDialog open={verifyOpen} onOpenChange={setVerifyOpen} vendorId={vendor.id} vendorName={vendor.business_name} onSubmitted={fetchVendorDetails} />
            )}
            {isOwner && vendor && (
                <ServicePackageModal
                    open={isServiceModalOpen}
                    onOpenChange={setIsServiceModalOpen}
                    vendorId={vendor.id}
                    onSuccess={fetchVendorDetails}
                />
            )}
        </div>
    );
};

export default VendorDetail;
