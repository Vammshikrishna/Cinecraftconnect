import { Cookie, ShieldCheck, Info, Settings, ToggleLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useScroll } from 'framer-motion';
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

const CREAM = '#F8F5F0'; const INK = '#0D0D0D'; const ORANGE = '#f97316';
const SERIF = "'Lora', Georgia, serif"; const MONO = "'Inconsolata', 'Courier New', monospace"; const SANS = "'Work Sans', system-ui, sans-serif";

const FilmGrain = () => <div aria-hidden style={{ position:'fixed', inset:0, zIndex:998, pointerEvents:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat:'repeat', backgroundSize:'220px', opacity:0.025, mixBlendMode:'multiply' }} />;
const Slug = ({ text }: { text: string }) => <div style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:'0.22em', textTransform:'uppercase', color:'rgba(13,13,13,0.35)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}><span style={{ width:6, height:6, borderRadius:'50%', background:ORANGE, display:'inline-block' }} />{text}</div>;

const Sec = ({ num, Icon, title, tag, children }: { num:string; Icon:any; title:string; tag:string; children:React.ReactNode }) => (
  <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8 md:gap-16 py-10 md:py-14 border-b border-black/10">
    <div style={{ display:'flex', gap:14 }}>
      <span style={{ fontFamily:MONO, fontSize:12, fontWeight:700, color:ORANGE, marginTop:4 }}>[ {num} ]</span>
      <div>
        <div style={{ width:36, height:36, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
          <Icon size={16} style={{ color:ORANGE }} />
        </div>
        <h2 style={{ fontFamily:SERIF, fontSize:20, fontWeight:400, color:INK, marginBottom:6 }}>{title}</h2>
        <span style={{ fontFamily:MONO, fontSize:9, color:'rgba(13,13,13,0.3)', letterSpacing:'0.18em', textTransform:'uppercase' }}>{tag}</span>
      </div>
    </div>
    <div style={{ fontSize:15, color:'rgba(13,13,13,0.62)', lineHeight:1.8 }}>{children}</div>
  </div>
);

const COOKIE_TYPES = [
  { type:'Essential Cookies',  required:true,  desc:'Required to maintain your encrypted session. Stores JWT auth tokens to verify API access. Cannot be disabled.' },
  { type:'Functional Cookies', required:false, desc:'Configure interface aesthetics, keeping forced-light parameters active across logins, and caching showreel lists.' },
  { type:'Analytical Cookies', required:false, desc:'Optionally calculate anonymous server load metrics, tracking peak casting schedules to prevent latency spikes.' },
];

const CookiePolicy = () => {
  const lastUpdated = "April 17, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Cookie Policy — CineCraft Connect" description="Learn how and why CineCraft Connect uses cookies to provide a functional and secure creator workspace." />
      <FilmGrain />
      <main className="max-w-[1440px] mx-auto px-6 md:px-12 pt-32 md:pt-40 pb-16 md:pb-24">

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.22,1,0.36,1] }}>
          <Slug text="EXT. Legal Board — Cookie Manifest" />
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:32 }}>
            <div style={{ width:48, height:48, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Cookie size={20} style={{ color:ORANGE }} />
            </div>
            <div>
              <h1 style={{ fontFamily:SERIF, fontSize:'clamp(36px,5vw,60px)', fontWeight:300, color:INK, lineHeight:1.1 }}>Cookie Policy</h1>
              <p style={{ fontFamily:MONO, fontSize:10, color:'rgba(13,13,13,0.3)', letterSpacing:'0.18em', textTransform:'uppercase', marginTop:6 }}>Last Updated // {lastUpdated.toUpperCase()}</p>
            </div>
          </div>
          <p style={{ fontSize:16, color:'rgba(13,13,13,0.6)', maxWidth:600, lineHeight:1.75, marginBottom:60, paddingBottom:48, borderBottom:'1px solid rgba(13,13,13,0.1)' }}>
            This policy explains what cookies are, how we use them, and how you can control them when using CineCraft Connect.
          </p>
        </motion.div>

        <Sec num="01" Icon={Cookie} title="What Are Cookies?" tag="Definition // Storage Spec">
          <p>Cookies are small data blocks downloaded onto your device's browser memory when visiting websites. They allow the host application to maintain session consistency, secure private workspaces, and store interface theme configurations.</p>
        </Sec>

        <Sec num="02" Icon={ShieldCheck} title="How We Use Cookies" tag="Policies // Disclosures">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {COOKIE_TYPES.map((c,i) => (
              <div key={i} style={{ display:'flex', gap:20, padding:'20px 22px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4 }}>
                <div>
                  <span style={{ fontFamily:MONO, fontSize:9, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', padding:'3px 8px', borderRadius:3, background: c.required ? 'rgba(249,115,22,0.1)' : 'rgba(13,13,13,0.06)', color: c.required ? ORANGE : 'rgba(13,13,13,0.4)', border: c.required ? `1px solid rgba(249,115,22,0.3)` : '1px solid rgba(13,13,13,0.12)', display:'inline-block', marginBottom:10 }}>
                    {c.required ? 'Required' : 'Optional'}
                  </span>
                  <div style={{ fontFamily:SERIF, fontSize:16, color:INK, marginBottom:6 }}>{c.type}</div>
                  <div style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec num="03" Icon={Settings} title="Controlling Cookies" tag="User Control // Instructions">
          <p style={{ marginBottom:20 }}>Most browser settings allow you to block, audit, or purge local cookies. Doing so will invalidate cached authentication state and log you out of protected workspaces.</p>
          <a href="https://allaboutcookies.org" target="_blank" rel="noopener noreferrer" style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:'0.16em', textTransform:'uppercase', color:ORANGE, textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
            More About Cookies <Info size={12} />
          </a>
        </Sec>

        <Sec num="04" Icon={ToggleLeft} title="Cookie Preferences" tag="Consent // Opt-Out">
          <p style={{ marginBottom:16 }}>You can manage your cookie preferences at any time through our Cookie Consent Banner, accessible from the settings menu. Withdrawing consent for optional cookies will not affect core functionality.</p>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'rgba(13,13,13,0.55)', fontStyle:'italic' }}>
            Essential cookies cannot be disabled as they are required for the platform to function securely.
          </div>
        </Sec>
      </main>
      <Footer />
    </div>
  );
};

export default CookiePolicy;
