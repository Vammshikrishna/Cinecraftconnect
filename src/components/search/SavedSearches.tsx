import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { Search, Trash2, BookmarkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SavedSearch {
  id: string;
  search_name: string;
  search_query: string;
  search_filters: any;
  search_type: string;
  created_at: string;
}

interface SavedSearchesProps {
  onLoadSearch: (filters: any) => void;
}

export const SavedSearches = ({ onLoadSearch }: SavedSearchesProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSavedSearches();
    }
  }, [user]);

  const fetchSavedSearches = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedSearches(data || []);
    } catch (error) {
      console.error('Error fetching saved searches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSearch = (search: SavedSearch) => {
    onLoadSearch(search.search_filters);
    toast({
      title: "Search Loaded",
      description: `Loaded search: ${search.search_name}`
    });
  };

  const deleteSearch = async (searchId: string) => {
    try {
      await supabase
        .from('saved_searches')
        .delete()
        .eq('id', searchId);

      setSavedSearches(prev => prev.filter(s => s.id !== searchId));
      toast({
        title: "Search Deleted",
        description: "Your saved search has been deleted."
      });
    } catch (error) {
      console.error('Error deleting search:', error);
      toast({
        title: "Delete Error",
        description: "There was an error deleting your search.",
        variant: "destructive"
      });
    }
  };

  const getFilterSummary = (filters: any) => {
    const summary = [];
    if (filters.query) summary.push(`"${filters.query}"`);
    if (filters.type && filters.type !== 'all') summary.push(filters.type);
    if (filters.location) summary.push(filters.location);
    if (filters.craft && filters.craft.length > 0) {
      summary.push(`${filters.craft.length} craft${filters.craft.length > 1 ? 's' : ''}`);
    }
    if (filters.genre && filters.genre.length > 0) {
      summary.push(`${filters.genre.length} genre${filters.genre.length > 1 ? 's' : ''}`);
    }
    return summary.slice(0, 3).join(', ') + (summary.length > 3 ? '...' : '');
  };

  if (!user) {
    return (
      <Card className="border-white/10 bg-cinesphere-dark/50">
        <CardHeader>
          <CardTitle className="text-white">Saved Searches</CardTitle>
          <CardDescription>Sign in to save and manage your searches</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-white/10 bg-cinesphere-dark/50">
        <CardHeader>
          <CardTitle className="text-white">Saved Searches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-cinesphere-dark/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <BookmarkIcon className="mr-2 h-5 w-5" />
          Saved Searches
        </CardTitle>
        <CardDescription>
          {savedSearches.length > 0 
            ? `You have ${savedSearches.length} saved search${savedSearches.length > 1 ? 'es' : ''}`
            : "You haven't saved any searches yet"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {savedSearches.length > 0 ? (
          <div className="space-y-4">
            {savedSearches.map((search, index) => (
              <div key={search.id}>
                <div className="p-4 rounded-lg border border-white/10 hover:border-cinesphere-purple/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{search.search_name}</h4>
                      <p className="text-gray-400 text-sm mb-2">
                        {getFilterSummary(search.search_filters)}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {search.search_type}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(search.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadSearch(search)}
                        className="text-xs"
                      >
                        <Search className="mr-1 h-3 w-3" />
                        Load
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSearch(search.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                {index < savedSearches.length - 1 && <Separator className="my-2 bg-white/10" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BookmarkIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-400 mb-2">No saved searches</p>
            <p className="text-gray-500 text-sm">
              Perform a search and save it to quickly access it later
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};