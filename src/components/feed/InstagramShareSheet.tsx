import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link as LinkIcon, Share2, Film, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/use-media-query";

interface InstagramShareSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    postId: string;
}

interface ShareTarget {
    id: string;
    name: string;
    avatar_url: string | null;
    type: 'user' | 'project' | 'room';
    subtitle?: string;
}

export function InstagramShareSheet({ isOpen, onOpenChange, postId }: InstagramShareSheetProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [targets, setTargets] = useState<ShareTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<Set<string>>(new Set());
    const { user } = useAuth();
    const { toast } = useToast();
    const isDesktop = useMediaQuery("(min-width: 768px)");

    useEffect(() => {
        if (isOpen && user) {
            fetchTargets();
        }
    }, [isOpen, user]);

    const fetchTargets = async () => {
        if (!user) return;
        setLoading(true);

        const newTargets: ShareTarget[] = [];

        try {
            // 1. Fetch Connections (Profiles)
            try {
                const { data: profiles, error: profilesError } = await supabase
                    .rpc('get_user_conversations_with_profiles' as any, { p_user_id: user.id });

                if (profilesError) throw profilesError;

                if (profiles) {
                    const uniqueProfiles = new Set();
                    profiles.forEach((p: any) => {
                        if (!uniqueProfiles.has(p.other_user_id)) {
                            uniqueProfiles.add(p.other_user_id);
                            newTargets.push({
                                id: p.other_user_id,
                                name: p.other_user_full_name || 'Unknown',
                                avatar_url: p.other_user_avatar_url,
                                type: 'user',
                                subtitle: 'Connection'
                            });
                        }
                    });
                }
            } catch (e) {
                console.error("Error fetching profiles:", e);
            }

            // 2. Fetch Projects
            try {
                // Step 1: Get project IDs the user is a member of
                const { data: memberData, error: memberError } = await supabase
                    .from('project_members' as any)
                    .select('project_id')
                    .eq('user_id', user.id);

                if (memberError) throw memberError;

                if (memberData && memberData.length > 0) {
                    const projectIds = memberData.map((m: any) => m.project_id);

                    // Step 2: Fetch project spaces for these projects
                    const { data: spaces, error: spacesError } = await supabase
                        .from('project_spaces' as any)
                        .select('id, name, project_id')
                        .in('project_id', projectIds);

                    if (spacesError) throw spacesError;

                    if (spaces) {
                        spaces.forEach((space: any) => {
                            newTargets.push({
                                id: space.id,
                                name: space.name,
                                avatar_url: null,
                                type: 'project',
                                subtitle: 'Project Space'
                            });
                        });
                    }
                }
            } catch (e) {
                console.error("Error fetching projects:", e);
            }

            // 3. Fetch Discussion Rooms
            try {
                // Fetch ALL discussion rooms (since membership might have been reset)
                // In a real app, you might want to filter by membership or public status
                const { data: rooms, error: roomsError } = await supabase
                    .from('discussion_rooms')
                    .select('id, title');

                if (roomsError) throw roomsError;

                if (rooms) {
                    rooms.forEach((r: any) => {
                        newTargets.push({
                            id: r.id,
                            name: r.title,
                            avatar_url: null,
                            type: 'room',
                            subtitle: 'Discussion Room'
                        });
                    });
                }
            } catch (e) {
                console.error("Error fetching rooms:", e);
            }

            setTargets(newTargets);

        } catch (error) {
            console.error("Error in fetchTargets:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (target: ShareTarget) => {
        if (!user) return;
        setSending(target.id);

        try {
            // Fetch post details first
            const { data: post } = await supabase
                .from('posts')
                .select('content, media_url, profiles(username, avatar_url)')
                .eq('id', postId)
                .single();

            // Handle potential array return from Supabase relation
            const authorProfile = Array.isArray(post?.profiles)
                ? post.profiles[0]
                : post?.profiles;

            const shareData = {
                postId,
                previewUrl: post?.media_url,
                caption: post?.content,
                author: authorProfile
            };

            // Create a structured message that the chat components can parse
            // Using a prefix to identify it as a shared post
            const messageContent = `POST_SHARE::${JSON.stringify(shareData)}`;

            if (target.type === 'user') {
                const channelId = [user.id, target.id].sort().join('-');
                await supabase.from('direct_messages' as any).insert({
                    content: messageContent,
                    sender_id: user.id,
                    channel_id: channelId,
                    recipient_id: target.id
                });
            } else if (target.type === 'project') {
                await supabase.from('project_messages' as any).insert({
                    project_id: target.id,
                    user_id: user.id,
                    content: messageContent
                });
            } else if (target.type === 'room') {
                await supabase.from('room_messages' as any).insert({
                    room_id: target.id,
                    user_id: user.id,
                    content: messageContent
                });
            }

            setSentTo(prev => new Set(prev).add(target.id));
            toast({ title: "Sent", description: `Shared to ${target.name}` });

        } catch (error) {
            console.error("Error sending:", error);
            toast({ title: "Error", description: "Failed to share.", variant: "destructive" });
        } finally {
            setSending(null);
        }
    };

    const handleCopyLink = async () => {
        const shareUrl = `${window.location.origin}/feed?post=${postId}`;
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Copied", description: "Link copied to clipboard" });
        onOpenChange(false);
    };

    const handleSystemShare = async () => {
        const shareUrl = `${window.location.origin}/feed?post=${postId}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'ReelSphere Post', url: shareUrl });
            } catch (err) {
                console.error("Share failed", err);
            }
        } else {
            handleCopyLink();
        }
    };

    const [searchResults, setSearchResults] = useState<ShareTarget[]>([]);

    useEffect(() => {
        const searchProfiles = async () => {
            if (!searchQuery.trim() || !user) {
                setSearchResults([]);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, avatar_url')
                    .ilike('full_name', `%${searchQuery}%`)
                    .limit(10);

                if (error) throw error;

                if (data) {
                    const newResults: ShareTarget[] = data
                        .filter(p => p.id !== user.id) // Exclude self
                        .map(p => ({
                            id: p.id,
                            full_name: p.full_name || 'Unknown',
                            username: p.username || '',
                            avatar_url: p.avatar_url,
                            type: 'user' as const,
                            subtitle: p.username ? `@${p.username}` : 'User'
                        }))
                        .map(p => ({
                            id: p.id,
                            name: p.full_name,
                            avatar_url: p.avatar_url,
                            type: 'user',
                            subtitle: p.subtitle
                        }));
                    setSearchResults(newResults);
                }
            } catch (error) {
                console.error("Error searching profiles:", error);
            }
        };

        const timeoutId = setTimeout(searchProfiles, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, user]);

    // Merge targets (connections/projects/rooms) with search results
    // Prioritize search results when searching, but keep unique items
    const displayTargets = searchQuery.trim()
        ? [
            ...searchResults,
            ...targets.filter(t =>
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !searchResults.some(r => r.id === t.id && r.type === t.type)
            )
        ]
        : targets;

    const Content = (
        <div className="flex flex-col h-full max-h-[80vh]">
            <div className="p-4 border-b border-border space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        autoFocus
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-muted/50 border-none"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Button variant="outline" size="sm" className="flex-shrink-0 gap-2" onClick={handleCopyLink}>
                        <LinkIcon className="h-4 w-4" /> Copy Link
                    </Button>
                    <Button variant="outline" size="sm" className="flex-shrink-0 gap-2" onClick={handleSystemShare}>
                        <Share2 className="h-4 w-4" /> Share via...
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : displayTargets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No results found</div>
                ) : (
                    <div className="space-y-1">
                        {displayTargets.map(target => (
                            <div key={`${target.type}-${target.id}`} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Avatar className="h-12 w-12 border border-border">
                                        <AvatarImage src={target.avatar_url || undefined} />
                                        <AvatarFallback className="bg-primary/10 text-primary">
                                            {target.type === 'project' ? <Film className="h-5 w-5" /> :
                                                target.type === 'room' ? <MessageSquare className="h-5 w-5" /> :
                                                    target.name[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="font-medium truncate">{target.name}</span>
                                        <span className="text-xs text-muted-foreground truncate">{target.subtitle}</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant={sentTo.has(target.id) ? "ghost" : "default"}
                                    className={sentTo.has(target.id) ? "text-green-500" : "bg-primary hover:bg-primary/90"}
                                    disabled={sending === target.id || sentTo.has(target.id)}
                                    onClick={() => handleSend(target)}
                                >
                                    {sentTo.has(target.id) ? "Sent" : sending === target.id ? "..." : "Send"}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[400px] p-0 gap-0 bg-card text-card-foreground">
                    <DialogHeader className="p-4 border-b border-border">
                        <DialogTitle className="text-center">Share to...</DialogTitle>
                        <DialogDescription className="sr-only">
                            Share this post with your connections, projects, or discussion rooms.
                        </DialogDescription>
                    </DialogHeader>
                    {Content}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-card text-card-foreground max-h-[90vh]">
                <DrawerHeader className="border-b border-border">
                    <DrawerTitle className="text-center">Share to...</DrawerTitle>
                    <DrawerDescription className="sr-only">
                        Share this post with your connections, projects, or discussion rooms.
                    </DrawerDescription>
                </DrawerHeader>
                {Content}
            </DrawerContent>
        </Drawer>
    );
}
