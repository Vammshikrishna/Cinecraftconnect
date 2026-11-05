import { ShoppingBag, Briefcase, Zap, Globe, Lock, CheckCircle2, Users, Film, Home, MessageSquare, Star, Megaphone, Shield, Building2, Store } from 'lucide-react';
import Footer from "@/components/Footer";
import SEO from "@/components/common/SEO";

import { PageHero, SectionHead, IconTile, cardStyle, CtaBand } from '@/components/landing/PageParts';
import { FAINT, INK, LINE, MUTED, ORANGE, ORANGE_INK, SANS } from '@/components/landing/tokens';

const features = [
  { num:'01', id:'feed',        title:'Community Feed',        icon: Home,        description:'Your personalized stream of industry updates, behind-the-scenes content, and creative inspiration from films, TV, YouTube, and every format.', details:['Photo & Video Posts','Industry News','Behind The Scenes','Creator Spotlights'] },
  { num:'02', id:'network',     title:'Creator Network',       icon: Users,       description:'Discover and connect with professionals across every discipline — film directors, TV producers, YouTubers, brand filmmakers, podcast creators, and more.', details:['Smart Matching','Craft Filters','Mutual Connections','Portfolio Previews'] },
  { num:'03', id:'projects',    title:'Project Management',    icon: Film,        description:'Organize any production from concept to delivery. Track scenes, manage assets, and collaborate with your crew in real-time — whether it is a feature film or a Reels campaign.', details:['Scene Tracking','Asset Library','Crew Roles','Production Timeline'] },
  { num:'04', id:'marketplace', title:'Equipment Marketplace', icon: ShoppingBag, description:'Rent and list professional gear from verified creators and studios. Cinema cameras, lenses, drones, lighting rigs, audio equipment, and studio spaces.', details:['Verified Listings','Secure Payments','Insurance Options','Local Pickups'] },
  { num:'05', id:'jobs',        title:'Job Board',             icon: Briefcase,   description:'The most active job board across the entertainment industry. Film, TV, OTT, YouTube, ad films, brand content, music videos, podcast productions, and more.', details:['All Formats','Portfolio Integration','Direct Messaging','Verified Employers'] },
  { num:'06', id:'discussions', title:'Discussion Rooms',      icon: MessageSquare,description:'Craft-specific communities for every corner of entertainment — cinematography, editing, sound, production design, digital content, advertising, and live events.', details:['Spatial Audio','Screen Sharing','Whiteboarding','Room Categories'] },
  { num:'07', id:'companies',   title:'Company Pages',         icon: Building2,   description:'Dedicated profiles for studios, agencies, and production houses. Showcase your portfolio, list job openings, and manage your team in one centralized space.', details:['Team Roster','Verified Jobs','Studio Portfolio','Brand Assets'] },
  { num:'08', id:'vendors',     title:'Verified Vendors',      icon: Store,       description:'Find trusted service providers for your next production. From catering and transport to specialized VFX houses and legal counsel.', details:['Service Listings','Direct Booking','Location Filters','Vendor Badges'] },
  { num:'09', id:'ratings',     title:'Ratings & Reviews',     icon: Star,        description:'Build professional credibility with our transparent rating system. Review collaborators, equipment renters, and vendors after successful project completion.', details:['Verified Reviews','Project-tied Feedback','Dispute Resolution','Trust Scores'] },
  { num:'10', id:'announcements',title:'Industry Announcements',icon: Megaphone,   description:'Broadcast major updates to your network. Share festival selections, project wraps, casting calls, and release dates with high-visibility announcement posts.', details:['Push Notifications','Custom Banners','Analytics','Targeted Reach'] },
];

const accountTypes = [
  { type: 'Fan Account', desc: 'Designed for enthusiasts and fans.', access: 'View-only access to public feeds, announcements, and discussions.', restrictions: 'Cannot post jobs, rent equipment, pitch stories, or directly message industry professionals.', icon: Users },
  { type: 'Creator Pro', desc: 'For individual filmmakers and creators.', access: 'Full access to the creator network, project spaces, job board, pitching, and marketplace.', restrictions: 'Standard platform fees apply to equipment rentals and job promotions.', icon: Shield },
  { type: 'Studio / Company', desc: 'For production houses and agencies.', access: 'Everything in Pro, plus Company Pages, multi-user project management, and verified job postings.', restrictions: 'Requires official business verification and approval process.', icon: Building2 }
];

