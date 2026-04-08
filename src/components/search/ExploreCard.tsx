import { Link } from 'react-router-dom';

import { Heart, MessageCircle, Play, Layers, User, Building2, ShoppingBag, Megaphone, MessageSquare, MapPin, Film } from 'lucide-react';

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
    status?: string;
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
                        <Link to={`/post/${item.id}`} className="block aspect-[3/4.5] relative group overflow-hidden bg-black transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none">
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
                        <Link to={`/post/${item.id}`} className="block aspect-[3/4.5] relative group overflow-hidden bg-muted transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none">
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
                            <Link to={`/post/${item.id}`} className="block aspect-[3/4.5] relative group overflow-hidden bg-gradient-to-br from-card to-muted/5 transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none border-[0.5px] border-white/5">
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
                    <Link to={`/post/${item.id}`} className={`block aspect-[3/4.5] relative group overflow-hidden ${getGradient(item.id)} p-8 flex items-center justify-center text-center transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none`}>
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
                    <Link to={`/projects/${item.id}/space`} className="aspect-[3/4.5] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col shadow-2xl rounded-none">
                        <TypeBadge icon={Layers} label="PROJECT SPACE" />
                        <div className="relative aspect-[1.5/1] w-full overflow-hidden shrink-0 bg-black border-b border-white/10">
                            {projectImage ? (
                                <img src={projectImage} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            ) : (
                                <div className="w-full h-full bg-muted/20 flex items-center justify-center p-6 border-b border-white/5" style={{ background: getGradient(item.id) }}>
                                    <Layers size={32} className="text-white/30 animate-pulse" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                            <div className="absolute bottom-2 left-2">
                                <span className="px-1.5 py-0.5 rounded-sm bg-primary text-[clamp(6.5px,1.5vw,8px)] font-black text-primary-foreground uppercase tracking-widest leading-none shadow-lg">
                                    {(item as any).status || 'ACTIVE'}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 px-4 pt-2 pb-4 flex flex-col justify-between overflow-hidden min-h-0 bg-gradient-to-b from-card to-background">
                            <div className="space-y-1">
                                <h3 className="text-foreground font-black text-[clamp(11px,3vw,14px)] uppercase tracking-tighter leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                    {item.title || item.name}
                                </h3>

                                <p className="text-muted-foreground text-[clamp(8px,1.8vw,9.5px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed">
                                    {item.description || 'Professional production workspace for cinematic collaboration and project management.'}
                                </p>

                                <div className="flex flex-col gap-1 text-muted-foreground pt-1.5 border-t border-white/5">
                                    {((item as any).genre?.[0]) && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Film size={10} className="text-primary" />
                                            <span className="text-[clamp(7.5px,1.5vw,8.5px)] font-black uppercase tracking-widest truncate max-w-[120px]">{(item as any).genre[0]}</span>
                                        </div>
                                    )}
                                    {(item as any).location && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <MapPin size={10} className="text-primary" />
                                            <span className="text-[clamp(7px,1.5vw,8.5px)] font-black uppercase tracking-widest truncate max-w-[120px] opacity-70">{(item as any).location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-auto pt-2 overflow-hidden h-0 group-hover:h-8 transition-all duration-300">
                                <div className="w-full h-full bg-primary text-primary-foreground text-[clamp(7.5px,2vw,9px)] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-1.5 rounded-sm shadow-xl">
                                    ENTER SPACE <Play size={8} fill="currentColor" />
                                </div>
                            </div>
                        </div>

                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'user':
                return (
                    <Link to={`/profile/${item.id}`} className="block aspect-[3/4.5] relative group overflow-hidden bg-black transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none">
                        <TypeBadge icon={User} label="CREATOR" />
                        <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30 relative">
                            {item.avatar_url ? (
                                <img src={item.avatar_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.username} />
                            ) : (
                                <div className={`w-full h-full ${getGradient(item.id)} flex items-center justify-center`}>
                                    <span className="text-4xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">{item.username?.charAt(0)}</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                    <span className="text-[clamp(7.5px,2vw,9px)] font-black text-white uppercase tracking-[0.15em]">Verified</span>
                                </div>
                                <p className="text-white font-black uppercase tracking-tighter text-[clamp(11px,3.5vw,15px)] leading-none truncate">@{item.username}</p>
                                <p className="text-white/60 text-[clamp(8px,2vw,10px)] font-bold uppercase tracking-widest truncate mt-0.5">{item.full_name}</p>
                            </div>
                        </div>
                    </Link>
                );

            case 'discussion':
                return (
                    <Link to={`/discussion-rooms/${item.id}`} className="aspect-[3/4.5] relative group overflow-hidden bg-card border-white/5 flex flex-col transition-all hover:brightness-105 active:scale-95 shadow-2xl rounded-none">
                        <TypeBadge icon={MessageSquare} label="DISCUSSION" />

                        <div className="flex-1 flex flex-col p-4 pt-8 pb-2 relative overflow-hidden min-h-0 bg-gradient-to-br from-card to-background">
                            <div className="min-w-0 mb-3">
                                <h3 className="text-foreground font-black text-[clamp(10px,3vw,14px)] uppercase tracking-tighter leading-tight line-clamp-2">
                                    {item.title}
                                </h3>
                                <p className="text-primary text-[clamp(6.5px,1.5vw,7.5px)] font-black uppercase tracking-widest mt-0.5 leading-none shrink-0 truncate"># {String((item as any).category || 'GENERAL').toUpperCase()}</p>
                            </div>

                            <p className="text-muted-foreground/80 text-[clamp(8px,2vw,10px)] font-medium line-clamp-5 leading-relaxed mb-3 uppercase tracking-tight opacity-70 italic group-hover:opacity-100 transition-opacity">
                                "{item.description || 'Verified cinematic craft discussion room.'}"
                            </p>

                            <div className="mt-auto">
                                <div className="w-full py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 transition-all duration-300">
                                    <span className="text-[clamp(7.5px,2vw,9px)] font-black uppercase tracking-[0.15em]">Join Now</span>
                                </div>
                            </div>
                        </div>

                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'announcement':
                return (
                    <Link to="/announcements" className={`aspect-[3/4.5] relative group overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-600/5 p-6 flex flex-col items-center justify-center text-center transition-all hover:brightness-105 active:scale-95 shadow-2xl rounded-none`}>
                        <TypeBadge icon={Megaphone} label="NEWS" />
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500 border border-orange-500/20 shadow-2xl ring-1 ring-orange-500/30">
                            <Megaphone size={24} className="group-hover:rotate-12 transition-transform duration-500" />
                        </div>
                        <h3 className="text-foreground font-black text-[clamp(11px,3.5vw,15px)] uppercase tracking-tighter line-clamp-3 leading-tight">{item.title}</h3>
                        <div className="mt-4 px-4 py-1 rounded-full border border-orange-500/30 text-orange-500 text-[clamp(7.5px,2vw,9px)] font-black uppercase tracking-widest group-hover:bg-orange-500/10 transition-colors">
                            Read Update
                        </div>
                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'vendor':
                return (
                    <Link to={`/vendors/${item.id}`} className={`aspect-[3/4.5] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col rounded-none shadow-2xl`}>
                        <TypeBadge icon={Building2} label="VENDOR" />
                        <div className="relative aspect-[1.5/1] w-full overflow-hidden shrink-0 bg-black border-b border-white/5">
                            {item.logo_url ? (
                                <img src={item.logo_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={item.business_name} />
                            ) : (
                                <div className={`w-full h-full ${getGradient(item.id)} flex flex-col items-center justify-center opacity-80`}>
                                    <Building2 size={24} className="text-white/20 mb-1" />
                                    <span className="text-2xl font-black text-white uppercase tracking-tighter">{item.business_name?.charAt(0)}</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                        </div>

                        <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden min-h-0">
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <div className="px-1 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-[clamp(6.5px,1.5vw,7.5px)] font-black text-primary uppercase tracking-widest leading-none w-fit shrink-0">
                                        {String((item as any).category || 'VENDOR').toUpperCase()}
                                    </div>
                                    <span className="block text-[clamp(7.5px,2vw,9px)] font-black text-muted-foreground uppercase tracking-widest truncate opacity-60">{item.city || 'GLOBAL'}</span>
                                </div>

                                <h3 className="text-foreground font-black text-[clamp(10px,3vw,14px)] uppercase tracking-tighter leading-tight line-clamp-2">{item.business_name}</h3>

                                <p className="text-muted-foreground text-[clamp(8px,2vw,9.5px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed">
                                    {item.description || 'Verified cinematic craft professional service provider.'}
                                </p>
                            </div>
                        </div>
                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'marketplace':
                return (
                    <Link to={`/marketplace/${item.id}`} className="aspect-[3/4.5] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col shadow-2xl rounded-none">
                        <TypeBadge icon={ShoppingBag} label={`${String(item.listing_type || 'EQUIPMENT').toUpperCase()}`} />
                        <div className="relative aspect-[1.5/1] w-full overflow-hidden shrink-0 bg-black border-b border-white/5">
                            {item.image_url ? (
                                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            ) : (
                                <div className="w-full h-full bg-muted/20 flex items-center justify-center">
                                    <ShoppingBag size={24} className="text-muted-foreground/20 animate-pulse" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                        </div>

                        <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden min-h-0">
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="px-1 py-0.5 rounded-sm bg-blue-500/10 border border-blue-500/20 text-[clamp(6.5px,1.5vw,7.5px)] font-black text-blue-600 uppercase tracking-widest leading-none w-fit shrink-0">
                                            {String((item as any).category || 'GEAR').toUpperCase()}
                                        </div>
                                        <span className="text-emerald-500 font-black text-[clamp(9px,2.5vw,11px)] tracking-tighter shrink-0">
                                            ₹{item.price_per_day}
                                        </span>
                                    </div>
                                    <span className="block text-[clamp(7.5px,2vw,9px)] font-black text-muted-foreground uppercase tracking-widest truncate opacity-60">{item.location || 'GLOBAL'}</span>
                                </div>

                                <h3 className="text-foreground font-black text-[clamp(10px,3vw,14px)] uppercase tracking-tighter leading-tight line-clamp-2">{item.title}</h3>
                                <p className="text-muted-foreground text-[clamp(8px,2vw,9.5px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed">
                                    {item.description || 'Verified cinematic production resource and world-class professional listing.'}
                                </p>
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
