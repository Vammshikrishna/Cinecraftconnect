import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, FolderKanban, Building2, Award, Film, Clapperboard, PenSquare } from 'lucide-react';

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

/** "How you're connected" and a recent-activity strip for someone else's profile. */
export const ProfileContextStrip = ({ userId, showContext }: { userId: string; showContext: boolean }) => {
  const [ctx, setCtx] = useState<any>(null);
  const [act, setAct] = useState<any>(null);

  useEffect(() => {
    const db = supabase as any;
    if (showContext) db.rpc('get_connection_context', { p_user: userId }).then(({ data }: any) => setCtx(data || null));
    db.rpc('get_profile_activity', { p_user: userId }).then(({ data }: any) => setAct(data || null));
  }, [userId, showContext]);

  const mutuals: any[] = ctx?.mutuals || [];
  const projects: any[] = ctx?.shared_projects || [];
  const pages: any[] = ctx?.shared_pages || [];
  const hasContext = mutuals.length > 0 || projects.length > 0 || pages.length > 0;
  const chips: { key: string; icon: any; text: string }[] = [];
  if (act?.active_recently) chips.push({ key: 'active', icon: PenSquare, text: 'Active this week' });
  if (act?.last_credit) chips.push({ key: 'credit', icon: Clapperboard, text: `Credit: ${act.last_credit.role} on ${act.last_credit.project} · ${ago(act.last_credit.at)}` });
  if (act?.last_portfolio) chips.push({ key: 'port', icon: Film, text: `Portfolio: ${act.last_portfolio.title} · ${ago(act.last_portfolio.at)}` });
  if (act?.last_award) chips.push({ key: 'award', icon: Award, text: `${act.last_award.kind === 'press' ? 'Press' : 'Award'}: ${act.last_award.title}` });
  if (act?.last_post_at && !act?.active_recently) chips.push({ key: 'post', icon: PenSquare, text: `Last post ${ago(act.last_post_at)}` });

  if (!hasContext && chips.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border bg-card/40 backdrop-blur-md p-4 space-y-3">
      {hasContext && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">How you're connected</p>
          {mutuals.length > 0 && (
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2">
                {mutuals.map(m => (
                  <Link key={m.id} to={`/profile/${m.id}`} title={m.full_name}>
                    <Avatar className="h-7 w-7 border-2 border-background"><AvatarImage src={m.avatar_url || undefined} /><AvatarFallback className="text-[10px]">{(m.full_name || '?')[0]}</AvatarFallback></Avatar>
                  </Link>
                ))}
              </div>
              <p className="text-sm">
                <Users className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                {ctx.mutual_count} mutual connection{ctx.mutual_count === 1 ? '' : 's'}:{' '}
                <span className="text-muted-foreground">{mutuals.slice(0, 2).map(m => m.full_name).join(', ')}{ctx.mutual_count > 2 ? ` and ${ctx.mutual_count - 2} more` : ''}</span>
              </p>
            </div>
          )}
          {projects.length > 0 && (
            <p className="text-sm"><FolderKanban className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" /> You're both in <span className="text-muted-foreground">{projects.map(p => p.name).join(', ')}</span></p>
          )}
          {pages.length > 0 && (
            <p className="text-sm"><Building2 className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" /> You're both on{' '}
              {pages.map((p, i) => <span key={p.id}>{i > 0 && ', '}<Link to={`/pages/${p.slug}`} className="text-primary hover:underline">{p.name}</Link></span>)}
            </p>
          )}
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(c => (
            <span key={c.key} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${c.key === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}`}>
              <c.icon className="h-3 w-3" /> {c.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
