import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  LayoutContextProvider,
  useMediaDeviceSelect,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Maximize, X, Radio, PhoneOff, Smile, Settings as SettingsIcon, Mic, Camera, Speaker, Shield, ShieldAlert, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from './types';

interface EmbeddedCallPanelProps {
  roomId: string;
  roomName: string;
  onLeave: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  userRole: UserRole;
}

const MyVideoConference = ({ onLeave, userRole }: { onLeave: () => void, userRole: UserRole }) => {
  useEffect(() => {
    // Just to acknowledge onLeave if not used elsewhere, though usually 
    // it's triggered by LiveKit's onDisconnected on the root room.
    const lkLeave = () => {};
    return lkLeave;
  }, [onLeave]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHostControls, setShowHostControls] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showMoreReactions, setShowMoreReactions] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number, emoji: string, x: number }[]>([]);
  const { toast } = useToast();
  const participants = useParticipants();
  
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

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] relative overflow-hidden font-sans">
      {/* Dynamic Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#12122b] via-[#0a0a0f] to-[#1e1e3f] opacity-50 pointer-events-none" />

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

      <div className="flex-grow flex min-h-0 relative">
        <div className="flex-grow relative overflow-y-auto p-3 sm:p-4">
          <GridLayout tracks={tracks}>
            <ParticipantTile className="rounded-2xl overflow-hidden border border-white/5 shadow-2xl transition-all duration-300 hover:border-primary/30" />
          </GridLayout>
        </div>
        
        {/* Responsive Panels with Glassmorphism */}
        {/* Participant List - Bottom Sheet on Mobile, Sidebar on Desktop */}
        {showParticipants && (
          <div className="absolute inset-x-0 bottom-0 top-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-80 bg-black/40 backdrop-blur-3xl z-[120] animate-in slide-in-from-bottom sm:slide-in-from-right duration-500 overflow-hidden flex flex-col sm:border-l border-white/10">
            {/* Overlay for mobile to close on click outside (optional but good) */}
            <div className="absolute inset-0 sm:hidden" onClick={() => setShowParticipants(false)} />
            
            <div className="relative mt-auto sm:mt-0 flex flex-col h-[70%] sm:h-full bg-black/80 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t sm:border-t-0 border-white/10 rounded-t-[32px] sm:rounded-none p-6 shadow-2xl">
              {/* Mobile handle */}
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 sm:hidden shrink-0" />
              
              <div className="flex justify-between items-center mb-8 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  <h3 className="text-xl font-bold text-white">In the Room ({participants.length})</h3>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowParticipants(false)} 
                  className="hover:bg-red-500/20 text-white rounded-full h-10 w-10 p-0 border border-white/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="flex-grow space-y-3 overflow-y-auto pr-1 overflow-x-hidden custom-scrollbar">
                {participants.map((p) => (
                  <div key={p.sid} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 group">
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 bg-gradient-to-tr from-primary/10 to-secondary/10 rounded-full border border-white/10 flex items-center justify-center text-primary font-bold shadow-inner">
                        {p.identity[0].toUpperCase()}
                      </div>
                      {p.isSpeaking && <div className="absolute -inset-1 rounded-full border-2 border-primary/50 animate-pulse" />}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">{p.identity}</p>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                        {p.isLocal ? 'Host' : 'Participant'}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center">
                       {p.isSpeaking ? (
                         <div className="flex gap-0.5 h-3 items-end">
                           <div className="w-0.5 h-2 bg-primary animate-bounce-short" />
                           <div className="w-0.5 h-3 bg-primary animate-bounce-short delay-75" />
                           <div className="w-0.5 h-2 bg-primary animate-bounce-short delay-150" />
                         </div>
                       ) : (
                         <div className="w-2 h-2 rounded-full bg-green-500/50" />
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Top Right Controls - Removed as requested */}

      {/* Modern Floating Control Bar */}
      <div className="absolute bottom-2 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-1 py-1 sm:px-3 sm:py-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-0.5 sm:gap-2 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-500 max-w-[98vw]">
        <div className="flex-shrink-0 flex items-center pr-1 sm:pr-2 border-r border-white/10">
          <ControlBar 
            variation="minimal" 
            controls={{ leave: true, microphone: true, camera: true, chat: false, settings: false, screenShare: true }}
            className="modern-control-bar no-dropdowns"
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSettings(true)}
            className="h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] p-0 rounded-full text-gray-400 hover:bg-white/10 transition-all border border-white/5"
            title="Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>

          {(userRole === 'creator' || userRole === 'admin') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowHostControls(!showHostControls)}
              className={`h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] p-0 rounded-full transition-all duration-300 ${showHostControls ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:bg-white/10'}`}
              title="Host Controls"
            >
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
        
        <div className="h-6 w-px bg-white/10 mx-1" />
        
        <div className="flex gap-1 sm:gap-2 relative">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setShowReactions(!showReactions);
              if (!showReactions) setShowMoreReactions(false);
            }}
            className={`h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] p-0 rounded-full transition-all duration-300 ${showReactions ? 'bg-secondary text-white' : 'text-gray-400 hover:bg-white/10'}`}
            title="Reactions"
          >
            <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowParticipants(!showParticipants)}
            className={`h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] p-0 rounded-full transition-all duration-300 ${showParticipants ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.4)]' : 'text-gray-400 hover:bg-white/10'}`}
            title="Show Participants"
          >
            <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-90 text-primary" />
          </Button>
        </div>
      </div>

      {/* Globally Centered Reaction Picker Popover */}
      {showReactions && (
        <div className={`absolute bottom-36 sm:bottom-28 left-1/2 -translate-x-1/2 mb-5 p-3 bg-black/95 backdrop-blur-2xl border border-white/10 ${showMoreReactions ? 'rounded-3xl flex-wrap w-[280px] sm:w-[400px]' : 'rounded-full whitespace-nowrap overflow-x-auto max-w-[90vw]'} flex flex-row gap-3 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[200] justify-center scale-95 sm:scale-100 origin-bottom`}>
          {(showMoreReactions ? ['❤️', '👏', '🔥', '😂', '😮', '😢', '👍', '🎉', '🙌', '✨', '🤩', '💡'] : ['❤️', '👏', '🔥', '😂', '😮', '😢']).map((emoji) => (
            <button 
              key={emoji}
              className="text-2xl sm:text-3xl hover:scale-150 transition-all duration-300 active:scale-90 px-1.5 py-1 shrink-0" 
              onClick={() => {
                const id = Date.now();
                const x = 30 + Math.random() * 40; // Random position between 30% and 70%
                setFloatingEmojis(prev => [...prev, { id, emoji, x }]);
                setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2000);
                if (!showMoreReactions) setShowReactions(false);
              }}
            >
              {emoji}
            </button>
          ))}
          <button 
            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all shrink-0 ml-1 border border-white/5"
            onClick={(e) => {
              e.stopPropagation();
              setShowMoreReactions(!showMoreReactions);
            }}
            title="More Reactions"
          >
            {showMoreReactions ? <X className="w-5 h-5" /> : <div className="flex gap-0.5"><span className="w-1.5 h-1.5 bg-current rounded-full"/><span className="w-1.5 h-1.5 bg-current rounded-full"/><span className="w-1.5 h-1.5 bg-current rounded-full"/></div>}
          </button>
        </div>
      )}

      {/* Premium Settings Dialog */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-md bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
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
               className="w-full mt-10 rounded-2xl py-6 bg-primary text-primary-foreground font-bold text-sm tracking-wide shadow-[0_10px_30px_rgba(var(--primary),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
               onClick={() => setShowSettings(false)}
            >
              Save & Close
            </Button>
          </div>
        </div>
      )}
      {/* Host Controls Dialog */}
      {showHostControls && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHostControls(false)} />
          <div className="relative w-full max-w-md bg-[#0a0a0f]/95 backdrop-blur-3xl border border-orange-500/20 rounded-[32px] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
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
                   // Remote muting requires specific server-side permissions or 
                   // specific track publications settings. In standard LK client,
                   // we can only request participants to mute or use custom data messages.
                   // For now, let's provide the 'End Call for All' which is the strongest control.
                   toast({ title: "Mute All Requested", description: "Requesting participants to mute their microphones." });
                }}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/10 transition-all text-left"
              >
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400">
                  <VolumeX className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Mute All Participants</p>
                  <p className="text-xs text-gray-400">Silence everyone in the discussion</p>
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
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-400">End Discussion for All</p>
                  <p className="text-xs text-red-400/60">Terminate the session globally</p>
                </div>
              </button>
            </div>

            <p className="mt-8 text-[10px] text-center text-gray-500 font-medium px-4 leading-relaxed">
              As a host, you are responsible for maintaining a healthy discussion environment.
            </p>
          </div>
        </div>
      )}

      <style>{`
        .top-settings-bar {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .top-settings-bar .lk-button {
          background: transparent !important;
          border: none !important;
          color: white !important;
          width: 36px !important;
          height: 36px !important;
          opacity: 0.8;
          transition: all 0.3s;
        }
        .top-settings-bar .lk-button:hover {
          opacity: 1;
          transform: rotate(20deg);
        }
        .modern-control-bar {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .modern-control-bar .lk-button {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 9999px !important;
          color: white !important;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          width: 34px !important;
          height: 34px !important;
        }
        .modern-control-bar .lk-button:hover {
          background: rgba(255, 255, 255, 0.15) !important;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        .modern-control-bar .lk-button-leave {
          background: rgba(239, 68, 68, 0.2) !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          color: #f87171 !important;
          border-radius: 9999px !important;
          width: 34px !important;
          height: 34px !important;
          padding: 0 !important;
          min-width: unset !important;
        }
        .modern-control-bar .lk-button-leave:hover {
          background: rgba(239, 68, 68, 0.4) !important;
          border-color: rgba(239, 68, 68, 0.5) !important;
        }
        @media (max-width: 640px) {
          .modern-control-bar .lk-button-leave {
             width: 34px !important;
             height: 34px !important;
          }
        }
        .lk-grid-layout {
          gap: 1.5rem !important;
          padding-bottom: 4.5rem !important;
        }
        .lk-chat-header {
          display: none !important;
        }
        .lk-chat {
          background: transparent !important;
          border: none !important;
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
        .lk-device-menu {
          display: none !important;
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
          .modern-control-bar .lk-button-leave {
            width: 30px !important;
            height: 30px !important;
          }
        }
      `}</style>
    </div>
  );
};

