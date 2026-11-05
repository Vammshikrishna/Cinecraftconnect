import { ShieldCheck, Lock, EyeOff, UserCheck, Smartphone, ShieldAlert, Key, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useScroll } from 'framer-motion';
import { DocHeader, DocSec as Sec } from "@/components/landing/DocParts";
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

const CREAM = 'hsl(var(--background))'; const INK = 'hsl(var(--foreground))'; const ORANGE = '#FF4B33'; const ORANGE_INK = 'hsl(var(--primary))';
const SERIF = "'Lora', Georgia, serif"; const MONO = "'Inconsolata', 'Courier New', monospace"; const SANS = "'Work Sans', system-ui, sans-serif";


const SafetyCenter = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Safety Center — CineCraft Connect" description="Security best practices, account protection, and how to report suspicious activity on CineCraft Connect." />
      <main className="max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-36 pb-16 md:pb-24">

        <DocHeader Icon={ShieldCheck} label="Resources" title="Safety Center" meta={<>Last updated {lastUpdated}</>} intro={<>CineCraft Connect employs enterprise-grade security protocols to ensure your data, projects, and transactions remain protected at all times.</>} />

        {/* Security pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-0">
          {[
            { icon:Lock,      title:'Data Encryption',   desc:'Data is encrypted in transit (TLS) and encrypted at rest by our hosting provider. Direct messages and project-space chat are additionally end-to-end encrypted.' },
            { icon:EyeOff,    title:'Privacy Controls',  desc:'Granular controls allow you to choose who sees your portfolio, credits, and contact info.' },
            { icon:UserCheck, title:'Verified Profiles', desc:'Look for the checkmark to identify verified professionals and equipment vendors.' },
          ].map((c,i) => (
            <div key={i} style={{ padding:'32px 28px', border:'1px solid hsl(var(--border))', borderRadius:4 }}>
              <div style={{ width:36, height:36, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                <c.icon size={16} style={{ color:ORANGE }} />
              </div>
              <div style={{ fontFamily:SERIF, fontSize:18, color:INK, marginBottom:10 }}>{c.title}</div>
              <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{c.desc}</p>
            </div>
          ))}
        </div>

        <Sec num="01" Icon={Smartphone} title="Securing Your Account" tag="Best Practices // Steps">
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { n:1, title:'Use a Strong Password', desc:'Always use a unique password for CineCraft. We recommend a password manager to generate and store complex credentials — never reuse passwords across services.' },
              { n:2, title:'Back Up Your E2EE Keys', desc:<>Your encryption keys are generated on-device. Set up your backup passphrase in <Link to="/settings/security" style={{ color:'inherit', fontWeight:600, textDecoration:'underline', textUnderlineOffset:3 }}>Settings → Security → Key Backup</Link> so you can recover access if you lose your device.</> },
              { n:3, title:'Verify Marketplace Listings', desc:'Before renting equipment, check the vendor\'s ratings and verification status. Use internal messaging for all project coordination — never move off-platform.' },
              { n:4, title:'Review Active Sessions', desc:<>Periodically review your active sessions in <Link to="/settings/security" style={{ color:'inherit', fontWeight:600, textDecoration:'underline', textUnderlineOffset:3 }}>Settings → Security → Sessions</Link> and revoke any devices you don&apos;t recognise.</> },
            ].map((step,i) => (
              <div key={i} style={{ display:'flex', gap:20, padding:'20px 22px', border:'1px solid hsl(var(--border))', borderRadius:4 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:'rgba(249,115,22,0.08)', border:`1px solid rgba(249,115,22,0.2)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:16, fontWeight:600, color:ORANGE_INK }}>{step.n}</span>
                </div>
                <div>
                  <h3 style={{ fontFamily:SERIF, fontSize:16, fontWeight:400, color:INK, marginBottom:6 }}>{step.title}</h3>
                  <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec num="02" Icon={Key} title="E2EE Explained" tag="Technical // Encryption">
          <p style={{ marginBottom:16 }}>End-to-end encryption (E2EE) means that messages are encrypted on your device before they leave it. Only the intended recipient, with their private key, can decrypt and read the message text.</p>
          <p style={{ marginBottom:16 }}>CineCraft's servers never have access to your decryption keys. Even in the event of a server breach, your private messages remain unreadable to any third party.</p>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'hsl(var(--muted-foreground))' }}>
            <strong style={{ fontFamily:SERIF, color:INK }}>Note:</strong> E2EE applies to the text of Direct Messages and Project Space chat. File attachments, shared cards, and public Community Discussion Rooms are not end-to-end encrypted.
          </div>
        </Sec>

        {/* Emergency callout */}
        <div style={{ marginTop:56, padding:'32px 36px', border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.04)', borderRadius:4 }}>
          <h3 style={{ fontFamily:SERIF, color:'#ef4444', fontWeight:400, fontSize:18, marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <ShieldAlert size={16} style={{ color:'#ef4444' }} /> Reporting Suspicious Activity
          </h3>
          <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', lineHeight:1.7, marginBottom:16 }}>
            If you believe your account has been compromised or you encounter fraudulent activity, contact our Security Operations Center (SOC) immediately.
          </p>
          <div style={{ fontSize:16, fontWeight:700, color:'#dc2626', padding:'12px 16px', border:'1px solid rgba(180,35,24,0.25)', borderRadius:10, display:'inline-block' }}>
            Emergency contact: <a href="mailto:security@cinecraftconnect.com" style={{ color:'inherit', textDecoration:'underline', textUnderlineOffset:3 }}>security@cinecraftconnect.com</a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SafetyCenter;
