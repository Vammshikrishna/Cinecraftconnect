import { useRef } from 'react';
import { Users, Globe, Target, Film, Heart, Lightbulb } from "lucide-react";
import { useInView, motion } from 'framer-motion';
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

const CREAM  = '#F8F5F0';
const INK    = '#0D0D0D';
const ORANGE = '#f97316';
const SERIF  = "'Lora', Georgia, serif";
const MONO   = "'Inconsolata', 'Courier New', monospace";
const SANS   = "'Work Sans', system-ui, sans-serif";

const FilmGrain = () => (
  <div aria-hidden style={{ position:'fixed', inset:0, zIndex:998, pointerEvents:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat:'repeat', backgroundSize:'220px', opacity:0.025, mixBlendMode:'multiply' }} />
);
const Slug = ({ text }: { text: string }) => (
  <div style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:'rgba(13,13,13,0.35)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
    <span style={{ width:6, height:6, borderRadius:'50%', background:ORANGE, display:'inline-block' }} />
    {text}
  </div>
);
const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return <motion.div ref={ref} initial={{ opacity:0, y:32 }} animate={inView ? { opacity:1, y:0 } : {}} transition={{ duration:0.65, delay, ease:[0.22,1,0.36,1] }}>{children}</motion.div>;
};

const values = [
  { num:'01', title:'Community First',   icon:Users,    desc:'We believe the best work happens when creators support one another. Our platform fosters genuine, un-gamified professional connections.' },
  { num:'02', title:'Security & Privacy',icon:Target,   desc:'Every pitch, conversation, and project space is protected. We enforce E2EE encryption to ensure your creative property remains strictly yours.' },
  { num:'03', title:'Creative Freedom',  icon:Heart,    desc:'No algorithm decides what you see or who hires you. Your craft speaks for itself, free from vanity metrics.' },
  { num:'04', title:'Borderless Cinema', icon:Globe,    desc:'From Mumbai to Los Angeles, CineCraft bridges creative communities across continents without barriers.' },
  { num:'05', title:'Innovation Led',    icon:Lightbulb,desc:'Constant iteration guided by filmmaker feedback — not investor dashboards. We build what the industry actually needs.' },
  { num:'06', title:'Story First',       icon:Film,     desc:'Every feature decision starts with one question: does this help a filmmaker tell a better story?' },
];

const About = () => {
  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="About Us — CineCraft Connect" description="Learn about the mission, values, and origin story of CineCraft Connect, the professional network for the entire entertainment industry." />
      <FilmGrain />

      <main className="pt-24 md:pt-36">
        {/* Hero */}
        <motion.section initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.22,1,0.36,1] }} className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 md:py-20">
          <Slug text="EXT. Production Office — Entertainment Industry" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-end">
            <div>
              <h1 style={{ fontFamily:SERIF, fontSize:'clamp(44px,7vw,80px)', fontWeight:300, color:INK, lineHeight:1.08, letterSpacing:'-0.02em' }}>
                Empowering<br />every creator<br /><em style={{ color:'rgba(13,13,13,0.45)', fontStyle:'italic' }}>in entertainment.</em>
              </h1>
            </div>
            <div style={{ paddingBottom:8 }}>
              <p style={{ fontSize:17, color:'rgba(13,13,13,0.62)', lineHeight:1.75, marginBottom:20 }}>
                CineCraft Connect was born from a simple observation: the entertainment industry is built on collaboration, yet the tools we use are fragmented.
              </p>
              <p style={{ fontSize:15, color:'rgba(13,13,13,0.5)', lineHeight:1.7 }}>
                Whether you make feature films, TV shows, YouTube content, Instagram campaigns, ad films, or podcasts — we exist to restore clarity, connection, and security to your creative pipeline.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Ink rule */}
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          <div style={{ height:1, background:'rgba(13,13,13,0.12)' }} />
        </div>

        {/* Values */}
        <Reveal>
          <section className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-20">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:56 }}>
              <div>
                <Slug text="INT. Writers Room — Specs & Values" />
                <h2 style={{ fontFamily:SERIF, fontSize:'clamp(28px,3vw,44px)', fontWeight:300, color:INK }}>Our Core Principles</h2>
              </div>
              <p className="hidden md:block" style={{ fontSize:13, color:'rgba(13,13,13,0.4)', maxWidth:240, textAlign:'right', lineHeight:1.6 }}>
                Six convictions that guide every product decision.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px]" style={{ background: 'rgba(13,13,13,0.1)', border:'1px solid rgba(13,13,13,0.1)' }}>
              {values.map((v, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div style={{
                    background: CREAM,
                    padding:'44px 36px',
                    transition:'background 0.25s',
                    height: '100%'
                  }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.03)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = CREAM)}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                      <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:ORANGE }}>[ {v.num} ]</span>
                      <v.icon size={18} style={{ color:'rgba(13,13,13,0.25)' }} />
                    </div>
                    <h3 style={{ fontFamily:SERIF, fontSize:22, fontWeight:400, color:INK, marginBottom:12, lineHeight:1.2 }}>{v.title}</h3>
                    <p style={{ fontSize:14, color:'rgba(13,13,13,0.55)', lineHeight:1.7 }}>{v.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Origin story */}
        <div style={{ background:INK, color:CREAM }}>
          <Reveal>
            <section className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-start">
              <div>
                <Slug text="INT. Developer Lab — Backstage Logs" />
                <h2 style={{ fontFamily:SERIF, fontSize:'clamp(28px,3vw,44px)', fontWeight:300, color:CREAM, lineHeight:1.25, marginBottom:20 }}>
                  The Story Behind CineCraft
                </h2>
                <div style={{ fontFamily:MONO, fontSize:10, color:'rgba(248,245,240,0.25)', letterSpacing:'0.15em', textTransform:'uppercase' }}>
                  [ Archive: ORIGIN_LOG.TXT ]
                </div>
              </div>
              <div style={{ fontSize:15, color:'rgba(248,245,240,0.6)', lineHeight:1.8 }}>
                <p style={{ marginBottom:20 }}>Founded by a team of creators and software developers, CineCraft Connect was built to solve the real-world problems we faced while making content — across films, TV, YouTube, ad campaigns, and digital media.</p>
                <p style={{ marginBottom:20 }}>After years of using fragmented tools — spreadsheets for casting, WhatsApp for coordination, email chains for script feedback — we decided to build the platform we always wished existed.</p>
                <p>Today, CineCraft Connect is open for its first users. Join us at launch and help shape the platform for the entire entertainment community.</p>
              </div>
            </section>
          </Reveal>


        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
