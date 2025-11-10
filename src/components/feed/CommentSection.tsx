
import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeComments } from "@/hooks/useRealtimeComments";
import { Trash2 } from "lucide-react";
import { Comment } from "@/types";

const CommentSection = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  const fetchComments = useCallback(async () => {
    if (!postId) return;

    const { data, error } = await supabase
      .from("post_comments")
      .select(`id, content, created_at, user_id, profiles:profiles!inner(full_name, username, avatar_url)`)
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching comments", description: error.message, variant: "destructive" });
    } else {
      setComments(data as unknown as Comment[]);
    }
  }, [postId, toast]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useRealtimeComments({
    postId,
    onInsert: () => {
      fetchComments();
    },
    onDelete: (deletedCommentId) => {
      setComments((prevComments) => prevComments.filter((comment) => comment.id !== deletedCommentId));
    },
  });

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!user) {
      toast({ title: "Authentication required", description: "You need to be logged in to comment.", variant: "destructive" });
      return;
    }

    const tempId = crypto.randomUUID();
    const optimisticComment: Comment = {
      id: tempId,
      content: newComment.trim(),
      created_at: new Date().toISOString(),
      user_id: user.id,
      profiles: {
        full_name: user.user_metadata?.full_name || "You",
        username: user.user_metadata?.username || "",
        avatar_url: user.user_metadata?.avatar_url || null,
      },
    };

    setComments((prev) => [optimisticComment, ...prev]);
    const originalNewComment = newComment;
    setNewComment("");

    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: user.id,
      content: originalNewComment.trim(),
    });

    if (error) {
      toast({ title: "Failed to add comment", description: error.message, variant: "destructive" });
      setComments((prev) => prev.filter((c) => c.id !== tempId)); // Rollback
      setNewComment(originalNewComment);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const originalComments = [...comments];
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    const { error } = await supabase.from("post_comments").delete().eq("id", commentId);

    if (error) {
      toast({ title: "Failed to delete comment", description: error.message, variant: "destructive" });
      setComments(originalComments); // Rollback
    }
  };
  
  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="mt-4">
      {user && (
        <form onSubmit={handleAddComment} className="flex items-center space-x-3 mb-6">
          <Avatar className="h-9 w-9">
            {user.user_metadata?.avatar_url && <AvatarImage src={user.user_metadata.avatar_url} />}
            <AvatarFallback>{getInitials(user.user_metadata?.full_name || 'U')}</AvatarFallback>
          </Avatar>
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1"
          />
          <Button type="submit">Post</Button>
        </form>
      )}
      <div className="space-y-4">
        {comments.map((comment) => {
          const authorName = comment.profiles?.full_name || comment.profiles?.username || "Anonymous";
          return (
            <div key={comment.id} className="flex items-start space-x-3">
              <Avatar className="h-9 w-9">
                {comment.profiles?.avatar_url && <AvatarImage src={comment.profiles.avatar_url} />}
                <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                    <p className="font-semibold text-sm">{authorName}</p>
                    {user && user.id === comment.user_id && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteComment(comment.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <p className="text-sm">{comment.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommentSection;
