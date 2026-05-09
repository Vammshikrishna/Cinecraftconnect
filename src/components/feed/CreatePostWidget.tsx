import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { Card } from '@/components/ui/card';
import { PlusCircle, User, Building2, Loader2, Smile } from 'lucide-react';
import MediaUpload from '@/components/feed/MediaUpload';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { cacheManager } from '@/utils/caching';
import { performanceMonitor } from '@/utils/monitoring';
import { useMyPages } from '@/hooks/useCompanyPages';
import { useAppRole } from '@/hooks/useAppRole';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import { useKeyboard } from '@/contexts/KeyboardContext';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const postSchema = z.object({
    content: z.string().trim().optional(),
    tags: z.array(z.string().max(50)).max(10).optional()
});

interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

interface CreatePostWidgetProps {
    onPostCreated?: () => void;
    defaultExpanded?: boolean;
    defaultPageId?: string;
}

export function CreatePostWidget({ onPostCreated, defaultExpanded = false, defaultPageId = "user" }: CreatePostWidgetProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { data: myPages } = useMyPages();
    const { isInternal } = useAppRole();
    const [showCreatePost, setShowCreatePost] = useState(defaultExpanded);
    const [newPostContent, setNewPostContent] = useState("");
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
    const [selectedPageId, setSelectedPageId] = useState<string | "user">(defaultPageId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const queryClient = useQueryClient();
    
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

    useEffect(() => {
        if (defaultExpanded) {
            setShowCreatePost(true);
        }
    }, [defaultExpanded]);

    if (isInternal) return null;

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
                // Native-like interaction for mobile: dismiss keyboard first, wait, then show picker
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
        // Only auto-close on mobile when keyboard is coming up
        if (isMobile && localEmojiOpen) {
            setLocalEmojiOpen(false);
            setIsEmojiPickerOpen(false);
        }
    };

    const handleMediaUpload = (items: MediaItem[]) => {
        setMediaItems(items);
    };

    const createPost = async () => {
        if ((!newPostContent.trim() && mediaItems.length === 0) || isSubmitting) return;

        try {
            setIsSubmitting(true);
            const validation = postSchema.safeParse({
                content: newPostContent,
                tags: []
            });

            if (!validation.success) {
                toast({
                    title: "Validation error",
                    description: validation.error.issues[0].message,
                    variant: "destructive",
                });
                return;
            }

            if (!validation.data.content && mediaItems.length === 0) {
                toast({
                    title: "Empty post",
                    description: "Please add some text or attach media to create a post",
                    variant: "destructive",
                });
                return;
            }

            if (!user) {
                toast({
                    title: "Authentication required",
                    description: "Please log in to create posts",
                    variant: "destructive",
                });
                return;
            }

            const { data: postData, error } = await supabase
                .from('posts')
                .insert([
                    {
                        author_id: user.id,
                        page_id: selectedPageId === "user" ? null : selectedPageId,
                        content: validation.data.content || "",
                        media_url: mediaItems.length > 0 ? mediaItems[0].url : null,
                        media_type: mediaItems.length > 0 ? mediaItems[0].type : null,
                        media_items: mediaItems,
                        tags: validation.data.tags || [],
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            // Handle Mentions Persistence
            if (mentionedIds.size > 0 && postData) {
              const mentionsToInsert = Array.from(mentionedIds).map(mentionedId => ({
                mentioner_id: user.id,
                mentioned_id: mentionedId,
                related_id: postData.id,
                related_type: 'post'
              }));
              
              await supabase.from('mentions' as any).insert(mentionsToInsert as any);
            }

            setNewPostContent("");
            setMediaItems([]);
            setMentionedIds(new Set());
            setSelectedPageId("user");
            setShowCreatePost(false);
            setLocalEmojiOpen(false);
            setIsEmojiPickerOpen(false);

            // Invalidate cache
            cacheManager.invalidate('posts-feed');
            queryClient.invalidateQueries({ queryKey: ['home-feed-data'] });

            if (onPostCreated) {
                onPostCreated();
            }

            toast({
                title: "Success",
                description: "Post created successfully!",
            });

            performanceMonitor.logToAnalytics('post_created');
        } catch (error) {
            console.error('Error creating post:', error);
            toast({
                title: "Error",
                description: "Failed to create post",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderEmojiPicker = () => (
        <EmojiPicker
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.APPLE}
            onEmojiClick={(emojiData) => {
                setNewPostContent(prev => prev + emojiData.emoji);
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
        <Card className="glass-card p-2 mb-6" id="create-post-widget">
            {!showCreatePost ? (
                <Button
                    id="create-post-trigger"
                    onClick={() => setShowCreatePost(true)}
                    className="w-full justify-start text-left bg-transparent hover:bg-accent border-dashed border-2 border-border h-10 text-sm"
                    variant="outline"
                >
                    <PlusCircle className="mr-2 h-5 w-5 shrink-0" />
                    <span className="hidden sm:inline">Share your latest project or idea...</span>
                    <span className="inline sm:hidden">Create a post...</span>
                </Button>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground mr-1">Post as:</span>
                            <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                                <SelectTrigger className="w-[200px] h-9 glass-card-nav text-xs font-semibold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="glass-card">
                                    <SelectItem value="user">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={user?.user_metadata?.avatar_url} />
                                                <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                                            </Avatar>
                                            <span>Personal</span>
                                        </div>
                                    </SelectItem>
                                    {(myPages || []).map(page => (
                                        <SelectItem key={page.id} value={page.id}>
                                            <div className="flex items-center gap-2 text-primary">
                                                <Avatar className="h-5 w-5">
                                                    <AvatarImage src={page.logo_url || ""} />
                                                    <AvatarFallback><Building2 className="h-3 w-3" /></AvatarFallback>
                                                </Avatar>
                                                <span>{page.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="relative group/caption">
                        <MentionTextarea
                            ref={textareaRef}
                            placeholder="What's happening in your creative world?"
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            onFocus={handleInputFocus}
                            onMentionSelected={(user) => setMentionedIds(prev => new Set(prev).add(user.id))}
                            className="bg-input border-border text-foreground placeholder:text-muted-foreground min-h-[120px] pb-10"
                            autoFocus={false}
                        />
                        
                        {/* Emoji Toggle Button */}
                        <div className="absolute bottom-3 right-3 z-20">
                            {isMobile ? (
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all emoji-toggle-button"
                                    onClick={handleEmojiToggle}
                                >
                                    <Smile className={localEmojiOpen ? "h-5 w-5 text-primary" : "h-5 w-5"} />
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
                                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all emoji-toggle-button"
                                        >
                                            <Smile className={localEmojiOpen ? "h-5 w-5 text-primary" : "h-5 w-5"} />
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

                    {/* Mobile Emoji Picker Extension */}
                    {isMobile && localEmojiOpen && (
                        <div className="animate-in slide-in-from-bottom-2 duration-200">
                            {renderEmojiPicker()}
                        </div>
                    )}

                    <MediaUpload
                        onMediaUpload={handleMediaUpload}
                        disabled={false}
                    />

                    <div className="flex justify-end items-center space-x-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCreatePost(false);
                                setNewPostContent("");
                                setMediaItems([]);
                                setLocalEmojiOpen(false);
                                setIsEmojiPickerOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={createPost}
                            disabled={(!newPostContent.trim() && mediaItems.length === 0) || isSubmitting}
                            className="bg-gradient-to-r from-primary to-primary/80 px-8"
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isSubmitting ? "Posting..." : "Post"}
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
