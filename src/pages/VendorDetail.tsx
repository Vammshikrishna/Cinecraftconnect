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
import {
    MapPin,
    MessageSquare,
    Share2,
    Globe,
    Phone,
    Mail,
    Building2,
    Star
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { PageHeader } from '@/components/common/PageHeader';
import { useAppRole } from '@/hooks/useAppRole';
import { Trash2, Plus } from 'lucide-react';

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
                            <span>Industry Vendor Profile</span>
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
                        <div className="aspect-video bg-muted rounded-xl overflow-hidden border border-border relative group">
                            {vendor.images && vendor.images.length > 0 ? (
                                <img
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
                            <div className="grid grid-cols-5 gap-2">
                                {vendor.images.map((img, idx) => (
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

                        {/* Description */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold">About Us</h3>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {vendor.description}
                            </p>
                        </div>

                        {/* Services */}
                        {vendor.services_offered && vendor.services_offered.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold">Services Offered</h3>
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
                                <h3 className="text-xl font-semibold">Service Packages</h3>
                                {isOwner && (
                                    <Button size="sm" onClick={() => setIsServiceModalOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> Add Package
                                    </Button>
                                )}
                            </div>
                            
                            {services.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {services.map(service => (
                                        <div key={service.id} className="p-4 bg-card border border-border rounded-xl space-y-3 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => push(`/vendors/services/${service.id}`)}>
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
                                <div className="p-8 text-center bg-muted/50 rounded-xl border border-dashed border-border">
                                    <p className="text-muted-foreground">No service packages listed yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Info & Actions */}
                    <div className="space-y-8">
                        <div className="bg-card border border-border rounded-xl p-6 space-y-6 sticky top-24">
                            {/* Header Info */}
                            <div className="flex items-start gap-4">
                                <Avatar className="h-16 w-16 border-2 border-border">
                                    <AvatarImage src={vendor.logo_url || undefined} />
                                    <AvatarFallback><Building2 /></AvatarFallback>
                                </Avatar>
                                 <div>
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
                            <div className="grid grid-cols-1 gap-3">
                             {!isInternal && (
                                 <Button className="w-full gap-2" onClick={handleContactVendor}>
                                     <MessageSquare className="h-4 w-4" />
                                     Chat with Vendor
                                 </Button>
                             )}
                                {/* Future: Add booking/request quote button */}
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
