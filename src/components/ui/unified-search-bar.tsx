import React, { ReactNode } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '@/lib/utils';

export interface UnifiedSearchBarProps {
    searchQuery: string;
    onSearchChange: (val: string) => void;
    searchPlaceholder?: string;
    hasActiveFilters?: boolean;
    filterContent?: ReactNode;
    filterTitle?: string;
    className?: string;
    filterOpen?: boolean;
    onFilterOpenChange?: (open: boolean) => void;
    onFilterClick?: () => void;
    extraActions?: ReactNode;
}

export const UnifiedSearchBar = ({
    searchQuery,
    onSearchChange,
    searchPlaceholder = "Search...",
    hasActiveFilters = false,
    filterContent,
    filterTitle = "Filter Results",
    className,
    filterOpen,
    onFilterOpenChange,
    onFilterClick,
    extraActions
}: UnifiedSearchBarProps) => {
    
    const filterButton = (
        <Button
            variant="ghost"
            onClick={onFilterClick}
            className={cn(
                "h-12 px-3 sm:px-5 rounded-xl border font-bold text-xs uppercase tracking-widest gap-2 shrink-0 transition-colors",
                hasActiveFilters ? "text-primary border-primary/30 bg-primary/5" : "border-border/50 hover:bg-muted/50"
            )}
        >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span> {hasActiveFilters && '•'}
        </Button>
    );

    return (
        <div className={cn("bg-card/40 border border-border/50 rounded-2xl md:rounded-3xl p-2 md:p-3 mb-8 backdrop-blur-xl transition-all", className)}>
            <div className="flex flex-row gap-2 md:gap-3">
                <div className="relative flex-grow h-12">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                    <Input
                        placeholder={searchPlaceholder}
                        className="h-12 pl-11 bg-background/50 border-transparent focus:bg-muted/30 rounded-xl md:rounded-2xl transition-all font-medium placeholder:text-muted-foreground/50 text-sm w-full"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                    />
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                    {filterContent ? (
                        <Popover open={filterOpen} onOpenChange={onFilterOpenChange}>
                            <PopoverTrigger asChild>
                                <div className="flex">
                                    {filterButton}
                                </div>
                            </PopoverTrigger>
                            <PopoverContent 
                                className="w-[calc(100vw-2rem)] sm:w-80 max-h-[85vh] flex flex-col p-5 space-y-4 rounded-2xl glass-card border-border/40 shadow-2xl overflow-hidden" 
                                align="end"
                            >
                                <p className="font-black text-sm uppercase tracking-widest shrink-0">{filterTitle}</p>
                                <div className="flex-1 overflow-y-auto -mx-5 px-5">
                                    {filterContent}
                                </div>
                            </PopoverContent>
                        </Popover>
                    ) : onFilterClick ? (
                        <div className="flex">
                            {filterButton}
                        </div>
                    ) : null}
                    
                    {extraActions && (
                        <div className="flex h-12">
                            {extraActions}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
