import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { motion } from 'framer-motion';
import AppLogo from '@/components/common/AppLogo';

const LandingNavbar = () => {
  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between glass-card p-2 px-6 rounded-2xl border-border/30">
        <AppLogo size="md" />

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 mr-6 border-r border-border pr-6">
            <Link to="/features" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link to="/about" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">About</Link>
            <Link to="/pricing" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="ghost" className="text-sm font-bold text-foreground hover:bg-muted rounded-xl px-6">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-primary text-white text-sm font-bold rounded-xl px-6 hover:scale-105 transition-all">
                Join Community
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default LandingNavbar;
