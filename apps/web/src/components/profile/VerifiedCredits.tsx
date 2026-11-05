import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BadgeCheck, Film, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { friendlyError } from '@cinecraft/core';
import { CreditLine } from '@/components/common/CreditLine';

interface ProjectCredit {
  id: string;
  project_id: string | null;
  project_title: string;
  user_id: string;
  role: string;
  verifier_id: string | null;
  status?: 'pending' | 'accepted' | 'declined';
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
  } | null;
}

const monthYear = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

export const VerifiedCredits = ({ userId, isOwn = false }: { userId: string; isOwn?: boolean }) => {
  const [allCredits, setAllCredits] = useState<ProjectCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCredits = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_credits')
        .select(`
          *,
          profiles:verifier_id (
            full_name,
            username
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllCredits((data as any) || []);
    } catch (error: any) {
      toast({
        title: 'Error loading credits',
        description: friendlyError(error, 'Failed to retrieve verified production credits.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // only confirmed credits are shown on a profile; the person also sees the ones waiting for their answer
  const credits = allCredits.filter(c => (c.status ?? 'accepted') === 'accepted');
  const pending = isOwn ? allCredits.filter(c => c.status === 'pending') : [];

  const respond = async (id: string, accept: boolean) => {
    const { error } = await (supabase as any).rpc('respond_credit', { p_id: id, p_accept: accept });
    if (error) {
      toast({ title: 'Could not update the credit', description: friendlyError(error), variant: 'destructive' });
      return;
    }
    toast({ title: accept ? 'Credit confirmed' : 'Credit declined' });
    fetchCredits();
  };

  const pendingBlock = pending.length > 0 && (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3 mb-6">
      <p className="text-sm font-semibold">Credits waiting for your answer</p>
      {pending.map(p => (
        <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <div className="text-sm">
            <p className="font-semibold">{p.role} · {p.project_title}</p>
            <p className="text-xs text-muted-foreground">Added by {p.profiles?.full_name || (p.profiles?.username ? '@' + p.profiles.username : 'a project creator')}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => respond(p.id, true)}><Check className="h-4 w-4 mr-1" /> Confirm</Button>
            <Button size="sm" variant="outline" onClick={() => respond(p.id, false)}><X className="h-4 w-4 mr-1" /> Decline</Button>
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading verified credits...</div>;
  }

  if (credits.length === 0) {
    return (
      <div>
        {pendingBlock}
        <div className="flex flex-col items-center text-center py-16 max-w-md mx-auto">
          <Film className="w-8 h-8 text-muted-foreground mb-4" aria-hidden="true" />
          <h3 className="font-serif text-xl font-semibold text-foreground mb-2">No verified credits yet</h3>
          <p className="text-sm text-muted-foreground">
            A credit appears here once a project creator adds your role and you confirm it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {pendingBlock}
      <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-border">
        <h2 className="font-serif text-2xl font-semibold text-foreground">Filmography</h2>
        <p className="text-xs text-muted-foreground">Each credit was added by a project creator and confirmed by this person.</p>
      </div>

      <ol className="divide-y divide-border/70">
        {credits.map((credit) => {
          const verifier = credit.profiles?.full_name || (credit.profiles?.username ? `@${credit.profiles.username}` : null);
          const when = monthYear(credit.created_at);
          return (
            <li key={credit.id} className="flex items-start gap-3">
              <CreditLine
                className="flex-1 min-w-0"
                serifLead
                lead={
                  credit.project_id ? (
                    <Link to={`/projects/${credit.project_id}`} className="hover:text-primary transition-colors">
                      {credit.project_title}
                    </Link>
                  ) : (
                    credit.project_title
                  )
                }
                trail={credit.role}
                note={
                  verifier ? (
                    <>
                      Confirmed by{' '}
                      <Link to={`/profile/${credit.verifier_id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                        {verifier}
                      </Link>
                      {when && <> in {when}</>}
                    </>
                  ) : (
                    when ? `Added in ${when}` : undefined
                  )
                }
              />
              <BadgeCheck className="h-4 w-4 text-amber-500 shrink-0 mt-[1.15rem]" aria-label="Verified credit" />
            </li>
          );
        })}
      </ol>
    </div>
  );
};
