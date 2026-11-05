import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Ban, ShieldAlert, LifeBuoy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { friendlyError } from '@cinecraft/core';
import { useAuth } from '@/contexts/AuthContext';

export const SuspendedPage = () => {
  const { signOut, user } = useAuth();
  const [appeal, setAppeal] = useState<{ status: string; decision_note: string | null } | null>(null);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [permanent, setPermanent] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (supabase as any).from('appeals').select('status, decision_note').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => { if (data) setAppeal(data); });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    // Best effort: learn whether the suspension is temporary. Without an answer we use neutral wording.
    (supabase as any).rpc('get_my_account_standing').then(({ data }: any) => {
      const ban = data?.ban;
      if (!ban) return;
      if (typeof ban.reason === 'string' && ban.reason.trim()) setBanReason(ban.reason.trim());
      if (ban.ban_type === 'temporary' && ban.expires_at) setExpiresAt(ban.expires_at);
      else if (ban.ban_type === 'permanent') setPermanent(true);
    }).catch(() => undefined);
  }, [user?.id]);

  const sendAppeal = async () => {
    setSending(true);
    setError(null);
    const { error: err } = await (supabase as any).rpc('submit_appeal', { p_message: message });
    setSending(false);
    if (err) { setError(friendlyError(err, 'Could not send your appeal. Please try again.')); return; }
    setAppeal({ status: 'pending', decision_note: null });
    setWriting(false);
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Cinematic Red Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-red-500/10 blur-[150px] rounded-full opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-12 text-center border-red-500/20 bg-red-500/5 relative z-10"
      >
        <div className="w-24 h-24 bg-red-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-red-500/20 ring-4 ring-red-500/10">
          <Ban className="w-12 h-12 text-red-500" />
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-4 leading-none">
          Access Restricted
        </h1>
        
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-600 rounded-full mb-6">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="text-[12px] font-black uppercase tracking-widest">Account Suspended</span>
        </div>

        <p className="text-muted-foreground text-sm font-medium mb-10 leading-relaxed">
          Your account has been suspended for violating CineCraft Connect community standards or terms of service. {expiresAt ? `Access is paused until ${new Date(expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.` : permanent ? 'Access to platform features has been removed.' : 'Access to platform features is restricted.'} You can appeal this decision below.
        </p>
        {banReason && (
          <p className="text-sm rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 mb-8 text-left" data-testid="suspension-reason"><span className="font-bold">Reason given:</span> {banReason}</p>
        )}

        <div className="space-y-4">
          {appeal?.status === 'pending' ? (
            <p className="text-sm text-muted-foreground rounded-xl border border-red-500/20 px-4 py-3">Your appeal has been sent. We will let you know the decision.</p>
          ) : writing ? (
            <div className="space-y-3 text-left">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Explain why this decision should change (at least 20 characters)."
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setWriting(false)} disabled={sending}>Cancel</Button>
                <Button className="flex-1" onClick={sendAppeal} disabled={sending || message.trim().length < 20}>{sending ? 'Sending…' : 'Send appeal'}</Button>
              </div>
            </div>
          ) : (
            <>
              {appeal && appeal.status !== 'pending' && (
                <p className="text-xs text-muted-foreground">Your last appeal was {appeal.status === 'reversed' ? 'accepted' : 'reviewed and the decision stands'}{appeal.decision_note ? `: ${appeal.decision_note}` : '.'}</p>
              )}
              <Button onClick={() => setWriting(true)} variant="outline" className="w-full h-12 rounded-xl font-bold gap-2 border-red-500/20 hover:bg-red-500/10 hover:text-red-600 transition">
                <LifeBuoy className="w-4 h-4" /> Appeal this decision
              </Button>
            </>
          )}
          
          <Button 
            variant="ghost" 
            onClick={() => signOut()}
            className="w-full h-12 rounded-xl font-black uppercase text-[12px] tracking-widest text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>

        <div className="mt-12 pt-8 border-t border-red-500/10 text-[12px] font-bold uppercase tracking-widest text-muted-foreground/50">
          CineCraft Governance Engine • Ref: CC-ENF-B001
        </div>
      </motion.div>
    </div>
  );
};
