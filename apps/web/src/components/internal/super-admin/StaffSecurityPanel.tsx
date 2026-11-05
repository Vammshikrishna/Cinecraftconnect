import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Landmark, ShieldCheck, TimerReset } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';
import { friendlyError } from '@cinecraft/core';
import { cn } from '@/lib/utils';

interface Settings { require_mfa: boolean; idle_minutes: number; max_session_hours: number }
interface ReviewRow { user_id: string; full_name: string | null; username: string | null; role: string; last_reviewed_at: string | null; reviewed_by_name: string | null; is_due: boolean }

export const IDLE_MIN = 5, IDLE_MAX = 240, SESSION_MIN = 1, SESSION_MAX = 72;

/** The limits the field labels promise; a blank or fractional value is refused. */
export function validateSecurityLimits(s: { idle_minutes: number; max_session_hours: number }): string | null {
  const ok = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!ok(s.idle_minutes, IDLE_MIN, IDLE_MAX)) return `Inactivity limit must be a whole number from ${IDLE_MIN} to ${IDLE_MAX} minutes.`;
  if (!ok(s.max_session_hours, SESSION_MIN, SESSION_MAX)) return `Longest session must be a whole number from ${SESSION_MIN} to ${SESSION_MAX} hours.`;
  return null;
}

const ROLE_LABEL: Record<string, string> = { moderator: 'Moderator', admin: 'Admin', super_admin: 'Super admin', finance: 'Finance' };

interface Enrollment {
  require_mfa: boolean; super_admins: number; total: number; missing: number;
  pending_request: { id: string; maker_name: string | null; requested_at: string; mine: boolean } | null;
  people: { user_id: string; name: string; username: string | null; email: string | null; role: string; enrolled: boolean; enrolled_at: string | null }[];
}

