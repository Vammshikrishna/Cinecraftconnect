import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getDisplayMessage, getNotificationIcon } from '@/lib/chat-utils';
import { useNavigate } from 'react-router-dom';
import { useUserSettings } from '@/hooks/useUserSettings';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { premiumNotificationManager } from '@/lib/notifications/premiumNotificationManager';

// Safe wrapper to extract actionUrl from any notification event (Push, Local, flat or nested)
const extractActionUrl = (event: any): string | null => {
    if (!event) return null;

    console.log('[NOTIFICATIONS] Extracting actionUrl from raw event object:', JSON.stringify(event));

    const candidates = [
        event.notification?.data,
        event.notification?.extra,
        event.notification,
        event.data,
        event.extra,
        event
    ];

    for (const item of candidates) {
        if (item && typeof item === 'object') {
            const url = item.actionUrl ||
                item.actionurl ||
                item.action_url ||
                item.actionUrlString ||
                item.action_url_string;
            if (url && typeof url === 'string') {
                return url;
            }
        }
    }

    return null;
};

// Safe helper to schedule native local notifications
const scheduleLocalNotification = async (title: string, body: string, actionUrl?: string, channelId?: string) => {
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    title,
                    body,
                    id: Math.floor(Math.random() * 1000000),
                    extra: {
                        actionUrl,
                    },
                    channelId: channelId || 'default-channel-v2'
                }
            ]
        });
        console.log('[NOTIFICATIONS] Native local notification popup scheduled:', { title, body, actionUrl });
    } catch (e) {
        console.error('[NOTIFICATIONS] Failed to schedule native local notification:', e);
    }
};

// Match current user visibility to suppress/mute toast alerts if user is actively viewing
const isUserViewingPage = (actionUrl: string | null | undefined): boolean => {
    if (!actionUrl) return false;
    
    const currentPath = window.location.pathname;
    
    if (currentPath === actionUrl) return true;
    
    // Project space messages redirection
    if (actionUrl.startsWith('/projects/') && actionUrl.includes('/space')) {
        const actionProjectId = actionUrl.replace('/projects/', '').split('/')[0];
        if (currentPath.startsWith('/projects/') && currentPath.includes('/space')) {
            const currentProjectId = currentPath.replace('/projects/', '').split('/')[0];
            if (currentProjectId === actionProjectId) {
                console.log(`[NOTIFICATIONS MUTE] User already viewing Project Space: ${actionProjectId}`);
                return true;
            }
        }
    }
    
    // Direct Messages
    if (actionUrl.startsWith('/messages/')) {
        const actionUserId = actionUrl.replace('/messages/', '');
        if (currentPath.startsWith('/messages/')) {
            const currentUserId = currentPath.replace('/messages/', '');
            if (currentUserId === actionUserId) {
                return true;
            }
        }
    }
    
    // Discussion Rooms
    if (actionUrl.startsWith('/discussion-rooms/')) {
        const actionRoomId = actionUrl.replace('/discussion-rooms/', '');
        if (currentPath.startsWith('/discussion-rooms/')) {
            const currentRoomId = currentPath.replace('/discussion-rooms/', '');
            if (currentRoomId === actionRoomId) {
                return true;
            }
        }
    }
    
    return false;
};

// Helper to extract a unique key representing a conversation from actionUrl
const getConversationKey = (url: string | null | undefined): string => {
    if (!url) return 'general';
    const lower = url.toLowerCase();
    if (lower.startsWith('/messages/')) {
        return 'dm_' + lower.substring('/messages/'.length);
    }
    if (lower.startsWith('/discussion-rooms/')) {
        return 'room_' + lower.substring('/discussion-rooms/'.length);
    }
    if (lower.startsWith('/projects/') && lower.includes('/space')) {
        const parts = lower.substring('/projects/'.length).split('/');
        return 'project_' + parts[0];
    }
    return url;
};

// Play standard web notification beep safely
const playWebAudioBeep = () => {
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
};

