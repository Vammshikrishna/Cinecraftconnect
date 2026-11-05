import { useState } from "react";
import { useT } from '@/hooks/useT';
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Film, Briefcase, Users, MoreHorizontal, ShoppingBag, BookOpen, Megaphone, Star, Lightbulb, ArrowLeftRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AccountSwitcherSheet } from "@/components/profile/AccountSwitcherSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from "@/hooks/useAccountType";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import DiscussionRoomIcon from "@/components/icons/DiscussionRoomIcon";
import VendorIcon from "@/components/icons/VendorIcon";
import StudioPageIcon from "@/components/icons/StudioPageIcon";
import { useKeyboard } from "@/contexts/KeyboardContext";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useAppNavigation } from "@/contexts/NavigationContext";

export function MobileNav() {
  const { t } = useT();
  const location = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { hasUnreadDiscussions, hasUnreadProjects } = useUnreadMessages();
  const { isKeyboardVisible, isEmojiPickerOpen } = useKeyboard();
  const scrollDirection = useScrollDirection();
  const { push, resetTo, lastTabPaths } = useAppNavigation();
  
  // Define chat-related paths where we hide the bottom navbar completely (active chats only)
  const isChatPage = (location.pathname.startsWith('/messages/') && location.pathname !== '/messages') || 
                    location.pathname.startsWith('/dm/') || 
                    (location.pathname.startsWith('/chat/') && location.pathname !== '/chat') ||
                    (location.pathname.startsWith('/discussion-rooms/') && location.pathname !== '/discussion-rooms') ||
                    location.pathname.endsWith('/space');

  const isScrollingDown = !isChatPage && scrollDirection === 'down';
  // the bar stays mounted while scrolling and slides away with a transform; it only unmounts when it must not exist at all
  const showNav = user && !isKeyboardVisible && !isEmojiPickerOpen && !isChatPage;

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleTabClick = (to: string) => {
    if (isActive(to)) {
      // If already on this tab, reset to root to clear stack
      resetTo(to);
    } else {
      // Restore last visited path in this tab or go to root
      const targetPath = lastTabPaths[to] || to;
      push(targetPath);
    }
  };

  const creatorNavItems = [
    { to: "/feed", icon: Home, label: 'Home', key: 'nav.home' },
    { to: "/projects", icon: Film, label: 'Projects', key: 'nav.projects' },
    { to: "/discussion-rooms", icon: DiscussionRoomIcon, label: 'Discussions', key: 'nav.discussions' },
    { to: "/jobs", icon: Briefcase, label: 'Jobs', key: 'nav.jobs' },
    { to: "/network", icon: Users, label: 'Network', key: 'nav.network' },
  ];

  const fanNavItems = [
    { to: "/feed", icon: Home, label: 'Home', key: 'nav.home' },
    { to: "/discussion-rooms", icon: DiscussionRoomIcon, label: 'Discussions', key: 'nav.discussions' },
    { to: "/ratings", icon: Star, label: 'Ratings', key: 'nav.ratings' },
    { to: "/announcements", icon: Megaphone, label: 'Announcements', key: 'nav.announcements' },
    { to: "/pages", icon: StudioPageIcon, label: 'Pages', key: 'nav.pages' },
  ];

  const navItems = isFan ? fanNavItems : creatorNavItems;

  const hasNotification = (label?: string) => {
    if (label === 'Discussions') return hasUnreadDiscussions;
    if (label === 'Projects') return hasUnreadProjects;
    return false;
  };

  // More-menu paths used for active-state detection
  const commonMorePaths = ["/ratings", "/announcements", "/marketplace", "/vendors", "/pages", "/messages", "/dm", "/pitch", "/contracts"];
  const allMorePaths = commonMorePaths;
  const isMoreActive = allMorePaths.some(p => location.pathname.startsWith(p));

  return (
    <>
    <AccountSwitcherSheet isOpen={switcherOpen} onOpenChange={setSwitcherOpen} />
      {showNav && (
        <nav
          aria-hidden={isScrollingDown || undefined}
          className={cn("lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-background/75 backdrop-blur-xl backdrop-saturate-150 border-t border-border/60 pb-[calc(env(safe-area-inset-bottom)+8px)] md:pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-200 ease-out-strong", isScrollingDown && "translate-y-full pointer-events-none")}
        >
          <div className="flex items-center justify-around py-1 md:py-2 px-2 md:px-4">
            {navItems.map(({ to, icon: Icon, label, key }) => (
              <button
                key={to}
                aria-label={t(key as any)}
                onClick={() => handleTabClick(to)}
                className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center py-1.5 md:py-2 px-2 md:px-3 rounded-lg transition-[color,transform] duration-150 active:scale-90 ${isActive(to) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <div className="relative">
                  <Icon className={cn("w-5 h-5 md:w-6 md:h-6", isActive(to) ? "text-primary" : "")} />
                  {hasNotification(label) && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2 md:h-2.5 md:w-2.5 items-center justify-center rounded-full bg-red-500 border-2 border-card" />
                  )}
                </div>
                {isActive(to) && (
                  <div className="w-1 h-1 bg-primary rounded-full mt-0.5 md:mt-1 animate-scale-in" />
                )}
              </button>
            ))}

            {/* More dropdown for additional items - Creators Only */}
            {!isFan && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="More"
                    className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center py-1.5 md:py-2 px-2 md:px-3 rounded-lg transition-[color,transform] duration-150 active:scale-90 ${isMoreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <MoreHorizontal className={cn("w-5 h-5 md:w-6 md:h-6", isMoreActive ? "text-primary" : "")} />
                    {isMoreActive && (
                      <div className="w-1 h-1 bg-primary rounded-full mt-0.5 md:mt-1 animate-scale-in" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
                  <DropdownMenuItem onClick={() => handleTabClick('/pitch')}>
                    <div className={cn("flex items-center gap-3 cursor-pointer w-full", isActive('/pitch') ? "text-primary" : "")}>
                      <Lightbulb size={18} />
                      <span>Pitch</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTabClick('/ratings')}>
                    <div className={cn("flex items-center gap-3 cursor-pointer w-full", isActive('/ratings') ? "text-primary" : "")}>
                      <Star size={18} />
                      <span>Ratings</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTabClick('/announcements')}>
                    <div className={cn("flex items-center gap-3 cursor-pointer w-full", isActive('/announcements') ? "text-primary" : "")}>
                      <Megaphone size={18} />
                      <span>Announcements</span>
                    </div>
                  </DropdownMenuItem>
  
                  <DropdownMenuItem onClick={() => handleTabClick('/marketplace')}>
                    <div className={cn("flex items-center gap-3 cursor-pointer w-full", isActive('/marketplace') ? "text-primary" : "")}>
                      <ShoppingBag size={18} />
                      <span>Marketplace</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTabClick('/pages')}>
                    <div className={cn("flex items-center gap-3 cursor-pointer w-full", isActive('/pages') ? "text-primary" : "")}>
                      <StudioPageIcon size={18} />
                      <span>Pages</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSwitcherOpen(true)}>
                    <div className="flex items-center gap-3 cursor-pointer w-full">
                      <ArrowLeftRight size={18} />
                      <span>Switch account</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
