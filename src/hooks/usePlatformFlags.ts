import { useState, useEffect } from 'react';
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

export interface PlatformFlag {
  id: string;
  key: PlatformFlagKey;
  value: boolean;
  description: string;
}

export const usePlatformFlags = () => {
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

    // Subscribe to platform flag changes
    const channel = supabase
      .channel('platform-flags')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_flags' },
        () => fetchFlags()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isEnabled = (key: PlatformFlagKey) => {
    if (key === 'maintenance_mode' || key === 'global_lock') {
      return flags[key] === true;
    }
    return flags[key] !== false;
  };

  return { flags, loading, isEnabled, fetchFlags };
};
