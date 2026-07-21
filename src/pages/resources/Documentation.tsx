import { BookOpen, HelpCircle, Code, Rocket, Users, ShieldCheck, MessageSquare, ShoppingBag } from 'lucide-react';
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

const DocCard = ({ icon: Icon, title, desc }: { icon:any; title:string; desc:string }) => (
  <div style={{ padding:'22px 24px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4, display:'flex', gap:16 }}>
    <div style={{ width:34, height:34, borderRadius:6, border:`1px solid rgba(249,115,22,0.25)`, background:'rgba(249,115,22,0.05)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <Icon size={15} style={{ color:ORANGE }} />
    </div>
    <div>
      <div style={{ fontFamily:SERIF, fontSize:15, color:INK, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{desc}</div>
    </div>
  </div>
);

const Documentation = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Documentation — CineCraft Connect" description="Comprehensive guides covering portfolios, marketplace listings, project spaces, and discussion rooms." />
      <FilmGrain />
      <main className="max-w-[1440px] mx-auto px-6 md:px-12 pt-32 md:pt-40 pb-16 md:pb-24">

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.22,1,0.36,1] }}>
          <Slug text="EXT. User Guide — Comprehensive Documentation" />
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:32 }}>
            <div style={{ width:48, height:48, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <BookOpen size={20} style={{ color:ORANGE }} />
            </div>
            <div>
              <h1 style={{ fontFamily:SERIF, fontSize:'clamp(36px,5vw,60px)', fontWeight:300, color:INK, lineHeight:1.1 }}>Documentation</h1>
              <p style={{ fontFamily:MONO, fontSize:10, color:'rgba(13,13,13,0.3)', letterSpacing:'0.18em', textTransform:'uppercase', marginTop:6 }}>Last Updated // {lastUpdated.toUpperCase()}</p>
            </div>
          </div>
          <p style={{ fontSize:16, color:'rgba(13,13,13,0.6)', maxWidth:600, lineHeight:1.75, marginBottom:60, paddingBottom:48, borderBottom:'1px solid rgba(13,13,13,0.1)' }}>
            CineCraft Connect is designed to simplify every aspect of entertainment production. Whether you're a creator looking for talent or a vendor offering equipment, our tools are built for your workflow.
          </p>
        </motion.div>

        <Sec num="01" Icon={Rocket} title="Getting Started" tag="Onboarding // System Access">
          <p style={{ marginBottom:20 }}>Getting started takes under 3 minutes. Create your account, complete your craft profile, and you'll immediately appear in crew discovery searches.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DocCard icon={Users} title="Creator Network" desc="Build your professional portfolio, connect with peers, and showcase your filmography to the industry." />
            <DocCard icon={Code} title="Project Spaces" desc="Collaborate in real-time with your crew. Manage scripts, boards, and schedules in one unified workspace." />
            <DocCard icon={ShoppingBag} title="Marketplace" desc="Rent and list professional cinema gear. ARRI, RED, vintage glass, and production equipment." />
            <DocCard icon={MessageSquare} title="Discussion Rooms" desc="Join craft-specific communities. Engage in deep industry discussions with verified professionals." />
          </div>
        </Sec>

        <Sec num="02" Icon={HelpCircle} title="Feature Overviews" tag="Reference // Module Spec">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { title:'1. Professional Portfolios', desc:'Your profile is your digital resume. High-fidelity video embeds, credit lists, and gear lists allow you to stand out to casting directors and recruiters worldwide.' },
              { title:'2. Marketplace & Vendors', desc:'Rent high-end equipment or secure film locations through our verified marketplace. Vendors can manage inventory and bookings seamlessly from a single dashboard.' },
              { title:'3. Discussion Rooms', desc:'Join craft-specific communities. From Cinematography to Post-Production, engage in deep industry discussions with verified professionals in your field.' },
              { title:'4. E2EE Project Channels', desc:'Every project space uses end-to-end encryption. Share scripts, shot lists, and schedules knowing only your crew can read them.' },
            ].map((item,i) => (
              <div key={i} style={{ padding:'20px 22px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4 }}>
                <div style={{ fontFamily:SERIF, fontSize:16, color:INK, marginBottom:6 }}>{item.title}</div>
                <div style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec num="03" Icon={ShieldCheck} title="Security & Encryption" tag="Technical // E2EE Spec">
          <p style={{ marginBottom:16 }}>CineCraft Connect uses local client-side encryption for all project communications. Your cryptographic keys are generated on-device and never leave your hardware in plain text.</p>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'rgba(13,13,13,0.55)' }}>
            <strong style={{ fontFamily:SERIF, color:INK }}>Key Backup:</strong> Set up your E2EE backup passphrase in Settings → Security → Key Backup. Without this, encrypted messages are unrecoverable if you lose device access.
          </div>
        </Sec>

        <div style={{ marginTop:56, padding:'32px 36px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4 }}>
          <h4 style={{ fontFamily:SERIF, color:ORANGE, fontWeight:400, fontSize:18, marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <ShieldCheck size={16} style={{ color:ORANGE }} /> Need Technical Help?
          </h4>
          <p style={{ fontSize:13, color:'rgba(13,13,13,0.55)', lineHeight:1.7 }}>
            If you encounter bugs or need technical guidance, our engineering team is available 24/7. Contact us at <strong>support@cinecraftconnect.com</strong> or visit the Support Hub from within the app.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Documentation;
