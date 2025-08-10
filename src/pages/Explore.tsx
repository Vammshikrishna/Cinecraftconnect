
import { useState } from 'react';
import { Search, Compass, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdvancedSearch from '@/components/search/AdvancedSearch';
import SavedSearches from '@/components/search/SavedSearches';
import SearchResults from '@/components/search/SearchResults';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SearchFilters {
  query: string;
  contentType: string[];
  dateRange: { from: Date | null; to: Date | null };
  location: string;
  tags: string[];
  author: string;
  sortBy: string;
  mediaOnly: boolean;
}

const Explore = () => {
  const { toast } = useToast();
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({
    query: '',
    contentType: [],
    dateRange: { from: null, to: null },
    location: '',
    tags: [],
    author: '',
    sortBy: 'relevance',
    mediaOnly: false
  });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (filters: SearchFilters) => {
    setLoading(true);
    setActiveFilters(filters);
    setHasSearched(true);
    
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleSaveSearch = async (name: string, filters: SearchFilters) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Sign in required', description: 'Please sign in to save searches.' });
        return;
      }

      const jsonFilters = {
        query: filters.query,
        contentType: filters.contentType,
        dateRange: {
          from: filters.dateRange.from ? filters.dateRange.from.toISOString() : null,
          to: filters.dateRange.to ? filters.dateRange.to.toISOString() : null,
        },
        location: filters.location,
        tags: filters.tags,
        author: filters.author,
        sortBy: filters.sortBy,
        mediaOnly: filters.mediaOnly,
      };

      const payload = {
        user_id: user.id,
        search_name: name,
        search_query: filters.query,
        search_filters: jsonFilters as any,
        search_type: 'global' as const,
      };

      const { error } = await supabase.from('saved_searches').insert([payload as any]);
      if (error) throw error;
      toast({ title: 'Search saved', description: `Saved "${name}"` });
    } catch (e: any) {
      console.error('Save search error', e);
      toast({ title: 'Failed to save search', description: e.message });
    }
  };

  const handleLoadSearch = (savedSearch: any) => {
    const filters = {
      query: savedSearch.search_query || '',
      ...savedSearch.search_filters
    };
    handleSearch(filters);
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <div className="container mx-auto px-4 py-8 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
              <Compass className="mr-3 h-8 w-8 text-primary" />
              Explore & Discover
            </h1>
            <p className="text-muted-foreground">Find content, projects, people, and opportunities</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <AdvancedSearch 
              onSearch={handleSearch}
              onSaveSearch={handleSaveSearch}
            />

            <SearchResults
              query={activeFilters.query}
              filters={activeFilters}
              loading={loading}
            />

            {!hasSearched && !loading && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Trending Now
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Use the search above to discover content</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <SavedSearches onLoadSearch={handleLoadSearch} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Explore;
