import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens(true);

// Silence bridge-stalling console logs in production release builds
if (!__DEV__) {
  console.log = () => { };
  console.info = () => { };
  console.debug = () => { };
}

import 'react-native-url-polyfill/auto';

import { install } from 'react-native-quick-crypto';
install(); // Sets up global.crypto and global.window.crypto

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
if (!globalThis.window.crypto && globalThis.crypto) {
  globalThis.window.crypto = globalThis.crypto;
}

// Polyfill TextEncoder and TextDecoder for React Native Hermes runtime
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = class TextEncoder {
    encode(input = '') {
      const str = String(input);
      const utf8 = [];
      for (let i = 0; i < str.length; i++) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        } else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        } else {
          i++;
          charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
          utf8.push(
            0xf0 | (charcode >> 18),
            0x80 | ((charcode >> 12) & 0x3f),
            0x80 | ((charcode >> 6) & 0x3f),
            0x80 | (charcode & 0x3f)
          );
        }
      }
      return new Uint8Array(utf8);
    }
  };
}

if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = class TextDecoder {
    decode(bytes) {
      if (!bytes) return '';
      const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      let out = '';
      let i = 0;
      const len = array.length;
      while (i < len) {
        const c = array[i++];
        if (c >> 7 === 0) {
          out += String.fromCharCode(c);
        } else if (c >> 5 === 0x06) {
          const c2 = array[i++];
          out += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
        } else if (c >> 4 === 0x0e) {
          const c2 = array[i++];
          const c3 = array[i++];
          out += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
        } else if (c >> 3 === 0x1e) {
          const c2 = array[i++];
          const c3 = array[i++];
          const c4 = array[i++];
          let u = ((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
          u -= 0x10000;
          out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
        }
      }
      return out;
    }
  };
}

// Assign nativeCrypto and fast native base64 polyfills
globalThis.nativeCrypto = require('react-native-quick-crypto');

// Safely load QuickBase64 — if the native module isn't linked, fall back to a pure-JS btoa/atob
try {
  const quickBase64 = require('react-native-quick-base64');
  if (quickBase64?.btoa && quickBase64?.atob) {
    globalThis.btoa = quickBase64.btoa;
    globalThis.atob = quickBase64.atob;
  }
} catch (_quickBase64Err) {
  // QuickBase64 native module not linked — use JS fallbacks
  if (!globalThis.btoa) {
    globalThis.btoa = (str) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let result = '';
      let i = 0;
      const bytes = typeof str === 'string' ? str : String(str);
      while (i < bytes.length) {
        const a = bytes.charCodeAt(i++);
        const b = bytes.charCodeAt(i++);
        const c = bytes.charCodeAt(i++);
        result += chars[a >> 2];
        result += chars[((a & 3) << 4) | (b >> 4)];
        result += isNaN(b) ? '=' : chars[((b & 15) << 2) | (c >> 6)];
        result += isNaN(b) || isNaN(c) ? '=' : chars[c & 63];
      }
      return result;
    };
  }
  if (!globalThis.atob) {
    globalThis.atob = (str) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let result = '';
      let i = 0;
      str = str.replace(/[^A-Za-z0-9+/=]/g, '');
      while (i < str.length) {
        const enc1 = chars.indexOf(str[i++]);
        const enc2 = chars.indexOf(str[i++]);
        const enc3 = chars.indexOf(str[i++]);
        const enc4 = chars.indexOf(str[i++]);
        result += String.fromCharCode((enc1 << 2) | (enc2 >> 4));
        if (enc3 !== 64) result += String.fromCharCode(((enc2 & 15) << 4) | (enc3 >> 2));
        if (enc4 !== 64) result += String.fromCharCode(((enc3 & 3) << 6) | enc4);
      }
      return result;
    };
  }
}

import messaging from '@react-native-firebase/messaging';
import { AppRegistry, NativeModules, Image } from 'react-native';

