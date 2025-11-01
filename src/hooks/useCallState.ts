import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  is_audio_enabled: boolean;
  is_video_enabled: boolean;
}

export interface ActiveCall {
  id: string;
  room_id: string;
  started_by: string;
  call_type: 'audio' | 'video';
  is_active: boolean;
  participant_count: number;
  started_at: string;
  ended_at: string | null;
}

export const useCallState = (roomId: string) => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isInCall, setIsInCall] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  // Fetch active call
  useEffect(() => {
    const fetchActiveCall = async () => {
      const { data } = await supabase
        .from('room_calls')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .single();

      if (data && (data.call_type === 'audio' || data.call_type === 'video')) {
        setActiveCall(data as ActiveCall);
      }
    };

    fetchActiveCall();

    // Subscribe to call changes
    const channel = supabase
      .channel(`room-calls-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_calls',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const call = payload.new as any;
            if (call.is_active && (call.call_type === 'audio' || call.call_type === 'video')) {
              setActiveCall(call as ActiveCall);
            } else {
              setActiveCall(null);
            }
          } else if (payload.eventType === 'DELETE') {
            setActiveCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Fetch participants
  useEffect(() => {
    if (!activeCall) {
      setParticipants([]);
      return;
    }

    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('call_participants')
        .select('*')
        .eq('call_id', activeCall.id)
        .is('left_at', null);

      setParticipants(data || []);
    };

    fetchParticipants();

    // Subscribe to participant changes
    const channel = supabase
      .channel(`call-participants-${activeCall.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_participants',
          filter: `call_id=eq.${activeCall.id}`,
        },
        () => {
          fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCall]);

  // Check if user is in call
  useEffect(() => {
    if (!user || !activeCall) {
      setIsInCall(false);
      return;
    }

    const userParticipant = participants.find(p => p.user_id === user.id && !p.left_at);
    setIsInCall(!!userParticipant);

    if (userParticipant) {
      setIsAudioEnabled(userParticipant.is_audio_enabled);
      setIsVideoEnabled(userParticipant.is_video_enabled);
    }
  }, [user, activeCall, participants]);

  const startCall = async (callType: 'audio' | 'video') => {
    if (!user) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('room_calls')
        .insert({
          room_id: roomId,
          started_by: user.id,
          call_type: callType,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join the call
      await joinCall(data.id);

      return data;
    } catch (error) {
      console.error('Error starting call:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const joinCall = async (callId?: string) => {
    if (!user) return false;

    const targetCallId = callId || activeCall?.id;
    if (!targetCallId) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('call_participants')
        .insert({
          call_id: targetCallId,
          user_id: user.id,
          is_audio_enabled: isAudioEnabled,
          is_video_enabled: isVideoEnabled,
        });

      if (error) throw error;

      setIsInCall(true);
      return true;
    } catch (error) {
      console.error('Error joining call:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const leaveCall = async () => {
    if (!user || !activeCall) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', activeCall.id)
        .eq('user_id', user.id)
        .is('left_at', null);

      if (error) throw error;

      setIsInCall(false);
      return true;
    } catch (error) {
      console.error('Error leaving call:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const endCall = async () => {
    if (!user || !activeCall || activeCall.started_by !== user.id) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('room_calls')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('id', activeCall.id);

      if (error) throw error;

      setActiveCall(null);
      setIsInCall(false);
      return true;
    } catch (error) {
      console.error('Error ending call:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggleAudio = async () => {
    if (!user || !activeCall || !isInCall) return;

    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);

    await supabase
      .from('call_participants')
      .update({ is_audio_enabled: newState })
      .eq('call_id', activeCall.id)
      .eq('user_id', user.id)
      .is('left_at', null);
  };

  const toggleVideo = async () => {
    if (!user || !activeCall || !isInCall) return;

    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);

    await supabase
      .from('call_participants')
      .update({ is_video_enabled: newState })
      .eq('call_id', activeCall.id)
      .eq('user_id', user.id)
      .is('left_at', null);
  };

  return {
    activeCall,
    participants,
    isInCall,
    isAudioEnabled,
    isVideoEnabled,
    loading,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleAudio,
    toggleVideo,
  };
};
