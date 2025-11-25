import { useParticipant, useVideoTrack, useAudioTrack } from '@daily-co/daily-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mic, MicOff } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ParticipantTileProps {
    sessionId: string;
    isScreenShare: boolean;
}

export const ParticipantTile = ({ sessionId, isScreenShare }: ParticipantTileProps) => {
    const participant = useParticipant(sessionId);
    const videoTrack = useVideoTrack(sessionId);
    const audioTrack = useAudioTrack(sessionId);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && videoTrack.persistentTrack) {
            videoRef.current.srcObject = new MediaStream([videoTrack.persistentTrack]);
        }
    }, [videoTrack.persistentTrack]);

    if (!participant) return null;

    const isLocal = participant.local;
    const isMuted = !audioTrack.isOff;
    const hasVideo = !videoTrack.isOff;

    return (
        <div className="relative bg-muted rounded-lg overflow-hidden h-full min-h-[200px]">
            {hasVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    muted={isLocal}
                    playsInline
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <Avatar className="h-24 w-24">
                        <AvatarImage src={participant.user_name} />
                        <AvatarFallback className="text-2xl">
                            {participant.user_name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                    </Avatar>
                </div>
            )}

            {/* Participant info overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium truncate">
                        {participant.user_name || 'Guest'} {isLocal && '(You)'}
                    </span>
                    {!isMuted && (
                        <div className="bg-destructive/90 rounded-full p-1.5">
                            <MicOff className="h-3 w-3 text-white" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
