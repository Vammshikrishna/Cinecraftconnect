import { FileText, Scale, UserCheck, AlertTriangle, Shield, Gavel } from 'lucide-react';
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

const Card = ({ title, desc }: { title:string; desc:string }) => (
  <div style={{ padding:'20px 22px', border:'1px solid rgba(13,13,13,0.1)', borderRadius:4 }}>
    <div style={{ fontFamily:SERIF, fontSize:15, color:INK, marginBottom:6 }}>{title}</div>
    <div style={{ fontSize:13, color:'rgba(13,13,13,0.52)', lineHeight:1.65 }}>{desc}</div>
  </div>
);

const Bullet = ({ text }: { text: string }) => (
  <div style={{ display:'flex', alignItems:'flex-start', gap:10, fontFamily:MONO, fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'rgba(13,13,13,0.6)', fontWeight:700 }}>
    <span style={{ width:5, height:5, borderRadius:'50%', background:ORANGE, marginTop:5, flexShrink:0 }} />{text}
  </div>
);

const TermsOfService = () => {
  const lastUpdated = "July 25, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Terms of Service — CineCraft Connect" description="Review the terms of service governing user accounts, communication conduct, and intellectual property limits." />
      <FilmGrain />
      <main className="max-w-[1440px] mx-auto px-6 md:px-12 pt-32 md:pt-40 pb-16 md:pb-24">

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.22,1,0.36,1] }}>
          <Slug text="EXT. Legal Board — User Contract" />
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:32 }}>
            <div style={{ width:48, height:48, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Gavel size={20} style={{ color:ORANGE }} />
            </div>
            <div>
              <h1 style={{ fontFamily:SERIF, fontSize:'clamp(36px,5vw,60px)', fontWeight:300, color:INK, lineHeight:1.1 }}>Terms of Service</h1>
              <p style={{ fontFamily:MONO, fontSize:10, color:'rgba(13,13,13,0.3)', letterSpacing:'0.18em', textTransform:'uppercase', marginTop:6 }}>Effective Date // {lastUpdated.toUpperCase()}</p>
            </div>
          </div>
          <p style={{ fontSize:16, color:'rgba(13,13,13,0.6)', maxWidth:600, lineHeight:1.75, marginBottom:60, paddingBottom:48, borderBottom:'1px solid rgba(13,13,13,0.1)' }}>
            By accessing or using CineCraft Connect, you agree to be bound by these Terms of Service and our Privacy Policy.
          </p>
        </motion.div>

        <Sec num="01" Icon={FileText} title="Agreement to Terms" tag="Verification // System Bounds">
          <p style={{ marginBottom:16 }}>By accessing or using CineCraft Connect (the "Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform. These terms apply to all visitors, creators, and others who access or use the Service.</p>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'rgba(13,13,13,0.55)', fontStyle:'italic' }}>
            CineCraft Connect reserves the right to update these terms at any time. Continued use constitutes acceptance of updated terms.
          </div>
        </Sec>

        <Sec num="02" Icon={UserCheck} title="User Accounts" tag="Verification // User Accounts">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-0">
            <Card title="Responsibility" desc="You are responsible for safeguarding credentials, session keys, and local E2EE private PIN codes. Any database changes under your token are your legal responsibility." />
            <Card title="Age Requirements" desc="You must be at least 18 years of age to contract casting positions or advertise camera gear rentals on this platform." />
            <Card title="Accurate Information" desc="You agree to provide accurate, current, and complete information during registration and to update it as necessary." />
            <Card title="Account Security" desc="Immediately notify us of any unauthorized use of your account or any breach of security you become aware of." />
          </div>
        </Sec>

        <Sec num="03" Icon={AlertTriangle} title="Content & Conduct" tag="Rules // Ethical Code">
          <p style={{ marginBottom:20 }}>Our Service allows you to post portfolios, link showreels, and communicate in encrypted project rooms. You represent and warrant that:</p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {['You own or have licensing rights to all uploaded showreels and scripts.','Your content does not infringe the privacy or copyright of any crew member.','You will not post deceptive bids, dummy casting offers, or fraudulent vendor listings.','You will not harass, threaten, or demean other members of the platform.','You will not use the platform for any unlawful purpose or prohibited activity.'].map((t,i) => <Bullet key={i} text={t} />)}
          </div>
        </Sec>

        <Sec num="04" Icon={Scale} title="Intellectual Property" tag="IP Rights // Ownership">
          <p style={{ marginBottom:16 }}>You retain all ownership rights to content you create and upload. By posting content, you grant us a limited, non-exclusive license to display and distribute it within the platform.</p>
          <p>The CineCraft Connect platform, including its design, code, branding, and all non-user-generated content, is owned by CineCraft Connect and protected by applicable intellectual property laws.</p>
        </Sec>

        <Sec num="05" Icon={Shield} title="Limitation of Liability" tag="Liability Limits // Disclaimers">
          <p style={{ marginBottom:16 }}>In no event shall CineCraft Connect, its founders, or licensing partners be liable for any indirect, incidental, or consequential damages resulting from communications or rentals coordinated through our network tools.</p>
          <p style={{ marginBottom:16 }}>The Platform is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied.</p>
          <p><strong>Pitch Marketplace Exclusion:</strong> CineCraft Connect is a neutral marketplace platform. We are explicitly held harmless for any intellectual property disputes, script theft allegations, compensation disagreements, or creative ownership claims arising between writers (submitters) and call creators (producers) using the Pitch feature. The platform's role is limited to facilitating introductions and storing timestamped evidence — not adjudicating disputes.</p>
        </Sec>

        <Sec num="06" Icon={Gavel} title="Pitch Marketplace — Dispute Resolution" tag="Mandatory Arbitration // Pitch Feature">
          <p style={{ marginBottom:16 }}>This section governs all disputes arising from use of the Pitch feature, including pitch submission, review, or any resulting collaboration or IP claim.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
            <Bullet text="Mandatory Arbitration: All disputes must be resolved through binding private arbitration — not through public courts — except where applicable law explicitly prohibits this." />
            <Bullet text="Arbitration Body: Arbitration shall be conducted under the rules of the Society of Mediators and Arbitrators of India (SAMA) or any mutually agreed arbitration body." />
            <Bullet text="Venue: Arbitration proceedings shall take place in Hyderabad, Telangana, India, and may be conducted in English or Hindi." />
            <Bullet text="Class Action Waiver: Users waive all rights to participate in class-action lawsuits or class-wide arbitration against CineCraft Connect arising from Pitch feature disputes." />
            <Bullet text="Hold Harmless: Writers and call creators agree to hold CineCraft Connect harmless and indemnify it against any claims, damages, or legal costs arising from disputes between platform users." />
            <Bullet text="Evidence Admissibility: Parties agree that server-side timestamps, access logs, NDA signatures, and guild registration numbers stored by CineCraft Connect constitute valid and admissible evidence in any arbitration or court proceeding." />
          </div>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'rgba(13,13,13,0.55)', fontStyle:'italic' }}>
            Governing Law for Pitch Disputes: Indian Copyright Act (1957), Information Technology Act (2000), and the Arbitration and Conciliation Act (1996).
          </div>
        </Sec>

        <Sec num="07" Icon={FileText} title="Pitch-Specific IP Declarations" tag="Writer Obligations // Pitch Feature">
          <p style={{ marginBottom:16 }}>By submitting a pitch through the CineCraft Connect Pitch Marketplace, writers and creators make the following legally binding declarations:</p>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
            <Bullet text="Rights Ownership: You confirm you are the sole or authorised owner of all rights to the submitted story, script, or concept." />
            <Bullet text="Original Work: You declare the submission is an original creative work and has not been plagiarised from any existing copyrighted material." />
            <Bullet text="Guild Registration: If a Screenwriters Association (SWA) or WGA registration number is provided, you confirm it is accurate and belongs to the submitted work." />
            <Bullet text="False Declaration Liability: Submitting a pitch with false declarations constitutes fraudulent misrepresentation and may be prosecuted under the Indian Penal Code, Section 420, and the IT Act." />
            <Bullet text="NDA Binding Effect: If a Non-Disclosure Agreement (NDA) is signed via the platform's e-signature feature, it constitutes a valid clickwrap agreement under the Indian IT Act, 2000, and is legally binding on both parties." />
            <Bullet text="Call Creator Obligation: Call creators who sign an NDA to access protected pitch content are bound to maintain confidentiality and may not use the pitch concept without formal agreement with the writer." />
          </div>
          <div style={{ padding:'16px 20px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4, fontSize:13, color:'rgba(13,13,13,0.55)' }}>
            <strong>Register your script before pitching:</strong> Writers are strongly encouraged to register their work with the{' '}
            <a href="https://swaindia.org" target="_blank" rel="noopener noreferrer" style={{ color:'#f97316', textDecoration:'underline' }}>Screenwriters Association (SWA)</a>{' '}
            before submitting on the platform. SWA registration provides government-backed copyright proof that significantly strengthens your legal position in any dispute.
          </div>
        </Sec>

        <div style={{ marginTop:56, padding:'32px 36px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4 }}>
          <h4 style={{ fontFamily:SERIF, color:ORANGE, fontWeight:400, fontSize:18, marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <Gavel size={16} style={{ color:ORANGE }} /> Governing Law
          </h4>
          <p style={{ fontSize:13, color:'rgba(13,13,13,0.55)', lineHeight:1.7 }}>
            These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration in accordance with standard arbitration rules.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
