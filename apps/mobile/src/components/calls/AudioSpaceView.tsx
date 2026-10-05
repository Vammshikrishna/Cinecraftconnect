import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  Animated,
  Easing,
  DeviceEventEmitter,
  Dimensions,
} from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { useLiveCall } from '../../hooks/useLiveCall';
import { useGlobalCall } from '../../contexts/CallContext';
import { formatCallDuration } from '../../services/callService';
import { announceCallEnded } from '../../services/callSession';
import {
  LiveParticipant,
  SpaceAction,
  SpeakingMode,
  raiseHand,
  rejoinLiveCall,
  sendCallData,
  setMicEnabled,
  spaceAction,
} from '../../services/liveCall';

// Same palette as the call screen so the two feel like one product.
const DARK_BG = '#0F0F12';
const CARD_BG = '#18181C';
const SURFACE = '#141419';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.12)';
const GLASS_BG = 'rgba(255, 255, 255, 0.06)';
const EMERALD = '#10B981';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const PURPLE = '#7C3AED';
const ORANGE = '#FF4B33';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const EMOJIS = ['❤️', '👏', '🔥', '😂', '😮', '🎉', '👍', '🙏'];

interface Props {
  roomName?: string;
  /** Optional: opens the full-screen version of the same space. */
  onExpand?: () => void;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
  anim: Animated.Value;
}

const roleLabel = (p: LiveParticipant): string | null =>
  p.role === 'host' ? 'HOST' : p.role === 'cohost' ? 'CO-HOST' : null;

/**
 * Twitter/X-Spaces style audio room, styled like the call screen (pill header, glass cards, floating control island).
 * People on stage talk, everyone else listens; the host decides whether listeners must raise a hand (request mode)
 * or can unmute freely (open mic), and can invite, mute, move or remove people. Permissions are enforced by the
 * server (see the space-control edge function); this is only the interface.
 */
