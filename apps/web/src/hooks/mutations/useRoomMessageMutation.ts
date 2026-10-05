import { mutationQueue } from '@/lib/offline/mutationQueue';
import { useAuth } from '@/contexts/AuthContext';
import { ClientIdManager } from '@/lib/offline/clientIds';

export function useRoomMessageMutation() {
  const { user } = useAuth();

  const sendRoomMessage = async (roomId: string, content: string, options?: { replyToId?: string | null, mediaUrl?: string | null, mediaType?: string | null }) => {
    if (!user) return;
    
    mutationQueue.enqueue(
      'SEND_ROOM_MESSAGE',
      { userId: user.id, roomId, content, replyToId: options?.replyToId, mediaUrl: options?.mediaUrl, mediaType: options?.mediaType, tempId: ClientIdManager.generate() },
      { id: ClientIdManager.generate() }
    );
  };

  const deleteRoomMessage = async (messageId: string) => {
    if (!user) return;
    mutationQueue.enqueue(
      'DELETE_ROOM_MESSAGE',
      { messageId, userId: user.id },
      { id: ClientIdManager.generate() }
    );
  };

  return { sendRoomMessage, deleteRoomMessage };
}
