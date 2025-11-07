
import { useState, useEffect } from "react";
import Footer from "@/components/Footer";
import VoiceChat from "@/components/chat/VoiceChat";
import TextChat from "@/components/chat/TextChat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Mic, Zap, Users } from "lucide-react";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTranscript?: boolean;
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);

  useEffect(() => {
    document.title = "AI Chat | CineSphere";
  }, []);

  const handleSendTextMessage = (text: string) => {
    // This will be handled by the VoiceChat component
    // when it's connected, otherwise show a message
    if (!isVoiceConnected) {
      const newMessage: Message = {
        id: `msg_${Date.now()}`,
        type: 'user',
        content: text,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);
      
      // Simulate AI response for demo
      setTimeout(() => {
        const aiResponse: Message = {
          id: `msg_${Date.now() + 1}`,
          type: 'assistant',
          content: "Hi! I'm the CineSphere AI assistant. Please start a voice chat session for full conversation capabilities, including real-time voice interaction.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cinesphere-dark to-black">
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 flex items-center justify-center gap-3">
              <MessageSquare className="text-cinesphere-purple" />
              AI-Powered Chat
            </h1>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Experience the future of conversation with our AI assistant. Use voice or text to discuss 
              film industry topics, get career advice, and explore creative ideas.
            </p>
          </div>

          {/* Features Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <Mic className="h-8 w-8 text-cinesphere-purple mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Voice Conversations</h3>
                <p className="text-sm text-gray-400">Real-time voice-to-voice AI chat with natural speech patterns</p>
              </CardContent>
            </Card>
            
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <Zap className="h-8 w-8 text-cinesphere-purple mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Instant Responses</h3>
                <p className="text-sm text-gray-400">Lightning-fast AI responses with industry-specific knowledge</p>
              </CardContent>
            </Card>
            
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 text-cinesphere-purple mx-auto mb-2" />
                <h3 className="font-semibold mb-1">Film Industry Expert</h3>
                <p className="text-sm text-gray-400">Specialized knowledge about cinema, networking, and career growth</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Chat Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Voice Chat Panel */}
            <div className="space-y-6">
              <VoiceChat 
                onMessageUpdate={(updatedMessages) => {
                  setMessages(updatedMessages);
                  setIsVoiceConnected(true);
                }}
              />
              
              {/* Tips Card */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">💡 Tips for Better Conversations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cinesphere-purple rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-300">Speak clearly and at a normal pace for best recognition</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cinesphere-purple rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-300">Ask about film industry trends, networking, or creative advice</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-cinesphere-purple rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-300">Use the mute button if you need a moment to think</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Text Chat Panel */}
            <div>
              <TextChat 
                messages={messages}
                onSendMessage={handleSendTextMessage}
                isConnected={isVoiceConnected}
              />
            </div>
          </div>

          {/* Sample Questions */}
          <div className="mt-12">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-xl text-center">Sample Questions to Get Started</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-cinesphere-purple">Career & Industry</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>"What are the current trends in independent filmmaking?"</li>
                      <li>"How can I break into the film industry as a cinematographer?"</li>
                      <li>"What networking events should I attend in LA?"</li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-cinesphere-purple">Creative & Technical</h4>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li>"What camera equipment is best for documentary work?"</li>
                      <li>"How do I develop a unique directorial style?"</li>
                      <li>"What are some effective storytelling techniques?"</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChatPage;
