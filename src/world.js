// Toot Tube: the static world. Sky, light, flowing water, banks with pool-noodle bumpers, valley terrain, decor, arches, signs.

import * as THREE from 'three';
import { DS, BANK_H, CHECKPOINTS, FINISH_S, START_S, HAZARDS } from './track.js';
import { paint, place, merged, rng, textTexture, fbm, smoothstep } from './util3d.js';

const SKY_TOP = new THREE.Color('#47b9ff');
const SKY_HOR = new THREE.Color('#dff5ff');
const FOG = new THREE.Color('#d3f0ff');
const GRASS = new THREE.Color('#8fdc63');
const GRASS_D = new THREE.Color('#6cc84f');
const HILL = new THREE.Color('#5fbf5a');
const SAND = new THREE.Color('#f5d995');
const CLAY = new THREE.Color('#ffa86e');
const CLAY_WET = new THREE.Color('#e7875c');

export function buildWorld(scene, track, haz) {
  const world = {};
  const uTime = { value: 0 };
  world.uTime = uTime;

  scene.background = FOG.clone();
  scene.fog = new THREE.Fog(FOG, 80, 300);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: SKY_TOP }, hor: { value: SKY_HOR }, sunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vD;
        void main(){ float h = clamp(vD.y, -1.0, 1.0);
          vec3 c = mix(hor, top, pow(smoothstep(0.0, 0.75, h), 0.8));
          if (h < 0.0) c = hor;
          float sd = max(dot(normalize(vD), sunDir), 0.0);
          c += vec3(1.0, 0.93, 0.75) * (pow(sd, 400.0) * 1.4 + pow(sd, 18.0) * 0.18);
          gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  world.sky = sky;

  const hemi = new THREE.HemisphereLight(0xd6f1ff, 0x94d873, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 140;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  const sunOff = new THREE.Vector3(0.45, 0.8, 0.35).normalize().multiplyScalar(70);
  world.sun = sun;

  const field = buildField(track);
  world.field = field;
  world.groundY = (x, z) => field.height(x, z);

  world.water = buildWater(scene, track, haz, uTime);
  buildBanks(scene, track);
  buildCaps(scene, track);
  buildTerrain(scene, track, field);
  buildDecor(scene, track, field);
  world.clouds = buildClouds(scene, track);
  world.arches = buildArches(scene, track);
  world.beacons = buildBeacons(scene, track);
  buildSigns(scene, track);

  world.update = (dt, focus, cam) => {
    uTime.value += dt;
    sky.position.copy(cam.position);
    sun.position.copy(focus).add(sunOff);
    sun.target.position.copy(focus);
    const snap = 0.5;
    sun.position.x = Math.round(sun.position.x / snap) * snap;
    sun.position.z = Math.round(sun.position.z / snap) * snap;
    sun.target.position.x = sun.position.x - sunOff.x;
    sun.target.position.z = sun.position.z - sunOff.z;
    world.clouds.position.x += dt * 0.6;
    for (const a of world.arches) a.update(dt);
    for (const b of world.beacons) b.update(dt, cam);
  };
  return world;
}

function buildField(track) {
  const b = track.bounds, M = 230, step = 4;
  const x0 = b.minX - M, z0 = b.minZ - M;
  const nx = Math.ceil((b.maxX - b.minX + 2 * M) / step) + 1;
  const nz = Math.ceil((b.maxZ - b.minZ + 2 * M) / step) + 1;
  const idx = new Int32Array(nx * nz).fill(-1);
  const dist = new Float32Array(nx * nz).fill(1e9);
  const R = 220;
  const rc = Math.ceil(R / step);
  for (let i = 0; i < track.n; i += 3) {
    const px = track.X[i], pz = track.Z[i];
    const cx = Math.round((px - x0) / step), cz = Math.round((pz - z0) / step);
    for (let a = -rc; a <= rc; a++) {
      const gx = cx + a; if (gx < 0 || gx >= nx) continue;
      const wx = x0 + gx * step - px;
      for (let c = -rc; c <= rc; c++) {
        const gz = cz + c; if (gz < 0 || gz >= nz) continue;
        const wz = z0 + gz * step - pz;
        const d = wx * wx + wz * wz;
        const k = gz * nx + gx;
        if (d < dist[k]) { dist[k] = d; idx[k] = i; }
      }
    }
  }
  const near = (x, z) => {
    const gx = Math.min(nx - 1, Math.max(0, Math.round((x - x0) / step)));
    const gz = Math.min(nz - 1, Math.max(0, Math.round((z - z0) / step)));
    let i = idx[gz * nx + gx];
    if (i < 0) return null;
    let best = i, bd = Infinity;
    for (let j = Math.max(0, i - 14); j <= Math.min(track.n - 1, i + 14); j++) {
      const dx = x - track.X[j], dz = z - track.Z[j];
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = j; }
    }
    return { i: best, d: Math.sqrt(bd) };
  };
  const height = (x, z) => {
    const n = near(x, z);
    if (!n) return 40;
    const hw = track.HW[n.i], wy = track.Y[n.i];
    const dd = n.d - hw;
    const gy = wy + BANK_H;
    if (dd < 2.4) return wy - 2.5;
    if (dd < 4.6) return gy - 0.14;
    const hill = smoothstep(14, 190, dd);
    const bump = fbm(x * 0.012, z * 0.012, 4);
    const small = fbm(x * 0.05 + 7, z * 0.05 - 3, 2);
    return gy + hill * (34 + bump * 30) + smoothstep(6, 30, dd) * small * 1.6 - (dd < 6.5 ? (6.5 - dd) * 0.07 : 0);
  };
  return { near, height, nx, nz, x0, z0, step, dist };
}

