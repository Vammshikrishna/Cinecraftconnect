import { motion } from 'framer-motion';
import { Ban, ShieldAlert, LifeBuoy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export const SuspendedPage = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Cinematic Red Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-red-500/10 blur-[150px] rounded-full opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-12 text-center border-red-500/20 bg-red-500/5 relative z-10"
      >
        <div className="w-24 h-24 bg-red-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-red-500/20 ring-4 ring-red-500/10">
          <Ban className="w-12 h-12 text-red-500" />
        </div>

        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-4 leading-none">
          Access Restricted
        </h1>
        
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-600 rounded-full mb-6">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Account Suspended</span>
        </div>

        <p className="text-muted-foreground text-sm font-medium mb-10 leading-relaxed">
          Your account has been suspended for violating CineCraft Connect community standards or terms of service. Access to all platform features has been permanently revoked.
        </p>

        <div className="space-y-4">
          <Button variant="outline" className="w-full h-12 rounded-xl font-bold gap-2 border-red-500/20 hover:bg-red-500/10 hover:text-red-600 transition-all">
            <LifeBuoy className="w-4 h-4" /> Appeal this decision
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => signOut()}
            className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>

        <div className="mt-12 pt-8 border-t border-red-500/10 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
          CineCraft Governance Engine • Ref: CC-ENF-B001
        </div>
      </motion.div>
    </div>
  );
};
