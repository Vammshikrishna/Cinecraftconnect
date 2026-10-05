import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EndorsementInfo {
  skill_id: number;
  endorsements: number;
  endorsed_by_me: boolean;
  sample_names: string[];
}

/** Endorsement counts per skill for one profile, and endorse / take back (connections only, enforced by the server). */
export const useSkillEndorsements = (userId: string) => {
  const { toast } = useToast();
  const [info, setInfo] = useState<Record<number, EndorsementInfo>>({});

  const load = useCallback(async () => {
    const { data } = await (supabase as any).rpc('skill_endorsement_summary', { p_user: userId });
    const map: Record<number, EndorsementInfo> = {};
    ((data || []) as EndorsementInfo[]).forEach(r => { map[Number(r.skill_id)] = r; });
    setInfo(map);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (skillId: number) => {
    const { error } = await (supabase as any).rpc('toggle_skill_endorsement', { p_skill_id: skillId });
    if (error) {
      toast({ title: 'Could not endorse', description: error.message, variant: 'destructive' });
      return;
    }
    load();
  };

  return { info, toggle };
};
