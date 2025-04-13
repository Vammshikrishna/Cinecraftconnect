
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  Menu, 
  X, 
  Film, 
  User, 
  Briefcase, 
  Play, 
  Users, 
  BookOpen, 
  Settings,
  LogOut,
  MessageCircle,
  Video
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
            {/* Search Dialog */}
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <Search className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
                <DialogHeader>
                  <DialogTitle>Search CineSphere</DialogTitle>
                </DialogHeader>
                <div className="flex items-center space-x-2 py-4">
                  <Search className="h-5 w-5 text-gray-400" />
                  <Input 
                    placeholder="Search for projects, people, or crafts..." 
                    className="bg-white/5 border-white/10 focus:border-cinesphere-purple"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Recent searches</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/20">Cinematography</Badge>
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/20">Maya Chen</Badge>
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/20">Sci-fi projects</Badge>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-cinesphere-purple text-white text-xs flex items-center justify-center rounded-full">3</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <div className="max-h-72 overflow-y-auto">
                  <div className="p-3 hover:bg-white/5 cursor-pointer">
                    <div className="flex">
                      <Avatar className="h-8 w-8 mr-3">
                        <AvatarFallback className="bg-cinesphere-purple/80">MC</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm"><span className="font-semibold">Maya Chen</span> commented on your post</p>
                        <p className="text-xs text-gray-400">2 hours ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 hover:bg-white/5 cursor-pointer">
                    <div className="flex">
                      <Avatar className="h-8 w-8 mr-3">
                        <AvatarFallback className="bg-cinesphere-blue/80">JW</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm"><span className="font-semibold">James Wilson</span> liked your project</p>
                        <p className="text-xs text-gray-400">5 hours ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 hover:bg-white/5 cursor-pointer">
                    <div className="flex">
                      <Avatar className="h-8 w-8 mr-3">
                        <AvatarFallback className="bg-gradient-to-br from-cinesphere-purple to-cinesphere-blue">CS</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm">New discussion room: <span className="font-semibold">Indie Film Financing</span></p>
                        <p className="text-xs text-gray-400">1 day ago</p>
                      </div>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <div className="p-2 text-center">
                  <Button variant="link" className="text-cinesphere-purple text-sm">Mark all as read</Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Discussion Room / Chats */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <MessageCircle className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
                <DropdownMenuLabel>Quick Chat</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <div className="max-h-60 overflow-y-auto">
                  <div className="p-2 hover:bg-white/5 cursor-pointer">
                    <div className="flex items-center">
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarFallback className="bg-cinesphere-purple/80">MC</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Maya Chen</p>
                        <p className="text-xs text-gray-400 truncate">Can you share those lighting refe...</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 hover:bg-white/5 cursor-pointer">
                    <div className="flex items-center">
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarFallback className="bg-cinesphere-blue/80">JW</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">James Wilson</p>
                        <p className="text-xs text-gray-400 truncate">Let me know what you think of the new...</p>
                      </div>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <div className="p-2">
                  <Link to="/feed" onClick={() => console.log('Open chats tab')}>
                    <Button variant="default" size="sm" className="w-full bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue">
                      View All Messages
                    </Button>
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full h-8 w-8 p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg" />
                    <AvatarFallback className="bg-cinesphere-purple text-white">CS</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
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
                <DropdownMenuItem>
                  <Link to="/feed" className="flex items-center w-full" onClick={() => console.log('Navigate to discussion rooms')}>
                    <Video className="mr-2 h-4 w-4" />
                    <span>Discussion Rooms</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem>
                  <Link to="/settings" className="flex items-center w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem>
                  <Link to="/login" className="flex items-center w-full text-red-400 hover:text-red-300">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
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
              
              <div 
                className="nav-item nav-item-inactive block cursor-pointer"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSearchOpen(true);
                }}
              >
                <div className="flex items-center">
                  <Search size={18} className="mr-3" />
                  <span>Search</span>
                </div>
              </div>
              
              <Link 
                to="/feed" 
                className="nav-item nav-item-inactive block"
                onClick={() => {
                  setMobileMenuOpen(false);
                  console.log('Navigate to discussion tab');
                }}
              >
                <div className="flex items-center">
                  <Video size={18} className="mr-3" />
                  <span>Discussion Rooms</span>
                </div>
              </Link>
              
              <Link 
                to="/feed" 
                className="nav-item nav-item-inactive block"
                onClick={() => {
                  setMobileMenuOpen(false);
                  console.log('Navigate to chats tab');
                }}
              >
                <div className="flex items-center">
                  <MessageCircle size={18} className="mr-3" />
                  <span>Chats</span>
                </div>
              </Link>
              
              <Link 
                to="/settings" 
                className="nav-item nav-item-inactive block"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <Settings size={18} className="mr-3" />
                  <span>Settings</span>
                </div>
              </Link>
              
              <Link 
                to="/login" 
                className="nav-item block text-red-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <LogOut size={18} className="mr-3" />
                  <span>Logout</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
