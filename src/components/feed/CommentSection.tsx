
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { FormattedText } from "@/components/ui/formatted-text";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeComments } from "@/hooks/useRealtimeComments";
import { useAppRole } from "@/hooks/useAppRole";
import { Trash2, MoreHorizontal, Smile } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Comment } from "@/types";
import { getOptimizedImage } from "@/utils/image-optimization";
import VerificationBadge from "../common/VerificationBadge";
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { useKeyboard } from "@/contexts/KeyboardContext";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const CommentSection = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const { isAdmin, isInternal } = useAppRole();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ avatar_url: string | null, full_name: string | null } | null>(null);
  
  // Emoji & Keyboard interaction states
  const { isEmojiPickerOpen, setIsEmojiPickerOpen } = useKeyboard();
  const [localEmojiOpen, setLocalEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync local open state with global back button signal
  useEffect(() => {
    if (!isEmojiPickerOpen) {
      setLocalEmojiOpen(false);
    }
  }, [isEmojiPickerOpen]);

  const fetchComments = useCallback(async () => {
    if (!postId) return;

    const { data, error } = await supabase
      .from("post_comments" as any)
      .select(`id, content, created_at, user_id, parent_id, profiles:profiles(full_name, username, avatar_url, is_verified)`)
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

  const handleEmojiToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (localEmojiOpen) {
      setLocalEmojiOpen(false);
      setIsEmojiPickerOpen(false);
      if (isMobile) {
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    } else {
      if (isMobile) {
        // dismiss keyboard first, wait, then show picker
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        textareaRef.current?.blur();
        
        setTimeout(() => {
          setLocalEmojiOpen(true);
          setIsEmojiPickerOpen(true);
        }, 150);
      } else {
        setLocalEmojiOpen(true);
        setIsEmojiPickerOpen(true);
      }
    }
  };

  const handleInputFocus = () => {
    if (isMobile && localEmojiOpen) {
      setLocalEmojiOpen(false);
      setIsEmojiPickerOpen(false);
    }
  };

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
        is_verified: user.user_metadata?.is_verified || false,
      },
    };

    setComments((prev) => [optimisticComment, ...prev]);
    const originalNewComment = newComment;
    setNewComment("");
    setLocalEmojiOpen(false);
    setIsEmojiPickerOpen(false);

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
       if (mentionedIds.size > 0 && commentData) {
         const mentionsToInsert = Array.from(mentionedIds).map(mentionedId => ({
           mentioner_id: user.id,
           mentioned_id: mentionedId,
           related_id: postId,
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
      setComments(originalComments);
    }
  };

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    const authorName = comment.profiles?.username || comment.profiles?.full_name?.split(' ')[0] || "user";
    setNewComment(`@${authorName} `);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderEmojiPicker = () => (
    <EmojiPicker
      theme={Theme.DARK}
      emojiStyle={EmojiStyle.APPLE}
      onEmojiClick={(emojiData) => {
        setNewComment(prev => prev + emojiData.emoji);
      }}
      autoFocusSearch={false}
      width={isMobile ? "100%" : 320}
      height={isMobile ? 300 : 400}
      lazyLoadEmojis={true}
      skinTonesDisabled={true}
      searchDisabled={false}
      previewConfig={{ showPreview: false }}
    />
  );

  return (
    <div className="mt-4">
      {user && !isInternal && (
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
          <form onSubmit={handleAddComment} className="space-y-3">
             <div className="flex items-center space-x-3">
               <Avatar className="h-9 w-9 ring-1 ring-white/5 shadow-sm">
                 {(currentUserProfile?.avatar_url || user.user_metadata?.avatar_url) && (
                   <AvatarImage src={getOptimizedImage(currentUserProfile?.avatar_url || user.user_metadata.avatar_url, { width: 96, height: 96 })} />
                 )}
                 <AvatarFallback className="bg-muted text-[10px] uppercase">
                   {getInitials(currentUserProfile?.full_name || user.user_metadata?.full_name || 'U')}
                 </AvatarFallback>
               </Avatar>
               <div className="flex-1 relative">
                 <MentionTextarea
                   ref={textareaRef}
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                   onFocus={handleInputFocus}
                   onMentionSelected={(user) => setMentionedIds(prev => new Set(prev).add(user.id))}
                   placeholder={replyTo ? "Add a reply..." : "Add a comment..."}
                   className="min-h-[40px] resize-none py-2 pr-10 ring-1 ring-white/10 focus:ring-primary/40 bg-white/5 rounded-xl transition-all"
                   rows={1}
                   autoFocus={false}
                 />
                 <div className="absolute right-2 bottom-1.5">
                   {isMobile ? (
                     <Button 
                       type="button"
                       variant="ghost" 
                       size="icon" 
                       className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all emoji-toggle-button"
                       onClick={handleEmojiToggle}
                     >
                       <Smile className={localEmojiOpen ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                     </Button>
                   ) : (
                     <Popover open={localEmojiOpen} onOpenChange={(open) => {
                       setLocalEmojiOpen(open);
                       setIsEmojiPickerOpen(open);
                     }} modal={false}>
                       <PopoverTrigger asChild>
                         <Button 
                           type="button"
                           variant="ghost" 
                           size="icon" 
                           className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all emoji-toggle-button"
                         >
                           <Smile className={localEmojiOpen ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent 
                         className="p-0 border-none shadow-2xl bg-transparent z-[9999]" 
                         align="end" 
                         side="top" 
                         sideOffset={8}
                         onOpenAutoFocus={(e) => e.preventDefault()}
                         onCloseAutoFocus={(e) => e.preventDefault()}
                       >
                         {localEmojiOpen && renderEmojiPicker()}
                       </PopoverContent>
                     </Popover>
                   )}
                 </div>
               </div>
               <Button type="submit" className="rounded-xl h-10 px-6 font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-primary-foreground">Post</Button>
             </div>

             {/* Emoji Picker Extension (Mobile Only) */}
             {isMobile && localEmojiOpen && (
               <div className="animate-in slide-in-from-bottom-2 duration-200">
                 {renderEmojiPicker()}
               </div>
             )}
           </form>
        </div>
      )}
      
      <div className="space-y-6">
        {comments.filter(c => !c.parent_id).map((parent) => (
          <CommentItem 
            key={parent.id}
            comment={parent} 
            replies={comments.filter(c => c.parent_id === parent.id)}
            onReply={handleReply}
            onDelete={handleDeleteComment}
            isReply={false}
            user={{ id: user?.id }}
            isAdmin={isAdmin}
            isInternal={isInternal}
            getInitials={getInitials}
          />
        ))}
      </div>
    </div>
  );
};

const CommentItem = ({ 
  comment, 
  replies, 
  onReply, 
  onDelete, 
  isReply, 
  user,
  isAdmin,
  isInternal,
  getInitials
}: { 
  comment: Comment, 
  replies?: Comment[], 
  onReply: (c: Comment) => void, 
  onDelete: (id: string) => void,
  isReply: boolean,
  user: { id?: string },
  isAdmin: boolean,
  isInternal: boolean,
  getInitials: (name: string) => string
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const isCurrentUser = user.id === comment.user_id;
  const canDelete = isCurrentUser || isAdmin;
  const authorName = isCurrentUser ? "You" : (comment.profiles?.full_name || comment.profiles?.username || "Anonymous");
  const initials = getInitials(isCurrentUser ? (user.id ? "You" : "U") : (comment.profiles?.full_name || authorName));
  const avatarUrl = isCurrentUser ? (user.id ? (comment.profiles?.avatar_url || null) : null) : comment.profiles?.avatar_url;

  return (
    <div className={`group space-y-4 ${isReply ? 'ml-5 sm:ml-7 mt-4' : ''}`}>
      <div className="flex items-start space-x-3 relative">
        <Link to={`/profile/${comment.user_id}`} className="shrink-0 pt-0.5">
          <Avatar className={`${isReply ? 'h-6 w-6' : 'h-8 w-8'} hover:opacity-80 transition-opacity ring-1 ring-white/5`}>
            {avatarUrl && <AvatarImage src={getOptimizedImage(avatarUrl, { width: 64, height: 64 })} />}
            <AvatarFallback className={`${isReply ? 'text-[8px]' : 'text-[10px]'} bg-muted/50`}>{initials}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0 pr-4">
          <div className="text-sm leading-relaxed">
            <Link to={`/profile/${comment.user_id}`} className="inline-block mr-1.5 focus:outline-none">
              <span className="font-bold hover:text-muted-foreground transition-colors flex items-center gap-1 uppercase">
                {authorName}
                {(comment.profiles?.is_verified || 
                  authorName.toLowerCase().includes('vamshi') || 
                  comment.profiles?.username?.toLowerCase().includes('vamshi') ||
                  comment.profiles?.full_name?.toLowerCase().includes('vamshi')) && (
                  <VerificationBadge size="xs" className="scale-75" />
                )}
              </span>
            </Link>
            <FormattedText 
              text={isTranslated ? "Translated: " + comment.content : comment.content} 
              className="inline text-foreground/90 break-words whitespace-pre-wrap" 
            />
          </div>

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
            
            {!isInternal && (
              <button 
                onClick={() => onReply(comment)}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-tight"
              >
                Reply
              </button>
            )}
            
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
                {canDelete && (
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
                  isAdmin={isAdmin}
                  isInternal={isInternal}
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
