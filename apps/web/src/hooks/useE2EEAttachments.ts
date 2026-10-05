import { useState, useCallback } from 'react';
import { E2EEProtocolService, downloadAndDecryptAttachment, DecryptedAttachment } from '@/lib/e2ee';

export const useE2EEAttachments = () => {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  /**
   * Encrypts file blob locally with random AES key and uploads to Supabase Storage.
   */
  const uploadEncryptedAttachment = useCallback(async (
    file: File,
    bucketName?: string,
    pathPrefix?: string
  ) => {
    setUploading(true);
    try {
      return await E2EEProtocolService.encryptAttachment(file, bucketName, pathPrefix);
    } finally {
      setUploading(false);
    }
  }, []);

  /**
   * Downloads and decrypts an encrypted storage attachment.
   */
  const decryptAttachment = useCallback(async (
    storageUrl: string,
    fileKeyB64: string,
    metadataB64?: string
  ): Promise<DecryptedAttachment> => {
    setDownloading(true);
    try {
      return await E2EEProtocolService.decryptAttachment(storageUrl, fileKeyB64, metadataB64);
    } finally {
      setDownloading(false);
    }
  }, []);

  return {
    uploadEncryptedAttachment,
    decryptAttachment,
    uploading,
    downloading,
  };
};
