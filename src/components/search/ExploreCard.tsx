import { Link } from 'react-router-dom';

import { Heart, MessageCircle, Play, Layers, User, Building2, ShoppingBag, Megaphone, MessageSquare } from 'lucide-react';

export type ExploreItemType = 'project' | 'user' | 'discussion' | 'post' | 'announcement' | 'vendor' | 'marketplace';

export interface ExploreItem {
    id: string;
    type: ExploreItemType;
    title?: string;
    name?: string;
    username?: string;
    full_name?: string;
    description?: string;
    content?: string;
    avatar_url?: string;
    image_url?: string;
    video_url?: string;
    logo_url?: string;
    author?: {
        username: string;
        full_name: string;
    } | null;
    price_per_day?: number;
    listing_type?: 'equipment' | 'location';
    business_name?: string;
    location?: string;
    city?: string;
    category?: string;
    phone?: string;
    email?: string;
    average_rating?: number;
    review_count?: number;
    like_count?: number;
    comment_count?: number;
}

interface ExploreCardProps {
    item: ExploreItem;
}

export const ExploreCard = ({ item }: ExploreCardProps) => {
    // Consistent gradient based on ID
    const getGradient = (id: string) => {
        const gradients = [
            'bg-gradient-to-br from-pink-500 to-rose-500',
            'bg-gradient-to-br from-purple-500 to-indigo-500',
            'bg-gradient-to-br from-blue-500 to-cyan-500',
            'bg-gradient-to-br from-emerald-500 to-teal-500',
            'bg-gradient-to-br from-orange-500 to-amber-500',
        ];
        const index = id.charCodeAt(0) % gradients.length;
        return gradients[index];
    };

    const Overlay = ({ likes, comments, author }: { likes?: number, comments?: number, author?: { username: string, full_name: string } | null }) => (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-3 z-20 cursor-pointer">
            <div className="flex justify-start">
                {author && (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/20 border border-white/20 flex items-center justify-center overflow-hidden">
                            <User size={12} className="text-white" />
                        </div>
                        <span className="text-[10px] font-black text-white/90 uppercase tracking-widest truncate max-w-[80px]">
                            {author.username}
                        </span>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-center gap-5">
                <div className="flex items-center gap-1.5 text-white font-black text-xs">
                    <Heart className="fill-white" size={18} />
                    <span>{likes || 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white font-black text-xs">
                    <MessageCircle className="fill-white" size={18} />
                    <span>{comments || 0}</span>
                </div>
            </div>
            <div className="flex justify-end">
                {/* Empty for balance or type icon could go here if needed bottom-right */}
            </div>
        </div>
    );

    const TypeBadge = ({ icon: Icon, label }: { icon: any, label: string }) => (
        <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded-full bg-black/90 backdrop-blur-md border border-white/10 flex items-center gap-1.5 pointer-events-none group-hover:opacity-0 transition-opacity duration-300">
            <Icon size={10} className="text-white/80" />
            <span className="text-[7px] font-black text-white uppercase tracking-widest leading-none">{label?.toUpperCase()}</span>
        </div>
    );

    const renderContent = () => {
        switch (item.type) {
            case 'post':
                if (item.video_url) {
                    return (
                        <Link to={`/feed?highlight=${item.id}`} className="block aspect-[4/5] relative group overflow-hidden bg-black transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none">
                            <video src={item.video_url} className="w-full h-full object-cover" muted loop playsInline />
                            <div className="absolute top-2 right-2 text-white drop-shadow-md z-10 pointer-events-none">
                                <Play size={16} fill="currentColor" />
                            </div>
                            <TypeBadge icon={Layers} label="POST" />
                            <Overlay likes={item.like_count} comments={item.comment_count} author={item.author} />
                        </Link>
                    );
                }
                if (item.image_url) {
                    return (
                        <Link to={`/feed?highlight=${item.id}`} className="block aspect-[4/5] relative group overflow-hidden bg-muted transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none">
                            <img src={item.image_url} alt="Post" className="w-full h-full object-cover" />
                            <TypeBadge icon={Layers} label="POST" />
                            <Overlay likes={item.like_count} comments={item.comment_count} author={item.author} />
                        </Link>
                    );
                }
                // Text post or Job Share
                if (item.content?.includes('JOB_SHARE::')) {
                    try {
                        const parts = item.content.split('JOB_SHARE::');
                        const jsonStr = parts[parts.length - 1].trim();
                        const shareData = JSON.parse(jsonStr);

                        return (
                            <Link to={`/feed?highlight=${item.id}`} className="block aspect-[4/5] relative group overflow-hidden bg-gradient-to-br from-card to-muted/5 transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none border-[0.5px] border-white/5">
                                <TypeBadge icon={Megaphone} label="HIRING" />
                                <div className="w-full h-full p-3 flex flex-col justify-between items-center text-center">
                                    <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl border-4 border-background shadow-2xl ring-1 ring-white/10 bg-muted overflow-hidden shrink-0 mt-6 flex items-center justify-center">
                                        {shareData.logoUrl ? (
                                            <img src={shareData.logoUrl} className="object-cover w-full h-full" alt="Company Logo" />
                                        ) : (
                                            <span className="text-2xl font-black text-primary uppercase leading-none">{shareData.company?.[0] || 'J'}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 w-full flex flex-col justify-center items-center gap-2 px-2 pb-6">
                                        <h4 className="text-[12px] md:text-base font-black text-foreground leading-tight tracking-tighter uppercase line-clamp-2 w-full">
                                            {shareData.title || 'Opening'}
                                        </h4>
                                        <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[6px] md:text-[10px] font-black text-primary uppercase tracking-widest shrink-0">
                                            Apply Now
                                        </div>
                                    </div>
                                </div>
                                <Overlay likes={item.like_count} comments={item.comment_count} author={item.author} />
                            </Link>
                        );
                    } catch (e) {
                        // Fallback down to normal text
                    }
                }

                return (
                    <Link to={`/feed?highlight=${item.id}`} className={`block aspect-[4/5] relative group overflow-hidden ${getGradient(item.id)} p-8 flex items-center justify-center text-center transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none`}>
                        <TypeBadge icon={MessageCircle} label="INSIGHT" />
                        <p className="text-white font-black text-sm md:text-base leading-relaxed uppercase tracking-tight line-clamp-6 drop-shadow-lg">
                            {item.content?.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim() || item.content}
                        </p>
                        <Overlay likes={item.like_count} comments={item.comment_count} author={item.author} />
                    </Link>
                );

            case 'project':
                const projectImage = (item as any).image_url || (item as any).thumbnail_url;
                return (
                    <Link to={`/projects/${item.id}/space`} className={`block aspect-[4/5] relative group overflow-hidden ${!projectImage ? getGradient(item.id) : ''} flex flex-col items-center justify-center text-center transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none`}>
                        <TypeBadge icon={Layers} label="PROJECT" />
                        {projectImage ? (
                            <img src={projectImage} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full p-4 flex flex-col items-center justify-center relative z-10">
                                <h3 className="text-white font-black text-lg md:text-xl uppercase tracking-tighter line-clamp-3 mb-2 drop-shadow-md leading-none">{item.title || item.name}</h3>
                                <p className="text-white/80 text-[10px] font-medium line-clamp-2 uppercase tracking-wide">{item.description}</p>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10" />
                        <div className="absolute bottom-4 left-4 right-4 z-20 text-left">
                            <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                <Layers size={10} className="text-white" />
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Active Space</span>
                            </div>
                            <h3 className="text-white font-black text-sm uppercase tracking-tighter line-clamp-1 leading-none">{item.title || item.name}</h3>
                        </div>
                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'user':
                return (
                    <Link to={`/profile/${item.id}`} className="block aspect-[4/5] relative group overflow-hidden bg-black transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none">
                        <TypeBadge icon={User} label="PROFESSIONAL" />
                        <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30 relative">
                            {item.avatar_url ? (
                                <img src={item.avatar_url} className="w-full h-full object-cover" alt={item.username} />
                            ) : (
                                <div className={`w-full h-full ${getGradient(item.id)} flex items-center justify-center`}>
                                    <span className="text-4xl font-black text-white uppercase tracking-tighter">{item.username?.charAt(0)}</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
                                <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                    <User size={10} className="text-white" />
                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Verified Craft</span>
                                </div>
                                <p className="text-white font-black uppercase tracking-tighter text-sm leading-none truncate">@{item.username}</p>
                                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest truncate mt-1">{item.full_name}</p>
                            </div>
                        </div>
                    </Link>
                );

            case 'discussion':
                return (
                    <Link to={`/discussion-rooms/${item.id}`} className="aspect-[4/5] relative group overflow-hidden bg-card border-b border-r border-white/5 flex flex-col px-3 pb-3 pt-0 transition-all hover:brightness-105 active:scale-95 shadow-none rounded-none">
                        {/* 1. Professional Type Header */}
                        <TypeBadge icon={MessageSquare} label="DISCUSSION ROOM" />

                        {/* 2. Structured Information Body (High-End SaaS Style) */}
                        <div className="flex-1 flex flex-col pt-7 relative overflow-hidden min-h-0">
                            <div className="flex justify-between items-start mb-1.5 md:mb-2 relative z-10">
                                <h3 className="text-foreground font-bold text-[clamp(11px,3vw,14px)] uppercase tracking-tighter truncate leading-none w-full">
                                    {item.title}
                                </h3>
                                <MessageSquare size={12} className="text-emerald-500/40 shrink-0 mt-0.5" />
                            </div>

                            <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 relative z-10">
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-[clamp(6.5px,1.5vw,7.5px)] font-black text-emerald-600 uppercase tracking-widest leading-none">
                                    # {item.category || 'GENERAL'}
                                </span>
                                <span className="text-[clamp(6px,1.5vw,7px)] font-medium text-muted-foreground/50 uppercase tracking-widest">
                                    109D AGO
                                </span>
                            </div>

                            <p className="text-muted-foreground/80 text-[clamp(8px,2vw,10px)] font-medium line-clamp-3 md:line-clamp-4 leading-relaxed mb-1 md:mb-2 uppercase tracking-tight relative z-10">
                                {item.description || 'Verified cinematic craft discussion for professional creators.'}
                            </p>
                        </div>

                        {/* 3. High-Gloss Action Strip */}
                        <div className="mt-auto pt-2 border-t border-border/10">
                            <div className="w-full py-[clamp(6px,1.5vh,10px)] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2 transition-all duration-300 shadow-md translate-y-0 group-hover:-translate-y-0.5">
                                <MessageSquare size={12} fill="white" className="opacity-80" />
                                <span className="text-[clamp(8px,2vw,10px)] font-extrabold uppercase tracking-widest leading-none">Join Room</span>
                            </div>
                        </div>

                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'announcement':
                return (
                    <div className={`aspect-[4/5] relative group overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-600/5 p-6 flex flex-col items-center justify-center text-center border-b border-r border-orange-500/20 shadow-none rounded-none`}>
                        <TypeBadge icon={Megaphone} label="OFFICIAL" />
                        <div className="w-16 h-16 rounded-3xl bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500 border border-orange-500/20">
                            <Megaphone size={32} />
                        </div>
                        <h3 className="text-foreground font-black text-base md:text-lg uppercase tracking-tighter line-clamp-3 leading-none">{item.title}</h3>
                    </div>
                );

            case 'vendor':
                return (
                    <Link to="/vendors" className={`aspect-[4/5] relative group overflow-hidden bg-card border-b border-r border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col rounded-none`}>
                        <TypeBadge icon={Building2} label="VENDORS" />
                        <div className="relative aspect-[2/1] w-full overflow-hidden shrink-0 bg-muted/20">
                            {item.logo_url ? (
                                <img src={item.logo_url} className="w-full h-full object-cover" alt={item.business_name} />
                            ) : (
                                <div className={`w-full h-full ${getGradient(item.id)} flex flex-col items-center justify-center`}>
                                    <Building2 size={24} className="text-white/20 mb-1" />
                                    <span className="text-xl font-black text-white uppercase">{item.business_name?.charAt(0)}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 p-2 md:p-3 flex flex-col justify-between overflow-hidden min-h-0">
                            <div className="space-y-1.5 md:space-y-2">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[7px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">
                                            # {item.category || 'CRAFT VENDOR'}
                                        </div>
                                    </div>
                                    <h3 className="text-foreground font-bold text-[clamp(12px,2.5vw,14px)] uppercase tracking-tighter truncate leading-none">{item.business_name}</h3>
                                    <p className="text-muted-foreground text-[clamp(8px,2vw,10px)] font-medium line-clamp-2 uppercase tracking-tight">{item.description || 'Verified Film Craft Professional Service Provider.'}</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50 border border-border/50 text-[clamp(6px,1.5vw,7.5px)] font-black uppercase tracking-tighter text-muted-foreground w-fit max-w-full">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                        <span className="truncate">{item.city || item.location || 'HYDERABAD, IND'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-border/10 flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-1 text-muted-foreground min-w-0">
                                    <span className="w-4 h-4 md:w-5 md:h-5 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <Play size={8} className="fill-emerald-500/80 rotate-90" />
                                    </span>
                                    <span className="text-[clamp(8px,2vw,9.5px)] font-black tracking-tight truncate">{item.phone || '91XXXXXXXX'}</span>
                                </div>
                                <div className="px-2 py-0.5 rounded-md bg-secondary/50 border border-border/50 text-[clamp(6px,1.5vw,7.5px)] font-black text-muted-foreground uppercase whitespace-nowrap">
                                    CONTACT
                                </div>
                            </div>
                        </div>
                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'marketplace':
                return (
                    <Link to="/marketplace" className="aspect-[4/5] relative group overflow-hidden bg-card border-b border-r border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col">
                        <TypeBadge icon={ShoppingBag} label={item.listing_type?.toUpperCase() || 'EQUIPMENT'} />
                        <div className="relative aspect-[2/1] w-full overflow-hidden shrink-0">
                            {item.image_url ? (
                                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                                    <ShoppingBag size={24} className="text-muted-foreground/30" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 p-2 md:p-3 flex flex-col justify-between overflow-hidden min-h-0">
                            <div className="space-y-1.5 md:space-y-2">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[7px] font-black text-blue-600 uppercase tracking-widest whitespace-nowrap">
                                            # {item.category || 'EQUIPMENT'}
                                        </div>
                                    </div>
                                    <h3 className="text-foreground font-bold text-[clamp(12px,2.5vw,14px)] uppercase tracking-tighter truncate leading-none">{item.title}</h3>
                                    <p className="text-muted-foreground text-[clamp(8px,2vw,10px)] font-medium line-clamp-2 uppercase tracking-tight">{item.description || 'Professional Grade Equipment Listing.'}</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/50 border border-border/50 text-[clamp(6px,1.5vw,7.5px)] font-black uppercase tracking-tighter text-muted-foreground w-fit max-w-full">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                        <span className="truncate">{item.city || 'HYDERABAD, IND'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-border/10 flex items-center justify-between mt-auto">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-emerald-500 font-black text-[clamp(13px,3vw,16px)] tracking-tighter">₹{item.price_per_day}</span>
                                    <span className="text-[clamp(6px,1.5vw,7.5px)] font-black text-muted-foreground uppercase opacity-70">/ Day</span>
                                </div>
                                <div className="px-2 py-0.5 rounded-md bg-muted/50 border border-border/50 text-[clamp(6px,1.5vw,7.5px)] font-black text-muted-foreground uppercase whitespace-nowrap">
                                    ₹{item.price_per_day ? item.price_per_day * 10 : 0} / WK
                                </div>
                            </div>
                        </div>
                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            default:
                return null;
        }
    };

    return renderContent();
};
