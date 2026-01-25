import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Call {
    id: string;
    room_type: 'project' | 'discussion';
    room_id: string;
    daily_room_name: string;
    daily_room_url: string;
    status: 'active' | 'ended';
    started_by: string;
}

export const useCall = (roomType: 'project' | 'discussion', roomId: string) => {
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
            .maybeSingle();

        setActiveCall(data as Call | null);
    };

    const startCall = async () => {
        if (!user) return null;

        setLoading(true);
        try {
            // Generate unique room name for Jitsi
            // Using a strictly unique name to avoid random people joining
            const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const roomName = `CineCraft_${roomType}_${roomId}_${uniqueSuffix}`;
            const jitsiUrl = `https://meet.jit.si/${roomName}`;

            console.log("Starting Jitsi call:", jitsiUrl);

            // We store the Jitsi URL in the 'daily_room_url' column to reuse existing schema
            const { data, error } = await supabase
                .from('calls' as any)
                .insert([{
                    room_type: roomType,
                    room_id: roomId,
                    daily_room_name: roomName,
                    daily_room_url: jitsiUrl,
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
        if (!activeCall) return;

        try {
            await supabase
                .from('calls' as any)
                .update({ status: 'ended', ended_at: new Date().toISOString() })
                .eq('id', activeCall.id);

            setActiveCall(null);
        } catch (error) {
            console.error('Error ending call:', error);
        }
    };

    return {
        activeCall,
        loading,
        startCall,
        joinCall,
        endCall
    };
};
