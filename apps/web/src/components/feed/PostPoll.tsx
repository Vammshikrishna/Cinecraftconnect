import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { fetchPolls, voteInPoll, removePollVote, pollPercentages, pollStatusText, type PollView, friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * The poll on a post. Options are buttons until you vote; then every option shows its share of the votes.
 * You can change your vote until the poll closes. The author sees results at any time.
 */
export const PostPoll = ({ postId }: { postId: string }) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const key = ['post-poll', postId];

  const { data: poll, isLoading } = useQuery<PollView | null>({
    queryKey: key,
    queryFn: async () => (await fetchPolls(supabase, [postId]))[postId] ?? null,
    staleTime: 30_000,
  });

  if (isLoading) return <div className="my-3 h-28 rounded-2xl bg-muted animate-pulse motion-reduce:animate-none" aria-hidden="true" />;
  if (!poll) return null;

  const showResults = poll.options.every((o) => o.votes !== null);
  const percents = pollPercentages(poll);

  const act = async (fn: () => Promise<PollView>) => {
    if (busy) return;
    setBusy(true);
    try {
      qc.setQueryData(key, await fn());
    } catch (e: any) {
      toast({ title: 'Could not update your vote', description: friendlyError(e), variant: 'destructive' });
      qc.invalidateQueries({ queryKey: key });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-3 rounded-2xl border border-border/60 bg-card/60 p-3" onClick={(e) => e.stopPropagation()}>
      {poll.question && <p className="font-semibold text-base mb-2 leading-snug">{poll.question}</p>}
      <div role="radiogroup" aria-label={poll.question || 'Poll'} className="space-y-2">
        {poll.options.map((o, i) => {
          const mine = poll.my_option === o.id;
          const pct = percents[i];
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={mine}
              disabled={poll.closed || busy}
              onClick={() => (mine ? act(() => removePollVote(supabase, poll.post_id)) : act(() => voteInPoll(supabase, o.id)))}
              className={cn(
                'relative w-full min-h-[44px] overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors',
                mine ? 'border-primary' : 'border-border/60 hover:border-primary/50',
                (poll.closed || busy) && 'cursor-default',
              )}
            >
              {showResults && pct !== null && (
                <span
                  className={cn('absolute inset-y-0 left-0 transition-[width] duration-500 motion-reduce:transition-none', mine ? 'bg-primary/25' : 'bg-muted')}
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              )}
              <span className="relative flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  {mine && <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />}
                  <span className={cn('truncate', mine && 'font-semibold')}>{o.label}</span>
                </span>
                {showResults && pct !== null && <span className="shrink-0 font-semibold tabular-nums">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        {pollStatusText(poll)}
        {!poll.closed && poll.my_option && ' · Tap your choice again to remove your vote'}
        {!showResults && ' · Vote to see the results'}
      </p>
    </div>
  );
};
