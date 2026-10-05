import { getSupabaseClient } from '@cinecraft/api';
import { E2EEProtocolService } from '@cinecraft/e2ee';

export interface SendMessageParams {
  conversationId: string;
  senderId: string;
  senderDeviceId: string;
  partnerDeviceId?: string;
  plaintext: string;
  isEncrypted?: boolean;
}

export class MessagingService {
  static async sendDirectMessage(params: SendMessageParams): Promise<any> {
    const supabase = getSupabaseClient();
    let contentToStore = params.plaintext;

    if (params.isEncrypted && params.partnerDeviceId) {
      try {
        contentToStore = await E2EEProtocolService.sendDirectMessage({
          conversationId: params.conversationId,
          senderId: params.senderId,
          senderDeviceId: params.senderDeviceId,
          partnerDeviceId: params.partnerDeviceId,
          plaintext: params.plaintext,
        });
      } catch (err) {
        console.error('[MessagingService] E2EE encryption failed:', err);
        throw err;
      }
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        sender_id: params.senderId,
        content: contentToStore,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async decryptMessage(
    ciphertext: string,
    currentUserId: string,
    currentDeviceId: string
  ): Promise<string> {
    if (!ciphertext) return '';
    if (!ciphertext.startsWith('{')) return ciphertext;

    return await E2EEProtocolService.receiveDirectMessage({
      rawPayload: ciphertext,
      currentUserId,
      currentDeviceId,
    });
  }

  static async fetchMessages(conversationId: string, limit: number = 50): Promise<any[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, username, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  static async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);

    if (error) {
      console.warn('[MessagingService] Error marking as read:', error.message);
    }
  }
}
