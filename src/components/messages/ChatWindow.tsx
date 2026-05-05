import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Send, ArrowLeft, MoreVertical, Reply, Trash2, ShieldBan, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { usePresence } from '@/hooks/usePresence';
import { useAppRole } from '@/hooks/useAppRole';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ChatWindowProps {
  threadId: string;
  onBack?: () => void;
}

export const ChatWindow = ({ threadId, onBack }: ChatWindowProps) => {
  const { user } = useAuth();
  const { isInternal } = useAppRole();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const { onlineUserIds } = usePresence(`convo:${threadId}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, created_at, user_id, is_deleted, reply_to_id, profiles(full_name, avatar_url)')
        .eq('conversation_id', threadId)
        .order('created_at', { ascending: true });

      if (error) console.error('Error fetching messages', error);
      else setMessages(data as any);
      setLoading(false);
    };

    fetchMessages();
  }, [threadId]);

  useEffect(() => {
    const subscription = supabase
      .channel(`messages:${threadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${threadId}` }, payload => {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as Message;
          // enrich with profile data locally to avoid another fetch
          supabase.from('profiles').select('full_name, avatar_url').eq('id', newMessage.user_id).single().then(({ data }) => {
            newMessage.profiles = data;
            setMessages(currentMessages => [...currentMessages, newMessage]);
          });
        } else if (payload.eventType === 'UPDATE') {
          setMessages(currentMessages => 
            currentMessages.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } : msg)
          );
        } else if (payload.eventType === 'DELETE') {
          setMessages(currentMessages => currentMessages.filter(msg => msg.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const { error } = await supabase.from('messages').insert({
      conversation_id: threadId,
      sender_id: user.id,
      content: newMessage.trim(),
      reply_to_id: replyingTo?.id || null
    });

    if (error) console.error('Error sending message', error);
    else {
      setNewMessage('');
      setReplyingTo(null);
    }
  };

  const handleUndoMessage = async (messageId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true, content: 'This message was deleted' })
      .eq('id', messageId)
      .eq('sender_id', user.id);
    
    if (error) {
      console.error('Error undoing message:', error);
    }
  };

  if (loading) return <div className="p-4"><EnhancedSkeleton className="h-full w-full" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border bg-background shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h2 className="text-lg font-semibold">Conversation</h2>
        </div>
        {/* Message history deletion moved to global Account Settings */}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => {
          const isSender = msg.user_id === user?.id;
          return (
          <div key={msg.id} className={`flex items-start gap-3 group ${isSender ? 'flex-row-reverse' : ''}`}>
            {!isSender && (
              <div className="relative flex-shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={msg.profiles?.avatar_url || undefined} />
                  <AvatarFallback>{msg.profiles?.full_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                {onlineUserIds.includes(msg.user_id) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />}
              </div>
            )}
            <div className={`flex flex-col relative max-w-[70%] ${isSender ? 'items-end' : 'items-start'}`}>
              <div className={`p-3 rounded-2xl ${msg.is_deleted ? 'bg-muted/50 border border-border text-muted-foreground italic text-xs py-2' : isSender ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {msg.reply_to_id && !msg.is_deleted && (() => {
                  const repliedMsg = messages.find(m => m.id === msg.reply_to_id);
                  if (!repliedMsg) return null;
                  return (
                    <div className={`mb-2 p-2 rounded-lg text-[10px] border ${isSender ? 'bg-primary-foreground/10 border-primary-foreground/20' : 'bg-background/50 border-border'}`}>
                      <div className="font-semibold mb-0.5 opacity-75">
                        {repliedMsg.profiles?.full_name || 'User'}
                      </div>
                      <div className="opacity-90 line-clamp-1">
                        {repliedMsg.is_deleted ? <em>This message was deleted</em> : repliedMsg.content}
                      </div>
                    </div>
                  )
                })()}

                {msg.is_deleted ? (
                  <span className="flex items-center gap-1.5"><ShieldBan className="h-3.5 w-3.5" /> This message was deleted</span>
                ) : (
                  <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              
              {!msg.is_deleted && (
                <div className={`absolute ${isSender ? 'right-full mr-2' : 'left-full ml-2'} top-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 text-muted-foreground hover:bg-muted rounded-full">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isSender ? 'end' : 'start'} className="w-36">
                      <DropdownMenuItem onClick={() => setReplyingTo(msg)} className="text-xs cursor-pointer">
                        <Reply className="h-3.5 w-3.5 mr-2" /> Reply
                      </DropdownMenuItem>
                      {isSender && (
                        <DropdownMenuItem onClick={() => handleUndoMessage(msg.id)} className="text-xs text-destructive focus:bg-destructive/10 cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Undo
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              
              <p className="text-[10px] text-muted-foreground mt-1 px-1">{format(new Date(msg.created_at), 'p')}</p>
            </div>
          </div>
        );})}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex flex-col bg-background p-4 border-t sticky bottom-0 lg:static">
        {replyingTo && (
          <div className="bg-muted px-3 py-1.5 mb-2 rounded-lg flex items-center justify-between border border-border text-xs">
            <div className="flex-1 overflow-hidden pr-2">
              <div className="font-semibold text-primary mb-0.5 text-[10px] uppercase">
                Replying to {replyingTo.profiles?.full_name || 'User'}
              </div>
              <div className="text-muted-foreground truncate opacity-80">
                {replyingTo.content}
              </div>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-background text-muted-foreground transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {isInternal ? (
          <div className="text-center p-3 text-muted-foreground text-sm bg-muted/50 rounded-lg border border-border italic flex items-center justify-center gap-2">
            <ShieldBan className="h-4 w-4" /> Internal staff cannot send direct messages
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="bg-muted/50" />
            <Button type="submit" size="icon" className="shrink-0"><Send className="h-4 w-4" /></Button>
          </form>
        )}
      </div>
    </div>
  );
};
