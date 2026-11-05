/** Shows the numbers of a transparency report. Counts of 1 to 4 arrive as "<5" and are shown as they are. */
export type Count = number | string | null | undefined;

export interface TransparencyNumbers {
  reports?: {
    received?: Count; closed?: Count; upheld?: Count; dismissed?: Count; still_open?: Count;
    child_safety?: Count; child_safety_passed_on?: Count; child_safety_messages?: Count; child_safety_messages_passed_on?: Count; hidden_while_reviewed?: Count; flagged_by_rules?: Count;
    by_reason?: Record<string, Count>; by_type?: Record<string, Count>;
  };
  actions?: { content_removed?: Count; warnings?: Count; reach_limited?: Count; accounts_suspended?: Count; strikes_issued?: Count };
  response?: { median_hours?: number | null; p90_hours?: number | null; within_target_pct?: number | null };
  appeals?: { filed?: Count; reversed?: Count; upheld?: Count; pending?: Count; of_removals_or_warnings?: Count; of_suspensions?: Count };
  marketplace_disputes?: {
    opened?: Count; resolved?: Count; withdrawn?: Count; still_open?: Count;
    in_favour_of_the_person_who_opened_it?: Count; in_favour_of_the_other_side?: Count; split_or_no_fault?: Count;
  } | null;
}

export const REASON_LABEL: Record<string, string> = {
  spam: 'Spam', harassment: 'Harassment', hate_speech: 'Hate speech', misinformation: 'Misinformation', explicit_content: 'Explicit content',
  impersonation: 'Impersonation', fraud: 'Fraud or scams', other: 'Other', child_safety: 'Child safety',
};
export const TYPE_LABEL: Record<string, string> = {
  post: 'Posts', comment: 'Comments', user: 'Accounts', job: 'Jobs', listing: 'Marketplace listings', room: 'Discussion rooms', message: 'Messages',
  announcement: 'Announcements', review: 'Reviews', cinema: 'Cinema', pitch_call: 'Pitch calls', pitch_submission: 'Pitch submissions',
};

const num = (c: Count) => (c === null || c === undefined ? 'n/a' : typeof c === 'number' ? c.toLocaleString() : c);
const hours = (h: number | null | undefined) => (h === null || h === undefined ? 'n/a' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h} h` : `${Math.round(h / 24)} days`);

const Block = ({ title, rows }: { title: string; rows: Array<[string, string]> }) => (
  <section className="rounded-2xl border border-border bg-card">
    <h3 className="px-5 pt-4 pb-2 text-sm font-semibold">{title}</h3>
    <dl className="divide-y divide-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-semibold tabular-nums text-right">{v}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export const TransparencyData = ({ data }: { data: TransparencyNumbers }) => {
  const r = data.reports || {};
  const a = data.actions || {};
  const p = data.response || {};
  const ap = data.appeals || {};
  const d = data.marketplace_disputes;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Block title="Reports" rows={[
        ['Reports received', num(r.received)], ['Reports closed', num(r.closed)], ['Led to action', num(r.upheld)], ['Found not to break the rules', num(r.dismissed)],
        ['Hidden while being reviewed', num(r.hidden_while_reviewed)], ['Found by automatic rules', num(r.flagged_by_rules)],
      ]} />
      <Block title="What we did" rows={[
        ['Content removed', num(a.content_removed)], ['Warnings', num(a.warnings)], ['Reach limited', num(a.reach_limited)],
        ['Accounts suspended', num(a.accounts_suspended)], ['Strikes issued', num(a.strikes_issued)],
      ]} />
      <Block title="How fast" rows={[
        ['Typical time to decide', hours(p.median_hours)], ['9 in 10 decided within', hours(p.p90_hours)],
        ['Decided within our target', p.within_target_pct === null || p.within_target_pct === undefined ? 'n/a' : `${p.within_target_pct}%`],
      ]} />
      <Block title="Appeals" rows={[
        ['Appeals received', num(ap.filed)], ['Decision reversed', num(ap.reversed)], ['Decision kept', num(ap.upheld)], ['Waiting', num(ap.pending)],
        ['About removals or warnings', num(ap.of_removals_or_warnings)], ['About suspensions', num(ap.of_suspensions)],
      ]} />
      <Block title="Child safety" rows={[['Reports received', num(r.child_safety)], ['Reports about chat messages', num(r.child_safety_messages)], ['Passed to the authorities', num(r.child_safety_passed_on)], ['Chat reports passed to the authorities', num(r.child_safety_messages_passed_on)]]} />
      {d && (
        <Block title="Marketplace disputes" rows={[
          ['Opened', num(d.opened)], ['Resolved', num(d.resolved)], ['Withdrawn', num(d.withdrawn)],
          ['Decided for the person who opened it', num(d.in_favour_of_the_person_who_opened_it)], ['Decided for the other side', num(d.in_favour_of_the_other_side)],
          ['Split or no fault', num(d.split_or_no_fault)],
        ]} />
      )}
      {r.by_reason && Object.keys(r.by_reason).length > 0 && (
        <Block title="Reports by reason" rows={Object.entries(r.by_reason).map(([k, v]) => [REASON_LABEL[k] || k, num(v)] as [string, string])} />
      )}
      {r.by_type && Object.keys(r.by_type).length > 0 && (
        <Block title="Reports by what was reported" rows={Object.entries(r.by_type).map(([k, v]) => [TYPE_LABEL[k] || k, num(v)] as [string, string])} />
      )}
    </div>
  );
};

export default TransparencyData;
