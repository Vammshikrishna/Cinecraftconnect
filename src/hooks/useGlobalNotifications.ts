import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getDisplayMessage, getNotificationIcon } from '@/lib/chat-utils';
import { useNavigate } from 'react-router-dom';
import { useUserSettings } from '@/hooks/useUserSettings';

export const useGlobalNotifications = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { settings } = useUserSettings();

    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`global-notifications:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const notification = payload.new as any;
                    
                    // Play sound if enabled for ALL notification types (including messages)
                    if (settings?.notification_sounds !== false) {
                        try {
                            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                            const oscillator = audioContext.createOscillator();
                            const gainNode = audioContext.createGain();

                            oscillator.connect(gainNode);
                            gainNode.connect(audioContext.destination);

                            oscillator.type = 'sine';
                            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
                            
                            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                            oscillator.start(audioContext.currentTime);
                            oscillator.stop(audioContext.currentTime + 0.5);
                        } catch (e) {
                            console.error('Web Audio API error:', e);
                        }
                    }

                    // Skip the visual Toast for message notifications (they show in the navbar icon)
                    if (notification.type === 'new_message') return;

                    toast({
                        title: `${getNotificationIcon(notification.type)} ${notification.title}`,
                        description: getDisplayMessage(notification.message),
                        onClick: () => {
                            if (notification.action_url) {
                                navigate(notification.action_url);
                            }
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, toast, navigate, settings]);
};
