import type { PointerEvent } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { BadgeCheck, Bell } from 'lucide-react';
import DeviceMock from './DeviceMock';
import { GearScreen } from './AppScreens';
import { DesktopScreen, LaptopFrame, TabletFrame, TabletScreen } from './DeviceFrames';
import { CARD, INK, LINE, MUTED, ORANGE, SANS } from './tokens';

const STAGE_W = 720;
const STAGE_H = 660;

const Float = ({ icon, title, sub, style }: { icon: React.ReactNode; title: string; sub: string; style: React.CSSProperties & { z?: number } }) => (
  <motion.div
    aria-hidden="true"
    style={{ position: 'absolute', width: 210, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderRadius: 16, background: CARD, border: `1px solid ${LINE}`, boxShadow: '0 22px 40px -18px rgba(20,17,15,0.35)', fontFamily: SANS, ...style }}
  >
    <span style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF1EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{title}</span>
      <span style={{ display: 'block', fontSize: 12, color: MUTED, lineHeight: 1.3 }}>{sub}</span>
    </span>
  </motion.div>
);

/** One app on three devices: the web app on a laptop, the project board on a tablet, the chat on a phone, in 3D. The group follows the
    mouse a little and floats gently; with reduced motion it stands still. Decorative: the words beside it say the same things. */
const HeroStage = () => {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-1, 1], [-18, -2]), { stiffness: 90, damping: 18 });
  const rotateX = useSpring(useTransform(my, [-1, 1], [8, 0]), { stiffness: 90, damping: 18 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  return (
    <div
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ width: `calc(${STAGE_W}px * var(--hs, var(--s)))`, height: `calc(${STAGE_H}px * var(--hs, var(--s)))`, margin: '0 auto', position: 'relative', pointerEvents: 'auto' }}
    >
      <div style={{ width: STAGE_W, height: STAGE_H, transform: 'scale(var(--hs, var(--s)))', transformOrigin: 'top left', perspective: 1600 }}>
        <div className={reduce ? undefined : 'landing-float'} style={{ width: '100%', height: '100%' }}>
          <motion.div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', rotateX: reduce ? 4 : rotateX, rotateY: reduce ? -9 : rotateY }}>
            {/* laptop (the web app), at the back: the largest screen */}
            <motion.div style={{ position: 'absolute', left: 80, top: 20, z: -150 }}>
              <LaptopFrame><DesktopScreen /></LaptopFrame>
            </motion.div>
            {/* tablet (project space), in front on the left: mid-size */}
            <motion.div style={{ position: 'absolute', left: -30, top: 350, z: 40, rotateY: 6 }}>
              <TabletFrame><TabletScreen /></TabletFrame>
            </motion.div>
            {/* phone (marketplace), in front on the right: the smallest, as in real life (about 150 px wide against a 560 px laptop) */}
            <motion.div style={{ position: 'absolute', left: 520, top: 210, z: 110, scale: 0.56, transformOrigin: 'top left' }}>
              <DeviceMock><GearScreen /></DeviceMock>
            </motion.div>
            <Float icon={<Bell size={17} color={ORANGE} />} title="New job matches your alert" sub="Colorist · Los Angeles" style={{ right: 10, top: -20, z: 150 }} />
            <Float icon={<BadgeCheck size={17} color={ORANGE} />} title="Credit confirmed" sub="Harbour Lights · DoP" style={{ left: 430, top: 590, z: 150 }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default HeroStage;
