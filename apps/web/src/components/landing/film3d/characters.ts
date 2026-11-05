import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Anim, at, mat, mesh, sph } from './kit';
import { PROPS } from './props';
import { SMALL_PROPS } from './propsSmall';
import type { CraftSpec } from './crafts';

/* One craft, as a person: realistic proportions (about 7.5 heads tall), a shaped torso, neck, a face with eyes, brows, nose, mouth and
   ears, real hands, and arms and legs with elbows and knees. The arms are solved so each person's hands actually reach their tool
   (two-bone inverse kinematics), so the pose follows from what they are doing. Crew details: lanyard badge, collar, sleeves, belt, shoes.
   It faces +z and stands on y = 0. The still parts are merged into a few meshes per person, so the detail costs very little to draw. */
export interface Character {
  root: THREE.Group;
  update: (t: number) => void;
}

const UP = new THREE.Vector3(0, 1, 0);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** a tapered limb segment between two points (radius rA at a, rB at b) */
const seg = (a: THREE.Vector3, b: THREE.Vector3, rA: number, rB: number, hex: number) => {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = mesh(new THREE.CylinderGeometry(rB, rA, Math.max(len, 0.001), 14, 1), hex);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
};

/** two-bone inverse kinematics: where the middle joint (elbow / knee) goes so that a chain of lengths l1 + l2 reaches `target` */
const solve = (root: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3) => {
  const to = target.clone().sub(root);
  const d = Math.min(Math.max(to.length(), 0.05), l1 + l2 - 0.002);
  const dir = to.normalize();
  const end = root.clone().addScaledVector(dir, d);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-6) perp.set(0, -1, 0);
  perp.normalize();
  return { mid: root.clone().addScaledVector(dir, a).addScaledVector(perp, h), end };
};

/** merges every mesh under `group` that shares a material into one mesh, in the group's own space; frees the originals */
const bake = (group: THREE.Group): THREE.Group => {
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  meshes.forEach((m) => {
    const g = m.geometry.clone();
    g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
    const mt = m.material as THREE.Material;
    if (!byMat.has(mt)) byMat.set(mt, []);
    byMat.get(mt)!.push(g);
    m.geometry.dispose();
  });
  const out = new THREE.Group();
  byMat.forEach((geos, mt) => {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (merged) out.add(new THREE.Mesh(merged, mt));
  });
  return out;
};

