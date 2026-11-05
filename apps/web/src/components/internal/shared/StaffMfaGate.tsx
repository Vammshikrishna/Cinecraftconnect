import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { friendlyError } from '@cinecraft/core';

interface SecuritySettings { require_mfa: boolean; idle_minutes: number; max_session_hours: number }
const DEFAULTS: SecuritySettings = { require_mfa: false, idle_minutes: 30, max_session_hours: 12 };

/** Signs staff out after a period of no activity, and after a maximum session length, whatever they are doing. */
const useStaffSessionLimits = (settings: SecuritySettings) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const last = useRef(Date.now());
  const warned = useRef(false);

  const end = useCallback(async (why: string) => {
    toast({ title: 'Signed out for security', description: why });
    await supabase.auth.signOut();
    window.location.href = '/auth';
  }, [toast]);

  useEffect(() => {
    const touch = () => { last.current = Date.now(); warned.current = false; };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => {
      const idleMs = Date.now() - last.current;
      const limit = settings.idle_minutes * 60000;
      if (idleMs >= limit) return void end(`You were inactive for ${settings.idle_minutes} minutes.`);
      if (!warned.current && limit - idleMs <= 2 * 60000) {
        warned.current = true;
        toast({ title: 'Still there?', description: 'You will be signed out in about 2 minutes unless you use the console.' });
      }
      const since = user?.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : null;
      if (since && Date.now() - since >= settings.max_session_hours * 3600000) {
        void end(`Staff sessions last at most ${settings.max_session_hours} hours. Please sign in again.`);
      }
    }, 15000);
    return () => { events.forEach((e) => window.removeEventListener(e, touch)); clearInterval(timer); };
  }, [settings.idle_minutes, settings.max_session_hours, user?.last_sign_in_at, end, toast]);
};

/** Scan a code, then type the 6 digits. Used when two-step sign-in is required, and from the optional banner. */
const Enroll = ({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) => {
  const { toast } = useToast();
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // a half-finished earlier attempt blocks a new one, so clear it first
        const { data: list } = await supabase.auth.mfa.listFactors();
        for (const f of (list as any)?.all || []) {
          if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `CineCraft staff ${new Date().toISOString().slice(0, 10)}` });
        if (e) throw e;
        if (alive && data) setFactor({ id: data.id, qr: (data as any).totp.qr_code, secret: (data as any).totp.secret });
      } catch (e: any) {
        if (alive) setError(friendlyError(e, 'Could not start the setup. Two-step sign-in may not be switched on for this project yet.'));
      }
    })();
    return () => { alive = false; };
  }, []);

  const verify = async (value: string) => {
    if (!factor || value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const ch = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (ch.error) throw ch.error;
      const v = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.data.id, code: value });
      if (v.error) throw v.error;
      await supabase.auth.refreshSession();
      toast({ title: 'Two-step sign-in is on' });
      onDone();
    } catch (e: any) {
      setError('That code did not work. Check the time on your phone and try the next code.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center"><ShieldCheck className="h-7 w-7" /></div>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Set up two-step sign-in</h2>
        <p className="text-sm text-muted-foreground mt-1">Scan this with an authenticator app (Google Authenticator, 1Password, Authy), then enter the 6 digits it shows.</p>
      </div>
      {!factor && !error && <div className="flex justify-center py-6"><LoadingSpinner size="lg" /></div>}
      {factor && (
        <>
          <img src={factor.qr} alt="QR code for your authenticator app" className="mx-auto h-44 w-44 rounded-xl border border-border bg-white p-2" />
          <p className="text-xs text-muted-foreground">Cannot scan? Enter this key: <span className="font-mono select-all text-foreground">{factor.secret}</span></p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v); if (v.length === 6) void verify(v); }} disabled={busy} autoFocus>
              <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /></InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
            </InputOTP>
          </div>
        </>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {busy && <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking</p>}
      {onCancel && <Button variant="ghost" onClick={onCancel}>Not now</Button>}
    </div>
  );
};

/** The 6-digit step on every new sign-in once a factor exists. */
const Verify = ({ onDone }: { onDone: () => void }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const { data: list } = await supabase.auth.mfa.listFactors();
      const factor = (list as any)?.totp?.[0];
      if (!factor) throw new Error('No authenticator is set up for this account.');
      const ch = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (ch.error) throw ch.error;
      const v = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.data.id, code: value });
      if (v.error) throw v.error;
      await supabase.auth.refreshSession();
      onDone();
    } catch {
      setError('That code did not work. Try the next one.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center"><KeyRound className="h-7 w-7" /></div>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Enter your code</h2>
        <p className="text-sm text-muted-foreground mt-1">Open your authenticator app and type the 6 digits for CineCraft.</p>
      </div>
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v); if (v.length === 6) void submit(v); }} disabled={busy} autoFocus>
          <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /></InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
        </InputOTP>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {busy && <p className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking</p>}
    </div>
  );
};

const Inner = ({ settings, children }: { settings: SecuritySettings; children: React.ReactNode }) => {
  useStaffSessionLimits(settings);
  return <>{children}</>;
};

/**
 * Wraps the staff consoles. When a super admin has turned two-step sign-in on for staff, nobody gets past this without a
 * code. While it is off, staff who have not set it up see a small reminder. Idle and maximum session limits apply either way.
 */
export const StaffMfaGate = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [level, setLevel] = useState<{ current: string; next: string } | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    const [s, a] = await Promise.all([
      (supabase as any).rpc('staff_security_settings'),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setSettings(s.error || !s.data ? DEFAULTS : (s.data as SecuritySettings));
    setLevel({ current: (a.data as any)?.currentLevel || 'aal1', next: (a.data as any)?.nextLevel || 'aal1' });
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!settings || !level) {
    return <div className="min-h-[60vh] flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  const hasFactor = level.next === 'aal2';
  const satisfied = level.current === 'aal2';

  if (settings.require_mfa && !satisfied) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          {hasFactor ? <Verify onDone={refresh} /> : <Enroll onDone={refresh} />}
        </div>
      </main>
    );
  }

  return (
    <Inner settings={settings}>
      {!settings.require_mfa && !hasFactor && !dismissed && (
        <div role="status" className="w-full border-b border-amber-500/25 bg-amber-500/10">
          <div className="mx-auto max-w-[1600px] flex items-center gap-3 px-4 sm:px-6 py-2">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="flex-1 min-w-0 text-[13px] text-foreground truncate sm:whitespace-normal">
              <span className="font-semibold">Protect this staff account.</span>{' '}
              <span className="text-muted-foreground hidden sm:inline">Add two-step sign-in. It will become required for staff.</span>
            </p>
            <Button size="sm" className="h-8 rounded-lg px-3 text-[13px] font-semibold shrink-0" onClick={() => setEnrolling(true)}>Set up</Button>
            <button type="button" onClick={() => setDismissed(true)} className="h-8 px-2 text-[13px] text-muted-foreground hover:text-foreground shrink-0">Later</button>
          </div>
        </div>
      )}
      {enrolling ? (
        <main className="min-h-[70vh] flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm">
            <Enroll onDone={() => { setEnrolling(false); void refresh(); }} onCancel={() => setEnrolling(false)} />
          </div>
        </main>
      ) : children}
    </Inner>
  );
};

export default StaffMfaGate;
