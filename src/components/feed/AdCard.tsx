import { Button } from '@/components/ui/button';
import { ExternalLink, Info } from 'lucide-react';

interface AdCardProps {
    title?: string;
    description?: string;
    imageUrl?: string;
    ctaText?: string;
    ctaLink?: string;
    sponsorName?: string;
}

const AdCard = ({
    title = "ReelSphere Pro",
    description = "Unlock advanced analytics, unlimited project storage, and premium networking features.",
    imageUrl = "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=800&q=80",
    ctaText = "Upgrade Now",
    ctaLink = "/settings",
    sponsorName = "Sponsored"
}: AdCardProps) => {
    return (
        <div className="my-6 mx-4 rounded-xl overflow-hidden border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        {sponsorName} <Info className="h-3 w-3" />
                    </span>
                </div>
            </div>

            <div className="relative aspect-video w-full overflow-hidden">
                <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform hover:scale-105 duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-xl font-bold mb-1">{title}</h3>
                    <p className="text-sm text-white/90 line-clamp-2 mb-3">{description}</p>
                    <Button size="sm" className="w-full sm:w-auto bg-white text-black hover:bg-white/90" asChild>
                        <a href={ctaLink} target="_blank" rel="noopener noreferrer">
                            {ctaText} <ExternalLink className="ml-2 h-3 w-3" />
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AdCard;
