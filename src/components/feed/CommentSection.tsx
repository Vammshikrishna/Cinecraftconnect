
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { FormattedText } from "@/components/ui/formatted-text";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeComments } from "@/hooks/useRealtimeComments";
import { Trash2, MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Comment } from "@/types";

const CommentSection = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ avatar_url: string | null, full_name: string | null } | null>(null);

  const fetchComments = useCallback(async () => {
    if (!postId) return;

    const { data, error } = await supabase
      .from("post_comments" as any)
      .select(`id, content, created_at, user_id, parent_id, profiles:profiles(full_name, username, avatar_url)`)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Error fetching comments", description: error.message, variant: "destructive" });
    } else {
      setComments(data as unknown as Comment[]);
    }
  }, [postId, toast]);

  useEffect(() => {
    fetchComments();
    
    // Fetch current user's full profile to get the avatar accurately
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", user.id)
        .single();
      if (data) setCurrentUserProfile(data);
    };
    fetchUserProfile();
  }, [fetchComments, user?.id]);

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
      parent_id: replyTo?.id || null,
      profiles: {
        full_name: user.user_metadata?.full_name || "You",
        username: user.user_metadata?.username || "",
        avatar_url: user.user_metadata?.avatar_url || null,
      },
    };

    setComments((prev) => [optimisticComment, ...prev]);
    const originalNewComment = newComment;
    setNewComment("");

      const { data: commentData, error } = await supabase.from("post_comments" as any).insert({
        post_id: postId,
        user_id: user.id,
        content: originalNewComment.trim(),
        parent_id: replyTo?.id || null,
      }).select().single();
 
     if (error) {
       toast({ title: "Failed to add comment", description: error.message, variant: "destructive" });
       setComments((prev) => prev.filter((c) => c.id !== tempId)); // Rollback
       setNewComment(originalNewComment);
     } else {
       // Handle Mentions Persistence for Comments
       if (mentionedIds.size > 0 && commentData) {
         const mentionsToInsert = Array.from(mentionedIds).map(mentionedId => ({
           mentioner_id: user.id,
           mentioned_id: mentionedId,
           related_id: postId, // Link to the post
           related_type: 'post'
         }));
         
         await supabase.from('mentions' as any).insert(mentionsToInsert as any);
        }
        setMentionedIds(new Set());
        setReplyTo(null);
      }
  };

  const handleDeleteComment = async (commentId: string) => {
    const originalComments = [...comments];
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    const { error } = await supabase.from("post_comments" as any).delete().eq("id", commentId);

    if (error) {
      toast({ title: "Failed to delete comment", description: error.message, variant: "destructive" });
      setComments(originalComments); // Rollback
    }
  };

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    const authorName = comment.profiles?.username || comment.profiles?.full_name?.split(' ')[0] || "user";
    setNewComment(`@${authorName} `);
    // Focus the textarea - would need a ref here in a full implementation
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="mt-4">
      {user && (
        <div className="mb-6 space-y-4">
          {replyTo && (
            <div className="flex items-center justify-between px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 transition-all duration-300">
               <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">
                 Replying to <span className="text-primary">@{replyTo.profiles?.username || "user"}</span>
               </p>
               <button 
                 onClick={() => { setReplyTo(null); setNewComment(""); }}
                 className="text-[10px] font-bold text-primary hover:text-foreground transition-colors uppercase tracking-widest"
               >
                 Cancel
               </button>
            </div>
          )}
          <form onSubmit={handleAddComment} className="flex items-center space-x-3">
             <Avatar className="h-9 w-9 ring-1 ring-white/5 shadow-sm">
               {(currentUserProfile?.avatar_url || user.user_metadata?.avatar_url) && (
                 <AvatarImage src={currentUserProfile?.avatar_url || user.user_metadata.avatar_url} />
               )}
               <AvatarFallback className="bg-muted text-[10px] uppercase">
                 {getInitials(currentUserProfile?.full_name || user.user_metadata?.full_name || 'U')}
               </AvatarFallback>
             </Avatar>
             <div className="flex-1">
               <MentionTextarea
                 value={newComment}
                 onChange={(e) => setNewComment(e.target.value)}
                 onMentionSelected={(user) => setMentionedIds(prev => new Set(prev).add(user.id))}
                 placeholder={replyTo ? "Add a reply..." : "Add a comment..."}
                 className="min-h-[40px] resize-none py-2 ring-1 ring-white/10 focus:ring-primary/40 bg-white/5 rounded-xl transition-all"
                 rows={1}
               />
             </div>
             <Button type="submit" className="rounded-xl h-10 px-6 font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-primary-foreground">Post</Button>
           </form>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Render only Parent Comments */}
        {comments.filter(c => !c.parent_id).map((parent) => (
          <CommentItem 
            key={parent.id}
            comment={parent} 
            replies={comments.filter(c => c.parent_id === parent.id)}
            onReply={handleReply}
            onDelete={handleDeleteComment}
            isReply={false}
            user={{ id: user?.id }}
            getInitials={getInitials}
          />
        ))}
      </div>
    </div>
  );
};

