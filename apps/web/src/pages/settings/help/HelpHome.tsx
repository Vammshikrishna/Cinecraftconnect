import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MessageSquarePlus, Inbox, Scale, Flag, X, SearchX } from 'lucide-react';
import { HELP_CATEGORIES, popularHelpArticles, searchHelp } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { SettingsPageHeader, SettingsSection, SettingsLinkRow } from '@/components/settings/SettingsUI';
import { ArticleRow, CATEGORY_ICON, HelpCard } from '@/components/help/HelpParts';

/** Help Center home: search, popular articles, topics, and ways to contact us. */
const HelpHome = () => {
  const [params] = useSearchParams();
  const [q, setQ] = useState(() => (params.get('q') || '').slice(0, 100));
  const [open, setOpen] = useState(0);
  const [attention, setAttention] = useState(0);
  const results = useMemo(() => searchHelp(q, 10), [q]);

  useEffect(() => {
    (supabase as any).rpc('my_support_tickets').then(({ data }: any) => {
      const rows = (data || []) as any[];
      setOpen(rows.filter(r => r.status === 'open' || r.status === 'in_progress').length);
      setAttention(rows.filter(r => r.staff_replied).length);
    });
  }, []);

  const searching = q.trim().length >= 2;

  return (
    <>
      <SettingsPageHeader title="Help Center" description="Find answers fast, or talk to our team." />

      <div className="relative mb-8">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground" />
        <input
          type="search"
          enterKeyHint="search"
          aria-label="Search help articles"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search for help, e.g. verification, block, availability"
          className="w-full h-12 rounded-2xl border bg-card pl-11 pr-12 text-base outline-none focus:ring-2 focus:ring-primary/30"
        />
        {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center active:opacity-60"><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>

      {searching ? (
        results.length > 0 ? (
          <SettingsSection title={`${results.length} result${results.length === 1 ? '' : 's'}`}>
            {results.map(a => <ArticleRow key={a.id} article={a} showCategory />)}
          </SettingsSection>
        ) : (
          <div className="rounded-2xl border bg-card p-8 text-center space-y-3 mb-8">
            <SearchX className="h-9 w-9 mx-auto text-muted-foreground/50" />
            <p className="font-semibold break-words">No articles match "{q}"</p>
            <p className="text-sm text-muted-foreground">Try different words, or ask our team directly.</p>
            <Link to="/settings/help/new" className="inline-flex h-11 items-center rounded-full bg-primary text-primary-foreground px-5 text-sm font-semibold active:scale-[0.97] transition-transform duration-100">Contact support</Link>
          </div>
        )
      ) : (
        <>
          <SettingsSection title="Popular articles">
            {popularHelpArticles().map(a => <ArticleRow key={a.id} article={a} />)}
          </SettingsSection>

          <section className="mb-8">
            <h3 className="text-base font-semibold mb-3">Browse by topic</h3>
            <div className="grid grid-cols-2 gap-3">
              {HELP_CATEGORIES.map(c => (
                <HelpCard key={c.id} icon={CATEGORY_ICON[c.icon]} title={c.title} description={c.description} to={`/settings/help/category/${c.id}`} />
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-base font-semibold mb-3">Still need help?</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <HelpCard icon={MessageSquarePlus} title="Contact support" description="Usually a reply within 24 hours" to="/settings/help/new" />
              <HelpCard icon={Inbox} title="Your requests" description={open ? `${open} open` : 'Replies and history'} to="/settings/help/requests"
                badge={attention > 0 ? <span className="rounded-full bg-primary text-primary-foreground text-[12px] font-bold px-2 py-0.5">{attention} new</span> : undefined} />
              <HelpCard icon={Flag} title="Your reports" description="What happened to what you reported" to="/settings/help/reports" />
              <HelpCard icon={Scale} title="Appeal a decision" description="Ask us to review a restriction" to="/settings/help/new?topic=appeal" />
            </div>
          </section>

          <SettingsSection title="Policies">
            <SettingsLinkRow title="Privacy Policy" to="/settings/legal/privacy" />
            <SettingsLinkRow title="Terms of Service" to="/settings/legal/terms" />
            <SettingsLinkRow title="Cookie Policy" to="/settings/legal/cookies" />
          </SettingsSection>
        </>
      )}
    </>
  );
};

export default HelpHome;
