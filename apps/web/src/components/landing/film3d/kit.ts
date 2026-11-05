import * as THREE from 'three';

/* Small helpers for building the low-poly figures. Materials are shared by colour, so 24 characters with hundreds of parts
   only create a few dozen materials. */
interface MatOpts { rough?: number; metal?: number; emissive?: number; glow?: number; opacity?: number }
const cache = new Map<string, THREE.MeshStandardMaterial>();

export const mat = (hex: number, o: MatOpts = {}): THREE.MeshStandardMaterial => {
  const key = `${hex}|${o.rough ?? 0.62}|${o.metal ?? 0}|${o.emissive ?? 0}|${o.glow ?? 0}|${o.opacity ?? 1}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: o.rough ?? 0.62,
      metalness: o.metal ?? 0,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.glow ?? 0,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
};

export const disposeKit = () => { cache.forEach((m) => m.dispose()); cache.clear(); };

export const mesh = (g: THREE.BufferGeometry, hex: number, o?: MatOpts) => new THREE.Mesh(g, mat(hex, o));
export const box = (w: number, h: number, d: number, hex: number, o?: MatOpts) => mesh(new THREE.BoxGeometry(w, h, d), hex, o);
export const cyl = (rt: number, rb: number, h: number, hex: number, o?: MatOpts, seg = 18) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), hex, o);
export const sph = (r: number, hex: number, o?: MatOpts) => mesh(new THREE.SphereGeometry(r, 18, 14), hex, o);
export const cone = (r: number, h: number, hex: number, o?: MatOpts, seg = 18) => mesh(new THREE.ConeGeometry(r, h, seg), hex, o);
export const torus = (R: number, r: number, hex: number, o?: MatOpts, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(R, r, 10, 28, arc), hex, o);
export const capsule = (r: number, len: number, hex: number, o?: MatOpts) => mesh(new THREE.CapsuleGeometry(r, len, 4, 12), hex, o);

export const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
};

export type Anim = (t: number) => void;
export interface PropResult { group: THREE.Group; anims: Anim[] }
