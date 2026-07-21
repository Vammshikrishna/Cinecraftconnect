import { CornerBrackets } from '@/components/ui/CornerBrackets';
import { Link } from 'react-router-dom';
import { MapPin, Box } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getGradientForString } from '@/utils/colors';

interface ProjectShareCardProps {
    projectId: string;
    title?: string;
    description?: string;
    location?: string;
    status?: string;
    genre?: string;
}

export const ProjectShareCard = ({
    projectId,
    title: initialTitle,
    description: initialDesc,
    location: initialLoc,
    status: initialStatus,
    genre: initialGenre
}: ProjectShareCardProps) => {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDesc);
    const [location, setLocation] = useState(initialLoc);
    const [status, setStatus] = useState(initialStatus);
    const [genre, setGenre] = useState(initialGenre);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchProjectDetails = async () => {
            if (!projectId) return;

            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .maybeSingle();

                if (data && !error) {
                    setTitle(data.title);
                    setDescription(data.description || '');
                    setLocation(data.location || '');
                    setStatus(data.status || 'Active');
                    setGenre((data.genre as any)?.[0] || 'Film');
                    setImageUrl(data.image_url || null);
                }
            } catch (err) {
                console.error('Error self-healing project card:', err);
            }
        };

        fetchProjectDetails();
    }, [projectId]);

    const bgGradient = getGradientForString(title || 'Project');

    return (
        <Link
            to={`/projects/${projectId}/space`}
            className="block w-[220px] shrink-0 glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-xl border border-black/10 dark:border-white/10"
        >
            <CornerBrackets />
            {/* Visual Header */}
            <div className="aspect-[16/9] w-full relative flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={title || 'Project'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                ) : (
                    <div className="w-full h-full" style={{ background: bgGradient }} />
                )}
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />



                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary text-black text-[7px] font-black uppercase tracking-widest shadow-lg">
                    <Box size={9} fill="currentColor" />
                    Project Space
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4 space-y-3 bg-white dark:bg-black/60 backdrop-blur-xl">
                {/* Title */}
                <h4 className="font-serif text-[13px] font-bold text-foreground leading-tight group-hover:text-primary transition-colors tracking-tight uppercase line-clamp-2">
                    {title || 'Loading Space...'}
                </h4>

                {/* Bio/Description */}
                {description && (
                    <p className="text-[10px] text-foreground/60 font-medium leading-relaxed line-clamp-2 italic border-y border-white/5 py-2 animate-in fade-in duration-700">
                        {description}
                    </p>
                )}

                {/* Location — below bio */}
                {location && (
                    <div className="font-mono flex items-center gap-1.5 text-[8px] text-muted-foreground font-bold uppercase tracking-widest">
                        <MapPin size={8} className="text-primary shrink-0" />
                        <span className="truncate">{location}</span>
                    </div>
                )}

                {/* Status & Genre badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    {status && (
                        <div className="font-mono text-[7.5px] font-black text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                            STATUS // {status}
                        </div>
                    )}
                    {genre && (
                        <div className="font-mono text-[7.5px] font-black text-muted-foreground uppercase tracking-widest bg-muted/10 border border-border/40 px-2 py-0.5 rounded">
                            GENRE // {genre}
                        </div>
                    )}
                </div>

                <div className="w-full py-2.5 bg-primary text-black text-center rounded-xl group-hover:bg-primary/90 transition-all text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <Box size={14} className="fill-black" />
                    Enter Project Space
                </div>
            </div>
        </Link>
    );
};
