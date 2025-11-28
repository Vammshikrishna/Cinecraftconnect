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
            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Vendors Directory</h1>
                        <p className="text-gray-400">
                            Connect with verified industry businesses and service providers
                        </p>
                    </div>
                    <Button onClick={() => setShowRegistrationModal(true)} className="gap-2">
                        <Plus size={18} />
                        Register Your Business
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="glass-card rounded-xl p-4 mb-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <Input
                                placeholder="Search vendors..."
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
                                <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
                                    <div className="w-20 h-20 bg-gray-700 rounded-lg mb-4"></div>
                                    <div className="h-6 bg-gray-700 rounded mb-2"></div>
                                    <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                                </div>
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
