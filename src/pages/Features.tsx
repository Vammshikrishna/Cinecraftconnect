import { useRef, useEffect, useState } from 'react';
import { useScroll, useInView, motion } from 'framer-motion';
import { ShoppingBag, Briefcase, Zap, Globe, Lock, CheckCircle2, Users, Film, Home, MessageSquare, Star, Megaphone, Shield, Building2, Store } from 'lucide-react';
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

const CREAM = '#F8F5F0';
const INK   = '#0D0D0D';
const ORANGE = '#f97316';
const SERIF = "'Lora', Georgia, serif";
const MONO  = "'Inconsolata', 'Courier New', monospace";
const SANS  = "'Work Sans', system-ui, sans-serif";

const FilmGrain = () => (
  <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 998, pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '220px', opacity: 0.025, mixBlendMode: 'multiply' }} />
);

const Slug = ({ text }: { text: string }) => (
  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.35)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ORANGE, display: 'inline-block' }} />
    {text}
  </div>
);

const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>
  );
};

const features = [
  { num:'01', id:'feed',        title:'Community Feed',        icon: Home,        description:'Your personalized stream of industry updates, behind-the-scenes content, and creative inspiration from films, TV, YouTube, and every format.', details:['Photo & Video Posts','Industry News','Behind The Scenes','Creator Spotlights'] },
  { num:'02', id:'network',     title:'Creator Network',       icon: Users,       description:'Discover and connect with professionals across every discipline — film directors, TV producers, YouTubers, brand filmmakers, podcast creators, and more.', details:['Smart Matching','Craft Filters','Mutual Connections','Portfolio Previews'] },
  { num:'03', id:'projects',    title:'Project Management',    icon: Film,        description:'Organize any production from concept to delivery. Track scenes, manage assets, and collaborate with your crew in real-time — whether it is a feature film or a Reels campaign.', details:['Scene Tracking','Asset Library','Crew Roles','Production Timeline'] },
  { num:'04', id:'marketplace', title:'Equipment Marketplace', icon: ShoppingBag, description:'Rent and list professional gear from verified creators and studios. Cinema cameras, lenses, drones, lighting rigs, audio equipment, and studio spaces.', details:['Verified Listings','Secure Payments','Insurance Options','Local Pickups'] },
  { num:'05', id:'jobs',        title:'Job Board',             icon: Briefcase,   description:'The most active job board across the entertainment industry. Film, TV, OTT, YouTube, ad films, brand content, music videos, podcast productions, and more.', details:['All Formats','Portfolio Integration','Direct Messaging','Verified Employers'] },
  { num:'06', id:'discussions', title:'Discussion Rooms',      icon: MessageSquare,description:'Craft-specific communities for every corner of entertainment — cinematography, editing, sound, production design, digital content, advertising, and live events.', details:['Spatial Audio','Screen Sharing','Whiteboarding','Room Categories'] },
  { num:'07', id:'companies',   title:'Company Pages',         icon: Building2,   description:'Dedicated profiles for studios, agencies, and production houses. Showcase your portfolio, list job openings, and manage your team in one centralized space.', details:['Team Roster','Verified Jobs','Studio Portfolio','Brand Assets'] },
  { num:'08', id:'vendors',     title:'Verified Vendors',      icon: Store,       description:'Find trusted service providers for your next production. From catering and transport to specialized VFX houses and legal counsel.', details:['Service Listings','Direct Booking','Location Filters','Vendor Badges'] },
  { num:'09', id:'ratings',     title:'Ratings & Reviews',     icon: Star,        description:'Build professional credibility with our transparent rating system. Review collaborators, equipment renters, and vendors after successful project completion.', details:['Verified Reviews','Project-tied Feedback','Dispute Resolution','Trust Scores'] },
  { num:'10', id:'announcements',title:'Industry Announcements',icon: Megaphone,   description:'Broadcast major updates to your network. Share festival selections, project wraps, casting calls, and release dates with high-visibility announcement posts.', details:['Push Notifications','Custom Banners','Analytics','Targeted Reach'] },
];

const accountTypes = [
  { type: 'Fan Account', desc: 'Designed for enthusiasts and fans.', access: 'View-only access to public feeds, announcements, and discussions.', restrictions: 'Cannot post jobs, rent equipment, pitch stories, or directly message industry professionals.', icon: Users },
  { type: 'Creator Pro', desc: 'For individual filmmakers and creators.', access: 'Full access to the creator network, project spaces, job board, pitching, and marketplace.', restrictions: 'Standard platform fees apply to equipment rentals and job promotions.', icon: Shield },
  { type: 'Studio / Company', desc: 'For production houses and agencies.', access: 'Everything in Pro, plus Company Pages, multi-user project management, and verified job postings.', restrictions: 'Requires official business verification and approval process.', icon: Building2 }
];

const specs = [
  { num:'01', title:'Global Network',   icon: Globe,         desc:'Connect with professionals worldwide.' },
  { num:'02', title:'Secure Workflow',  icon: Lock,          desc:'Your data and assets are encrypted.' },
  { num:'03', title:'Instant Updates',  icon: Zap,           desc:'Real-time sync across all devices.' },
  { num:'04', title:'Pro Verification', icon: CheckCircle2,  desc:'Build trust with verified badges.' },
];

