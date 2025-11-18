
import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ActiveSpeaker from './ActiveSpeaker';

export interface Call {
  id: string;
  room_id: string;
  created_by: string;
  call_type: 'audio' | 'video';
  // Add any other relevant call properties
}

interface VideoCallInterfaceProps {
  call: Call;
  onLeave: () => void;
}

// Mock participant data
const mockParticipants = [
  { id: '1', name: 'Alice', audioLevel: 0.8 },
  { id: '2', name: 'Bob', audioLevel: 0.3 },
  { id: '3', name: 'Charlie', audioLevel: 0.1 },
];

export const VideoCallInterface = ({ call, onLeave }: VideoCallInterfaceProps) => {
  const [isMuted, setMuted] = useState(false);
  const [isVideoEnabled, setVideoEnabled] = useState(call.call_type === 'video');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [participants, setParticipants] = useState(mockParticipants);

  useEffect(() => {
    // MOCK: In a real app, you would set up WebRTC connections here.
    // For now, we'll just use a mock stream.
    const getMockStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: isVideoEnabled, 
          audio: true 
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        // MOCK: Display the same stream as the remote user for demo purposes
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
      }
    };
    getMockStream();

    // MOCK: Simulate audio level changes
    const interval = setInterval(() => {
      setParticipants(prevParticipants =>
        prevParticipants.map(p => ({
          ...p,
          audioLevel: Math.random(),
        }))
      );
    }, 1000);

    return () => {
      // Clean up the stream.
      const stream = localVideoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      clearInterval(interval);
    };
  }, [isVideoEnabled]);

  const toggleMute = () => setMuted(!isMuted);
  const toggleVideo = () => setVideoEnabled(!isVideoEnabled);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50">
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Remote Video */}
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {/* Local Video */}
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute w-48 h-32 bottom-4 right-4 border-2 border-white rounded-lg" />
        
        {/* Active Speaker */}
        <div className="absolute top-4 left-4">
          <ActiveSpeaker participants={participants} />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-10 flex gap-4">
        <Button onClick={toggleMute} variant={isMuted ? "destructive" : "secondary"} size="lg" className="rounded-full">
          {isMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button onClick={toggleVideo} variant={!isVideoEnabled ? "destructive" : "secondary"} size="lg" className="rounded-full">
          {!isVideoEnabled ? <VideoOff /> : <Video />}
        </Button>
        <Button onClick={onLeave} variant="destructive" size="lg" className="rounded-full">
          <PhoneOff />
        </Button>
      </div>
    </div>
  );
};
