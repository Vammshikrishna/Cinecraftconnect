import { useCallback, useEffect, useState } from 'react';
import { Gavel, Plus, Clock, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { friendlyError } from '@cinecraft/core';
import { cn } from '@/lib/utils';

type Status = 'pending' | 'under_review' | 'fulfilled' | 'rejected' | 'legal_hold';

interface LegalRequest {
  id: string;
  request_id: string;
  requester_name: string;
  requester_entity: string;
  request_type: string;
  target_user_id: string | null;
  target_user_name: string | null;
  target_content_id: string | null;
  status: Status;
  evidence_url: string | null;
  internal_notes: string | null;
  deadline_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Received',
  under_review: 'Under review',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
  legal_hold: 'Legal hold',
};
const STATUS_STYLE: Record<Status, string> = {
  pending: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
  under_review: 'border-sky-500/40 text-sky-600 bg-sky-500/10',
  fulfilled: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10',
  rejected: 'border-border text-muted-foreground bg-muted',
  legal_hold: 'border-violet-500/40 text-violet-600 bg-violet-500/10',
};
const TYPES = ['Court order', 'Law enforcement request', 'Copyright takedown', 'User data request', 'Preservation request', 'Other'];
const ACTIONS: { status: Status; label: string; destructive?: boolean }[] = [
  { status: 'under_review', label: 'Start review' },
  { status: 'legal_hold', label: 'Place on hold' },
  { status: 'fulfilled', label: 'Mark fulfilled' },
  { status: 'rejected', label: 'Reject', destructive: true },
];
const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Received' },
  { id: 'under_review', label: 'Under review' },
  { id: 'legal_hold', label: 'Hold' },
  { id: 'fulfilled', label: 'Closed' },
];

const deadlineInfo = (iso: string | null, status: Status) => {
  if (!iso || status === 'fulfilled' || status === 'rejected') return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `${-days} d overdue`, tone: 'text-destructive font-semibold' };
  if (days <= 3) return { text: `Due in ${days} d`, tone: 'text-amber-600 font-semibold' };
  return { text: `Due ${new Date(iso).toLocaleDateString()}`, tone: 'text-muted-foreground' };
};

/**
 * Court orders, law enforcement requests, copyright takedowns and data requests. Every step is written to the audit
 * ledger, and only super admins can see or change them.
 */
