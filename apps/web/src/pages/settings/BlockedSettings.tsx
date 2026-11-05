import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { SettingsPageHeader, SettingsSection } from '@/components/settings/SettingsUI';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchMutedAuthors, unmuteAuthor, type MutedAuthor,
  fetchMutedWords, addMutedWord, removeMutedWord, fetchHiddenPosts, unhidePost, type HiddenPost,
} from '@cinecraft/core';
import { Input } from '@/components/ui/input';
import { LoadError } from '@/components/settings/LoadError';
import { undoable } from '@/lib/undoable';
import { friendlyError } from '@cinecraft/core';

const initialOf = (name: string) => Array.from(name.trim())[0] || '?';

const ListSkeleton = () => (
  <div role="status" aria-label="Loading" className="space-y-2 mb-8">
    <div className="h-14 rounded-2xl bg-muted/60 animate-pulse" />
    <div className="h-14 rounded-2xl bg-muted/60 animate-pulse" />
  </div>
);

const BlockedSettings = () => {
  const { blocked, loading, unblock } = useBlockedUsers();
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const [muted, setMuted] = useState<MutedAuthor[] | null>(null);
  const [words, setWords] = useState<string[] | null>(null);
  const [newWord, setNewWord] = useState('');
  const [hidden, setHidden] = useState<HiddenPost[] | null>(null);
  const [loadFailed, setLoadFailed] = useState<{ muted: boolean; words: boolean; hidden: boolean }>({ muted: false, words: false, hidden: false });
  const [wordError, setWordError] = useState<string | null>(null);
  const loadAll = () => {
    if (!user) return;
    setLoadFailed({ muted: false, words: false, hidden: false });
    fetchMutedAuthors(supabase, user.id).then(setMuted).catch(() => { setMuted([]); setLoadFailed((f) => ({ ...f, muted: true })); });
    fetchMutedWords(supabase, user.id).then(setWords).catch(() => { setWords([]); setLoadFailed((f) => ({ ...f, words: true })); });
    fetchHiddenPosts(supabase, user.id).then(setHidden).catch(() => { setHidden([]); setLoadFailed((f) => ({ ...f, hidden: true })); });
  };
  useEffect(() => { loadAll(); }, [user?.id]);
  const failedMsg = <LoadError className="mb-8" title="Could not load this list" onRetry={loadAll} />;
  const shownBlocked = blocked.filter((b) => !hiddenIds.includes(b.blocked_user_id));

  return (
    <>
      <SettingsPageHeader title="Blocked accounts" description="They cannot message you, call you, send requests or see your profile details. They are not told." />
      {loading ? (
        <ListSkeleton />
      ) : shownBlocked.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center rounded-2xl border border-dashed mb-8">You haven't blocked anyone. You can block someone from their profile.</p>
      ) : (
        <SettingsSection>
          {shownBlocked.map(b => (
            <div key={b.blocked_user_id} className="flex items-center gap-3 px-4 py-3">
              <Link to={`/profile/${b.blocked_user_id}`} aria-label={`View profile of ${b.profile?.full_name || b.profile?.username || 'Member'}`}>
                <Avatar className="h-10 w-10"><AvatarImage src={b.profile?.avatar_url || undefined} /><AvatarFallback>{initialOf(b.profile?.full_name || b.profile?.username || '?')}</AvatarFallback></Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium truncate">{b.profile?.full_name || b.profile?.username || 'Member'}</p>
                {b.profile?.username && <p className="text-xs text-muted-foreground truncate">@{b.profile.username}</p>}
              </div>
              <Button size="sm" variant="secondary" onClick={() => undoable({
                title: 'Unblocked',
                description: 'Tap Undo to keep them blocked.',
                apply: () => setHiddenIds((ids) => [...ids, b.blocked_user_id]),
                revert: () => setHiddenIds((ids) => ids.filter((id) => id !== b.blocked_user_id)),
                commit: async () => {
                  const { error } = await unblock(b.blocked_user_id);
                  setHiddenIds((ids) => ids.filter((id) => id !== b.blocked_user_id));
                  if (error) toast({ title: 'Could not unblock', variant: 'destructive' });
                },
              })}>Unblock</Button>
            </div>
          ))}
        </SettingsSection>
      )}

      <div className="mt-10">
        <SettingsPageHeader sub title="Muted accounts" description="Their posts do not show in your feed. They can still see you and message you, and they are not told." />
        {muted === null ? (
          <ListSkeleton />
        ) : loadFailed.muted ? failedMsg : muted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center rounded-2xl border border-dashed mb-8">You haven't muted anyone. You can mute someone from their post.</p>
        ) : (
          <SettingsSection>
            {muted.map(m => (
              <div key={m.author_id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/profile/${m.author_id}`} aria-label={`View profile of ${m.profile?.full_name || m.profile?.username || 'Member'}`}>
                  <Avatar className="h-10 w-10"><AvatarImage src={m.profile?.avatar_url || undefined} /><AvatarFallback>{initialOf(m.profile?.full_name || m.profile?.username || '?')}</AvatarFallback></Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium truncate">{m.profile?.full_name || m.profile?.username || 'Member'}</p>
                  {m.profile?.username && <p className="text-xs text-muted-foreground truncate">@{m.profile.username}</p>}
                </div>
                <Button size="sm" variant="secondary" onClick={async () => {
                  try {
                    await unmuteAuthor(supabase, user!.id, m.author_id);
                    setMuted((prev) => (prev || []).filter((x) => x.author_id !== m.author_id));
                    toast({ title: 'Unmuted' });
                  } catch { toast({ title: 'Could not unmute', variant: 'destructive' }); }
                }}>Unmute</Button>
              </div>
            ))}
          </SettingsSection>
        )}
      </div>

      <div className="mt-10">
        <SettingsPageHeader sub title="Muted words" description="Posts that contain these words or hashtags do not show in your feed." />
        <form
          className="flex gap-2 mb-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!user) return;
            if (!newWord.trim()) { setWordError('Type a word, phrase or hashtag to mute.'); return; }
            setWordError(null);
            try {
              const w = await addMutedWord(supabase, user.id, newWord);
              setWords((prev) => [w, ...(prev || []).filter((x) => x !== w)]);
              setNewWord('');
            } catch (err: any) { toast({ title: 'Could not mute', description: friendlyError(err), variant: 'destructive' }); }
          }}
        >
          <Input value={newWord} onChange={(e) => { setNewWord(e.target.value); setWordError(null); }} maxLength={40} placeholder="A word, phrase or #hashtag" aria-label="Word to mute" />
          <Button type="submit" variant="secondary">Mute</Button>
        </form>
        {wordError && <p role="alert" className="text-sm text-destructive -mt-2 mb-4">{wordError}</p>}
        {words === null ? (
          <ListSkeleton />
        ) : loadFailed.words ? failedMsg : words.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center rounded-2xl border border-dashed mb-8">No muted words.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {words.map((w) => (
              <button
                key={w}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 h-10 md:h-9 text-sm"
                aria-label={`Unmute ${w}`}
                onClick={async () => {
                  try { await removeMutedWord(supabase, user!.id, w); setWords((prev) => (prev || []).filter((x) => x !== w)); }
                  catch { toast({ title: 'Could not unmute', variant: 'destructive' }); }
                }}
              >
                {w} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <SettingsPageHeader sub title="Hidden posts" description="Posts you marked as not interested. Bring one back any time." />
        {hidden === null ? (
          <ListSkeleton />
        ) : loadFailed.hidden ? failedMsg : hidden.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center rounded-2xl border border-dashed mb-8">You have not hidden any posts.</p>
        ) : (
          <SettingsSection>
            {hidden.map((h) => (
              <div key={h.post_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium line-clamp-1 break-words">{h.post?.content || 'A post'}</p>
                  <p className="text-xs text-muted-foreground">{h.post?.author?.full_name || h.post?.author?.username || ''}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={async () => {
                  try { await unhidePost(supabase, user!.id, h.post_id); setHidden((prev) => (prev || []).filter((x) => x.post_id !== h.post_id)); toast({ title: 'It can show in your feed again' }); }
                  catch { toast({ title: 'Could not bring it back', variant: 'destructive' }); }
                }}>Show again</Button>
              </div>
            ))}
          </SettingsSection>
        )}
      </div>
    </>
  );
};

export default BlockedSettings;
