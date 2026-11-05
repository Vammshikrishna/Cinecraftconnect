import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, BadgeCheck, Bell, Building2, Lock, Megaphone, MessagesSquare, ShieldCheck, Star, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Footer from '@/components/Footer';
import SEO from '@/components/common/SEO';
import Walkthrough from '@/components/landing/Walkthrough';
import HeroStage from '@/components/landing/HeroStage';
import FilmJourney from '@/components/landing/FilmJourney';
import TiltCard from '@/components/landing/TiltCard';
import { canDrawWebGL } from '@/components/landing/film3d/filmStore';
import { BG, CARD, FAINT, INK, LINE, MONO, MUTED, ORANGE, ORANGE_INK, SANS, SERIF } from '@/components/landing/tokens';

/* The landing page tells one story. The hero and the "How content gets made" journey sit on a 3D studio (fixed, behind the page): 24 craft
   characters, in the order content is made, and the camera follows your scroll. When the journey ends the page turns solid and shows the
   product: an interactive walkthrough of the app, then the rest of the platform. It keeps its own light palette on purpose (it is the
   first thing a visitor sees, whatever theme the signed-in app uses). Everything moves less under "reduce motion", and nothing hijacks
   scrolling. Without WebGL, on a data-saver connection, or while the 3D loads, the page is a normal light page. */

// the 3D background is a separate chunk (three.js), loaded after the page has painted
const FilmWorld = lazy(() => import('@/components/landing/film3d/FilmWorld'));

const MORE = [
  { icon: MessagesSquare, title: 'Discussion rooms', desc: 'Craft communities across film, TV, digital, music, advertising and podcasting.' },
  { icon: Building2, title: 'Company pages', desc: 'Studios, agencies and production houses show their portfolio and list jobs.' },
  { icon: ShieldCheck, title: 'Verified vendors', desc: 'Trusted partners for your next shoot, from catering to VFX houses.' },
  { icon: Star, title: 'Ratings and reviews', desc: 'Build credibility with transparent ratings after a project is completed.' },
  { icon: Megaphone, title: 'Industry announcements', desc: 'Share festival selections, casting calls and news with your followers.' },
  { icon: Bell, title: 'Job alerts', desc: 'Hear first about roles that match your craft, city and pay.' },
];

const TIERS = [
  { type: 'Fan account', desc: 'For enthusiasts and fans.', access: 'View-only access to public feeds and discussions.', limits: 'Cannot post jobs, rent equipment, pitch stories or message professionals.', featured: false },
  { type: 'Creator Pro', desc: 'For individual filmmakers and creators.', access: 'Full access to the creator network, project spaces, job board and marketplace.', limits: 'Standard platform fees apply.', featured: true },
  { type: 'Studio or company', desc: 'For production houses and agencies.', access: 'Everything in Pro, plus company pages and multi-user project management.', limits: 'Requires official business verification.', featured: false },
];

const btnBase: React.CSSProperties = { fontFamily: SANS, fontSize: 16, fontWeight: 700, padding: '15px 26px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', cursor: 'pointer', border: 'none', minHeight: 52 };

