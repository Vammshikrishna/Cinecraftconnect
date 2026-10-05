/**
 * Real-time call engine for the mobile app (LiveKit over WebRTC).
 *
 * The call lives in this module (not in a screen) so it survives navigation: minimizing to the in-app PiP bubble,
 * switching to the chat, or Android's system PiP never tears the media down. Screens just subscribe to snapshots.
 *
 * It speaks the same protocol as the web app so web and mobile users end up in the SAME LiveKit room:
 *   - the room name is the `daily_room_name` of the active `calls` row (`CineCraft_<type>_<roomId>_<suffix>`),
 *   - joiners find it via the `calls` table / `answer_call`, callers create it with `create_or_start_call`,
 *   - the `livekit-token` edge function mints a token only for authorised room members.
 */
import { DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import {
  ConnectionQuality,
  ConnectionState,
  DisconnectReason,
  Participant,
  RemoteParticipant,
  Room,
  RoomEvent,
  RoomOptions,
  Track,
  VideoPresets,
} from 'livekit-client';
import { getSupabaseClient } from '@cinecraft/api';
import { ENV } from '../config/env';

export type CallRoomType = 'direct' | 'project' | 'discussion';
/** 'dropped' = the connection was lost for good but the call may still be running: the user can rejoin it. */
export type LiveCallPhase = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'dropped' | 'ended' | 'failed';
export type LiveCallQuality = 'excellent' | 'good' | 'poor' | 'lost';

export type CallMode = 'call' | 'audio_space';
export type SpeakingMode = 'open' | 'request';
export type SpaceRole = 'host' | 'cohost' | 'speaker' | 'listener';
export type SpaceAction = 'promote' | 'demote' | 'cohost' | 'mute' | 'remove' | 'set_mode' | 'end';

export interface LiveParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMicOn: boolean;
  isCameraOn: boolean;
  /** Camera track to render with <VideoView/> (undefined when the camera is off). */
  videoTrack?: any;
  isScreenSharing: boolean;
  /** Screen-share track to render with <VideoView/> (undefined when not sharing). */
  screenTrack?: any;
  /** Audio-space role (always 'speaker' in a normal call). */
  role: SpaceRole;
  /** Server-granted permission to publish audio. */
  canPublish: boolean;
  /** Listener asked to speak (audio spaces). */
  handRaised: boolean;
  /** Profile picture URL the server put in the participant's metadata (undefined if they have none). */
  avatarUrl?: string;
}

export interface LiveCallSnapshot {
  phase: LiveCallPhase;
  /** Human readable reason when phase is 'failed' / 'ended'. */
  message?: string;
  roomName?: string;
  callId?: string;
  /** True when this device created the call (vs. joined one that was already ringing/active). */
  isCaller: boolean;
  participants: LiveParticipant[];
  /** Participants other than the local user. */
  remoteCount: number;
  quality: LiveCallQuality;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isSpeakerOn: boolean;
  /** 'audio_space' = voice-only room with host / speakers / listeners. */
  mode: CallMode;
  speakingMode: SpeakingMode;
  /** The local user's role in an audio space. */
  myRole: SpaceRole;
  /** Whether the local user is currently allowed to publish audio. */
  canSpeak: boolean;
  handRaised: boolean;
}

export interface JoinLiveCallOptions {
  roomType: CallRoomType;
  roomId: string;
  roomName?: string;
  /** Name shown to the other participants. */
  participantName: string;
  withVideo?: boolean;
  /** Start the call as an audio space (only used when this device creates the call). */
  mode?: CallMode;
  speakingMode?: SpeakingMode;
  startMuted?: boolean;
  /** Which route to prefer for audio output at the start. */
  speakerOn?: boolean;
  /** Called after we created a brand-new call so the caller can ring everyone (push + realtime invite). */
  onCallCreated?: () => void;
  /** Data-channel messages (reactions) from other participants. */
  onData?: (message: { type: string; [k: string]: any }, from?: string) => void;
}

const EMPTY: LiveCallSnapshot = {
  phase: 'idle',
  isCaller: false,
  participants: [],
  remoteCount: 0,
  quality: 'excellent',
  isMicEnabled: false,
  isCameraEnabled: false,
  isScreenSharing: false,
  isSpeakerOn: true,
  mode: 'call',
  speakingMode: 'request',
  myRole: 'speaker',
  canSpeak: true,
  handRaised: false,
};

