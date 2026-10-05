import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, LogOut, MailPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

/** Shown to the person invited to a page's team (accept / decline), and to members who may want to leave. */
export const PageInviteBanner = ({ page, userId, isMember }: { page: { id: string; name: string; owner_id: string }; userId?: string; isMember: boolean }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: invite } = useQuery({
    queryKey: ['my-page-invite', page.id, userId],
    enabled: !!userId && !isMember && page.owner_id !== userId,
    queryFn: async () => {
      const { data } = await db
        .from('company_page_invites')
        .select('id, title, department')
        .eq('page_id', page.id)
        .eq('invitee_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
      return data as { id: string; title: string | null; department: string | null } | null;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-page-invite', page.id] });
    queryClient.invalidateQueries({ queryKey: ['page-members', page.id] });
    queryClient.invalidateQueries({ queryKey: ['page-admin', page.id] });
  };

  const answer = async (accept: boolean) => {
    if (!invite) return;
    setBusy(true);
    const { data, error } = await db.rpc('respond_page_invite', { p_invite_id: invite.id, p_accept: accept });
    setBusy(false);
    if (error || data?.success === false) return toast({ title: 'Could not answer', description: error?.message || data?.message, variant: 'destructive' });
    toast({ title: accept ? `You joined ${page.name}` : 'Invitation declined' });
    refresh();
  };

  const leave = async () => {
    if (!window.confirm(`Leave the ${page.name} team?`)) return;
    setBusy(true);
    const { data, error } = await db.rpc('leave_page_team', { p_page_id: page.id });
    setBusy(false);
    if (error || data?.success === false) return toast({ title: 'Could not leave', description: error?.message || data?.message, variant: 'destructive' });
    toast({ title: 'You left the team' });
    refresh();
  };

  if (invite) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0"><MailPlus size={18} /></div>
          <div>
            <p className="font-black text-sm">{page.name} invited you to join their team</p>
            <p className="text-xs text-muted-foreground">{[invite.title, invite.department].filter(Boolean).join(' · ') || 'Team member'} · they will be listed on the page once you accept.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="rounded-full" disabled={busy} onClick={() => answer(true)}><Check className="w-4 h-4 mr-1" /> Accept</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => answer(false)}><X className="w-4 h-4 mr-1" /> Decline</Button>
        </div>
      </div>
    );
  }

  if (isMember && userId && page.owner_id !== userId) {
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground hover:text-red-500" disabled={busy} onClick={leave}>
          <LogOut className="w-4 h-4 mr-1" /> Leave team
        </Button>
      </div>
    );
  }
  return null;
}