const Features = () => {
  return (
    <div style={{ background: CREAM, color: INK, fontFamily: SANS, overflowX: 'hidden' }}>
      <SEO title="Features — CineCraft Connect" description="Explore tools for the entire entertainment industry — film, TV, YouTube, ad films, podcasts. Crew discovery, project management, job board, and equipment marketplace." />
      <FilmGrain />
      <main className="pt-24 md:pt-36 pb-12 md:pb-20">
        {/* Hero */}
        <motion.section initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.22,1,0.36,1] }} className="max-w-[1440px] mx-auto px-6 md:px-12 pb-12 md:pb-20 text-center">
          <Slug text="EXT. Platform Specs — For All Entertainment" />
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(40px,6vw,72px)', fontWeight: 300, color: INK, lineHeight: 1.1, marginBottom: 24, letterSpacing: '-0.01em' }}>
            Every tool your production needs.<br /><em style={{ fontStyle:'italic', color:'rgba(13,13,13,0.5)' }}>Whatever format you create in.</em>
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(13,13,13,0.6)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
            Film, TV, YouTube, Instagram, ad campaigns, music videos, podcasts — CineCraft Connect is built for every creator in the entertainment industry.
          </p>
        </motion.section>

        {/* Divider */}
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          <div style={{ height: 1, background: 'rgba(13,13,13,0.1)' }} />
        </div>

        {/* Features */}
        <section className="max-w-[1440px] mx-auto px-6 md:px-12">
          {features.map((f, i) => (
            <Reveal key={i} delay={0.04 * i}>
              <div id={f.id} className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 md:gap-16 py-10 md:py-14 border-b border-black/10">
                {/* Left */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: ORANGE, marginTop: 4 }}>[ {f.num} ]</span>
                  <div>
                    <div style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid rgba(249,115,22,0.3)`, background: 'rgba(249,115,22,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                      <f.icon size={16} style={{ color: ORANGE }} />
                    </div>
                    <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: INK, marginBottom: 6, lineHeight: 1.2 }}>{f.title}</h2>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(13,13,13,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>MODULE // {f.num}</span>
                  </div>
                </div>
                {/* Right */}
                <div>
                  <p style={{ fontSize: 15, color: 'rgba(13,13,13,0.62)', lineHeight: 1.75, marginBottom: 24 }}>{f.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {f.details.map((d, j) => (
                      <span key={j} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '6px 12px', border: '1px solid rgba(13,13,13,0.12)', color: 'rgba(13,13,13,0.5)', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: ORANGE }} />
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </section>

        {/* Account Types */}
        <Reveal>
          <section className="max-w-[1440px] mx-auto px-6 md:px-12 pt-16 md:pt-20">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, paddingBottom: 32, borderBottom: '1px solid rgba(13,13,13,0.1)' }}>
              <div>
                <Slug text="EXT. Access Control — Account Types" />
                <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(32px,4vw,52px)', fontWeight: 300, color: INK, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                  Choose your<br /><em style={{ fontStyle: 'italic', color: 'rgba(13,13,13,0.5)' }}>access level.</em>
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {accountTypes.map((acc, i) => (
                <div key={i} style={{ padding: '40px 32px', border: '1px solid rgba(13,13,13,0.1)', borderRadius: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, border: `1px solid rgba(249,115,22,0.3)`, background: 'rgba(249,115,22,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                    <acc.icon size={20} style={{ color: ORANGE }} />
                  </div>
                  <h3 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 400, color: INK, marginBottom: 8 }}>{acc.type}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(13,13,13,0.5)', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid rgba(13,13,13,0.08)' }}>{acc.desc}</p>
                  
                  <div style={{ marginBottom: 20 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: ORANGE, display: 'block', marginBottom: 8 }}>Access</span>
                    <p style={{ fontSize: 14, color: 'rgba(13,13,13,0.7)', lineHeight: 1.6 }}>{acc.access}</p>
                  </div>
                  
                  <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(13,13,13,0.4)', display: 'block', marginBottom: 8 }}>Restrictions</span>
                    <p style={{ fontSize: 14, color: 'rgba(13,13,13,0.5)', lineHeight: 1.6 }}>{acc.restrictions}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* System specs */}
        <Reveal>
          <section className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-20">
            <Slug text="INT. Platform NOC — Telemetry & Security" />
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px,3vw,42px)', fontWeight: 300, color: INK, marginBottom: 48 }}>System Specifications</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[1px]" style={{ background: 'rgba(13,13,13,0.1)', border: '1px solid rgba(13,13,13,0.1)' }}>
              {specs.map((s, i) => (
                <div key={i} style={{ background: CREAM, padding: '40px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(13,13,13,0.25)' }}>[ {s.num} ]</span>
                    <div style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid rgba(249,115,22,0.3)`, background: 'rgba(249,115,22,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <s.icon size={14} style={{ color: ORANGE }} />
                    </div>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 400, color: INK, marginBottom: 6 }}>{s.title}</h3>
                    <p style={{ fontSize: 13, color: 'rgba(13,13,13,0.5)', lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
};

export default Features;
