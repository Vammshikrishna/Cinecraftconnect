import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SearchResultsProps {
  query: string;
  filters: any;
  loading: boolean;
}

const SearchResults = ({ query, filters, loading }: SearchResultsProps) => {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </CardContent>
      </Card>
    );
  }

  if (!query) {
    return null;
  }

  return (
    <Card>
      <CardContent className="text-center py-12">
        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-muted-foreground">Try adjusting your search terms</p>
      </CardContent>
    </Card>
  );
};

export default SearchResults;