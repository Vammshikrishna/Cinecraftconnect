import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const ContentModerationDashboard = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('content_moderation')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (mounted) setItems(data || []);
      } catch (e) {
        console.error('Fetch moderation error', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Content Moderation
          </h1>
          <p className="text-muted-foreground">Review moderation status of your content</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moderation Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8"><p className="text-muted-foreground">Loading...</p></div>
          ) : items.length === 0 ? (
            <div className="text-center py-8"><p className="text-muted-foreground">No items pending moderation</p></div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="p-4 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{item.content_type}</div>
                      <div className="text-sm text-muted-foreground">Status: {item.moderation_status}</div>
                      {item.moderation_reason && (
                        <div className="text-sm text-muted-foreground mt-1">{item.moderation_reason}</div>
                      )}
                    </div>
                    <Badge variant={item.moderation_status === 'approved' ? 'default' : item.moderation_status === 'rejected' ? 'destructive' : 'secondary'}>
                      {item.moderation_status || 'pending'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContentModerationDashboard;