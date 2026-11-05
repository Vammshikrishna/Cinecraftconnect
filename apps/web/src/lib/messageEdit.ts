/** Editing your own chat message (discussion rooms and project spaces). One place for the rules, so the screens and the tests agree. */

/** A message can be edited for this long after it was sent (the database enforces the same window, part FQ). */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const EDIT_MAX_LENGTH = 2000;

const SPECIAL_PREFIXES = ['POST_SHARE::', 'MARKETPLACE_SHARE::', 'ANNOUNCEMENT_SHARE::', 'VENDOR_SHARE::', 'PROJECT_SHARE::', 'DISCUSSION_SHARE::', 'ROOM_SHARE::', 'PROFILE_SHARE::', 'PITCH_SHARE::', 'COMPANY_SHARE::', 'CONTENT_SHARE::', 'JOB_SHARE::', '__e2ee'];

export interface EditableMessageLike {
  id: string;
  user_id: string;
  content?: string | null;
  created_at: string;
  is_deleted?: boolean | null;
  media_url?: string | null;
  media_type?: string | null;
  status?: string;
}

/** True when `userId` may edit this message right now: their own, plain text (no media, share card or call notice), not deleted, still inside the window. */
export const canEditMessage = (m: EditableMessageLike, userId: string | undefined | null, now: number = Date.now()): boolean => {
  if (!userId || m.user_id !== userId) return false;
  if (m.is_deleted || m.status === 'pending' || m.status === 'error' || String(m.id).startsWith('temp-')) return false;
  if (m.media_url || (m.media_type && m.media_type !== 'text')) return false;
  const text = m.content || '';
  if (!text.trim() || SPECIAL_PREFIXES.some((p) => text.includes(p)) || /^\s*📞/.test(text)) return false;
  const age = now - new Date(m.created_at).getTime();
  return Number.isFinite(age) && age >= 0 && age <= EDIT_WINDOW_MS;
};

export type EditCheck = { ok: true; text: string } | { ok: false; reason: 'empty' | 'unchanged' | 'too_long'; message: string };

/** Checks the new text before it is saved. */
export const checkEditedText = (original: string, next: string): EditCheck => {
  const text = next.trim();
  if (!text) return { ok: false, reason: 'empty', message: 'A message cannot be empty. Delete it instead.' };
  if (text === (original || '').trim()) return { ok: false, reason: 'unchanged', message: 'Nothing was changed.' };
  if (text.length > EDIT_MAX_LENGTH) return { ok: false, reason: 'too_long', message: `Messages can be up to ${EDIT_MAX_LENGTH} characters.` };
  return { ok: true, text };
};

/** Minutes left to edit, for the editor hint ("12 min left"). */
export const editMinutesLeft = (createdAt: string, now: number = Date.now()): number =>
  Math.max(0, Math.ceil((EDIT_WINDOW_MS - (now - new Date(createdAt).getTime())) / 60000));
