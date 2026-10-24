// Toot Tube: hazard models (spiked rollers, angry pufferfish, donut bumpers, sweeper posts, bean cans, geysers, whirlpools), drawn at time T from sim.js.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, place, merged } from './util3d.js';
import { doorsClose, geyserState } from './sim.js';

const PURPLE = '#7b3ff2';
const PURPLE_D = '#5b25cf';
const PURPLE_L = '#a987ff';
const SPIKE = '#fff1c2';
const INK = '#1d1438';
const NAVY = '#1d2b53';
const CREAM = '#fff1c2';
const WHITE = '#ffffff';
const TAU = Math.PI * 2;

const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });

function spikeAt(parts, x, y, z, dx, dy, dz, len = 0.34, rad = 0.12) {
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const g = paint(new THREE.ConeGeometry(rad, len, 9), SPIKE);
  g.applyQuaternion(q);
  g.translate(x + dir.x * len * 0.45, y + dir.y * len * 0.45, z + dir.z * len * 0.45);
  parts.push(g);
}

function arcPart(color, R, tube, span, up) {
  const g = new THREE.TorusGeometry(R, tube, 8, 28, span);
  const c = up ? Math.PI / 2 : -Math.PI / 2;
  g.rotateZ(c - span / 2);
  const ends = [c - span / 2, c + span / 2].map((a) =>
    P(new THREE.SphereGeometry(tube, 8, 6), color, { x: Math.cos(a) * R, y: Math.sin(a) * R }));
  return merged([paint(g, color), ...ends]);
}

const P = (geo, color, t) => place(paint(geo, color), t);

const rollerCache = new Map();
function rollerGeometry(len) {
  const key = Math.round(len * 20);
  if (rollerCache.has(key)) return rollerCache.get(key);
  const parts = [];
  const R = 0.42;
  parts.push(place(paint(new THREE.CylinderGeometry(R, R, len, 24, 1), PURPLE), { rz: Math.PI / 2 }));
  for (const sx of [-1, 1]) parts.push(place(paint(new THREE.SphereGeometry(R, 24, 16), PURPLE), { x: sx * len / 2 }));
  const rings = Math.max(2, Math.floor(len / 0.55));
  for (let i = 0; i <= rings; i++) {
    const x = -len / 2 + 0.25 + (i / rings) * (len - 0.5);
    parts.push(place(paint(new THREE.TorusGeometry(R + 0.01, 0.05, 8, 26), PURPLE_D), { x, ry: Math.PI / 2 }));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + (i % 2) * (Math.PI / 8);
      const dy = Math.cos(a), dz = Math.sin(a);
      spikeAt(parts, x, dy * R, dz * R, 0, dy, dz);
    }
  }
  const g = merged(parts);
  rollerCache.set(key, g);
  return g;
}

function buoyGeometry() {
  const parts = [paint(new THREE.SphereGeometry(0.62, 36, 26), PURPLE)];
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const p = ico.attributes.position;
  const seen = new Set();
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const k = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (v.z > 0.55) continue;
    spikeAt(parts, v.x * 0.58, v.y * 0.58, v.z * 0.58, v.x, v.y, v.z, 0.36, 0.11);
  }
  for (const s of [-1, 1]) {
    parts.push(P(new THREE.SphereGeometry(1, 18, 14), WHITE, { x: s * 0.22, y: 0.14, z: 0.48, sx: 0.16, sy: 0.16, sz: 0.15 }));
    parts.push(P(new THREE.SphereGeometry(1, 14, 10), INK, { x: s * 0.17, y: 0.12, z: 0.6, sx: 0.085, sy: 0.085, sz: 0.07 }));
    parts.push(P(new THREE.SphereGeometry(1, 8, 6), WHITE, { x: s * 0.17 + 0.03, y: 0.16, z: 0.66, sx: 0.03, sy: 0.03, sz: 0.03 }));
    parts.push(P(new RoundedBoxGeometry(0.3, 0.07, 0.08, 2, 0.03), PURPLE_D, { x: s * 0.22, y: 0.32, z: 0.47, rz: s * 0.4 }));
    parts.push(P(new THREE.SphereGeometry(1, 12, 9), PURPLE_L, { x: s * 0.6, y: -0.1, z: 0.1, sx: 0.1, sy: 0.22, sz: 0.14, rz: s * 0.5 }));
  }
  parts.push(arcPart(INK, 0.16, 0.03, 1.1, true).translate(0, -0.2, 0.6));
  return merged(parts);
}

