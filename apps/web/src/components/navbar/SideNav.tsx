import { useEffect, useRef, useState, ReactNode } from 'react';
import { useT } from '@/hooks/useT';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Search, Film, Briefcase, Users, MessageSquare, Bell, PlusSquare, Menu, Star, Megaphone, ShoppingBag,
  Lightbulb, Settings, LogOut, Flag, Shield, Crown, ArrowLeftRight, PanelLeft,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useAppRole } from '@/hooks/useAppRole';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useUnreadPitchSubmissions } from '@/hooks/useUnreadPitchSubmissions';
import { useUnreadAnnouncements } from '@/hooks/useUnreadAnnouncements';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedImage } from '@/utils/image-optimization';
import { useCachedImage } from '@/hooks/useCachedImage';
import DiscussionRoomIcon from '@/components/icons/DiscussionRoomIcon';
import StudioPageIcon from '@/components/icons/StudioPageIcon';
import { cn } from '@/lib/utils';
import { AccountSwitcherSheet } from '@/components/profile/AccountSwitcherSheet';

/** How many notifications I have not read, kept live. */
function useUnreadNotificationCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) { setCount(0); return; }
    let alive = true;
    const load = async () => {
      const { count: n } = await (supabase as any).from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false).not('type', 'in', '(new_message,call_started,incoming_call,call,call_answered,call_event,call_invite,call_missed,call_ended,call_declined,space_started)');
      if (alive) setCount(n || 0);
    };
    load();
    const channel = supabase
      .channel(`sidenav_notifications_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [user?.id]);
  return count;
}

const Badge = ({ n }: { n: number }) => (
  <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] px-1 items-center justify-center rounded-full bg-red-500 text-xs leading-none font-bold text-white border-2 border-background">
    {n > 9 ? '9+' : n}
  </span>
);
const Dot = () => <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-background" />;

const itemCls = (active: boolean) => cn(
  'group flex items-center gap-3.5 rounded-lg px-3 py-2 transition-colors w-full text-left',
  'hover:bg-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
  active ? 'font-bold text-primary' : 'font-medium text-foreground/85',
);

const Item = ({ to, label, icon, active, badge }: { to: string; label: string; icon: ReactNode; active: boolean; badge?: ReactNode }) => (
  <Link to={to} className={itemCls(active)} aria-label={label} title={label} aria-current={active ? 'page' : undefined}>
    <span className="relative shrink-0 transition-transform group-hover:scale-105">{icon}{badge}</span>
    <span className="text-sm truncate whitespace-nowrap opacity-0 transition-opacity duration-150 group-data-[open=true]/side:opacity-100">{label}</span>
  </Link>
);

/**
 * The navigation on wide screens: a slim column of icons on the left that opens over the page (with the labels) when the
 * pointer or the keyboard focus is in it. The page never moves. Below the lg breakpoint the top bar and the bottom tab bar stay.
 */
const SideNav = () => {
  const { t } = useT();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { isFan, isCreator, isStudio } = useAccountType();
  const { isModerator, isAdmin, isSuperAdmin } = useAppRole();
  const { unreadCount: unreadMessages, hasUnreadDiscussions, hasUnreadProjects } = useUnreadMessages();
  const { unreadPitchCount, hasUnreadPitches } = useUnreadPitchSubmissions();
  const { unreadAnnouncements } = useUnreadAnnouncements();
  const unreadNotifications = useUnreadNotificationCount();
  const [railOpen, setRailOpen] = useState(false);
  // open on intent: a pointer just passing along the left edge (to the browser's Back button) should not open the rail
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelOpen = () => { if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; } };
  useEffect(() => cancelOpen, []);
  // touch screens cannot hover, so a button opens the rail (with its labels) like a drawer
  const [pinned, setPinned] = useState(false);
  const { toast } = useToast();
  const { pathname } = useLocation();

  const avatar = useCachedImage(getOptimizedImage(profile?.avatar_url, { width: 96, height: 96 }));
  const name = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'Profile';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const is = (path: string) => pathname === path || (path !== '/' && pathname.startsWith(path));

  const logout = async () => {
    try { await signOut(); toast({ title: 'Logged out successfully' }); }
    catch { toast({ title: 'Could not log out', description: 'Please try again.', variant: 'destructive' }); }
  };

  const internal = [
    ...(isModerator ? [{ path: '/moderation', label: 'Moderation', icon: <Flag size={18} className="text-amber-500" /> }] : []),
    ...(isAdmin ? [{ path: '/admin', label: 'Admin Panel', icon: <Shield size={18} className="text-blue-500" /> }] : []),
    ...(isSuperAdmin ? [{ path: '/super-admin', label: 'Super Admin', icon: <Crown size={18} className="text-amber-500" /> }] : []),
  ];

  // One flat column, in this order (Profile last, then More).
  const item = {
    home: { to: '/feed', label: t('nav.home'), icon: <Home size={20} />, active: is('/feed') },
    search: { to: '/search', label: t('nav.search'), icon: <Search size={20} />, active: is('/search') },
    messages: { to: '/messages', label: t('nav.messages'), icon: <MessageSquare size={20} />, active: is('/messages'), badge: unreadMessages > 0 ? <Badge n={unreadMessages} /> : undefined },
    notifications: { to: '/notifications', label: t('nav.notifications'), icon: <Bell size={20} />, active: is('/notifications'), badge: unreadNotifications > 0 ? <Badge n={unreadNotifications} /> : undefined },
    create: { to: '/create', label: t('nav.create'), icon: <PlusSquare size={20} />, active: is('/create') },
    projects: { to: '/projects', label: 'ProjectSpace', icon: <Film size={20} />, active: is('/projects'), badge: hasUnreadProjects ? <Dot /> : undefined },
    jobs: { to: '/jobs', label: t('nav.jobs'), icon: <Briefcase size={20} />, active: is('/jobs') },
    pitch: { to: '/pitch', label: t('nav.pitch'), icon: <Lightbulb size={20} />, active: is('/pitch'), badge: (isCreator || isStudio) && hasUnreadPitches ? <Badge n={unreadPitchCount} /> : undefined },
    marketplace: { to: '/marketplace', label: t('nav.marketplace'), icon: <ShoppingBag size={20} />, active: is('/marketplace') },
    network: { to: '/network', label: t('nav.network'), icon: <Users size={20} />, active: is('/network') },
    discussions: { to: '/discussion-rooms', label: t('nav.discussions'), icon: <DiscussionRoomIcon size={20} />, active: is('/discussion-rooms'), badge: hasUnreadDiscussions ? <Dot /> : undefined },
    pages: { to: '/pages', label: t('nav.pages'), icon: <StudioPageIcon size={20} />, active: is('/pages') },
    ratings: { to: '/ratings', label: t('nav.ratings'), icon: <Star size={20} />, active: is('/ratings') },
    announcements: { to: '/announcements', label: t('nav.announcements'), icon: <Megaphone size={20} />, active: is('/announcements'), badge: unreadAnnouncements > 0 ? <Badge n={unreadAnnouncements} /> : undefined },
  };
  const nav = isFan
    ? [item.home, item.discussions, item.announcements, item.pages, item.ratings, item.messages, item.notifications, item.search]
    : [item.home, item.projects, item.discussions, item.jobs, item.network, item.pitch, item.marketplace, item.announcements, item.pages, item.ratings, item.messages, item.notifications, item.create, item.search];

  return (
    <>
    {pinned && <div className="hidden lg:block fixed inset-0 z-30 bg-black/20" onClick={() => setPinned(false)} aria-hidden="true" />}
    <aside
      data-open={railOpen || pinned}
      onMouseEnter={() => { cancelOpen(); openTimer.current = setTimeout(() => setRailOpen(true), 120); }}
      onMouseLeave={() => { cancelOpen(); setRailOpen(false); }}
      onFocus={(e) => { if (e.target.matches(':focus-visible')) setRailOpen(true); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRailOpen(false); }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) {
          setRailOpen(false);
          setPinned(false);
          (document.activeElement as HTMLElement | null)?.blur();
        }
      }}
      className="group/side hidden lg:flex fixed left-0 top-0 bottom-0 z-40 flex-col w-[72px] data-[open=true]:w-[244px] overflow-hidden border-r border-border bg-card px-3 pt-6 pb-4 transition-[width,box-shadow] duration-200 ease-out data-[open=true]:shadow-2xl"
      aria-label="Main navigation"
    >
      <div className="px-3 pb-6 min-h-[44px]">
        <Link to="/feed" className="flex items-center gap-3" aria-label="CineCraft Connect">
          <img src="/logo-192.png" alt="" className="h-7 w-7 shrink-0 rounded-full object-contain" />
          <span className="whitespace-nowrap font-serif text-base font-bold uppercase tracking-tight opacity-0 transition-opacity duration-150 group-data-[open=true]/side:opacity-100">CineCraft <span className="text-primary">Connect</span></span>
        </Link>
        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          aria-pressed={pinned}
          aria-label={pinned ? t('nav.hideLabels') : t('nav.showLabels')}
          className="hidden [@media(hover:none)]:flex mt-3 h-11 w-full items-center gap-3 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <PanelLeft size={20} className="shrink-0" />
          <span className="text-sm whitespace-nowrap opacity-0 transition-opacity duration-150 group-data-[open=true]/side:opacity-100">{pinned ? t('nav.hideLabels') : t('nav.showLabels')}</span>
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {nav.map((n) => <Item key={n.to} to={n.to} label={n.label} icon={n.icon} active={n.active} badge={(n as any).badge} />)}
        <Item
          to="/profile"
          label={t('nav.profile')}
          active={is('/profile')}
          icon={
            <Avatar className={cn('h-[22px] w-[22px]', is('/profile') && 'ring-2 ring-primary')}>
              {profile?.avatar_url && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
          }
        />
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={itemCls(internal.some((m) => is(m.path)))} aria-label={t('nav.more')} title={t('nav.more')}>
            <span className="relative shrink-0"><Menu size={20} /></span>
            <span className="text-sm whitespace-nowrap opacity-0 transition-opacity duration-150 group-data-[open=true]/side:opacity-100">More</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60 mb-2">
          {internal.length > 0 && (
            <>
              <p className="px-3 py-1 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Internal</p>
              {internal.map((m) => (
                <DropdownMenuItem key={m.path} asChild>
                  <Link to={m.path} className="flex items-center gap-3 px-3 py-2 cursor-pointer">{m.icon}<span className="text-sm font-medium">{m.label}</span></Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => setSwitcherOpen(true)} className="flex items-center gap-3 px-3 py-2 cursor-pointer">
            <ArrowLeftRight size={18} /><span className="text-sm font-medium">Switch account</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings" className="flex items-center gap-3 px-3 py-2 cursor-pointer"><Settings size={18} /><span className="text-sm font-medium">Settings</span></Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout} className="flex items-center gap-3 px-3 py-2 cursor-pointer text-destructive focus:text-destructive">
            <LogOut size={18} /><span className="text-sm font-medium">Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountSwitcherSheet isOpen={switcherOpen} onOpenChange={setSwitcherOpen} />
    </aside>
    </>
  );
};

export default SideNav;
