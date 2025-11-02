import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Menu, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';

// Import the new component files
import NavLinks from './navbar/NavLinks';
import MobileMenu from './navbar/MobileMenu';
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
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-white/10 bg-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-between py-3 sm:py-4">
            {/* Logo */}
            <Link to="/" className="flex items-center flex-shrink-0">
              <Film className="h-6 w-6 sm:h-8 sm:w-8 text-cinesphere-purple mr-2" />
              <span className="text-lg sm:text-2xl font-bold text-gradient whitespace-nowrap">
                <span className="hidden sm:inline">Cine Craft Connect</span>
                <span className="sm:hidden">CCC</span>
              </span>
            </Link>

            {/* Desktop Navigation - Only show for authenticated users on large screens */}
            {user && (
              <div className="hidden lg:flex flex-1 mx-8">
                <NavLinks />
              </div>
            )}

            {/* Right side content */}
            <div className="flex items-center gap-2 sm:gap-4">
              {user ? <>
                  {/* Authenticated user features */}
                  <div className="hidden lg:flex items-center gap-3">
                    <SearchDialog isOpen={searchOpen} onOpenChange={setSearchOpen} />
                    <NotificationsDropdown />
                    <ChatMenu />
                    <UserProfileMenu />
                  </div>
                  {/* Mobile: Show only search and profile */}
                  <div className="lg:hidden flex items-center gap-2">
                    <SearchDialog isOpen={searchOpen} onOpenChange={setSearchOpen} />
                    <UserProfileMenu />
                  </div>
                </> : <>
                  {/* Unauthenticated user buttons */}
                  <div className="hidden sm:flex items-center gap-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/auth">Login</Link>
                    </Button>
                    <Button variant="default" size="sm" asChild>
                      <Link to="/auth">Sign Up</Link>
                    </Button>
                  </div>
                  {/* Mobile auth button - single compact button */}
                  <div className="sm:hidden">
                    <Button variant="default" size="sm" asChild>
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