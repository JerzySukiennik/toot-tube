// Toot Tube: small three.js helpers (vertex-coloured geometry, merging, canvas text textures, seeded random).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries };

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

export function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  geo.applyMatrix4(m);
  return geo;
}

export function merged(parts) {
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  return g;
}

export function textTexture(text, opts = {}) {
  const {
    w = 512, h = 256, bg = '#ffffff', fg = '#1d2b53', font = 'Lilita One',
    size = 92, radius = 40, border = null, borderW = 14, lineGap = 1.05, stripes = null,
  } = opts;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (stripes) {
    const cell = h / 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < Math.ceil(w / cell); x++) {
      g.fillStyle = (x + y) % 2 ? stripes[0] : stripes[1];
      g.fillRect(x * cell, y * cell, cell, cell);
    }
  } else if (bg) {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(0, 0, w, h, radius);
    g.fill();
  }
  if (border) {
    g.strokeStyle = border; g.lineWidth = borderW;
    g.beginPath(); g.roundRect(borderW / 2, borderW / 2, w - borderW, h - borderW, radius); g.stroke();
  }
  const lines = String(text).split('\n');
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let fs = size;
  g.font = `${fs}px "${font}", "Arial Rounded MT Bold", sans-serif`;
  const maxW = Math.max(...lines.map((l) => g.measureText(l).width));
  if (maxW > w * 0.88) fs = Math.floor(fs * (w * 0.88) / maxW);
  g.font = `${fs}px "${font}", "Arial Rounded MT Bold", sans-serif`;
  const lh = fs * lineGap;
  const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
  if (stripes) {
    g.lineWidth = fs * 0.16; g.strokeStyle = '#ffffff'; g.lineJoin = 'round';
    lines.forEach((l, i) => g.strokeText(l, w / 2, y0 + i * lh + fs * 0.04));
  }
  lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh + fs * 0.04));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const P = new Uint8Array(512);
{
  const r = rng(7);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function grad(h, x, y) {
  const u = (h & 1) ? x : -x, v = (h & 2) ? y : -y;
  return (h & 4) ? u + v * 0.5 : u * 0.5 + v;
}
export function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = P[X] + Y, b = P[X + 1] + Y;
  const l1 = grad(P[a], x, y) + u * (grad(P[b], x - 1, y) - grad(P[a], x, y));
  const l2 = grad(P[a + 1], x, y - 1) + u * (grad(P[b + 1], x - 1, y - 1) - grad(P[a + 1], x, y - 1));
  return l1 + v * (l2 - l1);
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
