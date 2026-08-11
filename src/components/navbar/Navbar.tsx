import { Link, useLocation } from 'react-router-dom';
import { Search, Star } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountType } from '@/hooks/useAccountType';
import NavLinks from './NavLinks';
import NotificationsDropdown from './NotificationsDropdown';
import MoreMenu from './MoreMenu';
import UserProfileMenu from './UserProfileMenu';
import { MobileNav } from "./MobileNav";
import AppLogo from '@/components/common/AppLogo';
import { MessageSquare } from 'lucide-react';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useScrollDirection } from '@/hooks/useScrollDirection';

const Navbar = () => {
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const location = useLocation();
  const isSearchActive = location.pathname.startsWith('/search');
  const scrollDirection = useScrollDirection();
  const isScrollingDown = scrollDirection === 'down';

  const isChatPage = (location.pathname.startsWith('/messages/') && location.pathname !== '/messages') || 
                    location.pathname.startsWith('/dm/') || 
                    (location.pathname.startsWith('/chat/') && location.pathname !== '/chat') ||
                    (location.pathname.startsWith('/discussion-rooms/') && location.pathname !== '/discussion-rooms') ||
                    location.pathname.endsWith('/space');

  const shouldHideTopNavMobile = isScrollingDown || isChatPage;

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm transition-transform duration-300 overflow-x-hidden pt-[env(safe-area-inset-top)] ${shouldHideTopNavMobile ? '-translate-y-full lg:translate-y-0' : 'translate-y-0'}`}
      >
        <div className="w-full px-1.5 sm:px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between py-2 sm:py-3 gap-1 sm:gap-4">
            {/* Logo */}
            <AppLogo size="md" to="/" />

            {/* Right side content */}
            <div className="flex items-center gap-0 sm:gap-2 lg:gap-3 flex-shrink-0">
              {user ? (
                <>
                  {/* Group 2: Navigation (Links + More) */}
                  <div className="hidden lg:flex items-center gap-1 xl:gap-2">
                    <NavLinks />
                    {!isFan && <MoreMenu />}
                  </div>


                  {/* Group 1: Utility & Account (Search, Chat, Notifs, Profile) */}
                  <div className="flex items-center gap-0.5 sm:gap-2">
                    {/* Search - now part of the utility group on all devices */}
                    <Button 
                      variant={isSearchActive ? "default" : "ghost"} 
                      size="icon" 
                      asChild 
                      className={`h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 p-0 transition-all duration-300 ${isSearchActive ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "text-foreground/70 hover:text-primary hover:bg-primary/10"}`}
                    >
                      <Link to="/search">
                        <Search className={`h-4 w-4 sm:h-5 sm:w-5 ${isSearchActive ? "text-primary-foreground" : ""}`} />
                      </Link>
                    </Button>

                    <ChatLink />
                    <NotificationsDropdown />
                    <UserProfileMenu />
                  </div>
                </>
              ) : (
                <>
                  {/* Unauthenticated user buttons */}
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild className="px-3">
                      <Link to="/auth">Login</Link>
                    </Button>
                    <Button size="sm" asChild className="btn-primary px-3">
                      <Link to="/auth">Sign Up</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      {/* Mobile Nav Menu (for links) */}
      {user && <MobileNav />}
    </>
  );
};

const ChatLink = () => {
  const { unreadCount } = useUnreadMessages();
  const location = useLocation();
  const isMessagesActive = location.pathname.startsWith('/messages');

  return (
    <Button 
      variant={isMessagesActive ? "default" : "ghost"} 
      size="icon" 
      asChild 
      className={`h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 p-0 relative transition-all duration-300 ${isMessagesActive ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "text-foreground/70 hover:text-primary hover:bg-primary/10"}`}
    >
      <Link to="/messages">
        <MessageSquare className={`h-4 w-4 sm:h-5 sm:w-5 ${isMessagesActive ? "text-primary-foreground" : ""}`} />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-red-500 text-[9px] sm:text-[10px] font-bold text-white border-2 animate-in zoom-in ${isMessagesActive ? 'border-primary' : 'border-background'}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
};

export default Navbar;