function sweeperPost() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    parts.push(place(paint(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 28, 1), i % 2 ? '#ffffff' : '#40d3c0'), { y: -0.6 + i * 0.5 }));
  }
  for (let i = 0; i <= 4; i++) {
    parts.push(place(paint(new THREE.TorusGeometry(0.55, 0.045, 8, 28), '#ffffff'), { y: -0.85 + i * 0.5, rx: Math.PI / 2 }));
  }
  parts.push(place(paint(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 20), '#ffffff'), { y: 1.4 }));
  parts.push(place(paint(new THREE.SphereGeometry(0.45, 24, 16), '#ffd23f'), { y: 2.3, sy: 0.8 }));
  return merged(parts);
}

function sweeperArms(len, arms) {
  const parts = [];
  for (let k = 0; k < arms; k++) {
    const phi = (k / arms) * TAU;
    const arm = [];
    const bar = paint(new THREE.CylinderGeometry(0.15, 0.15, len - 0.4, 12, 1), PURPLE);
    place(bar, { x: 0.2 + (len - 0.4) / 2, rz: Math.PI / 2 });
    arm.push(bar);
    arm.push(place(paint(new THREE.SphereGeometry(0.22, 16, 12), PURPLE_D), { x: len }));
    for (let x = 0.9; x < len - 0.1; x += 0.42) {
      spikeAt(arm, x, 0, 0.13, 0, 0, 1, 0.3, 0.09);
      spikeAt(arm, x, 0, -0.13, 0, 0, -1, 0.3, 0.09);
      spikeAt(arm, x + 0.21, 0.13, 0, 0, 1, 0, 0.26, 0.08);
    }
    const g = merged(arm);
    g.rotateY(-phi);
    parts.push(g);
  }
  parts.push(place(paint(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 24), PURPLE_D), {}));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    spikeAt(parts, Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72, Math.cos(a), 0, Math.sin(a), 0.2, 0.08);
  }
  return merged(parts);
}

function housingGeometry() {
  return merged([
    P(new RoundedBoxGeometry(1.7, 1.5, 2.2, 3, 0.2), NAVY, {}),
    P(new RoundedBoxGeometry(1.5, 0.1, 2.0, 2, 0.04), CREAM, { y: 0.8 }),
    P(new RoundedBoxGeometry(0.06, 1.1, 1.9, 2, 0.02), CREAM, { x: 0.87 }),
    P(new RoundedBoxGeometry(0.06, 1.1, 1.9, 2, 0.02), CREAM, { x: -0.87 }),
  ]);
}

