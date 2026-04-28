import { useState, useEffect } from 'react';
import { Shield, Crown, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppRole } from '@/hooks/useAppRole';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

/**
 * DevAdminBypass — A developer tool that only appears on localhost.
 * Allows instant promotion to Super Admin for testing governance layers.
 */
const DevAdminBypass = () => {
  const { user } = useAuth();
  const { isSuperAdmin, loading } = useAppRole();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  // Enhanced localhost detection
  const isLocalhost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.endsWith('.local');

  useEffect(() => {
    // Debug log to help identify why it might be hidden
    console.log('[DevAdminBypass] State:', { isLocalhost, hasUser: !!user, isSuperAdmin, loading });

    if (isLocalhost && !isSuperAdmin) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [user, isSuperAdmin, loading, isLocalhost]);

  const claimSuperAdmin = async () => {
    if (!user) return;

    try {
      // Use RPC to bypass RLS (Security Definer)
      const { error } = await (supabase as any).rpc('claim_admin_access');


      if (error) throw error;

      toast({
        title: "🛡️ Dev Access Granted",
        description: "You are now a Super Admin. Refreshing roles...",
      });

      // Force a small delay then reload to update hooks
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast({
        title: "Bypass Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="glass-card p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-2xl w-72 pointer-events-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black text-amber-600 uppercase tracking-widest">Dev Mode</span>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-amber-500/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-amber-500" />
              </button>
            </div>
            
            <p className="text-xs text-foreground/80 mb-4 leading-relaxed">
              {!user 
                ? "Please sign in to your account first, then you can claim Super Admin status for that account."
                : `No Super Admin role detected for @${user?.email?.split('@')[0]}. Claim access to test governance layers.`
              }
            </p>

            <Button 
              onClick={claimSuperAdmin}
              disabled={!user}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-9 rounded-xl shadow-lg shadow-amber-500/20 group disabled:opacity-50"
            >
              <Crown className="w-3 h-3 mr-2 group-hover:rotate-12 transition-transform" />
              {user ? "Become Super Admin" : "Sign In Required"}
              <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl pointer-events-auto transition-colors ${
          isExpanded ? 'bg-background border border-amber-500/30' : 'bg-amber-500'
        }`}
      >
        {isExpanded ? (
          <Shield className="w-6 h-6 text-amber-500" />
        ) : (
          <Crown className="w-6 h-6 text-white" />
        )}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-background rounded-full animate-pulse" />
      </motion.button>
    </div>
  );
};

export default DevAdminBypass;
