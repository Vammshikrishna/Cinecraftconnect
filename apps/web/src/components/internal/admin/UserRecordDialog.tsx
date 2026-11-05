import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AlertTriangle, Ban, BadgeCheck, Flag, Gavel, History, ShieldAlert } from 'lucide-react';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import StaffNotes from '@/components/internal/admin/StaffNotes';
import { friendlyError } from '@cinecraft/core';
import { isMissingDbObject, moneyMap } from '@/components/internal/shared/deskLogic';
import { RepeatOffenderBanner, useRepeatFacts } from '@/components/internal/moderator/CaseToolsParts';

interface Props {
  userId: string | null;
  onClose: () => void;
}

type TimelineItem = { at: string; icon: JSX.Element; title: string; detail?: string };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Everything staff did to or about one account, in order, with the current strikes. Opened from User Management. */
const UserRecordDialog = ({ userId, onClose }: Props) => {
  const { toast } = useToast();
  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [striking, setStriking] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const repeatFacts = useRepeatFacts(userId);
  const [overview, setOverview] = useState<any | null>(null);
  const [overviewState, setOverviewState] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'denied' | 'error'>('idle');

  // orders, devices and reports: admins only, and it needs part GB. Anything else leaves the rest of the record untouched.
  useEffect(() => {
    setOverview(null);
    if (!userId) { setOverviewState('idle'); return; }
    let alive = true;
    setOverviewState('loading');
    (async () => {
      const { data, error } = await (supabase as any).rpc('staff_account_overview', { p_user: userId });
      if (!alive) return;
      if (error) {
        setOverviewState(isMissingDbObject(error) ? 'missing' : (error.code === '42501' || /admins only|two-step/i.test(error.message || '')) ? 'denied' : 'error');
        return;
      }
      setOverview(data);
      setOverviewState('ready');
    })();
    return () => { alive = false; };
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('get_user_record', { p_user: userId });
    if (error) toast({ title: 'Could not load the record', description: friendlyError(error), variant: 'destructive' });
    setRecord(error ? null : data);
    setLoading(false);
  }, [userId, toast]);

  useEffect(() => {
    setRecord(null);
    if (userId) load();
  }, [userId, load]);

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!record) return [];
    const items: TimelineItem[] = [];
    (record.strikes || []).forEach((s: any) => items.push({ at: s.created_at, icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />, title: 'Strike', detail: s.reason }));
    (record.bans || []).forEach((b: any) => {
      items.push({ at: b.created_at, icon: <Ban className="w-3.5 h-3.5 text-red-500" />, title: b.ban_type === 'permanent' ? 'Suspended (permanent)' : 'Suspended (temporary)', detail: b.reason });
      if (b.lifted_at) items.push({ at: b.lifted_at, icon: <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />, title: 'Suspension lifted' });
    });
    (record.reports_against || []).forEach((r: any) => items.push({ at: r.created_at, icon: <Flag className="w-3.5 h-3.5 text-rose-500" />, title: `Reported (${r.target_type}): ${String(r.reason).replace(/_/g, ' ')}`, detail: `${r.status}${r.resolution_note ? ' · ' + r.resolution_note : ''}` }));
    (record.appeals || []).forEach((a: any) => items.push({ at: a.created_at, icon: <Gavel className="w-3.5 h-3.5 text-blue-500" />, title: `Appeal (${a.status})`, detail: a.message }));
    (record.audit || []).forEach((l: any) => items.push({ at: l.created_at, icon: <History className="w-3.5 h-3.5 text-muted-foreground" />, title: `Staff: ${String(l.action).replace(/_/g, ' ')}`, detail: l.metadata?.reason || l.metadata?.note || undefined }));
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  }, [record]);

  const activeStrikes = (record?.strikes || []).filter((s: any) => !s.revoked_at && new Date(s.expires_at) > new Date());
  const p = record?.profile;

  const giveStrike = async (reason: string) => {
    const { data, error } = await (supabase as any).rpc('issue_strike', { p_user: userId, p_reason: reason });
    if (error) { toast({ title: 'Could not give a strike', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Strike given', description: `They now have ${data?.active_strikes ?? '?'} active strike(s).` });
    load();
  };

  const removeStrike = async (id: string, note: string) => {
    const { error } = await (supabase as any).rpc('revoke_strike', { p_strike: id, p_note: note });
    if (error) { toast({ title: 'Could not remove the strike', description: friendlyError(error), variant: 'destructive' }); return; }
    toast({ title: 'Strike removed' });
    load();
  };

  return (
    <Dialog open={!!userId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{p ? `@${p.username || p.id.slice(0, 8)}` : 'Account record'}</DialogTitle>
          <DialogDescription>
            {p ? `${p.full_name || ''} · ${p.account_type || ''} · joined ${p.created_at ? when(p.created_at) : '?'}` : 'Everything staff did to or about this account.'}
          </DialogDescription>
        </DialogHeader>

        {loading && !record ? (
          <div className="py-12 flex justify-center"><LoadingSpinner size="md" /></div>
        ) : !record ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">The record could not be loaded. Nothing was changed.</p>
            <Button variant="outline" size="sm" onClick={() => load()}>Try again</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {p?.is_banned && <Badge variant="destructive">Suspended</Badge>}
              {p?.is_shadowbanned && <Badge variant="outline" className="border-purple-500/30 text-purple-600">Shadowbanned</Badge>}
              {p?.muted_until && new Date(p.muted_until) > new Date() && <Badge variant="outline" className="border-amber-500/30 text-amber-600">Muted until {when(p.muted_until)}</Badge>}
              {record.rank > 0 && <Badge variant="outline">Staff</Badge>}
              <Badge variant="outline">{activeStrikes.length} active strike{activeStrikes.length === 1 ? '' : 's'}</Badge>
              <Badge variant="outline">{(record.reports_against || []).length} report(s) against</Badge>
              <Badge variant="outline">{record.reports_filed} report(s) filed</Badge>
            </div>

            <RepeatOffenderBanner facts={repeatFacts} />

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Strikes</h4>
                <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => setStriking(true)}>
                  <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Give a strike
                </Button>
              </div>
              {(record.strikes || []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">None.</p>
              ) : (
                (record.strikes || []).map((s: any) => {
                  const active = !s.revoked_at && new Date(s.expires_at) > new Date();
                  return (
                    <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm break-words">{s.reason}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {when(s.created_at)} · {s.revoked_at ? 'removed' : active ? `expires ${when(s.expires_at)}` : 'expired'}
                        </p>
                      </div>
                      {active && <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => setRemoving(s.id)}>Remove</Button>}
                    </div>
                  );
                })
              )}
            </section>

            <section className="space-y-2" aria-label="Orders, devices and reports">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Orders, devices and reports</h4>
              {overviewState === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
              {overviewState === 'missing' && <p className="text-sm text-muted-foreground" role="note">Not switched on yet. Run <span className="font-mono">supabase/manual/part_gb_admin_account_overview.sql</span>.</p>}
              {overviewState === 'denied' && <p className="text-sm text-muted-foreground" role="note">Admins only{'. '}This block shows payment and device facts.</p>}
              {overviewState === 'error' && <p className="text-sm text-muted-foreground" role="note">Could not load this block right now.</p>}
              {overviewState === 'ready' && overview && (
                <div className="grid gap-3 sm:grid-cols-2" data-testid="account-overview">
                  <div className="rounded-lg border border-border/40 p-3 space-y-1">
                    <p className="text-[12px] font-bold">Orders and payments</p>
                    {overview.orders ? (
                      <dl className="text-xs space-y-0.5">
                        <div className="flex justify-between"><dt className="text-muted-foreground">Bought / sold</dt><dd className="font-bold tabular-nums">{overview.orders.bought} / {overview.orders.sold}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Paid in total</dt><dd className="font-bold text-right">{moneyMap(overview.orders.paid_by_currency)}</dd></div>
                        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Earned (after fees)</dt><dd className="font-bold text-right">{moneyMap(overview.orders.earned_by_currency)}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted-foreground">Refunded / disputed</dt><dd className="font-bold tabular-nums">{overview.orders.refunded} / {overview.orders.disputed}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted-foreground">Last order</dt><dd className="font-bold">{overview.orders.last_order_at ? when(overview.orders.last_order_at) : 'none'}</dd></div>
                      </dl>
                    ) : <p className="text-xs text-muted-foreground">Not available.</p>}
                  </div>
                  <div className="rounded-lg border border-border/40 p-3 space-y-1">
                    <p className="text-[12px] font-bold">Warnings</p>
                    {overview.warnings ? (
                      <dl className="text-xs space-y-0.5">
                        <div className="flex justify-between"><dt className="text-muted-foreground">Active strikes</dt><dd className="font-bold tabular-nums">{overview.warnings.strikes_active}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted-foreground">Strikes ever</dt><dd className="font-bold tabular-nums">{overview.warnings.strikes_total}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted-foreground">Earlier suspensions</dt><dd className="font-bold tabular-nums">{overview.warnings.suspensions}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted-foreground">Last strike</dt><dd className="font-bold">{overview.warnings.last_strike_at ? when(overview.warnings.last_strike_at) : 'none'}</dd></div>
                      </dl>
                    ) : <p className="text-xs text-muted-foreground">Not available.</p>}
                  </div>
                  <div className="rounded-lg border border-border/40 p-3 space-y-1">
                    <p className="text-[12px] font-bold">Reports</p>
                    {overview.reports ? (
                      <>
                        <dl className="text-xs space-y-0.5">
                          <div className="flex justify-between"><dt className="text-muted-foreground">Against them (open / all)</dt><dd className="font-bold tabular-nums">{overview.reports.against_open} / {overview.reports.against_total}</dd></div>
                          <div className="flex justify-between"><dt className="text-muted-foreground">Filed by them (dismissed / all)</dt><dd className="font-bold tabular-nums">{overview.reports.filed_dismissed} / {overview.reports.filed_total}</dd></div>
                        </dl>
                        {(overview.reports.recent_against || []).length > 0 && (
                          <ul className="text-xs space-y-0.5 pt-1">
                            {overview.reports.recent_against.map((r: any) => (
                              <li key={r.id} className="text-muted-foreground">{String(r.reason).replace(/_/g, ' ')} ({r.target_type}) · {r.status} · {when(r.created_at)}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : <p className="text-xs text-muted-foreground">Not available.</p>}
                  </div>
                  <div className="rounded-lg border border-border/40 p-3 space-y-1">
                    <p className="text-[12px] font-bold">Devices and sessions</p>
                    {overview.sessions ? (
                      <>
                        <p className="text-xs text-muted-foreground">{overview.sessions.active} signed in now · {overview.sessions.total} ever{overview.sessions.suspicious ? ` · ${overview.sessions.suspicious} look suspicious` : ''}</p>
                        <ul className="text-xs space-y-0.5">
                          {(overview.sessions.devices || []).slice(0, 5).map((d: any, i: number) => (
                            <li key={i} className="flex justify-between gap-2">
                              <span className="truncate">{d.device}{d.platform ? ` (${d.platform})` : ''}{d.suspicious ? ' - suspicious' : ''}</span>
                              <span className="text-muted-foreground shrink-0">{d.signed_in ? 'signed in' : 'signed out'} · {when(d.last_active_at)}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : <p className="text-xs text-muted-foreground">Not available.</p>}
                  </div>
                </div>
              )}
            </section>

            {userId && <StaffNotes userId={userId} />}

            <section className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Timeline</h4>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nothing recorded yet.</p>
              ) : (
                <ol className="space-y-2">
                  {timeline.map((t, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1 shrink-0">{t.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.title}</p>
                        {t.detail && <p className="text-xs text-muted-foreground break-words">{t.detail}</p>}
                        <p className="text-[12px] text-muted-foreground">{when(t.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}

        <ReasonDialog
          open={striking}
          title="Give a strike?"
          description="They are warned. At three active strikes they are muted for a week. A strike expires after 180 days."
          confirmLabel="Give strike"
          destructive
          onCancel={() => setStriking(false)}
          onConfirm={async (reason) => { setStriking(false); await giveStrike(reason); }}
        />
        <ReasonDialog
          open={!!removing}
          title="Remove this strike?"
          description="Say why it should not count. This is recorded in the audit log."
          confirmLabel="Remove strike"
          onCancel={() => setRemoving(null)}
          onConfirm={async (note) => { const id = removing; setRemoving(null); if (id) await removeStrike(id, note); }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default UserRecordDialog;
