
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VideoCallInterface, Call } from './VideoCallInterface';
import { Button } from '@/components/ui/button';
import { Phone, Video } from 'lucide-react';

interface VideoCallManagerProps {
  roomId: string;
  userId: string;
}

export const VideoCallManager = ({ roomId, userId }: VideoCallManagerProps) => {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();

  const startCall = async (type: 'audio' | 'video') => {
    setIsJoining(true);
    try {
      const { data, error } = await supabase.rpc('start_call', { 
        room_id: roomId, 
        created_by: userId, 
        call_type: type 
      });

      if (error) throw error;

      setActiveCall(data as Call);
    } catch (error: any) {
      toast({ title: "Error Starting Call", description: error.message, variant: "destructive" });
    } finally {
      setIsJoining(false);
    }
  };

  const joinCall = async (call: Call) => {
    setActiveCall(call);
  };

  const leaveCall = () => {
    setActiveCall(null);
    // Here you might want to notify other users that you've left the call.
  };

  // This component will render the call interface if a call is active,
  // otherwise it can render buttons to start a new call.
  // For this project, we will initiate calls from the main chat interface.

  if (activeCall) {
    return <VideoCallInterface call={activeCall} onLeave={leaveCall} />;
  }

  return null; // Or render call initiation buttons here.
};
