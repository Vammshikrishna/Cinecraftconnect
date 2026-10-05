import { useEffect, useLayoutEffect, useState, useRef, useMemo } from 'react';
import { useGlobalCall } from '@/contexts/CallContext';
import { useLocation } from 'react-router-dom';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  useConnectionState,
  useIsSpeaking,
  useRoomContext,
  LayoutContextProvider,
  useMediaDeviceSelect,
  TrackToggle,
  VideoTrack,
} from '@livekit/components-react';
import { Track, RoomEvent, setLogLevel, LogLevel } from 'livekit-client';
import { CALL_ROOM_OPTIONS } from '@/lib/calls/roomOptions';
import { AudioSpaceView } from './AudioSpaceView';
import '@livekit/components-styles';
import { supabase } from '@/integrations/supabase/client';
import { callAudio } from '@/lib/calls/callAudioEffects';

setLogLevel(LogLevel.error); // Silence LiveKit debug logs
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/theme-provider';
import { Loader2, X, Smile, Settings as SettingsIcon, Mic, MicOff, Camera, Speaker, Shield, ShieldAlert, VolumeX, Radio, Minimize2, Maximize2, PhoneOff, ChevronLeft, ChevronRight, Phone, Users, Scaling, PhoneCall, Check, BellRing, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// A discussion room page can be opened as /discussion-rooms/:id or /discussions/:id (both routes exist). The inline
// call placement only recognised the first, so on the second the call covered the whole screen instead of sitting
// next to the chat.
const isDiscussionPath = (p: string) => p.startsWith('/discussion-rooms') || p.startsWith('/discussions');
const isProjectSpacePath = (p: string) => p.includes('/projects/');

interface LiveKitCallContainerProps {
  roomId: string;
  onLeave: () => void;
  roomName?: string;
  projectId?: string;
  userRole?: 'creator' | 'admin' | 'member' | 'guest';
}

// Voice activity comes from LiveKit's own speaker detection (server-side active speakers + the participant's
// isSpeakingChanged event). It used to also build a Web Audio analyser + requestAnimationFrame loop per tile, which
// piled up AudioContexts (Chrome allows only a handful), cost CPU and could make call audio glitch.
const useVoiceActivity = (participant?: any) => {
  const room = useRoomContext();
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const decayTimeout = useRef<any>(null);

  useEffect(() => {
    if (!participant) return;

    const triggerSpeaking = () => {
      setIsSpeaking(true);
      if (decayTimeout.current) clearTimeout(decayTimeout.current);
      decayTimeout.current = setTimeout(() => setIsSpeaking(false), 950);
    };

    const onActiveSpeakersChanged = (speakers: any[]) => {
      if (speakers.some((s) => s.sid === participant.sid || s.identity === participant.identity)) {
        triggerSpeaking();
      }
    };
    if (room) room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);

    const onSpeakingChanged = (speaking: boolean) => {
      if (speaking) {
        triggerSpeaking();
      } else {
        if (decayTimeout.current) clearTimeout(decayTimeout.current);
        decayTimeout.current = setTimeout(() => setIsSpeaking(false), 850);
      }
    };
    const onMuted = () => setIsSpeaking(false);
    participant.on('isSpeakingChanged', onSpeakingChanged);
    participant.on('trackMuted', onMuted);

    return () => {
      if (room) room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
      participant.off('isSpeakingChanged', onSpeakingChanged);
      participant.off('trackMuted', onMuted);
      if (decayTimeout.current) clearTimeout(decayTimeout.current);
    };
  }, [participant, room]);

  return isSpeaking;
};

const avatarCache = new Map<string, string | null>();

const useParticipantAvatar = (identity?: string, name?: string) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (identity && avatarCache.has(identity)) return avatarCache.get(identity)!;
    if (name && avatarCache.has(name)) return avatarCache.get(name)!;
    return null;
  });

  useEffect(() => {
    if (!identity && !name) return;
    const key = identity || name || '';
    if (avatarCache.has(key)) {
      setAvatarUrl(avatarCache.get(key)!);
      return;
    }

    let isMounted = true;
    const fetchAvatar = async () => {
      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
        
        let query = supabase.from('profiles').select('avatar_url');
        if (isUUID) {
          query = query.eq('id', key);
        } else {
          query = query.or(`username.ilike.${key},full_name.ilike.${key}`);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data?.avatar_url && isMounted) {
          avatarCache.set(key, data.avatar_url);
          setAvatarUrl(data.avatar_url);
        } else {
          avatarCache.set(key, null);
        }
      } catch (err) {
        avatarCache.set(key, null);
      }
    };

    fetchAvatar();
    return () => {
      isMounted = false;
    };
  }, [identity, name]);

  return avatarUrl;
};

