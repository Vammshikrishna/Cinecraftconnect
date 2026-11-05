import { CachedImage } from '../common/CachedImage';
import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  useWindowDimensions,
  Platform,
  AppState,
  StatusBar,
  Vibration,
  Modal,
  Image,
  NativeModules,
  DeviceEventEmitter,
} from 'react-native';
import { Icon } from '../common/Icon';
import { IncomingCallScreen } from './IncomingCallScreen';
import { useGlobalCall } from '../../contexts/CallContext';
import {
  formatCallDuration,
  postCallSystemMessage,
} from '../../services/callService';
import { addPipListener, addPipActionListener, setPipCallState } from '../../services/pipService';
import { VideoView } from '@livekit/react-native';
import { useLiveCall } from '../../hooks/useLiveCall';
import { useUserSettings } from '../../hooks/useUserSettings';
import type { ThemeColors } from '../../contexts/SettingsContext';
import { getSupabaseClient } from '@cinecraft/api';
import { calmLoop } from '../../utils/motion';
import { beginCallSession } from '../../services/callSession';
import { isDeviceLocked, setLockedCall, useLockedCall } from '../../services/lockScreenGuard';
import { verifyCallInvite } from '../../services/callInviteVerify';

const ORANGE = '#FF4B33';
const EMERALD = '#10B981';
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
  const styles = useCallStyles();
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

  const lockedCall = useLockedCall();
  // the call ending also ends the lock-screen mode
  useEffect(() => {
    if (!isActive) setLockedCall(false);
  }, [isActive]);

  const handleExpand = useCallback(() => {
    maximizeCall();
    try {
      if (navigationRef) {
        const doNavigate = () => {
          try {
            // Back to where the call belongs: a discussion room opens on its call tab, a project space on its Live Call
            // tab. Only a one-to-one call (no room) uses the full-screen call screen.
            if (roomType === 'discussion' && roomId) {
              navigationRef.navigate('DiscussionRoomDetail', { roomId, roomTitle: roomName, openCallTab: Date.now() });
            } else if (roomType === 'project' && roomId) {
              navigationRef.navigate('ProjectSpace', { spaceId: roomId, projectTitle: roomName, openCallTab: Date.now() });
            } else {
              navigationRef.navigate('Call', {
                roomId,
                roomType,
                roomName,
                partnerName,
                partnerId,
                isVideo: !isVideoOff,
                answering: true,
              });
            }
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

  // The PiP window gets no touches from Android, so its mute / speaker / end buttons are system actions: keep their
  // state current and answer them here.
  useEffect(() => {
    if (isActive) setPipCallState(isMuted, isSpeakerOn);
  }, [isActive, isMuted, isSpeakerOn]);

  const pipActionRef = useRef<(action: string) => void>(() => {});
  pipActionRef.current = (action: string) => {
    if (action === 'mute') updateCallState({ isMuted: !isMuted });
    else if (action === 'speaker') updateCallState({ isSpeakerOn: !isSpeakerOn });
    else if (action === 'end') {
      try {
        if (roomType && roomId) {
          postCallSystemMessage(roomType as any, roomId, 'ended', formatCallDuration(callDuration), undefined, partnerId).catch(() => {});
        }
      } catch {}
      endCall();
    }
  };
  useEffect(() => {
    const sub = addPipActionListener((a) => pipActionRef.current(a));
    return () => sub?.remove();
  }, []);

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
          .on('broadcast', { event: 'incoming_call_invite' }, async (payload: any) => {
            const data = payload?.payload;
            if (data && data.targetUserId === user.id && data.callerId !== user.id) {
              // Respect user setting: Who can call me
              if (settings.allow_incoming_calls === 'nobody') return;

              // anyone can send on this channel: only ring for a call the database confirms, with the caller's real name
              const verified = await verifyCallInvite(data);
              if (!verified || !isMounted) return;

              setIncomingCall({
                callerId: data.callerId,
                callerName: verified.callerName,
                callerAvatar: verified.callerAvatar,
                roomId: data.roomId,
                roomName: String(data.roomName || 'Live Call').slice(0, 80),
                roomType: ['project', 'discussion', 'direct'].includes(data.roomType) ? data.roomType : 'direct',
                isVideo: !!data.isVideo,
              });

              if (settings.call_vibration !== false) {
                Vibration.vibrate([0, 600, 400, 600], true);
              }
            }
          })
          .on('broadcast', { event: 'incoming_call_cancelled' }, (payload: any) => {
            // the caller hung up before anyone answered: stop ringing
            const data = payload?.payload;
            if (!data?.roomId) return;
            if (Array.isArray(data.targetUserIds) && !data.targetUserIds.includes(user.id)) return;
            setIncomingCall((current) => {
              if (current && current.roomId === data.roomId) {
                Vibration.cancel();
                NativeModules.NotificationBridge?.cancelIncomingCall?.();
                return null;
              }
              return current;
            });
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
  const handleAcceptCall = async () => {
    Vibration.cancel();
    NativeModules.NotificationBridge?.cancelIncomingCall?.();
    if (!incomingCall) return;
    const callToJoin = { ...incomingCall };
    setIncomingCall(null);
    // Answered on the lock screen: show only the full-screen call, never the room (its chat and tabs would be readable by
    // whoever holds the phone). The call screen then has no way out until the owner unlocks.
    const lockedNow = await isDeviceLocked();
    setLockedCall(lockedNow);

    startCall({
      roomId: callToJoin.roomId,
      roomType: callToJoin.roomType,
      roomName: callToJoin.roomName,
      partnerName: callToJoin.callerName,
      partnerId: callToJoin.callerId,
      isVideo: callToJoin.isVideo,
    });

    try {
      // A call in a discussion room or project space is answered inside that room (its call tab), like starting one there.
      // That screen does not connect the media itself, so connect it here. A one-to-one call opens the call screen,
      // which connects on its own. This is also where answering from the lock screen ends up.
      if (!lockedNow && (callToJoin.roomType === 'discussion' || callToJoin.roomType === 'project')) {
        void beginCallSession({
          roomType: callToJoin.roomType,
          roomId: callToJoin.roomId,
          roomName: callToJoin.roomName,
          isVideo: callToJoin.isVideo,
          startMuted: !!settings.call_mute_mic_on_join,
          videoOffOnJoin: !!settings.call_video_off_on_join,
        }).catch((e) => console.warn('[GlobalCallPipOverlay] Join from incoming call failed:', e));
        if (callToJoin.roomType === 'discussion') {
          navigationRef?.navigate('DiscussionRoomDetail', { roomId: callToJoin.roomId, roomTitle: callToJoin.roomName, openCallTab: Date.now() });
        } else {
          navigationRef?.navigate('ProjectSpace', { spaceId: callToJoin.roomId, projectTitle: callToJoin.roomName, openCallTab: Date.now() });
        }
        return;
      }
      navigationRef?.navigate('Call', {
        roomId: callToJoin.roomId,
        roomType: callToJoin.roomType,
        roomName: callToJoin.roomName,
        partnerName: callToJoin.callerName,
        partnerId: callToJoin.callerId,
        isVideo: callToJoin.isVideo,
        answering: true,
      });
    } catch (e) {
      console.warn('[GlobalCallPipOverlay] Accept navigation error:', e);
    }
  };

  // Decline incoming call action
  const handleDeclineCall = () => {
    Vibration.cancel();
    NativeModules.NotificationBridge?.cancelIncomingCall?.();
    setIncomingCall(null);
  };

  // A call that rang while the app was closed or locked: the notification opened the app, so show the call screen.
  // (Android only; the native side hands the caller over once, from a cold start or while the app is running.)
  const [autoAcceptCall, setAutoAcceptCall] = useState(false);
  useEffect(() => {
    const showFromNative = (d: any) => {
      if (!d?.roomId) return;
      NativeModules.NotificationBridge?.cancelIncomingCall?.(); // the screen takes over from the ringing notification
      setIncomingCall({
        callerId: d.callerId || '',
        callerName: d.callerName || 'Incoming call',
        callerAvatar: d.callerAvatar || undefined,
        roomId: d.roomId,
        roomName: d.roomName || 'Live Call',
        roomType: d.roomType === 'project' || d.roomType === 'discussion' ? d.roomType : 'direct',
        isVideo: !!d.isVideo,
      });
      if (d.callAction === 'accept') setAutoAcceptCall(true);
      else if (settings.call_vibration !== false) Vibration.vibrate([0, 600, 400, 600], true);
    };
    NativeModules.NotificationBridge?.getInitialNotificationData?.()
      ?.then((d: any) => { if (d?.incomingCall) showFromNative(d); })
      ?.catch?.(() => {});
    const sub = DeviceEventEmitter.addListener('incomingCallFromNative', showFromNative);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (autoAcceptCall && incomingCall) {
      setAutoAcceptCall(false);
      handleAcceptCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAcceptCall, incomingCall]);

  // When in Android OS native Picture-in-Picture mode outside the app,
  // render the dedicated full-window call view so MainActivity displays exclusively the call UI.
  if (isActive && isNativePip) {
    return (
      <NativePipCallView
        displayName={displayName}
        displayInitial={displayInitial}
        callDuration={callDuration}
        isMuted={isMuted}
        callStatus={callStatus}
      />
    );
  }

  const shouldRenderPip = isActive && isMinimized && !lockedCall && (settings.call_pip_enabled ?? true);

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
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.incomingBannerDeclineBtn}
              onPress={handleDeclineCall}
              activeOpacity={0.8}
            >
              <Icon name="x" size={16} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Call" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
        <IncomingCallScreen
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          roomName={incomingCall.roomName}
          roomType={incomingCall.roomType}
          isVideo={incomingCall.isVideo}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
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
const PipTimer = React.memo(({ duration }: { duration: number }) => {
  const styles = useCallStyles();
  return <Text style={styles.pipTimer}>{formatCallDuration(duration)}</Text>;
});

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
  const styles = useCallStyles();
  const { themeColors } = useUserSettings();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isSpeaking) {
      anim = calmLoop(
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
            <View style={[styles.pipStatusDot, { backgroundColor: isSpeaking ? EMERALD : themeColors.iconSecondary }]} />
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
            color={isMuted ? '#EF4444' : themeColors.textPrimary}
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
            color={isSpeakerOn ? EMERALD : themeColors.iconSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity accessibilityRole="button" accessibilityLabel="End call"
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
 * NativePipCallView
 *
 * What the Android OS Picture-in-Picture window shows (like Google Meet): just the call, no buttons. Android sends no
 * touches into that small window, so mute / speaker / end are the system's own buttons (see MainActivity.pipActions);
 * tapping the window opens the system controls and the expand icon brings the app back.
 * Shows the person who is talking (or the first other person) with their video, or their picture when the camera is off.
 */
const NativePipCallView = React.memo(({
  displayName,
  displayInitial,
  callDuration,
  isMuted,
  callStatus,
}: {
  displayName: string;
  displayInitial: string;
  callDuration: number;
  isMuted: boolean;
  callStatus: string;
}) => {
  const live = useLiveCall();
  const others = live.participants.filter((p) => !p.isLocal);
  const sharer = live.participants.find((p) => p.isScreenSharing && p.screenTrack);
  const main = others.find((p) => p.isSpeaking) || others[0] || live.participants[0];
  const me = live.participants.find((p) => p.isLocal);
  const mainName = main && !main.isLocal ? main.name : displayName;
  const initial = (mainName?.[0] || displayInitial || '?').toUpperCase();
  const showMyself = !!me && !!main && !main.isLocal && me.isCameraOn && !!me.videoTrack;
  const mm = String(Math.floor(callDuration / 60)).padStart(2, '0');
  const ss = String(callDuration % 60).padStart(2, '0');
  const connected = callStatus === 'connected' || callDuration > 0;

  return (
    // absolute and on top of the whole app: in the PiP window nothing of the app screen may show through
    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#0F0F12', zIndex: 99999999, elevation: 99999999 }}>
      <StatusBar hidden />
      {sharer ? (
        <VideoView style={{ flex: 1 }} videoTrack={sharer.screenTrack} objectFit="contain" />
      ) : main && main.isCameraOn && main.videoTrack ? (
        <VideoView style={{ flex: 1 }} videoTrack={main.videoTrack} objectFit="cover" mirror={main.isLocal} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {main?.avatarUrl ? (
            <CachedImage uri={main.avatarUrl} style={{ width: '38%', aspectRatio: 1, borderRadius: 999 }} />
          ) : (
            <View style={{ width: '38%', aspectRatio: 1, borderRadius: 999, backgroundColor: '#4C2A9A', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>{initial}</Text>
            </View>
          )}
        </View>
      )}

      {/* timer / status, top left */}
      <View style={{ position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: connected ? '#10B981' : '#FF4B33' }} />
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{connected ? `${mm}:${ss}` : 'Ringing…'}</Text>
      </View>

      {/* name, bottom left */}
      <View style={{ position: 'absolute', left: 6, bottom: 6, maxWidth: '70%', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
        {isMuted ? <Icon name="mic-off" size={10} color="#EF4444" /> : null}
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{mainName}</Text>
      </View>

      {/* your own camera, bottom right */}
      {showMyself && me?.videoTrack ? (
        <View style={{ position: 'absolute', right: 6, bottom: 6, width: '28%', aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}>
          <VideoView style={{ flex: 1 }} videoTrack={me.videoTrack} objectFit="cover" mirror />
        </View>
      ) : null}
    </View>
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
  const styles = useCallStyles();
  const [sizeMode, setSizeMode] = useState<PipSizeMode>('normal');
  // Tablets (shortest side >= 600dp) get a PiP about 1.4x bigger; the window size is read live so rotation works.
  const { width: winW, height: winH } = useWindowDimensions();
  const pipScaleFactor = Math.min(winW, winH) >= 600 ? 1.4 : 1;
  const win = useRef({ w: winW, h: winH, k: pipScaleFactor });
  win.current = { w: winW, h: winH, k: pipScaleFactor };
  const cfg = useMemo(() => {
    const base = PIP_SIZES[sizeMode];
    if (pipScaleFactor === 1) return base;
    const out: any = {};
    (Object.keys(base) as (keyof typeof base)[]).forEach((key) => {
      out[key] = Math.round((base[key] as number) * pipScaleFactor);
    });
    return out as typeof base;
  }, [sizeMode, pipScaleFactor]);

  const baseW = Math.round(PIP_SIZES.normal.width * pipScaleFactor);
  const baseH = Math.round(PIP_SIZES.normal.height * pipScaleFactor);
  const currentWidth = useRef(baseW);
  const currentHeight = useRef(baseH);
  const animWidth = useRef(new Animated.Value(baseW)).current;
  const animHeight = useRef(new Animated.Value(baseH)).current;

  const initialX = winW - baseW - PIP_MARGIN;
  const initialY = winH - baseH - 120;

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

  // Keep the card on screen when the window changes (rotation, split screen)
  useEffect(() => {
    const maxX = Math.max(PIP_MARGIN, winW - currentWidth.current - PIP_MARGIN);
    const maxY = Math.max(50, winH - currentHeight.current - 50);
    const x = Math.min(Math.max(PIP_MARGIN, currentPos.current.x), maxX);
    const y = Math.min(Math.max(50, currentPos.current.y), maxY);
    if (x !== currentPos.current.x || y !== currentPos.current.y) {
      pan.setValue({ x, y });
      currentPos.current = { x, y };
    }
  }, [winW, winH, pan]);

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
        const snapX = gesture.moveX > win.current.w / 2
          ? win.current.w - currentWidth.current - PIP_MARGIN
          : PIP_MARGIN;
        const boundedY = Math.max(
          50,
          Math.min(win.current.h - currentHeight.current - 50, gesture.moveY - currentHeight.current / 2)
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
  const startDim = useRef({ w: baseW, h: baseH, x: initialX, y: initialY });
  const resizePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isResizing.current = true;
        const curX = currentPos.current.x;
        const curY = currentPos.current.y;
        isDockedOnRight.current = curX > win.current.w / 2;
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
        const newW = Math.max(130 * win.current.k, Math.min(275 * win.current.k, startDim.current.w + delta));
        const newH = Math.round(newW * 1.22);

        animWidth.setValue(newW);
        animHeight.setValue(newH);
        currentWidth.current = newW;
        currentHeight.current = newH;

        if (newW / win.current.k < 160) setSizeMode('compact');
        else if (newW / win.current.k > 215) setSizeMode('large');
        else setSizeMode('normal');

        // Prevent off-screen clipping when anchored to right edge
        if (isDockedOnRight.current) {
          const rightEdge = startDim.current.x + startDim.current.w;
          const adjustedX = Math.max(PIP_MARGIN, Math.min(win.current.w - newW - PIP_MARGIN, rightEdge - newW));
          pan.x.setValue(adjustedX);
          currentPos.current.x = adjustedX;
        }

        // Prevent bottom clipping
        if (startDim.current.y + newH > win.current.h - 60) {
          const adjustedY = Math.max(50, win.current.h - 60 - newH);
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
        const finalW = Math.max(130 * win.current.k, Math.min(275 * win.current.k, startDim.current.w + delta));
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

const makeStyles = (c: ThemeColors, isDark: boolean) => {
  const d = (dark: string, light: string) => (isDark ? dark : light);
  return StyleSheet.create({
  pipDraggableWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 999999,
    elevation: 999,
  },
  pipCard: {
    borderRadius: 20,
    backgroundColor: d('#0D111D', c.bgCard),
    borderWidth: 1.5,
    borderColor: d('rgba(255, 255, 255, 0.14)', c.border),
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
    backgroundColor: d('rgba(255, 255, 255, 0.08)', c.chipBg),
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: d('rgba(255, 255, 255, 0.1)', c.border),
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
    backgroundColor: d('rgba(255, 255, 255, 0.7)', 'rgba(15, 23, 42, 0.45)'),
    transform: [{ rotate: '-45deg' }],
  },
  pipResizeGripBar3: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 4,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: d('rgba(255, 255, 255, 0.4)', 'rgba(15, 23, 42, 0.25)'),
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
    fontSize: 12,
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
    backgroundColor: c.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipAvatarText: {
    color: c.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  pipName: {
    color: c.textPrimary,
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
    backgroundColor: d('rgba(255, 255, 255, 0.06)', c.chipBg),
    borderWidth: 1,
    borderColor: d('rgba(255, 255, 255, 0.1)', c.border),
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
    color: c.textSecondary,
    fontSize: 12,
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
    color: d('#FDBA74', '#C2410C'),
    fontSize: 12,
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
    borderTopColor: c.divider,
  },
  pipActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: d('rgba(255, 255, 255, 0.08)', c.chipBg),
    borderWidth: 1,
    borderColor: d('rgba(255, 255, 255, 0.12)', c.border),
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
    backgroundColor: d('#0D111D', c.bgCard),
    zIndex: 99999999,
    elevation: 99999999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  nativePipCardInner: {
    width: '100%',
    height: '100%',
    backgroundColor: d('#0D111D', c.bgCard),
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
    backgroundColor: c.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: d('rgba(255, 255, 255, 0.15)', c.border),
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
    backgroundColor: c.chipBg,
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
    color: c.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  incomingBannerName: {
    color: c.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Lora-Bold',
  },
  incomingBannerType: {
    color: EMERALD,
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  });
};

/** Theme-aware styles for the call overlays (rebuilt only when the theme changes). */
const useCallStyles = () => {
  const { themeColors, isDark } = useUserSettings();
  return useMemo(() => makeStyles(themeColors, isDark), [themeColors, isDark]);
};

export default GlobalCallPipOverlay;
