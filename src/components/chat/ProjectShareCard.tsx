import { Link } from 'react-router-dom';
import { Film, MapPin, Box, Zap, Clock } from 'lucide-react';
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

    useEffect(() => {
        const fetchProjectDetails = async () => {
            if (initialStatus && initialDesc) return;

            try {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single();

                if (data && !error) {
                    setTitle(data.title);
                    setDescription(data.description || '');
                    setLocation(data.location || 'Global Production');
                    setStatus(data.status || 'Active');
                    setGenre((data.genre as any)?.[0] || 'Film');
                }
            } catch (err) {
                console.error('Error self-healing project card:', err);
            }
        };

        fetchProjectDetails();
    }, [projectId, initialStatus, initialDesc]);

    const bgGradient = getGradientForString(title || 'Project');

    return (
        <Link
            to={`/projects/${projectId}/space`}
            className="block w-full max-w-[210px] sm:max-w-[280px] min-w-[170px] sm:min-w-[220px] glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-xl border border-white/10"
        >
            {/* Visual Header */}
            <div
                className="aspect-[16/9] w-full relative flex items-center justify-center overflow-hidden"
                style={{ background: bgGradient }}
            >
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                <Film className="w-16 h-16 text-white/40 relative z-10 group-hover:scale-110 transition-transform duration-700 drop-shadow-2xl" />

                {status && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[8px] font-black uppercase tracking-widest text-white shadow-lg">
                        {status}
                    </div>
                )}

                {genre && (
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md border border-white/10 text-[8px] font-black uppercase tracking-widest text-white/90">
                        {genre}
                    </div>
                )}

                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary text-black text-[8px] font-black uppercase tracking-widest shadow-lg">
                    <Box size={10} fill="currentColor" />
                    Project Space
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4 space-y-4 bg-muted/30 backdrop-blur-xl">
                <div className="space-y-1.5">
                    <h4 className="text-[16px] font-black text-foreground leading-tight group-hover:text-primary transition-colors tracking-tighter uppercase truncate">
                        {title || 'Loading Space...'}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                        <MapPin size={10} className="text-primary/60" />
                        <span className="truncate">{location || 'Production Hub'}</span>
                    </div>
                </div>

                {description && (
                    <p className="text-[10px] text-foreground/60 font-medium leading-relaxed line-clamp-2 italic border-y border-white/5 py-2 animate-in fade-in duration-700">
                        {description}
                    </p>
                )}

                {/* Status Bar */}
                <div className="flex items-center gap-3 justify-between px-1">
                    <div className="flex items-center gap-1.5 text-[8px] font-black text-primary uppercase tracking-widest">
                        <Zap size={10} />
                        Active Space
                    </div>
                    <div className="flex items-center gap-1.5 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                        <Clock size={10} />
                        Real-time
                    </div>
                </div>

                <div className="w-full py-2.5 bg-primary text-black text-center rounded-xl group-hover:bg-primary/90 transition-all text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <Box size={14} className="fill-black" />
                    Enter Project Space
                </div>
            </div>
        </Link>
    );
};

