
import { Link } from 'react-router-dom';
import { 
  User, 
  Film, 
  Video, 
  Settings,
  LogOut,
  Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/contexts/AuthContext';

const UserProfileMenu = () => {
  const { user, profile, signOut, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 p-0">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }
  
  if (!user) {
    return (
      <Link to="/login">
        <Button size="sm" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
          Sign In
        </Button>
      </Link>
    );
  }
  
  // Get the user's initials for the avatar fallback
  const getInitials = () => {
    if (!profile?.full_name) return "U";
    
    return profile.full_name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="rounded-full h-8 w-8 p-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-cinesphere-purple text-white">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
        <DropdownMenuLabel>
          {profile?.full_name || user.email}
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
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onClick={() => signOut()}>
          <div className="flex items-center w-full text-red-400 hover:text-red-300 cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserProfileMenu;