const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  stopLocalTrackOnUnpublish: true,
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  videoCaptureDefaults: { resolution: VideoPresets.h540.resolution, facingMode: 'user' },
  publishDefaults: {
    simulcast: true,
    dtx: true,
    red: true,
    videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h180],
    videoEncoding: VideoPresets.h540.encoding,
    degradationPreference: 'maintain-framerate',
  },
};

let room: Room | null = null;
let snapshot: LiveCallSnapshot = EMPTY;
const listeners = new Set<() => void>();
let globalsReady = false;
let audioModule: any = null;
let activeCallId: string | undefined;
let startedAsCaller = false;
let onDataCb: JoinLiveCallOptions['onData'];
let joinInFlight: Promise<LiveCallSnapshot> | null = null;
let lastJoinOpts: JoinLiveCallOptions | null = null;
let leaving = false;

const emit = (patch?: Partial<LiveCallSnapshot>) => {
  if (patch) snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // a listener must never break the call
    }
  });
};

export const subscribeLiveCall = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getLiveCallSnapshot = (): LiveCallSnapshot => snapshot;

/** WebRTC globals + audio session come from @livekit/react-native; load lazily so cold start isn't slowed. */
const ensureNative = () => {
  if (globalsReady) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const lk = require('@livekit/react-native');
  lk.registerGlobals();
  audioModule = lk;
  globalsReady = true;
};

const mapQuality = (q?: ConnectionQuality): LiveCallQuality => {
  switch (q) {
    case ConnectionQuality.Excellent:
      return 'excellent';
    case ConnectionQuality.Good:
      return 'good';
    case ConnectionQuality.Poor:
      return 'poor';
    case ConnectionQuality.Lost:
      return 'lost';
    default:
      return 'excellent';
  }
};

const parseRole = (metadata?: string): SpaceRole | undefined => {
  if (!metadata) return undefined;
  try {
    const r = JSON.parse(metadata)?.role;
    return r === 'host' || r === 'cohost' || r === 'speaker' || r === 'listener' ? r : undefined;
  } catch {
    return undefined;
  }
};

const parseAvatar = (metadata?: string): string | undefined => {
  if (!metadata) return undefined;
  try {
    return JSON.parse(metadata)?.avatar || undefined;
  } catch {
    return undefined;
  }
};

const toParticipant = (p: Participant): LiveParticipant => {
  const camPub = p.getTrackPublication(Track.Source.Camera);
  const cameraOn = !!camPub && !camPub.isMuted && !!camPub.track;
  const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
  const sharing = !!screenPub && !screenPub.isMuted && !!screenPub.track;
  return {
    identity: p.identity,
    name: (p.name || p.identity || 'Participant').replace(/_/g, ' '),
    isLocal: p.isLocal,
    isSpeaking: p.isSpeaking,
    isMicOn: p.isMicrophoneEnabled,
    isCameraOn: cameraOn,
    videoTrack: cameraOn ? camPub?.track : undefined,
    isScreenSharing: sharing,
    screenTrack: sharing ? screenPub?.track : undefined,
    role: parseRole(p.metadata) || (snapshot.mode === 'audio_space' ? 'listener' : 'speaker'),
    canPublish: p.permissions?.canPublish ?? true,
    handRaised: (p as any).attributes?.hand === '1',
    avatarUrl: parseAvatar(p.metadata),
  };
};

const refreshParticipants = () => {
  if (!room) return;
  const list: Participant[] = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
  const mapped = list.map(toParticipant);
  const remoteCount = mapped.filter((p) => !p.isLocal).length;
  let speakingMode: SpeakingMode = snapshot.speakingMode;
  try {
    const rm = room.metadata ? JSON.parse(room.metadata)?.speaking_mode : undefined;
    if (rm === 'open' || rm === 'request') speakingMode = rm;
  } catch {
    // keep the last known mode
  }
  const me = mapped.find((p) => p.isLocal);
  const wasSpeaker = snapshot.canSpeak;
  emit({
    participants: mapped,
    remoteCount,
    speakingMode,
    myRole: me?.role ?? snapshot.myRole,
    canSpeak: me?.canPublish ?? snapshot.canSpeak,
    handRaised: me?.handRaised ?? false,
    isMicEnabled: room.localParticipant.isMicrophoneEnabled,
    isCameraEnabled: room.localParticipant.isCameraEnabled,
    isScreenSharing: room.localParticipant.isScreenShareEnabled,
  });
  // The host answered our raised hand (we can publish now): lower it.
  if (!wasSpeaker && me?.canPublish && me.handRaised) {
    void (room.localParticipant as any).setAttributes({ hand: '' });
  }
};

