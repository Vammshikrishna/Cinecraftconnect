
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// A placeholder for a real WebRTC/video service client
const videoServiceClient = {
  join: async (roomId: string, userId: string) => {
    console.log(`${userId} joining room ${roomId}`);
    return { success: true };
  },
  leave: (roomId: string, userId: string) => {
    console.log(`${userId} leaving room ${roomId}`);
  },
  getParticipants: (roomId: string, callback: (participants: any[]) => void) => {
    // Simulate participants joining and leaving
    const interval = setInterval(() => {
      callback([
        { id: 'user1', name: 'Alice', stream: null, isMuted: false, isCameraOff: false },
        { id: 'user2', name: 'Bob', stream: null, isMuted: true, isCameraOff: false },
      ]);
    }, 5000);
    return () => clearInterval(interval);
  },
};

interface VideoChatProps {
  roomId: string;
  roomTitle: string;
}

const VideoChat = ({ roomId, roomTitle }: VideoChatProps) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isConnected) return;

    // Get local media stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.error('Error getting media stream:', err));

    // Subscribe to participant updates
    const unsubscribe = videoServiceClient.getParticipants(roomId, setParticipants);
    return unsubscribe;

  }, [isConnected, roomId]);

  const handleJoin = async () => {
    if (!user) return;
    const result = await videoServiceClient.join(roomId, user.id);
    if (result.success) {
      setIsConnected(true);
    }
  };

  const handleLeave = () => {
    if (!user) return;
    videoServiceClient.leave(roomId, user.id);
    setIsConnected(false);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-xl font-semibold mb-2">Join Video Call</h2>
        <p className="text-muted-foreground mb-4">You're about to join the video session for {roomTitle}.</p>
        <Button onClick={handleJoin}>Join Now</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        <Card>
          <CardHeader><CardTitle>{user?.user_metadata.full_name || 'You'}</CardTitle></CardHeader>
          <CardContent>
            <video ref={localVideoRef} autoPlay muted className="w-full h-full rounded-md bg-muted" />
          </CardContent>
        </Card>
        {participants.map(p => (
          <Card key={p.id}>
            <CardHeader><CardTitle>{p.name}</CardTitle></CardHeader>
            <CardContent>
              <div className="w-full h-full rounded-md bg-muted flex items-center justify-center">
                <span>Video placeholder</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-center items-center p-4 bg-card border-t gap-4 mt-4">
        <Button variant={isMuted ? 'destructive' : 'outline'} size="icon" onClick={() => setIsMuted(!isMuted)}>
          {isMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button variant={isCameraOff ? 'destructive' : 'outline'} size="icon" onClick={() => setIsCameraOff(!isCameraOff)}>
          {isCameraOff ? <VideoOff /> : <Video />}
        </Button>
        <Button variant="destructive" size="icon" onClick={handleLeave}>
          <PhoneOff />
        </Button>
      </div>
    </div>
  );
};

export default VideoChat;
