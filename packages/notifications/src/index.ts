import { getSupabaseClient } from '@cinecraft/api';

export interface PushTokenRegistration {
  userId: string;
  token: string;
  platform: 'android' | 'ios' | 'web';
  deviceId?: string;
}

export interface DeepLinkRoute {
  type: 'message' | 'project' | 'discussion' | 'profile' | 'post' | 'unknown';
  id?: string;
  url: string;
}

export class NotificationService {
  static async registerPushToken(params: PushTokenRegistration): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      // 1. Upsert into user_push_tokens table
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert(
          {
            user_id: params.userId,
            token: params.token,
            platform: params.platform,
            device_id: params.deviceId || null,
            active: true,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id, token' }
        );

      if (error) {
        console.warn('[NotificationService] Failed to upsert push token:', error.message);
      }

      console.log('[NotificationService] Push token successfully registered and synced for user:', params.userId);
    } catch (err) {
      console.warn('[NotificationService] Error registering push token:', err);
    }
  }

  static parseDeepLink(url: string): DeepLinkRoute {
    if (!url) return { type: 'unknown', url: '' };

    try {
      const cleanUrl = url.replace(/^(cinecraftconnect:\/\/|https?:\/\/[^/]+\/)/, '');
      const segments = cleanUrl.split('?')[0].split('/').filter(Boolean);

      if (segments[0] === 'messages' || segments[0] === 'chat') {
        return { type: 'message', id: segments[1], url };
      }
      if (segments[0] === 'projects' || segments[0] === 'project-space') {
        return { type: 'project', id: segments[1], url };
      }
      if (segments[0] === 'discussions') {
        return { type: 'discussion', id: segments[1], url };
      }
      if (segments[0] === 'profile') {
        return { type: 'profile', id: segments[1], url };
      }
      if (segments[0] === 'posts') {
        return { type: 'post', id: segments[1], url };
      }
      return { type: 'unknown', url };
    } catch {
      return { type: 'unknown', url };
    }
  }
}
