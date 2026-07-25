import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FilterState {
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    category?: string;
}

interface MarketplaceFiltersProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
}

export const MarketplaceFilters = ({ filters, onFiltersChange }: MarketplaceFiltersProps) => {
    const [localFilters, setLocalFilters] = useState<FilterState>(filters);

    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    const handleApply = () => {
        onFiltersChange(localFilters);
    };

    const handleClear = () => {
        const cleared = { minPrice: undefined, maxPrice: undefined, location: undefined, category: undefined };
        setLocalFilters(cleared);
        onFiltersChange(cleared);
    };

    return (
        <div className="flex flex-col space-y-6">
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                        id="location"
                        placeholder="e.g. Los Angeles, CA"
                        value={localFilters.location || ''}
                        onChange={(e) => setLocalFilters({ ...localFilters, location: e.target.value })}
                        className="bg-input border-border"
                    />
                </div>

                <div className="space-y-2">
                    <Label>Price Range (₹)</Label>
                    <div className="flex items-center gap-4">
                        <div className="space-y-1">
                            <Input
                                type="number"
                                placeholder="Min"
                                value={localFilters.minPrice || ''}
                                onChange={(e) => setLocalFilters({ ...localFilters, minPrice: Number(e.target.value) || undefined })}
                                className="bg-input border-border"
                            />
                        </div>
                        <span className="text-muted-foreground">-</span>
                        <div className="space-y-1">
                            <Input
                                type="number"
                                placeholder="Max"
                                value={localFilters.maxPrice || ''}
                                onChange={(e) => setLocalFilters({ ...localFilters, maxPrice: Number(e.target.value) || undefined })}
                                className="bg-input border-border"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                        id="category"
                        placeholder="e.g. Camera, Lighting"
                        value={localFilters.category || ''}
                        onChange={(e) => setLocalFilters({ ...localFilters, category: e.target.value })}
                        className="bg-input border-border"
                    />
                </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border/10">
                <Button variant="outline" onClick={handleClear} className="flex-1 text-xs font-bold uppercase tracking-widest">
                    Clear All
                </Button>
                <Button onClick={handleApply} className="flex-1 text-xs font-bold uppercase tracking-widest">
                    Apply Filters
                </Button>
            </div>
        </div>
    );
};