// Universal Image Cache Interceptor:
// Injects { cache: 'force-cache' } into every remote HTTP(S) image source across all screens.
// This guarantees that every image viewed once is preserved in Fresco's 300MB disk cache
// and displays instantly even when completely offline without any network stalls.
try {
  const originalImageRender = Image.render;
  if (typeof originalImageRender === 'function') {
    Image.render = function (props, ref) {
      if (props && props.source) {
        let src = props.source;
        if (
          src &&
          typeof src === 'object' &&
          !Array.isArray(src) &&
          typeof src.uri === 'string' &&
          src.uri.startsWith('http')
        ) {
          if (!src.cache) {
            src = Object.assign({}, src, { cache: 'force-cache' });
            props = Object.assign({}, props, { source: src });
          }
        } else if (Array.isArray(src)) {
          let changed = false;
          const newSrc = src.map(function (s) {
            if (s && typeof s === 'object' && typeof s.uri === 'string' && s.uri.startsWith('http') && !s.cache) {
              changed = true;
              return Object.assign({}, s, { cache: 'force-cache' });
            }
            return s;
          });
          if (changed) {
            props = Object.assign({}, props, { source: newSrc });
          }
        }
      }
      return originalImageRender.call(this, props, ref);
    };
  }
} catch (_imgPatchErr) {
  // non-fatal
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { installActivityIndicatorInterceptor } from './src/components/common/CineSpinner';
installActivityIndicatorInterceptor();

import App from './src/App';
import { name as appName } from './app.json';

// Register background FCM message handler with client-side E2EE decryption
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[FCM] Background push notification received:', remoteMessage);

  try {
    const data = remoteMessage.data || {};
    const title = remoteMessage.notification?.title || data.title || data.senderName || 'CineCraft Connect';
    let body = remoteMessage.notification?.body || data.body || 'You have a new message.';
    const rawActionUrl = typeof data.actionUrl === 'string' ? data.actionUrl : (typeof data.action_url === 'string' ? data.action_url : '');
    const isProjectMsg = data.type === 'project' || data.type === 'project_space' || data.type === 'project_space_message' || data.related_type === 'project_space_message' || (Boolean(rawActionUrl) && (rawActionUrl.includes('/projects/') || rawActionUrl.includes('/project-space/')));
    const targetRoomId = data.roomId || data.room_id || (rawActionUrl.includes('/discussion-rooms/') ? rawActionUrl.split('/discussion-rooms/')[1]?.split('?')[0] : null);
    const targetSpaceId = data.spaceId || data.space_id || data.project_space_id ||
      (isProjectMsg && typeof data.conversationId === 'string' && data.conversationId.length === 36 ? data.conversationId : null) ||
      (rawActionUrl && rawActionUrl.includes('/project-space/') ? rawActionUrl.split('/project-space/')[1]?.split('?')[0] : null) ||
      (rawActionUrl && rawActionUrl.includes('/projects/') && rawActionUrl.includes('/space') ? rawActionUrl.split('/projects/')[1]?.split('/')[0] : null) ||
      null;
    const targetConversationId = data.conversationId || data.channelId || data.senderId || null;

    // Check user settings before displaying notification
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
    } catch { }

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
    } catch { }

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
              console.log(`[FCM Background] Suppressed push notification because room ${targetRoomId} is muted.`);
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
                console.log(`[FCM Background] Suppressed push notification because room ${targetRoomId} is mentions-only.`);
                return;
              }
            }
          }
        }
      } catch { }
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
              console.log(`[FCM Background] Suppressed push notification because project space ${targetSpaceId} is muted.`);
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
                console.log(`[FCM Background] Suppressed push notification because project space ${targetSpaceId} is mentions-only.`);
                return;
              }
            }
          }
        }
      } catch { }
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
                console.log(`[FCM Background] Suppressed push notification because DM conversation ${cand} is muted.`);
                return;
              }
            }
          }
        }
      } catch { }
    }

    // Check if payload contains encrypted E2EE message
    const rawCipher = data.encryptedContent || data.body;
    const isEncrypted =
      data.isEncrypted === 'true' ||
      (typeof rawCipher === 'string' && (rawCipher.includes('__e2ee') || rawCipher.startsWith('{')));

    if (isEncrypted && data.targetUserId) {
      try {
        const { decryptAnyMessagePayload } = require('./src/services/decryptMessageHelper');
        const decrypted = await decryptAnyMessagePayload(rawCipher, data.targetUserId, data.conversationId);
        if (decrypted && !decrypted.includes('__e2ee') && !decrypted.startsWith('{')) {
          body = decrypted;
        }
      } catch (decErr) {
        console.warn('[FCM Background] Failed to decrypt message for notification:', decErr);
      }
    }

    if (NativeModules.NotificationBridge?.displayNotification) {
      const targetScreen = targetSpaceId ? 'ProjectSpace' : (targetRoomId ? 'DiscussionRoomDetail' : 'Conversation');
      const targetId = targetSpaceId
        ? (targetSpaceId || data.projectId || data.project_id)
        : (targetRoomId ? targetRoomId : (data.partnerId || data.partner_id || data.senderId || data.sender_id || data.conversationId));
      const conversationKey = `${targetScreen}_${targetId || data.id || 'general'}`;
      const avatarUrl = data.avatarUrl || data.avatar_url || data.senderAvatar || data.sender_avatar || null;

      let myAvatarUrl = null;
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
  } catch (err) {
    console.warn('[FCM Background] Notification processing error:', err);
  }
});

AppRegistry.registerHeadlessTask('NotificationActionTask', () => async (taskData) => {
  try {
    console.log('[HeadlessTask] NotificationActionTask running:', taskData);
    const { handleNotificationAction } = require('./src/services/notificationActionHandler');
    await handleNotificationAction(taskData);
  } catch (headlessErr) {
    console.warn('[HeadlessTask] Error running NotificationActionTask:', headlessErr);
  }
});

AppRegistry.registerComponent(appName, () => App);
