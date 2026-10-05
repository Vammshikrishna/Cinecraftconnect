import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Animated,
  Easing,
  Modal,
  ScrollView,
  Dimensions,
  StatusBar,
  Switch,
  PanResponder,
  BackHandler,
  Alert,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import {
  postCallSystemMessage,
  sendCallNotifications,
  formatCallDuration,
} from '../../services/callService';
import {
  enterPipMode,
  setAutoPipEnabled,
  addPipListener,
} from '../../services/pipService';
import { useGlobalCall } from '../../contexts/CallContext';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useLiveCall } from '../../hooks/useLiveCall';
import {
  joinLiveCall,
  leaveLiveCall,
  isLiveCallActive,
  setMicEnabled,
  setCameraEnabled,
  setSpeakerOn,
  flipCamera,
  sendCallData,
  rejoinLiveCall,
  setScreenShareEnabled,
  startRingback,
  stopRingback,
  playBusyTone,
} from '../../services/liveCall';
import { VideoView } from '@livekit/react-native';
import { beginCallSession, askHowToStart } from '../../services/callSession';
import { AudioSpaceView } from '../../components/calls/AudioSpaceView';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium Color Palette
const ORANGE = '#FF4B33';
const EMERALD = '#10B981';
const AMBER = '#F59E0B';
const DARK_BG = '#0F0F12';
const CARD_BG = '#18181C';
const SURFACE = '#141419';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.12)';
const GLASS_BG = 'rgba(255, 255, 255, 0.06)';

// Real video rendering helpers
const ABS_FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
const localPreviewStyle = {
  position: 'absolute' as const,
  right: 16,
  top: 16,
  width: 108,
  height: 156,
  borderRadius: 14,
  overflow: 'hidden' as const,
  backgroundColor: '#000000',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.12)',
};
const flipBtnStyle = {
  position: 'absolute' as const,
  right: 6,
  bottom: 6,
  width: 28,
  height: 28,
  borderRadius: 14,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
};

// PiP Constants
const PIP_WIDTH = 180;
const PIP_HEIGHT = 210;
const PIP_MARGIN = 12;
const PIP_SNAP_DAMPING = 14;
const PIP_SNAP_STIFFNESS = 120;

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  anim: Animated.Value;
}

