import { Lightbulb, Film, DollarSign, Shield, Globe, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import VerificationBadge from "@/components/common/VerificationBadge";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PitchShareCardProps {
    title: string;
    id: string;
    description?: string;
    category?: string;
    genres?: string[];
    languages?: string[];
    format?: string;
    compensation?: string;
    tags?: string[];
    budget_range?: string;
    deadline?: string;
    author?: {
        name: string;
        avatar?: string;
        craft?: string;
        is_verified?: boolean;
    };
}

const COMPENSATION_LABELS: Record<string, string> = {
    fixed: 'Fixed Budget',
    negotiable: 'Negotiable',
    commission: 'Commission Based',
    royalty: 'Royalty Based',
    deferred: 'Deferred Payment',
    equity: 'Equity/Stake',
    pro_bono: 'Pro Bono',
    development_deal: 'Development Deal',
    paid: 'Paid Offer',
    unpaid: 'Unpaid'
};

const FORMAT_LABELS: Record<string, string> = {
    feature: 'Feature Film',
    short_film: 'Short Film',
    series: 'Web Series',
    documentary: 'Documentary',
    animation: 'Animation',
    reality: 'Reality Show',
    youtube: 'Digital / YouTube',
    branded: 'Branded Film',
    other: 'Other Project'
};

export const PitchShareCard = ({ 
    title, id, description: initialDesc, category: initialCat, 
    genres: initialGenres, languages: initialLanguages,
    format: initialFormat, compensation: initialComp, tags: initialTags, 
    author: initialAuthor, budget_range: initialBudget, deadline: initialDeadline 
}: PitchShareCardProps) => {
    const [author, setAuthor] = useState(initialAuthor);
    const [description, setDescription] = useState(initialDesc);
    const [format, setFormat] = useState(initialFormat);
    const [genres, setGenres] = useState(initialGenres || (initialCat ? [initialCat] : []));
    const [languages, setLanguages] = useState(initialLanguages || []);
    const [compensation, setCompensation] = useState(initialComp);
    const [budgetRange, setBudgetRange] = useState(initialBudget);
    const [deadline, setDeadline] = useState(initialDeadline);
    const [tags, setTags] = useState(initialTags);

    const displayFormat = format ? (FORMAT_LABELS[format.toLowerCase()] || format) : '';
    const displayComp = compensation ? (COMPENSATION_LABELS[compensation.toLowerCase()] || compensation) : 'Undisclosed';

    useEffect(() => {
        if (!id || id === 'undefined') return;
        const fetchMissingData = async () => {
            if (initialAuthor && initialDesc) return;
            
            try {
                const { data, error } = await supabase
                    .from('pitch_calls' as any)
                    .select(`
                        *,
                        profiles:creator_id (
                            full_name,
                            avatar_url,
                            craft,
                            is_verified
                        )
                    `)
                    .eq('id', id)
                    .single();

                if (data && !error) {
                    const d = data as any;
                    if (!author) {
                        setAuthor({
                            name: d.profiles?.full_name || 'Creator',
                            avatar: d.profiles?.avatar_url || '',
                            craft: d.profiles?.craft || 'Creator',
                            is_verified: d.profiles?.is_verified
                        });
                    }
                    if (!description) setDescription(d.requirement_description);
                    if (!format) setFormat(d.project_type);
                    if (genres.length === 0) setGenres(d.genre || []);
                    if (languages.length === 0) setLanguages(d.language || []);
                    if (!compensation) setCompensation(d.compensation);
                    if (!budgetRange) setBudgetRange(d.budget_range);
                    if (!deadline) setDeadline(d.deadline);
                    if (!tags || tags.length === 0) {
                        const newTags = [
                            d.is_open_to_debut && 'Debut Writers Welcome',
                            d.is_regional_welcome && 'Regional Stories',
                            d.nda_required && 'NDA Required'
                        ].filter(Boolean) as string[];
                        setTags(newTags);
                    }
                }
            } catch (err) {
                console.error('Error self-healing pitch card:', err);
            }
        };

        fetchMissingData();
    }, [id, initialAuthor, initialDesc, genres.length, languages.length, compensation, budgetRange, deadline, tags]);

    return (
        <Link 
            to={`/pitch/${id}`}
            className="block w-full max-w-[240px] min-w-[200px] glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-2xl border border-white/10"
        >
            {/* Compact Header - Identity & Status */}
            <div className="p-4 bg-black/60 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
                {author && (
                    <div className="flex items-center gap-3 overflow-hidden">
                        <Avatar className="h-10 w-10 rounded-xl border border-white/20 shadow-sm">
                            <AvatarImage src={author.avatar} />
                            <AvatarFallback className="text-[12px] bg-primary text-black font-black uppercase">
                                {author.name[0]}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                                <span className="text-[11px] font-black text-white uppercase tracking-wider truncate leading-tight">
                                    {author.name}
                                </span>
                                {author.is_verified && <VerificationBadge size="xs" />}
                            </div>
                            <span className="text-[8px] text-primary font-black uppercase tracking-[0.2em] leading-tight">
                                {author.craft || 'Director'}
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="px-2 py-0.5 bg-red-600 text-white text-[7px] font-black uppercase tracking-widest rounded shadow-lg animate-pulse">
                        Active
                    </div>
                    <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[7px] font-black text-primary uppercase tracking-widest">
                        Pitch Deck
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-5 space-y-4 bg-background/80 backdrop-blur-md">

                <div className="space-y-2">
                    <h3 className="text-[16px] font-black text-primary leading-tight group-hover:scale-[1.02] transition-transform duration-300 tracking-tight uppercase">
                        {title}
                    </h3>
                    {description && (
                        <p className="text-[11px] text-foreground/70 font-medium line-clamp-6 leading-relaxed animate-in fade-in duration-700">
                            {description}
                        </p>
                    )}
                </div>

                {/* Badges & Meta */}
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                        {displayFormat && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-black text-primary uppercase tracking-widest">
                                <Film size={10} /> {displayFormat}
                            </div>
                        )}
                        {genres.map(g => (
                            <div key={g} className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[9px] font-black text-foreground/70 uppercase tracking-widest">
                                {g}
                            </div>
                        ))}
                        {languages.map(l => (
                            <div key={l} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[9px] font-black text-blue-500/70 uppercase tracking-widest">
                                <Globe size={10} /> {l}
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between py-3 border-y border-white/10">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-[10px] font-black text-foreground/80 uppercase tracking-widest">
                                <DollarSign size={12} className="text-primary" />
                                {displayComp}
                            </div>
                            {budgetRange && (
                                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest pl-5">
                                    {budgetRange}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <div className="text-[10px] font-black text-primary uppercase tracking-widest">
                                {compensation?.includes('deal') ? 'Dev Deal' : 'Pitch Call'}
                            </div>
                            {deadline && (
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                                    <Clock size={10} />
                                    Ends {new Date(deadline).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>

                    {tags && tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-500">
                            {tags.map(tag => (
                                <div key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/5 border border-green-500/10 text-[8px] font-bold text-green-500/80 uppercase tracking-widest">
                                    {tag.includes('NDA') ? <Shield size={8} /> : <Globe size={8} />}
                                    {tag}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-full py-2.5 bg-primary text-black text-center rounded-xl hover:bg-primary/90 transition-all text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <Lightbulb size={14} className="fill-black" />
                    Pitch Now
                </div>
            </div>
        </Link>
    );
};
