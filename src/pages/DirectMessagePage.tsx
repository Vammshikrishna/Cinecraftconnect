
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const DirectMessagePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !userId) return;

    const setupConversation = async () => {
      // Check if a conversation already exists.
      // A more robust way would be a function that checks for conversation
      // between two specific users, regardless of who is sender/receiver.
      const { data, error: rpcError } = await supabase.rpc('get_or_create_conversation', { p_user_id_1: user.id, p_user_id_2: userId });

      if (rpcError) {
        console.error("Error checking for existing conversation:", rpcError);
        setError("Could not start a conversation.");
        return;
      }
      
      // If conversation exists, redirect to it
      if (data) {
        navigate(`/chats/${data}`);
      } else {
        // If no conversation, we can either create one here or let ChatPage handle it.
        // For simplicity, we'll redirect and let ChatPage/ChatList handle showing the new chat.
        // This page becomes a temporary placeholder to initiate a chat.
        // A better UX might involve sending the first message right here.
        navigate(`/chats/${userId}`);
      }
    };

    setupConversation();

  }, [user, userId, navigate]);

  if (error) {
    return <div className="text-center p-8 text-destructive">{error}</div>;
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner />
      <p className="ml-4">Starting your conversation...</p>
    </div>
  );
};

export default DirectMessagePage;
