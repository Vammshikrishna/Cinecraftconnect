import { Link } from 'react-router-dom';
import { Store, MapPin, Star, Phone, Mail, CheckCircle2, Briefcase } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VendorShareCardProps {
    vendorId: string;
    name: string;
    logoUrl?: string;
    bannerUrl?: string;
    category?: string | string[];
    location?: string;
    description?: string;
    phone?: string;
    email?: string;
    rating?: number;
    reviewCount?: number;
    isVerified?: boolean;
    services_offered?: string[];
}

export const VendorShareCard = ({
    vendorId,
    name: initialName,
    logoUrl: initialLogo,
    bannerUrl: initialBanner,
    category: initialCat,
    location: initialLoc,
    description: initialDesc,
    phone: initialPhone,
    email: initialEmail,
    rating: initialRating,
    reviewCount: initialReviewCount,
    isVerified: initialVerified,
    services_offered: initialServices
}: VendorShareCardProps) => {
    const [name, setName] = useState(initialName);
    const [logoUrl, setLogoUrl] = useState(initialLogo);
    const [bannerUrl, setBannerUrl] = useState(initialBanner);
    const [categories, setCategories] = useState<string[]>(
        Array.isArray(initialCat) ? initialCat : initialCat ? [initialCat] : []
    );
    const [location, setLocation] = useState(initialLoc);
    const [description, setDescription] = useState(initialDesc);
    const [phone, setPhone] = useState(initialPhone);
    const [email, setEmail] = useState(initialEmail);
    const [rating, setRating] = useState(initialRating);
    const [reviewCount, setReviewCount] = useState(initialReviewCount);
    const [isVerified, setIsVerified] = useState(initialVerified);
    const [services, setServices] = useState<string[]>(initialServices || []);

    useEffect(() => {
        const fetchMissingData = async () => {
            if (!vendorId || vendorId === 'undefined' || vendorId === 'null') return;
            // If we have basic info but are missing the "detail" info, fetch it
            if (initialDesc && initialPhone && initialEmail && initialRating) return;

            try {
                const { data, error } = await supabase
                    .from('vendors')
                    .select('*')
                    .eq('id', vendorId)
                    .single();

                if (data && !error) {
                    const v = data;
                    setName(v.business_name);
                    setLogoUrl(v.logo_url || undefined);
                    setBannerUrl((v.images?.[0] || v.logo_url) || undefined);
                    setCategories(Array.isArray(v.category) ? v.category : v.category ? [v.category] : []);
                    setLocation(v.location || undefined);
                    setDescription(v.description || undefined);
                    setPhone(v.phone || undefined);
                    setEmail(v.email || undefined);
                    // Use fallback values as these might come from a view/RPC in future
                    setRating((v as any).average_rating || (v as any).rating || 0);
                    setReviewCount((v as any).review_count || (v as any).reviewCount || 0);
                    setIsVerified(v.is_verified || false);
                    setServices(v.services_offered || []);
                }
            } catch (err) {
                console.error('Error self-healing vendor card:', err);
            }
        };

        fetchMissingData();
    }, [vendorId, initialDesc, initialPhone, initialEmail, initialRating]);

    return (
        <Link
            to={`/vendors/${vendorId}`}
            className="block w-full max-w-[240px] min-w-[220px] glass-card-premium rounded-2xl overflow-hidden transition-all duration-500 hover:-translate-y-2 active:scale-[0.98] no-underline group shadow-xl border border-white/10"
        >
            {/* Premium Header: Banner + Floating Logo */}
            <div className="relative h-28 w-full overflow-hidden bg-muted">
                {/* Banner Background */}
                {bannerUrl || logoUrl ? (
                    <div className="absolute inset-0">
                        <img
                            src={bannerUrl || logoUrl}
                            alt=""
                            className="w-full h-full object-cover blur-[2px] brightness-75 scale-105 group-hover:scale-110 transition-transform duration-1000"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-primary/5" />
                )}

                {/* Floating Logo/Avatar */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="relative group/logo">
                        <div className="w-16 h-16 rounded-full border-4 border-white/20 backdrop-blur-xl shadow-2xl overflow-hidden bg-background/80 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-500">
                            {logoUrl ? (
                                <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
                            ) : (
                                <Store className="h-8 w-8 text-primary/40" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Rating Badge */}
                {reviewCount ? reviewCount > 0 && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-1 shadow-lg animate-in fade-in zoom-in duration-500">
                        <Star size={10} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-[9px] font-black text-white">{rating?.toFixed(1)}</span>
                    </div>
                ) : null}

                {/* Categories */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 px-3">
                    {categories.slice(0, 2).map((cat, i) => (
                        <div key={i} className="px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-md border border-white/10 text-[7px] font-black uppercase tracking-widest text-white/90">
                            {cat}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4 space-y-4 bg-muted/30 backdrop-blur-xl">
                <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5 px-2">
                        <h4 className="text-[16px] font-black text-foreground leading-tight group-hover:text-primary transition-colors tracking-tighter uppercase truncate">
                            {name}
                        </h4>
                        {isVerified && (
                            <div className="bg-primary/20 text-primary p-0.5 rounded-full shrink-0">
                                <CheckCircle2 size={12} fill="currentColor" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground font-bold uppercase tracking-widest">
                        <MapPin className="h-3 w-3 text-primary/60" />
                        {location || 'Global'}
                    </div>
                </div>

                {description && (
                    <p className="text-[10px] text-foreground/60 font-medium leading-relaxed line-clamp-2 text-center italic border-y border-white/5 py-2 animate-in fade-in duration-700">
                        "{description}"
                    </p>
                )}

                {services && services.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center justify-center animate-in fade-in duration-1000">
                        {services.slice(0, 3).map((svc, i) => (
                            <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/5 text-[7px] font-black uppercase tracking-widest text-primary/70">
                                <Briefcase size={8} /> {svc}
                            </div>
                        ))}
                    </div>
                )}

                {/* Contact Quick Info */}
                {(phone || email) && (
                    <div className="flex items-center justify-center gap-3 animate-in fade-in slide-in-from-bottom-1 duration-500">
                        {phone && (
                            <div className="flex items-center gap-1.5 text-[8px] font-black text-primary uppercase tracking-widest">
                                <Phone size={10} />
                                Available
                            </div>
                        )}
                        {email && (
                            <div className="flex items-center gap-1.5 text-[8px] font-black text-green-500 uppercase tracking-widest">
                                <Mail size={10} />
                                Verified
                            </div>
                        )}
                    </div>
                )}

                <div className="w-full py-2.5 bg-primary text-black text-center rounded-xl hover:bg-primary/90 transition-all text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                    <Store size={14} className="fill-black" />
                    Visit Company
                </div>
            </div>
        </Link>
    );
};

