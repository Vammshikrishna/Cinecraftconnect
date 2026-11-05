import * as THREE from 'three';
import { Anim, PropResult, at, box, cone, cyl, mesh, sph, torus } from './kit';
import type { PropId } from './crafts';

/* Small hand-held tools for the sub-craft people who stand beside each station's main craft. They are compact on purpose: several people
   share one pedestal, so nothing here is bigger than what a person can hold or wear. Same conventions as props.ts (faces +z). */
const ORANGE = 0xff4b33;
const CREAM = 0xf4f0ea;
const DARK = 0x2b2b30;
const WOOD = 0x8a6a46;

const make = (): { g: THREE.Group; anims: Anim[] } => ({ g: new THREE.Group(), anims: [] });

export const SMALL_PROPS: Partial<Record<PropId, () => PropResult>> = {
  tablet() {
    const { g, anims } = make();
    g.add(at(box(0.3, 0.22, 0.015, DARK), 0, 1.1, 0.44, -0.45));
    g.add(at(box(0.27, 0.19, 0.005, 0xff9a86, { emissive: ORANGE, glow: 0.4 }), 0, 1.1, 0.452, -0.45));
    return { group: g, anims };
  },
  pad() {
    const { g } = make();
    g.add(at(box(0.26, 0.34, 0.012, 0xffffff), -0.2, 1.06, 0.42, -0.4));
    [0.08, 0.02, -0.04, -0.1].forEach((y) => g.add(at(box(0.18, 0.01, 0.006, 0x3a3631), -0.2, 1.06 + y, 0.43, -0.4)));
    g.add(at(cyl(0.01, 0.01, 0.16, 0xffd34a), 0.18, 1.1, 0.42, 0.5, 0, 0.5));
    return { group: g, anims: [] };
  },
  swatch() {
    const { g } = make();
    [0xff4b33, 0xffc247, 0x7ed957, 0x5a7aff, 0xc15ae0].forEach((c, i) => {
      const s = box(0.05, 0.3, 0.008, c);
      s.geometry.translate(0, 0.15, 0);
      g.add(at(s, 0.2, 1.0, 0.42, -0.35, 0, (i - 2) * 0.28));
    });
    return { group: g, anims: [] };
  },
  lamp() {
    const { g, anims } = make();
    g.add(at(cyl(0.07, 0.08, 0.03, WOOD), 0.2, 1.02, 0.42));
    g.add(at(cyl(0.012, 0.012, 0.2, DARK), 0.2, 1.13, 0.42));
    g.add(at(cone(0.11, 0.14, 0xffe7b0, { emissive: 0xffe0a0, glow: 0.8 }, 20), 0.2, 1.28, 0.42, Math.PI));
    anims.push((t) => { g.rotation.y = Math.sin(t * 0.6) * 0.02; });
    return { group: g, anims };
  },
  crate() {
    const { g } = make();
    g.add(at(box(0.36, 0.2, 0.26, WOOD), 0, 0.92, 0.46));
    g.add(at(sph(0.07, ORANGE), -0.08, 1.06, 0.46));
    g.add(at(cone(0.05, 0.16, 0x5a7aff), 0.08, 1.1, 0.44));
    g.add(at(cyl(0.02, 0.02, 0.22, 0xe8b83a), 0.0, 1.08, 0.52, 0, 0, 0.6));
    return { group: g, anims: [] };
  },
  hair() {
    const { g, anims } = make();
    const dryer = new THREE.Group();
    dryer.add(at(cyl(0.05, 0.04, 0.2, 0xf3b6c4), 0, 0, 0, Math.PI / 2));
    dryer.add(at(cyl(0.02, 0.02, 0.12, DARK), 0, -0.08, -0.03));
    dryer.add(at(cyl(0.055, 0.055, 0.03, DARK), 0, 0, 0.11, Math.PI / 2));
    g.add(at(dryer, 0.3, 1.42, 0.34, 0, -0.9));
    g.add(at(box(0.16, 0.025, 0.02, DARK), -0.28, 1.06, 0.44, 0, 0, 0.2));
    anims.push((t) => { dryer.rotation.z = Math.sin(t * 5) * 0.03; });
    return { group: g, anims };
  },
  pole() {
    const { g } = make();
    g.add(at(cyl(0.02, 0.02, 2.2, DARK), 0.5, 1.1, 0.3));
    g.add(at(box(0.5, 0.45, 0.012, 0x1d1a18), 0.5, 1.85, 0.3));
    g.add(at(cyl(0.12, 0.14, 0.03, DARK), 0.5, 0.02, 0.3));
    return { group: g, anims: [] };
  },
  boomS() {
    const { g, anims } = make();
    const pole = new THREE.Group();
    pole.add(at(cyl(0.016, 0.016, 1.6, DARK), 0, 0, 0, Math.PI / 2));
    pole.add(at(cyl(0.06, 0.06, 0.24, 0xc9c4bb, { rough: 1 }), 0, 0, 0.82, Math.PI / 2));
    g.add(at(pole, 0, 2.1, 0.5));
    anims.push((t) => { pole.rotation.y = Math.sin(t * 0.8) * 0.1; });
    return { group: g, anims };
  },
  phones() {
    const { g, anims } = make();
    g.add(at(torus(0.128, 0.012, DARK, {}, Math.PI), 0, 1.69, 0));
    [-1, 1].forEach((s) => g.add(at(cyl(0.05, 0.05, 0.034, ORANGE), s * 0.126, 1.678, 0, 0, 0, Math.PI / 2)));
    const bars = [0, 1, 2, 3, 4].map((i) => { const b = box(0.04, 1, 0.01, ORANGE, { emissive: ORANGE, glow: 0.4 }); b.position.set(-0.1 + i * 0.05, 1.0, 0.46); g.add(b); return b; });
    g.add(at(box(0.3, 0.16, 0.012, DARK), 0, 1.0, 0.45, -0.3));
    anims.push((t) => bars.forEach((b, i) => { const h = 0.03 + Math.abs(Math.sin(t * 3 + i)) * 0.09; b.scale.y = h; b.position.y = 1.0 + h / 2; }));
    return { group: g, anims };
  },
  flame() {
    const { g, anims } = make();
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 12), new THREE.MeshBasicMaterial({ color: 0xffa23a }));
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 12), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    g.add(f, core);
    g.add(at(cyl(0.05, 0.05, 0.22, 0xd62a1a), 0.6, 0.11, 0.2));
    anims.push((t) => { const s = 1 + Math.sin(t * 9) * 0.15; f.scale.set(1, s, 1); core.scale.set(1, s, 1); f.position.set(0.58, 1.32, 0.36); core.position.set(0.58, 1.3, 0.36); });
    return { group: g, anims };
  },
  wire() {
    const { g, anims } = make();
    const w = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), new THREE.MeshBasicMaterial({ color: ORANGE, wireframe: true }));
    g.add(w);
    g.add(at(box(0.3, 0.2, 0.012, DARK), -0.2, 1.05, 0.44, -0.4));
    anims.push((t) => { w.position.set(0.5, 1.55 + Math.sin(t * 1.5) * 0.04, 0.36); w.rotation.set(t * 0.5, t * 0.8, 0); });
    return { group: g, anims };
  },
  foley() {
    const { g, anims } = make();
    const a = mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x6a4a2a);
    const b = mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x6a4a2a);
    g.add(a, b);
    g.add(at(box(0.5, 0.05, 0.3, 0x8a8f99), 0, 0.9, 0.5));
    anims.push((t) => { const c = Math.abs(Math.sin(t * 3)); a.position.set(-0.07 - c * 0.12, 1.05, 0.42); b.position.set(0.07 + c * 0.12, 1.05, 0.42); a.rotation.z = Math.PI / 2; b.rotation.z = -Math.PI / 2; });
    return { group: g, anims };
  },
  coffee() {
    const { g } = make();
    g.add(at(cyl(0.045, 0.036, 0.1, CREAM), 0.22, 1.08, 0.4));
    g.add(at(torus(0.03, 0.007, CREAM), 0.27, 1.08, 0.4));
    g.add(at(box(0.07, 0.15, 0.04, DARK), -0.24, 1.1, 0.4));
    return { group: g, anims: [] };
  },
};
