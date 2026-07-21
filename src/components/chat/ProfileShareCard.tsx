import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';
import VerificationBadge from '../common/VerificationBadge';
import { getOptimizedImage } from '@/utils/image-optimization';
import { supabase } from '@/integrations/supabase/client';
import { User, Zap } from 'lucide-react';
import { CornerBrackets } from '@/components/ui/CornerBrackets';

interface ProfileShareCardProps {
    name: string;
    id?: string;
    avatar?: string;
    craft?: string;
    username?: string;
    is_verified?: boolean;
    bio?: string;
}

export const ProfileShareCard = ({ 
    name: initialName, 
    id, 
    avatar: initialAvatar, 
    craft: initialCraft, 
    username: initialUsername, 
    is_verified: initialVerified,
    bio: initialBio
}: ProfileShareCardProps) => {
    const { push } = useAppNavigation();
    const [name, setName] = useState(initialName);
    const [avatar, setAvatar] = useState(initialAvatar);
    const [craft, setCraft] = useState(initialCraft);
    const [username, setUsername] = useState(initialUsername);
    const [isVerified, setIsVerified] = useState(initialVerified);
    const [bio, setBio] = useState(initialBio);

    useEffect(() => {
        const fetchProfileData = async () => {
            if (!id || id === 'undefined' || id === 'null') return;
            if (initialCraft && initialBio) return;
            
            const identifier = id || initialUsername;
            if (!identifier || identifier === 'undefined' || identifier === 'null') return;

            try {
                const query = supabase.from('profiles').select('*');
                if (id) query.eq('id', id);
                else query.eq('username', initialUsername || '');

                const { data, error } = await query.maybeSingle();

                if (data && !error) {
                    setName(data.full_name || data.username || 'Anonymous');
                    setAvatar(data.avatar_url || undefined);
                    setCraft(data.craft || undefined);
                    setUsername(data.username || undefined);
                    setIsVerified(data.is_verified ?? undefined);
                    setBio(data.bio || undefined);
                }
            } catch (err) {
                console.error('Error self-healing profile card:', err);
            }
        };

        fetchProfileData();
    }, [id, initialUsername, initialCraft, initialBio]);

    const profileLink = username || id;
    const isValidLink = !!profileLink;
    const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

    const handleNavigate = (e: React.MouseEvent) => {
        if (!isValidLink) {
            e.preventDefault();
            e.stopPropagation();
        } else if (!(e.target instanceof HTMLAnchorElement)) {
            push(`/profile/${profileLink}`);
        }
    };

    return (
        <div 
            onClick={handleNavigate}
            className={cn(
                "group relative glass-card-premium flex flex-col items-center text-center p-6 transition-all duration-500 hover:-translate-y-2 w-[220px] shrink-0 min-h-[320px] justify-between overflow-hidden select-none rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl",
                !isValidLink ? "cursor-default opacity-75 grayscale-[0.5]" : "cursor-pointer active:scale-[0.98]"
            )}
        >
            <CornerBrackets />
            {/* Artistic Background Element */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent -z-10" />
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 blur-[60px] rounded-full" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-secondary/10 blur-[60px] rounded-full" />

            <div className="w-full flex flex-col items-center z-10">
                {/* Avatar Section */}
                <div className="mb-5 relative group/avatar">
                    <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-700" />
                    <Avatar className="h-28 w-28 border-[3px] border-background shadow-2xl scale-100 group-hover/avatar:scale-105 transition-all duration-700 ring-2 ring-primary/20">
                        <AvatarImage src={getOptimizedImage(avatar || '', { width: 200, height: 200 }) || undefined} alt={name} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    {isVerified && (
                        <div className="absolute -bottom-1 -right-1 z-20 animate-in zoom-in duration-500">
                            <VerificationBadge size="sm" />
                        </div>
                    )}
                </div>

                {/* Name and Info */}
                <div className="space-y-2 w-full px-2">
                    <h3 className="font-serif text-[13px] font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight flex items-center justify-center gap-1.5 uppercase tracking-tight">
                        {name}
                    </h3>
                    
                    <div className="font-mono inline-flex items-center justify-center mx-auto text-[7.5px] font-bold text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2 py-0.5 rounded w-max">
                        CRAFT // {craft || 'Filmmaker'}
                    </div>

                    {bio && (
                        <p className="text-[10px] text-muted-foreground/80 font-medium line-clamp-2 mt-3 leading-relaxed italic px-2">
                            "{bio}"
                        </p>
                    )}
                </div>
            </div>

            <div className="w-full mt-8 z-10">
                <div className={cn(
                    "w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg flex items-center justify-center gap-2",
                    isValidLink 
                        ? "bg-primary text-black hover:bg-primary/90 shadow-primary/20" 
                        : "bg-muted text-muted-foreground"
                )}>
                    <User size={14} className="fill-current" />
                    {isValidLink ? 'View Portfolio' : 'Unavailable'}
                </div>
            </div>
        </div>
    );
};

