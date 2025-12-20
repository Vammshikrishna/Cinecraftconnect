
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X, Users } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

interface Member {
  id: string;
  username: string;
  avatar_url: string;
}

interface RoomMembersProps {
  roomId: string;
  onClose: () => void;
}

export const RoomMembers = ({ roomId, onClose }: RoomMembersProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);

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
        .select('id, username, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      setMembers(profilesData as Member[]);
    } catch (err: any) {
      setError('Failed to fetch room members.');
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return (
    <div className="absolute top-0 right-0 h-full w-full max-w-xs bg-background/95 backdrop-blur-xl border-l border-white/10 z-20 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      <header className="flex items-center justify-between p-4 border-b border-white/10 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-sm">Room Members</h2>
            <p className="text-[10px] text-muted-foreground">{members.length} {members.length === 1 ? 'person' : 'people'}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </header>

      <ScrollArea className="flex-1">
        {loading && (
          <div className="flex items-center justify-center p-6">
            <LoadingSpinner />
          </div>
        )}
        {error && <p className="text-red-500 p-4">{error}</p>}
        {!loading && !error && (
          <div className="p-4 space-y-2">
            {members.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground/50 border border-dashed border-white/10 rounded-xl">
                <p>No members found.</p>
              </div>
            ) : (
              members.map((member) => (
                <Link
                  to={`/profile/${member.id}`}
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                >
                  <Avatar className="h-10 w-10 border border-white/10 group-hover:border-primary/50 transition-colors">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback className="bg-muted text-muted-foreground">{member.username?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{member.username}</p>
                    <p className="text-[10px] text-muted-foreground truncate">View Profile</p>
                  </div>
                </Link>
              ))
            )
            }
          </div>
        )
        }
      </ScrollArea >
    </div >
  );
};
