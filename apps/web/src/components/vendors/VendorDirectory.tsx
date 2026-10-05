import { orTerm } from '@/lib/postgrest';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    Search,
    Filter,
    Plus,
    CheckCircle2
} from 'lucide-react';
import VendorIcon from '@/components/icons/VendorIcon';
import { Vendor, VendorService, PRODUCTION_TYPES } from '@/types/marketplace';
import { VendorRegistrationModal } from '@/components/vendors/VendorRegistrationModal';
import { VendorCard } from '@/components/vendors/VendorCard';
import { ServiceCard } from '@/components/vendors/ServiceCard';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';


import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAppRole } from '@/hooks/useAppRole';
import { UnifiedSearchBar } from '@/components/ui/unified-search-bar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export const VendorDirectory = ({ searchSlot, registerOpen, onRegisterOpenChange }: { searchSlot?: HTMLElement | null; registerOpen?: boolean; onRegisterOpenChange?: (open: boolean) => void }) => {
    const { toast } = useToast();
    const { push } = useAppNavigation();
    const { isInternal } = useAppRole();
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterVerified, setFilterVerified] = useState(false);
    // the Register Business button can live in the Marketplace header (controlled) or here (standalone)
    const [internalRegister, setInternalRegister] = useState(false);
    const showRegistrationModal = registerOpen ?? internalRegister;
    const setShowRegistrationModal = onRegisterOpenChange ?? setInternalRegister;

    // Services state
    const [activeTab, setActiveTab] = useState<'vendors' | 'services'>('vendors');
    const [services, setServices] = useState<VendorService[]>([]);
    const [filterProductionType, setFilterProductionType] = useState<string>('all');
    const [filterMinCapacity, setFilterMinCapacity] = useState<string>('');




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
                .select('*, vendor:vendor_id ( business_name, logo_url, is_verified )')
                .eq('is_active', true);

            if (searchQuery) {
                query = query.or(`title.ilike.%${orTerm(searchQuery)}%,description.ilike.%${orTerm(searchQuery)}%`);
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

    // the search + filters sit above the Marketplace tabs (same place as the other tabs) when a slot is given
    const searchBar = (
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
    );

    return (
        <div>
            {searchSlot && createPortal(searchBar, searchSlot)}
                {/* Directory tabs + register */}
                <div className="flex items-end justify-between gap-4 mb-6 border-b border-border/50">
                  <div className="flex gap-4">
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
                  {!isInternal && registerOpen === undefined && (
                    <Button onClick={() => setShowRegistrationModal(true)} className="gap-2 rounded-xl h-9 px-4 mb-2 font-bold text-sm shrink-0">
                        <Plus size={16} strokeWidth={3} />
                        <span>Register Business</span>
                    </Button>
                  )}
                </div>

                {!searchSlot && searchBar}

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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {vendors.map((vendor) => (
                                        <VendorCard key={vendor.id} vendor={vendor} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                                <ServiceCard key={service.id} service={service as any} />
                            ))
                        )}
                    </div>
                )}

            {/* Vendor Registration Modal */}
            <VendorRegistrationModal
                open={showRegistrationModal}
                onOpenChange={setShowRegistrationModal}
                onSuccess={handleVendorRegistered}
            />
        </div>
    );
};

export default VendorDirectory;
