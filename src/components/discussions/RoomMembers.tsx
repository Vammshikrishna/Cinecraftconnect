
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X, Users } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

interface Member {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface RoomMembersProps {
  roomId: string;
  onClose?: () => void;
}

export const RoomMembers = ({ roomId, onClose }: RoomMembersProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch room members (user_ids)
      const { data: membersData, error: membersError } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', roomId);

      if (membersError) throw membersError;

      if (!membersData || membersData.length === 0) {
        setMembers([]);
        return;
      }

      const userIds = membersData.map((m: any) => m.user_id);

      // 2. Fetch profiles for these user_ids
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      setMembers((profilesData || []) as Member[]);
    } catch (err: any) {
      console.error('Error fetching members:', err);
      setError(err?.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchMembers();

    const channel = supabase
      .channel(`room_members_sync:${roomId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'room_members', 
        filter: `room_id=eq.${roomId}` 
      }, fetchMembers)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMembers]);

  return (
    <div className="flex flex-col w-72 max-h-[450px] bg-background/95 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl border border-white/10">
      <header className="flex items-center justify-between p-3 border-b border-white/10 bg-muted/20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/20 rounded-lg">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-xs">Room Members</h2>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
              {members.length} {members.length === 1 ? 'person' : 'people'}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <ScrollArea className="flex-1 min-h-[100px]">
        <div className="p-2 space-y-1">
          {loading && members.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <p className="text-[10px] text-destructive p-4 text-center">{error}</p>
          ) : members.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground/40 italic">
              <p className="text-[10px]">No members found</p>
            </div>
          ) : (
            members.map((member) => {
              const displayName = member.username || member.full_name || 'Anonymous';
              return (
                <Link
                  to={`/profile/${member.id}`}
                  key={member.id}
                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                >
                  <Avatar className="h-8 w-8 border border-white/10 group-hover:border-primary/50 transition-colors">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="bg-muted text-[10px] font-bold text-muted-foreground">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs truncate group-hover:text-primary transition-colors">
                      {displayName}
                    </p>
                    <p className="text-[9px] text-muted-foreground truncate opacity-60">View Profile</p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

