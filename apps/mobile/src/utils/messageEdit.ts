/** Editing your own DM text (port of the web lib/messageEdit.ts). */

export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const EDIT_MAX_LENGTH = 2000;

const SPECIAL_PREFIXES = ['POST_SHARE::', 'MARKETPLACE_SHARE::', 'ANNOUNCEMENT_SHARE::', 'VENDOR_SHARE::', 'PROJECT_SHARE::', 'DISCUSSION_SHARE::', 'ROOM_SHARE::', 'PROFILE_SHARE::', 'PITCH_SHARE::', 'COMPANY_SHARE::', 'CONTENT_SHARE::', 'JOB_SHARE::'];

export interface EditableMessageLike {
  id: string;
  sender_id: string;
  content?: string | null;
  created_at: string;
  is_deleted?: boolean | null;
  media_url?: string | null;
  media_type?: string | null;
  status?: string;
}

/** `content` should be the decrypted text. */
export const canEditMessage = (m: EditableMessageLike, userId: string | undefined | null, now: number = Date.now()): boolean => {
  if (!userId || m.sender_id !== userId) return false;
  if (m.is_deleted || m.status === 'pending' || m.status === 'error' || String(m.id).startsWith('temp-')) return false;
  if (m.media_url || (m.media_type && m.media_type !== 'text')) return false;
  const text = m.content || '';
  if (!text.trim() || SPECIAL_PREFIXES.some((p) => text.includes(p)) || /^\s*📞/.test(text)) return false;
  const age = now - new Date(m.created_at).getTime();
  return Number.isFinite(age) && age >= 0 && age <= EDIT_WINDOW_MS;
};

export type EditCheck = { ok: true; text: string } | { ok: false; reason: 'empty' | 'unchanged' | 'too_long'; message: string };

export const checkEditedText = (original: string, next: string): EditCheck => {
  const text = next.trim();
  if (!text) return { ok: false, reason: 'empty', message: 'A message cannot be empty. Delete it instead.' };
  if (text === (original || '').trim()) return { ok: false, reason: 'unchanged', message: 'Nothing was changed.' };
  if (text.length > EDIT_MAX_LENGTH) return { ok: false, reason: 'too_long', message: `Messages can be up to ${EDIT_MAX_LENGTH} characters.` };
  return { ok: true, text };
};

export const editMinutesLeft = (createdAt: string, now: number = Date.now()): number =>
  Math.max(0, Math.ceil((EDIT_WINDOW_MS - (now - new Date(createdAt).getTime())) / 60000));
