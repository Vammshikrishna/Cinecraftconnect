import { Alert } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { friendlyError, directChannelId } from '@cinecraft/core';
import { saveCache } from '../services/offlineCache';
import { showToast } from '../contexts/ToastContext';

/**
 * Same as web Messages.tsx handleDeleteConversation: the direct_messages rows between the two people are deleted
 * (RLS lets either side), so the chat is gone for both and a new message starts it again.
 */
export const confirmAndDeleteConversation = (
  userId: string,
  partnerId: string,
  partnerName: string,
  onDeleted?: () => void,
) => {
  const name = partnerName || 'this person';
  Alert.alert(
    'Delete conversation for both of you?',
    `Every message in this conversation with ${name} will be removed for both you and ${name}. This cannot be undone. A new message starts a fresh conversation.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete for both',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await (getSupabaseClient() as any)
              .from('direct_messages')
              .delete()
              .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`);
            if (error) throw error;
            saveCache(`conv_messages_${directChannelId(userId, partnerId)}`, []).catch(() => { });
            showToast({ title: 'Conversation deleted', message: `Removed for you and ${name}.`, type: 'success' });
            onDeleted?.();
          } catch (e) {
            Alert.alert('Could not delete the conversation', friendlyError(e, 'Please try again.'));
          }
        },
      },
    ],
  );
};