// ─── Permissions ─────────────────────────────────────────────────────────────

const askAndroid = async (perm: any, title: string, message: string): Promise<boolean> => {
  if (await PermissionsAndroid.check(perm)) return true;
  const res = await PermissionsAndroid.request(perm, {
    title,
    message,
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return res === PermissionsAndroid.RESULTS.GRANTED;
};

/** Returns which of the requested permissions we hold. Mic is required to talk; camera only for video calls. */
export const ensureCallPermissions = async (
  withVideo: boolean,
  needMic: boolean = true
): Promise<{ mic: boolean; camera: boolean }> => {
  if (Platform.OS !== 'android') return { mic: true, camera: true };
  const mic = needMic
    ? await askAndroid(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        'Allow microphone access',
        'CineCraft Connect needs the microphone so the other people on the call can hear you.'
      )
    : await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  let camera = true;
  if (withVideo) {
    camera = await askAndroid(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      'Allow camera access',
      'CineCraft Connect needs the camera so the other people on the call can see you.'
    );
  }
  // Android 12+ needs this to route audio to a Bluetooth headset.
  if ((Platform.Version as number) >= 31) {
    try {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    } catch {
      // optional
    }
  }
  return { mic, camera };
};

// ─── Call state machine (shared with the web app) ────────────────────────────

// Matches a connection name for this room whatever its type: an invite can arrive typed as "direct" even though the
// call was started from a project space or a discussion room.
const connectionPattern = (roomId: string) =>
  `CineCraft_%_${roomId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0]}_%`;

/**
 * The running call (or audio space) for a room, if any. A normal call only counts while it is recent (a call row
 * that was never closed must not trap people), but an audio space can legitimately run for hours.
 */
const findActiveCallRow = async (roomId: string): Promise<any | null> => {
  const supabase = getSupabaseClient() as any;
  const base = (cols: string) =>
    supabase
      .from('calls')
      .select(cols)
      .in('status', ['active', 'ringing', 'initiating'])
      .like('daily_room_name', connectionPattern(roomId))
      .order('created_at', { ascending: false })
      .limit(5);
  let { data, error } = await base('id, daily_room_name, status, room_type, call_mode, speaking_mode, created_at');
  // Database not updated yet (no call_mode column): still find ordinary calls so people can join them.
  if (error) ({ data } = await base('id, daily_room_name, status, room_type, created_at'));
  const callCutoff = Date.now() - 10 * 60 * 1000;
  const spaceCutoff = Date.now() - 24 * 60 * 60 * 1000;
  return (
    (data || []).find((r: any) => {
      const created = new Date(r.created_at).getTime();
      return r.call_mode === 'audio_space' ? created >= spaceCutoff : created >= callCutoff;
    }) || null
  );
};

/** Lets the UI decide whether to offer "start a call / start an audio space" or just join what is already running. */
export const findActiveCall = async (roomId: string): Promise<{ mode: CallMode } | null> => {
  try {
    const row = await findActiveCallRow(roomId);
    return row ? { mode: (row.call_mode || 'call') as CallMode } : null;
  } catch {
    return null;
  }
};

/** Finds an already running call for this room and marks us as a participant, or creates a new one. */
const resolveCall = async (
  roomType: CallRoomType,
  roomId: string,
  mode: CallMode = 'call',
  speakingMode: SpeakingMode = 'request'
): Promise<{
  connectionId: string;
  callId?: string;
  isCaller: boolean;
  roomType: CallRoomType;
  mode: CallMode;
  speakingMode: SpeakingMode;
}> => {
  const supabase = getSupabaseClient() as any;
  const cleanId = roomId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];

  // 1. A call that is already ringing / active for this room (match on the connection name the web app also uses).
  try {
    const existing = await findActiveCallRow(roomId);
    if (existing?.daily_room_name) {
      const { data: answered } = await supabase.rpc('answer_call', { p_call_id: existing.id });
      if (answered?.success) {
        return {
          connectionId: answered.connection_id || existing.daily_room_name,
          callId: existing.id,
          isCaller: false,
          roomType: (existing.room_type as CallRoomType) || roomType,
          mode: (answered.call_mode || existing.call_mode || 'call') as CallMode,
          speakingMode: (answered.speaking_mode || existing.speaking_mode || 'request') as SpeakingMode,
        };
      }
    }
  } catch {
    // fall through to the RPC-by-room path
  }

  // 2. Same thing through the RPC (works for uuid-based rooms even when the table read is restricted).
  try {
    const { data: answered } = await supabase.rpc('answer_call', { p_room_type: roomType, p_room_id: cleanId });
    if (answered?.success && answered.connection_id) {
      return {
        connectionId: answered.connection_id,
        callId: answered.call_id,
        isCaller: false,
        roomType,
        mode: (answered.call_mode || 'call') as CallMode,
        speakingMode: (answered.speaking_mode || 'request') as SpeakingMode,
      };
    }
  } catch {
    // no active call: start one
  }

  // 3. Nobody is calling yet: we are the caller.
  const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const connectionId = `CineCraft_${roomType}_${cleanId}_${suffix}`;
  let callId: string | undefined;
  let startError: string | undefined;
  try {
    const { data: started, error } = await supabase.rpc('create_or_start_call', {
      p_room_type: roomType,
      p_room_id: cleanId,
      p_connection_id: connectionId,
      p_call_mode: mode,
      p_speaking_mode: speakingMode,
    });
    if (started?.success) callId = started.call_id;
    else startError = started?.message || error?.message;
  } catch (e: any) {
    startError = e?.message;
  }
  // An audio space only exists as a row in the database. If it could not be created (typically because the
  // database update has not been applied) do NOT quietly start a plain call: nobody could ever join it as a space.
  if (mode === 'audio_space' && !callId) {
    throw new Error(
      `Audio spaces are not enabled on the server yet. The database update (part_n) and the livekit-token / space-control functions need to be deployed first.${startError ? ` (${startError})` : ''}`
    );
  }
  return { connectionId, callId, isCaller: true, roomType, mode, speakingMode };
};

const fetchToken = async (
  roomName: string,
  participantName: string,
  roomType: CallRoomType,
  roomId: string,
  callId?: string
): Promise<{ token: string; space?: { mode: string; speakingMode: string; role: SpaceRole; callId: string } | null }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: {
      roomName,
      participantName,
      roomType,
      roomId: roomId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0],
      callId,
    },
  });
  if (error || !data?.token) {
    // "non-2xx status code" hides the real reason; the response body carries it.
    let detail = '';
    try {
      const body = await (error as any)?.context?.json?.();
      detail = body?.message || body?.error || '';
    } catch {
      // body was not JSON
    }
    throw new Error(detail || (data as any)?.message || error?.message || 'Could not get a call token');
  }
  return { token: data.token as string, space: (data as any).space || null };
};

