import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface SearchResultsProps {
  query: string;
  filters: any;
  loading: boolean;
}

type ResultItem = {
  id: string;
  type: 'post' | 'project';
  title: string;
  snippet: string;
  created_at?: string;
};

const SearchResults = ({ query, filters, loading }: SearchResultsProps) => {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!query) { setResults([]); return; }
      setLocalLoading(true);
      try {
        const postsPromise = supabase
          .from('posts')
          .select('id, content, created_at')
          .ilike('content', `%${query}%`)
          .limit(10);

        const projectsPromise = supabase
          .from('projects')
          .select('id, title, description, created_at')
          .ilike('title', `%${query}%`)
          .eq('is_public', true)
          .limit(10);

        const [{ data: posts, error: pErr }, { data: projects, error: prErr }] = await Promise.all([postsPromise, projectsPromise]);
        if (pErr) console.error(pErr);
        if (prErr) console.error(prErr);

        const mapped: ResultItem[] = [
          ...(posts || []).map((p: any) => ({ id: p.id, type: 'post' as const, title: 'Post', snippet: p.content, created_at: p.created_at })),
          ...(projects || []).map((pr: any) => ({ id: pr.id, type: 'project' as const, title: pr.title, snippet: pr.description || '', created_at: pr.created_at })),
        ];
        setResults(mapped);
      } finally {
        setLocalLoading(false);
      }
    };
    run();
  }, [query, JSON.stringify(filters)]);

  if (loading || localLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </CardContent>
      </Card>
    );
  }

  if (!query) return null;

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No results found</h3>
          <p className="text-muted-foreground">Try adjusting your search terms</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {results.map((item) => (
            <li key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="text-xs uppercase text-muted-foreground mb-1">{item.type}</div>
              <div className="font-medium">{item.title}</div>
              <div className="text-sm text-muted-foreground truncate">{item.snippet}</div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default SearchResults;