import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    Truck,
    Search,
    Filter,
    Plus,
    CheckCircle2
} from 'lucide-react';
import VendorIcon from '@/components/icons/VendorIcon';
import { Vendor } from '@/types/marketplace';
import { VendorRegistrationModal } from '@/components/vendors/VendorRegistrationModal';
import { VendorCard } from '@/components/vendors/VendorCard';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { PageHeader } from '@/components/common/PageHeader';


import { useAccountType } from '@/hooks/useAccountType';
import { useNavigate } from 'react-router-dom';


const Vendors = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { isFan } = useAccountType();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);

    // Redirect fans
    useEffect(() => {
        if (isFan) {
            navigate('/pricing');
        }
    }, [isFan, navigate]);



    useEffect(() => {
        fetchVendors();
    }, [searchQuery]);

    const fetchVendors = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .rpc('search_vendors', {
                    search_query: searchQuery || undefined,
                    filter_category: undefined,
                    filter_location: undefined,
                    verified_only: false
                });

            if (error) throw error;

            setVendors((data || []).map(v => ({
                ...v,
                updated_at: v.created_at
            })));
        } catch (error: any) {
            console.error('Error fetching vendors:', error);
            toast({
                title: 'Error',
                description: 'Failed to load vendors',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVendorRegistered = () => {
        setShowRegistrationModal(false);
        fetchVendors();
        toast({
            title: 'Success',
            description: 'Your vendor profile has been submitted for verification!'
        });
    };

    return (
        <div className="min-h-screen bg-background selection:bg-primary/30">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[120px]" />
            </div>

            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-40 relative z-10">
                <PageHeader 
                  title="Vendor Directory" 
                  subtitle="Find film equipment rentals, studios, and production services" 
                  Icon={Truck}
                  actionsAtTop={true}
                  actions={
                    <Button onClick={() => setShowRegistrationModal(true)} className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 px-4 shadow-lg shadow-primary/20 hover:scale-105 transition-all shrink-0 text-sm">
                        <Plus size={18} strokeWidth={3} />
                        <span>Register Business</span>
                    </Button>
                  }
                />

                {/* Search Bar */}
                <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[28px] p-2 md:p-3 mb-10 shadow-sm dark:shadow-none">
                    <div className="flex flex-row gap-2 md:gap-3">
                        <div className="relative flex-grow h-12 md:h-14">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={20} />
                            <Input
                                placeholder="Search for equipment, services, or locations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 h-full bg-background/50 border-transparent focus:bg-muted/30 rounded-2xl text-base transition-all font-medium placeholder:text-muted-foreground/50"
                            />
                        </div>
                        <Button variant="ghost" className="shrink-0 h-12 md:h-14 gap-2 rounded-2xl border border-border/50 hover:bg-muted/50 font-bold uppercase tracking-widest text-xs">
                            <Filter size={18} />
                            <span>Filters</span>
                        </Button>
                    </div>
                </div>

                {/* Featured Verified Vendors */}
                {vendors.filter(v => v.is_verified).length > 0 && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-6">
                            <CheckCircle2 size={24} className="text-primary" />
                            <h2 className="text-2xl font-black tracking-tight uppercase">Verified Professionals</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                            {vendors
                                .filter(v => v.is_verified)
                                .slice(0, 8)
                                .map((vendor) => (
                                    <VendorCard key={vendor.id} vendor={vendor} />
                                ))}
                        </div>
                    </div>
                )}

                {/* All Vendors */}
                <div className="mt-12">
                    <div className="flex items-center gap-2 mb-6">
                        <VendorIcon size={24} className="text-primary/60" />
                        <h2 className="text-2xl font-black tracking-tight uppercase">Industry Directory</h2>
                    </div>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <EnhancedSkeleton key={i} className="h-[250px] rounded-[2.5rem]" />
                            ))}
                        </div>
                    ) : vendors.length === 0 ? (
                        <div className="text-center py-24 bg-card/10 border border-border/50 border-dashed rounded-[3rem]">
                            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                <VendorIcon size={32} className="text-primary" />
                            </div>
                            <h3 className="text-2xl font-black mb-2">No vendors found</h3>
                            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                                Be the first to establish a presence in this directory!
                            </p>
                            <Button onClick={() => setShowRegistrationModal(true)} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold">
                                Register Your Business
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            {vendors.map((vendor) => (
                                <VendorCard key={vendor.id} vendor={vendor} />
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Vendor Registration Modal */}
            <VendorRegistrationModal
                open={showRegistrationModal}
                onOpenChange={setShowRegistrationModal}
                onSuccess={handleVendorRegistered}
            />
        </div>
    );
};

export default Vendors;
