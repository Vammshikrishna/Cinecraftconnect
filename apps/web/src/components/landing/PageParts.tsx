import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CARD, INK, LINE, MONO, MUTED, ORANGE, ORANGE_INK, SANS, SERIF } from './tokens';

/* Building blocks shared by the public pages (About, Features), in the landing page's look. */
export const eyebrow: React.CSSProperties = { fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: ORANGE_INK, margin: '0 0 14px' };

export const PageHero = ({ label, title, accent, intro }: { label: string; title: ReactNode; accent: string; intro: ReactNode }) => (
  <section className="relative max-w-[1280px] mx-auto px-6 md:px-12 pt-24 md:pt-36 pb-12 md:pb-16">
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'radial-gradient(50% 70% at 85% 0%, rgba(255,75,51,0.14), rgba(255,75,51,0) 70%)' }} />
    <p style={eyebrow}>{label}</p>
    <h1 className="[text-wrap:balance]" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(40px, 6vw, 78px)', letterSpacing: '-0.04em', color: INK, margin: '0 0 22px', maxWidth: 960 }}>
      {title}{' '}
      <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: ORANGE_INK, letterSpacing: '-0.02em' }}>{accent}</span>
    </h1>
    <div className="[text-wrap:pretty]" style={{ fontSize: 19, color: MUTED, lineHeight: 1.6, maxWidth: 640 }}>{intro}</div>
  </section>
);

export const SectionHead = ({ label, title, note }: { label: string; title: string; note?: string }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 32 }}>
    <div>
      <p style={eyebrow}>{label}</p>
      <h2 className="[text-wrap:balance]" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(30px, 3.8vw, 48px)', lineHeight: 1.06, letterSpacing: '-0.03em', color: INK, margin: 0 }}>{title}</h2>
    </div>
    {note && <p style={{ fontSize: 15, color: MUTED, margin: 0 }}>{note}</p>}
  </div>
);

export const IconTile = ({ children, size = 44 }: { children: ReactNode; size?: number }) => (
  <div aria-hidden="true" style={{ width: size, height: size, borderRadius: 14, background: '#FFF1EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{children}</div>
);

export const cardStyle: React.CSSProperties = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 24, padding: 26, boxShadow: '0 24px 50px -36px rgba(20,17,15,0.4)' };

export const CtaBand = ({ title, accent, text }: { title: string; accent: string; text: string }) => (
  <section className="px-6 md:px-12 pb-16 md:pb-24">
    <div style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', maxWidth: 1280, margin: '0 auto', borderRadius: 32, background: INK, color: '#fff', padding: 'clamp(40px, 7vw, 80px) clamp(24px, 6vw, 72px)', textAlign: 'center' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'radial-gradient(60% 90% at 50% 130%, rgba(255,75,51,0.5), rgba(255,75,51,0) 70%)' }} />
      <h2 className="[text-wrap:balance]" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(30px, 4.4vw, 54px)', lineHeight: 1.05, letterSpacing: '-0.035em', margin: '0 0 16px', color: '#fff' }}>
        {title}{' '}<span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: '#FF8A78' }}>{accent}</span>
      </h2>
      <p className="[text-wrap:pretty]" style={{ fontSize: 17, color: 'rgba(255,255,255,0.78)', maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.6 }}>{text}</p>
      <Link to="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '0 26px', borderRadius: 14, background: ORANGE, color: INK, fontFamily: SANS, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
        Create your profile <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  </section>
);
