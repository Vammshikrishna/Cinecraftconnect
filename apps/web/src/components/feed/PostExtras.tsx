import { safeHref } from '@/lib/safeUrl';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ExternalLink, Users } from 'lucide-react';
import {
  checkSchedule, collabLine, fetchCollaborators, formatSchedule, isScheduledFuture, removeCollaborator, reschedulePost,
  respondToCollaboration, toLocalInputValue, type LinkPreview, type PostCollabs,
} from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { friendlyError } from '@cinecraft/core';

/** Shown to the author of a post that is waiting for its publish time. */
export const ScheduledBanner = ({ postId, scheduledAt }: { postId: string; scheduledAt: string }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(toLocalInputValue(new Date(scheduledAt)));
  const [busy, setBusy] = useState(false);

  if (!isScheduledFuture(scheduledAt)) return null;

  const refresh = () => { qc.invalidateQueries({ queryKey: ['home-feed-posts'] }); qc.invalidateQueries({ queryKey: ['home-feed-static'] }); };
  const run = async (when: Date | null) => {
    setBusy(true);
    try {
      const r = await reschedulePost(supabase, postId, when);
      toast({ title: r.published ? 'Published' : 'Rescheduled', description: r.published ? 'Your post is live now.' : `It will go live ${formatSchedule(when!)}.` });
      setEditing(false);
      refresh();
    } catch (e: any) {
      toast({ title: 'Could not change the schedule', description: friendlyError(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const when = new Date(value);
    const check = checkSchedule(when);
    if (!check.ok) { toast({ title: 'Check the time', description: check.message, variant: 'destructive' }); return; }
    run(when);
  };

  return (
    <div className="my-3 rounded-2xl border border-primary/30 bg-primary/5 p-3" role="status">
      <div className="flex items-center gap-2 text-sm">
        <CalendarClock className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">Scheduled for <strong>{formatSchedule(scheduledAt)}</strong>. Only you can see it until then.</span>
      </div>
      {editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="w-auto" aria-label="New publish time" />
          <Button size="sm" disabled={busy} onClick={save}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => run(null)}>Publish now</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>Change time</Button>
        </div>
      )}
    </div>
  );
};

/** "with Sam and Ria", plus the accept / decline buttons for a person who was invited. */
export const CollaboratorsLine = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const key = ['post-collabs', postId];
  const { data } = useQuery<PostCollabs | null>({
    queryKey: key,
    queryFn: async () => (await fetchCollaborators(supabase, [postId]))[postId] ?? null,
    staleTime: 30_000,
  });
  if (!data) return null;

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast({ title: ok }); qc.invalidateQueries({ queryKey: key }); }
    catch (e: any) { toast({ title: 'Could not update', description: friendlyError(e), variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const line = collabLine(data.accepted);
  return (
    <div className="my-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      {data.my_status === 'pending' && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm" role="region" aria-label="Collaboration invitation">
          <p>You were invited to be credited on this post.</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => act(() => respondToCollaboration(supabase, postId, true), 'You are credited on this post')}>Accept</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => respondToCollaboration(supabase, postId, false), 'Invitation declined')}>Decline</Button>
          </div>
        </div>
      )}
      {data.accepted.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          {data.accepted.map((p, i) => (
            <span key={p.id}>
              {i === 0 ? 'with ' : i === data.accepted.length - 1 ? ' and ' : ', '}
              <Link to={`/profile/${p.id}`} className="font-medium text-foreground hover:underline">{p.full_name || `@${p.username}`}</Link>
            </span>
          ))}
          {data.my_status === 'accepted' && user && (
            <button type="button" className="ml-2 text-xs underline" disabled={busy} onClick={() => act(() => removeCollaborator(supabase, postId, user.id), 'You were removed from this post')}>Remove me</button>
          )}
          <span className="sr-only">{line}</span>
        </p>
      )}
      {data.is_author && data.pending.length > 0 && (
        <p className="text-xs text-muted-foreground">Waiting for {data.pending.map((p) => p.full_name || `@${p.username}`).join(', ')} to answer.</p>
      )}
    </div>
  );
};

/** The title, description and picture of the first link in a post. */
export const LinkPreviewCard = ({ preview }: { preview: LinkPreview }) => {
  let host = preview.site || '';
  try { host = host || new URL(preview.url).hostname.replace(/^www\./, ''); } catch { /* keep what we have */ }
  // The stored link is written by the post's author: only show the card for a normal web link.
  const href = safeHref(preview.url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => e.stopPropagation()}
      className="my-3 flex overflow-hidden rounded-2xl border border-border/60 bg-card/60 hover:border-primary/40 transition-colors"
    >
      {preview.image && (
        <img src={preview.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-auto w-28 sm:w-36 shrink-0 object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
      )}
      <div className="min-w-0 p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><ExternalLink className="h-3 w-3" aria-hidden="true" />{host}</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug line-clamp-2">{preview.title}</p>
        {preview.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{preview.description}</p>}
      </div>
    </a>
  );
};
