import { useEffect, useState } from 'react';
import { Eye, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { friendlyError } from '@cinecraft/core';
import { endStaffAccess, expireStaffAccess, type StaffTarget } from '@/lib/staffAccess';

interface Props {
  targetType: StaffTarget;
  targetId: string;
  /** called after the visit has ended (Lock) or run out, so the screen can go back to the access gate */
  onEnded: () => void;
}

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
};

/**
 * The one place that tells a staff member what this visit is: read-only, audited, and for how long.
 * Shown at the top of every room and project space a staff member is observing.
 */
export const StaffObserverBanner = ({ targetType, targetId, onEnded }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!user?.id || !targetId) return;
    let alive = true;
    (supabase as any)
      .from('space_access_grants')
      .select('expires_at')
      .eq('user_id', user.id)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => { if (alive && data?.expires_at) setExpiresAt(new Date(data.expires_at).getTime()); });
    return () => { alive = false; };
  }, [user?.id, targetType, targetId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = expiresAt ? expiresAt - now : null;

  useEffect(() => {
    if (remaining !== null && remaining <= 0) {
      expireStaffAccess(targetType, targetId).finally(() => {
        toast({ title: 'Access ended', description: 'Your audited access to this space has expired.' });
        onEnded();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining !== null && remaining <= 0]);

  const lock = async () => {
    setLocking(true);
    try {
      await endStaffAccess(targetType, targetId);
      toast({ title: 'Access ended', description: 'Your audited access has been removed.' });
      onEnded();
    } catch (e: any) {
      toast({ title: 'Could not end access', description: friendlyError(e), variant: 'destructive' });
    } finally {
      setLocking(false);
    }
  };

  const low = remaining !== null && remaining < 5 * 60 * 1000;

  return (
    <div role="status" className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-amber-500/25 bg-amber-500/10">
      <Eye className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
      <p className="flex-1 min-w-0 text-sm text-foreground">
        <span className="font-semibold">Audited access, read only.</span>{' '}
        <span className="text-muted-foreground hidden sm:inline">You can read but not post, and you are not shown as a member. Everything you do is logged.</span>
      </p>
      {remaining !== null && (
        <span className={`text-sm font-medium tabular-nums shrink-0 ${low ? 'text-destructive' : 'text-foreground'}`} aria-label="Time left">{fmt(remaining)} left</span>
      )}
      <Button size="sm" variant="outline" onClick={lock} disabled={locking} className="h-8 rounded-lg gap-1.5 shrink-0">
        {locking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} End access
      </Button>
    </div>
  );
};