// ─── Native helpers ──────────────────────────────────────────────────────────

const startForegroundService = async (title: string, withMic: boolean = true) => {
  try {
    await NativeModules.CallService?.start?.(title, withMic);
  } catch {
    // best effort
  }
};

const stopForegroundService = async () => {
  try {
    await NativeModules.CallService?.stop?.();
  } catch {
    // best effort
  }
};

export const setSpeakerOn = async (on: boolean): Promise<void> => {
  emit({ isSpeakerOn: on });
  try {
    ensureNative();
    const outputs: string[] = await audioModule.AudioSession.getAudioOutputs();
    // Bluetooth / wired headsets win over the toggle, exactly like a phone call.
    const preferred = outputs.includes('bluetooth')
      ? 'bluetooth'
      : outputs.includes('headset')
      ? 'headset'
      : on
      ? 'speaker'
      : 'earpiece';
    if (outputs.includes(preferred)) await audioModule.AudioSession.selectAudioOutput(preferred);
  } catch {
    // routing is best effort
  }
};

// ─── Public API ──────────────────────────────────────────────────────────────

const doJoin = async (opts: JoinLiveCallOptions): Promise<LiveCallSnapshot> => {
  // Leaving a previous call first guarantees a single Room instance.
  if (room) await leaveLiveCall({ silent: true });

  lastJoinOpts = opts;
  leaving = false;
  snapshot = { ...EMPTY, phase: 'connecting', roomName: opts.roomName, isSpeakerOn: opts.speakerOn ?? true };
  startedAsCaller = false;
  activeCallId = undefined;
  onDataCb = opts.onData;
  emit();

  try {
    ensureNative();

    const call = await resolveCall(opts.roomType, opts.roomId, opts.mode ?? 'call', opts.speakingMode ?? 'request');
    startedAsCaller = call.isCaller;
    activeCallId = call.callId;
    emit({
      roomName: opts.roomName,
      callId: call.callId,
      isCaller: call.isCaller,
      mode: call.mode,
      speakingMode: call.speakingMode,
    });

    const { token, space } = await fetchToken(call.connectionId, opts.participantName, call.roomType, opts.roomId, call.callId);
    const isSpace = call.mode === 'audio_space';
    if (isSpace && !space) {
      // The old livekit-token function does not know about spaces: everyone would get a plain open call.
      throw new Error('Audio spaces are not enabled on the server yet. The database update (part_n) and the livekit-token / space-control functions need to be deployed first.');
    }
    if (isSpace && space) {
      emit({
        mode: 'audio_space',
        speakingMode: space.speakingMode as SpeakingMode,
        myRole: space.role,
        canSpeak: ['host', 'cohost', 'speaker'].includes(space.role) || space.speakingMode === 'open',
        callId: space.callId || call.callId,
      });
      activeCallId = space.callId || call.callId;
    }

    // Permissions now that we know what we are joining. A space LISTENER never needs the microphone (it is asked
    // for later, if they are invited to speak), and an audio space never needs the camera.
    const needsMicNow = !isSpace || snapshot.myRole === 'host' || snapshot.myRole === 'cohost' || snapshot.myRole === 'speaker';
    const perms = await ensureCallPermissions(!isSpace && !!opts.withVideo, needsMicNow);
    if (needsMicNow && !perms.mic) {
      throw new Error('Microphone access is needed to speak. Turn it on in Settings > Apps > CineCraft Connect.');
    }

    // Start the audio session + foreground service before connecting so the first packet already has audio focus.
    await audioModule.AudioSession.configureAudio({
      android: {
        // A space is mostly listening: default to the loudspeaker unless the user chose the earpiece.
        preferredOutputList: [opts.speakerOn === false ? 'earpiece' : 'speaker', 'headset', 'bluetooth'],
        audioTypeOptions: audioModule.AndroidAudioTypePresets.communication,
      },
      ios: { defaultOutput: opts.speakerOn === false ? 'earpiece' : 'speaker' },
    });
    await audioModule.AudioSession.startAudioSession();
    await startForegroundService(opts.roomName || (isSpace ? 'Audio space' : 'Call in progress'), perms.mic && needsMicNow);

    const r = new Room(ROOM_OPTIONS);
    room = r;

    r.on(RoomEvent.ParticipantConnected, refreshParticipants)
      .on(RoomEvent.ParticipantDisconnected, refreshParticipants)
      .on(RoomEvent.TrackSubscribed, refreshParticipants)
      .on(RoomEvent.TrackUnsubscribed, refreshParticipants)
      .on(RoomEvent.TrackMuted, refreshParticipants)
      .on(RoomEvent.TrackUnmuted, refreshParticipants)
      .on(RoomEvent.LocalTrackPublished, refreshParticipants)
      .on(RoomEvent.LocalTrackUnpublished, refreshParticipants)
      .on(RoomEvent.ActiveSpeakersChanged, refreshParticipants)
      .on(RoomEvent.ParticipantNameChanged, refreshParticipants)
      .on(RoomEvent.ParticipantPermissionsChanged, refreshParticipants)
      .on(RoomEvent.ParticipantMetadataChanged, refreshParticipants)
      .on(RoomEvent.ParticipantAttributesChanged, refreshParticipants)
      .on(RoomEvent.RoomMetadataChanged, refreshParticipants)
      .on(RoomEvent.ConnectionQualityChanged, (q: ConnectionQuality, p: Participant) => {
        if (p.isLocal) emit({ quality: mapQuality(q) });
      })
      .on(RoomEvent.Reconnecting, () => emit({ phase: 'reconnecting' }))
      .on(RoomEvent.Reconnected, () => {
        emit({ phase: 'connected' });
        refreshParticipants();
      })
      .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (room !== r || leaving) return;
        // The server closed the room / removed us / we signed in elsewhere: the call is genuinely over.
        const over =
          reason === DisconnectReason.CLIENT_INITIATED ||
          reason === DisconnectReason.ROOM_DELETED ||
          reason === DisconnectReason.PARTICIPANT_REMOVED ||
          reason === DisconnectReason.DUPLICATE_IDENTITY;
        if (over) {
          emit({ phase: 'ended', message: 'The call ended.' });
        } else {
          // Network loss / server restart that the SDK could not recover from: keep the call context so the user
          // can tap "Rejoin" instead of silently losing the call.
          emit({ phase: 'dropped', message: 'Connection lost.', participants: [], remoteCount: 0 });
        }
        void cleanup();
      })
      .on(RoomEvent.MediaDevicesError, () => {
        emit({ message: 'There is a problem with the microphone or camera.' });
      })
      .on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg && typeof msg.type === 'string') {
            onDataCb?.(msg, participant?.identity);
            // Any screen (e.g. the in-room audio space) can show reactions without owning the call's data callback.
            if (msg.type === 'reaction') DeviceEventEmitter.emit('liveCallReaction', msg);
          }
        } catch {
          // ignore non-JSON data
        }
      });

    await r.connect(ENV.LIVEKIT_URL, token, { autoSubscribe: true });

    // Publish the microphone right away (this was the web "mic is off" bug too). Honour "mute on join".
    // In an audio space only the host starts live; everyone else (listeners, invited speakers) joins muted and
    // turns the mic on themselves when they are on stage.
    try {
      const wantMic = isSpace ? snapshot.myRole === 'host' && !opts.startMuted : !opts.startMuted;
      if (wantMic) await r.localParticipant.setMicrophoneEnabled(true);
    } catch (e) {
      emit({ message: 'Could not start the microphone.' });
    }
    if (!isSpace && opts.withVideo && perms.camera) {
      try {
        await r.localParticipant.setCameraEnabled(true);
      } catch {
        // camera is optional
      }
    }

    emit({ phase: r.state === ConnectionState.Connected ? 'connected' : 'connecting' });
    refreshParticipants();
    void setSpeakerOn(opts.speakerOn !== false);

    if (call.isCaller) opts.onCallCreated?.();
    return snapshot;
  } catch (e: any) {
    const message = e?.message || 'Could not connect the call.';
    emit({ phase: 'failed', message });
    await cleanup();
    return snapshot;
  }
};

