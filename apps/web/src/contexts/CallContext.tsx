import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';
import { canStartCalls, FAN_CALL_TOOLTIP } from '@/lib/calls/fanCallRule';
import { supabase } from '@/integrations/supabase/client';
import { postCallSystemMessage, sendCallNotifications, formatCallDuration } from '@/lib/calls/callSystemMessages';
import { fetchCallToken, callParticipantName, warmCallService } from '@/lib/calls/callToken';

interface CallState {
  isActive: boolean;
  roomId: string | null;            // Component/Room ID (e.g. Discussion UUID)
  connectionId: string | null;      // LiveKit Room Name (e.g. CineCraft_...)
  roomName: string | null;          // Display Name
  roomType: 'discussion' | 'project' | 'direct' | null;
  isMinimized: boolean;
  isPipHidden: boolean;
  userRole: 'creator' | 'admin' | 'member' | 'guest';
  /** 'audio_space' = voice-only room with host / speakers / listeners. */
  callMode?: 'call' | 'audio_space';
  speakingMode?: 'open' | 'request';
}

export interface StartCallOptions {
  mode?: 'audio_space';
  speakingMode?: 'open' | 'request';
}

interface CallContextType {
  callState: CallState;
  startCall: (roomType: 'discussion' | 'project' | 'direct', roomId: string, roomName: string, role?: string, options?: StartCallOptions) => Promise<boolean>;
  joinCall: (roomType: 'discussion' | 'project' | 'direct', roomId: string, roomName: string, role?: string) => Promise<boolean>;
  leaveCall: () => void;
  /** The call screen tells us when the other person actually joined (so a hang-up before that is recorded as a missed call). */
  markCallAnswered: () => void;
  toggleMinimize: (minimized?: boolean) => void;
  togglePipHidden: (hidden?: boolean) => void;
  reconcileCall: (roomType: 'discussion' | 'project' | 'direct', roomId: string) => Promise<{ canJoin: boolean; status: string; connectionId?: string }>;
  /** The call or audio space already running in a room, if any (so starting one never ends someone else's). */
  findActiveCall: (roomType: 'discussion' | 'project' | 'direct', roomId: string) => Promise<{ mode: 'call' | 'audio_space' } | null>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, profile } = useAuth();
  useEffect(() => { if (user?.id) warmCallService(); }, [user?.id]);
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    roomId: null,
    connectionId: null,
    roomName: null,
    roomType: null,
    isMinimized: false,
    isPipHidden: false,
    userRole: 'member',
  });

  const toggleMinimize = (minimized?: boolean) => {
    setCallState(prev => ({
      ...prev,
      isMinimized: minimized !== undefined ? minimized : !prev.isMinimized,
      isPipHidden: false, // Always unhide when toggling minimize/maximize
    }));
  };

  const togglePipHidden = (hidden?: boolean) => {
    setCallState(prev => ({
      ...prev,
      isPipHidden: hidden !== undefined ? hidden : !prev.isPipHidden,
    }));
  };

  const callStartTimeRef = useRef<number | null>(null);
  const callerRef = useRef(false);   // this person started the call
  const answeredRef = useRef(false); // the other person joined

  // Call Session Restoration
  useEffect(() => {
    if (!user) return;
    const restoreSession = async () => {
      try {
        const value = typeof localStorage !== 'undefined' ? localStorage.getItem('active_call_session') : null;
        if (value) {
          const session = JSON.parse(value);
          if (session?.roomId && session?.roomType) {
            const check = await reconcileCall(session.roomType, session.roomId);
            if (check.canJoin) {
              console.log('🔄 [PROCESS RECOVERY] Restoring active call session:', session);
              callerRef.current = false; answeredRef.current = true;
              setCallState({
                isActive: true,
                roomId: session.roomId,
                connectionId: session.connectionId || check.connectionId || session.roomId,
                roomName: session.roomName || 'Live Call',
                roomType: session.roomType,
                isMinimized: false,
                isPipHidden: false,
                userRole: session.userRole || 'member',
              });
            } else {
              localStorage.removeItem('active_call_session');
            }
          }
        }
      } catch (e) {
        console.warn('Call session restoration notice:', e);
      }
    };
    restoreSession();
  }, [user?.id]);

  const wasActiveRef = useRef(false);
  // Persist or clear active call session in storage
  useEffect(() => {
    if (callState.isActive && callState.roomId && callState.roomType) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          'active_call_session',
          JSON.stringify({
            roomId: callState.roomId,
            connectionId: callState.connectionId,
            roomName: callState.roomName,
            roomType: callState.roomType,
            userRole: callState.userRole,
          })
        );
      }
      wasActiveRef.current = true;
    } else if (!callState.isActive && wasActiveRef.current) {
      // only clear after a call really ran in this page. On a fresh page load callState starts inactive, and clearing then wiped the saved
      // call before the sign-in finished, so a reload could never put the person back into their call.
      wasActiveRef.current = false;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('active_call_session');
      }
    }
  }, [callState.isActive, callState.roomId, callState.roomType, callState.connectionId]);

  // Authoritative State Machine: Reconcile Call Status with Database
  const reconcileCall = async (roomType: 'discussion' | 'project' | 'direct', roomId: string) => {
    try {
      const { data, error } = await (supabase.rpc as any)('reconcile_call_state', {
        p_room_type: roomType,
        p_room_id: roomId,
      });

      if (error || !data) {
        return { canJoin: false, status: 'error' };
      }

      return {
        canJoin: !!data.can_join,
        status: data.status || 'none',
        connectionId: data.daily_room_name,
      };
    } catch (e) {
      console.warn('Error during reconcileCall:', e);
      return { canJoin: false, status: 'error' };
    }
  };

  const findActiveCall = async (roomType: 'discussion' | 'project' | 'direct', roomId: string) => {
    try {
      const cleanId = roomId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];
      const query = (cols: string) =>
        supabase
          .from('calls' as any)
          .select(cols)
          .eq('room_type', roomType)
          .in('status', ['active', 'ringing', 'initiating'])
          .like('daily_room_name', `CineCraft_%_${cleanId}_%`)
          .order('created_at', { ascending: false })
          .limit(5);
      let { data, error } = await query('daily_room_name, call_mode, created_at');
      // Database without the audio-space columns yet: still find ordinary calls so people can join them.
      if (error) ({ data } = await query('daily_room_name, created_at'));
      const callCutoff = Date.now() - 10 * 60 * 1000;
      const spaceCutoff = Date.now() - 24 * 60 * 60 * 1000;
      // A normal call only counts while it is recent; an audio space can legitimately run for hours.
      const hit = ((data as any[]) || []).find((r) => {
        const created = new Date(r.created_at).getTime();
        return r.call_mode === 'audio_space' ? created >= spaceCutoff : created >= callCutoff;
      });
      return hit ? { mode: (hit.call_mode === 'audio_space' ? 'audio_space' : 'call') as 'call' | 'audio_space' } : null;
    } catch {
      return null;
    }
  };

  const leaveCall = async () => {
    const activeRoomType = callState.roomType;
    const activeRoomId = callState.roomId;
    const isCallActive = callState.isActive;
    const isSpace = callState.callMode === 'audio_space';

    if (isCallActive && activeRoomId && activeRoomType && user) {
      try {
        // Match THIS call by its connection name. Without it, leaving one room's call could end a different
        // room's call (it used to pick "the latest active call of this type").
        let callQuery = supabase
          .from('calls' as any)
          .select('id, started_by')
          .eq('room_type', activeRoomType)
          .in('status', ['active', 'ringing', 'initiating']);
        if (callState.connectionId) callQuery = callQuery.eq('daily_room_name', callState.connectionId);
        const { data: activeCall } = await callQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (activeCall) {
          await supabase
            .from('call_participants' as any)
            .update({ status: 'left' })
            .eq('call_id', (activeCall as any).id)
            .eq('user_id', user.id);

          // An audio space keeps running for everyone else when one person leaves; only the host's "End space"
          // (space-control) closes it.
          if (!isSpace) {
            await supabase
              .from('calls' as any)
              .update({ status: 'ended', ended_at: new Date().toISOString() })
              .eq('id', (activeCall as any).id);
          }
        }
      } catch (err) {
        console.warn('Error in leaveCall cleanup:', err);
      }

      if (isSpace) {
        callStartTimeRef.current = null;
        setCallState({
          isActive: false,
          roomId: null,
          connectionId: null,
          roomName: null,
          roomType: null,
          isMinimized: false,
          isPipHidden: false,
          userRole: 'member',
        });
        sessionStorage.removeItem('was_answered_from_lockscreen');
        return;
      }

      const durationMs = callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 0;
      const formattedDuration = formatCallDuration(durationMs);
      // nobody ever joined this call (caller hung up, the person declined, or never picked up): a missed call, not a call with a duration
      const missed = activeRoomType === 'direct' && callerRef.current && !answeredRef.current;
      postCallSystemMessage(activeRoomType, activeRoomId, missed ? 'missed' : 'ended', missed ? undefined : formattedDuration, user.id);

      // Broadcast call_ended so partner ends call automatically (cellular style)
      try {
        const cleanId = (activeRoomId || '').replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];
        const bcChannel = supabase.channel('global-call-invites-broadcast');
        bcChannel.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { roomId: activeRoomId, cleanId },
        });
      } catch (bcErr) {}
    }

    callStartTimeRef.current = null;
    setCallState({
      isActive: false,
      roomId: null,
      connectionId: null,
      roomName: null,
      roomType: null,
      isMinimized: false,
      isPipHidden: false,
      userRole: 'member',
    });

    sessionStorage.removeItem('was_answered_from_lockscreen');
  };

  // Cleanup on logout
  useEffect(() => {
    if (!user && callState.isActive) {
      leaveCall();
    }
  }, [user, callState.isActive]);

  const joinCall = async (roomType: 'discussion' | 'project' | 'direct', roomId: string, roomName: string, role: string = 'member') => {
    let currentUserId = user?.id;
    if (!currentUserId) {
      const { data } = await supabase.auth.getSession();
      currentUserId = data.session?.user?.id;
    }
    if (!currentUserId) {
      console.warn('[joinCall] No active authenticated user found to join call');
      return false;
    }

    let connectionId = roomId;
    let callJoined = false;
    const participantName = callParticipantName(profile, { id: currentUserId, email: user?.email });
    let joinedMode: 'call' | 'audio_space' = 'call';
    let joinedSpeaking: 'open' | 'request' = 'request';

    // Authoritative State Machine: Atomic Answer Call
    try {
      const { data: answerResult, error: answerError } = await (supabase.rpc as any)('answer_call', {
        p_room_type: roomType,
        p_room_id: roomId,
      });

      if (!answerError && answerResult && answerResult.success) {
        connectionId = answerResult?.connection_id || roomId;
        callJoined = true;
        fetchCallToken(connectionId, participantName).catch(() => {});
        joinedMode = answerResult?.call_mode === 'audio_space' ? 'audio_space' : 'call';
        joinedSpeaking = answerResult?.speaking_mode === 'open' ? 'open' : 'request';

        // Multi-Device Synchronization: Send silent cancellation to user's other devices
        try {
          supabase.functions.invoke('push-delivery', {
            body: {
              recipientIds: [currentUserId],
              type: 'call_answered',
              roomId: roomId,
              callId: answerResult?.call_id,
            },
          });
        } catch (syncErr) {
          console.warn('Multi-device answer sync notice:', syncErr);
        }
      } else {
        console.warn('[joinCall] RPC answer_call notice, falling back:', answerResult?.message || answerError?.message);
      }
    } catch (err) {
      console.warn('[joinCall] RPC answer_call exception, falling back:', err);
    }

    // Direct Table Fallback
    if (!callJoined) {
      try {
        const { data: existingCall } = await supabase
          .from('calls' as any)
          .select('*')
          .eq('room_type', roomType)
          .in('status', ['active', 'ringing', 'initiating'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingCall) {
          connectionId = (existingCall as any).daily_room_name || roomId;
          await supabase
            .from('call_participants' as any)
            .upsert([{
              call_id: (existingCall as any).id,
              user_id: currentUserId,
              status: 'joined',
              joined_at: new Date().toISOString(),
            }], { onConflict: 'call_id,user_id' });
        }
      } catch (fallbackErr) {
        console.warn('[joinCall] Direct fallback notice:', fallbackErr);
      }
    }

    callerRef.current = false; answeredRef.current = true;
    callStartTimeRef.current = Date.now();

    // Launch UI with validated connectionId
    setCallState({
      isActive: true,
      roomId,
      connectionId,
      roomName,
      roomType,
      isMinimized: false,
      isPipHidden: false,
      userRole: role as any,
      callMode: joinedMode,
      speakingMode: joinedSpeaking,
    });

    return true;
  };

  const startCall = async (roomType: 'discussion' | 'project' | 'direct', roomId: string, roomName: string, role: string = 'member', options?: StartCallOptions) => {
    if (!user) return false;
    // Fans can answer and join calls but not start them (the database enforces this too, part GG).
    if (!canStartCalls(profile?.account_type)) {
      toast({ title: FAN_CALL_TOOLTIP });
      return false;
    }

    try {
      // 1. Generate unique connection ID
      const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const connectionId = `CineCraft_${roomType}_${roomId}_${uniqueSuffix}`;
      let callStarted = false;

      // 2. Authoritative Database State Machine: Atomic Start Call
      try {
        const { data: startResult, error: startError } = await (supabase.rpc as any)('create_or_start_call', {
          p_room_type: roomType,
          p_room_id: roomId,
          p_connection_id: connectionId,
          p_call_mode: options?.mode === 'audio_space' ? 'audio_space' : 'call',
          p_speaking_mode: options?.speakingMode === 'open' ? 'open' : 'request',
        });

        if (!startError && startResult && startResult.success) {
          callStarted = true;
        } else if (options?.mode === 'audio_space') {
          // An audio space only exists as a database row with call_mode = 'audio_space'. Falling back to the plain
          // table insert below would quietly create an ordinary video call that nobody can join as a space.
          console.error('[startCall] Could not create the audio space:', startResult?.message || startError?.message);
          throw new Error('Audio spaces are not enabled on the server yet. The database update (part_n) and the livekit-token / space-control functions need to be deployed first.');
        } else {
          console.warn('[startCall] RPC create_or_start_call notice, falling back to direct table:', startResult?.message || startError?.message);
        }
      } catch (rpcErr) {
        // For a space there is no valid fallback (see above): surface the failure instead of starting a plain call.
        if (options?.mode === 'audio_space') throw rpcErr;
        console.warn('[startCall] RPC exception, falling back:', rpcErr);
      }

      // Fallback to direct insertion if RPC had an authorization or lag mismatch
      if (!callStarted) {
        try {
          const cleanRoomUuid = roomId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRoomUuid);

          // Safety cleanup of stale active calls
          await supabase
            .from('calls' as any)
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('room_type', roomType)
            .eq('daily_room_name', connectionId)
            .eq('status', 'active');

          const { data: newCall, error: insertError } = await supabase
            .from('calls' as any)
            .insert([{
              room_type: roomType,
              room_id: isUuid ? cleanRoomUuid : null,
              daily_room_name: connectionId,
              daily_room_url: connectionId,
              started_by: user.id,
              created_by: user.id,
              status: 'active',
              started_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (!insertError && newCall) {
            callStarted = true;
            await supabase
              .from('call_participants' as any)
              .upsert([{
                call_id: (newCall as any).id,
                user_id: user.id,
                status: 'joined',
                joined_at: new Date().toISOString(),
              }], { onConflict: 'call_id,user_id' });
          }
        } catch (tableErr) {
          console.warn('[startCall] Direct table insert notice:', tableErr);
        }
      }

      // Neither the database function nor the fallback created the call (for example the person blocked you, or you are not in this chat):
      // do not open a call screen and do not ring anybody.
      if (!callStarted) {
        console.warn('[startCall] The call could not be created, not ringing.');
        return false;
      }

      // the call screen needs a token; ask for it now so it is ready when the screen opens
      fetchCallToken(connectionId, callParticipantName(profile, user)).catch(() => {});

      // 3. Post start system message in chat
      const kind = options?.mode === 'audio_space' ? 'space' : 'call';
      postCallSystemMessage(roomType, roomId, 'started', undefined, user.id, kind);

      // 4. Dispatch FCM High-Priority Calling Push to Recipients
      sendCallNotifications(roomType, roomId, roomName, user.id, kind);

      // 5. Launch Live UI
      callerRef.current = true; answeredRef.current = false;
      callStartTimeRef.current = Date.now();

      setCallState({
        isActive: true,
        roomId,
        connectionId,
        roomName,
        roomType,
        isMinimized: false,
        isPipHidden: false,
        userRole: role as any,
        callMode: options?.mode === 'audio_space' ? 'audio_space' : 'call',
        speakingMode: options?.speakingMode === 'open' ? 'open' : 'request',
      });

      return true;
    } catch (err) {
      console.error('Error starting global call:', err);
      return false;
    }
  };

  return (
    <CallContext.Provider value={{ callState, startCall, joinCall, leaveCall, markCallAnswered: () => { answeredRef.current = true; }, toggleMinimize, togglePipHidden, reconcileCall, findActiveCall }}>
      {children}
    </CallContext.Provider>
  );
};

export const useGlobalCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useGlobalCall must be used within a CallProvider');
  }
  return context;
};
