import * as THREE from 'three';
import { Anim, PropResult, at, box, cone, cyl, mesh, sph, torus } from './kit';
import type { PropId } from './crafts';

/* The tool of each craft, drawn from simple shapes. A character faces +z (toward the camera). Each builder returns the prop and
   any idle animations (spinning, bobbing, blinking). Colours stay in the brand's warm range with neutral darks. */
const ORANGE = 0xff4b33;
const CREAM = 0xf4f0ea;
const DARK = 0x2b2b30;
const WOOD = 0x8a6a46;

const result = (): { g: THREE.Group; anims: Anim[] } => ({ g: new THREE.Group(), anims: [] });

const table = (g: THREE.Group, w: number, d: number, y: number, z: number, x = 0) => {
  g.add(at(box(w, 0.05, d, WOOD), x, y, z));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(0.025, 0.025, y, 0x5a4a38), x + sx * (w / 2 - 0.05), y / 2, z + sz * (d / 2 - 0.05)));
};

const headphones = (g: THREE.Group, y = 1.69) => {
  g.add(at(torus(0.128, 0.012, DARK, {}, Math.PI), 0, y, 0, 0, 0, 0));
  g.add(at(cyl(0.05, 0.05, 0.034, ORANGE), 0.126, y - 0.012, 0, 0, 0, Math.PI / 2));
  g.add(at(cyl(0.05, 0.05, 0.034, ORANGE), -0.126, y - 0.012, 0, 0, 0, Math.PI / 2));
};

const note = (hex: number) => {
  const n = new THREE.Group();
  n.add(sph(0.06, hex));
  n.add(at(cyl(0.01, 0.01, 0.22, hex), 0.05, 0.12, 0));
  n.add(at(box(0.1, 0.03, 0.01, hex), 0.09, 0.22, 0));
  return n;
};

