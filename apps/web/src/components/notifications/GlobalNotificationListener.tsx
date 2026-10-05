import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { premiumNotificationManager } from '@/lib/notifications/premiumNotificationManager';
import { useAuth } from '@/contexts/AuthContext';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { useQueryClient } from '@tanstack/react-query';
import { getDisplayMessage } from '@/lib/chat-utils';
import { getLocalPrivateKey } from '@/lib/e2ee-storage';
import { 
    importPrivateKey, 
    decryptDirectMessage, 
    importSymmetricKey, 
    decryptGroupMessage,
    decryptWithPrivateKey,
    E2EEProtocolService
} from '@/lib/e2ee';

// In-memory caches to make notifications render instantly without network latency
const profileCache = new Map<string, { full_name: string | null, avatar_url: string | null }>();
const roomCache = new Map<string, { title: string | null }>();
const projectCache = new Map<string, { name: string | null, project_id: string | null }>();

// E2EE Keys Cache for Web App Toasts
const privateKeyCache = new Map<string, CryptoKey | null>();
const groupKeyCache = new Map<string, CryptoKey>();

async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
    if (privateKeyCache.has(userId)) return privateKeyCache.get(userId) || null;
    
    try {
        const privateKeyStr = await getLocalPrivateKey(userId);
        if (privateKeyStr) {
            const imported = await importPrivateKey(privateKeyStr);
            privateKeyCache.set(userId, imported);
            return imported;
        }
    } catch (e) {
        console.error("Failed to load private key for notifications", e);
    }
    privateKeyCache.set(userId, null);
    return null;
}

async function getGroupKey(targetId: string, targetType: string, userId: string): Promise<CryptoKey | null> {
    const cacheKey = `${targetType}_${targetId}`;
    if (groupKeyCache.has(cacheKey)) return groupKeyCache.get(cacheKey) || null;
    
    try {
        const pk = await getPrivateKey(userId);
        if (!pk) return null;

        const { data, error } = await (supabase as any)
            .from('group_keys')
            .select('encrypted_symmetric_key')
            .eq('target_type', targetType)
            .eq('target_id', targetId)
            .eq('user_id', userId)
            .maybeSingle();

        if (!error && (data as any)?.encrypted_symmetric_key) {
            try {
                const rawSymmetricKeyBase64 = await decryptWithPrivateKey((data as any).encrypted_symmetric_key, pk);
                const loadedSymmetricKey = await importSymmetricKey(rawSymmetricKeyBase64);
                groupKeyCache.set(cacheKey, loadedSymmetricKey);
                return loadedSymmetricKey;
            } catch (decErr) {
                console.error(`Failed to decrypt group key for notifications (target: ${targetId}):`, decErr);
                // Do not delete group_keys row: preserving it ensures chat history remains intact
                return null;
            }
        }
    } catch (e) {
        console.error("Failed to load group key for notifications", e);
    }
    return null;
}

