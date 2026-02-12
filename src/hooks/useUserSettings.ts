import { useState, useEffect } from 'react';
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
    // Privacy
    profile_visibility?: 'public' | 'connections' | 'private';
    show_email?: boolean;
    show_location?: boolean;
    show_online_status?: boolean;
    allow_messages_from?: 'everyone' | 'connections' | 'nobody';
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

export const useUserSettings = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load settings
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const loadSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('user_settings' as any)
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error loading settings:', error);
                    return;
                }

                if (data) {
                    setSettings(data as any);
                } else {
                    // Create default settings if they don't exist
                    const { data: newSettings, error: createError } = await supabase
                        .from('user_settings' as any)
                        .insert({ user_id: user.id })
                        .select()
                        .single();

                    if (createError) {
                        console.error('Error creating settings:', createError);
                    } else {
                        setSettings(newSettings as any);
                    }
                }
            } catch (error) {
                console.error('Unexpected error loading settings:', error);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, [user]);

    // Update settings
    const updateSettings = async (updates: Partial<UserSettings>) => {
        if (!user) return false;

        setSaving(true);
        try {
            const { data, error } = await supabase
                .from('user_settings' as any)
                .update(updates)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating settings:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to save settings. Please try again.',
                    variant: 'destructive',
                });
                return false;
            }

            setSettings(data as any);
            toast({
                title: 'Settings Saved',
                description: 'Your preferences have been updated successfully.',
            });
            return true;
        } catch (error) {
            console.error('Unexpected error updating settings:', error);
            toast({
                title: 'Error',
                description: 'An unexpected error occurred.',
                variant: 'destructive',
            });
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Update a single setting
    const updateSetting = async <K extends keyof UserSettings>(
        key: K,
        value: UserSettings[K]
    ) => {
        return updateSettings({ [key]: value });
    };

    return {
        settings,
        loading,
        saving,
        updateSettings,
        updateSetting,
    };
};