export const useGlobalNotifications = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { settings } = useUserSettings();

    const refs = useRef({ settings, navigate, toast });
    useEffect(() => {
        refs.current = { settings, navigate, toast };
    }, [settings, navigate, toast]);

    useEffect(() => {
        if (!user) {
            // Reset catch-up flag when user logs out so it triggers again on their next login!
            sessionStorage.removeItem('has_shown_offline_catchup');
            return;
        }

        // Check for any pending notification route from a cold-start tap
        const pendingRoute = localStorage.getItem('pending_notification_route');
        if (pendingRoute) {
            console.log('[PUSH NAVIGATION] Cold-start tap detected, executing pending route redirection:', pendingRoute);
            localStorage.removeItem('pending_notification_route');
            setTimeout(() => {
                navigate(pendingRoute);
            }, 800);
        }

        // Force-sync the user session token to the active WebSocket client so RLS allows realtime subscriptions immediately!
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.access_token) {
                console.log('[NOTIFICATION SETUP] Synchronizing active session token with Supabase Realtime WebSocket.');
                supabase.realtime.setAuth(session.access_token);
            }
        });

        const hookId = Math.random().toString(36).substring(7);
        console.log(`[NOTIFICATION SETUP] Initializing fresh subscription channels with hookId: ${hookId}`);

        // Fetch offline unread notifications on startup/login catch-up
        const fetchOfflineNotifications = async () => {
            const hasShownCatchUp = sessionStorage.getItem('has_shown_offline_catchup');
            if (hasShownCatchUp === 'true') {
                console.log('[CATCH-UP] Already shown offline notifications catch-up in this session. Skipping.');
                return;
            }

            try {
                // Query the notifications table directly for unread records
                const { data: unreadNotifications, error } = await supabase
                    .from('notifications')
                    .select('id, title, message, action_url, type, created_at')
                    .eq('user_id', user.id)
                    .eq('is_read', false)
                    .order('created_at', { ascending: true })
                    .limit(10); // Show up to 10 unread notifications individually

                if (error) {
                    console.error('Error fetching unread notifications catch-up:', error);
                    return;
                }

                if (unreadNotifications && unreadNotifications.length > 0) {
                    console.log(`[CATCH-UP] Found ${unreadNotifications.length} unread notifications for startup catch-up.`);

                    sessionStorage.setItem('has_shown_offline_catchup', 'true');

                    for (const notification of unreadNotifications) {
                        const displayMessage = getDisplayMessage(notification.message);

                        if (Capacitor.isNativePlatform()) {
                            // Suppress OS-level local notification alert catch-up when starting to avoid duplicate noise with FCM,
                            // but show in-app PremiumNotification overlay so they see them clearly.
                            premiumNotificationManager.addNotification({
                                type: notification.type || 'generic',
                                title: notification.title || 'Notification',
                                description: displayMessage,
                                actionUrl: notification.action_url || undefined
                            });
                        } else {
                            // Web Toast
                            refs.current.toast({
                                title: `${getNotificationIcon(notification.type)} ${notification.title}`,
                                description: displayMessage,
                                onClick: () => {
                                    if (notification.action_url) {
                                        supabase.from('notifications').update({ is_read: true }).eq('id', notification.id).then();
                                        refs.current.navigate(notification.action_url);
                                    }
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to run catch-up notification sequence:', err);
            }
        };

        fetchOfflineNotifications();

        // 1. General notifications table subscription
        const generalChannel = supabase
            .channel(`global-notifications:${user.id}:${hookId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                async (payload) => {
                    const notification = payload.new as any;
                    const displayMessage = getDisplayMessage(notification.message);

                    // Suppress if the user is already viewing the target page
                    if (isUserViewingPage(notification.action_url)) {
                        console.log('[NOTIFICATION] User is already viewing this page. Skipping notification.');
                        return;
                    }

                    // Play sound on web/desktop if enabled
                    if (!Capacitor.isNativePlatform() && refs.current.settings?.notification_sounds !== false) {
                        playWebAudioBeep();
                    }

                    if (Capacitor.isNativePlatform()) {
                        // Foreground native: add in-app PremiumNotification overlay card + local notification popup
                        premiumNotificationManager.addNotification({
                            type: notification.type || 'generic',
                            title: notification.title || 'Notification',
                            description: displayMessage,
                            actionUrl: notification.action_url || undefined
                        });

                        const channelId = ['follow', 'connection_request', 'like', 'comment', 'mention'].includes(notification.type || '')
                            ? 'social-high-priority-v2'
                            : ['new_message', 'message', 'chat'].includes(notification.type || '')
                                ? 'msg-high-priority-v2'
                                : 'alarm-high-priority-v2';

                        scheduleLocalNotification(
                            notification.title || 'Notification',
                            displayMessage,
                            notification.action_url || undefined,
                            channelId
                        );
                    } else {
                        // Web desktop: trigger standard in-app toast
                        refs.current.toast({
                            title: `${getNotificationIcon(notification.type)} ${notification.title}`,
                            description: displayMessage,
                            onClick: () => {
                                if (notification.action_url) {
                                    supabase.from('notifications').update({ is_read: true }).eq('id', notification.id).then();
                                    refs.current.navigate(notification.action_url);
                                }
                            }
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[REALTIME STATUS] generalChannel status for user ${user.id}:`, status);
            });

        // 2. Real-time System-wide Announcements subscription
        const announcementChannel = supabase
            .channel(`system-announcements:${hookId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'system_announcements'
                },
                async (payload) => {
                    const announcement = payload.new as any;
                    const displayMessage = getDisplayMessage(announcement.body);

                    if (!Capacitor.isNativePlatform() && refs.current.settings?.notification_sounds !== false) {
                        playWebAudioBeep();
                    }

                    if (Capacitor.isNativePlatform()) {
                        premiumNotificationManager.addNotification({
                            type: 'system_announcement',
                            title: announcement.title || 'Announcement',
                            description: displayMessage,
                            actionUrl: '/announcements'
                        });

                        scheduleLocalNotification(
                            announcement.title || 'Announcement',
                            displayMessage,
                            '/announcements',
                            'alarm-high-priority-v2'
                        );
                    } else {
                        refs.current.toast({
                            title: `📢 ${announcement.title}`,
                            description: displayMessage,
                            onClick: () => {
                                refs.current.navigate('/announcements');
                            }
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[REALTIME STATUS] announcementChannel status:`, status);
            });

        return () => {
            console.log(`[NOTIFICATION CLEANUP] Dismounting subscription channels for hookId: ${hookId}`);
            supabase.removeChannel(generalChannel);
            supabase.removeChannel(announcementChannel);
        };
    }, [user]);

    // Capacitor native Push and Local notifications registration & action listeners
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let localListener: any;
        let pushRecListener: any;
        let pushActListener: any;

        const setupActionListeners = async () => {
            try {
                // 1. Local notification action listener
                localListener = await LocalNotifications.addListener(
                    'localNotificationActionPerformed',
                    (action) => {
                        const actionUrl = extractActionUrl(action);
                        if (actionUrl) {
                            console.log('[PUSH NAVIGATION] Local notification tapped, saving to localStorage:', actionUrl);
                            localStorage.setItem('pending_notification_route', actionUrl);
                            refs.current.navigate(actionUrl);
                        }
                    }
                );

                // 2. Push notification received listener (suppressed in foreground to prevent duplicate render)
                pushRecListener = await PushNotifications.addListener(
                    'pushNotificationReceived',
                    (notification: any) => {
                        console.log('[PUSH] Received push in foreground (suppressed to prevent duplicates with realtime):', notification);
                    }
                );

                // 3. Push notification action listener (handles tap on notification bar when closed/backgrounded)
                pushActListener = await PushNotifications.addListener(
                    'pushNotificationActionPerformed',
                    (notification: any) => {
                        console.log('[PUSH NAVIGATION] Push notification tapped, raw data:', notification);
                        const actionUrl = extractActionUrl(notification);
                        if (actionUrl) {
                            console.log('[PUSH NAVIGATION] Extracted actionUrl from push action:', actionUrl);
                            localStorage.setItem('pending_notification_route', actionUrl);
                            setTimeout(() => {
                                refs.current.navigate(actionUrl);
                            }, 100);
                        }
                    }
                );

                // Initialize high-priority channels for Android heads-up display support
                const channels = [
                    {
                        id: 'msg-high-priority-v2',
                        name: 'High Priority Messages',
                        description: 'Heads-up channel for new chat messages',
                        importance: 5, // IMPORTANCE_HIGH
                        sound: 'default',
                        vibration: true,
                        lights: true,
                        lightColor: '#FF4B33',
                        visibility: 1 // VISIBILITY_PUBLIC
                    },
                    {
                        id: 'social-high-priority-v2',
                        name: 'Social Interactions',
                        description: 'Heads-up channel for followers, likes, comments and mentions',
                        importance: 4, // IMPORTANCE_DEFAULT
                        sound: 'default',
                        vibration: true,
                        lights: true,
                        lightColor: '#FF4B33',
                        visibility: 1
                    },
                    {
                        id: 'call-high-priority-v2',
                        name: 'Invites & Calls',
                        description: 'Heads-up channel for room invites and crew invitations',
                        importance: 5, // IMPORTANCE_HIGH
                        sound: 'default',
                        vibration: true,
                        lights: true,
                        lightColor: '#FF4B33',
                        visibility: 1
                    },
                    {
                        id: 'alarm-high-priority-v2',
                        name: 'Announcements & Alerts',
                        description: 'Heads-up channel for critical system updates',
                        importance: 5, // IMPORTANCE_HIGH
                        sound: 'default',
                        vibration: true,
                        lights: true,
                        lightColor: '#FF4B33',
                        visibility: 1
                    }
                ];

                for (const ch of channels) {
                    try {
                        await PushNotifications.createChannel(ch as any);
                        await LocalNotifications.createChannel(ch as any);
                        console.log(`[CHANNELS] Created native channel successfully: ${ch.id}`);
                    } catch (chErr) {
                        console.warn(`[CHANNELS] Failed to create native channel: ${ch.id}`, chErr);
                    }
                }

                // Register with Google/Apple push servers to fetch device FCM token
                let permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive !== 'granted') {
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive === 'granted') {
                    console.log('[PUSH REGISTRATION] Permission granted, registering for token...');
                    await PushNotifications.register();
                } else {
                    console.warn('[PUSH REGISTRATION] Push permissions denied.');
                }
            } catch (e) {
                console.error('[PUSH NOTIFICATIONS] Setup failed:', e);
            }
        };

        setupActionListeners();

        return () => {
            console.log('[PUSH NOTIFICATIONS] Cleaning up native action listeners.');
            if (localListener && typeof localListener.remove === 'function') {
                localListener.remove();
            }
            if (pushRecListener && typeof pushRecListener.remove === 'function') {
                pushRecListener.remove();
            }
            if (pushActListener && typeof pushActListener.remove === 'function') {
                pushActListener.remove();
            }
        };
    }, []);

    // Capacitor Native appStateChange listener to route pending notifications on resume
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let resumeListener: any;

        const setupResumeListener = async () => {
            try {
                const { App } = await import('@capacitor/app');
                resumeListener = await App.addListener('appStateChange', (state) => {
                    if (state.isActive) {
                        console.log('[PUSH NAVIGATION] App became active/resumed, checking pending route...');
                        const pendingRoute = localStorage.getItem('pending_notification_route');
                        if (pendingRoute && user) {
                            console.log('[PUSH NAVIGATION] Resumed, executing pending route redirection:', pendingRoute);
                            localStorage.removeItem('pending_notification_route');
                            setTimeout(() => {
                                navigate(pendingRoute);
                            }, 500);
                        }
                    }
                });
            } catch (err) {
                console.error('Failed to register App state change listener:', err);
            }
        };

        setupResumeListener();

        return () => {
            if (resumeListener && typeof resumeListener.remove === 'function') {
                resumeListener.remove();
            }
        };
    }, [user, navigate]);
};