export const CallScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const params = route?.params ?? {};
  const {
    roomId,
    roomType,
    roomName,
    partnerName,
    partnerId,
    isVideo = false,
  } = params;

  // Push notifications use 'room' for discussion rooms; the call tables and token function call it 'discussion'.
  const normalizedRoomType: 'direct' | 'project' | 'discussion' =
    roomType === 'project' ? 'project' : roomType === 'discussion' || roomType === 'room' ? 'discussion' : 'direct';

  // Global Call Context for seamless in-app PiP & state persistence
  const {
    callState,
    startCall,
    endCall,
    minimizeCall,
    maximizeCall,
    updateCallState,
  } = useGlobalCall();

  const { settings } = useUserSettings();

  const isMinimizedRef = useRef(false);
  const presenceChannelRef = useRef<any>(null);

  // Call States (Initialized according to user's APK settings)
  // Real media engine (LiveKit). Everything about who is connected / speaking / how good the line is comes from here.
  const live = useLiveCall();
  const callStatus: 'Connecting' | 'Connected' | 'Reconnecting' =
    live.phase === 'reconnecting'
      ? 'Reconnecting'
      : live.phase === 'connected' && live.remoteCount > 0
      ? 'Connected'
      : 'Connecting';
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(settings.call_mute_mic_on_join ?? false);
  const [isVideoOff, setIsVideoOff] = useState(settings.call_video_off_on_join ? true : !isVideo);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isNoiseSuppressionOn, setIsNoiseSuppressionOn] = useState(true);
  const [isHDVideoOn, setIsHDVideoOn] = useState(!settings.call_data_saver);
  const [isMirrorCameraOn, setIsMirrorCameraOn] = useState(true);
  const localLive = live.participants.find((p) => p.isLocal);
  const screenSharer = live.participants.find((p) => p.isScreenSharing && (p.isLocal || p.screenTrack));
  const isSpeaking = !!localLive?.isSpeaking && !isMuted;
  const anyoneSpeaking = live.participants.some((p) => p.isSpeaking);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isNativePip, setIsNativePip] = useState(false);
  const connectionQuality: 'excellent' | 'good' | 'poor' = live.quality === 'lost' ? 'poor' : live.quality;

  // User Profile, Room Members & Realtime Presence State
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    full_name?: string;
    username?: string;
    avatar_url?: string;
  } | null>(null);
  const [roomMembersList, setRoomMembersList] = useState<any[]>([]);
  const [ringingRequestedIds, setRingingRequestedIds] = useState<Set<string>>(new Set());

  // Modals & Popovers
  const [showReactions, setShowReactions] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  // Animated speaking glow for participants
  const speakingGlowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(speakingGlowAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(speakingGlowAnim, {
            toValue: 0.4,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      speakingGlowAnim.setValue(0);
    }
  }, [isSpeaking, speakingGlowAnim]);

  // System-level Android Picture-in-Picture lifecycle (outside app)
  useEffect(() => {
    setAutoPipEnabled(true);
    const sub = addPipListener((isInPip) => {
      setIsNativePip(isInPip);
      if (isInPip) {
        updateCallState({
          isActive: true,
          roomId,
          roomType,
          roomName,
          partnerName: partnerName || currentUserProfile?.full_name,
          partnerId,
          callDuration,
          isMuted,
          isSpeakerOn,
          isSpeaking,
          isVideoOff,
          callStatus,
        });
      }
    });

    return () => {
      if (sub && sub.remove) {
        sub.remove();
      }
    };
  }, [roomId, roomType, roomName, partnerName, partnerId, callDuration, isMuted, isSpeakerOn, isSpeaking, isVideoOff, callStatus, currentUserProfile, updateCallState]);

  // Fetch logged in user and room participants
  useEffect(() => {
    let isMounted = true;
    const fetchUserData = async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && isMounted) {
          const { data: prof } = await (supabase
            .from('profiles')
            .select('full_name, username, avatar_url')
            .eq('id', user.id)
            .maybeSingle() as any);
          if (prof && isMounted) {
            setCurrentUserProfile(prof);
          }

          if (roomType === 'discussion' && roomId) {
            const { data: mems } = await (supabase
              .from('room_members' as any)
              .select('user_id, profiles(id, full_name, username, avatar_url)')
              .eq('room_id', roomId) as any);
            if (mems && isMounted) {
              const mapped = mems
                .map((m: any) => ({ ...m.profiles, id: m.user_id || m.profiles?.id }))
                .filter((p: any) => p && p.full_name !== prof?.full_name);
              setRoomMembersList(mapped);
            }
          } else if (roomType === 'project' && roomId) {
            const cleanId = roomId.replace(/^CineCraft_project_/, '').split('_')[0];
            const { data: mems } = await (supabase
              .from('project_space_members' as any)
              .select('user_id, profiles(id, full_name, username, avatar_url)')
              .eq('project_space_id', cleanId) as any);
            if (mems && isMounted) {
              const mapped = mems
                .map((m: any) => ({ ...m.profiles, id: m.user_id || m.profiles?.id }))
                .filter((p: any) => p && p.full_name !== prof?.full_name);
              setRoomMembersList(mapped);
            }
          }
        }
      } catch (e) {
        console.warn('Error fetching call profile/members:', e);
      }
    };

    fetchUserData();
    return () => {
      isMounted = false;
    };
  }, [roomId, roomType]);

  // Participants shown in the UI come from the live media session (LiveKit), not a presence channel.
  const memberAvatars = useMemo(() => {
    const map = new Map<string, string>();
    roomMembersList.forEach((m: any) => {
      const id = m.id || m.user_id;
      if (id && m.avatar_url) map.set(id, m.avatar_url);
    });
    return map;
  }, [roomMembersList]);

  const activeRealtimeParticipants = useMemo(
    () =>
      live.participants.map((p) => ({
        userId: p.identity,
        fullName: p.name,
        avatarUrl: memberAvatars.get(p.identity),
        isMuted: !p.isMicOn,
        isVideoOff: !p.isCameraOn,
        isSpeaking: p.isSpeaking,
      })),
    [live.participants, memberAvatars]
  );

  // Animations
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;

  // Equalizer Bars Animations
  const eqBar1 = useRef(new Animated.Value(8)).current;
  const eqBar2 = useRef(new Animated.Value(18)).current;
  const eqBar3 = useRef(new Animated.Value(28)).current;
  const eqBar4 = useRef(new Animated.Value(14)).current;
  const eqBar5 = useRef(new Animated.Value(8)).current;

  // Ripple Animations for Ringing State
  useEffect(() => {
    const createRipple = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1.35,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createRipple(pulseAnim1, 0);
    const anim2 = createRipple(pulseAnim2, 600);
    const anim3 = createRipple(pulseAnim3, 1200);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [pulseAnim1, pulseAnim2, pulseAnim3]);

  // Equalizer animation: runs only while a participant is actually speaking (LiveKit voice activity)
  useEffect(() => {
    if (callStatus !== 'Connected' || !anyoneSpeaking) {
      return;
    }

    const animateEq = (bar: Animated.Value, minH: number, maxH: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: maxH, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(bar, { toValue: minH, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );
    };

    const bars = [
      animateEq(eqBar1, 6, 24, 400),
      animateEq(eqBar2, 10, 32, 550),
      animateEq(eqBar3, 8, 36, 350),
      animateEq(eqBar4, 10, 26, 480),
      animateEq(eqBar5, 6, 20, 600),
    ];
    bars.forEach((b) => b.start());
    return () => bars.forEach((b) => b.stop());
  }, [callStatus, anyoneSpeaking, eqBar1, eqBar2, eqBar3, eqBar4, eqBar5]);

  // Live Monospace Call Duration Timer
  useEffect(() => {
    if (callStatus !== 'Connected') return;
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  const formatTimer = formatCallDuration;

  const currentUserIdRef = useRef<string | null>(null);
  const callDurationRef = useRef(0);
  const callActiveRef = useRef(callState.isActive);
  callActiveRef.current = callState.isActive;
  const hasEndedRef = useRef(false);

  // Keep global call context state in sync with local CallScreen controls
  useEffect(() => {
    updateCallState({
      callDuration,
      isMuted,
      isSpeakerOn,
      isSpeaking,
      isVideoOff,
      callStatus,
    });
  }, [callDuration, isMuted, isSpeakerOn, isSpeaking, isVideoOff, callStatus, updateCallState]);

  // Trigger Call Started system message and notifications on mount, or resume ongoing call
  useEffect(() => {
    let isMounted = true;
    const initCall = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          currentUserIdRef.current = user.id;

          // If resuming an already active call from in-app PiP
          if (callState.isActive && callState.roomId === roomId && isLiveCallActive()) {
            isMinimizedRef.current = false;
            maximizeCall();
            if (callState.callDuration) {
              setCallDuration(callState.callDuration);
              callDurationRef.current = callState.callDuration;
            }
            setIsMuted(callState.isMuted);
            setIsSpeakerOn(callState.isSpeakerOn);
            setIsVideoOff(callState.isVideoOff);
            return;
          }

          // The media session may still be running (user came back from the PiP bubble / chat).
          if (isLiveCallActive()) return;

          // Rooms and project spaces can run a normal call or an audio space: ask unless one is already running.
          const choice = params.callMode
            ? params.callMode === 'audio_space'
              ? ({ kind: 'space', speakingMode: params.speakingMode || 'request' } as const)
              : ({ kind: 'call' } as const)
            : await askHowToStart(roomType, roomId);
          if (!choice) {
            hasEndedRef.current = true;
            try {
              if (navigation?.canGoBack?.()) navigation.goBack();
            } catch {
              // navigation dismissed
            }
            return;
          }

          // Register new call globally
          startCall({
            roomId,
            roomType,
            roomName,
            partnerName,
            partnerId,
            isVideo: choice.kind === 'space' ? false : isVideo,
          });

          // Connect the real audio/video session (shared with the in-room Call tab).
          await beginCallSession({
            roomType,
            roomId,
            roomName,
            partnerName,
            partnerId,
            isVideo: choice.kind === 'space' ? false : isVideo,
            mode: choice.kind === 'space' ? 'audio_space' : undefined,
            speakingMode: choice.kind === 'space' ? choice.speakingMode : undefined,
            startMuted: !!settings.call_mute_mic_on_join,
            videoOffOnJoin: !!settings.call_video_off_on_join,
            speakerOn: isSpeakerOn,
            onData: (msg) => {
              if (msg.type === 'reaction' && msg.emoji) showReactionFromPeer(msg.emoji);
            },
          });
        }
      } catch (err) {
        console.warn('[CallScreen] Init call system message error:', err);
      }
    };

    initCall();

    return () => {
      isMounted = false;
      // CRITICAL: Only send 'ended' if NOT minimized!
      // When minimized, the user is just navigating to chat/feed while call stays active in PiP.
      if (!isMinimizedRef.current && !hasEndedRef.current && currentUserIdRef.current && callActiveRef.current) {
        hasEndedRef.current = true;
        const durStr = formatCallDuration(callDurationRef.current);
        postCallSystemMessage(roomType, roomId, 'ended', durStr, currentUserIdRef.current, partnerId);
        broadcastCallEnded();
        endCall();
      }
    };
  }, [roomId, roomType, roomName, partnerName, isVideo, partnerId]);

  // Tell the other devices (web app listens on the same channel) that the call is over.
  const broadcastCallEnded = useCallback(() => {
    try {
      const ch = getSupabaseClient().channel('global-call-invites-broadcast');
      ch.send({ type: 'broadcast', event: 'call_ended', payload: { roomId, cleanId: roomId } });
    } catch {
      // best effort
    }
  }, [roomId]);

  const handleEndCall = useCallback(() => {
    isMinimizedRef.current = false;
    if (!hasEndedRef.current) {
      hasEndedRef.current = true;
      const durStr = formatCallDuration(callDurationRef.current);
      postCallSystemMessage(roomType, roomId, 'ended', durStr, currentUserIdRef.current || undefined, partnerId).catch(() => {});
      broadcastCallEnded();
    }
    endCall();
    try {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      } else if (navigation?.navigate) {
        navigation.navigate('MainTabs');
      }
    } catch {
      // navigation dismissed
    }
  }, [navigation, roomType, roomId, partnerId, endCall]);

  // Ringing tone, no-answer timeout, hang-up when the other person leaves, declined/cancelled handling and
  // setup-failure messages are handled app-wide by <CallLifecycle/> so they also work from the in-room Call tab.
  // When the call ends for any reason while this screen is open, close it.
  const callWasActiveRef = useRef(false);
  useEffect(() => {
    if (callState.isActive) {
      callWasActiveRef.current = true;
      return;
    }
    if (callWasActiveRef.current && !isMinimizedRef.current && !hasEndedRef.current) {
      callWasActiveRef.current = false;
      hasEndedRef.current = true;
      try {
        if (navigation?.canGoBack?.()) navigation.goBack();
      } catch {
        // navigation dismissed
      }
    }
  }, [callState.isActive]);

  // Trigger In-App Picture-in-Picture (WhatsApp-Style)
  // Keeps call alive globally and navigates back to previous app screen with floating draggable bubble
  const handleMinimizeToPip = useCallback(() => {
    isMinimizedRef.current = true;
    updateCallState({
      isActive: true,
      isMinimized: true,
      roomId,
      roomType,
      roomName,
      partnerName,
      partnerId,
      isVideo,
      callDuration: callDurationRef.current,
      isMuted,
      isSpeakerOn,
      isSpeaking,
      isVideoOff,
      callStatus,
    });
    minimizeCall();

    try {
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      } else if (navigation?.navigate) {
        navigation.navigate('MainTabs');
      }
    } catch (e) {
      console.warn('[CallScreen] Minimize navigation back error:', e);
    }
  }, [
    updateCallState,
    minimizeCall,
    roomId,
    roomType,
    roomName,
    partnerName,
    partnerId,
    isVideo,
    isMuted,
    isSpeakerOn,
    isSpeaking,
    isVideoOff,
    callStatus,
    navigation,
  ]);

  // Handle hardware back button to minimize to in-app PiP
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleMinimizeToPip();
      return true;
    });
    return () => backHandler.remove();
  }, [handleMinimizeToPip]);

  // Request/Ring member to join call
  const handleRequestToJoin = (member: any) => {
    const memberId = member.id || member.user_id;
    if (!memberId) return;
    setRingingRequestedIds((prev) => new Set(prev).add(memberId));
    sendCallNotifications(
      roomType,
      roomId,
      roomName || partnerName || 'Live Call',
      currentUserIdRef.current || '',
      isVideo
    );
  };

  // Floating Emoji Handler
  const showReactionFromPeer = (emoji: string) => {
    const newId = `${Date.now()}_${Math.random()}`;
    const anim = new Animated.Value(0);
    const randomX = Math.floor(Math.random() * (SCREEN_WIDTH - 120)) + 40;
    setFloatingEmojis((prev) => [...prev, { id: newId, emoji, x: randomX, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newId));
    });
  };

  const sendReaction = (emoji: string) => {
    sendCallData({ type: 'reaction', emoji });
    const newId = `${Date.now()}_${Math.random()}`;
    const anim = new Animated.Value(0);
    const randomX = Math.floor(Math.random() * (SCREEN_WIDTH - 120)) + 40;

    const newEmoji: FloatingEmoji = {
      id: newId,
      emoji,
      x: randomX,
      anim,
    };

    setFloatingEmojis((prev) => [...prev, newEmoji]);
    setShowReactions(false);

    Animated.timing(anim, {
      toValue: 1,
      duration: 1800,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newId));
    });
  };

  const displayName = (partnerName || roomName || 'Live Session').trim() || 'Session';
  const displayInitial = displayName.charAt(0).toUpperCase();

  // Compute participant counts
  const liveConnectedCount = useMemo(() => {
    const realtimeCount = activeRealtimeParticipants.length;
    if (realtimeCount > 0) return realtimeCount;
    // Fallback: at least 2 (caller + partner)
    return roomType === 'direct' ? 2 : Math.max(roomMembersList.length + 1, 2);
  }, [activeRealtimeParticipants.length, roomMembersList.length, roomType]);

  // Members not yet connected
  const activeIds = useMemo(
    () => new Set(activeRealtimeParticipants.map((p) => p.userId)),
    [activeRealtimeParticipants]
  );
  const notInCallMembers = useMemo(
    () => roomMembersList.filter((m) => !activeIds.has(m.id || m.user_id)),
    [roomMembersList, activeIds]
  );

  // Connection quality color
  const qualityColor = connectionQuality === 'excellent' ? EMERALD
    : connectionQuality === 'good' ? AMBER
    : '#EF4444';

  // When in PiP mode (either OS PiP outside app or in-app minimized),
  // return null so GlobalCallPipOverlay renders the unified, edge-to-edge PiP card.
  if (isNativePip || isMinimized) {
    return null;
  }

  // Audio space: its own layout (stage + listeners), same app-wide call lifecycle.
  if (live.mode === 'audio_space') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8 }}>
          <TouchableOpacity style={styles.minimizeBtn} onPress={handleMinimizeToPip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="chevron-down" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <AudioSpaceView roomName={displayName} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />

      {/* ── 1. Top Header Bar ──────────────────────────────────────────────── */}
      <View style={styles.topHeader}>
        {/* Left: Speaker / Earpiece Toggle Pill */}
        <TouchableOpacity
          style={styles.speakerPill}
          onPress={() => {
            const next = !isSpeakerOn;
            setIsSpeakerOn(next);
            void setSpeakerOn(next);
          }}
          activeOpacity={0.7}
        >
          <Icon
            name={isSpeakerOn ? 'volume-2' : 'volume-x'}
            size={14}
            color={isSpeakerOn ? EMERALD : '#94A3B8'}
          />
          <Text style={[styles.speakerText, isSpeakerOn && styles.speakerTextActive]}>
            {isSpeakerOn ? 'Speaker' : 'Earpiece'}
          </Text>
        </TouchableOpacity>

        {/* Center: Live Call Status / Monospace Duration Pill */}
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: callStatus === 'Connected' ? qualityColor : ORANGE },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: callStatus === 'Connected' ? qualityColor : '#FDBA74' },
            ]}
          >
            {callStatus === 'Connected' ? formatTimer(callDuration) : 'Ringing...'}
          </Text>
        </View>

        {/* Right: Chat & Minimize Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.chatHeaderBtn}
            onPress={handleMinimizeToPip}
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="message-square" size={15} color="#FFFFFF" />
            <Text style={styles.chatHeaderText}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.minimizeBtn}
            onPress={handleMinimizeToPip}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="chevron-down" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>


      {/* ── 2. Floating Reaction Emojis Overlay ──────────────────────────────── */}
      <View pointerEvents="none" style={styles.floatingEmojisContainer}>
        {floatingEmojis.map((item) => {
          const translateY = item.anim.interpolate({
            inputRange: [0, 1],
            outputRange: [SCREEN_HEIGHT * 0.65, 80],
          });
          const opacity = item.anim.interpolate({
            inputRange: [0, 0.15, 0.75, 1],
            outputRange: [0, 1, 0.9, 0],
          });
          const scale = item.anim.interpolate({
            inputRange: [0, 0.2, 1],
            outputRange: [0.6, 1.25, 1],
          });

          return (
            <Animated.Text
              key={item.id}
              style={[
                styles.floatingEmoji,
                {
                  left: item.x,
                  transform: [{ translateY }, { scale }],
                  opacity,
                },
              ]}
            >
              {item.emoji}
            </Animated.Text>
          );
        })}
      </View>

      {/* ── 3. Main Calling Stage Arena ────────────────────────────────────── */}
      <View style={styles.stage}>
        {screenSharer ? (
          /* Screen-share stage: show the shared screen full-size (never our own, to avoid a mirror loop) */
          <View style={styles.videoStage}>
            <View style={[styles.videoTile, { backgroundColor: '#000000' }]}>
              {screenSharer.isLocal ? (
                <View style={styles.videoPlaceholderAvatar}>
                  <Icon name="monitor" size={34} color="#FFFFFF" />
                </View>
              ) : (
                <VideoView style={ABS_FILL} videoTrack={screenSharer.screenTrack} objectFit="contain" />
              )}
              <View style={styles.videoNameTag}>
                <Text style={styles.videoNameText} numberOfLines={1}>
                  {screenSharer.isLocal ? 'You are sharing your screen' : `${screenSharer.name} is sharing their screen`}
                </Text>
              </View>
            </View>
            {screenSharer.isLocal ? (
              <TouchableOpacity
                style={[styles.endCallBtn, { alignSelf: 'center', marginTop: 16, width: 'auto', paddingHorizontal: 22 }]}
                onPress={() => void setScreenShareEnabled(false)}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Stop sharing</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : isVideoOff ? (
          /* Audio Stage / Concentric Ripple Rings Mode */
          <View style={styles.audioStage}>
            {/* Concentric Ripple Rings */}
            <View style={styles.rippleCenter}>
              <Animated.View
                style={[
                  styles.rippleOuter,
                  {
                    transform: [{ scale: pulseAnim3 }],
                    opacity: pulseAnim3.interpolate({
                      inputRange: [1, 1.35],
                      outputRange: [0.35, 0],
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.rippleMiddle,
                  {
                    transform: [{ scale: pulseAnim2 }],
                    opacity: pulseAnim2.interpolate({
                      inputRange: [1, 1.35],
                      outputRange: [0.45, 0],
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.rippleInner,
                  {
                    transform: [{ scale: pulseAnim1 }],
                    opacity: pulseAnim1.interpolate({
                      inputRange: [1, 1.35],
                      outputRange: [0.6, 0],
                    }),
                  },
                ]}
              />

              {/* Large Caller Avatar */}
              <View
                style={[
                  styles.avatarWrapper,
                  isSpeaking && styles.avatarWrapperSpeaking,
                ]}
              >
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarInitial}>{displayInitial}</Text>
                </View>
              </View>
            </View>

            {/* Caller Name & Subtitle */}
            <Text style={styles.callerTitle} numberOfLines={1}>
              {displayName}
            </Text>

            {/* Call State / Speaking Pill */}
            {callStatus === 'Connected' ? (
              <View style={styles.speakingBadge}>
                <View style={[styles.speakingDot, isSpeaking && styles.speakingDotActive]} />
                <Text style={styles.speakingText}>
                  {isSpeaking ? 'Speaking' : isMuted ? 'Muted' : 'Connected'}
                </Text>
              </View>
            ) : (
              <View style={styles.ringingBadge}>
                <View style={styles.ringingDot} />
                <Text style={styles.ringingText}>Ringing...</Text>
              </View>
            )}

            {/* Room Type Pill */}
            {roomType && (
              <View style={styles.roomTypePill}>
                <Icon
                  name={roomType === 'direct' ? 'user' : roomType === 'project' ? 'briefcase' : 'radio'}
                  size={12}
                  color="#94A3B8"
                />
                <Text style={styles.roomTypeText}>
                  {roomType === 'direct'
                    ? 'Direct Call'
                    : roomType === 'project'
                    ? 'Project Space Call'
                    : 'Discussion Room'}
                </Text>
              </View>
            )}

            {/* Real-time Animated Equalizer Sound Wave Bars */}
            {callStatus === 'Connected' && (
              <View style={styles.equalizerRow}>
                <Animated.View style={[styles.equalizerBar, { height: eqBar1 }]} />
                <Animated.View style={[styles.equalizerBar, { height: eqBar2 }]} />
                <Animated.View style={[styles.equalizerBar, { height: eqBar3 }]} />
                <Animated.View style={[styles.equalizerBar, { height: eqBar4 }]} />
                <Animated.View style={[styles.equalizerBar, { height: eqBar5 }]} />
              </View>
            )}
          </View>
        ) : (
          /* Video Stage Arena: first remote camera full-size, own camera as a small preview */
          <View style={styles.videoStage}>
            {(() => {
              const remoteWithVideo = live.participants.find((p) => !p.isLocal && p.isCameraOn && p.videoTrack);
              const me = live.participants.find((p) => p.isLocal);
              return (
                <>
                  <View style={styles.videoTile}>
                    {remoteWithVideo ? (
                      <VideoView
                        style={ABS_FILL}
                        videoTrack={remoteWithVideo.videoTrack}
                        objectFit="cover"
                      />
                    ) : (
                      <View style={styles.videoPlaceholderAvatar}>
                        <Text style={styles.videoPlaceholderText}>{displayInitial}</Text>
                      </View>
                    )}
                    <View style={styles.videoNameTag}>
                      <Text style={styles.videoNameText} numberOfLines={1}>
                        {remoteWithVideo ? remoteWithVideo.name : callStatus === 'Connected' ? displayName : 'Calling…'}
                      </Text>
                    </View>
                  </View>
                  {me?.isCameraOn && me.videoTrack ? (
                    <View style={localPreviewStyle}>
                      <VideoView
                        style={ABS_FILL}
                        videoTrack={me.videoTrack}
                        objectFit="cover"
                        mirror={isMirrorCameraOn}
                        zOrder={1}
                      />
                      <TouchableOpacity style={flipBtnStyle} onPress={() => void flipCamera()} activeOpacity={0.8}>
                        <Icon name="refresh-cw" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              );
            })()}
          </View>
        )}
      </View>

      {/* ── Connection lost: offer to rejoin instead of silently losing the call ───────────────────────── */}
      {live.phase === 'dropped' && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 15, 18, 0.92)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 28,
            zIndex: 50,
          }}
        >
          <Icon name="wifi-off" size={44} color="#EF4444" />
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 16 }}>Connection lost</Text>
          <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            You were disconnected from the call. The call may still be running — tap Rejoin to get back in.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 24,
              backgroundColor: EMERALD,
              borderRadius: 28,
              paddingVertical: 14,
              paddingHorizontal: 40,
            }}
            onPress={() => void rejoinLiveCall()}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Rejoin call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 14, padding: 10 }} onPress={handleEndCall} activeOpacity={0.7}>
            <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '700' }}>Leave</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── 4. Reaction Picker Popover (Centered above Control Bar) ──────────── */}
      {showReactions && (
        <View style={styles.reactionPopover}>
          {['❤️', '👏', '🔥', '😂', '😮', '😢', '👍', '🎉'].map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionBtn}
              onPress={() => sendReaction(emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── 5. Fixed Bottom Floating Island Control Bar ────────────────────── */}
      <View style={styles.bottomBarContainer}>
        <View style={styles.islandControlBar}>
          {/* Core Media Controls */}
          <View style={styles.coreControlsRow}>
            {/* Mic Toggle */}
            <TouchableOpacity
              style={[styles.ctrlActionBtn, isMuted && styles.ctrlActionBtnMuted]}
              onPress={() => {
                const next = !isMuted;
                setIsMuted(next);
                void setMicEnabled(!next);
              }}
              activeOpacity={0.75}
            >
              <Icon
                name={isMuted ? 'mic-off' : 'mic'}
                size={19}
                color={isMuted ? '#EF4444' : '#FFFFFF'}
              />
            </TouchableOpacity>

            {/* Video Toggle */}
            <TouchableOpacity
              style={[styles.ctrlActionBtn, isVideoOff && styles.ctrlActionBtnMuted]}
              onPress={async () => {
                const turnOn = isVideoOff;
                const ok = await setCameraEnabled(turnOn);
                if (ok || !turnOn) setIsVideoOff(!turnOn);
                else Alert.alert('Camera unavailable', 'Allow camera access to turn your video on.');
              }}
              activeOpacity={0.75}
            >
              <Icon
                name={isVideoOff ? 'video-off' : 'video'}
                size={19}
                color={isVideoOff ? '#EF4444' : '#FFFFFF'}
              />
            </TouchableOpacity>

            {/* End Call Button */}
            <TouchableOpacity
              style={styles.endCallBtn}
              onPress={handleEndCall}
              activeOpacity={0.8}
            >
              <Icon name="phone-off" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Vertical Glass Separator */}
          <View style={styles.ctrlDivider} />

          {/* Secondary In-Call Actions */}
          <View style={styles.secondaryControlsRow}>
            {/* Switch to Chat Button */}
            <TouchableOpacity
              style={styles.ctrlIconBtn}
              onPress={handleMinimizeToPip}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="message-square" size={18} color="#E2E8F0" />
            </TouchableOpacity>

            {/* Screen share (Android) */}
            {Platform.OS === 'android' && (
              <TouchableOpacity
                style={[styles.ctrlIconBtn, live.isScreenSharing && styles.ctrlIconBtnActive]}
                onPress={async () => {
                  const ok = await setScreenShareEnabled(!live.isScreenSharing);
                  if (!ok && !live.isScreenSharing) {
                    Alert.alert('Screen sharing', 'Screen sharing was cancelled or is not available right now.');
                  }
                }}
                activeOpacity={0.75}
              >
                <Icon name="monitor" size={18} color={live.isScreenSharing ? ORANGE : '#E2E8F0'} />
              </TouchableOpacity>
            )}

            {/* Reactions Popover Trigger */}
            <TouchableOpacity
              style={[styles.ctrlIconBtn, showReactions && styles.ctrlIconBtnActive]}
              onPress={() => {
                setShowReactions((prev) => !prev);
                setShowParticipants(false);
                setShowSettings(false);
              }}
              activeOpacity={0.75}
            >
              <Icon
                name="smile"
                size={18}
                color={showReactions ? ORANGE : '#E2E8F0'}
              />
            </TouchableOpacity>

            {/* Participants Modal Trigger */}
            <TouchableOpacity
              style={[styles.ctrlIconBtn, showParticipants && styles.ctrlIconBtnActive]}
              onPress={() => {
                setShowParticipants(true);
                setShowReactions(false);
                setShowSettings(false);
              }}
              activeOpacity={0.75}
            >
              <Icon
                name="users"
                size={18}
                color={showParticipants ? ORANGE : '#E2E8F0'}
              />
              <View style={styles.participantBadge}>
                <Text style={styles.participantBadgeText}>
                  {liveConnectedCount}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Settings Modal Trigger */}
            <TouchableOpacity
              style={[styles.ctrlIconBtn, showSettings && styles.ctrlIconBtnActive]}
              onPress={() => {
                setShowSettings(true);
                setShowReactions(false);
                setShowParticipants(false);
              }}
              activeOpacity={0.75}
            >
              <Icon
                name="settings"
                size={18}
                color={showSettings ? ORANGE : '#E2E8F0'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── 6. Participants Modal (Premium Centered Card) ──────────────────── */}
      <Modal
        visible={showParticipants}
        transparent
        animationType="fade"
        onRequestClose={() => setShowParticipants(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowParticipants(false)}
          />
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalSubtitle}>PEOPLE</Text>
                <Text style={styles.modalTitle}>
                  In This Call ({liveConnectedCount})
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowParticipants(false)}
              >
                <Icon name="x" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Participants List */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Connected Section */}
              <View style={styles.sectionHeaderRow}>
                <Icon name="wifi" size={10} color={EMERALD} />
                <Text style={styles.sectionHeaderTitle}>CONNECTED ({liveConnectedCount})</Text>
              </View>

              {/* Local User (You) */}
              <View style={styles.participantItem}>
                <View style={styles.participantLeft}>
                  <View style={[styles.participantAvatar, isSpeaking && styles.participantAvatarSpeaking]}>
                    <Text style={styles.participantAvatarText}>
                      {(currentUserProfile?.full_name || currentUserProfile?.username || 'Y')[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.participantInfo}>
                    <View style={styles.participantNameRow}>
                      <Text style={styles.participantName} numberOfLines={1}>
                        {currentUserProfile?.full_name || currentUserProfile?.username || 'You'}
                      </Text>
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>You</Text>
                      </View>
                    </View>
                    <View style={styles.participantStatusRow}>
                      <View style={[styles.participantStatusIndicator, { backgroundColor: isSpeaking ? EMERALD : '#94A3B8' }]} />
                      <Text style={[styles.participantStatusText, isSpeaking && { color: EMERALD }]}>
                        {isSpeaking ? 'Speaking' : 'Connected'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.micIndicator, isMuted && styles.micIndicatorMuted]}>
                  <Icon name={isMuted ? 'mic-off' : 'mic'} size={14} color={isMuted ? '#EF4444' : EMERALD} />
                </View>
              </View>

              {/* Other Realtime Connected Members or Direct Call Partner */}
              {activeRealtimeParticipants.filter((p) => p.userId !== currentUserIdRef.current).length > 0 ? (
                activeRealtimeParticipants
                  .filter((p) => p.userId !== currentUserIdRef.current)
                  .map((p, idx) => {
                    const pName = p.fullName || `Participant ${idx + 1}`;
                    const pInit = pName[0]?.toUpperCase() || 'P';
                    const pMuted = p.isMuted;
                    const pSpeaking = p.isSpeaking;
                    return (
                      <View key={p.userId || idx} style={styles.participantItem}>
                        <View style={styles.participantLeft}>
                          <View
                            style={[
                              styles.participantAvatar,
                              styles.participantAvatarPartner,
                              pSpeaking && styles.participantAvatarSpeaking,
                            ]}
                          >
                            <Text style={styles.participantAvatarText}>{pInit}</Text>
                          </View>
                          <View style={styles.participantInfo}>
                            <Text style={styles.participantName} numberOfLines={1}>
                              {pName}
                            </Text>
                            <View style={styles.participantStatusRow}>
                              <View style={[styles.participantStatusIndicator, { backgroundColor: pSpeaking ? EMERALD : '#94A3B8' }]} />
                              <Text style={[styles.participantStatusText, pSpeaking && { color: EMERALD }]}>
                                {pSpeaking ? 'Speaking' : 'Connected'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={[styles.micIndicator, pMuted && styles.micIndicatorMuted]}>
                          <Icon name={pMuted ? 'mic-off' : 'mic'} size={14} color={pMuted ? '#EF4444' : EMERALD} />
                        </View>
                      </View>
                    );
                  })
              ) : (
                <View style={styles.participantItem}>
                  <View style={styles.participantLeft}>
                    <View style={[styles.participantAvatar, styles.participantAvatarPartner]}>
                      <Text style={styles.participantAvatarText}>{displayInitial}</Text>
                    </View>
                    <View style={styles.participantInfo}>
                      <Text style={styles.participantName} numberOfLines={1}>{displayName}</Text>
                      <View style={styles.participantStatusRow}>
                        <View style={[styles.participantStatusIndicator, { backgroundColor: EMERALD }]} />
                        <Text style={styles.participantStatusText}>Connected</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.micIndicator}>
                    <Icon name="mic" size={14} color={EMERALD} />
                  </View>
                </View>
              )}

              {/* Members Not in Call (Invite / Ring) */}
              {notInCallMembers.length > 0 && (
                <View style={styles.notInCallSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Icon name="user-x" size={10} color="#64748B" />
                    <Text style={styles.sectionHeaderTitle}>NOT IN CALL ({notInCallMembers.length})</Text>
                  </View>
                  {notInCallMembers.map((m, idx) => {
                    const mId = m.id || m.user_id || `${idx}`;
                    const mName = m.full_name || m.username || `Member ${idx + 1}`;
                    const mInit = mName[0]?.toUpperCase() || 'M';
                    const isRequested = ringingRequestedIds.has(mId);

                    return (
                      <View key={mId} style={styles.notInCallItem}>
                        <View style={styles.participantLeft}>
                          <View style={styles.notInCallAvatar}>
                            <Text style={styles.notInCallAvatarText}>{mInit}</Text>
                          </View>
                          <View style={styles.participantInfo}>
                            <Text style={styles.notInCallName} numberOfLines={1}>
                              {mName}
                            </Text>
                            <Text style={styles.notInCallStatus}>Offline</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.ringBtn,
                            isRequested ? styles.ringBtnActive : styles.ringBtnDefault,
                          ]}
                          disabled={isRequested}
                          onPress={() => handleRequestToJoin(m)}
                          activeOpacity={0.8}
                        >
                          <Icon
                            name={isRequested ? 'check' : 'bell'}
                            size={12}
                            color={isRequested ? EMERALD : '#FFFFFF'}
                          />
                          <Text
                            style={[
                              styles.ringBtnText,
                              isRequested && styles.ringBtnTextActive,
                            ]}
                          >
                            {isRequested ? 'Ringing...' : 'Request'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* E2EE Security Badge */}
              <View style={styles.securityBox}>
                <Icon name="shield" size={16} color={EMERALD} />
                <Text style={styles.securityText}>
                  Calls are encrypted in transit between your device and the call server.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 7. Settings Modal (Premium Card) ───────────────────────────────── */}
      <Modal
        visible={showSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowSettings(false)}
          />
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalSubtitle}>PREFERENCES</Text>
                <Text style={styles.modalTitle}>Call Settings</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowSettings(false)}
              >
                <Icon name="x" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Audio Section */}
              <View style={styles.settingSectionHeader}>
                <Icon name="headphones" size={12} color={ORANGE} />
                <Text style={styles.settingSectionTitle}>AUDIO</Text>
              </View>

              {/* Speaker Setting */}
              <View style={styles.settingRow}>
                <View style={styles.settingIconWrap}>
                  <Icon name="volume-2" size={16} color={isSpeakerOn ? EMERALD : '#94A3B8'} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Speakerphone</Text>
                  <Text style={styles.settingDescription}>Route audio through device loudspeaker</Text>
                </View>
                <Switch
                  value={isSpeakerOn}
                  onValueChange={(v) => {
                    setIsSpeakerOn(v);
                    void setSpeakerOn(v);
                  }}
                  trackColor={{ false: '#334155', true: 'rgba(16, 185, 129, 0.4)' }}
                  thumbColor={isSpeakerOn ? EMERALD : '#94A3B8'}
                />
              </View>

              {/* Noise Suppression */}
              <View style={styles.settingRow}>
                <View style={styles.settingIconWrap}>
                  <Icon name="zap" size={16} color={isNoiseSuppressionOn ? AMBER : '#94A3B8'} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Noise Suppression</Text>
                  <Text style={styles.settingDescription}>Filter background static and noise</Text>
                </View>
                <Switch
                  value={isNoiseSuppressionOn}
                  onValueChange={setIsNoiseSuppressionOn}
                  trackColor={{ false: '#334155', true: 'rgba(245, 158, 11, 0.4)' }}
                  thumbColor={isNoiseSuppressionOn ? AMBER : '#94A3B8'}
                />
              </View>

              {/* Video Section */}
              <View style={[styles.settingSectionHeader, { marginTop: 18 }]}>
                <Icon name="video" size={12} color={ORANGE} />
                <Text style={styles.settingSectionTitle}>VIDEO</Text>
              </View>

              {/* HD Video Quality */}
              <View style={styles.settingRow}>
                <View style={styles.settingIconWrap}>
                  <Icon name="monitor" size={16} color={isHDVideoOn ? ORANGE : '#94A3B8'} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>HD Video Stream</Text>
                  <Text style={styles.settingDescription}>High definition 720p/1080p stream</Text>
                </View>
                <Switch
                  value={isHDVideoOn}
                  onValueChange={setIsHDVideoOn}
                  trackColor={{ false: '#334155', true: 'rgba(255, 75, 51, 0.4)' }}
                  thumbColor={isHDVideoOn ? ORANGE : '#94A3B8'}
                />
              </View>

              {/* Mirror Front Camera */}
              <View style={styles.settingRow}>
                <View style={styles.settingIconWrap}>
                  <Icon name="refresh-cw" size={16} color={isMirrorCameraOn ? ORANGE : '#94A3B8'} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Mirror Front Camera</Text>
                  <Text style={styles.settingDescription}>Mirror selfie camera preview</Text>
                </View>
                <Switch
                  value={isMirrorCameraOn}
                  onValueChange={setIsMirrorCameraOn}
                  trackColor={{ false: '#334155', true: 'rgba(255, 75, 51, 0.4)' }}
                  thumbColor={isMirrorCameraOn ? ORANGE : '#94A3B8'}
                />
              </View>

              {/* E2EE Info Box */}
              <View style={styles.settingE2EEBox}>
                <Icon name="shield" size={16} color={EMERALD} />
                <View style={styles.settingE2EERight}>
                  <Text style={styles.settingE2EETitle}>Encrypted in transit</Text>
                  <Text style={styles.settingE2EEDesc}>
                    Audio and video are encrypted between your device and the call server.
                  </Text>
                </View>
              </View>

              {/* Connection Quality Info */}
              <View style={styles.connectionInfoBox}>
                <View style={styles.connectionInfoRow}>
                  <Icon name="wifi" size={14} color={qualityColor} />
                  <Text style={[styles.connectionInfoLabel, { color: qualityColor }]}>
                    Connection: {connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)}
                  </Text>
                </View>
                <Text style={styles.connectionInfoDesc}>
                  Call duration: {formatTimer(callDuration)}
                </Text>
              </View>

              {/* Primary Action Button */}
              <TouchableOpacity
                style={styles.saveCloseBtn}
                onPress={() => setShowSettings(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.saveCloseBtnText}>Save & Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },

  // ── Top Header ─────────────────────────────────────────────────────────────
  topHeader: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  speakerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  speakerText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  speakerTextActive: {
    color: '#FFFFFF',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  minimizeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 75, 51, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.5)',
  },
  chatHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Floating Emojis ────────────────────────────────────────────────────────
  floatingEmojisContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 150,
  },
  floatingEmoji: {
    position: 'absolute',
    fontSize: 42,
  },

  // ── Main Stage ─────────────────────────────────────────────────────────────
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  audioStage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  rippleCenter: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  rippleOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 75, 51, 0.25)',
    backgroundColor: 'rgba(255, 75, 51, 0.05)',
  },
  rippleMiddle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 75, 51, 0.35)',
    backgroundColor: 'rgba(255, 75, 51, 0.08)',
  },
  rippleInner: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 2,
    borderColor: 'rgba(255, 75, 51, 0.5)',
    backgroundColor: 'rgba(255, 75, 51, 0.15)',
  },
  avatarWrapper: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: ORANGE,
    padding: 3,
    backgroundColor: 'rgba(255, 75, 51, 0.25)',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  avatarWrapperSpeaking: {
    borderColor: EMERALD,
    shadowColor: EMERALD,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 50,
    backgroundColor: '#1E1E24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
  },
  callerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
    maxWidth: SCREEN_WIDTH - 64,
  },
  speakingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 12,
  },
  speakingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  speakingDotActive: {
    backgroundColor: EMERALD,
  },
  speakingText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  ringingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.3)',
    marginBottom: 12,
  },
  ringingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  ringingText: {
    color: '#FDBA74',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roomTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 24,
  },
  roomTypeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  equalizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    marginTop: 6,
  },
  equalizerBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: ORANGE,
  },

  // ── Video Stage ────────────────────────────────────────────────────────────
  videoStage: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.58,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  videoTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  videoPlaceholderAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  videoNameTag: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  videoNameText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Reaction Popover ───────────────────────────────────────────────────────
  reactionPopover: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 200,
  },
  reactionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  reactionEmojiText: {
    fontSize: 22,
  },

  // ── Fixed Bottom Floating Island Control Bar ──────────────────────────────
  bottomBarContainer: {
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    zIndex: 30,
  },
  islandControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 36,
    backgroundColor: 'rgba(24, 24, 28, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.75,
    shadowRadius: 30,
    elevation: 24,
  },
  coreControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctrlActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlActionBtnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  endCallBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  ctrlDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 10,
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctrlIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ctrlIconBtnActive: {
    backgroundColor: 'rgba(255, 75, 51, 0.2)',
    borderColor: 'rgba(255, 75, 51, 0.5)',
  },
  participantBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  // ── Modals & Sheets ────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0A0A0F',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 22,
    maxHeight: SCREEN_HEIGHT * 0.78,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalSubtitle: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    marginBottom: 8,
  },

  // ── Participant Items ──────────────────────────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionHeaderTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  participantInfo: {
    flex: 1,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 75, 51, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 75, 51, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarPartner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  participantAvatarSpeaking: {
    borderColor: EMERALD,
    borderWidth: 2.5,
    shadowColor: EMERALD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  participantAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 75, 51, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.3)',
  },
  youBadgeText: {
    color: ORANGE,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  participantStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  participantStatusIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  participantStatusText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  micIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIndicatorMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginTop: 12,
  },
  securityText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },

  // ── Not In Call Section ────────────────────────────────────────────────────
  notInCallSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  notInCallItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 8,
  },
  notInCallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notInCallAvatarText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  notInCallName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  notInCallStatus: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  ringBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  ringBtnDefault: {
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  ringBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  ringBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  ringBtnTextActive: {
    color: EMERALD,
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  settingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  settingSectionTitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  settingDescription: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  settingE2EEBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginTop: 18,
  },
  settingE2EERight: {
    flex: 1,
  },
  settingE2EETitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  settingE2EEDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 16,
  },
  connectionInfoBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 12,
  },
  connectionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connectionInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  connectionInfoDesc: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  saveCloseBtn: {
    backgroundColor: ORANGE,
    borderRadius: 18,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  saveCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Native System-Level Picture-in-Picture View ───────────────────────────
  nativePipRoot: {
    flex: 1,
    backgroundColor: '#0F0F12',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  nativePipGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F0F12',
  },
  nativePipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  nativePipLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  nativePipTimer: {
    color: EMERALD,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  nativePipCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativePipAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 75, 51, 0.25)',
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  nativePipAvatarSpeaking: {
    borderColor: EMERALD,
    borderWidth: 2,
  },
  nativePipAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  nativePipTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 120,
    textAlign: 'center',
  },
  nativePipBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  nativePipStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  nativePipStatus: {
    color: '#A7F3D0',
    fontSize: 9,
    fontWeight: '700',
  },

  // ── Picture-in-Picture (PiP) Floating Widget ──────────────────────────────
  pipRootContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 99999,
  },
  pipDraggableWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 99999,
  },
  pipCard: {
    width: PIP_WIDTH,
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 28,
  },
  pipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pipHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pipLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  pipTimer: {
    color: EMERALD,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pipExpandBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  pipAvatarOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: ORANGE,
    padding: 2,
    backgroundColor: 'rgba(255, 75, 51, 0.2)',
    marginBottom: 6,
  },
  pipAvatarSpeaking: {
    borderColor: EMERALD,
    borderWidth: 2.5,
    shadowColor: EMERALD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  pipAvatarInner: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: '#1E1E24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  pipName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 150,
  },
  pipSpeakingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pipSpeakingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: EMERALD,
  },
  pipSpeakingText: {
    color: EMERALD,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pipActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  pipActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipActionBtnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  pipActionBtnSpeaker: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  pipActionBtnEnd: {
    backgroundColor: '#DC2626',
    borderWidth: 0,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
});

export default CallScreen;
