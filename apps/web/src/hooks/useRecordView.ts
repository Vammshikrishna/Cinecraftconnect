import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useRecordView = (targetId: string | undefined) => {
  const { user } = useAuth();
  const recorded = useRef(false);

  useEffect(() => {
    const recordView = async () => {
      // Don't record if targetId is missing, or if we already recorded in this session,
      // or if viewing own profile
      // (only signed-in views of other people's profiles are counted)
      if (!targetId || !user || recorded.current || user.id === targetId) return;

      // Mark as recorded IMMEDIATELY (synchronously) to prevent double firing in StrictMode
      recorded.current = true;

      try {
        const { error } = await (supabase as any).rpc('record_profile_view', { p_profile: targetId });

        if (error) {
          // If it failed, we can allow a retry on next render/change
          recorded.current = false;
          console.error('Failed to record view:', error);
        } else {
          console.log('Profile view recorded');
        }
      } catch (err) {
        recorded.current = false;
        console.error('View recording exception:', err);
      }
    };

    if (targetId) {
      recordView();
    }
  }, [targetId, user?.id]);
};
