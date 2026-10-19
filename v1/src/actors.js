// Toot Tube: the inflatable ring and the five hand-built animals, with their procedural animation.

import * as THREE from 'three';
import { RAFT } from './config.js';

const matCache = new Map();
function mat(color, rough = 0.55) {
  const k = color + rough;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  return matCache.get(k);
}
const SPH = new THREE.SphereGeometry(1, 22, 16);
const SPH_LO = new THREE.SphereGeometry(1, 12, 9);

function ball(parent, color, x, y, z, sx, sy = sx, sz = sx, lo = false) {
  const m = new THREE.Mesh(lo ? SPH_LO : SPH, mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function eye(parent, x, y, z, r, white = true, look = 0.55) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (white) ball(g, '#ffffff', 0, 0, 0, r, r, r * 0.8);
  const pr = white ? r * look : r;
  ball(g, '#16152b', 0, white ? r * 0.08 : 0, white ? r * 0.62 : 0, pr, pr, pr * 0.6);
  ball(g, '#ffffff', pr * 0.35, pr * 0.45 + (white ? r * 0.08 : 0), (white ? r * 0.62 : 0) + pr * 0.45, pr * 0.28, pr * 0.28, pr * 0.2, true);
  parent.add(g);
  return g;
}

function limb(parent, color, x, y, z, sx, sy, sz) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = ball(pivot, color, 0, -sy * 0.7, 0, sx, sy, sz);
  m.castShadow = true;
  parent.add(pivot);
  return pivot;
}

