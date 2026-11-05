import * as THREE from 'three';
import { CRAFTS, EXTRAS, PHASES } from './crafts';
import { buildCharacter, Character } from './characters';
import { disposeKit } from './kit';

/* The landing page's background world: 24 craft characters on pedestals along a winding path, in the order a film gets made, with
   a film strip on the floor that lights up behind the camera, and a cinema screen at the end. The camera flies along the path as the
   page scrolls, starting high above (so the whole studio reads as a miniature) and coming down to eye level at each craft. */
const PAGE = 0xfbfaf8;
const ORANGE = 0xff4b33;
const PHASE_COLOR: Record<string, number> = { Develop: 0xffe4d2, Prepare: 0xffd2c0, Shoot: 0xffbfa8, Finish: 0xeadcf7 };
const SPACING = 6.2;
const FRAMES = 260;

const stationPos = (i: number) => new THREE.Vector3(Math.sin(i * 0.6) * 3.6, 0, -i * SPACING);

const label = (text: string, font: string, fg: string, bg: string, w = 640, h = 140, dot = true) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (globalThis as any).document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const r = h / 2;
  g.fillStyle = bg;
  g.beginPath(); g.moveTo(r, 4); g.arcTo(w - 4, 4, w - 4, h - 4, r - 4); g.arcTo(w - 4, h - 4, 4, h - 4, r - 4); g.arcTo(4, h - 4, 4, 4, r - 4); g.arcTo(4, 4, w - 4, 4, r - 4); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(20,17,15,0.14)'; g.lineWidth = 3; g.stroke();
  if (dot) { g.fillStyle = '#ff4b33'; g.beginPath(); g.arc(r + 6, h / 2, 13, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = fg; g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(text, dot ? w / 2 + 16 : w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};

const sprite = (tex: THREE.Texture, sx: number, sy: number) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(sx, sy, 1);
  return s;
};

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** native mode only: name tags that are on screen for the station at journey position t */
  tags: (t: number) => NativeTag[];
  resize: (w: number, h: number) => void;
  /** t: 0..25 along the journey. Returns the craft in front of the camera (0..23) or -1 while it is above / at the end. */
  frame: (time: number, t: number, still: boolean) => number;
  dispose: () => void;
}

/** A name tag as the mobile app draws it: native text laid over the 3D view at a projected screen position (x, y in 0..1). */
export interface NativeTag { key: string; text: string; x: number; y: number; opacity: number; main: boolean }

