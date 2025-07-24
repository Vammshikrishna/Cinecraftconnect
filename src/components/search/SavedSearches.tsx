import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SavedSearches = ({ onLoadSearch }: { onLoadSearch: (search: any) => void }) => {
  return (
    <Card className="w-full animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          Saved Searches
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No saved searches yet</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SavedSearches;