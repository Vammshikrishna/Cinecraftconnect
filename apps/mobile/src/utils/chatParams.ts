/**
 * Pure helpers for the Messages / Conversation navigation params (no react-native imports).
 * Many screens open a chat with different key names (partnerId, recipientId, userId ...);
 * this accepts all of them so every caller keeps working.
 */
const first = (...values: any[]): any => {
  for (const v of values) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
};

export interface ChatParams {
  conversationId?: string;
  partnerId?: string;
  partnerName?: string;
  partnerAvatar?: string;
  partnerCraft?: string;
}

const looksLikeUuid = (v: any) => typeof v === 'string' && v.includes('-');

/** Normalise any of the naming schemes used by callers into one shape. */
export const resolveChatParams = (params: any): ChatParams => {
  const p = params || {};
  const conversationId = first(p.conversationId, p.channelId, p.channel_id);
  const partnerId = first(
    p.partnerId, p.partner_id, p.recipientId, p.recipient_id, p.userId, p.user_id,
    p.senderId, p.sender_id, p.trigger_user_id,
    looksLikeUuid(conversationId) ? conversationId : undefined,
  );
  const partnerName = first(
    p.partnerName, p.recipientName, p.recipient_name, p.userName, p.user_name,
    p.senderName, p.sender_name, p.title,
  );
  const partnerAvatar = first(
    p.partnerAvatar, p.recipientAvatar, p.recipient_avatar, p.avatarUrl, p.avatar_url,
  );
  const partnerCraft = first(p.partnerCraft, p.recipientCraft);
  return { conversationId, partnerId, partnerName, partnerAvatar, partnerCraft };
};

/** Stable key for a conversation shown in the split view. */
export const chatKeyFor = (params: any): string => {
  const r = resolveChatParams(params);
  return String(r.conversationId || r.partnerId || 'chat');
};

/** Ids that must not appear in new-message search: people I blocked and people who blocked me. */
export const blockedBothWays = (
  myId: string,
  rows: Array<{ user_id?: string; blocked_user_id?: string }> | null | undefined,
): Set<string> => {
  const out = new Set<string>();
  for (const r of rows || []) {
    if (r.user_id === myId && r.blocked_user_id) out.add(r.blocked_user_id);
    else if (r.blocked_user_id === myId && r.user_id) out.add(r.user_id);
  }
  return out;
};
