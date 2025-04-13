
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

const NotificationsDropdown = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-cinesphere-purple text-white text-xs flex items-center justify-center rounded-full">3</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="max-h-72 overflow-y-auto">
          <div className="p-3 hover:bg-white/5 cursor-pointer">
            <div className="flex">
              <Avatar className="h-8 w-8 mr-3">
                <AvatarFallback className="bg-cinesphere-purple/80">MC</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm"><span className="font-semibold">Maya Chen</span> commented on your post</p>
                <p className="text-xs text-gray-400">2 hours ago</p>
              </div>
            </div>
          </div>
          <div className="p-3 hover:bg-white/5 cursor-pointer">
            <div className="flex">
              <Avatar className="h-8 w-8 mr-3">
                <AvatarFallback className="bg-cinesphere-blue/80">JW</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm"><span className="font-semibold">James Wilson</span> liked your project</p>
                <p className="text-xs text-gray-400">5 hours ago</p>
              </div>
            </div>
          </div>
          <div className="p-3 hover:bg-white/5 cursor-pointer">
            <div className="flex">
              <Avatar className="h-8 w-8 mr-3">
                <AvatarFallback className="bg-gradient-to-br from-cinesphere-purple to-cinesphere-blue">CS</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm">New discussion room: <span className="font-semibold">Indie Film Financing</span></p>
                <p className="text-xs text-gray-400">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="p-2 text-center">
          <Button variant="link" className="text-cinesphere-purple text-sm">Mark all as read</Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;
