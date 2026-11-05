import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { Link } from 'react-router-dom';
import { MapPin, Briefcase, Lock, DollarSign, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAccountType } from '@/hooks/useAccountType';
import { getOptimizedImage } from '@/utils/image-optimization';
import { cn } from '@/lib/utils';

interface JobShareCardProps {
    jobId: string;
    title?: string;
    company?: string;
    location?: string;
    logoUrl?: string;
    description?: string;
    imageUrl?: string;
    salary?: string;
    type?: string;
    className?: string;
    compact?: boolean;
}

export const JobShareCard = ({
    jobId,
    title: initialTitle,
    company: initialCompany,
    location: initialLocation,
    logoUrl: initialLogo,
    description: initialDesc,
    salary: initialSalary,
    type: initialType,
    className,
    compact
}: JobShareCardProps) => {
    const { isFan } = useAccountType();
    const [title, setTitle] = useState(initialTitle);
    const [company, setCompany] = useState(initialCompany);
    const [location, setLocation] = useState(initialLocation);
    const [logoUrl, setLogoUrl] = useState(initialLogo);
    const [description, setDescription] = useState(initialDesc);
    const [salary, setSalary] = useState(initialSalary);
    const [type, setType] = useState(initialType);

    useEffect(() => {
        const fetchJobDetails = async () => {
            if (!jobId || jobId === 'undefined') return;
            if (initialDesc && initialSalary) return;

            try {
                const { data, error } = await supabase
                    .from('jobs')
                    .select('*, profiles(full_name, avatar_url, username)')
                    .eq('id', jobId)
                    .maybeSingle();

                if (data && !error) {
                    setTitle(data.title);
                    setCompany(data.profiles?.full_name || data.profiles?.username || 'Studio');
                    setLocation(data.location || undefined);
                    setLogoUrl(data.profiles?.avatar_url || undefined);
                    setDescription(data.description || undefined);
                    const salaryText = data.salary_min && data.salary_max 
                        ? `\u20b9${data.salary_min.toLocaleString()} - \u20b9${data.salary_max.toLocaleString()}`
                        : data.salary_min 
                            ? `\u20b9${data.salary_min.toLocaleString()}+` 
                            : undefined;
                    setSalary(salaryText);
                    setType(data.type || undefined);
                }
            } catch (err) {
                console.error('Error self-healing job card:', err);
            }
        };

        fetchJobDetails();
    }, [jobId, initialDesc, initialSalary]);

    if (compact) {
        return (
            <Link
                to={`/jobs/${jobId}`}
                className={cn(
                    "block w-full glass-card-premium rounded-xl overflow-hidden transition duration-300 hover:-translate-y-1 active:scale-[0.98] no-underline group shadow-lg border border-black/10 dark:border-white/10",
                    className
                )}
            >
            <CornerBrackets />
                {/* Compact Header */}
                <div className="p-2.5 bg-black/60 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Avatar className="h-6 w-6 rounded-md border border-black/20 dark:border-white/20 shadow-sm shrink-0">
                            <AvatarImage src={getOptimizedImage(logoUrl, { width: 48, height: 48 }) || undefined} />
                            <AvatarFallback className="text-[12px] bg-primary text-black font-black uppercase shrink-0">
                                {company?.[0]}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-[12px] font-bold text-white uppercase tracking-wider truncate leading-tight">
                            {company}
                        </span>
                    </div>
                    <div className="shrink-0 px-1.5 py-0.5 bg-[#ff3d00] text-white text-xs font-black uppercase tracking-widest rounded shadow-sm">
                        Hiring
                    </div>
                </div>

                {/* Compact Content */}
                <div className="p-3 space-y-2 bg-white dark:bg-black/60">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-sm font-bold text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors uppercase line-clamp-2 flex-1">
                            {title || 'Open Casting'}
                        </h3>
                        {type && (
                            <div className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-[12px] font-medium text-primary shrink-0 mt-0.5">
                                {type}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center text-[12px] text-muted-foreground font-medium truncate bg-muted/10 border border-border/40 px-1.5 py-0.5 rounded">
                            <span className="truncate">{location || 'Global Location'}</span>
                        </div>
                        {salary && (
                            <span className="text-[12px] font-black text-green-500 uppercase tracking-widest shrink-0">
                                {salary.includes(' - ') ? salary.split(' - ')[0] : salary}
                            </span>
                        )}
                    </div>
                    {description && (
                        <p className="text-[12px] text-foreground/70 font-medium leading-relaxed line-clamp-3 italic opacity-80 border-l-2 border-primary/30 pl-2 mt-2">
                            {description}
                        </p>
                    )}
                </div>
            </Link>
        );
    }

    return (
        <Link
            to={`/jobs/${jobId}`}
            className={cn(
                "relative block w-[220px] shrink-0 glass-card-premium rounded-2xl overflow-hidden transition duration-500 hover:-translate-y-1 active:scale-[0.98] no-underline group shadow-2xl border border-black/10 dark:border-white/10",
                className
            )}
        >
            {/* HIRING badge - top-right corner chip */}
            <div className="absolute top-3 right-3 z-10 px-2 py-0.5 bg-[#ff3d00] text-white text-xs font-black uppercase tracking-widest rounded shadow-md">
                Hiring
            </div>

            {/* Content Section */}
            <div className="pt-10 px-4 pb-4 space-y-4 bg-white dark:bg-black/60">
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-sm font-bold text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors uppercase line-clamp-2 flex-1">
                            {title || 'Open Casting'}
                        </h3>
                        {type && (
                            <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-xs font-medium text-primary shrink-0 mt-0.5">
                                {type}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center text-xs text-muted-foreground font-medium bg-muted/10 border border-border/40 px-2 py-0.5 rounded w-max">
                        <span className="truncate">{location || 'Global Location'}</span>
                    </div>
                </div>

                {description && (
                    <p className="text-[12px] text-foreground/60 font-medium leading-relaxed line-clamp-3 italic border-l-2 border-primary/20 pl-2.5">
                        {description}
                    </p>
                )}

                {/* Status badges - compact inline */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-muted/10 border border-border/40 rounded text-xs font-medium text-foreground/70">
                        <Clock size={9} className="text-primary" />
                        Active Now
                    </div>
                    {salary && (
                        <div className="px-2 py-0.5 bg-green-500/5 border border-green-500/20 rounded text-xs font-medium text-green-600 dark:text-green-400">
                            {salary}
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    {/* Who posted */}
                    <div className="flex items-center gap-2.5 mb-3 px-1">
                        <Avatar className="h-7 w-7 rounded-lg border border-border/40 shadow-sm shrink-0">
                            <AvatarImage src={getOptimizedImage(logoUrl, { width: 56, height: 56 }) || undefined} />
                            <AvatarFallback className="text-[12px] bg-primary text-black font-black uppercase">
                                {company?.[0]}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[12px] font-black text-foreground uppercase tracking-wider truncate leading-tight">{company}</span>
                            <span className="text-xs text-primary font-black uppercase tracking-widest leading-tight">Hiring Entity</span>
                        </div>
                    </div>
                    {isFan ? (
                        <div className="w-full py-3 bg-muted/40 text-muted-foreground text-center rounded-2xl flex items-center justify-center gap-3 text-[12px] font-black uppercase tracking-widest opacity-80 cursor-not-allowed border border-dashed border-black/10 dark:border-white/10">
                            <Lock size={14} />
                            Creator Only
                        </div>
                    ) : (
                        <div className="w-full py-3 bg-[#ff3d00] hover:bg-[#ff5722] text-white text-center rounded-2xl transition text-[12px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 flex items-center justify-center gap-3">
                            <Briefcase size={16} className="fill-white" />
                            Apply for Role
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
};