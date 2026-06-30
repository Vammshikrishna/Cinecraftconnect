import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { getOptimizedImage } from '@/utils/image-optimization';
import { useCachedImage } from '@/hooks/useCachedImage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Plus, LogOut } from 'lucide-react';

const UserProfileMenu = () => {
  const { profile, savedAccounts, switchAccount, addAccount, signOut } = useAuth();
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

  const displayName = profile?.full_name || profile?.username || 'User';
  const otherAccounts = savedAccounts.filter(acc => acc.userId !== profile?.id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full ml-1 sm:ml-2 focus:outline-none select-none">
        <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
          {profile?.avatar_url && (
            <AvatarImage src={cachedAvatar} alt={displayName} />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 mt-1 rounded-xl p-1 bg-card border border-border shadow-lg">
        <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Active Account
        </DropdownMenuLabel>
        
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg hover:bg-muted transition-colors focus:bg-muted focus:outline-none">
            <Avatar className="h-7 w-7 border border-border/55">
              {profile?.avatar_url && <AvatarImage src={cachedAvatar} alt={displayName} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate leading-none text-foreground">{displayName}</span>
              <span className="text-[10px] text-muted-foreground truncate mt-1">@{profile?.username}</span>
            </div>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg hover:bg-muted transition-colors focus:bg-muted focus:outline-none">
            <Settings size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Settings</span>
          </Link>
        </DropdownMenuItem>

        {otherAccounts.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuLabel className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Switch Accounts
            </DropdownMenuLabel>
            {otherAccounts.map((acc) => {
              const otherAvatar = getOptimizedImage(acc.avatarUrl, { width: 96, height: 96 });
              return (
                <DropdownMenuItem
                  key={acc.userId}
                  onClick={() => switchAccount(acc.userId)}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg hover:bg-muted transition-colors focus:bg-muted focus:outline-none"
                >
                  <Avatar className="h-7 w-7 border border-border/50">
                    {acc.avatarUrl && <AvatarImage src={otherAvatar} alt={acc.username} />}
                    <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold">
                      {getInitials(acc.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate leading-none text-foreground">{acc.username}</span>
                    <span className="text-[10px] text-muted-foreground truncate mt-1">{acc.email}</span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={addAccount}
          className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg text-primary hover:bg-primary/10 transition-colors focus:bg-primary/10 focus:outline-none"
        >
          <Plus size={16} />
          <span className="text-sm font-semibold">Add Account</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg text-destructive hover:bg-destructive/10 transition-colors focus:bg-destructive/10 focus:outline-none"
        >
          <LogOut size={16} />
          <span className="text-sm font-semibold">Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserProfileMenu;
