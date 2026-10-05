import { lazy, Suspense, useEffect, useState } from 'react';
import { useGlobalCall } from '@/contexts/CallContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useNativeCallKit } from '@/hooks/useNativeCallKit';

const LiveKitCallContainer = lazy(() => import('./LiveKitCallContainer').then(m => ({ default: m.LiveKitCallContainer })));

interface IncomingCallInvite {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  roomId: string;
  roomName: string;
  roomType: 'project' | 'discussion' | 'direct';
  actionUrl?: string;
}

export const GlobalCallOverlay = () => {
  const { callState, leaveCall, joinCall } = useGlobalCall();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<IncomingCallInvite | null>(null);

  // Initialize native background / lockscreen callkit push handlers
  useNativeCallKit();

  // Listen to real-time incoming call invitations via Supabase Postgres changes AND Broadcast
  useEffect(() => {
    if (!user?.id) return;

    // Listener 1: Realtime Broadcast Channel
    const broadcastChannel = supabase.channel('global-call-invites-broadcast', {
      config: { broadcast: { self: true } }
    });

    broadcastChannel
      .on('broadcast', { event: 'incoming_call_invite' }, (payload) => {
        const data = payload.payload;
        if (data && data.targetUserId === user.id && data.callerId !== user.id) {
          setIncomingCall({
            callerId: data.callerId,
            callerName: data.callerName || 'Team Member',
            callerAvatar: data.callerAvatar,
            roomId: data.roomId,
            roomName: data.roomName || 'Live Call',
            roomType: data.roomType || 'project',
            actionUrl: data.actionUrl,
          });
        }
      })
      .subscribe();

    // Listener 2: Postgres DB Changes on notifications table filtered for current user
    const dbChannel = supabase.channel(`global-call-invites-db-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const n = payload.new;
          if (!n || n.trigger_user_id === user.id) return;

          const isCallNotification =
            n.type === 'call_invite' ||
            n.type === 'incoming_call' ||
            n.type === 'call_started' ||
            (n.title && n.title.toLowerCase().includes('call'));

          if (isCallNotification) {
            let callerName = 'Team Member';
            let callerAvatar = undefined;

            if (n.trigger_user_id) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('full_name, username, avatar_url')
                .eq('id', n.trigger_user_id)
                .maybeSingle();

              if (prof) {
                callerName = prof.full_name || prof.username || 'Team Member';
                callerAvatar = prof.avatar_url || undefined;
              }
            }

            const actionUrl = n.action_url || '';
            let roomType: 'project' | 'discussion' | 'direct' = 'project';
            let roomId = '';
            let roomName = 'Live Call';

            if (actionUrl.includes('discussion') || actionUrl.includes('room=')) {
              roomType = 'discussion';
              const match = actionUrl.match(/room=([^&]+)/);
              if (match) roomId = match[1];
            } else if (actionUrl.includes('project-space')) {
              roomType = 'project';
              const parts = actionUrl.replace('/project-space/', '').split('?')[0].split('/');
              roomId = parts[0] || '';
            } else if (actionUrl.includes('messages') || actionUrl.includes('chat=')) {
              roomType = 'direct';
              const chatMatch = actionUrl.match(/chat=([^&]+)/);
              if (chatMatch) {
                roomId = chatMatch[1];
              } else {
                const parts = actionUrl.split('/');
                roomId = parts[parts.length - 1] || '';
              }
            }

            roomId = roomId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];

            // Extract room name from notification message: "X started a call in RoomName"
            const inMatch = n.message?.match(/in (.+)$/);
            if (inMatch) roomName = inMatch[1].trim();
            else if (n.title) roomName = n.title;

            setIncomingCall({
              callerId: n.trigger_user_id || 'caller',
              callerName,
              callerAvatar,
              roomId: roomId || 'room',
              roomName,
              roomType,
              actionUrl: n.action_url,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  }, [user?.id]);

  // Play in-app Web Audio ringtone chime when incoming call overlay is visible
  useEffect(() => {
    if (!incomingCall || callState.isActive) return;

    let audioCtx: AudioContext | null = null;
    let intervalId: any = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();

        const playRingChime = () => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }

          const now = audioCtx.currentTime;
          const osc1 = audioCtx.createOscillator();
          const osc2 = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(audioCtx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.2);
          osc2.stop(now + 1.2);
        };

        playRingChime();
        intervalId = setInterval(playRingChime, 2500);
      }
    } catch (e) {
      console.warn('In-app ringtone audio creation failed:', e);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [incomingCall, callState.isActive]);

  // Auto-dismiss incoming call banner after 30 seconds
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => {
      setIncomingCall(null);
    }, 30000);
    return () => clearTimeout(timer);
  }, [incomingCall]);

  // Zero-RTT LiveKit Token Pre-warming while ringing (Discord / Zoom style)
  useEffect(() => {
    if (!incomingCall?.roomId || !user?.id) return;
    const participantName = profile?.full_name?.trim() || user?.email?.split('@')[0] || user.id;
    supabase.functions.invoke('livekit-token', {
      body: {
        roomName: incomingCall.roomId,
        participantName,
      },
    }).catch(() => {});
  }, [incomingCall?.roomId, user?.id]);

  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    const { roomType, roomId, roomName } = incomingCall;
    setIncomingCall(null);
    await joinCall(roomType, roomId, roomName, 'member');
  };

  const handleDeclineCall = () => {
    if (incomingCall) {
      const channel = supabase.channel('global-call-invites-broadcast');
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'call_declined',
            payload: {
              roomId: incomingCall.roomId,
              targetUserId: incomingCall.callerId,
              declinerId: user?.id,
            }
          });
        }
      });
    }
    setIncomingCall(null);
  };

  return (
    <>
      {/* Real-time Incoming Call Banner (Teams/WhatsApp Style) */}
      {incomingCall && !callState.isActive && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999999] w-[calc(100%-2rem)] max-w-md bg-[#0c0c14]/95 backdrop-blur-3xl border-2 border-primary/50 rounded-[28px] p-4 shadow-[0_20px_70px_rgba(255,107,0,0.5)] animate-in slide-in-from-top-6 duration-300">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary/30 to-orange-500/30 border-2 border-primary/60 flex items-center justify-center text-white font-black overflow-hidden shadow-inner">
                  {incomingCall.callerAvatar ? (
                    <img loading="lazy" decoding="async" src={incomingCall.callerAvatar} alt={incomingCall.callerName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base">{incomingCall.callerName[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0c0c14] flex items-center justify-center animate-pulse">
                  <PhoneCall className="w-2.5 h-2.5 text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Incoming Video Call</p>
                </div>
                <p className="text-base font-bold text-white truncate leading-tight mt-0.5">{incomingCall.callerName}</p>
                <p className="text-xs text-gray-300 truncate mt-0.5">Invited you to join <span className="text-primary font-bold">{incomingCall.roomName}</span></p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={handleDeclineCall}
                className="h-10 w-10 p-0 rounded-full bg-white/10 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-white/10 backdrop-blur-md transition-all"
                title="Decline"
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptCall}
                className="h-10 px-5 rounded-full bg-green-600 hover:bg-green-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all flex items-center gap-1.5 animate-pulse"
                title="Accept & Join Call"
              >
                <PhoneCall className="w-4 h-4" />
                Join Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active LiveKit Call View Container */}
      {callState.isActive && callState.roomId && (
        <Suspense fallback={null}>
          <LiveKitCallContainer
            // The LiveKit room is the call row's connection name (CineCraft_<type>_<id>_<suffix>), the same one mobile joins.
            // Passing the bare room id put web users in a different LiveKit room from everyone else and hid audio spaces.
            roomId={callState.connectionId || callState.roomId}
            roomName={callState.roomName || 'Call'}
            userRole={callState.userRole}
            onLeave={() => {
              leaveCall();
            }}
          />
        </Suspense>
      )}
    </>
  );
};
