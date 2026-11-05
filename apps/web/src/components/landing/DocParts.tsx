import type { ReactNode, ElementType } from 'react';
import { INK, MONO, MUTED, ORANGE, ORANGE_INK, SANS } from './tokens';

/* Header and numbered section for the long reading pages (Documentation, Guidelines, Safety Center, Privacy, Terms, Cookies).
   They colour themselves with the app's theme variables, so the same markup works on the public pages (light, via PublicPage) and inside
   the signed-in settings (`embedded`, which keeps a compact header and the app's own theme). */

export const DocHeader = ({ Icon, label, title, meta, intro, embedded }: { Icon: ElementType; label: string; title: string; meta: ReactNode; intro: ReactNode; embedded?: boolean }) => {
  if (embedded) {
    return (
      <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid hsl(var(--border))' }}>
        <h1 style={{ fontFamily: SANS, fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.03em', color: INK, lineHeight: 1.1, margin: 0 }}>{title}</h1>
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', margin: '6px 0 12px' }}>{meta}</p>
        <p style={{ fontSize: '1rem', color: 'hsl(var(--muted-foreground))', maxWidth: 600, lineHeight: 1.7, margin: 0 }}>{intro}</p>
      </div>
    );
  }
  return (
    <header style={{ position: 'relative', marginBottom: 40 }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: '-60px -40px 0', zIndex: -1, background: 'radial-gradient(50% 80% at 85% 0%, rgba(255,75,51,0.13), rgba(255,75,51,0) 70%)' }} />
      <p style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: ORANGE_INK, margin: '0 0 16px' }}>
        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 11, background: '#FFF1EE', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={17} style={{ color: ORANGE }} /></span>
        {label}
      </p>
      <h1 className="[text-wrap:balance]" style={{ fontFamily: SANS, fontSize: 'clamp(40px, 5.6vw, 72px)', fontWeight: 700, letterSpacing: '-0.04em', color: INK, margin: '0 0 12px' }}>{title}</h1>
      <p style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, margin: '0 0 20px' }}>{meta}</p>
      <p className="[text-wrap:pretty]" style={{ fontSize: 19, color: MUTED, maxWidth: 680, lineHeight: 1.65, margin: 0 }}>{intro}</p>
    </header>
  );
};

export const DocSec = ({ num, Icon, title, children }: { num: string; Icon: ElementType; title: string; tag?: string; children: ReactNode }) => (
  <section
    className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5 md:gap-12"
    style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 24, padding: 'clamp(22px, 3vw, 36px)', marginBottom: 16, boxShadow: '0 24px 50px -40px rgba(20,17,15,0.4)', scrollMarginTop: 96 }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, background: '#FFF1EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} style={{ color: ORANGE }} />
      </div>
      <h2 style={{ fontSize: '1.3125rem', color: INK, lineHeight: 1.25, margin: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: '0.8em', color: ORANGE_INK, marginRight: 6 }}>{String(Number(num)).padStart(2, '0')}</span>{title}
      </h2>
    </div>
    <div style={{ fontSize: '1rem', color: 'hsl(var(--foreground) / 0.85)', lineHeight: 1.75, maxWidth: 720 }}>{children}</div>
  </section>
);
