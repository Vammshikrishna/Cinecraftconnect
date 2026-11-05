import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ScrollView, Modal, Switch, Animated, Easing, DeviceEventEmitter, useWindowDimensions } from 'react-native';
import { VideoView } from '@livekit/react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { useLiveCall } from '../../hooks/useLiveCall';
import { useGlobalCall } from '../../contexts/CallContext';
import {
  rejoinLiveCall,
  setCameraEnabled,
  setScreenShareEnabled,
  flipCamera,
  sendCallData,
  setSpeakerOn,
  LiveParticipant,
} from '../../services/liveCall';
import { announceCallEnded } from '../../services/callSession';
import { AudioSpaceView } from './AudioSpaceView';
import { formatCallDuration } from '../../services/callService';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useIslandSizes } from './useIslandSizes';

const DARK_BG = '#0F0F12';
const CARD_BG = '#18181C';
const EMERALD = '#10B981';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const ORANGE = '#FF4B33';

const EMOJIS = ['❤️', '👏', '🔥', '😂', '😮', '🎉', '👍', '🙏'];

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  anim: Animated.Value;
}

const ABS_FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

interface Props {
  roomId: string;
  roomName?: string;
  /** Opens the full-screen call view (same call, bigger controls). */
  onExpand?: () => void;
}

/**
 * The call rendered INSIDE a room, next to its chat (Call tab / Chat tab). It does not own the call: the media session
 * and its lifecycle live in services/liveCall + <CallLifecycle/>, so switching tabs never interrupts audio or video.
 */
export const InlineCallPanel = (props: Props) => {
  const live = useLiveCall();
  // Audio spaces (voice only, stage + listeners) have their own layout.
  return live.mode === 'audio_space' ? (
    <AudioSpaceView roomName={props.roomName} onExpand={props.onExpand} />
  ) : (
    <InlineCallPanelInner {...props} />
  );
};

