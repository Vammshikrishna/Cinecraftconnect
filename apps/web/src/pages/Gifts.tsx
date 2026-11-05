import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Gift as GiftIcon, Sparkles } from 'lucide-react';
import { ENTITLEMENT_LABEL, friendlyError } from '@cinecraft/core';
import { useGifts, type Gift } from '@/hooks/useGifts';
import { useToast } from '@/hooks/use-toast';
import { undoable } from '@/lib/undoable';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LoadError } from '@/components/settings/LoadError';
import { cn } from '@/lib/utils';

const contents = (g: Gift) => {
  if (g.kind === 'plan') return `${g.label} for ${g.days} days`;
  const name = ENTITLEMENT_LABEL[g.feature_key || ''] || g.feature_key || 'A feature';
  if (g.feature_value === true) return `${name} for ${g.days} days`;
  if (g.feature_value === null) return `Unlimited ${name.toLowerCase()} for ${g.days} days`;
  return `Up to ${String(g.feature_value)} ${name.toLowerCase()} for ${g.days} days`;
};

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

/** Gifts from the team. Closed at first like a gift card; open it, read the message, and accept. */
const Gifts = () => {
  const { toast } = useToast();
  const { gifts, loading, error, refetch, open, accept, accepting, decline } = useGifts();
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  // gifts hidden by "Not now" while the Undo window is open
  const [hiding, setHiding] = useState<string[]>([]);

  const reveal = (g: Gift) => {
    setOpened((o) => ({ ...o, [g.id]: true }));
    if (g.status === 'sent') open(g.id);
  };

  const take = async (g: Gift) => {
    try {
      const r = await accept(g.id);
      toast({
        title: 'Gift accepted',
        description: r.starts_when_live ? 'Everything is free during the beta. Your gift starts counting when plans begin.' : 'It is yours now.',
      });
    } catch (e) {
      toast({ title: 'Could not accept the gift', description: friendlyError(e), variant: 'destructive' });
    }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

  if (error && gifts.length === 0) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-24">
        <h1 className="text-3xl font-bold tracking-tight">Your gifts</h1>
        <LoadError className="mt-8" title="Could not load your gifts" onRetry={refetch} />
      </main>
    );
  }

  const visible = gifts.filter((g) => g.status !== 'declined' && !hiding.includes(g.id));

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-24">
      <h1 className="text-3xl font-bold tracking-tight">Your gifts</h1>
      <p className="text-muted-foreground mt-1">Gifts from the CineCraft team.</p>

      {visible.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-border bg-card py-16 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center mb-4"><GiftIcon className="h-7 w-7 text-muted-foreground" /></div>
          <p className="font-semibold">No gifts yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">When the team sends you something, it will appear here and you will get a notification.</p>
          <Button asChild variant="outline" className="mt-5 rounded-xl"><Link to="/plans">See plans</Link></Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-5">
          {visible.map((g) => {
            const waiting = g.status === 'sent' || g.status === 'opened';
            const isOpen = !waiting || opened[g.id] || g.status === 'opened';
            return (
              <li key={g.id} className={cn('relative overflow-hidden rounded-3xl border', waiting ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card shadow-md shadow-primary/10' : 'border-border bg-card')}>
                <AnimatePresence mode="wait" initial={false}>
                  {!isOpen ? (
                    <motion.div key="closed" exit={{ opacity: 0, scale: 0.97 }} className="p-8 text-center">
                      <div className="mx-auto h-16 w-16 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-sm"><GiftIcon className="h-8 w-8" /></div>
                      <p className="mt-4 text-lg font-semibold">A gift from {g.from_name}</p>
                      <p className="text-sm text-muted-foreground mt-1">Open it to see what is inside.</p>
                      <Button className="mt-5 h-11 rounded-xl px-8 font-semibold" onClick={() => reveal(g)}>Open</Button>
                    </motion.div>
                  ) : (
                    <motion.div key="open" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-6 sm:p-8">
                      <p className="text-xs font-medium text-muted-foreground">From {g.from_name}</p>
                      <p className="mt-1 text-2xl font-bold tracking-tight flex items-start gap-2"><Sparkles className="h-6 w-6 text-primary shrink-0 mt-1" /> {contents(g)}</p>
                      {g.message && <p className="mt-4 rounded-2xl bg-muted/50 border border-border px-4 py-3 text-sm whitespace-pre-wrap break-words">{g.message}</p>}

                      {waiting ? (
                        <div className="mt-6 flex flex-wrap items-center gap-3">
                          <Button className="h-11 rounded-xl px-7 font-semibold" onClick={() => take(g)} disabled={accepting}>Accept gift</Button>
                          <button type="button" onClick={() => undoable({
                            title: 'Gift declined',
                            description: 'You can undo this for a few seconds.',
                            apply: () => setHiding((h) => [...h, g.id]),
                            revert: () => setHiding((h) => h.filter((x) => x !== g.id)),
                            commit: () => decline(g.id),
                          })} className="inline-flex min-h-[44px] items-center px-2 text-sm text-muted-foreground hover:text-foreground">Not now</button>
                          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {daysLeft(g.expires_at)} {daysLeft(g.expires_at) === 1 ? 'day' : 'days'} left to accept</span>
                        </div>
                      ) : g.status === 'accepted' ? (
                        <p className="mt-5 text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                          {g.applied_at ? `Active until ${new Date(new Date(g.applied_at).getTime() + g.days * 86400000).toLocaleDateString()}` : 'Accepted. Everything is free during the beta, so it starts when plans begin.'}
                        </p>
                      ) : (
                        <p className="mt-5 text-sm text-muted-foreground">This gift is no longer available.</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
};

export default Gifts;
