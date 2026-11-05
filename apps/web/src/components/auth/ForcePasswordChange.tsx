import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const FORCED_PASSWORD_MIN = 12;

/** The rules for the password chosen on the forced-change screen; returns the problem in plain words, or null when it is fine. */
export function validateForcedPassword(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Enter the password you signed in with.';
  if (next.length < FORCED_PASSWORD_MIN) return `Choose a password of at least ${FORCED_PASSWORD_MIN} characters.`;
  if (next === current) return 'Choose a password different from the one you signed in with.';
  if (next !== confirm) return 'The two new passwords do not match.';
  return null;
}

/**
 * Shown instead of any page while profiles.force_password_reset is true (a new staff account, or a reset by a super admin).
 * Nothing else opens until the person has chosen their own password. Needs clear_my_password_reset() from part_gd_staff_security.sql.
 */
export const ForcePasswordChange = () => {
  const { user, signOut, refreshProfile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateForcedPassword(current, next, confirm);
    if (invalid) return setError(invalid);
    if (!user?.email) return setError('Sign in again to continue.');

    setBusy(true);
    setError('');
    try {
      const { error: reauth } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (reauth) throw new Error('That is not the password you signed in with.');
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      const { error: clearError } = await (supabase as any).rpc('clear_my_password_reset');
      if (clearError) throw clearError;
      await refreshProfile();
    } catch (err: any) {
      setError(friendlyError(err, 'Could not change the password. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-border bg-card p-8 space-y-5" aria-labelledby="force-pw-title">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center"><KeyRound className="h-6 w-6" aria-hidden="true" /></div>
        <div>
          <h1 id="force-pw-title" className="text-2xl font-bold tracking-tight">Choose your own password</h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Your account needs a new password before you can continue. The one you signed in with was only meant for the first sign-in.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fp-current">Password you signed in with</Label>
          <Input id="fp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fp-new">New password</Label>
          <Input id="fp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="h-11 rounded-xl" />
          <p className="text-xs text-muted-foreground">At least {FORCED_PASSWORD_MIN} characters.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fp-confirm">Type the new password again</Label>
          <Input id="fp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-xl" />
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={() => signOut()}>Sign out</Button>
          <Button type="submit" className="h-11 rounded-xl px-6 font-semibold" disabled={busy}>{busy ? 'Saving' : 'Save new password'}</Button>
        </div>
      </form>
    </main>
  );
};

export default ForcePasswordChange;
