import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, FileText, LifeBuoy, Mail, Search, X } from 'lucide-react';
import { HELP_ARTICLES, HELP_CATEGORIES, articlesInCategory, getHelpArticle, getHelpCategory, popularHelpArticles, searchHelp, type HelpArticle } from '@cinecraft/core';
import Footer from '@/components/Footer';
import SEO from '@/components/common/SEO';
import { useAuth } from '@/contexts/AuthContext';
import { PageHero, SectionHead, IconTile, cardStyle, eyebrow } from '@/components/landing/PageParts';
import { BadgeCheck, Building2, Eye } from 'lucide-react';
import { CATEGORY_ICON } from '@/components/help/HelpParts';
import { INK, LINE, MONO, MUTED, ORANGE, ORANGE_INK, SANS } from '@/components/landing/tokens';

/* The public Support Hub. It needs no account on purpose: the people who most need help are often the ones who cannot sign in.
   The articles are the same ones the app's Help Center uses (packages/core/src/help.ts), so both always agree. */
const SUPPORT_EMAIL = 'support@cinecraftconnect.com';

const mailTo = (subject: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    'What happened:\n\n\nThe email address on your account:\n\nWhat you were doing when it went wrong (sign in, sign up, password reset, ...):\n\nYour device and browser:\n',
  )}`;

/* Help by account type. What each account can do is the same text as on the landing page's "Choose how you join" and the Features page.
   The articles are picked by who actually needs them: a fan has no jobs or marketplace to ask about; a studio posts the jobs. */
type TypeId = 'fan' | 'creator' | 'studio';
const ACCOUNT_HELP: { id: TypeId; label: string; icon: typeof Eye; tagline: string; access: string; limits: string; articles: string[] }[] = [
  {
    id: 'fan', label: 'Fan account', icon: Eye, tagline: 'For enthusiasts and fans.',
    access: 'View-only access to public feeds, announcements and discussions.',
    limits: 'Cannot post jobs, rent equipment, pitch stories or message professionals.',
    articles: ['cant-sign-in', 'change-password', 'profile-visibility', 'block-someone', 'report-something', 'notifications-and-quiet-hours', 'download-your-data', 'delete-account'],
  },
  {
    id: 'creator', label: 'Creator Pro', icon: BadgeCheck, tagline: 'For individual filmmakers and creators.',
    access: 'Full access to the creator network, project spaces, job board, pitching and marketplace.',
    limits: 'Standard platform fees apply to equipment rentals and bookings.',
    articles: ['complete-your-profile', 'verify-your-account', 'find-people-and-work', 'send-connection-request', 'apply-for-a-job', 'availability-status', 'credits-confirmation', 'book-gear-or-location', 'submit-your-work', 'who-can-message-me'],
  },
  {
    id: 'studio', label: 'Studio or company', icon: Building2, tagline: 'For production houses and agencies.',
    access: 'Everything in Pro, plus company pages, multi-user project management and verified job postings.',
    limits: 'Requires official business verification.',
    articles: ['verify-your-account', 'post-a-job', 'invite-to-project', 'date-requests', 'credits-confirmation', 'become-a-vendor', 'submit-your-work', 'appeal-a-decision'],
  },
];

const AccountTypeHelp = () => {
  const { profile } = useAuth();
  const mine = (profile as { account_type?: string } | null)?.account_type;
  const [active, setActive] = useState<TypeId>(mine === 'studio' || mine === 'creator' || mine === 'fan' ? mine : 'creator');
  const cur = ACCOUNT_HELP.find((a) => a.id === active)!;
  const list = cur.articles.map((id) => getHelpArticle(id)).filter(Boolean) as HelpArticle[];
  return (
    <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-14 md:pb-20" aria-labelledby="type-help-title">
      <SectionHead label="By account type" title="Help for your account" note={mine ? 'Your account type is selected first.' : 'Pick the kind of account you have, or want.'} />
      <div role="tablist" aria-label="Account type" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {ACCOUNT_HELP.map((a) => {
          const on = a.id === active;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              id={`type-tab-${a.id}`}
              aria-selected={on}
              aria-controls="type-panel"
              onClick={() => setActive(a.id)}
              className="landing-focus"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 18px', borderRadius: 99, fontFamily: SANS, fontSize: 15.5, fontWeight: 700, cursor: 'pointer', background: on ? INK : '#fff', color: on ? '#fff' : INK, border: `1px solid ${on ? INK : LINE}` }}
            >
              <a.icon size={16} aria-hidden="true" />{a.label}{mine === a.id && <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', opacity: 0.8 }}>YOURS</span>}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="type-panel" aria-labelledby={`type-tab-${active}`} className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-5">
        <div style={cardStyle}>
          <h2 id="type-help-title" style={{ fontSize: 24, color: INK, margin: '0 0 4px' }}>{cur.label}</h2>
          <p style={{ fontSize: 15, color: MUTED, margin: '0 0 16px' }}>{cur.tagline}</p>
          <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANGE_INK, margin: '0 0 4px' }}>What you can do</p>
          <p style={{ fontSize: 15.5, color: INK, lineHeight: 1.6, margin: '0 0 14px' }}>{cur.access}</p>
          <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, margin: '0 0 4px' }}>Limits</p>
          <p style={{ fontSize: 15.5, color: MUTED, lineHeight: 1.6, margin: 0 }}>{cur.limits}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ alignContent: 'start' }}>
          {list.map((a) => <ArticleLink key={a.id} a={a} />)}
        </div>
      </div>
    </section>
  );
};

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '0 20px', borderRadius: 12, fontFamily: SANS, fontSize: 15, fontWeight: 700, textDecoration: 'none' };

/** Contact options: the way out when the articles do not solve it. Works signed out (email), and signed in (a request in the app). */
const ContactCard = ({ subject = 'I need help with CineCraft Connect', title = 'Still stuck?' }: { subject?: string; title?: string }) => {
  const { user } = useAuth();
  return (
    <div style={{ ...cardStyle, borderColor: ORANGE, boxShadow: '0 30px 60px -38px rgba(255,75,51,0.55)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <IconTile><LifeBuoy size={21} color={ORANGE} aria-hidden="true" /></IconTile>
        <h2 style={{ fontSize: 24, color: INK, margin: 0 }}>{title}</h2>
      </div>
      <p className="[text-wrap:pretty]" style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.65, margin: '0 0 18px', maxWidth: 560 }}>
        Our team reads every message. You do not need to be signed in: if you cannot get into your account, email us from the address on it and tell us what you see.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <a href={mailTo(subject)} className="landing-btn landing-focus" style={{ ...btn, background: INK, color: '#fff' }}>
          <Mail size={17} aria-hidden="true" /> Email {SUPPORT_EMAIL}
        </a>
        {user && (
          <Link to="/settings/help/new" className="landing-btn landing-focus" style={{ ...btn, background: '#fff', color: INK, border: `1px solid ${LINE}` }}>
            Open a request in the app <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
};

const ArticleLink = ({ a, showCategory }: { a: HelpArticle; showCategory?: boolean }) => {
  const cat = getHelpCategory(a.category);
  return (
    <Link to={`/support/article/${a.id}`} className="landing-focus" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 16, background: '#fff', border: `1px solid ${LINE}`, textDecoration: 'none', color: INK }}>
      <IconTile size={38}><FileText size={17} color={ORANGE} aria-hidden="true" /></IconTile>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 16.5, fontWeight: 600, lineHeight: 1.3 }}>{a.title}</span>
        <span style={{ display: 'block', fontSize: 14, color: MUTED, lineHeight: 1.4, marginTop: 2 }}>{showCategory && cat ? `${cat.title} · ` : ''}{a.summary}</span>
      </span>
      <ArrowRight size={17} color={MUTED} aria-hidden="true" style={{ flexShrink: 0 }} />
    </Link>
  );
};

const Back = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="landing-focus" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, fontSize: 15, fontWeight: 600, color: MUTED, textDecoration: 'none' }}>
    <ChevronLeft size={17} aria-hidden="true" /> {label}
  </Link>
);

/* ── /support ── */
export const SupportHub = () => {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchHelp(q, 8), [q]);
  const searching = q.trim().length >= 2;
  const signIn = getHelpArticle('cant-sign-in');

  return (
    <div style={{ color: INK, fontFamily: SANS, overflowX: 'clip' }}>
      <SEO title="Support Hub — CineCraft Connect" description="Find answers about your account, privacy, projects, jobs and the marketplace. No sign-in needed. If you cannot sign in, email our team." />
      <main>
        <PageHero
          label="Support Hub"
          title="How can we"
          accent="help?"
          intro="Answers to the most common questions, and a way to reach our team. You do not need to be signed in."
        />

        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-10 md:pb-14">
          <div style={{ position: 'relative', maxWidth: 720 }}>
            <Search size={20} aria-hidden="true" style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: MUTED }} />
            <input
              type="search"
              enterKeyHint="search"
              aria-label="Search help articles"
              value={q}
              onChange={(e) => setQ(e.target.value.slice(0, 100))}
              placeholder="Search, e.g. can't sign in, reset password, verification"
              className="landing-focus"
              style={{ width: '100%', minHeight: 58, padding: '0 52px 0 50px', borderRadius: 18, border: `1px solid ${LINE}`, background: '#fff', fontFamily: SANS, fontSize: 17, color: INK, boxShadow: '0 20px 44px -30px rgba(20,17,15,0.4)' }}
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="landing-focus" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer', color: MUTED }}>
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>

          {searching && (
            <div role="region" aria-label="Search results" aria-live="polite" style={{ maxWidth: 720, marginTop: 18, display: 'grid', gap: 10 }}>
              {results.length ? results.map((a) => <ArticleLink key={a.id} a={a} showCategory />) : (
                <p style={{ fontSize: 16.5, color: MUTED, margin: '6px 2px' }}>No article matches "{q.trim()}". Try other words, or <a href={mailTo(`Help: ${q.trim()}`)} style={{ color: ORANGE_INK, fontWeight: 600 }}>email our team</a>.</p>
              )}
            </div>
          )}
        </section>

        {!searching && (
          <>
            {/* the most common reason to be here without an account */}
            <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-12 md:pb-16">
              <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18, background: '#FFF7F4', borderColor: 'rgba(255,75,51,0.35)' }}>
                <div style={{ minWidth: 0, flex: '1 1 360px' }}>
                  <p style={eyebrow}>Trouble signing in?</p>
                  <h2 style={{ fontSize: 26, color: INK, margin: '0 0 6px' }}>Can't sign in, or can't reset your password?</h2>
                  <p style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.6, margin: 0 }}>Start with the steps below. If they don't fix it, email us and we will help you back in.</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {signIn && <Link to={`/support/article/${signIn.id}`} className="landing-btn landing-focus" style={{ ...btn, background: INK, color: '#fff' }}>Read the steps <ArrowRight size={16} aria-hidden="true" /></Link>}
                  <a href={mailTo("I can't sign in to CineCraft Connect")} className="landing-btn landing-focus" style={{ ...btn, background: '#fff', color: INK, border: `1px solid ${LINE}` }}>Email us</a>
                </div>
              </div>
            </section>

            <AccountTypeHelp />

            <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-14 md:pb-20">
              <SectionHead label="Popular" title="Most read" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{popularHelpArticles().map((a) => <ArticleLink key={a.id} a={a} showCategory />)}</div>
            </section>

            <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-14 md:pb-20">
              <SectionHead label="Topics" title="Browse by topic" />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {HELP_CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICON[c.icon];
                  const n = articlesInCategory(c.id).length;
                  return (
                    <li key={c.id}>
                      <Link to={`/support/category/${c.id}`} className="landing-focus" style={{ ...cardStyle, display: 'block', textDecoration: 'none', color: INK, height: '100%' }}>
                        <IconTile><Icon size={21} color={ORANGE} aria-hidden="true" /></IconTile>
                        <h3 style={{ fontSize: 20, margin: '16px 0 6px' }}>{c.title}</h3>
                        <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.55, margin: '0 0 12px' }}>{c.description}</p>
                        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: ORANGE_INK }}>{n} {n === 1 ? 'ARTICLE' : 'ARTICLES'}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-16 md:pb-24"><ContactCard /></section>
      </main>
      <Footer />
    </div>
  );
};

/* ── /support/category/:id ── */
export const SupportCategory = () => {
  const { id = '' } = useParams();
  const cat = getHelpCategory(id);
  const list = cat ? articlesInCategory(cat.id) : [];
  return (
    <div style={{ color: INK, fontFamily: SANS, overflowX: 'clip' }}>
      <SEO title={`${cat?.title || 'Help'} — Support Hub`} description={cat?.description || 'Help articles'} />
      <main className="max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-32 pb-16 md:pb-24">
        <Back to="/support" label="Support Hub" />
        {cat ? (
          <>
            <h1 className="[text-wrap:balance]" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-0.035em', margin: '12px 0 10px' }}>{cat.title}</h1>
            <p style={{ fontSize: 18, color: MUTED, margin: '0 0 32px' }}>{cat.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginBottom: 40 }}>{list.map((a) => <ArticleLink key={a.id} a={a} />)}</div>
          </>
        ) : (
          <p style={{ fontSize: 18, color: MUTED, margin: '24px 0 40px' }}>We could not find that topic. <Link to="/support" style={{ color: ORANGE_INK, fontWeight: 600 }}>Go back to the Support Hub.</Link></p>
        )}
        <ContactCard />
      </main>
      <Footer />
    </div>
  );
};

/* ── /support/article/:id ── */
export const SupportArticle = () => {
  const { id = '' } = useParams();
  const article = getHelpArticle(id);
  const cat = article ? getHelpCategory(article.category) : undefined;
  const related = (article?.related || []).map((r) => HELP_ARTICLES.find((a) => a.id === r)).filter(Boolean) as HelpArticle[];
  return (
    <div style={{ color: INK, fontFamily: SANS, overflowX: 'clip' }}>
      <SEO title={`${article?.title || 'Help'} — Support Hub`} description={article?.summary || 'Help article'} />
      <main className="max-w-[860px] mx-auto px-6 md:px-12 pt-24 md:pt-32 pb-16 md:pb-24">
        <Back to={cat ? `/support/category/${cat.id}` : '/support'} label={cat?.title || 'Support Hub'} />
        {article ? (
          <article>
            <h1 className="[text-wrap:balance]" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(32px, 4.6vw, 52px)', letterSpacing: '-0.035em', margin: '12px 0 12px' }}>{article.title}</h1>
            <p className="[text-wrap:pretty]" style={{ fontSize: 19, color: MUTED, lineHeight: 1.6, margin: '0 0 28px' }}>{article.summary}</p>
            {article.steps && (
              <ol style={{ listStyle: 'none', margin: '0 0 28px', padding: 0, display: 'grid', gap: 14 }}>
                {article.steps.map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF1EE', color: ORANGE_INK, fontFamily: MONO, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <p style={{ fontSize: 17.5, lineHeight: 1.65, margin: '3px 0 0' }}>{s}</p>
                  </li>
                ))}
              </ol>
            )}
            <div style={{ display: 'grid', gap: 14, marginBottom: 36 }}>
              {article.body.map((p, i) => <p key={i} className="[text-wrap:pretty]" style={{ fontSize: 17.5, lineHeight: 1.7, color: 'rgba(20,17,15,0.82)', margin: 0 }}>{p}</p>)}
            </div>
            {related.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <p style={eyebrow}>Related</p>
                <div style={{ display: 'grid', gap: 10 }}>{related.map((a) => <ArticleLink key={a.id} a={a} />)}</div>
              </div>
            )}
          </article>
        ) : (
          <p style={{ fontSize: 18, color: MUTED, margin: '24px 0 40px' }}>We could not find that article. <Link to="/support" style={{ color: ORANGE_INK, fontWeight: 600 }}>Search the Support Hub.</Link></p>
        )}
        <ContactCard subject={article ? `Help with: ${article.title}` : undefined} title="Did this not solve it?" />
      </main>
      <Footer />
    </div>
  );
};
