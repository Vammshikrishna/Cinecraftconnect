import { Shield, Lock, Eye, FileText, Trash2, Globe } from 'lucide-react';
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

const PrivacyPolicy = () => {
  const lastUpdated = "April 17, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Privacy Policy — CineCraft Connect" description="Review our policies detailing personal data collection, encryption, and data retention guidelines." />
      <FilmGrain />
      <main className="max-w-[1440px] mx-auto px-6 md:px-12 pt-32 md:pt-40 pb-16 md:pb-24">

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.22,1,0.36,1] }}>
          <Slug text="EXT. Legal Board — Privacy Charter" />
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:32 }}>
            <div style={{ width:48, height:48, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Shield size={20} style={{ color:ORANGE }} />
            </div>
            <div>
              <h1 style={{ fontFamily:SERIF, fontSize:'clamp(36px,5vw,60px)', fontWeight:300, color:INK, lineHeight:1.1 }}>Privacy Policy</h1>
              <p style={{ fontFamily:MONO, fontSize:10, color:'rgba(13,13,13,0.3)', letterSpacing:'0.18em', textTransform:'uppercase', marginTop:6 }}>Last Updated // {lastUpdated.toUpperCase()}</p>
            </div>
          </div>
          <p style={{ fontSize:16, color:'rgba(13,13,13,0.6)', maxWidth:600, lineHeight:1.75, marginBottom:60, paddingBottom:48, borderBottom:'1px solid rgba(13,13,13,0.1)' }}>
            We respect your privacy and are committed to protecting your personal data. This policy explains how we collect, use, and safeguard your information.
          </p>
        </motion.div>

        <Sec num="01" Icon={Eye} title="Introduction" tag="Foreword // Regulatory Compliance">
          <p style={{ marginBottom:16 }}>CineCraft Connect acts as the Data Controller under GDPR guidelines for all data collected through our platform. This Privacy Policy applies to all users of our web and mobile applications.</p>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'rgba(13,13,13,0.55)', fontStyle:'italic' }}>
            CineCraft Connect acts as the Data Controller under GDPR guidelines for all data collected.
          </div>
        </Sec>

        <Sec num="02" Icon={Lock} title="Data We Collect" tag="Disclosures // Types">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { t:'Identity', d:'First name, last name, username, and craft or role.' },
              { t:'Contact Details', d:'Email address and linked social handles.' },
              { t:'Technical Data', d:'IP address, browser type, and native device info.' },
              { t:'Usage Activity', d:'How you use our casting and project features.' },
              { t:'Profile Information', d:'Showreels, job histories, project files, and ratings.' },
              { t:'Communications', d:'Encrypted message metadata for security auditing.' },
            ].map((c,i) => (
              <div key={i} style={{ padding:'18px 20px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4 }}>
                <div style={{ fontFamily:SERIF, fontSize:15, color:INK, marginBottom:6 }}>{c.t}</div>
                <div style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec num="03" Icon={FileText} title="How We Use Data" tag="Usage Spec // Intent">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { id:'01', t:'Casting & Directory', d:'To present your credentials within searches, allowing directors to coordinate hires.' },
              { id:'02', t:'Encrypted Communication', d:'To synchronize end-to-end encrypted direct messaging and project space channels.' },
              { id:'03', t:'Platform Integrity', d:'To audit operations and prevent malicious script injections or fraudulent project postings.' },
              { id:'04', t:'Service Improvement', d:'To analyze usage patterns and improve platform features and performance over time.' },
            ].map((item,i) => (
              <div key={i} style={{ display:'flex', gap:16, padding:'18px 20px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4 }}>
                <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:ORANGE, flexShrink:0 }}>[ {item.id} ]</span>
                <div>
                  <div style={{ fontFamily:SERIF, fontSize:15, color:INK, marginBottom:4 }}>{item.t}</div>
                  <div style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{item.d}</div>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec num="04" Icon={Globe} title="Data Sharing" tag="Third Parties // Disclosure">
          <p style={{ marginBottom:16 }}>We do not sell your personal data to third parties. We may share your data with trusted service providers who assist in operating the platform, subject to strict confidentiality agreements.</p>
          <p>We may disclose your information if required by law, court order, or to protect the rights, property, or safety of CineCraft Connect, our users, or the public.</p>
        </Sec>

        <Sec num="05" Icon={Shield} title="Your GDPR Rights" tag="User Rights // GDPR Compliance">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { t:'Access', d:'Request a copy of the personal data we hold about you.' },
              { t:'Rectification', d:'Request correction of inaccurate or incomplete data.' },
              { t:'Erasure', d:'Request deletion of your personal data under certain conditions.' },
              { t:'Portability', d:'Request transfer of your data to another service provider.' },
            ].map((r,i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'18px 20px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:ORANGE, marginTop:7, flexShrink:0 }} />
                <div>
                  <div style={{ fontFamily:SERIF, fontSize:15, color:INK, marginBottom:4 }}>{r.t}</div>
                  <div style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{r.d}</div>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <div style={{ marginTop:56, padding:'32px 36px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4 }}>
          <h4 style={{ fontFamily:SERIF, color:ORANGE, fontWeight:400, fontSize:18, marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <Trash2 size={16} style={{ color:ORANGE }} /> Account Deletion
          </h4>
          <p style={{ fontSize:13, color:'rgba(13,13,13,0.55)', lineHeight:1.7 }}>
            In compliance with App Store and Google Play guidelines, you can request full account deletion via Account Settings. All personal data, keys, credentials, and portfolios will be permanently scrubbed from our production data stores immediately.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
