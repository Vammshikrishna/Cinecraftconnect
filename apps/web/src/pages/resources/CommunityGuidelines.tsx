import { Users, Scale, Heart, AlertTriangle, CheckCircle2, Flag } from 'lucide-react';
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

const BulletItem = ({ text, icon }: { text: string; icon?: React.ReactNode }) => (
  <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 0', borderBottom:'1px solid rgba(13,13,13,0.06)' }}>
    <span style={{ marginTop:3, flexShrink:0 }}>{icon ?? <span style={{ width:6, height:6, borderRadius:'50%', background:'rgba(13,13,13,0.3)', display:'block', marginTop:6 }} />}</span>
    <span style={{ fontSize:14, color:'rgba(13,13,13,0.65)', lineHeight:1.65 }}>{text}</span>
  </div>
);

const CommunityGuidelines = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <div style={{ background:CREAM, color:INK, fontFamily:SANS, overflowX:'hidden' }}>
      <SEO title="Community Guidelines — CineCraft Connect" description="Our code of conduct governing professional behaviour, content standards, and enforcement policies on CineCraft Connect." />
      <FilmGrain />
      <main className="max-w-[1440px] mx-auto px-6 md:px-12 pt-32 md:pt-40 pb-16 md:pb-24">

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.22,1,0.36,1] }}>
          <Slug text="INT. Community Standards — Code of Conduct" />
          <div style={{ display:'flex', alignItems:'center', gap:20, marginBottom:32 }}>
            <div style={{ width:48, height:48, borderRadius:8, border:`1px solid rgba(249,115,22,0.3)`, background:'rgba(249,115,22,0.06)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Users size={20} style={{ color:ORANGE }} />
            </div>
            <div>
              <h1 style={{ fontFamily:SERIF, fontSize:'clamp(36px,5vw,60px)', fontWeight:300, color:INK, lineHeight:1.1 }}>Community Guidelines</h1>
              <p style={{ fontFamily:MONO, fontSize:10, color:'rgba(13,13,13,0.3)', letterSpacing:'0.18em', textTransform:'uppercase', marginTop:6 }}>Last Updated // {lastUpdated.toUpperCase()}</p>
            </div>
          </div>
          <p style={{ fontSize:16, color:'rgba(13,13,13,0.6)', maxWidth:600, lineHeight:1.75, marginBottom:60, paddingBottom:48, borderBottom:'1px solid rgba(13,13,13,0.1)' }}>
            CineCraft Connect is a professional community of creators, artists, and technicians across the entertainment industry. We believe in fostering mutual respect, creative freedom, and professional integrity.
          </p>
        </motion.div>

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
                <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:ORANGE, flexShrink:0, minWidth:90 }} className="mb-2 md:mb-0">{tier.step}</span>
                <p style={{ fontSize:14, color:'rgba(13,13,13,0.58)', lineHeight:1.65 }}>{tier.desc}</p>
              </div>
            ))}
          </div>
        </Sec>

        <div style={{ marginTop:56, padding:'32px 36px', border:`1px solid rgba(249,115,22,0.2)`, background:'rgba(249,115,22,0.04)', borderRadius:4 }}>
          <h4 style={{ fontFamily:SERIF, color:ORANGE, fontWeight:400, fontSize:18, marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
            <Flag size={16} style={{ color:ORANGE }} /> Reporting Violations
          </h4>
          <p style={{ fontSize:13, color:'rgba(13,13,13,0.55)', lineHeight:1.7 }}>
            See something that violates these guidelines? Use the <strong>"Report"</strong> button found on all content, profiles, and messages. Our moderation team reviews every report within 24 hours.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CommunityGuidelines;
