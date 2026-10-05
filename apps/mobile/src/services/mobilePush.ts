import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, AppState, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from '@cinecraft/notifications';
import { isUserInActiveChat } from './activeScreenTracker';

/**
 * Safely obtain the Firebase messaging instance to prevent native crashes on unconfigured environments
 */
const getMessagingSafe = () => {
  try {
    return messaging();
  } catch (err) {
    console.warn('[Push] Firebase messaging is not initialized or supported in this environment:', err);
    return null;
  }
};

const NOTIF_SETTINGS_PROMPTED_KEY = '@cc_notif_settings_prompted';

// The Android 13+ runtime prompt is silently skipped if it is requested before the Activity is resumed (which
// is exactly when this runs on a cold start / right after sign-in). Wait until the app is really in the foreground.
const waitUntilForeground = async (): Promise<void> => {
  if (AppState.currentState !== 'active') {
    await new Promise<void>((resolve) => {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          sub.remove();
          resolve();
        }
      });
    });
  }
  await new Promise((r) => setTimeout(r, 800));
};

// Several auth events fire registerForPushNotifications at once; Android rejects overlapping permission requests.
let permissionRequestInFlight: Promise<boolean> | null = null;
export const requestUserPermission = (): Promise<boolean> => {
  if (!permissionRequestInFlight) {
    permissionRequestInFlight = requestUserPermissionImpl().finally(() => {
      permissionRequestInFlight = null;
    });
  }
  return permissionRequestInFlight;
};

const requestUserPermissionImpl = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      if ((Platform.Version as number) >= 33) {
        const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
        if (await PermissionsAndroid.check(perm)) return true;

        await waitUntilForeground();
        const result = await PermissionsAndroid.request(perm, {
          title: 'Allow notifications',
          message: 'CineCraft Connect needs notification access to alert you about messages, calls and project updates.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not now',
        });
        if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

        // "Don't ask again" (or denied twice): Android will not show the prompt any more, so point to Settings once.
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          const alreadyPrompted = await AsyncStorage.getItem(NOTIF_SETTINGS_PROMPTED_KEY).catch(() => null);
          if (!alreadyPrompted) {
            AsyncStorage.setItem(NOTIF_SETTINGS_PROMPTED_KEY, '1').catch(() => { });
            Alert.alert(
              'Notifications are turned off',
              'Turn on notifications for CineCraft Connect in Settings to get messages and call alerts.',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => { }) },
              ]
            );
          }
        }
        return false;
      }
      return true;
    }

    const fcm = getMessagingSafe();
    if (!fcm) return false;

    const authStatus = await fcm.requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    return enabled;
  } catch (err) {
    console.warn('[Push] Permission request failed:', err);
    return false;
  }
};

