import { useState } from 'react';
import { Search, Filter, X, Calendar, MapPin, Tag, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

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

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onSaveSearch: (name: string, filters: SearchFilters) => void;
}

const AdvancedSearch = ({ onSearch, onSaveSearch }: AdvancedSearchProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    contentType: [],
    dateRange: { from: null, to: null },
    location: '',
    tags: [],
    author: '',
    sortBy: 'relevance',
    mediaOnly: false
  });

  const handleSearch = () => {
    onSearch(filters);
  };

  return (
    <Card className="w-full animate-fade-in">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Advanced Search
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
          <Button onClick={handleSearch} className="hover-glow">
            Search
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvancedSearch;