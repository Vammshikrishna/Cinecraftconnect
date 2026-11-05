import { normalizeShareCardData } from './ShareCard';

/**
 * Utility functions for chat message replies and media handling across mobile screens
 */

/**
 * Extracts a thumbnail image URL from a replied message or media URL.
 * Supports:
 * - Single image URL string (e.g. "https://.../img.jpg")
 * - JSON string array (e.g. '["https://.../img.jpg", ...]')
 * - JSON string array of objects (e.g. '[{"url":"https://.../img.jpg"}]')
 * - Message object with attachment_url / media_url
 */
export const getReplyThumbnail = (rawUrlOrMsg: any): string | null => {
  if (!rawUrlOrMsg) return null;
  const raw = typeof rawUrlOrMsg === 'string'
    ? rawUrlOrMsg
    : (rawUrlOrMsg.media_url || rawUrlOrMsg.attachment_url);
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // If stored as JSON array string: '["https://..."]' or '[{"url":"https://..."}]'
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        const u = typeof first === 'string' ? first : (first?.url || first?.uri);
        if (u && typeof u === 'string') return u;
      }
    } catch { }
  }

  // If stored as JSON object string: '{"url":"https://..."}'
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const u = parsed?.url || parsed?.uri;
      if (u && typeof u === 'string') return u;
    } catch { }
    return null;
  }

  // Check if explicitly typed
  const mediaType = typeof rawUrlOrMsg === 'object'
    ? (rawUrlOrMsg.media_type || rawUrlOrMsg.attachment_type)
    : null;

  if (mediaType === 'image') return trimmed;
  if (mediaType === 'video' || mediaType === 'file' || mediaType === 'audio') return null;

  // File extension checks
  if (trimmed.match(/\.(jpg|jpeg|png|gif|webp|heic|bmp|tiff)(\?.*)?$/i)) {
    return trimmed;
  }
  if (trimmed.match(/\.(mp4|mov|mkv|webm|avi|pdf|doc|docx|zip|rar|mp3|wav|ogg)(\?.*)?$/i)) {
    return null;
  }

  // If HTTP/HTTPS and not a known non-image
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return null;
};

/**
 * Returns a human-friendly reply snippet with appropriate icon prefix (e.g., "📷 Photo", "🎥 Video")
 */
export const getReplySnippet = (msg: any, rawFallbackText?: string): string => {
  if (!msg) return rawFallbackText || 'Replying';
  const hasImage = Boolean(getReplyThumbnail(msg));
  const raw = (rawFallbackText ?? msg.content ?? '').trim();

  if (!raw || raw === 'Shared an image' || raw === 'Shared an attachment') {
    return hasImage ? '📷 Photo' : (raw || 'Attachment');
  }
  if (raw === 'Shared a video' || msg.media_type === 'video' || msg.attachment_type === 'video') {
    return '🎥 Video';
  }
  if (hasImage && !raw.startsWith('📷')) {
    return `📷 ${raw}`;
  }
  return raw;
};

const SHARE_PREFIXES: { prefix: string; type: string }[] = [
  { prefix: 'PROJECT_SHARE::', type: 'project' },
  { prefix: 'POST_SHARE::', type: 'post' },
  { prefix: 'JOB_SHARE::', type: 'job' },
  { prefix: 'PROFILE_SHARE::', type: 'profile' },
  { prefix: 'PITCH_SHARE::', type: 'pitch' },
  { prefix: 'MARKETPLACE_SHARE::', type: 'marketplace' },
  { prefix: 'ANNOUNCEMENT_SHARE::', type: 'announcement' },
  { prefix: 'VENDOR_SHARE::', type: 'vendor' },
  { prefix: 'COMPANY_SHARE::', type: 'company' },
  { prefix: 'DISCUSSION_SHARE::', type: 'room' },
  { prefix: 'ROOM_SHARE::', type: 'room' },
  { prefix: 'CONTENT_SHARE::', type: 'content' },
];

const shareParseCache = new Map<string, { type: string; data: any; caption?: string } | null>();

/**
 * Parses a decrypted `*_SHARE::{json}` message into card data (copy of the room / project-space parsers, one place for DMs).
 * Returns null when the text is not a share or the JSON is broken, so the caller can fall back to the text line.
 * Pass `data` through normalizeShareCardData() before giving it to ShareCard.
 */
export const parseShareData = (content: string | null | undefined): { type: string; data: any; caption?: string } | null => {
  if (!content || typeof content !== 'string') return null;
  if (shareParseCache.has(content)) return shareParseCache.get(content)!;
  let result: { type: string; data: any; caption?: string } | null = null;
  const clean = content.replace(/^FORWARDED::/, '').trim();
  for (const { prefix, type } of SHARE_PREFIXES) {
    if (!clean.includes(prefix)) continue;
    try {
      const parts = clean.split(prefix);
      const caption = parts[0].trim();
      const raw = JSON.parse(parts[parts.length - 1].trim());
      if (!raw || typeof raw !== 'object') break;
      const data: any = {
        ...raw,
        type,
        id: raw.id || raw.projectId || raw.postId || raw.jobId || raw.listingId || raw.roomId || raw.pitchId,
        title: raw.title || raw.jobTitle || raw.name || raw.caption || 'Shared item',
        subtitle: raw.subtitle || raw.description || raw.logline,
        imageUrl: raw.imageUrl || raw.banner_url || raw.cover_image || raw.previewUrl || raw.poster_path,
        avatarUrl: raw.avatarUrl || raw.authorAvatar || raw.avatar,
        badge: raw.badge || raw.category || raw.genre || raw.genre_display || (type === 'content' ? undefined : raw.type),
        priceOrSalary: raw.priceOrSalary || raw.budget || raw.salary || raw.price,
        description: raw.description || raw.logline,
        genre: raw.genre || raw.genre_display,
      };
      if (type === 'content' && (raw.type === 'movie' || raw.type === 'tv')) data.mediaType = raw.type;
      // film shares (type movie/tv) become content cards; id falls back through roomId, pitchId ...
      const normalized = normalizeShareCardData(data);
      result = { type: normalized.type || type, data: normalized, caption: caption || undefined };
    } catch {
      result = null;
    }
    break;
  }
  shareParseCache.set(content, result);
  return result;
};
