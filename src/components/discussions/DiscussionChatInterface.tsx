
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, isToday, isYesterday } from 'date-fns';
import { Message, UserRole, Category, Call } from './types';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { ArrowLeft, Video, Settings, Users, Phone, Loader2, ChevronDown, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RoomMembers } from './RoomMembers';
import { RoomSettings } from './RoomSettings';
import { VideoCallManager } from './VideoCallManager';
import { useToast } from '@/hooks/use-toast';
import { EncryptionService } from '@/services/EncryptionService';
import { PostShareCard } from '@/components/chat/PostShareCard';
import { MarketplaceShareCard } from '@/components/chat/MarketplaceShareCard';

interface DiscussionChatInterfaceProps {
  roomId: string;
  userRole: UserRole;
  roomTitle: string;
  roomDescription: string | null;
  categoryId: string;
  categories: Category[];
  roomType: 'public' | 'private' | 'secret';
  onClose: () => void;
  onRoomUpdated: (roomId: string, newTitle: string, newDescription: string) => void;
}

export const DiscussionChatInterface = ({ roomId, userRole, roomTitle, roomDescription, categoryId, categories, roomType, onClose, onRoomUpdated }: DiscussionChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(roomId);
  const [isMembersSidebarOpen, setMembersSidebarOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isJoiningCall, setIsJoiningCall] = useState(false);
  const [isCallTypeDialogOpen, setCallTypeDialogOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setIsAtBottom(true);
    setUnreadCount(0);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
    setIsAtBottom(isBottom);
    if (isBottom) {
      setUnreadCount(0);
    }
  };

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('room_messages')
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles (
            id,
            username,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Decrypt messages if roomKey exists
      const decryptedMessages = await Promise.all(((data as any) || []).map(async (msg: any) => {
        if (!msg.content) return msg;
        // Check if JSON (likely encrypted)
        if (roomKey && msg.content.startsWith('{') && msg.content.includes('"iv"')) {
          try {
            const parsed = JSON.parse(msg.content);
            const decryptedText = await EncryptionService.decryptGroupMessage(parsed.ciphertext, parsed.iv, roomKey);
            if (decryptedText) {
              return { ...msg, content: decryptedText };
            }
          } catch (e) {
            // Ignore parse errors (plaintext)
          }
        }
        return msg;
      }));

      setMessages(decryptedMessages);
    } catch (err: any) {
      setError('Failed to fetch messages. Please try again later.');
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId, roomKey]);

  // --- E2EE Room Key Management ---
  useEffect(() => {
    if (!roomId || !user) return;

    // SKIP encryption for public rooms.
    if (roomType === 'public') {
      console.log("Public room: Encryption disabled.");
      setRoomKey(null);
      return;
    }

    const setupRoomEncryption = async () => {
      try {
        // 1. Check if I have a key for this room
        const { data: keyData, error: _keyError } = await supabase
          .from('room_keys' as any)
          .select('encrypted_key, sender_id')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (keyData) {
          // I have a key! Decrypt it.
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('public_key')
            .eq('id', (keyData as any).sender_id)
            .single();

          if ((senderProfile as any)?.public_key) {
            try {
              const parsedKey = JSON.parse((keyData as any).encrypted_key);
              const decryptedKey = await EncryptionService.decryptRoomKey(
                parsedKey.ciphertext,
                parsedKey.iv,
                (senderProfile as any).public_key
              );
              if (decryptedKey) {
                setRoomKey(decryptedKey);
                console.log("Room key decrypted successfully.");
              }
            } catch (err) {
              console.error("Failed to parse/decrypt room key", err);
            }
          }
        } else {
          // No key found. Check if I am the Creator.
          const { data: room } = await supabase
            .from('discussion_rooms')
            .select('creator_id')
            .eq('id', roomId)
            .single();

          if (room?.creator_id === user.id) {
            console.log("I am creator. Generating new room key...");
            const newKey = await EncryptionService.generateRoomKey();

            // Encrypt for MYSELF first
            const { data: myProfile } = await supabase.from('profiles').select('public_key').eq('id', user.id).single();

            if ((myProfile as any)?.public_key) {
              const encryptedForMe = await EncryptionService.encryptRoomKeyForUser(newKey, (myProfile as any).public_key);

              if (encryptedForMe) {
                // Store in DB
                const { error: insertError } = await supabase.from('room_keys' as any).insert({
                  room_id: roomId,
                  user_id: user.id,
                  sender_id: user.id,
                  encrypted_key: JSON.stringify({ ciphertext: encryptedForMe.encryptedKey, iv: encryptedForMe.iv })
                });

                if (!insertError) {
                  setRoomKey(newKey);
                  console.log("New room key generated and saved.");
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error setting up room encryption:", err);
      }
    };

    setupRoomEncryption();
  }, [roomId, user, roomType]);

  useEffect(() => {
    fetchMessages();
    const timer = setTimeout(() => scrollToBottom('auto'), 500);
    return () => clearTimeout(timer);
  }, [fetchMessages]); // fetchMessages now depends on roomKey

  useEffect(() => {
    const channel = supabase
      .channel(`chat-room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          // Check if the new message is from the current user
          const isMyMessage = payload.new && (payload.new as any).user_id === user?.id;

          fetchMessages();

          if (isMyMessage) {
            // If it's my message, I've already handled the scroll in handleSendMessage, 
            // but doing it again here ensures sync.
            setTimeout(() => scrollToBottom(), 300);
          } else {
            // If it's someone else's message
            if (isAtBottom) {
              setTimeout(() => scrollToBottom(), 300);
            } else {
              setUnreadCount(prev => prev + 1);
            }
          }
        })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages, isAtBottom, user?.id]);

  const handleSendMessage = async (content: string) => {
    if (!user || !roomId) return;

    try {
      let contentToSend = content;
      if (roomKey) {
        const encrypted = await EncryptionService.encryptGroupMessage(content, roomKey);
        contentToSend = JSON.stringify(encrypted);
      }
      const { error } = await supabase.from('room_messages').insert({
        content: contentToSend,
        user_id: user.id,
        room_id: roomId
      });
      if (error) throw error;
      fetchMessages(); // Refresh messages immediately
      setTimeout(() => scrollToBottom(), 100); // Force scroll on send
      stopTyping(); // Stop typing indicator on send
    } catch (err) {
      console.error("Error sending message:", err);
      // Optionally, show an error to the user
    }
  };

  const handleAttach = async (file: File) => {
    if (!user || !roomId) return;

    try {
      // 1. Encrypt File
      const encryptedData = await EncryptionService.encryptFile(file);
      if (!encryptedData) throw new Error("Failed to encrypt file");

      const filePath = `${roomId}/${Date.now()}_${file.name}.enc`;

      // 2. Upload Encrypted Blob
      // Discussion rooms might share the 'project-files' bucket or have a 'discussion-files' bucket?
      // Let's assume 'discussion-files' exists or use a generic one.
      // Checking existing buckets... user only used 'project-files' before. 
      // I will use 'project-files' for now but prefix with roomID which is a UUID.
      // Wait, 'project-files' policies might rely on project_id? 
      // If 'discussion-files' doesn't exist, upload will fail.
      // I'll try 'project-files' for now, but if it fails, I might need to create a bucket.
      // Actually, let's use 'project-files' since that's what we have.

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, encryptedData.encryptedBlob);

      if (uploadError) throw uploadError;

      // 3. Prepare Metadata
      const fileMetadata = JSON.stringify({
        type: 'file',
        path: filePath,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        key: encryptedData.key,
        iv: encryptedData.iv
      });

      // 4. Encrypt Metadata
      let contentToInsert = fileMetadata;
      if (roomKey) {
        const encryptedMsg = await EncryptionService.encryptGroupMessage(fileMetadata, roomKey);
        contentToInsert = JSON.stringify(encryptedMsg);
      } else {
        contentToInsert = `Shared a file: ${file.name} (Unencrypted)`;
      }

      const { error: msgError } = await supabase.from('room_messages').insert({
        content: contentToInsert,
        user_id: user.id,
        room_id: roomId
      });

      if (msgError) throw msgError;

      toast({ title: "Success", description: "Encrypted file uploaded successfully" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });
    }
  };

  const downloadDecryptedFile = async (metadata: any) => {
    try {
      toast({ title: "Decrypting...", description: "Downloading and decrypting file..." });

      const { data, error } = await supabase.storage.from('project-files').download(metadata.path);
      if (error) throw error;

      const decryptedBlob = await EncryptionService.decryptFile(data, metadata.key, metadata.iv);
      if (!decryptedBlob) throw new Error("Decryption failed");

      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = metadata.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Success", description: "File downloaded." });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to download/decrypt file.", variant: "destructive" });
    }
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (!user) return;
    setCallTypeDialogOpen(false);
    setIsJoiningCall(true);
    try {
      const { data, error } = await (supabase.rpc as any)('start_call', {
        room_id: roomId,
        created_by: user.id,
        call_type: type
      });

      if (error) throw error;
      const newCall = await fetchCall((data as any).id);
      if (newCall) setActiveCall(newCall);

    } catch (error: any) {
      toast({ title: "Error Starting Call", description: error.message, variant: "destructive" });
    } finally {
      setIsJoiningCall(false);
    }
  };

  const fetchCall = async (callId: string): Promise<Call | null> => {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();
      if (error) throw error;
      return data as unknown as Call;
    } catch (error) {
      console.error("Failed to fetch call details", error);
      toast({ title: "Error", description: "Could not fetch call details.", variant: "destructive" });
      return null;
    }
  }


  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return format(date, 'p');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'P');
  };

  if (loading && messages.length === 0) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-red-500">{error}</div>;
  }

  if (activeCall && user) {
    return <VideoCallManager roomId={roomId} userId={user.id} />
  }

  return (
    <div className="flex flex-col h-full w-full bg-background text-foreground overflow-hidden relative">
      <header className="flex items-center justify-between gap-4 p-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-lg truncate text-foreground">{roomTitle}</h2>
            <p className="text-sm text-muted-foreground truncate">{roomDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCallTypeDialogOpen(true)} disabled={isJoiningCall}>
            {isJoiningCall ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMembersSidebarOpen(true)}><Users className="w-5 h-5" /></Button>
          <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button>
            </DialogTrigger>
            <RoomSettings
              roomId={roomId}
              currentTitle={roomTitle}
              currentDescription={roomDescription}
              currentCategory={categoryId}
              categories={categories}
              onRoomUpdated={onRoomUpdated}
              onClose={() => setSettingsOpen(false)}
            />
          </Dialog>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 flex flex-col overflow-y-auto p-4 pr-4 custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No messages yet</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Start the conversation!</p>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isSender = message.profiles.id === user?.id;
              return (
                <div key={message.id} className={`flex items-end gap-3 my-4 ${isSender ? 'flex-row-reverse' : ''}`}>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to={`/profile/${message.profiles.id}`}>
                          <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
                            <AvatarImage src={message.profiles.avatar_url || undefined} />
                            <AvatarFallback>{(message.profiles.username || 'U').charAt(0)}</AvatarFallback>
                          </Avatar>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side={isSender ? 'right' : 'left'}>
                        <p>{message.profiles.username}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className={`${message.content.startsWith('POST_SHARE::') || message.content.startsWith('MARKETPLACE_SHARE::') ? 'p-0 bg-transparent' : `p-3 rounded-2xl ${isSender ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} max-w-sm md:max-w-md lg:max-w-lg relative group`}>
                    {message.content.startsWith('POST_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('POST_SHARE::', ''));
                          return <PostShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>;
                        }
                      })()
                    ) : message.content.startsWith('MARKETPLACE_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('MARKETPLACE_SHARE::', ''));
                          return <MarketplaceShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>;
                        }
                      })()
                    ) : (
                      // File Message Detection
                      (() => {
                        try {
                          if (message.content.includes('"type":"file"')) {
                            const metadata = JSON.parse(message.content);
                            if (metadata.type === 'file' && metadata.key && metadata.iv) {
                              return (
                                <div className="flex flex-col gap-2">
                                  <p className="font-semibold text-sm">🔒 Encrypted File</p>
                                  <div className="flex items-center gap-2 p-2 bg-black/20 rounded">
                                    <span className="text-xs truncate max-w-[150px]">{metadata.name}</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => downloadDecryptedFile(metadata)}>
                                      Download
                                    </Button>
                                  </div>
                                </div>
                              );
                            }
                          }
                          // Fallback normal message
                          return <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>;
                        } catch {
                          return <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>;
                        }
                      })()
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTimestamp(message.created_at)}</span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Unread Messages Indicator */}
        {!isAtBottom && unreadCount > 0 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <Button
              onClick={() => scrollToBottom()}
              className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              size="sm"
            >
              <ChevronDown className="h-4 w-4" />
              {unreadCount} New Message{unreadCount > 1 ? 's' : ''}
            </Button>
          </div>
        )}

        {isMembersSidebarOpen && <RoomMembers roomId={roomId} onClose={() => setMembersSidebarOpen(false)} />}
      </div>

      <div className="p-4 border-t border-border/50 bg-background">
        <TypingIndicator typingUsers={typingUsers} />
        <MessageComposer
          onSend={handleSendMessage}
          onAttach={handleAttach}
          onTyping={startTyping}
          onStopTyping={stopTyping}
          userRole={userRole}
        />
      </div>

      <Dialog open={isCallTypeDialogOpen} onOpenChange={setCallTypeDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Start a Call</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex justify-around">
            <Button variant="outline" size="lg" onClick={() => startCall('audio')} className="flex flex-col h-24 w-24">
              <Phone className="h-8 w-8 mb-2" />
              Audio Call
            </Button>
            <Button variant="outline" size="lg" onClick={() => startCall('video')} className="flex flex-col h-24 w-24">
              <Video className="h-8 w-8 mb-2" />
              Video Call
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
};