const BUILDERS = {
  capybara(a) {
    const C = '#b97c4b', D = '#8a5733', L = '#d9a774';
    ball(a.body, C, 0, 0.44, 0, 0.41, 0.43, 0.39);
    ball(a.body, L, 0, 0.4, 0.2, 0.3, 0.32, 0.22);
    ball(a.head, C, 0, 0, 0, 0.29, 0.26, 0.31);
    ball(a.head, D, 0, -0.04, 0.24, 0.2, 0.15, 0.16);
    ball(a.head, '#2b1a10', 0.07, 0.0, 0.38, 0.03, 0.025, 0.02, true);
    ball(a.head, '#2b1a10', -0.07, 0.0, 0.38, 0.03, 0.025, 0.02, true);
    ball(a.head, C, 0.19, 0.2, -0.06, 0.07, 0.07, 0.05, true);
    ball(a.head, C, -0.19, 0.2, -0.06, 0.07, 0.07, 0.05, true);
    a.eyes.push(eye(a.head, 0.14, 0.09, 0.17, 0.05, false));
    a.eyes.push(eye(a.head, -0.14, 0.09, 0.17, 0.05, false));
    ball(a.head, C, 0.14, 0.13, 0.18, 0.07, 0.03, 0.05, true);
    ball(a.head, C, -0.14, 0.13, 0.18, 0.07, 0.03, 0.05, true);
    a.head.position.set(0, 0.9, 0.06);
    a.feetColor = D; a.armColor = C;
  },
  frog(a) {
    const C = '#62cf48', L = '#e6f59a';
    ball(a.body, C, 0, 0.38, 0, 0.44, 0.38, 0.4);
    ball(a.body, L, 0, 0.36, 0.2, 0.32, 0.27, 0.22);
    ball(a.head, C, 0, 0, 0, 0.42, 0.28, 0.36);
    a.eyes.push(eye(a.head, 0.19, 0.24, 0.1, 0.14, true, 0.5));
    a.eyes.push(eye(a.head, -0.19, 0.24, 0.1, 0.14, true, 0.5));
    ball(a.head, C, 0.19, 0.19, 0.06, 0.16, 0.12, 0.15);
    ball(a.head, C, -0.19, 0.19, 0.06, 0.16, 0.12, 0.15);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 20, Math.PI), mat('#2a5a1c'));
    mouth.rotation.set(0, 0, Math.PI);
    mouth.position.set(0, -0.02, 0.33);
    mouth.scale.set(1, 0.45, 1);
    a.head.add(mouth);
    ball(a.head, '#ff9ab0', 0.27, -0.04, 0.24, 0.06, 0.035, 0.03, true);
    ball(a.head, '#ff9ab0', -0.27, -0.04, 0.24, 0.06, 0.035, 0.03, true);
    a.head.position.set(0, 0.72, 0.04);
    a.feetColor = '#4fb53a'; a.armColor = C; a.wideFeet = true;
  },
  pig(a) {
    const C = '#ff9cc4', D = '#ff77ad';
    ball(a.body, C, 0, 0.44, 0, 0.42, 0.44, 0.4);
    ball(a.head, C, 0, 0, 0, 0.3, 0.28, 0.29);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.12, 20), mat(D));
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.04, 0.3);
    snout.castShadow = true;
    a.head.add(snout);
    ball(a.head, '#c94d82', 0.045, -0.04, 0.365, 0.025, 0.035, 0.01, true);
    ball(a.head, '#c94d82', -0.045, -0.04, 0.365, 0.025, 0.035, 0.01, true);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 12), mat(D));
      ear.position.set(s * 0.17, 0.27, 0.0);
      ear.rotation.set(0.35, 0, -s * 0.5);
      a.head.add(ear);
    }
    a.eyes.push(eye(a.head, 0.12, 0.08, 0.24, 0.045, false));
    a.eyes.push(eye(a.head, -0.12, 0.08, 0.24, 0.045, false));
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 14, Math.PI * 1.6), mat(D));
    tail.position.set(0, 0.5, -0.42);
    tail.rotation.y = Math.PI / 2;
    a.body.add(tail);
    a.tail = tail;
    a.head.position.set(0, 0.92, 0.06);
    a.feetColor = D; a.armColor = C;
  },
  penguin(a) {
    const C = '#24345e', W = '#ffffff', O = '#ff9a1f';
    ball(a.body, C, 0, 0.5, 0, 0.38, 0.5, 0.36);
    ball(a.body, W, 0, 0.45, 0.17, 0.29, 0.4, 0.22);
    ball(a.head, W, 0.08, 0.02, 0.24, 0.12, 0.13, 0.08, true);
    ball(a.head, W, -0.08, 0.02, 0.24, 0.12, 0.13, 0.08, true);
    a.eyes.push(eye(a.head, 0.09, 0.04, 0.29, 0.06, false));
    a.eyes.push(eye(a.head, -0.09, 0.04, 0.29, 0.06, false));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 12), mat(O));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.06, 0.38);
    a.head.add(beak);
    ball(a.head, '#ff8fa8', 0.2, -0.07, 0.24, 0.05, 0.03, 0.02, true);
    ball(a.head, '#ff8fa8', -0.2, -0.07, 0.24, 0.05, 0.03, 0.02, true);
    a.head.position.set(0, 0.8, 0.02);
    a.feetColor = O; a.armColor = C; a.flippers = true; a.wideFeet = true;
  },
  duck(a) {
    const C = '#ffd23f', O = '#ff8f1f';
    ball(a.body, C, 0, 0.42, -0.02, 0.4, 0.4, 0.43);
    ball(a.body, '#fff2b0', 0, 0.38, 0.2, 0.28, 0.28, 0.2);
    ball(a.head, C, 0, 0, 0, 0.27, 0.27, 0.27);
    ball(a.head, O, 0, -0.06, 0.26, 0.15, 0.05, 0.15);
    ball(a.head, O, 0, -0.1, 0.24, 0.12, 0.035, 0.13);
    a.eyes.push(eye(a.head, 0.11, 0.07, 0.21, 0.05, false));
    a.eyes.push(eye(a.head, -0.11, 0.07, 0.21, 0.05, false));
    ball(a.head, C, 0, 0.28, -0.02, 0.06, 0.1, 0.06, true);
    ball(a.head, C, 0.04, 0.3, -0.07, 0.05, 0.08, 0.05, true);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 10), mat(C));
    tail.position.set(0, 0.5, -0.45);
    tail.rotation.x = -2.2;
    a.body.add(tail);
    a.tail = tail;
    a.head.position.set(0, 0.9, 0.08);
    a.feetColor = O; a.armColor = C; a.flippers = true; a.wideFeet = true;
  },
};

