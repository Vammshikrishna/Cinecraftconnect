import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Vibration, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@cinecraft/api';

export interface UserSettings {
  id?: string;
  user_id?: string;
  // Appearance
  theme?: 'light' | 'dark' | 'oled' | 'system';
  font_size?: 'small' | 'medium' | 'large';
  language?: string;
  // Calls & LiveKit
  allow_incoming_calls?: 'everyone' | 'connections' | 'nobody';
  call_alert_mode?: 'fullscreen' | 'banner';
  call_ringtone?: boolean;
  call_vibration?: boolean;
  call_pip_enabled?: boolean;
  call_mute_mic_on_join?: boolean;
  call_video_off_on_join?: boolean;
  call_data_saver?: boolean;
  // Notifications
  email_notifications?: boolean;
  push_notifications?: boolean;
  project_notifications?: boolean;
  message_notifications?: boolean;
  comment_notifications?: boolean;
  job_alerts?: boolean;
  dnd_enabled?: boolean;
  dnd_start_time?: string;
  dnd_end_time?: string;
  // Privacy & Safety
  profile_visibility?: 'public' | 'connections' | 'private';
  show_email?: boolean;
  show_location?: boolean;
  show_online_status?: boolean;
  read_receipts?: boolean;
  allow_messages_from?: 'everyone' | 'connections' | 'nobody';
  allow_connection_requests?: 'everyone' | 'mutuals' | 'nobody';
  // Media & Storage
  media_auto_download?: 'wifi_cellular' | 'wifi' | 'never';
  video_streaming_quality?: 'auto' | 'high' | 'saver';
  video_autoplay?: 'always' | 'wifi' | 'never';
  // Security
  biometric_lock?: boolean;
  // Accessibility
  high_contrast?: boolean;
  reduce_motion?: boolean;
  // Sound & Haptics
  sound_effects?: boolean;
  notification_sounds?: boolean;
  haptic_feedback?: boolean;
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  font_size: 'medium',
  language: 'English',
  allow_incoming_calls: 'everyone',
  call_alert_mode: 'fullscreen',
  call_ringtone: true,
  call_vibration: true,
  call_pip_enabled: true,
  call_mute_mic_on_join: false,
  call_video_off_on_join: false,
  call_data_saver: false,
  email_notifications: true,
  push_notifications: true,
  project_notifications: true,
  message_notifications: true,
  comment_notifications: true,
  job_alerts: true,
  dnd_enabled: false,
  dnd_start_time: '22:00',
  dnd_end_time: '08:00',
  profile_visibility: 'public',
  show_email: false,
  show_location: true,
  show_online_status: true,
  read_receipts: true,
  allow_messages_from: 'everyone',
  allow_connection_requests: 'everyone',
  media_auto_download: 'wifi',
  video_streaming_quality: 'auto',
  video_autoplay: 'wifi',
  biometric_lock: false,
  high_contrast: false,
  reduce_motion: false,
  sound_effects: true,
  notification_sounds: true,
  haptic_feedback: true,
};

export interface ThemeColors {
  bgScreen: string;
  bgCard: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  divider: string;
  chipBg: string;
}

