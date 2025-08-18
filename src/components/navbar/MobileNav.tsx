
import { Link, useLocation } from "react-router-dom";
import { Home, Play, Film, Briefcase, Users, BookOpen } from "lucide-react";

export function MobileNav() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { to: "/", icon: Home },
    { to: "/feed", icon: Play },
    { to: "/projects", icon: Film },
    { to: "/jobs", icon: Briefcase },
    { to: "/network", icon: Users },
    { to: "/learn", icon: BookOpen }
  ];

  return (
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
            <Icon size={24} className={isActive(to) ? 'text-primary' : ''} />
            {isActive(to) && (
              <div className="w-1 h-1 bg-primary rounded-full mt-1 animate-scale-in"></div>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
