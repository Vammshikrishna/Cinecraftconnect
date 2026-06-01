
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
            let query = supabase
                .from('marketplace_listings')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            // Apply filters manually since we aren't using the RPC
            if (activeTab !== 'all') {
                if (activeTab === 'bundle') {
                    query = query.eq('is_bundle', true);
                } else {
                    query = query.eq('listing_type', activeTab as any).eq('is_bundle', false);
                }
            }
            if (filters.category) {
                query = query.eq('category', filters.category);
            }
            if (filters.location) {
                query = query.ilike('location', `%${filters.location}%`);
            }
            if (filters.minPrice) {
                query = query.gte('price_per_day', filters.minPrice);
            }
            if (filters.maxPrice) {
                query = query.lte('price_per_day', filters.maxPrice);
            }
            if (searchQuery) {
                query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data || data.length === 0) return [];

            // Fetch profiles in batch
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
