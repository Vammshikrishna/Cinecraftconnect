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
import { useMessageMutation } from '@/hooks/mutations/useMessageMutation';
import { useCachedImage } from '@/hooks/useCachedImage';
import { getReplyThumbnail, getReplySnippet } from '@/components/chat/chatUtils';
import { useGroupKey } from '@/hooks/useGroupKey';
import { bufferToBase64, base64ToBuffer } from '@/lib/e2ee';

interface Message {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ChatWindowProps {
  threadId: string;
  onBack?: () => void;
}

const MessageAvatar = ({ src, name }: { src?: string | null; name: string }) => {
  const cachedSrc = useCachedImage(src || undefined);
  return (
    <Avatar className="h-8 w-8">
      <AvatarImage src={cachedSrc} />
      <AvatarFallback>{name[0] || 'U'}</AvatarFallback>
    </Avatar>
  );
};

// --- Thread-scoped AES-256-GCM helpers ---
// Uses the existing group_keys table with target_type='conversation' and target_id=threadId
const encryptThreadMessage = async (plaintext: string, key: CryptoKey): Promise<string> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  return JSON.stringify({
    __e2ee_thread: true,
    iv: bufferToBase64(iv.buffer),
    ct: bufferToBase64(cipherBuf),
  });
};

const decryptThreadMessage = async (raw: string, key: CryptoKey): Promise<string> => {
  if (!raw.includes('__e2ee_thread')) return raw; // legacy plaintext
  try {
    const { iv, ct } = JSON.parse(raw);
    const decBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(base64ToBuffer(iv)) },
      key,
      base64ToBuffer(ct)
    );
    return new TextDecoder().decode(decBuf);
  } catch {
    return '🔒 Unable to decrypt message';
  }
};

