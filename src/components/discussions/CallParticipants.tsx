import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CallParticipant } from '@/hooks/useCallState';

interface CallParticipantsProps {
  participants: CallParticipant[];
  isInCall: boolean;
  onJoinCall: () => void;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export const CallParticipants = ({ participants, isInCall, onJoinCall }: CallParticipantsProps) => {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = participants.map(p => p.user_id);
      if (userIds.length === 0) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (data) {
        const profileMap = data.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, Profile>);
        setProfiles(profileMap);
      }
    };

    fetchProfiles();
  }, [participants]);

  if (participants.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground mb-4">No one is in the call yet</p>
        {!isInCall && (
          <Button onClick={onJoinCall} className="gap-2">
            <Phone className="h-4 w-4" />
            Join Call
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          In Call ({participants.length})
        </h3>
        {!isInCall && (
          <Button onClick={onJoinCall} size="sm" className="gap-2">
            <Phone className="h-4 w-4" />
            Join
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {participants.map((participant) => {
          const profile = profiles[participant.user_id];
          const name = profile?.full_name || 'Unknown User';
          
          return (
            <Card key={participant.id} className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {participant.is_audio_enabled ? (
                      <Mic className="h-3 w-3 text-green-500" />
                    ) : (
                      <MicOff className="h-3 w-3 text-muted-foreground" />
                    )}
                    {participant.is_video_enabled ? (
                      <Video className="h-3 w-3 text-green-500" />
                    ) : (
                      <VideoOff className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
