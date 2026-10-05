import { useState } from 'react';
import { Shield, Crown, AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import AppLogo from '@/components/common/AppLogo';
import { motion } from 'framer-motion';

const SetupAdmin = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const claimAdmin = async () => {
    if (!user) {
      toast({ title: "Auth Required", description: "Please sign in first.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Call the emergency claim RPC
      const { error } = await (supabase as any).rpc('claim_admin_access');
      
      if (error) throw error;

      setSuccess(true);
      toast({ title: "👑 Role Granted", description: "You are now a Super Admin." });
    } catch (err: any) {
      toast({ 
        title: "Setup Failed", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-8 rounded-3xl border border-amber-500/20 bg-amber-500/5 text-center shadow-2xl"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
        </div>

        <AppLogo size="lg" className="mb-2 mx-auto justify-center" />
        <h1 className="text-2xl font-black text-foreground mb-2 uppercase tracking-tight">Platform Setup</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          This is an emergency setup page to claim the first **Super Admin** account. 
          Use this to unlock the governance layers.
        </p>

        {!success ? (
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-left">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-700 uppercase">Requirements</span>
              </div>
              <ul className="text-xs text-amber-800 space-y-1 opacity-80">
                <li>• You must be logged in</li>
                <li>• No other Super Admin must exist in the system</li>
              </ul>
            </div>

            <Button 
              onClick={claimAdmin}
              disabled={loading || !user}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-12 rounded-2xl shadow-xl shadow-amber-500/20 group"
            >
              {loading ? "Processing..." : (
                <>
                  <Crown className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                  Claim Root Authority
                  <ArrowRight className="w-4 h-4 ml-auto opacity-50" />
                </>
              )}
            </Button>
            
            {!user && (
              <p className="text-[10px] text-red-500 font-bold uppercase mt-2">
                You are currently logged out. Please sign in first.
              </p>
            )}
          </div>
        ) : (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto border border-green-500/20">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Access Granted!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You are now a Super Admin. Your privileges are active.
              </p>
            </div>
            <Button 
              className="w-full bg-primary text-white font-bold h-12 rounded-2xl"
              onClick={() => window.location.href = '/feed'}
            >
              Go to Platform
            </Button>
          </motion.div>
        )}
      </motion.div>

      <p className="mt-8 text-[10px] text-muted-foreground uppercase font-medium tracking-[0.2em]">
        Governance Layer v1.0 · Emergency Access
      </p>
    </div>
  );
};

export default SetupAdmin;
