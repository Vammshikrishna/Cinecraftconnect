import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import Footer from '@/components/Footer';
import SEO from '@/components/common/SEO';

/* ─── Design Tokens ─────────────────────────── */
const CREAM = '#F8F5F0';
const INK   = '#0D0D0D';
const ORANGE = '#f97316';
const SERIF = "'Lora', Georgia, serif";
const MONO  = "'Inconsolata', 'Courier New', monospace";
const SANS  = "'Work Sans', system-ui, sans-serif";

/* ─── Film Grain ─────────────────────────────
   Subtle texture overlay so content feels printed
   ─────────────────────────────────────────── */
const FilmGrain = () => (
  <div aria-hidden style={{
    position: 'fixed', inset: 0, zIndex: 998, pointerEvents: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat', backgroundSize: '220px', opacity: 0.025, mixBlendMode: 'multiply',
  }} />
);

/* ─── Typewriter ────────────────────────────── */
const ROLES = ['Directors','YouTubers','Cinematographers','TV Producers','Editors','Instagram Creators','Writers','Ad Film Makers','VFX Artists','Music Video Directors','Sound Designers','Content Creators','Showrunners','Podcast Creators'];
const TypewriterRole = () => {
  const [idx, setIdx] = useState(0);
  const [txt, setTxt] = useState('');
  const [del, setDel] = useState(false);
  useEffect(() => {
    const word = ROLES[idx];
    let t: ReturnType<typeof setTimeout>;
    if (!del && txt.length < word.length) t = setTimeout(() => setTxt(word.slice(0, txt.length + 1)), 68);
    else if (!del && txt.length === word.length) t = setTimeout(() => setDel(true), 1800);
    else if (del && txt.length > 0) t = setTimeout(() => setTxt(word.slice(0, txt.length - 1)), 34);
    else { setDel(false); setIdx((p: number) => (p + 1) % ROLES.length); }
    return () => clearTimeout(t);
  }, [txt, del, idx]);
  return (
    <span style={{ color: ORANGE }}>
      {txt}<span style={{ color: ORANGE, animation: 'pulse 1s infinite' }}>|</span>
    </span>
  );
};

/* ─── Reveal wrapper ────────────────────────── */
const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >{children}</motion.div>
  );
};

/* ─── Slug line ─────────────────────────────── */
const Slug = ({ text }: { text: string }) => (
  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.35)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ORANGE, display: 'inline-block' }} />
    {text}
  </div>
);

/* ─── Launch Pillars ────────────────────────── */
const PILLARS = [
  { val: 'Free', lbl: 'To Join' },
  { val: 'E2EE', lbl: 'Encrypted' },
  { val: 'All',  lbl: 'Platforms' },
  { val: '24/7', lbl: 'Uptime Goal' },
];

/* ─── Feature list ──────────────────────────── */
const FEATURES = [
  { n:'01', title:'Creator Network',        desc:'Connect with professionals across films, TV shows, YouTube channels, Instagram brands, ad agencies, and music videos. Smart craft-based discovery.' },
  { n:'02', title:'Project Spaces',          desc:'Encrypted collaborative rooms for any production — from feature films to Reels campaigns. Script feedback, shot lists, and scheduling, all in one place.' },
  { n:'03', title:'Job Board',               desc:'Browse and post roles across every format — film sets, YouTube productions, ad campaigns, brand shoots, podcast studios, OTT shows, and more.' },
  { n:'04', title:'Equipment Marketplace',   desc:'Rent and list professional gear — cinema cameras, lenses, lighting, audio, drones, and studio equipment — from verified creators and studios.' },
  { n:'05', title:'Story Pitching',          desc:'Pitch your concepts directly to producers, brands, and studios. Submit showreels, storyboards, and concept decks from your profile.' },
  { n:'06', title:'Discussion Rooms',        desc:'Craft-specific communities for every corner of the entertainment industry — film, TV, digital, music, advertising, and podcasting.' },
  { n:'07', title:'Company Pages',           desc:'Dedicated profiles for studios, agencies, and production houses to showcase portfolios and list jobs.' },
  { n:'08', title:'Verified Vendors',        desc:'Find trusted service providers for your next production, from catering to VFX houses.' },
  { n:'09', title:'Ratings & Reviews',       desc:'Build professional credibility with transparent ratings after successful project completion.' },
  { n:'10', title:'Industry Announcements',  desc:'Broadcast major updates, festival selections, and casting calls to your entire network.' },
];

