import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Bell, Clock, Eye, FileText, Lock, Megaphone, MessagesSquare, Star, UserPlus, Users } from 'lucide-react';
import DeviceMock, { PHONE_W } from './DeviceMock';
import { DiscussionScreen, GearScreen, JobsScreen, PitchScreen, ProfileScreen, ProjectScreen } from './AppScreens';
import { CARD, FAINT, INK, LINE, MONO, MUTED, ORANGE, ORANGE_INK, SANS, SERIF } from './tokens';

type CalloutData = { icon: ReactNode; title: string; sub: string };
type Step = { id: string; n: string; title: string; body: string; points: string[]; Screen: () => JSX.Element; tilt: number; callouts: [CalloutData, CalloutData] };

const STEPS: Step[] = [
  {
    id: 'profile', n: '01', title: 'Build a profile that proves your work', Screen: ProfileScreen, tilt: -16,
    body: 'Add your craft, showreel and credits. A project creator adds your role and you confirm it, so every credit on your profile is real.',
    points: ['Credits confirmed by the people you worked with', 'Find and connect with crew by craft', 'Verified badge for trusted profiles'],
    callouts: [{ icon: (<BadgeCheck size={18} color={ORANGE} />), title: 'Credit confirmed', sub: 'Harbour Lights · DoP' }, { icon: (<UserPlus size={18} color={ORANGE} />), title: 'New connection request', sub: 'Daniel Brooks · Director' }],
  },
  {
    id: 'work', n: '02', title: 'Find work and crew across every format', Screen: JobsScreen, tilt: 13,
    body: 'Browse jobs for films, series, ads, music videos and YouTube, or post a role of your own. Apply with the screening questions the hirer sets.',
    points: ['Deadlines, openings and shoot dates on every job', 'Job alerts that match your craft and city', 'Track every application in one place'],
    callouts: [{ icon: (<Bell size={18} color={ORANGE} />), title: 'New job matches your alert', sub: 'Colorist · Los Angeles' }, { icon: (<Eye size={18} color={ORANGE} />), title: 'Application viewed', sub: 'Lantern Pictures' }],
  },
  {
    id: 'produce', n: '03', title: 'Run the whole production in one space', Screen: ProjectScreen, tilt: -12,
    body: 'Every production gets a private project space: end-to-end encrypted chat, tasks, files, call sheets and shot lists, shared with your crew.',
    points: ['End-to-end encrypted crew chat', 'Tasks, files, call sheet and shot list', 'Start a call with your crew from the space'],
    callouts: [{ icon: (<Lock size={18} color={ORANGE} />), title: 'End-to-end encrypted', sub: 'Only your crew can read it' }, { icon: (<FileText size={18} color={ORANGE} />), title: 'Call sheet updated', sub: 'Day 12 · 6:30 AM' }],
  },
  {
    id: 'gear', n: '04', title: 'Rent the gear you need, from verified vendors', Screen: GearScreen, tilt: 14,
    body: 'Rent cameras, lenses and lighting from verified studios and vendors. Compare listings, read reviews and ask for a quote.',
    points: ['Verified vendors with ratings and reviews', 'Ask for a quote and check availability', 'Compare listings and read reviews first'],
    callouts: [{ icon: (<Star size={18} color={ORANGE} />), title: 'Quote received', sub: '$950 / day' }, { icon: (<BadgeCheck size={18} color={ORANGE} />), title: 'Verified vendor', sub: 'Frameworks Rentals' }],
  },
  {
    id: 'pitch', n: '05', title: 'Pitch your story and tell the network', Screen: PitchScreen, tilt: -10,
    body: 'Send your pitch, showreel and deck straight to producers and studios. Studios and creators announce casting calls and festival news to their followers.',
    points: ['Pitch to producers, brands and studios', 'Announcements with scheduling and expiry', 'Studio pages to show your portfolio'],
    callouts: [{ icon: (<Megaphone size={18} color={ORANGE} />), title: 'Casting call posted', sub: 'Lantern Pictures' }, { icon: (<Clock size={18} color={ORANGE} />), title: 'Open call closes soon', sub: 'Short film series · 30 Nov' }],
  },
  {
    id: 'rooms', n: '06', title: "Join your craft's community", Screen: DiscussionScreen, tilt: 12,
    body: 'Every craft has its own discussion rooms. Ask a question, share your work, learn a technique, or meet the people you might work with next.',
    points: ['Rooms for every craft, public or private', 'Share work and get notes from your peers', 'Meet collaborators before you work together'],
    callouts: [{ icon: (<MessagesSquare size={18} color={ORANGE} />), title: 'New reply in Cinematography Lounge', sub: '3 people answered' }, { icon: (<Users size={18} color={ORANGE} />), title: 'Room invite', sub: "Editors' Cut · private room" }],
  },
];

