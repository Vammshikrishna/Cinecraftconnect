import { Film, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getOptimizedImage } from '@/utils/image-optimization';
import { useState, useEffect } from 'react';
import { fetchContentDetails } from '@/services/tmdb';

interface ContentShareCardProps {
    id: string;
    type: 'movie' | 'tv';
    title: string;
    poster_path: string | null;
    rating?: number;
    overview?: string;
}

export const ContentShareCard = ({ id, type, title, poster_path }: ContentShareCardProps) => {
    const [metadata, setMetadata] = useState<{ language: string; year: string } | null>(null);

    useEffect(() => {
        const hydrateData = async () => {
            if (!id || id === 'undefined') return;
            try {
                const details = await fetchContentDetails(parseInt(id), type);
                if (details) {
                    const year = new Date(details.release_date || details.first_air_date).getFullYear().toString();
                    const langMap: Record<string, string> = {
                        'en': 'ENGLISH',
                        'hi': 'HINDI',
                        'te': 'TELUGU',
                        'ta': 'TAMIL',
                        'ml': 'MALAYALAM',
                        'kn': 'KANNADA'
                    };
                    setMetadata({
                        language: langMap[details.original_language] || details.original_language.toUpperCase(),
                        year: year
                    });
                }
            } catch (err) {
                console.error('Error hydrating content share card:', err);
            }
        };

        hydrateData();
    }, [id, type]);

    return (
        <Link 
            to={`/content/${type}/${id}`}
            className="block w-full max-w-[160px] sm:max-w-[220px] min-w-[130px] sm:min-w-[180px] bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-1 active:scale-[0.99] no-underline group shadow-xl border border-black/5 dark:border-white/5"
        >
            {/* Poster Image */}
            <div className="relative aspect-[2/3] overflow-hidden">
                {poster_path ? (
                    <img 
                        src={getOptimizedImage(`https://image.tmdb.org/t/p/w500${poster_path}`, { width: 400 })} 
                        alt={title} 
                        className="w-full h-full object-cover" 
                    />
                ) : (
                    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Film className="w-12 h-12 text-zinc-300" />
                    </div>
                )}
            </div>

            {/* Content Details - Perfectly matching the reference */}
            <div className="p-4 bg-white dark:bg-zinc-900">
                <h3 className="text-zinc-900 dark:text-white font-bold text-lg tracking-tight mb-3">
                    {title}
                </h3>
                
                {/* Thin Separator Line */}
                <div className="w-full h-[1px] bg-zinc-100 dark:bg-white/10 mb-3" />

                {/* Metadata Row: Language & Year */}
                <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {metadata?.language || 'LOADING...'}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">
                        {metadata?.year || '....'}
                    </span>
                </div>

                {/* Star Rating Section */}
                <div className="flex items-center justify-center gap-1.5 pb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                            key={star} 
                            className="w-6 h-6 text-zinc-300 dark:text-zinc-700 stroke-[1.5px]" 
                        />
                    ))}
                </div>
            </div>
        </Link>
    );
};