const specs = [
  { num:'01', title:'Global Network',   icon: Globe,         desc:'Connect with professionals worldwide.' },
  { num:'02', title:'Secure Workflow',  icon: Lock,          desc:'Your data and assets are encrypted.' },
  { num:'03', title:'Instant Updates',  icon: Zap,           desc:'Real-time sync across all devices.' },
  { num:'04', title:'Pro Verification', icon: CheckCircle2,  desc:'Build trust with verified badges.' },
];

const MONO = "'Inconsolata', ui-monospace, monospace";

const Features = () => {
  return (
    <div style={{ color: INK, fontFamily: SANS, overflowX: 'clip' }}>
      <SEO title="Features — CineCraft Connect" description="Explore tools for the entire entertainment industry: films, TV, YouTube, Instagram, ad films, music videos and podcasts. Crew discovery, project management, job board, and equipment marketplace." />
      <main>
        <PageHero
          label="Features"
          title="Every tool your production needs."
          accent="Whatever format you create in."
          intro="Film, TV, YouTube, Instagram, ad campaigns, music videos and podcasts: CineCraft Connect is built for every creator in the entertainment industry."
        />

        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-16 md:pb-24">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f) => (
              <li key={f.id} id={f.id} style={{ ...cardStyle, scrollMarginTop: 96, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <IconTile><f.icon size={21} color={ORANGE} aria-hidden="true" /></IconTile>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: ORANGE_INK }}>{f.num}</div>
                    <h2 style={{ fontSize: 23, color: INK, margin: 0, lineHeight: 1.15 }}>{f.title}</h2>
                  </div>
                </div>
                <p className="[text-wrap:pretty]" style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.65, margin: '0 0 18px' }}>{f.description}</p>
                <ul style={{ listStyle: 'none', margin: 'auto 0 0', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {f.details.map((d) => (
                    <li key={d} style={{ fontSize: 13.5, fontWeight: 600, color: ORANGE_INK, background: '#FFF1EE', padding: '5px 12px', borderRadius: 999 }}>{d}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-16 md:pb-24">
          <SectionHead label="Accounts" title="Choose your access level" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {accountTypes.map((acc, i) => (
              <div key={acc.type} style={{ ...cardStyle, padding: 28, border: `1px solid ${i === 1 ? ORANGE : LINE}`, boxShadow: i === 1 ? '0 30px 60px -34px rgba(255,75,51,0.6)' : cardStyle.boxShadow, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <IconTile><acc.icon size={21} color={ORANGE} aria-hidden="true" /></IconTile>
                <h3 style={{ fontSize: 24, color: INK, margin: '18px 0 6px' }}>{acc.type}</h3>
                <p style={{ fontSize: 15, color: MUTED, margin: '0 0 18px', paddingBottom: 18, borderBottom: `1px solid ${LINE}` }}>{acc.desc}</p>
                <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANGE_INK, margin: '0 0 4px' }}>What you get</p>
                <p style={{ fontSize: 15, color: INK, lineHeight: 1.6, margin: '0 0 16px' }}>{acc.access}</p>
                <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, margin: 'auto 0 4px' }}>Limits</p>
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: 0 }}>{acc.restrictions}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-[1280px] mx-auto px-6 md:px-12 pb-16 md:pb-24">
          <SectionHead label="Included" title="Built into every account" />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {specs.map((sp) => (
              <li key={sp.title} style={cardStyle}>
                <IconTile size={40}><sp.icon size={19} color={ORANGE} aria-hidden="true" /></IconTile>
                <h3 style={{ fontSize: 19, color: INK, margin: '16px 0 6px' }}>{sp.title}</h3>
                <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: 0 }}>{sp.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <CtaBand title="Ready to put it" accent="to work?" text="Create your profile and start using every tool on this page." />
      </main>

      <Footer />
    </div>
  );
};

export default Features;
