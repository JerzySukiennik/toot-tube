// Toot Tube: the inflatable ring (solid rope, valve, sector stripes, deflating) and the five chunky toy animals with their animation.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAFT } from './config.js';
import { paint, place, merged } from './util3d.js';

const TAU = Math.PI * 2;
const INK = '#16152b';
const WHITE = '#ffffff';
const SKIN = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });

const P = (geo, color, t) => place(paint(geo, color), t);
const ball = (color, x, y, z, sx, sy = sx, sz = sx, rz = 0, seg = 22) =>
  P(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), color, { x, y, z, rz, sx, sy, sz });
const rbox = (color, w, h, d, r, x, y, z, rz = 0) => P(new RoundedBoxGeometry(w, h, d, 3, r), color, { x, y, z, rz });
const mesh = (parent, geo, shadow = true) => {
  const m = new THREE.Mesh(geo, SKIN);
  m.castShadow = shadow;
  parent.add(m);
  return m;
};
const surfZ = (rx, ry, rz) => (x, y) => rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2));
const onEll = (rx, ry, rz, ax, ay, k = 0.96) => [Math.sin(ax) * Math.cos(ay) * rx * k, Math.sin(ay) * ry * k, Math.cos(ax) * Math.cos(ay) * rz * k];

function arcGeo(color, R, tube, span) {
  const g = new THREE.TorusGeometry(R, tube, 8, 30, span);
  g.rotateZ(-Math.PI / 2 - span / 2);
  const ends = [-Math.PI / 2 - span / 2, -Math.PI / 2 + span / 2].map((a) =>
    P(new THREE.SphereGeometry(tube, 8, 6), color, { x: Math.cos(a) * R, y: Math.sin(a) * R }));
  return merged([paint(g, color), ...ends]);
}

function onHead(geo, rx, ry, rz, off) {
  const p = geo.attributes.position;
  const zf = surfZ(rx, ry, rz);
  for (let i = 0; i < p.count; i++) p.setZ(i, zf(p.getX(i), p.getY(i)) + off);
  p.needsUpdate = true;
  return geo;
}

function mouthSet(a, color, o) {
  const { cx, cy, R, span, head: [rx, ry, rz], w = 0.08 } = o;
  const oy = o.oy ?? cy - 0.005;
  const zf = surfZ(rx, ry, rz);
  const smile = onHead(place(arcGeo(color, R, 0.018, span), { x: cx, y: cy }), rx, ry, rz, 0.01);
  const open = ball(color, cx, oy, zf(cx, oy) + 0.004, w * 0.5, w * 0.62, 0.02, 0, 12);
  const flat = P(new THREE.CapsuleGeometry(0.014, w, 3, 8), color, { x: cx, y: oy, z: zf(cx, oy) + 0.008, rz: Math.PI / 2 });
  a.mouths = { smile: mesh(a.head, smile, false), o: mesh(a.head, open, false), flat: mesh(a.head, flat, false) };
  a.mouths.smile.visible = true;
  a.mouths.o.visible = false;
  a.mouths.flat.visible = false;
}

function eyeRig(parent, x, y, z, r, look = 0.6) {
  const pr = r * look, pz = r * 0.9 - pr * 0.35;
  const open = new THREE.Mesh(merged([
    ball(WHITE, 0, 0, 0, r, r, r * 0.9, 0, 18),
    ball(INK, 0, r * 0.04, pz, pr, pr, pr * 0.85, 0, 16),
    ball(WHITE, pr * 0.36, pr * 0.4 + r * 0.04, pz + pr * 0.62, pr * 0.3, pr * 0.3, pr * 0.22, 0, 8),
  ]), SKIN);
  open.position.set(x, y, z);
  parent.add(open);
  const shut = new THREE.Mesh(arcGeo(INK, r * 0.72, r * 0.13, 2.4), SKIN);
  shut.position.set(x, y + r * 0.05, z + r * 0.9);
  parent.add(shut);
  return { open, shut, k: 1 };
}

function limb(color, paw, len, r, pawR) {
  return merged([
    P(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 10), color, { y: -len / 2 }),
    ball(paw, 0, -len, 0.02, pawR * 1.1, pawR, pawR * 1.1),
  ]);
}

