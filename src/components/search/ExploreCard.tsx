import { Link } from 'react-router-dom';

import { Heart, MessageCircle, Play, Layers, User, Building2, ShoppingBag, Megaphone } from 'lucide-react';

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

    const Overlay = ({ likes, comments }: { likes?: number, comments?: number }) => (
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6 z-20 cursor-pointer">
            <div className="flex items-center gap-1.5 text-white font-bold">
                <Heart className="fill-white" size={20} />
                <span>{likes || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 text-white font-bold">
                <MessageCircle className="fill-white" size={20} />
                <span>{comments || 0}</span>
            </div>
        </div>
    );

    const TypeIcon = ({ icon: Icon }: { icon: any }) => (
        <div className="absolute top-2 right-2 text-white drop-shadow-md z-10">
            <Icon size={18} className="fill-white/20" />
        </div>
    );

    const renderContent = () => {
        switch (item.type) {
            case 'post':
                if (item.video_url) {
                    return (
                        <Link to={`/feed?highlight=${item.id}`} className="block aspect-square relative group overflow-hidden bg-black">
                            <video src={item.video_url} className="w-full h-full object-cover" muted loop playsInline />
                            <TypeIcon icon={Play} />
                            <Overlay likes={item.like_count} comments={item.comment_count} />
                        </Link>
                    );
                }
                if (item.image_url) {
                    return (
                        <Link to={`/feed?highlight=${item.id}`} className="block aspect-square relative group overflow-hidden bg-muted">
                            <img src={item.image_url} alt="Post" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <Overlay likes={item.like_count} comments={item.comment_count} />
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
                            <Link to={`/feed?highlight=${item.id}`} className="block aspect-square relative group overflow-hidden bg-gradient-to-br from-card to-muted/5 group-hover:brightness-110 transition-all duration-500">
                                <div className="w-full h-full p-2.5 flex flex-col justify-between items-center text-center">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl border-4 border-background shadow-xl ring-1 ring-white/10 bg-muted overflow-hidden shrink-0 mt-2 flex items-center justify-center">
                                        {shareData.logoUrl ? (
                                            <img src={shareData.logoUrl} className="object-cover w-full h-full" alt="Company Logo" />
                                        ) : (
                                            <span className="text-xl font-black text-primary uppercase">{shareData.company?.[0] || 'J'}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 w-full flex flex-col justify-center items-center gap-1.5 px-1 pb-2">
                                        <h4 className="text-[10px] md:text-sm font-black text-foreground leading-tight tracking-tighter uppercase truncate w-full max-w-[120px]">
                                            {shareData.title || 'Opening'}
                                        </h4>
                                        <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[6px] md:text-[8px] font-black text-primary uppercase tracking-widest shrink-0">
                                            Hiring
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute inset-0 border border-black/5 dark:border-white/5 pointer-events-none rounded-none md:rounded-sm" />
                                <Overlay likes={item.like_count} comments={item.comment_count} />
                            </Link>
                        );
                    } catch (e) {
                         // Fallback down to normal text
                    }
                }

                return (
                    <Link to={`/feed?highlight=${item.id}`} className={`block aspect-square relative group overflow-hidden ${getGradient(item.id)} p-6 flex items-center justify-center text-center`}>
                        <p className="text-white font-semibold line-clamp-5 text-sm leading-relaxed">
                            {item.content?.split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim() || item.content}
                        </p>
                        <Overlay likes={item.like_count} comments={item.comment_count} />
                    </Link>
                );

            case 'project':
                const projectImage = (item as any).image_url || (item as any).thumbnail_url;
                return (
                    <Link to={`/projects/${item.id}/space`} className={`block aspect-square relative group overflow-hidden ${!projectImage ? getGradient(item.id) : ''} p-4 flex flex-col items-center justify-center text-center`}>
                        <TypeIcon icon={Layers} />
                        {projectImage ? (
                            <img src={projectImage} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        ) : (
                            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20 w-full h-full flex flex-col items-center justify-center relative z-10">
                                <h3 className="text-white font-bold text-lg line-clamp-2 mb-2">{item.title || item.name}</h3>
                                <p className="text-white/90 text-xs line-clamp-3">{item.description}</p>
                            </div>
                        )}
                        {projectImage && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />}
                        {projectImage && (
                            <div className="absolute bottom-3 left-3 right-3 z-20 text-left">
                                <h3 className="text-white font-bold text-sm line-clamp-1">{item.title || item.name}</h3>
                                <p className="text-white/70 text-[10px] line-clamp-1">{item.description}</p>
                            </div>
                        )}
                    </Link>
                );

            case 'user':
                return (
                    <Link to={`/profile/${item.id}`} className="block aspect-square relative group overflow-hidden bg-muted">
                        <TypeIcon icon={User} />
                        <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30 relative">
                            {item.avatar_url ? (
                                <img src={item.avatar_url} className="w-full h-full object-cover" alt={item.username} />
                            ) : (
                                <div className={`w-full h-full ${getGradient(item.id)} flex items-center justify-center`}>
                                    <span className="text-4xl font-bold text-white">{item.username?.charAt(0).toUpperCase()}</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                                <p className="text-white font-bold truncate text-sm">@{item.username}</p>
                                <p className="text-white/80 text-xs truncate">{item.full_name}</p>
                            </div>
                        </div>
                    </Link>
                );

            case 'discussion':
                return (
                    <Link to={`/discussion-rooms/${item.id}`} className={`block aspect-square relative group overflow-hidden bg-card p-4 flex flex-col items-center justify-center text-center border border-border hover:bg-accent/5 transition-colors`}>
                        <TypeIcon icon={MessageCircle} />
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-primary">
                            <MessageCircle size={24} />
                        </div>
                        <h3 className="text-foreground font-bold text-base line-clamp-2 mb-1">{item.title}</h3>
                        <p className="text-muted-foreground text-xs line-clamp-2">{item.description}</p>
                    </Link>
                );

            case 'announcement':
                return (
                    <div className={`block aspect-square relative group overflow-hidden bg-orange-500/10 p-4 flex flex-col items-center justify-center text-center border border-orange-500/20`}>
                        <TypeIcon icon={Megaphone} />
                        <Megaphone size={32} className="text-orange-500 mb-3" />
                        <h3 className="text-foreground font-bold text-base line-clamp-2">{item.title}</h3>
                    </div>
                );

            case 'vendor':
                return (
                    <Link to="/vendors" className="block aspect-square relative group overflow-hidden bg-card border border-border">
                        <TypeIcon icon={Building2} />
                        {item.logo_url ? (
                            <img src={item.logo_url} className="w-full h-full object-cover" alt={item.business_name} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                                <Building2 size={40} className="text-muted-foreground" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                            <p className="text-white font-bold text-sm truncate">{item.business_name}</p>
                        </div>
                    </Link>
                );

            case 'marketplace':
                return (
                    <Link to="/marketplace" className="block aspect-square relative group overflow-hidden bg-card border border-border">
                        <TypeIcon icon={ShoppingBag} />
                        <div className="w-full h-full flex flex-col items-center justify-center">
                            <ShoppingBag size={40} className="text-primary mb-2" />
                            <p className="text-primary font-bold">${item.price_per_day}/day</p>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                            <p className="text-white font-bold text-sm truncate">{item.title}</p>
                        </div>
                    </Link>
                );

            default:
                return null;
        }
    };

    return renderContent();
};