export function buildCharacter(spec: CraftSpec): Character {
  const root = new THREE.Group();
  const female = spec.body === 'f';
  const sx = female ? 0.178 : 0.205;
  const drop = spec.stance === 'jump' ? 0.12 : spec.stance === 'wide' ? 0.05 : 0;
  const hipY = 0.93 - drop;
  const lean = spec.lean ?? 0;
  const body = new THREE.Group();

  // ── legs ──
  const skinMat = spec.skin;
  const ankle = (side: number): THREE.Vector3 => {
    switch (spec.stance) {
      case 'wide': return v(side * 0.25, 0.07, 0.03);
      case 'jump': return v(side * 0.3, 0.07, 0.04);
      case 'kick': return side > 0 ? v(0.14, 0.62, 0.52) : v(-0.1, 0.07, 0);
      default: return v(side * 0.1, 0.07, side > 0 ? -0.03 : 0.04);
    }
  };
  for (const side of [-1, 1]) {
    const hip = v(side * 0.095, hipY, 0);
    const { mid: knee, end } = solve(hip, ankle(side), 0.44, 0.44, v(side * 0.1, 0.1, 1));
    body.add(at(sph(0.098, spec.pants), hip.x, hip.y, hip.z));
    body.add(seg(hip, knee, 0.088, 0.064, spec.pants));
    body.add(at(sph(0.064, spec.pants), knee.x, knee.y, knee.z));
    body.add(seg(knee, end, 0.062, 0.044, spec.pants));
    // shoe, pointing along the leg's forward direction on the floor
    const shoe = new THREE.Group();
    shoe.add(at(mesh(new THREE.BoxGeometry(0.1, 0.075, 0.26), 0x1d1a18), 0, 0, 0.06));
    shoe.add(at(mesh(new THREE.BoxGeometry(0.104, 0.02, 0.27), 0xe8e2d9), 0, -0.04, 0.06));
    shoe.add(at(sph(0.05, 0x1d1a18), 0, 0.005, 0.185));
    shoe.position.copy(end).add(v(0, -0.03, 0));
    shoe.rotation.y = side * 0.18;
    if (spec.stance === 'kick' && side > 0) shoe.rotation.x = -0.9;
    body.add(shoe);
  }
  // pelvis, belt
  body.add(at(mesh(new THREE.BoxGeometry(0.33, 0.17, 0.21), spec.pants), 0, hipY + 0.03, 0));
  const belt = mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.034, 24), 0x1d1a18);
  belt.scale.set(female ? 1.05 : 1.2, 1, 0.72);
  belt.position.set(0, hipY + 0.07, 0);
  body.add(belt);
  body.add(at(mesh(new THREE.BoxGeometry(0.045, 0.034, 0.012), 0xc9b26a), 0, hipY + 0.07, 0.133));

  // ── upper body, pivoting at the hips so it can lean ──
  const upper = new THREE.Group();
  upper.position.set(0, hipY - 0.03, 0);
  upper.rotation.x = lean;
  const profile = female
    ? [[0, 0], [0.155, 0], [0.18, 0.06], [0.135, 0.2], [0.158, 0.34], [0.168, 0.45], [0.15, 0.52], [0.07, 0.56], [0, 0.56]]
    : [[0, 0], [0.15, 0], [0.175, 0.05], [0.168, 0.19], [0.182, 0.33], [0.2, 0.46], [0.17, 0.53], [0.075, 0.57], [0, 0.57]];
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const torsoGeo = new THREE.LatheGeometry(pts, 24);
  const torso = new THREE.Mesh(torsoGeo, mat(spec.shirt));
  torso.scale.set(female ? 1.0 : 1.16, 1, 0.74);
  upper.add(torso);
  if (spec.jacket !== undefined) {
    const jk = new THREE.Mesh(torsoGeo, mat(spec.jacket));
    jk.scale.set(torso.scale.x * 1.07, 1.01, torso.scale.z * 1.1);
    upper.add(jk);
    // the open front shows the shirt
    upper.add(at(mesh(new THREE.BoxGeometry(0.075, 0.4, 0.012), spec.shirt), 0, 0.3, 0.157));
    upper.add(at(mesh(new THREE.BoxGeometry(0.012, 0.42, 0.014), 0x1d1a18), 0.04, 0.3, 0.158));
    upper.add(at(mesh(new THREE.BoxGeometry(0.012, 0.42, 0.014), 0x1d1a18), -0.04, 0.3, 0.158));
  }
  // neck and collar
  upper.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.057, 0.13, 14), skinMat), 0, 0.6, 0.005));
  const collar = at(mesh(new THREE.TorusGeometry(0.062, 0.014, 8, 20), spec.jacket !== undefined ? spec.jacket : spec.shirt), 0, 0.555, 0.01, Math.PI / 2 - 0.35);
  collar.scale.set(1.1, 1, 1.1);
  upper.add(collar);
  // crew badge on a lanyard
  if (spec.badge !== false) {
    [-1, 1].forEach((s) => upper.add(at(mesh(new THREE.BoxGeometry(0.008, 0.27, 0.006), 0x2a2522), s * 0.05, 0.43, 0.14, -0.05, 0, s * -0.22)));
    upper.add(at(mesh(new THREE.BoxGeometry(0.072, 0.1, 0.008), 0xffffff), 0, 0.27, 0.152));
    upper.add(at(mesh(new THREE.BoxGeometry(0.072, 0.022, 0.009), 0xff4b33), 0, 0.305, 0.153));
  }
  body.add(upper);

  // ── arms: the hand goes where the prop is, the elbow follows ──
  const toWorld = (p: THREE.Vector3) => p.clone().applyAxisAngle(v(1, 0, 0), lean).add(upper.position);
  const sleeve = spec.jacket !== undefined ? spec.jacket : spec.shirt;
  for (const side of [-1, 1]) {
    const target = side < 0 ? spec.handL : spec.handR;
    const shoulder = toWorld(v(side * sx, 0.5, 0.0));
    const rest = shoulder.clone().add(v(side * 0.1, -0.52, 0.05));
    let T = target ? v(target[0], target[1], target[2]) : rest;
    const raised = T.y > shoulder.y - 0.05;
    const pole = raised ? v(side * 0.7, -0.15, -0.6) : v(side * 0.55, -1, -0.25);
    let sol = solve(shoulder, T, 0.3, 0.27, pole);
    const fdir = sol.end.clone().sub(sol.mid).normalize();
    // the hand's centre sits just beyond the wrist
    sol = solve(shoulder, T.clone().addScaledVector(fdir, -0.055), 0.3, 0.27, pole);
    const wrist = sol.end;
    const f = wrist.clone().sub(sol.mid).normalize();
    body.add(at(sph(female ? 0.052 : 0.058, sleeve), shoulder.x, shoulder.y - 0.01, shoulder.z));
    body.add(seg(shoulder, sol.mid, 0.052, 0.042, sleeve));
    body.add(at(sph(0.042, sleeve), sol.mid.x, sol.mid.y, sol.mid.z));
    body.add(seg(sol.mid, wrist, 0.041, 0.032, spec.short ? skinMat : sleeve));
    // hand
    const hand = new THREE.Group();
    hand.add(at(mesh(new THREE.SphereGeometry(0.036, 12, 10), skinMat), 0, 0.04, 0));
    hand.children[0].scale.set(1.15, 1.3, 0.72);
    hand.add(at(mesh(new THREE.CapsuleGeometry(0.014, 0.05, 3, 8), skinMat), 0, 0.095, 0));
    hand.children[1].scale.set(2.4, 1, 1.15);
    hand.add(at(mesh(new THREE.CapsuleGeometry(0.0125, 0.034, 3, 8), skinMat), side * -0.034, 0.045, 0.022, 0.3, 0, side * -0.7));
    hand.position.copy(wrist);
    hand.quaternion.setFromUnitVectors(UP, f);
    body.add(hand);
  }

  // ── head ──
  const eyes = new THREE.Group();
  const headTop = toWorld(v(0, 0.595, 0.005));
  const H = new THREE.Group();
  H.position.copy(headTop).add(v(0, 0.135, 0.012));
  H.rotation.x = lean * 0.5;
  // skull and jaw
  H.add(at(mesh(new THREE.SphereGeometry(0.118, 24, 18), skinMat), 0, 0, 0));
  H.children[0].scale.set(0.95, 1.14, 1.02);
  H.add(at(mesh(new THREE.SphereGeometry(0.085, 20, 14), skinMat), 0, -0.068, 0.016));
  H.children[1].scale.set(1.0, 0.78, 0.95);
  [-1, 1].forEach((s) => {
    H.add(at(mesh(new THREE.SphereGeometry(0.02, 10, 8), skinMat), s * 0.108, -0.008, -0.008));
    H.children[H.children.length - 1].scale.set(0.45, 1, 0.8);
  });
  // nose and mouth
  H.add(at(mesh(new THREE.SphereGeometry(0.017, 10, 8), skinMat), 0, -0.013, 0.118));
  H.children[H.children.length - 1].scale.set(0.9, 1.25, 1.1);
  H.add(at(mesh(new THREE.TorusGeometry(0.026, 0.0036, 6, 14, Math.PI), 0x8a3a3a), 0, -0.052, 0.103, 0, 0, Math.PI));
  // brows
  [-1, 1].forEach((s) => H.add(at(mesh(new THREE.BoxGeometry(0.036, 0.0075, 0.01), spec.hair === 0x8a8278 ? 0x6a6258 : spec.hair), s * 0.038, 0.047, 0.104, 0, 0, s * 0.14)));
  // eyes (their own group, so they can blink)
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group();
    const white = mesh(new THREE.SphereGeometry(0.0165, 12, 10), 0xffffff, { rough: 0.3 });
    white.scale.set(1, 0.82, 0.5);
    const iris = at(mesh(new THREE.SphereGeometry(0.0088, 10, 8), 0x3a2418, { rough: 0.2 }), 0, 0, 0.0065);
    iris.scale.set(1, 1, 0.5);
    eye.add(white, iris);
    eye.position.set(s * 0.038, 0.018, 0.102);
    eyes.add(eye);
  });
  H.add(eyes);
  // hair: the cap is a little larger than the skull in every direction (so no scalp shows through), sits back to show the forehead,
  // and covers the nape
  const hairHex = spec.hair;
  if (spec.hairStyle !== 'none') {
    const capGeo = new THREE.SphereGeometry(0.13, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.53);
    const hairMesh = (hex: number) => {
      const m = mesh(capGeo, hex, { rough: 0.85 });
      m.scale.set(1.04, 1.2, 1.1);
      m.position.set(0, 0.004, -0.012);
      m.rotation.x = -0.5;
      return m;
    };
    if (spec.hairStyle === 'cap') {
      H.add(hairMesh(0x1d1a18));
      H.add(at(mesh(new THREE.BoxGeometry(0.15, 0.012, 0.1), 0x1d1a18, { rough: 0.8 }), 0, 0.058, 0.135, 0.14));
      H.add(at(mesh(new THREE.BoxGeometry(0.07, 0.05, 0.04), hairHex), 0, -0.07, -0.108));
    } else {
      H.add(hairMesh(hairHex));
      [-1, 1].forEach((s) => H.add(at(mesh(new THREE.BoxGeometry(0.016, 0.06, 0.06), hairHex, { rough: 0.85 }), s * 0.109, 0.012, 0.012)));
    }
    if (spec.hairStyle === 'long') {
      H.add(at(mesh(new THREE.BoxGeometry(0.27, 0.4, 0.07), hairHex, { rough: 0.85 }), 0, -0.14, -0.1));
      [-1, 1].forEach((s) => H.add(at(mesh(new THREE.BoxGeometry(0.05, 0.34, 0.12), hairHex, { rough: 0.85 }), s * 0.12, -0.1, -0.03)));
    }
    if (spec.hairStyle === 'wavy') {
      // loose curls spread over the crown and the back, never over the forehead
      for (let i = 0; i < 16; i++) {
        const theta = i * 2.4;
        const phi = 0.15 + ((i * 37) % 10) / 10 * 1.15;
        const x = Math.sin(phi) * Math.cos(theta), z = Math.sin(phi) * Math.sin(theta);
        if (z > 0.15 && phi > 0.7) continue;
        H.add(at(mesh(new THREE.SphereGeometry(0.044, 8, 6), hairHex, { rough: 0.9 }), x * 0.128, Math.cos(phi) * 0.15, z * 0.13 - 0.012));
      }
    }
    if (spec.hairStyle === 'bun') H.add(at(sph(0.055, hairHex, { rough: 0.9 }), 0, 0.12, -0.085));
  }
  // beard
  if (spec.beard) {
    const full = spec.beard === 'full';
    const shell = at(mesh(new THREE.SphereGeometry(0.088, 18, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), full ? hairHex : 0x3a2a20, { rough: 0.9, opacity: full ? 1 : 0.5 }), 0, -0.066, 0.02);
    shell.scale.set(1.04, 0.82, 0.98);
    H.add(shell);
    if (full) H.add(at(mesh(new THREE.BoxGeometry(0.07, 0.014, 0.02), hairHex), 0, -0.036, 0.112));
  }

  // ── merge what stands still ──
  const bodyGroup = bake(body);
  const headGroup = new THREE.Group();
  headGroup.position.copy(H.position);
  headGroup.rotation.copy(H.rotation);
  const eyeGroup = eyes; // stays unmerged
  H.remove(eyes);
  const headBaked = bake(H);
  headGroup.add(headBaked);
  headGroup.add(eyeGroup);
  const upperBody = bodyGroup;
  root.add(upperBody);
  root.add(headGroup);

  // ── the tool ──
  const { group: prop, anims } = (SMALL_PROPS[spec.prop] ?? PROPS[spec.prop]!)();
  root.add(prop);
  root.scale.setScalar(1.1); // a little larger than life, so the people read from far away

  // soft contact shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 28), new THREE.MeshBasicMaterial({ color: 0x3a2a20, transparent: true, opacity: 0.14, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(shadow);

  // ── life: breathing, a slow look around, blinking, a little sway ──
  const phase = Math.random() * 6.28;
  const baseY = headGroup.rotation.y;
  const update: Anim = (t) => {
    const s = t + phase;
    upperBody.scale.y = 1 + Math.sin(s * 1.5) * 0.004;
    upperBody.rotation.z = Math.sin(s * 0.55) * 0.006;
    headGroup.rotation.y = baseY + Math.sin(s * 0.45) * 0.28;
    headGroup.rotation.z = Math.sin(s * 0.7) * 0.035;
    const b = (s * 0.28) % 1;
    eyeGroup.scale.y = b > 0.94 ? 0.12 : 1;
    anims.forEach((a) => a(t));
  };

  return { root, update };
}
