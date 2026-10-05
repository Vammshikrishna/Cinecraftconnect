import { CachedImage } from '../common/CachedImage';
import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  AppState,
  StatusBar,
  Vibration,
  Modal,
  Image,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useGlobalCall } from '../../contexts/CallContext';
import {
  formatCallDuration,
  postCallSystemMessage,
} from '../../services/callService';
import { addPipListener } from '../../services/pipService';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ORANGE = '#FF4B33';
const EMERALD = '#10B981';
const PIP_WIDTH = 180;
const PIP_HEIGHT = 215;
const PIP_MARGIN = 12;

/**
 * GlobalCallPipOverlay
 * 
 * This component is rendered at the App root level (persists across all navigation).
 * When in Android OS Picture-in-Picture mode (outside the app), it renders a full-window
 * dedicated call UI so the OS PiP window displays only the call.
 * In-app, when minimized, it shows a draggable floating bubble.
 */
export const GlobalCallPipOverlay = ({ navigationRef }: { navigationRef?: any }) => {
  const { callState, updateCallState, endCall, maximizeCall, startCall } = useGlobalCall();
  const { settings } = useUserSettings();
  const [isNativePip, setIsNativePip] = useState(false);
  const prevNativePip = useRef(false);

  // Incoming call invite state
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    roomId: string;
    roomName: string;
    roomType: 'project' | 'discussion' | 'direct';
    isVideo?: boolean;
  } | null>(null);

  const {
    isActive,
    isMinimized,
    roomId,
    roomType,
    roomName,
    partnerName,
    partnerId,
    callDuration,
    isMuted,
    isSpeakerOn,
    isSpeaking,
    isVideoOff,
    callStatus,
  } = callState;

  const displayName = (partnerName || roomName || 'Live Session').trim() || 'Session';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const handleExpand = useCallback(() => {
    maximizeCall();
    try {
      if (navigationRef) {
        const doNavigate = () => {
          try {
            navigationRef.navigate('Call', {
              roomId,
              roomType,
              roomName,
              partnerName,
              partnerId,
              isVideo: !isVideoOff,
            });
          } catch (err) {
            console.warn('[GlobalCallPipOverlay] doNavigate error:', err);
          }
        };

        if (typeof navigationRef.isReady === 'function' ? navigationRef.isReady() : true) {
          doNavigate();
        } else {
          setTimeout(doNavigate, 120);
        }
      }
    } catch (err) {
      console.warn('[GlobalCallPipOverlay] Expand navigation error:', err);
    }
  }, [maximizeCall, navigationRef, roomId, roomType, roomName, partnerName, partnerId, isVideoOff]);

  // Listen to Android OS PiP mode changes
  useEffect(() => {
    const sub = addPipListener((inPip) => {
      console.log('[GlobalCallPipOverlay] Native OS PiP mode changed:', inPip, 'prev:', prevNativePip.current);
      if (prevNativePip.current && !inPip && isActive) {
        handleExpand();
      }
      prevNativePip.current = inPip;
      setIsNativePip(inPip);
    });
    return () => {
      sub?.remove();
    };
  }, [isActive, handleExpand]);

  // Listen for AppState changes when returning to active from background
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && prevNativePip.current && isActive) {
        handleExpand();
      }
    });
    return () => {
      appStateSub.remove();
    };
  }, [isActive, handleExpand]);

  // Real-time Incoming Call Invitations (Supabase Broadcast + Postgres DB)
  useEffect(() => {
    let broadcastChannel: any = null;
    let notifChannel: any = null;
    let isMounted = true;

    const setupListeners = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        // 1. Broadcast Channel
        broadcastChannel = supabase.channel('global-call-invites-broadcast');
        broadcastChannel
          .on('broadcast', { event: 'incoming_call_invite' }, (payload: any) => {
            const data = payload?.payload;
            if (data && data.targetUserId === user.id && data.callerId !== user.id) {
              // Respect user setting: Who can call me
              if (settings.allow_incoming_calls === 'nobody') return;

              setIncomingCall({
                callerId: data.callerId,
                callerName: data.callerName || 'Team Member',
                callerAvatar: data.callerAvatar,
                roomId: data.roomId,
                roomName: data.roomName || 'Live Call',
                roomType: data.roomType || 'direct',
                isVideo: !!data.isVideo,
              });

              if (settings.call_vibration !== false) {
                Vibration.vibrate([0, 600, 400, 600], true);
              }
            }
          })
          .subscribe();

        // 2. DB Postgres Changes on notifications
        notifChannel = supabase
          .channel(`global-call-invites-db-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${user.id}`,
            },
            async (payload: any) => {
              const n = payload?.new;
              if (!n || n.trigger_user_id === user.id) return;
              if (settings.allow_incoming_calls === 'nobody') return;

              const isCall =
                n.type === 'incoming_call' ||
                n.type === 'call_started' ||
                n.type === 'call_invite' ||
                (n.title && n.title.toLowerCase().includes('call'));

              if (isCall && n.action_url) {
                let rId = '';
                if (n.action_url.includes('chat=')) {
                  rId = n.action_url.split('chat=')[1]?.split('&')[0] || '';
                } else if (n.action_url.includes('discussion-rooms/')) {
                  rId = n.action_url.split('discussion-rooms/')[1]?.split('&')[0] || '';
                } else if (n.action_url.includes('space')) {
                  rId = n.action_url.split('/')[2] || '';
                }

                if (rId) {
                  setIncomingCall({
                    callerId: n.trigger_user_id,
                    callerName: n.title?.replace(/ is calling you\.\.\./i, '') || 'Crew Member',
                    roomId: rId,
                    roomName: 'Live Call',
                    roomType: 'direct',
                    isVideo: n.title?.includes('Video') ?? false,
                  });

                  if (settings.call_vibration !== false) {
                    Vibration.vibrate([0, 600, 400, 600], true);
                  }
                }
              }
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('[GlobalCallPipOverlay] Setup incoming call listener error:', e);
      }
    };

    setupListeners();

    return () => {
      isMounted = false;
      Vibration.cancel();
      if (broadcastChannel) broadcastChannel.unsubscribe().catch(() => {});
      if (notifChannel) notifChannel.unsubscribe().catch(() => {});
    };
  }, [settings.allow_incoming_calls, settings.call_vibration]);

  // Accept incoming call action
  const handleAcceptCall = () => {
    Vibration.cancel();
    if (!incomingCall) return;
    const callToJoin = { ...incomingCall };
    setIncomingCall(null);

    startCall({
      roomId: callToJoin.roomId,
      roomType: callToJoin.roomType,
      roomName: callToJoin.roomName,
      partnerName: callToJoin.callerName,
      partnerId: callToJoin.callerId,
      isVideo: callToJoin.isVideo,
    });

    try {
      navigationRef?.navigate('Call', {
        roomId: callToJoin.roomId,
        roomType: callToJoin.roomType,
        roomName: callToJoin.roomName,
        partnerName: callToJoin.callerName,
        partnerId: callToJoin.callerId,
        isVideo: callToJoin.isVideo,
      });
    } catch (e) {
      console.warn('[GlobalCallPipOverlay] Accept navigation error:', e);
    }
  };

  // Decline incoming call action
  const handleDeclineCall = () => {
    Vibration.cancel();
    setIncomingCall(null);
  };

  // When in Android OS native Picture-in-Picture mode outside the app,
  // render the dedicated full-window call view so MainActivity displays exclusively the call UI.
  if (isActive && isNativePip) {
    return (
      <NativePipFullScreenView
        displayName={displayName}
        displayInitial={displayInitial}
        callDuration={callDuration}
        isMuted={isMuted}
        isSpeaking={isSpeaking}
        isSpeakerOn={isSpeakerOn}
        callStatus={callStatus}
        onToggleMute={() => updateCallState({ isMuted: !isMuted })}
        onToggleSpeaker={() => updateCallState({ isSpeakerOn: !isSpeakerOn })}
        onExpand={handleExpand}
        onEndCall={() => {
          try {
            if (roomType && roomId) {
              const durStr = formatCallDuration(callDuration);
              postCallSystemMessage(roomType as any, roomId, 'ended', durStr, undefined, partnerId).catch(() => {});
            }
          } catch {}
          endCall();
        }}
      />
    );
  }

  const shouldRenderPip = isActive && isMinimized && (settings.call_pip_enabled ?? true);

  return (
    <>
      {/* 1. Active Call Draggable PiP Bubble (respects settings.call_pip_enabled) */}
      {shouldRenderPip && (
        <PipBubble
          displayName={displayName}
          displayInitial={displayInitial}
          callDuration={callDuration}
          isMuted={isMuted}
          isSpeakerOn={isSpeakerOn}
          isSpeaking={isSpeaking}
          callStatus={callStatus}
          onToggleMute={() => updateCallState({ isMuted: !isMuted })}
          onToggleSpeaker={() => updateCallState({ isSpeakerOn: !isSpeakerOn })}
          onExpand={handleExpand}
          onEndCall={() => {
            try {
              if (roomType && roomId) {
                const durStr = formatCallDuration(callDuration);
                postCallSystemMessage(roomType as any, roomId, 'ended', durStr, undefined, partnerId).catch(() => {});
              }
            } catch {}
            endCall();
          }}
        />
      )}

      {/* 2. Incoming Call Notification (Banner vs Fullscreen based on settings.call_alert_mode) */}
      {incomingCall && settings.call_alert_mode === 'banner' && (
        <View style={styles.incomingBannerOverlay}>
          <View style={styles.incomingBannerCard}>
            <View style={styles.incomingBannerAvatar}>
              {incomingCall.callerAvatar ? (
                <CachedImage uri={incomingCall.callerAvatar} style={styles.incomingAvatarImg} />
              ) : (
                <Text style={styles.incomingAvatarInitial}>
                  {(incomingCall.callerName || 'C').charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.incomingBannerName} numberOfLines={1}>
                {incomingCall.callerName}
              </Text>
              <Text style={styles.incomingBannerType}>
                {incomingCall.isVideo ? 'Incoming Video Call...' : 'Incoming Voice Call...'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.incomingBannerDeclineBtn}
              onPress={handleDeclineCall}
              activeOpacity={0.8}
            >
              <Icon name="x" size={16} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.incomingBannerAcceptBtn}
              onPress={handleAcceptCall}
              activeOpacity={0.8}
            >
              <Icon name="phone" size={16} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {incomingCall && settings.call_alert_mode !== 'banner' && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={handleDeclineCall}
        >
          <View style={styles.incomingModalOverlay}>
            <View style={styles.incomingModalCenter}>
              <View style={styles.incomingPulseRing}>
                <View style={styles.incomingModalAvatar}>
                  {incomingCall.callerAvatar ? (
                    <CachedImage uri={incomingCall.callerAvatar} style={styles.incomingModalAvatarImg} />
                  ) : (
                    <Text style={styles.incomingModalAvatarInitial}>
                      {(incomingCall.callerName || 'C').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>

              <Text style={styles.incomingModalName} numberOfLines={1}>
                {incomingCall.callerName}
              </Text>
              <Text style={styles.incomingModalSub}>
                CineCraft Connect {incomingCall.isVideo ? 'Video' : 'Voice'} Call
              </Text>

              <View style={styles.incomingModalActionRow}>
                <TouchableOpacity
                  style={styles.incomingModalDeclineBtn}
                  onPress={handleDeclineCall}
                  activeOpacity={0.8}
                >
                  <Icon name="phone-off" size={24} color="#FFFFFF" />
                  <Text style={styles.incomingBtnLabel}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.incomingModalAcceptBtn}
                  onPress={handleAcceptCall}
                  activeOpacity={0.8}
                >
                  <Icon name="phone" size={24} color="#FFFFFF" />
                  <Text style={styles.incomingBtnLabel}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const PIP_SIZES = {
  compact: {
    width: 142,
    height: 178,
    avatarOuter: 44,
    avatarInner: 38,
    avatarText: 16,
    nameSize: 11,
    maxNameWidth: 115,
    actionBtnSize: 28,
    actionIconSize: 11,
    pillPaddingH: 6,
    pillFont: 9,
  },
  normal: {
    width: 185,
    height: 225,
    avatarOuter: 54,
    avatarInner: 48,
    avatarText: 20,
    nameSize: 13,
    maxNameWidth: 150,
    actionBtnSize: 34,
    actionIconSize: 13,
    pillPaddingH: 8,
    pillFont: 11,
  },
  large: {
    width: 245,
    height: 290,
    avatarOuter: 68,
    avatarInner: 60,
    avatarText: 26,
    nameSize: 15,
    maxNameWidth: 200,
    actionBtnSize: 38,
    actionIconSize: 15,
    pillPaddingH: 10,
    pillFont: 12,
  },
};
type PipSizeMode = 'compact' | 'normal' | 'large';

/**
 * Isolated memoized timer so 1s clock ticks do not trigger re-render
 * of the outer card or gesture PanResponders during dragging.
 */
const PipTimer = React.memo(({ duration }: { duration: number }) => (
  <Text style={styles.pipTimer}>{formatCallDuration(duration)}</Text>
));

/**
 * Single shared PipCardContent component used by both:
 * 1. PipBubble (in-app floating/draggable/resizable card)
 * 2. NativePipFullScreenView (Android OS Picture-in-Picture window)
 *
 * Guarantees 100% identical styling, typography, animations, and controls.
 */
interface PipCardContentProps {
  displayName: string;
  displayInitial: string;
  callDuration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isSpeaking: boolean;
  callStatus: string;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  cfg?: (typeof PIP_SIZES)['normal'];
}

const PipCardContent = React.memo(({
  displayName,
  displayInitial,
  callDuration,
  isMuted,
  isSpeakerOn,
  isSpeaking,
  callStatus,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
  cfg = PIP_SIZES.normal,
}: PipCardContentProps) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isSpeaking) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 550,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 550,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isSpeaking, pulseAnim]);

  return (
    <>
      {/* PiP Header - Minimalist GMeet style status pill */}
      <View style={styles.pipHeaderGMeet}>
        <View style={styles.pipLivePill}>
          <View style={styles.pipLiveDot} />
          <PipTimer duration={callDuration} />
        </View>
      </View>

      {/* PiP Body - Avatar with speaking pulse, Name, Status */}
      <View style={styles.pipBody}>
        <Animated.View
          style={[
            styles.pipAvatarOuter,
            { width: cfg.avatarOuter, height: cfg.avatarOuter, borderRadius: cfg.avatarOuter / 2 },
            isSpeaking && styles.pipAvatarSpeaking,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View
            style={[
              styles.pipAvatarInner,
              { borderRadius: cfg.avatarInner / 2 },
            ]}
          >
            <Text style={[styles.pipAvatarText, { fontSize: cfg.avatarText }]}>
              {displayInitial}
            </Text>
          </View>
        </Animated.View>
        <Text
          style={[styles.pipName, { fontSize: cfg.nameSize, maxWidth: cfg.maxNameWidth }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {callStatus === 'Connected' && (
          <View
            style={[
              styles.pipStatusPill,
              { paddingHorizontal: cfg.pillPaddingH },
              isSpeaking && styles.pipStatusPillSpeaking,
            ]}
          >
            <View style={[styles.pipStatusDot, { backgroundColor: isSpeaking ? EMERALD : '#94A3B8' }]} />
            <Text style={[styles.pipStatusText, { fontSize: cfg.pillFont }, isSpeaking && { color: EMERALD }]}>
              {isSpeaking ? 'Speaking' : isMuted ? 'Muted' : 'Active'}
            </Text>
          </View>
        )}
        {callStatus === 'Connecting' && (
          <View style={styles.pipRingingPill}>
            <View style={[styles.pipStatusDot, { backgroundColor: ORANGE }]} />
            <Text style={styles.pipRingingText}>Ringing...</Text>
          </View>
        )}
      </View>

      {/* PiP Actions - Mute, Speaker, End */}
      <View style={styles.pipActionsRow}>
        <TouchableOpacity
          style={[
            styles.pipActionBtn,
            { width: cfg.actionBtnSize, height: cfg.actionBtnSize, borderRadius: cfg.actionBtnSize / 2 },
            isMuted && styles.pipActionBtnMuted,
          ]}
          onPress={onToggleMute}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name={isMuted ? 'mic-off' : 'mic'}
            size={cfg.actionIconSize}
            color={isMuted ? '#EF4444' : '#FFFFFF'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pipActionBtn,
            { width: cfg.actionBtnSize, height: cfg.actionBtnSize, borderRadius: cfg.actionBtnSize / 2 },
            isSpeakerOn && styles.pipActionBtnSpeaker,
          ]}
          onPress={onToggleSpeaker}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name={isSpeakerOn ? 'volume-2' : 'volume-x'}
            size={cfg.actionIconSize}
            color={isSpeakerOn ? EMERALD : '#94A3B8'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pipActionBtn,
            styles.pipActionBtnEnd,
            { width: cfg.actionBtnSize, height: cfg.actionBtnSize, borderRadius: cfg.actionBtnSize / 2 },
          ]}
          onPress={onEndCall}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="phone-off" size={cfg.actionIconSize} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </>
  );
});

/**
 * NativePipFullScreenView
 * 
 * Rendered when the Android OS enters Picture-in-Picture mode outside the app.
 * Uses the shared PipCardContent to guarantee 100% UI and functionality parity.
 */
const NativePipFullScreenView = React.memo(({
  displayName,
  displayInitial,
  callDuration,
  isMuted,
  isSpeaking,
  isSpeakerOn,
  callStatus,
  onToggleMute,
  onToggleSpeaker,
  onExpand,
  onEndCall,
}: {
  displayName: string;
  displayInitial: string;
  callDuration: number;
  isMuted: boolean;
  isSpeaking: boolean;
  isSpeakerOn: boolean;
  callStatus: string;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onExpand: () => void;
  onEndCall: () => void;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onExpand}
      style={styles.nativePipFullScreen}
    >
      <StatusBar hidden />
      <View style={styles.nativePipCardInner}>
        <PipCardContent
          displayName={displayName}
          displayInitial={displayInitial}
          callDuration={callDuration}
          isMuted={isMuted}
          isSpeakerOn={isSpeakerOn}
          isSpeaking={isSpeaking}
          callStatus={callStatus}
          onToggleMute={onToggleMute}
          onToggleSpeaker={onToggleSpeaker}
          onEndCall={onEndCall}
        />

        {/* Corner Affordance */}
        <View style={styles.pipCornerResizeHandle}>
          <View style={styles.pipResizeCornerPlate} />
          <View style={styles.pipResizeGripBar1} />
          <View style={styles.pipResizeGripBar2} />
          <View style={styles.pipResizeGripBar3} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

/**
 * PipBubble - The resizable and draggable floating card
 */
const PipBubble = React.memo(({
  displayName,
  displayInitial,
  callDuration,
  isMuted,
  isSpeakerOn,
  isSpeaking,
  callStatus,
  onToggleMute,
  onToggleSpeaker,
  onExpand,
  onEndCall,
}: {
  displayName: string;
  displayInitial: string;
  callDuration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isSpeaking: boolean;
  callStatus: string;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onExpand: () => void;
  onEndCall: () => void;
}) => {
  const [sizeMode, setSizeMode] = useState<PipSizeMode>('normal');
  const cfg = PIP_SIZES[sizeMode];

  const currentWidth = useRef(PIP_SIZES.normal.width);
  const currentHeight = useRef(PIP_SIZES.normal.height);
  const animWidth = useRef(new Animated.Value(PIP_SIZES.normal.width)).current;
  const animHeight = useRef(new Animated.Value(PIP_SIZES.normal.height)).current;

  const initialX = SCREEN_WIDTH - PIP_SIZES.normal.width - PIP_MARGIN;
  const initialY = SCREEN_HEIGHT - PIP_SIZES.normal.height - 120;

  const pan = useRef(
    new Animated.ValueXY({
      x: initialX,
      y: initialY,
    })
  ).current;

  const pipScale = useRef(new Animated.Value(0.7)).current;
  const pipOpacity = useRef(new Animated.Value(0)).current;
  const currentPos = useRef({ x: initialX, y: initialY });
  const isClosing = useRef(false);

  // GMeet-style gesture state
  const isResizing = useRef(false);
  const isDockedOnRight = useRef(true);
  const gripScale = useRef(new Animated.Value(1)).current;

  // Smooth opening animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(pipScale, {
        toValue: 1,
        useNativeDriver: false,
        friction: 6,
        tension: 80,
      }),
      Animated.timing(pipOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [pipScale, pipOpacity]);

  // Track position
  useEffect(() => {
    const id = pan.addListener((value) => {
      currentPos.current = value;
    });
    return () => {
      pan.removeListener(id);
    };
  }, [pan]);

  // Smooth closing animation (no freeze or disturbance)
  const handleSmoothClose = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Animated.parallel([
      Animated.timing(pipScale, {
        toValue: 0.15,
        duration: 160,
        useNativeDriver: false,
      }),
      Animated.timing(pipOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: false,
      }),
    ]).start(() => {
      onEndCall();
    });
  }, [onEndCall, pipScale, pipOpacity]);

  // Card movement PanResponder (disabled while resizing)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isResizing.current,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !isResizing.current && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
      onPanResponderGrant: () => {
        pan.setOffset(currentPos.current);
        pan.setValue({ x: 0, y: 0 });
        Animated.spring(pipScale, {
          toValue: 1.04,
          useNativeDriver: false,
          friction: 6,
        }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        const snapX = gesture.moveX > SCREEN_WIDTH / 2
          ? SCREEN_WIDTH - currentWidth.current - PIP_MARGIN
          : PIP_MARGIN;
        const boundedY = Math.max(
          50,
          Math.min(SCREEN_HEIGHT - currentHeight.current - 50, gesture.moveY - currentHeight.current / 2)
        );

        Animated.parallel([
          Animated.spring(pan, {
            toValue: { x: snapX, y: boundedY },
            useNativeDriver: false,
            damping: 15,
            stiffness: 130,
            mass: 0.8,
            velocity: { x: gesture.vx * 0.5, y: gesture.vy * 0.5 },
          }),
          Animated.spring(pipScale, {
            toValue: 1,
            useNativeDriver: false,
            friction: 6,
          }),
        ]).start();
      },
    })
  ).current;

  // Google Meet Style Exclusive Corner Drag-to-Resize PanResponder
  const startDim = useRef({ w: PIP_SIZES.normal.width, h: PIP_SIZES.normal.height, x: initialX, y: initialY });
  const resizePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isResizing.current = true;
        const curX = currentPos.current.x;
        const curY = currentPos.current.y;
        isDockedOnRight.current = curX > SCREEN_WIDTH / 2;
        startDim.current = {
          w: currentWidth.current,
          h: currentHeight.current,
          x: curX,
          y: curY,
        };
        Animated.spring(gripScale, {
          toValue: 1.25,
          useNativeDriver: false,
          friction: 5,
        }).start();
      },
      onPanResponderMove: (_, gesture) => {
        // Dragging diagonally expands or shrinks proportionally
        const delta = Math.max(gesture.dx, gesture.dy);
        const newW = Math.max(130, Math.min(275, startDim.current.w + delta));
        const newH = Math.round(newW * 1.22);

        animWidth.setValue(newW);
        animHeight.setValue(newH);
        currentWidth.current = newW;
        currentHeight.current = newH;

        if (newW < 160) setSizeMode('compact');
        else if (newW > 215) setSizeMode('large');
        else setSizeMode('normal');

        // Prevent off-screen clipping when anchored to right edge
        if (isDockedOnRight.current) {
          const rightEdge = startDim.current.x + startDim.current.w;
          const adjustedX = Math.max(PIP_MARGIN, Math.min(SCREEN_WIDTH - newW - PIP_MARGIN, rightEdge - newW));
          pan.x.setValue(adjustedX);
          currentPos.current.x = adjustedX;
        }

        // Prevent bottom clipping
        if (startDim.current.y + newH > SCREEN_HEIGHT - 60) {
          const adjustedY = Math.max(50, SCREEN_HEIGHT - 60 - newH);
          pan.y.setValue(adjustedY);
          currentPos.current.y = adjustedY;
        }
      },
      onPanResponderRelease: (_, gesture) => {
        isResizing.current = false;
        Animated.spring(gripScale, {
          toValue: 1,
          useNativeDriver: false,
          friction: 6,
        }).start();

        const delta = Math.max(gesture.dx, gesture.dy);
        const finalW = Math.max(130, Math.min(275, startDim.current.w + delta));
        const finalH = Math.round(finalW * 1.22);
        currentWidth.current = finalW;
        currentHeight.current = finalH;

        Animated.parallel([
          Animated.spring(animWidth, { toValue: finalW, useNativeDriver: false, damping: 15, stiffness: 140 }),
          Animated.spring(animHeight, { toValue: finalH, useNativeDriver: false, damping: 15, stiffness: 140 }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        isResizing.current = false;
        Animated.spring(gripScale, {
          toValue: 1,
          useNativeDriver: false,
          friction: 6,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.pipDraggableWrap,
        {
          opacity: pipOpacity,
          transform: [
            ...pan.getTranslateTransform(),
            { scale: pipScale },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={[
          styles.pipCard,
          {
            width: animWidth,
            minHeight: animHeight,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={onExpand}
          style={styles.pipCardInner}
        >
          <PipCardContent
            displayName={displayName}
            displayInitial={displayInitial}
            callDuration={callDuration}
            isMuted={isMuted}
            isSpeakerOn={isSpeakerOn}
            isSpeaking={isSpeaking}
            callStatus={callStatus}
            onToggleMute={onToggleMute}
            onToggleSpeaker={onToggleSpeaker}
            onEndCall={handleSmoothClose}
            cfg={cfg}
          />
        </TouchableOpacity>

        {/* Google Meet Style Corner Drag-to-Resize Grip Handle */}
        <Animated.View
          style={[
            styles.pipCornerResizeHandle,
            { transform: [{ scale: gripScale }] },
          ]}
          {...resizePanResponder.panHandlers}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <View style={styles.pipResizeCornerPlate} />
          <View style={styles.pipResizeGripBar1} />
          <View style={styles.pipResizeGripBar2} />
          <View style={styles.pipResizeGripBar3} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  pipDraggableWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 999999,
    elevation: 999,
  },
  pipCard: {
    borderRadius: 20,
    backgroundColor: '#0D111D',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 16,
    overflow: 'hidden',
  },
  pipCardInner: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  pipHeaderGMeet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    width: '100%',
  },
  pipLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pipCornerResizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    zIndex: 99,
    elevation: 20,
  },
  pipResizeCornerPlate: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomRightRadius: 18,
    backgroundColor: 'rgba(255, 75, 51, 0.2)',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.35)',
  },
  pipResizeGripBar1: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: ORANGE,
    transform: [{ rotate: '-45deg' }],
  },
  pipResizeGripBar2: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 8,
    height: 1.8,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    transform: [{ rotate: '-45deg' }],
  },
  pipResizeGripBar3: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 4,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    transform: [{ rotate: '-45deg' }],
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
  pipBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
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
  pipStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pipStatusPillSpeaking: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pipStatusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  pipStatusText: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pipRingingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.3)',
  },
  pipRingingText: {
    color: '#FDBA74',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  // Native OS PiP Full-window Styles
  nativePipFullScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D111D',
    zIndex: 99999999,
    elevation: 99999999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  nativePipCardInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D111D',
    padding: 8,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },

  // Incoming Call Banner Styles
  incomingBannerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 20,
    left: 16,
    right: 16,
    zIndex: 9999999,
    elevation: 9999,
  },
  incomingBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151C26',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  incomingBannerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  incomingAvatarImg: {
    width: 44,
    height: 44,
  },
  incomingAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  incomingBannerName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Lora-Bold',
  },
  incomingBannerType: {
    color: EMERALD,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  incomingBannerDeclineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomingBannerAcceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Incoming Call Fullscreen Modal Styles
  incomingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 21, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  incomingModalCenter: {
    alignItems: 'center',
    width: '100%',
  },
  incomingPulseRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 75, 51, 0.3)',
  },
  incomingModalAvatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#1E293B',
    borderWidth: 3,
    borderColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  incomingModalAvatarImg: {
    width: 104,
    height: 104,
  },
  incomingModalAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  incomingModalName: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Lora-Bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  incomingModalSub: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 48,
  },
  incomingModalActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
  },
  incomingModalDeclineBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  incomingModalAcceptBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  incomingBtnLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
});

export default GlobalCallPipOverlay;
