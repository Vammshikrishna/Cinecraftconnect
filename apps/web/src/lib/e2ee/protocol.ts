import { encryptDMMessage, decryptDMMessage } from './dm/message';
import { encryptGroupMessagePayload, decryptGroupMessagePayload } from './group/mls';
import { encryptAndUploadAttachment, downloadAndDecryptAttachment } from './attachments';

export class E2EEProtocolService {
  /**
   * Encrypts a Direct Message payload using Double Ratchet.
   */
  static async sendDirectMessage(params: {
    conversationId: string;
    senderId: string;
    senderDeviceId: string;
    partnerDeviceId: string;
    plaintext: string;
    signingPrivateKey?: CryptoKey;
  }): Promise<string> {
    return encryptDMMessage(
      params.conversationId,
      params.senderId,
      params.senderDeviceId,
      params.partnerDeviceId,
      params.plaintext,
      params.signingPrivateKey
    );
  }

  /**
   * Decrypts a Direct Message payload. Fails closed if decryption fails.
   */
  static async receiveDirectMessage(params: {
    rawPayload: string;
    currentUserId: string;
    currentDeviceId: string;
    legacyPrivateKeyB64?: string;
  }): Promise<string> {
    // 1. Try Double Ratchet Version 2 parsing
    const decrypted = await decryptDMMessage(
      params.rawPayload,
      params.currentUserId,
      params.currentDeviceId
    );

    if (decrypted !== null) {
      return decrypted;
    }

    // 2. Fail closed if ciphertext payload could not be authenticated/decrypted
    return params.rawPayload.startsWith('{') ? '🔒 Unable to decrypt message' : params.rawPayload;
  }

  /**
   * Encrypts a Group Message payload (ProjectSpace / Private Room) using Group MLS Epoch key.
   */
  static async sendGroupMessage(params: {
    targetType: 'project_space' | 'room';
    groupId: string;
    senderId: string;
    senderDeviceId: string;
    plaintext: string;
    epochKeyB64: string;
    epoch: number;
  }): Promise<string> {
    return encryptGroupMessagePayload(
      params.targetType,
      params.groupId,
      params.senderId,
      params.senderDeviceId,
      params.plaintext,
      params.epochKeyB64,
      params.epoch
    );
  }

  /**
   * Decrypts a Group Message payload using Group MLS Epoch key.
   */
  static async receiveGroupMessage(params: {
    rawPayload: string;
    epochKeyB64: string;
  }): Promise<string> {
    const decrypted = await decryptGroupMessagePayload(params.rawPayload, params.epochKeyB64);
    if (decrypted !== null) {
      return decrypted;
    }
    return params.rawPayload.startsWith('{') ? '🔒 Unable to decrypt group message' : params.rawPayload;
  }

  /**
   * Client-side attachment encryption prior to storage upload.
   */
  static async encryptAttachment(file: File, bucketName?: string, pathPrefix?: string) {
    return encryptAndUploadAttachment(file, bucketName, pathPrefix);
  }

  /**
   * Client-side attachment decryption after storage download.
   */
  static async decryptAttachment(storageUrl: string, fileKeyB64: string, metadataB64?: string) {
    return downloadAndDecryptAttachment(storageUrl, fileKeyB64, metadataB64);
  }
}