function foamGeometry() {
  let g = new THREE.SphereGeometry(1.1, 28, 20);
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.1 * Math.sin(x * 4.3 + z * 2.1) * Math.cos(y * 3.7 - z * 1.3);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

function canTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ff8a2a'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffd23f'; g.fillRect(0, 30, 512, 16); g.fillRect(0, 210, 512, 16);
  for (let k = 0; k < 2; k++) {
    const ox = k * 256;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(ox + 128, 128, 92, 62, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c4551d';
    for (let b = 0; b < 5; b++) {
      g.beginPath(); g.ellipse(ox + 82 + b * 23, 150 + (b % 2) * 8, 13, 9, 0.4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = NAVY;
    g.font = '52px "Lilita One", sans-serif';
    g.textAlign = 'center';
    g.fillText('BEANS', ox + 128, 118);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function whirlMaterial(h) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { t: { value: 0 }, str: { value: h.str } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float t; uniform float str; varying vec2 vP;
      void main(){
        float R = ${h.R.toFixed(2)};
        float r = length(vP);
        float a = atan(vP.y, vP.x);
        float rn = clamp(r / R, 0.0, 1.0);
        float arms = 0.5 + 0.5 * sin(3.0 * a + 4.5 * log(r + 0.25) - t * str * 4.0);
        float foam = smoothstep(0.78, 0.95, arms) * smoothstep(0.12, 0.45, rn) * (1.0 - smoothstep(0.8, 0.98, rn));
        float rim = smoothstep(0.86, 0.99, rn);
        vec3 deep = vec3(0.03, 0.22, 0.48);
        vec3 mid = vec3(0.12, 0.52, 0.86);
        vec3 c = mix(deep, mid, rn * 0.9 + arms * 0.1);
        c = mix(c, vec3(0.92, 0.99, 1.0), foam * 0.85 + rim * 0.8);
        float alpha = (0.5 + foam * 0.35 + rim * 0.5) * (1.0 - smoothstep(0.985, 1.0, rn));
        gl_FragColor = vec4(c, alpha);
      }`,
  });
}

function geyserPadMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { t: { value: 0 }, k: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float t; uniform float k; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float r = length(vP) / 1.7;
        vec2 g = floor(vP * 3.0);
        vec2 f = fract(vP * 3.0) - 0.5;
        float ph = fract(t * (0.8 + h(g)) + h(g + 3.1));
        float b = (1.0 - smoothstep(0.05, 0.22 * ph + 0.05, length(f))) * step(h(g + 7.0), 0.35 + k * 0.6);
        float ring = smoothstep(0.08, 0.0, abs(r - 0.92)) * 0.5;
        float a = (b * (0.4 + k * 0.6) + ring) * (1.0 - smoothstep(0.9, 1.0, r));
        gl_FragColor = vec4(vec3(0.95, 1.0, 1.0), a);
      }`,
  });
}

function stripeTexture(colors, n) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 4;
  const g = c.getContext('2d');
  for (let x = 0; x < 512; x++) {
    g.fillStyle = Math.floor((x / 512) * n) % 2 ? colors[1] : colors[0];
    g.fillRect(x, 0, 1, 4);
  }
  return c;
}

export class HazardViews {
  constructor(scene, track, haz) {
    this.track = track;
    this.haz = haz;
    this.items = [];
    this.beans = [];
    const donutGeo = new THREE.TorusGeometry(1.12, 0.36, 28, 96);
    donutGeo.rotateX(Math.PI / 2);
    const donutTex = new THREE.CanvasTexture(stripeTexture(['#4fe0b0', '#ffffff'], 8));
    donutTex.colorSpace = THREE.SRGBColorSpace;
    donutTex.wrapS = donutTex.wrapT = THREE.RepeatWrapping;
    donutTex.anisotropy = 8;
    const silver = new THREE.MeshStandardMaterial({ color: '#dfe6f0', roughness: 0.25, metalness: 0.6 });
    const shared = {
      solid: solidMat,
      buoyGeo: buoyGeometry(),
      donutGeo,
      donutMat: new THREE.MeshPhysicalMaterial({ map: donutTex, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      housingGeo: housingGeometry(),
      postGeo: sweeperPost(),
      canGeo: new THREE.CylinderGeometry(0.32, 0.32, 0.72, 28, 1),
      canMat: [new THREE.MeshStandardMaterial({ map: canTexture(), roughness: 0.4 }), silver, silver],
      rimGeo: merged([
        place(paint(new THREE.TorusGeometry(0.32, 0.03, 8, 28), '#dfe6f0'), { y: 0.36, rx: Math.PI / 2 }),
        place(paint(new THREE.TorusGeometry(0.32, 0.03, 8, 28), '#dfe6f0'), { y: -0.36, rx: Math.PI / 2 }),
        P(new RoundedBoxGeometry(0.14, 0.03, 0.08, 2, 0.012), '#dfe6f0', { y: 0.37, z: 0.06 }),
      ]),
      rimMat: silver,
      glowMat: new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.45, depthWrite: false }),
      ringMat: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false }),
      foamGeo: foamGeometry(),
      foamMat: new THREE.MeshStandardMaterial({ color: '#f4fdff', roughness: 0.7, emissive: '#bdefff', emissiveIntensity: 0.15 }),
      jetMat: new THREE.MeshStandardMaterial({ color: '#e9fbff', transparent: true, opacity: 0.8, roughness: 0.2, side: THREE.DoubleSide, emissive: '#bdefff', emissiveIntensity: 0.3 }),
      housingMat: solidMat,
    };
    for (const h of haz.list) {
      const before = scene.children.length;
      const count = this.items.length;
      this.build(scene, h, shared);
      const objs = scene.children.slice(before);
      for (let i = count; i < this.items.length; i++) this.items[i].objs = objs;
    }
  }

  build(scene, h, S) {
    const haz = this.haz;
    if (h.type === 'roller') {
      const len = Math.hypot(h.bx - h.ax, h.bz - h.az);
      const g = new THREE.Group();
      const m = new THREE.Mesh(rollerGeometry(len), S.solid);
      m.castShadow = true;
      g.add(m);
      g.position.set((h.ax + h.bx) / 2, h.wy + 0.22, (h.az + h.bz) / 2);
      g.rotation.y = Math.atan2(-(h.bz - h.az), h.bx - h.ax);
      scene.add(g);
      this.items.push({ h, update: (T) => { m.rotation.x = T * 1.6; } });
    } else if (h.type === 'slider') {
      const g = new THREE.Group();
      const m = new THREE.Mesh(rollerGeometry(h.len), S.solid);
      m.castShadow = true;
      g.add(m);
      g.rotation.y = Math.atan2(-h.rz, h.rx);
      scene.add(g);
      this.items.push({ h, update: (T) => {
        const c = haz.sliderLat(h, T);
        g.position.set(h.cx + h.rx * c, h.wy + 0.22, h.cz + h.rz * c);
        m.rotation.x = c * 1.4;
      } });
    } else if (h.type === 'doors') {
      const len = h.hw + 1.6;
      const doors = [-1, 1].map((side) => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(rollerGeometry(len), S.solid);
        m.castShadow = true;
        g.add(m);
        g.rotation.y = Math.atan2(-h.rz, h.rx);
        scene.add(g);
        const box = new THREE.Mesh(S.housingGeo, S.housingMat);
        box.position.set(h.cx + h.rx * side * (h.hw + 0.55), h.wy + 0.45, h.cz + h.rz * side * (h.hw + 0.55));
        box.rotation.y = Math.atan2(-h.rz, h.rx);
        box.castShadow = true;
        scene.add(box);
        return { g, m, side };
      });
      this.items.push({ h, update: (T) => {
        const k = doorsClose(T, h.period, h.phase);
        const L = 0.6 + (h.hw - 0.25 - 0.6) * k;
        const inner = h.hw + 0.4 - L - 0.4;
        for (const d of doors) {
          const c = d.side * (inner + len / 2);
          d.g.position.set(h.cx + h.rx * c, h.wy + 0.22, h.cz + h.rz * c);
          d.m.rotation.x = k * 6 * d.side;
        }
      } });
    } else if (h.type === 'buoy') {
      const m = new THREE.Mesh(S.buoyGeo, S.solid);
      m.castShadow = true;
      scene.add(m);
      const ph = h.s * 0.37;
      this.items.push({ h, update: (T) => {
        const p = haz.buoyPos(h, T);
        m.position.set(p.x, h.wy + 0.18 + Math.sin(T * 2 + ph) * 0.08, p.z);
        m.rotation.y = T * 0.5 + ph;
        m.rotation.z = Math.sin(T * 1.3 + ph) * 0.15;
      } });
    } else if (h.type === 'donut') {
      const m = new THREE.Mesh(S.donutGeo, S.donutMat);
      m.castShadow = true;
      m.position.set(h.x, h.wy + 0.1, h.z);
      scene.add(m);
      const ph = h.s * 0.21;
      const item = { h, squash: 0, update: (T, dt) => {
        item.squash = Math.max(0, item.squash - dt * 2.5);
        const sq = Math.sin(T * 30) * item.squash * 0.18;
        m.scale.set(1 + sq, 1 - sq, 1 + sq);
        m.position.y = h.wy + 0.1 + Math.sin(T * 1.7 + ph) * 0.06;
        m.rotation.x = Math.sin(T * 1.1 + ph) * 0.05;
        m.rotation.z = Math.cos(T * 1.3 + ph) * 0.05;
      } };
      this.items.push(item);
    } else if (h.type === 'sweeper') {
      const post = new THREE.Mesh(S.postGeo, S.solid);
      post.position.set(h.x, h.wy, h.z);
      post.castShadow = true;
      scene.add(post);
      const arms = new THREE.Mesh(sweeperArms(h.len, h.arms), S.solid);
      arms.position.set(h.x, h.wy + 0.71, h.z);
      arms.castShadow = true;
      scene.add(arms);
      const ring = new THREE.Mesh(new THREE.RingGeometry(h.len - 0.12, h.len + 0.12, 64), S.ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(h.x, h.wy + 0.04, h.z);
      scene.add(ring);
      this.items.push({ h, update: (T) => { arms.rotation.y = -haz.sweeperAngle(h, T, 0); } });
    } else if (h.type === 'whirl') {
      const mat = whirlMaterial(h);
      const m = new THREE.Mesh(new THREE.CircleGeometry(h.R, 64), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(h.x, h.wy + 0.035, h.z);
      m.renderOrder = 1;
      scene.add(m);
      this.items.push({ h, update: (T) => { mat.uniforms.t.value = T; } });
    } else if (h.type === 'geyser') {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), geyserPadMaterial());
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(h.x, h.wy + 0.04, h.z);
      pad.renderOrder = 1;
      scene.add(pad);
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 1, 24, 1, false), S.jetMat);
      jet.position.set(h.x, h.wy, h.z);
      jet.visible = false;
      scene.add(jet);
      const crown = new THREE.Mesh(S.foamGeo, S.foamMat);
      crown.visible = false;
      scene.add(crown);
      this.items.push({ h, update: (T) => {
        const g = geyserState(T, h.period, h.phase);
        pad.material.uniforms.t.value = T;
        pad.material.uniforms.k.value = g.mode === 'warn' ? g.k : g.mode === 'jet' ? 1 : 0;
        if (g.mode === 'jet') {
          const up = Math.sin(Math.min(1, g.k * 1.15) * Math.PI);
          const hgt = 0.3 + up * 5.2;
          jet.visible = true;
          crown.visible = true;
          jet.scale.set(1 + Math.sin(T * 40) * 0.04, hgt, 1 + Math.cos(T * 37) * 0.04);
          jet.position.y = h.wy + hgt / 2;
          crown.position.set(h.x, h.wy + hgt, h.z);
          crown.rotation.y = T * 3;
        } else {
          jet.visible = false;
          crown.visible = false;
        }
      } });
    } else if (h.type === 'bean') {
      const g = new THREE.Group();
      const spin = new THREE.Group();
      const can = new THREE.Mesh(S.canGeo, S.canMat);
      can.castShadow = true;
      const rim = new THREE.Mesh(S.rimGeo, S.rimMat);
      rim.castShadow = true;
      spin.add(can, rim);
      g.add(spin);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 32), S.glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = -0.4;
      g.add(glow);
      g.position.set(h.x, h.wy + 0.45, h.z);
      scene.add(g);
      const ph = h.s * 0.13;
      const item = { h, g, update: (T, dt, now) => {
        const since = now - h.taken;
        const vis = since > 25 ? Math.min(1, (since - 25) * 2) : Math.max(0, 1 - since * 4);
        g.visible = vis > 0.01;
        const pop = since < 0.25 ? 1 + since * 3 : 1;
        g.scale.setScalar(Math.max(0.01, vis * pop));
        g.position.y = h.wy + 0.5 + Math.sin(T * 2.2 + ph) * 0.1 + (since < 0.25 ? since * 4 : 0);
        spin.rotation.y = T * 1.5 + ph;
        spin.rotation.z = Math.sin(T * 1.4 + ph) * 0.2;
        glow.material.opacity = 0.3 + Math.sin(T * 4 + ph) * 0.15;
      } };
      this.beans.push(item);
      this.items.push(item);
    }
  }

  bumpDonut(x, z) {
    for (const it of this.items) {
      if (it.h.type === 'donut' && Math.hypot(it.h.x - x, it.h.z - z) < 2.5) it.squash = 1;
    }
  }

  update(T, dt, now, focusS) {
    for (const it of this.items) {
      const d = it.h.s - focusS;
      const vis = d < 200 && d > -45;
      if (it.objs && it.vis !== vis) { it.vis = vis; for (const o of it.objs) o.visible = vis; }
      if (!vis || d > 150) continue;
      it.update(T, dt, now);
    }
  }
}
