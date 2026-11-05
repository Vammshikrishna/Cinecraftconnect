import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Clear chat" on this device only. We remember WHEN the signed-in person cleared a conversation and hide every message
 * from that moment or older. Nothing is deleted on the server; the other person keeps their copy.
 */
const key = (userId: string, partnerId: string) => `chat_cleared:${userId}:${partnerId}`;

export const getChatClearedAt = async (userId?: string | null, partnerId?: string | null): Promise<number | null> => {
  if (!userId || !partnerId) return null;
  try {
    const raw = await AsyncStorage.getItem(key(userId, partnerId));
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

export const setChatClearedNow = async (userId: string, partnerId: string): Promise<number> => {
  const now = Date.now();
  try {
    await AsyncStorage.setItem(key(userId, partnerId), String(now));
  } catch {
    /* storage failed: the chat is then only cleared until it is reopened */
  }
  return now;
};

/** true when a message (by its created_at) is newer than the clear marker, or there is no marker */
export const isAfterChatClear = (createdAt: string | null | undefined, clearedAt: number | null): boolean => {
  if (clearedAt == null) return true;
  if (!createdAt) return true;
  const t = new Date(createdAt).getTime();
  return !Number.isFinite(t) || t > clearedAt;
};
