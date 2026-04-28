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

interface VendorShareSheetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    vendorId: string;
}

interface ShareTarget {
    id: string;
    name: string;
    avatar_url: string | null;
    type: 'user' | 'project' | 'space' | 'room';
    subtitle?: string;
}

export function VendorShareSheet({ isOpen, onOpenChange, vendorId }: VendorShareSheetProps) {
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
    }, [isOpen, user, connections]);

    const fetchTargets = async () => {
        if (!user) return;
        setLoading(true);

        const newTargets: ShareTarget[] = [];
        // Reuse similar logic to MarketplaceShareSheet for fetching targets
        // Simplified here for brevity but ideally shared logic
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

            // 2. Project Spaces
            // Get spaces via membership
            const { data: memberSpaces, error: memberError } = await supabase
                .from('project_space_members' as any)
                .select('project_space_id')
                .eq('user_id', user.id);

            // Get projects owned by user
            const { data: ownedProjects } = await supabase
                .from('projects')
                .select('id')
                .eq('creator_id', user.id);

            if (memberError) console.error("Error fetching member spaces:", memberError);

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
                                type: 'space',
                                subtitle: `Project Space • ${space.name}`
                            });
                        }
                    });
                }
            }
            // 3. Discussion Rooms
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
            console.error("Error fetching targets", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (target: ShareTarget) => {
        if (!user) return;
        setSending(target.id);

        try {
            // Fetch vendor details
            const { data: vendor } = await supabase
                .from('vendors')
                .select('business_name, logo_url, category, location, description')
                .eq('id', vendorId)
                .single();

            if (!vendor) throw new Error("Vendor not found");

            const shareData = {
                vendorId,
                name: vendor.business_name,
                logoUrl: vendor.logo_url,
                category: vendor.category,
                location: vendor.location,
                description: vendor.description,
                type: 'VENDOR'
            };

            const messageContent = `VENDOR_SHARE::${JSON.stringify(shareData)}`;

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
                // Assuming project_messages exist
                await supabase.from('project_messages' as any).insert({
                    project_id: target.id,
                    user_id: user.id,
                    content: messageContent
                });
            } else if (target.type === 'space') {
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
            toast({ title: "Sent", description: `Shared with ${target.name}` });

        } catch (error) {
            console.error("Error sending:", error);
            toast({ title: "Error", description: "Failed to share.", variant: "destructive" });
        } finally {
            setSending(null);
        }
    };

    const handleCopyLink = async () => {
        const shareUrl = `${window.location.origin}/vendors/${vendorId}`;
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Copied", description: "Link copied to clipboard" });
        onOpenChange(false);
    };

    const handleSystemShare = async () => {
        const shareUrl = `${window.location.origin}/vendors/${vendorId}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Check out this vendor on CineCraft', url: shareUrl });
            } catch (err) {
                console.error("Share failed", err);
            }
        } else {
            handleCopyLink();
        }
    };

    // Search logic similar to MarketplaceShareSheet
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

    const displayTargets = searchQuery.trim() ? searchResults : targets; // Simplification


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
                                            {(target.type === 'project' || target.type === 'space') ? <Film className="h-5 w-5" /> :
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
                                    className={sentTo.has(target.id) ? "text-primary" : "bg-primary hover:bg-primary/90"}
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
                        <DialogTitle className="text-center">Share Vendor</DialogTitle>
                        <DialogDescription className="sr-only">
                            Share this vendor with your connections or projects.
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
                    <DrawerTitle className="text-center">Share Vendor</DrawerTitle>
                    <DrawerDescription className="sr-only">
                        Share this vendor with your connections or projects.
                    </DrawerDescription>
                </DrawerHeader>
                {Content}
            </DrawerContent>
        </Drawer>
    );
}

