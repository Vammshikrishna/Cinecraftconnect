import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { cn } from '@/lib/utils';
import { usePresence } from '@/hooks/usePresence';

interface Thread {
  id: string;
  subject?: string;
  last_message: {
    content: string;
    created_at: string;
  };
  participants: {
    profiles: {
      id: string;
      full_name: string;
      avatar_url: string;
    };
  }[];
}

interface ConversationListProps {
  onSelectThread: (threadId: string) => void;
  isCollapsed: boolean;
}

export const ConversationList = ({ onSelectThread, isCollapsed }: ConversationListProps) => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const { onlineUserIds } = usePresence('global-presence');

  useEffect(() => {
    if (!user) return;

    const fetchThreads = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_user_message_threads', { p_user_id: user.id });

      if (error) {
        console.error('Error fetching message threads', error);
      } else {
        setThreads(data || []);
      }
      setLoading(false);
    };

    fetchThreads();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-2 px-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <EnhancedSkeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <EnhancedSkeleton className="h-4 w-3/4" />
              <EnhancedSkeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {threads.map(thread => {
        const otherParticipants = thread.participants.filter(p => p.profiles.id !== user?.id);
        const displayName = otherParticipants.map(p => p.profiles.full_name).join(', ') || 'Me';
        const isOnline = otherParticipants.some(p => onlineUserIds.includes(p.profiles.id));

        return (
          <button 
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={cn(
              'w-full text-left p-2 rounded-lg transition-colors hover:bg-muted',
              // Add active state styling later
            )}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className={cn(isCollapsed && 'h-8 w-8')}>
                  <AvatarImage src={otherParticipants[0]?.profiles.avatar_url} />
                  <AvatarFallback>{displayName[0]}</AvatarFallback>
                </Avatar>
                {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />} 
              </div>
              {!isCollapsed && (
                <div className="flex-1 truncate">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-sm text-muted-foreground truncate">{thread.last_message.content}</p>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
