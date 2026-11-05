import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { joinRequestUiState } from './joinRequestStatus';

interface PrivateRoomAccessPanelProps {
  roomId: string;
  roomTitle: string;
  roomDescription: string | null;
  onClose: () => void;
  showBackButton?: boolean;
}

/**
 * Shown to someone who is not a member of a private room. Only a request whose status is "pending"
 * shows "Request Pending"; a rejected or old request lets the user ask again.
 * (Same panel as the inline copy in pages/DiscussionRooms.tsx, with the status fix.)
 */
export const PrivateRoomAccessPanel = ({
  roomId,
  roomTitle,
  roomDescription,
  onClose,
  showBackButton = false,
}: PrivateRoomAccessPanelProps) => {
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'loading'>('loading');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  const { push } = useAppNavigation();
  const { toast } = useToast();

  useEffect(() => {
    const checkRequestStatus = async () => {
      if (!user) {
        setRequestStatus('none');
        return;
      }
      if (!roomId) return;
      try {
        const { data, error } = await supabase
          .from('room_join_requests')
          .select('id, status, created_at')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        const rows = (data as any[]) || [];
        const state = joinRequestUiState(rows);
        setRequestStatus(state);
        setRequestId(state === 'pending' ? String(rows[0]?.id ?? '') || null : null);
        setDeclined(state === 'none' && /reject|declin|deny|denied/i.test(String(rows[0]?.status || '')));
      } catch (err) {
        console.error('Error checking join request status:', err);
        setRequestStatus('none');
      }
    };
    checkRequestStatus();
  }, [user, roomId]);

  const handleRequestAccess = async () => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Redirecting to sign in page...', variant: 'destructive' });
      push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!roomId) return;
    try {
      setRequestStatus('loading');
      const { data, error } = await supabase
        .from('room_join_requests')
        .insert({ room_id: roomId, user_id: user.id, status: 'pending', ...(message.trim() ? { message: message.trim().slice(0, 300) } : {}) } as any)
        .select('id')
        .maybeSingle();

      if (error) throw error;

      setRequestStatus('pending');
      setDeclined(false);
      setRequestId((data as any)?.id ? String((data as any).id) : null);
      toast({ title: 'Request Sent', description: 'Your request to join this private room has been sent to the admin.' });
    } catch (err: any) {
      console.error('Error sending join request:', err);
      // a second pending request for the same room is refused by the database: show the state instead of an error
      if (err?.code === '23505') {
        setRequestStatus('pending');
        toast({ title: 'Already requested', description: 'You already have a pending request for this room.' });
        return;
      }
      toast({ title: 'Request Failed', description: friendlyError(err), variant: 'destructive' });
      setRequestStatus('none');
    }
  };

  const handleCancelRequest = async () => {
    if (!user || !roomId) return;
    try {
      setRequestStatus('loading');
      let q = supabase.from('room_join_requests').delete().eq('room_id', roomId).eq('user_id', user.id).eq('status', 'pending');
      if (requestId) q = q.eq('id', requestId as any);
      const { error } = await q;
      if (error) throw error;
      setRequestStatus('none');
      setRequestId(null);
      toast({ title: 'Request cancelled', description: 'You can ask again any time.' });
    } catch (err: any) {
      toast({ title: 'Could not cancel', description: friendlyError(err), variant: 'destructive' });
      setRequestStatus('pending');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background relative select-none animate-in fade-in duration-300">
      {showBackButton && (
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 hover:bg-foreground/5 rounded-xl px-4 h-10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-bold text-xs uppercase tracking-wider">Back</span>
          </Button>
        </div>
      )}

      <div className="w-full max-w-md p-8 rounded-3xl glass-card-premium border border-foreground/10 shadow-2xl relative overflow-hidden flex flex-col items-center text-center space-y-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -ml-16 -mb-16" />

        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 relative shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]">
          <div className="absolute inset-0 rounded-full bg-primary/5 duration-1000 opacity-60" />
          <Lock className="w-10 h-10 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-foreground">Private Room</h2>
          <p className="text-sm font-bold text-primary uppercase tracking-widest">{roomTitle}</p>
        </div>

        {roomDescription && (
          <p className="text-sm text-muted-foreground leading-relaxed px-2 bg-foreground/5 border border-foreground/5 rounded-2xl py-3 w-full">
            "{roomDescription}"
          </p>
        )}

        <div className="w-full pt-4 border-t border-border/40">
          {requestStatus === 'loading' ? (
            <Button disabled className="w-full h-12 rounded-xl flex items-center justify-center font-bold text-sm bg-primary/80">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking status...
            </Button>
          ) : requestStatus === 'pending' ? (
            <div className="space-y-3 w-full">
              <Button disabled className="w-full h-12 rounded-xl font-bold text-sm bg-muted text-muted-foreground border border-border/30 cursor-not-allowed">
                Request Pending
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancelRequest} className="w-full h-10 rounded-xl text-sm font-semibold text-muted-foreground hover:text-destructive">
                Cancel request
              </Button>
              <p className="text-[12px] text-muted-foreground font-semibold">
                Your request is awaiting admin approval. You will be notified once approved.
              </p>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              {declined && (
                <p className="text-[12px] font-semibold text-destructive">Your last request was not accepted. You can ask again.</p>
              )}
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                placeholder="Add a short note for the admin (optional)"
                aria-label="Message to the room admin (optional)"
                rows={2}
                className="resize-none text-sm"
              />
              <Button
                onClick={handleRequestAccess}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition duration-300"
              >
                Request to Join
              </Button>
              <p className="text-[12px] text-muted-foreground">
                This room requires admin permission to join.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrivateRoomAccessPanel;