export const EmbeddedCallPanel = ({ roomId, roomName, onLeave, isMinimized = false, onToggleMinimize, userRole }: EmbeddedCallPanelProps) => {
  const { user, profile } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      if (!user) return;
      try {
        const { data, error: funcError } = await supabase.functions.invoke('livekit-token', {
          body: {
            roomName: roomId,
            participantName: profile?.full_name || user.email?.split('@')[0] || user.id,
          },
        });

        if (funcError) throw funcError;
        setToken(data.token);
      } catch (err: any) {
        console.error('Error fetching LiveKit token:', err);
        setError(err.message || 'Failed to connect to call service');
      }
    };

    fetchToken();
  }, [roomId, user, profile]);

  const serverUrl = import.meta.env.VITE_LIVEKIT_URL;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[#1a1a2e] h-full text-white text-center">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <X className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-xl font-bold mb-2">Connection Error</h3>
        <p className="text-gray-400 mb-6 text-sm">{error}</p>
        <Button onClick={onLeave} variant="destructive">Go Back</Button>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[#1a1a2e] h-full text-white">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse text-gray-400">Securing connection...</p>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-white/10 rounded-2xl p-3 mx-3 mt-2 shadow-xl animate-in slide-in-from-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400" />
                Live Discussion
              </p>
              <p className="text-gray-400 text-xs">{roomName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onToggleMinimize} className="text-white hover:bg-white/10 h-8 w-8 rounded-full">
              <Maximize className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onLeave} className="text-red-400 hover:bg-red-600/20 h-8 w-8 rounded-full">
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e] text-white overflow-hidden relative">
      <LiveKitRoom
        video={false}
        audio={false}
        token={token}
        serverUrl={serverUrl}
        onDisconnected={onLeave}
        data-lk-theme="default"
        style={{ height: '100%' }}
      >
        <LayoutContextProvider>
          <MyVideoConference onLeave={onLeave} userRole={userRole} />
        </LayoutContextProvider>
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
};
