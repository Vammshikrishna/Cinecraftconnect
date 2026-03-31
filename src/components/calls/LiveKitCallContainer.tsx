import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPortal } from 'react-dom';

interface LiveKitCallContainerProps {
  roomId: string;
  onLeave: () => void;
  roomName?: string;
  projectId?: string;
}

// Sub-component to safely use LiveKit hooks inside the Room context
const CallImplementation = ({ onLeave }: { onLeave: () => void }) => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="flex flex-col h-full bg-[#111] relative">
      <div className="flex-1 p-4 overflow-hidden">
        <GridLayout tracks={tracks}>
          <ParticipantTile />
        </GridLayout>
      </div>
      <div className="h-20 shrink-0 border-t border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-center">
        <ControlBar variation="minimal" controls={{ leave: false }} />
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={onLeave}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-red-500 hover:bg-red-600 text-white border-none"
        >
            <X className="h-6 w-6" />
        </Button>
      </div>
      <RoomAudioRenderer />
    </div>
  );
};

export const LiveKitCallContainer = ({ roomId, onLeave }: LiveKitCallContainerProps) => {
  const { user, profile } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const fetchToken = async () => {
      if (!user) return;
      try {
        const participantName = (profile?.full_name || user.email?.split('@')[0] || user.id).replace(/[^a-zA-Z0-9]/g, '_');
        const { data, error: funcError } = await supabase.functions.invoke('livekit-token', {
          body: {
            roomName: roomId,
            participantName,
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

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black overflow-hidden">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        onDisconnected={onLeave}
        data-lk-theme="default"
        style={{ height: '100dvh' }}
        key={token}
      >
        <CallImplementation onLeave={onLeave} />
      </LiveKitRoom>
    </div>,
    document.body
  );
};
