// Toot Tube: the floating candy channel. Sky, sun, water, padded tray walls, rounded end caps, cloud sea, floating decor, arches, beacons, signs.

import * as THREE from 'three';
import { DS, CHECKPOINTS, FINISH_S, START_S, HAZARDS } from './track.js';
import { paint, place, merged, rng, textTexture, smoothstep } from './util3d.js';

const SKY_TOP = new THREE.Color('#2a9bf0');
const SKY_HOR = new THREE.Color('#cdf1ff');
const WHITE = new THREE.Color('#ffffff');
const CORAL = new THREE.Color('#ff8c62');
const YELLOW = '#ffc93c';
const STEP = 2;
const CH = 60;
const WALL = 1.0;
const TOP = 1.0;
const RIM = 0.45;
const BOTTOM = -4.0;

const PROF = [
  [1, WALL, TOP, 0], [1, WALL, -2.2, 0], [1, WALL - 0.5, -3.2, 1], [1, 0.2, BOTTOM + 0.1, 1],
  [1, -1.5, BOTTOM, 1], [-1, -1.5, BOTTOM, 1], [-1, 0.2, BOTTOM + 0.1, 1], [-1, WALL - 0.5, -3.2, 1],
  [-1, WALL, -2.2, 0], [-1, WALL, TOP, 0], [-1, 0, TOP, 0], [-1, 0, -0.5, 0],
  [-1, -0.5, -0.9, 0], [1, -0.5, -0.9, 0], [1, 0, -0.5, 0], [1, 0, TOP, 0],
];
const SIL = 10;

const frameAt = (track, i) => ({ x: track.X[i], y: track.Y[i], z: track.Z[i], tx: track.TX[i], tz: track.TZ[i], hw: track.HW[i] });
const P3 = (f, lat, y) => [f.x - f.tz * lat, y, f.z + f.tx * lat];

