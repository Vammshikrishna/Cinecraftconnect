import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function usePostBookmarks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all bookmarked post IDs for the current user
  const bookmarkedPostIds = useQuery({
    queryKey: ["post_bookmarks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("post_bookmarks" as any)
        .select("post_id")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return (data as any[]).map((b) => b.post_id);
    },
    enabled: !!user,
  });

  // Toggle bookmark mutation
  const toggleBookmark = useMutation({
    mutationFn: async ({ postId, isBookmarked }: { postId: string; isBookmarked: boolean }) => {
      if (!user) throw new Error("Authentication required");

      if (isBookmarked) {
        // Delete bookmark
        const { error } = await supabase
          .from("post_bookmarks" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", postId);
        if (error) throw error;
      } else {
        // Insert bookmark
        const { error } = await supabase
          .from("post_bookmarks" as any)
          .insert({ user_id: user.id, post_id: postId });
        if (error) throw error;
      }
    },
    // the bookmark fills in (or empties) at once; it goes back if the save fails
    onMutate: async ({ postId, isBookmarked }: { postId: string; isBookmarked: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ["post_bookmarks", user?.id] });
      const previous = queryClient.getQueryData<string[]>(["post_bookmarks", user?.id]);
      if (previous) {
        queryClient.setQueryData(
          ["post_bookmarks", user?.id],
          isBookmarked ? previous.filter((id) => id !== postId) : [...previous, postId],
        );
      }
      return { previous };
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.isBookmarked ? "Removed from bookmarks" : "Saved to bookmarks",
        duration: 2000,
      });
    },
    onSettled: () => {
      // Invalidate both the IDs set AND potentially a list of bookmarked posts
      queryClient.invalidateQueries({ queryKey: ["post_bookmarks", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["bookmarked_posts", user?.id] });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(["post_bookmarks", user?.id], context.previous);
      console.error("Error toggling bookmark:", error);
      toast({
        title: "Error updating bookmarks",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Fetch the full details of bookmarked posts
  const bookmarkedPosts = useQuery({
    queryKey: ["bookmarked_posts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("post_bookmarks" as any)
        .select(`
          post_id,
          posts (
            id,
            content,
            media_urls,
            media_type,
            like_count,
            comment_count,
            share_count,
            created_at,
            author_id,
            author:profiles!posts_author_id_fkey (
              id,
              full_name,
              username,
              avatar_url,
              craft
            )
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any[]).map((b) => b.posts).filter(p => !!p);
    },
    enabled: !!user,
  });

  return {
    bookmarkedPostIds: Array.isArray(bookmarkedPostIds.data) ? bookmarkedPostIds.data : [],
    toggleBookmark,
    bookmarkedPosts,
    isInitialLoading: bookmarkedPostIds.isLoading,
  };
}
