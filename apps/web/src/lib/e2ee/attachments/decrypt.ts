import { base64ToBuffer } from '../core';
import { supabase } from '@/integrations/supabase/client';

export interface DecryptedAttachment {
  blobUrl: string;
  name: string;
  type: string;
  size: number;
}

/**
 * Downloads and decrypts an encrypted storage attachment blob.
 */
export const downloadAndDecryptAttachment = async (
  encryptedStorageUrl: string,
  fileKeyB64: string,
  encryptedMetadataB64?: string
): Promise<DecryptedAttachment> => {
  // 1. Download encrypted blob with fallback
  let combinedBuffer: ArrayBuffer;
  try {
    const res = await fetch(encryptedStorageUrl);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    combinedBuffer = await res.arrayBuffer();
  } catch (fetchErr) {
    try {
      const urlObj = new URL(encryptedStorageUrl);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      const publicIdx = parts.indexOf('public');
      if (publicIdx !== -1 && parts.length > publicIdx + 2) {
        const bucket = parts[publicIdx + 1];
        const path = parts.slice(publicIdx + 2).join('/');
        const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(path);
        if (downloadError || !blob) throw downloadError || new Error('Download failed');
        combinedBuffer = await blob.arrayBuffer();
      } else {
        throw fetchErr;
      }
    } catch (fallbackErr) {
      console.error('[E2EE Decrypt] Failed to fetch encrypted payload:', fetchErr, fallbackErr);
      throw new Error('Failed to fetch encrypted attachment payload');
    }
  }

  // Extract IV (first 12 bytes) and Ciphertext (remainder)
  const iv = new Uint8Array(combinedBuffer.slice(0, 12));
  const ciphertext = combinedBuffer.slice(12);

  // 2. Import AES-256 File Key
  const fileKeyRaw = base64ToBuffer(fileKeyB64);
  const fileKey = await window.crypto.subtle.importKey(
    'raw',
    fileKeyRaw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Decrypt Blob
  const decryptedBuf = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    fileKey,
    ciphertext
  );

  // 4. Decrypt Metadata if available
  let name = 'attachment';
  let type = 'application/octet-stream';
  let size = decryptedBuf.byteLength;

  if (encryptedMetadataB64 && encryptedMetadataB64.includes(':')) {
    try {
      const [metaIvB64, metaCipherB64] = encryptedMetadataB64.split(':');
      const metaIv = new Uint8Array(base64ToBuffer(metaIvB64));
      const metaCipher = base64ToBuffer(metaCipherB64);

      const metaDecryptedBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: metaIv },
        fileKey,
        metaCipher
      );

      const metaJson = JSON.parse(new TextDecoder().decode(metaDecryptedBuf));
      if (metaJson.name) name = metaJson.name;
      if (metaJson.type) type = metaJson.type;
      if (metaJson.size) size = metaJson.size;
    } catch (e) {
      console.warn('Attachment metadata decryption skipped:', e);
    }
  }

  const decryptedBlob = new Blob([decryptedBuf], { type });
  const blobUrl = URL.createObjectURL(decryptedBlob);

  return {
    blobUrl,
    name,
    type,
    size,
  };
};
