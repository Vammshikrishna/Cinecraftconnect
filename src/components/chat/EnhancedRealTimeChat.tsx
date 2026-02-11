
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Send, ArrowLeft, MoreVertical, Smile } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { PostShareCard } from './PostShareCard';
import { MarketplaceShareCard } from './MarketplaceShareCard';
import { AnnouncementShareCard } from './AnnouncementShareCard';
import { EncryptionService } from '@/services/EncryptionService';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender_profile: {
    full_name: string;
    avatar_url: string;
  } | null;
}

interface EnhancedRealTimeChatProps {
  roomId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatarUrl: string;
  onBackClick: () => void;
}

const EnhancedRealTimeChat = ({ roomId, partnerId, partnerName, partnerAvatarUrl, onBackClick }: EnhancedRealTimeChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [partnerPublicKey, setPartnerPublicKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchPartnerKey = async () => {
      if (!partnerId) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('public_key')
        .eq('id', partnerId)
        .single();

      if (!error && (data as any)?.public_key) {
        setPartnerPublicKey((data as any).public_key);
      }
    };
    fetchPartnerKey();
  }, [partnerId]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    const { data, error } = await (supabase.rpc as any)('get_messages_for_channel', { p_channel_id: roomId });
    if (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } else {
      // Decrypt messages
      const loadedMessages = data as Message[];
      // We can only decrypt if we have the partner's public key (to derive the shared secret)
      // AND the user's private key (handled by EncryptionService internally).
      // Since fetches are async, we might want to do this transformation:

      if (partnerPublicKey) {
        const decryptedPromise = loadedMessages.map(async (msg) => {
          // Try to decrypt only if it looks encrypted (e.g. check if it's JSON with iv?) 
          // Our format: { ciphertext, iv } returned by encryptMessage
          // AND we stored { ciphertext, iv } as JSON string in content?
          // Wait, encryption service encryptMessage returns object. 
          // handleSendMessage stores object.ciphertext? No, we need to store string.
          // We should store JSON string of { ciphertext, iv }.

          try {
            const parsed = JSON.parse(msg.content);
            if (parsed.ciphertext && parsed.iv) {
              const decrypted = await EncryptionService.decryptMessage(parsed.ciphertext, parsed.iv, partnerPublicKey);
              if (decrypted) {
                return { ...msg, content: decrypted };
              }
            }
          } catch (e) {
            // Not JSON or not encrypted format -> Plaintext
          }
          return msg;
        });
        const decryptedMessages = await Promise.all(decryptedPromise);
        setMessages(decryptedMessages);
      } else {
        // If we don't have the key yet, we can't decrypt encrypted messages.
        // We should probably wait or trigger re-fetch when key loads.
        // For now, show as is (will look like garbage if encrypted).
        setMessages(loadedMessages);
      }
    }

    // Mark messages as read
    if (user && roomId) {
      const { error: readError } = await supabase
        .from('direct_messages' as any)
        .update({ is_read: true })
        .eq('channel_id', roomId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (readError) {
        console.error('Error marking messages as read:', readError);
      }
    }

    setLoading(false);
  }, [roomId, partnerPublicKey, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`realtime-chat:${roomId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `channel_id=eq.${roomId}` },
        (_payload) => {
          fetchMessages();
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages, user?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user || !roomId) return;

    // We need to implement encryption BEFORE insert.
    // Ideally we modify the insert call above.


    let contentToSend = newMessage.trim();
    if (partnerPublicKey) {
      const encrypted = await EncryptionService.encryptMessage(contentToSend, partnerPublicKey);
      if (encrypted) {
        contentToSend = JSON.stringify(encrypted);
      } else {
        console.warn('Failed to encrypt message. Falling back to plaintext.');
        // Fallback to clear text
      }
    } else {
      console.warn("No partner public key. Sending plaintext.");
    }

    const { error: sendError } = await supabase.from('direct_messages' as any).insert({
      content: contentToSend,
      sender_id: user.id,
      channel_id: roomId,
      receiver_id: partnerId
    });

    if (sendError) {
      console.error('Error sending message:', sendError);
    } else {
      setNewMessage('');
      setShowEmojiPicker(false);
    }
  };

  const onEmojiClick = (emojiObject: EmojiClickData) => {
    setNewMessage(prevMessage => prevMessage + emojiObject.emoji);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'p'); // e.g., 5:30 PM
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d'); // e.g., Jul 23
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <header className="flex items-center justify-between px-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onBackClick} className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft className="h-6 w-6" />
          </button>
          {partnerName && (
            <>
              <Avatar>
                <AvatarImage src={partnerAvatarUrl} />
                <AvatarFallback>{partnerName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <h2 className="font-bold text-lg">{partnerName}</h2>
            </>
          )}
        </div>
        <button onClick={() => console.log('Dot menu clicked')} className="p-2 rounded-full hover:bg-muted">
          <MoreVertical className="h-6 w-6" />
        </button>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-2 pb-20 md:p-4 md:pb-4 pr-2 md:pr-4">
            {messages.map((message) => {
              const isSender = message.sender_id === user?.id;
              return (
                <div key={message.id} className={`flex items-end gap-3 my-4 ${isSender ? 'flex-row-reverse' : ''}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.sender_profile?.avatar_url} />
                    <AvatarFallback>{message.sender_profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className={`${message.content.startsWith('POST_SHARE::') || message.content.startsWith('MARKETPLACE_SHARE::') || message.content.startsWith('ANNOUNCEMENT_SHARE::') ? 'p-0 bg-transparent' : `p-3 rounded-2xl ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`} max-w-xs lg:max-w-md`}>
                    {message.content.startsWith('POST_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('POST_SHARE::', ''));
                          return <PostShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm break-words">{message.content}</p>;
                        }
                      })()
                    ) : message.content.startsWith('MARKETPLACE_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('MARKETPLACE_SHARE::', ''));
                          return <MarketplaceShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm break-words">{message.content}</p>;
                        }
                      })()
                    ) : message.content.startsWith('ANNOUNCEMENT_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('ANNOUNCEMENT_SHARE::', ''));
                          return <AnnouncementShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm break-words">{message.content}</p>;
                        }
                      })()
                    ) : (
                      <p className="text-sm break-words">{message.content}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTimestamp(message.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-border">
            {showEmojiPicker && (
              <div className="absolute bottom-20 z-10">
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="rounded-full"
              >
                <Smile className="h-5 w-5" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 rounded-full"
                autoComplete="off"
              />
              <Button type="submit" size="icon" className="rounded-full" disabled={!newMessage.trim()}>
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default EnhancedRealTimeChat;
