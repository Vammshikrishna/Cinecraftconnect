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
        <div className="absolute inset-0 bg-black/60 opacity-0 pointer-events-none [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto transition-all duration-300 flex flex-col p-3 z-20 cursor-pointer">
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

            <div className="flex-1 flex flex-col items-center justify-center translate-y-4 [@media(hover:hover)]:group-hover:translate-y-0 transition-transform duration-300">
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
        <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded-full bg-black/90 backdrop-blur-md border border-white/10 flex items-center gap-1.5 pointer-events-none [@media(hover:hover)]:group-hover:opacity-0 transition-opacity duration-300">
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
                    <Link to={`/post/${item.id}`} state={{ from: 'explore' }} className={`block aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden ${getGradient(item.id)} p-4 md:p-8 flex items-center justify-center text-center transition-all hover:brightness-110 active:scale-95 shadow-none rounded-none w-full max-w-full`}>
                        <TypeBadge icon={MessageCircle} label="INSIGHT" />
                        <p className="font-serif text-white font-bold text-[clamp(12px,3vw,16px)] leading-relaxed uppercase tracking-tight line-clamp-6 drop-shadow-lg break-words">
                            {item.content?.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim() || item.content}
                        </p>
                        <Overlay actionText="VIEW POST" likes={item.like_count} comments={item.comment_count} author={item.author} />
                    </Link>
                );

            case 'project':
                const projectImage = (item as any).image_url || (item as any).thumbnail_url;
                return (
                    <Link to={`/projects/${item.id}/space`} className="aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col shadow-2xl rounded-none w-full max-w-full">
                        <TypeBadge icon={Layers} label="PROJECT SPACE" />
                        <div className="relative aspect-[1.8/1] w-full overflow-hidden shrink-0 bg-black border-b border-white/10">
                            {projectImage ? (
                                <img src={projectImage} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            ) : (
                                <div className="w-full h-full bg-muted/20 flex items-center justify-center p-4 border-b border-white/5" style={{ background: getGradient(item.id) }}>
                                    <Layers size={24} className="text-white/30 animate-pulse" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                            <div className="absolute bottom-1.5 left-1.5">
                                <span className="font-mono px-1.5 py-0.5 rounded-sm bg-primary text-[clamp(6px,1vw,7px)] font-bold text-primary-foreground uppercase tracking-widest leading-none shadow-lg">
                                    STATUS // {(item as any).status || 'ACTIVE'}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden min-h-0 bg-gradient-to-b from-card to-background">
                            <div className="space-y-1">
                                <h3 className="font-serif text-[clamp(11px,2.4vw,15px)] font-bold text-foreground uppercase tracking-tight leading-tight line-clamp-2 group-hover:text-primary transition-colors break-words">
                                    {item.title || item.name}
                                </h3>

                                <p className="text-muted-foreground text-[clamp(7px,1.2vw,8px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed break-words">
                                    {item.description || 'Professional production workspace for cinematic collaboration and project management.'}
                                </p>

                                <div className="flex flex-col gap-1 text-muted-foreground pt-1.5 border-t border-white/5">
                                    {((item as any).genre?.[0]) && (
                                        <div className="flex items-center gap-1.5 shrink-0 overflow-hidden">
                                            <Film size={9} className="text-primary shrink-0" />
                                            <span className="font-mono text-[clamp(6px,1vw,7px)] font-bold uppercase tracking-widest truncate max-w-full">GENRE // {(item as any).genre[0]}</span>
                                        </div>
                                    )}
                                    {(item as any).location && (
                                        <div className="flex items-center gap-1.5 shrink-0 overflow-hidden">
                                            <MapPin size={9} className="text-primary shrink-0" />
                                            <span className="font-mono text-[clamp(6px,1vw,7px)] font-bold uppercase tracking-widest truncate max-w-full opacity-70">LOC // {(item as any).location}</span>
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
                    <Link to={`/profile/${item.id}`} className="aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border border-border/50 transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center rounded-[1.25rem] shadow-sm w-full max-w-full">
                        <CornerBrackets />
                        <div className="w-[54%] md:w-[56%] aspect-square rounded-full overflow-hidden shadow-xl border-[2.5px] border-background -mt-3 md:-mt-4 mb-1.5 group-hover:shadow-2xl transition-all duration-500 relative z-10">
                            {item.avatar_url ? (
                                <img src={item.avatar_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.full_name || item.username} />
                            ) : (
                                <div className={`w-full h-full ${getGradient(item.id)} flex items-center justify-center`}>
                                    <span className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter drop-shadow-md">{item.username?.charAt(0)}</span>
                                </div>
                            )}
                        </div>

                        <div className="px-2.5 text-center w-full flex flex-col items-center z-10">
                            <div className="flex items-center justify-center gap-1 w-full mb-1 px-1">
                                <h3 className="font-serif text-[clamp(8.5px,2vw,12px)] font-bold text-foreground group-hover:text-primary uppercase tracking-tight leading-tight line-clamp-2 transition-colors break-words">
                                    {item.full_name || item.username}
                                </h3>
                                {(item.is_verified ||
                                    item.username?.toLowerCase().includes('vamshi') ||
                                    item.full_name?.toLowerCase().includes('vamshi')) && (
                                        <VerificationBadge size="xs" className="shrink-0 scale-75" />
                                    )}
                            </div>

                            <div className="bg-primary/10 border border-primary/20 text-primary font-bold text-[5.5px] md:text-[7px] uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center justify-center gap-1 shadow-sm max-w-[95%] overflow-hidden">
                                <Zap size={7} className="shrink-0" fill="currentColor" />
                                <span className="line-clamp-2 leading-tight whitespace-normal text-center break-words">{craftsStr}</span>
                            </div>

                            <p className="mt-1.5 text-[7.5px] md:text-[8.5px] text-muted-foreground italic font-medium line-clamp-2 px-1 leading-normal opacity-80 w-full text-center break-words">
                                "{item.description || 'Passionate cinematic creator connecting through storytelling.'}"
                            </p>
                        </div>

                        <Overlay actionText="VIEW PROFILE" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'discussion':
                return (
                    <Link to={`/discussion-rooms/${item.id}`} className="aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border border-border flex flex-col transition-all hover:scale-[1.02] active:scale-95 shadow-sm rounded-[1.25rem] w-full max-w-full">
                        <CornerBrackets />

                        <div className="flex flex-col flex-1 p-3 md:p-4 relative z-10 h-full">
                            {/* Top Header */}
                            <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3 pt-0.5">
                                <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-[#FF3300]/10 border border-[#FF3300]/30 flex items-center justify-center shrink-0 shadow-sm">
                                    <MessageSquare className="w-3 h-3 md:w-4 md:h-4 text-[#FF3300]" />
                                </div>
                                <div className="flex flex-col justify-center overflow-hidden min-w-0">
                                    <span className="text-foreground font-black text-[clamp(7.5px,1.8vw,11px)] uppercase tracking-wider leading-none truncate max-w-full">DISCUSSION</span>
                                    <span className="text-[#FF3300] font-black text-[6px] md:text-[7.5px] uppercase tracking-widest leading-none mt-0.5">ROOM</span>
                                </div>
                            </div>

                            {/* Title */}
                            <h3 className="font-serif text-[clamp(11px,2.4vw,15px)] font-black text-[#FF3300] uppercase tracking-tight leading-tight line-clamp-2 mb-2 pr-1 break-words">
                                {item.title}
                            </h3>

                            {/* Description with left border */}
                            <div className="pl-2 border-l-[2px] border-[#FF3300]/30 mb-auto">
                                <p className="text-muted-foreground text-[8.5px] md:text-[10px] font-semibold line-clamp-3 leading-relaxed italic opacity-90 break-words">
                                    {item.description || 'Verified cinematic craft discussion room.'}
                                </p>
                            </div>

                            {/* Bottom Footer */}
                            <div className="flex items-center gap-1.5 mt-2 text-muted-foreground/80 truncate max-w-full">
                                <Users className="w-3 h-3 text-[#FF3300] shrink-0" />
                                <span className="font-black text-[7.5px] md:text-[9px] uppercase tracking-widest truncate">{(item as any).member_count || 0} MEMBERS</span>
                            </div>
                        </div>

                        <Overlay actionText="JOIN ROOM" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'announcement':
                return (
                    <Link to="/announcements" className={`aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-600/5 p-4 md:p-6 flex flex-col items-center justify-center text-center transition-all hover:brightness-105 active:scale-95 shadow-2xl rounded-none w-full max-w-full`}>
                        <TypeBadge icon={Megaphone} label="NEWS" />
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500 border border-orange-500/20 shadow-2xl ring-1 ring-orange-500/30">
                            <Megaphone size={24} className="group-hover:rotate-12 transition-transform duration-500" />
                        </div>
                        <h3 className="font-serif text-[clamp(12px,3vw,16px)] font-bold text-foreground uppercase tracking-tighter line-clamp-3 leading-tight break-words">{item.title}</h3>
                        <div className="mt-4 px-4 py-1 rounded-full border border-orange-500/30 text-orange-500 text-[clamp(6.5px,1.5vw,8px)] font-black uppercase tracking-widest group-hover:bg-orange-500/10 transition-colors">
                            Read Update
                        </div>
                        <Overlay actionText="VIEW UPDATE" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'company':
                return (
                    <Link to={`/company/${item.id}`} className={`aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card transition-all hover:scale-[1.02] active:scale-95 flex flex-col rounded-[1.25rem] shadow-md border border-border/50 w-full max-w-full`}>
                        <CornerBrackets />
                        <div className="absolute top-2 right-2 md:top-3 md:right-3 z-30 bg-[#0A0A0A] rounded-full px-2 py-0.5 md:px-2.5 md:py-1 flex items-center gap-1 md:gap-1.5 shadow-lg">
                            <Users size={10} className="text-[#FF1A1A]" />
                            <span className="text-[8px] md:text-[10px] font-bold text-white">{item.like_count || 0}</span>
                        </div>

                        <div className="relative h-[32%] md:h-[36%] w-full overflow-hidden shrink-0 bg-gradient-to-br from-neutral-900 via-zinc-800 to-black">
                            {(item.image_url || (item as any).cover_image_url) ? (
                                <img
                                    src={item.image_url || (item as any).cover_image_url}
                                    className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110"
                                    alt=""
                                    onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary/30 via-neutral-900 to-black opacity-80 flex items-center justify-center">
                                    <Building2 className="w-6 h-6 text-white/20" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 bg-card p-2.5 md:p-4 flex flex-col items-center text-center relative z-10 pt-5 md:pt-7">
                            <div className="absolute -top-5 md:-top-7 flex flex-col items-center w-[90%]">
                                <div className="w-9 h-9 md:w-13 md:h-13 rounded-lg md:rounded-xl bg-[#FF4500] border-[2px] border-card shadow-sm overflow-hidden flex items-center justify-center p-0.5 z-10 relative">
                                    {item.logo_url ? (
                                        <img src={item.logo_url} className="w-full h-full object-contain" alt={item.name} />
                                    ) : (
                                        <Building2 className="w-4 h-4 md:w-6 md:h-6 text-white" />
                                    )}
                                </div>
                                <div className="bg-[#FF1A1A] text-black font-black text-[6px] md:text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full -mt-1.5 relative z-20 truncate max-w-full">
                                    {Array.isArray((item as any).industry) ? (item as any).industry[0] : ((item as any).industry || 'PRODUCTION HOUSE')}
                                </div>
                            </div>

                            <h3 className="font-serif text-[clamp(11px,2.5vw,15px)] font-black text-foreground group-hover:text-primary uppercase tracking-tight leading-tight line-clamp-1 w-full mt-1 transition-colors break-words">
                                {item.name}
                            </h3>

                            <div className="flex items-center gap-1 mt-1 text-muted-foreground mb-1.5 md:mb-2 w-full justify-center">
                                <MapPin size={9} className="text-[#FF1A1A] shrink-0" />
                                <span className="text-[7.5px] md:text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">{item.location || 'GLOBAL'}</span>
                            </div>

                            <p className="text-muted-foreground text-[8.5px] md:text-[10px] font-medium italic line-clamp-2 px-1 mt-auto pb-1 leading-relaxed opacity-80 break-words">
                                "{item.description || 'movie is a soulful entertainment'}"
                            </p>
                        </div>
                        <Overlay actionText="VIEW COMPANY" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'vendor':
                return (
                    <Link to={`/vendors/${item.id}`} className={`aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col rounded-none shadow-2xl w-full max-w-full`}>
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
                                    <span className="font-mono block text-[clamp(6.5px,1.5vw,8px)] font-bold text-muted-foreground uppercase tracking-widest truncate opacity-60 bg-muted/10 border border-border/40 px-1 py-0.5 rounded w-fit max-w-full">LOC // {item.city || 'GLOBAL'}</span>
                                </div>

                                <h3 className="font-serif text-[clamp(12px,3vw,16px)] font-bold text-foreground uppercase tracking-tighter leading-tight line-clamp-2 break-words">{item.business_name}</h3>

                                <p className="text-muted-foreground text-[clamp(7px,1.5vw,8.5px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed break-words">
                                    {item.description || 'Verified cinematic craft professional service provider.'}
                                </p>
                            </div>
                        </div>
                        <Overlay actionText="VIEW VENDOR" likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'marketplace':
                return (
                    <Link to={`/marketplace/${item.id}`} className="aspect-[3/4.5] lg:aspect-[3/4] relative group overflow-hidden bg-card border-white/5 transition-all hover:brightness-105 active:scale-95 flex flex-col shadow-2xl rounded-none w-full max-w-full">
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
                                    <span className="font-mono block text-[clamp(6.5px,1.5vw,8px)] font-bold text-muted-foreground uppercase tracking-widest truncate opacity-60 bg-muted/10 border border-border/40 px-1 py-0.5 rounded w-fit max-w-full">LOC // {item.location || 'GLOBAL'}</span>
                                </div>

                                <h3 className="font-serif text-[clamp(12px,3vw,16px)] font-bold text-foreground uppercase tracking-tighter leading-tight line-clamp-2 break-words">{item.title}</h3>
                                <p className="text-muted-foreground text-[clamp(7px,1.5vw,8.5px)] font-medium line-clamp-2 uppercase tracking-tight opacity-70 leading-relaxed break-words">
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

