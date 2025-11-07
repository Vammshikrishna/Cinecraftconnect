import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';

// Import the new component files
import NavLinks from './navbar/NavLinks';
import NotificationsDropdown from './navbar/NotificationsDropdown';
import SearchDialog from './navbar/SearchDialog';
import UserProfileMenu from './navbar/UserProfileMenu';
import ChatMenu from './navbar/ChatMenu';
import { MobileNav } from "./navbar/MobileNav";
const Navbar = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    user
  } = useAuth();
  return <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm transition-theme overflow-x-hidden">
        <div className="w-full px-2 sm:px-4 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between py-2 sm:py-3 gap-2 sm:gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0 group min-w-0">
              <Film className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-primary mr-1 sm:mr-2 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-base sm:text-lg lg:text-2xl font-bold text-gradient whitespace-nowrap">
                <span className="hidden md:inline">CineCraft Connect</span>
                <span className="md:hidden">CCC</span>
              </span>
            </Link>

            {/* Desktop Navigation - Only show for authenticated users on large screens */}
            {user && (
              <div className="hidden lg:flex flex-1 mx-4 overflow-x-auto scrollbar-hide">
                <NavLinks />
              </div>
            )}

            {/* Right side content */}
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 flex-shrink-0">
              {user ? <>
                  {/* Authenticated user features */}
                  <div className="hidden lg:flex items-center gap-2">
                    <SearchDialog isOpen={searchOpen} onOpenChange={setSearchOpen} />
                    <NotificationsDropdown />
                    <ChatMenu />
                    <UserProfileMenu />
                  </div>
                  {/* Mobile: Show only search and profile */}
                  <div className="lg:hidden flex items-center gap-1">
                    <SearchDialog isOpen={searchOpen} onOpenChange={setSearchOpen} />
                    <NotificationsDropdown />
                    <ChatMenu />
                    <UserProfileMenu />
                  </div>
                </> : <>
                  {/* Unauthenticated user buttons */}
                  <div className="hidden sm:flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild className="px-3">
                      <Link to="/auth">Login</Link>
                    </Button>
                    <Button size="sm" asChild className="btn-primary px-3">
                      <Link to="/auth">Sign Up</Link>
                    </Button>
                  </div>
                  {/* Mobile auth button - single compact button */}
                  <div className="sm:hidden flex items-center gap-1">
                    <Button className="btn-primary text-xs px-2 py-1 h-8" size="sm" asChild>
                      <Link to="/auth">Login</Link>
                    </Button>
                  </div>
                </>}
            </div>
          </div>
        </div>
      </header>
      {/* Only show mobile nav for authenticated users */}
      {user && <MobileNav />}
    </>;
};
export default Navbar;