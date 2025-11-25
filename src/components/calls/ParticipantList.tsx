import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParticipantIds } from '@daily-co/daily-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';

interface Participant {
    id: string;
    user_id: string;
    status: 'requesting' | 'joined' | 'left';
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
    };
}

interface ParticipantListProps {
    callId: string;
    roomType: 'project' | 'discussion';
    roomId: string;
}

export const ParticipantList = ({ callId, roomType, roomId }: ParticipantListProps) => {
    const dailyParticipantIds = useParticipantIds();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [roomMembers, setRoomMembers] = useState<any[]>([]);

    useEffect(() => {
        fetchParticipants();
        fetchRoomMembers();

        // Subscribe to participant changes
        const channel = supabase
            .channel(`call_participants:${callId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'call_participants',
                filter: `call_id=eq.${callId}`
            }, () => {
                fetchParticipants();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [callId]);

    const fetchParticipants = async () => {
        const { data } = await supabase
            .from('call_participants' as any)
            .select(`
        id,
        user_id,
        status,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
            .eq('call_id', callId);

        if (data) {
            setParticipants(data as any);
        }
    };

    const fetchRoomMembers = async () => {
        if (roomType === 'project') {
            const { data } = await supabase
                .from('project_space_members' as any)
                .select(`
          user_id,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
                .eq('project_space_id', roomId);

            if (data) setRoomMembers(data);
        } else {
            const { data } = await supabase
                .from('room_members' as any)
                .select(`
          user_id,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
                .eq('room_id', roomId);

            if (data) setRoomMembers(data);
        }
    };

    const handleApproveRequest = async (participantId: string) => {
        await supabase
            .from('call_participants' as any)
            .update({ status: 'joined' })
            .eq('id', participantId);
    };

    const handleDenyRequest = async (participantId: string) => {
        await supabase
            .from('call_participants' as any)
            .delete()
            .eq('id', participantId);
    };

    const joinedParticipants = participants.filter(p => p.status === 'joined');
    const requestingParticipants = participants.filter(p => p.status === 'requesting');
    const notInCall = roomMembers.filter(m =>
        !participants.some(p => p.user_id === m.user_id && p.status === 'joined')
    );

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border">
                <h3 className="font-semibold">Participants</h3>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Join Requests */}
                    {requestingParticipants.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Waiting to Join</h4>
                            <div className="space-y-2">
                                {requestingParticipants.map((participant) => (
                                    <div key={participant.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={participant.profiles?.avatar_url || undefined} />
                                                <AvatarFallback>
                                                    {participant.profiles?.full_name?.[0] || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm">{participant.profiles?.full_name || 'Unknown'}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => handleApproveRequest(participant.id)}
                                            >
                                                <Check className="h-4 w-4 text-green-500" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => handleDenyRequest(participant.id)}
                                            >
                                                <X className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* In Call */}
                    <div>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                            In Call ({joinedParticipants.length})
                        </h4>
                        <div className="space-y-2">
                            {joinedParticipants.map((participant) => (
                                <div key={participant.id} className="flex items-center gap-2 p-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={participant.profiles?.avatar_url || undefined} />
                                        <AvatarFallback>
                                            {participant.profiles?.full_name?.[0] || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{participant.profiles?.full_name || 'Unknown'}</span>
                                    <Badge variant="secondary" className="ml-auto text-xs">Active</Badge>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Not in Call */}
                    {notInCall.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                                Not in Call ({notInCall.length})
                            </h4>
                            <div className="space-y-2">
                                {notInCall.map((member) => (
                                    <div key={member.user_id} className="flex items-center gap-2 p-2 opacity-60">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.profiles?.avatar_url || undefined} />
                                            <AvatarFallback>
                                                {member.profiles?.full_name?.[0] || 'U'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{member.profiles?.full_name || 'Unknown'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
