import React, { useEffect, useReducer, useRef, useState } from 'react';
import { useRoomContext, useParticipants, useConnectionState, useMediaDeviceSelect } from '@livekit/components-react';
import { ConnectionState, RoomEvent, Participant } from 'livekit-client';
import {
  Mic, MicOff, Hand, LogOut, Users, X, Smile, Settings as SettingsIcon, Minimize2, Maximize2, Radio, Headphones, Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { postCallSystemMessage, formatCallDuration } from '@/lib/calls/callSystemMessages';
import { cn } from '@/lib/utils';

type Role = 'host' | 'cohost' | 'speaker' | 'listener';
type SpeakingMode = 'open' | 'request';
type SpaceAction = 'promote' | 'demote' | 'cohost' | 'mute' | 'remove' | 'set_mode' | 'end';

interface Props {
  callId: string;
  roomName?: string;
  roomType: 'discussion' | 'project' | 'direct' | null;
  roomId: string | null;
  initialRole: Role;
  initialSpeakingMode: SpeakingMode;
  /** True while the call is shown as the small floating window. */
  isMinimized?: boolean;
  /** Toggle between the floating window and the full view. */
  onToggleMinimize?: () => void;
  /** Leaves the space (the call context handles cleanup; the space itself keeps running for others). */
  onLeave: () => void;
}

const EMOJIS = ['❤️', '👏', '🔥', '😂', '😮', '🎉', '👍', '🙏'];

/** The profile picture the server put in the participant's metadata (no database round trip needed). */
const metaAvatar = (p: Participant): string | undefined => {
  try {
    return p.metadata ? JSON.parse(p.metadata)?.avatar || undefined : undefined;
  } catch {
    return undefined;
  }
};

const parseRole = (p: Participant): Role => {
  try {
    const r = p.metadata ? JSON.parse(p.metadata)?.role : undefined;
    if (r === 'host' || r === 'cohost' || r === 'speaker' || r === 'listener') return r;
  } catch {
    // fall through
  }
  return 'listener';
};

/**
 * Twitter/X-Spaces style audio room for the web, styled like the rest of the call UI (theme aware, pill header,
 * floating control island). People on stage talk, everyone else listens. The host picks whether listeners must raise a
 * hand (request mode) or can unmute (open mic) and can invite, mute, move or remove people. Publishing rights are
 * enforced by the LiveKit server through the livekit-token / space-control edge functions.
 */
export const AudioSpaceView = ({
  callId, roomName, roomType, roomId, initialRole, initialSpeakingMode, isMinimized, onToggleMinimize, onLeave,
}: Props) => {
  const room = useRoomContext();
  const participants = useParticipants();
  const connectionState = useConnectionState();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Participant | null>(null);
  const [panel, setPanel] = useState<'none' | 'requests' | 'reactions' | 'settings'>('none');
  const [seconds, setSeconds] = useState(0);
  const [floating, setFloating] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const startedRef = useRef(Date.now());

  // Roles, permissions, raised hands and the speaking mode change on the server: re-read them on those events.
  useEffect(() => {
    const events = [
      RoomEvent.ParticipantPermissionsChanged, RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantAttributesChanged,
      RoomEvent.RoomMetadataChanged, RoomEvent.ActiveSpeakersChanged, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
    ];
    events.forEach((e) => room.on(e as any, rerender));

    // Emoji reactions travel over the data channel to everyone in the space.
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === 'reaction' && msg.emoji) showEmoji(msg.emoji, msg.x);
      } catch {
        // ignore other data
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      events.forEach((e) => room.off(e as any, rerender));
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  useEffect(() => {
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - startedRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const showEmoji = (emoji: string, x?: number) => {
    const id = Date.now() + Math.random();
    const left = typeof x === 'number' ? x : 25 + Math.random() * 50;
    setFloating((prev) => [...prev, { id, emoji, x: left }]);
    setTimeout(() => setFloating((prev) => prev.filter((e) => e.id !== id)), 2500);
  };
  const sendReaction = (emoji: string) => {
    const x = 25 + Math.random() * 50;
    showEmoji(emoji, x);
    setPanel('none');
    try {
      room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'reaction', emoji, x })), { reliable: true });
    } catch {
      // reactions are cosmetic
    }
  };

  const local = room.localParticipant;
  const roleOf = (p: Participant): Role => (p.isLocal && !p.metadata ? initialRole : parseRole(p));
  const myRole = roleOf(local);
  const isHost = myRole === 'host';
  const isManager = isHost || myRole === 'cohost';
  const canSpeak = local.permissions?.canPublish ?? false;
  const micOn = local.isMicrophoneEnabled;

  let speakingMode: SpeakingMode = initialSpeakingMode;
  try {
    const m = room.metadata ? JSON.parse(room.metadata)?.speaking_mode : undefined;
    if (m === 'open' || m === 'request') speakingMode = m;
  } catch {
    // keep initial
  }

  const onStage = (p: Participant) => {
    const r = roleOf(p);
    return r === 'host' || r === 'cohost' || r === 'speaker' || (speakingMode === 'open' && (p.permissions?.canPublish ?? false) && p.isMicrophoneEnabled);
  };
  const stage = participants.filter(onStage);
  const listeners = participants.filter((p) => !onStage(p));
  const hands = listeners.filter((p) => !p.isLocal && (p as any).attributes?.hand === '1');
  const handRaised = (local as any).attributes?.hand === '1';
  const connected = connectionState === ConnectionState.Connected;
  const duration = formatCallDuration(seconds * 1000);

  // The host goes live on arrival; everyone else joins muted and turns the mic on themselves when on stage.
  const wentLive = useRef(false);
  useEffect(() => {
    if (wentLive.current || !isHost || !canSpeak) return;
    wentLive.current = true;
    local.setMicrophoneEnabled(true).catch(() => {
      toast({ title: 'Microphone unavailable', description: 'Allow microphone access so people can hear you.', variant: 'destructive' });
    });
  }, [isHost, canSpeak]);

  // Answered raised hand: lower it once we are allowed to speak.
  useEffect(() => {
    if (canSpeak && handRaised) (local as any).setAttributes({ hand: '' }).catch(() => {});
  }, [canSpeak, handRaised]);

  // Avatars
  const idsKey = participants.map((p) => p.identity).sort().join(',');
  useEffect(() => {
    // Only people whose picture did not arrive with their LiveKit metadata need a database lookup.
    const missing = participants.filter((p) => p.identity && !metaAvatar(p) && !avatars[p.identity]).map((p) => p.identity);
    if (missing.length === 0) return;
    let cancelled = false;
    supabase.from('profiles').select('id, avatar_url').in('id', missing).then(({ data, error }) => {
      if (error) console.warn('[AudioSpaceView] avatar lookup failed:', error.message);
      if (cancelled || !data) return;
      setAvatars((prev) => {
        const next = { ...prev };
        data.forEach((r: any) => r.avatar_url && (next[r.id] = r.avatar_url));
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey, participants.map((p) => p.metadata).join('|')]);

  const act = async (action: SpaceAction, target?: Participant, mode?: SpeakingMode) => {
    setPicked(null);
    const { data, error } = await supabase.functions.invoke('space-control', {
      body: { action, callId, targetUserId: target?.identity, mode },
    });
    if (error || (data as any)?.error) {
      toast({ title: 'Not allowed', description: (data as any)?.message || error?.message || 'That action failed.', variant: 'destructive' });
    }
  };

  const toggleMic = async () => {
    try {
      await local.setMicrophoneEnabled(!micOn);
    } catch {
      toast({ title: 'Microphone unavailable', description: 'Allow microphone access in your browser.', variant: 'destructive' });
    }
  };

  const toggleHand = () => (local as any).setAttributes({ hand: handRaised ? '' : '1' }).then(rerender).catch(() => {});

  const endSpace = async () => {
    if (!window.confirm('End this space for everyone?')) return;
    await act('end');
    if (user?.id && roomType && roomId) {
      postCallSystemMessage(roomType, roomId, 'ended', duration, user.id, 'space');
    }
    onLeave();
  };

  const name = (p: Participant) => (p.name || p.identity || 'Guest').replace(/_/g, ' ');
  const avatarUrlOf = (p: Participant) => metaAvatar(p) || avatars[p.identity];
  const avatarEl = (p: Participant, size: number) =>
    avatarUrlOf(p) ? (
      <img
        src={avatarUrlOf(p)}
        alt={name(p)}
        className="rounded-full object-cover w-full h-full"
        referrerPolicy="no-referrer"
        onError={(e) => ((e.currentTarget.style.display = 'none'))}
      />
    ) : (
      <div
        className="rounded-full w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 text-white font-black flex items-center justify-center uppercase"
        style={{ fontSize: size * 0.4 }}
      >
        {(name(p)[0] || '?').toUpperCase()}
      </div>
    );

  // Shared look: same pills / island as the call screen.
  const pill = cn(
    'flex items-center gap-1.5 backdrop-blur-xl px-3 py-1 rounded-full border shadow-sm',
    isDark ? 'bg-black/70 border-white/15 text-white' : 'bg-white/95 border-slate-300 text-slate-800'
  );
  const iconBtn = cn(
    'ctrl-icon-btn transition-all duration-200',
    isDark ? 'bg-white/10 hover:bg-white/20 text-white/90 border border-white/15' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
  );
  const card = cn('rounded-3xl border', isDark ? 'bg-gradient-to-b from-[#1d1d24] to-[#111115] border-white/10' : 'bg-gradient-to-b from-white to-slate-100 border-slate-200/80');
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';

  // ── Floating window (minimized) ──────────────────────────────────────────────────────────────────────────────
  if (isMinimized) {
    const speaking = stage.filter((p) => p.isSpeaking);
    const lead = speaking[0] || stage[0];
    const visible = stage.slice(0, 4);
    // Same look as the call's floating window: dark glass card, red live dot, big controls that scale with the window.
    const stop = (fn: () => void) => (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      fn();
    };
    return (
      <div className="@container/pip relative h-full w-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#1f1b3a] via-[#15151f] to-[#0c0c12] text-white">
        {/* soft speaking glow */}
        <div className={cn('absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl transition-opacity duration-500', speaking.length > 0 ? 'bg-emerald-500/30 opacity-100' : 'bg-purple-500/20 opacity-70')} />

        <div className="relative h-full w-full flex flex-col justify-between p-[clamp(0.5rem,3.5cqi,0.9rem)]">
          {/* Top: live dot, room, timer, expand */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <p className="text-[clamp(9px,3cqi,11px)] font-black uppercase tracking-wider truncate">{roomName || 'Audio space'}</p>
              <span className="text-[clamp(9px,3cqi,11px)] font-mono font-bold text-emerald-400 shrink-0">{connected ? duration : '…'}</span>
            </div>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={stop(() => onToggleMinimize?.())}
              className="shrink-0 w-[clamp(24px,8cqi,32px)] h-[clamp(24px,8cqi,32px)] rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors"
              title="Expand"
            >
              <Maximize2 className="w-[55%] h-[55%]" />
            </button>
          </div>

          {/* Middle: who is on stage + who is speaking */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex -space-x-3 shrink-0">
              {visible.map((p) => (
                <div
                  key={p.identity}
                  className={cn(
                    'w-[clamp(30px,13cqi,44px)] h-[clamp(30px,13cqi,44px)] rounded-full overflow-hidden border-2 transition-all duration-300',
                    p.isSpeaking ? 'border-emerald-400 scale-110 z-10 shadow-[0_0_14px_rgba(16,185,129,0.7)]' : 'border-[#15151f]'
                  )}
                >
                  {avatarEl(p, 44)}
                </div>
              ))}
              {stage.length > visible.length && (
                <div className="w-[clamp(30px,13cqi,44px)] h-[clamp(30px,13cqi,44px)] rounded-full bg-white/15 border-2 border-[#15151f] flex items-center justify-center text-[10px] font-black">
                  +{stage.length - visible.length}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[clamp(11px,3.6cqi,13px)] font-bold truncate">
                {speaking.length > 0 ? name(speaking[0]) : lead ? name(lead) : 'Audio space'}
              </p>
              <div className="flex items-center gap-1.5 text-[clamp(9px,3cqi,11px)] text-slate-400">
                {speaking.length > 0 ? (
                  <>
                    <span className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-pulse [animation-delay:120ms]" />
                      <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-pulse [animation-delay:240ms]" />
                    </span>
                    <span className="text-emerald-400 font-semibold">speaking</span>
                  </>
                ) : (
                  <span className="truncate">{stage.length} on stage · {listeners.length} listening</span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom: mic / hand, requests, leave */}
          <div className="flex items-center justify-center gap-[clamp(6px,3cqi,12px)]">
            {canSpeak ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={stop(toggleMic)}
                className={cn('w-[clamp(30px,10cqi,40px)] h-[clamp(30px,10cqi,40px)] rounded-full flex items-center justify-center text-white transition-colors border', micOn ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-300/40' : 'bg-red-500 hover:bg-red-600 border-red-300/40')}
                title={micOn ? 'Mute' : 'Unmute'}
              >
                {micOn ? <Mic className="w-[48%] h-[48%]" /> : <MicOff className="w-[48%] h-[48%]" />}
              </button>
            ) : (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={stop(toggleHand)}
                className={cn('w-[clamp(30px,10cqi,40px)] h-[clamp(30px,10cqi,40px)] rounded-full flex items-center justify-center transition-colors border', handRaised ? 'bg-purple-600 border-purple-300/40' : 'bg-white/10 hover:bg-white/20 border-white/15')}
                title={handRaised ? 'Lower hand' : 'Request to speak'}
              >
                <Hand className="w-[48%] h-[48%]" />
              </button>
            )}

            {isManager && hands.length > 0 && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={stop(() => {
                  onToggleMinimize?.();
                  setPanel('requests');
                })}
                className="relative h-[clamp(30px,10cqi,40px)] px-3 rounded-full bg-orange-500/90 hover:bg-orange-500 text-white text-xs font-black flex items-center gap-1"
                title="Requests to speak"
              >
                ✋ {hands.length}
              </button>
            )}

            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={stop(() => (isHost ? endSpace() : onLeave()))}
              className="w-[clamp(30px,10cqi,40px)] h-[clamp(30px,10cqi,40px)] rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center border border-red-300/40 shadow-[0_0_14px_rgba(239,68,68,0.5)] transition-colors"
              title={isHost ? 'End space for everyone' : 'Leave quietly'}
            >
              {isHost ? <X className="w-[48%] h-[48%]" /> : <LogOut className="w-[48%] h-[48%]" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative flex flex-col h-full w-full font-sans select-none transition-colors duration-300', isDark ? 'bg-[#0f0f12] text-white' : 'bg-slate-100 text-slate-900')}>
      {/* Header pills */}
      <header className="h-14 shrink-0 px-3 sm:px-6 flex items-center justify-between gap-2 z-30">
        <div className={pill}>
          <Radio className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs font-bold hidden sm:inline">Audio space</span>
          <span className={cn('text-xs font-semibold', mutedText)}>· {stage.length} speaking · {listeners.length} listening</span>
        </div>

        <div className={cn(pill, isDark ? 'text-emerald-400' : 'text-emerald-600')}>
          <span className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-red-500 animate-pulse' : 'bg-amber-400 animate-ping')} />
          <span className="text-[10px] font-black uppercase tracking-wider text-red-500">Live</span>
          <span className="text-xs font-bold font-mono tracking-wider">{connected ? duration : 'Connecting…'}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleMinimize}
          className={cn('rounded-full h-8 w-8 p-0 border backdrop-blur-md shadow-sm flex items-center justify-center', isDark ? 'bg-black/60 hover:bg-black/80 text-orange-400 border-white/15' : 'bg-white/90 hover:bg-white text-orange-500 border-slate-300')}
          title="Minimize"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </Button>
      </header>

      {/* Floating emojis */}
      <div className="absolute inset-0 pointer-events-none z-[150] overflow-hidden">
        {floating.map(({ id, emoji, x }) => (
          <div key={id} className="absolute bottom-24 text-5xl animate-up-float" style={{ left: `${x}%` }}>
            {emoji}
          </div>
        ))}
      </div>

      {/* Title + speaking mode */}
      <div className="px-3 sm:px-6 pb-2 flex items-center justify-between gap-3 z-10">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold truncate">{roomName || 'Audio space'}</h2>
          <p className={cn('text-xs', mutedText)}>
            {speakingMode === 'open' ? 'Open mic · anyone can speak' : 'Raise your hand to speak · the host approves'}
          </p>
        </div>
        {isManager && (
          <div className={cn('flex items-center gap-1 rounded-full p-1 shrink-0 border', isDark ? 'bg-black/50 border-white/10' : 'bg-white border-slate-200')}>
            {(['request', 'open'] as SpeakingMode[]).map((m) => (
              <button
                key={m}
                onClick={() => speakingMode !== m && act('set_mode', undefined, m)}
                className={cn('px-3 py-1 rounded-full text-xs font-bold transition-colors', speakingMode === m ? 'bg-purple-600 text-white' : mutedText + ' hover:text-primary')}
              >
                {m === 'request' ? 'Raise hand' : 'Open mic'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stage + listeners */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-3 z-10 space-y-5">
        <section>
          <p className={cn('text-[11px] font-black tracking-widest mb-2.5 flex items-center gap-1.5', mutedText)}>
            <Mic className="w-3 h-3" /> ON STAGE
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {stage.map((p) => {
              const r = roleOf(p);
              const manageable = isManager && !p.isLocal;
              return (
                <button
                  key={p.identity}
                  onClick={() => manageable && setPicked(p)}
                  className={cn(
                    card, 'relative h-44 sm:h-52 flex items-center justify-center overflow-hidden transition-all duration-300 border',
                    p.isSpeaking ? 'border-emerald-500 ring-4 ring-emerald-400/40 shadow-[0_0_36px_rgba(16,185,129,0.55)]' : isDark ? 'shadow-[0_15px_35px_rgba(0,0,0,0.6)]' : 'shadow-[0_10px_25px_rgba(0,0,0,0.06)]',
                    manageable ? 'cursor-pointer hover:scale-[1.01]' : 'cursor-default'
                  )}
                >
                  {p.isSpeaking && (
                    <>
                      <span className="absolute w-36 h-36 rounded-full bg-emerald-500/15 border border-emerald-400/30" />
                      <span className="absolute w-48 h-48 rounded-full bg-emerald-500/10 border border-emerald-400/20" />
                    </>
                  )}
                  <div className={cn('relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 overflow-hidden shadow-2xl', p.isSpeaking ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 scale-105' : isDark ? 'bg-white/10' : 'bg-slate-200')}>
                    {avatarEl(p, 96)}
                  </div>
                  {r !== 'speaker' && (
                    <span className="absolute top-2.5 left-2.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600 text-white">
                      {r === 'host' ? 'Host' : 'Co-host'}
                    </span>
                  )}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-xl border max-w-full', p.isSpeaking ? (isDark ? 'bg-black/85 border-emerald-500/50 text-emerald-400' : 'bg-white/95 border-emerald-500/60 text-emerald-700') : isDark ? 'bg-black/75 border-white/15 text-white' : 'bg-white/95 border-slate-200 text-slate-800')}>
                      {p.isMicrophoneEnabled ? <Mic className="w-3 h-3 text-emerald-400 shrink-0" /> : <MicOff className="w-3 h-3 text-red-400 shrink-0" />}
                      <span className="text-[11px] font-bold truncate">{name(p)}{p.isLocal ? ' (You)' : ''}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className={cn(card, 'p-4')}>
          <p className={cn('text-[11px] font-black tracking-widest mb-3 flex items-center gap-1.5', mutedText)}>
            <Headphones className="w-3 h-3" /> LISTENERS ({listeners.length})
          </p>
          {listeners.length === 0 ? (
            <p className={cn('text-sm', mutedText)}>Nobody is listening yet. Share the room so people can join.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-2.5">
              {listeners.map((p) => {
                const manageable = isManager && !p.isLocal;
                return (
                  <button
                    key={p.identity}
                    onClick={() => manageable && setPicked(p)}
                    className={cn('relative flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-colors', manageable ? (isDark ? 'hover:bg-white/5 cursor-pointer' : 'hover:bg-slate-100 cursor-pointer') : 'cursor-default')}
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden">{avatarEl(p, 44)}</div>
                    {(p as any).attributes?.hand === '1' && <span className="absolute top-1 right-2 text-sm bg-amber-200 rounded-full px-0.5 shadow">✋</span>}
                    <span className={cn('text-[11px] font-semibold truncate max-w-full', isDark ? 'text-slate-300' : 'text-slate-600')}>
                      {name(p)}{p.isLocal ? ' (You)' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating control island (same style as the call screen) */}
      <footer className="h-20 shrink-0 flex items-center justify-center z-30 pb-2">
        <div className={cn('px-3 py-2 backdrop-blur-2xl border rounded-full flex items-center gap-2 shadow-2xl max-w-[calc(100%-24px)] overflow-x-auto scrollbar-none transition-colors', isDark ? 'bg-[#18181c]/95 border-white/20 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)]' : 'bg-white/95 border-slate-300 text-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.15)]')}>
          {canSpeak ? (
            <button
              onClick={toggleMic}
              className={cn('ctrl-action-btn transition-all duration-200 text-white border', micOn ? 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400/50' : 'bg-red-500 hover:bg-red-600 border-red-400/50')}
              title={micOn ? 'Mute' : 'Unmute'}
            >
              {micOn ? <Mic /> : <MicOff />}
            </button>
          ) : (
            <button
              onClick={toggleHand}
              className={cn('ctrl-action-btn transition-all duration-200 border', handRaised ? 'bg-purple-600 text-white border-purple-400/50' : isDark ? 'bg-white/10 hover:bg-white/20 text-white border-white/15' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300')}
              title={handRaised ? 'Lower hand' : 'Request to speak'}
            >
              <Hand />
            </button>
          )}

          {canSpeak && myRole === 'speaker' && (
            <button onClick={() => act('demote', local)} className={cn(iconBtn, 'w-auto px-3 text-xs font-bold')} title="Step down to listeners">
              Step down
            </button>
          )}

          <div className={cn('h-6 w-px mx-1 shrink-0', isDark ? 'bg-white/20' : 'bg-slate-300')} />

          {isManager && (
            <button onClick={() => setPanel(panel === 'requests' ? 'none' : 'requests')} className={cn(iconBtn, 'relative', panel === 'requests' && 'bg-primary/20 text-primary border-primary/40')} title="Requests to speak">
              <Hand className="w-4 h-4" />
              {hands.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center">{hands.length}</span>
              )}
            </button>
          )}
          <button onClick={() => setPanel(panel === 'reactions' ? 'none' : 'reactions')} className={cn(iconBtn, panel === 'reactions' && 'bg-primary/20 text-primary border-primary/40')} title="Reactions">
            <Smile className="w-4 h-4" />
          </button>
          <button onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')} className={cn(iconBtn, panel === 'settings' && 'bg-primary/20 text-primary border-primary/40')} title="Audio settings">
            <SettingsIcon className="w-4 h-4" />
          </button>

          <div className={cn('h-6 w-px mx-1 shrink-0', isDark ? 'bg-white/20' : 'bg-slate-300')} />

          <button
            onClick={isHost ? endSpace : onLeave}
            className="ctrl-action-btn bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-400/40 transition-all duration-200 active:scale-95"
            title={isHost ? 'End space for everyone' : 'Leave quietly'}
          >
            {isHost ? <X /> : <LogOut />}
          </button>
        </div>
      </footer>

      {/* Popovers above the island */}
      {panel === 'reactions' && (
        <div className={cn('absolute bottom-24 left-1/2 -translate-x-1/2 z-40 flex gap-1 p-2 rounded-full border shadow-2xl backdrop-blur-xl', isDark ? 'bg-[#18181c]/95 border-white/20' : 'bg-white/95 border-slate-300')}>
          {EMOJIS.map((e) => (
            <button key={e} onClick={() => sendReaction(e)} className="text-2xl w-10 h-10 rounded-full hover:scale-125 transition-transform">
              {e}
            </button>
          ))}
        </div>
      )}
      {panel === 'requests' && (
        <PopoverCard isDark={isDark} title={`Requests to speak (${hands.length})`} onClose={() => setPanel('none')}>
          {hands.length === 0 ? (
            <p className={cn('text-sm py-2', mutedText)}>No raised hands right now.</p>
          ) : (
            hands.map((p) => (
              <div key={p.identity} className="flex items-center gap-3 py-2">
                <div className="w-9 h-9 rounded-full overflow-hidden">{avatarEl(p, 36)}</div>
                <p className="flex-1 truncate text-sm font-semibold">{name(p)}</p>
                <Button size="sm" className="rounded-full bg-emerald-500 hover:bg-emerald-600 font-bold text-white" onClick={() => act('promote', p)}>
                  Approve
                </Button>
              </div>
            ))
          )}
        </PopoverCard>
      )}
      {panel === 'settings' && <SpaceAudioSettings isDark={isDark} onClose={() => setPanel('none')} />}

      {/* Manage one person */}
      {picked && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setPicked(null)}>
          <div className={cn('w-full sm:w-80 rounded-t-3xl sm:rounded-3xl p-4 shadow-2xl border', isDark ? 'bg-[#0f0f12] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900')} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full overflow-hidden">{avatarEl(picked, 40)}</div>
              <div className="min-w-0">
                <p className="font-bold truncate">{name(picked)}</p>
                <p className={cn('text-[11px] uppercase tracking-wider font-bold', mutedText)}>{roleOf(picked)}</p>
              </div>
            </div>
            {[
              !onStage(picked) && { label: 'Invite to speak', run: () => act('promote', picked) },
              onStage(picked) && roleOf(picked) !== 'host' && { label: 'Move to listeners', run: () => act('demote', picked) },
              onStage(picked) && picked.isMicrophoneEnabled && { label: 'Mute', run: () => act('mute', picked) },
              isHost && roleOf(picked) !== 'cohost' && roleOf(picked) !== 'host' && { label: 'Make co-host', run: () => act('cohost', picked) },
              roleOf(picked) !== 'host' && !(roleOf(picked) === 'cohost' && !isHost) && { label: 'Remove from space', run: () => act('remove', picked), danger: true },
            ]
              .filter(Boolean)
              .map((item: any) => (
                <button key={item.label} onClick={item.run} className={cn('w-full text-left px-2 py-3 border-t text-sm font-semibold', isDark ? 'border-white/10 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50', item.danger && 'text-red-500')}>
                  {item.label}
                </button>
              ))}
            <button onClick={() => setPicked(null)} className={cn('w-full text-center px-2 py-3 border-t text-sm', isDark ? 'border-white/10 text-slate-400 hover:bg-white/5' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PopoverCard = ({ isDark, title, onClose, children }: { isDark: boolean; title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className={cn('absolute bottom-24 left-1/2 -translate-x-1/2 z-40 w-[min(92%,380px)] rounded-3xl border p-4 shadow-2xl backdrop-blur-xl', isDark ? 'bg-[#18181c]/95 border-white/20 text-white' : 'bg-white/95 border-slate-300 text-slate-900')}>
    <div className="flex items-center justify-between mb-2">
      <p className="font-extrabold text-sm flex items-center gap-2"><Users className="w-4 h-4" /> {title}</p>
      <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-black/10"><X className="w-4 h-4" /></button>
    </div>
    {children}
  </div>
);

/** Microphone / speaker pickers (same device lists the call screen uses). */
const SpaceAudioSettings = ({ isDark, onClose }: { isDark: boolean; onClose: () => void }) => {
  const { devices: mics, activeDeviceId: micId, setActiveMediaDevice: setMic } = useMediaDeviceSelect({ kind: 'audioinput' });
  const { devices: speakers, activeDeviceId: spkId, setActiveMediaDevice: setSpk } = useMediaDeviceSelect({ kind: 'audiooutput' });
  const select = cn('w-full rounded-xl border px-3 py-2 text-sm', isDark ? 'bg-[#0f0f12] border-white/15 text-white' : 'bg-white border-slate-300 text-slate-900');
  return (
    <PopoverCard isDark={isDark} title="Audio settings" onClose={onClose}>
      <label className="text-[11px] font-black tracking-widest text-slate-500 flex items-center gap-1.5 mt-1 mb-1.5"><Mic className="w-3 h-3" /> MICROPHONE</label>
      <select className={select} value={micId} onChange={(e) => setMic(e.target.value)}>
        {mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
      </select>
      <label className="text-[11px] font-black tracking-widest text-slate-500 flex items-center gap-1.5 mt-3 mb-1.5"><Volume2 className="w-3 h-3" /> SPEAKER</label>
      <select className={select} value={spkId} onChange={(e) => setSpk(e.target.value)}>
        {speakers.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>)}
      </select>
    </PopoverCard>
  );
};
