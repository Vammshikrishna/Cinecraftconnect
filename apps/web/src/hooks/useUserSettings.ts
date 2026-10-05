import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';

export interface UserSettings {
    id?: string;
    user_id?: string;
    // Appearance
    theme?: 'light' | 'dark' | 'system';
    font_size?: 'small' | 'medium' | 'large';
    language?: string;
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
    // Privacy
    profile_visibility?: 'public' | 'connections' | 'private';
    show_email?: boolean;
    show_location?: boolean;
    show_online_status?: boolean;
    read_receipts?: boolean;
    allow_messages_from?: 'everyone' | 'connections' | 'nobody';
    allow_connection_requests?: 'everyone' | 'mutuals' | 'nobody';
    // Calls
    allow_incoming_calls?: 'everyone' | 'connections' | 'nobody';
    call_mute_mic_on_join?: boolean;
    call_video_off_on_join?: boolean;
    call_data_saver?: boolean;
    // Media
    video_streaming_quality?: 'auto' | 'high' | 'saver';
    // Accessibility
    high_contrast?: boolean;
    reduce_motion?: boolean;
    // Sound
    sound_effects?: boolean;
    notification_sounds?: boolean;
    // Timestamps
    created_at?: string;
    updated_at?: string;
}

/**
 * The signed-in person's settings. One shared copy (react-query), so the settings menu and every settings page show
 * the same values right after a change. Changes are saved straight away and shown immediately (optimistic).
 */
export const useUserSettings = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const key = ['user_settings', user?.id];

    const { data: settings = null, isLoading } = useQuery({
        queryKey: key,
        enabled: !!user,
        staleTime: 1000 * 60 * 5,
        queryFn: async (): Promise<UserSettings | null> => {
            const db = supabase as any;
            const { data, error } = await db.from('user_settings').select('*').eq('user_id', user!.id).maybeSingle();
            if (error) {
                console.error('Error loading settings:', error);
                return null;
            }
            if (data) return data as UserSettings;
            // first visit: create the row with the defaults
            const { data: created, error: createError } = await db.from('user_settings').insert({ user_id: user!.id }).select().single();
            if (createError) {
                console.error('Error creating settings:', createError);
                return null;
            }
            return created as UserSettings;
        },
    });

    const updateSettings = async (updates: Partial<UserSettings>) => {
        if (!user) return false;
        const previous = queryClient.getQueryData<UserSettings | null>(key);
        queryClient.setQueryData<UserSettings | null>(key, (old) => ({ ...(old || {}), ...updates }));
        const { data, error } = await (supabase as any).from('user_settings').update(updates).eq('user_id', user.id).select().single();
        if (error) {
            console.error('Error updating settings:', error);
            queryClient.setQueryData(key, previous ?? null);
            toast({ title: 'Could not save', description: error.message || 'Please try again.', variant: 'destructive' });
            return false;
        }
        queryClient.setQueryData(key, data as UserSettings);
        return true;
    };

    const updateSetting = async <K extends keyof UserSettings>(settingKey: K, value: UserSettings[K]) =>
        updateSettings({ [settingKey]: value } as Partial<UserSettings>);

    return {
        settings,
        loading: !!user && isLoading,
        saving: false,
        updateSettings,
        updateSetting,
    };
};