function buildWater(scene, track, haz, uTime) {
  const NX = 18, stepI = 2;
  const rows = Math.floor((track.n - 1) / stepI) + 1;
  const pos = new Float32Array(rows * (NX + 1) * 3);
  const river = new Float32Array(rows * (NX + 1) * 3);
  const hwA = new Float32Array(rows * (NX + 1));
  const slope = new Float32Array(rows * (NX + 1));
  let v = 0;
  for (let r = 0; r < rows; r++) {
    const i = Math.min(track.n - 1, r * stepI);
    const rx = -track.TZ[i], rz = track.TX[i], hw = track.HW[i], ext = hw + 1.4;
    for (let k = 0; k <= NX; k++) {
      const u = (k / NX) * 2 - 1;
      const lat = u * ext;
      pos[v * 3] = track.X[i] + rx * lat;
      pos[v * 3 + 1] = track.Y[i];
      pos[v * 3 + 2] = track.Z[i] + rz * lat;
      river[v * 3] = lat; river[v * 3 + 1] = i * DS; river[v * 3 + 2] = track.CUR[i];
      hwA[v] = hw; slope[v] = track.SLOPE[i];
      v++;
    }
  }
  const index = [];
  for (let r = 0; r < rows - 1; r++) for (let k = 0; k < NX; k++) {
    const a = r * (NX + 1) + k, b = a + 1, c = a + NX + 1, d = c + 1;
    index.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRiver', new THREE.BufferAttribute(river, 3));
  geo.setAttribute('aHw', new THREE.BufferAttribute(hwA, 1));
  geo.setAttribute('aSlope', new THREE.BufferAttribute(slope, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();

  const foamTex = buildFoamTexture(track, haz);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uFoam = { value: foamTex };
    sh.uniforms.uLen = { value: track.length };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aRiver; attribute float aHw; attribute float aSlope;
        varying vec3 vRiver; varying float vHw; varying float vSlope;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRiver = aRiver; vHw = aHw; vSlope = aSlope;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform sampler2D uFoam; uniform float uLen;
        varying vec3 vRiver; varying float vHw; varying float vSlope;
        vec2 wh2(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
        float wh1(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        float wnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(wh1(i), wh1(i+vec2(1.0,0.0)), u.x), mix(wh1(i+vec2(0.0,1.0)), wh1(i+vec2(1.0,1.0)), u.x), u.y); }
        float wcells(vec2 x){ vec2 n=floor(x), f=fract(x); float m1=8.0, m2=8.0;
          for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=wh2(n+g);
            o = 0.5 + 0.42*sin(uTime*0.7 + 6.2831*o); vec2 r=g+o-f; float d=dot(r,r);
            if(d<m1){ m2=m1; m1=d; } else if(d<m2){ m2=d; } }
          return sqrt(m2)-sqrt(m1); }
        vec3 waterCol(out float foam){
          float lat = vRiver.x, s = vRiver.y, cur = vRiver.z;
          float T = 3.0;
          float p0 = fract(uTime / T), p1 = fract(uTime / T + 0.5);
          float wA = 1.0 - abs(2.0 * p0 - 1.0);
          vec2 q = vec2(lat, s) * 0.4;
          float eA = wcells(q + vec2(0.0, p0 * T * cur * 0.4));
          float eB = wcells(q + vec2(3.7, 1.3 + p1 * T * cur * 0.4));
          float e = mix(eB, eA, wA);
          float line = 1.0 - smoothstep(0.03, 0.15, e);
          float edgeN = abs(lat) / vHw;
          vec3 deep = vec3(0.04, 0.50, 0.80);
          vec3 mid = vec3(0.16, 0.72, 0.93);
          vec3 lineC = vec3(0.72, 0.96, 1.0);
          vec3 c = mix(deep, mid, smoothstep(0.15, 1.0, edgeN));
          c = mix(c, lineC, line * 0.5);
          float n = wnoise(vec2(lat * 1.2, s * 0.8 + uTime * cur * 1.1));
          float n2 = wnoise(vec2(lat * 2.6 + 3.0, s * 2.0 + uTime * cur * 1.6));
          float edgeFoam = smoothstep(vHw - 1.25, vHw - 0.4, abs(lat)) * (0.5 + 0.5 * n);
          float tex = texture2D(uFoam, vec2(clamp(lat / (vHw + 1.4) * 0.5 + 0.5, 0.0, 1.0), s / uLen)).r;
          float hazFoam = tex * (0.55 + 0.45 * n2);
          float rapid = smoothstep(2.3, 3.4, cur) * smoothstep(0.55, 0.8, wnoise(vec2(lat * 0.9, s * 0.45 + uTime * cur * 0.8)));
          float fall = smoothstep(0.05, 0.25, -vSlope);
          foam = max(max(edgeFoam, hazFoam), max(rapid * 0.9, fall * (0.55 + 0.45 * n2)));
          foam = smoothstep(0.42, 0.56, foam);
          c = mix(c, vec3(0.97, 1.0, 1.0), foam);
          return c;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float foamAmt = 0.0;
        diffuseColor.rgb = waterCol(foamAmt);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.75, 0.9, 1.0) * foamAmt * 0.35 + diffuseColor.rgb * 0.08;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function segD(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1)));
  return Math.hypot(px - ax - abx * t, pz - az - abz * t);
}

