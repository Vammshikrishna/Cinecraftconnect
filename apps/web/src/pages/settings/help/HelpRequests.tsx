import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Star, Inbox, ChevronRight } from 'lucide-react';
import { TICKET_CATEGORY_LABEL } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { SettingsPageHeader } from '@/components/settings/SettingsUI';
import { LoadError } from '@/components/settings/LoadError';
import { HelpBack, StatusBadge } from '@/components/help/HelpParts';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'open' | 'done';

const HelpRequests = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = () => {
    setFailed(false);
    setLoading(true);
    (supabase as any).rpc('my_support_tickets').then(({ data, error }: any) => {
      if (error) setFailed(true); else setRows(data || []);
      setLoading(false);
    }).catch(() => { setFailed(true); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const shown = rows.filter(r => filter === 'all' || (filter === 'open' ? ['open', 'in_progress'].includes(r.status) : ['resolved', 'closed'].includes(r.status)));

  return (
    <>
      <HelpBack to="/settings/help" label="Help Center" />
      <div className="flex items-center justify-between gap-3">
        <SettingsPageHeader title="Your requests" description="Replies and history from our team." />
        <Button asChild size="sm" className="rounded-full shrink-0"><Link to="/settings/help/new"><Plus className="h-4 w-4 mr-1" /> New</Link></Button>
      </div>

      <div role="group" aria-label="Filter requests" className="flex flex-wrap gap-2 mb-5">
        {([['all', 'All'], ['open', 'Open'], ['done', 'Resolved']] as [Filter, string][]).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn('h-11 md:h-9 px-4 md:px-3.5 rounded-full text-sm font-medium border transition-colors active:opacity-70', filter === k ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground hover:bg-muted')}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div role="status" aria-label="Loading requests" className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/60 animate-pulse" />)}
        </div>
      ) : failed ? (
        <LoadError title="Could not load your requests" onRetry={load} />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center space-y-2">
          <Inbox className="h-9 w-9 mx-auto text-muted-foreground/50" />
          <p className="font-semibold">{rows.length === 0 ? 'No requests yet' : 'Nothing here'}</p>
          <p className="text-sm text-muted-foreground">{rows.length === 0 ? 'When you contact support, your conversation shows up here.' : 'Try a different filter.'}</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card divide-y overflow-hidden">
          {shown.map(r => (
            <Link key={r.id} to={`/settings/help/requests/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/70 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base font-medium truncate">{r.subject}</p>
                  {r.staff_replied && <span className="h-2 w-2 rounded-full bg-primary shrink-0" title="Support replied" aria-label="Support replied" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {TICKET_CATEGORY_LABEL[r.category] || r.category} · {r.staff_replied ? 'Support replied · ' : ''}{formatDistanceToNow(new Date(r.last_message_at), { addSuffix: true })}
                </p>
              </div>
              {r.csat_rating ? <span className="flex items-center gap-0.5 text-xs text-amber-500"><Star className="h-3.5 w-3.5 fill-current" />{r.csat_rating}</span> : null}
              <StatusBadge status={r.status} />
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

export default HelpRequests;
