import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { Card } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import MediaUpload from '@/components/feed/MediaUpload';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { cacheManager } from '@/utils/caching';
import { performanceMonitor } from '@/utils/monitoring';
import { useMyPages } from '@/hooks/useCompanyPages';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Building2, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

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
    const [showCreatePost, setShowCreatePost] = useState(defaultExpanded);
    const [newPostContent, setNewPostContent] = useState("");
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [mentionedIds, setMentionedIds] = useState<Set<string>>(new Set());
    const [selectedPageId, setSelectedPageId] = useState<string | "user">(defaultPageId);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (defaultExpanded) {
            setShowCreatePost(true);
        }
    }, [defaultExpanded]);

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

                    <MentionTextarea
                        placeholder="What's happening in your creative world?"
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        onMentionSelected={(user) => setMentionedIds(prev => new Set(prev).add(user.id))}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground min-h-[100px]"
                        autoFocus
                    />

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
