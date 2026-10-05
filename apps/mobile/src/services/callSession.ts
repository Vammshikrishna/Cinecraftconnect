/**
 * Call session helpers shared by the full-screen call screen and the in-room (tabbed) call panel, so starting and
 * finishing a call does exactly the same bookkeeping wherever the user triggers it from.
 */
import { getSupabaseClient } from '@cinecraft/api';
import { Alert } from 'react-native';
import { joinLiveCall, findActiveCall, CallRoomType, CallMode, SpeakingMode } from './liveCall';
import { postCallSystemMessage, sendCallNotifications, formatCallDuration } from './callService';

/** Push notifications call a discussion room "room"; the call tables and the token function say "discussion". */
export const normalizeCallRoomType = (roomType?: string): CallRoomType =>
  roomType === 'project' ? 'project' : roomType === 'discussion' || roomType === 'room' ? 'discussion' : 'direct';

/**
 * Before starting something in a discussion room / project space, ask how: a normal voice/video call or an audio
 * space (listeners + speakers). If a call or space is already running, there is nothing to ask: just join it.
 */
export const askHowToStart = async (
  roomType: string | undefined,
  roomId: string,
  /** The user already picked (e.g. tapped the video or the audio-space button): skip the "which kind?" question. */
  prefer?: 'call' | 'space'
): Promise<{ kind: 'join' } | { kind: 'call' } | { kind: 'space'; speakingMode: SpeakingMode } | null> => {
  const type = normalizeCallRoomType(roomType);
  if (type === 'direct') return { kind: 'call' };
  if (await findActiveCall(roomId)) return { kind: 'join' };

  const kind = prefer || (await new Promise<'call' | 'space' | null>((resolve) => {
    Alert.alert(
      'Start in this room',
      'How do you want to talk?',
      [
        { text: 'Voice / video call', onPress: () => resolve('call') },
        { text: 'Audio space', onPress: () => resolve('space') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  }));
  if (!kind) return null;
  if (kind === 'call') return { kind: 'call' };

  const speakingMode = await new Promise<SpeakingMode | null>((resolve) => {
    Alert.alert(
      'Who can speak?',
      'You can change this at any time while the space is live.',
      [
        { text: 'Raise hand — I approve speakers', onPress: () => resolve('request') },
        { text: 'Open mic — anyone can speak', onPress: () => resolve('open') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
  return speakingMode ? { kind: 'space', speakingMode } : null;
};

export interface BeginCallParams {
  roomType?: string;
  roomId: string;
  roomName?: string;
  partnerName?: string;
  partnerId?: string;
  isVideo?: boolean;
  /** Start an audio space (voice only, host/speakers/listeners) when no call is running yet. */
  mode?: CallMode;
  speakingMode?: SpeakingMode;
  startMuted?: boolean;
  videoOffOnJoin?: boolean;
  speakerOn?: boolean;
  onData?: (message: { type: string; [k: string]: any }, from?: string) => void;
}

/**
 * Connects the media session. If nobody was calling yet this makes us the caller, and only then is the
 * "call started" chat message posted and everyone else rung.
 */
export const beginCallSession = async (p: BeginCallParams): Promise<void> => {
  const supabase = getSupabaseClient();
  const { data: auth } = await supabase.auth.getSession();
  const user = auth?.session?.user;
  if (!user) throw new Error('Please sign in to start a call.');

  const { data: prof } = await (supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', user.id)
    .maybeSingle() as any);
  const myName = prof?.full_name || prof?.username || user.email?.split('@')[0] || 'Member';
  const roomType = normalizeCallRoomType(p.roomType);

  await joinLiveCall({
    roomType,
    roomId: p.roomId,
    roomName: p.roomName || p.partnerName,
    participantName: myName,
    mode: p.mode,
    speakingMode: p.speakingMode,
    withVideo: !!p.isVideo && !p.videoOffOnJoin && p.mode !== 'audio_space',
    startMuted: !!p.startMuted,
    speakerOn: p.speakerOn,
    onCallCreated: () => {
      const kind = p.mode === 'audio_space' ? 'space' : 'call';
      postCallSystemMessage(roomType, p.roomId, 'started', undefined, user.id, p.partnerId, kind).catch(() => {});
      sendCallNotifications(roomType, p.roomId, p.roomName || p.partnerName || 'Live Call', user.id, !!p.isVideo, kind).catch(
        () => {}
      );
    },
    onData: p.onData,
  });
};

/** Posts the "call ended • duration" chat message and tells the other devices (web listens on this channel too). */
export const announceCallEnded = async (p: {
  roomType?: string;
  roomId: string;
  partnerId?: string;
  durationSecs: number;
  /** 'space' posts "Audio space ended"; omit nothing for listeners (callers skip announcing for them). */
  kind?: 'call' | 'space';
}): Promise<void> => {
  const supabase = getSupabaseClient();
  try {
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth?.session?.user?.id;
    postCallSystemMessage(
      normalizeCallRoomType(p.roomType),
      p.roomId,
      'ended',
      formatCallDuration(p.durationSecs),
      uid,
      p.partnerId,
      p.kind ?? 'call'
    ).catch(() => {});
  } catch {
    // bookkeeping only
  }
  try {
    const ch = supabase.channel('global-call-invites-broadcast');
    ch.send({ type: 'broadcast', event: 'call_ended', payload: { roomId: p.roomId, cleanId: p.roomId } });
  } catch {
    // best effort
  }
};
