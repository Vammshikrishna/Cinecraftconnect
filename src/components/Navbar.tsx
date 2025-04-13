
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Menu, X } from 'lucide-react';
import { Button } from "@/components/ui/button";

// Import the new component files
import NavLinks from './navbar/NavLinks';
import MobileMenu from './navbar/MobileMenu';
import NotificationsDropdown from './navbar/NotificationsDropdown';
import SearchDialog from './navbar/SearchDialog';
import UserProfileMenu from './navbar/UserProfileMenu';
import ChatMenu from './navbar/ChatMenu';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-cinesphere-dark/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Film className="h-8 w-8 text-cinesphere-purple mr-2" />
            <span className="text-2xl font-bold text-gradient">CineSphere</span>
          </Link>

          {/* Desktop Navigation */}
          <NavLinks />

          {/* Search, Notifications, Profile */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Search Dialog */}
            <SearchDialog 
              isOpen={searchOpen}
              onOpenChange={setSearchOpen}
            />
            
            {/* Notifications */}
            <NotificationsDropdown />
            
            {/* Discussion Room / Chats */}
            <ChatMenu />
            
            {/* User Profile */}
            <UserProfileMenu />
          </div>

          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleMobileMenu} 
            className="md:hidden text-gray-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <MobileMenu 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)}
        onSearchOpen={() => setSearchOpen(true)}
      />
    </header>
  );
};

export default Navbar;
