import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { premiumNotificationManager } from '@/lib/notifications/premiumNotificationManager';
import { useAuth } from '@/contexts/AuthContext';
import { Capacitor } from '@capacitor/core';

// In-memory caches to make notifications render instantly without network latency
const profileCache = new Map<string, { full_name: string | null, avatar_url: string | null }>();
const roomCache = new Map<string, { title: string | null }>();
const projectCache = new Map<string, { name: string | null, project_id: string | null }>();

export const GlobalNotificationListener = () => {
    const { user } = useAuth();

    // Restrict in-app toast notifications to web only
    if (Capacitor.isNativePlatform()) {
        return null;
    }

    useEffect(() => {
        if (!user) return;

        const dmChannel = supabase.channel('global_notifications_dm')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'direct_messages'
            }, (payload) => {
                console.log('🔔 [Realtime] Direct Message received:', payload);
                const message = payload.new;
                
                if (message.sender_id === user.id) {
                    console.log('🔕 [Realtime] Ignored own DM');
                    return;
                }
                
                // Fetch profile using async IIFE with cache
                (async () => {
                    try {
                        let profile = profileCache.get(message.sender_id);
                        
                        if (!profile) {
                            const { data, error } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', message.sender_id).single();
                            if (error) console.error('Error fetching profile for DM:', error);
                            if (data) {
                                profile = data;
                                profileCache.set(message.sender_id, data);
                            }
                        }
                        
                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: profile?.full_name || 'New Message',
                            description: message.content || 'Sent an attachment',
                            actionUrl: `/messages/${message.sender_id}`,
                            senderName: profile?.full_name || 'System',
                            avatarUrl: profile?.avatar_url || undefined
                        });
                    } catch (err) {
                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: 'New Message',
                            description: message.content || 'Sent an attachment',
                            actionUrl: `/messages/${message.sender_id}`
                        });
                    }
                })();
            })
            .subscribe((status) => {
                console.log('📡 [DM Listener] Subscription status:', status);
            });

        const roomChannel = supabase.channel('global_notifications_rooms')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'room_messages'
            }, (payload) => {
                console.log('🔔 [Realtime] Room Message received:', payload);
                const message = payload.new;
                
                window.dispatchEvent(new CustomEvent('room_message_received', { detail: message }));

                if (message.sender_id === user.id || message.user_id === user.id) {
                    console.log('🔕 [Realtime] Ignored own room message');
                    return;
                }
                
                (async () => {
                    try {
                        let room = roomCache.get(message.room_id);
                        if (!room) {
                            const { data } = await supabase.from('discussion_rooms').select('title').eq('id', message.room_id).single();
                            if (data) { room = data; roomCache.set(message.room_id, data); }
                        }

                        let profile = profileCache.get(message.user_id);
                        if (!profile) {
                            const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', message.user_id).single();
                            if (data) { profile = data; profileCache.set(message.user_id, data); }
                        }

                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: `${room?.title || 'Room'}: ${profile?.full_name || 'Someone'}`,
                            description: message.content || 'Sent an attachment',
                            actionUrl: `/discussion-rooms/${message.room_id}`,
                            senderName: profile?.full_name || 'System',
                            avatarUrl: profile?.avatar_url || undefined
                        });
                    } catch (e) {
                        console.error('Room fetch error', e);
                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: 'New Room Message',
                            description: message.content || 'Sent an attachment',
                            actionUrl: `/discussion-rooms/${message.room_id}`
                        });
                    }
                })();
            })
            .subscribe((status) => {
                console.log('📡 [Room Listener] Subscription status:', status);
            });

        const projectChannel = supabase.channel('global_notifications_projects')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'project_space_messages'
            }, (payload) => {
                console.log('🔔 [Realtime] Project Space Message received:', payload);
                const message = payload.new;
                
                window.dispatchEvent(new CustomEvent('project_message_received', { detail: message }));
                
                if (message.user_id === user.id) {
                    console.log('🔕 [Realtime] Ignored own project space message');
                    return;
                }
                
                (async () => {
                    try {
                        let space = projectCache.get(message.project_space_id);
                        if (!space) {
                            const { data } = await supabase.from('project_spaces').select('name, project_id').eq('id', message.project_space_id).single();
                            if (data) { space = data; projectCache.set(message.project_space_id, data); }
                        }

                        let profile = profileCache.get(message.user_id);
                        if (!profile) {
                            const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', message.user_id).single();
                            if (data) { profile = data; profileCache.set(message.user_id, data); }
                        }

                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: `${space?.name || 'Project'}: ${profile?.full_name || 'Someone'}`,
                            description: message.content || 'Sent an attachment',
                            actionUrl: space?.project_id ? `/projects/${space.project_id}/space` : `/projects`,
                            senderName: profile?.full_name || 'System',
                            avatarUrl: profile?.avatar_url || undefined
                        });
                    } catch (e) {
                        console.error('Project fetch error', e);
                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: 'New Project Message',
                            description: message.content || 'Sent an attachment',
                            actionUrl: `/projects`
                        });
                    }
                })();
            })
            .subscribe((status) => {
                console.log('📡 [Project Listener] Subscription status:', status);
            });

        const generalNotificationChannel = supabase.channel('global_notifications_general')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                console.log('🔔 [Realtime] General Notification received:', payload);
                const notification = payload.new;
                
                if (notification.trigger_user_id === user.id) {
                    console.log('🔕 [Realtime] Ignored notification triggered by self');
                    return;
                }
                
                (async () => {
                    try {
                        let profile = undefined;
                        if (notification.trigger_user_id) {
                            profile = profileCache.get(notification.trigger_user_id);
                            if (!profile) {
                                const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', notification.trigger_user_id).single();
                                if (data) { profile = data; profileCache.set(notification.trigger_user_id, data); }
                            }
                        }

                        premiumNotificationManager.addNotification({
                            type: notification.type as any || 'social',
                            title: notification.title,
                            description: notification.message,
                            actionUrl: notification.action_url || '/notifications',
                            senderName: profile?.full_name || 'System',
                            avatarUrl: profile?.avatar_url || undefined
                        });
                    } catch (e) {
                        console.error('General Notification fetch error', e);
                    }
                })();
            })
            .subscribe((status) => {
                console.log('📡 [General Notification Listener] Subscription status:', status);
            });

        return () => {
            supabase.removeChannel(dmChannel);
            supabase.removeChannel(roomChannel);
            supabase.removeChannel(projectChannel);
            supabase.removeChannel(generalNotificationChannel);
        };
    }, [user]);

    return null;
};
