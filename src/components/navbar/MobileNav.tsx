
import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-4 left-4 z-50 rounded-full bg-cinesphere-dark shadow-lg border border-white/10"
        onClick={toggleMenu}
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <nav className={`fixed inset-0 z-40 pointer-events-none ${isOpen ? 'visible' : 'invisible'}`}>
        <div 
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsOpen(false)}
        />
        
        <div className="fixed bottom-4 left-4 flex items-center justify-center">
          <div className={`relative transition-all duration-500 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
            {[
              { to: "/", label: "Home", angle: 0 },
              { to: "/feed", label: "Feed", angle: 60 },
              { to: "/projects", label: "Projects", angle: 120 },
              { to: "/jobs", label: "Jobs", angle: 180 },
              { to: "/network", label: "Network", angle: 240 },
              { to: "/learn", label: "Learn", angle: 300 }
            ].map(({ to, label, angle }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setIsOpen(false)}
                className="nav-item nav-item-inactive absolute pointer-events-auto"
                style={{
                  transform: `rotate(${angle}deg) translate(100px) rotate(-${angle}deg)`,
                  transition: 'transform 0.5s, opacity 0.3s',
                  opacity: isOpen ? 1 : 0
                }}
              >
                <div className="bg-cinesphere-dark px-4 py-2 rounded-full shadow-lg border border-white/10">
                  {label}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
