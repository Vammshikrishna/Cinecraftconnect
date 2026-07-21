import { mutationQueue } from './mutationQueue';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';

/**
 * Global Registry for all Offline Mutation execution logic.
 * The MutationFlusher will call these handlers when it processes the queue.
 */
export const registerAllMutationHandlers = () => {

  // ==========================================
  // SOCIAL INTERACTIONS
  // ==========================================
  mutationQueue.registerHandler('LIKE_POST', async (payload: { postId: string, userId: string }) => {
    const { error } = await supabase.from('post_likes').insert({
      post_id: payload.postId,
      user_id: payload.userId
    });
    if (error && error.code !== '23505') throw error; // Ignore unique constraint if already liked
  });

  mutationQueue.registerHandler('UNLIKE_POST', async (payload: { postId: string, userId: string }) => {
    const { error } = await supabase.from('post_likes')
      .delete()
      .eq('post_id', payload.postId)
      .eq('user_id', payload.userId);
    if (error) throw error;
  });

  mutationQueue.registerHandler('FOLLOW_USER', async (payload: { followerId: string, followingId: string }) => {
    const { error } = await supabase.from('user_connections').insert({
      follower_id: payload.followerId,
      following_id: payload.followingId,
      status: 'pending'
    });
    if (error && error.code !== '23505') throw error;
  });

  mutationQueue.registerHandler('CREATE_COMMENT', async (payload: { postId: string, userId: string, content: string, tempId: string, parentId?: string | null, mentions?: string[] }) => {
    const { data: commentData, error } = await supabase.from('post_comments' as any).insert({
      post_id: payload.postId,
      user_id: payload.userId,
      content: payload.content,
      parent_id: payload.parentId || null
    }).select().single();
    if (error) throw error;

    if (payload.mentions && payload.mentions.length > 0 && commentData) {
      const mentionsToInsert = payload.mentions.map(mentionedId => ({
        mentioner_id: payload.userId,
        mentioned_id: mentionedId,
        related_id: payload.postId,
        related_type: 'post'
      }));
      await supabase.from('mentions' as any).insert(mentionsToInsert as any);
    }
  });

  mutationQueue.registerHandler('DELETE_COMMENT', async (payload: { commentId: string }) => {
    const { error } = await supabase.from('post_comments' as any).delete().eq('id', payload.commentId);
    if (error) throw error;
  });

  // ==========================================
  // CHAT & MESSAGING
  // ==========================================
  mutationQueue.registerHandler('SEND_MESSAGE', async (payload: { conversationId: string, userId: string, content: string, replyToId?: string | null }) => {
    const { error } = await supabase.from('messages').insert({
      conversation_id: payload.conversationId,
      sender_id: payload.userId,
      content: payload.content,
      reply_to_id: payload.replyToId || null
    });
    if (error) throw error;
  });

  mutationQueue.registerHandler('DELETE_MESSAGE', async (payload: { messageId: string, userId: string }) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true, content: 'This message was deleted' })
      .eq('id', payload.messageId)
      .eq('sender_id', payload.userId);
    if (error) throw error;
  });

  mutationQueue.registerHandler('SEND_ROOM_MESSAGE', async (payload: { roomId: string, userId: string, content: string, replyToId?: string | null, mediaUrl?: string | null, mediaType?: string | null }) => {
    const { error } = await supabase.from('room_messages').insert({
      room_id: payload.roomId,
      user_id: payload.userId,
      content: payload.content,
      reply_to_id: payload.replyToId || null,
      media_url: payload.mediaUrl || null,
      media_type: payload.mediaType || null
    });
    if (error) throw error;
  });

  mutationQueue.registerHandler('DELETE_ROOM_MESSAGE', async (payload: { messageId: string, userId: string }) => {
    const { error } = await supabase
      .from('room_messages')
      .delete()
      .eq('id', payload.messageId); // Note: We might need to check if user has permission or rely on RLS
    if (error) throw error;
  });



  // ==========================================
  // POST CREATION
  // ==========================================
  mutationQueue.registerHandler('CREATE_POST', async (payload: { userId: string, content: string, tempId: string, mediaItems?: any[], tags?: string[], pageId?: string | null }) => {
    const { error } = await supabase.from('posts').insert({
      author_id: payload.userId,
      content: payload.content,
      page_id: payload.pageId || null,
      media_urls: payload.mediaItems ? payload.mediaItems.map((item: any) => item.url) : [],
      media_type: payload.mediaItems && payload.mediaItems.length > 0 ? payload.mediaItems[0].type : null,
      tags: payload.tags || []
    });
    if (error) throw error;
  });
  mutationQueue.registerHandler('MARK_NOTIFICATION_READ', async (payload: { notificationId: string }) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', payload.notificationId);
    if (error) throw error;
  });

  mutationQueue.registerHandler('MARK_ALL_NOTIFICATIONS_READ', async (payload: { userId: string }) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', payload.userId)
      .eq('is_read', false);
    if (error) throw error;
  });

  mutationQueue.registerHandler('DELETE_NOTIFICATION', async (payload: { notificationId: string }) => {
    const { error } = await supabase.from('notifications').delete().eq('id', payload.notificationId);
    if (error) throw error;
  });

  mutationQueue.registerHandler('RESOLVE_NOTIFICATION_ACTION', async (payload: { notificationId: string; type: string; relatedId: string; action: 'accept' | 'decline' }) => {
    const { type, relatedId, action } = payload;
    if (type === 'project_invite' || type === 'project_application') {
      const table = type === 'project_invite' ? 'project_space_join_requests' : 'project_applications';
      const status = action === 'accept' ? 'approved' : 'rejected';
      const { error } = await supabase.from(table as any).update({ status }).eq('id', relatedId);
      if (error) throw error;
    } else if (type === 'new_follower') {
      if (action === 'accept') {
          const { error } = await supabase.from('user_connections' as any).update({ status: 'accepted' }).eq('id', relatedId);
          if (error) throw error;
      } else {
          const { error } = await supabase.from('user_connections' as any).delete().eq('id', relatedId);
          if (error) throw error;
      }
    }
  });

  mutationQueue.registerHandler('UPDATE_JOB', async (payload: any) => {
    const { jobId, employerId, ...jobData } = payload;
    const { error } = await supabase.from('jobs').update(jobData).eq('id', jobId);
    if (error) throw error;
  });

  mutationQueue.registerHandler('CREATE_JOB', async (payload: any) => {
    const { tempId, employerId, ...jobData } = payload;
    const { error } = await supabase.from('jobs').insert({
      ...jobData,
      posted_by: employerId,
    });
    if (error) throw error;
  });

  mutationQueue.registerHandler('APPLY_JOB', async (payload: any) => {
    const { jobId, applicantId, ...applicationData } = payload;
    const { error } = await supabase.from('job_applications').insert({
      ...applicationData,
      job_id: jobId,
      applicant_id: applicantId
    });
    if (error) throw error;
  });

  mutationQueue.registerHandler('DELETE_VENDOR', async (payload: { vendorId: string; ownerId: string }) => {
    const { error } = await supabase.from('vendors').delete().eq('id', payload.vendorId);
    if (error) throw error;
  });

};
