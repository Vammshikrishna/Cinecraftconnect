import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Phone, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCall } from '@/hooks/useCall';
import { NativeCallContainer } from '@/components/calls/NativeCallContainer';
import { MessageComposer } from './MessageComposer';
import { EncryptionService } from '@/services/EncryptionService';
import { PostShareCard } from '@/components/chat/PostShareCard';
import { MarketplaceShareCard } from '@/components/chat/MarketplaceShareCard';
import { AnnouncementShareCard } from '@/components/chat/AnnouncementShareCard';

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ProjectChatInterfaceProps {
  projectId: string;
}

export const ProjectChatInterface = ({ projectId }: ProjectChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inCall, setInCall] = useState(false);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  // const [isKeyLoading, setIsKeyLoading] = useState(false); // Unused for now

  // Use spaceId for the call room, as RLS policies expect project_space_id
  const { activeCall, loading, startCall, joinCall } = useCall('project', spaceId || '');

  useEffect(() => {
    const fetchSpaceId = async () => {
      if (!projectId) return;
      const { data, error } = await supabase
        .from('project_spaces' as any)
        .select('id')
        .eq('project_id', projectId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching project space:', error);
        return;
      }

      // Fetch project details (title) independently
      const { data: projectData } = await supabase
        .from('projects')
        .select('title, creator_id')
        .eq('id', projectId)
        .single();

      if (projectData) {
        setProjectName(projectData.title);
      }

      if (data) {
        setSpaceId((data as any).id);
      } else {
        console.log('No project space found. checking ownership to auto-create...');
        // We already fetched projectData above

        if (projectData && user && projectData.creator_id === user.id) {
          console.log('User is creator. Creating default space...');
          const { data: newSpace, error: createError } = await supabase
            .from('project_spaces' as any)
            .insert({
              project_id: projectId,
              name: 'General'
            })
            .select()
            .single();

          if (!createError && newSpace) {
            setSpaceId((newSpace as any).id);
            toast({ title: "Fixed", description: "Project space created automatically." });
          } else {
            console.error('Failed to create space:', createError);
          }
        } else {
          console.error('No project space found and user is not creator.');
        }
      }
    };
    fetchSpaceId();
  }, [projectId, user]);

  useEffect(() => {
    if (!spaceId) return;

    fetchMessages();

    const channel = supabase
      .channel(`project_messages:${spaceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_space_messages',
        filter: `project_space_id=eq.${spaceId}`
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- E2EE Room Key Management ---
  useEffect(() => {
    if (!spaceId || !user) return;

    const setupRoomEncryption = async () => {
      // setIsKeyLoading(true);
      try {
        // 1. Check if I have a key for this room
        const { data: keyData, error: _keyError } = await supabase
          .from('room_keys' as any)
          .select('encrypted_key, sender_id')
          .eq('room_id', spaceId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (keyData) {
          // I have a key! Decrypt it.
          // We need the sender's public key to decrypt.
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('public_key')
            .eq('id', (keyData as any).sender_id)
            .single();

          if ((senderProfile as any)?.public_key) {
            // Note: In our `encryptRoomKeyForUser` implementation, we used `encryptMessage` logic.
            // Our `encryptMessage` returns { ciphertext, iv }. 
            // The `room_keys` table stores `encrypted_key` as text. 
            // We assume it's stored as JSON string of { ciphertext, iv }?
            // Wait, migration said "encrypted_key text". 
            // `EncryptionService` now returns `{ encryptedKey: string, iv: string }`.
            // Let's assume we store JSON.stringify({ ciphertext: ..., iv: ... }).

            try {
              const parsedKey = JSON.parse((keyData as any).encrypted_key);
              // Wait, `EncryptionService.decryptRoomKey` expects simple args.
              // It calls `decryptMessage`.
              const decryptedKey = await EncryptionService.decryptRoomKey(
                parsedKey.ciphertext, // or parsedKey.encryptedKey? The service returns { encryptedKey, iv }.
                parsedKey.iv,
                (senderProfile as any).public_key
              );
              if (decryptedKey) {
                setRoomKey(decryptedKey);
                console.log("Room key decrypted successfully.");

                // Auto-Share Logic: If I have a valid key, check if others need it?
                // Checking permissions... avoiding loop. 
              }
            } catch (err) {
              console.error("Failed to parse/decrypt room key", err);
            }
          }
        } else {
          // No key found.
          console.log("No room key found for user.");

          // Check if I am the project creator (or authorized to create key)
          const { data: project } = await supabase
            .from('projects')
            .select('creator_id')
            .eq('id', projectId)
            .single();

          if (project?.creator_id === user.id) {
            console.log("I am creator. Generating new room key...");
            const newKey = await EncryptionService.generateRoomKey();

            // Encrypt for MYSELF first
            const { data: myProfile } = await supabase.from('profiles').select('public_key').eq('id', user.id).single();

            if ((myProfile as any)?.public_key) {
              const encryptedForMe = await EncryptionService.encryptRoomKeyForUser(newKey, (myProfile as any).public_key);

              if (encryptedForMe) {
                // Store in DB
                const { error: insertError } = await supabase.from('room_keys' as any).insert({
                  room_id: spaceId,
                  user_id: user.id,
                  sender_id: user.id,
                  encrypted_key: JSON.stringify({ ciphertext: encryptedForMe.encryptedKey, iv: encryptedForMe.iv })
                });

                if (!insertError) {
                  setRoomKey(newKey);
                  console.log("New room key generated and saved.");
                  // TODO: Share with other members? (This requires listing members and encrypting for each)
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error setting up room encryption:", err);
      } finally {
        // setIsKeyLoading(false);
      }
    };

    setupRoomEncryption();
  }, [spaceId, user, projectId]);


  const fetchMessages = async () => {
    if (!spaceId) return;

    const { data, error } = await supabase
      .from('project_space_messages' as any)
      .select(`
        id,
        content,
        user_id,
        created_at,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .eq('project_space_id', spaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      // Decrypt messages
      const decryptedMessages = await Promise.all(((data as any) || []).map(async (msg: any) => {
        if (!msg.content) return msg;
        // Check if JSON (likely encrypted)
        if (msg.content.startsWith('{') && msg.content.includes('"iv"') && roomKey) {
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
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || sending || !user) return;

    setSending(true);
    try {
      let contentToSend = content.trim();

      // Encrypt if we have a key
      if (roomKey) {
        const encrypted = await EncryptionService.encryptGroupMessage(contentToSend, roomKey);
        contentToSend = JSON.stringify(encrypted); // { ciphertext, iv }
      }

      const { error } = await supabase
        .from('project_space_messages' as any)
        .insert([{
          project_space_id: spaceId,
          user_id: user?.id,
          content: contentToSend
        }]);

      if (error) throw error;
    } catch (err: any) {
      console.error('Send message error:', err);
      toast({
        title: "Error",
        description: err.message || err.error_description || "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleAttach = async (file: File) => {
    if (!user || !projectId) return;
    setSending(true);
    try {
      // 1. Encrypt File
      const encryptedData = await EncryptionService.encryptFile(file);
      if (!encryptedData) throw new Error("Failed to encrypt file");

      const filePath = `${projectId}/${Date.now()}_${file.name}.enc`;

      // 2. Upload Encrypted Blob
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, encryptedData.encryptedBlob);

      if (uploadError) throw uploadError;

      // 3. Prepare Metadata (Plaintext content)
      const fileMetadata = JSON.stringify({
        type: 'file',
        path: filePath,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        key: encryptedData.key,
        iv: encryptedData.iv
      });

      // 4. Encrypt Metadata with Room Key
      let contentToInsert = fileMetadata;
      if (roomKey) {
        const encryptedMsg = await EncryptionService.encryptGroupMessage(fileMetadata, roomKey);
        contentToInsert = JSON.stringify(encryptedMsg);
      } else {
        // Fallback for non-E2EE rooms (shouldn't happen if migration worked, but safe fallback)
        contentToInsert = `Shared a file: ${file.name} (Unencrypted)`;
      }

      // Send message with file reference
      const { error: msgError } = await supabase
        .from('project_space_messages' as any)
        .insert({
          project_space_id: spaceId,
          user_id: user.id,
          content: contentToInsert
        });

      if (msgError) throw msgError;

      toast({ title: "Success", description: "Encrypted file uploaded successfully" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: "Failed to upload file", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const downloadDecryptedFile = async (metadata: any) => {
    try {
      toast({ title: "Decrypting...", description: "Downloading and decrypting file..." });

      // 1. Download Encrypted Blob
      const { data, error } = await supabase.storage.from('project-files').download(metadata.path);
      if (error) throw error;

      // 2. Decrypt Blob
      const decryptedBlob = await EncryptionService.decryptFile(data, metadata.key, metadata.iv);
      if (!decryptedBlob) throw new Error("Decryption failed");

      // 3. Trigger Download / View
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

  const handleStartCall = async () => {
    const call = await startCall();
    if (call) {
      setInCall(true);
    } else {
      toast({
        title: "Error",
        description: "Failed to start call. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleJoinCall = async () => {
    const success = await joinCall();
    if (success) {
      setInCall(true);
    }
  };

  const handleLeaveCall = () => {
    setInCall(false);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If in call, show call interface
  if (inCall && activeCall) {
    return (
      <NativeCallContainer
        roomId={spaceId || projectId}
        onLeave={handleLeaveCall}
        roomName={projectName || 'Project Call'}
        projectId={projectId}
      />
    );
  }

  // Otherwise show chat interface
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap justify-between items-center p-4 border-b border-border gap-2">
        <h2 className="text-lg font-semibold">Project Chat</h2>
        <div className="flex gap-2">
          {activeCall ? (
            <Button size="sm" variant="default" onClick={handleJoinCall} disabled={loading}>
              <Video className="h-4 w-4 mr-2" />Join Call
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleStartCall} disabled={loading}>
                <Phone className="h-4 w-4 mr-2" />Call
              </Button>
              <Button size="sm" variant="outline" onClick={handleStartCall} disabled={loading}>
                <Video className="h-4 w-4 mr-2" />Video
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.user_id === user?.id;
            return (
              <div key={message.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={message.profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    {message.profiles?.full_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                  <div className={`${(message.content.startsWith('POST_SHARE::') || message.content.startsWith('MARKETPLACE_SHARE::') || message.content.startsWith('ANNOUNCEMENT_SHARE::')) ? 'p-0 bg-transparent' : `rounded-lg px-4 py-2 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}`}>
                    {!isOwn && (
                      <p className="text-xs font-semibold mb-1">
                        {message.profiles?.full_name || 'Unknown User'}
                      </p>
                    )}
                    {message.content.startsWith('POST_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('POST_SHARE::', ''));
                          return <PostShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
                        }
                      })()
                    ) : message.content.startsWith('MARKETPLACE_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('MARKETPLACE_SHARE::', ''));
                          return <MarketplaceShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
                        }
                      })()
                    ) : message.content.startsWith('ANNOUNCEMENT_SHARE::') ? (
                      (() => {
                        try {
                          const shareData = JSON.parse(message.content.replace('ANNOUNCEMENT_SHARE::', ''));
                          return <AnnouncementShareCard {...shareData} />;
                        } catch (e) {
                          return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
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
                          return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
                        } catch {
                          return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
                        }
                      })()
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border">
        <MessageComposer
          onSend={handleSendMessage}
          onAttach={handleAttach}
          disabled={sending}
        />
      </div>
    </div>
  );
};
