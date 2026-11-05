import { Users, Globe, Target, Film, Heart, Lightbulb } from "lucide-react";
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

import { PageHero, SectionHead, IconTile, cardStyle, CtaBand } from '@/components/landing/PageParts';
import { INK, MUTED, ORANGE, SANS } from '@/components/landing/tokens';

const values = [
  { title: 'Community first', icon: Users, desc: 'We believe the best work happens when creators support one another. Our platform fosters genuine, un-gamified professional connections.' },
  { title: 'Security and privacy', icon: Target, desc: 'Every pitch, conversation, and project space is protected. We enforce E2EE encryption to ensure your creative property remains strictly yours.' },
  { title: 'Creative freedom', icon: Heart, desc: 'No algorithm decides what you see or who hires you. Your craft speaks for itself, free from vanity metrics.' },
  { title: 'Borderless cinema', icon: Globe, desc: 'From Mumbai to Los Angeles, CineCraft bridges creative communities across continents without barriers.' },
  { title: 'Innovation led', icon: Lightbulb, desc: 'Constant iteration guided by creator feedback, not investor dashboards. We build what the industry actually needs.' },
  { title: 'Story first', icon: Film, desc: 'Every feature decision starts with one question: does this help a creator tell a better story?' },
];

const About = () => {
  return (
    <div style={{ color: INK, fontFamily: SANS, overflowX: 'clip' }}>
      <SEO title="About Us — CineCraft Connect" description="Learn about the mission, values, and origin story of CineCraft Connect, the professional network for the entire entertainment industry." />

      <main>
        <PageHero
          label="About"
          title="Empowering every creator"
          accent="in entertainment."
          intro={
            <>
              <p style={{ margin: '0 0 16px', color: INK, fontSize: 20 }}>CineCraft Connect was born from a simple observation: the entertainment industry is built on collaboration, yet the tools we use are fragmented.</p>
              <p style={{ margin: 0 }}>Whether you make feature films, TV shows, YouTube content, Instagram campaigns, ad films, or podcasts, we exist to restore clarity, connection, and security to your creative pipeline.</p>
            </>
          }
        />

        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-16 md:pb-24">
          <SectionHead label="Principles" title="What we believe" note="Six convictions that guide every product decision." />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {values.map((v) => (
              <li key={v.title} style={cardStyle}>
                <IconTile><v.icon size={21} color={ORANGE} aria-hidden="true" /></IconTile>
                <h3 style={{ fontSize: 21, color: INK, margin: '18px 0 8px', lineHeight: 1.2 }}>{v.title}</h3>
                <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.65, margin: 0 }}>{v.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-16 md:pb-24">
          <div style={{ borderRadius: 32, background: INK, color: '#fff', padding: 'clamp(32px, 6vw, 72px)' }} className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20 items-start">
            <h2 className="[text-wrap:balance]" style={{ fontSize: 'clamp(30px, 3.6vw, 48px)', lineHeight: 1.08, color: '#fff', margin: 0 }}>The story behind CineCraft</h2>
            <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.8)', lineHeight: 1.75, maxWidth: 560 }}>
              <p style={{ margin: '0 0 20px' }}>Founded by a team of creators and software developers, CineCraft Connect was built to solve the real-world problems we faced while making content across films, TV, YouTube, ad campaigns, and digital media.</p>
              <p style={{ margin: '0 0 20px' }}>After years of using fragmented tools (spreadsheets for casting, WhatsApp for coordination, email chains for script feedback) we decided to build the platform we always wished existed.</p>
              <p style={{ margin: 0 }}>Today, CineCraft Connect is open for its first users. Join us at launch and help shape the platform for the entire entertainment community.</p>
            </div>
          </div>
        </section>

        <CtaBand title="Be one of the first" accent="to build it with us." text="Create your profile and start working with the people who make entertainment." />
      </main>

      <Footer />
    </div>
  );
};

export default About;
