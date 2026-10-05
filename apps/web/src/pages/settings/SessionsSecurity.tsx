import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SessionData, SessionCard } from '@/components/security/SessionCard';
import { collectDeviceMetadata } from '@/lib/auth/deviceFingerprint';
import { toast } from 'sonner';
import { Shield, MonitorSmartphone } from 'lucide-react';
import { BackButton } from '@/components/common/BackButton';

const SessionsSecurity = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    if (!user) return;
    try {
      const meta = await collectDeviceMetadata();
      
      const { data, error } = await supabase
        .from('user_sessions' as any)
        .select('*')
        .eq('user_id', user.id)
        .is('revoked_at', null)
        .order('last_active_at', { ascending: false });

      if (error) {
        // Handle case where table doesn't exist yet gracefully
        console.error('Failed to load sessions', error);
        return;
      }

      const mapped = (data || []).map((s: any) => ({
        ...s,
        is_current: s.device_id === meta.deviceId
      })) as SessionData[];

      // Sort so current is always on top
      mapped.sort((a, b) => (a.is_current === b.is_current ? 0 : a.is_current ? -1 : 1));

      setSessions(mapped);
    } catch (e) {
      console.error('Failed to load sessions exception', e);
      toast.error('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      // Server-side: invalidate the refresh tokens of ALL other devices (Supabase cannot target a single one).
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
      console.error('Failed to revoke session', e);
      toast.error('Failed to logout device');
    } finally {
      setRevokingId(null);
    }
  };

  return (
     <div className="pb-10">
      <main className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6">
            <BackButton label="BACK TO SECURITY" to="/settings/security" className="mb-4 lg:hidden" />
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <MonitorSmartphone className="h-8 w-8 text-primary" />
                Active Sessions
            </h1>
            <p className="text-muted-foreground mt-2">Manage your trusted devices</p>
        </div>
        
        <div className="bg-card p-6 rounded-2xl border flex items-start gap-4 shadow-sm">
          <div className="p-3 bg-primary/10 rounded-full shrink-0 text-primary">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Trusted Devices</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Review devices that have access to your account. You can log out of any unfamiliar or old devices here to secure your account.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground ml-1">
            Active Sessions
          </h3>
          
          {loading ? (
             <div className="space-y-4 animate-pulse">
                {[1,2,3].map(i => (
                   <div key={i} className="h-24 bg-muted rounded-xl border"></div>
                ))}
             </div>
          ) : (
            <div className="space-y-4">
               {sessions.map(s => (
                 <SessionCard 
                   key={s.id} 
                   session={s} 
                   onRevoke={handleRevoke}
                   isRevoking={revokingId === s.id}
                 />
               ))}
               
               {sessions.length === 0 && (
                  <div className="text-center p-8 text-muted-foreground border rounded-xl bg-card">
                    No active sessions tracked yet.
                  </div>
               )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SessionsSecurity;
