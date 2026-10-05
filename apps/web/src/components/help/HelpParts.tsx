import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Rocket, User, Shield, Users, Film, Briefcase, Store, Star, Phone, Wrench, ChevronRight, ChevronLeft, FileText,
} from 'lucide-react';
import { HELP_CATEGORIES, type HelpArticle, type HelpCategory } from '@cinecraft/core';
import { cn } from '@/lib/utils';

export const CATEGORY_ICON: Record<HelpCategory['icon'], any> = {
  rocket: Rocket, user: User, shield: Shield, users: Users, film: Film, briefcase: Briefcase, store: Store, star: Star, phone: Phone, wrench: Wrench,
};

export const HelpBack = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
    <ChevronLeft className="h-4 w-4" /> {label}
  </Link>
);

export const ArticleRow = ({ article, showCategory = false }: { article: HelpArticle; showCategory?: boolean }) => {
  const cat = HELP_CATEGORIES.find(c => c.id === article.category);
  return (
    <Link to={`/settings/help/article/${article.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
      <FileText className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">{article.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{showCategory && cat ? `${cat.title} · ` : ''}{article.summary}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
};

export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    open: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    resolved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    closed: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  };
  const label: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', map[status] || map.closed)}>{label[status] || status}</span>;
};

export const HelpCard = ({ icon: Icon, title, description, to, badge }: { icon: any; title: string; description: string; to: string; badge?: ReactNode }) => (
  <Link to={to} className="rounded-2xl border bg-card p-4 hover:bg-muted/40 transition-colors flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
      {badge}
    </div>
    <p className="font-semibold text-[15px] leading-tight">{title}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </Link>
);
