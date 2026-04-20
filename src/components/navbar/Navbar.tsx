import { Link } from 'react-router-dom';
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

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm transition-theme overflow-x-hidden`}>
        <div className="w-full px-2 sm:px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between py-2 sm:py-3 gap-2 sm:gap-4">
            {/* Logo */}
            <AppLogo size="md" to="/" />

            {/* Right side content */}
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
              {user ? (
                <>
                  {/* Desktop: Links and other icons */}
                  <div className="hidden lg:flex items-center gap-2 xl:gap-4">
                    <NavLinks />
                  </div>

                  {/* Fan badge — always visible when logged in as fan */}
                  {isFan && (
                    <Link to="/pricing" className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold shrink-0 hover:bg-primary/20 transition-all hover:scale-105 active:scale-95 shadow-sm">
                      <Star className="h-3.5 w-3.5 fill-primary" />
                      <span>Upgrade to Pro</span>
                    </Link>
                  )}

                  {/* Mobile: Show only search */}
                  <div className="lg:hidden flex items-center flex-1">
                    <div className="w-full px-2 flex justify-end">
                      <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                        <Link to="/search">
                          <Search className="h-5 w-5" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Icons for both mobile and desktop */}
                  <div className="hidden lg:block">
                    <MoreMenu />
                  </div>
                  <div className="hidden lg:block">
                    <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                      <Link to="/search">
                        <Search className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                  {!isFan && <ChatLink />}
                  <NotificationsDropdown />
                  <UserProfileMenu />
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
  
  return (
    <Button variant="ghost" size="icon" asChild className="relative text-muted-foreground hover:text-foreground">
      <Link to="/messages">
        <MessageSquare className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-background animate-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
};

export default Navbar;
