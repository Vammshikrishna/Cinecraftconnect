/**
 * Global Active Screen Tracker
 * Tracks which chat/project/discussion room the user is actively viewing
 * to suppress heads-up notifications for messages on that same screen.
 */

export interface ActiveChatContext {
  screen: 'DiscussionRoomDetail' | 'ProjectSpace' | 'Conversation' | null;
  roomId?: string | null;
  projectId?: string | null;
  spaceId?: string | null;
  partnerId?: string | null;
  conversationId?: string | null;
  timestamp: number;
}

let activeChat: ActiveChatContext = {
  screen: null,
  timestamp: 0,
};

export const setActiveChatContext = (ctx: Partial<ActiveChatContext>) => {
  activeChat = {
    screen: ctx.screen || null,
    roomId: ctx.roomId ? String(ctx.roomId) : null,
    projectId: ctx.projectId ? String(ctx.projectId) : null,
    spaceId: ctx.spaceId ? String(ctx.spaceId) : null,
    partnerId: ctx.partnerId ? String(ctx.partnerId) : null,
    conversationId: ctx.conversationId ? String(ctx.conversationId) : null,
    timestamp: Date.now(),
  };
  console.log('[ActiveScreenTracker] Set active chat context:', activeChat);
};

export const clearActiveChatContext = () => {
  activeChat = {
    screen: null,
    timestamp: Date.now(),
  };
};

export const getActiveChatContext = (): ActiveChatContext => {
  return activeChat;
};

/**
 * Checks if the user is currently viewing the chat/screen that an incoming notification belongs to
 */
export const isUserInActiveChat = (data: any, navigationRef?: any): boolean => {
  if (!data) return false;

  const ctx = getActiveChatContext();

  let currentRouteName: string | null = null;
  let currentParams: any = null;
  try {
    if (navigationRef && typeof navigationRef.getCurrentRoute === 'function') {
      const route = navigationRef.getCurrentRoute();
      if (route) {
        currentRouteName = route.name;
        currentParams = route.params;
      }
    }
  } catch {}

  // If currentRouteName exists and is not one of the chat screens, user is on another screen (e.g. Feed, Profile)
  const activeScreen = currentRouteName || ctx.screen;
  if (!activeScreen) return false;

  const rawActionUrl = typeof data.actionUrl === 'string' ? data.actionUrl : (typeof data.action_url === 'string' ? data.action_url : (typeof data.url === 'string' ? data.url : ''));
  const type = String(data.type || data.related_type || '').toLowerCase();

  // 1. Discussion Room matching
  if (activeScreen === 'DiscussionRoomDetail') {
    const activeRoomIds = [
      ctx.roomId,
      currentParams?.roomId,
      currentParams?.room_id,
      currentParams?.relatedId,
      currentParams?.id,
    ].filter(Boolean).map((id) => String(id).toLowerCase());

    const incomingRoomIds = [
      data.roomId,
      data.room_id,
      data.conversationId,
      data.relatedId,
      data.related_id,
      data.channelId,
      rawActionUrl.includes('/discussion-rooms/') ? rawActionUrl.split('/discussion-rooms/')[1]?.split('?')[0]?.split('/')[0] : null,
      rawActionUrl.includes('/discussions/') ? rawActionUrl.split('/discussions/')[1]?.split('?')[0]?.split('/')[0] : null,
    ].filter(Boolean).map((id) => String(id).toLowerCase());

    for (const aId of activeRoomIds) {
      for (const inId of incomingRoomIds) {
        if (aId === inId) return true;
      }
    }
  }

  // 2. Project Space matching
  if (activeScreen === 'ProjectSpace') {
    const activeSpaceIds = [
      ctx.spaceId,
      ctx.projectId,
      currentParams?.spaceId,
      currentParams?.space_id,
      currentParams?.project_space_id,
      currentParams?.projectId,
      currentParams?.project_id,
      currentParams?.relatedId,
      currentParams?.id,
    ].filter(Boolean).map((id) => String(id).toLowerCase());

    const incomingSpaceIds = [
      data.spaceId,
      data.space_id,
      data.project_space_id,
      data.projectId,
      data.project_id,
      data.conversationId,
      rawActionUrl.includes('/projects/') ? rawActionUrl.split('/projects/')[1]?.split('/')[0] : null,
      rawActionUrl.includes('/project-space/') ? rawActionUrl.split('/project-space/')[1]?.split('?')[0] : null,
    ].filter(Boolean).map((id) => String(id).toLowerCase());

    for (const aId of activeSpaceIds) {
      for (const inId of incomingSpaceIds) {
        if (aId === inId) return true;
      }
    }
  }

  // 3. Conversation / DM matching
  if (activeScreen === 'Conversation') {
    const activeIds = [
      ctx.partnerId,
      ctx.conversationId,
      currentParams?.partnerId,
      currentParams?.partner_id,
      currentParams?.senderId,
      currentParams?.conversationId,
      currentParams?.channelId,
      currentParams?.id,
    ].filter(Boolean).map((id) => String(id).toLowerCase());

    const incomingIds = [
      data.senderId,
      data.sender_id,
      data.partnerId,
      data.partner_id,
      data.trigger_user_id,
      data.conversationId,
      data.channelId,
      data.channel_id,
      rawActionUrl && rawActionUrl.includes('/messages/') ? rawActionUrl.split('/messages/')[1]?.split('?')[0]?.split('/')[0] : null,
    ].filter(Boolean).map((id) => String(id).toLowerCase());

    for (const aId of activeIds) {
      for (const inId of incomingIds) {
        if (aId === inId) return true;
        // Direct room ID contains sender or partner user ID
        if (aId.length >= 18 && inId.length >= 18 && (aId.includes(inId) || inId.includes(aId))) return true;
      }
    }
  }

  return false;
};
