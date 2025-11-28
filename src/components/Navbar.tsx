import { Link, useLocation } from 'react-router-dom';
import { Film, Search } from 'lucide-react';
import { Button } from "./ui/button.tsx";
import { useAuth } from '../contexts/AuthContext.tsx';
import NavLinks from './navbar/NavLinks.tsx';
import NotificationsDropdown from './navbar/NotificationsDropdown.tsx';

import MoreMenu from './navbar/MoreMenu.tsx';
import UserProfileMenu from './navbar/UserProfileMenu.tsx';
import ChatMenu from './navbar/ChatMenu.tsx';
import { MobileNav } from "./navbar/MobileNav.tsx";

const Navbar = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Check if we are in an immersive route (Project Space, Discussion Room, Chat DM)
  const isImmersiveRoute =
    /^\/projects\/[^/]+\/space/.test(location.pathname) ||
    /^\/discussion-rooms\/[^/]+$/.test(location.pathname) ||
    /^\/messages\/[^/]+$/.test(location.pathname);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm transition-theme overflow-x-hidden ${isImmersiveRoute ? 'hidden lg:block' : ''}`}>
        <div className="w-full px-2 sm:px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between py-2 sm:py-3 gap-2 sm:gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0 group min-w-0">
              <Film className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-primary mr-1 sm:mr-2 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-gradient whitespace-nowrap">
                <span className="hidden xl:inline">CineCraft Connect</span>
                <span className="xl:hidden">CCC</span>
              </span>
            </Link>

            {/* Global Search (Left side) - Only for authenticated users */}
            {user && (
              <div className="hidden lg:flex items-center ml-4">
                <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-foreground">
                  <Link to="/search">
                    <Search className="h-5 w-5" />
                  </Link>
                </Button>
              </div>
            )}

            {/* Right side content */}
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
              {user ? (
                <>
                  {/* Desktop: Links and other icons */}
                  <div className="hidden lg:flex items-center gap-2 xl:gap-4">
                    <NavLinks />
                  </div>

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
                  <ChatMenu />
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

export default Navbar;
