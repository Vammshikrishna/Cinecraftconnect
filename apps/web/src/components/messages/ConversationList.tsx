import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { cn } from '@/lib/utils';
import { usePresence } from '@/hooks/usePresence';
import { useCachedImage } from '@/hooks/useCachedImage';
import { getDisplayMessage } from '@/lib/chat-utils';

interface Thread {
  conversation_id: string;
  last_message_content: string;
  last_message_created_at: string;
  last_message_sender_id: string;
  other_user_id: string;
  other_user_full_name: string;
  other_user_avatar_url: string;
  other_user_username: string;
  other_user_craft?: string;
  unread_count: number;
}

interface ConversationListProps {
  onSelectThread: (threadId: string) => void;
  isCollapsed: boolean;
}

const ThreadAvatar = ({ src, name, className }: { src?: string; name: string; className?: string }) => {
  const cachedSrc = useCachedImage(src);
  return (
    <Avatar className={className}>
      <AvatarImage src={cachedSrc} />
      <AvatarFallback>{name[0] || 'U'}</AvatarFallback>
    </Avatar>
  );
};

export const ConversationList = ({ onSelectThread, isCollapsed }: ConversationListProps) => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const { onlineUserIds } = usePresence('global-presence');

  useEffect(() => {
    if (!user) return;

    const fetchThreads = async () => {
      setLoading(true);
      const { data, error } = await (supabase.rpc as any)('get_user_message_threads', { p_user_id: user.id });

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
        const displayName = thread.other_user_full_name || thread.other_user_username || 'User';
        const isOnline = onlineUserIds.includes(thread.other_user_id);

        return (
          <button
            key={thread.conversation_id}
            onClick={() => onSelectThread(thread.conversation_id)}
            className={cn(
              'w-full text-left p-2 rounded-lg transition-colors hover:bg-muted',
            )}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ThreadAvatar 
                  src={thread.other_user_avatar_url} 
                  name={displayName} 
                  className={cn(isCollapsed && 'h-8 w-8')}
                />
                {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />}
              </div>
              {!isCollapsed && (
                <div className="flex-1 truncate">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-sm text-muted-foreground truncate">{getDisplayMessage(thread.last_message_content)}</p>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
