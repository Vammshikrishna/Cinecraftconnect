
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastMessageToken, setLastMessageToken] = useState(0);

  const fetchInitialUnreadStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data: hasUnreadData } = await supabase.rpc('has_unread_messages' as any);
      const { data: countData } = await supabase.rpc('get_total_unread_count' as any);

      setHasUnread(!!hasUnreadData);
      setUnreadCount(Number(countData || 0));
      // Increment token to force re-fetch of previews in components like ChatMenu
      setLastMessageToken(prev => prev + 1);

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
      // Logic checked by Supabase RLS (only recipient/member receives payload)
      // but we double confirm it's not our own message
      const senderId = payload.new.sender_id || payload.new.user_id;
      if (senderId !== user.id) {
        if (!location.pathname.startsWith('/messages') &&
          !location.pathname.startsWith('/dm/') &&
          !location.pathname.startsWith('/discussion-rooms') &&
          !location.pathname.includes('/space')) {
          setHasUnread(true);
          setLastMessageToken(prev => prev + 1);
        }
      }
    };

    // User-specific channels for DMs, Rooms, and Projects
    const directMessagesChannel = supabase
      .channel(`user_dm_${user.id}`)
      .on('postgres_changes', { 
         event: 'INSERT', 
         schema: 'public', 
         table: 'direct_messages' 
      }, handleNewMessage)
      .subscribe();

    const roomMessagesChannel = supabase
      .channel(`user_room_${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'room_messages' 
      }, handleNewMessage)
      .subscribe();

    const projectMessagesChannel = supabase
      .channel(`user_project_${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'project_space_messages' 
      }, handleNewMessage)
      .subscribe();

    // Listen for read status updates (when we mark messages as seen)
    const roomReadStatusChannel = supabase
      .channel(`user_room_read_${user.id}`)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'room_message_read_status',
        filter: `user_id=eq.${user.id}`
      }, () => fetchInitialUnreadStatus())
      .subscribe();

    const projectReadStatusChannel = supabase
      .channel(`user_project_read_${user.id}`)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'project_message_read_status',
        filter: `user_id=eq.${user.id}`
      }, () => fetchInitialUnreadStatus())
      .subscribe();

    return () => {
      supabase.removeChannel(directMessagesChannel);
      supabase.removeChannel(roomMessagesChannel);
      supabase.removeChannel(projectMessagesChannel);
      supabase.removeChannel(roomReadStatusChannel);
      supabase.removeChannel(projectReadStatusChannel);
    };
  }, [user?.id, location.pathname, fetchInitialUnreadStatus]);

  useEffect(() => {
    // If user navigates to a chat-related page, clear the notification.
    if (location.pathname.startsWith('/messages') ||
      location.pathname.startsWith('/dm/') ||
      location.pathname.startsWith('/discussion-rooms') ||
      location.pathname.includes('/space')) {
      setHasUnread(false);
      setUnreadCount(0);
    }
  }, [location.pathname]);

  return { hasUnread, unreadCount, lastMessageToken };
};