export function buildWorld(scene, track, haz) {
  const world = {};
  const uTime = { value: 0 };
  const cull = [];
  world.uTime = uTime;
  world.cull = cull;

  scene.background = SKY_HOR.clone();
  scene.fog = new THREE.Fog(SKY_HOR, 120, 330);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: SKY_TOP }, hor: { value: SKY_HOR }, sunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vD;
        void main(){ float h = clamp(vD.y, -1.0, 1.0);
          vec3 c = mix(hor, top, pow(smoothstep(0.0, 0.7, h), 0.75));
          if (h < 0.0) c = hor;
          float sd = max(dot(normalize(vD), sunDir), 0.0);
          c += vec3(1.0, 0.95, 0.8) * (pow(sd, 400.0) * 1.2 + pow(sd, 18.0) * 0.16);
          gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  world.sky = sky;

  scene.add(new THREE.HemisphereLight(0xeaf8ff, 0xbfe3ff, 1.3));
  const sun = new THREE.DirectionalLight(0xfff3dc, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 5; sc.far = 140;
  sun.shadow.bias = -0.0009;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  world.sun = sun;
  const sunOff = new THREE.Vector3(0.45, 0.8, 0.35).normalize().multiplyScalar(70);

  world.water = buildWater(scene, track, haz, uTime);
  buildChannel(scene, track, cull);
  world.clouds = buildClouds(scene, track);
  buildDecor(scene, track, cull);
  world.arches = buildArches(scene, track);
  world.beacons = buildBeacons(scene, track);
  buildSigns(scene, track, cull);
  for (const a of world.arches) cull.push({ obj: a.group, s: a.s, ahead: 330, behind: 60 });

  world.update = (dt, focus, cam, s = 0) => {
    uTime.value += dt;
    for (const c of cull) {
      const d = c.s - s;
      c.obj.visible = d < c.ahead && d > -c.behind;
    }
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
    for (const b of world.beacons) b.update(dt, cam, s);
  };
  return world;
}

function buildWater(scene, track, haz, uTime) {
  const NX = 18;
  const rows = Math.floor((track.n - 1) / STEP) + 1;
  const pos = new Float32Array(rows * (NX + 1) * 3);
  const river = new Float32Array(rows * (NX + 1) * 3);
  const hwA = new Float32Array(rows * (NX + 1));
  const slope = new Float32Array(rows * (NX + 1));
  let v = 0;
  for (let r = 0; r < rows; r++) {
    const i = Math.min(track.n - 1, r * STEP);
    const rx = -track.TZ[i], rz = track.TX[i], hw = track.HW[i];
    for (let k = 0; k <= NX; k++) {
      const lat = ((k / NX) * 2 - 1) * hw;
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
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0 });
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
          vec3 deep = vec3(0.03, 0.52, 0.92);
          vec3 mid = vec3(0.14, 0.80, 1.0);
          vec3 lineC = vec3(0.78, 0.98, 1.0);
          vec3 c = mix(deep, mid, smoothstep(0.15, 1.0, edgeN));
          c = mix(c, lineC, line * 0.5);
          float n = wnoise(vec2(lat * 1.2, s * 0.8 + uTime * cur * 1.1));
          float n2 = wnoise(vec2(lat * 2.6 + 3.0, s * 2.0 + uTime * cur * 1.6));
          float edgeFoam = smoothstep(vHw - 1.25, vHw - 0.4, abs(lat)) * (0.5 + 0.5 * n);
          float tex = texture2D(uFoam, vec2(clamp(lat / vHw * 0.5 + 0.5, 0.0, 1.0), s / uLen)).r;
          float hazFoam = tex * (0.55 + 0.45 * n2);
          float rapid = smoothstep(2.3, 3.4, cur) * smoothstep(0.55, 0.8, wnoise(vec2(lat * 0.9, s * 0.45 + uTime * cur * 0.8)));
          float fall = smoothstep(0.05, 0.25, -vSlope);
          float streak = wnoise(vec2(lat * 3.0 + 1.7, s * 5.0 + uTime * 2.2));
          foam = max(max(edgeFoam, hazFoam), max(rapid * 0.9, fall * (0.15 + 0.85 * n2 * streak)));
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
  mesh.userData.kind = 'water';
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
      const lat = ((col + 0.5) / W * 2 - 1) * f.hw;
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

function trayFull(track) {
  const P = PROF.length, R = Math.floor((track.n - 1) / STEP);
  const pos = new Float32Array((R + 1) * P * 3);
  const uv = new Float32Array((R + 1) * P * 2);
  const col = new Float32Array((R + 1) * P * 3);
  let v = 0;
  for (let r = 0; r <= R; r++) {
    const f = frameAt(track, r * STEP);
    for (const [sg, d, y, base] of PROF) {
      pos.set(P3(f, sg * (f.hw + d), f.y + y), v * 3);
      uv[v * 2] = r / 4; uv[v * 2 + 1] = 0;
      const c = base ? CORAL : WHITE;
      col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
      v++;
    }
  }
  const idx = [];
  for (let r = 0; r < R; r++) for (let k = 0; k < P; k++) {
    const a = r * P + k, b = r * P + (k + 1) % P, c = a + P, d = b + P;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { g, P, R };
}

function trayChunk(full, r0, r1) {
  const { g, P } = full;
  const a = r0 * P, b = (r1 + 1) * P;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const at = g.attributes[name], n = at.itemSize;
    out.setAttribute(name, new THREE.BufferAttribute(at.array.slice(a * n, b * n), n));
  }
  const idx = [];
  for (let r = r0; r < r1; r++) for (let k = 0; k < P; k++) {
    const a0 = (r - r0) * P + k, b0 = (r - r0) * P + (k + 1) % P, c0 = a0 + P, d0 = b0 + P;
    idx.push(a0, b0, c0, b0, d0, c0);
  }
  out.setIndex(idx);
  return out;
}

function railChunk(track, r0, r1) {
  const RS = 12, w = RS + 1;
  const pos = [], nor = [], uv = [], idx = [];
  for (const sg of [-1, 1]) {
    const base = pos.length / 3;
    for (let r = r0; r <= r1; r++) {
      const f = frameAt(track, r * STEP);
      const Lx = -sg * f.tz, Lz = sg * f.tx;
      const C = P3(f, sg * (f.hw + RIM), f.y + TOP);
      for (let k = 0; k <= RS; k++) {
        const t = (k / RS) * Math.PI * 2, ct = Math.cos(t), st = Math.sin(t);
        const nx = ct * Lx, ny = st, nz = ct * Lz;
        pos.push(C[0] + RIM * nx, C[1] + RIM * ny, C[2] + RIM * nz);
        nor.push(nx, ny, nz);
        uv.push(r / 4, k / RS);
      }
    }
    for (let r = r0; r < r1; r++) for (let k = 0; k < RS; k++) {
      const a = base + (r - r0) * w + k, b = a + 1, c = a + w, d = c + 1;
      if (sg > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function capGeo(track, end) {
  const P = SIL, N = 8;
  const f = frameAt(track, end ? track.n - 1 : 0);
  const Rc = 0.8 * (f.hw + WALL);
  const dir = end ? 1 : -1;
  const span = end ? track.length : 0;
  const pos = [], uv = [], col = [], idx = [];
  const push = (lat, y, o, base) => {
    const q = P3(f, lat, y);
    pos.push(q[0] + f.tx * o, q[1], q[2] + f.tz * o);
    uv.push((span + o) / 4, 0);
    const c = base ? CORAL : WHITE;
    col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j <= N; j++) {
    const th = (j / N) * Math.PI / 2;
    const c = Math.cos(th), o = dir * Rc * Math.sin(th);
    for (let k = 0; k < P; k++) {
      const [sg, d, y, base] = PROF[k];
      push(c * sg * (f.hw + d), f.y + c * y, o, base);
    }
  }
  for (let j = 0; j < N; j++) for (let k = 0; k < P; k++) {
    const a = j * P + k, b = j * P + (k + 1) % P, cc = (j + 1) * P + k, d = (j + 1) * P + (k + 1) % P;
    if (dir < 0) idx.push(a, cc, b, b, cc, d); else idx.push(a, b, cc, b, d, cc);
  }
  const plateBase = pos.length / 3;
  for (let k = 0; k < P; k++) {
    const [sg, d, y, base] = PROF[k];
    push(sg * (f.hw + d), f.y + y, 0, base);
  }
  const contour = [];
  for (let k = 0; k < SIL; k++) contour.push(new THREE.Vector2(PROF[k][0] * (f.hw + PROF[k][1]), PROF[k][2]));
  for (const t of THREE.ShapeUtils.triangulateShape(contour, [])) idx.push(plateBase + t[0], plateBase + t[1], plateBase + t[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  for (let k = 0; k < P; k++) nrm.setXYZ(plateBase + k, dir * f.tx, 0, dir * f.tz);
  nrm.needsUpdate = true;
  return g;
}

function buildChannel(scene, track, cull) {
  const full = trayFull(track);
  const R = full.R;
  const tray = new THREE.MeshLambertMaterial({ map: stripeTexture('#ffffff', '#9fdcff'), vertexColors: true });
  const rail = new THREE.MeshLambertMaterial({ map: stripeTexture(YELLOW, '#fff6d6') });
  const caps = new THREE.MeshLambertMaterial({ map: stripeTexture('#ffffff', '#9fdcff'), vertexColors: true, side: THREE.DoubleSide });
  const K = Math.ceil(R / CH);
  for (let k = 0; k < K; k++) {
    const r0 = k * CH, r1 = Math.min(R, (k + 1) * CH);
    const s = (k + 0.5) * CH;
    const body = new THREE.Mesh(trayChunk(full, r0, r1), tray);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);
    cull.push({ obj: body, s, ahead: 330, behind: 90 });
    const rails = new THREE.Mesh(railChunk(track, r0, r1), rail);
    rails.castShadow = true;
    rails.receiveShadow = true;
    scene.add(rails);
    cull.push({ obj: rails, s, ahead: 330, behind: 90 });
  }
  for (const end of [false, true]) {
    const m = new THREE.Mesh(capGeo(track, end), caps);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    cull.push({ obj: m, s: end ? track.length : 0, ahead: 330, behind: 90 });
  }
}

function inst(parent, geo, mat, list, shadow = false) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3(), sc = new THREE.Vector3();
  list.forEach((it, i) => {
    e.set(it.tilt || 0, it.ry || 0, it.rz || 0);
    q.setFromEuler(e);
    const s = it.s ?? 1;
    m.compose(v.set(it.x, it.y, it.z), q, sc.set(s, s * (it.sy ?? 1), s));
    im.setMatrixAt(i, m);
    if (it.color) im.setColorAt(i, new THREE.Color(it.color));
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = shadow;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  im.userData.kind = 'decor';
  parent.add(im);
  return im;
}

function chunked(parent, cull, geo, mat, list, shadow = false) {
  const groups = new Map();
  for (const it of list) {
    const k = Math.floor(it.at / CH);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  for (const [k, items] of groups) {
    const im = inst(parent, geo, mat, items, shadow);
    cull.push({ obj: im, s: (k + 0.5) * CH, ahead: 330, behind: 90 });
  }
}

function buildClouds(scene, track) {
  const r = rng(9);
  const parts = [];
  for (let k = 0; k < 6; k++) {
    const s = 3 + r() * 3;
    parts.push(place(paint(new THREE.IcosahedronGeometry(s, 1), '#ffffff'), { x: (k - 2.5) * 3.2 + r() * 2, y: r() * 1.5, z: (r() - 0.5) * 4, sy: 0.7 }));
  }
  const geo = merged(parts, true);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xe4f6ff, emissiveIntensity: 0.5, flatShading: true });
  const b = track.bounds;
  const list = [];
  for (let i = 0; i < 170; i++) {
    list.push({ x: b.minX - 260 + r() * (b.maxX - b.minX + 520), y: -22 - r() * 16, z: b.minZ - 260 + r() * (b.maxZ - b.minZ + 520), ry: r() * 6, s: 1.2 + r() * 1.6, sy: 0.8 });
  }
  for (let i = 0; i < 70; i++) {
    list.push({ x: b.minX - 220 + r() * (b.maxX - b.minX + 440), y: 26 + r() * 40, z: b.minZ - 220 + r() * (b.maxZ - b.minZ + 440), ry: r() * 6, s: 1 + r() * 1.4, sy: 1 });
  }
  const g = new THREE.Group();
  inst(g, geo, mat, list, false);
  scene.add(g);
  return g;
}

function islandGeometry() {
  const rock = place(paint(new THREE.ConeGeometry(5, 6, 7), '#c99a6b'), { rx: Math.PI, y: -3 });
  const top = place(paint(new THREE.CylinderGeometry(5.1, 4.6, 1.1, 9), '#7ed957'), { y: 0.55 });
  const tree = place(paint(new THREE.IcosahedronGeometry(1.1, 0), '#4cbf4a'), { x: 1.2, y: 2.1, z: -0.6 });
  return merged([rock, top, tree]);
}

function balloonGeometry() {
  const ball = paint(new THREE.SphereGeometry(1.4, 12, 10), '#ffffff');
  const string = place(paint(new THREE.CylinderGeometry(0.03, 0.03, 7, 3), '#ffffff'), { y: -4.9 });
  return merged([ball, string]);
}

function pillar(h) {
  const parts = [];
  const n = Math.max(2, Math.round(h / 0.8));
  for (let i = 0; i < n; i++) {
    parts.push(place(paint(new THREE.CylinderGeometry(0.45, 0.45, 0.62, 14), i % 2 ? '#ffffff' : YELLOW), { y: i * 0.8 + 0.31 }));
  }
  parts.push(place(paint(new THREE.SphereGeometry(0.62, 14, 10), YELLOW), { y: h + 0.1 }));
  return merged(parts);
}

function buildDecor(scene, track, cull) {
  const r = rng(42);
  const b = track.bounds;
  const pick = (m) => b.minX - m + r() * (b.maxX - b.minX + 2 * m);
  const pickZ = (m) => b.minZ - m + r() * (b.maxZ - b.minZ + 2 * m);
  const candy = ['#ffffff', '#ff8c62', YELLOW, '#7fd3ff', '#7be38b', '#ff8fbd'];
  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const tintMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const islands = [];
  for (let i = 0; i < 12; i++) islands.push({ x: pick(160), y: 34 + r() * 40, z: pickZ(160), ry: r() * 6, s: 0.8 + r() * 0.8 });
  inst(scene, islandGeometry(), litMat, islands);

  const balloons = [];
  for (let i = 0; i < 10; i++) balloons.push({ x: pick(120), y: 30 + r() * 30, z: pickZ(120), s: 0.9 + r() * 0.5, color: candy[i % candy.length] });
  inst(scene, balloonGeometry(), tintMat, balloons);

  const rings = [];
  for (let i = 0; i < 8; i++) rings.push({ x: pick(180), y: 22 + r() * 30, z: pickZ(180), ry: r() * 6, tilt: (r() - 0.5) * 0.5, s: 0.9 + r() * 0.4, color: candy[(i * 2 + 1) % candy.length] });
  inst(scene, new THREE.TorusGeometry(3, 0.9, 10, 18), tintMat, rings);

  const chain = [];
  for (let s = 20; s < track.length - 20; s += 30) {
    const f = track.at(s, {});
    for (const sg of [-1, 1]) {
      const lat = sg * (f.hw + 0.7);
      chain.push({ x: f.x - f.tz * lat, y: f.y + BOTTOM - 7, z: f.z + f.tx * lat, sy: 14, at: s });
    }
  }
  chunked(scene, cull, paint(new THREE.CylinderGeometry(0.35, 0.35, 1, 6), '#ffffff'), tintMat, chain);

  const blobGeo = paint(new THREE.SphereGeometry(0.32, 8, 6), '#ffffff');
  const blobMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const cs of [...CHECKPOINTS.slice(1), FINISH_S]) {
    const list = [];
    for (let i = -3; i <= 3; i++) {
      for (const sg of [-1, 1]) {
        const s = cs + i * 2 + (sg > 0 ? 0.6 : 0);
        const f = track.at(s, {});
        list.push({ x: f.x - f.tz * sg * (f.hw + RIM), y: f.y + TOP + 0.75, z: f.z + f.tx * sg * (f.hw + RIM), color: candy[(i + 3 + (sg > 0 ? 2 : 0)) % candy.length] });
      }
    }
    const im = inst(scene, blobGeo, blobMat, list);
    cull.push({ obj: im, s: cs, ahead: 330, behind: 60 });
  }
}

function buildArches(scene, track) {
  const arches = [];
  const defs = [{ s: START_S + 5, label: 'START', kind: 'start' }];
  for (let i = 1; i < CHECKPOINTS.length; i++) defs.push({ s: CHECKPOINTS[i], label: `CHECKPOINT ${i}`, kind: 'cp', index: i });
  defs.push({ s: FINISH_S, label: 'FINISH', kind: 'finish' });
  const H = 11.2;
  const pillarGeo = pillar(H);
  for (const d of defs) {
    const f = track.at(d.s, {});
    const g = new THREE.Group();
    const span = f.hw + RIM;
    const bw = span * 2;
    const posts = [];
    for (const side of [-1, 1]) posts.push(pillarGeo.clone().translate(side * span, 0, 0));
    const tex = d.kind === 'finish'
      ? textTexture(d.label, { w: 1024, h: 192, stripes: ['#1d2b53', '#ffffff'], fg: '#1d2b53', size: 120 })
      : textTexture(d.label, { w: 1024, h: 192, bg: d.kind === 'start' ? YELLOW : '#ffffff', fg: '#1d2b53', size: 118, radius: 60, border: '#3d7bff', borderW: 18 });
    const banner = new THREE.Group();
    banner.position.y = H + 0.3;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, 1.7, 0.3), new THREE.MeshStandardMaterial({ color: CORAL, roughness: 0.5 }));
    body.castShadow = true;
    banner.add(body);
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    for (const sz of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(bw, 1.7), face);
      pl.position.z = sz * 0.156;
      if (sz < 0) pl.rotation.y = Math.PI;
      banner.add(pl);
    }
    g.add(banner);
    const fl = [];
    for (let k = 0; k < 11; k++) {
      const x = -bw / 2 + 0.4 + (k / 10) * (bw - 0.8);
      fl.push(place(paint(new THREE.ConeGeometry(0.3, 0.7, 3), k % 2 ? YELLOW : '#ffffff'), { x, y: H + 0.3 + 0.85 + 0.35 }));
    }
    const frame = new THREE.Mesh(merged(posts.concat(fl)), new THREE.MeshLambertMaterial({ vertexColors: true }));
    frame.castShadow = true;
    g.add(frame);
    g.position.set(f.x, f.y + TOP, f.z);
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
    gm.position.y = 5;
    g.add(gm);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.scale.y = 4.1;
    beam.position.y = 0.4;
    g.add(beam);
    const tex = textTexture(d.label, { w: 512, h: 256, bg: null, fg: '#ffffff', size: d.finish ? 120 : 190 });
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, transparent: true, depthWrite: false }));
    spr.scale.set(d.finish ? 8 : 6, d.finish ? 4 : 3, 1);
    spr.position.y = 7.9;
    g.add(spr);
    const outline = textTexture(d.label, { w: 512, h: 256, bg: null, fg: '#1d2b53', size: d.finish ? 120 : 190 });
    const sh = new THREE.Sprite(new THREE.SpriteMaterial({ map: outline, fog: false, transparent: true, depthWrite: false }));
    sh.scale.copy(spr.scale).multiplyScalar(1.08);
    sh.position.y = 7.75;
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
      update(dt, cam, s = 0) {
        t += dt;
        const target = state === 'done' ? 0 : 1;
        shown += (target - shown) * Math.min(1, dt * (state === 'done' ? 7 : 3));
        g.visible = shown > 0.02 && Math.abs(d.s - s) < 340;
        const pulse = state === 'next' ? 1 + Math.sin(t * 4) * 0.08 : 1;
        gm.rotation.y = t * (state === 'next' ? 1.6 : 0.6);
        gm.position.y = 5 + Math.sin(t * 1.6) * 0.35;
        gm.scale.setScalar(shown * pulse);
        beamMat.opacity = (state === 'next' ? 0.32 + Math.sin(t * 4) * 0.08 : 0.14) * shown;
        spr.scale.set((d.finish ? 8 : 6) * shown, (d.finish ? 4 : 3) * shown, 1);
        sh.scale.copy(spr.scale).multiplyScalar(1.08);
      },
    });
  }
  return out;
}

function buildSigns(scene, track, cull) {
  const post = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  for (const h of HAZARDS) {
    if (h.type !== 'sign') continue;
    const f = track.at(h.s, {});
    const lat = h.side * (f.hw + RIM);
    const g = new THREE.Group();
    const tex = textTexture(h.text, { w: 512, h: 288, bg: '#fff7e0', fg: '#1d2b53', size: 84, radius: 34, border: '#ff9a3d', borderW: 16 });
    const body = paint(new THREE.BoxGeometry(3.4, 1.9, 0.14), '#ffffff').translate(0, 2.6, 0);
    const pole = paint(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 8), '#ffffff').translate(0, 1.3, 0);
    const frame = new THREE.Mesh(merged([body, pole]), post);
    frame.castShadow = true;
    g.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.9), new THREE.MeshLambertMaterial({ map: tex }));
    face.position.set(0, 2.6, 0.08);
    g.add(face);
    g.position.set(f.x - f.tz * lat, f.y + TOP + RIM, f.z + f.tx * lat);
    g.rotation.y = Math.atan2(-f.tx, -f.tz) - h.side * 0.45;
    scene.add(g);
    cull.push({ obj: g, s: h.s, ahead: 260, behind: 40 });
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
