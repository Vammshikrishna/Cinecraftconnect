import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { Lightbulb, Shield, Globe, Clock } from 'lucide-react';
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
                    .maybeSingle();

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
            className="block w-[220px] shrink-0 glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-2xl border border-black/10 dark:border-white/10 relative"
        >
            <CornerBrackets />

            {/* Status badges - top-right corner chips */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                <div className="px-2 py-0.5 bg-red-600 text-white text-[7px] font-black uppercase tracking-widest rounded shadow-md animate-pulse">
                    Active
                </div>
                <div className="px-2 py-0.5 bg-primary/20 border border-primary/30 text-primary text-[7px] font-black uppercase tracking-widest rounded">
                    Pitch Deck
                </div>
            </div>

            {/* Content Section */}
            <div className="pt-10 px-4 pb-4 space-y-3 bg-white dark:bg-black/60 backdrop-blur-md">

                <div className="space-y-1.5">
                    <h3 className="font-serif text-[13px] font-bold text-primary leading-tight tracking-tight uppercase line-clamp-3">
                        {title}
                    </h3>
                    {description && (
                        <p className="text-[10px] text-foreground/70 font-medium line-clamp-3 leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                    {displayFormat && (
                        <div className="font-mono flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[7.5px] font-bold text-primary uppercase tracking-widest">
                            FMT // {displayFormat}
                        </div>
                    )}
                    {genres.map(g => (
                        <div key={g} className="font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[7.5px] font-bold text-foreground/70 uppercase tracking-widest">
                            GENRE // {g}
                        </div>
                    ))}
                    {languages.map(l => (
                        <div key={l} className="font-mono flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/5 border border-blue-500/10 text-[7.5px] font-bold text-blue-500/70 uppercase tracking-widest">
                            LANG // {l}
                        </div>
                    ))}
                </div>

                {/* Comp & Deadline */}
                <div className="flex items-center justify-between py-2 border-y border-black/10 dark:border-white/10">
                    <div className="flex flex-col gap-1">
                        <div className="font-mono text-[7.5px] font-bold text-foreground/80 uppercase tracking-widest bg-muted/10 border border-border/40 px-2 py-0.5 rounded">
                            COMP // {displayComp}
                        </div>
                        {budgetRange && (
                            <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest pl-1">
                                {budgetRange}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="text-[9px] font-black text-primary uppercase tracking-widest">
                            {compensation?.includes('deal') ? 'Dev Deal' : 'Pitch Call'}
                        </div>
                        {deadline && (
                            <div className="flex items-center gap-1 text-[8px] font-black text-rose-500 uppercase tracking-widest">
                                <Clock size={9} />
                                Ends {new Date(deadline).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                </div>

                {tags && tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map(tag => (
                            <div key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/5 border border-green-500/10 text-[7.5px] font-bold text-green-500/80 uppercase tracking-widest">
                                {tag.includes('NDA') ? <Shield size={8} /> : <Globe size={8} />}
                                {tag}
                            </div>
                        ))}
                    </div>
                )}

                {/* Who posted - above CTA */}
                {author && (
                    <div className="flex items-center gap-2.5 pt-2 border-t border-border/10">
                        <Avatar className="h-7 w-7 rounded-lg border border-border/40 shadow-sm shrink-0">
                            <AvatarImage src={author.avatar} />
                            <AvatarFallback className="text-[9px] bg-primary text-black font-black uppercase">
                                {author.name[0]}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black text-foreground uppercase tracking-wider truncate leading-tight">{author.name}</span>
                                {author.is_verified && <VerificationBadge size="xs" />}
                            </div>
                            <span className="text-[7.5px] text-primary font-black uppercase tracking-widest leading-tight">{author.craft || 'Director'}</span>
                        </div>
                    </div>
                )}

                <div className="w-full py-2.5 bg-primary text-black text-center rounded-xl hover:bg-primary/90 transition-all text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <Lightbulb size={14} className="fill-black" />
                    Pitch Now
                </div>
            </div>
        </Link>
    );
};