function buildFoamTexture(track, haz) {
  const W = 48, H = Math.ceil(track.length) + 1;
  const data = new Uint8Array(W * H * 4);
  const f = {};
  const shapes = [];
  for (const h of haz.list) {
    if (h.type === 'roller') shapes.push({ s: h.s, d: (x, z) => segD(x, z, h.ax, h.az, h.bx, h.bz) - 0.45, r: 1.1 });
    else if (h.type === 'buoy' && !h.orbit) shapes.push({ s: h.s, d: (x, z) => Math.hypot(x - h.x, z - h.z) - 0.65, r: 1.0 });
    else if (h.type === 'donut') shapes.push({ s: h.s, d: (x, z) => Math.hypot(x - h.x, z - h.z) - 1.45, r: 0.8 });
    else if (h.type === 'sweeper') shapes.push({ s: h.s, d: (x, z) => Math.hypot(x - h.x, z - h.z) - 0.6, r: 1.0 });
  }
  for (let row = 0; row < H; row++) {
    const s = row;
    track.at(s, f);
    const near = shapes.filter((sh) => Math.abs(sh.s - s) < 12);
    for (let col = 0; col < W; col++) {
      const lat = ((col + 0.5) / W * 2 - 1) * (f.hw + 1.4);
      const x = f.x - f.tz * lat, z = f.z + f.tx * lat;
      let v = 0;
      for (const sh of near) {
        const d = sh.d(x, z);
        v = Math.max(v, 1 - smoothstep(0, sh.r, d));
      }
      if (s > 659 && s < 674) v = Math.max(v, 1 - smoothstep(659, 674, s) * 0.9);
      const k = (row * W + col) * 4;
      data[k] = data[k + 1] = data[k + 2] = Math.round(v * 255);
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function buildBanks(scene, track) {
  const prof = [
    [0.05, -1.3, CLAY_WET], [0.5, -0.15, CLAY_WET], [0.9, 0.55, CLAY], [1.5, 1.45, CLAY],
    [2.05, BANK_H - 0.12, CLAY], [2.4, BANK_H, GRASS], [4.8, BANK_H, GRASS],
  ];
  const stepI = 2;
  const rows = Math.floor((track.n - 1) / stepI) + 1;
  for (const side of [-1, 1]) {
    const pos = [], col = [], index = [];
    for (let r = 0; r < rows; r++) {
      const i = Math.min(track.n - 1, r * stepI);
      const rx = -track.TZ[i] * side, rz = track.TX[i] * side, hw = track.HW[i], y = track.Y[i];
      for (const [o, dy, c] of prof) {
        pos.push(track.X[i] + rx * (hw + o), y + dy, track.Z[i] + rz * (hw + o));
        col.push(c.r, c.g, c.b);
      }
    }
    const P = prof.length;
    for (let r = 0; r < rows - 1; r++) for (let k = 0; k < P - 1; k++) {
      const a = r * P + k, b = a + 1, c = a + P, d = c + 1;
      if (side > 0) index.push(a, b, c, b, d, c); else index.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    m.receiveShadow = true;
    scene.add(m);

    const RS = 14, rad = 0.42;
    const tp = [], tn = [], tu = [], ti = [];
    for (let r = 0; r < rows; r++) {
      const i = Math.min(track.n - 1, r * stepI);
      const rx = -track.TZ[i] * side, rz = track.TX[i] * side, hw = track.HW[i];
      const cx = track.X[i] + rx * (hw + 0.05), cz = track.Z[i] + rz * (hw + 0.05), cy = track.Y[i] + 0.2;
      for (let k = 0; k <= RS; k++) {
        const t = (k / RS) * Math.PI * 2;
        const nx = rx * Math.cos(t), ny = Math.sin(t), nz = rz * Math.cos(t);
        tp.push(cx + nx * rad, cy + ny * rad, cz + nz * rad);
        tn.push(nx, ny, nz);
        tu.push((i * DS) / 3, k / RS);
      }
    }
    for (let r = 0; r < rows - 1; r++) for (let k = 0; k < RS; k++) {
      const a = r * (RS + 1) + k, b = a + 1, c = a + RS + 1, d = c + 1;
      if (side > 0) ti.push(a, c, b, b, c, d); else ti.push(a, b, c, b, d, c);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    tg.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3));
    tg.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2));
    tg.setIndex(ti);
    const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: stripeTexture('#ffd23f', '#ffffff'), roughness: 0.4, side: THREE.DoubleSide }));
    tm.receiveShadow = true;
    scene.add(tm);
  }
}

