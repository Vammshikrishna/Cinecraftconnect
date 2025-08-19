
import { Link, useLocation } from "react-router-dom";
import { Home, Play, Film, Briefcase, Users, BookOpen, Menu, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import UserProfileMenu from "./UserProfileMenu";

export function MobileNav() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { to: "/feed", icon: Home },
    { to: "/", icon: Play },
    { to: "/projects", icon: Film },
    { to: "/jobs", icon: Briefcase },
    { to: "/network", icon: Users }
  ];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around py-2 px-4">
          {navItems.map(({ to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 ${
                isActive(to) 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={20} className={isActive(to) ? 'text-primary' : ''} />
              {isActive(to) && (
                <div className="w-1 h-1 bg-primary rounded-full mt-1 animate-scale-in"></div>
              )}
            </Link>
          ))}
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="flex flex-col items-center justify-center py-2 px-3">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <Link 
                  to="/learn" 
                  className="flex items-center space-x-3 text-foreground hover:text-primary transition-colors py-2"
                  onClick={() => setIsOpen(false)}
                >
                  <BookOpen size={20} />
                  <span>Learn</span>
                </Link>
                <Link 
                  to="/profile" 
                  className="flex items-center space-x-3 text-foreground hover:text-primary transition-colors py-2"
                  onClick={() => setIsOpen(false)}
                >
                  <Users size={20} />
                  <span>Profile</span>
                </Link>
                <Link 
                  to="/settings" 
                  className="flex items-center space-x-3 text-foreground hover:text-primary transition-colors py-2"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings size={20} />
                  <span>Settings</span>
                </Link>
                <div className="pt-4 border-t border-border">
                  <UserProfileMenu />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}
