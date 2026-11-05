/**
 * "Clear chat" on this device. Nothing is deleted from the database: we remember WHEN the signed-in person cleared a conversation
 * and hide every message from that moment or older (in the thread, in the chat list preview and so in search). The other person
 * keeps their full copy, and messages sent after the marker show normally. Stored per user and per conversation partner in
 * localStorage, so it survives a reload (same idea as "Clear chat" on mobile, which also only empties this device).
 */
const key = (userId: string, partnerId: string) => `chat_cleared:${userId}:${partnerId}`;

export const getChatClearedAt = (userId?: string | null, partnerId?: string | null): number | null => {
  if (!userId || !partnerId) return null;
  try {
    const raw = localStorage.getItem(key(userId, partnerId));
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

export const setChatClearedNow = (userId: string, partnerId: string): void => {
  try {
    localStorage.setItem(key(userId, partnerId), String(Date.now()));
  } catch {
    /* storage can be blocked: the chat is then only cleared until the next reload */
  }
};

/** true when a message (by its created_at) is newer than the clear marker, or there is no marker */
export const isAfterChatClear = (createdAt: string | null | undefined, clearedAt: number | null): boolean => {
  if (clearedAt == null) return true;
  if (!createdAt) return true;
  const t = new Date(createdAt).getTime();
  return !Number.isFinite(t) || t > clearedAt;
};
