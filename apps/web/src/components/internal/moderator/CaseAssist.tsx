import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Lightbulb, Zap } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';

export interface Bundle { id: string; name: string; action: string; note: string; also_warn: boolean; position: number }

const ACTION_WORDS: Record<string, string> = {
  dismiss: 'dismissed', warn: 'warned', takedown: 'taken down', shadowban: 'shadowbanned', ban: 'banned',
};

/** The bundles staff can apply with one click (admins edit them in the Moderation tab). */
export const useBundles = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  useEffect(() => {
    (supabase as any).from('mod_bundles').select('id, name, action, note, also_warn, position').order('position')
      .then(({ data }: any) => setBundles(data || []));
  }, []);
  return bundles;
};

/** Runs a bundle on a report and says what happened. Returns true if it worked. */
export const applyBundle = async (
  reportId: string,
  bundle: Bundle,
  toast: (o: { title: string; description?: string; variant?: 'destructive' }) => void,
): Promise<boolean> => {
  const { data, error } = await (supabase as any).rpc('moderator_apply_bundle', { p_report: reportId, p_bundle: bundle.id });
  if (error) {
    toast({ title: 'Could not apply that', description: friendlyError(error), variant: 'destructive' });
    return false;
  }
  toast({
    title: data?.queued ? 'Sent for second approval' : `Done: ${ACTION_WORDS[bundle.action] || bundle.action}`,
    description: data?.also_warned ? 'The author was also warned.' : undefined,
  });
  return true;
};

/** "Similar reports were mostly taken down", from how past reports of the same kind were decided. */
export const SuggestionBanner = ({ reportId }: { reportId: string }) => {
  const [p, setP] = useState<{ total: number; counts: Record<string, number>; suggested: string | null; suggested_count: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (supabase as any).rpc('get_report_precedents', { p_report: reportId }).then(({ data }: any) => { if (alive) setP(data); });
    return () => { alive = false; };
  }, [reportId]);

  if (!p || p.total < 3) return null;
  const parts = Object.entries(p.counts).filter(([k]) => k !== 'other').sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${ACTION_WORDS[k] || k}`);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
      <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
      <div className="text-xs leading-relaxed">
        {p.suggested ? (
          <p><span className="font-bold">Suggested: {ACTION_WORDS[p.suggested] || p.suggested}.</span> {p.suggested_count} of the last {p.total} similar reports were handled that way.</p>
        ) : (
          <p className="font-bold">No clear pattern in the last {p.total} similar reports.</p>
        )}
        <p className="text-muted-foreground">{parts.join(' · ')}. A guide only. The decision is yours.</p>
      </div>
    </div>
  );
};

/** One-click actions: the action, the wording and, where it says so, a warning to the author. */
export const BundleButtons = ({ reportId, onDone }: { reportId: string; onDone: () => void }) => {
  const { toast } = useToast();
  const bundles = useBundles();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(async (b: Bundle) => {
    setBusy(b.id);
    const ok = await applyBundle(reportId, b, toast);
    setBusy(null);
    if (ok) onDone();
  }, [reportId, toast, onDone]);

  if (bundles.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-[12px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Zap className="w-3 h-3" /> Quick actions</h3>
      <div className="flex flex-wrap gap-2">
        {bundles.map((b) => (
          <Button key={b.id} size="sm" variant="outline" disabled={!!busy} onClick={() => run(b)} className="h-8 text-xs font-bold rounded-lg">
            {busy === b.id ? 'Working…' : b.name}
          </Button>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">Each one carries its own wording and warning. Taking content down or banning still needs a second person.</p>
    </div>
  );
};

/** A compact look at what was reported: its text and pictures (the live item, or the copy saved when it was reported). */
export const EvidenceView = ({ evidence }: { evidence: any }) => {
  if (!evidence) {
    return <p className="text-xs text-muted-foreground italic">No copy of the content was saved with this report.</p>;
  }
  const text = evidence.content || evidence.description || evidence.bio || '';
  const media: string[] = [
    ...((evidence.media_items as any[]) || []).map((m) => m?.url).filter(Boolean),
    ...(((evidence.media_items as any[])?.length ? [] : evidence.media_urls) || []),
    ...(evidence.images || []),
  ];
  return (
    <div className="space-y-3">
      {evidence.title && <p className="font-bold text-sm">{evidence.title}</p>}
      {text && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{text}</p>}
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden bg-black">
          {media.slice(0, 4).map((u, i) => (
            <img key={i} src={u} alt="" loading="lazy" decoding="async" className="w-full h-40 object-cover" />
          ))}
        </div>
      )}
      {!text && media.length === 0 && !evidence.title && <p className="text-xs text-muted-foreground italic">No text or pictures.</p>}
    </div>
  );
};
