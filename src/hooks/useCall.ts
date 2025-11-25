import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createDailyRoom } from '@/lib/daily';

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
            // Generate unique room name
            const roomName = `${roomType}-${roomId}-${Date.now()}`;

            // Create Daily.co room via API
            const dailyRoom = await createDailyRoom(roomName);

            if (!dailyRoom) {
                throw new Error('Failed to create Daily.co room');
            }

            const { data, error } = await supabase
                .from('calls' as any)
                .insert([{
                    room_type: roomType,
                    room_id: roomId,
                    daily_room_name: dailyRoom.name,
                    daily_room_url: dailyRoom.url,
                    started_by: user.id,
                    status: 'active'
                }])
                .select()
                .single();

            if (error) throw error;

            // Add self as participant (using upsert to avoid 409 conflict)
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
