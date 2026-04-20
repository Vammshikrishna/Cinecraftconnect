import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [hasUnread, setHasUnread] = useState(false); // Refers to DMs only for the chat icon
  const [hasUnreadDiscussions, setHasUnreadDiscussions] = useState(false);
  const [hasUnreadProjects, setHasUnreadProjects] = useState(false);
  const [unreadProjectIds, setUnreadProjectIds] = useState<string[]>([]);
  const [unreadDiscussionIds, setUnreadDiscussionIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0); // Refers to DMs only
  const [lastMessageToken, setLastMessageToken] = useState(0);

  const fetchInitialUnreadStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data: previews, error: previewError } = await supabase.rpc('get_unread_message_previews' as any);
      
      if (!previewError && Array.isArray(previews)) {
        // 1. DMs (Direct Messages)
        const dmPreviews = previews.filter((p: any) => (p.chat_type || p.type) === 'dm');
        const dmCount = dmPreviews.reduce((acc: number, p: any) => acc + (p.unread_count || 0), 0);
        setUnreadCount(dmCount);
        setHasUnread(dmCount > 0);

        // 2. Projects
        const projectIds = previews
          .filter((p: any) => (p.chat_type || p.type) === 'project' && p.unread_count > 0)
          .map((p: any) => p.context_id || p.c_id);
        setUnreadProjectIds(projectIds);
        setHasUnreadProjects(projectIds.length > 0);
          
        // 3. Discussions
        const discussionIds = previews
          .filter((p: any) => (p.chat_type || p.type) === 'discussion' && p.unread_count > 0)
          .map((p: any) => p.context_id || p.c_id);
        setUnreadDiscussionIds(discussionIds);
        setHasUnreadDiscussions(discussionIds.length > 0);
      }

      setLastMessageToken(prev => prev + 1);
    } catch (err) {
      console.error('An unexpected error occurred in useUnreadMessages:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchInitialUnreadStatus();
  }, [fetchInitialUnreadStatus]);

  useEffect(() => {
    if (!user) return;
    
    // Unique identifier for this hook instance's channels
    const hookId = Math.random().toString(36).substring(7);

    const handleNewMessage = (payload: any, type: 'dm' | 'discussion' | 'project') => {
      const senderId = payload.new.sender_id || payload.new.user_id;
      const contextId = payload.new.room_id || payload.new.project_space_id || payload.new.space_id || payload.new.sender_id;

      if (senderId !== user.id) {
        // Optimistically update UI instantly while we wait for RPC
        setLastMessageToken(prev => prev + 1);
        if (type === 'dm') {
          setUnreadCount(prev => prev + 1);
          setHasUnread(true);
        } else if (type === 'project') {
          setUnreadProjectIds(prev => Array.from(new Set([...prev, contextId])));
          setHasUnreadProjects(true);
        } else if (type === 'discussion') {
          setUnreadDiscussionIds(prev => Array.from(new Set([...prev, contextId])));
          setHasUnreadDiscussions(true);
        }

        // Force a re-fetch to ensure the database correctly calculates unread status
        fetchInitialUnreadStatus();
      }
    };

    const directMessagesChannel = supabase
      .channel(`user_dm_realtime_${user.id}_${hookId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (p) => handleNewMessage(p, 'dm'))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `receiver_id=eq.${user.id}`
      }, () => fetchInitialUnreadStatus()) // Catch updates/reads
      .subscribe();

    const roomMessagesChannel = supabase
      .channel(`user_room_realtime_${user.id}_${hookId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages' }, (p) => handleNewMessage(p, 'discussion'))
      .subscribe();

    const projectMessagesChannel = supabase
      .channel(`user_project_realtime_${user.id}_${hookId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_space_messages' }, (p) => handleNewMessage(p, 'project'))
      .subscribe();

    const roomReadStatusChannel = supabase
      .channel(`user_room_read_realtime_${user.id}_${hookId}`)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'room_message_read_status',
        filter: `user_id=eq.${user.id}`
      }, () => fetchInitialUnreadStatus())
      .subscribe();

    const projectReadStatusChannel = supabase
      .channel(`user_project_read_realtime_${user.id}_${hookId}`)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'project_space_message_read_status',
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
  }, [user?.id, fetchInitialUnreadStatus]);

  useEffect(() => {
    // Exact path-based clearing
    const discMatch = location.pathname.match(/\/discussion-rooms\/([a-zA-Z0-9-]+)/);
    const projMatch = location.pathname.match(/\/projects\/([a-zA-Z0-9-]+)\/space/);

    if (discMatch) {
      setUnreadDiscussionIds(prev => {
        const next = prev.filter(id => id !== discMatch[1]);
        if (next.length === 0) setHasUnreadDiscussions(false);
        return next;
      });
    }
    if (projMatch) {
      setUnreadProjectIds(prev => {
        const next = prev.filter(id => id !== projMatch[1]);
        if (next.length === 0) setHasUnreadProjects(false);
        return next;
      });
    }

    // Navbar total hasUnread clear logic for DM icon
    if (location.pathname.startsWith('/messages')) {
      setHasUnread(false);
      setUnreadCount(0);
    }
    if (location.pathname.startsWith('/dm/')) {
       // We'd ideally clear just that DM, but a full refresh is safer for now if unreadCount was purely based on RPC
       fetchInitialUnreadStatus();
    }
  }, [location.pathname, fetchInitialUnreadStatus]); // Removed unreadDiscussionIds/unreadProjectIds from dependencies to avoid loop

  return { 
    hasUnread, 
    hasUnreadDiscussions, 
    hasUnreadProjects, 
    unreadProjectIds,
    unreadDiscussionIds,
    unreadCount, 
    lastMessageToken 
  };
};
