
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface ChatUser {
  id: string;
  name: string;
  initials: string;
  lastMessage: string;
  timeAgo: string;
  avatarColor: string;
}

const ChatTab = () => {
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const { toast } = useToast();

  // Mock data for demo
  useEffect(() => {
    const mockUsers: ChatUser[] = [
      {
        id: "1",
        initials: "MC",
        name: "Maya Chen",
        lastMessage: "Can you share those lighting references?",
        timeAgo: "2h ago",
        avatarColor: "bg-gradient-to-br from-primary to-primary/70"
      },
      {
        id: "2",
        initials: "JW",
        name: "James Wilson", 
        lastMessage: "Let me know what you think of the new concept art!",
        timeAgo: "1d ago",
        avatarColor: "bg-gradient-to-br from-primary/70 to-primary/50"
      }
    ];
    setChatUsers(mockUsers);
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to send messages",
          variant: "destructive",
        });
        return;
      }

      await supabase.from('direct_messages').insert([{
        sender_id: user.id,
        recipient_id: selectedUser.id,
        content: newMessage,
      }]);

      setNewMessage("");
      toast({ title: "Message sent!" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4 text-gradient">Messages</h2>
      <p className="mb-6 text-gray-300">Chat with other filmmakers, collaborators, and mentors.</p>
      
      <div className="space-y-3 mb-6">
        {chatUsers.map((user) => (
          <div 
            key={user.id} 
            className="flex items-center p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
            onClick={() => setSelectedUser(user)}
          >
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback className={user.avatarColor}>{user.initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex justify-between">
                <h4 className="font-medium">{user.name}</h4>
                <span className="text-xs text-gray-400">{user.timeAgo}</span>
              </div>
              <p className="text-sm text-gray-400 truncate">{user.lastMessage}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedUser && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg">
          <p className="text-sm text-gray-400 mb-2">Reply to {selectedUser.name}:</p>
          <div className="flex space-x-2">
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              className="bg-black/20 border-white/10 text-white"
            />
            <Button onClick={sendMessage} size="sm" className="bg-gradient-to-r from-primary to-primary/80">
              <Send size={16} />
            </Button>
          </div>
        </div>
      )}
      
      <Button className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
        New Message
      </Button>
    </div>
  );
};

export default ChatTab;
