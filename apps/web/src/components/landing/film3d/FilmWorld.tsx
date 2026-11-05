import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';
import { buildWorld } from './world';
import { setFilmState } from './filmStore';
import { BG } from '../tokens';

/* The landing page background: how a film is made, as 24 craft characters in a 3D world.
   The camera follows the page's own scroll position, nothing is pinned or hijacked:
     - on the hero it hangs high above the studio and slowly drops,
     - through the "How a film gets made" section (#film-journey) it flies along the path, one craft at a time,
     - after that section the page has solid sections on top, so drawing stops.
   It is decoration (hidden from assistive technology; the journey panel carries the same words as real text). With reduced motion the
   camera still follows the scroll, but without smoothing or idle animation. */
const JOURNEY_ID = 'film-journey';
const LAST = 25;       // t of the final shot (the cinema)
const FIRST_STOP = 0.6; // t when the camera reaches the first craft

const FilmWorld = () => {
  const mount = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

    const world = buildWorld();
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 768 ? 1.25 : 1.6));
      renderer.setSize(w, h, false);
      world.resize(w, h);
    };
    fit();
    window.addEventListener('resize', fit);

    const debug = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
    const debugStop = debug?.get('st') ?? null;
    // development only: ?st=<0..25> jumps the camera; &nohero=1 hides the hero so the journey panel is in view without scrolling; &bare=1 hides the page
    const scrollTo = debug?.get('scrollto');
    if (scrollTo) setTimeout(() => {
      window.scrollTo({ top: Number(scrollTo), behavior: 'instant' as ScrollBehavior });
    }, 600);
    if (debug?.get('nohero')) document.querySelectorAll<HTMLElement>('.landing-root > header').forEach((el) => { el.style.display = 'none'; });
    if (debug?.get('bare')) {
      document.querySelectorAll<HTMLElement>('.landing-root > *').forEach((el) => { if (!el.querySelector('.film3d-canvas')) el.style.visibility = 'hidden'; });
    }

    // where the camera should be along the journey (0..25), and whether the story is on screen at all
    const read = () => {
      if (debugStop !== null) return { goal: Number(debugStop), visible: true };
      const j = document.getElementById(JOURNEY_ID);
      const y = window.scrollY;
      if (!j) return { goal: 0, visible: true };
      const top = j.getBoundingClientRect().top + y;
      const span = Math.max(j.offsetHeight - window.innerHeight, 1);
      if (y < top) return { goal: FIRST_STOP * Math.min(Math.max(y / Math.max(top, 1), 0), 1), visible: true };
      const p = Math.min((y - top) / span, 1);
      return { goal: FIRST_STOP + (LAST - FIRST_STOP) * p, visible: y - top < span + window.innerHeight };
    };

    let t = read().goal;
    let lastActive = -2;
    let raf = 0;
    let clock = performance.now();
    let stopped = false;
    let shown = false;

    const tick = (now: number) => {
      if (stopped) return;
      const dt = Math.min((now - clock) / 1000, 0.1);
      clock = now;
      const { goal, visible } = read();
      t = reduce ? goal : t + (goal - t) * (1 - Math.exp(-dt * 4.5));
      if (visible) {
        const a = world.frame(reduce ? 0 : now / 1000, t, reduce);
        if (a !== lastActive) {
          lastActive = a;
          setFilmState({ active: a, stage: a >= 0 ? 'craft' : t < 12 ? 'intro' : 'outro' });
        }
        renderer.render(world.scene, world.camera);
        if (!shown) { shown = true; host.style.opacity = '1'; setFilmState({ ready: true }); }
      }
      raf = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { clock = performance.now(); raf = requestAnimationFrame(tick); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', onVisibility);
      world.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      setFilmState({ ready: false, active: -1, stage: 'intro' });
    };
  }, [reduce]);

  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: BG }}>
      <div ref={mount} className="film3d-canvas" style={{ position: 'absolute', inset: 0, opacity: 0, transition: 'opacity 700ms ease' }} />
    </div>
  );
};

export default FilmWorld;