export function stripeTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 4;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 128, 4);
  g.fillStyle = b; g.fillRect(128, 0, 128, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function buildCaps(scene, track) {
  const mat = new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.9 });
  const noodle = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.45 });
  for (const [s, dir] of [[0, -1], [track.length, 1]]) {
    const f = track.at(s, {});
    const w = f.hw * 2 + 10;
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, BANK_H + 3, 3), mat);
    wall.position.set(0, BANK_H / 2 - 1.5, dir * 1.5);
    wall.receiveShadow = true;
    g.add(wall);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 8), new THREE.MeshStandardMaterial({ color: GRASS, roughness: 0.95 }));
    top.position.set(0, BANK_H - 0.1, dir * 4);
    g.add(top);
    const nood = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, f.hw * 2 + 1, 16), noodle);
    nood.rotation.z = Math.PI / 2;
    nood.position.set(0, 0.2, 0);
    g.add(nood);
    g.position.set(f.x, f.y, f.z);
    g.rotation.y = Math.atan2(f.tx, f.tz);
    scene.add(g);
  }
}

function buildTerrain(scene, track, field) {
  const b = track.bounds, M = 220, T = 48, step = 3;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false });
  const c = new THREE.Color();
  for (let tx = b.minX - M; tx < b.maxX + M; tx += T) {
    for (let tz = b.minZ - M; tz < b.maxZ + M; tz += T) {
      const n = field.near(tx + T / 2, tz + T / 2);
      if (!n || n.d > 230) continue;
      const N = T / step;
      const pos = [], col = [], index = [];
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const x = tx + i * step, z = tz + j * step;
        const y = field.height(x, z);
        pos.push(x, y, z);
        const nn = field.near(x, z);
        const dd = nn ? nn.d - track.HW[nn.i] : 999;
        const gy = nn ? track.Y[nn.i] + BANK_H : 0;
        const h = y - gy;
        const p = fbm(x * 0.03 + 11, z * 0.03 - 5, 3);
        c.copy(GRASS).lerp(GRASS_D, smoothstep(-0.05, 0.25, p));
        c.lerp(HILL, smoothstep(4, 22, h) * 0.7);
        const sandK = smoothstep(0.12, 0.3, fbm(x * 0.045 - 3, z * 0.045 + 9, 2)) * (1 - smoothstep(10, 26, dd));
        c.lerp(SAND, sandK);
        col.push(c.r, c.g, c.b);
      }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i, bb = a + 1, cc = a + N + 1, d = cc + 1;
        index.push(a, cc, bb, bb, cc, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(index);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      scene.add(m);
    }
  }
}

