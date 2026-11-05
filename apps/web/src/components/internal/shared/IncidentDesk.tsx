import { useCallback, useEffect, useState } from 'react';
import { Siren } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { isMissingFunction } from './ownerTeamLogic';

interface Incident {
  id: string; title: string; severity: string; status: string; internal_note: string | null; started_at: string; resolved_at: string | null;
  updates: { status: string; message: string; at: string }[];
}
const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;

/** Staff side of the public /status page: open an incident and post updates. Update text is PUBLIC. Needs part GI-4. */
const IncidentDesk = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<Incident[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<Record<string, { status: string; message: string }>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_list_incidents');
    if (error) { setState(isMissingFunction(error) ? 'missing' : 'error'); return; }
    setItems((data as Incident[]) || []); setState('ready');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('staff_open_incident', { p_title: title, p_severity: severity, p_message: message });
    setBusy(false);
    if (error) return toast({ title: 'Could not open the incident', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Incident opened', description: 'It now shows on the public status page.' });
    setTitle(''); setMessage(''); void load();
  };
  const post = async (i: Incident) => {
    const d = draft[i.id] || { status: i.status, message: '' };
    setBusy(true);
    const { error } = await (supabase as any).rpc('staff_post_incident_update', { p_id: i.id, p_status: d.status, p_message: d.message });
    setBusy(false);
    if (error) return toast({ title: 'Could not post the update', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Update posted' });
    setDraft((p) => { const n = { ...p }; delete n[i.id]; return n; }); void load();
  };

  if (state === 'missing') {
    return (
      <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5 rounded-2xl" role="status">
        <p className="font-black text-sm">The status page is not switched on yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run <span className="font-mono">supabase/manual/part_gi_4_status_page.sql</span> in the SQL editor, then press Refresh.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Refresh</Button>
      </div>
    );
  }
  if (state === 'error') {
    return <div className="glass-card p-6 rounded-2xl" role="alert"><p className="font-black text-sm">Could not load incidents</p><Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Try again</Button></div>;
  }

  return (
    <section aria-label="Incidents and status page" className="glass-card p-6 rounded-2xl border-border/50 space-y-5">
      <div className="flex items-center gap-2">
        <Siren className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Incidents and status page</h3>
        <a href="/status" target="_blank" rel="noreferrer" className="ml-auto text-xs font-bold text-primary underline">Open the public page</a>
      </div>
      <p className="text-xs text-muted-foreground">Everything you write in a title or an update is shown to the public at /status. Keep it factual: no names, no internal details.</p>

      <div className="rounded-2xl border border-border/50 p-4 space-y-3">
        <p className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">Open a new incident</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Input aria-label="Incident title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Short public title, e.g. Messages are delayed" />
          <select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-md border border-border/60 bg-background px-2 text-sm h-10">
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High (shows as outage)</option><option value="critical">Critical (shows as outage)</option>
          </select>
        </div>
        <Textarea aria-label="First public update" value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder="First public update" className="min-h-[70px]" />
        <Button className="rounded-xl" disabled={busy || title.trim().length < 5 || message.trim().length < 5} onClick={open}>Open incident</Button>
      </div>

      {state === 'loading' ? <p className="text-sm text-muted-foreground">Loading…</p> : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incidents recorded.</p>
      ) : items.map((i) => {
        const d = draft[i.id] || { status: i.status, message: '' };
        return (
          <div key={i.id} className="rounded-2xl border border-border/50 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-sm">{i.title}</p>
              <span className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">{i.severity} · {i.resolved_at ? 'resolved' : i.status}</span>
              <span className="ml-auto text-xs text-muted-foreground">{new Date(i.started_at).toLocaleString()}</span>
            </div>
            {i.internal_note && <p className="text-xs text-muted-foreground">Internal note (not public): {i.internal_note}</p>}
            {i.updates.slice(0, 3).map((u, k) => <p key={k} className="text-xs"><span className="font-bold uppercase text-muted-foreground">{u.status}</span> · {u.message}</p>)}
            {!i.resolved_at && (
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto] pt-1">
                <select aria-label="New status" value={d.status} onChange={(e) => setDraft((p) => ({ ...p, [i.id]: { ...d, status: e.target.value } }))} className="rounded-md border border-border/60 bg-background px-2 text-sm h-10">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <Input aria-label="Public update" value={d.message} maxLength={1000} onChange={(e) => setDraft((p) => ({ ...p, [i.id]: { ...d, message: e.target.value } }))} placeholder="Public update" />
                <Button className="rounded-xl" disabled={busy || d.message.trim().length < 5} onClick={() => post(i)}>Post update</Button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default IncidentDesk;
