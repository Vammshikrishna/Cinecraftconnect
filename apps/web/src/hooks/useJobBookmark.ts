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

  // Real-time listener for local window events and cross-tab storage events
  useEffect(() => {
    if (!jobId) return;
    const handleBookmarkChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ jobId: string; isBookmarked: boolean }>;
      if (customEvent.detail?.jobId === jobId) {
        setIsBookmarked(customEvent.detail.isBookmarked);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cc_job_bookmark_sync' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.jobId === jobId && typeof parsed?.isBookmarked === 'boolean') {
            setIsBookmarked(parsed.isBookmarked);
          }
        } catch {}
      }
    };

    window.addEventListener('jobBookmarkChanged', handleBookmarkChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('jobBookmarkChanged', handleBookmarkChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [jobId]);

  // Supabase Realtime subscription for job_bookmarks
  useEffect(() => {
    if (!user || !jobId) return;

    const channel = supabase
      .channel(`job_bookmark_${jobId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_bookmarks',
        },
        async (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const { data } = await supabase
              .from('job_bookmarks' as any)
              .select('id')
              .eq('job_id', jobId)
              .eq('user_id', user.id)
              .maybeSingle();
            const isNowBookmarked = !!data;
            setIsBookmarked(isNowBookmarked);
            window.dispatchEvent(new CustomEvent('jobBookmarkChanged', {
              detail: { jobId, isBookmarked: isNowBookmarked }
            }));
          } else if (payload.eventType === 'INSERT') {
            if (payload.new?.job_id === jobId && payload.new?.user_id === user.id) {
              setIsBookmarked(true);
              window.dispatchEvent(new CustomEvent('jobBookmarkChanged', {
                detail: { jobId, isBookmarked: true }
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
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
    const nextState = !isBookmarked;
    setIsBookmarked(nextState); // Optimistic UI update

    // Broadcast event immediately across current window and other tabs
    window.dispatchEvent(new CustomEvent('jobBookmarkChanged', {
      detail: { jobId, isBookmarked: nextState }
    }));
    try {
      localStorage.setItem('cc_job_bookmark_sync', JSON.stringify({
        jobId,
        isBookmarked: nextState,
        ts: Date.now()
      }));
    } catch {}

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
        // Add bookmark with upsert
        const { error } = await supabase
          .from('job_bookmarks' as any)
          .upsert({ job_id: jobId, user_id: user.id }, { onConflict: 'user_id,job_id' });

        if (error) throw error;

        toast({
          title: "Job saved successfully",
          description: "You can find this in your saved jobs list.",
        });
      }
    } catch (error: any) {
      console.error('Error toggling job bookmark:', error);
      setIsBookmarked(previousState); // Revert on failure
      window.dispatchEvent(new CustomEvent('jobBookmarkChanged', {
        detail: { jobId, isBookmarked: previousState }
      }));
      try {
        localStorage.setItem('cc_job_bookmark_sync', JSON.stringify({
          jobId,
          isBookmarked: previousState,
          ts: Date.now()
        }));
      } catch {}
      toast({
        title: "Error",
        description: "Failed to update saved status. Please try again.",
        variant: "destructive"
      });
    }
  };

  return { isBookmarked, toggleBookmark, loading };
}
