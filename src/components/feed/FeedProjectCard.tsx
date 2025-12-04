import { Link } from 'react-router-dom';
import { Film, MapPin, Lock, Calendar, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface FeedProjectCardProps {
    project: {
        id: string;
        name: string;
        description: string | null;
        status: string | null;
        location: string | null;
        created_at: string;
        project_space_type?: 'public' | 'private' | 'secret';
        creator?: {
            full_name: string | null;
            avatar_url: string | null;
        };
    };
}

const FeedProjectCard = ({ project }: FeedProjectCardProps) => {
    return (
        <Link to={`/projects/${project.id}/space`} className="block group h-full">
            <div className="relative overflow-hidden rounded-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-card/30 backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)] h-full flex flex-col">
                {/* Decorative gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative p-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-4 flex-1">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                                <Film className="h-6 w-6" />
                            </div>

                            <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                        {project.name}
                                    </h3>
                                    {project.status && (
                                        <Badge variant="outline" className="capitalize bg-primary/5 border-primary/20 text-primary text-[10px] h-5">
                                            {project.status}
                                        </Badge>
                                    )}
                                    {project.project_space_type === 'private' && (
                                        <Badge variant="secondary" className="flex items-center gap-1 text-[10px] h-5">
                                            <Lock className="h-3 w-3" />
                                            Private
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {project.description || 'No description provided.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-all duration-300 opacity-100 translate-x-0 sm:opacity-0 sm:-translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0">
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {project.creator && (
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5 border border-white/10">
                                        <AvatarImage src={project.creator.avatar_url || undefined} />
                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                            {project.creator.full_name?.charAt(0) || 'C'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium text-foreground/80 line-clamp-1 max-w-[80px]">
                                        {project.creator.full_name || 'Creator'}
                                    </span>
                                </div>
                            )}

                            {project.location && (
                                <div className="flex items-center gap-1 hidden sm:flex">
                                    <MapPin className="h-3 w-3" />
                                    <span className="line-clamp-1 max-w-[80px]">{project.location}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default FeedProjectCard;