export const PROPS: Partial<Record<PropId, () => PropResult>> = {
  laptop() {
    const { g, anims } = result();
    // the base sits in front of the person; the screen is at the far edge, facing the person (so we see the lid and a glowing logo)
    g.add(at(box(0.5, 0.03, 0.36, DARK), 0, 1.02, 0.44));
    g.add(at(box(0.5, 0.34, 0.025, 0x3a3a40), 0, 1.2, 0.62, 0.22));
    g.add(at(cyl(0.05, 0.05, 0.006, ORANGE, { emissive: ORANGE, glow: 0.7 }), 0, 1.2, 0.638, Math.PI / 2 + 0.22));
    g.add(at(box(0.44, 0.28, 0.005, 0xff9a86, { emissive: ORANGE, glow: 0.45 }), 0, 1.2, 0.604, 0.22));
    const pages = [0, 1, 2].map(() => { const p = box(0.15, 0.2, 0.004, 0xffffff); g.add(p); return p; });
    anims.push((t) => pages.forEach((p, i) => {
      const a = t * 0.8 + i * 2.1;
      p.position.set(Math.cos(a) * 0.62, 1.78 + Math.sin(t + i) * 0.05, Math.sin(a) * 0.4 + 0.15);
      p.rotation.set(0.2, -a + Math.PI / 2, Math.sin(t + i) * 0.15);
    }));
    return { group: g, anims };
  },

  briefcase() {
    const { g, anims } = result();
    g.add(at(box(0.42, 0.3, 0.12, 0x7a4a2a), 0.4, 0.42, 0.14));
    g.add(at(torus(0.07, 0.012, 0x3a3631, {}, Math.PI), 0.4, 0.57, 0.14));
    g.add(at(box(0.045, 0.095, 0.012, 0x1d1a18, { rough: 0.3 }), -0.25, 1.64, 0.07, 0, 0.25, 0.12));
    g.add(at(box(0.06, 0.04, 0.125, 0xe8b83a, { metal: 0.6 }), 0.4, 0.47, 0.14));
    const coins = [0, 1, 2].map((i) => { const c = cyl(0.055, 0.055, 0.014, 0xe8b83a, { metal: 0.6, rough: 0.3 }, 24); c.rotation.x = Math.PI / 2; g.add(c); return c; });
    anims.push((t) => coins.forEach((c, i) => { c.position.set(0.62 + i * 0.03, 1.2 + i * 0.2 + Math.sin(t * 1.6 + i) * 0.04, 0.25); c.rotation.z = t * 1.8 + i; }));
    return { group: g, anims };
  },

  megaphone() {
    const { g, anims } = result();
    const mp = new THREE.Group();
    mp.add(at(cyl(0.17, 0.06, 0.38, ORANGE), 0, 0, 0.2, Math.PI / 2));
    mp.add(at(cyl(0.065, 0.065, 0.09, DARK), 0, 0, -0.02, Math.PI / 2));
    mp.add(at(cyl(0.026, 0.026, 0.14, DARK), 0, -0.1, 0.04));
    g.add(at(mp, 0.1, 1.56, 0.26, 0, -0.95));
    // the director's chair
    const chair = new THREE.Group();
    chair.add(at(box(0.55, 0.04, 0.45, 0xc9a36a), 0, 0.55, 0));
    chair.add(at(box(0.55, 0.4, 0.04, 0x8a4b2a), 0, 0.86, -0.22));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) chair.add(at(cyl(0.02, 0.02, 0.55, WOOD), sx * 0.26, 0.275, sz * 0.2));
    chair.add(at(box(0.5, 0.05, 0.05, WOOD), 0, 1.07, -0.22));
    g.add(at(chair, -1.05, 0, 0.1, 0, 0.5));
    anims.push((t) => { g.rotation.y = Math.sin(t * 0.6) * 0.03; });
    return { group: g, anims };
  },

  clipboard() {
    const { g, anims } = result();
    const board = new THREE.Group();
    board.add(box(0.3, 0.4, 0.025, WOOD));
    board.add(at(box(0.26, 0.34, 0.005, 0xffffff), 0, 0, 0.016));
    [-0.07, 0.07].forEach((x, i) => board.add(at(box(0.08, 0.09, 0.006, [0xff9a86, 0x86b9ff][i]), x, 0.08, 0.02)));
    board.add(at(box(0.18, 0.012, 0.006, 0x3a3631), 0, -0.03, 0.02));
    board.add(at(box(0.18, 0.012, 0.006, 0x3a3631), 0, -0.07, 0.02));
    g.add(at(board, -0.3, 1.2, 0.42, -0.35));
    const cards = [0, 1, 2].map((i) => { const c = new THREE.Group(); c.add(box(0.12, 0.15, 0.01, 0xffffff)); c.add(at(box(0.09, 0.09, 0.012, [0xff9a86, 0x86b9ff, 0xffd34a][i]), 0, 0.015, 0.006)); g.add(c); return c; });
    anims.push((t) => cards.forEach((c, i) => { c.position.set(0.8 + (i - 1) * 0.02, 1.2 + i * 0.28 + Math.sin(t * 1.3 + i) * 0.05, 0.25); c.rotation.y = Math.sin(t * 0.9 + i) * 0.5; }));
    return { group: g, anims };
  },

  mapPin() {
    const { g, anims } = result();
    table(g, 1.0, 0.7, 0.5, 0.7);
    g.add(at(box(0.9, 0.012, 0.6, 0xf1e6cf), 0, 0.535, 0.7));
    [[-0.2, 0.7, 0.3, 0.2], [0, 0.78, 0.35, -0.5], [0.22, 0.62, 0.3, 0.3]].forEach(([x, z, w, r]) => g.add(at(box(w, 0.014, 0.025, ORANGE), x, 0.545, z, 0, r)));
    const pin = new THREE.Group();
    pin.add(at(sph(0.13, ORANGE), 0, 0.28, 0));
    pin.add(at(cone(0.1, 0.3, ORANGE), 0, 0.1, 0, Math.PI));
    pin.add(at(sph(0.045, 0xffffff), 0, 0.28, 0.1));
    pin.scale.setScalar(0.62);
    g.add(pin);
    anims.push((t) => pin.position.set(0.15, 0.62 + Math.sin(t * 2) * 0.04, 0.7));
    return { group: g, anims };
  },

  easel() {
    const { g } = result();
    const e = new THREE.Group();
    e.add(at(box(0.72, 0.5, 0.03, CREAM), 0, 1.15, 0.56, -0.3));
    [[-0.17, 0.08], [0.17, 0.08], [-0.17, -0.12], [0.17, -0.12]].forEach(([x, y]) => e.add(at(box(0.28, 0.17, 0.005, 0xdcd6cc), x, 1.15 + y * 0.96, 0.58 + y * 0.28, -0.3)));
    [[-0.17, 0.08], [0.17, -0.12]].forEach(([x, y]) => e.add(at(box(0.1, 0.06, 0.006, ORANGE), x, 1.15 + y * 0.96, 0.59 + y * 0.28, -0.3)));
    for (const sx of [-1, 1]) e.add(at(cyl(0.02, 0.02, 1.35, WOOD), sx * 0.3, 0.68, 0.5, -0.08));
    e.add(at(cyl(0.02, 0.02, 1.0, WOOD), 0, 0.5, 0.18, 0.3));
    g.add(at(e, 0.78, 0, -0.12, 0, -0.45));
    return { group: g, anims: [] };
  },

  setModel() {
    const { g, anims } = result();
    table(g, 0.9, 0.6, 0.52, 0.62);
    const house = new THREE.Group();
    house.add(at(box(0.4, 0.22, 0.3, 0xe8e2d9), 0, 0.11, 0));
    house.add(at(cone(0.32, 0.2, ORANGE, {}, 4), 0, 0.32, 0, 0, Math.PI / 4));
    house.add(at(box(0.07, 0.12, 0.01, 0x6a5a48), 0, 0.06, 0.155));
    [-0.12, 0.12].forEach((x) => house.add(at(box(0.07, 0.07, 0.01, 0x86b9ff), x, 0.13, 0.155)));
    g.add(at(house, 0, 0.545, 0.62));
    [0xff4b33, 0xffc247, 0x7ed957, 0x5a7aff].forEach((c, i) => g.add(at(box(0.07, 0.012, 0.1, c), -0.3 + i * 0.09, 0.552, 0.82, 0, 0.2)));
    anims.push((t) => { house.rotation.y = Math.sin(t * 0.5) * 0.25; });
    return { group: g, anims };
  },

  mannequin() {
    const { g } = result();
    const m = new THREE.Group();
    m.add(at(cyl(0.02, 0.02, 1.3, 0x6a6258), 0, 0.65, 0));
    m.add(at(cyl(0.2, 0.22, 0.03, 0x6a6258), 0, 0.02, 0));
    m.add(at(cyl(0.13, 0.19, 0.5, CREAM), 0, 1.1, 0));
    m.add(at(cyl(0.17, 0.36, 0.72, ORANGE), 0, 0.72, 0));
    m.add(at(sph(0.07, CREAM), 0, 1.42, 0));
    m.add(at(box(0.2, 0.03, 0.18, 0xf2c94c), 0, 0.99, 0));
    g.add(at(m, -0.85, 0, 0.3, 0, 0.4));
    g.add(at(torus(0.215, 0.02, 0xf2c94c), 0, 1.4, 0, Math.PI / 2));
    return { group: g, anims: [] };
  },

  palette() {
    const { g, anims } = result();
    const p = new THREE.Group();
    p.add(cyl(0.22, 0.22, 0.02, 0xd8b080, {}, 28));
    [0xff4b33, 0xffc247, 0x7ed957, 0x5a7aff, 0xc15ae0].forEach((c, i) => { const a = i * 1.1 - 1; p.add(at(sph(0.035, c), Math.cos(a) * 0.13, 0.025, Math.sin(a) * 0.13)); });
    g.add(at(p, -0.32, 1.1, 0.4, -0.9));
    g.add(at(cyl(0.012, 0.012, 0.28, DARK), 0.3, 1.22, 0.42, 0.5, 0, 0.5));
    g.add(at(cyl(0.017, 0.004, 0.07, ORANGE), 0.38, 1.35, 0.47, 0.5, 0, 0.5));
    g.add(at(cyl(0.02, 0.02, 1.9, DARK), 0.95, 0.95, -0.3));
    g.add(at(cyl(0.16, 0.16, 0.02, DARK), 0.95, 0.02, -0.3));
    const ring = at(torus(0.38, 0.04, 0xffffff, { emissive: 0xfff2dd, glow: 0.9 }), 0.95, 1.75, -0.3);
    g.add(ring);
    anims.push((t) => { (ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.1; });
    return { group: g, anims };
  },

  walkie() {
    const { g, anims } = result();
    g.add(at(box(0.09, 0.2, 0.05, 0x1d1a18), 0.16, 1.62, 0.3));
    g.add(at(cyl(0.01, 0.01, 0.14, 0x1d1a18), 0.19, 1.79, 0.3));
    const led = at(sph(0.012, 0x7ed957, { emissive: 0x7ed957, glow: 1 }), 0.16, 1.7, 0.33);
    g.add(led);
    const board = new THREE.Group();
    board.add(box(0.28, 0.36, 0.022, WOOD));
    board.add(at(box(0.24, 0.3, 0.005, 0xffffff), 0, 0, 0.014));
    [0.09, 0.03, -0.03, -0.09].forEach((y, i) => board.add(at(box(0.15 + (i % 2) * 0.04, 0.012, 0.006, i === 0 ? ORANGE : 0x3a3631), 0, y, 0.02)));
    g.add(at(board, -0.3, 1.15, 0.42, -0.35));
    const watch = new THREE.Group();
    watch.add(at(cyl(0.07, 0.07, 0.03, CREAM), 0, 0, 0, Math.PI / 2));
    watch.add(at(torus(0.07, 0.008, ORANGE), 0, 0, 0));
    g.add(at(watch, -0.6, 1.0, 0.35));
    anims.push((t) => { (led.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + (Math.sin(t * 6) > 0 ? 0.7 : 0); });
    return { group: g, anims };
  },

  camera() {
    const { g, anims } = result();
    const cam = new THREE.Group();
    cam.add(box(0.26, 0.24, 0.46, DARK));
    cam.add(at(box(0.05, 0.05, 0.3, DARK), 0, 0.15, 0.02));
    cam.add(at(cyl(0.085, 0.085, 0.3, 0x111111), 0, 0, 0.37, Math.PI / 2));
    cam.add(at(cyl(0.1, 0.1, 0.03, ORANGE), 0, 0, 0.53, Math.PI / 2));
    cam.add(at(box(0.22, 0.18, 0.1, 0x1d1a18), 0, 0, 0.6));
    cam.add(at(box(0.16, 0.11, 0.02, 0x2f3a6a, { emissive: 0x5a7aff, glow: 0.5 }), -0.17, 0.05, 0.05));
    const rec = at(sph(0.02, 0xff2a1a, { emissive: 0xff2a1a, glow: 1 }), 0.09, 0.09, -0.1);
    cam.add(rec);
    g.add(at(cam, 0.24, 1.6, 0.18));
    anims.push((t) => { (rec.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 4) > 0 ? 1.2 : 0.1; });
    return { group: g, anims };
  },

  lens() {
    const { g, anims } = result();
    const lens = new THREE.Group();
    lens.add(at(cyl(0.1, 0.1, 0.34, DARK), 0, 0, 0, Math.PI / 2));
    [-0.1, 0, 0.1].forEach((z, i) => lens.add(at(torus(0.104, 0.012, i === 1 ? ORANGE : CREAM), 0, 0, z)));
    lens.add(at(cyl(0.07, 0.07, 0.02, 0x4a6aa0, { metal: 0.5, rough: 0.2 }), 0, 0, 0.17, Math.PI / 2));
    g.add(at(lens, 0, 1.12, 0.46));
    g.add(at(torus(0.12, 0.03, 0xf2c94c), 0.32, 0.92, 0.1, Math.PI / 2));
    // the slate that gets clapped
    const slate = new THREE.Group();
    slate.add(box(0.36, 0.28, 0.02, 0x1d1a18));
    [-0.1, 0.1].forEach((y) => slate.add(at(box(0.3, 0.012, 0.022, CREAM), 0, y - 0.02, 0.002)));
    const arm = new THREE.Group();
    arm.add(at(box(0.36, 0.06, 0.025, 0x1d1a18), 0.18, 0, 0));
    [0.05, 0.15, 0.25, 0.33].forEach((x, i) => arm.add(at(box(0.04, 0.06, 0.027, i % 2 ? CREAM : ORANGE), x, 0, 0)));
    slate.add(at(arm, -0.18, 0.17, 0));
    g.add(at(slate, -0.8, 0.5, 0.3, 0, 0.2));
    g.add(at(box(0.5, 0.36, 0.3, 0x5a4a38), -0.8, 0.18, 0.28, 0, 0.2));
    anims.push((t) => { const c = (t % 3) / 3; arm.rotation.z = c < 0.12 ? -0.5 + (c / 0.12) * 0.5 : -0.5 * Math.max(0, 1 - (c - 0.12) * 4) ; });
    return { group: g, anims };
  },

  light() {
    const { g, anims } = result();
    g.add(at(cyl(0.02, 0.02, 2.3, DARK), 0.95, 1.15, 0.1));
    [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2; g.add(at(cyl(0.015, 0.015, 0.8, DARK), 0.95 + Math.cos(a) * 0.3, 0.38, 0.1 + Math.sin(a) * 0.3, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35)); });
    const lamp = new THREE.Group();
    lamp.add(at(cyl(0.22, 0.22, 0.3, 0xd89a3a), 0, 0, 0, Math.PI / 2));
    lamp.add(at(cyl(0.2, 0.2, 0.02, 0xfff2cc, { emissive: 0xffe9b0, glow: 1.1 }), 0, 0, 0.16, Math.PI / 2));
    [[0, 0.26], [0, -0.26]].forEach(([x, y]) => lamp.add(at(box(0.3, 0.02, 0.12, DARK), x, y, 0.2)));
    g.add(at(lamp, 0.95, 2.2, 0.1, 0.35, -0.35));
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.2, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    beam.geometry.translate(0, -1.1, 0);
    beam.rotation.set(Math.PI / 2 + 0.55, 0, 0.35);
    beam.position.set(0.92, 2.15, 0.28);
    g.add(beam);
    g.add(at(torus(0.12, 0.03, 0x1d1a18), -0.32, 0.92, 0.12, Math.PI / 2));
    anims.push((t) => { (beam.material as THREE.MeshBasicMaterial).opacity = 0.11 + Math.sin(t * 2.4) * 0.025; });
    return { group: g, anims };
  },

  dolly() {
    const { g, anims } = result();
    [-0.35, 0.35].forEach((x) => g.add(at(box(0.06, 0.04, 2.3, 0x8a8f99, { metal: 0.6 }), x, 0.03, 0.75)));
    const rig = new THREE.Group();
    rig.add(at(box(1.0, 0.08, 0.7, DARK), 0, 0.28, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rig.add(at(cyl(0.1, 0.1, 0.06, 0x111111), sx * 0.35, 0.12, sz * 0.25, 0, 0, Math.PI / 2));
    rig.add(at(box(0.3, 0.24, 0.4, DARK), 0, 0.5, 0));
    rig.add(at(cyl(0.075, 0.075, 0.26, 0x111111), 0, 0.5, 0.3, Math.PI / 2));
    rig.add(at(cyl(0.09, 0.09, 0.03, ORANGE), 0, 0.5, 0.44, Math.PI / 2));
    rig.add(at(cyl(0.02, 0.02, 0.8, DARK), 0, 0.68, -0.38, -0.5));
    g.add(rig);
    anims.push((t) => { rig.position.set(0, 0, 0.72 + Math.sin(t * 0.7) * 0.25); });
    // a flag on a stand
    g.add(at(cyl(0.015, 0.015, 1.6, DARK), 0.95, 0.8, 0.2));
    g.add(at(box(0.5, 0.45, 0.012, 0x1d1a18), 0.95, 1.45, 0.2));
    return { group: g, anims };
  },

  boom() {
    const { g, anims } = result();
    headphones(g);
    const pole = new THREE.Group();
    pole.add(at(cyl(0.018, 0.018, 2.0, DARK), 0, 0, 0, Math.PI / 2));
    const furry = at(cyl(0.07, 0.07, 0.3, 0xc9c4bb, { rough: 1 }), 0, 0, 1.02, Math.PI / 2);
    pole.add(furry);
    for (let i = 0; i < 14; i++) { const a = i * 2.4; pole.add(at(sph(0.025, 0xd9d4cb, { rough: 1 }), Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0.92 + (i % 5) * 0.06)); }
    g.add(at(pole, 0, 2.02, 0.62));
    const bag = new THREE.Group();
    bag.add(box(0.3, 0.22, 0.12, DARK));
    const bars = [0, 1, 2].map((i) => { const b = box(0.03, 0.08, 0.01, 0x7ed957, { emissive: 0x7ed957, glow: 0.8 }); b.position.set(-0.07 + i * 0.07, 0, 0.065); bag.add(b); return b; });
    g.add(at(bag, -0.34, 0.96, 0.1));
    anims.push((t) => { pole.rotation.y = Math.sin(t * 0.8) * 0.12; bars.forEach((b, i) => { b.scale.y = 0.5 + Math.abs(Math.sin(t * 5 + i * 1.7)) * 1.2; }); });
    return { group: g, anims };
  },

  mask() {
    const { g, anims } = result();
    const face = (hex: number, smile: boolean) => {
      const f = new THREE.Group();
      f.add(at(mesh(new THREE.SphereGeometry(0.17, 20, 14), hex), 0, 0, 0));
      f.children[0].scale.set(1, 1.15, 0.38);
      [-0.06, 0.06].forEach((x) => f.add(at(sph(0.022, 0x1d1a18), x, 0.04, 0.06)));
      f.add(at(torus(0.07, 0.012, 0x1d1a18, {}, Math.PI), 0, smile ? -0.03 : -0.1, 0.065, 0, 0, smile ? Math.PI : 0));
      return f;
    };
    const m1 = face(CREAM, true);
    const m2 = face(ORANGE, false);
    g.add(m1, m2);
    anims.push((t) => { m1.position.set(-0.82, 1.62 + Math.sin(t * 1.4) * 0.03, 0.28); m1.rotation.z = 0.3; m2.position.set(0.8, 1.35 + Math.sin(t * 1.4 + 1) * 0.03, 0.3); m2.rotation.z = -0.3; });
    g.add(at(cyl(0.9, 0.9, 0.012, 0xfff2cc, { emissive: 0xffe9b0, glow: 0.2, opacity: 0.55 }, 36), 0, 0.01, 0));
    return { group: g, anims };
  },

  dancer() {
    const { g, anims } = result();
    const notes = [0xff4b33, 0xffc247, 0x7a5ac8, 0x5a7aff].map((c) => { const n = note(c); g.add(n); return n; });
    anims.push((t) => notes.forEach((n, i) => { const a = t * 0.9 + i * 1.6; n.position.set(Math.cos(a) * 0.95, 1.2 + (i % 2) * 0.5 + Math.sin(t * 2 + i) * 0.1, Math.sin(a) * 0.5 + 0.1); n.rotation.y = -a; }));
    g.add(at(cyl(0.9, 0.9, 0.012, 0xe6dcff, { opacity: 0.6 }, 36), 0, 0.01, 0));
    return { group: g, anims };
  },

  stunt() {
    const { g, anims } = result();
    const helmet = new THREE.Group();
    helmet.add(mesh(new THREE.SphereGeometry(0.14, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), ORANGE, { rough: 0.35 }));
    helmet.add(at(box(0.15, 0.05, 0.03, 0x1d1a18, { rough: 0.2 }), 0, -0.035, 0.105));
    helmet.add(at(box(0.025, 0.025, 0.27, CREAM), 0, 0.138, 0));
    g.add(at(helmet, 0, 1.69 - 0.12, -0.005)); // the stunt pose crouches by 0.12
    g.add(at(box(1.3, 0.3, 0.9, 0x3a6ab0), 1.0, 0.15, 0.3, 0, -0.3));
    [[-1.0, 0.4], [-1.25, 0.1]].forEach(([x, z]) => { g.add(at(cone(0.12, 0.3, 0xff7a1a), x, 0.15, z)); g.add(at(cyl(0.08, 0.1, 0.05, CREAM), x, 0.18, z)); });
    const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffa23a }));
    g.add(spark);
    anims.push((t) => { spark.position.set(-0.9, 1.35 + Math.sin(t * 3) * 0.05, 0.3); spark.rotation.set(t, t * 1.3, 0); spark.scale.setScalar(1 + Math.sin(t * 6) * 0.2); });
    return { group: g, anims };
  },

  continuity() {
    const { g, anims } = result();
    const board = new THREE.Group();
    board.add(box(0.3, 0.4, 0.025, WOOD));
    board.add(at(box(0.26, 0.34, 0.005, 0xffffff), 0, 0, 0.016));
    [0.1, 0.04, -0.02, -0.08].forEach((y) => board.add(at(box(0.18, 0.012, 0.006, 0x3a3631), 0, y, 0.02)));
    g.add(at(board, -0.3, 1.2, 0.42, -0.35));
    g.add(at(cyl(0.012, 0.012, 0.2, 0x3a3631), 0.3, 1.12, 0.42, 0.5, 0, 0.4));
    const check = new THREE.Group();
    check.add(at(box(0.09, 0.26, 0.05, 0x3fb86a, { emissive: 0x3fb86a, glow: 0.35 }), 0.1, 0.05, 0, 0, 0, -0.75));
    check.add(at(box(0.09, 0.13, 0.05, 0x3fb86a, { emissive: 0x3fb86a, glow: 0.35 }), -0.07, -0.04, 0, 0, 0, 0.8));
    g.add(check);
    anims.push((t) => { check.position.set(0.8, 1.6 + Math.sin(t * 1.8) * 0.06, 0.3); check.rotation.y = Math.sin(t * 0.9) * 0.4; });
    return { group: g, anims };
  },

  editing() {
    const { g, anims } = result();
    table(g, 1.1, 0.6, 0.72, 0.78);
    g.add(at(box(0.66, 0.4, 0.03, 0x1d1a18), 0, 1.07, 0.95));
    g.add(at(cyl(0.02, 0.02, 0.18, DARK), 0, 0.84, 0.95));
    g.add(at(box(0.6, 0.34, 0.005, 0x23283a, { emissive: 0x2f3a6a, glow: 0.4 }), 0, 1.07, 0.968));
    [[-0.2, 0.0, 0.18, 0xff4b33], [0.02, 0.0, 0.26, 0x5a7aff], [0.2, 0.0, 0.14, 0xffc247], [-0.12, -0.07, 0.3, 0x7ed957], [0.14, -0.07, 0.2, 0xc15ae0]].forEach(([x, y, w, c]) => g.add(at(box(w as number, 0.045, 0.006, c as number, { emissive: c as number, glow: 0.35 }), x as number, 1.0 + (y as number), 0.975)));
    const head = at(box(0.012, 0.22, 0.008, 0xffffff, { emissive: 0xffffff, glow: 0.9 }), 0, 1.03, 0.978);
    g.add(head);
    g.add(at(box(0.42, 0.02, 0.14, 0x3a3631), 0, 0.76, 0.62));
    anims.push((t) => { head.position.x = -0.27 + ((t * 0.12) % 1) * 0.54; });
    return { group: g, anims };
  },

  colorWheel() {
    const { g, anims } = result();
    const wheel = new THREE.Group();
    [0xff4b33, 0xffc247, 0x7ed957, 0x35c9c9, 0x5a7aff, 0xc15ae0].forEach((c, i) => {
      wheel.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 18, 1, false, (i * Math.PI) / 3, Math.PI / 3), c, { rough: 0.4 }));
    });
    wheel.add(cyl(0.12, 0.12, 0.045, 0xffffff));
    const holder = new THREE.Group();
    holder.add(wheel);
    wheel.rotation.x = Math.PI / 2;
    g.add(at(holder, 0.62, 1.38, 0.5));
    g.add(at(box(0.7, 0.04, 0.35, DARK), 0, 0.86, 0.62));
    [0xff4b33, 0x5a7aff, 0xffc247].forEach((c, i) => g.add(at(sph(0.04, c, { rough: 0.3 }), -0.2 + i * 0.2, 0.92, 0.6)));
    anims.push((t) => { wheel.rotation.y = t * 0.5; });
    return { group: g, anims };
  },

  hologram() {
    const { g, anims } = result();
    const holo = new THREE.Group();
    holo.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshBasicMaterial({ color: ORANGE, wireframe: true })));
    holo.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), new THREE.MeshBasicMaterial({ color: 0xffb38a })));
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.008, 6, 48), new THREE.MeshBasicMaterial({ color: 0x5a7aff }));
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.008, 6, 48), new THREE.MeshBasicMaterial({ color: 0xc15ae0 }));
    holo.add(r1, r2);
    g.add(holo);
    g.add(at(box(0.55, 0.03, 0.34, DARK), 0.95, 0.95, 0.4));
    g.add(at(box(0.55, 0.005, 0.02, ORANGE, { emissive: ORANGE, glow: 0.8 }), 0.95, 0.97, 0.56));
    g.add(at(cyl(0.02, 0.02, 0.95, DARK), 0.95, 0.47, 0.4));
    anims.push((t) => { holo.position.set(0.95, 1.5 + Math.sin(t * 1.5) * 0.06, 0.4); holo.rotation.set(t * 0.4, t * 0.7, 0); r1.rotation.set(Math.PI / 2, 0, t); r2.rotation.set(0.5, t * 0.6, 0); });
    return { group: g, anims };
  },

  speakers() {
    const { g, anims } = result();
    headphones(g);
    for (const sx of [-1, 1]) {
      g.add(at(box(0.36, 0.78, 0.32, DARK), sx * 0.9, 0.5, 0.2, 0, -sx * 0.3));
      const w = at(cyl(0.12, 0.12, 0.03, CREAM), sx * 0.9 + sx * -0.03, 0.38, 0.36, Math.PI / 2, 0, 0);
      w.position.x = sx * 0.86; w.rotation.y = -sx * 0.3;
      g.add(w);
      g.add(at(cyl(0.05, 0.05, 0.03, ORANGE), sx * 0.86, 0.68, 0.36, Math.PI / 2, -sx * 0.3, 0));
    }
    const bars = Array.from({ length: 7 }, (_, i) => { const b = box(0.07, 1, 0.07, ORANGE, { emissive: ORANGE, glow: 0.4 }); b.position.set(0.72 + i * 0.12, 1.95, 0.45); g.add(b); return b; });
    anims.push((t) => bars.forEach((b, i) => { const h = 0.1 + Math.abs(Math.sin(t * 3 + i * 0.9)) * 0.42; b.scale.y = h; b.position.y = 0.95 + h / 2; }));
    return { group: g, anims };
  },

  piano() {
    const { g, anims } = result();
    g.add(at(box(1.1, 0.12, 0.32, CREAM), 0, 0.86, 0.56));
    for (let i = 0; i < 7; i++) if (i !== 2 && i !== 6) g.add(at(box(0.05, 0.06, 0.17, 0x1d1a18), -0.42 + i * 0.14, 0.95, 0.5));
    for (const sx of [-1, 1]) g.add(at(cyl(0.025, 0.025, 0.8, DARK), sx * 0.5, 0.4, 0.56));
    g.add(at(box(0.42, 0.26, 0.02, CREAM), 0, 1.12, 0.74, -0.35));
    [0.07, 0.02, -0.03, -0.08].forEach((y) => g.add(at(box(0.32, 0.01, 0.006, 0x3a3631), 0, 1.12 + y, 0.755, -0.35)));
    const notes = [0xff4b33, 0xffc247, 0x7a5ac8, 0x5a7aff].map((c) => { const n = note(c); g.add(n); return n; });
    anims.push((t) => notes.forEach((n, i) => { const a = t * 0.8 + i * 1.6; n.position.set(Math.cos(a) * 1.1, 1.3 + (i % 2) * 0.5 + Math.sin(t * 2 + i) * 0.08, Math.sin(a) * 0.5 + 0.3); n.rotation.y = -a; }));
    return { group: g, anims };
  },
};

