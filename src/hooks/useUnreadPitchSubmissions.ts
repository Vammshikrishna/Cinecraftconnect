import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

/**
 * Watches pitch_submissions for unread (status = 'submitted') entries
 * on pitch calls owned by the current user.
 * Automatically clears when the user navigates to /pitch (inbox tab).
 */
export const useUnreadPitchSubmissions = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchCount = useCallback(async () => {
        if (!user) return;

        try {
            // Get all pitch call IDs owned by this user
            const { data: myCalls, error: callsError } = await (supabase as any)
                .from('pitch_calls')
                .select('id')
                .eq('creator_id', user.id);

            if (callsError || !myCalls?.length) {
                setUnreadCount(0);
                return;
            }

            const callIds = myCalls.map((c: any) => c.id);

            // Count submissions that are still in 'submitted' state (i.e. not yet seen)
            const { count, error: subError } = await (supabase as any)
                .from('pitch_submissions')
                .select('id', { count: 'exact', head: true })
                .in('pitch_call_id', callIds)
                .eq('status', 'submitted');

            if (!subError) {
                setUnreadCount(count ?? 0);
            }
        } catch (err) {
            console.error('useUnreadPitchSubmissions error:', err);
        }
    }, [user]);

    // Initial fetch
    useEffect(() => {
        fetchCount();
    }, [fetchCount]);

    // Real-time subscription
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`pitch_submissions_unread_${user.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'pitch_submissions' },
                () => fetchCount()
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'pitch_submissions' },
                () => fetchCount()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchCount]);

    // Clear when user visits the pitch inbox
    useEffect(() => {
        if (location.pathname.startsWith('/pitch')) {
            // Don't clear immediately — let them see the badge until they open inbox
            // Refetch after a brief delay to sync with actual state
            const t = setTimeout(() => fetchCount(), 2000);
            return () => clearTimeout(t);
        }
    }, [location.pathname, fetchCount]);

    return { unreadPitchCount: unreadCount, hasUnreadPitches: unreadCount > 0 };
};