/** Joins the running call for a room, or starts a new one. Safe to call twice (returns the in-flight attempt). */
export const joinLiveCall = (opts: JoinLiveCallOptions): Promise<LiveCallSnapshot> => {
  if (joinInFlight) return joinInFlight;
  joinInFlight = doJoin(opts).finally(() => {
    joinInFlight = null;
  });
  return joinInFlight;
};

export const setMicEnabled = async (enabled: boolean): Promise<void> => {
  if (!room) return;
  try {
    if (enabled) {
      const perms = await ensureCallPermissions(false, true);
      if (!perms.mic) {
        emit({ message: 'Allow microphone access to speak.' });
        return;
      }
      // A listener who is now speaking needs the microphone foreground-service type to keep working in the background.
      void startForegroundService(snapshot.roomName || 'Audio space', true);
    }
    await room.localParticipant.setMicrophoneEnabled(enabled);
  } catch {
    emit({ message: 'Could not change the microphone.' });
  }
  refreshParticipants();
};

export const setCameraEnabled = async (enabled: boolean): Promise<boolean> => {
  if (!room) return false;
  try {
    if (enabled) {
      const perms = await ensureCallPermissions(true);
      if (!perms.camera) return false;
    }
    await room.localParticipant.setCameraEnabled(enabled);
    refreshParticipants();
    return true;
  } catch {
    emit({ message: 'Could not change the camera.' });
    return false;
  }
};

