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
import { useConnections } from "@/hooks/useConnections";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    const [activeTab, setActiveTab] = useState("connections");
    const { user } = useAuth();
    const { toast } = useToast();
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const { connections } = useConnections();

    useEffect(() => {
        if (isOpen && user) {
            fetchTargets();
        }
    }, [isOpen, user, connections]);

    const fetchTargets = async () => {
        if (!user) return;
        setLoading(true);

        const newTargets: ShareTarget[] = [];
        try {
            if (connections) {
                connections.forEach(conn => {
                    const isFollower = conn.follower_id === user.id;
                    const profile = isFollower ? conn.following_profile : conn.follower_profile;
                    if (profile) {
                        newTargets.push({
                            id: profile.id,
                            name: profile.full_name || profile.username || 'Unknown',
                            avatar_url: profile.avatar_url,
                            type: 'user',
                            subtitle: 'Connection'
                        });
                    }
                });
            }

            const { data: memberSpaces } = await supabase
                .from('project_space_members' as any)
                .select('project_space_id')
                .eq('user_id', user.id);

            const { data: ownedProjects } = await supabase
                .from('projects')
                .select('id')
                .eq('creator_id', user.id);

            const knownSpaceIds = memberSpaces?.map((m: any) => m.project_space_id) || [];
            const ownedProjectIds = ownedProjects?.map((p: any) => p.id) || [];

            let additionalSpaceIds: string[] = [];
            if (ownedProjectIds.length > 0) {
                const { data: spaces } = await supabase
                    .from('project_spaces' as any)
                    .select('id')
                    .in('project_id', ownedProjectIds);
                additionalSpaceIds = spaces?.map((s: any) => s.id) || [];
            }
            const allSpaceIds = Array.from(new Set([...knownSpaceIds, ...additionalSpaceIds]));

            if (allSpaceIds.length > 0) {
                const { data: spacesData } = await supabase
                    .from('project_spaces' as any)
                    .select('id, name, project_id, projects!inner(title)')
                    .in('id', allSpaceIds);

                if (spacesData) {
                    spacesData.forEach((space: any) => {
                        const projectTitle = Array.isArray(space.projects) ? space.projects[0]?.title : space.projects?.title;
                        if (projectTitle) {
                            newTargets.push({
                                id: space.id,
                                name: projectTitle,
                                avatar_url: null,
                                type: 'project',
                                subtitle: `Project Space • ${space.name}`
                            });
                        }
                    });
                }
            }

            const { data: rooms } = await supabase
                .from('discussion_rooms')
                .select('id, title');

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
            const { data: post } = await supabase
                .from('posts')
                .select('content, media_url, profiles(username, avatar_url)')
                .eq('id', postId)
                .single();

            const authorProfile = Array.isArray(post?.profiles) ? post.profiles[0] : post?.profiles;
            const shareData = {
                postId,
                previewUrl: post?.media_url,
                caption: post?.content,
                author: authorProfile,
                recipient_id: target.id,
                recipient_type: target.type === 'user' ? 'connection' : target.type === 'room' ? 'discussion_room' : 'project_space',
                shared_content_id: postId,
                shared_content_type: 'post'
            };

            const messageContent = `POST_SHARE::${JSON.stringify(shareData)}`;

            if (target.type === 'user') {
                const channelId = [user.id, target.id].sort().join('-');
                const { error: sendError } = await supabase.from('direct_messages' as any).insert({
                    content: messageContent,
                    sender_id: user.id,
                    channel_id: channelId,
                    receiver_id: target.id
                });
                if (sendError && sendError.message?.includes('receiver_id')) {
                    await supabase.from('direct_messages' as any).insert({
                        content: messageContent,
                        sender_id: user.id,
                        channel_id: channelId,
                        recipient_id: target.id
                    });
                }
            } else if (target.type === 'project') {
                await supabase.from('project_space_messages' as any).insert({
                    project_space_id: target.id,
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
            if (!searchQuery.trim() || !user || activeTab !== "connections") {
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
                        .filter(p => p.id !== user.id)
                        .map(p => ({
                            id: p.id,
                            name: p.full_name || 'Unknown',
                            avatar_url: p.avatar_url,
                            type: 'user',
                            subtitle: p.username ? `@${p.username}` : 'User'
                        }));
                    setSearchResults(newResults);
                }
            } catch (error) {
                console.error("Error searching profiles:", error);
            }
        };
        const timeoutId = setTimeout(searchProfiles, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, user, activeTab]);

    const filteredTargets = targets.filter(t => {
        if (activeTab === "connections") return t.type === 'user';
        if (activeTab === "discussions") return t.type === 'room';
        if (activeTab === "projects") return t.type === 'project';
        return false;
    });

    const displayTargets = searchQuery.trim()
        ? [
            ...(activeTab === "connections" ? searchResults : []),
            ...filteredTargets.filter(t =>
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !searchResults.some(r => r.id === t.id && r.type === t.type)
            )
        ]
        : filteredTargets;

    const Content = (
        <div className="flex flex-col h-[500px] md:h-[600px] max-h-full">
            <div className="p-4 border-b border-border space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        autoFocus
                        placeholder={`Search ${activeTab}...`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-muted/50 border-none rounded-xl h-11"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Button variant="outline" size="sm" className="flex-shrink-0 gap-2 rounded-xl" onClick={handleCopyLink}>
                        <LinkIcon className="h-4 w-4" /> Copy Link
                    </Button>
                    <Button variant="outline" size="sm" className="flex-shrink-0 gap-2 rounded-xl" onClick={handleSystemShare}>
                        <Share2 className="h-4 w-4" /> Share via...
                    </Button>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full grid grid-cols-3 bg-muted/30 p-1 rounded-xl h-10">
                        <TabsTrigger value="connections" className="text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">Connections</TabsTrigger>
                        <TabsTrigger value="discussions" className="text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">Discussions</TabsTrigger>
                        <TabsTrigger value="projects" className="text-[10px] font-black uppercase tracking-widest rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">Projects</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-50">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Searching Recipients...</p>
                    </div>
                ) : displayTargets.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground font-medium">No matching {activeTab} found</p>
                    </div>
                ) : (
                    <div className="space-y-1 pb-32 md:pb-6">
                        {displayTargets.map(target => (
                            <div key={`${target.type}-${target.id}`} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors group">
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
                                    className={sentTo.has(target.id) ? "text-primary" : "bg-primary hover:bg-primary/90 rounded-full px-5 h-8 text-xs font-bold"}
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
                <DialogContent className="sm:max-w-[400px] p-0 gap-0 bg-card text-card-foreground overflow-hidden flex flex-col">
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
            <DrawerContent className="bg-card text-card-foreground h-[65vh] flex flex-col">
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
