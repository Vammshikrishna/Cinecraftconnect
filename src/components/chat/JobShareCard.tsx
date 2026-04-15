import { Link } from 'react-router-dom';
import { MapPin, Briefcase, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAccountType } from '@/hooks/useAccountType';

interface JobShareCardProps {
    jobId: string;
    title?: string;
    company?: string;
    location?: string;
    logoUrl?: string;
    description?: string;
    imageUrl?: string;
}

export const JobShareCard = ({ jobId, title, company, location, logoUrl, description, imageUrl }: JobShareCardProps) => {
    const { isFan } = useAccountType();

    const Wrapper = isFan ? 'div' : Link;
    const wrapperProps = isFan ? {} : { to: `/jobs/${jobId}` };

    return (
        <div className="w-full max-w-[440px] bg-zinc-50/80 dark:bg-card/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl md:rounded-[28px] overflow-hidden transition-all hover:border-primary/50 hover:shadow-[0_20px_50px_-15px_rgba(var(--primary),0.15)] group relative bg-gradient-to-br from-zinc-100/50 to-zinc-50/50 dark:from-card dark:to-muted/5 shadow-sm dark:shadow-none">
            <div className="flex flex-col md:flex-row h-full">
                {/* Header Image - Fixed Horizontal Professional Width */}
                <Wrapper
                    {...wrapperProps as any}
                    className="relative w-full h-[40px] md:w-[75px] md:h-auto md:aspect-square overflow-hidden bg-muted group-hover:brightness-110 transition-all duration-500 shrink-0 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/5"
                >
                    {imageUrl ? (
                        <img src={imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-emerald-700/10 to-blue-600/5 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50" />
                            <Briefcase className="w-4 h-4 text-primary/40 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                    )}

                    {/* Badge - Always Visible High-Fidelity */}
                    <div className="absolute top-2 left-3 md:top-1 md:left-1 flex items-center gap-0.5 p-0.5 bg-background/80 backdrop-blur-md rounded-md border border-black/5 dark:border-white/10 shadow-sm">
                        <Avatar className="h-2.5 w-2.5 rounded-sm">
                            <AvatarImage src={logoUrl || undefined} />
                            <AvatarFallback className="text-[4px] bg-primary/10 text-primary font-black uppercase">
                                {company?.[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-[6px] font-black text-primary uppercase tracking-widest pr-0.5">
                            Active
                        </span>
                    </div>
                </Wrapper>

                {/* Content Container - Compact & Detailed */}
                <div className="flex-1 px-4 py-4 md:px-5 md:py-5 flex flex-col justify-between gap-2.5 md:gap-3 min-w-0">
                    <div className="space-y-1 md:space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5 md:mb-1">
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                <Avatar className="h-4 w-4 md:h-5 md:w-5 rounded-md border border-white/5 shadow-sm">
                                    <AvatarImage src={logoUrl || undefined} />
                                    <AvatarFallback className="text-[7px] md:text-[8px] bg-primary/10 text-primary font-black">
                                        {company?.[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                    {company || 'Studio'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-[8px] md:text-[9px] text-primary font-black uppercase tracking-widest shrink-0 animate-pulse bg-primary/5 px-2 py-0.5 rounded-full border border-primary/20">
                                Hiring
                            </div>
                        </div>

                        <h4 className="text-sm md:text-base font-black text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1 tracking-tight">
                            {title || 'Job Opening'}
                        </h4>

                        <div className="flex items-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] text-muted-foreground/70 font-medium">
                            <div className="flex items-center gap-1">
                                <MapPin size={10} className="text-primary/40" />
                                <span className="truncate">{location || 'Remote'}</span>
                            </div>
                            <span className="opacity-30">•</span>
                            <span className="truncate">Full-time</span>
                        </div>

                        {description && (
                            <p className="text-[10px] md:text-[11px] font-medium text-muted-foreground/60 leading-snug line-clamp-1 md:line-clamp-2 pt-0.5">
                                {description}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 pt-0.5 md:pt-1 font-black uppercase tracking-widest text-[8px] md:text-[9px]">
                        {isFan ? (
                            <div className="flex-1 py-1.5 bg-muted/40 text-muted-foreground text-center rounded-xl border border-black/5 dark:border-white/5 flex items-center justify-center gap-1.5 opacity-80 cursor-not-allowed">
                                <Lock size={10} />
                                Creators Only
                            </div>
                        ) : (
                            <>
                                <Link to={`/jobs/${jobId}?apply=true`} className="flex-1 py-1.5 bg-primary text-primary-foreground text-center rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] no-underline">
                                    Apply
                                </Link>
                                <Link to={`/jobs/${jobId}`} className="flex-1 py-1.5 bg-muted/40 text-muted-foreground text-center rounded-xl hover:bg-muted transition-all border border-black/5 dark:border-white/5 no-underline">
                                    Details
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Subtle glow border */}
            <div className="absolute inset-0 border border-black/5 dark:border-white/5 rounded-[28px] pointer-events-none group-hover:border-primary/20 transition-colors" />
        </div>
    );
};