export const flipCamera = async (): Promise<void> => {
  if (!room) return;
  try {
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track: any = pub?.track;
    if (track?.restartTrack) {
      const current = track.mediaStreamTrack?.getSettings?.().facingMode;
      await track.restartTrack({ facingMode: current === 'environment' ? 'user' : 'environment' });
    }
  } catch {
    // flipping is best effort
  }
};

/** Sends a small JSON message (reactions) to everyone in the call over the LiveKit data channel. */
export const sendCallData = (message: { type: string; [k: string]: any }): void => {
  if (!room) return;
  try {
    void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)), { reliable: true });
  } catch {
    // ignore
  }
};

const cleanup = async () => {
  const r = room;
  room = null;
  try {
    r?.removeAllListeners();
  } catch {
    // ignore
  }
  try {
    audioModule?.AudioSession.stopAudioSession();
  } catch {
    // ignore
  }
  await stopForegroundService();
};

/**
 * Leaves the call. The call row is ended only when nobody else is left, so a group call keeps running for the
 * remaining members when one person drops.
 */
export const leaveLiveCall = async (options: { silent?: boolean } = {}): Promise<void> => {
  const r = room;
  const callId = activeCallId;
  // No room object means the connection was already lost: never end the call for the others in that case.
  const wasAlone = !!r && r.remoteParticipants.size === 0;
  leaving = true;
  const supabase = getSupabaseClient() as any;

  if (r) {
    try {
      await r.disconnect();
    } catch {
      // ignore
    }
  }
  await cleanup();

  if (callId) {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth?.session?.user?.id;
      if (uid) {
        await supabase.from('call_participants').update({ status: 'left' }).eq('call_id', callId).eq('user_id', uid);
      }
      if (wasAlone) {
        await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', callId);
      }
    } catch {
      // bookkeeping only
    }
  }

  activeCallId = undefined;
  startedAsCaller = false;
  if (!options.silent) lastJoinOpts = null;
  if (!options.silent) emit({ ...EMPTY, phase: 'ended' });
  else snapshot = EMPTY;
};

