/**
 * Pitch and Story Exchange helpers shared by web and mobile. The database does the real checking
 * (supabase/manual/part_av_pitch_security.sql); these keep both apps identical. See docs/PITCH.md.
 */

/** Everything a listing card needs. synopsis_full is deliberately not here: it is only readable through the RPC below. */
export const STORY_LISTING_COLUMNS =
  'id, created_at, updated_at, creator_id, title, logline, synopsis_teaser, genre, format, language, tone, stage, asking_deal, nda_required, is_published';

/** The guild / registration number is typed by the producer and not checked, so the apps call it "claimed". */
export const GUILD_CLAIM_LABEL = 'Guild member (claimed)';
export const GUILD_CLAIM_HINT = 'Entered by the producer. CineCraft has not verified it.';

export function hasGuildClaim(attachments: unknown): boolean {
  if (!attachments || typeof attachments !== 'object' || Array.isArray(attachments)) return false;
  const v = (attachments as Record<string, unknown>).producers_guild_member_id;
  return typeof v === 'string' && v.trim().length > 0;
}

/** Genre and language are text[] on pitch calls and plain text elsewhere. */
export function listText(v: string | string[] | null | undefined, sep = ', '): string {
  if (Array.isArray(v)) return v.filter(Boolean).join(sep);
  return typeof v === 'string' ? v : '';
}

export function isDirectPitchCall(attachments: unknown): boolean {
  return !!attachments && typeof attachments === 'object' && !Array.isArray(attachments)
    && (attachments as Record<string, unknown>).is_direct_catcher === true;
}