const eyebrow: React.CSSProperties = { fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: ORANGE_INK, margin: '0 0 14px' };
const h2: React.CSSProperties = { fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(32px, 4.2vw, 54px)', lineHeight: 1.06, letterSpacing: '-0.03em', color: INK, margin: 0 };

const Index = () => {
  const reduce = useReducedMotion();
  // can this visitor have the 3D studio? (WebGL, not on a data-saver connection.) Decided once, so the page reserves its space from the first paint.
  const [canFilm] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return !conn?.saveData && canDrawWebGL();
  });
  // ...and it starts loading once the page is on screen
  const [film, setFilm] = useState(false);
  useEffect(() => {
    if (!canFilm) return;
    // start once the browser is idle (the text and buttons are already on screen), but no later than 1.5 s
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setFilm(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setFilm(true), 600);
    return () => window.clearTimeout(id);
  }, [canFilm]);

  return (
    <div className="landing-root" style={{ position: 'relative', zIndex: 1, background: canFilm ? 'transparent' : BG, color: INK, fontFamily: SANS, overflowX: 'clip' }}>
      {film && <Suspense fallback={null}><FilmWorld /></Suspense>}
      <style>{`
        .landing-root { --s: 1; --hs: 1; }
        @media (min-width: 1600px) { .landing-root { --hs: 1.1; } }
        @media (min-width: 1900px) { .landing-root { --hs: 1.18; } }
        @media (min-width: 2400px) { .landing-root { --hs: 1.5; } }
        @media (max-width: 1279px) { .landing-root { --s: .9; } }
        @media (max-width: 639px) { .landing-root { --s: .64; } }
        @keyframes landing-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        .landing-float { animation: landing-float 7s ease-in-out infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .landing-float { animation: none; will-change: auto; } }
        .landing-btn { transition: transform 160ms cubic-bezier(.23,1,.32,1), background-color 160ms, box-shadow 160ms; -webkit-user-select: none; user-select: none; }
        .landing-btn:active { transform: scale(.97); }
        @media (hover: hover) and (pointer: fine) {
          .landing-btn-ink:hover { background-color: ${ORANGE_INK} !important; }
          .landing-btn-orange:hover { background-color: #FF6A55 !important; }
          .landing-btn-ghost:hover { background-color: rgba(20,17,15,0.05) !important; }
        }
        .landing-focus:focus-visible { outline: 2px solid ${ORANGE}; outline-offset: 3px; }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
        .hero-veil { background: linear-gradient(90deg, rgba(251,250,248,0.94) 0%, rgba(251,250,248,0.8) 34%, rgba(251,250,248,0) 60%), linear-gradient(0deg, rgba(251,250,248,0.9) 0%, rgba(251,250,248,0) 22%); }
        @media (max-width: 1023px) { .hero-veil { background: linear-gradient(180deg, rgba(251,250,248,0.97) 0%, rgba(251,250,248,0.93) 56%, rgba(251,250,248,0) 82%); } }
        @keyframes landing-nudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        .landing-nudge { animation: landing-nudge 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .landing-nudge { animation: none; } }
      `}</style>
      <SEO
        title="CineCraft Connect — The Entertainment Industry Network"
        description="Where entertainment talent, opportunities and production come together. Find crew and jobs, run your production in an encrypted project space, rent gear and build a profile of confirmed credits. For films, TV and OTT, YouTube, Instagram, ad films, music videos and podcasts."
      />

      {/* ── HERO: the 3D studio is the picture, the words sit beside it ── */}
      <header style={{ position: 'relative', isolation: 'isolate', minHeight: '100svh', display: 'flex', alignItems: 'center' }}>
        {/* keeps the words readable over the scene: light on the left, clear on the right */}
        <div aria-hidden="true" className={canFilm ? 'hero-veil' : undefined} style={{ position: 'absolute', inset: 0, zIndex: -1, background: canFilm ? undefined : 'radial-gradient(52% 60% at 82% 28%, rgba(255,75,51,0.2), rgba(255,75,51,0) 70%), radial-gradient(40% 50% at 8% 4%, rgba(255,180,120,0.2), rgba(255,180,120,0) 70%)' }} />
        <div className={`max-w-[1760px] mx-auto w-full px-6 md:px-12 2xl:px-20 pt-[104px] pb-[88px] xl:grid xl:grid-cols-[minmax(0,1fr)_calc(720px*var(--hs))] xl:gap-10 xl:items-center ${canFilm ? 'max-lg:pb-[48vh]' : ''}`}>
          <motion.div style={{ maxWidth: 'min(760px, 100%)' }} initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <h1 className="[text-wrap:balance]" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(36px, 3.9vw, 78px)', lineHeight: 1.04, letterSpacing: '-0.035em', color: INK, margin: '0 0 22px' }}>
              Where Entertainment Talent, Opportunities and Production{' '}
              <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: ORANGE_INK }}>Come Together.</span>
            </h1>
            <p className="[text-wrap:pretty]" style={{ fontSize: 19, color: MUTED, lineHeight: 1.6, maxWidth: 540, margin: '0 0 24px' }}>
              Films, series, YouTube, Instagram, ads, music videos and podcasts: whatever you make, find crew and jobs, run your shoot in an encrypted project space, rent gear and build a profile of credits confirmed by the people you worked with.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBottom: 28 }}>
              <Link to="/register" className="landing-btn landing-btn-ink landing-focus" style={{ ...btnBase, background: INK, color: '#fff' }}>
                Create your profile <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a href={canFilm ? '#film-journey' : '#how-it-works'} className="landing-btn landing-btn-ghost landing-focus" style={{ ...btnBase, background: 'rgba(255,255,255,0.7)', color: INK, border: `1px solid ${LINE}` }}>
                {canFilm ? 'See how content gets made' : 'See how it works'}
              </a>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px 26px', fontSize: 15, color: MUTED }}>
              {[[BadgeCheck, 'Free to join'], [Lock, 'End-to-end encrypted chat'], [Sparkles, 'Films, TV, YouTube, Instagram, ads, music and podcasts']].map(([Icon, label]) => {
                const I = Icon as typeof BadgeCheck;
                return <li key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><I size={17} color={ORANGE} aria-hidden="true" />{label as string}</li>;
              })}
            </ul>
          </motion.div>
          <div className="hidden xl:block"><HeroStage /></div>
        </div>
        {canFilm && (
          <div aria-hidden="true" className="landing-nudge" style={{ position: 'absolute', left: '50%', bottom: 26, marginLeft: -60, width: 120, textAlign: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK }}>
            Scroll <ArrowDown size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
          </div>
        )}
      </header>

      {/* ── HOW A FILM GETS MADE: the 3D journey through the 24 crafts ── */}
      {canFilm && <FilmJourney />}

      {/* ── from here the page is solid: the product ── */}
      <div style={{ position: 'relative', background: BG }}>
        <Walkthrough />

        {/* ── EVERYTHING ELSE ── */}
        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-20 md:pb-28">
          <p style={eyebrow}>And there is more</p>
          <h2 className="[text-wrap:balance]" style={{ ...h2, maxWidth: 760, marginBottom: 40 }}>Everything else a production runs on.</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {MORE.map(({ icon: Icon, title, desc }) => (
              <li key={title}>
                <TiltCard style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 24, padding: 26, boxShadow: '0 24px 50px -34px rgba(20,17,15,0.4)' }}>
                  <span style={{ width: 46, height: 46, borderRadius: 14, background: '#FFF1EE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}><Icon size={22} color={ORANGE} aria-hidden="true" /></span>
                  <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', color: INK, margin: '0 0 8px' }}>{title}</h3>
                  <p className="[text-wrap:pretty]" style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </TiltCard>
              </li>
            ))}
          </ul>
        </section>

        {/* ── ACCOUNT TYPES ── */}
        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-20 md:pb-28">
          <p style={eyebrow}>Join</p>
          <h2 className="[text-wrap:balance]" style={{ ...h2, marginBottom: 36 }}>Choose how you join.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TIERS.map((t) => (
              <div key={t.type} style={{ padding: 28, borderRadius: 24, background: CARD, border: `1px solid ${t.featured ? ORANGE : LINE}`, boxShadow: t.featured ? '0 30px 60px -34px rgba(255,75,51,0.6)' : 'none' }}>
                <h3 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', margin: '0 0 6px' }}>{t.type}</h3>
                <p style={{ fontSize: 15, color: MUTED, margin: '0 0 20px' }}>{t.desc}</p>
                <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANGE_INK, margin: '0 0 4px' }}>What you get</p>
                <p style={{ fontSize: 15, color: INK, lineHeight: 1.55, margin: '0 0 16px' }}>{t.access}</p>
                <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, margin: '0 0 4px' }}>Limits</p>
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.55, margin: 0 }}>{t.limits}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CLOSING ── */}
        <section className="px-6 md:px-12 pb-20 md:pb-28">
          <div style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', maxWidth: 1280, margin: '0 auto', borderRadius: 32, background: INK, color: '#fff', padding: 'clamp(48px, 8vw, 96px) clamp(24px, 6vw, 80px)', textAlign: 'center' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'radial-gradient(60% 90% at 50% 130%, rgba(255,75,51,0.55), rgba(255,75,51,0) 70%)' }} />
            <h2 className="[text-wrap:balance]" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.04, letterSpacing: '-0.035em', margin: '0 0 18px' }}>
              Ready to frame your{' '}
              <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: '#FF8A78' }}>next production?</span>
            </h2>
            <p className="[text-wrap:pretty]" style={{ fontSize: 18, color: 'rgba(255,255,255,0.78)', maxWidth: 520, margin: '0 auto 34px', lineHeight: 1.6 }}>
              Create your account, set up your encryption backup key, and start working with the people who make entertainment.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', alignItems: 'center' }}>
              <Link to="/register" className="landing-btn landing-btn-orange landing-focus" style={{ ...btnBase, background: ORANGE, color: INK }}>
                Join CineCraft Connect <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/auth" className="landing-focus" style={{ padding: '12px 6px', fontSize: 16, fontWeight: 600, color: '#fff', textDecoration: 'underline', textUnderlineOffset: 5, textDecorationColor: 'rgba(255,255,255,0.4)' }}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* positioned and solid, like the sections above: otherwise the fixed 3D background paints over the footer */}
      <div style={{ position: 'relative', background: BG }}>
        <Footer />
      </div>
    </div>
  );
};

export default Index;
