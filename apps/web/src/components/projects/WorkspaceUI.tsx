import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The look every Project Space page shares: one page frame, one header, one card, one empty state.
 * Keep pages to these so Tasks, Files, Call Sheet and the rest read as one product.
 */

/** The scrolling frame of a page. */
export const WorkspacePage = ({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) => (
  <div className="h-full overflow-y-auto no-scrollbar">
    <div className={cn('w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6', wide ? 'max-w-6xl' : 'max-w-4xl', className)}>{children}</div>
  </div>
);

/** Title, a line that says what the page is for, and the page's main actions on the right. */
export const WorkspaceHeader = ({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) => (
  <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
    <div className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </header>
);

/** A plain card: a border, a soft background, no glow. */
export const WorkspaceCard = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('rounded-2xl border border-border bg-card', className)}>{children}</div>
);

/** A card with its own heading row. */
export const WorkspaceSection = ({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) => (
  <WorkspaceCard className={className}>
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
    <div className="p-5 pt-4">{children}</div>
  </WorkspaceCard>
);

/** Nothing here yet: say what goes here and give the next step. */
export const WorkspaceEmpty = ({ icon: Icon, title, description, action }: { icon: ComponentType<{ className?: string }>; title: string; description: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
    <div className="h-14 w-14 rounded-full bg-muted grid place-items-center mb-4">
      <Icon className="h-6 w-6 text-muted-foreground" />
    </div>
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/** A note for people who can look but not change (staff in observation mode). */
export const WorkspaceNotice = ({ children }: { children: ReactNode }) => (
  <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{children}</div>
);

/** The top of a page: an icon, the title, what the page is for, actions and a row of live numbers. */
export const WorkspaceHero = ({ icon: Icon, title, description, actions, stats }: { icon: ComponentType<{ className?: string }>; title: string; description?: string; actions?: ReactNode; stats?: { label: string; value: ReactNode; tone?: 'default' | 'primary' | 'success' | 'warn' }[] }) => (
  <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
    <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" aria-hidden />
    <div className="relative flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5 min-w-0">
        <span className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center shrink-0 shadow-sm">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
    {stats && stats.length > 0 && (
      <dl className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-background/70 border border-border/70 px-4 py-3">
            <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
            <dd className={cn('text-2xl font-bold mt-0.5 tabular-nums', s.tone === 'primary' && 'text-primary', s.tone === 'success' && 'text-emerald-600 dark:text-emerald-400', s.tone === 'warn' && 'text-amber-600 dark:text-amber-400')}>{s.value}</dd>
          </div>
        ))}
      </dl>
    )}
  </section>
);

/** A row of pill filters ("All", "Open", "Done" ...). */
export const FilterChips = <T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[]; label: string }) => (
  <div role="tablist" aria-label={label} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        role="tab"
        aria-selected={value === o.id}
        onClick={() => onChange(o.id)}
        className={cn('h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border', value === o.id ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/60')}
      >
        {o.label}
        {o.count !== undefined && <span className={cn('ml-1.5 text-xs tabular-nums', value === o.id ? 'opacity-70' : 'opacity-60')}>{o.count}</span>}
      </button>
    ))}
  </div>
);

/** A thin progress bar with its numbers. */
export const ProgressBar = ({ done, total, label }: { done: number; total: number; label: string }) => (
  <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
    <div className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400 transition-[width] duration-500" style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
  </div>
);