export function pitchCallIsClosed(call: { status?: string | null; deadline?: string | null }, now: Date = new Date()): boolean {
  if (call.status && call.status !== 'open') return true;
  if (!call.deadline) return false;
  const end = new Date(`${String(call.deadline).slice(0, 10)}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() < now.getTime();
}

/** The full synopsis of a story: the writer, or a producer the writer approved (after the NDA when one is needed). */
export async function fetchStoryFullSynopsis(client: any, storyId: string): Promise<string | null> {
  const { data, error } = await client.rpc('get_story_full_synopsis', { p_story: storyId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Creates the private brief for a direct pitch and returns its id. */
export async function createDirectPitchCall(client: any, producerId: string, title: string, producerName?: string | null): Promise<string> {
  const { data, error } = await client.rpc('submit_direct_pitch_call', {
    p_producer_id: producerId, p_title: title, p_producer_name: producerName ?? null,
  });
  if (error) throw error;
  return data as string;
}

let lastClose = 0;
/** Closes calls whose deadline has passed. Throttled to once every 10 minutes per session. */
export async function closeExpiredPitchCalls(client: any): Promise<void> {
  const now = Date.now();
  if (now - lastClose < 10 * 60 * 1000) return;
  lastClose = now;
  try { await client.rpc('close_expired_pitch_calls'); } catch { /* the lists still hide closed calls by their deadline */ }
}

/** Counts a view of a call (the database ignores the owner and repeat views within 12 hours). */
export async function logPitchCallView(client: any, callId: string): Promise<void> {
  try { await client.rpc('log_pitch_call_view', { p_call: callId }); } catch { /* analytics only */ }
}

// ── features added in part AW (supabase/manual/part_aw_pitch_features.sql) ────────────────────────────────────────

/** Statuses a writer can still withdraw from. */
export function canWithdrawPitch(status?: string | null): boolean {
  return !['withdrawn', 'passed', 'closed', 'collaborating'].includes(status || 'submitted');
}
/** A writer can change the pitch text until the call owner has started to review it. */
export function canEditPitch(status?: string | null): boolean {
  return ['submitted', 'seen'].includes(status || 'submitted');
}

export async function withdrawPitchSubmission(client: any, submissionId: string): Promise<void> {
  const { error } = await client.rpc('withdraw_pitch_submission', { p_id: submissionId });
  if (error) throw error;
}

export interface PitchStats { views: number; saves: number; submissions: number; by_status: Record<string, number> }
/** Numbers for the owner of a call; null for everyone else. */
export async function fetchPitchStats(client: any, callId: string): Promise<PitchStats | null> {
  const { data, error } = await client.rpc('pitch_call_stats', { p_call: callId });
  if (error) throw error;
  return (data as PitchStats | null) ?? null;
}

export async function closePitchCall(client: any, callId: string): Promise<void> {
  const { error } = await client.from('pitch_calls').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', callId);
  if (error) throw error;
}

/** Re-opens a call. A deadline that already passed moves a week ahead, otherwise the call would close again at once. */
export async function reopenPitchCall(client: any, call: { id: string; deadline?: string | null }): Promise<string | null> {
  const patch: Record<string, unknown> = { status: 'open', updated_at: new Date().toISOString() };
  let deadline = call.deadline ?? null;
  if (deadline && pitchCallIsClosed({ status: 'open', deadline })) {
    const d = new Date(); d.setDate(d.getDate() + 7);
    deadline = d.toISOString().slice(0, 10);
    patch.deadline = deadline;
  }
  const { error } = await client.from('pitch_calls').update(patch).eq('id', call.id);
  if (error) throw error;
  return deadline;
}

const COPY_FIELDS = ['title', 'project_type', 'genre', 'subgenre', 'language', 'format', 'target_audience', 'budget_range', 'compensation',
  'requirement_description', 'tone', 'ref_films', 'is_open_to_debut', 'is_regional_welcome', 'rights_expectation', 'nda_required'] as const;

/** A fresh open copy of a call (no deadline, no views, no submissions). Returns the new id. */
export async function duplicatePitchCall(client: any, call: Record<string, any>, ownerId: string): Promise<string> {
  const row: Record<string, any> = { creator_id: ownerId, status: 'open', is_published: true, deadline: null };
  for (const k of COPY_FIELDS) if (call[k] !== undefined) row[k] = call[k];
  row.title = `${String(call.title || 'Pitch call').slice(0, 180)} (copy)`;
  const att = call.attachments && typeof call.attachments === 'object' && !Array.isArray(call.attachments) ? { ...call.attachments } : null;
  if (att) {
    delete att.is_direct_catcher; delete att.target_producer_id; delete att.target_producer_name; delete att.sender_id;
    row.attachments = att;
  }
  const { data, error } = await client.from('pitch_calls').insert(row).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export interface ReviewNote { note: string; rating: number | null }
export async function fetchReviewNote(client: any, submissionId: string): Promise<ReviewNote> {
  const { data, error } = await client.from('pitch_submission_notes').select('note, rating').eq('submission_id', submissionId).maybeSingle();
  if (error) throw error;
  return { note: data?.note ?? '', rating: data?.rating ?? null };
}
export async function saveReviewNote(client: any, submissionId: string, ownerId: string, v: ReviewNote): Promise<void> {
  const { error } = await client.from('pitch_submission_notes').upsert({
    submission_id: submissionId, owner_id: ownerId, note: v.note.slice(0, 2000), rating: v.rating, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export const FEEDBACK_MAX = 1000;
/** A short message the writer sees (and is notified about). */
export async function saveFeedback(client: any, submissionId: string, text: string): Promise<void> {
  const { error } = await client.from('pitch_submissions').update({ feedback: text.trim().slice(0, FEEDBACK_MAX) || null }).eq('id', submissionId);
  if (error) throw error;
}

function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formulas never run
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** The call owner's submissions as a CSV (a spreadsheet). */
export function submissionsToCsv(rows: any[]): string {
  const head = ['Title', 'Writer', 'For call', 'Logline', 'Genre', 'Language', 'Format', 'Status', 'Submitted'];
  const lines = rows.map((s) => [
    s.title, s.profiles?.full_name || s.profiles?.username || '', s.pitch_calls?.title || '', s.logline,
    listText(s.genre), listText(s.language), s.format, s.status, s.submitted_at,
  ].map(csvCell).join(','));
  return [head.join(','), ...lines].join('\r\n');
}

/** Where an unfinished pitch form is kept on this device. */
export function pitchDraftKey(userId: string | null | undefined, callId: string): string {
  return `pitch_draft:${userId || 'anon'}:${callId}`;
}

// ── part AX (supabase/manual/part_ax_pitch_extras.sql): attachments, compare, bulk, block, NDA record ───────────────

export const PITCH_ATTACHMENT_MAX = 3;
export const PITCH_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024;
export const PITCH_ATTACHMENT_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

const EXT_TYPES: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

/** A message for the writer, or null when the file may be attached. */
export function checkPitchAttachment(file: { name: string; size?: number | null }, already = 0): string | null {
  if (already >= PITCH_ATTACHMENT_MAX) return `You can attach up to ${PITCH_ATTACHMENT_MAX} files.`;
  if (!PITCH_ATTACHMENT_EXT.includes(extOf(file.name))) return 'Attach a PDF or an image (JPG, PNG, WEBP).';
  if (file.size != null && file.size > PITCH_ATTACHMENT_MAX_BYTES) return 'Each file can be up to 15 MB.';
  return null;
}

/** attachments/<writer id>/<pitch id>-<n>-<time>.<ext> : the writer can write here, the call owner can read it. */
export function pitchAttachmentPath(userId: string, submissionId: string, name: string, n = 1, now = Date.now()): string {
  return `attachments/${userId}/${submissionId}-${n}-${now}.${extOf(name) || 'pdf'}`;
}

export function newSubmissionId(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const h = '0123456789abcdef';
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return h[ch === 'x' ? r : (r & 0x3) | 0x8];
  });
}

/** Uploads one file (Blob in the browser, ArrayBuffer on a phone) and returns the reference to store on the pitch. */
export async function uploadPitchAttachment(
  client: any, userId: string, submissionId: string, body: any, name: string, n = 1,
): Promise<string> {
  const path = pitchAttachmentPath(userId, submissionId, name, n);
  const { error } = await client.storage.from('pitch_assets').upload(path, body, { contentType: EXT_TYPES[extOf(name)] || 'application/octet-stream', upsert: false });
  if (error) throw error;
  return `pitch_assets:${path}`;
}

export async function removePitchAttachment(client: any, ref: string): Promise<void> {
  try {
    await client.storage.from('pitch_assets').remove([ref.replace(/^pitch_assets:/, '')]);
  } catch { /* an orphan file is harmless and private */ }
}

export async function signPitchAttachment(client: any, ref: string, seconds = 300): Promise<string> {
  const { data, error } = await client.storage.from('pitch_assets').createSignedUrl(ref.replace(/^pitch_assets:/, ''), seconds);
  if (error || !data?.signedUrl) throw error || new Error('Could not open the file');
  return data.signedUrl as string;
}

/** "Attachment 1 (PDF)" style label from a stored reference. */
export function attachmentLabel(ref: string, index = 0): string {
  const ext = extOf(ref.split('?')[0]);
  return `Attachment ${index + 1}${ext ? ` (${ext.toUpperCase()})` : ''}`;
}

/** Private notes and ratings for several pitches at once (comparison view). */
export async function fetchReviewNotes(client: any, ids: string[]): Promise<Record<string, ReviewNote>> {
  if (ids.length === 0) return {};
  const { data, error } = await client.from('pitch_submission_notes').select('submission_id, note, rating').in('submission_id', ids);
  if (error) throw error;
  const out: Record<string, ReviewNote> = {};
  for (const r of data || []) out[r.submission_id] = { note: r.note ?? '', rating: r.rating ?? null };
  return out;
}

export const BULK_STATUSES: { value: string; label: string }[] = [
  { value: 'under_review', label: 'Under review' },
  { value: 'shortlisted', label: 'Shortlist' },
  { value: 'passed', label: 'Pass' },
];

/** Moves several pitches to one status. Withdrawn pitches are skipped (they can no longer change). Returns how many changed. */
export async function bulkUpdateStatus(client: any, ids: string[], status: string): Promise<number> {
  if (ids.length === 0) return 0;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === 'under_review') patch.reviewed_at = now;
  if (status === 'shortlisted') patch.shortlisted_at = now;
  if (status === 'passed') patch.passed_at = now;
  const { data, error } = await client.from('pitch_submissions').update(patch).in('id', ids).neq('status', 'withdrawn').select('id');
  if (error) throw error;
  return (data || []).length;
}

/** Blocks a person (they can no longer message you or pitch to you). Already blocked counts as done. */
export async function blockUser(client: any, me: string, target: string): Promise<void> {
  const { error } = await client.from('blocked_users').insert({ user_id: me, blocked_user_id: target });
  if (error && error.code !== '23505') throw error;
}

export interface NdaRecord {
  record_id: string; pitch_title: string; call_title: string; direct: boolean; nda_required: boolean;
  writer: { id: string; name: string | null } | null; owner: { id: string; name: string | null } | null;
  writer_signature: string | null; writer_signed_at: string | null; submitted_at: string | null;
  viewer_signatures: { name: string | null; signature: string; signed_at: string }[]; generated_at: string;
}

export async function fetchNdaRecord(client: any, submissionId: string): Promise<NdaRecord | null> {
  const { data, error } = await client.rpc('get_nda_record', { p_submission: submissionId });
  if (error) throw error;
  return (data as NdaRecord | null) ?? null;
}

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function when(v?: string | null): string {
  if (!v) return 'Not signed';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? esc(v) : `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

/** A printable page (save as PDF from the print dialog). It records who signed and when; it is not legal advice. */
export function buildNdaRecordHtml(r: NdaRecord): string {
  const viewers = r.viewer_signatures.length
    ? r.viewer_signatures.map((v) => `<tr><td>${esc(v.name || 'Reviewer')}</td><td class="sig">${esc(v.signature)}</td><td>${when(v.signed_at)}</td></tr>`).join('')
    : '<tr><td colspan="3">No reviewer has signed yet.</td></tr>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>NDA record ${esc(r.record_id)}</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;color:#111;max-width:760px;margin:32px auto;padding:0 20px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#555;margin:26px 0 8px}
table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}th{background:#f4f4f4;width:34%}
.sig{font-family:Georgia,serif;font-style:italic;font-size:16px}.note{margin-top:28px;font-size:12px;color:#555}
</style></head><body>
<h1>Confidentiality (NDA) record</h1>
<div>CineCraft Connect &middot; record ${esc(r.record_id)}</div>
<h2>The pitch</h2>
<table><tr><th>Pitch</th><td>${esc(r.pitch_title)}</td></tr>
<tr><th>Sent to</th><td>${r.direct ? 'Direct pitch (private)' : esc(r.call_title)}</td></tr>
<tr><th>Writer</th><td>${esc(r.writer?.name || '')}</td></tr>
<tr><th>Call owner</th><td>${esc(r.owner?.name || '')}</td></tr>
<tr><th>Sent</th><td>${when(r.submitted_at)}</td></tr>
<tr><th>NDA required by the call</th><td>${r.nda_required ? 'Yes' : 'No'}</td></tr></table>
<h2>Writer's e-signature</h2>
<table><tr><th>Signed as</th><td class="sig">${esc(r.writer_signature || 'Not signed')}</td></tr>
<tr><th>Signed at (server time)</th><td>${when(r.writer_signed_at)}</td></tr></table>
<h2>Terms shown to the writer when signing</h2>
<ul><li>Maintain strict confidentiality about this interaction</li><li>Not share details of this exchange with third parties</li><li>Be bound by CineCraft's Pitch Marketplace arbitration clause</li></ul>
<h2>Reviewer e-signatures</h2>
<table><tr><th>Name</th><th>Signed as</th><th>Signed at (server time)</th></tr>${viewers}</table>
<p class="note">Generated ${when(r.generated_at)}. Typed names and times are recorded by CineCraft Connect when each person signed. This record shows who signed and when; it is not legal advice.</p>
</body></html>`;
}

/** The same record as plain text, for the phone's share sheet. */
export function buildNdaRecordText(r: NdaRecord): string {
  const lines = [
    'CONFIDENTIALITY (NDA) RECORD - CineCraft Connect',
    `Record: ${r.record_id}`,
    `Pitch: ${r.pitch_title}`,
    `Sent to: ${r.direct ? 'Direct pitch (private)' : r.call_title}`,
    `Writer: ${r.writer?.name || ''}`,
    `Call owner: ${r.owner?.name || ''}`,
    `NDA required by the call: ${r.nda_required ? 'Yes' : 'No'}`,
    '',
    `Writer signed as: ${r.writer_signature || 'Not signed'}`,
    `Writer signed at: ${when(r.writer_signed_at)}`,
    '',
    'Reviewers:',
    ...(r.viewer_signatures.length
      ? r.viewer_signatures.map((v) => `- ${v.name || 'Reviewer'} signed as "${v.signature}" at ${when(v.signed_at)}`)
      : ['- No reviewer has signed yet.']),
    '',
    `Generated ${when(r.generated_at)}. Names and times were recorded by CineCraft Connect when each person signed. This record shows who signed and when; it is not legal advice.`,
  ];
  return lines.join('\n');
}

/**
 * Who may submit a pitch. ONE rule for web and mobile (F-03/F-04).
 * Fans never submit (whatever their free-text craft says). Creators always may. Studios only with a writer-side craft.
 * Staff are excluded by the apps themselves (isInternal). The database also refuses fans: supabase/manual/part_do_pitch_submit_rules.sql.
 */
export const PITCH_ROLE_CAN_SUBMIT = ['writer', 'screenwriter', 'director', 'creator', 'story developer', 'filmmaker'];

export function canSubmitPitch(craft?: string | null, accountType?: string | null): boolean {
  if (accountType === 'fan') return false;
  if (accountType === 'creator') return true;
  if (!craft) return false;
  const c = craft.toLowerCase();
  return PITCH_ROLE_CAN_SUBMIT.some((r) => c.includes(r.toLowerCase()));
}

// ── managing your own calls and reading the review inbox (same on web and mobile) ────────────────────────────────

export interface CallSubmissionCounts { total: number; fresh: number; shortlisted: number }

/** Per call: how many pitches came in (withdrawn ones not counted), how many are still new, how many are shortlisted. */
export function countSubmissionsByCall(rows: Array<{ pitch_call_id?: string | null; status?: string | null }> | null | undefined): Record<string, CallSubmissionCounts> {
  const out: Record<string, CallSubmissionCounts> = {};
  for (const r of rows ?? []) {
    if (!r?.pitch_call_id || r.status === 'withdrawn') continue;
    const c = (out[r.pitch_call_id] ||= { total: 0, fresh: 0, shortlisted: 0 });
    c.total++;
    if (r.status === 'submitted') c.fresh++;
    if (r.status === 'shortlisted') c.shortlisted++;
  }
  return out;
}

export type OwnCallState = 'draft' | 'open' | 'expired' | 'closed';

/** What a call you own looks like right now: a draft, open, past its deadline, or closed by you. */
export function ownCallState(call: { status?: string | null; deadline?: string | null; is_published?: boolean | null }, now: Date = new Date()): OwnCallState {
  if (call.is_published === false) return 'draft';
  if (call.status && call.status !== 'open') return 'closed';
  return pitchCallIsClosed(call, now) ? 'expired' : 'open';
}

/** Inbox order: new pitches first, then the rest by when they came in (newest first). */
export function sortInboxSubmissions<T extends { status?: string | null; submitted_at?: string | null; created_at?: string | null }>(rows: T[]): T[] {
  const when = (r: T) => new Date(r.submitted_at || r.created_at || 0).getTime() || 0;
  return [...rows].sort((a, b) => {
    const an = a.status === 'submitted' ? 1 : 0;
    const bn = b.status === 'submitted' ? 1 : 0;
    return an !== bn ? bn - an : when(b) - when(a);
  });
}
