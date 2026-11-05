import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Which of these posts the signed-in person has already liked (so a PostCard opens with a filled heart and the next tap unlikes). */
export function useLikedPostIds(postIds: string[]): { ids: Set<string>; setLiked: (postId: string, liked: boolean) => void } {
  const { user } = useAuth();
  const key = [...postIds].sort().join(',');
  // taps made on this screen: the card reports them here, so the heart fills at once and the next tap unlikes
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const { data } = useQuery({
    queryKey: ['liked_post_ids', user?.id, key],
    enabled: !!user?.id && postIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('post_likes').select('post_id').eq('user_id', user!.id).in('post_id', postIds);
      if (error) throw error;
      return (data || []).map((r: any) => r.post_id as string);
    },
  });
  const ids = new Set(data || []);
  Object.entries(changes).forEach(([id, liked]) => { if (liked) ids.add(id); else ids.delete(id); });
  return { ids, setLiked: (postId, liked) => setChanges((c) => ({ ...c, [postId]: liked })) };
}
