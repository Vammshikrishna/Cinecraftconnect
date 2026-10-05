import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Moon, CalendarDays, Lock, Ban, Activity, MessageCircle, UserPlus, Phone, Palette, Languages, Accessibility,
  Volume2, KeyRound, MonitorSmartphone, Download, LifeBuoy, Shield, FileText, Info, ChevronRight, ChevronLeft, Search, X, ExternalLink,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// One menu, the same groups and order as the mobile app (Instagram-style "Settings and activity").
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const VIS: Record<string, string> = { public: 'Public', connections: 'Connections', private: 'Private' };
const WHO: Record<string, string> = { everyone: 'Everyone', connections: 'Connections', mutuals: 'Mutuals', nobody: 'Nobody' };
const LANG: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', hi: 'हिन्दी' };
const THEME: Record<string, string> = { system: 'System', light: 'Light', dark: 'Dark' };

interface MenuItem { id: string; title: string; icon: any; path: string; value?: string; keywords?: string; external?: boolean }
interface MenuGroup { title: string; items: MenuItem[] }

export const useSettingsMenu = (): MenuGroup[] => {
  const { settings } = useUserSettings();
  const { blocked } = useBlockedUsers();
  const { theme } = useTheme();
  const s = settings || {};
  return [
    {
      title: 'How you use CineCraft',
      items: [
        { id: 'notifications', title: 'Notifications', icon: Bell, path: '/settings/notifications', value: s.push_notifications === false ? 'Off' : undefined, keywords: 'push email alerts' },
        { id: 'quiet', title: 'Quiet hours', icon: Moon, path: '/settings/quiet-hours', value: s.dnd_enabled ? 'On' : 'Off', keywords: 'do not disturb dnd' },
        { id: 'availability', title: 'Availability calendar', icon: CalendarDays, path: '/profile/availability', keywords: 'schedule booked free' },
      ],
    },
    {
      title: 'Who can see your content',
      items: [
        { id: 'privacy', title: 'Account privacy', icon: Lock, path: '/settings/privacy', value: VIS[s.profile_visibility || 'public'], keywords: 'visibility private public' },
        { id: 'blocked', title: 'Blocked', icon: Ban, path: '/settings/blocked', value: String(blocked.length), keywords: 'block unblock' },
        { id: 'activity', title: 'Activity status', icon: Activity, path: '/settings/activity', value: s.show_online_status === false ? 'Off' : 'On', keywords: 'online read receipts seen' },
      ],
    },
    {
      title: 'How others can interact with you',
      items: [
        { id: 'messages', title: 'Messages', icon: MessageCircle, path: '/settings/messages', value: WHO[s.allow_messages_from || 'everyone'], keywords: 'dm chat' },
        { id: 'requests', title: 'Connection requests', icon: UserPlus, path: '/settings/requests', value: WHO[s.allow_connection_requests || 'everyone'], keywords: 'connect network' },
        { id: 'calls', title: 'Calls', icon: Phone, path: '/settings/calls', value: WHO[s.allow_incoming_calls || 'everyone'], keywords: 'voice video livekit' },
      ],
    },
    {
      title: 'Your app and media',
      items: [
        { id: 'appearance', title: 'Appearance', icon: Palette, path: '/settings/appearance', value: THEME[theme || 'system'], keywords: 'theme dark light font' },
        { id: 'language', title: 'Language', icon: Languages, path: '/settings/language', value: LANG[s.language || 'en'] },
        { id: 'accessibility', title: 'Accessibility', icon: Accessibility, path: '/settings/accessibility', keywords: 'contrast motion' },
        { id: 'sound', title: 'Sound', icon: Volume2, path: '/settings/sound', keywords: 'effects chimes' },
      ],
    },
    {
      title: 'Security',
      items: [
        { id: 'security', title: 'Password and security', icon: KeyRound, path: '/settings/security', keywords: 'password 2fa e2ee pin' },
        { id: 'sessions', title: 'Where you are logged in', icon: MonitorSmartphone, path: '/settings/sessions', keywords: 'devices sessions' },
      ],
    },
    {
      title: 'Your information',
      items: [
        { id: 'data', title: 'Download your information', icon: Download, path: '/settings/data', keywords: 'export dpdp data' },
      ],
    },
    {
      title: 'More info and support',
      items: [
        { id: 'support', title: 'Help', icon: LifeBuoy, path: '/settings/help', keywords: 'support appeal contact tickets' },
        { id: 'privacy-policy', title: 'Privacy Policy', icon: Shield, path: '/settings/legal/privacy' },
        { id: 'terms', title: 'Terms of Service', icon: FileText, path: '/settings/legal/terms' },
        { id: 'about', title: 'About', icon: Info, path: '/settings/about', keywords: 'version' },
      ],
    },
  ];
};

