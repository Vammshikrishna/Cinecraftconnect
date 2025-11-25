import { useLocalSessionId, useDevices, useDaily } from '@daily-co/daily-react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, Monitor, Phone, Smile } from 'lucide-react';
import { useState } from 'react';
import { ReactionPicker } from './ReactionPicker';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

interface CallControlsProps {
    callId: string;
    onLeave: () => void;
}

export const CallControls = ({ callId, onLeave }: CallControlsProps) => {
    const daily = useDaily();
    const localSessionId = useLocalSessionId();
    const { microphones, cameras, setMicrophone, setCamera } = useDevices();

    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const toggleMicrophone = () => {
        if (daily) {
            daily.setLocalAudio(!isMuted);
            setIsMuted(!isMuted);
        }
    };

    const toggleCamera = () => {
        if (daily) {
            daily.setLocalVideo(!isCameraOff);
            setIsCameraOff(!isCameraOff);
        }
    };

    const toggleScreenShare = async () => {
        if (!daily) return;

        try {
            if (isScreenSharing) {
                await daily.stopScreenShare();
                setIsScreenSharing(false);
            } else {
                await daily.startScreenShare();
                setIsScreenSharing(true);
            }
        } catch (error) {
            console.error('Error toggling screen share:', error);
        }
    };

    return (
        <div className="flex items-center justify-center gap-3">
            {/* Microphone */}
            <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="lg"
                onClick={toggleMicrophone}
                className="rounded-full w-14 h-14"
            >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {/* Camera */}
            <Button
                variant={isCameraOff ? 'destructive' : 'outline'}
                size="lg"
                onClick={toggleCamera}
                className="rounded-full w-14 h-14"
            >
                {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>

            {/* Screen Share */}
            <Button
                variant={isScreenSharing ? 'default' : 'outline'}
                size="lg"
                onClick={toggleScreenShare}
                className="rounded-full w-14 h-14"
            >
                <Monitor className="h-5 w-5" />
            </Button>

            {/* Reactions */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="lg" className="rounded-full w-14 h-14">
                        <Smile className="h-5 w-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                    <ReactionPicker callId={callId} />
                </PopoverContent>
            </Popover>

            {/* Leave Call */}
            <Button
                variant="destructive"
                size="lg"
                onClick={onLeave}
                className="rounded-full px-6"
            >
                <Phone className="h-5 w-5 mr-2 rotate-[135deg]" />
                Leave
            </Button>
        </div>
    );
};
