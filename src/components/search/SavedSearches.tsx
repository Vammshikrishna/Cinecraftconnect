import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const SavedSearches = ({ onLoadSearch }: { onLoadSearch: (search: any) => void }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useState
  
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setItems([]); return; }
        const { data, error } = await supabase
          .from('saved_searches')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (isMounted) setItems(data || []);
      } catch (e) {
        console.error('Fetch saved searches error', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  return (
    <Card className="w-full animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-primary" />
          Saved Searches
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No saved searches yet</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <button
                  className="text-left flex-1 story-link"
                  onClick={() => onLoadSearch(s)}
                  aria-label={`Load saved search ${s.search_name}`}
                  title={s.search_name}
                >
                  <div className="font-medium">{s.search_name}</div>
                  <div className="text-sm text-muted-foreground truncate">{s.search_query}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedSearches;