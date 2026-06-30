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

const Navbar = () => {
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const location = useLocation();
  const isSearchActive = location.pathname.startsWith('/search');

  return (
    <>
      <header 
        className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm transition-theme overflow-x-hidden pt-[env(safe-area-inset-top)]"
      >
        <div className="w-full px-2 sm:px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between py-2 sm:py-3 gap-2 sm:gap-4">
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
                  <div className="flex items-center gap-1 sm:gap-2 ml-1">
                    {/* Search - now part of the utility group on all devices */}
                    <Button 
                      variant={isSearchActive ? "default" : "ghost"} 
                      size="icon" 
                      asChild 
                      className={`transition-all duration-300 ${isSearchActive ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "text-foreground/70 hover:text-primary hover:bg-primary/10"}`}
                    >
                      <Link to="/search">
                        <Search className={`h-5 w-5 ${isSearchActive ? "text-primary-foreground" : ""}`} />
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
      className={`relative transition-all duration-300 ${isMessagesActive ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "text-foreground/70 hover:text-primary hover:bg-primary/10"}`}
    >
      <Link to="/messages">
        <MessageSquare className={`h-5 w-5 ${isMessagesActive ? "text-primary-foreground" : ""}`} />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 animate-in zoom-in ${isMessagesActive ? 'border-primary' : 'border-background'}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
};

export default Navbar;
