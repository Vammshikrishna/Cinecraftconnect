/**
 * Who to show first in the share sheet, the way a social app does it: people you really interact with.
 * Signals (last 60 days): messages both ways and how recent, likes and comments on their posts, visits to their
 * profile, who you follow and who follows you, and your accepted connections. Each signal is capped so one very
 * chatty person cannot drown out everyone else, and chats fade with time.
 */
export interface ContactSignals {
  id: string;
  messages: number;
  lastMessageAt: string | null;
  unreadFromThem: number;
  likes: number;
  comments: number;
  views: number;
  iFollow: boolean;
  followsMe: boolean;
  isConnection: boolean;
}

const empty = (id: string): ContactSignals => ({
  id, messages: 0, lastMessageAt: null, unreadFromThem: 0, likes: 0, comments: 0, views: 0,
  iFollow: false, followsMe: false, isConnection: false,
});

export const contactScore = (s: ContactSignals, now: number = Date.now()): number => {
  const days = s.lastMessageAt ? Math.max(0, (now - new Date(s.lastMessageAt).getTime()) / 86400000) : Infinity;
  const recency = Number.isFinite(days) ? 40 * Math.exp(-days / 10) : 0; // a chat from today is worth 40, from 10 days ago about 15
  const volume = Math.min(Math.log2(1 + s.messages) * 6, 30);
  const likes = Math.min(s.likes * 2, 16);
  const comments = Math.min(s.comments * 4, 20);
  const views = Math.min(s.views * 3, 12);
  const unread = Math.min(s.unreadFromThem, 3) * 2;
  return recency + volume + likes + comments + views + unread + (s.iFollow ? 10 : 0) + (s.followsMe ? 4 : 0) + (s.isConnection ? 12 : 0);
};

/** Reads the signals for the signed-in person. Any one source that fails (a policy, a missing table) is just skipped. */
export const loadContactSignals = async (client: any, userId: string): Promise<Map<string, ContactSignals>> => {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const map = new Map<string, ContactSignals>();
  const get = (id: string) => {
    let s = map.get(id);
    if (!s) { s = empty(id); map.set(id, s); }
    return s;
  };
  const safe = async <T,>(p: PromiseLike<T>): Promise<T | null> => { try { return await p; } catch { return null; } };

  const [dms, likes, comments, views, following, followers] = await Promise.all([
    safe(client.from('direct_messages').select('sender_id, receiver_id, created_at, is_read')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).gte('created_at', since).order('created_at', { ascending: false }).limit(1000)),
    safe(client.from('post_likes').select('post_id, posts!inner(author_id)').eq('user_id', userId).gte('created_at', since).limit(300)),
    safe(client.from('post_comments').select('post_id, posts!inner(author_id)').eq('user_id', userId).gte('created_at', since).limit(300)),
    safe(client.from('profile_views').select('profile_id').eq('viewer_id', userId).gte('created_at', since).limit(300)),
    safe(client.from('user_follows').select('following_id').eq('follower_id', userId).limit(1000)),
    safe(client.from('user_follows').select('follower_id').eq('following_id', userId).limit(1000)),
  ]);

  ((dms as any)?.data || []).forEach((m: any) => {
    const other = m.sender_id === userId ? m.receiver_id : m.sender_id;
    if (!other || other === userId) return;
    const s = get(other);
    s.messages += 1;
    if (!s.lastMessageAt || m.created_at > s.lastMessageAt) s.lastMessageAt = m.created_at;
    if (m.sender_id === other && m.is_read === false) s.unreadFromThem += 1;
  });
  const author = (row: any) => (Array.isArray(row.posts) ? row.posts[0]?.author_id : row.posts?.author_id);
  ((likes as any)?.data || []).forEach((r: any) => { const a = author(r); if (a && a !== userId) get(a).likes += 1; });
  ((comments as any)?.data || []).forEach((r: any) => { const a = author(r); if (a && a !== userId) get(a).comments += 1; });
  ((views as any)?.data || []).forEach((r: any) => { if (r.profile_id && r.profile_id !== userId) get(r.profile_id).views += 1; });
  ((following as any)?.data || []).forEach((r: any) => { if (r.following_id) get(r.following_id).iFollow = true; });
  ((followers as any)?.data || []).forEach((r: any) => { if (r.follower_id) get(r.follower_id).followsMe = true; });
  return map;
};

/** The channel id both people's messages share (same rule the chat screens use). */
export const directChannelId = (userId1: string, userId2: string): string => {
  const [id1, id2] = [userId1, userId2].sort();
  if (id1?.length === 36 && id2?.length === 36) return id1.slice(0, 18) + id2.slice(18);
  return `${id1}-${id2}`.slice(0, 36);
};
