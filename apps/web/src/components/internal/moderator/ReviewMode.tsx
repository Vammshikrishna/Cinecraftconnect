import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkipForward } from 'lucide-react';
import { applyBundle, EvidenceView, SuggestionBanner, useBundles, type Bundle } from './CaseAssist';

interface Props {
  open: boolean;
  cases: any[];
  onClose: () => void;
  /** called after each decision so the queue behind refreshes */
  onChanged: () => void;
}

/**
 * One case at a time, with the quick actions on the number keys. After a decision the next case appears.
 * Keys: 1 to 9 apply the quick action with that number, N or the right arrow skips, Esc leaves.
 */
const ReviewMode = ({ open, cases, onClose, onChanged }: Props) => {
  const { toast } = useToast();
  const bundles = useBundles();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setSkipped(new Set()); setDone(0); }
  }, [open]);

  const remaining = useMemo(() => cases.filter((c) => !skipped.has(c.id)), [cases, skipped]);
  const current = remaining[0] || null;

  const apply = useCallback(async (b: Bundle) => {
    if (!current || busy) return;
    setBusy(true);
    const ok = await applyBundle(current.id, b, toast);
    setBusy(false);
    if (ok) {
      setDone((n) => n + 1);
      // the case stays in the list until the queue refreshes: skip it here so the next one shows now
      setSkipped((prev) => new Set(prev).add(current.id));
      onChanged();
    }
  }, [current, busy, toast, onChanged]);

  const skip = useCallback(() => {
    if (current) setSkipped((prev) => new Set(prev).add(current.id));
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') { e.preventDefault(); skip(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && bundles[n - 1]) { e.preventDefault(); apply(bundles[n - 1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, bundles, apply, skip]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review mode</DialogTitle>
          <DialogDescription>
            {done} done · {remaining.length} left. Press 1 to 9 for a quick action, N to skip, Esc to leave.
          </DialogDescription>
        </DialogHeader>

        {!current ? (
          <div className="py-16 text-center space-y-2">
            <p className="font-bold">{cases.length === 0 ? 'The queue is clear' : 'That was the last one'}</p>
            <p className="text-sm text-muted-foreground">{done > 0 ? `You handled ${done} case${done === 1 ? '' : 's'}.` : 'Nothing to review right now.'}</p>
            <Button onClick={onClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="uppercase font-black text-[12px]">{current.target_type}</Badge>
              <Badge variant="outline" className="uppercase font-black text-[12px]">{current.priority}</Badge>
              {(current.group_count || 1) > 1 && <Badge variant="destructive" className="text-[12px]">{current.group_count} reports</Badge>}
              <span className="text-sm font-bold uppercase">{String(current.reason).replace(/_/g, ' ')}</span>
              {current.reporter?.username && <span className="text-xs text-muted-foreground">reported by @{current.reporter.username}</span>}
            </div>
            {current.details && <p className="text-sm italic text-muted-foreground">"{current.details}"</p>}

            <SuggestionBanner reportId={current.id} />

            <div className="rounded-xl border border-border/50 bg-card/40 p-4">
              <EvidenceView evidence={current.evidence} />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {bundles.map((b, i) => (
                  <Button key={b.id} size="sm" variant="outline" disabled={busy} onClick={() => apply(b)} className="h-9 text-xs font-bold">
                    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-muted text-[12px]">{i + 1}</span>
                    {b.name}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={skip} disabled={busy} className="h-9 text-xs font-bold">
                  <SkipForward className="w-3.5 h-3.5 mr-1.5" /> Skip (N)
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">Taking content down and banning still need a second person to approve.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReviewMode;
