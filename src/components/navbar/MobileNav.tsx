// Mobile navigation bar for mobile view
import { Link, useLocation } from "react-router-dom";
import { Home, Film, Briefcase, Users, MoreHorizontal, ShoppingBag, BookOpen, Megaphone, Star, Lightbulb } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from "@/hooks/useAccountType";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import DiscussionRoomIcon from "@/components/icons/DiscussionRoomIcon";
import VendorIcon from "@/components/icons/VendorIcon";
import StudioPageIcon from "@/components/icons/StudioPageIcon";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { hasUnreadDiscussions, hasUnreadProjects } = useUnreadMessages();
  const isKeyboardVisible = useKeyboardVisible();

  // Don't render mobile nav for unauthenticated users or when keyboard is open
  if (!user || isKeyboardVisible) {
    return null;
  }

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const creatorNavItems = [
    { to: "/feed", icon: Home, label: 'Home' },
    { to: "/projects", icon: Film, label: 'Projects' },
    { to: "/discussion-rooms", icon: DiscussionRoomIcon, label: 'Discussions' },
    { to: "/jobs", icon: Briefcase, label: 'Jobs' },
    { to: "/network", icon: Users, label: 'Network' },
  ];

  const fanNavItems = [
    { to: "/feed", icon: Home, label: 'Home' },
    { to: "/discussion-rooms", icon: DiscussionRoomIcon, label: 'Discussions' },
    { to: "/ratings", icon: Star, label: 'Ratings' },
    { to: "/announcements", icon: Megaphone, label: 'Announcements' },
    { to: "/pages", icon: StudioPageIcon, label: 'Pages' },
  ];

  const navItems = isFan ? fanNavItems : creatorNavItems;

  const hasNotification = (label?: string) => {
    if (label === 'Discussions') return hasUnreadDiscussions;
    if (label === 'Projects') return hasUnreadProjects;
    return false;
  };

  // More-menu paths used for active-state detection
  const commonMorePaths = ["/ratings", "/announcements", "/learn", "/marketplace", "/vendors", "/pages", "/messages", "/dm", "/pitch"];
  const allMorePaths = commonMorePaths;
  const isMoreActive = allMorePaths.some(p => location.pathname.startsWith(p));

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-card/95 backdrop-blur-xl border-t border-border pb-[calc(env(safe-area-inset-bottom)+8px)] md:pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-around py-1 md:py-2 px-2 md:px-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center py-1.5 md:py-2 px-2 md:px-3 rounded-lg transition-all duration-200 ${isActive(to) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <div className="relative">
                <Icon className={cn("w-5 h-5 md:w-6 md:h-6", isActive(to) ? "text-primary" : "")} />
                {hasNotification(label) && (
                   <span className="absolute -top-1 -right-1 flex h-2 w-2 md:h-2.5 md:w-2.5 items-center justify-center rounded-full bg-red-500 border-2 border-card animate-pulse" />
                )}
              </div>
              {isActive(to) && (
                <div className="w-1 h-1 bg-primary rounded-full mt-0.5 md:mt-1 animate-scale-in" />
              )}
            </Link>
          ))}

          {/* More dropdown for additional items */}
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex flex-col items-center justify-center py-1.5 md:py-2 px-2 md:px-3 rounded-lg transition-all duration-200 ${isMoreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <MoreHorizontal className="w-5 h-5 md:w-6 md:h-6" />
                  {isMoreActive && (
                    <div className="w-1 h-1 bg-primary rounded-full mt-0.5 md:mt-1 animate-scale-in" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-48 mb-2">

                <DropdownMenuItem asChild>
                  <Link to="/pitch" className="flex items-center gap-3 cursor-pointer">
                    <Lightbulb size={18} />
                    <span>Pitch</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ratings" className="flex items-center gap-3 cursor-pointer">
                    <Star size={18} />
                    <span>Ratings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/announcements" className="flex items-center gap-3 cursor-pointer">
                    <Megaphone size={18} />
                    <span>Announcements</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/learn" className="flex items-center gap-3 cursor-pointer">
                    <BookOpen size={18} />
                    <span>Learn</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/marketplace" className="flex items-center gap-3 cursor-pointer">
                    <ShoppingBag size={18} />
                    <span>Marketplace</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/vendors" className="flex items-center gap-3 cursor-pointer">
                    <VendorIcon size={18} />
                    <span>Vendors</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/pages" className="flex items-center gap-3 cursor-pointer">
                    <StudioPageIcon size={18} />
                    <span>Pages</span>
                  </Link>
                </DropdownMenuItem>

                {/* Analytics */}

              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </nav>
    </>
  );
}