function tailCurl(color, x, y, z, turns, r0, dz) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const an = -Math.PI / 2 + t * TAU * turns;
    const r = r0 * (1 - 0.3 * t);
    pts.push(new THREE.Vector3(r * Math.cos(an), 0.1 + r * Math.sin(an), -dz * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = paint(new THREE.TubeGeometry(curve, 48, 0.024, 8, false), color);
  const end = pts[pts.length - 1];
  const g = merged([tube, ball(color, end.x, end.y, end.z, 0.024, 0.024, 0.024, 0, 8)]);
  return place(g, { x, y, z });
}

const BUILDERS = {
  capybara(a) {
    const C = '#b97c4b', D = '#8a5733', L = '#e3b583', K = '#2b1a10';
    const H = [0.28, 0.22, 0.25];
    a.feetColor = D; a.armColor = C; a.shoulder = [0.37, 0.6, 0.02];
    a.armGeo = limb(C, D, 0.36, 0.085, 0.1);
    mesh(a.body, merged([
      ball(C, 0, 0.42, 0, 0.46, 0.43, 0.42),
      ball(L, 0, 0.32, 0.2, 0.31, 0.28, 0.2),
    ]));
    a.head.position.set(0, 0.92, 0.08);
    mesh(a.head, merged([
      rbox(C, 0.56, 0.44, 0.5, 0.17, 0, 0, 0),
      ball(D, -0.2, 0.23, -0.04, 0.1, 0.07, 0.07),
      ball(D, 0.2, 0.23, -0.04, 0.1, 0.07, 0.07),
      ball(L, -0.2, 0.23, -0.01, 0.06, 0.045, 0.04),
      ball(L, 0.2, 0.23, -0.01, 0.06, 0.045, 0.04),
      rbox(K, 0.17, 0.095, 0.07, 0.042, 0, -0.085, 0.26),
    ]));
    a.eyes.push(eyeRig(a.head, -0.15, 0.08, 0.2, 0.072, 0.6));
    a.eyes.push(eyeRig(a.head, 0.15, 0.08, 0.2, 0.072, 0.6));
    a.cheeks = new THREE.Group();
    a.head.add(a.cheeks);
    mesh(a.cheeks, merged([ball(L, -0.19, -0.1, 0.16, 0.07, 0.05, 0.05), ball(L, 0.19, -0.1, 0.16, 0.07, 0.05, 0.05)]), false);
    mouthSet(a, K, { cx: 0, cy: -0.16, R: 0.058, span: 1.5, head: H, w: 0.1 });
  },

  frog(a) {
    const C = '#62cf48', Dk = '#3fa030', L = '#e4f58c', PK = '#ff9ab0', IN = '#2a5a1c';
    const B = [0.46, 0.4, 0.42], H = [0.46, 0.27, 0.38];
    a.feetColor = '#4fb53a'; a.armColor = C; a.wideFeet = true; a.shoulder = [0.34, 0.6, 0.04];
    a.armGeo = limb(C, L, 0.3, 0.07, 0.09);
    const spots = [[2.6, 0.3], [3.7, 0.2], [3.1, 0.9], [2.9, -0.1]].map(([ax, ay]) => {
      const q = onEll(B[0], B[1], B[2], ax, ay);
      return ball(Dk, q[0], 0.36 + q[1], q[2], 0.07, 0.045, 0.06, 0, 12);
    });
    mesh(a.body, merged([
      ball(C, 0, 0.36, 0, B[0], B[1], B[2]),
      ball(L, 0, 0.3, 0.2, 0.32, 0.27, 0.2),
      ...spots,
    ]));
    a.head.position.set(0, 0.74, 0.06);
    mesh(a.head, merged([
      ball(C, 0, 0, 0, H[0], H[1], H[2], 0, 28),
      ball(PK, 0.27, -0.06, 0.22, 0.07, 0.05, 0.05),
      ball(PK, -0.27, -0.06, 0.22, 0.07, 0.05, 0.05),
      ball(Dk, 0.08, 0.16, 0.34, 0.022, 0.018, 0.02),
      ball(Dk, -0.08, 0.16, 0.34, 0.022, 0.018, 0.02),
    ]));
    a.eyes.push(eyeRig(a.head, -0.2, 0.22, 0.12, 0.17, 0.52));
    a.eyes.push(eyeRig(a.head, 0.2, 0.22, 0.12, 0.17, 0.52));
    mouthSet(a, IN, { cx: 0, cy: 0.14, R: 0.2, span: 1.9, head: H, w: 0.3, oy: 0.0 });
  },

  pig(a) {
    const C = '#ff9cc4', D = '#ff77ad', Dk = '#e0508c', B2 = '#ffb8d6', K = '#7a2446';
    const H = [0.32, 0.3, 0.3];
    a.feetColor = D; a.armColor = C; a.shoulder = [0.36, 0.6, 0.02];
    a.armGeo = limb(C, Dk, 0.32, 0.085, 0.1);
    mesh(a.body, merged([
      ball(C, 0, 0.4, 0, 0.44, 0.42, 0.42),
      ball(B2, 0, 0.34, 0.2, 0.3, 0.28, 0.2),
    ]));
    a.tail = new THREE.Group();
    a.tail.position.set(0, 0.42, -0.4);
    a.body.add(a.tail);
    mesh(a.tail, tailCurl(D, 0, 0, 0, 1.4, 0.1, 0.07));
    a.head.position.set(0, 0.9, 0.06);
    mesh(a.head, merged([
      ball(C, 0, 0, 0, H[0], H[1], H[2], 0, 26),
      P(new THREE.CylinderGeometry(0.14, 0.15, 0.1, 26), D, { y: -0.04, z: 0.33, rx: Math.PI / 2 }),
      P(new THREE.TorusGeometry(0.14, 0.03, 8, 26), Dk, { y: -0.04, z: 0.38 }),
      ball(K, -0.05, -0.04, 0.39, 0.03, 0.04, 0.012),
      ball(K, 0.05, -0.04, 0.39, 0.03, 0.04, 0.012),
      ball(D, -0.24, 0.16, 0.0, 0.11, 0.15, 0.05, 0.8),
      ball(D, 0.24, 0.16, 0.0, 0.11, 0.15, 0.05, -0.8),
    ]));
    a.eyes.push(eyeRig(a.head, -0.13, 0.09, 0.26, 0.05, 0.62));
    a.eyes.push(eyeRig(a.head, 0.13, 0.09, 0.26, 0.05, 0.62));
    a.cheeks = new THREE.Group();
    a.head.add(a.cheeks);
    mesh(a.cheeks, merged([ball(Dk, -0.2, -0.1, 0.18, 0.075, 0.055, 0.06), ball(Dk, 0.2, -0.1, 0.18, 0.075, 0.055, 0.06)]), false);
    mouthSet(a, K, { cx: 0, cy: -0.21, R: 0.05, span: 1.4, head: H, w: 0.08 });
  },

  penguin(a) {
    const C = '#24345e', W = '#ffffff', O = '#ff9a1f', PK = '#ff8fa8';
    const H = [0.32, 0.3, 0.31];
    a.feetColor = O; a.armColor = C; a.flippers = true; a.wideFeet = true; a.shoulder = [0.3, 0.7, 0.0];
    a.armGeo = P(new THREE.SphereGeometry(1, 16, 12), C, { y: -0.2, sx: 0.065, sy: 0.22, sz: 0.12 });
    mesh(a.body, merged([
      ball(C, 0, 0.5, 0, 0.38, 0.5, 0.36),
      ball(W, 0, 0.44, 0.17, 0.28, 0.4, 0.22),
      ball(C, 0, 0.14, -0.3, 0.12, 0.12, 0.12),
    ]));
    a.head.position.set(0, 0.86, 0.02);
    mesh(a.head, merged([
      ball(C, 0, 0, 0, H[0], H[1], H[2], 0, 26),
      ball(W, 0, -0.03, 0.2, 0.22, 0.2, 0.14),
      P(new THREE.ConeGeometry(0.075, 0.2, 14), O, { y: -0.07, z: 0.36, rx: Math.PI / 2 }),
    ]));
    a.bill = new THREE.Group();
    a.bill.position.set(0, -0.12, 0.27);
    a.head.add(a.bill);
    mesh(a.bill, P(new THREE.ConeGeometry(0.06, 0.16, 12), O, { z: 0.08, rx: Math.PI / 2 }));
    a.eyes.push(eyeRig(a.head, -0.1, 0.06, 0.28, 0.055, 0.6));
    a.eyes.push(eyeRig(a.head, 0.1, 0.06, 0.28, 0.055, 0.6));
    a.cheeks = new THREE.Group();
    a.head.add(a.cheeks);
    mesh(a.cheeks, merged([ball(PK, -0.19, -0.1, 0.2, 0.05, 0.035, 0.03), ball(PK, 0.19, -0.1, 0.2, 0.05, 0.035, 0.03)]), false);
  },

  duck(a) {
    const C = '#ffd23f', Wg = '#f2b91f', Bl = '#fff2b0', O = '#ff8f1f';
    const H = [0.28, 0.28, 0.28];
    a.feetColor = O; a.armColor = C; a.flippers = true; a.wideFeet = true; a.shoulder = [0.37, 0.56, -0.02];
    a.armGeo = limb(C, Wg, 0.3, 0.075, 0.085);
    mesh(a.body, merged([
      ball(C, 0, 0.4, -0.02, 0.42, 0.4, 0.44),
      ball(Bl, 0, 0.36, 0.2, 0.3, 0.27, 0.2),
      ball(Wg, -0.36, 0.44, -0.08, 0.1, 0.24, 0.32, -0.15),
      ball(Wg, 0.36, 0.44, -0.08, 0.1, 0.24, 0.32, 0.15),
    ]));
    a.tail = new THREE.Group();
    a.tail.position.set(0, 0.56, -0.4);
    a.body.add(a.tail);
    mesh(a.tail, merged([
      P(new THREE.ConeGeometry(0.13, 0.3, 14), C, { y: 0.08, rx: -0.55 }),
      ball(C, 0.06, 0.16, -0.08, 0.08, 0.12, 0.05, -0.3),
    ]));
    a.head.position.set(0, 0.9, 0.07);
    mesh(a.head, merged([
      ball(C, 0, 0, 0, H[0], H[1], H[2], 0, 24),
      ball(C, 0, 0.27, -0.04, 0.06, 0.12, 0.05, 0.25),
      ball(C, 0.05, 0.25, -0.1, 0.05, 0.1, 0.04, -0.3),
      rbox(O, 0.26, 0.07, 0.22, 0.034, 0, -0.06, 0.25),
    ]));
    a.bill = new THREE.Group();
    a.bill.position.set(0, -0.1, 0.14);
    a.head.add(a.bill);
    mesh(a.bill, rbox(O, 0.22, 0.05, 0.2, 0.024, 0, -0.02, 0.1));
    a.eyes.push(eyeRig(a.head, -0.12, 0.06, 0.2, 0.058, 0.6));
    a.eyes.push(eyeRig(a.head, 0.12, 0.06, 0.2, 0.058, 0.6));
    a.cheeks = new THREE.Group();
    a.head.add(a.cheeks);
    mesh(a.cheeks, merged([ball('#ffa35c', -0.16, -0.08, 0.2, 0.05, 0.035, 0.04), ball('#ffa35c', 0.16, -0.08, 0.2, 0.05, 0.035, 0.04)]), false);
    a.feetColor = O;
  },
};

function buildRig(kind) {
  const a = { kind, eyes: [], mouths: {}, cheeks: null, bill: null, tail: null };
  a.root = new THREE.Group();
  a.inner = new THREE.Group();
  a.inner.scale.setScalar(1.3);
  a.root.add(a.inner);
  a.pivot = new THREE.Group();
  a.inner.add(a.pivot);
  a.body = new THREE.Group();
  a.pivot.add(a.body);
  a.head = new THREE.Group();
  a.body.add(a.head);
  (BUILDERS[kind] || BUILDERS.capybara)(a);
  const fs = a.wideFeet ? [0.12, 0.05, 0.16] : [0.1, 0.06, 0.13];
  a.feet = [-1, 1].map((s) => {
    const f = new THREE.Group();
    f.position.set(s * 0.15, 0, 0.05);
    mesh(f, ball(a.feetColor, 0, 0.04, 0.03, ...fs));
    a.inner.add(f);
    return f;
  });
  a.arms = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * a.shoulder[0], a.shoulder[1], a.shoulder[2]);
    mesh(p, a.armGeo);
    a.body.add(p);
    p.userData.side = s;
    return p;
  });
  a.butt = new THREE.Object3D();
  a.butt.position.set(0, 0.32, -0.38);
  a.pivot.add(a.butt);
  return a;
}

