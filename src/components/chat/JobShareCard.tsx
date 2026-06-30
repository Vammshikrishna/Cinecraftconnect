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
                        ? `₹${data.salary_min.toLocaleString()} - ₹${data.salary_max.toLocaleString()}`
                        : data.salary_min 
                            ? `₹${data.salary_min.toLocaleString()}+` 
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
                    "block w-full glass-card-premium rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] no-underline group shadow-lg border border-black/10 dark:border-white/10",
                    className
                )}
            >
                {/* Compact Header */}
                <div className="p-2.5 bg-black/60 backdrop-blur-xl border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Avatar className="h-6 w-6 rounded-md border border-black/20 dark:border-white/20 shadow-sm shrink-0">
                            <AvatarImage src={getOptimizedImage(logoUrl, { width: 48, height: 48 }) || undefined} />
                            <AvatarFallback className="text-[8px] bg-primary text-black font-black uppercase shrink-0">
                                {company?.[0]}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider truncate leading-tight">
                            {company}
                        </span>
                    </div>
                    <div className="shrink-0 px-1.5 py-0.5 bg-[#ff3d00] text-white text-[6.5px] font-black uppercase tracking-widest rounded shadow-sm">
                        Hiring
                    </div>
                </div>

                {/* Compact Content */}
                <div className="p-3 space-y-2 bg-white dark:bg-black/60 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors uppercase truncate">
                            {title || 'Open Casting'}
                        </h3>
                        {type && (
                            <div className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-[6px] font-black text-primary uppercase tracking-widest shrink-0">
                                {type}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-[8px] text-muted-foreground font-bold uppercase tracking-wider truncate">
                            <MapPin size={8} className="text-primary shrink-0" />
                            <span className="truncate">{location || 'Global Location'}</span>
                        </div>
                        {salary && (
                            <span className="text-[8px] font-black text-green-500 uppercase tracking-widest shrink-0">
                                {salary.includes(' - ') ? salary.split(' - ')[0] : salary}
                            </span>
                        )}
                    </div>
                    {description && (
                        <p className="text-[9px] text-foreground/70 font-medium leading-relaxed line-clamp-3 italic opacity-80 border-l-2 border-primary/30 pl-2 mt-2">
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
                "block w-[220px] shrink-0 glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-2xl border border-black/10 dark:border-white/10",
                className
            )}
        >
            {/* Header Section - Identity & Urgency */}
            <div className="p-4 bg-black/60 backdrop-blur-xl border-b border-black/10 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    <Avatar className="h-10 w-10 rounded-xl border border-black/20 dark:border-white/20 shadow-sm">
                        <AvatarImage src={getOptimizedImage(logoUrl, { width: 80, height: 80 }) || undefined} />
                        <AvatarFallback className="text-[12px] bg-primary text-black font-black uppercase">
                            {company?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-black text-white uppercase tracking-wider truncate leading-tight">
                            {company}
                        </span>
                        <span className="text-[8px] text-primary font-black uppercase tracking-[0.2em] leading-tight">
                            Hiring Entity
                        </span>
                    </div>
                </div>

                <div className="shrink-0 px-2 py-1 bg-[#ff3d00] text-white text-[8px] font-black uppercase tracking-widest rounded-md shadow-lg">
                    Hiring
                </div>
            </div>

            {/* Content Section */}
            <div className="p-5 space-y-5 bg-white dark:bg-black/60 backdrop-blur-md">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[18px] font-black text-foreground leading-tight tracking-tighter group-hover:text-primary transition-colors uppercase">
                            {title || 'Open Casting'}
                        </h3>
                        {type && (
                            <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md text-[7px] font-black text-primary uppercase tracking-widest">
                                {type}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em]">
                        <MapPin size={10} className="text-primary" />
                        <span className="truncate">{location || 'Global Location'}</span>
                    </div>
                </div>

                {description && (
                    <p className="text-[11px] text-foreground/70 font-medium leading-relaxed line-clamp-6 italic opacity-80 border-l-2 border-primary/30 pl-3">
                        {description}
                    </p>
                )}

                {/* Status Section */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-2 shadow-sm">
                        <Clock size={12} className="text-primary animate-pulse" />
                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Active Now</span>
                    </div>
                    {salary && (
                        <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-2 shadow-sm">
                            <DollarSign size={12} className="text-green-500" />
                            <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{salary}</span>
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    {isFan ? (
                        <div className="w-full py-3 bg-muted/40 text-muted-foreground text-center rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest opacity-80 cursor-not-allowed border border-dashed border-black/10 dark:border-white/10">
                            <Lock size={14} />
                            Creator Only
                        </div>
                    ) : (
                        <div className="w-full py-3 bg-[#ff3d00] hover:bg-[#ff5722] text-white text-center rounded-2xl transition-all text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-500/20 flex items-center justify-center gap-3">
                            <Briefcase size={16} className="fill-white" />
                            Apply for Role
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
};


