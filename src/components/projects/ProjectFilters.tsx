import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Filter, X } from 'lucide-react';

interface ProjectFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  activeFilters: FilterState;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export function ProjectFilters({ onFiltersChange, activeFilters, open, onOpenChange }: ProjectFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(activeFilters);

  useEffect(() => {
    if (open) {
      setLocalFilters(activeFilters);
    }
  }, [open, activeFilters]);

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
    if (onOpenChange) onOpenChange(false);
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
    if (onOpenChange) onOpenChange(false);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        <div className="space-y-6">
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

        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-border/10 shrink-0">
        <Button onClick={clearFilters} variant="outline" className="flex-1 text-xs font-bold uppercase tracking-widest">
          Clear All
        </Button>
        <Button onClick={applyFilters} className="flex-1 text-xs font-bold uppercase tracking-widest">
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