const RIGS = new Map();

function nodesOf(o) {
  const out = [];
  o.traverse((n) => { out.push(n); });
  return out;
}

export class Animal {
  constructor(kind) {
    if (!RIGS.has(kind)) RIGS.set(kind, buildRig(kind));
    const rig = RIGS.get(kind);
    this.kind = kind;
    this.root = rig.root.clone(true);
    const src = nodesOf(rig.root), dst = nodesOf(this.root);
    const at = new Map(src.map((n, i) => [n, dst[i]]));
    const m = (n) => (n ? at.get(n) : n);
    this.inner = m(rig.inner);
    this.pivot = m(rig.pivot);
    this.body = m(rig.body);
    this.head = m(rig.head);
    this.feet = rig.feet.map(m);
    this.arms = rig.arms.map(m);
    this.eyes = rig.eyes.map((e) => ({ open: m(e.open), shut: m(e.shut), k: 1 }));
    this.mouths = Object.fromEntries(Object.entries(rig.mouths).map(([k, n]) => [k, m(n)]));
    this.cheeks = m(rig.cheeks);
    this.bill = m(rig.bill);
    this.tail = m(rig.tail);
    this.butt = m(rig.butt);
    this.t = Math.random() * 10;
    this.blink = 2 + Math.random() * 3;
    this.spin = 0;
    this.strain = 0;
    this.relief = 0;
    this.wasFart = false;
    this.tag = null;
  }

