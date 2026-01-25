
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MarketplaceListing, ListingType } from '@/types/marketplace';

import { useToast } from '@/hooks/use-toast';

interface UseMarketplaceOptions {
    searchQuery?: string;
    activeTab?: ListingType | 'all';
    filters?: {
        minPrice?: number;
        maxPrice?: number;
        location?: string;
        category?: string;
    };
}

export const useMarketplaceListings = ({ searchQuery = '', activeTab = 'all', filters = {} }: UseMarketplaceOptions) => {
    return useQuery({
        queryKey: ['marketplace-listings', activeTab, searchQuery, filters],
        queryFn: async () => {
            const { data, error } = await supabase
                .rpc('search_marketplace_listings', {
                    search_query: searchQuery || undefined,
                    filter_type: activeTab === 'all' ? undefined : activeTab,
                    filter_category: filters.category || undefined,
                    filter_location: filters.location || undefined,
                    min_price: filters.minPrice || undefined,
                    max_price: filters.maxPrice || undefined
                });

            if (error) throw error;

            if (!data || data.length === 0) return [];

            // Optimize: Fetch all profiles in one go
            const userIds = new Set((data as any[]).map((l) => l.user_id));
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, username, avatar_url, full_name')
                .in('id', Array.from(userIds));

            const profilesMap = new Map(profiles?.map(p => [p.id, p]));

            return (data as any[]).map((listing: any) => ({
                ...listing,
                profiles: profilesMap.get(listing.user_id) ? {
                    username: profilesMap.get(listing.user_id)?.username || '',
                    avatar_url: profilesMap.get(listing.user_id)?.avatar_url || '',
                    full_name: profilesMap.get(listing.user_id)?.full_name || ''
                } : undefined,
                specifications: listing.specifications || {},
                availability_calendar: listing.availability_calendar || [],
                updated_at: listing.updated_at || listing.created_at
            })) as MarketplaceListing[];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};

export const useCreateListing = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async () => {
            // This is largely handled by the modal's internal logic usually, 
            // but if we were moving logic here we would need parameters.
            // For now, I'll just provide a way to invalidate.
            return;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
            toast({ title: 'Success', description: 'Listing created successfully!' });
        }
    });
}
