import { useEffect, useState } from 'react';
import { AlertTriangle, Lock, ShieldAlert, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isRepeatOffender, missingFunction, repeatSummary, type ClaimInfo, type RepeatFacts } from './caseTools';

/** Who holds the case and when it frees up. Shown only when somebody holds it. */
export const ClaimLockBanner = ({ info, owner }: { info: ClaimInfo; owner?: string | null }) => {
  if (!info.held) return null;
  if (info.mine) {
    return <p className="text-[12px] font-bold text-primary flex items-center gap-1.5"><Lock className="w-3 h-3" aria-hidden="true" /> You hold this case. It frees up after {info.freesInMinutes} more minutes without activity.</p>;
  }
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-xs ${info.idle ? 'border-border/50 bg-muted/40' : 'border-violet-500/30 bg-violet-500/5'}`}>
      <p className="font-bold flex items-center gap-2"><Lock className="w-3.5 h-3.5" aria-hidden="true" />
        {info.idle ? `@${owner || 'Another moderator'} has been quiet for ${info.idleMinutes} minutes` : `Held by @${owner || 'another moderator'}`}
      </p>
      <p className="text-muted-foreground mt-1">
        {info.idle ? 'Anyone can take this case now.' : `Only they can act on it. It frees up after ${info.freesInMinutes} more minutes without activity, or an admin can step in.`}
      </p>
    </div>
  );
};

/** Why and to whom the case was escalated (part GA keeps both on the case). */
export const EscalationBanner = ({ data }: { data: any }) => {
  if (!data?.escalated_to && !data?.escalation_reason) return null;
  return (
    <div role="status" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs space-y-1">
      <p className="font-bold text-red-500 flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" /> Escalated to {String(data.escalated_to || 'admin').replace('_', ' ')}{data.escalated_at ? ` on ${new Date(data.escalated_at).toLocaleString()}` : ''}</p>
      {data.escalation_reason && <p className="text-foreground/90">{data.escalation_reason}</p>}
    </div>
  );
};

/** Strikes in the last 90 days and earlier bans for the person the case is about (part GA get_repeat_offender). */
export const useRepeatFacts = (userId?: string | null) => {
  const [facts, setFacts] = useState<RepeatFacts | null>(null);
  useEffect(() => {
    setFacts(null);
    if (!userId) return;
    let live = true;
    (supabase as any).rpc('get_repeat_offender', { p_user: userId }).then(({ data, error }: any) => {
      if (live && !error && data && !missingFunction(error)) setFacts(data as RepeatFacts);
    });
    return () => { live = false; };
  }, [userId]);
  return facts;
};

export const RepeatOffenderBanner = ({ facts }: { facts: RepeatFacts | null }) => {
  const line = repeatSummary(facts);
  if (!line) return null;
  const repeat = isRepeatOffender(facts);
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-xs flex items-start gap-2 ${repeat ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 ${repeat ? 'text-red-500' : 'text-amber-500'}`} aria-hidden="true" />
      <div>
        <p className="font-bold">{repeat ? 'Repeat offender' : 'Earlier record'}</p>
        <p className="text-muted-foreground">{line}</p>
      </div>
    </div>
  );
};

/** Everyone who reported this same thing, merged into the one case. */
export const ReportersList = ({ targetType, targetId }: { targetType: string; targetId: string }) => {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    (supabase as any).from('content_reports')
      .select('id, reporter:reported_by(username)')
      .eq('target_type', targetType).eq('target_id', targetId)
      .then(({ data }: any) => {
        if (!live || !data) return;
        setNames(data.map((r: any) => r.reporter?.username ? `@${r.reporter.username}` : 'found automatically'));
      });
    return () => { live = false; };
  }, [targetType, targetId]);
  if (names.length < 2) return null;
  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs">
      <p className="font-bold flex items-center gap-2"><Users className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" /> {names.length} reports about this {targetType}</p>
      <p className="text-muted-foreground mt-1">{names.join(', ')}</p>
      <p className="text-muted-foreground mt-1">Shown as one case in the queue.</p>
    </div>
  );
};

interface TimelineEvent { at: string; kind: string; actor: string | null; detail: string }

const KIND_WORDS: Record<string, string> = {
  reported: 'Reported', report_claim: 'Claimed', report_idle_release: 'Freed after being idle', report_escalate: 'Escalated', note: 'Note',
  report_dismiss: 'Dismissed', report_warn: 'Warned', report_resolve: 'Resolved', approval_pending: 'Sent for second approval',
  report_duplicate: 'Closed as a duplicate', report_duplicate_received: 'Duplicate linked to this case',
  approval_approved: 'Second approval given', approval_rejected: 'Second approval refused',
};
const kindWord = (k: string) => KIND_WORDS[k] || k.replace(/^report_/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** One list of everything that happened to the case (part GA get_case_timeline). */
export const CaseTimeline = ({ caseId, refreshKey }: { caseId: string; refreshKey: number }) => {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true;
    (supabase as any).rpc('get_case_timeline', { p_report_id: caseId }).then(({ data, error }: any) => {
      if (!live) return;
      if (error) { setMissing(missingFunction(error)); setEvents(null); return; }
      setMissing(false);
      setEvents(((data as TimelineEvent[]) || []).slice().reverse());
    });
    return () => { live = false; };
  }, [caseId, refreshKey]);

  if (missing) {
    return <p className="text-[12px] text-muted-foreground rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2" role="status">The full timeline needs the moderation update (<span className="font-mono">part_ga_mod_tools.sql</span>). Notes are shown below.</p>;
  }
  if (!events) return null;
  return (
    <ol className="space-y-2" aria-label="Case timeline">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex gap-3 text-[12px]">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
          <div className="min-w-0">
            <p><span className="font-bold">{kindWord(e.kind)}</span>{e.actor ? <span className="text-muted-foreground"> by @{e.actor}</span> : null}</p>
            {e.detail && <p className="text-foreground/80 break-words">{e.detail}</p>}
            <p className="text-muted-foreground">{new Date(e.at).toLocaleString()}</p>
          </div>
        </li>
      ))}
    </ol>
  );
};

let replyCache: Array<{ title: string; body: string }> | null = null;

/** Ready-made wording for notes (admins edit these in the Moderation tab: mod_templates, kind "reply"). */
export const ReplyPicker = ({ onPick }: { onPick: (body: string) => void }) => {
  const [items, setItems] = useState<Array<{ title: string; body: string }>>(replyCache || []);
  useEffect(() => {
    (supabase as any).from('mod_templates').select('title, body').eq('kind', 'reply').order('title')
      .then(({ data }: any) => { if (data) { replyCache = data; setItems(data); } });
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Saved replies</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <button key={t.title} type="button" onClick={() => onPick(t.body)}
            className="text-[12px] font-bold px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
            {t.title}
          </button>
        ))}
      </div>
    </div>
  );
};