export const GlobalNotificationListener = () => {
    const { user } = useAuth();
    const { isChecking, isSetupRequired, isRecoveryRequired } = useE2EEBackup();
    const queryClient = useQueryClient();

    // Clear notification caches when user logs in/out or E2EE status finishes setup/recovery
    useEffect(() => {
        privateKeyCache.clear();
        groupKeyCache.clear();
    }, [user?.id, isChecking, isSetupRequired, isRecoveryRequired]);

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

                if (message.attachment_type === 'call_event' || (message.content && (message.content.includes('📞') || message.content.includes('Video call') || message.content.includes('Call ended')))) {
                    console.log('🔕 [Realtime] Ignored DM call event notification toast');
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
                        
                        let displayContent = message.content ? getDisplayMessage(message.content) : 'Sent an attachment';
                        
                        if (message.content) {
                            const isV2 = message.content.startsWith('{') && message.content.includes('"version":2');
                            const isLegacy = message.content.includes('__e2ee');
                            if (isV2 || isLegacy) {
                                const pk = await getPrivateKey(user.id);
                                if (pk) {
                                    if (isV2) {
                                        displayContent = await E2EEProtocolService.receiveDirectMessage({
                                            rawPayload: message.content,
                                            currentUserId: user.id,
                                            currentDeviceId: 'global_listener'
                                        });
                                    } else {
                                        displayContent = await decryptDirectMessage(message.content, pk);
                                    }
                                }
                            }
                        }
                        
                        if (displayContent && (displayContent.includes('📞') || displayContent.includes('Video call') || displayContent.includes('Call ended') || displayContent.includes('call started'))) {
                            console.log('🔕 [Realtime] Suppressed DM call event toast after decryption');
                            return;
                        }

                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: profile?.full_name || 'New Message',
                            description: displayContent,
                            actionUrl: `/messages/${message.sender_id}`,
                            senderName: profile?.full_name || 'System',
                            avatarUrl: profile?.avatar_url || undefined
                        });
                    } catch (err) {
                        let displayContent = message.content ? getDisplayMessage(message.content) : 'Sent an attachment';
                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: 'New Message',
                            description: displayContent,
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

                if (message.attachment_type === 'call_event' || (message.content && (message.content.includes('📞') || message.content.includes('Video call') || message.content.includes('Call ended')))) {
                    console.log('🔕 [Realtime] Ignored room message call event notification toast');
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

                        let displayContent = message.content ? getDisplayMessage(message.content) : 'Sent an attachment';
                        
                        if (message.content) {
                            const isV2 = message.content.startsWith('{') && (message.content.includes('"type":"group"') || message.content.includes('"version":2'));
                            const isLegacy = message.content.includes('__e2ee_group');

                            if (isV2 || isLegacy) {
                                const gk = await getGroupKey(message.room_id, 'room', user.id);
                                if (gk) {
                                    if (isV2) {
                                        const { base64ToBuffer } = await import('@/lib/e2ee');
                                        const envelope = JSON.parse(message.content);
                                        const iv = new Uint8Array(base64ToBuffer(envelope.header.iv));
                                        const ciphertext = base64ToBuffer(envelope.ciphertext);
                                        const decBuf = await window.crypto.subtle.decrypt(
                                            { name: 'AES-GCM', iv },
                                            gk,
                                            ciphertext
                                        );
                                        displayContent = new TextDecoder().decode(decBuf);
                                    } else {
                                        displayContent = await decryptGroupMessage(message.content, gk);
                                    }
                                }
                            }
                        }

                        if (displayContent && (displayContent.includes('📞') || displayContent.includes('Video call') || displayContent.includes('Call ended') || displayContent.includes('call started'))) {
                            console.log('🔕 [Realtime] Suppressed room message call event toast after decryption');
                            return;
                        }

                        // Check per-room notification preferences
                        let isMuted = false;
                        let isMentionsOnly = false;
                        try {
                            const rawPrefs = localStorage.getItem(`room_notif_${message.room_id}_${user.id}`);
                            if (rawPrefs) {
                                const parsed = JSON.parse(rawPrefs);
                                isMuted = parsed.muteRoom === true;
                                isMentionsOnly = parsed.mentionsOnly === true;
                            }
                        } catch {}

                        if (isMuted) {
                            console.log('🔕 [Realtime] Suppressed toast: Room is muted by user');
                            return;
                        }

                        if (isMentionsOnly) {
                            const myUsername = (user.user_metadata?.username || user.email?.split('@')[0] || '').toLowerCase();
                            const contentLower = (displayContent || '').toLowerCase();
                            const hasMention = myUsername && (contentLower.includes(`@${myUsername}`) || contentLower.includes('@all') || contentLower.includes('@everyone'));
                            if (!hasMention) {
                                console.log('🔕 [Realtime] Suppressed toast: Room is set to mentions only');
                                return;
                            }
                        }

                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: `${room?.title || 'Room'}: ${profile?.full_name || 'Someone'}`,
                            description: displayContent,
                            actionUrl: `/discussion-rooms/${message.room_id}`,
                            senderName: profile?.full_name || 'System',
                            avatarUrl: profile?.avatar_url || undefined
                        });
                    } catch (e) {
                        console.error('Room fetch error', e);
                        let displayContent = message.content ? getDisplayMessage(message.content) : 'Sent an attachment';
                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: 'New Room Message',
                            description: displayContent,
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
                
                if (message.user_id === user.id || message.sender_id === user.id) {
                    console.log('🔕 [Realtime] Ignored own project space message');
                    return;
                }

                if (message.attachment_type === 'call_event' || (message.content && (message.content.includes('📞') || message.content.includes('Video call') || message.content.includes('Call ended')))) {
                    console.log('🔕 [Realtime] Ignored project space message call event notification toast');
                    return;
                }
                
                (async () => {
                    try {
                        const senderId = message.sender_id || message.user_id;

                        let space = projectCache.get(message.project_space_id);
                        if (!space) {
                            const { data } = await supabase.from('project_spaces').select('name, project_id').eq('id', message.project_space_id).single();
                            if (data) { space = data; projectCache.set(message.project_space_id, data); }
                        }

                        let profile = senderId ? profileCache.get(senderId) : undefined;
                        if (!profile && senderId) {
                            const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', senderId).single();
                            if (data) { profile = data; profileCache.set(senderId, data); }
                        }

                        let displayContent = message.content ? getDisplayMessage(message.content) : 'Sent an attachment';

                        if (message.content) {
                            const isV2 = message.content.startsWith('{') && (message.content.includes('"type":"group"') || message.content.includes('"version":2'));
                            const isLegacy = message.content.includes('__e2ee_group');

                            if (isV2 || isLegacy) {
                                const gk = await getGroupKey(message.project_space_id, 'project_space', user.id);
                                if (gk) {
                                    if (isV2) {
                                        const { base64ToBuffer } = await import('@/lib/e2ee');
                                        const envelope = JSON.parse(message.content);
                                        const iv = new Uint8Array(base64ToBuffer(envelope.header.iv));
                                        const ciphertext = base64ToBuffer(envelope.ciphertext);
                                        const decBuf = await window.crypto.subtle.decrypt(
                                            { name: 'AES-GCM', iv },
                                            gk,
                                            ciphertext
                                        );
                                        displayContent = new TextDecoder().decode(decBuf);
                                    } else {
                                        displayContent = await decryptGroupMessage(message.content, gk);
                                    }
                                }
                            }
                        }

                        if (displayContent && (displayContent.includes('📞') || displayContent.includes('Video call') || displayContent.includes('Call ended') || displayContent.includes('call started'))) {
                            console.log('🔕 [Realtime] Suppressed project space call event toast after decryption');
                            return;
                        }

                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: `${space?.name || 'Project'}: ${profile?.full_name || 'Someone'}`,
                            description: displayContent,
                            actionUrl: space?.project_id ? `/projects/${space.project_id}/space` : `/projects`,
                            senderName: profile?.full_name || 'System',
                            avatarUrl: profile?.avatar_url || undefined
                        });
                    } catch (e) {
                        console.error('Project fetch error', e);
                        let displayContent = message.content ? getDisplayMessage(message.content) : 'Sent an attachment';
                        premiumNotificationManager.addNotification({
                            type: 'conversation',
                            title: 'New Project Message',
                            description: displayContent,
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

                // Skip background toast popups for call invitations because GlobalCallOverlay handles incoming calls!
                const isCallNotification = 
                    notification.type === 'call_invite' || 
                    notification.type === 'incoming_call' || 
                    notification.type === 'call_started' ||
                    notification.type === 'call' ||
                    (notification.title && notification.title.toLowerCase().includes('call'));

                if (isCallNotification) {
                    console.log('📞 [Realtime] Call notification handled by GlobalCallOverlay ring banner');
                    return;
                }

                // Globally invalidate connection and user caches when a connection notification arrives
                if (notification.type === 'connection' || notification.type === 'connection_request' || notification.type === 'network') {
                    queryClient.invalidateQueries({ queryKey: ['connections_manual'] });
                    queryClient.invalidateQueries({ queryKey: ['users'] });
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
