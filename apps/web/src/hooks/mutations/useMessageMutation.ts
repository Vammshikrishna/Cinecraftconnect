import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useMessageMutation() {
  const { user } = useAuth();

  const sendMessage = async (conversationId: string, content: string, options?: { replyToId?: string | null }) => {
    if (!user) return;
    
    mutationQueue.enqueue(
      'SEND_MESSAGE',
      { userId: user.id, conversationId, content, replyToId: options?.replyToId, tempId: ClientIdManager.generate() },
      { id: ClientIdManager.generate() }
    );
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'DELETE_MESSAGE',
      { messageId, userId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  return { sendMessage, deleteMessage };
}
