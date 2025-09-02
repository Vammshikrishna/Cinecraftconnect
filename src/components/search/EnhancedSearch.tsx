import { useState, useCallback, useMemo } from 'react';
import { Search, Filter, X, Calendar, MapPin, Tag, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';

interface SearchFilters {
  query: string;
  contentType: string[];
  dateRange: { from: Date | null; to: Date | null };
  location: string;
  tags: string[];
  author: string;
  sortBy: string;
  mediaOnly: boolean;
  projectStatus: string[];
  budget: { min: number | null; max: number | null };
}

interface EnhancedSearchProps {
  onSearch: (filters: SearchFilters, results: any[]) => void;
  onSaveSearch: (name: string, filters: SearchFilters) => void;
}

const EnhancedSearch = ({ onSearch, onSaveSearch }: EnhancedSearchProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    contentType: [],
    dateRange: { from: null, to: null },
    location: '',
    tags: [],
    author: '',
    sortBy: 'relevance',
    mediaOnly: false,
    projectStatus: [],
    budget: { min: null, max: null }
  });

  const debouncedQuery = useDebounce(filters.query, 300);

  const contentTypes = [
    { id: 'posts', label: 'Posts' },
    { id: 'projects', label: 'Projects' },
    { id: 'profiles', label: 'Users' },
    { id: 'discussions', label: 'Discussions' },
    { id: 'announcements', label: 'Announcements' }
  ];

  const sortOptions = [
    { value: 'relevance', label: 'Most Relevant' },
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'alphabetical', label: 'A-Z' }
  ];

  const projectStatuses = [
    { id: 'planning', label: 'Planning' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'on-hold', label: 'On Hold' }
  ];

  const performSearch = useCallback(async (searchFilters: SearchFilters) => {
    setIsLoading(true);
    const results: any[] = [];

    try {
      // Search posts
      if (!searchFilters.contentType.length || searchFilters.contentType.includes('posts')) {
        let postsQuery = supabase
          .from('posts')
          .select(`
            *,
            profiles:author_id (
              id,
              full_name,
              username,
              avatar_url
            )
          `);

        if (searchFilters.query) {
          postsQuery = postsQuery.ilike('content', `%${searchFilters.query}%`);
        }

        if (searchFilters.mediaOnly) {
          postsQuery = postsQuery.not('media_url', 'is', null);
        }

        if (searchFilters.tags.length > 0) {
          postsQuery = postsQuery.overlaps('tags', searchFilters.tags);
        }

        const { data: posts } = await postsQuery.limit(20);
        if (posts) {
          results.push(...posts.map(post => ({ ...post, type: 'post' })));
        }
      }

      // Search projects
      if (!searchFilters.contentType.length || searchFilters.contentType.includes('projects')) {
        let projectsQuery = supabase
          .from('projects')
          .select(`
            *,
            profiles:creator_id (
              id,
              full_name,
              username,
              avatar_url
            )
          `);

        if (searchFilters.query) {
          projectsQuery = projectsQuery.or(`title.ilike.%${searchFilters.query}%,description.ilike.%${searchFilters.query}%`);
        }

        if (searchFilters.location) {
          projectsQuery = projectsQuery.ilike('location', `%${searchFilters.location}%`);
        }

        if (searchFilters.projectStatus.length > 0) {
          projectsQuery = projectsQuery.in('status', searchFilters.projectStatus);
        }

        if (searchFilters.budget.min !== null) {
          projectsQuery = projectsQuery.gte('budget_min', searchFilters.budget.min);
        }

        if (searchFilters.budget.max !== null) {
          projectsQuery = projectsQuery.lte('budget_max', searchFilters.budget.max);
        }

        const { data: projects } = await projectsQuery.limit(20);
        if (projects) {
          results.push(...projects.map(project => ({ ...project, type: 'project' })));
        }
      }

      // Search users
      if (!searchFilters.contentType.length || searchFilters.contentType.includes('profiles')) {
        let profilesQuery = supabase
          .from('profiles')
          .select('*');

        if (searchFilters.query) {
          profilesQuery = profilesQuery.or(`full_name.ilike.%${searchFilters.query}%,username.ilike.%${searchFilters.query}%,bio.ilike.%${searchFilters.query}%`);
        }

        if (searchFilters.location) {
          profilesQuery = profilesQuery.ilike('location', `%${searchFilters.location}%`);
        }

        const { data: profiles } = await profilesQuery.limit(20);
        if (profiles) {
          results.push(...profiles.map(profile => ({ ...profile, type: 'profile' })));
        }
      }

      // Sort results
      const sortedResults = sortResults(results, searchFilters.sortBy);
      onSearch(searchFilters, sortedResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onSearch]);

  const sortResults = (results: any[], sortBy: string) => {
    switch (sortBy) {
      case 'newest':
        return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return results.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'popular':
        return results.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      case 'alphabetical':
        return results.sort((a, b) => (a.title || a.full_name || '').localeCompare(b.title || b.full_name || ''));
      default:
        return results;
    }
  };

  const handleSearch = useCallback(() => {
    performSearch(filters);
  }, [filters, performSearch]);

  // Auto-search when query changes
  useMemo(() => {
    if (debouncedQuery.length > 2) {
      performSearch(filters);
    }
  }, [debouncedQuery, filters, performSearch]);

  const handleContentTypeChange = (typeId: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      contentType: checked 
        ? [...prev.contentType, typeId]
        : prev.contentType.filter(id => id !== typeId)
    }));
  };

  const handleTagAdd = (tag: string) => {
    if (tag && !filters.tags.includes(tag)) {
      setFilters(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const handleTagRemove = (tag: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  return (
    <Card className="w-full glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Enhanced Search
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {isExpanded ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for content, projects, users..."
              value={filters.query}
              onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} className="hover-glow" disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
          <Button variant="secondary" onClick={() => {
            const name = window.prompt('Name this search');
            if (name) onSaveSearch(name, filters);
          }}>
            Save
          </Button>
        </div>

        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="space-y-6">
            {/* Content Type Filters */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Content Type</h4>
              <div className="grid grid-cols-2 gap-3">
                {contentTypes.map((type) => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={type.id}
                      checked={filters.contentType.includes(type.id)}
                      onCheckedChange={(checked) => handleContentTypeChange(type.id, checked as boolean)}
                    />
                    <label htmlFor={type.id} className="text-sm">{type.label}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Sort By</h4>
              <Select value={filters.sortBy} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </h4>
              <Input
                placeholder="Enter location..."
                value={filters.location}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </h4>
              <div className="flex flex-wrap gap-2 mb-2">
                {filters.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    #{tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => handleTagRemove(tag)} />
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Add tags..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleTagAdd(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>

            {/* Additional Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mediaOnly"
                  checked={filters.mediaOnly}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, mediaOnly: checked as boolean }))}
                />
                <label htmlFor="mediaOnly" className="text-sm">Media content only</label>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export default EnhancedSearch;