export const AudioSpaceView = ({ roomName, onExpand }: Props) => {
  const live = useLiveCall();
  const { callState, updateCallState, endCall } = useGlobalCall();
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<LiveParticipant | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);

  const isHost = live.myRole === 'host';
  const isManager = isHost || live.myRole === 'cohost';

  const isOnStage = (p: LiveParticipant) =>
    p.role === 'host' || p.role === 'cohost' || p.role === 'speaker' || (live.speakingMode === 'open' && p.canPublish && p.isMicOn);

  const stage = useMemo(() => live.participants.filter(isOnStage), [live.participants, live.speakingMode]);
  const listeners = useMemo(() => live.participants.filter((p) => !isOnStage(p)), [live.participants, live.speakingMode]);
  const hands = useMemo(() => listeners.filter((p) => p.handRaised && !p.isLocal), [listeners]);

  // One shared ripple animation behind every speaking avatar (same effect as the call screen's ringing/speaking glow).
  const pulse = useRef(new Animated.Value(1)).current;
  const anySpeaking = stage.some((p) => p.isSpeaking);
  useEffect(() => {
    if (!anySpeaking) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anySpeaking, pulse]);

  // Reactions from other people (and ourselves) float up over the whole screen.
  const showEmoji = (emoji: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    const anim = new Animated.Value(0);
    const x = Math.floor(Math.random() * (SCREEN_WIDTH - 120)) + 40;
    setFloating((prev) => [...prev, { id, emoji, x, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => {
      setFloating((prev) => prev.filter((e) => e.id !== id));
    });
  };
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('liveCallReaction', (msg: any) => msg?.emoji && showEmoji(msg.emoji));
    return () => sub.remove();
  }, []);
  const sendReaction = (emoji: string) => {
    setShowReactions(false);
    showEmoji(emoji);
    sendCallData({ type: 'reaction', emoji });
  };

  // Profile pictures
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
          data.forEach((r: any) => r.avatar_url && (next[r.id] = r.avatar_url));
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

  // Surface server messages ("only the host can do that") instead of failing silently.
  useEffect(() => {
    if (live.message && live.phase !== 'failed' && live.phase !== 'dropped' && live.phase !== 'ended') {
      Alert.alert('Audio space', live.message);
    }
  }, [live.message]);

  const connected = live.phase === 'connected';
  const statusText =
    live.phase === 'reconnecting' ? 'Reconnecting…' : connected ? formatCallDuration(callState.callDuration) : 'Joining…';
  const statusColor = live.phase === 'reconnecting' ? AMBER : connected ? EMERALD : '#FDBA74';

  const act = async (action: SpaceAction, target?: LiveParticipant, mode?: SpeakingMode) => {
    setPicked(null);
    await spaceAction(action, { targetUserId: target?.identity, mode });
  };

  const leave = () => {
    if (isHost) {
      Alert.alert('End this space?', 'This ends the audio space for everyone in it.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End space',
          style: 'destructive',
          onPress: async () => {
            await spaceAction('end');
            void announceCallEnded({
              roomType: callState.roomType || 'discussion',
              roomId: callState.roomId || '',
              partnerId: callState.partnerId,
              durationSecs: callState.callDuration,
              kind: 'space',
            });
            endCall();
          },
        },
      ]);
    } else {
      // Leaving quietly: nobody is told, the space goes on.
      endCall();
    }
  };

  const renderAvatar = (p: LiveParticipant, size: number) => {
    const avatar = p.avatarUrl || avatars[p.identity];
    const initial = (p.name[0] || '?').toUpperCase();
    return avatar ? (
      <CachedImage uri={avatar} style={{ width: size, height: size, borderRadius: size / 2 }} />
    ) : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#4C2A9A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.4 }}>{initial}</Text>
      </View>
    );
  };

  const renderStageCard = (p: LiveParticipant) => {
    const manageable = isManager && !p.isLocal;
    const badge = roleLabel(p);
    return (
      <TouchableOpacity
        key={p.identity}
        style={styles.stageCellWrap}
        activeOpacity={manageable ? 0.8 : 1}
        onPress={() => manageable && setPicked(p)}
      >
        <View style={[styles.stageCard, p.isSpeaking && styles.stageCardSpeaking]}>
          {p.isSpeaking && (
            <>
              <Animated.View
                pointerEvents="none"
                style={[styles.ripple, { transform: [{ scale: pulse }], opacity: pulse.interpolate({ inputRange: [1, 1.35], outputRange: [0.45, 0] }) }]}
              />
              <Animated.View
                pointerEvents="none"
                style={[styles.rippleInner, { transform: [{ scale: pulse }], opacity: pulse.interpolate({ inputRange: [1, 1.35], outputRange: [0.6, 0] }) }]}
              />
            </>
          )}
          <View style={[styles.avatarWrap, p.isSpeaking && styles.avatarWrapSpeaking]}>{renderAvatar(p, 72)}</View>

          {badge ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{badge}</Text>
            </View>
          ) : null}

          <View style={[styles.nameTag, p.isSpeaking && styles.nameTagSpeaking]}>
            <Icon name={p.isMicOn ? 'mic' : 'mic-off'} size={11} color={p.isMicOn ? EMERALD : RED} />
            <Text style={[styles.nameText, p.isSpeaking && { color: EMERALD }]} numberOfLines={1}>
              {p.name}
              {p.isLocal ? ' (You)' : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Header pills (same layout as the call screen) ─────────────────────────────────────────────────── */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.pill}
          onPress={() => updateCallState({ isSpeakerOn: !callState.isSpeakerOn })}
          activeOpacity={0.8}
        >
          <Icon name={callState.isSpeakerOn ? 'volume-2' : 'volume-x'} size={14} color={callState.isSpeakerOn ? EMERALD : '#94A3B8'} />
          <Text style={[styles.pillText, callState.isSpeakerOn && { color: EMERALD }]}>
            {callState.isSpeakerOn ? 'Speaker' : 'Earpiece'}
          </Text>
        </TouchableOpacity>

        <View style={styles.pill}>
          <View style={[styles.statusDot, { backgroundColor: connected ? RED : statusColor }]} />
          <Text style={[styles.liveWord, !connected && { color: statusColor }]}>{connected ? 'LIVE' : ''}</Text>
          <Text style={[styles.pillText, { color: statusColor, fontVariant: ['tabular-nums'] }]}>{statusText}</Text>
        </View>

        {onExpand ? (
          <TouchableOpacity style={styles.roundIcon} onPress={onExpand} activeOpacity={0.8}>
            <Icon name="maximize-2" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.roundIcon} />
        )}
      </View>

      {/* Floating reactions */}
      <View pointerEvents="none" style={styles.floatingLayer}>
        {floating.map((item) => (
          <Animated.Text
            key={item.id}
            style={[
              styles.floatingEmoji,
              {
                left: item.x,
                opacity: item.anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
                transform: [
                  { translateY: item.anim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT * 0.5, 60] }) },
                  { scale: item.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.25, 1] }) },
                ],
              },
            ]}
          >
            {item.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* Title + how people get on stage */}
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {roomName || 'Audio space'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {live.speakingMode === 'open' ? 'Open mic · anyone can speak' : 'Raise your hand · the host approves speakers'}
          </Text>
        </View>
        {isManager && (
          <View style={styles.modeSwitch}>
            {(['request', 'open'] as SpeakingMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeChip, live.speakingMode === m && styles.modeChipActive]}
                onPress={() => live.speakingMode !== m && void act('set_mode', undefined, m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeChipText, live.speakingMode === m && { color: '#FFFFFF' }]}>
                  {m === 'request' ? 'Raise hand' : 'Open mic'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionRow}>
          <Icon name="mic" size={11} color="#64748B" />
          <Text style={styles.sectionLabel}>ON STAGE ({stage.length})</Text>
        </View>
        <View style={styles.stageGrid}>{stage.map(renderStageCard)}</View>

        <View style={[styles.listenerCard]}>
          <View style={styles.sectionRow}>
            <Icon name="headphones" size={11} color="#64748B" />
            <Text style={styles.sectionLabel}>LISTENERS ({listeners.length})</Text>
          </View>
          {listeners.length === 0 ? (
            <Text style={styles.emptyText}>Nobody is listening yet. Share the room so people can join.</Text>
          ) : (
            <View style={styles.listenerWrap}>
              {listeners.map((p) => {
                const manageable = isManager && !p.isLocal;
                return (
                  <TouchableOpacity
                    key={p.identity}
                    style={styles.listenerCell}
                    activeOpacity={manageable ? 0.7 : 1}
                    onPress={() => manageable && setPicked(p)}
                  >
                    {renderAvatar(p, 44)}
                    {p.handRaised && (
                      <View style={styles.handBadge}>
                        <Text style={{ fontSize: 11 }}>✋</Text>
                      </View>
                    )}
                    <Text style={styles.listenerName} numberOfLines={1}>
                      {p.name}
                      {p.isLocal ? ' (You)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reaction picker (above the island) */}
      {showReactions && (
        <View style={styles.reactionPopover}>
          {EMOJIS.map((e) => (
            <TouchableOpacity key={e} style={styles.reactionBtn} onPress={() => sendReaction(e)} activeOpacity={0.7}>
              <Text style={styles.reactionEmoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Floating control island ───────────────────────────────────────────────────────────────────────── */}
      <View style={styles.bottomBarContainer}>
        <View style={styles.island}>
          {live.canSpeak ? (
            <TouchableOpacity
              style={[styles.ctrlMain, live.isMicEnabled ? styles.ctrlMainLive : styles.ctrlMainMuted]}
              onPress={() => void setMicEnabled(!live.isMicEnabled)}
              activeOpacity={0.85}
            >
              <Icon name={live.isMicEnabled ? 'mic' : 'mic-off'} size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.ctrlMain, live.handRaised ? styles.ctrlMainHand : styles.ctrlGlass]}
              onPress={() => void raiseHand(!live.handRaised)}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 20 }}>✋</Text>
            </TouchableOpacity>
          )}

          {live.canSpeak && live.myRole === 'speaker' && (
            <TouchableOpacity
              style={styles.stepDownBtn}
              onPress={() => spaceAction('demote', { targetUserId: live.participants.find((p) => p.isLocal)?.identity })}
            >
              <Text style={styles.stepDownText}>Step down</Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          {isManager && (
            <TouchableOpacity style={styles.ctrlIcon} onPress={() => setShowRequests(true)} activeOpacity={0.8}>
              <Icon name="users" size={18} color="#E2E8F0" />
              {hands.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{hands.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.ctrlIcon, showReactions && styles.ctrlIconActive]}
            onPress={() => setShowReactions((v) => !v)}
            activeOpacity={0.8}
          >
            <Icon name="smile" size={18} color={showReactions ? ORANGE : '#E2E8F0'} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.endBtn} onPress={leave} activeOpacity={0.85}>
            <Icon name={isHost ? 'x' : 'log-out'} size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Manage one person ─────────────────────────────────────────────────────────────────────────────── */}
      <Modal visible={!!picked} transparent animationType="fade" onRequestClose={() => setPicked(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPicked(null)}>
          <View style={styles.sheet}>
            {picked && (
              <>
                <View style={styles.sheetHeader}>
                  {renderAvatar(picked, 42)}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName} numberOfLines={1}>
                      {picked.name}
                    </Text>
                    <Text style={styles.sheetRole}>{picked.role.toUpperCase()}</Text>
                  </View>
                </View>
                {!isOnStage(picked) && <SheetButton label="Invite to speak" icon="mic" onPress={() => act('promote', picked)} />}
                {isOnStage(picked) && picked.role !== 'host' && (
                  <SheetButton label="Move to listeners" icon="headphones" onPress={() => act('demote', picked)} />
                )}
                {isOnStage(picked) && picked.isMicOn && <SheetButton label="Mute" icon="mic-off" onPress={() => act('mute', picked)} />}
                {isHost && picked.role !== 'cohost' && picked.role !== 'host' && (
                  <SheetButton label="Make co-host" icon="shield" onPress={() => act('cohost', picked)} />
                )}
                {picked.role !== 'host' && !(picked.role === 'cohost' && !isHost) && (
                  <SheetButton label="Remove from space" icon="user-x" danger onPress={() => act('remove', picked)} />
                )}
                <SheetButton label="Cancel" onPress={() => setPicked(null)} />
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Raised hands ──────────────────────────────────────────────────────────────────────────────────── */}
      <Modal visible={showRequests} transparent animationType="fade" onRequestClose={() => setShowRequests(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRequests(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Requests to speak ({hands.length})</Text>
            {hands.length === 0 ? (
              <Text style={styles.emptyText}>No raised hands right now.</Text>
            ) : (
              hands.map((p) => (
                <View key={p.identity} style={styles.requestRow}>
                  {renderAvatar(p, 38)}
                  <Text style={[styles.sheetName, { flex: 1 }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => act('promote', p)}>
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            <SheetButton label="Close" onPress={() => setShowRequests(false)} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Connection lost → rejoin ──────────────────────────────────────────────────────────────────────── */}
      {live.phase === 'dropped' && (
        <View style={styles.dropped}>
          <Icon name="wifi-off" size={40} color={RED} />
          <Text style={styles.droppedTitle}>Connection lost</Text>
          <Text style={styles.droppedBody}>You were disconnected from the space. It may still be running — tap Rejoin.</Text>
          <TouchableOpacity style={styles.rejoinBtn} onPress={() => void rejoinLiveCall()}>
            <Text style={styles.rejoinText}>Rejoin space</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12, padding: 8 }} onPress={() => endCall()}>
            <Text style={{ color: RED, fontWeight: '700' }}>Leave</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const SheetButton = ({ label, onPress, danger, icon }: { label: string; onPress: () => void; danger?: boolean; icon?: string }) => (
  <TouchableOpacity style={styles.sheetBtn} onPress={onPress} activeOpacity={0.8}>
    {icon ? <Icon name={icon} size={16} color={danger ? RED : '#E2E8F0'} /> : null}
    <Text style={[styles.sheetBtnText, danger && { color: RED }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },

  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GLASS_BG,
    borderColor: GLASS_BORDER,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  liveWord: { color: RED, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  roundIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: GLASS_BG, borderColor: GLASS_BORDER, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  floatingLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 },
  floatingEmoji: { position: 'absolute', top: 0, fontSize: 44 },

  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 10 },
  title: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  modeSwitch: { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 16, padding: 3, borderColor: GLASS_BORDER, borderWidth: 1 },
  modeChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 13 },
  modeChipActive: { backgroundColor: PURPLE },
  modeChipText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },

  scrollContent: { paddingBottom: 110, paddingHorizontal: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 8, paddingHorizontal: 4 },
  sectionLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  stageGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stageCellWrap: { width: '50%', padding: 4 },
  stageCard: {
    height: 168,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stageCardSpeaking: { borderColor: EMERALD, shadowColor: EMERALD, shadowOpacity: 0.6, shadowRadius: 14, elevation: 8 },
  ripple: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(16,185,129,0.18)' },
  rippleInner: { position: 'absolute', width: 108, height: 108, borderRadius: 54, backgroundColor: 'rgba(16,185,129,0.22)' },
  avatarWrap: { padding: 3, borderRadius: 40, borderWidth: 2, borderColor: 'transparent' },
  avatarWrapSpeaking: { borderColor: EMERALD },
  roleBadge: { position: 'absolute', top: 9, left: 9, backgroundColor: PURPLE, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2 },
  roleBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  nameTag: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderColor: GLASS_BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  nameTagSpeaking: { borderColor: 'rgba(16,185,129,0.55)' },
  nameText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', flexShrink: 1 },

  listenerCard: { marginTop: 14, backgroundColor: CARD_BG, borderRadius: 22, borderWidth: 1, borderColor: GLASS_BORDER, padding: 12, marginHorizontal: 4 },
  listenerWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  listenerCell: { width: '25%', alignItems: 'center', paddingVertical: 8 },
  listenerName: { color: '#CBD5E1', fontSize: 11, marginTop: 4, maxWidth: 70 },
  handBadge: { position: 'absolute', top: 4, right: 10, backgroundColor: '#FDE68A', borderRadius: 10, paddingHorizontal: 3 },
  emptyText: { color: '#64748B', fontSize: 13, paddingHorizontal: 4, paddingBottom: 4 },

  reactionPopover: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(24,24,28,0.97)',
    borderColor: GLASS_BORDER,
    borderWidth: 1,
    borderRadius: 28,
    padding: 6,
    zIndex: 30,
  },
  reactionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 24 },

  bottomBarContainer: { position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(24,24,28,0.96)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderRadius: 34,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 14,
  },
  ctrlMain: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  ctrlMainLive: { backgroundColor: EMERALD },
  ctrlMainMuted: { backgroundColor: RED },
  ctrlMainHand: { backgroundColor: PURPLE },
  ctrlGlass: { backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER },
  ctrlIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER },
  ctrlIconActive: { backgroundColor: 'rgba(255,75,51,0.18)', borderColor: 'rgba(255,75,51,0.45)' },
  divider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.16)' },
  stepDownBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  stepDownText: { color: '#94A3B8', fontWeight: '700', fontSize: 12 },
  endBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', shadowColor: RED, shadowOpacity: 0.5, shadowRadius: 10, elevation: 6 },
  countBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: DARK_BG, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: GLASS_BORDER, padding: 16, paddingBottom: 26 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  sheetName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  sheetRole: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  sheetTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  sheetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)' },
  sheetBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  approveBtn: { backgroundColor: EMERALD, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  approveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  dropped: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,15,18,0.95)', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 60 },
  droppedTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginTop: 14 },
  droppedBody: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  rejoinBtn: { marginTop: 20, backgroundColor: EMERALD, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 36 },
  rejoinText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
