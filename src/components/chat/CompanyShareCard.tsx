import { MapPin, Building2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import VerificationBadge from '../common/VerificationBadge';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CompanyShareCardProps {
    id: string;
    name: string;
    slug?: string;
    logo?: string;
    avatar?: string; // Support both naming conventions
    location?: string;
    industry?: string;
    description?: string;
}

export const CompanyShareCard = ({ id, name: initialName, slug: initialSlug, logo, avatar, location: initialLoc, industry: initialInd, description: initialDesc }: CompanyShareCardProps) => {
    const [name, setName] = useState(initialName);
    const [slug, setSlug] = useState(initialSlug);
    const [logoUrl, setLogoUrl] = useState(logo || avatar);
    const [location, setLocation] = useState(initialLoc);
    const [industry, setIndustry] = useState(initialInd);
    const [description, setDescription] = useState(initialDesc);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [followerCount, setFollowerCount] = useState<number | null>(null);

    useEffect(() => {
        const fetchCompanyDetails = async () => {
            if (!id || id === 'undefined') return;
            // If we have full details, don't fetch
            if (initialDesc && initialLoc && initialInd) return;

            try {
                // Try to fetch by ID or Slug
                const { data, error } = await supabase
                    .from('company_pages')
                    .select('*')
                    .or(`id.eq.${id},slug.eq.${id},slug.eq.${slug || ''}`)
                    .maybeSingle();

                if (data && !error) {
                    setName(data.name);
                    setSlug(data.slug);
                    setLogoUrl(data.logo_url || undefined);
                    setBannerUrl(data.cover_image_url || null);
                    setLocation(data.headquarters || undefined);
                    setIndustry((Array.isArray(data.industry) ? data.industry[0] : data.industry) || undefined);
                    setDescription((data.description || data.tagline) || undefined);
                    setIsVerified(data.is_verified || false);
                    setFollowerCount(data.follower_count);
                }
            } catch (err) {
                console.error('Error self-healing company card:', err);
            }
        };

        fetchCompanyDetails();
    }, [id, slug, initialDesc, initialLoc, initialInd]);

    return (
        <Link
            to={`/pages/${slug || id}`}
            className="block w-[220px] shrink-0 glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-2xl border border-black/10 dark:border-white/10"
        >
            {/* Premium Header: Banner + Floating Logo */}
            <div className="relative h-28 w-full overflow-hidden bg-muted">
                {/* Banner Background */}
                {bannerUrl || logoUrl ? (
                    <div className="absolute inset-0">
                        <img
                            src={bannerUrl || logoUrl}
                            alt=""
                            className="w-full h-full object-cover blur-[1px] brightness-[0.6] scale-105 group-hover:scale-110 transition-transform duration-1000"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-800" />
                )}

                {/* Floating Logo/Avatar */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="relative group/logo">
                        <div className="w-16 h-16 rounded-2xl border-[3px] border-black/20 dark:border-white/20 backdrop-blur-xl shadow-2xl overflow-hidden bg-white dark:bg-black/60 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                            {logoUrl ? (
                                <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
                            ) : (
                                <Building2 className="h-8 w-8 text-primary/40" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Followers Badge */}
                {followerCount !== null && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/10 flex items-center gap-1 shadow-lg animate-in fade-in zoom-in duration-500">
                        <Users size={10} className="text-primary" />
                        <span className="text-[8px] font-black text-white">{followerCount.toLocaleString()}</span>
                    </div>
                )}

                {/* Industry Label */}
                {industry && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center px-3">
                        <div className="px-2.5 py-0.5 rounded-full bg-primary text-black text-[7px] font-black uppercase tracking-[0.2em] shadow-lg">
                            {industry}
                        </div>
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="p-4 space-y-4 bg-card/90 dark:bg-black/40 backdrop-blur-xl border-t border-white/5">
                <div className="text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-1.5 px-2">
                        <h4 className="text-[15px] font-black text-foreground leading-tight group-hover:text-primary transition-colors tracking-tighter uppercase truncate">
                            {name}
                        </h4>
                        {(isVerified || name?.toLowerCase().includes('cinecraft')) && (
                            <VerificationBadge size="sm" />
                        )}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                        <MapPin className="h-3 w-3 text-primary/60" />
                        {location || 'Global Operations'}
                    </div>
                </div>

                {description && (
                    <p className="text-[10px] text-foreground/70 font-medium leading-relaxed line-clamp-2 text-center italic border-y border-white/5 py-2 animate-in fade-in duration-700">
                        "{description}"
                    </p>
                )}

                <div className="w-full py-2.5 bg-primary/10 text-primary text-center rounded-xl group-hover:bg-primary group-hover:text-black transition-all text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-primary/20 group-hover:border-transparent">
                    <Building2 size={12} className={industry ? "fill-current" : ""} />
                    Explore Page
                </div>
            </div>
        </Link>
    );
};
