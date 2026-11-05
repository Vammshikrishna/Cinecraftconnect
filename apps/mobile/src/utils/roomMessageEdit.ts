/** Room and project messages use user_id (and attachment_* in projects); the shared helper in messageEdit.ts uses sender_id / media_*. This adapts it. */
import { canEditMessage as canEditBase, checkEditedText, editMinutesLeft } from './messageEdit';

export { checkEditedText, editMinutesLeft };

export const canEditMessage = (m: any, userId: string | undefined | null, now: number = Date.now()): boolean =>
  !!m && canEditBase({
    ...m,
    sender_id: m.user_id,
    media_url: m.media_url ?? m.attachment_url ?? null,
    media_type: m.media_type ?? m.attachment_type ?? 'text',
  }, userId, now);
