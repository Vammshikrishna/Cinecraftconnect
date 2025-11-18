
import { useState, useEffect, useCallback } from 'react';
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
      const { data, error } = await supabase
        .from('room_members')
        .select('profiles(id, username, avatar_url)')
        .eq('room_id', roomId);

      if (error) throw error;
        
      const memberProfiles = data.map((item: any) => item.profiles).filter(Boolean);
      setMembers(memberProfiles as Member[]);
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
    <div className="absolute top-0 right-0 h-full w-full max-w-xs bg-gray-800 border-l border-gray-700 z-20 flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
                <Users className="h-6 w-6" />
                <h2 className="font-bold text-lg">Room Members</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                <X className="h-6 w-6" />
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
                <div className="p-4 space-y-4">
                {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback>{member.username?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.username}</span>
                    </div>
                ))}
                </div>
            )}
        </ScrollArea>
    </div>
  );
};
