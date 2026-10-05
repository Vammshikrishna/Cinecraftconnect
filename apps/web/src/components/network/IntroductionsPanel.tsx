import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

/** Introductions: requests people made to me (accept / decline) and the ones I asked for. */
export const IntroductionsPanel = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).rpc('list_introductions');
    setRows(data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (id: string, accept: boolean) => {
    const { error } = await (supabase as any).rpc('respond_introduction', { p_id: id, p_accept: accept });
    if (error) {
      toast({ title: 'Could not complete', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: accept ? 'Introduction made' : 'Declined' });
    }
    load();
  };

  const incoming = rows.filter(r => r.direction === 'incoming');
  const outgoing = rows.filter(r => r.direction === 'outgoing');
  if (rows.length === 0) return null;

  return (
    <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-border/50">
        <h2 className="text-xl font-semibold">Introductions</h2>
      </div>
      <div className="p-5 space-y-4">
        {incoming.map(r => (
          <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
            <div className="text-sm">
              <p><b>{r.requester_name}</b> ({r.requester_craft || 'Filmmaker'}) asks you to introduce them to <b>{r.target_name}</b> ({r.target_craft || 'Filmmaker'}).</p>
              {r.note && <p className="text-muted-foreground italic mt-1">“{r.note}”</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => respond(r.id, true)}><Check className="h-4 w-4 mr-1" /> Introduce</Button>
              <Button size="sm" variant="outline" onClick={() => respond(r.id, false)}><X className="h-4 w-4 mr-1" /> Decline</Button>
            </div>
          </div>
        ))}
        {outgoing.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Introductions you asked for</p>
            {outgoing.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm rounded-lg border px-3 py-2">
                <span>To <b>{r.target_name}</b> via {r.via_name}</span>
                <span className={r.status === 'accepted' ? 'text-emerald-600' : r.status === 'declined' ? 'text-muted-foreground' : 'text-amber-600'}>
                  {r.status === 'accepted' ? 'Introduced' : r.status === 'declined' ? 'Not taken forward' : 'Waiting'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
