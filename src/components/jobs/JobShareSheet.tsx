import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link as LinkIcon, Share2, Layout, Megaphone, Film, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useConnections } from "@/hooks/useConnections";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface JobShareSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    jobId: string;
}

interface ShareTarget {
    id: string;
    name: string;
    avatar_url: string | null;
    type: 'user' | 'project' | 'room';
    subtitle?: string;
}

export function JobShareSheet({ isOpen, onOpenChange, jobId }: JobShareSheetProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [targets, setTargets] = useState<ShareTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<Set<string>>(new Set());
    const [isJobOwner, setIsJobOwner] = useState(false);
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

            // 4. Check if current user is job owner
            const { data: jobOwnerData } = await supabase
                .from('jobs')
                .select('posted_by')
                .eq('id', jobId)
                .single();
            
            if (jobOwnerData && (jobOwnerData as any).posted_by === user.id) {
                setIsJobOwner(true);
            } else {
                setIsJobOwner(false);
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
            // Fetch job details first
            const { data: jobData } = await supabase
                .from('jobs')
                .select('title, location, company, description, image_url, company_pages:page_id(name, logo_url, slug)')
                .eq('id', jobId)
                .single();

            const job = jobData as any;

            const shareData = {
                jobId,
                title: job?.title,
                company: job?.company_pages?.name || job?.company,
                location: job?.location,
                logoUrl: job?.company_pages?.logo_url,
                slug: job?.company_pages?.slug
            };

            const messageContent = `JOB_SHARE::${JSON.stringify(shareData)}`;

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
            toast({ title: "Error", description: "Failed to share job.", variant: "destructive" });
        } finally {
            setSending(null);
        }
    };

    const handleShareToFeed = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch job info
            const { data: jobData } = await supabase
                .from('jobs')
                .select('title, company, location, description, image_url, company_pages:page_id(name, logo_url, slug)')
                .eq('id', jobId)
                .single();
            
            const job = jobData as any;
            const shareData = {
                jobId,
                title: job?.title,
                company: job?.company_pages?.name || job?.company,
                location: job?.location,
                logoUrl: job?.company_pages?.logo_url,
                slug: job?.company_pages?.slug
            };

            const content = `JOB_SHARE::${JSON.stringify(shareData)}`;
            
            const { error } = await supabase
                .from('posts')
                .insert({
                    content,
                    author_id: user.id,
                    media_items: []
                });

            if (error) throw error;
            toast({ title: "Shared", description: "Job posted to your feed!" });
            onOpenChange(false);
        } catch (error) {
            console.error("Error sharing to feed:", error);
            toast({ title: "Error", description: "Failed to post to feed.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleShareAsAnnouncement = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch job info
            const { data: jobData } = await supabase
                .from('jobs')
                .select('title, company, location, company_pages:page_id(name, logo_url, slug)')
                .eq('id', jobId)
                .single();
            
            const job = jobData as any;
            const shareData = {
                jobId,
                title: job?.title,
                company: job?.company_pages?.name || job?.company,
                location: job?.location,
                logoUrl: job?.company_pages?.logo_url,
                slug: job?.company_pages?.slug
            };

            const content = `JOB_SHARE::${JSON.stringify(shareData)}`;
            
            const { error } = await supabase
                .from('announcements')
                .insert({
                    title: `Job Opening: ${job?.title}`,
                    content,
                    author_id: user.id
                });

            if (error) throw error;
            toast({ title: "Announced", description: "Job announcement posted!" });
            onOpenChange(false);
        } catch (error) {
            console.error("Error sharing as announcement:", error);
            toast({ title: "Error", description: "Failed to post announcement.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = async () => {
        const shareUrl = `${window.location.origin}/jobs/${jobId}`;
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Copied", description: "Job link copied to clipboard" });
        onOpenChange(false);
    };

    const handleSystemShare = async () => {
        const shareUrl = `${window.location.origin}/jobs/${jobId}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'CineCraft Job Opening', url: shareUrl });
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
        <div className="flex flex-col h-full max-h-[80vh] w-full overflow-hidden">
            <div className="p-4 border-b border-border space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        autoFocus
                        placeholder="Search people, projects, rooms..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 bg-muted/50 border-none rounded-xl"
                    />
                </div>
                <div className="flex gap-x-3 overflow-x-auto pb-3 px-1 scrollbar-none w-full">
                    <Button variant="secondary" size="sm" className="h-11 flex-shrink-0 gap-2 rounded-2xl bg-muted/40 border-border/40 hover:bg-muted/60 transition-all font-bold px-4" onClick={handleCopyLink}>
                        <LinkIcon className="h-4 w-4" /> Link
                    </Button>
                    <Button variant="secondary" size="sm" className="h-11 flex-shrink-0 gap-2 rounded-2xl bg-primary/5 border-primary/20 hover:bg-primary/10 transition-all text-primary font-bold px-5 shadow-sm" onClick={handleShareToFeed}>
                        <Layout className="h-4 w-4" /> Post
                    </Button>
                    {isJobOwner && (
                        <Button variant="secondary" size="sm" className="h-11 flex-shrink-0 gap-2 rounded-2xl bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10 transition-all text-orange-500 font-bold px-5 shadow-sm" onClick={handleShareAsAnnouncement}>
                            <Megaphone className="h-4 w-4" /> Announcement
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" className="h-11 flex-shrink-0 gap-2 rounded-2xl bg-muted/40 border-border/40 hover:bg-muted/60 transition-all font-bold px-4" onClick={handleSystemShare}>
                        <Share2 className="h-4 w-4" /> More
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 px-2 sm:px-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="p-3 bg-primary/10 rounded-full text-primary">
                            <Share2 className="h-6 w-6" />
                        </motion.div>
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">Finding your crew...</p>
                    </div>
                ) : displayTargets.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="p-4 bg-muted/30 rounded-3xl inline-block mb-3">
                            <Search className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground">No matches found</p>
                    </div>
                ) : (
                    <div className="space-y-1 py-1 w-full overflow-x-hidden">
                        <AnimatePresence mode="popLayout">
                            {displayTargets.map((target, index) => (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.03 }}
                                    key={`${target.type}-${target.id}`}
                                    className="flex flex-row items-center justify-between p-3 sm:p-4 hover:bg-primary/5 rounded-[1.5rem] transition-all group active:scale-[0.98] w-full"
                                >
                                    <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
                                        <div className="relative shrink-0">
                                            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-background shadow-lg group-hover:scale-110 transition-transform duration-300">
                                                <AvatarImage src={target.avatar_url || undefined} className="object-cover" />
                                                <AvatarFallback className="bg-primary/10 text-primary font-black text-sm sm:text-base">
                                                    {target.type === 'project' ? <Film size={18} className="sm:w-5 sm:h-5" /> :
                                                        target.type === 'room' ? <MessageSquare size={18} className="sm:w-5 sm:h-5" /> :
                                                            target.name[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            {sentTo.has(target.id) && (
                                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 sm:p-1 border-2 border-background">
                                                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-white" />
                                                </motion.div>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1 overflow-hidden pr-2">
                                            <span className="font-bold text-sm sm:text-base truncate block text-foreground/90 group-hover:text-foreground transition-colors leading-tight">
                                                {target.name}
                                            </span>
                                            <div className="flex items-center gap-1 opacity-60">
                                                <span className="text-[9px] sm:text-[10px] text-muted-foreground truncate block uppercase tracking-[0.05em] sm:tracking-[0.1em] font-black">
                                                    {target.subtitle}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={sentTo.has(target.id) ? "ghost" : "default"}
                                        className={sentTo.has(target.id)
                                            ? "text-primary font-bold min-w-[70px] sm:min-w-[85px] bg-primary/5 rounded-2xl shrink-0 ml-2"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl h-10 px-4 sm:px-6 font-bold min-w-[70px] sm:min-w-[85px] shadow-lg shadow-primary/20 shrink-0 ml-2 text-[11px] sm:text-sm"}
                                        disabled={sending === target.id || sentTo.has(target.id)}
                                        onClick={() => handleSend(target)}
                                    >
                                        {sentTo.has(target.id) ? "Sent" : sending === target.id ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Share2 size={14} /></motion.div> : "Send"}
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
                <DialogContent className="w-[95vw] sm:max-w-[480px] p-0 gap-0 bg-card/95 backdrop-blur-3xl border-white/10 shadow-3xl rounded-[32px] overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-black tracking-tight text-center">Share Job Listing</DialogTitle>
                        <DialogDescription className="text-center text-xs text-muted-foreground mt-1">
                            Send this opportunity directly to your crew or space.
                        </DialogDescription>
                    </DialogHeader>
                    {Content}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="bg-card/95 backdrop-blur-3xl text-card-foreground max-h-[90vh] border-t-white/10 rounded-t-[32px]">
                <DrawerHeader className="pb-2">
                    <DrawerTitle className="text-xl font-black text-center">Share Job Listing</DrawerTitle>
                    <DrawerDescription className="text-center text-xs text-muted-foreground">
                        Send this opportunity directly to your crew or space.
                    </DrawerDescription>
                </DrawerHeader>
                {Content}
            </DrawerContent>
        </Drawer>
    );
}

