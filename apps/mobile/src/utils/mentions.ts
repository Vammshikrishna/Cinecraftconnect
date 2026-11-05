import { getSupabaseClient } from '@cinecraft/api';

export interface MentionUser {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

/** The label that was typed after the @ (username, else full name), as web mention-textarea inserts it. */
export const mentionLabel = (u: MentionUser) => u.username || u.full_name || '';

/** Ids of picked people whose @label is still in the text (they may have deleted it after picking). */
export function stillMentioned(text: string, picked: Record<string, MentionUser>, selfId?: string | null): string[] {
  return Object.values(picked)
    .filter((u) => u.id !== selfId && !!mentionLabel(u) && text.includes('@' + mentionLabel(u)))
    .map((u) => u.id);
}

/**
 * Save mention rows exactly like web (CommentSection / CreateAnnouncementDialog):
 * {mentioner_id, mentioned_id, related_id, related_type}. Fails soft: the post or comment already exists.
 */
export async function insertMentions(opts: {
  mentionerId: string;
  mentionedIds: string[];
  relatedId: string;
  relatedType: 'post' | 'comment' | 'announcement';
}): Promise<void> {
  const { mentionerId, mentionedIds, relatedId, relatedType } = opts;
  if (!mentionerId || !relatedId || mentionedIds.length === 0) return;
  try {
    const rows = Array.from(new Set(mentionedIds)).map((mentionedId) => ({
      mentioner_id: mentionerId,
      mentioned_id: mentionedId,
      related_id: relatedId,
      related_type: relatedType,
    }));
    await (getSupabaseClient() as any).from('mentions').insert(rows);
  } catch (e) {
    console.warn('[mentions] insert failed', e);
  }
}
