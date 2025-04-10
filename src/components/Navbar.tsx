
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Search, Menu, X, Film, User, Briefcase, Play, Users, BookOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Function to check if a path is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
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
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/feed" className={`nav-item ${isActive('/feed') ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <Play size={18} />
              <span>Feed</span>
            </Link>
            <Link to="/projects" className={`nav-item ${isActive('/projects') ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <Film size={18} />
              <span>Projects</span>
            </Link>
            <Link to="/jobs" className={`nav-item ${isActive('/jobs') ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <Briefcase size={18} />
              <span>Jobs</span>
            </Link>
            <Link to="/network" className={`nav-item ${isActive('/network') ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <Users size={18} />
              <span>Network</span>
            </Link>
            <Link to="/learn" className={`nav-item ${isActive('/learn') ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <BookOpen size={18} />
              <span>Learn</span>
            </Link>
          </nav>

          {/* Search, Notifications, Profile */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
              <Bell className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full h-8 w-8 p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg" />
                    <AvatarFallback className="bg-cinesphere-purple text-white">CS</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-secondary/95 backdrop-blur-md border-white/10">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/profile" className="flex items-center w-full">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link to="/projects/my" className="flex items-center w-full">
                    <Film className="mr-2 h-4 w-4" />
                    <span>My Projects</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/login" className="flex items-center w-full">
                    Logout
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      {mobileMenuOpen && (
        <div className="md:hidden bg-cinesphere-dark border-t border-white/10">
          <div className="space-y-1 px-4 py-3">
            <Link 
              to="/feed" 
              className={`nav-item block ${isActive('/feed') ? 'nav-item-active' : 'nav-item-inactive'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="flex items-center">
                <Play size={18} className="mr-3" />
                <span>Feed</span>
              </div>
            </Link>
            <Link 
              to="/projects" 
              className={`nav-item block ${isActive('/projects') ? 'nav-item-active' : 'nav-item-inactive'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="flex items-center">
                <Film size={18} className="mr-3" />
                <span>Projects</span>
              </div>
            </Link>
            <Link 
              to="/jobs" 
              className={`nav-item block ${isActive('/jobs') ? 'nav-item-active' : 'nav-item-inactive'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="flex items-center">
                <Briefcase size={18} className="mr-3" />
                <span>Jobs</span>
              </div>
            </Link>
            <Link 
              to="/network" 
              className={`nav-item block ${isActive('/network') ? 'nav-item-active' : 'nav-item-inactive'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="flex items-center">
                <Users size={18} className="mr-3" />
                <span>Network</span>
              </div>
            </Link>
            <Link 
              to="/learn" 
              className={`nav-item block ${isActive('/learn') ? 'nav-item-active' : 'nav-item-inactive'}`}
              onClick={() => setMobileMenuOpen(false)}
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
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <User size={18} className="mr-3" />
                  <span>Profile</span>
                </div>
              </Link>
              <div className="nav-item nav-item-inactive block cursor-pointer">
                <div className="flex items-center">
                  <Search size={18} className="mr-3" />
                  <span>Search</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
