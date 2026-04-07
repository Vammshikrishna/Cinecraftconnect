
import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { getDisplayMessage } from '@/lib/chat-utils';

const ChatMenu = () => {
  const { hasUnread } = useUnreadMessages();
  const [previews, setPreviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPreviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_unread_message_previews' as any);
      // console.log('UNREAD PREVIEWS RPC:', data, error);
      if (!error && Array.isArray(data)) {
        // Map RPC column names to what the UI template expects
        const mapped = data.map((item: any) => ({
          c_id: item.context_id || item.c_id,
          name: item.sender_name || item.name,
          avatar: item.sender_avatar || item.avatar,
          last_message: item.last_message,
          unread_count: item.unread_count,
          last_timestamp: item.last_timestamp,
          chat_type: item.chat_type || item.type,
        }));

        // De-duplicate by c_id
        const uniqueData = Array.from(new Map(mapped.map((item: any) => [item.c_id, item])).values());
        setPreviews(uniqueData);
      }
    } catch (e) {
      // Silent error for message previews
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // We fetch previews on mount AND when notification triggers.
    // We do NOT clear them just because hasUnread becomes false (e.g. visiting /messages)
    fetchPreviews();
  }, [hasUnread]);

  const getLink = (type: string, id: string) => {
    switch (type) {
      case 'project': return `/projects/${id}/space`;
      case 'discussion': return `/discussion-rooms/${id}`;
      default: return `/dm/${id}`;
    }
  };

  const getIcon = (type: string, avatar: string | null, name: string) => {
    if (type === 'dm') {
      return (
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={avatar || undefined} />
          <AvatarFallback>{name?.substring(0, 2)?.toUpperCase()}</AvatarFallback>
        </Avatar>
      );
    } else if (type === 'project') {
      return (
        <div className="h-10 w-10 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
          <span className="font-bold text-xs">PRJ</span>
        </div>
      );
    } else {
      return (
        <div className="h-10 w-10 rounded-md bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/20">
          <span className="font-bold text-xs">#</span>
        </div>
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <MessageSquare className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        alignOffset={0}
        sideOffset={12}
        collisionPadding={16}
        className="w-[320px] max-w-[calc(100vw-32px)] p-0 border border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/60 rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-[60] flex flex-col"
      >
        <DropdownMenuLabel className="p-3">Messages</DropdownMenuLabel>
        <DropdownMenuSeparator className="flex-shrink-0" />

        {loading ? (
          <div className="p-4 flex justify-center text-muted-foreground">
            <span className="animate-spin mr-2">⏳</span> Loading...
          </div>
        ) : previews.filter(p => p.c_id).length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto no-scrollbar scroll-smooth flex-1">
            {previews.filter(p => p.c_id).map((preview) => (
              <DropdownMenuItem key={`${preview.chat_type}-${preview.c_id}`} asChild className="p-0 focus:bg-accent/50 focus:outline-none cursor-pointer">
                <Link to={getLink(preview.chat_type || 'dm', preview.c_id)} className="flex items-start gap-3 w-full p-2.5 sm:p-3 transition-colors">
                  <div className="relative flex-shrink-0">
                    {getIcon(preview.chat_type || 'dm', preview.avatar, preview.name)}
                    {(preview.unread_count > 1) && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 border-background">
                        {preview.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="font-semibold text-sm truncate">{preview.name}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {preview.last_timestamp && formatDistanceToNow(new Date(preview.last_timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">
                      {preview.chat_type === 'project' ? `Project: ${getDisplayMessage(preview.last_message)}` : getDisplayMessage(preview.last_message)}
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No new messages</p>
          </div>
        )}

        <DropdownMenuSeparator className="flex-shrink-0" />
        <DropdownMenuItem asChild className="p-0 focus:bg-transparent mt-auto">
          <Link to="/messages" className="w-full text-center p-3 text-primary font-bold hover:bg-accent/50 transition-colors block">
            View all messages
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChatMenu;