  setTag(name, color) {
    if (this.tag) { this.root.remove(this.tag); this.tag.material.map.dispose(); }
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '40px "Lilita One", sans-serif';
    const w = Math.min(248, g.measureText(name).width + 34);
    g.fillStyle = 'rgba(20,28,60,0.55)';
    g.beginPath(); g.roundRect((256 - w) / 2, 6, w, 52, 26); g.fill();
    g.fillStyle = color;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    this.tag.scale.set(1.5, 0.375, 1);
    this.tag.position.y = 1.95;
    this.tag.renderOrder = 10;
    this.root.add(this.tag);
  }

  animate(st, dt) {
    this.t += dt;
    const t = this.t;
    const k = Math.min(1, (st.speed || 0) / 2.2);
    const side = st.dir || 0;
    const ph = (st.walkPhase || 0) * Math.PI;
    const fart = !!st.fart;
    const down = st.mode === 'knocked' || st.mode === 'fallen';
    if (fart && !this.wasFart) this.strain = 0.45;
    if (!fart && this.wasFart) this.relief = 0.55;
    this.wasFart = fart;
    this.strain = Math.max(0, this.strain - dt);
    this.relief = Math.max(0, this.relief - dt);
    const straining = fart && this.strain > 0;
    const happy = (fart && !straining) || this.relief > 0;

    let eyeMode = 'open', mouth = 'smile', cheekS = 1;
    if (down) { eyeMode = 'wide'; mouth = 'o'; }
    else if (st.duck) { eyeMode = 'shut'; mouth = 'flat'; cheekS = 1.45; }
    else if (straining) { eyeMode = 'shut'; mouth = 'o'; cheekS = 1.2; }
    else if (happy) eyeMode = 'happy';

    let lean = 0.3, roll = -side * 0.22 * k, sy = 1 + Math.sin(t * 2.2) * 0.015, sxz = 1;
    let armRaise = 1.95 + Math.sin(t * 1.7) * 0.05;
    let armSwing = Math.sin(ph) * 0.35 * k;
    let bodyY = Math.sin(t * 2.6) * 0.02;
    let headX = -0.2, headZ = Math.sin(t * 1.3) * 0.05;
    if (straining) {
      const j = Math.sin(t * 46) * 0.025;
      lean = 0.44; sy *= 1.05 + j; sxz *= 0.97 - j * 0.5; bodyY += 0.03;
      headZ += Math.sin(t * 30) * 0.03;
    } else if (happy) {
      lean = 0.22; bodyY += Math.abs(Math.sin(t * 7)) * 0.05; headZ += Math.sin(t * 9) * 0.06;
    }
    if (st.duck) { sy *= 0.9; sxz *= 1.07; bodyY -= 0.03; armRaise = 2.5; }
    if (down) {
      this.spin += dt * 11;
      armRaise = 2.7 + Math.sin(t * 13) * 0.45;
    } else this.spin *= Math.exp(-dt * 10);

    this.blink -= dt;
    if (this.blink < 0) this.blink = 2.5 + Math.random() * 3.5;
    const blinking = this.blink < 0.12 && eyeMode === 'open';

    this.pivot.position.y = bodyY;
    this.pivot.rotation.set(lean + this.spin, 0, roll);
    this.pivot.scale.set(sxz, sy, sxz);
    for (const e of this.eyes) {
      const target = eyeMode === 'open' || eyeMode === 'wide' ? (blinking ? 0 : 1) : 0;
      e.k += (target - e.k) * Math.min(1, dt * 22);
      const sc = eyeMode === 'wide' ? 1.25 : 1;
      e.open.scale.set(sc, Math.max(0.06, e.k) * sc, sc);
      e.open.visible = e.k > 0.06;
      e.shut.visible = e.k < 0.5;
      e.shut.rotation.z = eyeMode === 'happy' ? Math.PI : 0;
    }
    for (const key in this.mouths) this.mouths[key].visible = key === mouth;
    if (this.bill) this.bill.rotation.x += ((mouth === 'o' ? 0.42 : 0) - this.bill.rotation.x) * Math.min(1, dt * 14);
    if (this.cheeks) {
      const c = this.cheeks.scale.x;
      this.cheeks.scale.setScalar(c + (cheekS - c) * Math.min(1, dt * 8));
    }

    this.arms.forEach((a) => {
      const s = a.userData.side;
      const flail = down ? Math.sin(t * 13 + (s > 0 ? Math.PI : 0)) * 0.9 : 0;
      a.rotation.x = -armRaise + (down ? flail : armSwing * s);
      a.rotation.z = s * (down ? 0.5 : 0.2);
    });
    this.feet.forEach((f, i) => {
      const s = i ? 1 : -1;
      const kick = Math.sin(t * (4 + k * 6) + i * Math.PI) * (0.06 + k * 0.08);
      f.position.z = -0.12 + kick * 0.6 * s;
      f.position.y = 0.06 + kick;
    });
    this.head.rotation.set(headX, 0, headZ);
    if (this.tail) this.tail.rotation.z = Math.sin(t * (fart ? 30 : 4)) * (fart ? 0.6 : 0.2);
  }
}

