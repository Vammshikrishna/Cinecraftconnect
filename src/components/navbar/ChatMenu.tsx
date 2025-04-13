
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ChatMenu = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <MessageCircle className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
        <DropdownMenuLabel>Quick Chat</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="max-h-60 overflow-y-auto">
          <div className="p-2 hover:bg-white/5 cursor-pointer">
            <div className="flex items-center">
              <Avatar className="h-8 w-8 mr-2">
                <AvatarFallback className="bg-cinesphere-purple/80">MC</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">Maya Chen</p>
                <p className="text-xs text-gray-400 truncate">Can you share those lighting refe...</p>
              </div>
            </div>
          </div>
          <div className="p-2 hover:bg-white/5 cursor-pointer">
            <div className="flex items-center">
              <Avatar className="h-8 w-8 mr-2">
                <AvatarFallback className="bg-cinesphere-blue/80">JW</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">James Wilson</p>
                <p className="text-xs text-gray-400 truncate">Let me know what you think of the new...</p>
              </div>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="p-2">
          <Link to="/chat">
            <Button variant="default" size="sm" className="w-full bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue">
              View All Messages
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChatMenu;
