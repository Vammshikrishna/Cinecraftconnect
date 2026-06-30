import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useJobBookmark(jobId: string | undefined) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !jobId) {
      setLoading(false);
      return;
    }

    const checkBookmarkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('job_bookmarks' as any)
          .select('id')
          .eq('job_id', jobId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setIsBookmarked(!!data);
      } catch (error) {
        console.error('Error checking job bookmark status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkBookmarkStatus();
  }, [jobId, user]);

  const toggleBookmark = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save jobs.",
        variant: "destructive"
      });
      return;
    }

    if (!jobId) return;

    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked); // Optimistic UI update

    try {
      if (previousState) {
        // Remove bookmark
        const { error } = await supabase
          .from('job_bookmarks' as any)
          .delete()
          .eq('job_id', jobId)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: "Removed from saved jobs",
          description: "This job has been removed from your saved list.",
        });
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('job_bookmarks' as any)
          .insert({ job_id: jobId, user_id: user.id });

        if (error) throw error;

        toast({
          title: "Job saved successfully",
          description: "You can find this in your saved jobs list.",
        });
      }
    } catch (error: any) {
      console.error('Error toggling job bookmark:', error);
      setIsBookmarked(previousState); // Revert on failure
      toast({
        title: "Error",
        description: "Failed to update saved status. Please try again.",
        variant: "destructive"
      });
    }
  };

  return { isBookmarked, toggleBookmark, loading };
}
