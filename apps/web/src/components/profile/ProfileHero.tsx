import { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Globe, Instagram, Linkedin, Twitter, Facebook, Youtube, Briefcase, MapPin, Building2, Zap, Star } from 'lucide-react';
import VerificationBadge from '@/components/common/VerificationBadge';
import { formatURL } from '@/lib/utils';

export interface HeroStat { label: string; value: number | string; onClick?: () => void }

interface HeroProfile {
  full_name?: string | null; username?: string | null; bio?: string | null; craft?: string | null; location?: string | null;
  website?: string | null; is_verified?: boolean | null; account_type?: string | null;
  social_links?: Record<string, any> | null; instagram_url?: string | null; youtube_url?: string | null;
}

interface ProfileHeroProps {
  profile: HeroProfile;
  avatarSrc?: string;
  /** the @handle (a link, a button that switches account, or plain text) */
  handle: ReactNode;
  /** extra chips next to the account type, for example the availability badge */
  chips?: ReactNode;
  stats: HeroStat[];
  actions: ReactNode;
  /** shown between the numbers and the buttons, for example availability (nothing is drawn when it is null) */
  aside?: ReactNode;
}

const SocialLink = ({ href, label, children, hover }: { href: string; label: string; children: ReactNode; hover: string }) => (
  <a
    href={formatURL(href)}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className={`h-9 w-9 inline-flex items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors ${hover}`}
  >
    {children}
  </a>
);

/** The top of a profile (yours and other people's): who this is, how to reach them, and the numbers. */
export const ProfileHero = ({ profile: p, avatarSrc, handle, chips, stats, actions, aside }: ProfileHeroProps) => {
  const isFan = p.account_type === 'fan';
  const isStudio = p.account_type === 'studio';
  const links = p.social_links || {};
  const instagram = links.instagram || p.instagram_url;
  const youtube = links.youtube || p.youtube_url;
  const hasLinks = !!(instagram || links.linkedin || links.twitter || links.facebook || youtube || p.website);
  const name = p.full_name || p.username || '';

  return (
    <section className="rounded-3xl border border-border/60 bg-card shadow-sm overflow-hidden min-w-0">
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="p-6 md:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-8 min-w-0">
        <Avatar className="h-28 w-28 md:h-32 md:w-32 shrink-0 ring-4 ring-background shadow-xl border border-border/50">
          <AvatarImage src={avatarSrc || ''} alt={p.username || 'User'} className="object-cover" />
          <AvatarFallback className="bg-muted text-4xl font-black text-muted-foreground">{(p.username || name || '?').charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <div>
            <h1 className="text-2xl md:text-3xl leading-tight font-bold tracking-tight text-foreground break-words">
              {name}
              {p.is_verified && <VerificationBadge size="xl" className="ml-2 inline-flex align-middle" />}
            </h1>
            <div className="mt-0.5 text-sm font-semibold text-primary">{handle}</div>
          </div>

          {(p.craft || p.location) && (
            <p className="text-sm md:text-base text-muted-foreground font-medium flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-1">
              {p.craft && <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full" title={p.craft}><Briefcase size={14} className="shrink-0" /><span className="line-clamp-2 break-words">{p.craft}</span></span>}
              {p.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="shrink-0" />{p.location}</span>}
            </p>
          )}

          <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
            {isFan ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-amber-600">
                <Star size={12} className="fill-amber-500" /> Fan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-primary">
                {isStudio ? <Building2 size={12} /> : <Zap size={12} className="fill-primary" />} {isStudio ? 'Studio' : 'Pro'}
              </span>
            )}
            {chips}
          </div>

          {p.bio && <p className="text-sm md:text-base leading-relaxed text-foreground/85 max-w-3xl whitespace-pre-line break-words [overflow-wrap:anywhere]">{p.bio}</p>}

          {hasLinks && (
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 pt-1">
              {instagram && <SocialLink href={instagram} label="Instagram" hover="hover:text-pink-500 hover:border-pink-500/40"><Instagram size={18} /></SocialLink>}
              {links.linkedin && <SocialLink href={links.linkedin} label="LinkedIn" hover="hover:text-blue-600 hover:border-blue-600/40"><Linkedin size={18} /></SocialLink>}
              {links.twitter && <SocialLink href={links.twitter} label="X (Twitter)" hover="hover:text-sky-500 hover:border-sky-500/40"><Twitter size={18} /></SocialLink>}
              {links.facebook && <SocialLink href={links.facebook} label="Facebook" hover="hover:text-blue-500 hover:border-blue-500/40"><Facebook size={18} /></SocialLink>}
              {youtube && <SocialLink href={youtube} label="YouTube" hover="hover:text-red-600 hover:border-red-600/40"><Youtube size={18} /></SocialLink>}
              {p.website && (
                <a
                  href={formatURL(p.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 inline-flex items-center gap-2 rounded-full border border-border/60 px-3.5 text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors min-w-0"
                >
                  <Globe size={16} className="shrink-0" />
                  <span className="truncate max-w-[200px]">{p.website.replace(/^(https?|ftp):\/\//, '')}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t lg:border-t-0 lg:border-l border-border/50 bg-muted/20 p-6 flex flex-col gap-5">
        <dl className="grid grid-flow-col auto-cols-fr gap-4 text-center lg:text-left">
          {stats.map((s) => {
            const body = (
              <>
                <dd className="text-2xl font-bold text-foreground leading-none tabular-nums">{typeof s.value === 'number' ? new Intl.NumberFormat(undefined, { notation: 'compact' }).format(s.value) : s.value}</dd>
                <dt className="mt-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</dt>
              </>
            );
            return s.onClick ? (
              <button key={s.label} type="button" onClick={s.onClick} className="text-left py-2 px-3 -mx-3 -my-2 hover:opacity-75 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md">{body}</button>
            ) : (
              <div key={s.label}>{body}</div>
            );
          })}
        </dl>
        {aside}
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-auto">{actions}</div>
      </div>
      </div>
    </section>
  );
};
