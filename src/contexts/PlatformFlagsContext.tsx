import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PlatformFlagKey = 
  | 'maintenance_mode'
  | 'global_lock'
  | 'marketplace_enabled'
  | 'job_posting_enabled'
  | 'discussion_rooms_enabled'
  | 'user_registration_enabled'
  | 'verification_requests_enabled'
  | 'post_creation_enabled'
  | 'messaging_enabled'
  | 'talent_network_enabled'
  | 'project_creation_enabled'
  | 'monetization_enabled';

interface PlatformFlagsContextType {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (key: PlatformFlagKey) => boolean;
  refresh: () => Promise<void>;
}

const PlatformFlagsContext = createContext<PlatformFlagsContextType | undefined>(undefined);

export const PlatformFlagsProvider = ({ children }: { children: React.ReactNode }) => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    const { data, error } = await (supabase as any)
      .from('platform_flags')
      .select('key, value');

    if (!error && data) {
      const flagMap = (data as any[]).reduce((acc, flag) => ({
        ...acc,
        [flag.key]: flag.value
      }), {});
      setFlags(flagMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFlags();

    // Subscribe to platform flag changes with high priority
    const channel = supabase
      .channel('global-platform-governance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_flags' },
        (payload) => {
          console.log('[Governance] Flag Update Received:', payload);
          fetchFlags();
        }
      )
      .subscribe((status) => {
        console.log('[Governance] Subscription Status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isEnabled = (key: PlatformFlagKey) => flags[key] !== false;

  return (
    <PlatformFlagsContext.Provider value={{ flags, loading, isEnabled, refresh: fetchFlags }}>
      {children}
    </PlatformFlagsContext.Provider>
  );
};

export const usePlatformFlags = () => {
  const context = useContext(PlatformFlagsContext);
  if (context === undefined) {
    throw new Error('usePlatformFlags must be used within a PlatformFlagsProvider');
  }
  return context;
};
