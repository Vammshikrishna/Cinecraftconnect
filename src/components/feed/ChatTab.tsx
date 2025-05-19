
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ChatUser {
  initials: string;
  name: string;
  lastMessage: string;
  timeAgo: string;
  avatarColor: string;
}

const chatUsers: ChatUser[] = [
  {
    initials: "MC",
    name: "Maya Chen",
    lastMessage: "Can you share those lighting references?",
    timeAgo: "2h ago",
    avatarColor: "bg-gradient-to-br from-cinesphere-purple to-cinesphere-blue"
  },
  {
    initials: "JW",
    name: "James Wilson",
    lastMessage: "Let me know what you think of the new concept art!",
    timeAgo: "1d ago",
    avatarColor: "bg-gradient-to-br from-cinesphere-blue to-green-400"
  },
  {
    initials: "SP",
    name: "Sofia Patel",
    lastMessage: "The VFX test looks promising! I'll send you the final version soon.",
    timeAgo: "3d ago",
    avatarColor: "bg-gradient-to-br from-orange-400 to-red-500"
  }
];

const ChatTab = () => {
  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4 text-gradient">Messages</h2>
      <p className="mb-6 text-gray-300">Chat with other filmmakers, collaborators, and mentors.</p>
      
      <div className="space-y-3 mb-6">
        {chatUsers.map((user) => (
          <div key={user.name} className="flex items-center p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
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
      
      <Button className="w-full bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue hover:from-cinesphere-purple/90 hover:to-cinesphere-blue/90">
        New Message
      </Button>
    </div>
  );
};

export default ChatTab;
