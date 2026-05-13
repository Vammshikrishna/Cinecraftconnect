import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link as LinkIcon, Share2, Film, MessageSquare, Zap, Briefcase, Building2, Bell, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useConnections } from "@/hooks/useConnections";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyToClipboard, getAppOrigin } from "@/lib/utils/share";

export type ShareType = 'project' | 'room' | 'job' | 'post' | 'marketplace' | 'announcement' | 'vendor' | 'pitch' | 'profile' | 'company' | 'content';

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
    const { toast } = useToast();
    const { connections } = useConnections();
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [snap, setSnap] = useState<string | number | null>(0.6);

    useEffect(() => {
        if (isOpen && user) {
            fetchTargets();
        }
    }, [isOpen, user, connections]);

    const fetchTargets = async () => {
        if (!user) return;
        setLoading(true);

        try {
            const [memberSpacesRes, ownedProjectsRes, roomsRes] = await Promise.all([
                supabase.from('project_space_members').select('project_space_id').eq('user_id', user.id),
                supabase.from('projects').select('id').eq('creator_id', user.id),
                supabase.from('discussion_rooms').select('id, title')
            ]);

            const newTargets: ShareTarget[] = [];

            // 1. Process Connections
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
            if (roomsRes.data) {
                roomsRes.data.forEach((r: any) => {
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
            const prefix = shareType === 'room' ? 'DISCUSSION_SHARE::' : `${shareType.toUpperCase()}_SHARE::`;
            
            // Defensive check: Ensure profile shares always have an identifier in shareData
            let finalShareData = { ...shareData };
            if (shareType === 'profile' && !finalShareData.id && !finalShareData.username) {
                console.log('UniversalShareSheet: Injecting missing profile identifier', shareId);
                finalShareData.id = shareId; // Fallback to shareId if data is missing
            }

            const messageContent = `${prefix}${JSON.stringify(finalShareData)}`;

            if (target.type === 'user') {
                const channelId = [user.id, target.id].sort().join('-');
                await supabase.from('direct_messages').insert({
                    content: messageContent,
                    sender_id: user.id,
                    channel_id: channelId,
                    receiver_id: target.id
                });
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

    const handleCopyLink = async () => {
        let path = '';
        switch(shareType) {
            case 'project': path = `/projects/${shareId}/space`; break;
            case 'room': path = `/discussion-rooms/${shareId}`; break;
            case 'job': path = `/jobs/${shareId}`; break;
            case 'post': path = `/posts/${shareId}`; break;
            case 'marketplace': path = `/marketplace/${shareId}`; break;
            case 'announcement': path = `/announcements`; break;
            case 'vendor': path = `/vendors/${shareId}`; break;
            case 'pitch': path = `/pitch/${shareId}`; break;
            case 'profile': path = `/profile/${shareId}`; break;
            case 'company': path = `/pages/${shareId}`; break;
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
            case 'project': path = `/projects/${shareId}/space`; break;
            case 'room': path = `/discussion-rooms/${shareId}`; break;
            case 'job': path = `/jobs/${shareId}`; break;
            case 'post': path = `/posts/${shareId}`; break;
            case 'marketplace': path = `/marketplace/${shareId}`; break;
            case 'announcement': path = `/announcements`; break;
            case 'vendor': path = `/vendors/${shareId}`; break;
            case 'pitch': path = `/pitch/${shareId}`; break;
            case 'profile': path = `/profile/${shareId}`; break;
            case 'company': path = `/pages/${shareId}`; break;
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
                    console.error("Share failed", err);
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
        <div className="flex flex-col h-full overflow-y-auto bg-background">
            <div className="p-4 sm:p-6 space-y-4">
                {/* Share Preview */}
                <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm mb-2">
                    <div className="shrink-0 relative">
                        <Avatar className={`h-14 w-14 border-2 border-background shadow-md ${shareType === 'content' ? 'rounded-lg' : 'rounded-2xl'}`}>
                            <AvatarImage 
                                src={
                                    shareType === 'post' ? (shareData.mediaUrl || shareData.author?.avatar) :
                                    shareType === 'content' ? `https://image.tmdb.org/t/p/w200${shareData.poster_path}` :
                                    shareType === 'company' ? shareData.avatar :
                                    shareType === 'profile' ? shareData.avatar :
                                    shareData.avatarUrl || shareData.logoUrl || shareData.thumbnailUrl
                                } 
                                className="object-cover" 
                            />
                            <AvatarFallback className="bg-primary/10 text-primary font-black uppercase">
                                {shareType === 'project' ? <Film size={20} /> :
                                 shareType === 'room' ? <MessageSquare size={20} /> :
                                 shareType === 'job' ? <Briefcase size={20} /> :
                                 (shareData.title?.[0] || shareData.name?.[0] || '?')}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-1 -right-1 bg-primary text-white p-1 rounded-full shadow-lg">
                            {shareType === 'room' ? <MessageSquare size={10} /> :
                             shareType === 'job' ? <Briefcase size={10} /> :
                             shareType === 'marketplace' ? <Zap size={10} /> :
                             shareType === 'announcement' ? <Bell size={10} /> :
                             shareType === 'vendor' ? <Building2 size={10} /> :
                             shareType === 'pitch' ? <Zap size={10} /> :
                             shareType === 'profile' ? <User size={10} /> :
                             shareType === 'company' ? <Building2 size={10} /> :
                             shareType === 'content' ? <Film size={10} /> :
                             <Share2 size={10} />}
                        </div>
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-0.5">Sharing {shareType}</span>
                        <h4 className="font-black text-lg text-foreground truncate leading-tight">
                            {shareData.title || shareData.name || (shareType === 'post' ? 'Post Update' : 'Creative Content')}
                        </h4>
                        <p className="text-xs text-muted-foreground font-bold truncate opacity-70">
                            {shareType === 'profile' ? `@${shareId}` :
                             shareType === 'company' ? shareData.tagline :
                             shareType === 'content' ? `${shareData.type === 'movie' ? 'Movie' : 'TV Series'}` :
                             shareData.subtitle || shareData.description || 'CineCraft Connect'}
                        </p>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff4d4d] h-4 w-4" />
                    <Input
                        autoFocus
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

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full grid grid-cols-3 bg-zinc-100 dark:bg-zinc-800/50 p-1.5 rounded-2xl h-12">
                        <TabsTrigger value="connections" className="text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-[#ff4d4d] data-[state=active]:shadow-sm transition-all h-full">Connections</TabsTrigger>
                        <TabsTrigger value="discussions" className="text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-[#ff4d4d] data-[state=active]:shadow-sm transition-all h-full">Discussions</TabsTrigger>
                        <TabsTrigger value="projects" className="text-[10px] font-black uppercase tracking-widest rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-[#ff4d4d] data-[state=active]:shadow-sm transition-all h-full">Projects</TabsTrigger>
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
                <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-background border-none shadow-2xl overflow-hidden rounded-[32px]">
                    <DialogHeader className="p-6 pb-2 text-center">
                        <DialogTitle className="text-2xl font-black text-foreground">Share to...</DialogTitle>
                        <DialogDescription className="sr-only">Share this content with your network</DialogDescription>
                    </DialogHeader>
                    {Content}
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
            <DrawerContent className="bg-background flex flex-col border-none rounded-t-[32px] max-h-[96dvh] h-full outline-none">
                <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-muted/20 shrink-0" />
                <DrawerHeader className="pt-4 pb-2 text-center shrink-0">
                    <DrawerTitle className="text-2xl font-black text-foreground">Share to...</DrawerTitle>
                    <DrawerDescription className="sr-only">Share this content with your network</DrawerDescription>
                </DrawerHeader>
                <div className="flex-1 overflow-hidden flex flex-col">
                    {Content}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
