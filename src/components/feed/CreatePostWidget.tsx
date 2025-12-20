import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import MediaUpload from '@/components/feed/MediaUpload';
import { useAuth } from '@/contexts/AuthContext';
import { z } from 'zod';
import { cacheManager } from '@/utils/caching';
import { performanceMonitor } from '@/utils/monitoring';

const postSchema = z.object({
    content: z.string().trim().optional(),
    tags: z.array(z.string().max(50)).max(10).optional()
});

interface CreatePostWidgetProps {
    onPostCreated?: () => void;
    defaultExpanded?: boolean;
}

export function CreatePostWidget({ onPostCreated, defaultExpanded = false }: CreatePostWidgetProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [showCreatePost, setShowCreatePost] = useState(defaultExpanded);
    const [newPostContent, setNewPostContent] = useState("");
    const [postMediaUrl, setPostMediaUrl] = useState("");
    const [postMediaType, setPostMediaType] = useState<'image' | 'video' | null>(null);

    useEffect(() => {
        if (defaultExpanded) {
            setShowCreatePost(true);
        }
    }, [defaultExpanded]);

    const handleMediaUpload = (mediaUrl: string, mediaType: 'image' | 'video') => {
        setPostMediaUrl(mediaUrl);
        setPostMediaType(mediaType);
    };

    const createPost = async () => {
        try {
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

            if (!validation.data.content && !postMediaUrl) {
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

            const { error } = await supabase
                .from('posts')
                .insert([
                    {
                        author_id: user.id,
                        content: validation.data.content || "",
                        media_url: postMediaUrl || null,
                        media_type: postMediaType || null,
                        tags: validation.data.tags || [],
                    }
                ]);

            if (error) throw error;

            setNewPostContent("");
            setPostMediaUrl("");
            setPostMediaType(null);
            setShowCreatePost(false);

            // Invalidate cache
            cacheManager.invalidate('posts-feed');

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
        }
    };

    return (
        <Card className="glass-card p-6 mb-6" id="create-post-widget">
            {!showCreatePost ? (
                <Button
                    id="create-post-trigger"
                    onClick={() => setShowCreatePost(true)}
                    className="w-full justify-start text-left bg-transparent hover:bg-accent border-dashed border-2 border-border h-12"
                    variant="outline"
                >
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Share your latest project or idea...
                </Button>
            ) : (
                <div className="space-y-4">
                    <Textarea
                        placeholder="What's happening in your creative world?"
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground min-h-[100px]"
                        autoFocus
                    />

                    <MediaUpload
                        onMediaUpload={handleMediaUpload}
                        disabled={false}
                    />

                    <div className="flex justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                            {postMediaUrl && `${postMediaType} attached`}
                        </div>
                        <div className="flex space-x-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowCreatePost(false);
                                    setNewPostContent("");
                                    setPostMediaUrl("");
                                    setPostMediaType(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={createPost}
                                disabled={!newPostContent.trim() && !postMediaUrl}
                                className="bg-gradient-to-r from-primary to-primary/80"
                            >
                                Post
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
