
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

const ChatMenu = () => {
  const { hasUnread } = useUnreadMessages();
  const [previews, setPreviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPreviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_unread_message_previews' as any);
      console.log('UNREAD PREVIEWS RPC:', data, error);
      if (!error && Array.isArray(data)) {
        // De-duplicate by c_id if needed, though SQL does grouping
        const uniqueData = Array.from(new Map(data.map(item => [item.c_id, item])).values());
        setPreviews(uniqueData);
      }
    } catch (e) {
      console.error(e);
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
      case 'project': return `/projects/${id}`;
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
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Messages</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="p-4 flex justify-center text-muted-foreground">
            <span className="animate-spin mr-2">⏳</span> Loading...
          </div>
        ) : previews.filter(p => p.c_id).length > 0 ? (
          <div className="max-h-[300px] overflow-y-auto">
            {previews.filter(p => p.c_id).map((preview) => (
              <DropdownMenuItem key={`${preview.chat_type}-${preview.c_id}`} asChild className="cursor-pointer p-3">
                <Link to={getLink(preview.chat_type || 'dm', preview.c_id)} className="flex items-start gap-3 w-full">
                  <div className="relative">
                    {getIcon(preview.chat_type || 'dm', preview.avatar, preview.name)}
                    {(preview.unread_count > 1) && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        {preview.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-sm truncate">{preview.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">
                        {preview.last_timestamp && formatDistanceToNow(new Date(preview.last_timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-medium">
                      {preview.chat_type === 'project' ? `Project: ${preview.last_message}` : preview.last_message}
                    </p>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <p>No new messages</p>
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center p-3 text-primary font-medium cursor-pointer">
          <Link to="/messages">
            View all messages
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChatMenu;
