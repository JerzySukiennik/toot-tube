// Toot Tube: what the hazards look like. Logic lives in sim.js; this file only draws it at time T.

import * as THREE from 'three';
import { paint, place, merged } from './util3d.js';
import { doorsClose, geyserState } from './sim.js';

const PURPLE = '#7b3ff2';
const PURPLE_D = '#5b25cf';
const SPIKE = '#fff1c2';

function spikeAt(parts, x, y, z, dx, dy, dz, len = 0.34, rad = 0.12) {
  const g = paint(new THREE.ConeGeometry(rad, len, 6), SPIKE);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  g.translate(x + dir.x * len * 0.45, y + dir.y * len * 0.45, z + dir.z * len * 0.45);
  parts.push(g);
}

const rollerCache = new Map();
function rollerGeometry(len) {
  const key = Math.round(len * 4);
  if (rollerCache.has(key)) return rollerCache.get(key);
  const parts = [];
  const R = 0.42;
  const body = paint(new THREE.CylinderGeometry(R, R, len, 16, 1), PURPLE);
  place(body, { rz: Math.PI / 2 });
  parts.push(body);
  const rings = Math.max(2, Math.floor(len / 0.55));
  for (let i = 0; i <= rings; i++) {
    const x = -len / 2 + 0.25 + (i / rings) * (len - 0.5);
    const band = paint(new THREE.TorusGeometry(R, 0.05, 5, 16), PURPLE_D);
    place(band, { x, ry: Math.PI / 2 });
    parts.push(band);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + (i % 2) * (Math.PI / 6);
      const dy = Math.cos(a), dz = Math.sin(a);
      spikeAt(parts, x, dy * R, dz * R, 0, dy, dz);
    }
  }
  for (const sx of [-1, 1]) parts.push(place(paint(new THREE.SphereGeometry(R * 1.02, 14, 10), PURPLE_D), { x: sx * len / 2 }));
  const g = merged(parts);
  rollerCache.set(key, g);
  return g;
}

function buoyGeometry() {
  const parts = [paint(new THREE.SphereGeometry(0.62, 18, 14), PURPLE)];
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const p = ico.attributes.position;
  const seen = new Set();
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const k = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    spikeAt(parts, v.x * 0.58, v.y * 0.58, v.z * 0.58, v.x, v.y, v.z, 0.36, 0.11);
  }
  parts.push(place(paint(new THREE.SphereGeometry(0.16, 10, 8), '#ffffff'), { x: 0.25, y: 0.25, z: 0.5 }));
  parts.push(place(paint(new THREE.SphereGeometry(0.16, 10, 8), '#ffffff'), { x: -0.25, y: 0.25, z: 0.5 }));
  parts.push(place(paint(new THREE.SphereGeometry(0.08, 8, 6), '#1d1438'), { x: 0.26, y: 0.24, z: 0.64 }));
  parts.push(place(paint(new THREE.SphereGeometry(0.08, 8, 6), '#1d1438'), { x: -0.24, y: 0.24, z: 0.64 }));
  return merged(parts);
}

function donutGeometry() {
  const g = new THREE.TorusGeometry(1.12, 0.38, 12, 28).toNonIndexed();
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const A = new THREE.Color('#4fe0b0'), B = new THREE.Color('#ffffff');
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const c = Math.floor(((Math.atan2(cy, cx) + Math.PI) / (Math.PI * 2)) * 8) % 2 ? A : B;
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function sweeperArms(len, arms) {
  const parts = [];
  for (let k = 0; k < arms; k++) {
    const phi = (k / arms) * Math.PI * 2;
    const arm = [];
    const bar = paint(new THREE.CylinderGeometry(0.15, 0.15, len - 0.4, 10), PURPLE);
    place(bar, { x: 0.2 + (len - 0.4) / 2, rz: Math.PI / 2 });
    arm.push(bar);
    arm.push(place(paint(new THREE.SphereGeometry(0.22, 10, 8), PURPLE_D), { x: len }));
    for (let x = 0.9; x < len - 0.1; x += 0.42) {
      spikeAt(arm, x, 0, 0.13, 0, 0, 1, 0.3, 0.09);
      spikeAt(arm, x, 0, -0.13, 0, 0, -1, 0.3, 0.09);
      spikeAt(arm, x + 0.21, 0.13, 0, 0, 1, 0, 0.26, 0.08);
    }
    const g = merged(arm);
    g.rotateY(-phi);
    parts.push(g);
  }
  parts.push(place(paint(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 18), PURPLE_D), {}));
  return merged(parts);
}

