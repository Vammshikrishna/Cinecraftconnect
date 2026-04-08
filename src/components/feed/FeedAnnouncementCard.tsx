import { useState } from 'react';
import { Megaphone, Clock, Share2, Calendar, MoreVertical, Edit, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormattedText } from "@/components/ui/formatted-text";
import { JobShareCard } from "@/components/chat/JobShareCard";


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
}

import { AnnouncementShareSheet } from './AnnouncementShareSheet';

const FeedAnnouncementCard = ({ announcement }: FeedAnnouncementCardProps) => {
    const [isShareOpen, setIsShareOpen] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editTitle, setEditTitle] = useState(announcement.title);
    const [editContent, setEditContent] = useState(announcement.content.includes('JOB_SHARE::') ? announcement.content.split('JOB_SHARE::')[0].trim() : announcement.content);

    const isOwner = user?.id === announcement.author_id;

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening the dialog
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
            // Parent component should ideally listen to realtime changes or we need a reload/callback
            // For now relying on parent realtime listener (AnnouncementsTab has it)
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
        let finalContent = editContent.trim();
        
        // Preserve JOB_SHARE metadata if it exists
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
            // Update local state is tricky without parent callback or reloading.
            // But if we are in a list that uses realtime, it will update.
            // If not, we might view stale data until refresh.
            // We can force a local mutation of the prop object if we really wanted to (bad practice)
            // or we assume the parent handles it.
            // Let's assume parent handles it for now as AnnouncementsTab has realtime.
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
            <AnnouncementShareSheet
                isOpen={isShareOpen}
                onOpenChange={setIsShareOpen}
                announcement={announcement}
            />
            <Dialog>

                <DialogTrigger asChild>
                    <div className="relative h-full flex flex-col justify-between overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-card/40 backdrop-blur-xl transition-all duration-300 hover:border-orange-500/50 hover:shadow-[0_0_30px_-10px_rgba(249,115,22,0.3)] group cursor-pointer min-h-[220px]">
                        {/* Decorative gradient background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-red-500/5 opacity-100 transition-opacity duration-500 pointer-events-none" />

                        <div className="relative p-6 flex flex-col h-full z-10">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg ring-1 ring-white/20 group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                                    {announcement.company_pages?.logo_url ? (
                                        <img src={announcement.company_pages.logo_url} alt={announcement.company_pages.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Megaphone className="h-6 w-6 fill-white/20" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 leading-tight mb-1">
                                        {announcement.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}</span>
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
                                                {caption && <FormattedText text={caption} className="text-sm text-muted-foreground leading-relaxed" />}
                                                <JobShareCard {...shareData} />
                                            </div>
                                        );
                                    } catch (e) {
                                        return <FormattedText text={announcement.content} className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-6 flex-1" />;
                                    }
                                })()
                            ) : (
                                <FormattedText 
                                    text={announcement.content} 
                                    className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-6 flex-1" 
                                />
                            )}

                            {isOwner && (
                                <div className="absolute top-4 right-4 z-20" onClick={(e) => e.stopPropagation()}>
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
                </DialogTrigger>

                <DialogContent className="sm:max-w-lg overflow-hidden border-none shadow-2xl bg-background/95 backdrop-blur-2xl p-0 gap-0">
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-orange-500/20 to-red-600/20 z-0 pointer-events-none" />

                    <DialogHeader className="p-8 pb-4 z-10 relative">
                        <div className="flex items-center gap-6">
                            <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-xl text-white transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                                <Megaphone className="h-8 w-8 fill-white/20" />
                            </div>
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <DialogTitle className="text-3xl font-extrabold tracking-tight leading-tight text-foreground line-clamp-2">
                                    {announcement.title}
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Details for {announcement.title}
                                </DialogDescription>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-muted-foreground/80">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="h-4 w-4 text-orange-500" />
                                        <span>{format(new Date(announcement.created_at), "PPP")}</span>
                                    </div>
                                    <div className="hidden sm:block w-1 h-1 rounded-full bg-border" />
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-4 w-4 text-orange-500" />
                                        <span>{formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 pt-4 text-base leading-relaxed text-foreground/90 z-10 relative max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {announcement.content.includes('JOB_SHARE::') ? (
                            (() => {
                                try {
                                    const parts = announcement.content.split('JOB_SHARE::');
                                    const caption = parts[0].trim();
                                    const jsonStr = parts[parts.length - 1].trim();
                                    const shareData = JSON.parse(jsonStr);
                                    return (
                                        <div className="space-y-4">
                                            {caption && <FormattedText text={caption} className="text-base leading-relaxed" />}
                                            <JobShareCard {...shareData} />
                                        </div>
                                    );
                                } catch (e) {
                                    return <FormattedText text={announcement.content} className="text-base leading-relaxed" />;
                                }
                            })()
                        ) : (
                            <FormattedText text={announcement.content} className="text-base leading-relaxed" />
                        )}
                    </div>

                    <DialogFooter className="p-6 pt-4 bg-muted/30 z-10 relative flex flex-row flex-wrap gap-2 justify-end">
                        {isOwner && (
                            <>
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        // Need to close the current dialog first or use controlled state
                                        // But usually opening the edit dialog on top is fine.
                                        setIsEditOpen(true);
                                    }} 
                                    className="gap-2 border-orange-500/20 hover:bg-orange-500/10 hover:text-orange-600"
                                >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => setIsDeleteOpen(true)} 
                                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </Button>
                            </>
                        )}
                        <Button variant="outline" onClick={handleShare} className="gap-2">
                            <Share2 className="h-4 w-4" />
                            Share
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Announcement</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="Announcement Title"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Content</label>
                            <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder="Content"
                                rows={5}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdate} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your announcement.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default FeedAnnouncementCard;
