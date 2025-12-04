
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Filter } from 'lucide-react';

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
    const [isOpen, setIsOpen] = useState(false);

    const handleApply = () => {
        onFiltersChange(localFilters);
        setIsOpen(false);
    };

    const handleClear = () => {
        const cleared = { minPrice: undefined, maxPrice: undefined, location: undefined, category: undefined };
        setLocalFilters(cleared);
        onFiltersChange(cleared);
        setIsOpen(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" className="border-border gap-2">
                    <Filter size={18} />
                    Filters
                </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px] bg-card border-l border-border">
                <SheetHeader>
                    <SheetTitle>Filter Listings</SheetTitle>
                    <SheetDescription>
                        Refine your search to find exactly what you need.
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-6 py-6">
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
                <SheetFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={handleClear} className="w-full sm:w-auto">
                        Clear All
                    </Button>
                    <Button onClick={handleApply} className="w-full sm:w-auto">
                        Apply Filters
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};
