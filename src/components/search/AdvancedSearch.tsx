import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SavedSearches } from './SavedSearches';
import { SearchResults } from './SearchResults';
import { 
  Search, 
  Filter, 
  Save, 
  X, 
  MapPin, 
  DollarSign, 
  Calendar,
  Users,
  Film
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SearchFilters {
  query: string;
  type: 'all' | 'projects' | 'people' | 'collaborations';
  location: string;
  craft: string[];
  genre: string[];
  budgetMin: string;
  budgetMax: string;
  dateRange: string;
  status: string;
}

const crafts = [
  'Director', 'Producer', 'Screenwriter', 'Cinematographer', 'Editor',
  'Sound Designer', 'Composer', 'Production Designer', 'Costume Designer',
  'Makeup Artist', 'VFX Artist', 'Animator', 'Actor', 'Casting Director'
];

const genres = [
  'Drama', 'Comedy', 'Action', 'Thriller', 'Horror', 'Sci-Fi',
  'Fantasy', 'Romance', 'Documentary', 'Animation', 'Musical', 'Western'
];

export const AdvancedSearch = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    type: 'all',
    location: '',
    craft: [],
    genre: [],
    budgetMin: '',
    budgetMax: '',
    dateRange: '',
    status: ''
  });
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const addCraft = (craft: string) => {
    if (!filters.craft.includes(craft)) {
      setFilters(prev => ({
        ...prev,
        craft: [...prev.craft, craft]
      }));
    }
  };

  const removeCraft = (craft: string) => {
    setFilters(prev => ({
      ...prev,
      craft: prev.craft.filter(c => c !== craft)
    }));
  };

  const addGenre = (genre: string) => {
    if (!filters.genre.includes(genre)) {
      setFilters(prev => ({
        ...prev,
        genre: [...prev.genre, genre]
      }));
    }
  };

  const removeGenre = (genre: string) => {
    setFilters(prev => ({
      ...prev,
      genre: prev.genre.filter(g => g !== genre)
    }));
  };

  const performSearch = async () => {
    setIsSearching(true);
    try {
      let searchResults: any[] = [];

      // Search projects
      if (filters.type === 'all' || filters.type === 'projects') {
        let query = supabase
          .from('projects')
          .select('*, profiles!creator_id(full_name, avatar_url)')
          .eq('is_public', true);

        if (filters.query) {
          query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
        }
        if (filters.location) {
          query = query.ilike('location', `%${filters.location}%`);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.budgetMin) {
          query = query.gte('budget_min', parseInt(filters.budgetMin));
        }
        if (filters.budgetMax) {
          query = query.lte('budget_max', parseInt(filters.budgetMax));
        }
        if (filters.genre.length > 0) {
          query = query.overlaps('genre', filters.genre);
        }
        if (filters.craft.length > 0) {
          query = query.overlaps('required_roles', filters.craft);
        }

        const { data: projects } = await query.limit(20);
        searchResults = [...searchResults, ...(projects || []).map(p => ({ ...p, type: 'project' }))];
      }

      // Search people
      if (filters.type === 'all' || filters.type === 'people') {
        let query = supabase.from('profiles').select('*');

        if (filters.query) {
          query = query.or(`full_name.ilike.%${filters.query}%,bio.ilike.%${filters.query}%`);
        }
        if (filters.location) {
          query = query.ilike('location', `%${filters.location}%`);
        }
        if (filters.craft.length > 0) {
          query = query.in('craft', filters.craft);
        }

        const { data: people } = await query.limit(20);
        searchResults = [...searchResults, ...(people || []).map(p => ({ ...p, type: 'person' }))];
      }

      // Search collaborations
      if (filters.type === 'all' || filters.type === 'collaborations') {
        let query = supabase
          .from('collaborations')
          .select('*, profiles!poster_id(full_name, avatar_url)');

        if (filters.query) {
          query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
        }
        if (filters.location) {
          query = query.ilike('location', `%${filters.location}%`);
        }
        if (filters.craft.length > 0) {
          query = query.in('craft', filters.craft);
        }

        const { data: collaborations } = await query.limit(20);
        searchResults = [...searchResults, ...(collaborations || []).map(c => ({ ...c, type: 'collaboration' }))];
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "There was an error performing your search. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const saveSearch = async () => {
    if (!user || !saveName.trim()) return;

    try {
      await supabase
        .from('saved_searches')
        .insert({
          user_id: user.id,
          search_name: saveName,
          search_query: filters.query,
          search_filters: filters as any,
          search_type: 'advanced'
        });

      toast({
        title: "Search Saved",
        description: "Your search has been saved successfully."
      });

      setShowSaveDialog(false);
      setSaveName('');
    } catch (error) {
      console.error('Error saving search:', error);
      toast({
        title: "Save Error",
        description: "There was an error saving your search.",
        variant: "destructive"
      });
    }
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      type: 'all',
      location: '',
      craft: [],
      genre: [],
      budgetMin: '',
      budgetMax: '',
      dateRange: '',
      status: ''
    });
    setResults([]);
  };

  const hasActiveFilters = filters.query || filters.location || filters.craft.length > 0 || 
    filters.genre.length > 0 || filters.budgetMin || filters.budgetMax || filters.status;

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card className="border-white/10 bg-cinesphere-dark/50 sticky top-8">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center">
                    <Filter className="mr-2 h-5 w-5" />
                    Filters
                  </span>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs"
                    >
                      <X className="mr-1 h-3 w-3" />
                      Clear
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search Query */}
                <div>
                  <Label htmlFor="query" className="text-white">Search Term</Label>
                  <Input
                    id="query"
                    placeholder="Enter keywords..."
                    value={filters.query}
                    onChange={(e) => handleFilterChange('query', e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Search Type */}
                <div>
                  <Label className="text-white">Search In</Label>
                  <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everything</SelectItem>
                      <SelectItem value="projects">Projects</SelectItem>
                      <SelectItem value="people">People</SelectItem>
                      <SelectItem value="collaborations">Collaborations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location */}
                <div>
                  <Label htmlFor="location" className="text-white flex items-center">
                    <MapPin className="mr-1 h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    placeholder="City, State, Country"
                    value={filters.location}
                    onChange={(e) => handleFilterChange('location', e.target.value)}
                    className="mt-1"
                  />
                </div>

                {/* Crafts */}
                <div>
                  <Label className="text-white">Film Crafts</Label>
                  <Select onValueChange={addCraft}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Add craft..." />
                    </SelectTrigger>
                    <SelectContent>
                      {crafts.filter(c => !filters.craft.includes(c)).map(craft => (
                        <SelectItem key={craft} value={craft}>{craft}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filters.craft.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {filters.craft.map(craft => (
                        <Badge
                          key={craft}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeCraft(craft)}
                        >
                          {craft} <X className="ml-1 h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Genres */}
                <div>
                  <Label className="text-white">Genres</Label>
                  <Select onValueChange={addGenre}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Add genre..." />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.filter(g => !filters.genre.includes(g)).map(genre => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filters.genre.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {filters.genre.map(genre => (
                        <Badge
                          key={genre}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeGenre(genre)}
                        >
                          {genre} <X className="ml-1 h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Budget Range */}
                <div>
                  <Label className="text-white flex items-center">
                    <DollarSign className="mr-1 h-4 w-4" />
                    Budget Range
                  </Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Input
                      placeholder="Min"
                      value={filters.budgetMin}
                      onChange={(e) => handleFilterChange('budgetMin', e.target.value)}
                    />
                    <Input
                      placeholder="Max"
                      value={filters.budgetMax}
                      onChange={(e) => handleFilterChange('budgetMax', e.target.value)}
                    />
                  </div>
                </div>

                {/* Project Status */}
                <div>
                  <Label className="text-white">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any status</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="pre-production">Pre-production</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="post-production">Post-production</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="bg-white/20" />

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={performSearch}
                    disabled={isSearching}
                    className="w-full bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {isSearching ? 'Searching...' : 'Search'}
                  </Button>

                  {user && hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSaveDialog(true)}
                      className="w-full"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save Search
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="results" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="results">Search Results</TabsTrigger>
                <TabsTrigger value="saved">Saved Searches</TabsTrigger>
              </TabsList>
              
              <TabsContent value="results" className="mt-6">
                <SearchResults results={results} isLoading={isSearching} />
              </TabsContent>
              
              <TabsContent value="saved" className="mt-6">
                <SavedSearches onLoadSearch={setFilters} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 mx-4">
            <CardHeader>
              <CardTitle>Save Search</CardTitle>
              <CardDescription>Give your search a name to save it for later</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search name..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveSearch} disabled={!saveName.trim()}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};