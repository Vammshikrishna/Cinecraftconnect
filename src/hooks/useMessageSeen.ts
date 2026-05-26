import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type MessageTableType = 'direct_messages' | 'room_messages' | 'project_messages';

/**
 * Hook to handle Instagram-style "Seen" status using IntersectionObserver.
 * Now dynamic to support DMs, Discussion Rooms, and Project Spaces.
 */
export const useMessageSeen = (tableType: MessageTableType = 'direct_messages') => {
    const { user } = useAuth();
    const observerRef = useRef<IntersectionObserver | null>(null);
    const seenQueue = useRef<Set<string>>(new Set());
    const debounceTimer = useRef<any>(null);

    // The actual API call to mark messages as seen
    const flushSeenQueue = useCallback(async () => {
        if (seenQueue.current.size === 0 || !user) return;

        // Find the newest message ID in the queue (the watermark)
        const idsArray = Array.from(seenQueue.current);
        const newestId = idsArray[idsArray.length - 1]; 

        try {
            const rpcName = 
                tableType === 'direct_messages' ? 'mark_message_as_seen' : 
                tableType === 'room_messages' ? 'mark_room_message_as_seen' : 
                'mark_project_message_as_seen';

            const { error } = await (supabase.rpc as any)(rpcName, {
                p_message_id: newestId
            });
            
            if (error) {
                console.error(`[useMessageSeen] Update failed for ${newestId}:`, error);
            } else {
                seenQueue.current.clear();
            }
        } catch (err) {
            console.error('Error flushing seen queue:', err);
        }
    }, [user, tableType]);

    // Native debounce implementation
    const debouncedFlush = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            flushSeenQueue();
        }, 300); // Speed up from 1000ms to 300ms
    }, [flushSeenQueue]);

    useEffect(() => {
        if (!user) return;

        // Initialize Observer
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const messageId = entry.target.getAttribute('data-message-id');
                        const isIncoming = entry.target.getAttribute('data-sender-id') !== user.id;

                        if (messageId && !messageId.startsWith('temp-') && isIncoming) {
                            seenQueue.current.add(messageId);
                            debouncedFlush();
                        }
                    }
                });
            },
            { threshold: 0.1, rootMargin: '100px' } 
        );

        return () => {
            observerRef.current?.disconnect();
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [user, debouncedFlush]);

    // Function to attach the observer to a message element
    const observeMessage = useCallback((el: HTMLElement | null) => {
        if (el && observerRef.current) {
            observerRef.current.observe(el);
        }
    }, []);

    return { observeMessage };
};