function paintFaces(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const arr = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    c.set(fn(cx, cy, cz));
    for (let k = 0; k < 3; k++) { arr[(i + k) * 3] = c.r; arr[(i + k) * 3 + 1] = c.g; arr[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

function palmGeometry() {
  const parts = [];
  let x = 0, y = 0;
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.24 - i * 0.015, r1 = 0.22 - i * 0.015;
    const g = paint(new THREE.CylinderGeometry(r1, r0, 0.92, 7), i % 2 ? '#a26b3a' : '#bf8549');
    const nx = x + 0.07 * i;
    place(g, { x: nx, y: y + 0.46, z: 0, rz: -0.07 - i * 0.012 });
    parts.push(g);
    x = nx + 0.06; y += 0.9;
  }
  const topX = x, topY = y;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    const leaf = paint(new THREE.ConeGeometry(0.42, 3.0, 4), k % 2 ? '#2fb24a' : '#4fd05c');
    place(leaf, { sx: 1, sy: 1, sz: 0.2 });
    leaf.translate(0, 1.5, 0);
    const droop = 1.0 + (k % 3) * 0.18;
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationZ(-droop));
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationY(a));
    leaf.translate(topX, topY, 0);
    parts.push(leaf);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    parts.push(place(paint(new THREE.IcosahedronGeometry(0.17, 0), '#6b4425'), { x: topX + Math.cos(a) * 0.22, y: topY - 0.18, z: Math.sin(a) * 0.22 }));
  }
  return merged(parts);
}

function bushGeometry() {
  const parts = [];
  const r = rng(3);
  for (let k = 0; k < 4; k++) {
    const s = 0.55 + r() * 0.45;
    parts.push(place(paint(new THREE.IcosahedronGeometry(s, 0), k % 2 ? '#47b84f' : '#62cf5d'), { x: (r() - 0.5) * 1.1, y: s * 0.65, z: (r() - 0.5) * 1.1, ry: r() * 6 }));
  }
  parts.push(place(paint(new THREE.IcosahedronGeometry(0.12, 0), '#ff7eb6'), { x: 0.3, y: 1.15, z: 0.25 }));
  parts.push(place(paint(new THREE.IcosahedronGeometry(0.12, 0), '#ffffff'), { x: -0.35, y: 1.0, z: -0.1 }));
  return merged(parts);
}

function rockGeometry() {
  const g = paint(new THREE.DodecahedronGeometry(1, 0), '#d8cdbd');
  place(g, { sy: 0.6 });
  const g2 = paint(new THREE.DodecahedronGeometry(0.55, 0), '#c4b8a6');
  place(g2, { x: 0.8, y: -0.1, z: 0.3, sy: 0.7 });
  return merged([g, g2]);
}

