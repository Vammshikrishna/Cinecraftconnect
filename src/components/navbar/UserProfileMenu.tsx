
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';

const UserProfileMenu = () => {
  const { profile } = useAuth();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = profile?.full_name || profile?.username || 'User';

  return (
    <Link to="/profile" className="rounded-full">
      <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
        {profile?.avatar_url && (
          <AvatarImage src={profile.avatar_url} alt={displayName} />
        )}
        <AvatarFallback className="bg-primary text-primary-foreground">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
    </Link>
  );
};

export default UserProfileMenu;
