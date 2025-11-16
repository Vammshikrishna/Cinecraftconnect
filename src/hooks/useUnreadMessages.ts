
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [hasUnread, setHasUnread] = useState(false);

  const fetchInitialUnreadStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('has_unread_messages');
      
      if (error) {
        console.error('Error fetching unread status:', error);
        return;
      }
      
      setHasUnread(data);

    } catch (err) {
      console.error('An unexpected error occurred:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchInitialUnreadStatus();
  }, [fetchInitialUnreadStatus]);

  useEffect(() => {
    if (!user) return;

    const handleNewMessage = (payload: any) => {
      // Check if the message is from another user
      const senderId = payload.new.sender_id || payload.new.user_id;
      if (senderId !== user.id) {
        // Only show notification if not on a chat page
        if (!location.pathname.startsWith('/messages') && 
            !location.pathname.startsWith('/discussion-rooms') && 
            !location.pathname.includes('/space')) {
          setHasUnread(true);
        }
      }
    };

    const directMessagesChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleNewMessage)
      .subscribe();

    const roomMessagesChannel = supabase
      .channel('public:discussion_room_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussion_room_messages' }, handleNewMessage)
      .subscribe();

    // In a real app, you would also join channels for project spaces the user is a member of.
    // This is a simplified example.

    return () => {
      supabase.removeChannel(directMessagesChannel);
      supabase.removeChannel(roomMessagesChannel);
    };
  }, [user, location.pathname]);

  useEffect(() => {
    // If user navigates to a chat-related page, clear the notification.
    if (location.pathname.startsWith('/messages') || location.pathname.startsWith('/discussion-rooms') || location.pathname.includes('/space')) {
      setHasUnread(false);
    }
  }, [location.pathname]);

  return { hasUnread };
};
