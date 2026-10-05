import { bufferToBase64, base64ToBuffer } from '../core';
import { supabase } from '@/integrations/supabase/client';

export interface EncryptedAttachmentPayload {
  encryptedStorageUrl: string;
  fileKeyB64: string;           // Base64 AES-256 file key
  encryptedMetadataB64: string;  // Base64 encrypted filename & mimeType
}

/**
 * Encrypts a local file blob with a unique random AES-256-GCM key before upload.
 */
export const encryptAndUploadAttachment = async (
  file: File,
  bucketName: string = 'attachments',
  pathPrefix: string = 'e2ee'
): Promise<EncryptedAttachmentPayload> => {
  // 1. Generate unique random AES-256 key for this specific attachment
  const fileKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const fileKeyRaw = await window.crypto.subtle.exportKey('raw', fileKey);
  const fileKeyB64 = bufferToBase64(fileKeyRaw);

  // 2. Encrypt File Content
  const fileBuffer = await file.arrayBuffer();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedFileBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    fileKey,
    fileBuffer
  );

  // Concatenate IV (12 bytes) + Ciphertext for storage blob
  const combined = new Uint8Array(iv.byteLength + encryptedFileBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedFileBuffer), iv.byteLength);

  const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });

  // 3. Encrypt Metadata (original name, size, type)
  const metadata = JSON.stringify({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const metaIv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedMetaBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: metaIv },
    fileKey,
    new TextEncoder().encode(metadata)
  );

  const encryptedMetaB64 = `${bufferToBase64(metaIv.buffer)}:${bufferToBase64(encryptedMetaBuf)}`;

  // 4. Upload Encrypted Blob to Supabase Storage
  const fileName = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.enc`;
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, encryptedBlob, {
      contentType: 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload encrypted attachment: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return {
    encryptedStorageUrl: publicUrlData.publicUrl,
    fileKeyB64,
    encryptedMetadataB64: encryptedMetaB64,
  };
};