export class Animal {
  constructor(kind) {
    this.kind = kind;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group();
    this.pivot.scale.setScalar(1);
    this.inner = new THREE.Group();
    this.inner.scale.setScalar(1.3);
    this.root.add(this.inner);
    this.inner.add(this.pivot);
    this.body = new THREE.Group();
    this.pivot.add(this.body);
    this.head = new THREE.Group();
    this.body.add(this.head);
    this.eyes = [];
    (BUILDERS[kind] || BUILDERS.capybara)(this);
    const fs = this.wideFeet ? [0.11, 0.05, 0.16] : [0.09, 0.06, 0.12];
    this.feet = [-1, 1].map((s) => {
      const f = new THREE.Group();
      f.position.set(s * 0.15, 0, 0.05);
      ball(f, this.feetColor, 0, 0.04, 0.03, ...fs);
      this.inner.add(f);
      return f;
    });
    const as = this.flippers ? [0.06, 0.2, 0.12] : [0.07, 0.15, 0.07];
    this.arms = [-1, 1].map((s) => {
      const p = limb(this.body, this.armColor, s * 0.38, 0.62, 0.02, ...as);
      p.rotation.z = s * 0.35;
      p.userData.side = s;
      return p;
    });
    this.butt = new THREE.Object3D();
    this.butt.position.set(0, 0.32, -0.38);
    this.pivot.add(this.butt);
    this.t = Math.random() * 10;
    this.blink = 2 + Math.random() * 3;
    this.spin = 0;
    this.face = 0;
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
    const ph = (st.walkPhase || 0) * Math.PI;
    const side = st.dir || 0;
    let lean = 0.32, roll = -side * 0.22 * k, sy = 1 + Math.sin(t * 2.2) * 0.015, sxz = 1, eyeY = 1;
    let armRaise = 1.95 + Math.sin(t * 1.7) * 0.05, armSwing = Math.sin(ph) * 0.35 * k;
    let bodyY = Math.sin(t * 2.6) * 0.02;
    if (st.fart) {
      const j = Math.sin(t * 46) * 0.025;
      lean = 0.5; sy *= 1.06 + j; sxz *= 0.97 - j; eyeY = 0.25; bodyY += 0.04;
    }
    if (st.duck) { eyeY = 0.1; sxz *= 1.06; armRaise = 2.6; }
    if (st.mode === 'knocked' || st.mode === 'fallen') {
      this.spin += dt * 11;
      armRaise = 3.0; eyeY = 1.4;
    } else this.spin *= Math.exp(-dt * 10);
    this.blink -= dt;
    if (this.blink < 0) this.blink = 2.5 + Math.random() * 3.5;
    if (this.blink < 0.12 && !st.fart && !st.duck) eyeY = 0.1;

    this.pivot.position.y = bodyY;
    this.pivot.rotation.set(lean + this.spin, 0, roll);
    this.pivot.scale.set(sxz, sy, sxz);
    for (const e of this.eyes) e.scale.y += (eyeY - e.scale.y) * Math.min(1, dt * 20);
    this.arms.forEach((a) => {
      const s = a.userData.side;
      a.rotation.x = -armRaise + armSwing * s;
      a.rotation.z = s * 0.18;
    });
    this.feet.forEach((f, i) => {
      const s = i ? 1 : -1;
      const kick = Math.sin(t * (4 + k * 6) + i * Math.PI) * (0.06 + k * 0.08);
      f.position.z = -0.12 + kick * 0.6 * s;
      f.position.y = 0.06 + kick;
    });
    this.head.rotation.z = Math.sin(t * 1.3) * 0.04 + (st.fart ? Math.sin(t * 30) * 0.03 : 0);
    this.head.rotation.x = -0.25;
    if (this.tail) this.tail.rotation.z = Math.sin(t * (st.fart ? 30 : 4)) * (st.fart ? 0.6 : 0.2);
  }
}