function umbrellaGeometry() {
  const pole = paint(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), '#ffffff');
  place(pole, { y: 1.3 });
  const cols = ['#ff8a3d', '#ffffff', '#3dc6ff', '#ffffff'];
  const canopy = paintFaces(new THREE.ConeGeometry(1.7, 0.6, 12, 1, true), (x, y, z) => cols[Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12) % 4]);
  place(canopy, { y: 2.55 });
  const towel = paintFaces(new THREE.BoxGeometry(0.9, 0.03, 1.8), (x, y, z) => (Math.floor((z + 0.9) / 0.3) % 2 ? '#ffd23f' : '#3dc6ff'));
  place(towel, { x: 1.2, y: 0.03, z: 0.4, ry: 0.4 });
  return merged([pole, canopy, towel]);
}

function flowerGeometry() {
  const parts = [];
  const cols = ['#ffffff', '#ffd23f', '#ff8fbd', '#b48cff'];
  for (let k = 0; k < 5; k++) {
    const a = k * 1.3, rr = 0.3 + (k % 2) * 0.25;
    parts.push(place(paint(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3), '#3e9e3e'), { x: Math.cos(a) * rr, y: 0.2, z: Math.sin(a) * rr }));
    parts.push(place(paint(new THREE.IcosahedronGeometry(0.1, 0), cols[k % 4]), { x: Math.cos(a) * rr, y: 0.42, z: Math.sin(a) * rr }));
  }
  return merged(parts);
}

function scatter(scene, geo, mat, list, shadow) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((it, i) => {
    e.set(it.tilt || 0, it.ry, 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s * (it.sy || 1), it.s));
    im.setMatrixAt(i, m);
  });
  im.castShadow = !!shadow;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  scene.add(im);
  return im;
}

function buildDecor(scene, track, field) {
  const r = rng(42);
  const palms = [], bushes = [], rocks = [], umbrellas = [], flowers = [];
  const busy = [...CHECKPOINTS, FINISH_S, START_S + 4];
  for (const h of HAZARDS) if (h.type === 'sign') busy.push(h.s);
  const f = {};
  for (let s = 2; s < track.length - 2; s += 2.2) {
    track.at(s, f);
    for (const side of [-1, 1]) {
      const nearBusy = busy.some((b) => Math.abs(b - s) < 5);
      const roll = r();
      const dd = 5.2 + Math.pow(r(), 1.6) * 60;
      const lat = side * (f.hw + dd);
      const x = f.x - f.tz * lat + (r() - 0.5) * 2, z = f.z + f.tx * lat + (r() - 0.5) * 2;
      const n = field.near(x, z);
      if (!n || n.d - track.HW[n.i] < 5) continue;
      const y = field.height(x, z);
      const it = { x, y: y - 0.05, z, ry: r() * Math.PI * 2, s: 0.8 + r() * 0.5 };
      if (nearBusy && dd < 9) continue;
      if (roll < 0.2) { it.s = 0.85 + r() * 0.45; it.tilt = (r() - 0.5) * 0.15; palms.push(it); }
      else if (roll < 0.48) bushes.push(it);
      else if (roll < 0.58) { it.s = 0.5 + r() * 1.3; rocks.push(it); }
      else if (roll < 0.61 && dd < 22) { it.s = 1; umbrellas.push(it); }
      else if (roll < 0.85) { it.s = 1 + r() * 0.6; flowers.push(it); }
    }
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const matDS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  scatter(scene, palmGeometry(), matDS, palms, true);
  scatter(scene, bushGeometry(), mat, bushes, false);
  scatter(scene, rockGeometry(), mat, rocks, false);
  scatter(scene, umbrellaGeometry(), matDS, umbrellas, true);
  scatter(scene, flowerGeometry(), mat, flowers, false);
}

function buildClouds(scene, track) {
  const r = rng(9);
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const s = 3 + r() * 3;
    parts.push(place(paint(new THREE.IcosahedronGeometry(s, 1), '#ffffff'), { x: (k - 2.5) * 3.2 + r() * 2, y: r() * 1.5, z: (r() - 0.5) * 4, sy: 0.7 }));
  }
  const geo = merged(parts, true);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xdff4ff, emissiveIntensity: 0.55, flatShading: true, fog: false });
  const b = track.bounds;
  const list = [];
  for (let i = 0; i < 46; i++) {
    list.push({ x: b.minX - 200 + r() * (b.maxX - b.minX + 400), y: 70 + r() * 40, z: b.minZ - 200 + r() * (b.maxZ - b.minZ + 400), ry: r() * 6, s: 0.8 + r() * 1.2, sy: 1 });
  }
  const g = new THREE.Group();
  scatter(g, geo, mat, list, false);
  scene.add(g);
  return g;
}

