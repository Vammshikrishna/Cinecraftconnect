import { Users, Scale, Heart, AlertTriangle, CheckCircle2, Flag } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useScroll } from 'framer-motion';
import { DocHeader, DocSec as Sec } from "@/components/landing/DocParts";
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

const CREAM = 'hsl(var(--background))'; const INK = 'hsl(var(--foreground))'; const ORANGE = '#FF4B33'; const ORANGE_INK = 'hsl(var(--primary))';
const SERIF = "'Lora', Georgia, serif"; const MONO = "'Inconsolata', 'Courier New', monospace"; const SANS = "'Work Sans', system-ui, sans-serif";


const BulletItem = ({ text, icon }: { text: string; icon?: React.ReactNode }) => (
  <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 0', borderBottom:'1px solid hsl(var(--foreground) / 0.06)' }}>
    <span style={{ marginTop:3, flexShrink:0 }}>{icon ?? <span style={{ width:6, height:6, borderRadius:'50%', background:'hsl(var(--foreground) / 0.3)', display:'block', marginTop:6 }} />}</span>
    <span style={{ fontSize:14, color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{text}</span>
  </div>
);

const CommunityGuidelines = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Community Guidelines — CineCraft Connect" description="Our code of conduct governing professional behaviour, content standards, and enforcement policies on CineCraft Connect." />
      <main className="max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-36 pb-16 md:pb-24">

        <DocHeader Icon={Users} label="Resources" title="Community Guidelines" meta={<>Last updated {lastUpdated}</>} intro={<>CineCraft Connect is a professional community of creators, artists, and technicians across the entertainment industry. We believe in fostering mutual respect, creative freedom, and professional integrity.</>} />

        <Sec num="01" Icon={Heart} title="Our Philosophy" tag="Community // Values">
          <p>We built CineCraft for people who take their craft seriously. That means holding each other to a higher standard — one where your work speaks louder than your follower count, and where genuine collaboration beats networking theatre.</p>
        </Sec>

        <Sec num="02" Icon={CheckCircle2} title="Professional Conduct" tag="Expected Behaviour // Standards">
          <div style={{ display:'flex', flexDirection:'column' }}>
            {[
              'Be respectful in Discussion Rooms and private messages — even when you disagree.',
              'Honor your commitments on projects and marketplace transactions.',
              'Provide honest, constructive feedback when asked.',
              'Represent your credits and gear inventory accurately.',
              'Credit collaborators properly on posted work and productions.',
              'Communicate promptly when circumstances change on a project.',
            ].map((t,i) => <BulletItem key={i} text={t} icon={<CheckCircle2 size={14} style={{ color:'#22c55e', marginTop:2 }} />} />)}
          </div>
        </Sec>

        <Sec num="03" Icon={AlertTriangle} title="Zero Tolerance Policies" tag="Violations // Enforcement">
          <div style={{ display:'flex', flexDirection:'column' }}>
            {[
              'Harassment, hate speech, or bullying of any kind toward any member.',
              'Posting pirated content, leaked scripts, or unauthorized materials.',
              'Fraudulent marketplace listings or payment scams.',
              'Impersonating other creators, companies, or CineCraft staff members.',
              'Sharing private communications without the other party\'s explicit consent.',
              'Using bots or automated tools to artificially inflate profile metrics.',
            ].map((t,i) => <BulletItem key={i} text={t} icon={<AlertTriangle size={14} style={{ color:ORANGE, marginTop:2 }} />} />)}
          </div>
        </Sec>

        <Sec num="04" Icon={Scale} title="Enforcement & Governance" tag="Moderation // Tiers">
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { step:'1. Warning', desc:'Initial notification sent for minor first-time violations. No platform restriction applied.' },
              { step:'2. Muting',  desc:'Temporary restriction of messaging and discussion privileges for 24–72 hours.' },
              { step:'3. Suspension', desc:'Full account restriction for 7–30 days for severe or repeat offenses.' },
              { step:'4. Permanent Ban', desc:'Permanent removal from the platform for extreme violations or repeated severe offenses.' },
            ].map((tier,i) => (
              <div key={i} className="flex flex-col md:flex-row md:gap-4 p-5 md:py-4 md:px-5 border border-black/10 rounded">
                <span style={{ fontSize:15, fontWeight:600, color:ORANGE_INK, flexShrink:0, minWidth:140 }} className="mb-2 md:mb-0">{tier.step}</span>
                <p style={{ fontSize:14, color:'hsl(var(--muted-foreground))', lineHeight:1.65 }}>{tier.desc}</p>
              </div>
            ))}
          </div>
        </Sec>

        <div style={{ marginTop:56, padding:'32px 36px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4 }}>
          <h4 style={{ fontFamily:SERIF, color:ORANGE, fontWeight:400, fontSize:18, marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <Flag size={16} style={{ color:ORANGE }} /> Reporting Violations
          </h4>
          <p style={{ fontSize:13, color:'hsl(var(--muted-foreground))', lineHeight:1.7 }}>
            See something that violates these guidelines? Use the <strong>"Report"</strong> button found on all content, profiles, and messages. Our moderation team reviews every report within 24 hours.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CommunityGuidelines;
