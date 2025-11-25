// Mobile navigation bar for mobile view
import { Link, useLocation } from "react-router-dom";
import { Home, Film, Briefcase, Users, Play, MessageSquare, MoreHorizontal, ShoppingBag, Building2, BookOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

export function MobileNav() {
  const location = useLocation();
  const { user } = useAuth();

  // Don't render mobile nav for unauthenticated users
  if (!user) {
    return null;
  }

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { to: "/feed", icon: Home },
    { to: "/projects", icon: Film },
    { to: "/discussion-rooms", icon: Play },
    { to: "/jobs", icon: Briefcase },
    { to: "/network", icon: Users },
    { to: "/chats", icon: MessageSquare },
  ];

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around py-2 px-4">
          {navItems.map(({ to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 ${isActive(to) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Icon size={20} className={isActive(to) ? "text-primary" : ""} />
              {isActive(to) && (
                <div className="w-1 h-1 bg-primary rounded-full mt-1 animate-scale-in" />
              )}
            </Link>
          ))}
          {/* More dropdown for additional items */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 ${location.pathname.startsWith("/learn") ||
                    location.pathname.startsWith("/marketplace") ||
                    location.pathname.startsWith("/vendors")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <MoreHorizontal size={20} />
                {(location.pathname.startsWith("/learn") ||
                  location.pathname.startsWith("/marketplace") ||
                  location.pathname.startsWith("/vendors")) && (
                    <div className="w-1 h-1 bg-primary rounded-full mt-1 animate-scale-in" />
                  )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
              <DropdownMenuItem asChild>
                <Link to="/learn" className="flex items-center gap-3 cursor-pointer">
                  <BookOpen size={18} />
                  <span>Learn</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/marketplace" className="flex items-center gap-3 cursor-pointer">
                  <ShoppingBag size={18} />
                  <span>Marketplace</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/vendors" className="flex items-center gap-3 cursor-pointer">
                  <Building2 size={18} />
                  <span>Vendors</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </>
  );
}