/* ─── Index Page ────────────────────────────── */
const Index = () => {
  return (
    <div style={{ background: CREAM, color: INK, fontFamily: SANS, overflowX: 'hidden' }}>
      <SEO
        title="CineCraft Connect — The Entertainment Industry Network"
        description="Connect with directors, YouTubers, TV producers, ad filmmakers, Instagram creators, and every professional in the entertainment industry. One platform for all content formats."
      />
      <FilmGrain />

      {/* ── HERO ────────────────────────────── */}
      <header className="pt-[80px] md:pt-32 pb-16 md:pb-24 px-6 md:px-12 max-w-[1440px] mx-auto relative">
        {/* Top-right decorative film frame corners */}
        <div style={{ position: 'absolute', top: 100, right: 48, width: 80, height: 80, borderTop: `2px solid ${ORANGE}`, borderRight: `2px solid ${ORANGE}`, opacity: 0.3 }} className="hidden md:block" />
        <div style={{ position: 'absolute', bottom: 60, left: 32, width: 48, height: 48, borderBottom: `2px solid ${ORANGE}`, borderLeft: `2px solid ${ORANGE}`, opacity: 0.2 }} className="hidden md:block" />

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <Slug text="EXT. Platform Landing — Entertainment Industry" />

          {/* Issue-style eyebrow */}
          <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(13,13,13,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>Now Launching</span>
            <span style={{ width: 40, height: 1, background: 'rgba(13,13,13,0.2)', display: 'inline-block' }} />
            <span>2026</span>
          </div>

          {/* Main headline — big editorial */}
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5.5vw, 68px)', fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.02em', color: INK, marginBottom: 24, maxWidth: 900 }}>
            Where <TypewriterRole /><br />
            <em style={{ fontStyle: 'italic', color: 'rgba(13,13,13,0.55)' }}>build their next project.</em>
          </h1>

          <p style={{ fontSize: 16, color: 'rgba(13,13,13,0.6)', maxWidth: 520, lineHeight: 1.6, marginBottom: 32 }}>
            The professional network for the entire entertainment industry — films, TV, YouTube, Instagram, ad films, music videos, podcasts, and every format in between.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <Link to="/register">
              <button style={{ background: INK, color: CREAM, fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', padding: '14px 28px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.25s', borderRadius: 4 }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = ORANGE)}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = INK)}
              >
                Create Crew Profile <ArrowRight size={14} />
              </button>
            </Link>
            <Link to="/auth">
              <button style={{ background: 'transparent', color: INK, fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${INK}`, padding: '13px 28px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.25s, color 0.25s', borderRadius: 4 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = INK; (e.currentTarget as HTMLButtonElement).style.color = CREAM; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = INK; }}
              >
                [ Sign In ]
              </button>
            </Link>
          </div>

          {/* Scene metadata */}
          <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(13,13,13,0.25)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 48, display: 'flex', gap: 20 }}>
            <span>Scene 01</span><span>•</span><span>Roll A</span><span>•</span><span>24.00 FPS</span>
          </div>
        </motion.div>
      </header>

      {/* ── LAUNCH PILLARS ──────────────────────── */}
      <Reveal>
        <div style={{ background: INK }} className="px-6 md:px-12">
          <div className="max-w-[1440px] mx-auto grid grid-cols-2 md:grid-cols-4">
            {PILLARS.map((s, i) => (
              <div key={i} className={`py-12 px-8 text-center ${i % 2 === 0 ? 'border-r border-white/10' : ''} md:border-r md:border-white/10 md:last:border-r-0 ${i < 2 ? 'border-b border-white/10 md:border-b-0' : ''}`}>
                <div style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,52px)', fontWeight: 300, color: ORANGE, marginBottom: 8 }}>{s.val}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(248,245,240,0.35)' }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── MANIFESTO ───────────────────────── */}
      <Reveal>
        <section className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-start">
          <div>
            <Slug text="INT. Manifesto Room — Continuous" />
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px,3vw,42px)', fontWeight: 300, color: INK, lineHeight: 1.25, marginBottom: 20 }}>
                Built for the entire entertainment industry.
            </h2>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(13,13,13,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>[ File: CC_MANIFESTO.TXT ]</div>
          </div>
          <div style={{ fontSize: 16, color: 'rgba(13,13,13,0.65)', lineHeight: 1.75 }}>
            <p style={{ marginBottom: 20 }}>
              Whether you're making feature films, TV shows, YouTube videos, Instagram content, ad films, or music videos — CineCraft Connect is the professional home for every creator in the entertainment industry.
            </p>
            <p>
              One platform, every format. End-to-end encrypted project spaces, a unified crew network, a verified equipment marketplace, and a job board that spans all of entertainment.
            </p>
          </div>
        </section>
      </Reveal>

      {/* ── FEATURES LIST ───────────────────── */}
      <Reveal>
        <section className="max-w-[1440px] mx-auto px-6 md:px-12 pb-16 md:pb-24">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 56, paddingBottom: 32, borderBottom: '1px solid rgba(13,13,13,0.1)' }}>
            <div>
              <Slug text="EXT. Ecosystem Specs — Sequence Index" />
              <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px,3vw,44px)', fontWeight: 300, color: INK }}>Platform Modules</h2>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(13,13,13,0.5)', maxWidth: 280, lineHeight: 1.6, textAlign: 'left' }}>
              Unified pipelines for casting, pitching, and secure coordination.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {FEATURES.map((f, i) => (
              <div key={i} className="py-10 md:py-10 pr-0 md:pr-0 border-b border-black/10 md:[&:nth-last-child(-n+2)]:border-b-0 md:odd:border-r md:odd:pr-12 md:even:pl-12 last:border-b-0">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: ORANGE, marginTop: 3 }}>[ {f.n} ]</span>
                  <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: INK, lineHeight: 1.2 }}>{f.title}</h3>
                </div>
                <p style={{ fontSize: 14, color: 'rgba(13,13,13,0.58)', lineHeight: 1.7, paddingLeft: 32 }}>{f.desc}</p>
                <div style={{ paddingLeft: 32, marginTop: 16 }}>
                  <Link to="/features" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: ORANGE, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Learn More <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── ACCOUNT TIER SUMMARY ────────────── */}
      <Reveal>
        <section className="max-w-[1440px] mx-auto px-6 md:px-12 pb-16 md:pb-24">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48, paddingBottom: 32, borderBottom: '1px solid rgba(13,13,13,0.1)' }}>
            <div>
              <Slug text="INT. Gateway Controls — Membership" />
              <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px,3vw,44px)', fontWeight: 300, color: INK }}>Account Tiers</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { type: 'Fan Account', desc: 'Designed for enthusiasts and fans.', access: 'View-only access to public feeds and discussions.', restrictions: 'Cannot post jobs, rent equipment, pitch stories, or message professionals.' },
              { type: 'Creator Pro', desc: 'For individual filmmakers and creators.', access: 'Full access to the creator network, project spaces, job board, and marketplace.', restrictions: 'Standard platform fees apply.' },
              { type: 'Studio / Company', desc: 'For production houses and agencies.', access: 'Everything in Pro, plus Company Pages and multi-user project management.', restrictions: 'Requires official business verification.' }
            ].map((acc, i) => (
              <div key={i} style={{ padding: '32px', border: '1px solid rgba(13,13,13,0.1)', borderRadius: 4 }}>
                <h3 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: INK, marginBottom: 8 }}>{acc.type}</h3>
                <p style={{ fontSize: 13, color: 'rgba(13,13,13,0.6)', marginBottom: 20 }}>{acc.desc}</p>
                <div style={{ marginBottom: 16 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ORANGE, display: 'block', marginBottom: 6 }}>Access</span>
                  <p style={{ fontSize: 13, color: 'rgba(13,13,13,0.7)', lineHeight: 1.5 }}>{acc.access}</p>
                </div>
                <div>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.4)', display: 'block', marginBottom: 6 }}>Restrictions</span>
                  <p style={{ fontSize: 13, color: 'rgba(13,13,13,0.5)', lineHeight: 1.5 }}>{acc.restrictions}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ── DARK CTA ────────────────────────── */}
      <Reveal>
        <section style={{ background: INK, color: CREAM, padding: '100px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* Ghost watermark */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: '28vw', fontWeight: 900, color: 'rgba(248,245,240,0.025)', pointerEvents: 'none', userSelect: 'none', letterSpacing: '-0.05em' }}>
            CUT.
          </div>
          {/* Top accent line */}
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.4), transparent)' }} />

          <div style={{ position: 'relative', maxWidth: 680, margin: '0 auto' }}>
            <Slug text="EXT. The Next Scene — Night" />
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(36px,5vw,64px)', fontWeight: 300, color: CREAM, lineHeight: 1.15, marginBottom: 24 }}>
              Ready to frame your next production?
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(248,245,240,0.5)', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7 }}>
              Create your crew account, set up cryptographic backup keys, and start collaborating on a beautiful, distraction-free film network.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
              <Link to="/register">
                <button style={{ background: ORANGE, color: CREAM, fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', padding: '15px 32px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.25s', borderRadius: 4 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#ea6c10')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = ORANGE)}
                >
                  Join Community <ArrowRight size={14} />
                </button>
              </Link>
              <Link to="/auth">
                <button style={{ background: 'transparent', color: 'rgba(248,245,240,0.6)', fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(248,245,240,0.15)', padding: '14px 32px', cursor: 'pointer', transition: 'all 0.25s', borderRadius: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,245,240,0.4)'; (e.currentTarget as HTMLButtonElement).style.color = CREAM; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,245,240,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(248,245,240,0.6)'; }}
                >
                  Sign In
                </button>
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      <Footer />
    </div>
  );
};

export default Index;
