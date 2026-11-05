import { useEffect, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

/** A card that leans toward the pointer (mouse only). Touch and keyboard users, and anyone with reduced motion, get a flat card. */
/** True only where there is a mouse (hover + fine pointer). Phones and tablets never get the 3D tilt: text inside a 3D-transformed layer can
    fail to paint while scrolling on real mobile GPUs (cards showing a title but no description), and touch has no hover to react to. */
const useMouse = () => {
  const [mouse, setMouse] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(hover: hover) and (pointer: fine)');
    const on = () => setMouse(q.matches);
    on();
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return mouse;
};

const TiltCard = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => {
  const mouse = useMouse();
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(useTransform(px, [-1, 1], [-7, 7]), { stiffness: 160, damping: 20 });
  const rotateX = useSpring(useTransform(py, [-1, 1], [6, -6]), { stiffness: 160, damping: 20 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const onLeave = () => { px.set(0); py.set(0); };

  if (!mouse || reduce) return <div style={{ height: '100%', ...style }}>{children}</div>;

  return (
    <div style={{ perspective: 900 }} onPointerMove={onMove} onPointerLeave={onLeave}>
      <motion.div style={{ rotateX, rotateY, transformStyle: 'preserve-3d', height: '100%', ...style }}>{children}</motion.div>
    </div>
  );
};

export default TiltCard;