function pillar(height) {
  const parts = [];
  const n = Math.round(height / 0.8);
  for (let i = 0; i < n; i++) {
    parts.push(place(paint(new THREE.CylinderGeometry(0.55, 0.55, 0.62, 14), i % 2 ? '#ffffff' : '#3d7bff'), { y: i * 0.8 + 0.4 }));
    parts.push(place(paint(new THREE.TorusGeometry(0.55, 0.13, 6, 16), '#2a62e0'), { y: i * 0.8 + 0.8, rx: Math.PI / 2 }));
  }
  parts.push(place(paint(new THREE.SphereGeometry(0.7, 14, 10), '#ffd23f'), { y: n * 0.8 + 0.4 }));
  return merged(parts);
}

function buildArches(scene, track) {
  const arches = [];
  const pmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
  const defs = [{ s: START_S + 5, label: 'START', kind: 'start' }];
  for (let i = 1; i < CHECKPOINTS.length; i++) defs.push({ s: CHECKPOINTS[i], label: `CHECKPOINT ${i}`, kind: 'cp', index: i });
  defs.push({ s: FINISH_S, label: 'FINISH', kind: 'finish' });
  for (const d of defs) {
    const f = track.at(d.s, {});
    const g = new THREE.Group();
    const span = f.hw + 1.3;
    const H = 10.4;
    const pg = pillar(H);
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pg, pmat);
      p.position.set(side * span, BANK_H - 0.1, 0);
      p.castShadow = true;
      g.add(p);
    }
    const tex = d.kind === 'finish'
      ? textTexture(d.label, { w: 1024, h: 192, stripes: ['#1d2b53', '#ffffff'], fg: '#1d2b53', size: 120 })
      : textTexture(d.label, { w: 1024, h: 192, bg: d.kind === 'start' ? '#ffd23f' : '#ffffff', fg: '#1d2b53', size: 118, radius: 60, border: '#3d7bff', borderW: 18 });
    const bw = span * 2 - 0.6;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(bw, 1.7, 0.35),
      [
        new THREE.MeshStandardMaterial({ color: '#3d7bff', roughness: 0.5 }),
        new THREE.MeshStandardMaterial({ color: '#3d7bff', roughness: 0.5 }),
        new THREE.MeshStandardMaterial({ color: '#3d7bff', roughness: 0.5 }),
        new THREE.MeshStandardMaterial({ color: '#3d7bff', roughness: 0.5 }),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }),
      ],
    );
    tex.repeat.set(1, 1);
    banner.position.set(0, BANK_H + H - 0.5, 0);
    banner.castShadow = true;
    g.add(banner);
    const flagMat = new THREE.MeshStandardMaterial({ color: d.kind === 'finish' ? '#1d2b53' : '#ffd23f', side: THREE.DoubleSide, roughness: 0.6 });
    const flags = [];
    for (let k = 0; k < 9; k++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), k % 2 ? flagMat : new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }));
      fl.position.set(-bw / 2 + 0.5 + (k / 8) * (bw - 1), BANK_H + H - 1.65, 0);
      fl.rotation.x = Math.PI;
      g.add(fl);
      flags.push(fl);
    }
    g.position.set(f.x, f.y, f.z);
    g.rotation.y = Math.atan2(f.tx, f.tz);
    scene.add(g);
    let pulse = 0, t = 0;
    arches.push({
      ...d, group: g, banner,
      hit() { pulse = 1; },
      update(dt) {
        t += dt;
        pulse = Math.max(0, pulse - dt * 0.8);
        const k = 1 + Math.sin(t * 14) * 0.08 * pulse;
        banner.scale.set(k, k, 1);
        flags.forEach((fl, i) => { fl.rotation.z = Math.sin(t * 3 + i) * 0.15; });
      },
    });
  }
  return arches;
}

