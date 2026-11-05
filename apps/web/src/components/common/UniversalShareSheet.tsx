import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Search, Link as LinkIcon, Film, MessageSquare, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useConnections } from "@/hooks/useConnections";
import { copyToClipboard, getAppOrigin } from "@/lib/utils/share";
import { useAccountType } from "@/hooks/useAccountType";
import { generateDirectRoomId } from "@/lib/chat-utils";
import { friendlyError, loadContactSignals, contactScore } from '@cinecraft/core';
import { ShareIcon } from '@/components/icons/ShareIcon';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAppRole } from '@/hooks/useAppRole';

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
    /** when the last message in this chat, room or space was sent; used to put the busiest first */
    lastAt?: string | null;
}

const byName = (a: ShareTarget, b: ShareTarget) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const byActivity = (a: ShareTarget, b: ShareTarget) => (b.lastAt || '').localeCompare(a.lastAt || '') || byName(a, b);

/** How well a name matches what was typed: exact, starts with, a word starts with, contains. Lower is better. */
const matchRank = (text: string, q: string): number => {
    const t = text.toLowerCase();
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    if (t.split(/[\s._-]+/).some((w) => w.startsWith(q))) return 2;
    if (t.includes(q)) return 3;
    return 99;
};

export function UniversalShareSheet({ isOpen, onOpenChange, shareType, shareId, shareData }: UniversalShareSheetProps) {
    // "To feed" opens Create Post with the job card attached, so every post option is available (it used to post at once)
    const { push } = useAppNavigation();
    const { isInternal: isStaffAccount } = useAppRole();   // staff accounts cannot create posts, so they do not get "To feed"
    const [searchQuery, setSearchQuery] = useState("");
    const [targets, setTargets] = useState<ShareTarget[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Map<string, ShareTarget>>(new Map());
    const [activeTab, setActiveTab] = useState("connections");
    const { user } = useAuth();
    const { isFan } = useAccountType();
    const { toast } = useToast();
    const { connections } = useConnections();
    const isDesktop = useMediaQuery("(min-width: 768px)");

    const typeLabel = 
        shareType === 'room' ? 'Discussion' :
        shareType === 'marketplace' ? 'Listing' :
        shareType === 'company' ? 'Company' :
        shareType.charAt(0).toUpperCase() + shareType.slice(1);
    const titleText = 'Share';
    const keyOf = (t: ShareTarget) => `${t.type}-${t.id}`;

    useEffect(() => {
        if (isOpen && user) {
            fetchTargets();
        }
    }, [isOpen, user, connections]);

    // every time the sheet opens it starts clean
    useEffect(() => {
        if (isOpen) {
            setSelected(new Map());
            setSentTo(new Set());
            setSearchQuery('');
        }
    }, [isOpen]);

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

            // 1. People, ranked like a social app: how often and how recently I message them, whose posts I like or
            //    comment on, whose profile I visit, who I follow, and my connections
            const signals = await loadContactSignals(supabase, user.id);
            const profiles = new Map<string, { name: string; avatar: string | null; subtitle?: string }>();

            ((recentConvosRes.data as any[]) || []).forEach((c: any) => {
                if (c.other_user_id) profiles.set(c.other_user_id, { name: c.other_user_full_name || 'Unknown', avatar: c.other_user_avatar_url || null });
            });
            (connections || []).forEach((conn: any) => {
                const profile = conn.follower_id === user.id ? conn.following_profile : conn.follower_profile;
                if (!profile) return;
                profiles.set(profile.id, { name: profile.full_name || profile.username || 'Unknown', avatar: profile.avatar_url || null });
                const sig = signals.get(profile.id) || { id: profile.id, messages: 0, lastMessageAt: null, unreadFromThem: 0, likes: 0, comments: 0, views: 0, iFollow: false, followsMe: false, isConnection: false };
                sig.isConnection = true;
                signals.set(profile.id, sig);
            });

            const top = [...signals.values()]
                .map((sig) => ({ sig, score: contactScore(sig) }))
                .filter((x) => x.score > 0 && x.sig.id !== user.id)
                .sort((x, y) => y.score - x.score)
                .slice(0, 40);

            // people I follow or interact with who are not in a chat or connection yet need their profile loaded
            const missing = top.map((x) => x.sig.id).filter((id) => !profiles.has(id));
            if (missing.length > 0) {
                const { data: extra } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', missing);
                (extra || []).forEach((p: any) => profiles.set(p.id, { name: p.full_name || p.username || 'Unknown', avatar: p.avatar_url || null }));
            }

            const addedUserIds = new Set<string>();
            top.forEach(({ sig }) => {
                const p = profiles.get(sig.id);
                if (!p || addedUserIds.has(sig.id)) return;
                addedUserIds.add(sig.id);
                newTargets.push({
                    id: sig.id,
                    name: p.name,
                    avatar_url: p.avatar,
                    type: 'user',
                    subtitle: sig.messages > 0 ? 'Recent Interaction' : sig.isConnection ? 'Connection' : sig.iFollow ? 'Following' : 'Suggested',
                    lastAt: sig.lastMessageAt
                });
            });

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
                    .select('id, name, projects!inner(title, image_url)')
                    .in('id', allSpaceIds);

                if (spacesData) {
                    spacesData.forEach((space: any) => {
                        const project = Array.isArray(space.projects) ? space.projects[0] : space.projects;
                        const projectTitle = project?.title;
                        if (projectTitle) {
                            newTargets.push({
                                id: space.id,
                                name: projectTitle,
                                avatar_url: project?.image_url || null,
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

            // busiest rooms and project spaces first (people keep the order above)
            const roomIds = uniqueTargets.filter((t) => t.type === 'room').map((t) => t.id);
            const spaceIds = uniqueTargets.filter((t) => t.type === 'project').map((t) => t.id);
            const [roomActivity, spaceActivity] = await Promise.all([
                roomIds.length ? supabase.from('room_messages').select('room_id, created_at').in('room_id', roomIds).order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] as any[] }),
                spaceIds.length ? supabase.from('project_space_messages').select('project_space_id, created_at').in('project_space_id', spaceIds).order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] as any[] }),
            ]);
            const latest = new Map<string, string>();
            ((roomActivity as any).data || []).forEach((r: any) => { if (!latest.has(r.room_id)) latest.set(r.room_id, r.created_at); });
            ((spaceActivity as any).data || []).forEach((r: any) => { if (!latest.has(r.project_space_id)) latest.set(r.project_space_id, r.created_at); });
            uniqueTargets.forEach((t) => { if (t.type !== 'user') t.lastAt = latest.get(t.id) || null; });

            setTargets([
                ...uniqueTargets.filter((t) => t.type === 'user'),
                ...uniqueTargets.filter((t) => t.type === 'project').sort(byActivity),
                ...uniqueTargets.filter((t) => t.type === 'room').sort(byActivity),
            ]);
        } catch (error) {
            console.error("Error in fetchTargets:", error);
        } finally {
            setLoading(false);
        }
    };

    // sends the shared item to one person, room or project space; throws if the database refuses it
    const sendOne = async (target: ShareTarget) => {
        if (!user) return;
        const prefix = shareType === 'room' ? 'DISCUSSION_SHARE::' : `${shareType.toUpperCase()}_SHARE::`;

        // Defensive check: Ensure shares always have an identifier in shareData
        const finalShareData = { ...shareData };
        if (!finalShareData.id) finalShareData.id = shareId;

        // Wishlists have no chat card (a WISHLIST_SHARE:: message would show as raw JSON), so they go as a readable message with the link.
        const messageContent = shareType === 'wishlist'
            ? `${shareData?.title || 'Gear wishlist'}
${getAppOrigin()}/marketplace/wishlist/shared/${shareId}`
            : `${prefix}${JSON.stringify(finalShareData)}`;

        if (target.type === 'user') {
            const channelId = generateDirectRoomId(user.id, target.id);
            const { error: dmError } = await supabase.from('direct_messages').insert({
                content: messageContent,
                sender_id: user.id,
                channel_id: channelId,
                receiver_id: target.id
            });
            if (dmError) throw dmError;

            // Dispatch local event for instant UI update
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
            const { error: spaceError } = await supabase.from('project_space_messages').insert({
                project_space_id: target.id,
                user_id: user.id,
                content: messageContent
            });
            if (spaceError) throw spaceError;
        } else if (target.type === 'room') {
            const { error: roomError } = await supabase.from('room_messages').insert({
                room_id: target.id,
                user_id: user.id,
                content: messageContent
            });
            if (roomError) throw roomError;
        }
    };

    // the Send button: everyone selected gets it; the ones that worked are marked, the rest stay selected to retry
    const handleSendSelected = async () => {
        if (!user || selected.size === 0) return;
        setSending('batch');
        const items = [...selected.values()];
        const results = await Promise.allSettled(items.map(sendOne));
        const done = items.filter((_, i) => results[i].status === 'fulfilled');
        const firstFailure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;

        if (done.length > 0) {
            setSentTo((prev) => { const n = new Set(prev); done.forEach((t) => n.add(t.id)); return n; });
            setSelected((prev) => { const n = new Map(prev); done.forEach((t) => n.delete(keyOf(t))); return n; });
            toast({ title: 'Sent', description: done.length === 1 ? `Shared to ${done[0].name}` : `Shared to ${done.length} chats` });
        }
        if (firstFailure) {
            console.error('Error sending:', firstFailure.reason);
            toast({ title: 'Could not share', description: friendlyError(firstFailure.reason, 'Please try again.'), variant: 'destructive' });
        }
        setSending(null);
    };

    const toggleSelected = (t: ShareTarget) => {
        if (sentTo.has(t.id)) return;
        setSelected((prev) => {
            const n = new Map(prev);
            const k = keyOf(t);
            if (n.has(k)) n.delete(k); else n.set(k, t);
            return n;
        });
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
                description: friendlyError(err, "Failed to publish announcement."),
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
            case 'wishlist': path = `/marketplace/wishlist/shared/${shareId}`; break;
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
            case 'wishlist': path = `/marketplace/wishlist/shared/${shareId}`; break;
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
                // % _ and , would change what the search means, so they are removed from what was typed
                const term = searchQuery.trim().replace(/[%_,()\\]/g, ' ').trim();
                if (!term) { setSearchResults([]); return; }
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, avatar_url')
                    .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
                    .limit(20);

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

    const q = searchQuery.trim().toLowerCase();
    const known = new Set(filteredTargets.map((t) => keyOf(t)));
    const displayTargetsRaw = q
        ? [
            // people I already chat with or know come before strangers; within each group the closest name match first
            ...filteredTargets,
            ...(activeTab === "connections" ? searchResults : []),
        ]
            .map((t) => ({ t, rank: Math.min(matchRank(t.name, q), t.subtitle?.startsWith('@') ? matchRank(t.subtitle.slice(1), q) : 99) }))
            .filter((x) => x.rank < 99)
            .sort((x, y) => x.rank - y.rank || Number(known.has(keyOf(y.t))) - Number(known.has(keyOf(x.t))) || byName(x.t, y.t))
            .map((x) => x.t)
        : filteredTargets;

    const displayTargets = displayTargetsRaw.filter((target, index, self) =>
        index === self.findIndex((t) => t.id === target.id && t.type === target.type)
    );

    const TABS: { id: string; label: string }[] = [
        { id: 'connections', label: 'People' },
        { id: 'discussions', label: 'Discussions' },
        ...(isFan ? [] : [{ id: 'projects', label: 'Projects' }]),
    ];
    const roundAction = 'h-12 w-12 rounded-full bg-muted hover:bg-muted/70 text-foreground grid place-items-center transition active:scale-90 disabled:opacity-50';

    const Content = (
        <div className="flex flex-col h-full overflow-hidden bg-background">
            <div className="px-4 pt-1 pb-3 space-y-3 shrink-0">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        placeholder="Search"
                        aria-label="Search people, rooms and projects"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 bg-muted border-transparent rounded-xl h-10 focus-visible:ring-1 focus-visible:ring-primary/40 font-medium"
                    />
                </div>

                {/* What to share to */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Share to">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold transition-colors',
                                activeTab === tab.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* people, rooms and projects as a grid of round pictures */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar min-h-0">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground" role="status">
                        <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <p className="text-[13px] font-medium">Loading</p>
                    </div>
                ) : displayTargets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                        <Search className="h-8 w-8 text-muted-foreground/40 mb-3" />
                        <p className="text-sm font-semibold text-foreground">No matches found</p>
                        <p className="text-[13px] text-muted-foreground mt-1">
                            {searchQuery.trim() ? 'Try a different name.' : activeTab === 'connections' ? 'Connect with people to share with them here.' : 'Nothing to show here yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-2 gap-y-3">
                        {displayTargets.map((target) => {
                            const isSel = selected.has(keyOf(target));
                            const isSent = sentTo.has(target.id);
                            return (
                                <button
                                    key={keyOf(target)}
                                    type="button"
                                    aria-pressed={isSel}
                                    disabled={isSent || sending === 'batch'}
                                    onClick={() => toggleSelected(target)}
                                    className="flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-default"
                                >
                                    <span className="relative">
                                        <Avatar className={cn('h-16 w-16 transition-[transform,box-shadow] duration-200', isSel && 'scale-95 ring-2 ring-primary ring-offset-2 ring-offset-background')}>
                                            <AvatarImage src={target.avatar_url || undefined} className="object-cover" />
                                            <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-lg">
                                                {target.type === 'project' ? <Film size={22} /> :
                                                    target.type === 'room' ? <MessageSquare size={22} /> :
                                                        (target.name[0] || '?').toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {(isSel || isSent) && (
                                            <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-background animate-in zoom-in-50 duration-150">
                                                <Check className="h-3 w-3" strokeWidth={3} />
                                            </span>
                                        )}
                                    </span>
                                    <span className="w-full text-[12px] leading-tight text-center text-foreground line-clamp-2 break-words">{target.name}</span>
                                    {isSent && <span className="text-xs text-muted-foreground -mt-1">Sent</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* bottom: Send once someone is picked, otherwise the other ways to share */}
            <div className="shrink-0 border-t border-border/60 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
                {selected.size > 0 ? (
                    <Button
                        className="w-full h-11 rounded-xl font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200"
                        disabled={sending === 'batch'}
                        onClick={handleSendSelected}
                    >
                        {sending === 'batch' ? 'Sending…' : selected.size === 1 ? 'Send' : `Send to ${selected.size}`}
                    </Button>
                ) : (
                    <div className="flex items-start justify-center gap-6 animate-in fade-in duration-200">
                        <button type="button" onClick={handleCopyLink} className="flex flex-col items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span className={roundAction}><LinkIcon className="h-5 w-5" /></span>
                            Copy link
                        </button>
                        <button type="button" onClick={handleSystemShare} className="flex flex-col items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span className={roundAction}><ShareIcon className="h-5 w-5" /></span>
                            Share via
                        </button>
                        {shareType === 'job' && !isFan && (
                            <>
                                {!isStaffAccount && (
                                <button type="button" onClick={() => { onOpenChange(false); push('/create', { sharedJob: { ...shareData, id: shareId, jobId: shareData?.jobId || shareId } }); }} className="flex flex-col items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <span className={roundAction}><MessageSquare className="h-5 w-5" /></span>
                                    To feed
                                </button>
                                )}
                                <button type="button" disabled={sending === 'announcement'} onClick={handleShareToAnnouncement} className="flex flex-col items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <span className={roundAction}><Search className="h-5 w-5" /></span>
                                    {sending === 'announcement' ? 'Sharing…' : 'Announce'}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="sm:max-w-[420px] h-[85vh] md:h-[600px] max-h-[85vh] flex flex-col p-0 gap-0 bg-background border-none shadow-2xl overflow-hidden rounded-2xl">
                    <DialogHeader className="px-6 pt-4 pb-3 text-center shrink-0">
                        <DialogTitle className="text-base font-semibold text-foreground">{titleText}</DialogTitle>
                        <DialogDescription className="sr-only">Share this content with your network</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                        {Content}
                    </div>
                </DialogContent>
            </Dialog>
            </>
        );
    }

    return (
        <>
        <Drawer 
            open={isOpen} 
            onOpenChange={onOpenChange}
            shouldScaleBackground
        >
            <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()} className="bg-background flex flex-col border-none rounded-t-2xl h-[78dvh] max-h-[92dvh] outline-none">
                <DrawerHeader className="pt-2 pb-2 text-center shrink-0">
                    <DrawerTitle className="text-base font-semibold text-foreground">{titleText}</DrawerTitle>
                    <DrawerDescription className="sr-only">Share this content with your network</DrawerDescription>
                </DrawerHeader>
                <div className="flex-1 overflow-hidden flex flex-col">
                    {Content}
                </div>
            </DrawerContent>
        </Drawer>
        </>
    );
}
