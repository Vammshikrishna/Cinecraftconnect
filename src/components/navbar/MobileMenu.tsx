
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home,
  Play, 
  Film, 
  Briefcase, 
  Users, 
  BookOpen, 
  User, 
  Search, 
  Video,
  MessageCircle,
  Settings,
  LogOut
} from 'lucide-react';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchOpen: () => void;
}

const MobileMenu = ({ isOpen, onClose, onSearchOpen }: MobileMenuProps) => {
  const location = useLocation();

  // Function to check if a path is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  if (!isOpen) return null;

  return (
    <div className="md:hidden bg-cinesphere-dark border-t border-white/10">
      <div className="space-y-1 px-4 py-3">
        <Link 
          to="/" 
          className={`nav-item block ${isActive('/') ? 'nav-item-active' : 'nav-item-inactive'}`}
          onClick={onClose}
        >
          <div className="flex items-center">
            <Home size={18} className="mr-3" />
            <span>Home</span>
          </div>
        </Link>
        <Link 
          to="/feed" 
          className={`nav-item block ${isActive('/feed') ? 'nav-item-active' : 'nav-item-inactive'}`}
          onClick={onClose}
        >
          <div className="flex items-center">
            <Play size={18} className="mr-3" />
            <span>Feed</span>
          </div>
        </Link>
        <Link 
          to="/projects" 
          className={`nav-item block ${isActive('/projects') ? 'nav-item-active' : 'nav-item-inactive'}`}
          onClick={onClose}
        >
          <div className="flex items-center">
            <Film size={18} className="mr-3" />
            <span>Projects</span>
          </div>
        </Link>
        <Link 
          to="/jobs" 
          className={`nav-item block ${isActive('/jobs') ? 'nav-item-active' : 'nav-item-inactive'}`}
          onClick={onClose}
        >
          <div className="flex items-center">
            <Briefcase size={18} className="mr-3" />
            <span>Jobs</span>
          </div>
        </Link>
        <Link 
          to="/network" 
          className={`nav-item block ${isActive('/network') ? 'nav-item-active' : 'nav-item-inactive'}`}
          onClick={onClose}
        >
          <div className="flex items-center">
            <Users size={18} className="mr-3" />
            <span>Network</span>
          </div>
        </Link>
        <Link 
          to="/learn" 
          className={`nav-item block ${isActive('/learn') ? 'nav-item-active' : 'nav-item-inactive'}`}
          onClick={onClose}
        >
          <div className="flex items-center">
            <BookOpen size={18} className="mr-3" />
            <span>Learn</span>
          </div>
        </Link>
        
        <div className="pt-4 pb-3 border-t border-white/10">
          <Link 
            to="/profile" 
            className="nav-item nav-item-inactive block"
            onClick={onClose}
          >
            <div className="flex items-center">
              <User size={18} className="mr-3" />
              <span>Profile</span>
            </div>
          </Link>
          
          <div 
            className="nav-item nav-item-inactive block cursor-pointer"
            onClick={() => {
              onClose();
              onSearchOpen();
            }}
          >
            <div className="flex items-center">
              <Search size={18} className="mr-3" />
              <span>Search</span>
            </div>
          </div>
          
          <Link 
            to="/discussion-rooms" 
            className="nav-item nav-item-inactive block"
            onClick={onClose}
          >
            <div className="flex items-center">
              <Video size={18} className="mr-3" />
              <span>Discussion Rooms</span>
            </div>
          </Link>
          
          <Link 
            to="/chat" 
            className="nav-item nav-item-inactive block"
            onClick={onClose}
          >
            <div className="flex items-center">
              <MessageCircle size={18} className="mr-3" />
              <span>Chats</span>
            </div>
          </Link>
          
          <Link 
            to="/settings" 
            className="nav-item nav-item-inactive block"
            onClick={onClose}
          >
            <div className="flex items-center">
              <Settings size={18} className="mr-3" />
              <span>Settings</span>
            </div>
          </Link>
          
          <Link 
            to="/login" 
            className="nav-item block text-red-400"
            onClick={onClose}
          >
            <div className="flex items-center">
              <LogOut size={18} className="mr-3" />
              <span>Logout</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
