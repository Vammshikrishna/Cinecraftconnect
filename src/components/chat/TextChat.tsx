import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Bot, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTranscript?: boolean;
}

interface TextChatProps {
  messages: Message[];
  onSendMessage?: (text: string) => void;
  isConnected: boolean;
}

const TextChat: React.FC<TextChatProps> = ({ messages, onSendMessage, isConnected }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim() && onSendMessage) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="glass-card h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-cinesphere-purple" />
            Chat Transcript
          </span>
          <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-500/20 text-green-300" : ""}>
            {messages.length} messages
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-4">
        <div className="flex-1 space-y-4 overflow-y-auto max-h-96 mb-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 text-gray-500" />
              <p>Start a conversation with the AI assistant!</p>
              <p className="text-sm mt-1">You can use voice or text to communicate.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className={
                    message.type === 'user' 
                      ? "bg-cinesphere-purple/20 text-cinesphere-purple" 
                      : "bg-blue-500/20 text-blue-300"
                  }>
                    {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex-1 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {message.type === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    {message.isTranscript && (
                      <Badge variant="outline" className="text-xs px-1 py-0 border-yellow-500/30 text-yellow-300">
                        Transcript
                      </Badge>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  
                  <div className={`inline-block max-w-[85%] p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-cinesphere-purple/20 text-white'
                      : 'bg-white/5 border border-white/10 text-gray-100'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type a message or use voice..." : "Start voice chat to send messages"}
            disabled={!isConnected}
            className="bg-cinesphere-dark/50 border-white/10"
          />
          <Button
            onClick={handleSend}
            disabled={!inputText.trim() || !isConnected}
            className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {!isConnected && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Connect to voice chat to start messaging
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TextChat;