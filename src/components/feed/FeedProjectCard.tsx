import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Film, MoreVertical, Trash2, ExternalLink, MessageSquare, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { cn } from "@/lib/utils";
import { getOptimizedImage } from '@/utils/image-optimization';
import { LazyImage } from '@/components/performance/LazyImage';
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

interface FeedProjectCardProps {
    project: {
        id: string;
        title: string;
        description: string | null;
        status: string | null;
        location: string | null;
        created_at: string;
        project_space_type?: 'public' | 'private' | 'secret';
        genre?: string[] | null;
        image_url?: string | null;
        creator_id?: string;
        creator?: {
            full_name: string | null;
            avatar_url: string | null;
        };
    };
    onDismiss?: (id: string) => void;
}

const FeedProjectCard = ({ project, onDismiss }: FeedProjectCardProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { unreadProjectIds } = useUnreadMessages();
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const hasUnread = unreadProjectIds.includes(project.id);
    const isOwner = user?.id === project.creator_id;
    // Default cinematic placeholder image if none exists
    const displayImage = project.image_url || "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80";

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', project.id);

            if (error) throw error;

            toast({
                title: "Project Deleted",
                description: "The project has been permanently removed.",
            });
        } catch (error) {
            console.error('Error deleting project:', error);
            toast({
                title: "Error",
                description: "Failed to delete project. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
            setIsDeleteOpen(false);
        }
    };

    return (
        <div className="group bg-white dark:bg-card border border-border/50 rounded-[20px] overflow-hidden shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative">
            {/* Unread Message Indicator Overlay */}
            {hasUnread && (
                <div className={cn(
                    "absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-red-500/30 animate-in zoom-in slide-in-from-right-4 duration-500",
                    onDismiss && "right-12"
                )}>
                    <MessageSquare className="h-3 w-3 fill-current" />
                    New Activity
                    <span className="flex h-2 w-2 rounded-full bg-white animate-pulse" />
                </div>
            )}

            {onDismiss && (
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDismiss(project.id);
                    }}
                    className="absolute top-4 right-4 z-30 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/10 hover:border-white/20"
                    title="Dismiss suggestion"
                >
                    <X size={14} strokeWidth={3} />
                </button>
            )}

            <Link to={`/projects/${project.id}/space`} className="block relative aspect-[16/10] overflow-hidden">
                <LazyImage 
                    src={getOptimizedImage(displayImage, { width: 800, quality: 85 })} 
                    alt={project.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Status Badge */}
                <div className="absolute bottom-4 left-4">
                    <span className="font-mono px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-white shadow-lg border border-white/20">
                        STATUS // {project.status || 'Active'}
                    </span>
                </div>
            </Link>

            <div className="p-6 space-y-4 text-left">
                <div className="space-y-2">
                    <Link to={`/projects/${project.id}/space`} className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-lg font-bold text-foreground hover:text-primary transition-colors leading-tight tracking-tight">
                            {project.title}
                        </h3>
                    </Link>
                    <p className="text-xs text-muted-foreground/90 font-medium leading-relaxed line-clamp-2">
                        {project.description || 'No description provided.'}
                    </p>
                </div>

                <div className="flex flex-col gap-1.5 py-1">
                    <div className="flex items-center gap-2 text-foreground/80 font-medium min-w-0">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="font-mono text-[9px] font-bold tracking-widest uppercase bg-muted/10 border border-border/40 px-1.5 py-0.5 rounded truncate w-full">LOC // {project.location || 'Remote'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-foreground/80 font-medium min-w-0">
                        <Film className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="font-mono text-[9px] font-bold tracking-widest uppercase bg-muted/10 border border-border/40 px-1.5 py-0.5 rounded truncate w-full">GENRE // {project.genre?.[0] || 'Uncategorized'}</span>
                    </div>
                </div>

                <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        {(() => {
                            try {
                                const d = project.created_at ? new Date(project.created_at) : new Date();
                                return isNaN(d.getTime()) ? "Just now" : formatDistanceToNow(d, { addSuffix: true });
                            } catch {
                                return "Just now";
                            }
                        })()}
                    </span>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors">
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50 bg-background/95 backdrop-blur-xl">
                            <DropdownMenuItem asChild>
                                <Link to={`/projects/${project.id}/space`} className="flex items-center gap-2 cursor-pointer">
                                    <ExternalLink className="h-4 w-4" />
                                    <span>Enter Workspace</span>
                                </Link>
                            </DropdownMenuItem>
                            
                            {isOwner && (
                                <>
                                    <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-500/10" onClick={() => setIsDeleteOpen(true)}>
                                        <Trash2 className="h-4 w-4" />
                                        <span>Delete Project</span>
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent className="rounded-[24px] border-none bg-background/95 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black tracking-tight">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-medium text-muted-foreground">
                            This action cannot be undone. This will permanently delete your project
                            and remove all associated data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-border/50">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-500/20"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Permanently Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default FeedProjectCard;





