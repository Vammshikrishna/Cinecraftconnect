import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, X, Trash2, Quote } from 'lucide-react';

const REL: Record<string, string> = { worked_with: 'Worked together', managed: 'Managed them', hired: 'Hired them', mentored: 'Mentored them' };

/** Recommendations on a profile. The person sees pending ones and approves or declines them. */
export const RecommendationsSection = ({ userId, isOwner }: { userId: string; isOwner: boolean }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).rpc('list_recommendations', { p_subject: userId });
    setRows(data || []);
    setLoading(false);
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);

  const respond = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).rpc('respond_recommendation', { p_id: id, p_approve: approve });
    if (error) return toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
    load();
  };
  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('profile_recommendations').delete().eq('id', id);
    if (error) return toast({ title: 'Could not remove', description: error.message, variant: 'destructive' });
    load();
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (rows.length === 0) {
    return <p className="text-center text-muted-foreground py-12">{isOwner ? 'No recommendations yet. Connections you worked with can write one from your profile.' : 'No recommendations yet.'}</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map(r => (
        <div key={r.id} className={`rounded-xl border p-4 space-y-3 bg-card/40 ${r.status === 'pending' ? 'border-primary/40' : ''}`}>
          {r.status === 'pending' && (
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{isOwner ? 'Waiting for your approval' : 'Waiting for approval'}</p>
          )}
          <p className="text-sm leading-relaxed"><Quote className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />{r.body}</p>
          <div className="flex items-center justify-between gap-3">
            <Link to={`/profile/${r.author_id}`} className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8"><AvatarImage src={r.author_avatar || undefined} /><AvatarFallback>{(r.author_name || '?')[0]}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.author_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{REL[r.relationship]}{r.project_title ? ` · ${r.project_title}` : ''} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
              </div>
            </Link>
            <div className="flex gap-1 shrink-0">
              {isOwner && r.status === 'pending' && (
                <>
                  <Button size="sm" onClick={() => respond(r.id, true)}><Check className="h-4 w-4 mr-1" />Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => respond(r.id, false)}><X className="h-4 w-4" /></Button>
                </>
              )}
              {(isOwner || r.is_mine) && r.status !== 'pending' && (
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Remove" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
