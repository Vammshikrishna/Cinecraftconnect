import { Shield, Lock, Eye, FileText, Trash2, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useScroll } from 'framer-motion';
import { DocHeader, DocSec as Sec } from "@/components/landing/DocParts";
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

const CREAM = 'hsl(var(--background))'; const INK = 'hsl(var(--foreground))'; const ORANGE = '#FF4B33'; const ORANGE_INK = 'hsl(var(--primary))';
const SERIF = "'Lora', Georgia, serif"; const MONO = "'Inconsolata', 'Courier New', monospace"; const SANS = "'Work Sans', system-ui, sans-serif";


const PrivacyPolicy = ({ embedded = false }: { embedded?: boolean }) => {
  const lastUpdated = "April 17, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden', ...(embedded ? { borderRadius:16, border:'1px solid hsl(var(--border))' } : {}) }}>
      {!embedded && <SEO title="Privacy Policy — CineCraft Connect" description="Review our policies detailing personal data collection, encryption, and data retention guidelines." />}
      <main className={embedded ? 'px-5 md:px-8 pt-6 pb-6' : 'max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-36 pb-16 md:pb-24'}>

        <DocHeader Icon={Shield} label="Legal" title="Privacy Policy" meta={<>Last updated {lastUpdated}</>} intro={<>We respect your privacy and are committed to protecting your personal data. This policy explains how we collect, use, and safeguard your information.</>} embedded={embedded} />

        <Sec num="01" Icon={Eye} title="Introduction" tag="Foreword // Regulatory Compliance">
          <p style={{ marginBottom:16 }}>CineCraft Connect acts as the Data Controller under GDPR guidelines for all data collected through our platform. This Privacy Policy applies to all users of our web and mobile applications.</p>
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
              <div key={i} style={{ padding:'18px 20px', border:'1px solid hsl(var(--border))', borderRadius:12 }}>
                <div style={{ fontFamily:SERIF, fontSize:'0.9375rem', color:INK, marginBottom:6 }}>{c.t}</div>
                <div style={{ fontSize:'0.8125rem', color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{c.d}</div>
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
              <div key={i} style={{ display:'flex', gap:16, padding:'18px 20px', border:'1px solid hsl(var(--border))', borderRadius:12 }}>
                                <div>
                  <div style={{ fontFamily:SERIF, fontSize:'1.0625rem', fontWeight:600, color:INK, marginBottom:4 }}>{item.t}</div>
                  <div style={{ fontSize:'0.9375rem', color:'hsl(var(--foreground) / 0.8)', lineHeight:1.65 }}>{item.d}</div>
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
              <div key={i} style={{ display:'flex', gap:12, padding:'18px 20px', border:'1px solid hsl(var(--border))', borderRadius:12 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:ORANGE, marginTop:7, flexShrink:0 }} />
                <div>
                  <div style={{ fontFamily:SERIF, fontSize:'0.9375rem', color:INK, marginBottom:4 }}>{r.t}</div>
                  <div style={{ fontSize:'0.8125rem', color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{r.d}</div>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <div style={{ marginTop:56, padding:'32px 36px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4 }}>
          <h4 style={{ fontFamily:SERIF, color:ORANGE, fontWeight:400, fontSize:'1.125rem', marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <Trash2 size={16} style={{ color:ORANGE }} /> Account Deletion
          </h4>
          <p style={{ fontSize:'0.8125rem', color:'hsl(var(--muted-foreground))', lineHeight:1.7 }}>
            In compliance with App Store and Google Play guidelines, you can request full account deletion via Account Settings. Your account, profile, and the data linked to it are permanently deleted from our production data stores. Copies in routine encrypted backups are removed as those backups rotate out.
          </p>
        </div>
      </main>
      {!embedded && <Footer />}
    </div>
  );
};

export default PrivacyPolicy;
