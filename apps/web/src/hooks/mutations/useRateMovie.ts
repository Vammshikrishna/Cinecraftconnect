import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MovieRating {
  user_id: string;
  movie_title: string;
  rating: number;
}

export const useRateMovie = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, rating }: { title: string; rating: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Login Required");
      }

      const ratingData: MovieRating = {
        user_id: user.id,
        movie_title: title,
        rating
      };

      const { error } = await supabase
        .from('movie_ratings' as any)
        .upsert(ratingData, { 
          onConflict: 'user_id,movie_title'
        });

      if (error) throw error;
      return { title, rating };
    },
    onSuccess: (data) => {
      toast({
        title: "Rating Submitted",
        description: `You rated "${data.title}" ${data.rating} stars.`
      });
      // Optionally invalidate queries if there are any related to movie ratings
      // queryClient.invalidateQueries({ queryKey: ['movie_ratings', data.title] });
    },
    onError: (error: Error) => {
      if (error.message === "Login Required") {
        toast({
          title: "Login Required",
          description: "Please log in to rate this movie.",
          variant: "destructive"
        });
      } else {
        console.error('Error submitting rating:', error);
        toast({
          title: "Error",
          description: "Could not submit rating. Please try again.",
          variant: "destructive"
        });
      }
    }
  });
};
