import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { AudioRecorder, AudioQueue, encodeAudioForAPI } from '@/utils/AudioUtils';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTranscript?: boolean;
}

interface VoiceChatProps {
  onMessageUpdate: (messages: Message[]) => void;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ onMessageUpdate }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random()}`,
      timestamp: new Date()
    };
    
    setMessages(prev => {
      const updated = [...prev, newMessage];
      onMessageUpdate(updated);
      return updated;
    });
  }, [onMessageUpdate]);

  const updateLastMessage = useCallback((content: string, isTranscript = false) => {
    setMessages(prev => {
      const updated = [...prev];
      const lastMessage = updated[updated.length - 1];
      
      if (lastMessage && lastMessage.type === 'assistant' && lastMessage.isTranscript === isTranscript) {
        lastMessage.content = content;
      } else {
        const newMessage: Message = {
          id: `msg_${Date.now()}_${Math.random()}`,
          type: 'assistant',
          content,
          timestamp: new Date(),
          isTranscript
        };
        updated.push(newMessage);
      }
      
      onMessageUpdate(updated);
      return updated;
    });
  }, [onMessageUpdate]);

  const startConversation = async () => {
    try {
      // Initialize audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      audioQueueRef.current = new AudioQueue(audioContextRef.current);

      // Connect to WebSocket
      const wsUrl = `wss://ilvkmcfmlkpqbcmtnblt.supabase.co/functions/v1/realtime-chat`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Connected to voice chat');
        setIsConnected(true);
        toast({
          title: "Connected",
          description: "Voice chat is ready! Start speaking or type a message.",
        });
      };

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', data.type);

          switch (data.type) {
            case 'session.created':
              console.log('Session created successfully');
              break;

            case 'session.updated':
              console.log('Session updated successfully');
              break;

            case 'input_audio_buffer.speech_started':
              setIsRecording(true);
              setCurrentTranscript('');
              break;

            case 'input_audio_buffer.speech_stopped':
              setIsRecording(false);
              break;

            case 'conversation.item.input_audio_transcription.completed':
              if (data.transcript) {
                addMessage({
                  type: 'user',
                  content: data.transcript
                });
              }
              break;

            case 'response.audio.delta':
              if (data.delta && audioQueueRef.current && !isMuted) {
                setIsSpeaking(true);
                const binaryString = atob(data.delta);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                await audioQueueRef.current.addToQueue(bytes);
              }
              break;

            case 'response.audio.done':
              setIsSpeaking(false);
              break;

            case 'response.audio_transcript.delta':
              if (data.delta) {
                setCurrentTranscript(prev => prev + data.delta);
                updateLastMessage(currentTranscript + data.delta, true);
              }
              break;

            case 'response.audio_transcript.done':
              if (data.transcript) {
                updateLastMessage(data.transcript, false);
                setCurrentTranscript('');
              }
              break;

            case 'response.function_call_arguments.done':
              console.log('Function call:', data.name, data.arguments);
              // Handle function calls here if needed
              break;

            case 'error':
              console.error('WebSocket error:', data);
              toast({
                title: "Error",
                description: data.message || "An error occurred",
                variant: "destructive",
              });
              break;
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to voice chat service",
          variant: "destructive",
        });
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket connection closed');
        setIsConnected(false);
        setIsRecording(false);
        setIsSpeaking(false);
        cleanup();
      };

      // Start audio recording
      recorderRef.current = new AudioRecorder((audioData) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const encodedAudio = encodeAudioForAPI(audioData);
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encodedAudio
          }));
        }
      });

      await recorderRef.current.start();

    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    cleanup();
    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
    toast({
      title: "Disconnected",
      description: "Voice chat has been ended",
    });
  };

  const cleanup = () => {
    recorderRef.current?.stop();
    wsRef.current?.close();
    audioQueueRef.current?.clear();
    audioContextRef.current?.close();
    
    recorderRef.current = null;
    wsRef.current = null;
    audioContextRef.current = null;
    audioQueueRef.current = null;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      audioQueueRef.current?.clear();
    }
  };

  const sendTextMessage = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Not Connected",
        description: "Please start voice chat first",
        variant: "destructive",
      });
      return;
    }

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text
          }
        ]
      }
    };

    wsRef.current.send(JSON.stringify(event));
    wsRef.current.send(JSON.stringify({ type: 'response.create' }));

    addMessage({
      type: 'user',
      content: text
    });
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">AI Voice Chat</h3>
            <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-500/20 text-green-300" : ""}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {isConnected && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleMute}
                  className="border-white/20"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                
                <div className="flex items-center gap-2">
                  {isRecording && <Badge className="bg-red-500/20 text-red-300">Recording</Badge>}
                  {isSpeaking && <Badge className="bg-blue-500/20 text-blue-300">AI Speaking</Badge>}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4">
          {!isConnected ? (
            <Button 
              onClick={startConversation}
              className="bg-cinesphere-purple hover:bg-cinesphere-purple/90 flex items-center gap-2"
              size="lg"
            >
              <Phone className="h-5 w-5" />
              Start Voice Chat
            </Button>
          ) : (
            <Button 
              onClick={endConversation}
              variant="destructive"
              className="flex items-center gap-2"
              size="lg"
            >
              <PhoneOff className="h-5 w-5" />
              End Call
            </Button>
          )}
        </div>

        {isConnected && (
          <div className="mt-4 p-4 bg-cinesphere-purple/10 rounded-lg border border-cinesphere-purple/20">
            <p className="text-sm text-gray-300 text-center">
              {isRecording ? (
                <><Mic className="inline h-4 w-4 mr-2 text-red-400" />Listening...</>
              ) : isSpeaking ? (
                <><Volume2 className="inline h-4 w-4 mr-2 text-blue-400" />AI is speaking...</>
              ) : (
                <><MicOff className="inline h-4 w-4 mr-2 text-gray-400" />Ready to listen</>
              )}
            </p>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400 text-center">
          This AI assistant can help with film industry questions, networking tips, and creative discussions.
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceChat;