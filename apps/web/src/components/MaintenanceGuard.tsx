import React from 'react';
import { usePlatformFlags } from '@/hooks/usePlatformFlags';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, ShieldAlert, Hammer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaintenanceGuardProps {
  children: React.ReactNode;
}

export const MaintenanceGuard = ({ children }: MaintenanceGuardProps) => {
  const { isEnabled, loading } = usePlatformFlags();
  const { profile } = useAuth();

  // Staff (moderator, admin, super_admin) can bypass maintenance mode
  const isStaff = profile?.role && ['moderator', 'admin', 'super_admin'].includes(profile.role);

  if (loading) return null;

  if (!isEnabled('maintenance_mode') || isStaff) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-amber-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 animate-pulse">
        <Hammer className="w-12 h-12 text-amber-600" />
      </div>
      
      <div className="space-y-4 max-w-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full mb-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Maintenance Protocol Active</span>
        </div>
        
        <h1 className="text-4xl font-black uppercase tracking-tighter">CineCraft is Updating</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The platform is currently undergoing scheduled infrastructure upgrades. 
          Normal operations will resume shortly. We appreciate your patience as we build a better experience for creators.
        </p>
        
        <div className="pt-8 border-t border-border/50 mt-8">
          <div className="flex items-center justify-center gap-6 grayscale opacity-50">
            <ShieldAlert className="w-5 h-5" />
            <Lock className="w-5 h-5" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-4">
            Security Clearance Required for Entry
          </p>
          <Button 
            variant="link" 
            className="text-[10px] font-black uppercase tracking-widest text-primary mt-2"
            onClick={() => window.location.href = '/auth'}
          >
            Staff Login
          </Button>
        </div>
      </div>
    </div>
  );
};
