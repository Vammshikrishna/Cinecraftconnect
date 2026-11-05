import { Cookie, ShieldCheck, Info, Settings, ToggleLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useScroll } from 'framer-motion';
import { DocHeader, DocSec as Sec } from "@/components/landing/DocParts";
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

const CREAM = 'hsl(var(--background))'; const INK = 'hsl(var(--foreground))'; const ORANGE = '#FF4B33'; const ORANGE_INK = 'hsl(var(--primary))';
const SERIF = "'Lora', Georgia, serif"; const MONO = "'Inconsolata', 'Courier New', monospace"; const SANS = "'Work Sans', system-ui, sans-serif";


const COOKIE_TYPES = [
  { type:'Essential Cookies',  required:true,  desc:'Required to maintain your encrypted session. Stores JWT auth tokens to verify API access. Cannot be disabled.' },
  { type:'Functional Cookies', required:false, desc:'Configure interface aesthetics, keeping forced-light parameters active across logins, and caching showreel lists.' },
  { type:'Analytical Cookies', required:false, desc:'Optionally calculate anonymous server load metrics, tracking peak casting schedules to prevent latency spikes.' },
];

const CookiePolicy = ({ embedded = false }: { embedded?: boolean }) => {
  const lastUpdated = "April 17, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden', ...(embedded ? { borderRadius:16, border:'1px solid hsl(var(--border))' } : {}) }}>
      {!embedded && <SEO title="Cookie Policy — CineCraft Connect" description="Learn how and why CineCraft Connect uses cookies to provide a functional and secure creator workspace." />}
      <main className={embedded ? 'px-5 md:px-8 pt-6 pb-6' : 'max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-36 pb-16 md:pb-24'}>

        <DocHeader Icon={Cookie} label="Legal" title="Cookie Policy" meta={<>Last updated {lastUpdated}</>} intro={<>This policy explains what cookies are, how we use them, and how you can control them when using CineCraft Connect.</>} embedded={embedded} />

        <Sec num="01" Icon={Cookie} title="What Are Cookies?" tag="Definition // Storage Spec">
          <p>Cookies are small data blocks downloaded onto your device's browser memory when visiting websites. They allow the host application to maintain session consistency, secure private workspaces, and store interface theme configurations.</p>
        </Sec>

        <Sec num="02" Icon={ShieldCheck} title="How We Use Cookies" tag="Policies // Disclosures">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {COOKIE_TYPES.map((c,i) => (
              <div key={i} style={{ display:'flex', gap:20, padding:'20px 22px', border:'1px solid hsl(var(--border))', borderRadius:4 }}>
                <div>
                  <span style={{ fontSize:13, fontWeight:600, padding:'3px 10px', borderRadius:999, background: c.required ? 'rgba(255,75,51,0.1)' : 'hsl(var(--muted))', color: c.required ? ORANGE_INK : 'hsl(var(--foreground) / 0.8)', display:'inline-block', marginBottom:10 }}>
                    {c.required ? 'Required' : 'Optional'}
                  </span>
                  <div style={{ fontFamily:SERIF, fontSize:16, color:INK, marginBottom:6 }}>{c.type}</div>
                  <div style={{ fontSize:13, color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec num="03" Icon={Settings} title="Controlling Cookies" tag="User Control // Instructions">
          <p style={{ marginBottom:20 }}>Most browser settings allow you to block, audit, or purge local cookies. Doing so will invalidate cached authentication state and log you out of protected workspaces.</p>
          <a href="https://allaboutcookies.org" target="_blank" rel="noopener noreferrer" style={{ fontSize:15, fontWeight:600, color:ORANGE_INK, textDecoration:'underline', textUnderlineOffset:4, display:'inline-flex', alignItems:'center', gap:6 }}>
            More About Cookies <Info size={12} />
          </a>
        </Sec>

        <Sec num="04" Icon={ToggleLeft} title="Cookie Preferences" tag="Consent // Opt-Out">
          <p style={{ marginBottom:16 }}>You can manage your cookie preferences at any time through our Cookie Consent Banner, accessible from the settings menu. Withdrawing consent for optional cookies will not affect core functionality.</p>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'hsl(var(--muted-foreground))', fontStyle:'italic' }}>
            Essential cookies cannot be disabled as they are required for the platform to function securely.
          </div>
        </Sec>
      </main>
      {!embedded && <Footer />}
    </div>
  );
};

export default CookiePolicy;
