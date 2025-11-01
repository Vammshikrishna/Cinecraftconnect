import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Phone, 
  Users, 
  Settings,
  Video,
  PhoneCall
} from 'lucide-react';
import { EnhancedChatInterface } from '@/components/discussions/EnhancedChatInterface';
import { VideoCallInterface } from '@/components/discussions/VideoCallInterface';
import { CallParticipants } from '@/components/discussions/CallParticipants';
import { useCallState } from '@/hooks/useCallState';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProjectDiscussionRoomProps {
  projectId: string;
  projectTitle: string;
}

export const ProjectDiscussionRoom = ({ projectId, projectTitle }: ProjectDiscussionRoomProps) => {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'creator' | 'admin' | 'moderator' | 'member'>('member');
  const [loading, setLoading] = useState(true);

  const {
    activeCall,
    participants,
    isInCall,
    isAudioEnabled,
    isVideoEnabled,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleAudio,
    toggleVideo,
  } = useCallState(roomId || '');

  useEffect(() => {
    fetchDiscussionRoom();
  }, [projectId, user]);

  const fetchDiscussionRoom = async () => {
    if (!user) return;

    try {
      // Get the discussion room for this project
      const { data: room } = await supabase
        .from('discussion_rooms')
        .select('id')
        .eq('project_id', projectId)
        .single();

      if (room) {
        setRoomId(room.id);

        // Get user's role in this room
        const { data: membership } = await supabase
          .from('room_members')
          .select('role')
          .eq('room_id', room.id)
          .eq('user_id', user.id)
          .single();

        if (membership) {
          setUserRole(membership.role as any);
        }
      }
    } catch (error) {
      console.error('Error fetching discussion room:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCall = async (callType: 'audio' | 'video') => {
    await startCall(callType);
  };

  if (loading || !roomId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading discussion room...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{projectTitle}</h2>
          <p className="text-muted-foreground">Discussion Room</p>
        </div>
        <div className="flex gap-2">
          {!activeCall && (
            <>
              <Button
                variant="outline"
                onClick={() => handleStartCall('audio')}
                className="gap-2"
              >
                <PhoneCall className="h-4 w-4" />
                Start Audio Call
              </Button>
              <Button
                onClick={() => handleStartCall('video')}
                className="gap-2"
              >
                <Video className="h-4 w-4" />
                Start Video Call
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="chat" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="call" className="gap-2">
            <Phone className="h-4 w-4" />
            Call
            {activeCall && (
              <Badge variant="destructive" className="ml-1">
                Live
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" disabled={userRole === 'member'}>
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6">
          <Card>
            <EnhancedChatInterface
              roomId={roomId}
              userRole={userRole}
            />
          </Card>
        </TabsContent>

        <TabsContent value="call" className="mt-6 space-y-6">
          {activeCall ? (
            <>
              <VideoCallInterface
                call={activeCall}
                participants={participants}
                isInCall={isInCall}
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                onToggleAudio={toggleAudio}
                onToggleVideo={toggleVideo}
                onLeaveCall={leaveCall}
                onEndCall={endCall}
                currentUserId={user?.id || ''}
              />
              <CallParticipants
                participants={participants}
                isInCall={isInCall}
                onJoinCall={() => joinCall()}
              />
            </>
          ) : (
            <Card className="p-12 text-center">
              <Phone className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Active Call</h3>
              <p className="text-muted-foreground mb-6">
                Start an audio or video call to collaborate with your team
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => handleStartCall('audio')}
                  className="gap-2"
                >
                  <PhoneCall className="h-4 w-4" />
                  Start Audio Call
                </Button>
                <Button
                  onClick={() => handleStartCall('video')}
                  className="gap-2"
                >
                  <Video className="h-4 w-4" />
                  Start Video Call
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Room Members</h3>
            <p className="text-muted-foreground text-sm">
              Member management functionality coming soon
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Room Settings</h3>
            <p className="text-muted-foreground text-sm">
              Room configuration options coming soon
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