export const registerForPushNotifications = async (userId: string): Promise<string | null> => {
  try {
    const fcm = getMessagingSafe();
    if (!fcm) {
      console.warn('[Push] Firebase messaging is unavailable. Skipping token registration.');
      return null;
    }

    const hasPermission = await requestUserPermission();
    if (!hasPermission) {
      console.warn('[Push] Notification permission denied by user');
      return null;
    }

    // Ensure APNs / FCM token is registered
    const token = await fcm.getToken();
    console.log('[FCM] Token obtained successfully:', token);

    await NotificationService.registerPushToken({
      userId,
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });

    // Listen for FCM token refresh
    fcm.onTokenRefresh(async (newToken) => {
      console.log('[FCM] Token refreshed:', newToken);
      try {
        await NotificationService.registerPushToken({
          userId,
          token: newToken,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
      } catch (err) {
        console.warn('[Push] Token refresh update failed:', err);
      }
    });

    return token;
  } catch (error) {
    console.warn('[FCM] Failed to register push token:', error);
    return null;
  }
};

let pendingNotificationData: any = null;

export const setPendingNotificationData = (data: any) => {
  pendingNotificationData = data;
};

export const getPendingNotificationData = () => {
  return pendingNotificationData;
};

export const clearPendingNotificationData = () => {
  pendingNotificationData = null;
};

export const flushPendingNotification = (navigationRef?: any) => {
  if (!pendingNotificationData) return false;
  const isNavReady = navigationRef && typeof navigationRef.isReady === 'function' && navigationRef.isReady();
  if (!isNavReady) return false;

  console.log('[Push Navigation] Flushing queued pending notification data:', pendingNotificationData);
  const dataToProcess = pendingNotificationData;
  pendingNotificationData = null;
  return handleNotificationNavigation(dataToProcess, navigationRef);
};

export const resolveNotificationDeepLink = (data: any): string | null => {
  if (!data) return null;

  const actionUrl = typeof data.actionUrl === 'string' ? data.actionUrl : (typeof data.action_url === 'string' ? data.action_url : (typeof data.url === 'string' ? data.url : ''));
  const type = String(data.type || data.related_type || '').toLowerCase();
  const screen = data.screen;

  // 1. Project Space
  const isProjectSpace =
    screen === 'ProjectSpace' ||
    type === 'project' ||
    type === 'project_space' ||
    type === 'project_space_message' ||
    Boolean(data.spaceId || data.space_id || data.project_space_id) ||
    (Boolean(actionUrl) && ((actionUrl.includes('/projects/') && actionUrl.includes('/space')) || actionUrl.includes('/project-space/')));

  if (isProjectSpace) {
    const rawProjectId =
      data.projectId ||
      data.project_id ||
      data.relatedId ||
      data.related_id ||
      (actionUrl && actionUrl.includes('/projects/') ? actionUrl.split('/projects/')[1]?.split('/')[0] : null);

    const rawSpaceId =
      data.spaceId ||
      data.space_id ||
      data.project_space_id ||
      data.conversationId ||
      (actionUrl && actionUrl.includes('/project-space/') ? actionUrl.split('/project-space/')[1]?.split('?')[0] : null);

    const targetId = rawProjectId || rawSpaceId;
    if (targetId) {
      return `cinecraftconnect://projects/${targetId}`;
    }
  }

  // 2. Discussion Room
  const isDiscussionRoom =
    screen === 'DiscussionRoomDetail' ||
    type === 'room' ||
    type === 'discussion_room' ||
    type === 'room_message' ||
    Boolean(data.roomId || data.room_id) ||
    (Boolean(actionUrl) && (actionUrl.includes('/discussions/') || actionUrl.includes('/discussion-rooms/')));

  if (isDiscussionRoom) {
    const targetRoomId =
      data.roomId ||
      data.room_id ||
      data.relatedId ||
      data.related_id ||
      (type === 'room' || type === 'discussion_room' ? data.conversationId : null) ||
      (actionUrl && actionUrl.includes('/discussion-rooms/') ? actionUrl.split('/discussion-rooms/')[1]?.split('?')[0]?.split('/')[0] : null) ||
      (actionUrl && actionUrl.includes('/discussions/') ? actionUrl.split('/discussions/')[1]?.split('?')[0]?.split('/')[0] : null);

    if (targetRoomId) {
      return `cinecraftconnect://discussions/${targetRoomId}`;
    }
  }

  // 3. Direct Message
  const isDm =
    screen === 'Conversation' ||
    type === 'dm' ||
    type === 'direct_message' ||
    type === 'conversation' ||
    (type === 'new_message' && !isProjectSpace && !isDiscussionRoom) ||
    Boolean(data.partnerId || data.partner_id || data.senderId || data.sender_id) ||
    (Boolean(actionUrl) && actionUrl.includes('/messages/'));

  if (isDm) {
    const targetPartnerId =
      data.partnerId ||
      data.partner_id ||
      data.senderId ||
      data.sender_id ||
      data.trigger_user_id ||
      data.conversationId ||
      (actionUrl && actionUrl.includes('/messages/') ? actionUrl.split('/messages/')[1]?.split('?')[0]?.split('/')[0] : null);

    if (targetPartnerId) {
      return `cinecraftconnect://messages/${targetPartnerId}`;
    }
  }

  // 4. Action URL fallback
  if (actionUrl) {
    if (actionUrl.startsWith('cinecraftconnect://')) return actionUrl;
    if (actionUrl.startsWith('/')) return `cinecraftconnect:/${actionUrl}`;
  }

  return 'cinecraftconnect://notifications';
};

export const handleNotificationNavigation = (data: any, navigationRef?: any) => {
  if (!data) return false;

  const isNavReady = navigationRef && typeof navigationRef.isReady === 'function' && navigationRef.isReady();
  if (!isNavReady) {
    console.log('[Push Navigation] Navigation container is not ready yet. Queuing notification for deferred flush:', data);
    pendingNotificationData = data;
    return false;
  }

  console.log('[Push Navigation] Processing notification navigation:', data);

  const actionUrl = typeof data.actionUrl === 'string' ? data.actionUrl : (typeof data.action_url === 'string' ? data.action_url : (typeof data.url === 'string' ? data.url : ''));
  const type = String(data.type || data.related_type || '').toLowerCase();
  const screen = data.screen;

  // 1. Call Notifications
  const isCall =
    type === 'incoming_call' ||
    type === 'call_started' ||
    type === 'call_invite' ||
    Boolean(data.callId) ||
    data.autoJoinCall === 'true' ||
    actionUrl.includes('autoJoin=true');

  if (isCall) {
    const roomId = data.roomId || data.room_id || data.conversationId || data.spaceId || data.channelId;
    if (roomId && navigationRef.navigate) {
      navigationRef.navigate('Call', {
        roomId,
        roomName: data.roomName || data.roomTitle || data.senderName || 'Live Call',
        roomType: data.spaceId || type.includes('project') ? 'project' : (data.roomId || type.includes('room') ? 'room' : 'direct'),
        isVideo: /video/i.test(String(data.title || data.body || data.message || '')),
      });
      return;
    }
  }

  // 1b. Jobs and marketplace notifications carry an in-app path (e.g. /jobs/applications, /marketplace/bookings)
  if (actionUrl.startsWith('/') && navigationRef.navigate) {
    const segs = actionUrl.split('?')[0].split('/').filter(Boolean);
    const isId = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);
    const jobId = segs[0] === 'jobs' && isId(segs[1]) ? segs[1] : undefined;
    const listingId = segs[0] === 'marketplace' && isId(segs[1]) ? segs[1] : undefined;
    const vendorId = segs[0] === 'vendors' && isId(segs[1]) ? segs[1] : undefined;
    if (segs[0] === 'profile' && !segs[1]) {
      const tabQ = (actionUrl.split('?')[1] || '').match(/tab=([a-z]+)/)?.[1] || 'credits';
      navigationRef.navigate('Profile', { tab: tabQ });
      return;
    }
    if (segs[0] === 'settings' && segs[1] === 'help') {
      navigationRef.navigate('Support', { ticketId: segs[2] === 'requests' && isId(segs[3]) ? segs[3] : undefined });
      return;
    }
    if (segs[0] === 'network') {
      navigationRef.navigate('Network');
      return;
    }
    if (segs[0] === 'lists' && isId(segs[1])) {
      navigationRef.navigate('FilmList', { listId: segs[1] });
      return;
    }
    if (segs[0] === 'content' && isId(segs[2])) {
      navigationRef.navigate('ContentDetail', { contentId: segs[2], mediaType: segs[1] === 'tv' ? 'tv' : 'movie' });
      return;
    }
    if (segs[0] === 'announcements') {
      navigationRef.navigate('Announcements');
      return;
    }
    // company page: invitations, posts, role changes (/pages/<slug>)
    if (segs[0] === 'pages' && segs[1]) {
      navigationRef.navigate('CompanyPageDetail', isId(segs[1]) ? { pageId: segs[1] } : { pageSlug: segs[1] });
      return;
    }
    if (actionUrl === '/jobs/applications') { navigationRef.navigate('MyApplications'); return; }
    if (actionUrl === '/jobs/manage') { navigationRef.navigate('ManagePostings'); return; }
    if (jobId) { navigationRef.navigate('JobDetail', { jobId }); return; }
    if (actionUrl === '/marketplace/bookings') { navigationRef.navigate('MyBookings'); return; }
    if (actionUrl === '/marketplace/quotes') { navigationRef.navigate('MyQuotes'); return; }
    if (actionUrl === '/marketplace/hub') { navigationRef.navigate('SellerHub'); return; }
    if (listingId) { navigationRef.navigate('MarketplaceDetail', { listingId }); return; }
    if (vendorId) { navigationRef.navigate('VendorDetail', { vendorId }); return; }
  }

  // 2. Project Space Notifications
  const isProjectSpace =
    type === 'project' ||
    type === 'project_space' ||
    type === 'project_space_message' ||
    Boolean(data.spaceId || data.space_id || data.project_space_id) ||
    (Boolean(actionUrl) && (actionUrl.includes('/projects/') && actionUrl.includes('/space') || actionUrl.includes('/project-space/')));

  if (isProjectSpace) {
    const rawProjectId =
      data.projectId ||
      data.project_id ||
      data.relatedId ||
      data.related_id ||
      (actionUrl && actionUrl.includes('/projects/') ? actionUrl.split('/projects/')[1]?.split('/')[0] : null);

    const rawSpaceId =
      data.spaceId ||
      data.space_id ||
      data.project_space_id ||
      data.conversationId ||
      (actionUrl && actionUrl.includes('/project-space/') ? actionUrl.split('/project-space/')[1]?.split('?')[0] : null);

    const targetProjectId = rawProjectId || rawSpaceId;
    const targetSpaceId = rawSpaceId || rawProjectId;
    const projectTitle = data.roomTitle || data.title || data.senderName || 'Project Space';

    if (targetProjectId && navigationRef.navigate) {
      if (navigationRef.reset && (!navigationRef.canGoBack || !navigationRef.canGoBack())) {
        navigationRef.reset({
          index: 1,
          routes: [
            { name: 'MainTabs', state: { routes: [{ name: 'Projects' }], index: 0 } },
            {
              name: 'ProjectSpace',
              params: {
                projectId: targetProjectId,
                spaceId: targetSpaceId,
                projectTitle,
              },
            },
          ],
        });
        return;
      }
      navigationRef.navigate('ProjectSpace', {
        projectId: targetProjectId,
        spaceId: targetSpaceId,
        projectTitle,
      });
      return;
    }
  }

  // 3. Discussion Room Notifications
  const isDiscussionRoom =
    type === 'room' ||
    type === 'discussion_room' ||
    type === 'room_message' ||
    Boolean(data.roomId || data.room_id) ||
    (Boolean(actionUrl) && (actionUrl.includes('/discussions/') || actionUrl.includes('/discussion-rooms/')));

  if (isDiscussionRoom) {
    const targetRoomId =
      data.roomId ||
      data.room_id ||
      data.relatedId ||
      data.related_id ||
      (type === 'room' || type === 'discussion_room' ? data.conversationId : null) ||
      (actionUrl && actionUrl.includes('/discussion-rooms/') ? actionUrl.split('/discussion-rooms/')[1]?.split('?')[0]?.split('/')[0] : null) ||
      (actionUrl && actionUrl.includes('/discussions/') ? actionUrl.split('/discussions/')[1]?.split('?')[0]?.split('/')[0] : null);

    const roomTitle = data.roomTitle || data.room_title || data.title || 'Discussion Room';

    if (targetRoomId && navigationRef.navigate) {
      if (navigationRef.reset && (!navigationRef.canGoBack || !navigationRef.canGoBack())) {
        navigationRef.reset({
          index: 1,
          routes: [
            { name: 'MainTabs', state: { routes: [{ name: 'Discussions' }], index: 0 } },
            {
              name: 'DiscussionRoomDetail',
              params: {
                roomId: targetRoomId,
                roomTitle,
              },
            },
          ],
        });
        return;
      }
      navigationRef.navigate('DiscussionRoomDetail', {
        roomId: targetRoomId,
        roomTitle,
      });
      return;
    }
  }

  // 4. Direct Message / Conversation Notifications
  const isDm =
    type === 'dm' ||
    type === 'direct_message' ||
    type === 'conversation' ||
    (type === 'new_message' && !isProjectSpace && !isDiscussionRoom) ||
    Boolean(data.partnerId || data.partner_id || data.senderId || data.sender_id) ||
    (Boolean(actionUrl) && actionUrl.includes('/messages/'));

  if (isDm) {
    const targetPartnerId =
      data.partnerId ||
      data.partner_id ||
      data.senderId ||
      data.sender_id ||
      data.trigger_user_id ||
      (actionUrl && actionUrl.includes('/messages/') ? actionUrl.split('/messages/')[1]?.split('?')[0]?.split('/')[0] : null);

    const targetConvId = data.conversationId || data.channelId || data.channel_id || targetPartnerId;
    const partnerName = data.senderName || data.sender_name || data.title || 'Crew Member';
    const partnerAvatar = data.avatarUrl || data.avatar_url || null;

    if ((targetConvId || targetPartnerId) && navigationRef.navigate) {
      if (navigationRef.reset && (!navigationRef.canGoBack || !navigationRef.canGoBack())) {
        navigationRef.reset({
          index: 1,
          routes: [
            { name: 'MainTabs', state: { routes: [{ name: 'Messages' }], index: 0 } },
            {
              name: 'Conversation',
              params: {
                conversationId: targetConvId,
                partnerId: targetPartnerId,
                partnerName,
                partnerAvatar,
              },
            },
          ],
        });
        return;
      }
      navigationRef.navigate('Conversation', {
        conversationId: targetConvId,
        partnerId: targetPartnerId,
        partnerName,
        partnerAvatar,
      });
      return;
    }
  }

  // 5. Explicit Screen parameter fallback
  if (screen && navigationRef.navigate) {
    if (screen === 'ProjectSpace' || screen === 'DiscussionRoomDetail' || screen === 'Conversation') {
      if (screen === 'ProjectSpace') {
        navigationRef.navigate('ProjectSpace', {
          projectId: data.projectId || data.targetId || data.partnerId,
          spaceId: data.spaceId || data.targetId,
          projectTitle: data.title || data.partnerName || 'Project Space',
        });
        return;
      }
      if (screen === 'DiscussionRoomDetail') {
        navigationRef.navigate('DiscussionRoomDetail', {
          roomId: data.roomId || data.targetId || data.partnerId,
          roomTitle: data.title || data.partnerName || 'Discussion Room',
        });
        return;
      }
      if (screen === 'Conversation') {
        navigationRef.navigate('Conversation', {
          conversationId: data.conversationId || data.targetId || data.partnerId,
          partnerId: data.partnerId || data.senderId || data.targetId,
          partnerName: data.partnerName || data.senderName || 'Crew Member',
          partnerAvatar: data.avatarUrl,
        });
        return;
      }
    }
    navigationRef.navigate(screen, data);
    return;
  }

  // 6. Action URL deep linking fallbacks
  if (actionUrl) {
    if (actionUrl.includes('/pitch/')) {
      const pitchId = data.relatedId || data.related_id || actionUrl.split('/pitch/')[1]?.split('?')[0];
      if (pitchId) {
        navigationRef.navigate('PitchDetail', { pitchId });
        return;
      }
    }
    if (actionUrl.includes('/jobs/')) {
      const jobId = data.relatedId || data.related_id || actionUrl.split('/jobs/')[1]?.split('?')[0];
      if (jobId) {
        navigationRef.navigate('JobDetail', { jobId });
        return;
      }
    }
    if (actionUrl.includes('/profile/') || type === 'new_follower' || type === 'follow') {
      const userId = data.userId || data.user_id || data.trigger_user_id || actionUrl.split('/profile/')[1]?.split('?')[0];
      if (userId) {
        navigationRef.navigate('PublicProfile', { userId });
        return;
      }
    }
    if (actionUrl.includes('/projects/')) {
      const projectId = data.relatedId || data.related_id || actionUrl.split('/projects/')[1]?.split('/')[0];
      if (projectId) {
        navigationRef.navigate('ProjectDetail', { projectId });
        return;
      }
    }
    if (actionUrl.includes('/post/')) {
      const postId = data.relatedId || data.related_id || actionUrl.split('/post/')[1]?.split('?')[0];
      if (postId) {
        navigationRef.navigate('PostDetail', { postId });
        return;
      }
    }
  }

  // Default fallback
  if (navigationRef.navigate) {
    navigationRef.navigate('Notifications');
  }
};

/**
 * Setup foreground and notification tap listeners
 */
export const setupFCMListeners = (navigationRef?: any) => {
  const fcm = getMessagingSafe();
  if (!fcm) {
    console.warn('[FCM] Firebase messaging is unavailable. Foreground listeners skipped.');
    return () => {};
  }

  try {
    // 1. Foreground Message Handler (Displays heads-up notification while app is open)
    const unsubscribeOnMessage = fcm.onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[FCM] Foreground notification received:', remoteMessage);

      try {
        const data = remoteMessage.data || {};
        const title = remoteMessage.notification?.title || data.title || data.senderName || 'CineCraft Connect';
        let body = remoteMessage.notification?.body || data.body || 'You have a new message.';

        const rawCipher = data.encryptedContent || data.body;
        const isEncrypted =
          data.isEncrypted === 'true' ||
          (typeof rawCipher === 'string' && (rawCipher.includes('__e2ee') || rawCipher.startsWith('{')));

        if (isEncrypted && data.targetUserId) {
          try {
            const { decryptAnyMessagePayload } = require('./decryptMessageHelper');
            const decrypted = await decryptAnyMessagePayload(rawCipher, data.targetUserId, data.conversationId);
            if (decrypted && !decrypted.includes('__e2ee') && !decrypted.startsWith('{')) {
              body = decrypted;
            }
          } catch (decErr) {
            console.warn('[FCM Foreground] Failed to decrypt message:', decErr);
          }
        }

        const rawActionUrl = typeof data.actionUrl === 'string' ? data.actionUrl : (typeof data.action_url === 'string' ? data.action_url : '');
        const targetRoomId = (typeof data.roomId === 'string' ? data.roomId : '') || (typeof data.room_id === 'string' ? data.room_id : '') || (rawActionUrl.includes('/discussion-rooms/') ? rawActionUrl.split('/discussion-rooms/')[1]?.split('?')[0] : null);
        const isProjectMsg = data.type === 'project' || data.type === 'project_space' || data.type === 'project_space_message' || data.related_type === 'project_space_message' || (Boolean(rawActionUrl) && (rawActionUrl.includes('/projects/') || rawActionUrl.includes('/project-space/')));
        const targetSpaceId = (typeof data.spaceId === 'string' ? data.spaceId : '') ||
          (typeof data.space_id === 'string' ? data.space_id : '') ||
          (typeof data.project_space_id === 'string' ? data.project_space_id : '') ||
          (isProjectMsg && typeof data.conversationId === 'string' && data.conversationId.length === 36 ? data.conversationId : '') ||
          (rawActionUrl && rawActionUrl.includes('/project-space/') ? rawActionUrl.split('/project-space/')[1]?.split('?')[0] : '') ||
          (rawActionUrl && rawActionUrl.includes('/projects/') && rawActionUrl.includes('/space') ? rawActionUrl.split('/projects/')[1]?.split('/')[0] : '') ||
          null;
        const targetConversationId = (typeof data.conversationId === 'string' ? data.conversationId : '') || (typeof data.channelId === 'string' ? data.channelId : '') || (typeof data.senderId === 'string' ? data.senderId : '') || null;

        // Check user settings before displaying heads-up notification
        try {
          const keys = await AsyncStorage.getAllKeys();
          const settingKey = keys.find((k) => k.startsWith('@cinecraft_user_settings_'));
          if (settingKey) {
            const raw = await AsyncStorage.getItem(settingKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.push_notifications === false) return;
              if (parsed.message_notifications === false && (data.type === 'dm' || data.type === 'room' || data.conversationId || data.channelId || targetRoomId)) return;
              if (parsed.comment_notifications === false && (data.type === 'comment' || data.type === 'like' || data.type === 'social')) return;
              if (parsed.job_alerts === false && (data.type === 'job_application' || data.type === 'job_match' || data.type === 'pitch' || data.type === 'pitch_status_interested' || data.type === 'pitch_status_shortlisted')) return;
              if (parsed.project_notifications === false && (data.type === 'project' || data.type === 'project_invite' || data.type === 'project_update')) return;
              if (parsed.dnd_enabled) {
                const now = new Date();
                const curM = now.getHours() * 60 + now.getMinutes();
                const [sh, sm] = (parsed.dnd_start_time || '22:00').split(':').map(Number);
                const [eh, em] = (parsed.dnd_end_time || '08:00').split(':').map(Number);
                const sM = sh * 60 + sm;
                const eM = eh * 60 + em;
                const inQuiet = sM <= eM ? (curM >= sM && curM <= eM) : (curM >= sM || curM <= eM);
                if (inQuiet) return;
              }
            }
          }
        } catch {}

        // Helper: resolve current user's username and full_name for mentions-only checks
        let myUsername = '';
        let myFullName = '';
        try {
          const profileRaw = await AsyncStorage.getItem('@cinecraft_cache_user_profile_data');
          if (profileRaw) {
            const profileParsed = JSON.parse(profileRaw);
            const prof = profileParsed?.data?.profile || profileParsed?.profile || profileParsed;
            if (prof?.username) myUsername = String(prof.username).toLowerCase();
            if (prof?.full_name) myFullName = String(prof.full_name).toLowerCase();
          }
        } catch {}

        // Check per-room mute and mentions if room message
        if (targetRoomId) {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const roomKeys = keys.filter((k) => k.startsWith(`@room_notif_${targetRoomId}`));
            for (const rk of roomKeys) {
              const raw = await AsyncStorage.getItem(rk);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.muteRoom) {
                  console.log(`[FCM Foreground] Suppressed push notification because room ${targetRoomId} is muted.`);
                  return;
                }
                if (parsed.mentionsOnly) {
                  const msgText = String(body || '').toLowerCase();
                  const isMentioned =
                    msgText.includes('@all') ||
                    msgText.includes('@everyone') ||
                    (myUsername && msgText.includes(`@${myUsername}`)) ||
                    (myFullName && msgText.includes(`@${myFullName}`));
                  if (!isMentioned) {
                    console.log(`[FCM Foreground] Suppressed push notification because room ${targetRoomId} is mentions-only.`);
                    return;
                  }
                }
              }
            }
          } catch {}
        }

        // Check per-project-space mute and mentions
        if (targetSpaceId) {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const spaceKeys = keys.filter((k) => k.startsWith(`@space_notif_${targetSpaceId}`));
            for (const sk of spaceKeys) {
              const raw = await AsyncStorage.getItem(sk);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.muteSpace) {
                  console.log(`[FCM Foreground] Suppressed push notification because project space ${targetSpaceId} is muted.`);
                  return;
                }
                if (parsed.mentionsOnly) {
                  const msgText = String(body || '').toLowerCase();
                  const isMentioned =
                    msgText.includes('@all') ||
                    msgText.includes('@everyone') ||
                    (myUsername && msgText.includes(`@${myUsername}`)) ||
                    (myFullName && msgText.includes(`@${myFullName}`));
                  if (!isMentioned) {
                    console.log(`[FCM Foreground] Suppressed push notification because project space ${targetSpaceId} is mentions-only.`);
                    return;
                  }
                }
              }
            }
          } catch {}
        }

        // Check per-DM conversation mute
        const isDm =
          data.type === 'dm' ||
          data.type === 'new_message' ||
          data.type === 'conversation' ||
          data.related_type === 'direct_message' ||
          (rawActionUrl && rawActionUrl.includes('/messages/'));

        const dmCandidates = [
          data.conversationId,
          data.channelId,
          data.channel_id,
          data.senderId,
          data.sender_id,
          data.partnerId,
          data.partner_id,
          data.trigger_user_id,
          rawActionUrl && rawActionUrl.includes('/messages/') ? rawActionUrl.split('/messages/')[1]?.split('?')[0] : null,
        ].filter(Boolean);

        if (isDm && dmCandidates.length > 0) {
          try {
            const keys = await AsyncStorage.getAllKeys();
            for (const cand of dmCandidates) {
              const matchingKeys = keys.filter((k) => k.startsWith(`@dm_notif_${cand}`));
              for (const dk of matchingKeys) {
                const raw = await AsyncStorage.getItem(dk);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed.muteConversation) {
                    console.log(`[FCM Foreground] Suppressed push notification because DM conversation ${cand} is muted.`);
                    return;
                  }
                }
              }
            }
          } catch {}
        }

        // Suppress notification if user is currently active on this chat screen
        if (isUserInActiveChat(data, navigationRef)) {
          console.log('[FCM Foreground] Suppressing heads-up notification because user is already active in this screen:', {
            targetRoomId,
            targetSpaceId,
            targetConversationId,
          });
          return;
        }

        const { NativeModules } = require('react-native');
        if (NativeModules.NotificationBridge?.displayNotification) {
          const targetScreen = targetSpaceId ? 'ProjectSpace' : (targetRoomId ? 'DiscussionRoomDetail' : 'Conversation');
          const targetId = targetSpaceId
            ? (targetSpaceId || data.projectId || data.project_id)
            : (targetRoomId ? targetRoomId : (data.partnerId || data.partner_id || data.senderId || data.sender_id || data.conversationId));
          const conversationKey = `${targetScreen}_${targetId || data.id || 'general'}`;
          const avatarUrl = data.avatarUrl || data.avatar_url || data.senderAvatar || data.sender_avatar || null;

          let myAvatarUrl: string | null = null;
          try {
            const direct = await AsyncStorage.getItem('@cinecraft_current_user_avatar');
            if (direct && direct.trim()) {
              myAvatarUrl = direct.trim();
            } else {
              const profileRaw = await AsyncStorage.getItem('@cinecraft_cache_user_profile_data');
              if (profileRaw) {
                const parsed = JSON.parse(profileRaw);
                const prof = parsed?.data?.profile || parsed?.profile || parsed;
                if (prof?.avatar_url && String(prof.avatar_url).trim()) {
                  myAvatarUrl = String(prof.avatar_url).trim();
                }
              }
            }
          } catch {}

          if (myAvatarUrl && NativeModules.NotificationBridge?.setCurrentUserAvatar) {
            NativeModules.NotificationBridge.setCurrentUserAvatar(myAvatarUrl);
          }

          NativeModules.NotificationBridge.displayNotification(
            conversationKey,
            title,
            body,
            'fcm_fallback_notification_channel',
            targetScreen,
            targetId,
            data.senderName || title,
            avatarUrl,
            myAvatarUrl
          );
        }
      } catch (e) {
        console.warn('[FCM Foreground] Error displaying notification:', e);
      }
    });

    // 2. Notification Opened App from Background
    const unsubscribeNotificationOpened = fcm.onNotificationOpenedApp(
      (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        console.log('[FCM] Notification caused app to open from background:', remoteMessage);
        handleNotificationNavigation(remoteMessage.data, navigationRef);
      }
    );

    // 3. Notification Opened App from Quit State
    fcm.getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage?.data) {
          console.log('[FCM] App opened from quit state via notification:', remoteMessage);
          pendingNotificationData = remoteMessage.data;
          handleNotificationNavigation(remoteMessage.data, navigationRef);
          setTimeout(() => {
            flushPendingNotification(navigationRef);
          }, 1000);
          setTimeout(() => {
            flushPendingNotification(navigationRef);
          }, 2500);
        }
      })
      .catch((err) => {
        console.warn('[FCM] Error reading initial notification:', err);
      });

    return () => {
      unsubscribeOnMessage();
      unsubscribeNotificationOpened();
    };
  } catch (err) {
    console.warn('[FCM] Error setting up listeners:', err);
    return () => {};
  }
};
