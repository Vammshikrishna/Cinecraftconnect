import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { VendorService, Vendor } from '@/types/marketplace';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/common/PageHeader';
import { MapPin, Users, Calendar, CheckCircle2, MessageSquare, Briefcase } from 'lucide-react';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { useAuth } from '@/contexts/AuthContext';

const VendorServiceDetail = () => {
    const { id } = useParams<{ id: string }>();
    const { push, goBack } = useAppNavigation();
    const { toast } = useToast();
    const { user } = useAuth();
    
    const [service, setService] = useState<VendorService | null>(null);
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchServiceDetails();
        }
    }, [id]);

    const fetchServiceDetails = async () => {
        if (!id) return;
        try {
            setLoading(true);
            
            // Fetch service
            const { data, error: serviceError } = await supabase
                .from('vendor_services' as any)
                .select('*')
                .eq('id', id)
                .single();
                
            if (serviceError) throw serviceError;
            if (!data) throw new Error('Service not found');
            
            const serviceData = data as unknown as VendorService;
            setService(serviceData);

            // Fetch vendor
            const { data: vendorData, error: vendorError } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', serviceData.vendor_id)
                .single();
                
            if (vendorError) throw vendorError;
            setVendor(vendorData as Vendor);
            
        } catch (error: any) {
            console.error('Error fetching service details:', error);
            toast({
                title: 'Error',
                description: 'Failed to load service details',
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
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background pt-24 px-4 flex justify-center">
                <EnhancedSkeleton className="h-[400px] w-full max-w-4xl rounded-[2rem]" />
            </div>
        );
    }

    if (!service || !vendor) return null;

    return (
        <div className="min-h-screen bg-background pt-20 pb-40">
            <main className="max-w-4xl mx-auto px-4 md:px-8">
                <PageHeader
                    title={service.title}
                    subtitle={`Service Package by ${vendor.business_name}`}
                    onBack={() => goBack()}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                    {/* Main Content */}
                    <div className="md:col-span-2 space-y-8">
                        {/* Highlights */}
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2 bg-secondary/10 border border-border px-4 py-2 rounded-xl text-sm font-semibold">
                                <MapPin size={16} className="text-primary" />
                                {service.coverage_area}
                            </div>
                            <div className="flex items-center gap-2 bg-secondary/10 border border-border px-4 py-2 rounded-xl text-sm font-semibold">
                                <Calendar size={16} className="text-primary" />
                                Min {service.min_booking_days} day(s)
                            </div>
                            {service.crew_capacity && (
                                <div className="flex items-center gap-2 bg-secondary/10 border border-border px-4 py-2 rounded-xl text-sm font-semibold">
                                    <Users size={16} className="text-primary" />
                                    Up to {service.crew_capacity} crew
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <h3 className="text-xl font-bold mb-4">Service Description</h3>
                            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                {service.description}
                            </p>
                        </div>

                        {/* Checklist */}
                        {service.service_checklist && service.service_checklist.length > 0 && (
                            <div>
                                <h3 className="text-xl font-bold mb-4">What's Included</h3>
                                <div className="space-y-3">
                                    {service.service_checklist.map((item, idx) => (
                                        <div key={idx} className="flex items-start gap-3">
                                            <CheckCircle2 className="text-primary mt-0.5 shrink-0" size={18} />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Production Types */}
                        <div>
                            <h3 className="text-xl font-bold mb-4">Supported Productions</h3>
                            <div className="flex flex-wrap gap-2">
                                {service.production_types.map(pt => (
                                    <Badge key={pt} variant="outline" className="text-sm py-1 px-3">
                                        {pt}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-card border border-border rounded-2xl p-6 sticky top-24 shadow-sm">
                            <div className="text-center mb-6">
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Day Rate</p>
                                <div className="text-4xl font-black text-primary">₹{service.day_rate}</div>
                            </div>

                            <Button className="w-full h-12 text-base font-bold gap-2 mb-4" onClick={handleContactVendor}>
                                <MessageSquare size={18} />
                                Contact Vendor
                            </Button>

                            <div className="pt-6 border-t border-border mt-6">
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Provided By</p>
                                <div 
                                    className="flex items-center gap-3 cursor-pointer hover:bg-secondary/20 p-2 rounded-xl transition-colors -mx-2"
                                    onClick={() => push(`/vendors/${vendor.id}`)}
                                >
                                    <div className="w-12 h-12 bg-secondary/50 rounded-lg flex items-center justify-center shrink-0 border border-border">
                                        {vendor.logo_url ? (
                                            <img src={vendor.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                                        ) : (
                                            <Briefcase className="text-muted-foreground" size={20} />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold truncate text-foreground">{vendor.business_name}</h4>
                                        <p className="text-xs text-muted-foreground truncate">{vendor.location}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default VendorServiceDetail;
