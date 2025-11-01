import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff,
  Monitor,
  Maximize,
  Minimize
} from 'lucide-react';
import type { ActiveCall, CallParticipant } from '@/hooks/useCallState';

interface VideoCallInterfaceProps {
  call: ActiveCall;
  participants: CallParticipant[];
  isInCall: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
  onEndCall: () => void;
  currentUserId: string;
}

export const VideoCallInterface = ({
  call,
  participants,
  isInCall,
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeaveCall,
  onEndCall,
  currentUserId,
}: VideoCallInterfaceProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const isCallCreator = call.started_by === currentUserId;
  const activeParticipants = participants.filter(p => !p.left_at);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="bg-gradient-to-br from-primary/20 to-secondary/20 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="animate-pulse">
              ● LIVE
            </Badge>
            <span className="text-sm font-medium">
              {call.call_type === 'video' ? 'Video Call' : 'Audio Call'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-8 w-8"
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {activeParticipants.length} participant{activeParticipants.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div
        ref={videoContainerRef}
        className={`bg-black/90 ${isFullscreen ? 'h-screen' : 'aspect-video'} relative`}
      >
        {/* Placeholder for WebRTC video streams */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 w-full h-full">
            {activeParticipants.map((participant, index) => (
              <div
                key={participant.id}
                className="relative bg-muted/20 rounded-lg overflow-hidden flex items-center justify-center border border-white/10"
              >
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/50 mx-auto mb-2 flex items-center justify-center text-2xl font-bold">
                    {index + 1}
                  </div>
                  <p className="text-white/80 text-sm">Participant {index + 1}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {participant.is_audio_enabled ? (
                      <Mic className="h-4 w-4 text-green-400" />
                    ) : (
                      <MicOff className="h-4 w-4 text-red-400" />
                    )}
                    {participant.is_video_enabled ? (
                      <Video className="h-4 w-4 text-green-400" />
                    ) : (
                      <VideoOff className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call Controls */}
        {isInCall && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-3 bg-black/60 backdrop-blur-sm rounded-full px-6 py-3">
            <Button
              variant={isAudioEnabled ? 'default' : 'destructive'}
              size="icon"
              onClick={onToggleAudio}
              className="rounded-full h-12 w-12"
            >
              {isAudioEnabled ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button>

            {call.call_type === 'video' && (
              <Button
                variant={isVideoEnabled ? 'default' : 'destructive'}
                size="icon"
                onClick={onToggleVideo}
                className="rounded-full h-12 w-12"
              >
                {isVideoEnabled ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>
            )}

            <Button
              variant="secondary"
              size="icon"
              className="rounded-full h-12 w-12"
              disabled
            >
              <Monitor className="h-5 w-5" />
            </Button>

            {isCallCreator ? (
              <Button
                variant="destructive"
                onClick={onEndCall}
                className="rounded-full h-12 px-6 gap-2"
              >
                <PhoneOff className="h-5 w-5" />
                End Call
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={onLeaveCall}
                className="rounded-full h-12 px-6 gap-2"
              >
                <PhoneOff className="h-5 w-5" />
                Leave
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          WebRTC video streaming will be integrated with a service like LiveKit or PeerJS
        </p>
      </div>
    </Card>
  );
};