const TAU = Math.PI * 2;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

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
      const rel = wrapA(phi - Math.PI);
      const idx = (((Math.round(rel / w) % n) + n) % n);
      const d = wrapA(phi - (Math.PI + idx * w));
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

export class RaftView {
  constructor() {
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);
    this.deck = new THREE.Group();
    this.root.add(this.deck);

    const tg = new THREE.TorusGeometry(RAFT.ringR, RAFT.tubeR, 28, 160);
    tg.rotateX(Math.PI / 2);
    this.tubeMat = new THREE.MeshStandardMaterial({ map: ringTexture([1]), roughness: 0.28, metalness: 0 });
    this.tube = new THREE.Mesh(tg, this.tubeMat);
    this.tube.position.y = RAFT.tubeCY;
    this.tube.castShadow = true;
    this.tube.receiveShadow = true;
    this.tilt.add(this.tube);

    const rope = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.6 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + Math.PI / 8;
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 20, Math.PI), rope);
      h.position.set(Math.sin(a) * (RAFT.ringR + RAFT.tubeR * 0.9), RAFT.tubeCY - 0.02, Math.cos(a) * (RAFT.ringR + RAFT.tubeR * 0.9));
      h.rotation.set(0, a + Math.PI / 2, Math.PI);
      this.tilt.add(h);
    }
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
    valve.position.set(0, RAFT.tubeCY + RAFT.tubeR + 0.02, -RAFT.ringR);
    this.tilt.add(valve);

    this.barriers = new THREE.Group();
    this.tilt.add(this.barriers);
    this.sectorKey = '';
    this.tiltX = 0; this.tiltZ = 0; this.tvx = 0; this.tvz = 0;
    this.deflate = 0;
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
    const postMat = new THREE.MeshStandardMaterial({ color: '#1d2b53', roughness: 0.4 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
    const w = TAU / n;
    for (let i = 0; i < n; i++) {
      const phi = Math.PI + i * w + w / 2;
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.7, 6, 12), postMat);
      post.position.y = 0.32;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), capMat);
      cap.position.y = 0.78;
      g.add(post, cap);
      g.children.forEach((m) => { m.castShadow = true; });
      g.position.set(Math.sin(phi) * RAFT.ringR, RAFT.tubeCY, Math.cos(phi) * RAFT.ringR);
      g.rotation.y = phi;
      this.barriers.add(g);
    }
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
    this.tvx += ((tx - this.tiltX) * 30 - this.tvx * 5) * dt;
    this.tvz += ((tz - this.tiltZ) * 30 - this.tvz * 5) * dt;
    this.tiltX += this.tvx * dt; this.tiltZ += this.tvz * dt;
    this.root.position.set(raft.x, raft.y + (waterBob || 0), raft.z);
    this.root.rotation.y = raft.a;
    this.tilt.rotation.set(this.tiltX, 0, this.tiltZ);
    this.tilt.position.y = -this.deflate * 0.1 + Math.sin(this.t * 2.1) * 0.03;
    const d = this.deflate;
    const wob = d > 0 && d < 1 ? Math.sin(this.t * 40) * 0.06 * (1 - d) : 0;
    this.tube.scale.set(1 + wob + d * 0.05, Math.max(0.3, 1 - d * 0.65), 1 - wob + d * 0.05);
    this.tube.position.y = RAFT.tubeCY - d * 0.12;
  }
}
