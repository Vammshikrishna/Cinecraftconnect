import { useState, useEffect } from 'react';
import { Megaphone, Clock, Share2, MoreVertical, Edit, Trash2, Loader2, X, Youtube, Play } from 'lucide-react';
import { SiSpotify } from 'react-icons/si';
import { formatDistanceToNow } from 'date-fns';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppRole } from "@/hooks/useAppRole";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormattedText } from "@/components/ui/formatted-text";
import { JobShareCard } from "@/components/chat/JobShareCard";
import { UniversalShareSheet } from "@/components/common/UniversalShareSheet";
import { getOptimizedImage } from '@/utils/image-optimization';
import { LazyImage } from '@/components/performance/LazyImage';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { cn } from "@/lib/utils";

const getYouTubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const extractYouTubeIdFromText = (text: string): string | null => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  if (!matches) return null;
  for (const url of matches) {
    const videoId = getYouTubeId(url);
    if (videoId) return videoId;
  }
  return null;
};

const extractSpotifyInfoFromText = (text: string): { embedUrl: string, originalUrl: string } | null => {
  if (!text) return null;
  // Match Spotify track, album, playlist, episode, or show URLs
  const match = text.match(/https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (match) {
    return {
      embedUrl: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`,
      originalUrl: match[0]
    };
  }
  return null;
};

const SpotifyBanner = ({ originalUrl }: { originalUrl: string }) => {
    const [data, setData] = useState<{ thumbnail_url?: string, title?: string, author_name?: string } | null>(null);

    useEffect(() => {
        fetch(`https://open.spotify.com/oembed?url=${originalUrl}`)
            .then(res => res.json())
            .then(d => setData(d))
            .catch(err => console.error("Error fetching Spotify oEmbed", err));
    }, [originalUrl]);

    if (!data || !data.thumbnail_url) return null;

    return (
        <div 
            className="relative h-40 w-full rounded-2xl overflow-hidden mb-4 shadow-xl border border-white/5 shrink-0 group/video cursor-pointer flex items-center p-4 gap-4"
            onClick={() => window.open(originalUrl, '_blank')}
        >
            <div className="absolute inset-0 z-0">
                <img 
                    src={data.thumbnail_url} 
                    className="w-full h-full object-cover blur-2xl brightness-[0.4] transform scale-125" 
                    alt="" 
                />
            </div>
            
            <div className="absolute inset-0 bg-white/0 z-10 transition-colors duration-300 group-hover/video:bg-white/5" />

            <div className="relative z-20 h-24 w-24 sm:h-28 sm:w-28 shrink-0 rounded-md overflow-hidden shadow-2xl border border-white/10">
                <img 
                    src={data.thumbnail_url}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/video:scale-105"
                    alt={data.title || "Spotify Cover"}
                />
            </div>

            <div className="relative z-20 flex flex-col justify-center h-full flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 opacity-90">
                    <SiSpotify className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1DB954]" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white">
                        Spotify
                    </span>
                </div>
                <h3 className="text-white font-black text-lg sm:text-2xl line-clamp-2 leading-tight tracking-tight drop-shadow-md">
                    {data.title}
                </h3>
                {data.author_name && (
                    <p className="text-white/80 font-medium text-xs sm:text-sm mt-1 line-clamp-1 drop-shadow-sm">
                        {data.author_name}
                    </p>
                )}
            </div>
            
            <div className="absolute right-6 z-20 opacity-0 transform translate-x-4 transition-all duration-300 group-hover/video:opacity-100 group-hover/video:translate-x-0 hidden sm:flex">
                <div className="w-12 h-12 rounded-full bg-[#1DB954] flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                    <Play className="w-5 h-5 text-black ml-1 fill-black" />
                </div>
            </div>
        </div>
    );
};

interface FeedAnnouncementCardProps {
    announcement: {
        id: string;
        title: string;
        content: string;
        created_at: string;
        author_id?: string | null;
        publisher_page_id?: string | null;
        company_pages?: {
            id: string;
            name: string;
            logo_url: string;
            slug: string;
        } | null;
        profiles?: {
            full_name: string | null;
            username: string | null;
        } | null;
    };
    onDismiss?: (id: string) => void;
    isWidget?: boolean;
}

