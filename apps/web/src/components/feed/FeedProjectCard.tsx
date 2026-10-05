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

    const rolesCount = Array.isArray((project as any).required_roles) ? (project as any).required_roles.length : 0;
    const genreRaw = project.genre as unknown;
    const genreText = Array.isArray(genreRaw) && genreRaw.length > 0
        ? genreRaw.map((g) => String(g).toUpperCase()).join(', ')
        : (typeof genreRaw === 'string' && genreRaw
            ? genreRaw.toUpperCase()
            : 'ACTION');
    const locationText = project.location || 'HYDERABAD, TELANGANA, IND';
    const statusText = (project.status || 'ACTIVE').toUpperCase();

    return (
        <div className="group bg-card text-card-foreground border border-border/70 rounded-[22px] p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:border-primary/40 flex flex-col justify-between relative">
            {/* Unread Message Indicator Overlay */}
            {hasUnread && (
                <div className={cn(
                    "absolute top-4 right-14 z-20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-tighter shadow-lg shadow-red-500/30 animate-in zoom-in slide-in-from-right-4 duration-500",
                    onDismiss && "right-20"
                )}>
                    <MessageSquare className="h-3 w-3 fill-current" />
                    New Activity
                    <span className="flex h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                </div>
            )}

            {onDismiss && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDismiss(project.id);
                    }}
                    className="absolute top-4 right-4 z-30 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/10 hover:border-white/20"
                    title="Dismiss suggestion"
                >
                    <X size={14} strokeWidth={3} />
                </button>
            )}

            {/* Main Section: Poster + Header & Info */}
            <div>
                <div className="flex items-start gap-3.5 sm:gap-4">
                    {/* Left Square Poster */}
                    <Link to={`/projects/${project.id}/space`} className="w-16 h-16 sm:w-20 sm:h-20 rounded-[14px] sm:rounded-[16px] overflow-hidden shrink-0 relative shadow-sm block bg-gradient-to-br from-amber-500 via-orange-500 to-red-500">
                        {displayImage ? (
                            <LazyImage
                                src={getOptimizedImage(displayImage, { width: 400, quality: 85 })}
                                alt={project.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-7 h-7 text-white/90" />
                            </div>
                        )}
                    </Link>

                    {/* Right Column */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-0.5">
                        {/* Status Chip & 3-Dots Row */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 font-mono text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span>[SCENE: {statusText}]</span>
                            </div>

                            {/* 3-Dots Dropdown Menu */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50 bg-background/95 backdrop-blur-xl shadow-lg">
                                    <DropdownMenuItem asChild>
                                        <Link to={`/projects/${project.id}/space`} className="flex items-center gap-2 cursor-pointer">
                                            <ExternalLink className="h-4 w-4" />
                                            <span>Enter Workspace</span>
                                        </Link>
                                    </DropdownMenuItem>

                                    {isOwner && (
                                        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-500/10" onClick={() => setIsDeleteOpen(true)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span>Delete Project</span>
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Title */}
                        <Link to={`/projects/${project.id}/space`}>
                            <h3 className="font-serif font-bold text-base sm:text-lg text-foreground tracking-tight leading-snug truncate hover:text-primary transition-colors mt-0.5">
                                {project.title}
                            </h3>
                        </Link>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground line-clamp-1 font-normal">
                            {project.description || 'Testing the projectspace and it fetures'}
                        </p>
                    </div>
                </div>

                {/* Middle: Location Chip */}
                <div className="mt-2.5 inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-mono text-[9px] sm:text-[9.5px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-700/60 w-fit max-w-full truncate">
                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate">LOC // {locationText}</span>
                </div>

                {/* Roles & Genre Badges Row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Roles Badge */}
                    <div className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/40 text-red-600 dark:text-red-400 font-mono text-[9px] sm:text-[9.5px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md whitespace-nowrap">
                        <span className="text-xs">👥</span>
                        <span>ROLES // {rolesCount} OPEN</span>
                    </div>

                    {/* Genre Badge */}
                    <div className="inline-flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-mono text-[9px] sm:text-[9.5px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border border-slate-200/60 dark:border-slate-700/60 whitespace-nowrap">
                        <Film className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>GENRE // {genreText}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-normal">
                    {(() => {
                        try {
                            const d = project.created_at ? new Date(project.created_at) : new Date();
                            return isNaN(d.getTime()) ? "3 months ago" : formatDistanceToNow(d, { addSuffix: true });
                        } catch {
                            return "3 months ago";
                        }
                    })()}
                </span>

                <div className="flex items-center gap-1.5">
                    <Link
                        to={`/projects/${project.id}/space`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-400 border border-red-200/60 dark:border-red-900/40 transition-all hover:scale-105 shadow-xs"
                    >
                        <span className="text-[10px]">👥</span>
                        <span>Roles ({rolesCount})</span>
                    </Link>

                    <Link
                        to={`/projects/${project.id}/space`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-105 shadow-xs"
                    >
                        <span>View Space</span>
                        <ExternalLink className="w-3 h-3" />
                    </Link>
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





