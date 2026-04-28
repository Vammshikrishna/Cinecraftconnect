import React from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Monitor, Smartphone, Tablet, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface DesktopOnlyGuardProps {
  children: React.ReactNode;
}

/**
 * DesktopOnlyGuard - Prevents rendering of internal tools on mobile/tablet devices.
 * Shows a premium "PC Only" screen if the viewport is less than 1024px.
 */
const DesktopOnlyGuard = ({ children }: DesktopOnlyGuardProps) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();

  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-card p-8 rounded-3xl border border-border shadow-2xl space-y-6"
        >
          <div className="flex justify-center items-center gap-4 py-4">
            <div className="relative">
              <Monitor className="w-16 h-16 text-primary animate-pulse" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
            </div>
            <div className="flex flex-col gap-2 opacity-40">
              <Tablet className="w-8 h-8" />
              <Smartphone className="w-6 h-6 ml-1" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Desktop View Required</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Internal governance tools and administrative dashboards are optimized for large screens to ensure data precision and operational safety.
            </p>
          </div>

          <div className="bg-muted/50 rounded-2xl p-4 border border-border/50 text-xs text-muted-foreground italic">
            "Platform governance requires a stable desktop environment for complex operations."
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              className="w-full rounded-xl h-11 font-bold gap-2" 
              onClick={() => navigate('/feed')}
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Feed
            </Button>
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50">
              CineCraft Connect Governance
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

export default DesktopOnlyGuard;
