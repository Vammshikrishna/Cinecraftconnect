
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
import { Trash2, MoreHorizontal, Smile, ArrowUp, Heart, Pencil, Pin, EyeOff, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCommentMutation } from "@/hooks/mutations/useCommentMutation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Comment } from "@/types";
import { getOptimizedImage } from "@/utils/image-optimization";
import VerificationBadge from "../common/VerificationBadge";
import EmojiPicker, { Theme, EmojiStyle } from '@/components/common/LazyEmojiPicker';
import { useKeyboard } from "@/contexts/KeyboardContext";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ReportDialog from "@/components/common/ReportDialog";
import { friendlyError } from '@cinecraft/core';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

/** Longest comment allowed; the database enforces the same limit. */
const MAX_COMMENT_LENGTH = 2000;
/** Top-level comments shown at a time; "View more comments" adds this many again. */
const PAGE_SIZE = 20;
const COMMENT_FIELDS = `id, content, created_at, edited_at, user_id, parent_id, reply_to_user_id, is_pinned, is_hidden, like_count, profiles:user_id(full_name, username, avatar_url, is_verified), reply_to:reply_to_user_id(username, full_name)`;
// the older columns only, for a database that has not had part BG yet
const LEGACY_COMMENT_FIELDS = `id, content, created_at, user_id, parent_id, profiles:user_id(full_name, username, avatar_url, is_verified)`;

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
  const { addComment } = useCommentMutation();
  // people I blocked or muted: their comments are not shown, as in the feed
  const [hiddenAuthors, setHiddenAuthors] = useState<Set<string>>(new Set());
  const [postAuthorId, setPostAuthorId] = useState<string | null>(null);
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [topLimit, setTopLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

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

    const loadTop = (fields: string, legacy: boolean) => {
      let q = supabase.from("post_comments" as any).select(fields).eq("post_id", postId).is("parent_id", null);
      if (!legacy) q = q.order("is_pinned", { ascending: false });
      q = !legacy && sort === "top"
        ? q.order("like_count", { ascending: false }).order("created_at", { ascending: false })
        : q.order("created_at", { ascending: false });
      return q.limit(topLimit + 1);
    };

    let legacy = false;
    let top = await loadTop(COMMENT_FIELDS, false);
    if (top.error) {
      // part BG is not installed yet: fall back to the plain comment list
      legacy = true;
      top = await loadTop(LEGACY_COMMENT_FIELDS, true);
    }
    if (top.error) {
      toast({ title: "Error fetching comments", description: friendlyError(top.error), variant: "destructive" });
      return;
    }

    const topRows = ((top.data as any[]) || []);
    setHasMore(topRows.length > topLimit);
    const pageTop = topRows.slice(0, topLimit);
    const ids = pageTop.map((c) => c.id);

    let replies: any[] = [];
    if (ids.length > 0) {
      const res = await supabase
        .from("post_comments" as any)
        .select(legacy ? LEGACY_COMMENT_FIELDS : COMMENT_FIELDS)
        .in("parent_id", ids)
        .order("created_at", { ascending: true });
      replies = (res.data as any[]) || [];
    }
    const all = [...pageTop, ...replies];
    setComments(all as unknown as Comment[]);

    if (user?.id && all.length > 0 && !legacy) {
      const { data: mine } = await (supabase as any)
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in("comment_id", all.map((c) => c.id));
      setLikedIds(new Set((mine || []).map((l: any) => l.comment_id)));
    }
  }, [postId, toast, sort, topLimit, user?.id]);

  useEffect(() => {
    if (!user?.id || !postId) return;
    let alive = true;
    (async () => {
      const [blocked, muted, post] = await Promise.all([
        (supabase as any).from("blocked_users").select("blocked_user_id").eq("user_id", user.id),
        (supabase as any).from("muted_authors").select("author_id").eq("user_id", user.id),
        supabase.from("posts").select("author_id").eq("id", postId).maybeSingle(),
      ]);
      if (!alive) return;
      const ids = new Set<string>();
      (blocked.data || []).forEach((b: any) => b.blocked_user_id && ids.add(b.blocked_user_id));
      (muted.data || []).forEach((m: any) => m.author_id && ids.add(m.author_id));
      setHiddenAuthors(ids);
      setPostAuthorId((post.data as any)?.author_id ?? null);
    })();
    return () => { alive = false; };
  }, [user?.id, postId]);

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
    if (newComment.trim().length > MAX_COMMENT_LENGTH) {
      toast({ title: "Comment is too long", description: `Please keep it under ${MAX_COMMENT_LENGTH} characters.`, variant: "destructive" });
      return;
    }
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

    try {
      const mentions = mentionedIds.size > 0 ? Array.from(mentionedIds) : undefined;
      if (navigator.onLine) {
        const { error } = await supabase.from("post_comments" as any).insert({
          post_id: postId,
          user_id: user.id,
          content: originalNewComment.trim(),
          parent_id: replyTo?.id || null,
        });
        if (error) throw error;
        if (mentions) {
          await supabase.from("mentions" as any).insert(mentions.map((mentionedId) => ({
            mentioner_id: user.id,
            mentioned_id: mentionedId,
            related_id: postId,
            related_type: "post",
          })) as any);
        }
        fetchComments();
      } else {
        // offline: keep it and send it when the connection returns
        await addComment(postId, originalNewComment.trim(), { parentId: replyTo?.id, mentions });
      }
      setMentionedIds(new Set());
      setReplyTo(null);
    } catch (error: any) {
      toast({ title: "Failed to add comment", description: friendlyError(error), variant: "destructive" });
      setComments((prev) => prev.filter((c) => c.id !== tempId)); // Rollback
      setNewComment(originalNewComment);
    }
  };

  const handleToggleLike = async (commentId: string, liked: boolean) => {
    if (!user) return;
    setLikedIds((prev) => { const next = new Set(prev); liked ? next.delete(commentId) : next.add(commentId); return next; });
    setComments((prev) => prev.map((c: any) => c.id === commentId ? { ...c, like_count: Math.max(0, (c.like_count || 0) + (liked ? -1 : 1)) } : c));
    const { error } = liked
      ? await (supabase as any).from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id)
      : await (supabase as any).from("comment_likes").insert({ comment_id: commentId, user_id: user.id });
    if (error) {
      toast({ title: "Could not update your like", description: friendlyError(error), variant: "destructive" });
      fetchComments();
    }
  };

  const handleEditComment = async (commentId: string, text: string) => {
    const content = text.trim();
    if (!content) return false;
    if (content.length > MAX_COMMENT_LENGTH) {
      toast({ title: "Comment is too long", description: `Please keep it under ${MAX_COMMENT_LENGTH} characters.`, variant: "destructive" });
      return false;
    }
    const { error } = await supabase.from("post_comments" as any).update({ content }).eq("id", commentId);
    if (error) {
      toast({ title: "Could not save your change", description: friendlyError(error), variant: "destructive" });
      return false;
    }
    fetchComments();
    return true;
  };

  const handleModerateComment = async (commentId: string, changes: { is_pinned?: boolean; is_hidden?: boolean }, doneText: string) => {
    const { error } = await supabase.from("post_comments" as any).update(changes).eq("id", commentId);
    if (error) {
      toast({ title: "Could not do that", description: friendlyError(error), variant: "destructive" });
      return;
    }
    toast({ title: doneText });
    fetchComments();
  };

  // deleting asks first: a comment (and its replies) cannot be brought back
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const handleDeleteComment = async (commentId: string) => {
    const originalComments = [...comments];
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    try {
      const { error } = await supabase.from("post_comments" as any).delete().eq("id", commentId);
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Failed to delete comment", description: friendlyError(error), variant: "destructive" });
      setComments(originalComments);
    }
  };

  const visibleComments = comments.filter((c) => !hiddenAuthors.has(c.user_id));

  const handleReply = (comment: Comment) => {
    setReplyTo(comment);
    const authorName = comment.profiles?.username || comment.profiles?.full_name?.split(' ')[0] || "user";
    setNewComment(`@${authorName} `);
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        const len = textarea.value.length;
        textarea.setSelectionRange(len, len);
      }
    }, 100);
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
            <div className="flex items-center justify-between px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 transition duration-300">
               <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-tight">
                 Replying to <span className="text-primary">@{replyTo.profiles?.username || "user"}</span>
               </p>
               <button 
                 onClick={() => { setReplyTo(null); setNewComment(""); }}
                 className="text-[12px] font-bold text-primary hover:text-foreground transition-colors uppercase tracking-widest"
               >
                 Cancel
               </button>
            </div>
          )}
          <form onSubmit={handleAddComment} className="space-y-3">
             <div className="flex items-center space-x-3">
               <Avatar className="h-9 w-9 ring-1 ring-foreground/5 shadow-sm">
                 {(currentUserProfile?.avatar_url || user.user_metadata?.avatar_url) && (
                   <AvatarImage src={getOptimizedImage(currentUserProfile?.avatar_url || user.user_metadata.avatar_url, { width: 96, height: 96 })} />
                 )}
                 <AvatarFallback className="bg-muted text-[12px] uppercase">
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
                   className="min-h-[40px] resize-none py-2 pr-10 border border-border bg-muted/50 placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 rounded-xl transition"
                   rows={1}
                   autoFocus={false}
                 />
                 <div className="absolute right-2 bottom-1.5">
                   {isMobile ? (
                     <Button aria-label="Emoji" 
                       type="button"
                       variant="ghost" 
                       size="icon" 
                       className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition emoji-toggle-button"
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
                         <Button aria-label="Emoji" 
                           type="button"
                           variant="ghost" 
                           size="icon" 
                           className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition emoji-toggle-button"
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
               {newComment.trim().length > 0 ? (
                 <Button type="submit" size="icon" aria-label="Post comment" className="rounded-full h-10 w-10 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-md transition">
                   <ArrowUp className="h-5 w-5" />
                 </Button>
               ) : (
                 <Button type="submit" disabled className="rounded-xl h-10 px-6 font-bold uppercase tracking-wider text-xs bg-muted text-muted-foreground shrink-0">
                   Post
                 </Button>
               )}
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
      
      {(comments.length > 1 || hasMore || sort === "top") && (
        <div className="flex items-center justify-end gap-1 mb-4" role="group" aria-label="Sort comments">
          {([["newest", "Newest"], ["top", "Top"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => { setSort(value); setTopLimit(PAGE_SIZE); }}
              className={`text-[12px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border transition-colors ${sort === value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {visibleComments.filter(c => !c.parent_id).map((parent) => (
          <CommentItem 
            key={parent.id}
            comment={parent} 
            replies={visibleComments.filter(c => c.parent_id === parent.id)}
            onReply={handleReply}
            onDelete={(id: string) => setPendingDeleteId(id)}
            onReport={setReportCommentId}
            isPostAuthor={!!user?.id && user.id === postAuthorId}
            likedIds={likedIds}
            onLike={handleToggleLike}
            onEdit={handleEditComment}
            onModerate={handleModerateComment}
            parentAuthorId={parent.user_id}
            isReply={false}
            user={{ id: user?.id }}
            isAdmin={isAdmin}
            isInternal={isInternal}
            getInitials={getInitials}
          />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setTopLimit((n) => n + PAGE_SIZE)}
          className="mt-5 text-[12px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          View more comments
        </button>
      )}

      <ReportDialog
        open={!!reportCommentId}
        onOpenChange={(open) => { if (!open) setReportCommentId(null); }}
        targetId={reportCommentId || ""}
        targetType="comment"
      />
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(o) => { if (!o) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>It will be removed for everyone. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const id = pendingDeleteId; setPendingDeleteId(null); if (id) void handleDeleteComment(id); }}>Delete comment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CommentItem = ({ 
  comment, 
  replies, 
  onReply, 
  onDelete, 
  onReport,
  isPostAuthor,
  likedIds,
  onLike,
  onEdit,
  onModerate,
  parentAuthorId,
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
  onReport: (id: string) => void,
  isPostAuthor: boolean,
  likedIds: Set<string>,
  onLike: (id: string, liked: boolean) => void,
  onEdit: (id: string, text: string) => Promise<boolean>,
  onModerate: (id: string, changes: { is_pinned?: boolean; is_hidden?: boolean }, doneText: string) => void,
  parentAuthorId?: string,
  isReply: boolean,
  user: { id?: string },
  isAdmin: boolean,
  isInternal: boolean,
  getInitials: (name: string) => string
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const liked = likedIds.has(comment.id);
  const c: any = comment;
  const isCurrentUser = user.id === comment.user_id;
  const canDelete = isCurrentUser || isAdmin || isPostAuthor;
  const authorName = isCurrentUser ? "You" : (comment.profiles?.full_name || comment.profiles?.username || "Anonymous");
  const initials = getInitials(isCurrentUser ? (user.id ? "You" : "U") : (comment.profiles?.full_name || authorName));
  const avatarUrl = isCurrentUser ? (user.id ? (comment.profiles?.avatar_url || null) : null) : comment.profiles?.avatar_url;

  return (
    <div className={`group space-y-4 ${isReply ? 'ml-5 sm:ml-7 mt-4' : ''}`}>
      <div className="flex items-start space-x-3 relative">
        <Link to={`/profile/${comment.user_id}`} className="shrink-0 pt-0.5">
          <Avatar className={`${isReply ? 'h-6 w-6' : 'h-8 w-8'} hover:opacity-80 transition-opacity ring-1 ring-foreground/5`}>
            {avatarUrl && <AvatarImage src={getOptimizedImage(avatarUrl, { width: 64, height: 64 })} />}
            <AvatarFallback className={`${isReply ? 'text-[12px]' : 'text-[12px]'} bg-muted/50`}>{initials}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0 pr-4">
          <div className="text-sm leading-relaxed">
            <Link to={`/profile/${comment.user_id}`} className="inline-block mr-1.5 focus:outline-none">
              <span className="font-bold hover:text-muted-foreground transition-colors flex items-center gap-1 uppercase">
                {authorName}
                {comment.profiles?.is_verified && (
                  <VerificationBadge size="xs" className="scale-75" />
                )}
              </span>
            </Link>
            {c.is_pinned && (
              <span className="inline-flex items-center gap-1 mr-1.5 text-xs font-bold uppercase tracking-wider text-primary align-middle">
                <Pin className="h-3 w-3" /> Pinned
              </span>
            )}
            {c.is_hidden && (
              <span className="inline-flex items-center gap-1 mr-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground align-middle" title="Only you, the comment's author and the post's author can see this">
                <EyeOff className="h-3 w-3" /> Hidden
              </span>
            )}
            {isReply && c.reply_to?.username && c.reply_to_user_id !== parentAuthorId && !comment.content.trimStart().startsWith("@") && (
              <span className="mr-1 text-primary text-xs">@{c.reply_to.username}</span>
            )}
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={MAX_COMMENT_LENGTH}
                  rows={2}
                  autoFocus
                  className="w-full resize-none rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => { if (await onEdit(comment.id, draft)) setIsEditing(false); }}
                    className="text-[12px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary text-primary-foreground"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-[12px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <FormattedText
                  text={isTranslated ? "Translated: " + comment.content : comment.content}
                  className={`inline text-foreground/90 break-words whitespace-pre-wrap ${c.is_hidden ? "opacity-60" : ""}`}
                />
                {c.edited_at && <span className="ml-1.5 text-[12px] text-muted-foreground">(edited)</span>}
              </>
            )}
          </div>

          <div className="flex items-center gap-4 mt-1.5 overflow-hidden whitespace-nowrap">
            <span className="text-[12px] font-medium text-muted-foreground whitespace-nowrap">
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
                className="text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-tight"
              >
                Reply
              </button>
            )}
            
            <button
              type="button"
              onClick={() => onLike(comment.id, liked)}
              aria-pressed={liked}
              aria-label={liked ? "Unlike comment" : "Like comment"}
              className={`flex items-center gap-1 text-[12px] font-bold transition-colors ${liked ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Heart className="h-3.5 w-3.5" fill={liked ? "currentColor" : "none"} />
              {(c.like_count || 0) > 0 && <span>{c.like_count}</span>}
            </button>

            <button
              onClick={() => setIsTranslated(!isTranslated)}
              className="text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-tight whitespace-nowrap"
            >
              {isTranslated ? "See original" : "See translation"}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="More options" className="text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-0.5">
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-background/95 border-white/10 rounded-xl shadow-xl min-w-[120px]">
                {isCurrentUser && (
                  <DropdownMenuItem onClick={() => { setDraft(comment.content); setIsEditing(true); }} className="rounded-lg gap-2 cursor-pointer py-2.5">
                    <Pencil className="h-4 w-4" />
                    <span className="font-medium text-xs">Edit</span>
                  </DropdownMenuItem>
                )}
                {isPostAuthor && !isReply && (
                  <DropdownMenuItem onClick={() => onModerate(comment.id, { is_pinned: !c.is_pinned }, c.is_pinned ? "Comment unpinned" : "Comment pinned to the top")} className="rounded-lg gap-2 cursor-pointer py-2.5">
                    <Pin className="h-4 w-4" />
                    <span className="font-medium text-xs">{c.is_pinned ? "Unpin" : "Pin to top"}</span>
                  </DropdownMenuItem>
                )}
                {isPostAuthor && !isCurrentUser && (
                  <DropdownMenuItem onClick={() => onModerate(comment.id, { is_hidden: !c.is_hidden }, c.is_hidden ? "Comment is visible again" : "Comment hidden")} className="rounded-lg gap-2 cursor-pointer py-2.5">
                    {c.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    <span className="font-medium text-xs">{c.is_hidden ? "Show again" : "Hide"}</span>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(comment.id)}
                    className="rounded-lg gap-2 cursor-pointer focus:bg-red-500/10 text-red-500 focus:text-red-500 py-2.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="font-medium text-xs">Delete</span>
                  </DropdownMenuItem>
                )}
                {!isCurrentUser && (
                <DropdownMenuItem onClick={() => onReport(comment.id)} className="rounded-lg gap-2 cursor-pointer py-2.5">
                  <span className="font-medium text-xs text-muted-foreground">Report</span>
                </DropdownMenuItem>
                )}
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
              <span className="text-[12px] text-muted-foreground font-bold hover:text-foreground transition-colors uppercase tracking-widest whitespace-nowrap">
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
                <span className="text-[12px] text-muted-foreground font-bold hover:text-foreground transition-colors uppercase tracking-widest whitespace-nowrap">
                  Hide replies
                </span>
              </button>
              
              {replies.map(reply => (
                <CommentItem 
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  onDelete={onDelete}
                  onReport={onReport}
                  isPostAuthor={isPostAuthor}
                  likedIds={likedIds}
                  onLike={onLike}
                  onEdit={onEdit}
                  onModerate={onModerate}
                  parentAuthorId={comment.user_id}
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
