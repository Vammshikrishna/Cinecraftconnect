import { BookOpen, HelpCircle, Code, Rocket, Users, ShieldCheck, MessageSquare, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useScroll } from 'framer-motion';
import { DocHeader, DocSec as Sec } from "@/components/landing/DocParts";
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

const CREAM = 'hsl(var(--background))'; const INK = 'hsl(var(--foreground))'; const ORANGE = '#FF4B33'; const ORANGE_INK = 'hsl(var(--primary))';
const SERIF = "'Lora', Georgia, serif"; const MONO = "'Inconsolata', 'Courier New', monospace"; const SANS = "'Work Sans', system-ui, sans-serif";


const DocCard = ({ icon: Icon, title, desc }: { icon:any; title:string; desc:string }) => (
  <div style={{ padding:'22px 24px', border:'1px solid hsl(var(--border))', borderRadius:4, display:'flex', gap:16 }}>
    <div style={{ width:34, height:34, borderRadius:6, border:`1px solid rgba(249,115,22,0.25)`, background:'rgba(249,115,22,0.05)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <Icon size={15} style={{ color:ORANGE }} />
    </div>
    <div>
      <div style={{ fontFamily:SERIF, fontSize:15, color:INK, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{desc}</div>
    </div>
  </div>
);

const Documentation = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Documentation — CineCraft Connect" description="Comprehensive guides covering portfolios, marketplace listings, project spaces, and discussion rooms." />
      <main className="max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-36 pb-16 md:pb-24">

        <DocHeader Icon={BookOpen} label="Resources" title="Documentation" meta={<>Last updated {lastUpdated}</>} intro={<>CineCraft Connect is designed to simplify every aspect of entertainment production. Whether you're a creator looking for talent or a vendor offering equipment, our tools are built for your workflow.</>} />

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
              { title:'4. E2EE Project Channels', desc:'Project-space chat messages are end-to-end encrypted so only your crew can read them. Files and attachments shared in a space are not end-to-end encrypted.' },
            ].map((item,i) => (
              <div key={i} style={{ padding:'20px 22px', border:'1px solid hsl(var(--border))', borderRadius:4 }}>
                <div style={{ fontFamily:SERIF, fontSize:16, color:INK, marginBottom:6 }}>{item.title}</div>
                <div style={{ fontSize:13, color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec num="03" Icon={ShieldCheck} title="Security & Encryption" tag="Technical // E2EE Spec">
          <p style={{ marginBottom:16 }}>CineCraft Connect uses local client-side encryption for direct messages and project-space chat text. Your cryptographic keys are generated on-device and never leave your hardware in plain text.</p>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'hsl(var(--muted-foreground))' }}>
            <strong style={{ fontFamily:SERIF, color:INK }}>Key Backup:</strong> Set up your E2EE backup passphrase in Settings → Security → Key Backup. Without this, encrypted messages are unrecoverable if you lose device access.
          </div>
        </Sec>

        <div style={{ marginTop:56, padding:'32px 36px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4 }}>
          <h4 style={{ fontFamily:SERIF, color:"hsl(var(--primary))", fontWeight:600, fontSize:20, marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <ShieldCheck size={16} style={{ color:ORANGE }} /> Need Technical Help?
          </h4>
          <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', lineHeight:1.7 }}>
            If you encounter bugs or need technical guidance, our engineering team is available 24/7. Contact us at <a href="mailto:support@cinecraftconnect.com" style={{ fontWeight:700, color:'inherit', textDecoration:'underline', textUnderlineOffset:3 }}>support@cinecraftconnect.com</a> or visit the Support Hub from within the app.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Documentation;
