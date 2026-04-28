import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link as LinkIcon, Share2, Film, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConnections } from "@/hooks/useConnections";

interface AnnouncementShareSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    announcement: {
        id: string;
        title: string;
        content: string;
    };
}

interface ShareTarget {
    id: string;
    name: string;
    avatar_url: string | null;
    type: 'user' | 'project' | 'room';
    subtitle?: string;
}

export function AnnouncementShareSheet({ isOpen, onOpenChange, announcement }: AnnouncementShareSheetProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [targets, setTargets] = useState<ShareTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<Set<string>>(new Set());
    const { user } = useAuth();
    const { toast } = useToast();
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
            // 1. Add Connections
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

            // 2. Fetch Project Spaces
            try {
                // Get spaces via membership
                const { data: memberSpaces, error: memberError } = await supabase
                    .from('project_space_members' as any)
                    .select('project_space_id')
                    .eq('user_id', user.id);

                if (memberError) throw memberError;

                // Get projects owned by user
                const { data: ownedProjects, error: ownedError } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('creator_id', user.id);

                if (ownedError) throw ownedError;

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
                    const { data: spacesData, error: spacesError } = await supabase
                        .from('project_spaces' as any)
                        .select('id, name, project_id, projects!inner(title)')
                        .in('id', allSpaceIds);

                    if (spacesError) throw spacesError;

                    if (spacesData) {
                        const spaces = spacesData as any[];
                        spaces.forEach((space: any) => {
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
            } catch (e) {
                console.error("Error fetching project spaces:", e);
            }

            // 3. Fetch Discussion Rooms
            try {
                // Fetch ALL discussion rooms (consistent with InstagramShareSheet)
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
            const shareData = {
                title: announcement.title,
                content: announcement.content,
                id: announcement.id
            };

            const messageContent = `ANNOUNCEMENT_SHARE::${JSON.stringify(shareData)}`;

            if (target.type === 'user') {
                const channelId = [user.id, target.id].sort().join('-');
                const { error: sendError } = await supabase.from('direct_messages' as any).insert({
                    content: messageContent,
                    sender_id: user.id,
                    channel_id: channelId,
                    receiver_id: target.id
                });

                if (sendError && sendError.message?.includes('receiver_id')) {
                    // Fallback to legacy recipient_id
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
        // Just copy content for announcements since they might not have a dedicated public URL yet
        const textToCopy = `${announcement.title}\n\n${announcement.content}`;
        await navigator.clipboard.writeText(textToCopy);
        toast({ title: "Copied", description: "Announcement copied to clipboard" });
        onOpenChange(false);
    };

    const handleSystemShare = async () => {
        const textToShare = `${announcement.title}\n\n${announcement.content}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: announcement.title, text: textToShare });
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
                    .limit(5);

                if (error) throw error;

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
    }, [searchQuery, user]);

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
        <div className="flex flex-col h-full max-h-[85vh] overflow-hidden">
            <div className="p-4 sm:p-6 space-y-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 h-4 w-4 transition-colors group-focus-within:text-primary" />
                    <Input
                        autoFocus
                        placeholder="Search crew, projects, or rooms..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-11 bg-muted/30 border-none rounded-2xl h-12 focus-visible:ring-1 focus-visible:ring-primary/30 transition-all font-medium"
                    />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none px-1">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-shrink-0 gap-2 h-10 rounded-xl bg-muted/40 hover:bg-muted/60 border-none transition-all font-bold px-4" 
                        onClick={handleCopyLink}
                    >
                        <LinkIcon className="h-4 w-4" /> Copy Text
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-shrink-0 gap-2 h-10 rounded-xl bg-primary/5 border-primary/20 hover:bg-primary/10 transition-all text-primary font-bold px-5 shadow-sm" 
                        onClick={handleSystemShare}
                    >
                        <Share2 className="h-4 w-4" /> More
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 sm:px-4 pb-6 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                        <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        <p className="text-sm font-medium animate-pulse">Syncing crew...</p>
                    </div>
                ) : displayTargets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 bg-muted/30 rounded-full mb-3 text-muted-foreground/30">
                            <Search className="h-10 w-10" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground">No matches found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Try a different name or room</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {displayTargets.map((target) => (
                            <div 
                                key={`${target.type}-${target.id}`} 
                                className="flex items-center justify-between p-3 sm:p-4 hover:bg-primary/5 rounded-[1.5rem] transition-all group active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-3 sm:gap-4 overflow-hidden flex-1">
                                    <div className="relative shrink-0">
                                        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-background shadow-lg group-hover:scale-105 transition-transform duration-300">
                                            <AvatarImage src={target.avatar_url || undefined} className="object-cover" />
                                            <AvatarFallback className="bg-primary/10 text-primary font-black">
                                                {target.type === 'project' ? <Film size={20} /> :
                                                    target.type === 'room' ? <MessageSquare size={20} /> :
                                                        target.name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        {sentTo.has(target.id) && (
                                            <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-1 border-2 border-background shadow-sm">
                                                <div className="h-2 w-2 rounded-full bg-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="font-bold text-sm sm:text-base leading-tight truncate group-hover:text-primary transition-colors">
                                            {target.name}
                                        </span>
                                        <span className="text-[10px] sm:text-xs text-muted-foreground/70 font-bold uppercase tracking-widest mt-0.5 truncate">
                                            {target.subtitle}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant={sentTo.has(target.id) ? "ghost" : "default"}
                                    className={sentTo.has(target.id) 
                                        ? "text-primary font-bold bg-primary/5 rounded-2xl min-w-[70px]" 
                                        : "bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl h-10 px-5 font-bold min-w-[70px] shadow-lg shadow-primary/20"}
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

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-background/95 backdrop-blur-3xl border-none rounded-t-[32px] max-h-[90vh]">
                <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/40 my-4" />
                <DrawerHeader className="pb-2">
                    <DrawerTitle className="text-xl font-black text-center">Share Announcement</DrawerTitle>
                    <DrawerDescription className="text-center text-xs text-muted-foreground px-6">
                        Send this update directly to your connections or spaces.
                    </DrawerDescription>
                </DrawerHeader>
                {Content}
            </DrawerContent>
        </Drawer>
    );
}

