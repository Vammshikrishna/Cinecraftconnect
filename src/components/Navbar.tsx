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
        <div className="container mx-auto bg-black rounded-none">
          <div className="flex items-center justify-between py-4 rounded-none bg-black">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <Film className="h-8 w-8 text-cinesphere-purple mr-2" />
              <span className="text-2xl font-bold text-gradient">Cine Craft Connect</span>
            </Link>

            {/* Desktop Navigation - Only show for authenticated users */}
            {user && <NavLinks />}

            {/* Right side content */}
            <div className="flex items-center space-x-4">
              {user ? <>
                  {/* Authenticated user features */}
                  <div className="hidden md:flex items-center space-x-4">
                    <SearchDialog isOpen={searchOpen} onOpenChange={setSearchOpen} />
                    <NotificationsDropdown />
                    <ChatMenu />
                    <UserProfileMenu />
                  </div>
                  {/* Mobile profile button for authenticated users */}
                  <div className="md:hidden">
                    <UserProfileMenu />
                  </div>
                </> : <>
                  {/* Unauthenticated user buttons */}
                  <div className="hidden md:flex items-center space-x-4">
                    <Button variant="ghost" asChild>
                      <Link to="/auth">Login</Link>
                    </Button>
                    <Button variant="default" asChild>
                      <Link to="/auth">Sign Up</Link>
                    </Button>
                  </div>
                  {/* Mobile auth buttons */}
                  <div className="md:hidden flex items-center space-x-2">
                    <Button variant="ghost" size="sm" asChild>
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