const Callout = ({ c, style }: { c: CalloutData; style: React.CSSProperties & { z?: number } }) => (
  <motion.div
    aria-hidden="true"
    initial={{ opacity: 0, scale: 0.92, y: 12 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.96 }}
    transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    style={{ position: 'absolute', width: 214, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 16, background: CARD, border: `1px solid ${LINE}`, boxShadow: '0 22px 40px -18px rgba(20,17,15,0.35)', fontFamily: SANS, ...style }}
  >
    <span style={{ width: 34, height: 34, borderRadius: 10, background: '#FFF1EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</span>
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{c.title}</span>
      <span style={{ display: 'block', fontSize: 12, color: MUTED, lineHeight: 1.3 }}>{c.sub}</span>
    </span>
  </motion.div>
);

/** The how-it-works section: pick a step and the 3D phone turns to that part of the app. Controlled by the visitor (no scroll-jacking),
    keyboard friendly, and with reduced motion the phone just swaps screens. */
const Walkthrough = () => {
  const reduce = useReducedMotion();
  // /?step=3 opens the walkthrough on that step (1 to 5), so a step can be linked to
  const [active, setActive] = useState(() => {
    const n = typeof window === 'undefined' ? NaN : Number(new URLSearchParams(window.location.search).get('step'));
    return Number.isInteger(n) && n >= 1 && n <= STEPS.length ? n - 1 : 0;
  });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const step = STEPS[active];

  const select = (i: number, focus = false) => {
    setActive(i);
    if (focus) tabRefs.current[i]?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (i + 1) % STEPS.length : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (i + STEPS.length - 1) % STEPS.length : e.key === 'Home' ? 0 : e.key === 'End' ? STEPS.length - 1 : -1;
    if (next >= 0) { e.preventDefault(); select(next, true); }
  };

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="max-w-[1280px] mx-auto px-6 md:px-12 py-20 md:py-28" style={{ scrollMarginTop: 56 }}>
      <div style={{ maxWidth: 720, marginBottom: 48 }}>
        <p style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: ORANGE_INK, margin: '0 0 14px' }}>How it works</p>
        <h2 id="how-title" className="[text-wrap:balance]" style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(34px, 4.6vw, 60px)', lineHeight: 1.04, letterSpacing: '-0.03em', color: INK, margin: '0 0 16px' }}>
          From first credit to <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: ORANGE_INK }}>final cut</span>.
        </h2>
        <p className="[text-wrap:pretty]" style={{ fontSize: 18, color: MUTED, lineHeight: 1.6, margin: 0 }}>
          Pick a step and watch the app. These are example screens, so you can see how it works before you join.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-10 xl:gap-16 items-start">
        {/* steps */}
        <div role="tablist" aria-label="How CineCraft Connect works" aria-orientation="vertical" className="order-2 xl:order-1" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <div key={s.id} style={{ borderRadius: 20, border: `1px solid ${on ? ORANGE : LINE}`, background: on ? CARD : 'transparent', boxShadow: on ? '0 24px 44px -26px rgba(255,75,51,0.55)' : 'none', transition: 'background-color 200ms, border-color 200ms, box-shadow 200ms' }}>
                <button
                  ref={(el) => { tabRefs.current[i] = el; }}
                  role="tab"
                  id={`step-tab-${s.id}`}
                  aria-selected={on}
                  aria-controls="step-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => select(i)}
                  onKeyDown={(e) => onKey(e, i)}
                  className="landing-focus"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', padding: '16px 18px', minHeight: 60, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 20, fontFamily: SANS }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: on ? ORANGE_INK : FAINT, fontVariantNumeric: 'tabular-nums' }}>{s.n}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: INK, letterSpacing: '-0.015em', lineHeight: 1.25 }}>{s.title}</span>
                </button>
                <div style={{ display: 'grid', gridTemplateRows: on ? '1fr' : '0fr', transition: reduce ? 'none' : 'grid-template-rows 320ms cubic-bezier(0.22,1,0.36,1)' }}>
                  <div style={{ overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ padding: '0 18px 18px 47px' }}>
                      <p className="[text-wrap:pretty]" style={{ fontSize: 16, color: MUTED, lineHeight: 1.6, margin: '0 0 12px' }}>{s.body}</p>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                        {s.points.map((p) => (
                          <li key={p} style={{ display: 'flex', gap: 9, fontSize: 15, color: INK, lineHeight: 1.45 }}>
                            <BadgeCheck size={17} color={ORANGE} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* the 3D phone */}
        <div role="tabpanel" id="step-panel" aria-labelledby={`step-tab-${step.id}`} className="order-1 xl:order-2 xl:sticky xl:top-24">
          <div style={{ width: 'calc(600px * var(--s))', height: 'calc(660px * var(--s))', position: 'relative', left: '50%', transform: 'translateX(-50%)' }}>
            <div style={{ width: 600, height: 660, transform: 'scale(var(--s))', transformOrigin: 'top left', perspective: 1600 }}>
              <div className={reduce ? undefined : 'landing-float'} style={{ width: '100%', height: '100%' }}>
                <motion.div
                  animate={{ rotateY: step.tilt, rotateX: 5 }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 70, damping: 15 }}
                  style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
                >
                  <div style={{ position: 'absolute', left: (600 - PHONE_W) / 2, top: 20 }}>
                    <DeviceMock>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={step.id}
                          initial={reduce ? false : { opacity: 0, x: 26 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={reduce ? undefined : { opacity: 0, x: -26 }}
                          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                          style={{ position: 'absolute', inset: 0 }}
                        >
                          <step.Screen />
                        </motion.div>
                      </AnimatePresence>
                    </DeviceMock>
                  </div>
                  <AnimatePresence>
                    <Callout key={`${step.id}-a`} c={step.callouts[0]} style={{ left: 4, top: 150, z: 120 }} />
                    <Callout key={`${step.id}-b`} c={step.callouts[1]} style={{ right: 4, top: 430, z: 150 }} />
                  </AnimatePresence>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Walkthrough;
