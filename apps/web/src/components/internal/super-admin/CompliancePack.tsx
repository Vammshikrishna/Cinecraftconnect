import { useCallback, useEffect, useState } from 'react';
import { Download, FileLock2, Hourglass } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { downloadJson, erasureUrgency, isMissingFunction, rowsToCsv } from '@/components/internal/shared/ownerTeamLogic';

interface ExportReq {
  id: string; subject_user: string; subject_name: string; requested_by: string; reason: string; status: 'pending' | 'approved' | 'rejected' | 'delivered';
  decided_by: string | null; decision_note: string | null; created_at: string;
}
interface ErasureReq {
  id: string; subject_label: string; source: string; received_at: string; due_at: string; status: 'received' | 'approved' | 'rejected' | 'completed';
  logged_by: string; days_left: number | null; decision_note: string | null;
}
interface Overview { me: string; exports: ExportReq[]; erasures: ErasureReq[] }

const SECTIONS = ['account', 'profile', 'posts', 'jobs_posted', 'job_applications', 'reports_filed', 'support_tickets'] as const;
const URGENCY = { done: '', ok: 'text-muted-foreground', soon: 'text-amber-600', overdue: 'text-red-600 font-bold' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ask =
  | { kind: 'export-decide'; id: string; approve: boolean }
  | { kind: 'erasure-decide'; id: string; status: 'approved' | 'rejected' | 'completed' }
  | null;

/**
 * Super admin only. Data-export requests (one super admin asks, a DIFFERENT one approves, then the bundle downloads as separate JSON/CSV files)
 * and the erasure request list with its 30-day clock. Nothing here deletes anybody. Needs part GI-2.
 */
const CompliancePack = () => {
  const { toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState('');
  const [erasureLabel, setErasureLabel] = useState('');
  const [erasureUser, setErasureUser] = useState('');
  const [source, setSource] = useState('user');
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: d, error } = await (supabase as any).rpc('compliance_overview');
    if (error) { setState(isMissingFunction(error) ? 'missing' : 'error'); if (!isMissingFunction(error)) toast({ title: 'Could not load', description: friendlyError(error), variant: 'destructive' }); return; }
    setData(d as Overview); setState('ready');
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc(fn, args);
    setBusy(false);
    if (error) { toast({ title: 'Not done', description: friendlyError(error), variant: 'destructive' }); return false; }
    toast({ title: ok }); void load(); return true;
  };

  const requestExport = async () => {
    if (!UUID.test(subject.trim())) return toast({ title: 'Paste the account id', description: 'It is the long id shown on the person\'s record in Admin > Users.', variant: 'destructive' });
    if (await run('compliance_request_export', { p_user: subject.trim(), p_reason: reason }, 'Export requested. A different super admin must approve it.')) { setSubject(''); setReason(''); }
  };

  const download = async (r: ExportReq) => {
    setBusy(true);
    const { data: bundle, error } = await (supabase as any).rpc('compliance_build_export', { p_id: r.id });
    setBusy(false);
    if (error) return toast({ title: 'Could not build the bundle', description: friendlyError(error), variant: 'destructive' });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`data-export-${r.subject_user.slice(0, 8)}-${stamp}-all.json`, bundle);
    for (const key of SECTIONS) {
      const csv = rowsToCsv((bundle as any)[key]);
      if (!csv) continue;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `data-export-${r.subject_user.slice(0, 8)}-${stamp}-${key}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    toast({ title: 'Bundle downloaded', description: 'Handle it as personal data and send it only to the person who asked.' });
    void load();
  };

  const logErasure = async () => {
    const u = erasureUser.trim();
    if (u && !UUID.test(u)) return toast({ title: 'That account id does not look right', variant: 'destructive' });
    if (await run('compliance_log_erasure', { p_user: u || null, p_label: erasureLabel, p_source: source }, 'Erasure request logged. The 30-day clock started.')) { setErasureLabel(''); setErasureUser(''); }
  };

  if (state === 'missing') {
    return (
      <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5 rounded-2xl" role="status">
        <p className="font-black text-sm">The compliance pack is not switched on yet</p>
        <p className="text-xs text-muted-foreground mt-1">Run <span className="font-mono">supabase/manual/part_gi_2_compliance_pack.sql</span> in the SQL editor, then press Refresh.</p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Refresh</Button>
      </div>
    );
  }
  if (state === 'error') return <div className="glass-card p-6 rounded-2xl" role="alert"><p className="font-black text-sm">Could not load the compliance pack</p><Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={load}>Try again</Button></div>;

  const me = data?.me;
  return (
    <div className="space-y-8">
      <section aria-label="Data export requests" className="glass-card p-6 rounded-2xl border-border/50 space-y-4">
        <div className="flex items-center gap-2"><FileLock2 className="h-4 w-4 text-primary" aria-hidden="true" /><h3 className="text-sm font-black uppercase tracking-widest">Data export requests</h3></div>
        <p className="text-xs text-muted-foreground">
          A bundle holds the account, profile, posts, jobs, applications, reports filed and support tickets. It never holds private chat messages
          (end-to-end encrypted), passwords, keys or tokens. One super admin asks, a different one approves. Every step is in the audit log.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input aria-label="Account id" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Account id (uuid)" className="font-mono text-xs" />
          <Input aria-label="Reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. the person asked on 3 Nov" />
          <Button className="rounded-xl" disabled={busy || reason.trim().length < 5 || !subject.trim()} onClick={requestExport}>Ask to export</Button>
        </div>
        {state === 'loading' ? <p className="text-sm text-muted-foreground">Loading…</p> : data?.exports.length === 0 ? <p className="text-sm text-muted-foreground">No export requests yet.</p> : (
          <ul className="space-y-2">
            {data?.exports.map((r) => (
              <li key={r.id} className="rounded-xl border border-border/50 p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{r.subject_name} <span className="font-mono text-[12px] text-muted-foreground">{r.subject_user.slice(0, 8)}</span></p>
                  <p className="text-xs text-muted-foreground truncate">{r.reason} · {new Date(r.created_at).toLocaleDateString()}{r.decision_note ? ` · ${r.decision_note}` : ''}</p>
                </div>
                <span className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">{r.status}</span>
                {r.status === 'pending' && r.requested_by !== me && (
                  <>
                    <Button size="sm" className="rounded-xl" disabled={busy} onClick={() => setAsk({ kind: 'export-decide', id: r.id, approve: true })}>Approve</Button>
                    <Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setAsk({ kind: 'export-decide', id: r.id, approve: false })}>Reject</Button>
                  </>
                )}
                {r.status === 'pending' && r.requested_by === me && <span className="text-xs text-muted-foreground">Waiting for a different super admin</span>}
                {(r.status === 'approved' || r.status === 'delivered') && (
                  <Button size="sm" className="rounded-xl gap-1.5" disabled={busy} onClick={() => download(r)}><Download className="h-3.5 w-3.5" /> Download</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Erasure requests" className="glass-card p-6 rounded-2xl border-border/50 space-y-4">
        <div className="flex items-center gap-2"><Hourglass className="h-4 w-4 text-primary" aria-hidden="true" /><h3 className="text-sm font-black uppercase tracking-widest">Erasure requests (30-day clock)</h3></div>
        <p className="text-xs text-muted-foreground">This list only tracks and approves. Nothing is deleted from here: delete the account by hand, then mark the request completed.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]">
          <Input aria-label="Who asked" value={erasureLabel} maxLength={200} onChange={(e) => setErasureLabel(e.target.value)} placeholder="Who asked (email or username)" />
          <Input aria-label="Account id (optional)" value={erasureUser} onChange={(e) => setErasureUser(e.target.value)} placeholder="Account id (optional)" className="font-mono text-xs" />
          <select aria-label="How it arrived" value={source} onChange={(e) => setSource(e.target.value)} className="rounded-md border border-border/60 bg-background px-2 text-sm h-10">
            <option value="user">In the app</option><option value="email">By email</option><option value="legal">Legal</option><option value="regulator">Regulator</option><option value="other">Other</option>
          </select>
          <Button className="rounded-xl" disabled={busy || (!erasureUser.trim() && erasureLabel.trim().length < 3)} onClick={logErasure}>Log request</Button>
        </div>
        {data?.erasures.length === 0 ? <p className="text-sm text-muted-foreground">No erasure requests.</p> : (
          <ul className="space-y-2">
            {data?.erasures.map((r) => {
              const u = erasureUrgency(r.days_left);
              return (
                <li key={r.id} className="rounded-xl border border-border/50 p-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{r.subject_label}</p>
                    <p className="text-xs text-muted-foreground">Received {new Date(r.received_at).toLocaleDateString()} · due {new Date(r.due_at).toLocaleDateString()} · via {r.source}</p>
                  </div>
                  {u !== 'done' && <span className={`text-xs ${URGENCY[u]}`}>{(r.days_left as number) < 0 ? `${Math.abs(r.days_left as number)} days overdue` : `${r.days_left} days left`}</span>}
                  <span className="text-[12px] font-black uppercase tracking-widest text-muted-foreground">{r.status}</span>
                  {r.status === 'received' && r.logged_by !== me && (
                    <>
                      <Button size="sm" className="rounded-xl" disabled={busy} onClick={() => setAsk({ kind: 'erasure-decide', id: r.id, status: 'approved' })}>Approve</Button>
                      <Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setAsk({ kind: 'erasure-decide', id: r.id, status: 'rejected' })}>Reject</Button>
                    </>
                  )}
                  {r.status === 'received' && r.logged_by === me && <span className="text-xs text-muted-foreground">Waiting for a different super admin</span>}
                  {r.status === 'approved' && <Button size="sm" variant="outline" className="rounded-xl" disabled={busy} onClick={() => setAsk({ kind: 'erasure-decide', id: r.id, status: 'completed' })}>Mark deletion done</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ReasonDialog
        open={!!ask}
        title={ask?.kind === 'export-decide' ? (ask.approve ? 'Approve this export' : 'Reject this export') : ask?.kind === 'erasure-decide' ? (ask.status === 'completed' ? 'Confirm the account was deleted' : ask.status === 'approved' ? 'Approve this erasure request' : 'Reject this erasure request') : ''}
        description={ask?.kind === 'erasure-decide' && ask.status === 'completed' ? 'Only confirm after the account and its data were deleted by hand.' : 'Your note is kept in the audit log.'}
        confirmLabel="Confirm"
        hideSavedReasons
        onCancel={() => setAsk(null)}
        onConfirm={async (note) => {
          const a = ask; setAsk(null);
          if (!a) return;
          if (a.kind === 'export-decide') await run('compliance_decide_export', { p_id: a.id, p_approve: a.approve, p_note: note }, a.approve ? 'Export approved' : 'Export rejected');
          else await run('compliance_decide_erasure', { p_id: a.id, p_status: a.status, p_note: note }, 'Saved');
        }}
      />
    </div>
  );
};

export default CompliancePack;
