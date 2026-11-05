import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { sharedFetch } from '@/lib/sharedFetch';

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
      // several parts of the page ask at the same moment: they share the request that is already running
      const { data: previews, error: previewError } = await sharedFetch(`unread_previews:${user.id}`, async () =>
        supabase.rpc('get_unread_message_previews'),
      );

      if (!previewError && Array.isArray(previews)) {
        // 1. DMs (Direct Messages)
        const dmPreviews = previews.filter((p: any) => (p.chat_type || p.type) === 'dm');
        let dmCount = dmPreviews.reduce((acc: number, p: any) => acc + (p.unread_count || 0), 0);
        // message requests (part GF): their unread messages are counted once, as "N requests", not as chat unreads.
        // Before that part is run the call fails and the number stays as it was.
        try {
          const { data: reqs, error: reqErr } = await sharedFetch(`message_requests:${user.id}`, async () =>
            (supabase as any).rpc('get_message_requests'),
          );
          if (!reqErr && Array.isArray(reqs)) {
            const pending = reqs.filter((r: any) => !r.hidden);
            const hiddenUnread = reqs.filter((r: any) => r.hidden).reduce((n: number, r: any) => n + (r.unread_count || 0), 0);
            const pendingUnread = pending.reduce((n: number, r: any) => n + (r.unread_count || 0), 0);
            dmCount = Math.max(0, dmCount - pendingUnread - hiddenUnread) + pending.length;
          }
        } catch { /* keep the plain count */ }
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

    const handleNotification = (payload: any) => {
      const notif = payload.new;
      if (!notif) return;

      const triggerUserId = notif.trigger_user_id;
      if (triggerUserId === user.id) return;

      setLastMessageToken(prev => prev + 1);

      const actionUrl = notif.action_url || '';
      if (actionUrl.startsWith('/messages')) {
        setUnreadCount(prev => prev + 1);
        setHasUnread(true);
      } else if (actionUrl.startsWith('/discussion-rooms')) {
        const roomId = actionUrl.split('/').pop();
        if (roomId) {
          setUnreadDiscussionIds(prev => Array.from(new Set([...prev, roomId])));
          setHasUnreadDiscussions(true);
        }
      } else if (actionUrl.includes('/space')) {
        const match = actionUrl.match(/\/projects\/([a-zA-Z0-9-]+)\/space/);
        const projectId = match ? match[1] : null;
        if (projectId) {
          setUnreadProjectIds(prev => Array.from(new Set([...prev, projectId])));
          setHasUnreadProjects(true);
        }
      }

      fetchInitialUnreadStatus();
    };

    const unreadChannel = supabase
      .channel(`user_unread_sync_${user.id}_${hookId}`)
      // 1. Listen for incoming direct messages (only for this user)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `receiver_id=eq.${user.id}`
      }, () => fetchInitialUnreadStatus())
      // 2. Listen for new notifications (room & project message triggers populate notifications for members)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, handleNotification)
      // 3. Listen for room read status updates (when messages are marked read on another tab/session)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'room_message_read_status',
        filter: `user_id=eq.${user.id}`
      }, () => fetchInitialUnreadStatus())
      // 4. Listen for project read status updates (when messages are marked read on another tab/session)
      .on('postgres_changes', {
        event: '*', 
        schema: 'public', 
        table: 'project_message_read_status',
        filter: `user_id=eq.${user.id}`
      }, () => fetchInitialUnreadStatus())
      .subscribe();

    return () => {
      supabase.removeChannel(unreadChannel);
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
