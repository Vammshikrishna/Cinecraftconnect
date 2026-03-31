import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link as LinkIcon, Share2, Film, MessageSquare, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useConnections } from "@/hooks/useConnections";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

export type ShareType = 'project' | 'room' | 'job' | 'post' | 'marketplace' | 'announcement' | 'vendor';

interface UniversalShareSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    shareType: ShareType;
    shareId: string;
    shareData: any; // Data specific to the card type
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
    const { user } = useAuth();
    const { toast } = useToast();
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const { connections } = useConnections();

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
                        .select('id, name, projects!inner(title)')
                        .in('id', allSpaceIds);

                    if (spacesData) {
                        (spacesData as any[]).forEach((space: any) => {
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
            const prefix = shareType === 'room' ? 'DISCUSSION_SHARE::' : `${shareType.toUpperCase()}_SHARE::`;
            const messageContent = `${prefix}${JSON.stringify(shareData)}`;

            if (target.type === 'user') {
                const channelId = [user.id, target.id].sort().join('-');
                await supabase.from('direct_messages' as any).insert({
                    content: messageContent,
                    sender_id: user.id,
                    channel_id: channelId,
                    receiver_id: target.id
                });
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
        let path = '';
        switch(shareType) {
            case 'project': path = `/projects/${shareId}/space`; break;
            case 'room': path = `/discussion-rooms/${shareId}`; break;
            case 'job': path = `/jobs/${shareId}`; break;
            case 'post': path = `/posts/${shareId}`; break;
        }
        const shareUrl = `${window.location.origin}${path}`;
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Copied", description: "Link copied to clipboard" });
        onOpenChange(false);
    };

    const [searchResults, setSearchResults] = useState<ShareTarget[]>([]);

    useEffect(() => {
        const searchProfiles = async () => {
            if (!searchQuery.trim() || !user) {
                setSearchResults([]);
                return;
            }

            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, avatar_url')
                    .ilike('full_name', `%${searchQuery}%`)
                    .limit(5);

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

    const ModalContent = (
        <div className="flex flex-col h-full max-h-[80vh] w-full overflow-hidden">
            <div className="p-4 border-b border-border space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        autoFocus
                        placeholder="Search people, projects, rooms..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-muted/50 border-none rounded-xl h-10"
                    />
                </div>
                <div className="flex gap-x-2">
                    <Button variant="secondary" size="sm" className="h-9 flex-1 gap-2 rounded-xl bg-muted/40 border-border/40 hover:bg-muted/60 transition-all font-bold" onClick={handleCopyLink}>
                        <LinkIcon className="h-4 w-4" /> Copy Link
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 px-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                            <Share2 className="h-6 w-6" />
                        </motion.div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Syncing Crew...</p>
                    </div>
                ) : displayTargets.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-sm font-bold text-muted-foreground">No matches found</p>
                    </div>
                ) : (
                    <div className="space-y-1 py-1">
                        <AnimatePresence mode="popLayout">
                            {displayTargets.map((target, index) => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.03 }}
                                    key={`${target.type}-${target.id}`}
                                    className="flex flex-row items-center justify-between p-3 hover:bg-primary/5 rounded-2xl transition-all group active:scale-[0.98] w-full"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="relative shrink-0">
                                            <Avatar className="h-10 w-10 border-2 border-background shadow-md">
                                                <AvatarImage src={target.avatar_url || undefined} className="object-cover" />
                                                <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                                                    {target.type === 'project' ? <Film size={16} /> :
                                                        target.type === 'room' ? <MessageSquare size={16} /> :
                                                            target.name[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                                            <span className="font-bold text-sm truncate block text-foreground/90">
                                                {target.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate block uppercase tracking-wider font-black opacity-60">
                                                {target.subtitle}
                                            </span>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={sentTo.has(target.id) ? "ghost" : "default"}
                                        className={sentTo.has(target.id)
                                            ? "text-green-500 font-bold min-w-[70px] bg-green-500/5 rounded-xl shrink-0"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-9 px-4 font-bold min-w-[70px] shadow-lg shadow-primary/20 shrink-0 text-xs"}
                                        disabled={sending === target.id || sentTo.has(target.id)}
                                        onClick={() => handleSend(target)}
                                    >
                                        {sentTo.has(target.id) ? <Check size={16} /> : sending === target.id ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Share2 size={14} /></motion.div> : "Send"}
                                    </Button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </ScrollArea>
        </div>
    );

    if (isDesktop) {
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-card/95 backdrop-blur-3xl border-white/10 shadow-3xl rounded-3xl overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-black tracking-tight text-center">Share {shareType}</DialogTitle>
                        <DialogDescription className="text-center text-xs text-muted-foreground mt-1 uppercase tracking-widest font-black">
                            Collaborate with your crew
                        </DialogDescription>
                    </DialogHeader>
                    {ModalContent}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-card/95 backdrop-blur-3xl text-card-foreground border-t-white/10 rounded-t-3xl">
                <DrawerHeader className="pb-2">
                    <DrawerTitle className="text-xl font-black text-center">Share {shareType}</DrawerTitle>
                    <DrawerDescription className="text-center text-xs text-muted-foreground uppercase tracking-widest font-black">
                        Collaborate with your crew
                    </DrawerDescription>
                </DrawerHeader>
                <div className="pb-8">
                    {ModalContent}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
