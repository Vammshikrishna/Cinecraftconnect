import { supabase } from "@/integrations/supabase/client";

export const togglePostLike = async (postId: string, isLiked: boolean): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User must be logged in to like a post.");
  }

  if (isLiked) {
    // Currently liked, so unlike it
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .match({ post_id: postId, user_id: user.id });

    if (error) {
      console.error("Error unliking post:", error);
      throw new Error(error.message);
    }

    return true; // Assume success if no error
  } else {
    // Currently not liked, so like it.
    // Use upsert to handle cases where the like already exists, making the operation idempotent.
    const { error } = await supabase
      .from("post_likes")
      .upsert({ post_id: postId, user_id: user.id }, { onConflict: "post_id, user_id" });

    if (error) {
      console.error("Error liking post:", error);
      throw new Error(error.message);
    }
    return true;
  }
};
