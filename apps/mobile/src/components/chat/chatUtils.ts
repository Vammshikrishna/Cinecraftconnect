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
