import React from 'react';
import { usePlatformFlags, PlatformFlagKey } from '@/hooks/usePlatformFlags';
import { Lock, ShieldAlert } from 'lucide-react';

interface FeatureGuardProps {
  flag: PlatformFlagKey;
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export const FeatureGuard = ({ 
  flag, 
  children, 
  fallbackTitle = "Feature Restricted", 
  fallbackDescription = "This platform module is currently disabled by administrators for scheduled maintenance or security review." 
}: FeatureGuardProps) => {
  const { isEnabled, loading } = usePlatformFlags();

  if (loading) return null;

  if (isEnabled(flag)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[70vh] bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
        <Lock className="w-10 h-10 text-amber-600" />
      </div>
      <h2 className="text-2xl font-black uppercase tracking-tight mb-2">{fallbackTitle}</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto mb-8">
        {fallbackDescription}
      </p>
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-xl border border-border/50">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin Protocol Enforcement Active</span>
      </div>
    </div>
  );
};
