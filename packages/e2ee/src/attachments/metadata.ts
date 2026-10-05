export interface ProtectedAttachmentMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  encryptedThumbnailUrl?: string;
}

export const sanitizePublicMimeType = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
};
