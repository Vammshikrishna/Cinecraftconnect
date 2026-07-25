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
import { Vendor, VendorService, PRODUCTION_TYPES } from '@/types/marketplace';
import { VendorRegistrationModal } from '@/components/vendors/VendorRegistrationModal';
import { VendorCard } from '@/components/vendors/VendorCard';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { PageHeader } from '@/components/common/PageHeader';


import { useAccountType } from '@/hooks/useAccountType';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAppRole } from '@/hooks/useAppRole';
import { UnifiedSearchBar } from '@/components/ui/unified-search-bar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
const Vendors = () => {
    const { toast } = useToast();
    const { push } = useAppNavigation();
    const { isFan } = useAccountType();
    const { isInternal } = useAppRole();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterVerified, setFilterVerified] = useState(false);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);

    // Services state
    const [activeTab, setActiveTab] = useState<'vendors' | 'services'>('vendors');
    const [services, setServices] = useState<VendorService[]>([]);
    const [filterProductionType, setFilterProductionType] = useState<string>('all');
    const [filterMinCapacity, setFilterMinCapacity] = useState<string>('');

    // Redirect fans
    useEffect(() => {
        if (isFan) {
            push('/404');
        }
    }, [isFan, push]);



    useEffect(() => {
        if (activeTab === 'vendors') {
            fetchVendors();
        } else {
            fetchServices();
        }
    }, [searchQuery, activeTab, filterProductionType, filterMinCapacity, filterVerified]);

    const fetchServices = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('vendor_services' as any)
                .select('*')
                .eq('is_active', true);

            if (searchQuery) {
                query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
            }
            if (filterProductionType !== 'all') {
                query = query.contains('production_types', [filterProductionType]);
            }
            if (filterMinCapacity) {
                query = query.gte('crew_capacity', parseInt(filterMinCapacity));
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setServices((data || []) as unknown as VendorService[]);
        } catch (error: any) {
            console.error('Error fetching services:', error);
            toast({ title: 'Error', description: 'Failed to load services', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .rpc('search_vendors', {
                    search_query: searchQuery || undefined,
                    filter_category: undefined,
                    filter_location: undefined,
                    verified_only: filterVerified
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
                        !isInternal && (
                            <Button onClick={() => setShowRegistrationModal(true)} className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 px-4 shadow-lg shadow-primary/20 hover:scale-105 transition-all shrink-0 text-sm">
                                <Plus size={18} strokeWidth={3} />
                                <span>Register Business</span>
                            </Button>
                        )
                    }
                />

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-border/50">
                    <button
                        onClick={() => setActiveTab('vendors')}
                        className={`pb-3 font-bold uppercase tracking-widest text-sm transition-colors ${activeTab === 'vendors' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Vendor Directory
                    </button>
                    <button
                        onClick={() => setActiveTab('services')}
                        className={`pb-3 font-bold uppercase tracking-widest text-sm transition-colors ${activeTab === 'services' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        Service Packages
                    </button>
                </div>

                {/* Unified Search Bar */}
                <UnifiedSearchBar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder="Search for equipment, services, or locations..."
                    filterOpen={filterOpen}
                    onFilterOpenChange={setFilterOpen}
                    hasActiveFilters={activeTab === 'services' ? (filterProductionType !== 'all' || !!filterMinCapacity) : filterVerified}
                    filterTitle={`Filter ${activeTab === 'services' ? 'Services' : 'Vendors'}`}
                    filterContent={
                        <div className="space-y-4">
                            {activeTab === 'services' ? (
                                <>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Production Type</Label>
                                        <Select value={filterProductionType} onValueChange={setFilterProductionType}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="All Productions" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Productions</SelectItem>
                                                {PRODUCTION_TYPES.map(pt => (
                                                    <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Min Capacity</Label>
                                        <Input
                                            type="number"
                                            placeholder="e.g. 50"
                                            value={filterMinCapacity}
                                            onChange={(e) => setFilterMinCapacity(e.target.value)}
                                            className="bg-background border-border"
                                        />
                                    </div>
                                    <div className="pt-2 border-t border-border/10">
                                        <Button 
                                            variant="ghost" 
                                            className="w-full text-xs font-bold"
                                            onClick={() => {
                                                setFilterProductionType('all');
                                                setFilterMinCapacity('');
                                            }}
                                        >
                                            Clear Filters
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase cursor-pointer" htmlFor="verified-filter">
                                            Verified Professionals Only
                                        </Label>
                                        <Switch 
                                            id="verified-filter"
                                            checked={filterVerified} 
                                            onCheckedChange={setFilterVerified} 
                                        />
                                    </div>
                                    <div className="pt-2 border-t border-border/10">
                                        <Button 
                                            variant="ghost" 
                                            className="w-full text-xs font-bold"
                                            onClick={() => setFilterVerified(false)}
                                        >
                                            Clear Filters
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    }
                />

                {/* Content */}
                {activeTab === 'vendors' ? (
                    <>
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
                                    {!searchQuery && !isInternal && (
                                        <Button onClick={() => setShowRegistrationModal(true)} className="bg-primary hover:bg-primary/90 rounded-xl h-12 px-8 font-bold">
                                            Register Your Business
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                                    {vendors.map((vendor) => (
                                        <VendorCard key={vendor.id} vendor={vendor} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {loading ? (
                            [1, 2, 3, 4, 5, 6].map((i) => (
                                <EnhancedSkeleton key={i} className="h-[200px] rounded-[2rem]" />
                            ))
                        ) : services.length === 0 ? (
                            <div className="col-span-full text-center py-24 bg-card/10 border border-border/50 border-dashed rounded-[3rem]">
                                <h3 className="text-2xl font-black mb-2">No services found</h3>
                                <p className="text-muted-foreground">Try adjusting your search or filters.</p>
                            </div>
                        ) : (
                            services.map((service) => (
                                <div key={service.id} className="bg-card border border-border rounded-3xl p-6 cursor-pointer hover:border-primary/50 transition-colors shadow-sm" onClick={() => push(`/vendors/services/${service.id}`)}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-xl leading-tight">{service.title}</h3>
                                            <p className="text-sm text-primary font-black mt-1">₹{service.day_rate} <span className="text-xs text-muted-foreground uppercase font-medium">/ Day</span></p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{service.description}</p>

                                    <div className="flex flex-wrap gap-2 mt-auto">
                                        <div className="px-2 py-1 rounded bg-secondary/20 text-xs font-semibold text-secondary-foreground border border-border/50">
                                            {service.coverage_area}
                                        </div>
                                        {service.crew_capacity && (
                                            <div className="px-2 py-1 rounded bg-secondary/20 text-xs font-semibold text-secondary-foreground border border-border/50">
                                                Up to {service.crew_capacity} crew
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
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
