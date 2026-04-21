import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Call {
    id: string;
    room_type: 'project' | 'discussion';
    room_id: string;
    room_name: string;
    room_url: string;
    status: 'active' | 'ended';
    started_by: string;
}

export const useCall = (roomType: 'project' | 'discussion' | 'direct', roomId: string) => {
    const { user } = useAuth();
    const [activeCall, setActiveCall] = useState<Call | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!roomId) return;

        fetchActiveCall();

        // Subscribe to call changes
        const channel = supabase
            .channel(`calls:${roomType}:${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'calls',
                filter: `room_id=eq.${roomId}`
            }, () => {
                fetchActiveCall();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomType, roomId]);

    const fetchActiveCall = async () => {
        const { data } = await supabase
            .from('calls' as any)
            .select('*')
            .eq('room_type', roomType)
            .eq('room_id', roomId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        setActiveCall(data as Call | null);
    };

    const startCall = async () => {
        if (!user) return null;

        setLoading(true);
        try {
            // Check if there is already an active call
            const { data: existingCall } = await supabase
                .from('calls' as any)
                .select('*')
                .eq('room_type', roomType)
                .eq('room_id', roomId)
                .eq('status', 'active')
                .limit(1)
                .maybeSingle();

            if (existingCall) {

                setActiveCall(existingCall as unknown as Call);
                return existingCall;
            }

            // Safety: ensure no other calls are marked active (cleanup)
            await supabase
                .from('calls' as any)
                .update({ status: 'ended', ended_at: new Date().toISOString() })
                .eq('room_type', roomType)
                .eq('room_id', roomId)
                .eq('status', 'active');

            // Generate unique room name for LiveKit
            const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const roomName = `CineCraft_${roomType}_${roomId}_${uniqueSuffix}`;
            // We use the same name for URL as LiveKit URLs are handled by the server URL + token
            const roomUrl = roomName;



            // Create new call
            const { data, error } = await supabase
                .from('calls' as any)
                .insert([{
                    room_type: roomType,
                    room_id: roomId,
                    daily_room_name: roomName,
                    daily_room_url: roomUrl,
                    started_by: user.id,
                    status: 'active'
                }])
                .select()
                .single();

            if (error) throw error;

            // Add self as participant
            const { error: participantError } = await supabase
                .from('call_participants' as any)
                .upsert([{
                    call_id: (data as any).id,
                    user_id: user.id,
                    status: 'joined'
                }], { onConflict: 'call_id,user_id' })
                .select();

            if (participantError) {
                console.error('Error adding participant:', participantError);
            }

            setActiveCall(data as unknown as Call);
            return data;
        } catch (error) {
            console.error('Error starting call:', error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const joinCall = async () => {
        if (!user || !activeCall) return false;

        try {
            const { error } = await supabase
                .from('call_participants' as any)
                .upsert([{
                    call_id: activeCall.id,
                    user_id: user.id,
                    status: 'requesting' // Or 'joined' depending on logic, keeping 'requesting' as per original
                }], { onConflict: 'call_id,user_id' })
                .select();

            if (error) {
                console.error('Error joining call:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error joining call:', error);
            return false;
        }
    };

    const endCall = async () => {
        try {

            const { error } = await supabase
                .from('calls' as any)
                .update({ status: 'ended', ended_at: new Date().toISOString() })
                .eq('room_type', roomType)
                .eq('room_id', roomId)
                .eq('status', 'active');

            if (error) {
                console.error("Failed to end calls in DB:", error);
                throw error;
            }

            setActiveCall(null);
        } catch (error) {
            console.error('Error ending call:', error);
        }
    };

    const leaveCall = async () => {
        if (!activeCall || !user) return;

        try {

            const { error } = await supabase
                .from('call_participants' as any)
                .update({ status: 'left', left_at: new Date().toISOString() })
                .eq('call_id', activeCall.id)
                .eq('user_id', user.id);

            if (error) {
                console.error("Failed to update participation status:", error);
            }

            // Also check if we should end the call if we're the only one (this usually is handled by server but good practice)
            // For now just clear local state
            setActiveCall(null);
        } catch (error) {
            console.error('Error leaving call:', error);
        }
    };

    return {
        activeCall,
        loading,
        startCall,
        joinCall,
        endCall,
        leaveCall
    };
};
