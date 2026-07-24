import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getOptimizedImage } from '@/utils/image-optimization';
import { useCachedImage } from '@/hooks/useCachedImage';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Check, Plus, LogOut, Loader2, User } from 'lucide-react';

interface AccountSwitcherSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountSwitcherSheet = ({ isOpen, onOpenChange }: AccountSwitcherSheetProps) => {
  const { profile, user, savedAccounts, switchAccount, addAccount, signOut } = useAuth();
  const { toast } = useToast();
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);

  const activeUserId = profile?.id || user?.id;
  const activeDisplayName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'User';

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSwitchAccount = async (targetUserId: string, username: string) => {
    if (switchingUserId) return;
    try {
      setSwitchingUserId(targetUserId);
      toast({
        title: "Switching account",
        description: `Switching to @${username}...`,
      });
      await switchAccount(targetUserId);
      onOpenChange(false);
      toast({
        title: "Account Switched",
        description: `Now logged in as @${username}`,
      });
    } catch (error: any) {
      console.error('Account switch error:', error);
      toast({
        title: "Switch Failed",
        description: "Could not switch accounts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSwitchingUserId(null);
    }
  };

  const handleAddAccount = () => {
    onOpenChange(false);
    addAccount();
  };

  const handleSignOut = () => {
    onOpenChange(false);
    signOut();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[32px] p-6 max-h-[85vh] overflow-y-auto bg-card border-t border-border shadow-2xl max-w-lg mx-auto">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="text-lg font-bold tracking-tight text-foreground">
            Switch Accounts
          </DrawerTitle>
        </DrawerHeader>

        <div className="mt-4 space-y-2">
          {/* List of Accounts */}
          {savedAccounts.map((acc) => {
            const isActive = acc.userId === activeUserId;
            const isThisSwitching = switchingUserId === acc.userId;
            const avatarUrl = getOptimizedImage(acc.avatarUrl, { width: 120, height: 120 });

            return (
              <div
                key={acc.userId}
                onClick={() => {
                  if (!isActive && !switchingUserId) {
                    handleSwitchAccount(acc.userId, acc.username);
                  }
                }}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 border-primary shadow-sm cursor-default'
                    : 'bg-background hover:bg-muted/70 border-border cursor-pointer active:scale-[0.99]'
                } ${switchingUserId && !isThisSwitching ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative">
                    <Avatar className={`h-11 w-11 ${isActive ? 'ring-2 ring-primary border-2 border-background' : 'border border-border/60'}`}>
                      {acc.avatarUrl && <AvatarImage src={avatarUrl} alt={acc.username} className="object-cover" />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {getInitials(acc.username)}
                      </AvatarFallback>
                    </Avatar>
                    {isActive && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-foreground truncate leading-tight">
                      {acc.username}
                    </span>
                    <span className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                      {acc.email}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 ml-3">
                  {isThisSwitching ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : isActive ? (
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-primary hover:underline">
                      Switch
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Action buttons at bottom */}
          <div className="pt-4 space-y-2">
            <Button
              variant="outline"
              onClick={handleAddAccount}
              className="w-full h-12 rounded-2xl border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary font-bold gap-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Instagram Account / Link Account
            </Button>

            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full h-11 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold gap-2 text-sm mt-1"
            >
              <LogOut className="h-4 w-4" />
              Sign Out of Current Account
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
