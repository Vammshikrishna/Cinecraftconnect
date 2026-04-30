import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Footer from '@/components/Footer';

interface LegalPageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  lastUpdated: string;
}

const LegalPageLayout = ({ children, title, subtitle, icon, lastUpdated }: LegalPageLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden pt-20">
      {/* Cinematic ambient light orbs - matching Index.tsx style */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div
          className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full blur-[140px] transform-gpu"
          style={{ 
            background: 'radial-gradient(circle, hsl(161 100% 40% / 0.15), transparent 70%)',
            willChange: 'transform'
          }}
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, 10, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-[15%] -right-[5%] w-[50vw] h-[50vw] rounded-full blur-[160px] transform-gpu"
          style={{ 
            background: 'radial-gradient(circle, hsl(280 90% 70% / 0.10), transparent 70%)',
            willChange: 'transform'
          }}
          animate={{ scale: [1, 1.15, 1], x: [0, -20, 0], y: [0, -15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-16 pb-24 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-10 group hover:bg-primary/5"
          >
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back
          </Button>

          <header className="mb-16">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/5">
                {icon}
              </div>
              <div>
                <span className="text-primary font-bold tracking-[0.2em] uppercase text-xs">
                  Legal & Compliance
                </span>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight mt-1 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground/80 font-medium">
              <span className="w-8 h-[1px] bg-primary/30" />
              {subtitle}: {lastUpdated}
            </div>
          </header>

          <div className="space-y-12 max-w-none">
            {children}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default LegalPageLayout;