export interface SettingsContextType {
  settings: UserSettings;
  loading: boolean;
  saving: boolean;
  updateSettings: (updates: Partial<UserSettings>) => Promise<boolean>;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  isDndActive: () => boolean;
  themeColors: ThemeColors;
  fontScale: number;
  triggerHaptic: (durationMs?: number) => void;
  resolvedTheme: 'light' | 'dark' | 'oled';
  isDark: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  loading: false,
  saving: false,
  updateSettings: async () => false,
  updateSetting: () => {},
  isDndActive: () => false,
  themeColors: {
    bgScreen: '#0B0F15',
    bgCard: '#151C26',
    border: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    inputBg: '#111722',
    divider: 'rgba(255, 255, 255, 0.06)',
    chipBg: '#1F2937',
  },
  fontScale: 1.0,
  triggerHaptic: () => {},
  resolvedTheme: 'dark',
  isDark: true,
});

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const systemScheme = useColorScheme();

  const activeTheme = settings.theme || 'system';
  const resolvedTheme: 'light' | 'dark' | 'oled' = useMemo(() => {
    if (activeTheme === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return activeTheme;
  }, [activeTheme, systemScheme]);

  const isDark = resolvedTheme !== 'light';

  // 1. Initial Load: Instant local cache + Supabase sync
  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      // Step A: Immediate Synchronous Cache Hydration on frame 1
      try {
        const cachedLatest = await AsyncStorage.getItem('@cinecraft_user_settings_latest');
        if (cachedLatest && isMounted) {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(cachedLatest) });
        }
      } catch {}

      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          try {
            const cached = await AsyncStorage.getItem('@cinecraft_user_settings_guest');
            if (cached && isMounted) {
              const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
              setSettings(merged);
              await AsyncStorage.setItem('@cinecraft_user_settings_latest', JSON.stringify(merged));
            }
          } catch {}
          if (isMounted) setLoading(false);
          return;
        }

        if (isMounted) setUserId(user.id);

        // User-specific local cache read
        const cacheKey = `@cinecraft_user_settings_${user.id}`;
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached && isMounted) {
            const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
            setSettings(merged);
            await AsyncStorage.setItem('@cinecraft_user_settings_latest', JSON.stringify(merged));
          }
        } catch {}

        // Fetch remote settings from Supabase
        const { data, error } = await (supabase.from('user_settings') as any)
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data && isMounted) {
          const merged = { ...DEFAULT_SETTINGS, ...data };
          setSettings(merged);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(merged));
          await AsyncStorage.setItem('@cinecraft_user_settings_latest', JSON.stringify(merged));
        } else if (!data && isMounted) {
          try {
            const { data: newRow } = await (supabase.from('user_settings') as any)
              .insert({ user_id: user.id, ...DEFAULT_SETTINGS })
              .select()
              .maybeSingle();

            if (newRow && isMounted) {
              const merged = { ...DEFAULT_SETTINGS, ...newRow };
              setSettings(merged);
              await AsyncStorage.setItem(cacheKey, JSON.stringify(merged));
              await AsyncStorage.setItem('@cinecraft_user_settings_latest', JSON.stringify(merged));
            }
          } catch {}
        }
      } catch (err) {
        console.warn('[SettingsProvider] Load error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSettings();

    const supabase = getSupabaseClient();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (isMounted && (event === 'SIGNED_IN' || event === 'SIGNED_OUT')) {
        loadSettings();
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // 2. Optimistic Update Function (persists to AsyncStorage + Supabase)
  const updateSettings = useCallback(
    async (updates: Partial<UserSettings>): Promise<boolean> => {
      setSettings((prev) => {
        const next = { ...prev, ...updates };
        const key = userId ? `@cinecraft_user_settings_${userId}` : '@cinecraft_user_settings_guest';
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
        AsyncStorage.setItem('@cinecraft_user_settings_latest', JSON.stringify(next)).catch(() => {});
        AsyncStorage.setItem('@cinecraft_user_settings', JSON.stringify(next)).catch(() => {});
        return next;
      });

      setSaving(true);
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return true; // Saved locally

        const { error } = await (supabase.from('user_settings') as any)
          .upsert(
            {
              user_id: user.id,
              ...updates,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (error) {
          console.warn('[SettingsProvider] Remote upsert error:', error);
          return false;
        }

        return true;
      } catch (e) {
        console.warn('[SettingsProvider] Update error:', e);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void => {
      updateSettings({ [key]: value });
    },
    [updateSettings]
  );

  // 3. Helper: Check if Do Not Disturb (DND) quiet hours are active right now
  const isDndActive = useCallback((): boolean => {
    if (!settings.dnd_enabled) return false;
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = (settings.dnd_start_time || '22:00').split(':').map(Number);
      const [endH, endM] = (settings.dnd_end_time || '08:00').split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        // Daytime quiet hours e.g. 13:00 to 17:00
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      } else {
        // Overnight quiet hours e.g. 22:00 to 08:00
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      }
    } catch {
      return false;
    }
  }, [settings.dnd_enabled, settings.dnd_start_time, settings.dnd_end_time]);

  // 4. Active Theme Palette
  const themeColors: ThemeColors = useMemo(() => {
    if (resolvedTheme === 'oled') {
      return {
        bgScreen: '#000000',
        bgCard: '#0A0A0A',
        border: 'rgba(255, 255, 255, 0.12)',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        inputBg: '#111111',
        divider: 'rgba(255, 255, 255, 0.08)',
        chipBg: '#171717',
      };
    }
    if (resolvedTheme === 'light') {
      return {
        bgScreen: '#F8FAFC',
        bgCard: '#FFFFFF',
        border: '#E2E8F0',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        textMuted: '#94A3B8',
        inputBg: '#F1F5F9',
        divider: '#E2E8F0',
        chipBg: '#F1F5F9',
      };
    }
    // Cinema Dark default
    return {
      bgScreen: '#0B0F15',
      bgCard: '#151C26',
      border: 'rgba(255, 255, 255, 0.08)',
      textPrimary: '#F1F5F9',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      inputBg: '#111722',
      divider: 'rgba(255, 255, 255, 0.06)',
      chipBg: '#1F2937',
    };
  }, [resolvedTheme]);

  // 5. Font Scale
  const fontScale = useMemo(() => {
    if (settings.font_size === 'small') return 0.9;
    if (settings.font_size === 'large') return 1.15;
    return 1.0;
  }, [settings.font_size]);

  // 6. Trigger Haptic Vibration (respects settings.haptic_feedback)
  const triggerHaptic = useCallback(
    (durationMs: number = 35) => {
      if (settings.haptic_feedback !== false) {
        try {
          Vibration.vibrate(durationMs);
        } catch {}
      }
    },
    [settings.haptic_feedback]
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        saving,
        updateSettings,
        updateSetting,
        isDndActive,
        themeColors,
        fontScale,
        triggerHaptic,
        resolvedTheme,
        isDark,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
export const useUserSettings = useSettings;
