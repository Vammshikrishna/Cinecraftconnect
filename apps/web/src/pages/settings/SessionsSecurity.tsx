import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SessionData, SessionCard } from '@/components/security/SessionCard';
import { collectDeviceMetadata } from '@/lib/auth/deviceFingerprint';
import { toast } from '@/hooks/use-toast';
import { confirmDialog } from '@/lib/confirmDialog';
import { Shield, MonitorSmartphone, Loader2 } from 'lucide-react';
import { SettingsPageHeader } from '@/components/settings/SettingsUI';

const SessionsSecurity = () => {
  const { user, signOut } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    if (!user) return;
    setLoadError(false);
    try {
      const [meta, { data, error }] = await Promise.all([
        collectDeviceMetadata(),
        supabase
        .from('user_sessions' as any)
        .select('*')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .order('last_active_at', { ascending: false }),
      ]);

      if (error) {
        // Handle case where table doesn't exist yet gracefully
        console.error('Failed to load sessions', error);
        setLoadError(true);
        return;
      }

      // The login token rotates on every refresh and each rotation leaves its own row, so one device can appear many times.
      // Rows arrive newest first: keep the newest row per device so each device is listed (and can be logged out) once.
      const seen = new Set<string>();
      const newestPerDevice = (data || []).filter((s: any) => {
        const key = s.device_id || s.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const mapped = newestPerDevice.map((s: any) => ({
        ...s,
        is_current: s.device_id === meta.deviceId
      })) as SessionData[];

      // Sort so current is always on top
      mapped.sort((a, b) => (a.is_current === b.is_current ? 0 : a.is_current ? -1 : 1));

      setSessions(mapped);
    } catch (e) {
      console.error('Failed to load sessions exception', e);
      setLoadError(true);
      toast.error('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  // Signs out ONE device: the database function deletes just that auth session (part_dr_revoke_one_session.sql).
  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const { error } = await (supabase as any).rpc('revoke_my_session', { p_session_id: sessionId });
      if (error) throw error;

      toast.success('Logged out of that device');
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (e: any) {
      console.error('Failed to revoke session', e);
      toast.error(e?.message ? `Could not log out that device: ${e.message}` : 'Failed to logout device');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    const n = sessions.filter(s => !s.is_current).length;
    const ok = await confirmDialog(`This signs you out on ${n} other device${n === 1 ? '' : 's'}. This device stays signed in.`, {
      title: `Sign out of ${n} other device${n === 1 ? '' : 's'}?`,
      confirmLabel: 'Sign out other devices',
      destructive: true,
    });
    if (!ok) return;
    setRevokingId('__others__');
    try {
      // Server-side: invalidate the refresh tokens of ALL other devices.
      const { data: fnData, error: fnError } = await supabase.functions.invoke('revoke-other-sessions');
      if (fnError || (fnData as any)?.error) throw fnError || new Error((fnData as any).error);

      // Mark every non-current session row as revoked so the list and realtime monitors stay consistent.
      const meta = await collectDeviceMetadata();
      const { error } = await supabase
        .from('user_sessions' as any)
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', user!.id)
        .neq('device_id', meta.deviceId)
        .is('revoked_at', null);
      if (error) throw error;

      toast.success('Logged out of all other devices');
      setSessions(prev => prev.filter(s => s.is_current));
    } catch (e) {
      console.error('Failed to revoke other sessions', e);
      toast.error('Failed to log out other devices');
    } finally {
      setRevokingId(null);
    }
  };

  return (
     <>
      <SettingsPageHeader
        title="Where you are logged in"
        description="Review devices that have access to your account. Log out of any you do not recognise."
      />

      <section className="mb-8">
        <h3 className="text-base font-semibold mb-3">Active sessions</h3>
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading sessions">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-2xl border animate-pulse" aria-hidden="true"></div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                onRevoke={handleRevoke}
                isRevoking={revokingId === s.id}
                onSignOutHere={() => { void signOut(); }}
              />
            ))}

            {sessions.some(s => !s.is_current) && (
              <button
                type="button"
                onClick={handleRevokeOthers}
                disabled={revokingId !== null}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/15 disabled:opacity-50"
              >
                {revokingId === '__others__' && <Loader2 className="h-4 w-4 animate-spin" />}
                {revokingId === '__others__' ? 'Signing out...' : 'Sign out everywhere else'}
              </button>
            )}

            {sessions.length === 0 && loadError && (
              <div role="alert" className="text-center p-8 text-sm text-destructive border rounded-2xl bg-card space-y-3">
                <p>Could not load your sessions.</p>
                <button type="button" className="underline text-foreground" onClick={() => { setLoading(true); fetchSessions(); }}>Try again</button>
              </div>
            )}
            {sessions.length === 0 && !loadError && (
              <div className="text-center p-8 text-sm text-muted-foreground border rounded-2xl bg-card">
                No active sessions tracked yet.
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
};

export default SessionsSecurity;
