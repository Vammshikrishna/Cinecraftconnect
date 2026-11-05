import React, { ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
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
            aria-label={hasActiveFilters ? "Filters (active)" : "Filters"}
            className={cn(
                "h-12 px-3 sm:px-5 rounded-xl border font-semibold text-xs uppercase tracking-wider gap-2 shrink-0 transition-colors",
                hasActiveFilters ? "text-primary border-primary/40 bg-primary/5" : "border-border bg-background hover:bg-muted/60"
            )}
        >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span> {hasActiveFilters && '•'}
        </Button>
    );

    return (
        <div
            role="search"
            className={cn("bg-card border border-border rounded-2xl p-2 md:p-3 mb-8 shadow-sm transition-[color,background-color,border-color,box-shadow]", className)}
        >
            <div className="flex flex-row gap-2 md:gap-3">
                <div className="relative flex-grow h-12">
                    <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        aria-label={searchPlaceholder.replace(/\.{3}|…$/, '')}
                        placeholder={searchPlaceholder}
                        className="h-12 pl-11 pr-11 bg-background border-border/80 rounded-xl transition-colors font-medium placeholder:text-muted-foreground text-sm w-full focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => onSearchChange('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
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
