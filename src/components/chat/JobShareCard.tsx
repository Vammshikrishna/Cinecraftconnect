import { Link } from 'react-router-dom';
import { MapPin, Briefcase } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
    return (
        <div className="w-full max-w-[440px] bg-card/60 backdrop-blur-xl border border-white/10 rounded-[28px] overflow-hidden transition-all hover:border-primary/50 hover:shadow-[0_20px_50px_-15px_rgba(var(--primary),0.15)] group relative bg-gradient-to-br from-card to-muted/5">
            <div className="flex flex-row h-full">
                {/* Header Image - Fixed Horizontal Professional Width */}
                <Link
                    to={`/jobs/${jobId}`}
                    className="relative w-[80px] md:w-[130px] aspect-square overflow-hidden bg-muted group-hover:brightness-110 transition-all duration-500 shrink-0 border-r border-white/5"
                >
                    {imageUrl ? (
                        <img src={imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-emerald-700/10 to-blue-600/5 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50" />
                            <Briefcase className="w-8 h-8 text-primary/40 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                    )}

                    {/* Badge - Always Visible High-Fidelity */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 p-1 bg-background/80 backdrop-blur-md rounded-lg border border-white/10 shadow-sm">
                        <Avatar className="h-3.5 w-3.5 rounded-sm">
                            <AvatarImage src={logoUrl || undefined} />
                            <AvatarFallback className="text-[6px] bg-primary/10 text-primary font-black uppercase">
                                {company?.[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-[8px] font-black text-primary uppercase tracking-widest pr-0.5">
                            Active
                        </span>
                    </div>
                </Link>

                {/* Content Container - Compact & Detailed */}
                <div className="flex-1 p-4 flex flex-col justify-between gap-3 min-w-0">
                    <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                <Avatar className="h-5 w-5 rounded-md border border-white/5 shadow-sm">
                                    <AvatarImage src={logoUrl || undefined} />
                                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-black">
                                        {company?.[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                                    {company || 'Studio'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-primary font-black uppercase tracking-widest shrink-0 animate-pulse bg-primary/5 px-2 py-0.5 rounded-full border border-primary/20">
                                Hiring
                            </div>
                        </div>

                        <h4 className="text-base font-black text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1 tracking-tight">
                            {title || 'Job Opening'}
                        </h4>

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 font-medium">
                            <div className="flex items-center gap-1">
                                <MapPin size={10} className="text-primary/40" />
                                <span className="truncate">{location || 'Remote'}</span>
                            </div>
                            <span className="opacity-30">•</span>
                            <span className="truncate">Full-time</span>
                        </div>

                        {description && (
                            <p className="text-[11px] font-medium text-muted-foreground/60 leading-snug line-clamp-2 pt-0.5">
                                {description}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 font-black uppercase tracking-widest text-[9px]">
                        <Link to={`/jobs/${jobId}?apply=true`} className="flex-1 py-1.5 bg-primary text-primary-foreground text-center rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] no-underline">
                            Apply
                        </Link>
                        <Link to={`/jobs/${jobId}`} className="flex-1 py-1.5 bg-muted/40 text-muted-foreground text-center rounded-xl hover:bg-muted transition-all border border-white/5 no-underline">
                            Details
                        </Link>
                    </div>
                </div>
            </div>

            {/* Subtle glow border */}
            <div className="absolute inset-0 border border-white/5 rounded-[28px] pointer-events-none group-hover:border-primary/20 transition-colors" />
        </div>
    );
};
