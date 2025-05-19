
import { Link } from 'react-router-dom';
import { 
  User, 
  Film, 
  Video, 
  Settings
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const UserProfileMenu = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="rounded-full h-8 w-8 p-0">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-cinesphere-purple text-white">
              GU
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
        <DropdownMenuLabel>
          Guest User
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem>
          <Link to="/profile" className="flex items-center w-full">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link to="/projects/my" className="flex items-center w-full">
            <Film className="mr-2 h-4 w-4" />
            <span>My Projects</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link to="/discussion-rooms" className="flex items-center w-full">
            <Video className="mr-2 h-4 w-4" />
            <span>Discussion Rooms</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem>
          <Link to="/settings" className="flex items-center w-full">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserProfileMenu;