function ringTexture(colors) {
  const W = 2048;
  const c = document.createElement('canvas');
  c.width = W; c.height = 4;
  const g = c.getContext('2d');
  const n = colors.length;
  for (let x = 0; x < W; x++) {
    const theta = ((x + 0.5) / W) * TAU;
    const phi = Math.PI / 2 - theta;
    let col;
    if (n <= 1) {
      col = Math.floor(((theta / TAU) * 12 + 0.5)) % 2 ? '#ffffff' : '#ff8a2a';
    } else {
      const w = TAU / n;
      const rel = Math.atan2(Math.sin(phi - Math.PI), Math.cos(phi - Math.PI));
      const idx = (((Math.round(rel / w) % n) + n) % n);
      const d = Math.atan2(Math.sin(phi - (Math.PI + idx * w)), Math.cos(phi - (Math.PI + idx * w)));
      const stripe = Math.floor(((d + w / 2) / w) * 6) % 2;
      col = Math.abs(Math.abs(d) - w / 2) < 0.035 ? '#1d2b53' : stripe ? '#ffffff' : colors[idx];
    }
    g.fillStyle = col;
    g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const RING_U = 180, RING_V = 28;

function ringBase() {
  const R = RAFT.ringR, r = RAFT.tubeR;
  const pos = new Float32Array((RING_U + 1) * (RING_V + 1) * 3);
  const uv = new Float32Array((RING_U + 1) * (RING_V + 1) * 2);
  const idx = [];
  let p = 0, q = 0;
  for (let i = 0; i <= RING_U; i++) {
    const a = (i / RING_U) * TAU;
    for (let j = 0; j <= RING_V; j++) {
      const v = (j / RING_V) * TAU;
      const rho = R + r * Math.cos(v);
      pos[p++] = Math.sin(a) * rho; pos[p++] = r * Math.sin(v); pos[p++] = Math.cos(a) * rho;
      uv[q++] = i / RING_U; uv[q++] = j / RING_V;
    }
  }
  for (let i = 0; i < RING_U; i++) {
    for (let j = 0; j < RING_V; j++) {
      const a = i * (RING_V + 1) + j, b = (i + 1) * (RING_V + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function seamGroups(pos) {
  const map = new Map();
  for (let v = 0; v < pos.length; v += 3) {
    const k = `${Math.round(pos[v] * 1e4)},${Math.round(pos[v + 1] * 1e4)},${Math.round(pos[v + 2] * 1e4)}`;
    let g = map.get(k);
    if (!g) map.set(k, g = []);
    g.push(v / 3);
  }
  return [...map.values()].filter((g) => g.length > 1);
}

function weldNormals(geo, groups) {
  const n = geo.attributes.normal.array;
  for (const g of groups) {
    let x = 0, y = 0, z = 0;
    for (const v of g) { x += n[v * 3]; y += n[v * 3 + 1]; z += n[v * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1;
    for (const v of g) { n[v * 3] = x / l; n[v * 3 + 1] = y / l; n[v * 3 + 2] = z / l; }
  }
  geo.attributes.normal.needsUpdate = true;
}

function ropeGeometry() {
  const R = RAFT.ringR, r = RAFT.tubeR;
  const RR = R + r + 0.03;
  const N = 8;
  const pts = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU, b = a + TAU / (2 * N);
    pts.push(new THREE.Vector3(Math.sin(a) * RR, 0.08, Math.cos(a) * RR));
    pts.push(new THREE.Vector3(Math.sin(b) * (RR + 0.012), -0.1, Math.cos(b) * (RR + 0.012)));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  const parts = [paint(new THREE.TubeGeometry(curve, 320, 0.022, 8, true), '#1d2b53')];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU;
    parts.push(place(paint(new THREE.CapsuleGeometry(0.028, 0.04, 3, 8), '#1d2b53'), {
      x: Math.sin(a) * (RR - 0.03), y: 0.08, z: Math.cos(a) * (RR - 0.03), rz: Math.PI / 2, ry: a - Math.PI / 2,
    }));
  }
  return merged(parts);
}

export class RaftView {
  constructor() {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);
    this.deck = new THREE.Group();
    this.root.add(this.deck);

    this.base = ringBase();
    this.basePos = this.base.attributes.position.array.slice();
    this.seams = seamGroups(this.basePos);
    this.tubeMat = new THREE.MeshPhysicalMaterial({ map: ringTexture([1]), roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.14 });
    this.tube = new THREE.Mesh(this.base, this.tubeMat);
    this.tube.position.y = RAFT.tubeCY;
    this.tube.castShadow = true;
    this.tube.receiveShadow = true;
    this.tilt.add(this.tube);

    this.rope = mesh(this.tube, ropeGeometry());

    this.valve = mesh(this.tube, merged([
      P(new THREE.CylinderGeometry(0.036, 0.04, 0.11, 14), '#ffffff', { y: 0.05 }),
      P(new THREE.SphereGeometry(0.05, 14, 10), '#1d2b53', { y: 0.12, sy: 0.6 }),
    ]));
    this.valve.position.set(RAFT.ringR, RAFT.tubeR, 0);

    this.barriers = new THREE.Group();
    this.tilt.add(this.barriers);
    this.postGeo = new THREE.CapsuleGeometry(0.06, 0.7, 6, 12);
    this.capGeo = new THREE.SphereGeometry(0.13, 16, 12);
    this.postMat = new THREE.MeshStandardMaterial({ color: '#1d2b53', roughness: 0.4 });
    this.capMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
    this.sectorKey = '';
    this.tiltX = 0; this.tiltZ = 0; this.tvx = 0; this.tvz = 0;
    this.deflate = 0;
    this.shownD = 0;
    this.t = 0;
  }

  setSectors(colors) {
    const key = colors.join(',');
    if (key === this.sectorKey) return;
    this.sectorKey = key;
    const old = this.tubeMat.map;
    this.tubeMat.map = ringTexture(colors);
    this.tubeMat.needsUpdate = true;
    old?.dispose();
    this.barriers.clear();
    const n = colors.length;
    if (n <= 1) return;
    const TAUn = TAU / n;
    for (let i = 0; i < n; i++) {
      const phi = Math.PI + i * TAUn + TAUn / 2;
      const g = new THREE.Group();
      const post = new THREE.Mesh(this.postGeo, this.postMat);
      post.position.y = 0.32;
      const cap = new THREE.Mesh(this.capGeo, this.capMat);
      cap.position.y = 0.78;
      post.castShadow = true;
      cap.castShadow = true;
      g.add(post, cap);
      g.position.set(Math.sin(phi) * RAFT.ringR, RAFT.tubeCY, Math.cos(phi) * RAFT.ringR);
      g.rotation.y = phi;
      this.barriers.add(g);
    }
  }

  applyDeflate(d) {
    this.shownD = d;
    const P = this.base.attributes.position.array, B = this.basePos;
    const R = RAFT.ringR;
    const wob = 0.6 + 0.4 * Math.sin(this.t * 5);
    const flat = 1 - 0.8 * d;
    for (let v = 0; v < B.length; v += 3) {
      const x = B[v], y = B[v + 1], z = B[v + 2];
      const a = Math.atan2(x, z);
      const ox = Math.hypot(x, z) - R;
      const fold = (Math.sin(a * 11 + 0.8) + Math.sin(a * 5 - 0.5)) * 0.5;
      const ox2 = ox * (1 + 0.5 * d) + 0.05 * d * fold * wob;
      const oy2 = y * flat - 0.03 * d * (0.5 + 0.5 * Math.cos(a * 7));
      const rho = R + ox2;
      P[v] = Math.sin(a) * rho; P[v + 1] = oy2; P[v + 2] = Math.cos(a) * rho;
    }
    this.base.attributes.position.needsUpdate = true;
    this.base.computeVertexNormals();
    weldNormals(this.base, this.seams);
    const s = (RAFT.ringR + RAFT.tubeR * (1 + 0.5 * d) + 0.03) / (RAFT.ringR + RAFT.tubeR + 0.03);
    this.rope.scale.set(s, flat, s);
    this.valve.position.y = RAFT.tubeR * flat;
  }

  update(raft, players, dt, waterBob) {
    this.t += dt;
    let wx = 0, wz = 0;
    for (const p of players) {
      if (!p || p.mode !== 'ok') continue;
      wx += p.x; wz += p.z;
    }
    const ca = Math.cos(raft.a), sa = Math.sin(raft.a);
    const flx = raft.tx * ca - raft.tz * sa, flz = raft.tx * sa + raft.tz * ca;
    const sl = Math.max(-0.6, raft.slope || 0);
    const tx = wz * 0.035 + Math.sin(this.t * 1.7) * 0.02 - sl * flz * 0.8;
    const tz = -wx * 0.035 + Math.cos(this.t * 1.3) * 0.02 + sl * flx * 0.8;
    const steps = Math.min(12, Math.ceil(dt / (1 / 120)));
    const h = Math.min(dt, 0.2) / steps;
    for (let i = 0; i < steps; i++) {
      this.tvx += ((tx - this.tiltX) * 30 - this.tvx * 5) * h;
      this.tvz += ((tz - this.tiltZ) * 30 - this.tvz * 5) * h;
      this.tiltX += this.tvx * h; this.tiltZ += this.tvz * h;
    }
    this.tiltX = Math.max(-0.3, Math.min(0.3, this.tiltX));
    this.tiltZ = Math.max(-0.3, Math.min(0.3, this.tiltZ));
    this.root.position.set(raft.x, raft.y + (waterBob || 0), raft.z);
    this.root.rotation.y = raft.a;
    this.tilt.rotation.set(this.tiltX, 0, this.tiltZ);
    const d = this.deflate;
    this.tilt.position.y = Math.sin(this.t * 2.1) * 0.03;
    if (d !== this.shownD || (d > 0 && d < 1)) this.applyDeflate(d);
    this.tube.position.y = RAFT.tubeCY - d * 0.1;
  }
}
