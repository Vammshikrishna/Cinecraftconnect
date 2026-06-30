import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { motion, AnimatePresence } from 'framer-motion';
import AppLogo from '@/components/common/AppLogo';

const LandingNavbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navLinks = [
    { name: 'Features', href: '/features' },
    { name: 'About', href: '/about' },
  ];

  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 py-3 sm:py-4"
    >
      {!isOnline && (
        <div className="max-w-7xl mx-auto mb-2.5 text-center py-2 px-4 bg-amber-500/90 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl backdrop-blur-md shadow-md flex items-center justify-center gap-2 border border-amber-400/20">
          <WifiOff size={14} className="animate-pulse" />
          <span>Offline Mode active — browsing features is enabled, but login/registration is paused.</span>
        </div>
      )}
      <div className="max-w-7xl mx-auto flex items-center justify-between glass-card p-1 sm:p-1.5 px-3 sm:px-6 rounded-2xl border-border/30 backdrop-blur-xl bg-background/60">
        <AppLogo size="sm" />

        <div className="flex items-center gap-1.5 sm:gap-6">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 mr-6 border-r border-border pr-6">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                to={link.href} 
                className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <div className="scale-90 sm:scale-100">
              <ThemeToggle />
            </div>
            
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" className="text-xs font-bold text-foreground hover:bg-muted rounded-xl px-4">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-primary text-white text-xs font-bold rounded-xl px-4 hover:scale-105 transition-all h-9">
                  Join Community
                  <ArrowRight size={14} className="ml-2" />
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Toggle */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden h-8 w-8 rounded-lg hover:bg-muted"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X size={18} /> : <Menu size={18} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden mt-2 w-full"
          >
            <div className="glass-card p-4 flex flex-col gap-2 border-border/30 backdrop-blur-2xl bg-background/80 shadow-xl overflow-hidden">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  to={link.href} 
                  className="text-base font-bold text-foreground p-3 rounded-xl hover:bg-muted transition-colors flex items-center justify-between group"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                  <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </Link>
              ))}
              
              <div className="h-px bg-border/20 my-2 mx-2" />
              
              <div className="flex flex-col gap-2 pt-2">
                <Link to="/auth" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-base font-bold h-12 rounded-xl">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setIsOpen(false)}>
                  <Button className="w-full justify-between text-base font-bold h-12 rounded-xl bg-primary text-white px-6">
                    Join Community
                    <ArrowRight size={18} />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default LandingNavbar;