const InlineCallPanelInner = ({ roomId, roomName, onExpand }: Props) => {
  const live = useLiveCall();
  const { callState, updateCallState, endCall } = useGlobalCall();
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [showReactions, setShowReactions] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);
  const { width: winW, height: winH } = useWindowDimensions();
  const { isTablet, isLandscape } = useResponsive();
  const T = isTablet;
  const { themeColors, isDark, settings, updateSetting } = useUserSettings();
  // mic, camera, [flip], [share], participants, reactions, settings + two dividers; the sizes shrink on narrow phones so the island fits
  const ctrlCount = 5 + (live.isCameraEnabled ? 1 : 0) + (Platform.OS === 'android' || Platform.OS === 'ios' ? 1 : 0);
  const sz = useIslandSizes(ctrlCount, 2, T);
  const cs = { width: sz.ctrl, height: sz.ctrl, borderRadius: sz.ctrl / 2 };
  const iconSz = sz.ctrl >= 42 ? 19 : 17;
  const ctrlBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const glassBorder = isDark ? 'rgba(255,255,255,0.12)' : themeColors.border;
  const islandBg = isDark ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.97)';
  const popBg = isDark ? 'rgba(24,24,28,0.97)' : 'rgba(255,255,255,0.98)';

  // Reactions from other people (and ourselves) float up over the call.
  const showEmoji = (emoji: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    const anim = new Animated.Value(0);
    const x = Math.floor(Math.random() * Math.max(40, winW - 120)) + 40;
    setFloating((prev) => [...prev, { id, emoji, x, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
      setFloating((prev) => prev.filter((e) => e.id !== id));
    });
  };
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('liveCallReaction', (msg: any) => msg?.emoji && showEmoji(msg.emoji));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winW]);
  const sendReaction = (emoji: string) => {
    setShowReactions(false);
    showEmoji(emoji);
    sendCallData({ type: 'reaction', emoji });
  };

  const status =
    live.phase === 'reconnecting' || callState.partnerReconnecting
      ? 'Reconnecting…'
      : live.phase === 'connected' && live.remoteCount > 0
      ? formatCallDuration(callState.callDuration)
      : live.isCaller
      ? 'Ringing…'
      : 'Connecting…';
  const connected = live.phase === 'connected' && live.remoteCount > 0;
  const qualityColor = live.quality === 'excellent' ? EMERALD : live.quality === 'good' ? AMBER : RED;

  // Profile pictures for the people in the call (identities are user ids).
  const idsKey = live.participants.map((p) => p.identity).sort().join(',');
  useEffect(() => {
    const missing = live.participants.filter((p) => p.identity && !p.avatarUrl && !avatars[p.identity]).map((p) => p.identity);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (getSupabaseClient() as any).from('profiles').select('id, avatar_url').in('id', missing);
        if (cancelled || !data) return;
        setAvatars((prev) => {
          const next = { ...prev };
          data.forEach((r: any) => {
            if (r.avatar_url) next[r.id] = r.avatar_url;
          });
          return next;
        });
      } catch {
        // initials are the fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const sharer = live.participants.find((p) => p.isScreenSharing && (p.isLocal || p.screenTrack));
  const others = useMemo(() => live.participants, [live.participants]);

  const hangUp = () => {
    void announceCallEnded({
      roomType: callState.roomType || 'discussion',
      roomId,
      partnerId: callState.partnerId,
      durationSecs: callState.callDuration,
    });
    endCall();
  };

  const toggleMic = () => updateCallState({ isMuted: !callState.isMuted });
  const toggleSpeaker = () => updateCallState({ isSpeakerOn: !callState.isSpeakerOn });
  const toggleCamera = async () => {
    const turnOn = !live.isCameraEnabled;
    const ok = await setCameraEnabled(turnOn);
    if (ok) updateCallState({ isVideoOff: !turnOn, isVideo: callState.isVideo || turnOn });
    else if (turnOn) Alert.alert('Camera unavailable', 'Allow camera access to turn your video on.');
  };
  const toggleShare = async () => {
    const ok = await setScreenShareEnabled(!live.isScreenSharing);
    if (!ok && !live.isScreenSharing) Alert.alert('Screen sharing', 'Screen sharing was cancelled or is not available right now.');
  };

  const renderTile = (p: LiveParticipant, big = false, tileH = 0) => {
    // on a tablet the picture grows with the tile instead of staying a small dot in a huge black box
    const av = T && tileH > 0 ? Math.max(72, Math.min(200, Math.round(tileH * 0.42))) : 0;
    const avStyle = av ? { width: av, height: av, borderRadius: av / 2 } : null;
    const initial = (p.name[0] || '?').toUpperCase();
    const avatar = p.avatarUrl || avatars[p.identity];
    return (
      <View
        key={p.identity}
        style={[styles.tile, big && styles.tileBig, T && big && { minHeight: 0 }, p.isSpeaking && styles.tileSpeaking]}
      >
        {p.isCameraOn && p.videoTrack ? (
          <VideoView style={ABS_FILL} videoTrack={p.videoTrack} objectFit="cover" mirror={p.isLocal} />
        ) : (
          <View style={styles.avatarWrap}>
            {avatar ? (
              <CachedImage uri={avatar} style={[styles.avatarImg, T && styles.avatarImgT, avStyle]} />
            ) : (
              <View style={[styles.avatarFallback, T && styles.avatarImgT, avStyle]}>
                <Text style={[styles.avatarInitial, T && { fontSize: av ? Math.round(av * 0.37) : 44 }]}>{initial}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.nameTag}>
          <Icon name={p.isMicOn ? 'mic' : 'mic-off'} size={11} color={p.isMicOn ? EMERALD : RED} />
          <Text style={[styles.nameText, T && { fontSize: 14 }]} numberOfLines={1}>
            {p.name}
            {p.isLocal ? ' (You)' : ''}
          </Text>
        </View>
      </View>
    );
  };

  // Tablet: the biggest 16:9 tiles that fit all the people into the stage, centred. One person gets one large tile that
  // fits on screen (it used to be taller than the stage and was cut off).
  const tabletGrid = useMemo(() => {
    if (!T || stageSize.w <= 0 || stageSize.h <= 0 || others.length === 0) return null;
    const gap = 12;
    const availW = stageSize.w - 32; // the stage has 16 of padding on each side
    const n = others.length;
    let best = { w: 0, h: 0, gap };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cellW = (availW - gap * cols) / cols;
      const cellH = (stageSize.h - 8 - gap * rows) / rows;
      const w = Math.floor(Math.min(cellW, (cellH * 16) / 9));
      if (w > best.w) best = { w, h: Math.floor((w * 9) / 16), gap };
    }
    return best.w > 0 ? best : null;
  }, [T, stageSize.w, stageSize.h, others.length]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      {/* Status bar */}
      <View style={[styles.topBar, T && { paddingHorizontal: 20, paddingVertical: 14 }]}>
        <TouchableOpacity style={[styles.pill, { backgroundColor: pillBg }]} onPress={toggleSpeaker} activeOpacity={0.8}>
          <Icon name={callState.isSpeakerOn ? 'volume-2' : 'volume-x'} size={13} color={callState.isSpeakerOn ? EMERALD : themeColors.iconSecondary} />
          <Text style={[styles.pillText, { color: themeColors.textPrimary }]}>{callState.isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
        </TouchableOpacity>

        <View style={[styles.pill, { backgroundColor: pillBg }]}>
          <View style={[styles.dot, { backgroundColor: connected ? qualityColor : ORANGE }]} />
          <Text style={[styles.pillText, { color: connected ? qualityColor : isDark ? '#FDBA74' : '#C2410C' }]}>{status}</Text>
        </View>

        {onExpand ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Full screen" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.iconPill, { backgroundColor: pillBg }]} onPress={onExpand} activeOpacity={0.8}>
            <Icon name="maximize-2" size={14} color={themeColors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.iconPill, { backgroundColor: pillBg }]} />
        )}
      </View>

      {/* Stage */}
      <View style={[styles.stage, T && { paddingHorizontal: 16 }]} onLayout={(e) => setStageSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {sharer ? (
          <View style={styles.shareStage}>
            <View style={[styles.tile, styles.tileBig, { backgroundColor: '#000' }]}>
              {sharer.isLocal ? (
                <View style={styles.avatarWrap}>
                  <Icon name="monitor" size={36} color="#FFFFFF" />
                </View>
              ) : (
                <VideoView style={ABS_FILL} videoTrack={sharer.screenTrack} objectFit="contain" />
              )}
              <View style={styles.nameTag}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {sharer.isLocal ? 'You are sharing your screen' : `${sharer.name} is sharing their screen`}
                </Text>
              </View>
            </View>
            <ScrollView horizontal style={[styles.strip, T && { maxHeight: 150 }]} showsHorizontalScrollIndicator={false}>
              {others.map((p) => (
                <View key={p.identity} style={[styles.stripTile, T && { width: 140, height: 140 }]}>
                  {renderTile(p)}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.grid, T && { flexGrow: 1, justifyContent: 'center', alignContent: 'center' }]}
            showsVerticalScrollIndicator={false}
          >
            {others.length === 0 ? (
              <Text style={[styles.waiting, { color: themeColors.textSecondary }]}>{roomName ? `Starting ${roomName}…` : 'Starting call…'}</Text>
            ) : T && tabletGrid ? (
              others.map((p) => (
                <View key={p.identity} style={{ width: tabletGrid.w, height: tabletGrid.h, margin: tabletGrid.gap / 2 }}>
                  {renderTile(p, true, tabletGrid.h)}
                </View>
              ))
            ) : (
              others.map((p) => (
                <View key={p.identity} style={others.length === 1 ? styles.cellFull : styles.cellHalf}>
                  {renderTile(p, others.length === 1)}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Floating reactions */}
      <View pointerEvents="none" style={ABS_FILL}>
        {floating.map((item) => (
          <Animated.Text
            key={item.id}
            style={{
              position: 'absolute',
              top: 0,
              left: item.x,
              fontSize: 44,
              opacity: item.anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
              transform: [
                { translateY: item.anim.interpolate({ inputRange: [0, 1], outputRange: [winH * 0.5, 60] }) },
                { scale: item.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.25, 1] }) },
              ],
            }}
          >
            {item.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* Reaction picker (above the island) */}
      {showReactions && (
        <View style={[styles.reactionPopover, { backgroundColor: popBg, borderColor: isDark ? glassBorder : '#CBD5E1', shadowColor: '#000', shadowOpacity: isDark ? 0.5 : 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 }]}>
          {EMOJIS.map((e) => (
            <TouchableOpacity key={e} style={[styles.reactionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9', borderRadius: 22, marginHorizontal: 2 }]} onPress={() => sendReaction(e)} activeOpacity={0.7}>
              <Text style={styles.reactionEmoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Controls: the same floating island as the audio space */}
      <View style={[styles.controls, T && { paddingVertical: 20 }]}>
        <View style={[styles.island, { backgroundColor: islandBg, borderColor: glassBorder }, { gap: sz.gap, paddingHorizontal: sz.pad, paddingVertical: T ? 10 : 8, maxWidth: winW - 32 }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={callState.isMuted ? 'Unmute' : 'Mute'} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.ctrl, { backgroundColor: ctrlBg, borderColor: glassBorder }, cs, callState.isMuted && styles.ctrlOff]} onPress={toggleMic} activeOpacity={0.8}>
            <Icon name={callState.isMuted ? 'mic-off' : 'mic'} size={iconSz} color={callState.isMuted ? RED : themeColors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Camera" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.ctrl, { backgroundColor: ctrlBg, borderColor: glassBorder }, cs, !live.isCameraEnabled && styles.ctrlOff]} onPress={toggleCamera} activeOpacity={0.8}>
            <Icon name={live.isCameraEnabled ? 'video' : 'video-off'} size={iconSz} color={live.isCameraEnabled ? themeColors.textPrimary : RED} />
          </TouchableOpacity>
          {live.isCameraEnabled && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Flip camera" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.ctrl, { backgroundColor: ctrlBg, borderColor: glassBorder }, cs]} onPress={() => void flipCamera()} activeOpacity={0.8}>
              <Icon name="refresh-cw" size={iconSz - 1} color={themeColors.textPrimary} />
            </TouchableOpacity>
          )}
          {(Platform.OS === 'android' || Platform.OS === 'ios') && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share screen" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.ctrl, { backgroundColor: ctrlBg, borderColor: glassBorder }, cs, live.isScreenSharing && styles.ctrlActive]} onPress={toggleShare} activeOpacity={0.8}>
              <Icon name="monitor" size={iconSz - 1} color={live.isScreenSharing ? ORANGE : themeColors.textPrimary} />
            </TouchableOpacity>
          )}

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Participants" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.ctrl, { backgroundColor: ctrlBg, borderColor: glassBorder }, cs]} onPress={() => setShowPeople(true)} activeOpacity={0.8}>
            <Icon name="users" size={iconSz - 1} color={themeColors.textPrimary} />
            {live.participants.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{live.participants.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reactions" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.ctrl, { backgroundColor: ctrlBg, borderColor: glassBorder }, cs, showReactions && styles.ctrlActive]} onPress={() => setShowReactions((v) => !v)} activeOpacity={0.8}>
            <Icon name="smile" size={iconSz - 1} color={showReactions ? ORANGE : themeColors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Call settings" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.ctrl, { backgroundColor: ctrlBg, borderColor: glassBorder }, cs, showSettings && styles.ctrlActive]} onPress={() => setShowSettings(true)} activeOpacity={0.8}>
            <Icon name="settings" size={iconSz - 1} color={showSettings ? ORANGE : themeColors.textPrimary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="End call" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.endBtn, { width: sz.end, height: sz.end, borderRadius: sz.end / 2 }]} onPress={hangUp} activeOpacity={0.85}>
            <Icon name="phone-off" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Call settings */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettings(false)}>
          <View style={[styles.sheet, { backgroundColor: themeColors.bgScreen, borderColor: glassBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[styles.sheetTitle, { color: themeColors.textPrimary, marginBottom: 0 }]}>Call settings</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setShowSettings(false)}>
                <Icon name="x" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.settingGroup, { color: ORANGE }]}>AUDIO</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>Speakerphone</Text>
                <Text style={[styles.settingDesc, { color: themeColors.textSecondary }]}>Play the call through the loudspeaker</Text>
              </View>
              <Switch
                value={callState.isSpeakerOn}
                accessibilityLabel="Speakerphone"
                onValueChange={(v) => {
                  updateCallState({ isSpeakerOn: v });
                  void setSpeakerOn(v);
                }}
                trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: 'rgba(16,185,129,0.4)' }}
                thumbColor={callState.isSpeakerOn ? EMERALD : themeColors.iconSecondary}
              />
            </View>

            <Text style={[styles.settingGroup, { color: ORANGE, marginTop: 14 }]}>WHEN I JOIN A CALL</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>Mute my microphone</Text>
                <Text style={[styles.settingDesc, { color: themeColors.textSecondary }]}>Start every call muted</Text>
              </View>
              <Switch
                value={!!settings.call_mute_mic_on_join} accessibilityLabel="Mute my microphone"
                onValueChange={(v) => updateSetting('call_mute_mic_on_join', v)}
                trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: 'rgba(255,75,51,0.4)' }}
                thumbColor={settings.call_mute_mic_on_join ? ORANGE : themeColors.iconSecondary}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>Turn my camera off</Text>
                <Text style={[styles.settingDesc, { color: themeColors.textSecondary }]}>Join without video</Text>
              </View>
              <Switch
                value={!!settings.call_video_off_on_join} accessibilityLabel="Turn my camera off"
                onValueChange={(v) => updateSetting('call_video_off_on_join', v)}
                trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: 'rgba(255,75,51,0.4)' }}
                thumbColor={settings.call_video_off_on_join ? ORANGE : themeColors.iconSecondary}
              />
            </View>

            <View style={[styles.settingInfoBox, { backgroundColor: ctrlBg, borderColor: glassBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="wifi" size={14} color={qualityColor} />
                <Text style={{ color: qualityColor, fontWeight: '700', fontSize: 13 }}>
                  Connection: {live.quality.charAt(0).toUpperCase() + live.quality.slice(1)}
                </Text>
              </View>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 4 }}>Call time: {formatCallDuration(callState.callDuration)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Icon name="shield" size={14} color={EMERALD} />
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, flex: 1 }}>Audio and video are encrypted between your device and the call server.</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Participants */}
      <Modal visible={showPeople} transparent animationType="fade" onRequestClose={() => setShowPeople(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPeople(false)}>
          <View style={[styles.sheet, { backgroundColor: themeColors.bgScreen, borderColor: glassBorder }]}>
            <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Participants ({live.participants.length})</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {live.participants.map((p) => {
                const av = p.avatarUrl || avatars[p.identity];
                return (
                  <View key={p.identity} style={styles.personRow}>
                    {av ? (
                      <CachedImage uri={av} style={styles.personAvatar} />
                    ) : (
                      <View style={[styles.personAvatar, { backgroundColor: '#4C2A9A', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{(p.name[0] || '?').toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={[styles.personName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {p.name}
                      {p.isLocal ? ' (You)' : ''}
                    </Text>
                    <Icon name={p.isMicOn ? 'mic' : 'mic-off'} size={16} color={p.isMicOn ? EMERALD : RED} />
                    <Icon name={p.isCameraOn ? 'video' : 'video-off'} size={16} color={p.isCameraOn ? EMERALD : RED} />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Connection lost → rejoin */}
      {live.phase === 'dropped' && (
        <View style={[styles.dropped, { backgroundColor: isDark ? 'rgba(15,15,18,0.94)' : 'rgba(248,250,252,0.96)' }]}>
          <Icon name="wifi-off" size={40} color={RED} />
          <Text style={[styles.droppedTitle, { color: themeColors.textPrimary }]}>Connection lost</Text>
          <Text style={[styles.droppedBody, { color: themeColors.textSecondary }]}>You were disconnected from the call. It may still be running — tap Rejoin.</Text>
          <TouchableOpacity style={styles.rejoinBtn} onPress={() => void rejoinLiveCall()} activeOpacity={0.85}>
            <Text style={styles.rejoinText}>Rejoin call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12, padding: 8 }} onPress={hangUp}>
            <Text style={{ color: RED, fontWeight: '700' }}>Leave</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  iconPill: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stage: { flex: 1, paddingHorizontal: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8 },
  cellHalf: { width: '50%', padding: 4, aspectRatio: 0.85 },
  cellFull: { width: '100%', padding: 4, height: 360 },
  tile: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBig: { minHeight: 240 },
  tileSpeaking: { borderColor: EMERALD },
  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 84, height: 84, borderRadius: 42 },
  avatarFallback: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#4C2A9A', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
  nameTag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nameText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  waiting: { color: '#94A3B8', textAlign: 'center', width: '100%', marginTop: 60 },
  shareStage: { flex: 1 },
  strip: { maxHeight: 110, marginTop: 8 },
  stripTile: { width: 100, height: 100, marginRight: 8 },
  controls: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 34,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  divider: { width: 1, height: 22 },
  countBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  reactionPopover: { position: 'absolute', bottom: 96, alignSelf: 'center', flexDirection: 'row', borderWidth: 1, borderRadius: 28, padding: 6, zIndex: 30 },
  reactionBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, padding: 16, paddingBottom: 26, width: '100%', maxWidth: 640, alignSelf: 'center' },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  settingGroup: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 8, marginBottom: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingDesc: { fontSize: 12, marginTop: 2 },
  settingInfoBox: { marginTop: 14, borderRadius: 14, borderWidth: 1, padding: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  personAvatar: { width: 38, height: 38, borderRadius: 19 },
  personName: { flex: 1, fontSize: 15, fontWeight: '600' },
  ctrl: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  ctrlT: { width: 56, height: 56, borderRadius: 28 },
  avatarImgT: { width: 120, height: 120, borderRadius: 60 },
  ctrlOff: { backgroundColor: 'rgba(239,68,68,0.18)' },
  ctrlActive: { backgroundColor: 'rgba(255,75,51,0.2)' },
  endBtn: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: RED },
  dropped: { ...ABS_FILL, backgroundColor: 'rgba(15,15,18,0.94)', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 20 },
  droppedTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 14 },
  droppedBody: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  rejoinBtn: { marginTop: 20, backgroundColor: EMERALD, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 36 },
  rejoinText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
