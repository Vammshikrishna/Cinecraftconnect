import { Link } from 'react-router-dom';

import { Heart, MessageCircle, Play, Layers, User, Users, Building2, ShoppingBag, Megaphone, MessageSquare, MapPin, Film, Zap } from 'lucide-react';
import VerificationBadge from '../common/VerificationBadge';

export type ExploreItemType = 'project' | 'user' | 'discussion' | 'post' | 'announcement' | 'vendor' | 'marketplace' | 'company';

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
        is_verified?: boolean;
    } | null;
    is_verified?: boolean;
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
    isSpanned?: boolean;
}

export const ExploreCard = ({ item, isSpanned = false }: ExploreCardProps) => {
    // Consistent gradient based on ID
    const getGradient = (id: string) => {
        const gradients = [
            'bg-gradient-to-br from-pink-500 to-rose-500',
            'bg-gradient-to-br from-purple-500 to-indigo-500',
            'bg-gradient-to-br from-blue-500 to-cyan-500',
            'bg-gradient-to-br from-primary to-accent',
            'bg-gradient-to-br from-orange-500 to-amber-500',
        ];
        const index = id.charCodeAt(0) % gradients.length;
        return gradients[index];
    };

    const Overlay = ({ actionText, author }: { actionText?: string, likes?: number, comments?: number, author?: { username: string, full_name: string, is_verified?: boolean } | null }) => (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col p-3 z-20 cursor-pointer">
            <div className="flex justify-start">
                {author && (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/20 border border-white/20 flex items-center justify-center overflow-hidden">
                            <User size={12} className="text-white" />
                        </div>
                        <span className="text-[10px] font-black text-white/90 uppercase tracking-widest truncate max-w-[120px]">
                            {author.full_name || author.username}
                        </span>
                        {(author.is_verified || author.username?.toLowerCase().includes('vamshi')) && (
                            <VerificationBadge size="xs" className="scale-75" />
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                {actionText && (
                    <div className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-xl flex items-center gap-2 border border-white/10">
                        {actionText}
                    </div>
                )}
            </div>

        </div>
    );

    const CornerBrackets = () => (
        <>
            <div className="absolute top-2 left-2 w-3 h-3 border-t-[1.5px] border-l-[1.5px] border-primary z-20 pointer-events-none transition-all duration-300 opacity-80" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-[1.5px] border-r-[1.5px] border-primary z-20 pointer-events-none transition-all duration-300 opacity-80" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-[1.5px] border-l-[1.5px] border-primary z-20 pointer-events-none transition-all duration-300 opacity-80" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-[1.5px] border-r-[1.5px] border-primary z-20 pointer-events-none transition-all duration-300 opacity-80" />
        </>
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
                        <Link to={`/post/${item.id}`} state={{ from: 'explore' }} className="block aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-black transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none">
                            <video src={item.video_url} className="w-full h-full object-cover" muted loop playsInline />
                            <div className="absolute top-2 right-2 text-white drop-shadow-md z-10 pointer-events-none">
                                <Play size={16} fill="currentColor" />
                            </div>
                            <TypeBadge icon={Layers} label="POST" />
                            <Overlay actionText="VIEW POST" likes={item.like_count} comments={item.comment_count} author={item.author} />
                        </Link>
                    );
                }
                if (item.image_url) {
                    return (
                        <Link to={`/post/${item.id}`} state={{ from: 'explore' }} className="block aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-muted transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none">
                            <img src={item.image_url} alt="Post" className="w-full h-full object-cover" />
                            <TypeBadge icon={Layers} label="POST" />
                            <Overlay actionText="VIEW POST" likes={item.like_count} comments={item.comment_count} author={item.author} />
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
                            <Link to={`/post/${item.id}`} state={{ from: 'explore' }} className="block aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-gradient-to-br from-card to-muted/5 transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none border-[0.5px] border-white/5">
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
                                        <h4 className="font-serif text-sm md:text-lg font-bold text-foreground leading-tight tracking-tighter uppercase line-clamp-2 w-full">
                                            {shareData.title || 'Opening'}
                                        </h4>
                                        <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[6px] md:text-[10px] font-black text-primary uppercase tracking-widest shrink-0">
                                            Apply Now
                                        </div>
                                    </div>
                                </div>
                                <Overlay actionText="VIEW JOB" likes={item.like_count} comments={item.comment_count} author={item.author} />
                            </Link>
                        );
                    } catch (e) {
                        // Fallback down to normal text
                    }
                }

                return (
                    <Link to={`/post/${item.id}`} state={{ from: 'explore' }} className={`block aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden ${getGradient(item.id)} p-8 flex items-center justify-center text-center transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none`}>
                        <TypeBadge icon={MessageCircle} label="INSIGHT" />
                        <p className="font-serif text-white font-bold text-[clamp(12px,3vw,16px)] leading-relaxed uppercase tracking-tight line-clamp-6 drop-shadow-lg">
                            {item.content?.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim() || item.content}
                        </p>
                        <Overlay actionText="VIEW POST" likes={item.like_count} comments={item.comment_count} author={item.author} />
                    </Link>
                );

            case 'project':
                const projectImage = (item as any).image_url || (item as any).thumbnail_url;
                return (
                    <Link to={`/projects/${item.id}/space`} className="aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col shadow-2xl rounded-none">
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
                                <span className="font-mono px-1.5 py-0.5 rounded-sm bg-primary text-[clamp(6px,1.2vw,7.5px)] font-bold text-primary-foreground uppercase tracking-widest leading-none shadow-lg">
                                    STATUS // {(item as any).status || 'ACTIVE'}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 px-4 pt-2 pb-4 flex flex-col justify-between overflow-hidden min-h-0 bg-gradient-to-b from-card to-background">
                            <div className="space-y-1">
                                <h3 className="font-serif text-[clamp(12px,3vw,16px)] font-bold text-foreground uppercase tracking-tighter leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                    {item.title || item.name}
                                </h3>

                                <p className="text-muted-foreground text-[clamp(7px,1.5vw,8.5px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed">
                                    {item.description || 'Professional production workspace for cinematic collaboration and project management.'}
                                </p>

                                <div className="flex flex-col gap-1 text-muted-foreground pt-1.5 border-t border-white/5">
                                    {((item as any).genre?.[0]) && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Film size={10} className="text-primary" />
                                            <span className="font-mono text-[clamp(6.5px,1.2vw,7.5px)] font-bold uppercase tracking-widest truncate max-w-[120px]">GENRE // {(item as any).genre[0]}</span>
                                        </div>
                                    )}
                                    {(item as any).location && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <MapPin size={10} className="text-primary" />
                                            <span className="font-mono text-[clamp(6px,1.2vw,7.5px)] font-bold uppercase tracking-widest truncate max-w-[120px] opacity-70">LOC // {(item as any).location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        <Overlay actionText="VIEW PROJECT" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'user':
                const craftsStr = (item as any).craft ?
                    (Array.isArray((item as any).craft) ? (item as any).craft.join(', ') : String((item as any).craft))
                    : 'CREATOR';
                return (
                    <Link to={`/profile/${item.id}`} className="aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-[#F8F5F2] border border-black/5 transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center rounded-[1.25rem] shadow-sm">
                        <CornerBrackets />
                        <div className="w-[45%] aspect-square rounded-full overflow-hidden shadow-xl border-[3px] border-white mb-3 group-hover:shadow-2xl transition-all duration-500 relative z-10">
                            {item.avatar_url ? (
                                <img src={item.avatar_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.full_name || item.username} />
                            ) : (
                                <div className={`w-full h-full ${getGradient(item.id)} flex items-center justify-center`}>
                                    <span className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter drop-shadow-md">{item.username?.charAt(0)}</span>
                                </div>
                            )}
                        </div>

                        <div className="px-4 text-center w-full flex flex-col items-center z-10">
                            <div className="flex items-center justify-center gap-1.5 w-full mb-2 px-1">
                                <h3 className="font-serif text-[clamp(10px,2.5vw,14px)] font-black text-[#FF3300] uppercase tracking-tight leading-tight line-clamp-2">
                                    {item.full_name || item.username}
                                </h3>
                                {(item.is_verified ||
                                    item.username?.toLowerCase().includes('vamshi') ||
                                    item.full_name?.toLowerCase().includes('vamshi')) && (
                                        <VerificationBadge size="xs" className="shrink-0 scale-90" />
                                    )}
                            </div>

                            <div className="bg-[#FF3300]/10 border border-[#FF3300]/30 text-[#FF3300] font-black text-[6.5px] md:text-[8px] uppercase tracking-widest px-3 py-1 rounded-full flex items-center justify-center gap-1 shadow-sm max-w-[95%]">
                                <Zap size={8} className="shrink-0" fill="currentColor" />
                                <span className="line-clamp-2 leading-snug whitespace-normal text-center">{craftsStr}</span>
                            </div>

                            <p className="mt-3 text-[9px] md:text-[10px] text-muted-foreground/80 italic font-medium line-clamp-2 px-1 leading-relaxed opacity-80 w-full text-center">
                                "{item.description || 'Passionate cinematic creator connecting through storytelling.'}"
                            </p>
                        </div>

                        <Overlay actionText="VIEW PROFILE" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'discussion':
                return (
                    <Link to={`/discussion-rooms/${item.id}`} className="aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border border-border flex flex-col transition-all hover:scale-[1.02] active:scale-95 shadow-sm rounded-[1.25rem]">
                        <CornerBrackets />

                        <div className="flex flex-col flex-1 p-5 relative z-10 h-full">
                            {/* Top Header */}
                            <div className="flex items-center gap-2.5 mb-5 pt-2">
                                <div className="w-10 h-10 rounded-[12px] bg-[#FF3300]/10 border border-[#FF3300]/30 flex items-center justify-center shrink-0 shadow-sm">
                                    <MessageSquare size={18} className="text-[#FF3300]" />
                                </div>
                                <div className="flex flex-col justify-center -gap-0.5 mt-0.5">
                                    <span className="text-foreground font-black text-[clamp(14px,3.5vw,16px)] uppercase tracking-[0.15em] leading-none">DISCUSSION</span>
                                    <span className="text-[#FF3300] font-black text-[8.5px] uppercase tracking-[0.2em] leading-none mt-0.5 ml-[1px]">ROOM</span>
                                </div>
                            </div>

                            {/* Title */}
                            <h3 className="font-serif text-[clamp(14px,3.5vw,18px)] font-black text-[#FF3300] uppercase tracking-tight leading-tight line-clamp-2 mb-4 pr-2">
                                {item.title}
                            </h3>

                            {/* Description with left border */}
                            <div className="pl-3 border-l-[2.5px] border-[#FF3300]/30 mb-auto">
                                <p className="text-muted-foreground text-[11px] md:text-xs font-semibold line-clamp-4 leading-relaxed italic opacity-90">
                                    {item.description || 'Verified cinematic craft discussion room.'}
                                </p>
                            </div>

                            {/* Bottom Footer */}
                            <div className="flex items-center gap-2 mt-5 text-muted-foreground/80">
                                <Users size={16} className="text-[#FF3300]" />
                                <span className="font-black text-[10px] uppercase tracking-widest">{(item as any).member_count || 0} MEMBERS</span>
                            </div>
                        </div>

                        <Overlay actionText="JOIN ROOM" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'announcement':
                return (
                    <Link to="/announcements" className={`aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-600/5 p-6 flex flex-col items-center justify-center text-center transition-all hover:brightness-105 active:scale-95 shadow-2xl rounded-none`}>
                        <TypeBadge icon={Megaphone} label="NEWS" />
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500 border border-orange-500/20 shadow-2xl ring-1 ring-orange-500/30">
                            <Megaphone size={24} className="group-hover:rotate-12 transition-transform duration-500" />
                        </div>
                        <h3 className="font-serif text-[clamp(12px,3vw,16px)] font-bold text-foreground uppercase tracking-tighter line-clamp-3 leading-tight">{item.title}</h3>
                        <div className="mt-4 px-4 py-1 rounded-full border border-orange-500/30 text-orange-500 text-[clamp(6.5px,1.5vw,8px)] font-black uppercase tracking-widest group-hover:bg-orange-500/10 transition-colors">
                            Read Update
                        </div>
                        <Overlay actionText="VIEW UPDATE" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'company':
                return (
                    <Link to={`/company/${item.id}`} className={`aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-white transition-all hover:scale-[1.02] active:scale-95 flex flex-col rounded-[1.25rem] shadow-md border border-black/5`}>
                        <CornerBrackets />
                        <div className="absolute top-3 right-3 z-30 bg-[#0A0A0A] rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-lg">
                            <Users size={12} className="text-[#FF1A1A]" />
                            <span className="text-[10px] font-bold text-white">{item.like_count || 0}</span>
                        </div>

                        <div className="relative h-[45%] w-full overflow-hidden shrink-0 bg-[#1a1a1a]">
                            <img src={item.image_url || 'https://images.unsplash.com/photo-1595679905207-6b08051774e1?auto=format&fit=crop&q=80'} className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110" alt="Company Banner" />
                        </div>

                        <div className="flex-1 bg-white p-4 flex flex-col items-center text-center relative z-10 pt-10">
                            <div className="absolute -top-12 flex flex-col items-center">
                                <div className="w-[4.5rem] h-[4.5rem] md:w-20 md:h-20 rounded-[1.25rem] bg-[#FF4500] border-[3px] border-white shadow-sm overflow-hidden flex items-center justify-center p-1 z-10 relative">
                                    {item.logo_url ? (
                                        <img src={item.logo_url} className="w-full h-full object-contain" alt={item.name} />
                                    ) : (
                                        <Building2 size={32} className="text-white" />
                                    )}
                                </div>
                                <div className="bg-[#FF1A1A] text-black font-black text-[9px] md:text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full -mt-2.5 relative z-20">
                                    {Array.isArray((item as any).industry) ? (item as any).industry[0] : ((item as any).industry || 'PRODUCTION HOUSE')}
                                </div>
                            </div>

                            <h3 className="font-serif text-[clamp(14px,3.5vw,18px)] font-black text-black uppercase tracking-tight leading-tight line-clamp-1 w-full mt-2">
                                {item.name}
                            </h3>

                            <div className="flex items-center gap-1 mt-1.5 text-muted-foreground mb-4">
                                <MapPin size={12} className="text-[#FF1A1A]" />
                                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-widest">{item.location || 'GLOBAL'}</span>
                            </div>

                            <p className="text-[#666666] text-xs font-medium italic line-clamp-2 px-2 mt-auto pb-2">
                                "{item.description || 'movie is a soulful entertainment'}"
                            </p>
                        </div>
                        <Overlay actionText="VIEW COMPANY" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'vendor':
                return (
                    <Link to={`/vendors/${item.id}`} className={`aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col rounded-none shadow-2xl`}>
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
                                    <div className="font-mono px-1.5 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-[clamp(6px,1.2vw,7px)] font-bold text-primary uppercase tracking-widest leading-none w-fit shrink-0">
                                        CAT // {String((item as any).category || 'VENDOR').toUpperCase()}
                                    </div>
                                    <span className="font-mono block text-[clamp(6.5px,1.5vw,8px)] font-bold text-muted-foreground uppercase tracking-widest truncate opacity-60 bg-muted/10 border border-border/40 px-1 py-0.5 rounded w-max">LOC // {item.city || 'GLOBAL'}</span>
                                </div>

                                <h3 className="font-serif text-[clamp(12px,3vw,16px)] font-bold text-foreground uppercase tracking-tighter leading-tight line-clamp-2">{item.business_name}</h3>

                                <p className="text-muted-foreground text-[clamp(7px,1.5vw,8.5px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed">
                                    {item.description || 'Verified cinematic craft professional service provider.'}
                                </p>
                            </div>
                        </div>
                        <Overlay actionText="VIEW VENDOR" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'marketplace':
                return (
                    <Link to={`/marketplace/${item.id}`} className="aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col shadow-2xl rounded-none">
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
                                        <div className="font-mono px-1.5 py-0.5 rounded-sm bg-blue-500/10 border border-blue-500/20 text-[clamp(6px,1.2vw,7px)] font-bold text-blue-600 uppercase tracking-widest leading-none w-fit shrink-0">
                                            CAT // {String((item as any).category || 'GEAR').toUpperCase()}
                                        </div>
                                        <span className="text-primary font-black text-[clamp(8px,2vw,10px)] tracking-tighter shrink-0">
                                            ₹{item.price_per_day}
                                        </span>
                                    </div>
                                    <span className="font-mono block text-[clamp(6.5px,1.5vw,8px)] font-bold text-muted-foreground uppercase tracking-widest truncate opacity-60 bg-muted/10 border border-border/40 px-1 py-0.5 rounded w-max">LOC // {item.location || 'GLOBAL'}</span>
                                </div>

                                <h3 className="font-serif text-[clamp(12px,3vw,16px)] font-bold text-foreground uppercase tracking-tighter leading-tight line-clamp-2">{item.title}</h3>
                                <p className="text-muted-foreground text-[clamp(7px,1.5vw,8.5px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed">
                                    {item.description || 'Verified cinematic production resource and world-class professional listing.'}
                                </p>
                            </div>
                        </div>
                        <Overlay actionText="VIEW LISTING" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );





            default:
                return null;
        }
    };

    const content = renderContent();
    if (!content) return null;

    return (
        <div className="relative w-full h-full block group/brackets">
            {item.type !== 'post' && <CornerBrackets />}
            {content}
        </div>
    );
};

