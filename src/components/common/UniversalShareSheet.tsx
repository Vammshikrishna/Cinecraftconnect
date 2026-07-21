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
import { copyToClipboard, getAppOrigin } from "@/lib/utils/share";
import { useAccountType } from "@/hooks/useAccountType";
import { generateDirectRoomId } from "@/lib/chat-utils";

export type ShareType = 'project' | 'room' | 'job' | 'post' | 'marketplace' | 'announcement' | 'vendor' | 'pitch' | 'profile' | 'company' | 'content' | 'wishlist';

interface UniversalShareSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    shareType: ShareType;
    shareId: string;
    shareData: any;
}

interface ShareTarget {
    id: string;
    name: string;
    avatar_url: string | null;
    type: 'user' | 'project' | 'room';
    subtitle?: string;
}

export function UniversalShareSheet({ isOpen, onOpenChange, shareType, shareId, shareData }: UniversalShareSheetProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [targets, setTargets] = useState<ShareTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState("connections");
    const { user } = useAuth();
    const { isFan } = useAccountType();
    const { toast } = useToast();
    const { connections } = useConnections();
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [snap, setSnap] = useState<string | number | null>(0.6);

    const typeLabel = 
        shareType === 'room' ? 'Discussion' :
        shareType === 'marketplace' ? 'Listing' :
        shareType === 'company' ? 'Company' :
        shareType.charAt(0).toUpperCase() + shareType.slice(1);
    const titleText = `Share ${typeLabel} to...`;

    useEffect(() => {
        if (isOpen && user) {
            fetchTargets();
        }
    }, [isOpen, user, connections]);

    const fetchTargets = async () => {
        if (!user) return;
        setLoading(true);

        try {
            const [memberSpacesRes, ownedProjectsRes, memberRoomsRes, ownedRoomsRes, recentConvosRes] = await Promise.all([
                supabase.from('project_space_members').select('project_space_id').eq('user_id', user.id),
                supabase.from('projects').select('id').eq('creator_id', user.id),
                supabase.from('room_members').select('room_id').eq('user_id', user.id),
                supabase.from('discussion_rooms').select('id, title').eq('creator_id', user.id),
                supabase.rpc('get_user_conversations_with_profiles' as any, { p_user_id: user.id })
            ]);

            const newTargets: ShareTarget[] = [];

            // 1. Process Connections
            const addedUserIds = new Set<string>();

            if (recentConvosRes.data) {
                recentConvosRes.data.forEach((c: any) => {
                    if (!addedUserIds.has(c.other_user_id)) {
                        newTargets.push({
                            id: c.other_user_id,
                            name: c.other_user_full_name || 'Unknown',
                            avatar_url: c.other_user_avatar_url,
                            type: 'user',
                            subtitle: 'Recent Interaction'
                        });
                        addedUserIds.add(c.other_user_id);
                    }
                });
            }

            if (connections) {
                connections.forEach(conn => {
                    const isFollower = conn.follower_id === user.id;
                    const profile = isFollower ? conn.following_profile : conn.follower_profile;
                    if (profile && !addedUserIds.has(profile.id)) {
                        newTargets.push({
                            id: profile.id,
                            name: profile.full_name || profile.username || 'Unknown',
                            avatar_url: profile.avatar_url,
                            type: 'user',
                            subtitle: 'Connection'
                        });
                        addedUserIds.add(profile.id);
                    }
                });
            }

            // 2. Process Project Spaces
            const knownSpaceIds = memberSpacesRes.data?.map(m => m.project_space_id) || [];
            const ownedProjectIds = ownedProjectsRes.data?.map(p => p.id) || [];

            let allSpaceIds = [...knownSpaceIds];
            if (ownedProjectIds.length > 0) {
                const { data: spaces } = await supabase
                    .from('project_spaces')
                    .select('id')
                    .in('project_id', ownedProjectIds);
                if (spaces) allSpaceIds = Array.from(new Set([...allSpaceIds, ...spaces.map(s => s.id)]));
            }

            if (allSpaceIds.length > 0) {
                const { data: spacesData } = await supabase
                    .from('project_spaces')
                    .select('id, name, projects!inner(title)')
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

            // 3. Process Rooms
            const addedRoomIds = new Set<string>();

            if (ownedRoomsRes.data) {
                ownedRoomsRes.data.forEach((r: any) => {
                    newTargets.push({
                        id: r.id,
                        name: r.title,
                        avatar_url: null,
                        type: 'room',
                        subtitle: 'Discussion Room'
                    });
                    addedRoomIds.add(r.id);
                });
            }

            const memberRoomIds = memberRoomsRes.data?.map(m => m.room_id).filter(id => !addedRoomIds.has(id)) || [];

            if (memberRoomIds.length > 0) {
                const { data: memberRoomsData } = await supabase
                    .from('discussion_rooms')
                    .select('id, title')
                    .in('id', memberRoomIds);

                if (memberRoomsData) {
                    memberRoomsData.forEach((r: any) => {
                        newTargets.push({
                            id: r.id,
                            name: r.title,
                            avatar_url: null,
                            type: 'room',
                            subtitle: 'Discussion Room'
                        });
                    });
                }
            }

            // Deduplicate to avoid duplicate keys in React list rendering
            const uniqueTargets = newTargets.filter((target, index, self) =>
                index === self.findIndex((t) => t.id === target.id && t.type === target.type)
            );

            setTargets(uniqueTargets);
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
            const prefix = shareType === 'room' ? 'DISCUSSION_SHARE::' : `${shareType.toUpperCase()}_SHARE::`;
            
            // Defensive check: Ensure shares always have an identifier in shareData
            let finalShareData = { ...shareData };
            if (!finalShareData.id) {
                console.log('UniversalShareSheet: Injecting missing identifier', shareId);
                finalShareData.id = shareId; // Fallback to shareId if data is missing
            }

            const messageContent = `${prefix}${JSON.stringify(finalShareData)}`;

            if (target.type === 'user') {
                const channelId = generateDirectRoomId(user.id, target.id);
                await supabase.from('direct_messages').insert({
                    content: messageContent,
                    sender_id: user.id,
                    channel_id: channelId,
                    receiver_id: target.id
                });

                // Dispatch local event for instant UI update
                console.log('[UniversalShareSheet] Dispatching local chat_list_update event');
                window.dispatchEvent(new CustomEvent('chat_list_update', {
                    detail: { senderId: user.id, receiverId: target.id }
                }));

                // Safely broadcast globally
                const globalChannel = supabase.channel('global_chat_updates');
                globalChannel.send({
                    type: 'broadcast',
                    event: 'chat_list_update',
                    payload: { senderId: user.id, receiverId: target.id }
                }).catch(console.error);
            } else if (target.type === 'project') {
                await supabase.from('project_space_messages').insert({
                    project_space_id: target.id,
                    user_id: user.id,
                    content: messageContent
                });
            } else if (target.type === 'room') {
                await supabase.from('room_messages').insert({
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

    const handleShareToFeedPost = async () => {
        if (!user) return;
        setSending('feed_post');
        try {
            const prefix = `JOB_SHARE::`;
            const finalShareData = { ...shareData, id: shareId };
            const content = `${prefix}${JSON.stringify(finalShareData)}`;

            const { error } = await supabase.from('posts').insert({
                author_id: user.id,
                content: content,
            });

            if (error) throw error;

            toast({
                title: "Shared to Post",
                description: "This job opportunity has been posted to your profile and feed.",
            });
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error sharing to post:", err);
            toast({
                title: "Error sharing to post",
                description: err.message || "Failed to share job as a post.",
                variant: "destructive"
            });
        } finally {
            setSending(null);
        }
    };

    const handleShareToAnnouncement = async () => {
        if (!user) return;
        setSending('announcement');
        try {
            const prefix = `JOB_SHARE::`;
            const finalShareData = { ...shareData, id: shareId };
            const content = `${prefix}${JSON.stringify(finalShareData)}`;

            const { error } = await supabase.from('announcements').insert({
                author_id: user.id,
                title: `Hiring: ${shareData.title || 'Job Opportunity'}`,
                content: content,
                posted_at: new Date().toISOString()
            });

            if (error) throw error;

            toast({
                title: "Shared to Announcements",
                description: "This job has been published to Announcements and will show on the feed.",
            });
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error sharing to announcements:", err);
            toast({
                title: "Error sharing to announcements",
                description: err.message || "Failed to publish announcement.",
                variant: "destructive"
            });
        } finally {
            setSending(null);
        }
    };

    const handleCopyLink = async () => {
        let path = '';
        switch(shareType) {
            case 'project': path = `/projects/${shareId}`; break;
            case 'room': path = `/discussion-rooms/${shareId}`; break;
            case 'job': path = `/jobs/${shareId}`; break;
            case 'post': path = `/posts/${shareId}`; break;
            case 'marketplace': path = `/marketplace/${shareId}`; break;
            case 'announcement': path = `/announcements`; break;
            case 'vendor': path = `/vendors/${shareId}`; break;
            case 'pitch': path = `/pitch/${shareId}`; break;
            case 'profile': path = `/profile/${shareId}`; break;
            case 'company': path = `/pages/${shareId}`; break;
            case 'wishlist': path = `/wishlist/${shareId}`; break;
            case 'content': {
                const { type, id } = shareData;
                path = `/content/${type}/${id}`;
                break;
            }
        }
        const shareUrl = `${getAppOrigin()}${path}`;
        const success = await copyToClipboard(shareUrl);
        if (success) {
            toast({ title: "Copied", description: "Link copied to clipboard" });
        } else {
            toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
        }
    };

    const handleSystemShare = async () => {
        let path = '';
        switch(shareType) {
            case 'project': path = `/projects/${shareId}`; break;
            case 'room': path = `/discussion-rooms/${shareId}`; break;
            case 'job': path = `/jobs/${shareId}`; break;
            case 'post': path = `/posts/${shareId}`; break;
            case 'marketplace': path = `/marketplace/${shareId}`; break;
            case 'announcement': path = `/announcements`; break;
            case 'vendor': path = `/vendors/${shareId}`; break;
            case 'pitch': path = `/pitch/${shareId}`; break;
            case 'profile': path = `/profile/${shareId}`; break;
            case 'company': path = `/pages/${shareId}`; break;
            case 'wishlist': path = `/wishlist/${shareId}`; break;
            case 'content': {
                const { type, id } = shareData;
                path = `/content/${type}/${id}`;
                break;
            }
        }
        const shareUrl = `${getAppOrigin()}${path}`;

        if (navigator.share) {
            try {
                await navigator.share({ 
                    title: `Check out this ${shareType} on CineCraft`, 
                    url: shareUrl 
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error("Share failed, falling back to copy link", err);
                    await handleCopyLink();
                }
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
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, avatar_url')
                    .ilike('full_name', `%${searchQuery}%`)
                    .limit(10);

                if (data) {
                    const newResults: ShareTarget[] = data
                        .filter(p => p.id !== user.id)
                        .map(p => ({
                            id: p.id,
                            name: p.full_name || p.username || 'Unknown',
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

    const displayTargetsRaw = searchQuery.trim()
        ? [
            ...(activeTab === "connections" ? searchResults : []),
            ...filteredTargets.filter(t =>
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !searchResults.some(r => r.id === t.id && r.type === t.type)
            )
        ]
        : filteredTargets;

    const displayTargets = displayTargetsRaw.filter((target, index, self) =>
        index === self.findIndex((t) => t.id === target.id && t.type === target.type)
    );

    const Content = (
        <div className="flex flex-col h-full overflow-hidden bg-background">
            <div className="p-4 sm:p-6 space-y-4">

                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff4d4d] h-4 w-4" />
                    <Input
                        placeholder={`Search connections...`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-11 bg-white dark:bg-zinc-900 border-[#ff4d4d]/20 rounded-2xl h-12 focus-visible:ring-1 focus-visible:ring-[#ff4d4d]/30 transition-all font-medium text-foreground"
                    />
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3 px-1">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 gap-2 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-none transition-all font-bold text-foreground text-xs" 
                        onClick={handleCopyLink}
                    >
                        <LinkIcon className="h-3.5 w-3.5" /> Copy Link
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 gap-2 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-none transition-all font-bold text-foreground text-xs" 
                        onClick={handleSystemShare}
                    >
                        <Share2 className="h-3.5 w-3.5" /> Share via...
                    </Button>
                </div>

                {shareType === 'job' && !isFan && (
                    <div className="flex gap-3 px-1">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            disabled={sending === 'feed_post'}
                            className="flex-1 gap-2 h-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border-none transition-all font-bold text-xs" 
                            onClick={handleShareToFeedPost}
                        >
                            {sending === 'feed_post' ? "Sharing..." : "Share to Post"}
                        </Button>
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            disabled={sending === 'announcement'}
                            className="flex-1 gap-2 h-10 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary border-none transition-all font-bold text-xs" 
                            onClick={handleShareToAnnouncement}
                        >
                            {sending === 'announcement' ? "Sharing..." : "Share to Announcement"}
                        </Button>
                    </div>
                )}

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className={`w-full grid ${isFan ? 'grid-cols-2' : 'grid-cols-3'} bg-zinc-100 dark:bg-zinc-800/50 p-1.5 rounded-2xl h-12`}>
                        <TabsTrigger value="connections" className="text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-[#ff4d4d] data-[state=active]:shadow-sm transition-all h-full">Connections</TabsTrigger>
                        <TabsTrigger value="discussions" className="text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-[#ff4d4d] data-[state=active]:shadow-sm transition-all h-full">Discussions</TabsTrigger>
                        {!isFan && (
                            <TabsTrigger value="projects" className="text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-[#ff4d4d] data-[state=active]:shadow-sm transition-all h-full">Projects</TabsTrigger>
                        )}
                    </TabsList>
                </Tabs>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-6 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground opacity-70">
                        <div className="h-8 w-8 rounded-full border-2 border-[#ff4d4d] border-t-transparent animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing...</p>
                    </div>
                ) : displayTargets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-3 text-muted-foreground/30">
                            <Search className="h-10 w-10" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground">No matches found</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {displayTargets.map((target) => (
                            <div 
                                key={`${target.type}-${target.id}`} 
                                className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                    <div className="relative shrink-0">
                                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                            <AvatarImage src={target.avatar_url || undefined} className="object-cover" />
                                            <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-[#ff4d4d] font-bold">
                                                {target.type === 'project' ? <Film size={18} /> :
                                                    target.type === 'room' ? <MessageSquare size={18} /> :
                                                        target.name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-blue-500 shadow-sm" />
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className={`font-bold text-sm truncate ${activeTab === 'connections' ? 'text-[#ff4d4d]' : 'text-foreground'}`}>
                                            {target.name}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">
                                            {target.subtitle}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    className={sentTo.has(target.id) 
                                        ? "bg-zinc-200 dark:bg-zinc-700 text-muted-foreground rounded-xl min-w-[70px] h-9 font-bold" 
                                        : "bg-[#ff4d4d] text-white hover:bg-[#ff3333] rounded-xl h-9 px-5 font-bold min-w-[70px] shadow-lg shadow-[#ff4d4d]/20 transition-all"}
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
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[420px] max-h-[85vh] md:max-h-[620px] flex flex-col p-0 gap-0 bg-background border-none shadow-2xl overflow-hidden rounded-[32px]">
                    <DialogHeader className="p-6 pb-2 text-center shrink-0">
                        <DialogTitle className="text-2xl font-black text-foreground">{titleText}</DialogTitle>
                        <DialogDescription className="sr-only">Share this content with your network</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                        {Content}
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer 
            open={isOpen} 
            onOpenChange={onOpenChange}
            snapPoints={[0.6, 1]}
            activeSnapPoint={snap}
            setActiveSnapPoint={setSnap}
            shouldScaleBackground
        >
            <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()} className="bg-background flex flex-col border-none rounded-t-[32px] max-h-[96dvh] h-full outline-none">
                <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-muted/20 shrink-0" />
                <DrawerHeader className="pt-2 pb-1 text-center shrink-0">
                    <DrawerTitle className="text-2xl font-black text-foreground">{titleText}</DrawerTitle>
                    <DrawerDescription className="sr-only">Share this content with your network</DrawerDescription>
                </DrawerHeader>
                <div className="flex-1 overflow-hidden flex flex-col">
                    {Content}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
