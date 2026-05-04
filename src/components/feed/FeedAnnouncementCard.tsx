import { useState } from 'react';
import { Megaphone, Clock, Share2, MoreVertical, Edit, Trash2, Loader2, X } from 'lucide-react';
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
import { AnnouncementShareSheet } from './AnnouncementShareSheet';
import { getOptimizedImage } from '@/utils/image-optimization';

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
}

const FeedAnnouncementCard = ({ announcement, onDismiss }: FeedAnnouncementCardProps) => {
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
            <AnnouncementShareSheet
                isOpen={isShareOpen}
                onOpenChange={setIsShareOpen}
                announcement={announcement}
            />

            <div className="glass-card-premium min-h-[220px] transition-transform duration-500 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5 opacity-40 transition-opacity duration-500 pointer-events-none" />

                <div className="relative p-6 flex flex-col h-full z-10">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg ring-1 ring-white/20 group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                            {announcement.company_pages?.logo_url ? (
                                <img src={getOptimizedImage(announcement.company_pages.logo_url, { width: 96, height: 96 })} alt={announcement.company_pages.name} className="w-full h-full object-cover" />
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
                                        {caption && <FormattedText text={caption} className="text-sm text-muted-foreground leading-relaxed" />}
                                        <JobShareCard {...shareData} />
                                    </div>
                                );
                            } catch (e) {
                                return <FormattedText text={announcement.content} className="text-sm text-muted-foreground leading-relaxed line-clamp-6 mb-6 flex-1" />;
                            }
                        })()
                    ) : (
                        <FormattedText
                            text={announcement.content}
                            className="text-sm text-muted-foreground leading-relaxed line-clamp-6 mb-6 flex-1"
                        />
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
                    <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/40 my-4" />
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
        </>
    );
};

export default FeedAnnouncementCard;