export const LegalRequestsDesk = () => {
  const { toast } = useToast();
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState<LegalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<{ row: LegalRequest; status: Status; label: string; destructive?: boolean } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', entity: '', type: TYPES[0], userId: '', contentId: '', deadline: '', evidence: '', notes: '' });

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('staff_list_legal_requests', { p_status: filter });
    if (error) {
      toast({ title: 'Could not load legal requests', description: friendlyError(error), variant: 'destructive' });
      setRows([]);
    } else {
      setRows((data || []) as LegalRequest[]);
    }
    setLoading(false);
  }, [filter, toast]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const update = async (note: string) => {
    if (!deciding) return;
    const { error } = await (supabase as any).rpc('staff_update_legal_request', { p_id: deciding.row.id, p_status: deciding.status, p_note: note });
    if (error) {
      toast({ title: 'Could not update', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: `Marked ${STATUS_LABEL[deciding.status].toLowerCase()}` });
    setDeciding(null);
    load();
  };

  const log = async () => {
    setSaving(true);
    const { error } = await (supabase as any).rpc('staff_log_legal_request', {
      p_requester_name: form.name,
      p_requester_entity: form.entity,
      p_request_type: form.type,
      p_target_user: form.userId.trim() || null,
      p_target_content: form.contentId.trim() || null,
      p_deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      p_evidence_url: form.evidence.trim() || null,
      p_notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not log the request', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: 'Request logged' });
    setLogOpen(false);
    setForm({ name: '', entity: '', type: TYPES[0], userId: '', contentId: '', deadline: '', evidence: '', notes: '' });
    load();
  };

  return (
    <section aria-labelledby="legal-title" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="legal-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Gavel className="h-5 w-5 text-primary" /> Legal requests</h2>
          <p className="text-sm text-muted-foreground mt-1">Court orders, law enforcement, copyright and data requests. Every change is logged.</p>
        </div>
        <Button className="h-10 rounded-xl gap-1.5 font-semibold" onClick={() => setLogOpen(true)}><Plus className="h-4 w-4" /> Log a request</Button>
      </header>

      <div role="tablist" aria-label="Filter legal requests" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={cn('h-9 px-3.5 rounded-full text-sm font-medium border transition-colors', filter === f.id ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground')}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No legal requests</p>
          <p className="text-sm text-muted-foreground mt-1">Log a request when one arrives so the deadline is tracked.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const dl = deadlineInfo(r.deadline_at, r.status);
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-muted-foreground">{r.request_id}</p>
                    <p className="font-semibold mt-0.5">{r.request_type} <span className="font-normal text-muted-foreground">from</span> {r.requester_name}, {r.requester_entity}</p>
                    {(r.target_user_name || r.target_content_id) && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        About {r.target_user_name ? <span className="font-medium text-foreground">{r.target_user_name}</span> : null}
                        {r.target_user_name && r.target_content_id ? ', ' : ''}
                        {r.target_content_id ? <span>content {r.target_content_id}</span> : null}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant="outline" className={cn('rounded-full', STATUS_STYLE[r.status])}>{STATUS_LABEL[r.status]}</Badge>
                    {dl && <span className={cn('text-xs flex items-center gap-1', dl.tone)}><Clock className="h-3 w-3" /> {dl.text}</span>}
                  </div>
                </div>

                {r.evidence_url && <a href={r.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-primary hover:underline">Open the document</a>}
                {r.internal_notes && <pre className="mt-3 rounded-xl bg-muted/50 border border-border p-3 text-xs whitespace-pre-wrap font-sans text-foreground/80">{r.internal_notes}</pre>}

                <div className="mt-4 flex flex-wrap gap-2">
                  {ACTIONS.filter((a) => a.status !== r.status).map((a) => (
                    <Button key={a.status} variant={a.destructive ? 'outline' : 'secondary'} size="sm" className="h-9 rounded-lg"
                      onClick={() => setDeciding({ row: r, status: a.status, label: a.label, destructive: a.destructive })}>
                      {a.label}
                    </Button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ReasonDialog
        open={!!deciding}
        title={deciding ? `${deciding.label}: ${deciding.row.request_id}` : ''}
        description="Write what was decided and why. It is added to the notes and the audit ledger."
        confirmLabel={deciding?.label || 'Confirm'}
        destructive={deciding?.destructive}
        onCancel={() => setDeciding(null)}
        onConfirm={(note) => update(note)}
      />

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log a legal request</DialogTitle>
            <DialogDescription>Record it as soon as it arrives. The reference number is created for you.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="lr-name">Requester</Label><Input id="lr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><Label htmlFor="lr-entity">Organisation</Label><Input id="lr-entity" value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })} className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lr-type">Type</Label>
              <select id="lr-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="lr-user">Account id (optional)</Label><Input id="lr-user" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="uuid" className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><Label htmlFor="lr-content">Content id (optional)</Label><Input id="lr-content" value={form.contentId} onChange={(e) => setForm({ ...form, contentId: e.target.value })} className="h-11 rounded-xl" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="lr-deadline">Deadline</Label><Input id="lr-deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="h-11 rounded-xl" /></div>
              <div className="space-y-1.5"><Label htmlFor="lr-evidence">Document link (optional)</Label><Input id="lr-evidence" value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} className="h-11 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="lr-notes">Notes</Label><Textarea id="lr-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-xl min-h-[90px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={log} disabled={saving || !form.name.trim() || !form.entity.trim()} className="rounded-xl font-semibold">{saving ? 'Saving' : 'Log request'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default LegalRequestsDesk;