/** Two-step sign-in, idle and session limits for staff, and the periodic check that everyone who holds a staff role still should. */
export const StaffSecurityPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<ReviewRow | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrollmentMissing, setEnrollmentMissing] = useState(false);
  const [askingMfa, setAskingMfa] = useState(false);
  const [refundLimit, setRefundLimit] = useState<{ single: string; loaded: boolean }>({ single: '', loaded: false });
  const [settingLimit, setSettingLimit] = useState(false);

  const load = useCallback(async () => {
    const [s, r, e, l] = await Promise.all([
      (supabase as any).rpc('staff_security_settings'),
      (supabase as any).rpc('staff_roles_for_review', { p_days: 90 }),
      (supabase as any).rpc('staff_mfa_enrollment'),
      (supabase as any).rpc('finance_refund_settings'),
    ]);
    // the enrollment list and the refund limit come from SQL parts GD and GC; until they are run the rest still works
    setEnrollmentMissing(!!e.error);
    setEnrollment(e.error ? null : (e.data as Enrollment));
    if (!l.error && l.data) setRefundLimit({ single: String(Math.round((l.data.single_approver_limit_minor || 0) / 100)), loaded: true });
    if (s.error) toast({ title: 'Could not load settings', description: friendlyError(s.error), variant: 'destructive' });
    if (r.error) toast({ title: 'Could not load the role review', description: friendlyError(r.error), variant: 'destructive' });
    setSettings(s.data || null);
    setDraft(s.data || null);
    setRows((r.data || []) as ReviewRow[]);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  if (!settings || !draft) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);

  const limitError = validateSecurityLimits(draft);

  const save = async () => {
    if (limitError) return toast({ title: 'Check the limits', description: limitError, variant: 'destructive' });
    setSaving(true);
    const { error } = await (supabase as any).rpc('staff_set_security_settings', {
      p_require_mfa: draft.require_mfa,
      p_idle_minutes: draft.idle_minutes,
      p_max_session_hours: draft.max_session_hours,
    });
    setSaving(false);
    if (error) return toast({ title: 'Could not save', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Staff security updated' });
    void load();
  };

  const confirm = async (note: string) => {
    if (!confirming) return;
    const { error } = await (supabase as any).rpc('staff_confirm_role', { p_user: confirming.user_id, p_note: note });
    if (error) {
      toast({ title: 'Could not confirm', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: `${confirming.full_name || confirming.username || 'Role'} confirmed` });
    setConfirming(null);
    void load();
  };

  const due = rows.filter((r) => r.is_due).length;

  const askForMfa = async (note: string) => {
    const { error } = await (supabase as any).rpc('staff_request_mfa_requirement', { p_reason: note });
    if (error) return toast({ title: 'Could not ask for approval', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Sent for second approval', description: 'A different super admin must approve it in the Approvals tab.' });
    setAskingMfa(false);
    void load();
  };

  const saveRefundLimit = async (note: string) => {
    const major = Number(refundLimit.single);
    const { error } = await (supabase as any).rpc('finance_set_refund_limit', { p_minor: Math.round(major * 100), p_reason: note });
    if (error) return toast({ title: 'Could not save the limit', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Refund approval limit updated' });
    setSettingLimit(false);
    void load();
  };

  return (
    <div className="space-y-10">
      <section aria-labelledby="sec-title" className="space-y-4">
        <header>
          <h2 id="sec-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Staff security</h2>
          <p className="text-sm text-muted-foreground mt-1">Applies to everyone with a staff role.</p>
        </header>

        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          <div className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <Label htmlFor="req-mfa" className="text-base font-semibold">Require two-step sign-in</Label>
              <p className="text-sm text-muted-foreground mt-0.5">Staff must enter a code from an authenticator app before they can use any console or decide any request. Switching it on needs a second super admin to approve it, and only works once every staff member has set it up (see the list below).</p>
            </div>
            <Switch id="req-mfa" checked={draft.require_mfa} disabled={!draft.require_mfa && (enrollmentMissing || !!enrollment?.pending_request || (enrollment?.missing ?? 0) > 0)}
              onCheckedChange={(v) => { if (v) setAskingMfa(true); else setDraft({ ...draft, require_mfa: false }); }} />
          </div>
          <div className="grid sm:grid-cols-2 gap-5 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="idle">Sign out after inactivity (minutes)</Label>
              <Input id="idle" type="number" step={1} min={IDLE_MIN} max={IDLE_MAX} aria-invalid={!Number.isInteger(draft.idle_minutes) || draft.idle_minutes < IDLE_MIN || draft.idle_minutes > IDLE_MAX} value={draft.idle_minutes} onChange={(e) => setDraft({ ...draft, idle_minutes: Number(e.target.value) })} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxh">Longest session (hours)</Label>
              <Input id="maxh" type="number" step={1} min={SESSION_MIN} max={SESSION_MAX} aria-invalid={!Number.isInteger(draft.max_session_hours) || draft.max_session_hours < SESSION_MIN || draft.max_session_hours > SESSION_MAX} value={draft.max_session_hours} onChange={(e) => setDraft({ ...draft, max_session_hours: Number(e.target.value) })} className="h-11 rounded-xl" />
            </div>
          </div>
          {dirty && limitError && <p role="alert" className="px-5 pb-1 text-sm text-destructive">{limitError}</p>}
          <div className="flex justify-end gap-2 p-4">
            <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(settings)}>Discard</Button>
            <Button className="rounded-xl font-semibold" disabled={!dirty || saving || !!limitError} onClick={save}>{saving ? 'Saving' : 'Save changes'}</Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="mfa-title" className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="mfa-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Two-step sign-in set-up</h2>
            <p className="text-sm text-muted-foreground mt-1">Everyone must be set up before the requirement can be switched on, or they would be locked out. Each person sets it up themselves from the banner at the top of their console.</p>
          </div>
          {enrollment && (
            <Badge className={cn('rounded-full border', enrollment.missing === 0 ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' : 'bg-amber-500/15 text-amber-700 border-amber-500/30')}>
              {enrollment.total - enrollment.missing} of {enrollment.total} set up
            </Badge>
          )}
        </header>

        {enrollmentMissing ? (
          <p role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            The set-up list is not switched on yet. Run <span className="font-mono">supabase/manual/part_gd_staff_security.sql</span> in the SQL editor, then reload.
          </p>
        ) : enrollment && (
          <>
            {enrollment.pending_request && (
              <p role="status" className="rounded-2xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm">
                {enrollment.pending_request.mine
                  ? 'You asked to require two-step sign-in. A different super admin has to approve it in the Approvals tab.'
                  : `${enrollment.pending_request.maker_name || 'A super admin'} asked to require two-step sign-in. Approve it in the Approvals tab.`}
              </p>
            )}
            {!draft.require_mfa && !enrollment.pending_request && enrollment.missing === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                <p className="text-sm">Everyone is set up. You can now ask for the requirement to be switched on.</p>
                <Button className="rounded-xl font-semibold" onClick={() => setAskingMfa(true)} disabled={enrollment.super_admins < 2}>Ask for approval</Button>
              </div>
            )}
            <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden" aria-label="Two-step sign-in set-up by person">
              {enrollment.people.map((p) => (
                <li key={p.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name} <span className="text-muted-foreground font-normal">· {ROLE_LABEL[p.role] || p.role}</span></p>
                    {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                  </div>
                  <Badge variant="outline" className={cn('rounded-full', p.enrolled ? 'border-emerald-500/40 text-emerald-700 bg-emerald-500/10' : 'border-amber-500/40 text-amber-700 bg-amber-500/10')}>
                    {p.enrolled ? 'Set up' : 'Not set up yet'}
                  </Badge>
                </li>
              ))}
              {enrollment.people.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No staff accounts found.</li>}
            </ul>
          </>
        )}
      </section>

      {refundLimit.loaded && (
        <section aria-labelledby="refund-limit-title" className="space-y-4">
          <header>
            <h2 id="refund-limit-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Refund approval limit</h2>
            <p className="text-sm text-muted-foreground mt-1">A refund up to this amount needs one approver; above it, two different approvers. The person who asked for a refund can never approve it.</p>
          </header>
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5">
            <div className="space-y-1.5">
              <Label htmlFor="refund-limit">Limit (in main currency units)</Label>
              <Input id="refund-limit" type="number" min={0} step={1} value={refundLimit.single} onChange={(e) => setRefundLimit({ ...refundLimit, single: e.target.value })} className="h-11 w-48 rounded-xl" />
            </div>
            <Button className="rounded-xl font-semibold" disabled={!/^\d+$/.test(refundLimit.single)} onClick={() => setSettingLimit(true)}>Save limit</Button>
          </div>
        </section>
      )}

      <section aria-labelledby="rev-title" className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="rev-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><TimerReset className="h-5 w-5 text-primary" /> Role review</h2>
            <p className="text-sm text-muted-foreground mt-1">Confirm every 90 days that each person still needs their role. To remove a role, use the staff matrix.</p>
          </div>
          {due > 0 && <Badge className="rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30">{due} due for review</Badge>}
        </header>

        <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {rows.map((r) => (
            <li key={r.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{r.full_name || r.username || 'Unknown'} <span className="text-muted-foreground font-normal">· {ROLE_LABEL[r.role] || r.role}</span></p>
                <p className={cn('text-xs mt-0.5', r.is_due ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
                  {r.last_reviewed_at ? `Confirmed ${new Date(r.last_reviewed_at).toLocaleDateString()}${r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ''}` : 'Never confirmed'}
                </p>
              </div>
              {r.user_id === user?.id ? (
                <span className="text-xs text-muted-foreground">Another super admin confirms you</span>
              ) : (
                <Button size="sm" variant={r.is_due ? 'default' : 'secondary'} className="h-9 rounded-lg gap-1.5" onClick={() => setConfirming(r)}>
                  <BadgeCheck className="h-4 w-4" /> Confirm role
                </Button>
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">No staff accounts found.</li>}
        </ul>
      </section>

      <ReasonDialog
        open={askingMfa}
        title="Ask to require two-step sign-in for all staff"
        description="A different super admin has to approve it. Say why. It is recorded in the audit ledger."
        confirmLabel="Ask for approval"
        hideSavedReasons
        onCancel={() => setAskingMfa(false)}
        onConfirm={(note) => askForMfa(note)}
      />
      <ReasonDialog
        open={settingLimit}
        title="Change the refund approval limit"
        description="Say why. It is recorded in the audit ledger."
        confirmLabel="Save limit"
        hideSavedReasons
        onCancel={() => setSettingLimit(false)}
        onConfirm={(note) => saveRefundLimit(note)}
      />
      <ReasonDialog
        open={!!confirming}
        title={confirming ? `Confirm ${confirming.full_name || confirming.username || 'this person'} as ${ROLE_LABEL[confirming.role] || confirming.role}` : ''}
        description="Say why they still need this role. It is recorded in the audit ledger."
        confirmLabel="Confirm role"
        hideSavedReasons
        onCancel={() => setConfirming(null)}
        onConfirm={(note) => confirm(note)}
      />
    </div>
  );
};

export default StaffSecurityPanel;