// Sub-component for individual comments and their threads
const CommentItem = ({ 
  comment, 
  replies, 
  onReply, 
  onDelete, 
  isReply, 
  user,
  getInitials
}: { 
  comment: Comment, 
  replies?: Comment[], 
  onReply: (c: Comment) => void, 
  onDelete: (id: string) => void,
  isReply: boolean,
  user: { id?: string },
  getInitials: (name: string) => string
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const isCurrentUser = user.id === comment.user_id;
  const authorName = isCurrentUser ? "You" : (comment.profiles?.username || comment.profiles?.full_name?.split(' ')[0] || "Anonymous");
  const initials = getInitials(isCurrentUser ? (user.id ? "You" : "U") : (comment.profiles?.full_name || authorName));
  const avatarUrl = isCurrentUser ? (user.id ? (comment.profiles?.avatar_url || null) : null) : comment.profiles?.avatar_url;

  return (
    <div className={`group space-y-4 ${isReply ? 'ml-5 sm:ml-7 mt-4' : ''}`}>
      <div className="flex items-start space-x-3 relative">
        <Link to={`/profile/${comment.user_id}`} className="shrink-0 pt-0.5">
          <Avatar className={`${isReply ? 'h-6 w-6' : 'h-8 w-8'} hover:opacity-80 transition-opacity ring-1 ring-white/5`}>
            {avatarUrl && <AvatarImage src={avatarUrl} />}
            <AvatarFallback className={`${isReply ? 'text-[8px]' : 'text-[10px]'} bg-muted/50`}>{initials}</AvatarFallback>
          </Avatar>
        </Link>

        {/* Content Column */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="text-sm leading-relaxed">
            <Link to={`/profile/${comment.user_id}`} className="inline-block mr-1.5 focus:outline-none">
              <span className="font-bold hover:text-muted-foreground transition-colors">
                {authorName}
              </span>
            </Link>
            <FormattedText 
              text={isTranslated ? "Translated: " + comment.content : comment.content} 
              className="inline text-foreground/90 break-words whitespace-pre-wrap" 
            />
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-4 mt-1.5 overflow-hidden whitespace-nowrap">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              {(() => {
                try {
                  const d = comment.created_at ? new Date(comment.created_at) : new Date();
                  if (isNaN(d.getTime())) return "now";
                  return formatDistanceToNow(d, { addSuffix: false })
                    .replace('about ', '')
                    .replace(' minutes', 'm')
                    .replace(' hours', 'h')
                    .replace(' days', 'd')
                    .replace(' months', 'mo')
                    .replace(' years', 'y')
                    .replace(' minute', 'm')
                    .replace(' hour', 'h')
                    .replace(' day', 'd');
                } catch {
                  return "now";
                }
              })()}
            </span>
            
            <button 
              onClick={() => onReply(comment)}
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-tight"
            >
              Reply
            </button>
            
            <button 
              onClick={() => setIsTranslated(!isTranslated)}
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-tight whitespace-nowrap"
            >
              {isTranslated ? "See original" : "See translation"}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5">
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-background/95 backdrop-blur-xl border-white/10 rounded-xl shadow-xl min-w-[120px]">
                {user.id === comment.user_id && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(comment.id)}
                    className="rounded-lg gap-2 cursor-pointer focus:bg-red-500/10 text-red-500 focus:text-red-500 py-2.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="font-medium text-xs">Delete</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="rounded-lg gap-2 cursor-pointer py-2.5">
                  <span className="font-medium text-xs text-muted-foreground">Report</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Show Replies Button */}
      {replies && replies.length > 0 && !isReply && (
        <div className="ml-5 sm:ml-7 mt-2">
          {!showReplies ? (
            <button 
              onClick={() => setShowReplies(true)}
              className="flex items-center gap-3 group/view shadow-none border-none p-0 bg-transparent"
            >
              <div className="w-6 border-t border-muted-foreground/30 group-hover/view:border-muted-foreground/60 transition-colors" />
              <span className="text-[11px] text-muted-foreground font-bold hover:text-foreground transition-colors uppercase tracking-widest whitespace-nowrap">
                View replies ({replies.length})
              </span>
            </button>
          ) : (
            <div className="space-y-4">
              <button 
                onClick={() => setShowReplies(false)}
                className="flex items-center gap-3 group/view shadow-none border-none p-0 bg-transparent mb-4"
              >
                <div className="w-6 border-t border-muted-foreground/30 group-hover/view:border-muted-foreground/60 transition-colors" />
                <span className="text-[11px] text-muted-foreground font-bold hover:text-foreground transition-colors uppercase tracking-widest whitespace-nowrap">
                  Hide replies
                </span>
              </button>
              
              {replies.map(reply => (
                <CommentItem 
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  onDelete={onDelete}
                  isReply={true}
                  user={user}
                  getInitials={getInitials}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
