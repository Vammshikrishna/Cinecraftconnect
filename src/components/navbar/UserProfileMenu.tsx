import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { getOptimizedImage } from '@/utils/image-optimization';
import { useCachedImage } from '@/hooks/useCachedImage';
import { AccountSwitcherSheet } from '@/components/profile/AccountSwitcherSheet';

const UserProfileMenu = () => {
  const { profile, user } = useAuth();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLongPressRef = useRef(false);

  const avatarUrl = getOptimizedImage(profile?.avatar_url, { width: 96, height: 96 });
  const cachedAvatar = useCachedImage(avatarUrl);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'User';

  const handleTouchStart = () => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsSwitcherOpen(true);
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (isLongPressRef.current) {
      e.preventDefault(); // prevent navigation if it was a long press
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSwitcherOpen(true);
  };

  return (
    <>
      <Link 
        to="/profile" 
        className="rounded-full ml-0.5 sm:ml-2 focus:outline-none select-none inline-flex items-center justify-center transition-transform active:scale-95"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={() => { if (timerRef.current) clearTimeout(timerRef.current); }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ WebkitTouchCallout: 'none' }}
      >
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 cursor-pointer hover:ring-2 hover:ring-primary transition-all pointer-events-none">
          {profile?.avatar_url && (
            <AvatarImage src={cachedAvatar} alt={displayName} />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      </Link>
      
      <AccountSwitcherSheet
        isOpen={isSwitcherOpen}
        onOpenChange={setIsSwitcherOpen}
      />
    </>
  );
};

export default UserProfileMenu;