// Tier-1 Custom Participant Tile with Full Dark & Light Mode Theme Support & Jitter-Free Glow
const CustomParticipantTile = ({ trackRef }: { trackRef?: any }) => {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const participant = trackRef?.participant;
  const isScreenShare = trackRef?.source === Track.Source.ScreenShare;
  
  // Real-time smooth speaking detection (disabled on screen shares)
  const isVoiceActive = useVoiceActivity(participant);
  const isSpeakingHook = useIsSpeaking(participant);
  const isSpeaking = !isScreenShare && Boolean(isVoiceActive || isSpeakingHook || participant?.isSpeaking);

  const isCameraEnabled = Boolean(participant?.isCameraEnabled && trackRef?.publication?.isSubscribed && !trackRef?.publication?.isMuted);
  const isMicrophoneMuted = Boolean(!participant?.isMicrophoneEnabled);
  const name = participant?.name || participant?.identity || 'Participant';
  const displayName = name.replace(/_/g, ' ');
  const initial = (displayName[0] || 'C').toUpperCase();

  const avatarUrl = useParticipantAvatar(participant?.identity, participant?.name);

  return (
    <div className={cn(
      "relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden flex items-center justify-center transition-all duration-300 ease-out select-none border",
      isDark ? "bg-gradient-to-b from-[#1d1d24] to-[#111115]" : "bg-gradient-to-b from-white to-slate-100",
      isScreenShare 
        ? "bg-black border-white/20 shadow-2xl" 
        : isSpeaking 
          ? "border-emerald-500 ring-4 ring-emerald-400/50 shadow-[0_0_40px_rgba(16,185,129,0.7),inset_0_0_15px_rgba(16,185,129,0.2)]" 
          : isDark
            ? "border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.6)]"
            : "border-slate-200/80 shadow-[0_10px_25px_rgba(0,0,0,0.06)]"
    )}>
      {/* Video Stream / Screen Share Render */}
      {isScreenShare ? (
        <div 
          ref={(el) => {
            if (el) {
              const v = el.querySelector('video') as (HTMLVideoElement & { autoPictureInPicture?: boolean });
              if (v) {
                v.setAttribute('autopictureinpicture', '');
                v.autoPictureInPicture = true;
              }
            }
          }}
          className="w-full h-full flex items-center justify-center bg-black overflow-hidden [&_video]:object-contain [&_video]:w-full [&_video]:h-full [&_video]:max-h-full [&_video]:max-w-full"
        >
          <VideoTrack trackRef={trackRef} className="w-full h-full object-contain bg-black" />
        </div>
      ) : isCameraEnabled ? (
        <div
          ref={(el) => {
            if (el) {
              const v = el.querySelector('video') as (HTMLVideoElement & { autoPictureInPicture?: boolean });
              if (v) {
                v.setAttribute('autopictureinpicture', '');
                v.autoPictureInPicture = true;
              }
            }
          }}
          className="w-full h-full"
        >
          <VideoTrack trackRef={trackRef} className="w-full h-full object-cover" />
        </div>
      ) : (
        /* Tier-1 Audio-Only Avatar View with Smooth Concentric Ambient Rings */
        <div className="relative flex flex-col items-center justify-center p-3 sm:p-6 text-center z-10">
          {/* Smooth Jitter-Free Concentric Ambient Voice Rings */}
          <div className={cn(
            "absolute rounded-full transition-all duration-700 ease-out pointer-events-none",
            isSpeaking 
              ? "w-32 h-32 sm:w-48 sm:h-48 bg-emerald-500/15 border border-emerald-400/30 scale-100 opacity-100" 
              : "w-20 h-20 sm:w-36 sm:h-36 scale-75 opacity-0"
          )} />
          <div className={cn(
            "absolute rounded-full transition-all duration-1000 ease-out pointer-events-none delay-100",
            isSpeaking 
              ? "w-44 h-44 sm:w-64 sm:h-64 bg-emerald-500/10 border border-emerald-400/20 scale-100 opacity-100" 
              : "w-20 h-20 sm:w-36 sm:h-36 scale-75 opacity-0"
          )} />

          {/* Avatar Disc - Profile Photo with fallback to Initial */}
          <div className={cn(
            "relative w-20 h-20 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-500 ease-out shadow-2xl p-1 overflow-hidden",
            isSpeaking
              ? "bg-gradient-to-tr from-emerald-500 to-teal-400 ring-4 ring-emerald-400/60 shadow-[0_0_35px_rgba(16,185,129,0.6)] scale-105"
              : isDark
                ? "bg-gradient-to-tr from-primary/30 to-orange-500/20 border-2 border-white/15"
                : "bg-gradient-to-tr from-primary/20 to-orange-400/20 border-2 border-slate-300"
          )}>
            {avatarUrl ? (
              <img loading="lazy" decoding="async" 
                src={avatarUrl} 
                alt={displayName} 
                className="w-full h-full rounded-full object-cover" 
              />
            ) : (
              <div className={cn(
                "w-full h-full rounded-full flex items-center justify-center text-2xl sm:text-4xl font-black uppercase tracking-wider",
                isDark ? "bg-[#18181c] text-white" : "bg-white text-slate-800 shadow-inner"
              )}>
                {initial}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Floating Info Pill */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none z-20">
        <div className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-xl border shadow-sm max-w-full transition-all",
          isScreenShare
            ? "bg-black/85 border-blue-500/40 text-blue-300"
            : isSpeaking 
              ? isDark
                ? "bg-black/85 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.4)] text-emerald-400" 
                : "bg-white/95 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-emerald-700"
              : isDark
                ? "bg-black/75 border-white/15 text-white"
                : "bg-white/95 border-slate-200 text-slate-800 shadow-sm"
        )}>
          {isScreenShare ? (
            <Radio className="w-3 h-3 text-blue-400 shrink-0 animate-pulse" />
          ) : isMicrophoneMuted ? (
            <MicOff className="w-3 h-3 text-red-400 shrink-0" />
          ) : isSpeaking ? (
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="w-0.5 h-3.5 bg-emerald-400 rounded-full animate-pulse delay-75" />
              <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-pulse delay-150" />
            </div>
          ) : (
            <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
          )}
          <span className="text-[10px] sm:text-xs font-bold truncate">
            {isScreenShare ? `${displayName}'s screen` : displayName}
          </span>
        </div>
      </div>
    </div>
  );
};

// Sub-component to safely use LiveKit hooks inside the Room context
const CallImplementation = ({
  onLeave,
  userRole,
  isMinimized,
  onToggleMinimize,
  onHidePip,
  roomName,
  isFullscreen,
  onToggleFullscreen,
  pipSize,
  onCyclePipSize,
  onSetPipSize,
  roomId,
  roomType,
  isEmbedded,
}: {
  onLeave: () => void;
  userRole?: string;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onHidePip: () => void;
  roomName?: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  pipSize?: { width: number; height: number };
  onCyclePipSize?: () => void;
  onSetPipSize?: (size: { width: number; height: number }) => void;
  roomId?: string;
  roomType?: 'project' | 'discussion' | 'direct';
  isEmbedded?: boolean;
}) => {
  useEffect(() => {
    const lkLeave = () => { };
    return lkLeave;
  }, [onLeave]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHostControls, setShowHostControls] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showMoreReactions, setShowMoreReactions] = useState(false);
  const [showPipControls, setShowPipControls] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number, emoji: string, x: number }[]>([]);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const participants = useParticipants();
  const room = useRoomContext();

  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Listen for LiveKit Data Messages (Emoji reactions from peers)
  useEffect(() => {
    if (!room) return;
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);
        if (data.type === 'reaction' && data.emoji) {
          const id = Date.now() + Math.random();
          const x = data.x || (30 + Math.random() * 40);
          setFloatingEmojis(prev => [...prev, { id, emoji: data.emoji, x }]);
          setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2500);
        }
      } catch (e) {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  const sendReaction = (emoji: string) => {
    const id = Date.now();
    const x = 30 + Math.random() * 40;
    setFloatingEmojis(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2500);
    setShowReactions(false);
    setShowMoreReactions(false);

    // 1. Broadcast via LiveKit Data Channel to all other connected peers
    try {
      if (room?.localParticipant) {
        const payload = JSON.stringify({ type: 'reaction', emoji, x });
        room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
      }
    } catch (err) {}

    // 2. Broadcast via Supabase Realtime Channel
    try {
      const channel = supabase.channel('global-call-invites-broadcast');
      channel.send({
        type: 'broadcast',
        event: 'call_reaction',
        payload: { roomId, emoji, x, senderId: user?.id }
      }).catch(() => {});
    } catch (e) {}
  };

  const [callDuration, setCallDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const connectionState = useConnectionState();
  const isCallConnected = participants.length > 1;

  // Format call duration MM:SS or HH:MM:SS
  const formattedDuration = useMemo(() => {
    const hours = Math.floor(callDuration / 3600);
    const mins = Math.floor((callDuration % 3600) / 60);
    const secs = callDuration % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [callDuration]);

  // Duration Timer
  useEffect(() => {
    if (!isCallConnected) {
      setCallDuration(0);
      return;
    }
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isCallConnected]);

  // Native Hardware Controls: Proximity Sensor + Audio Focus
  useEffect(() => {
    try {
      (window as any).AndroidCallBridge?.enableProximitySensor(true);
      (window as any).AndroidCallBridge?.requestCallAudioFocus();
    } catch (e) {}

    const handleFocusLoss = () => {
      console.log('🔇 [Audio Focus] Loss transient - ducking audio');
    };
    const handleFocusGain = () => {
      console.log('🔊 [Audio Focus] Gain - restoring audio');
    };

    window.addEventListener('native_audio_focus_loss', handleFocusLoss);
    window.addEventListener('native_audio_focus_gain', handleFocusGain);

    return () => {
      try {
        (window as any).AndroidCallBridge?.enableProximitySensor(false);
      } catch (e) {}
      window.removeEventListener('native_audio_focus_loss', handleFocusLoss);
      window.removeEventListener('native_audio_focus_gain', handleFocusGain);
    };
  }, []);

  // Dedicated Picture-in-Picture trigger (Supports native Browser PiP, Document PiP, and In-App Floating PiP)
  const handleEnterPiP = async () => {
    // 1. Android Capacitor Native System PiP
    try {
      if ((window as any).AndroidCallBridge?.enterPictureInPicture) {
        (window as any).AndroidCallBridge.enterPictureInPicture();
        return;
      }
    } catch (e) {}

    // 2. Try Modern Document Picture-in-Picture (Chrome 116+ / Google Meet standard)
    if ('documentPictureInPicture' in window) {
      try {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 360,
          height: 240,
        });

        // Copy all styles to PiP window
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            if (styleSheet.href) {
              link.rel = 'stylesheet';
              link.type = styleSheet.type;
              link.media = (styleSheet.media as any)?.mediaText || '';
              link.href = styleSheet.href;
              pipWindow.document.head.appendChild(link);
            }
          }
        });

        // Mount PiP root container
        const container = document.createElement('div');
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.background = isDark ? '#0f0f12' : '#f8fafc';
        container.style.color = isDark ? '#ffffff' : '#0f172a';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';
        container.style.fontFamily = 'system-ui, sans-serif';

        // Header
        const header = document.createElement('div');
        header.style.padding = '8px 12px';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.background = isDark ? '#18181c' : '#ffffff';
        header.style.borderBottom = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0';
        header.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:8px;height:8px;border-radius:9999px;background:#10b981;"></div>
            <span style="font-weight:bold;font-size:12px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${roomName || 'CineCraft Call'}</span>
          </div>
          <span style="font-family:monospace;font-size:11px;color:#10b981;font-weight:bold;">${formattedDuration}</span>
        `;
        container.appendChild(header);

        // Body with Video
        const body = document.createElement('div');
        body.style.flex = '1';
        body.style.display = 'flex';
        body.style.alignItems = 'center';
        body.style.justifyContent = 'center';
        body.style.position = 'relative';
        body.style.background = '#000000';
        body.style.overflow = 'hidden';

        // Find primary active video
        const activeVideo = document.querySelector('video') as HTMLVideoElement | null;
        if (activeVideo && activeVideo.srcObject) {
          const pipVideo = document.createElement('video');
          pipVideo.srcObject = activeVideo.srcObject;
          pipVideo.autoplay = true;
          pipVideo.playsInline = true;
          pipVideo.muted = true;
          pipVideo.style.width = '100%';
          pipVideo.style.height = '100%';
          pipVideo.style.objectFit = 'contain';
          body.appendChild(pipVideo);
          pipVideo.play().catch(() => {});
        } else {
          body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
              <div style="width:56px;height:56px;border-radius:9999px;background:#ff6b00;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;">
                ${(roomName || 'C')[0].toUpperCase()}
              </div>
              <span style="font-size:11px;color:#94a3b8;font-weight:600;">Active Audio Call</span>
            </div>
          `;
        }
        container.appendChild(body);

        // Footer with Hangup button
        const footer = document.createElement('div');
        footer.style.padding = '8px';
        footer.style.display = 'flex';
        footer.style.alignItems = 'center';
        footer.style.justifyContent = 'center';
        footer.style.gap = '12px';
        footer.style.background = isDark ? '#18181c' : '#ffffff';
        footer.style.borderTop = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0';

        const endBtn = document.createElement('button');
        endBtn.innerHTML = 'End Call';
        endBtn.style.padding = '4px 16px';
        endBtn.style.borderRadius = '9999px';
        endBtn.style.background = '#ef4444';
        endBtn.style.color = '#ffffff';
        endBtn.style.border = 'none';
        endBtn.style.fontWeight = 'bold';
        endBtn.style.fontSize = '11px';
        endBtn.style.cursor = 'pointer';
        endBtn.onclick = () => {
          pipWindow.close();
          onLeave();
        };
        footer.appendChild(endBtn);
        container.appendChild(footer);

        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.appendChild(container);
        return;
      } catch (e) {
        console.warn('Document PiP skipped:', e);
      }
    }

    // 3. Try HTMLVideoElement requestPictureInPicture
    const videoEl = document.querySelector('video') as (HTMLVideoElement & { autoPictureInPicture?: boolean });
    if (videoEl && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          return;
        } else {
          videoEl.autoPictureInPicture = true;
          await videoEl.requestPictureInPicture();
          return;
        }
      } catch (e) {
        console.warn('Video PiP failed:', e);
      }
    }

    // 4. Fallback to in-app floating PiP bubble
    onToggleMinimize();
  };

  // Super-Engineer Auto Picture-in-Picture Manager (Web, Chrome 120+, Edge, Android)
  useEffect(() => {
    // 1. Android Native Bridge
    try {
      (window as any).AndroidCallBridge?.setInActiveCall(true);
    } catch (e) {}

    // 2. Ensure all on-screen video elements have autoPictureInPicture enabled
    const enforceAutoPiP = () => {
      document.querySelectorAll('video').forEach((v: any) => {
        try {
          if (!v.hasAttribute('autopictureinpicture')) {
            v.setAttribute('autopictureinpicture', '');
            v.autoPictureInPicture = true;
            v.disablePictureInPicture = false;
            v.playsInline = true;
            v.setAttribute('playsinline', 'true');
          }
        } catch (e) {}
      });
    };

    // One pass now; individual tiles also set the attribute from their ref callbacks. The old 1.5s interval and
    // document-wide MutationObserver re-scanned every video on every DOM change for the whole call (CPU drain).
    enforceAutoPiP();

    // 3. MediaSession Registration (Triggers Chrome's Auto-PiP permission popup)
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: roomName || 'CineCraft Live Call',
          artist: 'CineCraft Connect',
          album: 'VoIP Meeting',
        });

        (navigator.mediaSession as any).setActionHandler('enterpictureinpicture', () => {
          handleEnterPiP();
        });

        (navigator.mediaSession as any).setActionHandler('hangup', () => {
          onLeave();
        });
      } catch (e) {}
    }

    // 4. Tab Visibility Switch Trigger
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        try {
          if ((window as any).AndroidCallBridge?.enterPictureInPicture) {
            (window as any).AndroidCallBridge.enterPictureInPicture();
            return;
          }
        } catch (e) {}

        const activeVideo = Array.from(document.querySelectorAll('video')).find(
          (v: any) => !v.paused && v.readyState >= 2 && v.videoWidth > 0
        ) || document.querySelector('video');

        if (activeVideo && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
          try {
            (activeVideo as any).autoPictureInPicture = true;
            await (activeVideo as HTMLVideoElement).requestPictureInPicture();
          } catch (e) {
            console.warn('Auto-PiP visibility trigger handled by browser engine:', e);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      try {
        (window as any).AndroidCallBridge?.setInActiveCall(false);
      } catch (e) {}
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, [roomName, onLeave]);

  const toggleSpeaker = () => {
    const nextState = !isSpeakerOn;
    setIsSpeakerOn(nextState);
    try {
      (window as any).AndroidCallBridge?.setSpeakerphoneOn(nextState);
    } catch (e) {}
  };

  // Automatic Cellular-Style Hangup: When partner leaves a 1-on-1 call, end the call automatically
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (participants.length > 1) {
      if (!wasConnectedRef.current) {
        callAudio.playJoinChime();
      }
      wasConnectedRef.current = true;
    } else if (wasConnectedRef.current && participants.length <= 1) {
      // In direct 1-on-1 calls, if the other user hangs up, automatically end the call for this user
      if (roomType === 'direct' || !roomType) {
        console.log('📞 Partner hung up. Auto-ending call session.');
        callAudio.playDisconnectChime();
        const t = setTimeout(() => {
          onLeave();
        }, 600);
        return () => clearTimeout(t);
      }
    }
  }, [participants.length, roomType, onLeave]);

  // Outgoing Ringback Sound Synthesizer
  useEffect(() => {
    if (participants.length <= 1 && !wasConnectedRef.current) {
      callAudio.startOutgoingRingback();
    } else {
      callAudio.stop();
    }
    return () => {
      callAudio.stop();
    };
  }, [participants.length]);

  // 45s Call Unanswered Timeout
  useEffect(() => {
    if (participants.length > 1) return;
    const timeout = setTimeout(() => {
      if (participants.length <= 1 && !wasConnectedRef.current) {
        callAudio.playBusySignal();
        toast({
          title: "No Answer 📞",
          description: "The call timed out with no response.",
          variant: "destructive",
        });
        setTimeout(() => {
          onLeave();
        }, 1500);
      }
    }, 45000);
    return () => clearTimeout(timeout);
  }, [participants.length, onLeave, toast]);

  // Real-time broadcast listener for Call Declined, Call Cancelled, and Call Ended
  useEffect(() => {
    const cleanId = (roomId || '').replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];
    const channel = supabase.channel('global-call-invites-broadcast');

    channel.on('broadcast', { event: 'call_declined' }, ({ payload }) => {
      const pRoom = payload?.roomId || '';
      if (pRoom && (pRoom === roomId || pRoom === cleanId || roomId?.includes(pRoom))) {
        callAudio.playBusySignal();
        toast({
          title: "Call Declined 📞",
          description: "The recipient is currently unavailable.",
          variant: "destructive",
        });
        setTimeout(() => {
          onLeave();
        }, 1500);
      }
    });

    channel.on('broadcast', { event: 'call_cancelled' }, ({ payload }) => {
      const pRoom = payload?.roomId || '';
      if (pRoom && (pRoom === roomId || pRoom === cleanId || roomId?.includes(pRoom))) {
        callAudio.playDisconnectChime();
        toast({
          title: "Call Ended 📞",
          description: "The call was cancelled.",
        });
        setTimeout(() => {
          onLeave();
        }, 1000);
      }
    });

    channel.on('broadcast', { event: 'call_ended' }, ({ payload }) => {
      const pRoom = payload?.roomId || '';
      if (pRoom && (pRoom === roomId || pRoom === cleanId || roomId?.includes(pRoom))) {
        callAudio.playDisconnectChime();
        setTimeout(() => {
          onLeave();
        }, 600);
      }
    });

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onLeave, toast]);

  const [allRoomMembers, setAllRoomMembers] = useState<Array<{ id: string; full_name?: string; username?: string; avatar_url?: string }>>([]);
  const [requestedMemberIds, setRequestedMemberIds] = useState<Set<string>>(new Set());
  const [isHostOrAdmin, setIsHostOrAdmin] = useState(false);

  // Determine if the current user is an Admin, Sub-Admin, or Creator of this space/room
  useEffect(() => {
    if (!user?.id) return;
    
    const checkAdminStatus = async () => {
      if (userRole === 'creator' || userRole === 'admin' || userRole === 'sub_admin') {
        setIsHostOrAdmin(true);
        return;
      }

      const rawTargetId = roomId || '';
      const cleanId = rawTargetId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];

      if (!cleanId) return;

      try {
        // 1. Check projects table creator_id
        const { data: proj } = await (supabase
          .from('projects' as any)
          .select('creator_id')
          .eq('id', cleanId)
          .maybeSingle() as any);

        if (proj && proj.creator_id === user.id) {
          setIsHostOrAdmin(true);
          return;
        }

        // 2. Check project_space_members role
        const { data: spaceMem } = await (supabase
          .from('project_space_members' as any)
          .select('role')
          .eq('user_id', user.id)
          .eq('project_space_id', cleanId)
          .maybeSingle() as any);

        if (spaceMem && (spaceMem.role === 'admin' || spaceMem.role === 'sub_admin' || spaceMem.role === 'creator' || spaceMem.role === 'host')) {
          setIsHostOrAdmin(true);
          return;
        }

        // 3. Check discussion_rooms creator_id
        const { data: discRoom } = await (supabase
          .from('discussion_rooms' as any)
          .select('creator_id')
          .eq('id', cleanId)
          .maybeSingle() as any);

        if (discRoom && discRoom.creator_id === user.id) {
          setIsHostOrAdmin(true);
          return;
        }

        // 4. Check room_members role
        const { data: rMem } = await (supabase
          .from('room_members' as any)
          .select('role')
          .eq('room_id', cleanId)
          .eq('user_id', user.id)
          .maybeSingle() as any);

        if (rMem && (rMem.role === 'admin' || rMem.role === 'sub_admin' || rMem.role === 'host' || rMem.role === 'creator')) {
          setIsHostOrAdmin(true);
          return;
        }

        setIsHostOrAdmin(false);
      } catch (err) {
        console.warn('Error checking admin/host status:', err);
      }
    };

    checkAdminStatus();
  }, [user?.id, userRole, roomId]);

  // Fetch space/room members when participants sheet is opened
  useEffect(() => {
    if (!showParticipants) return;

    const fetchMembers = async () => {
      try {
        const rawTargetId = roomId || '';
        const cleanId = rawTargetId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];
        const userIds = new Set<string>();

        if (cleanId) {
          // 1. Try project_space_members directly by project_space_id
          const { data: pSpaceMembers } = await (supabase
            .from('project_space_members' as any)
            .select('user_id')
            .eq('project_space_id', cleanId) as any);
          if (pSpaceMembers) pSpaceMembers.forEach((m: any) => m.user_id && userIds.add(m.user_id));

          // 2. Resolve space from project_spaces if cleanId is space_id or project_id
          const { data: pSpaces } = await (supabase
            .from('project_spaces' as any)
            .select('id, project_id')
            .or(`id.eq.${cleanId},project_id.eq.${cleanId}`) as any);

          if (pSpaces && pSpaces.length > 0) {
            for (const sp of pSpaces) {
              const { data: spMembers } = await (supabase
                .from('project_space_members' as any)
                .select('user_id')
                .eq('project_space_id', sp.id) as any);
              if (spMembers) spMembers.forEach((m: any) => m.user_id && userIds.add(m.user_id));

              if (sp.project_id) {
                const { data: realProj } = await (supabase
                  .from('projects' as any)
                  .select('creator_id')
                  .eq('id', sp.project_id)
                  .maybeSingle() as any);
                if (realProj?.creator_id) userIds.add(realProj.creator_id);
              }
            }
          }

          // 3. Try project_space_members
          const { data: pMembers } = await (supabase
            .from('project_space_members' as any)
            .select('user_id')
            .eq('project_space_id', cleanId) as any);
          if (pMembers) pMembers.forEach((m: any) => m.user_id && userIds.add(m.user_id));

          // 4. Try project creator directly on projects table
          const { data: projCreator } = await (supabase
            .from('projects' as any)
            .select('creator_id')
            .eq('id', cleanId)
            .maybeSingle() as any);
          if (projCreator?.creator_id) userIds.add(projCreator.creator_id);

          // 5. Try room_members (discussion rooms)
          const { data: rMembers } = await (supabase
            .from('room_members' as any)
            .select('user_id')
            .eq('room_id', cleanId) as any);
          if (rMembers) rMembers.forEach((m: any) => m.user_id && userIds.add(m.user_id));

          // 6. Try conversations (direct messages)
          const { data: conv } = await (supabase
            .from('conversations' as any)
            .select('user1_id, user2_id')
            .eq('id', cleanId)
            .maybeSingle() as any);
          if (conv) {
            if (conv.user1_id) userIds.add(conv.user1_id);
            if (conv.user2_id) userIds.add(conv.user2_id);
          }
        }

        const userArray = Array.from(userIds);
        if (userArray.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .in('id', userArray);

          if (profs && profs.length > 0) {
            const mapped = profs.map(p => ({
              id: p.id,
              full_name: (p.full_name || p.username) ?? undefined,
              username: p.username ?? undefined,
              avatar_url: p.avatar_url ?? undefined
            }));
            setAllRoomMembers(mapped);
          } else {
            setAllRoomMembers([]);
          }
        } else {
          setAllRoomMembers([]);
        }
      } catch (err) {
        console.error('Error fetching room members for participant sheet:', err);
      }
    };

    fetchMembers();
  }, [showParticipants, roomId, user?.id]);

  // Filter out members who are already connected in LiveKit call
  const notInCallMembers = useMemo(() => {
    const connectedIdentities = new Set(
      participants.map(p => (p.identity || p.name || '').toLowerCase())
    );

    return allRoomMembers.filter(m => {
      if (m.id === user?.id) return false;
      
      const mName = (m.full_name || m.username || '').toLowerCase();
      const mUsername = (m.username || '').toLowerCase();
      const mId = (m.id || '').toLowerCase();

      const isConnected = Array.from(connectedIdentities).some(
        conn => conn.includes(mId) || conn.includes(mUsername) || conn.includes(mName) || (mName.length > 0 && conn.includes(mName))
      );

      return !isConnected;
    });
  }, [allRoomMembers, participants, user?.id]);

  const handleRequestToJoin = async (member: { id: string; full_name?: string; username?: string }) => {
    try {
      setRequestedMemberIds(prev => new Set(prev).add(member.id));
      const senderName = profile?.full_name || user?.email?.split('@')[0] || 'A team member';

      const rawTargetId = roomId || '';
      const cleanId = rawTargetId.replace(/^CineCraft_(project|discussion|direct)_/, '').split('_')[0];

      // 1. Insert DB notification to trigger Supabase Realtime postgres_changes on recipient PC/device
      const notificationPayload = {
        user_id: member.id,
        trigger_user_id: user?.id,
        type: 'call_invite',
        title: 'Call Invitation 📞',
        message: `${senderName} is requesting you to join the call in ${roomName || 'Project Space'}`,
        action_url: window.location.pathname,
        is_read: false,
      };

      await (supabase.from('notifications' as any).insert(notificationPayload) as any);

      // 2. Broadcast real-time incoming call ringing banner
      const channel = supabase.channel('global-call-invites-broadcast');
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'incoming_call_invite',
            payload: {
              targetUserId: member.id,
              callerId: user?.id,
              callerName: senderName,
              callerAvatar: profile?.avatar_url,
              roomId: cleanId || roomId,
              roomName: roomName || 'Project Space',
              roomType: roomType || 'project',
              actionUrl: window.location.pathname,
            }
          });
        }
      });

      toast({
        title: "Call Request Sent! 📞",
        description: `Asked ${member.full_name || member.username} to join the call.`,
      });
    } catch (err) {
      console.error('Failed to send call request:', err);
      toast({
        title: "Request Sent! 📞",
        description: `Notified ${member.full_name || member.username} to join.`,
      });
    }
  };

  // Device Selection Hooks
  const { devices: audioDevices, activeDeviceId: activeAudioId, setActiveMediaDevice: setActiveAudio } = useMediaDeviceSelect({ kind: 'audioinput' });
  const { devices: videoDevices, activeDeviceId: activeVideoId, setActiveMediaDevice: setActiveVideo } = useMediaDeviceSelect({ kind: 'videoinput' });
  const { devices: speakerDevices, activeDeviceId: activeSpeakerId, setActiveMediaDevice: setActiveSpeaker } = useMediaDeviceSelect({ kind: 'audiooutput' });

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const screenShareTrack = useMemo(
    () => tracks.find((t: any) => t.source === Track.Source.ScreenShare && t.publication?.isSubscribed !== false),
    [tracks]
  );
  
  const cameraTracks = useMemo(
    () => tracks.filter((t: any) => t.source !== Track.Source.ScreenShare),
    [tracks]
  );

  // Memoize sliced track arrays to prevent stale reference crashes in GridLayout
  const pipTracks = useMemo(() => tracks.slice(0, 1), [tracks]);
  const gridTracks = useMemo(() => tracks.slice(0, 12), [tracks]);

  // Stable key: changes only when real (non-placeholder) tracks change identity.
  const gridKey = useMemo(
    () => tracks
      .filter((t: any) => t.publication?.trackSid)
      .map((t: any) => t.publication!.trackSid)
      .join(','),
    [tracks]
  );

  if (isMinimized) {
    return (
      <div 
        className="@container/pip w-full h-full relative overflow-hidden rounded-3xl border-2 border-white/20 hover:border-primary/60 transition-colors duration-300 shadow-2xl bg-[#121214]"
        onClick={(e) => {
          e.stopPropagation();
          setShowPipControls(!showPipControls);
        }}
      >
        {/* Full-bleed Video Background */}
        <div className="absolute inset-0 z-0">
          {tracks.length > 0 ? (
            <GridLayout key={gridKey} tracks={pipTracks} className="h-full w-full lk-pip-grid">
              <ParticipantTile className="h-full w-full object-cover border-0 shadow-none lk-pip-tile" />
            </GridLayout>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a]">
              <div className="flex -space-x-3">
                {participants.slice(0, 3).map((p) => {
                  const name = (p.name || p.identity || '?').replace(/_/g, ' ');
                  return (
                    <div key={p.sid} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 border-2 border-white/10 flex items-center justify-center text-xs sm:text-sm font-bold text-white backdrop-blur-md shadow-2xl">
                      {name[0].toUpperCase()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Glossy Overlay for Controls */}
        <div className={cn(
          "absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/20 to-black/60 p-[clamp(0.4rem,2.5cqi,0.85rem)] flex flex-col justify-between transition-opacity duration-300",
          showPipControls ? "opacity-100" : "opacity-0 group-hover/bubble:opacity-100"
        )}>
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 bg-black/50 backdrop-blur-md px-[clamp(0.35rem,1.5cqi,0.6rem)] py-[clamp(0.15rem,1cqi,0.3rem)] rounded-full border border-white/10">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />
              <p className="text-white text-[clamp(9px,2.5cqi,11px)] font-black truncate tracking-wider uppercase">
                {roomName || 'Live'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onHidePip(); }} className="text-white/70 hover:text-white hover:bg-white/20 h-[clamp(22px,6.5cqi,32px)] w-[clamp(22px,6.5cqi,32px)] p-0 rounded-full backdrop-blur-sm transition-all flex items-center justify-center" title="Dock to side edge">
                <ChevronRight className="w-[clamp(11px,3.2cqi,15px)] h-[clamp(11px,3.2cqi,15px)]" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 w-full">
             {/* Mini Media Controls with Maximize on Left & End Call on Right */}
             <div className="bg-black/70 backdrop-blur-xl px-[clamp(0.35rem,2cqi,0.6rem)] py-[clamp(0.2rem,1.5cqi,0.4rem)] rounded-full border border-white/15 flex items-center justify-center gap-[clamp(0.2rem,1.5cqi,0.4rem)] max-w-full shadow-2xl">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={(e) => { e.stopPropagation(); onToggleMinimize(); }} 
                  className="h-[clamp(22px,6.5cqi,32px)] w-[clamp(22px,6.5cqi,32px)] p-0 rounded-full text-white/80 hover:text-white hover:bg-white/20 backdrop-blur-sm transition-all shrink-0 flex items-center justify-center" 
                  title="Maximize"
                >
                  <Maximize2 className="w-[clamp(11px,3.2cqi,15px)] h-[clamp(11px,3.2cqi,15px)]" />
                </Button>
                <div className="h-3 w-px bg-white/20 shrink-0" />
                <TrackToggle source={Track.Source.Microphone} className="lk-pip-toggle-btn" />
                <TrackToggle source={Track.Source.Camera} className="lk-pip-toggle-btn" />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={(e) => { e.stopPropagation(); onLeave(); }} 
                  className="h-[clamp(22px,6.5cqi,32px)] w-[clamp(22px,6.5cqi,32px)] p-0 rounded-full bg-red-600/90 hover:bg-red-600 text-white backdrop-blur-sm transition-all shadow-md shrink-0 border border-red-400/40 flex items-center justify-center" 
                  title="End Call"
                >
                  <PhoneOff className="w-[clamp(11px,3.2cqi,15px)] h-[clamp(11px,3.2cqi,15px)]" />
                </Button>
             </div>

            {/* Mini Speaking Badge */}
            {participants.some(p => p.isSpeaking) && (
              <div className="px-2 py-0.5 bg-green-500/80 backdrop-blur-md rounded-full flex items-center gap-1 shadow-lg border border-white/20">
                <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                <span className="text-[8px] text-white font-black uppercase tracking-tighter">Speaking</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col overflow-hidden font-sans transition-colors duration-300 select-none",
      isDark ? "bg-[#0f0f12] text-white" : "bg-slate-100 text-slate-900",
      isEmbedded
        ? "absolute inset-0 w-full h-full z-0"
        : "fixed inset-0 z-[99999] h-[100dvh] w-[100dvw]"
    )}>
      {/* 1. Fixed Top Header Bar (Height 56px) */}
      <header className="h-14 shrink-0 px-3 sm:px-6 flex items-center justify-between z-30">
        {/* Top Left: Speaker Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSpeaker}
          className={cn(
            "rounded-full h-8 px-3 gap-1.5 text-xs font-semibold transition-all border backdrop-blur-md shadow-sm",
            isDark ? "bg-black/60 hover:bg-black/80 text-white/90 border-white/15" : "bg-white/90 hover:bg-white text-slate-800 border-slate-300"
          )}
          title="Toggle Speakerphone / Earpiece"
        >
          {isSpeakerOn ? <Speaker className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-400" />}
          <span className="hidden sm:inline">{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
        </Button>

        {/* Center: Live Call Duration / Status */}
        <div>
          {connectionState === 'reconnecting' ? (
            <div className={cn(
              "flex items-center gap-1.5 backdrop-blur-xl px-3 py-1 rounded-full border shadow-sm",
              isDark ? "bg-black/75 border-amber-500/50 text-amber-400" : "bg-white/95 border-amber-500/60 text-amber-600"
            )}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Reconnecting</span>
            </div>
          ) : !isCallConnected ? (
            <div className={cn(
              "flex items-center gap-1.5 backdrop-blur-xl px-3 py-1 rounded-full border shadow-sm",
              isDark ? "bg-black/75 border-orange-500/40 text-orange-300" : "bg-white/95 border-orange-500/50 text-orange-600"
            )}>
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Ringing...</span>
            </div>
          ) : (
            <div className={cn(
              "flex items-center gap-1.5 backdrop-blur-xl px-3 py-1 rounded-full border shadow-sm",
              isDark ? "bg-black/75 border-white/15 text-emerald-400" : "bg-white/95 border-slate-300 text-emerald-600"
            )}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold font-mono tracking-wider">{formattedDuration}</span>
            </div>
          )}
        </div>

        {/* Top Right: Minimize to PiP */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEnterPiP}
          className={cn(
            "rounded-full h-8 w-8 p-0 transition-all border backdrop-blur-md shadow-sm flex items-center justify-center",
            isDark ? "bg-black/60 hover:bg-black/80 text-orange-400 border-white/15" : "bg-white/90 hover:bg-white text-orange-500 border-slate-300"
          )}
          title="Minimize to PiP"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </Button>
      </header>

      {/* Floating Emojis Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[150] overflow-hidden">
        {floatingEmojis.map(({ id, emoji, x }) => (
          <div
            key={id}
            className="absolute bottom-24 text-5xl animate-up-float"
            style={{ left: `${x}%` }}
          >
            {emoji}
          </div>
        ))}
      </div>

      {/* 2. Main Calling Stage (Guaranteed 0-Overlap, Fits Perfectly between Header & Footer) */}
      <main className="flex-1 min-h-0 w-full px-2 sm:px-4 py-1 flex flex-col items-center justify-center overflow-hidden z-10">
        {!isCallConnected ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-500">
            {/* Concentric Pulsing Ripple Rings */}
            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute w-52 h-52 sm:w-64 sm:h-64 rounded-full bg-primary/10 border border-primary/20 animate-ping opacity-60 pointer-events-none" />
              <div className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-primary/5 border border-primary/10 animate-pulse pointer-events-none" />
              <div className={cn(
                "relative w-28 h-28 sm:w-36 sm:h-36 rounded-full border-2 border-primary/50 p-1.5 shadow-[0_0_50px_rgba(255,107,0,0.35)] flex items-center justify-center overflow-hidden",
                isDark ? "bg-gradient-to-tr from-primary/30 to-orange-500/20" : "bg-gradient-to-tr from-primary/20 to-orange-400/20"
              )}>
                <div className={cn(
                  "w-full h-full rounded-full flex items-center justify-center text-4xl sm:text-5xl font-black uppercase tracking-wider overflow-hidden",
                  isDark ? "bg-zinc-900 text-white" : "bg-white text-slate-800 shadow-md"
                )}>
                  {(roomName || 'CineCraft')[0]}
                </div>
              </div>
            </div>

            <h2 className={cn(
              "text-2xl sm:text-3xl font-black tracking-tight mb-2 max-w-md truncate px-4",
              isDark ? "text-white" : "text-slate-900"
            )}>
              {roomName || 'Live Video Call'}
            </h2>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-widest animate-pulse">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
              <span>Ringing...</span>
            </div>

            {/* Equalizer Sound Wave Bars */}
            <div className="flex items-center gap-1.5 mt-8 h-8">
              <span className="w-1.5 h-3 bg-primary/60 rounded-full animate-pulse" />
              <span className="w-1.5 h-6 bg-primary rounded-full animate-pulse delay-75" />
              <span className="w-1.5 h-8 bg-primary rounded-full animate-pulse delay-150" />
              <span className="w-1.5 h-5 bg-primary/80 rounded-full animate-pulse delay-100" />
              <span className="w-1.5 h-2 bg-primary/50 rounded-full animate-pulse delay-200" />
            </div>
          </div>
        ) : (
          <div className="relative min-h-0 w-full h-full flex flex-col items-center justify-center overflow-hidden">
            {screenShareTrack ? (
              /* Google Meet Mobile Screen Share Hero Layout - Maximum Width */
              <div className="w-full h-full min-h-0 flex flex-col gap-2 max-w-7xl">
                {/* Screen Share Dominant Stage - 100% Complete 16:9 Presentation */}
                <div className="w-full aspect-video sm:aspect-auto sm:flex-1 min-h-0 rounded-2xl overflow-hidden shadow-2xl relative border border-white/15 bg-black flex items-center justify-center">
                  <CustomParticipantTile trackRef={screenShareTrack} />
                </div>

                {/* Speaking Participants Horizontal Strip at Bottom */}
                <div className="h-20 sm:h-28 w-full shrink-0 flex items-center justify-center gap-2 overflow-x-auto py-1 scrollbar-none px-1">
                  {cameraTracks.map((trackRef: any, idx: number) => (
                    <div 
                      key={trackRef.publication?.trackSid || `${trackRef.participant?.identity}_${idx}`}
                      className="h-full aspect-[4/3] sm:aspect-video shrink-0 rounded-2xl overflow-hidden shadow-lg border border-white/10"
                    >
                      <CustomParticipantTile trackRef={trackRef} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Zero-Scroll Adaptive Auto-Fitting Grid (Equal Height Split) */
              <div className={cn(
                "w-full h-full min-h-0 grid gap-2 sm:gap-3 items-center justify-center max-w-6xl",
                cameraTracks.length === 1 && "grid-cols-1 grid-rows-1 max-w-2xl",
                cameraTracks.length === 2 && "grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1",
                cameraTracks.length === 3 && "grid-cols-1 sm:grid-cols-2 grid-rows-3 sm:grid-rows-2",
                cameraTracks.length === 4 && "grid-cols-2 grid-rows-2",
                cameraTracks.length > 4 && "grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2"
              )}>
                {cameraTracks.map((trackRef: any, idx: number) => (
                  <div 
                    key={trackRef.publication?.trackSid || `${trackRef.participant?.identity}_${idx}`} 
                    className="w-full h-full min-h-0 flex items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl"
                  >
                    <CustomParticipantTile trackRef={trackRef} />
                  </div>
                ))}
              </div>
            )}
            
            {/* Overflow Indicator for large calls */}
            {participants.length > 12 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 px-4 py-1.5 bg-black/70 backdrop-blur-md border border-white/15 rounded-full flex items-center gap-2 group cursor-pointer hover:bg-white/10 transition-all z-20"
                onClick={() => setShowParticipants(true)}
              >
                <div className="flex -space-x-2">
                  {participants.slice(12, 15).map(p => {
                    const name = (p.name || p.identity || '?').replace(/_/g, ' ');
                    return (
                      <div key={p.sid} className="w-5 h-5 rounded-full bg-primary/20 border border-white/20 flex items-center justify-center text-[9px] font-bold text-white">
                        {name[0].toUpperCase()}
                      </div>
                    );
                  })}
                </div>
                <span className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors">
                  + {participants.length - 12} others
                </span>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* 3. Fixed Bottom Control Bar (Height 80px) */}
      <footer className="h-20 shrink-0 flex items-center justify-center z-30 pb-2">
        <div className={cn(
          "px-3 py-2 backdrop-blur-2xl border rounded-full flex items-center gap-2 shadow-2xl animate-in fade-in zoom-in duration-300 max-w-[calc(100%-24px)] overflow-x-auto scrollbar-none transition-colors",
          isDark 
            ? "bg-[#18181c]/95 border-white/20 text-white shadow-[0_20px_50px_rgba(0,0,0,0.8)]" 
            : "bg-white/95 border-slate-300 text-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.15)]"
        )}>
        {/* Core Media Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Microphone Toggle */}
          <TrackToggle 
            source={Track.Source.Microphone} 
            className={cn(
              "ctrl-action-btn transition-all duration-200",
              isDark 
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/15" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
            )}
          />

          {/* Camera Toggle */}
          <TrackToggle 
            source={Track.Source.Camera} 
            className={cn(
              "ctrl-action-btn transition-all duration-200",
              isDark 
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/15" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
            )}
          />

          {/* Screen Share (Desktop) */}
          <TrackToggle 
            source={Track.Source.ScreenShare} 
            className={cn(
              "ctrl-action-btn hidden sm:flex transition-all duration-200",
              isDark 
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/15" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
            )}
          />

          {/* End Call Button */}
          <button
            onClick={onLeave}
            className="ctrl-action-btn bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)] border border-red-400/40 transition-all duration-200 active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5 shrink-0" />
          </button>
        </div>

        <div className={cn("h-6 w-px mx-1 shrink-0", isDark ? "bg-white/20" : "bg-slate-300")} />

        {/* Secondary In-Call Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Fullscreen */}
          <button
            onClick={onToggleFullscreen}
            className={cn(
              "ctrl-icon-btn transition-all duration-200",
              isFullscreen 
                ? "bg-primary/20 text-primary border border-primary/40" 
                : isDark 
                  ? "bg-white/10 hover:bg-white/20 text-white/90 border border-white/15" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
            )}
            title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              const next = !showSettings;
              setShowSettings(next);
              if (next) {
                setShowReactions(false);
                setShowMoreReactions(false);
                setShowParticipants(false);
                setShowHostControls(false);
              }
            }}
            className={cn(
              "ctrl-icon-btn transition-all duration-200",
              showSettings
                ? "bg-primary/20 text-primary border border-primary/40"
                : isDark 
                  ? "bg-white/10 hover:bg-white/20 text-white/90 border border-white/15" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
            )}
            title="Audio & Video Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Reactions */}
          <button
            onClick={() => {
              const next = !showReactions;
              setShowReactions(next);
              if (next) {
                setShowParticipants(false);
                setShowSettings(false);
                setShowHostControls(false);
                setShowMoreReactions(false);
              }
            }}
            className={cn(
              "ctrl-icon-btn transition-all duration-200",
              showReactions 
                ? "bg-primary/20 text-primary border border-primary/40" 
                : isDark 
                  ? "bg-white/10 hover:bg-white/20 text-white/90 border border-white/15" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
            )}
            title="Reactions"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Participants */}
          <button
            onClick={() => {
              const next = !showParticipants;
              setShowParticipants(next);
              if (next) {
                setShowReactions(false);
                setShowMoreReactions(false);
                setShowSettings(false);
                setShowHostControls(false);
              }
            }}
            className={cn(
              "ctrl-icon-btn transition-all duration-200 relative",
              showParticipants 
                ? "bg-primary/20 text-primary border border-primary/40" 
                : isDark 
                  ? "bg-white/10 hover:bg-white/20 text-white/90 border border-white/15" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
            )}
            title="Participants"
          >
            <Users className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 text-[9px] font-black bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
              {participants.length}
            </span>
          </button>

          {/* Host Controls */}
          {isHostOrAdmin && (
            <button
              onClick={() => {
                const next = !showHostControls;
                setShowHostControls(next);
                if (next) {
                  setShowReactions(false);
                  setShowMoreReactions(false);
                  setShowParticipants(false);
                  setShowSettings(false);
                }
              }}
              className={cn(
                "ctrl-icon-btn transition-all duration-200",
                showHostControls 
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/40" 
                  : isDark 
                    ? "bg-white/10 hover:bg-white/20 text-white/90 border border-white/15" 
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
              )}
              title="Host Controls"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </footer>

      {/* Invisible backdrop to close reactions when clicking outside on the screen */}
      {showReactions && (
        <div 
          className="fixed inset-0 z-[190]" 
          onClick={() => {
            setShowReactions(false);
            setShowMoreReactions(false);
          }} 
        />
      )}

      {/* Globally Centered Reaction Picker Popover */}
      {showReactions && (
        <div className={`absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 p-1.5 sm:p-2 bg-black/95 backdrop-blur-2xl border border-white/10 ${showMoreReactions ? 'rounded-3xl flex-wrap w-[260px] sm:w-[360px]' : 'rounded-full whitespace-nowrap overflow-x-auto max-w-[95vw]'} flex flex-row items-center gap-1 sm:gap-2 animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] justify-center origin-bottom`}>
          {(showMoreReactions ? ['❤️', '👏', '🔥', '😂', '😮', '😢', '👍', '🎉', '🙌', '✨', '🤩', '💡'] : ['❤️', '👏', '🔥', '😂', '😮', '😢']).map((emoji) => (
            <button
              key={emoji}
              className="text-lg sm:text-2xl hover:scale-125 transition-all duration-200 active:scale-90 px-1 py-0.5 sm:px-1.5 sm:py-1 shrink-0"
              onClick={() => sendReaction(emoji)}
            >
              {emoji}
            </button>
          ))}
          <button
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all shrink-0 ml-0.5 border border-white/10"
            onClick={(e) => {
              e.stopPropagation();
              setShowMoreReactions(!showMoreReactions);
            }}
            title="More Reactions"
          >
            {showMoreReactions ? <X className="w-3.5 h-3.5" /> : <div className="flex gap-0.5"><span className="w-1 h-1 bg-current rounded-full" /><span className="w-1 h-1 bg-current rounded-full" /><span className="w-1 h-1 bg-current rounded-full" /></div>}
          </button>
        </div>
      )}

      {/* Participants Sheet Modal */}
      {showParticipants && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowParticipants(false)} />
          <div className="relative w-[calc(100%-2rem)] max-w-sm sm:max-w-md bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-5 sm:p-6 shadow-[0_30px_90px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">People</h3>
                <p className="text-xl font-bold text-white">In This Call ({participants.length})</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowParticipants(false)} className="hover:bg-red-500/20 text-white rounded-full h-10 w-10 p-0 border border-white/10">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {/* Active Call Participants */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Connected ({participants.length})</p>
                {participants.map((p) => {
                  const pName = p.name || p.identity || 'User';
                  const isMe = p.isLocal;
                  return (
                    <div key={p.identity} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-white text-sm shrink-0">
                          {pName[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {pName} {isMe && <span className="text-[11px] text-primary font-normal">(You)</span>}
                          </p>
                          <p className="text-[10px] text-green-400 font-medium">● Connected</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Members Not In Call (Invite / Ring) */}
              {notInCallMembers.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Not in Call ({notInCallMembers.length})</p>
                  {notInCallMembers.map((m) => {
                    const isRequested = requestedMemberIds.has(m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white text-sm shrink-0 overflow-hidden">
                            {m.avatar_url ? (
                              <img loading="lazy" decoding="async" src={m.avatar_url} alt={m.full_name || m.username} className="w-full h-full object-cover" />
                            ) : (
                              (m.full_name || m.username || 'M')[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{m.full_name || m.username}</p>
                            <p className="text-[10px] text-gray-400">Offline</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isRequested ? "secondary" : "default"}
                          disabled={isRequested}
                          onClick={() => handleRequestToJoin(m)}
                          className={cn(
                            "rounded-xl text-xs font-semibold shrink-0 gap-1.5 h-8 px-3 transition-all",
                            isRequested 
                              ? "bg-green-500/20 text-green-400 border border-green-500/30 cursor-default" 
                              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md active:scale-95"
                          )}
                        >
                          {isRequested ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Ringing...
                            </>
                          ) : (
                            <>
                              <BellRing className="w-3.5 h-3.5" /> Request
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Premium Settings Dialog */}
      {showSettings && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowSettings(false)} />
          <div className="relative w-[calc(100%-2rem)] max-w-sm sm:max-w-md bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-5 sm:p-6 shadow-[0_30px_90px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Preferences</h3>
                <p className="text-xl font-bold text-white">Call Settings</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowSettings(false)} className="hover:bg-red-500/20 text-white rounded-full h-10 w-10 p-0 border border-white/10">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Camera Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 flex items-center gap-2">
                  <Camera className="w-3 h-3" /> Video Input
                </label>
                <select
                  value={activeVideoId}
                  onChange={(e) => setActiveVideo(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-white/10"
                >
                  {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId} className="bg-[#1a1a2e]">{d.label || `Camera ${d.deviceId.slice(0, 5)}...`}</option>)}
                </select>
              </div>

              {/* Microphone Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 flex items-center gap-2">
                  <Mic className="w-3 h-3" /> Audio Input
                </label>
                <select
                  value={activeAudioId}
                  onChange={(e) => setActiveAudio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-white/10"
                >
                  {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId} className="bg-[#1a1a2e]">{d.label || `Mic ${d.deviceId.slice(0, 5)}...`}</option>)}
                </select>
              </div>

              {/* Speaker Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 flex items-center gap-2">
                  <Speaker className="w-3 h-3" /> Audio Output
                </label>
                <select
                  value={activeSpeakerId}
                  onChange={(e) => setActiveSpeaker(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:bg-white/10"
                >
                  {speakerDevices.map(d => <option key={d.deviceId} value={d.deviceId} className="bg-[#1a1a2e]">{d.label || `Speaker ${d.deviceId.slice(0, 5)}...`}</option>)}
                </select>
              </div>
            </div>

            <Button
              className="w-full mt-8 sm:mt-10 rounded-2xl py-6 bg-primary text-primary-foreground font-bold text-sm tracking-wide shadow-[0_10px_30px_rgba(var(--primary),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              onClick={() => setShowSettings(false)}
            >
              Save & Close
            </Button>
          </div>
        </div>,
        document.body
      )}
      {/* Host Controls Dialog */}
      {showHostControls && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowHostControls(false)} />
          <div className="relative w-[calc(100%-2rem)] max-w-sm sm:max-w-md bg-[#0a0a0f]/95 backdrop-blur-3xl border border-orange-500/30 rounded-[32px] p-5 sm:p-6 shadow-[0_30px_90px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-bold tracking-[0.2em] text-orange-400 uppercase">Discussion Host</h3>
                <p className="text-xl font-bold text-white">Host Dashboard</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setShowHostControls(false)} className="hover:bg-red-500/20 text-white rounded-full h-10 w-10 p-0 border border-white/10">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => {
                  toast({ title: "Mute All Requested", description: "Requesting participants to mute their microphones." });
                }}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-all text-left"
              >
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400 shrink-0">
                  <VolumeX className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">Mute All Participants</p>
                  <p className="text-xs text-gray-400 truncate">Silence everyone in the discussion</p>
                </div>
              </button>

              <button
                onClick={() => {
                  if (confirm('Are you sure you want to end this discussion for everyone?')) {
                    onLeave();
                    setShowHostControls(false);
                  }
                }}
                className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4 hover:bg-red-500/20 transition-all text-left"
              >
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-red-400 truncate">End Discussion for All</p>
                  <p className="text-xs text-red-400/60 truncate">Terminate the session globally</p>
                </div>
              </button>
            </div>

            <p className="mt-6 sm:mt-8 text-[10px] text-center text-gray-500 font-medium px-4 leading-relaxed">
              As a host, you are responsible for maintaining a healthy discussion environment.
            </p>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .modern-control-bar {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .modern-control-bar .lk-button {
          background: rgba(255, 255, 255, 0.08) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 9999px !important;
          color: white !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          width: 42px !important;
          height: 42px !important;
        }
        .modern-control-bar .lk-button:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
        }
        .modern-control-bar .lk-button-leave {
          background: rgba(239, 68, 68, 0.25) !important;
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
          color: #f87171 !important;
          border-radius: 9999px !important;
          width: 42px !important;
          height: 42px !important;
          padding: 0 !important;
          min-width: unset !important;
        }
        .modern-control-bar .lk-button-leave:hover {
          background: rgba(239, 68, 68, 0.45) !important;
          border-color: rgba(239, 68, 68, 0.6) !important;
        }
        @media (max-width: 640px) {
          .modern-control-bar .lk-button {
            width: 36px !important;
            height: 36px !important;
          }
          .modern-control-bar .lk-button-leave {
            width: 36px !important;
            height: 36px !important;
          }
        }
        /* Hide internal library buttons that conflict with our custom UI */
        .lk-focus-toggle-button, .lk-pin-button {
          display: none !important;
        }
        /* Force all video tracks and participant tiles to fill their containers completely */
        .lk-participant-tile,
        .lk-video-container,
        [class*="lk-participant-tile"],
        [class*="lk-video-container"] {
          width: 100% !important;
          height: 100% !important;
          overflow: hidden !important;
        }

        .lk-participant-tile video,
        .lk-video-container video,
        .lk-participant-media-video,
        [class*="lk-participant-tile"] video,
        [class*="lk-video-container"] video,
        .lk-pip-tile video,
        video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: inherit !important;
        }

        /* Force PiP video to fill its container 100% edge-to-edge with zero black gaps */
        .lk-pip-grid,
        .lk-pip-grid > *,
        .lk-pip-tile,
        .lk-pip-tile > *,
        .lk-pip-tile .lk-video-container,
        .lk-pip-tile .lk-participant-media-video {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          border-radius: inherit !important;
          aspect-ratio: auto !important;
          background: transparent !important;
          border: none !important;
        }

        .lk-pip-tile video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          border-radius: inherit !important;
        }

        /* Remove resize handles and technical indicators in PiP */
        .lk-pip-tile .lk-participant-metadata,
        .lk-pip-tile [class*="lk-resize"],
        .lk-pip-tile .lk-focus-toggle-button {
          display: none !important;
        }
        .lk-pip-toggle-btn {
          width: clamp(22px, 6.5cqi, 32px) !important;
          height: clamp(22px, 6.5cqi, 32px) !important;
          min-width: 20px !important;
          min-height: 20px !important;
          background: transparent !important;
          border: none !important;
          color: white !important;
          border-radius: 9999px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
          padding: 0 !important;
        }
        .lk-pip-toggle-btn svg {
          width: clamp(11px, 3.2cqi, 15px) !important;
          height: clamp(11px, 3.2cqi, 15px) !important;
        }
        .lk-pip-toggle-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .lk-pip-toggle-btn[data-lk-enabled="false"] {
          color: #f87171 !important;
        }
        @media (max-width: 640px) {
          .modern-control-bar .lk-button-leave {
             width: 34px !important;
             height: 34px !important;
          }
        }
        .lk-grid-layout {
          gap: 1.5rem !important;
          padding-bottom: 3.5rem !important;
        }
        .modern-control-bar.no-dropdowns .lk-button-group > *:not(:first-child) {
          display: none !important;
        }
        .modern-control-bar.no-dropdowns .lk-button-group {
          margin-right: -0.25rem !important;
        }
        .modern-control-bar.no-dropdowns .lk-button-group > .lk-button:first-child {
          border-radius: 9999px !important;
        }
        @keyframes up-float {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          20% { opacity: 1; transform: translateY(-20px) scale(1.2); }
          100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
        }
        .animate-up-float {
          animation: up-float 2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @media (max-width: 640px) {
          .modern-control-bar .lk-button {
            width: 30px !important;
            height: 30px !important;
          }
        }
      `}</style>
    </div>
  );
};

export const LiveKitCallContainer = ({ roomId, onLeave, userRole, roomName }: LiveKitCallContainerProps) => {
  const { user, profile } = useAuth();
  const { toast: showToast } = useToast();
  const toastRef = useRef(showToast);
  toastRef.current = showToast;
  const [token, setToken] = useState<string | null>(null);
  // Set when the call is an audio space (voice only, host / speakers / listeners): decided by the server.
  const [space, setSpace] = useState<{ callId: string; role: 'host' | 'cohost' | 'speaker' | 'listener'; speakingMode: 'open' | 'request' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { callState, toggleMinimize: toggleGlobalMinimize, togglePipHidden: toggleGlobalPipHidden } = useGlobalCall();
  // Capture participant name once at mount so profile re-fetches don't retrigger the token
  const participantNameRef = useRef<string | null>(null);
  const tokenFetchedRef = useRef<string | null>(null); // tracks which roomId the token was fetched for
  const location = useLocation();
  const prevPathname = useRef(location.pathname);
  
  // Initialize LiveKit user choices to prevent "Item with key lk-user-choices does not exist" error
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('lk-user-choices')) {
      try {
        localStorage.setItem('lk-user-choices', JSON.stringify({
          videoEnabled: false,
          audioEnabled: false,
          videoDeviceId: '',
          audioDeviceId: '',
          audioOutputDeviceId: ''
        }));
      } catch (e) {
        console.warn('Failed to initialize lk-user-choices:', e);
      }
    }
  }, []);

  const isMinimized = callState.isMinimized;
  const isPipHidden = callState.isPipHidden;
  const setIsMinimized = (val: boolean) => toggleGlobalMinimize(val);
  const setIsPipHidden = (val: boolean) => toggleGlobalPipHidden(val);
  const [pipSize, setPipSize] = useState({ width: 240, height: 135 });
  const isResizing = useRef(false);
  const touchStartDist = useRef<number | null>(null);
  const initialPipWidth = useRef<number>(240);
  const [embeddedStyle, setEmbeddedStyle] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
  const lastTap = useRef(0);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Native fullscreen request failed, using viewport CSS fallback:', err);
      setIsFullscreen(prev => !prev);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Smart portal targeting:
  // - In project/discussion space (not minimized) → embed in the inline #project-call-container/#discussion-call-container
  // - PiP or navigated away → float over document.body
  useEffect(() => {
    if (!mounted) return;

    if (isMinimized) {
      // PiP always floats on body
      setPortalTarget(document.body);
      return;
    }

    const anchorId = isProjectSpacePath(location.pathname)
      ? 'project-call-container'
      : isDiscussionPath(location.pathname)
        ? 'discussion-call-container'
        : null;

    if (anchorId) {
      const el = document.getElementById(anchorId);
      if (el) {
        setPortalTarget(el);
        return;
      }
    }

    // Fallback: render over body
    setPortalTarget(document.body);
  }, [mounted, isMinimized, location.pathname]);

  const togglePipSize = () => {
    const presets = [
      { width: 200, height: 112 },
      { width: 280, height: 158 },
      { width: 360, height: 202 }
    ];
    
    setPipSize(prev => {
      const currentIdx = presets.findIndex(p => Math.abs(p.width - prev.width) < 25);
      const nextIdx = (currentIdx + 1) % presets.length;
      return presets[nextIdx];
    });
  };

  const initialPipHeight = useRef<number>(135);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMinimized) return;
    if (e.touches.length === 2) {
      isResizing.current = true;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      initialPipWidth.current = pipSize.width;
      initialPipHeight.current = pipSize.height;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMinimized || e.touches.length !== 2 || !touchStartDist.current) return;
    const currentDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const scaleFactor = currentDist / touchStartDist.current;
    const newWidth = Math.min(Math.max(160, Math.round(initialPipWidth.current * scaleFactor)), Math.min(window.innerWidth - 32, 500));
    const newHeight = Math.min(Math.max(120, Math.round(initialPipHeight.current * scaleFactor)), Math.min(window.innerHeight - 32, 400));
    setPipSize({ width: newWidth, height: newHeight });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDist.current = null;
      isResizing.current = false;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isMinimized) return;
    const delta = e.deltaY < 0 ? 18 : -18;
    setPipSize(prev => ({
      width: Math.min(Math.max(160, prev.width + delta), Math.min(window.innerWidth - 32, 500)),
      height: Math.min(Math.max(120, prev.height + Math.round(delta * 0.75)), Math.min(window.innerHeight - 32, 400))
    }));
  };

  const handlePipClick = () => {
    if (!isMinimized) return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap detected
      togglePipSize();
    }
    lastTap.current = now;
  };

  const isEmbeddedView = isDiscussionPath(location.pathname) || location.pathname.startsWith('/projects/');
  
  // Logic to determine if we are currently looking at the same project/room that the call belongs to
  const isCurrentlyInCallRoom = () => {
    if (!callState.roomId) return false;
    
    // Check for project space match (using the anchor we added to ProjectSpace.tsx)
    if (callState.roomType === 'project') {
      const anchor = document.getElementById('active-project-anchor');
      const activeSpaceId = anchor?.getAttribute('data-space-id');
      const activeProjectId = anchor?.getAttribute('data-project-id');
      return activeSpaceId === callState.roomId || activeProjectId === callState.roomId;
    }
    
    // Check for discussion room match (using the anchor we added to DiscussionRooms.tsx)
    if (callState.roomType === 'discussion') {
      const anchor = document.getElementById('active-discussion-anchor');
      const activeRoomId = anchor?.getAttribute('data-room-id');
      return activeRoomId === callState.roomId;
    }
    
    return false;
  };
  
  const shouldHidePip = isMinimized && isPipHidden;

  // Inline mode: on a room page the call is positioned exactly over the page's call panel, so the chat stays
  // visible next to it (desktop) / one tap away (mobile tabs). embeddedStyle is measured from that panel.
  const embeddedActive = !isMinimized && isEmbeddedView && embeddedStyle.width > 0 && embeddedStyle.height > 0;
  const embeddedHidden = false;

  // Handle gestures & snapping for PiP
  const handleDragEnd = (_: any, info: any) => {
    if (!isMinimized) return;
    
    // Gesture 1: Fling / Swipe towards right edge to hide to side pill
    const isFlingRight = info.velocity.x > 250 || info.offset.x > 90;
    const isFlingLeft = info.velocity.x < -250 || info.offset.x < -180;
    
    if (isFlingRight || isFlingLeft) {
      setIsPipHidden(true);
      return;
    }
    
    // Gesture 2: Corner Snapping & Position Adjusting
    const x = info.offset.x + pipPos.x;
    const y = info.offset.y + pipPos.y;
    
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const padding = 16;
    const bottomOffset = 70;
    
    // Snap boundaries
    const leftLimit = -(windowW - pipSize.width - padding * 2);
    const topLimit = -(windowH - pipSize.height - padding * 2 - bottomOffset);
    
    // Smooth snap to 4 corners (top-right, top-left, bottom-right, bottom-left)
    const newX = x < leftLimit / 2 ? leftLimit : 0;
    const newY = y < topLimit / 2 ? topLimit : 0;
    
    setPipPos({ x: newX, y: newY });
  };

  // Measure the inline call panel before paint; only updates state when the rectangle really changed.
  useLayoutEffect(() => {
    if (isMinimized || !isEmbeddedView) return;
    const anchorId = isProjectSpacePath(location.pathname) ? 'project-call-container' : 'discussion-call-container';
    const el = document.getElementById(anchorId) || document.getElementById('discussion-call-container');
    const rect = el?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    setEmbeddedStyle((prev) =>
      prev.top === rect.top && prev.left === rect.left && prev.width === rect.width && prev.height === rect.height
        ? prev
        : { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
    );
  });

  // Dynamically map exact coordinates of the inline placeholder
  // This prevents LiveKit components from unmounting (which causes the blank screen)
  useEffect(() => {
    if (isMinimized || !(isDiscussionPath(location.pathname) || location.pathname.startsWith('/projects/'))) {
      return;
    }

    let ticking = false;
    const checkNodeAndUpdate = () => {
      // Try finding the specific anchor for current context
      const anchorId = isProjectSpacePath(location.pathname) ? 'project-call-container' : 'discussion-call-container';
      const el = document.getElementById(anchorId) || document.getElementById('discussion-call-container');
      
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setEmbeddedStyle((prev) =>
            prev.top === rect.top && prev.left === rect.left && prev.width === rect.width && prev.height === rect.height
              ? prev
              : { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          );
          return;
        }
      }
      
      if (isEmbeddedView) {
        // Functional update: this runs every frame now, so don't create a new state object when nothing changed.
        setEmbeddedStyle((prev) =>
          prev.width === 0 && prev.height === 0 && prev.top === 0 && prev.left === 0 ? prev : { top: 0, left: 0, width: 0, height: 0 }
        );
      }
    };

    const handleThrottledUpdate = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          checkNodeAndUpdate();
          ticking = false;
        });
        ticking = true;
      }
    };

    checkNodeAndUpdate();
    
    // Set up ResizeObserver to catch layout/size shifts of the anchor element
    let resizeObserver: ResizeObserver | null = null;
    const anchorId = isProjectSpacePath(location.pathname) ? 'project-call-container' : 'discussion-call-container';
    const el = document.getElementById(anchorId) || document.getElementById('discussion-call-container');
    if (el && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleThrottledUpdate();
      });
      resizeObserver.observe(el);
    }

    // Listen to scroll events (capturing) and window resize events with rAF throttling
    window.addEventListener('scroll', handleThrottledUpdate, true);
    window.addEventListener('resize', handleThrottledUpdate);
    
    // Re-measure every frame while the call is embedded. Coming back from the floating window (PiP) the page reveals the
    // call panel and re-lays itself out over several frames (section switch, sidebar, scroll), so a one-off measurement
    // or a 0.5s poll left the call sized to a stale rectangle: cut off at the top, with the panel's black background
    // showing underneath. Reading a rectangle per frame is cheap and state only changes when the rectangle does.
    let rafId = 0;
    const frameLoop = () => {
      checkNodeAndUpdate();
      rafId = requestAnimationFrame(frameLoop);
    };
    rafId = requestAnimationFrame(frameLoop);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('scroll', handleThrottledUpdate, true);
      window.removeEventListener('resize', handleThrottledUpdate);
      cancelAnimationFrame(rafId);
    };
  }, [location.pathname, isMinimized]);

  // Auto-minimize ONLY when the user actively navigates to a new page
  useEffect(() => {
    if (prevPathname.current && prevPathname.current !== location.pathname) {
      const isRoomPath = isDiscussionPath(location.pathname) || isProjectSpacePath(location.pathname);
      if (!isRoomPath && !isMinimized) {
        setIsMinimized(true);
      }
    }
    prevPathname.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    // Only fetch token once per roomId — do NOT re-fetch on profile/session changes
    // to prevent the call from disconnecting when auth events fire (e.g. TOKEN_REFRESHED)
    if (tokenFetchedRef.current === roomId) return;

    const fetchToken = async () => {
      try {
        // Capture name once and reuse it — profile updates must not cause a re-fetch
        if (!participantNameRef.current) {
          participantNameRef.current = profile?.full_name?.trim() || user.email?.split('@')[0] || user.id;
        }
        const participantName = participantNameRef.current;
        const { data, error: funcError } = await supabase.functions.invoke('livekit-token', {
          body: {
            roomName: roomId,
            participantName,
          },
        });

        if (funcError) {
          // "Edge Function returned a non-2xx status code" hides the real reason. The response body has it.
          let detail = '';
          try {
            const body = await (funcError as any).context?.json?.();
            detail = body?.message || body?.error || '';
          } catch {
            // body was not JSON
          }
          throw new Error(detail || funcError.message);
        }
        if (callState.callMode === 'audio_space' && data?.space?.mode !== 'audio_space') {
          // The old livekit-token function does not know about spaces: it would give everyone an ordinary call.
          throw new Error('Audio spaces are not enabled on the server yet. The database update (part_n) and the livekit-token / space-control functions need to be deployed first.');
        }
        tokenFetchedRef.current = roomId;
        setSpace(data.space?.mode === 'audio_space' ? { callId: data.space.callId, role: data.space.role, speakingMode: data.space.speakingMode } : null);
        setToken(data.token);
      } catch (err: any) {
        console.error('Error fetching LiveKit token:', err);
        setError(err.message || 'Failed to connect to call service');
      }
    };

    fetchToken();
  }, [roomId, user?.id]);

  const serverUrl = import.meta.env.VITE_LIVEKIT_URL;

  if (error) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#202124] text-white flex flex-col items-center justify-center p-4">
        <div className="bg-[#2b2b2b] p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-red-500/30">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
          <p className="text-gray-400 mb-8">{error}</p>
          <Button onClick={onLeave} variant="destructive" className="w-full py-6 text-lg font-bold rounded-xl shadow-lg shadow-red-500/20">
            Close Call
          </Button>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#202124] text-white flex flex-col items-center justify-center p-4">
        <div className="p-8 text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-medium animate-pulse">Initializing Secure Connection...</h2>
          <p className="text-gray-500 mt-2 text-sm italic">Connecting to CineCraft Live Services</p>
        </div>
      </div>
    );
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={isMinimized ? { scale: 0.8, opacity: 0 } : { opacity: 0 }}
        animate={
          shouldHidePip ? {
            opacity: 0,
            scale: 0.5,
            x: pipPos.x,
            y: pipPos.y,
            pointerEvents: 'none' as const,
            transition: { duration: 0.2, ease: "easeIn" }
          } : isMinimized ? {
            scale: 1,
            opacity: 1,
            x: pipPos.x,
            y: pipPos.y,
            pointerEvents: 'auto' as const,
            transition: { type: "spring", damping: 35, stiffness: 450 }
          } : {
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
            pointerEvents: 'auto' as const,
            transition: { type: "spring", damping: 35, stiffness: 450 }
          }
        }
        exit={{ scale: 0.5, opacity: 0 }}
        drag={isMinimized && !isResizing.current}
        onDragEnd={handleDragEnd}
        dragMomentum={true}
        dragConstraints={{ 
          left: typeof window !== 'undefined' ? -(window.innerWidth - pipSize.width - 16) : -1000, 
          right: 40, 
          top: typeof window !== 'undefined' ? -(window.innerHeight - pipSize.height - 80) : -1000, 
          bottom: 20 
        }}
        dragElastic={0.1}
        className={
          isMinimized
            ? "fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-[999999] bg-[#121214] rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] cursor-move touch-none group/bubble border-2 border-white/20 hover:border-primary/60 transition-colors duration-300 overflow-hidden"
            : embeddedActive || embeddedHidden
              ? "fixed z-[45] bg-[#09090b] overflow-hidden"
              : "fixed inset-0 top-0 left-0 right-0 bottom-0 z-[999999] bg-[#121214] overflow-hidden h-[100dvh] w-[100dvw]"
        }
        style={{
          width: isMinimized ? `${pipSize.width}px` : embeddedActive ? `${embeddedStyle.width}px` : embeddedHidden ? '1px' : '100vw',
          height: isMinimized ? `${pipSize.height}px` : embeddedActive ? `${embeddedStyle.height}px` : embeddedHidden ? '1px' : '100dvh',
          top: isMinimized ? undefined : embeddedActive ? embeddedStyle.top : embeddedHidden ? -10 : 0,
          left: isMinimized ? undefined : embeddedActive ? embeddedStyle.left : embeddedHidden ? -10 : 0,
          right: isMinimized || embeddedActive || embeddedHidden ? undefined : 0,
          bottom: isMinimized || embeddedActive || embeddedHidden ? undefined : 0,
          opacity: embeddedHidden ? 0 : undefined,
          pointerEvents: embeddedHidden ? 'none' : undefined,
          willChange: isMinimized ? 'transform' : 'auto',
          transform: isMinimized ? undefined : 'none',
        }}
        onPointerDown={handlePipClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {isMinimized && (
          <>
            {/* Top-Left Corner Resize Handle */}
            <div
              className="absolute top-0 left-0 w-8 h-8 cursor-nwse-resize z-[100] flex items-start justify-start p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 touch-none"
              onPointerDown={(e) => { e.stopPropagation(); isResizing.current = true; }}
              onPointerUp={() => { isResizing.current = false; }}
            >
              <motion.div
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0}
                onDrag={(_, info) => {
                  setPipSize(prev => ({
                    width: Math.min(Math.max(160, prev.width - info.delta.x), Math.min(window.innerWidth - 32, 500)),
                    height: Math.min(Math.max(120, prev.height - info.delta.y), Math.min(window.innerHeight - 32, 400))
                  }));
                }}
                onDragEnd={() => { isResizing.current = false; }}
                className="w-5 h-5 rounded-full bg-black/70 hover:bg-primary/90 flex items-center justify-center shadow-lg border border-white/20 backdrop-blur-md"
                title="Drag top-left corner to resize"
              >
                <div className="w-2 h-2 border-l-2 border-t-2 border-white/90 rounded-tl-xs" />
              </motion.div>
            </div>

            {/* Top-Right Corner Resize Handle */}
            <div
              className="absolute top-0 right-0 w-8 h-8 cursor-nesw-resize z-[100] flex items-start justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 touch-none"
              onPointerDown={(e) => { e.stopPropagation(); isResizing.current = true; }}
              onPointerUp={() => { isResizing.current = false; }}
            >
              <motion.div
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0}
                onDrag={(_, info) => {
                  setPipSize(prev => ({
                    width: Math.min(Math.max(160, prev.width + info.delta.x), Math.min(window.innerWidth - 32, 500)),
                    height: Math.min(Math.max(120, prev.height - info.delta.y), Math.min(window.innerHeight - 32, 400))
                  }));
                }}
                onDragEnd={() => { isResizing.current = false; }}
                className="w-5 h-5 rounded-full bg-black/70 hover:bg-primary/90 flex items-center justify-center shadow-lg border border-white/20 backdrop-blur-md"
                title="Drag top-right corner to resize"
              >
                <div className="w-2 h-2 border-r-2 border-t-2 border-white/90 rounded-tr-xs" />
              </motion.div>
            </div>

            {/* Bottom-Left Corner Resize Handle */}
            <div
              className="absolute bottom-0 left-0 w-8 h-8 cursor-nesw-resize z-[100] flex items-end justify-start p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 touch-none"
              onPointerDown={(e) => { e.stopPropagation(); isResizing.current = true; }}
              onPointerUp={() => { isResizing.current = false; }}
            >
              <motion.div
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0}
                onDrag={(_, info) => {
                  setPipSize(prev => ({
                    width: Math.min(Math.max(160, prev.width - info.delta.x), Math.min(window.innerWidth - 32, 500)),
                    height: Math.min(Math.max(120, prev.height + info.delta.y), Math.min(window.innerHeight - 32, 400))
                  }));
                }}
                onDragEnd={() => { isResizing.current = false; }}
                className="w-5 h-5 rounded-full bg-black/70 hover:bg-primary/90 flex items-center justify-center shadow-lg border border-white/20 backdrop-blur-md"
                title="Drag bottom-left corner to resize"
              >
                <div className="w-2 h-2 border-l-2 border-b-2 border-white/90 rounded-bl-xs" />
              </motion.div>
            </div>

            {/* Bottom-Right Corner Resize Handle */}
            <div
              className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize z-[100] flex items-end justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 touch-none"
              onPointerDown={(e) => { e.stopPropagation(); isResizing.current = true; }}
              onPointerUp={() => { isResizing.current = false; }}
            >
              <motion.div
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0}
                onDrag={(_, info) => {
                  setPipSize(prev => ({
                    width: Math.min(Math.max(160, prev.width + info.delta.x), Math.min(window.innerWidth - 32, 500)),
                    height: Math.min(Math.max(120, prev.height + info.delta.y), Math.min(window.innerHeight - 32, 400))
                  }));
                }}
                onDragEnd={() => { isResizing.current = false; }}
                className="w-5 h-5 rounded-full bg-black/70 hover:bg-primary/90 flex items-center justify-center shadow-lg border border-white/20 backdrop-blur-md"
                title="Drag bottom-right corner to resize"
              >
                <div className="w-2 h-2 border-r-2 border-b-2 border-white/90 rounded-br-xs" />
              </motion.div>
            </div>
          </>
        )}
        {/* LiveKit Room */}
        <LiveKitRoom
          video={false}
          // Publish the microphone as soon as we connect. It was false before, so nobody could hear you until
          // you found and tapped the mic button.
          audio={!space}
          options={CALL_ROOM_OPTIONS}
          onMediaDeviceFailure={(failure) => {
            toastRef.current({
              title: 'Microphone unavailable',
              description:
                failure === 'PermissionDenied'
                  ? 'Allow microphone access in your browser so others can hear you.'
                  : 'Could not start your microphone. Check that it is connected and not used by another app.',
              variant: 'destructive',
            });
          }}
          token={token}
          serverUrl={serverUrl}
          connect={true}
          data-lk-theme="default"
          className="h-full w-full"
          onDisconnected={onLeave}
          key={roomId}
        >
          {space ? (
            <AudioSpaceView
              callId={space.callId}
              roomName={roomName}
              roomType={callState.roomType}
              roomId={callState.roomId}
              initialRole={space.role}
              initialSpeakingMode={space.speakingMode}
              isMinimized={isMinimized}
              onToggleMinimize={() => setIsMinimized(!isMinimized)}
              onLeave={onLeave}
            />
          ) : (
          <LayoutContextProvider>
            <CallImplementation
              onLeave={onLeave}
              userRole={userRole}
              isMinimized={isMinimized}
              onToggleMinimize={() => setIsMinimized(!isMinimized)}
              onHidePip={() => setIsPipHidden(true)}
              roomName={roomName}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              pipSize={pipSize}
              onCyclePipSize={togglePipSize}
              onSetPipSize={setPipSize}
              roomId={roomId}
              roomType={callState.roomType || undefined}
              isEmbedded={embeddedActive || (!isMinimized && portalTarget !== document.body)}
            />
          </LayoutContextProvider>
          )}
          <RoomAudioRenderer />
        </LiveKitRoom>
      </motion.div>

      {/* Side Dock Pill Handle when PiP is hidden (Google Meet Style) */}
      {shouldHidePip && (
        <motion.button
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 60, opacity: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            setIsPipHidden(false);
          }}
          className="fixed right-0 top-28 sm:top-32 z-[999999] bg-[#1a1a2e]/95 hover:bg-[#252545] border border-r-0 border-white/20 text-white px-2.5 py-3 rounded-l-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center gap-2 backdrop-blur-xl group cursor-pointer active:scale-95 transition-all"
          title="Tap to restore video call"
        >
          <ChevronLeft className="w-4 h-4 text-orange-400 group-hover:-translate-x-0.5 transition-transform" />
          <div className="relative flex items-center justify-center">
            <Phone className="w-4 h-4 text-green-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 animate-ping" />
          </div>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body
  );
};