const FeedAnnouncementCard = ({ announcement, onDismiss, isWidget }: FeedAnnouncementCardProps) => {
    const { push } = useAppNavigation();
    const [isShareOpen, setIsShareOpen] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editTitle, setEditTitle] = useState(announcement.title);
    const [editContent, setEditContent] = useState(announcement.content.includes('JOB_SHARE::') ? announcement.content.split('JOB_SHARE::')[0].trim() : announcement.content);
    const { isAdmin } = useAppRole();
    const canManage = user?.id === announcement.author_id || isAdmin;
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const youtubeVideoId = extractYouTubeIdFromText(announcement.content);
    const spotifyInfo = extractSpotifyInfoFromText(announcement.content);

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsShareOpen(true);
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', announcement.id);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Announcement deleted successfully",
            });
        } catch (error) {
            console.error('Error deleting announcement:', error);
            toast({
                title: "Error",
                description: "Failed to delete announcement",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
        }
    };

    const handleUpdate = async () => {
        setIsSaving(true);
        let finalContent = editContent.trim();

        if (announcement.content.includes('JOB_SHARE::')) {
            const parts = announcement.content.split('JOB_SHARE::');
            const jsonPart = parts[parts.length - 1];
            finalContent = finalContent ? `${finalContent}\n\nJOB_SHARE::${jsonPart}` : `JOB_SHARE::${jsonPart}`;
        }

        try {
            const { error } = await supabase
                .from('announcements')
                .update({
                    title: editTitle,
                    content: finalContent
                })
                .eq('id', announcement.id);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Announcement updated successfully",
            });
            setIsEditOpen(false);
        } catch (error) {
            console.error('Error updating announcement:', error);
            toast({
                title: "Error",
                description: "Failed to update announcement",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <UniversalShareSheet
                isOpen={isShareOpen}
                onOpenChange={setIsShareOpen}
                shareType="announcement"
                shareId={announcement.id}
                shareData={{
                    id: announcement.id,
                    title: announcement.title,
                    content: announcement.content,
                    created_at: announcement.created_at,
                    author: announcement.profiles,
                    company: announcement.company_pages
                }}
            />

            <div className="glass-card-premium h-[420px] flex flex-col transition-transform duration-500 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5 opacity-40 transition-opacity duration-500 pointer-events-none" />

                <div className="relative p-6 flex flex-col h-full z-10">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg ring-1 ring-white/20 group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                            {announcement.company_pages?.logo_url ? (
                                <LazyImage src={getOptimizedImage(announcement.company_pages.logo_url, { width: 96, height: 96 })} alt={announcement.company_pages.name} className="w-full h-full object-cover" />
                            ) : (
                                <Megaphone className="h-6 w-6 fill-white/20" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0 pr-16">
                            <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 leading-tight mb-1">
                                {announcement.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                                <Clock className="h-3 w-3" />
                                <span>
                                    {(() => {
                                        try {
                                            const date = announcement.created_at ? new Date(announcement.created_at) : new Date();
                                            return isNaN(date.getTime()) ? "Just now" : formatDistanceToNow(date, { addSuffix: true });
                                        } catch {
                                            return "Just now";
                                        }
                                    })()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {announcement.content.includes('JOB_SHARE::') ? (
                        (() => {
                            try {
                                const parts = announcement.content.split('JOB_SHARE::');
                                const caption = parts[0].trim();
                                const jsonStr = parts[parts.length - 1].trim();
                                const shareData = JSON.parse(jsonStr);
                                return (
                                    <div className="mb-6 space-y-3">
                                        {caption && (
                                            <div className="flex flex-col">
                                                <FormattedText 
                                                    text={caption} 
                                                    className="text-sm text-muted-foreground leading-relaxed line-clamp-6"
                                                />
                                                {caption.length > 200 && (
                                                    <button
                                                        onClick={() => setIsDetailsOpen(true)}
                                                        className="text-xs font-black text-orange-500 hover:underline mt-1 text-left select-none outline-none cursor-pointer"
                                                    >
                                                        Read More
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {isWidget ? (
                                            <JobShareCard {...shareData} compact={true} className="w-full" />
                                        ) : (
                                            <JobShareCard {...shareData} className="w-full max-w-[450px]" />
                                        )}
                                    </div>
                                );
                            } catch (e) {
                                return (
                                    <div className="flex flex-col mb-6">
                                        <FormattedText 
                                            text={announcement.content} 
                                            className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-6"
                                        />
                                        {announcement.content.length > 200 && (
                                            <button
                                                onClick={() => setIsDetailsOpen(true)}
                                                className="text-xs font-black text-orange-500 hover:underline mt-1 text-left select-none outline-none cursor-pointer"
                                            >
                                                Read More
                                            </button>
                                        )}
                                    </div>
                                );
                            }
                        })()
                    ) : (
                        <div className="flex flex-col flex-1 mb-6 min-h-0">
                            <FormattedText
                                text={announcement.content}
                                className={cn("text-sm text-muted-foreground leading-relaxed", youtubeVideoId ? "line-clamp-3" : "line-clamp-[10]")}
                            />
                            {announcement.content.length > 200 && (
                                <button
                                    onClick={() => setIsDetailsOpen(true)}
                                    className="text-xs font-black text-orange-500 hover:underline mt-1.5 text-left select-none outline-none cursor-pointer"
                                >
                                    Read More
                                </button>
                            )}
                        </div>
                    )}

                    {youtubeVideoId && (
                        <div 
                            className="relative h-40 w-full rounded-xl overflow-hidden mb-4 shadow-md border border-black/10 dark:border-white/10 shrink-0 group/video cursor-pointer"
                            onClick={() => setIsDetailsOpen(true)}
                        >
                            <img 
                                src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`}
                                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover/video:scale-105"
                                alt="YouTube Video Thumbnail"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover/video:bg-black/20">
                                <svg className="w-12 h-12 drop-shadow-lg transform transition-transform group-hover/video:scale-110" viewBox="0 0 68 48">
                                    <path className="fill-[#ff0000]" d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"></path>
                                    <path className="fill-white" d="M 45,24 27,14 v 20 z"></path>
                                </svg>
                            </div>
                        </div>
                    )}

                    {spotifyInfo && !youtubeVideoId && (
                        <SpotifyBanner originalUrl={spotifyInfo.originalUrl} />
                    )}
                    
                    {(canManage || onDismiss) && (
                        <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
                            {canManage && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="text-red-600 focus:text-red-600">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            {onDismiss && (
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onDismiss(announcement.id);
                                    }}
                                    className="h-8 w-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                                    title="Dismiss suggestion"
                                >
                                    <X size={14} strokeWidth={2.5} />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-black/5 dark:border-white/5 mt-auto">
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-1 rounded-md">
                            {announcement.company_pages?.name || (announcement.profiles?.full_name || announcement.profiles?.username) || 'Official Announcement'}
                        </span>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                            onClick={handleShare}
                        >
                            <Share2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Edit Drawer */}
            <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DrawerContent className="bg-background/95 backdrop-blur-3xl border-none rounded-t-[32px] max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle className="text-xl font-black text-center">Edit Announcement</DrawerTitle>
                    </DrawerHeader>
                    <div className="space-y-6 px-6 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Title</label>
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="bg-primary/5 border-none focus-visible:ring-2 focus-visible:ring-primary h-12 rounded-2xl font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Content</label>
                            <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={6}
                                className="bg-primary/5 border-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl font-medium resize-none"
                            />
                        </div>
                    </div>
                    <DrawerFooter className="px-6 pb-12 pt-4">
                        <Button onClick={handleUpdate} disabled={isSaving} className="h-14 rounded-2xl bg-primary font-black text-lg shadow-xl shadow-primary/20">
                            {isSaving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Update Announcement
                        </Button>
                        <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="h-12 rounded-2xl font-bold text-muted-foreground">
                            Cancel
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            {/* Delete Confirmation Drawer */}
            <Drawer open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DrawerContent className="bg-background border-none rounded-t-[32px]">
                    <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/40 my-4" />
                    <DrawerHeader>
                        <DrawerTitle className="text-xl font-black text-center text-red-500">Delete Announcement?</DrawerTitle>
                        <p className="text-center text-muted-foreground text-sm font-medium mt-1">This action is permanent and cannot be reversed.</p>
                    </DrawerHeader>
                    <DrawerFooter className="px-6 pb-12 pt-6">
                        <Button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black text-lg shadow-xl shadow-red-500/20"
                        >
                            {isDeleting ? "Deleting..." : "Yes, Delete Announcement"}
                        </Button>
                        <Button variant="ghost" onClick={() => setIsDeleteOpen(false)} className="h-12 rounded-2xl font-bold">
                            Keep it
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
            {/* Details Drawer */}
            <Drawer open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DrawerContent className="bg-background/95 backdrop-blur-3xl border border-border/10 dark:border-white/5 rounded-t-[32px] max-h-[90vh] max-w-3xl mx-auto left-0 right-0">
                    <div className="mx-auto w-full max-w-3xl flex flex-col h-full">
                        <DrawerHeader className="px-6 flex items-start gap-4 text-left">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg ring-1 ring-white/20 overflow-hidden">
                                {announcement.company_pages?.logo_url ? (
                                    <LazyImage src={getOptimizedImage(announcement.company_pages.logo_url, { width: 96, height: 96 })} alt={announcement.company_pages.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Megaphone className="h-6 w-6 fill-white/20" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <DrawerTitle className="text-xl font-black text-foreground leading-tight">{announcement.title}</DrawerTitle>
                                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-md mt-1.5 inline-block">
                                    {announcement.company_pages?.name || (announcement.profiles?.full_name || announcement.profiles?.username) || 'Official Announcement'}
                                </span>
                            </div>
                        </DrawerHeader>
                        <div className="px-6 py-4 overflow-y-auto space-y-6 max-h-[50vh] scrollbar-thin flex-1">
                            {announcement.content.includes('JOB_SHARE::') ? (
                                (() => {
                                    try {
                                        const parts = announcement.content.split('JOB_SHARE::');
                                        const caption = parts[0].trim();
                                        const jsonStr = parts[parts.length - 1].trim();
                                        const shareData = JSON.parse(jsonStr);
                                        return (
                                            <div className="space-y-4">
                                                {caption && <FormattedText text={caption} className="text-sm text-foreground leading-relaxed" />}
                                                <JobShareCard {...shareData} className="w-full animate-in zoom-in-95 duration-200" />
                                            </div>
                                        );
                                    } catch (e) {
                                        return <FormattedText text={announcement.content} className="text-sm text-foreground leading-relaxed" />;
                                    }
                                })()
                            ) : (
                                <FormattedText text={announcement.content} className="text-sm text-foreground leading-relaxed" />
                            )}

                            {youtubeVideoId && (
                                <div className="relative aspect-video w-full rounded-2xl overflow-hidden shadow-xl border border-black/10 dark:border-white/10 shrink-0">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                                        title="YouTube video player"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                        className="absolute inset-0 w-full h-full border-none"
                                    />
                                </div>
                            )}

                            {spotifyInfo && !youtubeVideoId && (
                                <div className="mt-8 max-w-2xl mx-auto w-full">
                                    <SpotifyBanner originalUrl={spotifyInfo.originalUrl} />
                                </div>
                            )}
                        </div>
                        <DrawerFooter className="px-6 pb-12 pt-4 shrink-0">
                            <Button variant="secondary" onClick={() => setIsDetailsOpen(false)} className="h-14 rounded-2xl font-black text-lg bg-primary/10 text-primary border-none hover:bg-primary/20">
                                Close Details
                            </Button>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
};

export default FeedAnnouncementCard;
