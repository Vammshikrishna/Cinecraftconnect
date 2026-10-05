import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ScrollView } from 'react-native';
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
  LiveParticipant,
} from '../../services/liveCall';
import { announceCallEnded } from '../../services/callSession';
import { AudioSpaceView } from './AudioSpaceView';
import { formatCallDuration } from '../../services/callService';

const DARK_BG = '#0F0F12';
const CARD_BG = '#18181C';
const EMERALD = '#10B981';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const ORANGE = '#FF4B33';

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

  const status =
    live.phase === 'reconnecting'
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

  const renderTile = (p: LiveParticipant, big = false) => {
    const initial = (p.name[0] || '?').toUpperCase();
    const avatar = p.avatarUrl || avatars[p.identity];
    return (
      <View
        key={p.identity}
        style={[styles.tile, big && styles.tileBig, p.isSpeaking && styles.tileSpeaking]}
      >
        {p.isCameraOn && p.videoTrack ? (
          <VideoView style={ABS_FILL} videoTrack={p.videoTrack} objectFit="cover" mirror={p.isLocal} />
        ) : (
          <View style={styles.avatarWrap}>
            {avatar ? (
              <CachedImage uri={avatar} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.nameTag}>
          <Icon name={p.isMicOn ? 'mic' : 'mic-off'} size={11} color={p.isMicOn ? EMERALD : RED} />
          <Text style={styles.nameText} numberOfLines={1}>
            {p.name}
            {p.isLocal ? ' (You)' : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.pill} onPress={toggleSpeaker} activeOpacity={0.8}>
          <Icon name={callState.isSpeakerOn ? 'volume-2' : 'volume-x'} size={13} color={callState.isSpeakerOn ? EMERALD : '#94A3B8'} />
          <Text style={styles.pillText}>{callState.isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
        </TouchableOpacity>

        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: connected ? qualityColor : ORANGE }]} />
          <Text style={[styles.pillText, { color: connected ? qualityColor : '#FDBA74' }]}>{status}</Text>
        </View>

        {onExpand ? (
          <TouchableOpacity style={styles.iconPill} onPress={onExpand} activeOpacity={0.8}>
            <Icon name="maximize-2" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconPill} />
        )}
      </View>

      {/* Stage */}
      <View style={styles.stage}>
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
            <ScrollView horizontal style={styles.strip} showsHorizontalScrollIndicator={false}>
              {others.map((p) => (
                <View key={p.identity} style={styles.stripTile}>
                  {renderTile(p)}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {others.length === 0 ? (
              <Text style={styles.waiting}>{roomName ? `Starting ${roomName}…` : 'Starting call…'}</Text>
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

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={[styles.ctrl, callState.isMuted && styles.ctrlOff]} onPress={toggleMic} activeOpacity={0.8}>
          <Icon name={callState.isMuted ? 'mic-off' : 'mic'} size={19} color={callState.isMuted ? RED : '#FFFFFF'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, !live.isCameraEnabled && styles.ctrlOff]} onPress={toggleCamera} activeOpacity={0.8}>
          <Icon name={live.isCameraEnabled ? 'video' : 'video-off'} size={19} color={live.isCameraEnabled ? '#FFFFFF' : RED} />
        </TouchableOpacity>
        {live.isCameraEnabled && (
          <TouchableOpacity style={styles.ctrl} onPress={() => void flipCamera()} activeOpacity={0.8}>
            <Icon name="refresh-cw" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        {Platform.OS === 'android' && (
          <TouchableOpacity style={[styles.ctrl, live.isScreenSharing && styles.ctrlActive]} onPress={toggleShare} activeOpacity={0.8}>
            <Icon name="monitor" size={18} color={live.isScreenSharing ? ORANGE : '#FFFFFF'} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.endBtn} onPress={hangUp} activeOpacity={0.85}>
          <Icon name="phone-off" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Connection lost → rejoin */}
      {live.phase === 'dropped' && (
        <View style={styles.dropped}>
          <Icon name="wifi-off" size={40} color={RED} />
          <Text style={styles.droppedTitle}>Connection lost</Text>
          <Text style={styles.droppedBody}>You were disconnected from the call. It may still be running — tap Rejoin.</Text>
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
  iconPill: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
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
  avatarInitial: { color: '#FFFFFF', fontSize: 34, fontWeight: '800' },
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
  nameText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  waiting: { color: '#94A3B8', textAlign: 'center', width: '100%', marginTop: 60 },
  shareStage: { flex: 1 },
  strip: { maxHeight: 110, marginTop: 8 },
  stripTile: { width: 100, height: 100, marginRight: 8 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 14 },
  ctrl: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  ctrlOff: { backgroundColor: 'rgba(239,68,68,0.18)' },
  ctrlActive: { backgroundColor: 'rgba(255,75,51,0.2)' },
  endBtn: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: RED },
  dropped: { ...ABS_FILL, backgroundColor: 'rgba(15,15,18,0.94)', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 20 },
  droppedTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginTop: 14 },
  droppedBody: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  rejoinBtn: { marginTop: 20, backgroundColor: EMERALD, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 36 },
  rejoinText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