export const ChatWindow = ({ threadId, onBack }: ChatWindowProps) => {
  const { user } = useAuth();
  const { isInternal } = useAppRole();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const { onlineUserIds } = usePresence(`convo:${threadId}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage, deleteMessage } = useMessageMutation();

  // E2EE: Use symmetric group key scoped to this conversation thread
  const { symmetricKey, keysLoaded } = useGroupKey('conversation' as any, threadId);
  const keyRef = useRef<CryptoKey | null>(null);
  useEffect(() => { keyRef.current = symmetricKey; }, [symmetricKey]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const decryptMsg = async (m: Message): Promise<Message> => {
    const key = keyRef.current;
    if (!key || !m.content || m.is_deleted) return m;
    return { ...m, content: await decryptThreadMessage(m.content, key) };
  };

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, created_at, user_id, is_deleted, reply_to_id, attachment_url, attachment_type, profiles(full_name, avatar_url)')
        .eq('conversation_id', threadId)
        .order('created_at', { ascending: true });

      if (error) console.error('Error fetching messages', error);
      else {
        // Wait briefly for key to load if not yet ready
        let key = keyRef.current;
        if (!key) {
          for (let i = 0; i < 50; i++) {
            await new Promise(r => setTimeout(r, 100));
            key = keyRef.current;
            if (key) break;
          }
        }
        const decrypted = await Promise.all((data as any[]).map(decryptMsg));
        setMessages(decrypted);
      }
      setLoading(false);
    };

    if (keysLoaded || !symmetricKey) fetchMessages();
  }, [threadId, keysLoaded]);

  useEffect(() => {
    const subscription = supabase
      .channel(`messages:${threadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${threadId}` }, async payload => {
        if (payload.eventType === 'INSERT') {
          const newMsg = { ...payload.new } as Message;
          // Enrich with profile
          const { data: profileData } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', newMsg.user_id).single();
          newMsg.profiles = profileData;
          const decrypted = await decryptMsg(newMsg);
          setMessages(currentMessages => [...currentMessages, decrypted]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = { ...payload.new } as Message;
          const decrypted = await decryptMsg(updated);
          setMessages(currentMessages =>
            currentMessages.map(msg => msg.id === payload.new.id ? { ...msg, ...decrypted } : msg)
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

    const key = keyRef.current;
    let contentToSend = newMessage.trim();
    if (key) {
      try {
        contentToSend = await encryptThreadMessage(contentToSend, key);
      } catch (err) {
        console.error('Thread message encryption failed:', err);
        return; // Fail closed — do not send plaintext
      }
    }

    await sendMessage(threadId, contentToSend, { replyToId: replyingTo?.id });
    
    // Show plaintext optimistically
    setMessages(prev => [...prev, {
      id: `temp-${Date.now()}`,
      content: newMessage.trim(),
      created_at: new Date().toISOString(),
      user_id: user.id,
      profiles: null,
      reply_to_id: replyingTo?.id || null,
    }]);

    setNewMessage('');
    setReplyingTo(null);
  };

  const handleUndoMessage = async (messageId: string) => {
    if (!user) return;
    await deleteMessage(messageId);
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
        {messages.map((msg, idx) => {
          const isSender = msg.user_id === user?.id;
          const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
          const isSameSenderAsNext = nextMsg && nextMsg.user_id === msg.user_id;
          const showAvatar = !isSameSenderAsNext;

          return (
          <div key={msg.id} className={`flex items-start gap-3 group ${isSameSenderAsNext ? 'mb-1' : 'mb-3'} ${isSender ? 'flex-row-reverse' : ''}`}>
            {!isSender && (
              <div className="relative flex-shrink-0">
                {showAvatar ? (
                  <>
                    <MessageAvatar 
                      src={msg.profiles?.avatar_url} 
                      name={msg.profiles?.full_name || 'User'} 
                    />
                    {onlineUserIds.includes(msg.user_id) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />}
                  </>
                ) : (
                  <div className="h-8 w-8" />
                )}
              </div>
            )}
            <div className={`flex flex-col relative max-w-[70%] ${isSender ? 'items-end' : 'items-start'}`}>
              <div className={`p-3 rounded-2xl ${msg.is_deleted ? 'bg-muted/50 border border-border text-muted-foreground italic text-xs py-2' : isSender ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {msg.reply_to_id && !msg.is_deleted && (() => {
                  const repliedMsg = messages.find(m => m.id === msg.reply_to_id);
                  if (!repliedMsg) return null;
                  const repThumb = getReplyThumbnail(repliedMsg);
                  const rawText = repliedMsg.is_deleted ? 'Message deleted' : repliedMsg.content;
                  const snippet = repliedMsg.is_deleted ? rawText : getReplySnippet(repliedMsg, rawText);
                  return (
                    <div className={`mb-2 p-2 rounded-lg text-[10px] border flex items-center justify-between gap-2.5 ${isSender ? 'bg-primary-foreground/10 border-primary-foreground/20' : 'bg-background/50 border-border'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold mb-0.5 opacity-75 truncate">
                          {repliedMsg.profiles?.full_name || 'User'}
                        </div>
                        <div className="opacity-90 line-clamp-1 truncate">
                          {snippet}
                        </div>
                      </div>
                      {repThumb && (
                        <img loading="lazy" decoding="async"
                          src={repThumb}
                          alt="thumbnail"
                          className="w-8 h-8 rounded-md object-cover shrink-0 border border-black/10 dark:border-white/10"
                        />
                      )}
                    </div>
                  );
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
        );})
        }
        <div ref={messagesEndRef} />
      </div>
      <div className="flex flex-col bg-background p-4 border-t sticky bottom-0 lg:static">
        {replyingTo && (() => {
          const repThumb = getReplyThumbnail(replyingTo);
          const snippet = getReplySnippet(replyingTo, replyingTo.content);
          return (
            <div className="bg-muted px-3 py-1.5 mb-2 rounded-lg flex items-center justify-between border border-border text-xs gap-2">
              <div className="flex-1 overflow-hidden pr-2 min-w-0">
                <div className="font-semibold text-primary mb-0.5 text-[10px] uppercase truncate">
                  Replying to {replyingTo.profiles?.full_name || 'User'}
                </div>
                <div className="text-muted-foreground truncate opacity-80">
                  {snippet}
                </div>
              </div>
              {repThumb && (
                <img loading="lazy" decoding="async"
                  src={repThumb}
                  alt="thumbnail"
                  className="w-8 h-8 rounded-md object-cover shrink-0 border border-border"
                />
              )}
              <button 
                onClick={() => setReplyingTo(null)}
                className="p-1 rounded-full hover:bg-background text-muted-foreground transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })()}
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