function buildBeacons(scene, track) {
  const out = [];
  const list = CHECKPOINTS.slice(1).map((s, i) => ({ s, label: String(i + 1) }));
  list.push({ s: FINISH_S, label: 'FINISH', finish: true });
  const gem = new THREE.OctahedronGeometry(1.7, 0);
  gem.scale(0.75, 1.1, 0.75);
  const beamGeo = new THREE.CylinderGeometry(0.55, 1.6, 1, 24, 1, true);
  beamGeo.translate(0, 0.5, 0);
  for (const d of list) {
    const f = track.at(d.s, {});
    const g = new THREE.Group();
    g.position.set(f.x, f.y, f.z);
    const gemMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ff9a1f', emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1, fog: false });
    const gm = new THREE.Mesh(gem, gemMat);
    gm.position.y = 6.5;
    g.add(gm);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.scale.y = 5.6;
    beam.position.y = 0.4;
    g.add(beam);
    const tex = textTexture(d.label, { w: 512, h: 256, bg: null, fg: '#ffffff', size: d.finish ? 120 : 190 });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, transparent: true, depthWrite: false }));
    spr.scale.set(d.finish ? 8 : 6, d.finish ? 4 : 3, 1);
    spr.position.y = 9.6;
    g.add(spr);
    const outline = textTexture(d.label, { w: 512, h: 256, bg: null, fg: '#1d2b53', size: d.finish ? 120 : 190 });
    const sh = new THREE.Sprite(new THREE.SpriteMaterial({ map: outline, fog: false, transparent: true, depthWrite: false }));
    sh.scale.copy(spr.scale).multiplyScalar(1.08);
    sh.position.y = 9.45;
    sh.renderOrder = -1;
    g.add(sh);
    scene.add(g);
    let state = 'idle', t = Math.random() * 5, shown = 1;
    const COL = { next: ['#ffd23f', '#ff9a1f', '#ffe066'], idle: ['#ffffff', '#9fdcff', '#ffffff'], done: ['#6fe08a', '#2fb24a', '#a6f0b6'] };
    out.push({
      s: d.s, finish: !!d.finish, group: g,
      set(st) {
        if (st === state) return;
        state = st;
        const c = COL[st];
        gemMat.color.set(c[0]); gemMat.emissive.set(c[1]); beamMat.color.set(c[2]);
      },
      update(dt, cam) {
        t += dt;
        const target = state === 'done' ? 0 : 1;
        shown += (target - shown) * Math.min(1, dt * (state === 'done' ? 7 : 3));
        g.visible = shown > 0.02;
        const pulse = state === 'next' ? 1 + Math.sin(t * 4) * 0.08 : 1;
        gm.rotation.y = t * (state === 'next' ? 1.6 : 0.6);
        gm.position.y = 6.5 + Math.sin(t * 1.6) * 0.35;
        gm.scale.setScalar(shown * pulse);
        beamMat.opacity = (state === 'next' ? 0.32 + Math.sin(t * 4) * 0.08 : 0.14) * shown;
        spr.scale.set((d.finish ? 8 : 6) * shown, (d.finish ? 4 : 3) * shown, 1);
        sh.scale.copy(spr.scale).multiplyScalar(1.08);
      },
    });
  }
  return out;
}

function buildSigns(scene, track) {
  const post = new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.9 });
  for (const h of HAZARDS) {
    if (h.type !== 'sign') continue;
    const f = track.at(h.s, {});
    const lat = h.side * (f.hw + 3.1);
    const g = new THREE.Group();
    const tex = textTexture(h.text, { w: 512, h: 288, bg: '#fff7e0', fg: '#1d2b53', size: 84, radius: 34, border: '#ff9a3d', borderW: 16 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 0.14), [post, post, post, post, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), post]);
    board.position.y = 2.5;
    board.castShadow = true;
    g.add(board);
    for (const sx of [-1.2, 1.2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6), post);
      p.position.set(sx, 1.2, -0.05);
      g.add(p);
    }
    g.position.set(f.x - f.tz * lat, f.y + BANK_H, f.z + f.tx * lat);
    g.rotation.y = Math.atan2(-f.tx, -f.tz) - h.side * 0.45;
    scene.add(g);
  }
}