// ─── Audio spaces ───────────────────────────────────────────────────────────

/** Listener: ask the host to be allowed on stage (shown to hosts as a raised hand). */
export const raiseHand = async (raised: boolean): Promise<void> => {
  if (!room) return;
  try {
    await (room.localParticipant as any).setAttributes({ hand: raised ? '1' : '' });
    refreshParticipants();
  } catch {
    emit({ message: 'Could not raise your hand.' });
  }
};

/**
 * Host / co-host controls (invite to speak, move to listeners, mute, remove, change speaking mode, end the space).
 * The server checks the caller's role; this just forwards the request.
 */
export const spaceAction = async (
  action: SpaceAction,
  opts: { targetUserId?: string; mode?: SpeakingMode } = {}
): Promise<boolean> => {
  if (!activeCallId) return false;
  try {
    const { data, error } = await getSupabaseClient().functions.invoke('space-control', {
      body: { action, callId: activeCallId, targetUserId: opts.targetUserId, mode: opts.mode },
    });
    if (error || (data as any)?.error) {
      emit({ message: (data as any)?.message || error?.message || 'That action is not allowed.' });
      return false;
    }
    // Their hand has been answered: clear it on our side too.
    if (action === 'promote' && opts.targetUserId) refreshParticipants();
    return true;
  } catch {
    emit({ message: 'Could not reach the server. Try again.' });
    return false;
  }
};

/** Reconnects to the call after the connection was lost for good ('dropped'). Resolves with the new snapshot. */
export const rejoinLiveCall = (): Promise<LiveCallSnapshot> => {
  if (!lastJoinOpts) {
    emit({ phase: 'failed', message: 'There is no call to rejoin.' });
    return Promise.resolve(snapshot);
  }
  return joinLiveCall(lastJoinOpts);
};

/** Screen sharing uses Android's MediaProjection (the WebRTC library starts its own foreground service for it). */
export const setScreenShareEnabled = async (enabled: boolean): Promise<boolean> => {
  if (!room) return false;
  if (Platform.OS !== 'android') return false; // iOS needs a ReplayKit broadcast extension (see docs)
  try {
    await room.localParticipant.setScreenShareEnabled(enabled, { audio: false });
    refreshParticipants();
    return true;
  } catch {
    // Most commonly the user dismissed the system "Start recording or casting?" dialog.
    refreshParticipants();
    return false;
  }
};

// Ringback tone for the caller (the "ringing…" sound while waiting for someone to answer).
export const startRingback = (): void => {
  try {
    NativeModules.CallService?.startRingback?.();
  } catch {
    // cosmetic
  }
};
export const stopRingback = (): void => {
  try {
    NativeModules.CallService?.stopRingback?.();
  } catch {
    // cosmetic
  }
};
export const playBusyTone = (): void => {
  try {
    NativeModules.CallService?.playBusy?.();
  } catch {
    // cosmetic
  }
};

export const isLiveCallActive = (): boolean =>
  !!room && snapshot.phase !== 'ended' && snapshot.phase !== 'failed' && snapshot.phase !== 'dropped';

/** True when a call was dropped and can still be rejoined. */
export const canRejoinLiveCall = (): boolean => snapshot.phase === 'dropped' && !!lastJoinOpts;

export const wasCaller = (): boolean => startedAsCaller;