/** The menu list: Accounts Center card, search and the grouped rows. */
export const SettingsMenu = ({ compact = false }: { compact?: boolean }) => {
  const groups = useSettingsMenu();
  const { profile } = useAuth();
  const location = useLocation();
  const [q, setQ] = useState('');
  const active = location.pathname;

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups;
    return groups
      .map(g => ({ ...g, items: g.items.filter(i => (i.title + ' ' + (i.keywords || '') + ' ' + g.title).toLowerCase().includes(t)) }))
      .filter(g => g.items.length > 0);
  }, [groups, q]);

  return (
    <div className={cn('space-y-5', compact ? 'p-4' : '')}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search"
          className="w-full h-10 rounded-xl bg-muted/60 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>

      {!q && (
        <div>
          <p className="px-1 pb-2 text-[13px] font-semibold text-muted-foreground">Your account</p>
          <Link to="/settings/account" className={cn('flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors', active === '/settings/account' && 'bg-muted')}>
            <Avatar className="h-11 w-11"><AvatarImage src={(profile as any)?.avatar_url || undefined} /><AvatarFallback>{((profile as any)?.full_name || 'U')[0]}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight">Accounts Center</p>
              <p className="text-xs text-muted-foreground truncate">Password, security, personal details, verification</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      )}

      {filtered.map(g => (
        <div key={g.title}>
          <p className="px-1 pb-1 text-[13px] font-semibold text-muted-foreground">{g.title}</p>
          <div>
            {g.items.map(item => {
              const isActive = active === item.path.split('#')[0] || (item.id === 'support' && active.startsWith('/settings/help')) || (active.startsWith('/settings/legal') && (item.id === 'privacy-policy' && active.endsWith('/privacy') || item.id === 'terms' && active.endsWith('/terms')));
              const rowCls = cn('flex items-center gap-3.5 rounded-xl px-2 py-2.5 hover:bg-muted/60 transition-colors', isActive && 'bg-muted');
              const rowInner = (
                <>
                  <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.6} />
                  <span className="flex-1 text-[15px]">{item.title}</span>
                  {item.value && <span className="text-sm text-muted-foreground">{item.value}</span>}
                  {item.external ? <ExternalLink className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </>
              );
              // policies open in a new tab so Settings stays where it is
              return item.external ? (
                <a key={item.id} href={item.path} target="_blank" rel="noopener noreferrer" className={rowCls}>{rowInner}</a>
              ) : (
                <Link key={item.id} to={item.path} className={rowCls}>{rowInner}</Link>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No settings found for "{q}"</p>}

      {!q && (
        <div className="pt-1">
          <p className="px-1 pb-1 text-[13px] font-semibold text-muted-foreground">Login</p>
          <Link to="/settings/account#signout" className="block rounded-xl px-2 py-2.5 text-[15px] text-rose-500 hover:bg-muted/60">Log out</Link>
          {!compact && <p className="px-2 pt-4 text-xs text-muted-foreground">CineCraft Connect</p>}
        </div>
      )}
    </div>
  );
};

/** Layout for every /settings page: the menu on the left on wide screens, the page on the right. */
export const SettingsLayout = () => (
  <div className="min-h-screen bg-background pt-20 pb-28 lg:pb-16">
    <div className="max-w-6xl mx-auto flex">
      <aside className="hidden lg:block w-[340px] shrink-0 border-r border-border/60 self-stretch">
        <div className="px-4 pt-6 pb-2"><h1 className="text-2xl font-bold">Settings</h1></div>
        <SettingsMenu compact />
      </aside>
      <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 py-6">
        <div className="max-w-2xl"><Outlet /></div>
      </main>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Building blocks for settings pages (same look as the mobile app)
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const SettingsPageHeader = ({ title, description }: { title: string; description?: string }) => {
  const navigate = useNavigate();
  return (
    <div className="mb-6">
      <button onClick={() => navigate('/settings')} className="lg:hidden -ml-1 mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-5 w-5" /> Settings
      </button>
      <h2 className="text-2xl font-bold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
  );
};

export const SettingsSection = ({ id, title, description, children }: { id?: string; title?: string; description?: string; children: ReactNode }) => (
  <section id={id} className="mb-8 scroll-mt-24">
    {title && <h3 className="text-base font-semibold">{title}</h3>}
    {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    <div className={cn('rounded-2xl border bg-card divide-y overflow-hidden', title && 'mt-3')}>{children}</div>
  </section>
);

export const SettingsToggleRow = ({ title, description, checked, onCheckedChange, disabled }: {
  title: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean;
}) => (
  <label className={cn('flex items-center gap-4 px-4 py-3.5', disabled ? 'opacity-50' : 'cursor-pointer hover:bg-muted/40')}>
    <div className="flex-1 min-w-0">
      <p className="text-[15px]">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </label>
);

export const SettingsRadioRows = <T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; description?: string }[]; value: T; onChange: (v: T) => void;
}) => (
  <>
    {options.map(o => (
      <button key={o.value} onClick={() => onChange(o.value)} className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-muted/40">
        <div className="flex-1 min-w-0">
          <p className="text-[15px]">{o.label}</p>
          {o.description && <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>}
        </div>
        <span className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0', value === o.value ? 'border-foreground' : 'border-muted-foreground/40')}>
          {value === o.value && <span className="h-2.5 w-2.5 rounded-full bg-foreground" />}
        </span>
      </button>
    ))}
  </>
);

export const SettingsLinkRow = ({ title, description, value, onClick, to, href, danger, icon: Icon }: {
  title: string; description?: string; value?: string; onClick?: () => void; to?: string; href?: string; danger?: boolean; icon?: any;
}) => {
  const inner = (
    <>
      {Icon && <Icon className="h-5 w-5 shrink-0" strokeWidth={1.7} />}
      <div className="flex-1 min-w-0">
        <p className={cn('text-[15px]', danger && 'text-rose-500')}>{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {!danger && (href ? <ExternalLink className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </>
  );
  const cls = 'w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/40';
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
};

export const SettingsNote = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-muted-foreground px-1 -mt-5 mb-8">{children}</p>
);

/** Scrolls to #section after the page renders (menu rows link straight to a section). */
export const useScrollToHash = (ready = true) => {
  const location = useLocation();
  useEffect(() => {
    if (!ready || !location.hash) return;
    const t = setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [location.hash, ready]);
};

/** Applies font size, high contrast and reduced motion from the person's settings to the whole web app. */
export const UserPreferencesEffect = () => {
  const { settings } = useUserSettings();
  useEffect(() => {
    const root = document.documentElement;
    const size = settings?.font_size || 'medium';
    root.style.fontSize = size === 'small' ? '14px' : size === 'large' ? '18px' : '';
    root.classList.toggle('high-contrast', !!settings?.high_contrast);
    root.classList.toggle('reduce-motion', !!settings?.reduce_motion);
  }, [settings?.font_size, settings?.high_contrast, settings?.reduce_motion]);
  return null;
};
