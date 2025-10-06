import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Filter, X } from 'lucide-react';

interface ProjectFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  activeFilters: FilterState;
}

export interface FilterState {
  genres: string[];
  roles: string[];
  status: string[];
  locations: string[];
}

const AVAILABLE_GENRES = [
  'Action', 'Drama', 'Comedy', 'Thriller', 'Horror', 'Sci-Fi', 
  'Romance', 'Documentary', 'Fantasy', 'Mystery', 'Animation'
];

const AVAILABLE_ROLES = [
  'Director', 'Producer', 'Cinematographer', 'Editor', 'Sound Designer',
  'Production Designer', 'Screenwriter', 'Actor', 'Gaffer', 'Grip'
];

const AVAILABLE_STATUSES = [
  'planning', 'in-production', 'post-production', 'completed'
];

export function ProjectFilters({ onFiltersChange, activeFilters }: ProjectFiltersProps) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<FilterState>(activeFilters);

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setLocalFilters(prev => {
      const current = prev[category];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const clearFilters = () => {
    const emptyFilters: FilterState = {
      genres: [],
      roles: [],
      status: [],
      locations: []
    };
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const activeFilterCount = Object.values(activeFilters).reduce(
    (sum, arr) => sum + arr.length, 0
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge 
              variant="default" 
              className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filter Projects</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status Filter */}
          <div>
            <h3 className="font-medium mb-3">Status</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_STATUSES.map(status => (
                <Badge
                  key={status}
                  variant={localFilters.status.includes(status) ? 'default' : 'outline'}
                  className="cursor-pointer capitalize"
                  onClick={() => toggleFilter('status', status)}
                >
                  {status}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Genre Filter */}
          <div>
            <h3 className="font-medium mb-3">Genres</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_GENRES.map(genre => (
                <Badge
                  key={genre}
                  variant={localFilters.genres.includes(genre) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleFilter('genres', genre)}
                >
                  {genre}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Role Filter */}
          <div>
            <h3 className="font-medium mb-3">Looking For</h3>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ROLES.map(role => (
                <Badge
                  key={role}
                  variant={localFilters.roles.includes(role) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleFilter('roles', role)}
                >
                  {role}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button onClick={clearFilters} variant="outline" className="flex-1">
              <X className="mr-2 h-4 w-4" />
              Clear All
            </Button>
            <Button onClick={applyFilters} className="flex-1">
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
