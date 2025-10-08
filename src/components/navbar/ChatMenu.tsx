
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RecentMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
  sender_profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  recipient_profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const ChatMenu = () => {
  const { user } = useAuth();
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchRecentMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('direct_messages')
          .select('id, content, created_at, sender_id, recipient_id, is_read')
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        // Fetch profiles for all unique user IDs
        const userIds = new Set<string>();
        data?.forEach(msg => {
          userIds.add(msg.sender_id);
          userIds.add(msg.recipient_id);
        });

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', Array.from(userIds));

        const profilesMap = profiles?.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>) || {};

        // Combine messages with profiles
        const messagesWithProfiles = data?.map(msg => ({
          ...msg,
          sender_profile: profilesMap[msg.sender_id],
          recipient_profile: profilesMap[msg.recipient_id]
        }));

        setRecentMessages(messagesWithProfiles || []);

        // Count unread messages
        const { count } = await supabase
          .from('direct_messages')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('is_read', false);

        setUnreadCount(count || 0);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentMessages();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('direct-messages-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
          filter: `or(sender_id.eq.${user.id},recipient_id.eq.${user.id})`,
        },
        () => {
          fetchRecentMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getOtherUserProfile = (message: RecentMessage) => {
    if (message.sender_id === user?.id) {
      return message.recipient_profile;
    }
    return message.sender_profile;
  };

  const getDisplayName = (profile: any) => {
    return profile?.full_name || profile?.username || 'Unknown User';
  };

  const getInitials = (profile: any) => {
    const name = getDisplayName(profile);
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-white">
          <MessageCircle className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
        <DropdownMenuLabel>Quick Chat</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
          ) : recentMessages.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">No messages yet</div>
          ) : (
            recentMessages.map((message) => {
              const otherUser = getOtherUserProfile(message);
              return (
                <Link 
                  key={message.id} 
                  to="/chats"
                  className="block p-2 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center">
                    <Avatar className="h-8 w-8 mr-2">
                      <AvatarImage src={otherUser?.avatar_url || ''} />
                      <AvatarFallback className="bg-cinesphere-purple/80 text-xs">
                        {getInitials(otherUser)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getDisplayName(otherUser)}</p>
                      <p className="text-xs text-gray-400 truncate">{message.content}</p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="p-2">
          <Link to="/chats">
            <Button variant="default" size="sm" className="w-full bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue">
              View All Messages
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChatMenu;