export function buildWorld(opts: { native?: boolean } = {}): World {
  const native = !!opts.native; // native (React Native): no canvas, so no sprite tags, banners or screen texture
  const nativeTags: { key: string; text: string; g: THREE.Group; x: number; y: number; z: number; station: number; main: boolean }[] = [];
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAGE, 12, 40);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf2d9cc, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0e0, 1.6); sun.position.set(6, 10, 8); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffd7c4, 0.5); fill.position.set(-7, 4, 5); scene.add(fill);

  // ── the floor: a warm ground that fades into the page colour in the distance ──
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 230), new THREE.MeshStandardMaterial({ color: 0xf3e8e0, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, -78);
  scene.add(ground);

  // ── stations ──
  const stationPeople: Character[][] = []; // everyone standing on each station (filled when the station is built)
  const populators: (() => void)[] = [];
  const built: boolean[] = [];
  const groups: THREE.Group[] = [];
  const banners = new Set<THREE.Sprite>(); // phase banners: hidden on portrait screens, where the journey card names the phase
  let portrait = false;
  const fadeables: THREE.Sprite[] = []; // name tags and phase banners: they fade out when the camera is right next to them
  const positions: THREE.Vector3[] = [];
  CRAFTS.forEach((spec, i) => {
    const p = stationPos(i);
    positions.push(p);
    const g = new THREE.Group();
    g.position.copy(p);
    g.rotation.y = -Math.sin(i * 0.6) * 0.3;

    // Everyone on a station stands in one shallow arc across the camera's view, so nobody hides anybody else. The camera sits to the
    // station's front-right (+3.5, +6.4), so "across the view" is the world direction (cos 0.5, -sin 0.5) and the people face yaw 0.5.
    const phi = g.rotation.y;
    const toLocal = (wx: number, wz: number): [number, number] => [wx * Math.cos(phi) - wz * Math.sin(phi), wx * Math.sin(phi) + wz * Math.cos(phi)];
    const extras = EXTRAS.filter((e) => e.station === spec.name);
    const n = 1 + extras.length;
    const GAP = 0.94;
    const mainIdx = n === 2 ? 0 : n > 2 ? 1 : 0;
    const spot = (k: number): [number, number] => {
      const s = (k - (n - 1) / 2) * GAP + shift;
      const wx = Math.cos(0.5) * s - Math.sin(0.5) * -0.1 * s * s; // a gentle arc: the ends step back
      const wz = -Math.sin(0.5) * s + -Math.cos(0.5) * -0.1 * s * s;
      return toLocal(wx, wz);
    };
    const faceLocal = 0.5 - phi;
    // wide groups slide toward the clear right side of the screen (the explanation card covers the left)
    const shift = (n - 1) * 0.09;

    // the pedestal widens with the group, along the same direction
    const ped = new THREE.Group();
    ped.rotation.y = 0.5 - phi;
    { const [px, pz] = toLocal(Math.cos(0.5) * shift, -Math.sin(0.5) * shift); ped.position.set(px, 0, pz); }
    ped.scale.x = n === 1 ? 1 : (((n - 1) * GAP) / 2 + 1.25) / 1.7;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.78, 0.14, 48), new THREE.MeshStandardMaterial({ color: PHASE_COLOR[spec.phase], roughness: 0.8 }));
    base.position.y = 0.07;
    ped.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.025, 8, 64), new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.5 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.14;
    ped.add(rim);
    g.add(ped);

    const addTag = (name: string, x: number, z: number, idx: number) => {
      const text = name === 'Special Effects (SFX) Supervisor' ? 'SFX Supervisor' : name.replace(/ \(.*\)/, '');
      if (native) { nativeTags.push({ key: `${i}-${name}`, text, g, x, y: idx % 2 === 0 ? 2.5 : 2.24, z, station: i, main: name === spec.name }); return; }
      const tg = sprite(label(text, '600 50px "Work Sans", system-ui, sans-serif', '#14110f', 'rgba(255,255,255,0.96)'), 1.28, 0.28);
      tg.position.set(x, idx % 2 === 0 ? 2.5 : 2.24, z); // neighbours alternate in height, so their tags never overlap
      g.add(tg);
      fadeables.push(tg);
    };

    // The people are built when the camera gets near, not all up front: building ~40 detailed figures at once is what made the first
    // frames slow. The first few stations are built straight away (the hero shows them); the rest as the journey approaches.
    const people: Character[] = [];
    stationPeople.push(people);
    populators.push(() => {
      const ch = buildCharacter(spec);
      const [mx, mz] = spot(mainIdx);
      ch.root.position.set(mx, 0.14, mz);
      ch.root.rotation.y = faceLocal;
      g.add(ch.root);
      people.push(ch);
      addTag(spec.name, mx, mz, mainIdx);

      // the sub-craft people: the roles inside this craft, beside the main one
      let k = 0;
      extras.forEach((ex) => {
        if (k === mainIdx) k++;
        const c = buildCharacter(ex);
        const [sx, sz] = spot(k);
        c.root.position.set(sx, 0.14, sz);
        c.root.scale.setScalar(0.98);
        c.root.rotation.y = faceLocal;
        g.add(c.root);
        people.push(c);
        addTag(ex.name, sx, sz, k);
        k++;
      });
    });

    // phase banner above the first craft of each phase
    const phaseIdx = PHASES.findIndex((ph) => ph.id === spec.phase);
    if (!native && CRAFTS.findIndex((c) => c.phase === spec.phase) === i) {
      const banner = sprite(label(`${phaseIdx + 1}  ${spec.phase.toUpperCase()}`, '700 64px Inconsolata, ui-monospace, monospace', '#ffffff', 'rgba(20,17,15,0.92)', 640, 150, false), 3.5, 0.82);
      banner.position.set(0, 3.55, 0);
      // the hero shows the first station, where this banner would sit under the Scroll hint; the journey card names the phase instead
      if (i > 0) { g.add(banner); fadeables.push(banner); banners.add(banner); }
    }
    groups.push(g);
    scene.add(g);
  });

  for (let i = 0; i < Math.min(4, populators.length); i++) { populators[i](); built[i] = true; }

  // ── the film strip along the floor ──
  const pts = [...positions.map((p) => new THREE.Vector3(p.x, 0.03, p.z)), (() => { const e = stationPos(24); e.y = 0.03; return e; })()];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const frameGeo = new THREE.BoxGeometry(1.05, 0.02, 0.5);
  const innerGeo = new THREE.BoxGeometry(0.78, 0.012, 0.36);
  const outer = new THREE.InstancedMesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), FRAMES);
  const inner = new THREE.InstancedMesh(innerGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), FRAMES);
  const dummy = new THREE.Object3D();
  const tangent = new THREE.Vector3();
  const colA = new THREE.Color(0x2a2522), colB = new THREE.Color(0x4a423c), litA = new THREE.Color(0xff4b33), litB = new THREE.Color(0xffb38a);
  for (let k = 0; k < FRAMES; k++) {
    const u = k / (FRAMES - 1);
    curve.getPointAt(u, dummy.position);
    curve.getTangentAt(u, tangent);
    dummy.lookAt(dummy.position.x + tangent.x, dummy.position.y, dummy.position.z + tangent.z);
    dummy.updateMatrix();
    outer.setMatrixAt(k, dummy.matrix);
    dummy.position.y += 0.012; dummy.updateMatrix();
    inner.setMatrixAt(k, dummy.matrix);
    outer.setColorAt(k, colA); inner.setColorAt(k, colB);
  }
  scene.add(outer, inner);
  let lit = 0;
  const setLit = (n: number) => {
    const from = Math.min(lit, n), to = Math.max(lit, n);
    for (let k = from; k < to; k++) {
      const on = k < n;
      outer.setColorAt(k, on ? litA : colA);
      inner.setColorAt(k, on ? litB : colB);
    }
    lit = n;
    if (outer.instanceColor) outer.instanceColor.needsUpdate = true;
    if (inner.instanceColor) inner.instanceColor.needsUpdate = true;
  };

  // ── the cinema at the end ──
  const end = stationPos(24);
  const cinema = new THREE.Group();
  cinema.position.set(end.x, 0, end.z - 3.2); // set back, so the last craft stands in front of the screen
  const stage = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.3, 3.4), new THREE.MeshStandardMaterial({ color: 0x2a2522, roughness: 0.8 }));
  stage.position.set(0, 0.15, -0.6); cinema.add(stage);
  let screen: THREE.Mesh;
  if (native) {
    // no canvas to draw the "Now showing" text on: a dark screen with a play triangle (the journey card says the words)
    screen = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.37), new THREE.MeshBasicMaterial({ color: 0x2a1d18 }));
    const tri = new THREE.Shape(); tri.moveTo(-0.5, -0.8); tri.lineTo(-0.5, 0.8); tri.lineTo(0.85, 0);
    const play = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xff4b33 }));
    play.position.z = 0.02; screen.add(play);
  } else {
    const sc = (globalThis as any).document.createElement('canvas'); sc.width = 1280; sc.height = 540;
    const sg = sc.getContext('2d')!;
    const grad = sg.createLinearGradient(0, 0, 1280, 540); grad.addColorStop(0, '#1d1a18'); grad.addColorStop(1, '#3a241c');
    sg.fillStyle = grad; sg.fillRect(0, 0, 1280, 540);
    sg.fillStyle = '#ff4b33'; sg.beginPath(); sg.moveTo(560, 150); sg.lineTo(560, 270); sg.lineTo(660, 210); sg.closePath(); sg.fill();
    sg.fillStyle = '#ffffff'; sg.textAlign = 'center';
    sg.font = '700 78px "Work Sans", system-ui, sans-serif'; sg.fillText('Now showing', 640, 360);
    sg.fillStyle = 'rgba(255,255,255,0.78)'; sg.font = '500 38px "Work Sans", system-ui, sans-serif'; sg.fillText('Made by 24 crafts, working as one', 640, 424);
    const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
    screen = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.37), new THREE.MeshBasicMaterial({ map: stex }));
  }
  screen.position.set(0, 2.25, -1.55); cinema.add(screen);
  [-1, 1].forEach((s) => { const cur = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.8, 0.3), new THREE.MeshStandardMaterial({ color: 0xb8321f, roughness: 0.8 })); cur.position.set(s * 4.7, 2.2, -1.4); cinema.add(cur); });
  for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.6), new THREE.MeshStandardMaterial({ color: 0x8a2a1c, roughness: 0.9 }));
    seat.position.set(c * 0.95, 0.28, 2.0 + r * 1.3); cinema.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.12), new THREE.MeshStandardMaterial({ color: 0x8a2a1c, roughness: 0.9 }));
    back.position.set(c * 0.95, 0.7, 2.28 + r * 1.3); cinema.add(back);
  }
  scene.add(cinema);

  // ── the camera's journey ──
  const camPts: THREE.Vector3[] = [new THREE.Vector3(5.5, 11.5, 9)];
  const lookPts: THREE.Vector3[] = [new THREE.Vector3(0.5, 0.4, -22)];
  positions.forEach((p) => { // the camera stays off to one side of the path, so the figure it has just passed is out of frame and nothing blocks the view
    camPts.push(new THREE.Vector3(p.x + 4.7, 3.0, p.z + 8.6)); lookPts.push(new THREE.Vector3(p.x, 1.15, p.z)); });
  camPts.push(new THREE.Vector3(end.x + 1.5, 4.6, end.z + 17));
  lookPts.push(new THREE.Vector3(end.x, 1.7, end.z - 3.6));
  const camCurve = new THREE.CatmullRomCurve3(camPts, false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal');
  const N = camPts.length; // 26

  const resize = (w: number, h: number) => {
    const wide = w >= 1024;
    camera.aspect = w / h;
    camera.fov = w < h ? 54 : 42;
    // on wide screens the scene sits right of centre, leaving the page text on the left
    portrait = w < h;
    if (wide) camera.setViewOffset(w, h, -w * 0.27, 0, w, h);
    // on a phone the journey card fills the lower half of the screen, so the scene is lifted into the free upper half
    else if (portrait) camera.setViewOffset(w, h, 0, h * 0.2, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };

  const pc = new THREE.Vector3(), pl = new THREE.Vector3(), fwdDir = new THREE.Vector3(), gp = new THREE.Vector3();
  const frame = (time: number, t: number, still: boolean) => {
    // linger at each craft: the journey slows down at whole numbers
    const tt = still ? t : t - 0.55 * Math.sin(t * Math.PI * 2) / (Math.PI * 2);
    const u = Math.min(Math.max(tt / (N - 1), 0), 1);
    camCurve.getPoint(u, pc);
    lookCurve.getPoint(u, pl);
    camera.position.copy(pc);
    camera.lookAt(pl);

    const active = tt >= 0.55 && tt <= N - 1.55 ? Math.min(23, Math.max(0, Math.round(tt - 1))) : -1;
    // build the stations the camera is approaching (at most two per frame, so no single frame stalls)
    let made = 0;
    for (let i = 0; i < populators.length && made < 2; i++) {
      if (!built[i] && Math.abs(tt - (i + 1)) < 5) { populators[i](); built[i] = true; made++; }
    }
    stationPeople.forEach((list, i) => { if (Math.abs(tt - (i + 1)) < 4.2) list.forEach((c) => c.update(time)); });

    // stations lost in the fog are not drawn at all
    // stations lost in the fog are not drawn; every other station stays in the scene, so the scroll is one continuous flight
    camera.getWorldDirection(fwdDir);
    groups.forEach((g) => {
      g.visible = g.position.distanceTo(camera.position) < 60;
      // portrait screens: a station that has just been passed would fill the foreground, so it is dropped once it falls behind the camera line
      if (portrait && g.visible) { gp.copy(g.position).sub(camera.position); if (gp.dot(fwdDir) < 6.5) g.visible = false; }
    });

    const wp = new THREE.Vector3();
    camera.getWorldDirection(fwdDir);
    fadeables.forEach((s) => {
      if (portrait && banners.has(s)) { s.visible = false; return; }
      s.getWorldPosition(wp);
      // tags of a station the camera has just passed would be huge and in the way: fade them out as they fall behind
      const ahead = Math.min(Math.max((wp.clone().sub(camera.position).dot(fwdDir) - 5) / 3, 0), 1);
      const o = ahead * Math.min(Math.max((wp.distanceTo(camera.position) - 2.6) / 1.6, 0), 1) * (1 - Math.min(Math.max((tt - 24.2) / 0.7, 0), 1)); // in the finale the cinema is the picture, so the name tags step aside
      s.material.opacity = o;
      s.visible = o > 0.02;
    });

    // frames behind the camera light up
    const lead = Math.min(Math.max((tt - 0.4) / (N - 1.6), 0), 1);
    setLit(Math.round(lead * FRAMES));
    return active;
  };

  const dispose = () => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      mats.forEach((mm) => { const x = mm as THREE.Material & { map?: THREE.Texture }; x.map?.dispose(); x.dispose(); });
    });
    disposeKit();
  };

  const tagPos = new THREE.Vector3();
  const tags = (t: number): NativeTag[] => {
    const tt = t - 0.55 * Math.sin(t * Math.PI * 2) / (Math.PI * 2);
    const out: NativeTag[] = [];
    if (tt > 24.2) return out; // the finale: the cinema is the picture
    nativeTags.forEach((n) => {
      if (Math.abs(tt - (n.station + 1)) > 1.3 || !n.g.visible) return;
      tagPos.set(n.x, n.y, n.z);
      n.g.localToWorld(tagPos);
      const dist = tagPos.distanceTo(camera.position);
      const ahead = Math.min(Math.max((tagPos.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())) - 5) / 3, 0), 1);
      tagPos.project(camera);
      if (tagPos.z > 1) return;
      out.push({ key: n.key, text: n.text, x: (tagPos.x + 1) / 2, y: (1 - tagPos.y) / 2, opacity: ahead * Math.min(Math.max((dist - 2.6) / 1.6, 0), 1), main: n.main });
    });
    return out;
  };

  return { scene, camera, tags, resize, frame, dispose };
}
