import type { ReactNode } from 'react';

export const PHONE_W = 288;
export const PHONE_H = 600;

/** A phone frame drawn in CSS. Decorative: the text beside it says everything it shows. */
const DeviceMock = ({ children }: { children: ReactNode }) => (
  <div aria-hidden="true" style={{ width: PHONE_W, height: PHONE_H, position: 'relative', flexShrink: 0 }}>
    {/* side buttons */}
    <span style={{ position: 'absolute', left: -3, top: 120, width: 3, height: 34, borderRadius: 2, background: '#26262a' }} />
    <span style={{ position: 'absolute', left: -3, top: 168, width: 3, height: 58, borderRadius: 2, background: '#26262a' }} />
    <span style={{ position: 'absolute', right: -3, top: 150, width: 3, height: 80, borderRadius: 2, background: '#26262a' }} />
    <div
      style={{
        width: '100%', height: '100%', borderRadius: 46, padding: 9, boxSizing: 'border-box',
        background: 'linear-gradient(145deg, #34343a, #0b0b0d 60%)',
        boxShadow: '0 70px 90px -34px rgba(20,17,15,0.5), 0 34px 50px -26px rgba(255,75,51,0.35), inset 0 0 0 1.5px rgba(255,255,255,0.14)',
      }}
    >
      <div style={{ width: '100%', height: '100%', borderRadius: 37, overflow: 'hidden', background: '#F8F9FA', position: 'relative' }}>
        {children}
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 84, height: 24, borderRadius: 14, background: '#0b0b0d', zIndex: 5 }} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none', background: 'linear-gradient(115deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 36%)' }} />
      </div>
    </div>
  </div>
);

export default DeviceMock;
