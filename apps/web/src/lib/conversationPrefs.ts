export const MAX_PINNED_CHATS = 3;

export type ChatPref = { muted?: boolean; pinned?: boolean };
export type ChatPrefs = Record<string, ChatPref>;

const key = (userId: string) => `cc_convo_prefs:${userId}`;

export function readLocalPrefs(userId?: string | null): ChatPrefs {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLocalPrefs(userId: string, prefs: ChatPrefs) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(prefs));
  } catch {
    /* private window: the choice just is not remembered */
  }
}

/** Used by notification code that is not inside a React tree. */
export function isChatMuted(userId: string | undefined | null, partnerId: string): boolean {
  return !!readLocalPrefs(userId)[partnerId]?.muted;
}

export function pinnedCount(prefs: ChatPrefs): number {
  return Object.values(prefs).filter((p) => p?.pinned).length;
}

export function canPinChat(prefs: ChatPrefs, partnerId: string): boolean {
  return !!prefs[partnerId]?.pinned || pinnedCount(prefs) < MAX_PINNED_CHATS;
}

/** Pinned chats first (keeping their relative order), everything else unchanged. */
export function pinnedFirst<T extends { partner: { id: string } }>(items: T[], prefs: ChatPrefs): T[] {
  const pinned = items.filter((c) => prefs[c.partner.id]?.pinned);
  if (pinned.length === 0) return items;
  return [...pinned, ...items.filter((c) => !prefs[c.partner.id]?.pinned)];
}