function sweeperPost() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    parts.push(place(paint(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 16), i % 2 ? '#ffffff' : '#40d3c0'), { y: -0.6 + i * 0.5 }));
  }
  parts.push(place(paint(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 12), '#ffffff'), { y: 1.4 }));
  parts.push(place(paint(new THREE.SphereGeometry(0.45, 14, 10), '#ffd23f'), { y: 2.3 }));
  return merged(parts);
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
    g.fillStyle = '#1d2b53';
    g.font = '52px "Lilita One", sans-serif';
    g.textAlign = 'center';
    g.fillText('BEANS', ox + 128, 118);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class HazardViews {
  constructor(scene, track, haz) {
    this.track = track;
    this.haz = haz;
    this.items = [];
    this.beans = [];
    const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
    const buoyGeo = buoyGeometry();
    const donutGeo = donutGeometry();
    const postGeo = sweeperPost();
    const canGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.72, 20);
    const canMat = [
      new THREE.MeshStandardMaterial({ map: canTexture(), roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: '#d9dee8', roughness: 0.25, metalness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: '#d9dee8', roughness: 0.25, metalness: 0.6 }),
    ];
    const glowMat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.45, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false });

    for (const h of haz.list) {
      if (h.type === 'roller') {
        const len = Math.hypot(h.bx - h.ax, h.bz - h.az);
        const g = new THREE.Group();
        const m = new THREE.Mesh(rollerGeometry(len), solid);
        m.castShadow = true;
        g.add(m);
        g.position.set((h.ax + h.bx) / 2, h.wy + 0.22, (h.az + h.bz) / 2);
        g.rotation.y = Math.atan2(-(h.bz - h.az), h.bx - h.ax);
        scene.add(g);
        this.items.push({ h, update: (T) => { m.rotation.x = T * 1.6; } });
      } else if (h.type === 'slider') {
        const g = new THREE.Group();
        const m = new THREE.Mesh(rollerGeometry(h.len), solid);
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
          const m = new THREE.Mesh(rollerGeometry(len), solid);
          m.castShadow = true;
          g.add(m);
          g.rotation.y = Math.atan2(-h.rz, h.rx);
          scene.add(g);
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
        const m = new THREE.Mesh(buoyGeo, solid);
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
        const m = new THREE.Mesh(donutGeo, solid);
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
        const post = new THREE.Mesh(postGeo, solid);
        post.position.set(h.x, h.wy, h.z);
        post.castShadow = true;
        scene.add(post);
        const arms = new THREE.Mesh(sweeperArms(h.len, h.arms), solid);
        arms.position.set(h.x, h.wy + 0.87, h.z);
        arms.castShadow = true;
        scene.add(arms);
        const ring = new THREE.Mesh(new THREE.RingGeometry(h.len - 0.12, h.len + 0.12, 64), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(h.x, h.wy + 0.04, h.z);
        scene.add(ring);
        this.items.push({ h, update: (T) => { arms.rotation.y = -haz.sweeperAngle(h, T, 0); } });
      } else if (h.type === 'whirl') {
        const mat = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false,
          uniforms: { t: { value: 0 }, str: { value: h.str } },
          vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: `uniform float t; uniform float str; varying vec2 vP;
            void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
              float sp = sin(a * 3.0 + r * 1.9 - t * str * 5.0);
              float arms = smoothstep(0.55, 0.95, sp);
              float fade = 1.0 - smoothstep(0.55, 1.0, r / ${h.R.toFixed(1)});
              float core = 1.0 - smoothstep(0.0, 2.6, r);
              vec3 c = mix(vec3(0.02, 0.32, 0.6), vec3(0.85, 0.97, 1.0), arms);
              float al = (arms * 0.75 + core * 0.55 + 0.18) * fade;
              gl_FragColor = vec4(c, al); }`,
        });
        const m = new THREE.Mesh(new THREE.CircleGeometry(h.R, 48), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(h.x, h.wy + 0.035, h.z);
        m.renderOrder = 1;
        scene.add(m);
        this.items.push({ h, update: (T) => { mat.uniforms.t.value = T; } });
      } else if (h.type === 'geyser') {
        const pad = new THREE.Mesh(
          new THREE.CircleGeometry(1.7, 32),
          new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: { t: { value: 0 }, k: { value: 0 } },
            vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `uniform float t; uniform float k; varying vec2 vP;
              float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
              void main(){ float r = length(vP) / 1.7; vec2 g = floor(vP * 3.0); vec2 f = fract(vP * 3.0) - 0.5;
                float ph = fract(t * (0.8 + h(g)) + h(g + 3.1));
                float b = (1.0 - smoothstep(0.05, 0.22 * ph + 0.05, length(f))) * step(h(g + 7.0), 0.35 + k * 0.6);
                float ring = smoothstep(0.08, 0.0, abs(r - 0.92)) * 0.5;
                float a = (b * (0.4 + k * 0.6) + ring) * (1.0 - smoothstep(0.9, 1.0, r));
                gl_FragColor = vec4(vec3(0.95, 1.0, 1.0), a); }`,
          }),
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(h.x, h.wy + 0.04, h.z);
        pad.renderOrder = 1;
        scene.add(pad);
        const jet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 1.3, 1, 18, 1, true),
          new THREE.MeshStandardMaterial({ color: '#e9fbff', transparent: true, opacity: 0.78, roughness: 0.2, side: THREE.DoubleSide, emissive: '#bdefff', emissiveIntensity: 0.3 }),
        );
        jet.position.set(h.x, h.wy, h.z);
        jet.visible = false;
        scene.add(jet);
        const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), jet.material);
        jet.add(cap);
        this.items.push({ h, update: (T) => {
          const g = geyserState(T, h.period, h.phase);
          pad.material.uniforms.t.value = T;
          pad.material.uniforms.k.value = g.mode === 'warn' ? g.k : g.mode === 'jet' ? 1 : 0;
          if (g.mode === 'jet') {
            const up = Math.sin(Math.min(1, g.k * 1.15) * Math.PI);
            const hgt = 0.3 + up * 5.2;
            jet.visible = true;
            jet.scale.set(1 + Math.sin(T * 40) * 0.04, hgt, 1 + Math.cos(T * 37) * 0.04);
            jet.position.y = h.wy + hgt / 2;
            cap.position.y = 0.5;
            cap.scale.set(1 / 1, 1 / hgt, 1);
            cap.rotation.y = T * 3;
          } else jet.visible = false;
        } });
      } else if (h.type === 'bean') {
        const g = new THREE.Group();
        const can = new THREE.Mesh(canGeo, canMat);
        can.castShadow = true;
        g.add(can);
        const glow = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 32), glowMat);
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
          can.rotation.y = T * 1.5 + ph;
          can.rotation.z = Math.sin(T * 1.4 + ph) * 0.2;
          glow.material.opacity = 0.3 + Math.sin(T * 4 + ph) * 0.15;
        } };
        this.beans.push(item);
        this.items.push(item);
      }
    }
  }

  bumpDonut(x, z) {
    for (const it of this.items) {
      if (it.h.type === 'donut' && Math.hypot(it.h.x - x, it.h.z - z) < 2.5) it.squash = 1;
    }
  }

  update(T, dt, now, focusS) {
    for (const it of this.items) {
      if (Math.abs(it.h.s - focusS) > 140) continue;
      it.update(T, dt, now);
    }
  }
}
