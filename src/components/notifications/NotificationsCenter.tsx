import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const NotificationsCenter = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setItems([]); setLoading(false); return; }
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!mounted) return;
      if (error) console.error(error);
      setItems(data || []);
      setLoading(false);

      const channel = supabase
        .channel('notifications-stream')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
          setItems(prev => [payload.new as any, ...prev]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
    return () => { mounted = false; };
  }, []);

  const markRead = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) console.error('Mark read error', error);
  };

  return (
    <Card className="w-full animate-fade-in">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><p className="text-muted-foreground">Loading...</p></div>
        ) : items.length === 0 ? (
          <div className="text-center py-8"><p className="text-muted-foreground">No notifications yet</p></div>
        ) : (
          <ul className="space-y-4">
            {items.map((n) => (
              <li key={n.id} className={`p-4 rounded-lg border ${n.is_read ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-sm text-muted-foreground">{n.message}</div>
                    {n.action_url && (
                      <a href={n.action_url} className="text-primary text-sm story-link mt-2 inline-block">Open</a>
                    )}
                  </div>
                  {!n.is_read && (
                    <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>
                      <Check className="h-4 w-4 mr-1" /> Mark read
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsCenter;