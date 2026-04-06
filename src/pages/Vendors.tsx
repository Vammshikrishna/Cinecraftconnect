import { useState, useEffect } from 'react';

import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    Search,
    Filter,
    Plus,
    CheckCircle2,
    Building2
} from 'lucide-react';
import { Vendor } from '@/types/marketplace';
import { VendorRegistrationModal } from '@/components/vendors/VendorRegistrationModal';
import { VendorCard } from '@/components/vendors/VendorCard';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';


const Vendors = () => {
    const { toast } = useToast();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);

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
        <div className="min-h-screen bg-background">
            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 pb-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div className="max-w-2xl">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-primary leading-none">
                            Vendors Directory
                        </h1>
                        <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                            Connect with verified industry businesses and service providers
                        </p>
                    </div>
                    <Button onClick={() => setShowRegistrationModal(true)} className="gap-2.5 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform h-12 px-6 shrink-0">
                        <Plus size={20} strokeWidth={3} />
                        <span className="font-bold tracking-wide">Register Business</span>
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[28px] p-2 md:p-3 mb-8 shadow-sm dark:shadow-none">
                    <div className="flex flex-row gap-2 md:gap-3">
                        <div className="relative flex-grow h-12 md:h-14">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={20} />
                            <Input
                                placeholder="Search vendors..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-12 h-full bg-background/50 border-white/5 rounded-2xl text-base focus-visible:ring-primary/20 shadow-inner dark:shadow-none"
                            />
                        </div>
                        <Button variant="outline" className="shrink-0 h-12 md:h-14 gap-2 rounded-2xl border-white/5 bg-background/50 hover:bg-background/80 hover:text-foreground">
                            <Filter size={18} />
                            <span className="font-bold tracking-wide">Filters</span>
                        </Button>
                    </div>
                </div>

                {/* Featured Verified Vendors */}
                {vendors.filter(v => v.is_verified).length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 size={20} className="text-primary" />
                            <h2 className="text-xl font-semibold">Verified Vendors</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {vendors
                                .filter(v => v.is_verified)
                                .slice(0, 6)
                                .map((vendor) => (
                                    <VendorCard key={vendor.id} vendor={vendor} />
                                ))}
                        </div>
                    </div>
                )}

                {/* All Vendors */}
                <div>
                    <h2 className="text-xl font-semibold mb-4">All Vendors</h2>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <EnhancedSkeleton key={i} className="h-[200px] rounded-[24px]" />
                            ))}
                        </div>
                    ) : vendors.length === 0 ? (
                        <div className="text-center py-16">
                            <Building2 size={48} className="mx-auto text-gray-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No vendors found</h3>
                            <p className="text-gray-400 mb-4">
                                Be the first to register your business!
                            </p>
                            <Button onClick={() => setShowRegistrationModal(true)}>
                                Register Your Business
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
