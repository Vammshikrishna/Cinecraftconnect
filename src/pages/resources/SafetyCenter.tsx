import { ShieldCheck, Lock, EyeOff, UserCheck, Smartphone, ShieldAlert, Key, AlertCircle } from 'lucide-react';
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

const SafetyCenter = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Safety Center — CineCraft Connect" description="Security best practices, account protection, and how to report suspicious activity on CineCraft Connect." />
      <FilmGrain />
      <main className="max-w-[1440px] mx-auto px-6 md:px-12 pt-32 md:pt-40 pb-16 md:pb-24">

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.22,1,0.36,1] }}>
          <Slug text="INT. Security Operations — Trust & Safety" />
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:32 }}>
            <div style={{ width:48, height:48, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <ShieldCheck size={20} style={{ color:ORANGE }} />
            </div>
            <div>
              <h1 style={{ fontFamily:SERIF, fontSize:'clamp(36px,5vw,60px)', fontWeight:300, color:INK, lineHeight:1.1 }}>Safety Center</h1>
              <p style={{ fontFamily:MONO, fontSize:10, color:'rgba(13,13,13,0.3)', letterSpacing:'0.18em', textTransform:'uppercase', marginTop:6 }}>Last Updated // {lastUpdated.toUpperCase()}</p>
            </div>
          </div>
          <p style={{ fontSize:16, color:'rgba(13,13,13,0.6)', maxWidth:600, lineHeight:1.75, marginBottom:60, paddingBottom:48, borderBottom:'1px solid rgba(13,13,13,0.1)' }}>
            CineCraft Connect employs enterprise-grade security protocols to ensure your data, projects, and transactions remain protected at all times.
          </p>
        </motion.div>

        {/* Security pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-0">
          {[
            { icon:Lock,      title:'Data Encryption',   desc:'All personal data and private project files are encrypted at rest and in transit using AES-256.' },
            { icon:EyeOff,    title:'Privacy Controls',  desc:'Granular controls allow you to choose who sees your portfolio, credits, and contact info.' },
            { icon:UserCheck, title:'Verified Profiles', desc:'Look for the checkmark to identify verified professionals and equipment vendors.' },
          ].map((c,i) => (
            <div key={i} style={{ padding:'32px 28px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4 }}>
              <div style={{ width:36, height:36, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                <c.icon size={16} style={{ color:ORANGE }} />
              </div>
              <div style={{ fontFamily:SERIF, fontSize:18, color:INK, marginBottom:10 }}>{c.title}</div>
              <p style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{c.desc}</p>
            </div>
          ))}
        </div>

        <Sec num="01" Icon={Smartphone} title="Securing Your Account" tag="Best Practices // Steps">
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { n:1, title:'Use a Strong Password', desc:'Always use a unique password for CineCraft. We recommend a password manager to generate and store complex credentials — never reuse passwords across services.' },
              { n:2, title:'Back Up Your E2EE Keys', desc:'Your encryption keys are generated on-device. Set up your backup passphrase in Settings → Security → Key Backup so you can recover access if you lose your device.' },
              { n:3, title:'Verify Marketplace Listings', desc:'Before renting equipment, check the vendor\'s ratings and verification status. Use internal messaging for all project coordination — never move off-platform.' },
              { n:4, title:'Review Active Sessions', desc:'Periodically review your active sessions in Settings → Security → Sessions and revoke any devices you don\'t recognise.' },
            ].map((step,i) => (
              <div key={i} style={{ display:'flex', gap:20, padding:'20px 22px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'rgba(249,115,22,0.08)', border:`1px solid rgba(249,115,22,0.2)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontFamily:MONO, fontSize:13, fontWeight:700, color:ORANGE }}>{step.n}</span>
                </div>
                <div>
                  <div style={{ fontFamily:SERIF, fontSize:16, color:INK, marginBottom:6 }}>{step.title}</div>
                  <p style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec num="02" Icon={Key} title="E2EE Explained" tag="Technical // Encryption">
          <p style={{ marginBottom:16 }}>End-to-end encryption (E2EE) means that messages and project files are encrypted on your device before they leave it. Only the intended recipient, with their private key, can decrypt and read the content.</p>
          <p style={{ marginBottom:16 }}>CineCraft's servers never have access to your decryption keys. Even in the event of a server breach, your private messages remain unreadable to any third party.</p>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'rgba(13,13,13,0.55)' }}>
            <strong style={{ fontFamily:SERIF, color:INK }}>Note:</strong> E2EE only applies to Direct Messages and Project Channels. Community Discussion Rooms use server-side encryption.
          </div>
        </Sec>

        {/* Emergency callout */}
        <div style={{ marginTop:56, padding:'32px 36px', border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.04)', borderRadius:4 }}>
          <h4 style={{ fontFamily:SERIF, color:'#ef4444', fontWeight:400, fontSize:18, marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <ShieldAlert size={16} style={{ color:'#ef4444' }} /> Reporting Suspicious Activity
          </h4>
          <p style={{ fontSize:13, color:'rgba(13,13,13,0.55)', lineHeight:1.7, marginBottom:16 }}>
            If you believe your account has been compromised or you encounter fraudulent activity, contact our Security Operations Center (SOC) immediately.
          </p>
          <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'#ef4444', padding:'12px 16px', border:'1px solid rgba(239,68,68,0.2)', borderRadius:4, display:'inline-block' }}>
            Emergency: security@cinecraftconnect.com
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SafetyCenter;
