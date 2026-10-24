// Toot Tube: particles. Green gas clouds, spray, ripple rings on the water and checkpoint confetti.

import * as THREE from 'three';

class Particles {
  constructor(scene, max, kind) {
    this.max = max;
    this.kind = kind;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.seed = new Float32Array(max);
    this.tint = new Float32Array(max);
    this.aSize = new Float32Array(max);
    this.aAlpha = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.attrP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrS = new THREE.BufferAttribute(this.aSize, 1).setUsage(THREE.DynamicDrawUsage);
    this.attrA = new THREE.BufferAttribute(this.aAlpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attrP);
    g.setAttribute('aSize', this.attrS);
    g.setAttribute('aAlpha', this.attrA);
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(this.tint, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.uniforms = {
      uScale: { value: 800 },
      fogColor: { value: new THREE.Color('#d3f0ff') },
      fogNear: { value: 80 }, fogFar: { value: 300 },
    };
    const gas = kind === 'gas';
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: this.uniforms,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute float aSeed; attribute float aTint;
        uniform float uScale; varying float vA; varying float vSeed; varying float vFog; varying float vTint;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          vA = aAlpha; vSeed = aSeed; vTint = aTint; vFog = -mv.z;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        varying float vA; varying float vSeed; varying float vFog; varying float vTint;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float nz(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hh(i), hh(i+vec2(1,0)), u.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), u.x), u.y); }
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0;
          ${gas
            ? `float n = nz(c * 4.0 + vSeed * 17.0) * 0.55 + nz(c * 9.0 - vSeed * 5.0) * 0.25;
          float a = (1.0 - smoothstep(0.45, 0.95, d + n * 0.45 - 0.12)) * vA;
          vec3 inner = mix(vec3(0.86, 1.0, 0.42), vec3(0.98, 0.93, 0.35), vTint);
          vec3 outer = mix(vec3(0.42, 0.78, 0.12), vec3(0.6, 0.72, 0.1), vTint);
          vec3 col = mix(outer, inner, smoothstep(0.9, 0.1, d + n * 0.3) * 0.8 + 0.1 * (1.0 - c.y));`
            : `float a = (1.0 - smoothstep(0.55, 1.0, d)) * vA;
          vec3 col = mix(vec3(0.85, 0.97, 1.0), vec3(1.0), 1.0 - d);`}
          float f = smoothstep(fogNear, fogFar, vFog);
          if (a < 0.01) discard;
          gl_FragColor = vec4(mix(col, fogColor, f), a); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.geo = g;
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, tint = 0) {
    let i;
    if (this.n < this.max) i = this.n++;
    else {
      let best = 0, ba = -1;
      for (let k = 0; k < this.n; k += 7) { const r = this.age[k] / this.life[k]; if (r > ba) { ba = r; best = k; } }
      i = best;
    }
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.age[i] = 0;
    this.size0[i] = s0; this.size1[i] = s1;
    this.seed[i] = Math.random();
    this.tint[i] = tint;
    this.geo.attributes.aSeed.needsUpdate = true;
  }

  update(dt, drag, grav, lift) {
    let i = 0;
    while (i < this.n) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        const j = --this.n;
        this.pos[i * 3] = this.pos[j * 3]; this.pos[i * 3 + 1] = this.pos[j * 3 + 1]; this.pos[i * 3 + 2] = this.pos[j * 3 + 2];
        this.vel[i * 3] = this.vel[j * 3]; this.vel[i * 3 + 1] = this.vel[j * 3 + 1]; this.vel[i * 3 + 2] = this.vel[j * 3 + 2];
        this.life[i] = this.life[j]; this.age[i] = this.age[j];
        this.size0[i] = this.size0[j]; this.size1[i] = this.size1[j]; this.seed[i] = this.seed[j]; this.tint[i] = this.tint[j];
        continue;
      }
      const k = Math.exp(-drag * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - grav * dt + lift * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const r = this.age[i] / this.life[i];
      this.aSize[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * (1 - (1 - r) * (1 - r));
      this.aAlpha[i] = this.kind === 'gas' ? Math.min(1, r * 10) * (1 - r * r) * 0.78 : (1 - r);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.attrP.needsUpdate = true;
    this.attrS.needsUpdate = true;
    this.attrA.needsUpdate = true;
    this.geo.attributes.aTint.needsUpdate = true;
    this.geo.attributes.aSeed.needsUpdate = true;
  }
}

class Rings {
  constructor(scene, max = 80) {
    this.max = max;
    this.list = [];
    this.alpha = new Float32Array(max);
    const geo = new THREE.PlaneGeometry(2, 2);
    geo.rotateX(-Math.PI / 2);
    this.attrA = new THREE.InstancedBufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.attrA);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute float aAlpha; varying float vA; varying vec2 vP;
        void main(){ vA = aAlpha; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vA; varying vec2 vP;
        void main(){ float d = length(vP); float r = smoothstep(0.78, 0.9, d) * (1.0 - smoothstep(0.92, 1.0, d));
          float r2 = smoothstep(0.5, 0.58, d) * (1.0 - smoothstep(0.6, 0.66, d)) * 0.6;
          float a = (r + r2) * vA; if (a < 0.01) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, a * 0.85); }`,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
  }

  add(x, y, z, size = 2, life = 1.4) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ x, y, z, size, life, age: 0 });
  }

  update(dt) {
    this.list = this.list.filter((r) => (r.age += dt) < r.life);
    this.list.forEach((r, i) => {
      const k = r.age / r.life;
      const s = r.size * (0.25 + (1 - (1 - k) * (1 - k)) * 0.9);
      this.m.makeScale(s, 1, s);
      this.m.setPosition(r.x, r.y + 0.03, r.z);
      this.mesh.setMatrixAt(i, this.m);
      this.alpha[i] = (1 - k) * Math.min(1, k * 8);
    });
    this.mesh.count = this.list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.attrA.needsUpdate = true;
  }
}

class Confetti {
  constructor(scene, max = 260) {
    this.max = max;
    this.list = [];
    const geo = new THREE.PlaneGeometry(0.16, 0.26);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    const cols = ['#ffd23f', '#3d7bff', '#ff6fb5', '#2ec4b6', '#ffffff', '#ff8a2a'].map((c) => new THREE.Color(c));
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, cols[i % cols.length]);
    scene.add(this.mesh);
    this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.m = new THREE.Matrix4();
    this.v = new THREE.Vector3(); this.one = new THREE.Vector3(1, 1, 1);
  }

  burst(x, y, z, n = 160, spread = 6) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      this.list.push({
        x: x + Math.cos(a) * r, y: y + Math.random() * 1.5, z: z + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 4, vy: 3 + Math.random() * 5, vz: (Math.random() - 0.5) * 4,
        rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 14, sy: (Math.random() - 0.5) * 14,
        age: 0, life: 2.5 + Math.random() * 1.5,
      });
    }
  }

  update(dt) {
    this.list = this.list.filter((c) => (c.age += dt) < c.life);
    this.list.forEach((c, i) => {
      c.vy -= 6 * dt;
      const k = Math.exp(-1.6 * dt);
      c.vx *= k; c.vz *= k; c.vy = Math.max(c.vy, -2.2);
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.rx += c.sx * dt; c.ry += c.sy * dt;
      this.e.set(c.rx, c.ry, 0);
      this.q.setFromEuler(this.e);
      const s = Math.min(1, (c.life - c.age) * 2);
      this.v.set(c.x, c.y, c.z);
      this.m.compose(this.v, this.q, this.one.set(s, s, s));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.count = this.list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class FX {
  constructor(scene) {
    this.gas = new Particles(scene, 1100, 'gas');
    this.spray = new Particles(scene, 600, 'spray');
    this.rings = new Rings(scene);
    this.confettiSys = new Confetti(scene);
    this.acc = new Map();
  }

  setView(camera, renderer) {
    const h = renderer.domElement.height;
    const s = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.gas.uniforms.uScale.value = s;
    this.spray.uniforms.uScale.value = s;
  }

  fart(id, dt, bx, by, bz, fx, fz, vx, vz, waterY, power = 1) {
    const a = (this.acc.get(id) || 0) + dt * 46 * power;
    let n = Math.floor(a);
    this.acc.set(id, a - n);
    while (n-- > 0) {
      const sp = 2.4 + Math.random() * 2.2;
      const jx = (Math.random() - 0.5) * 1.6, jy = Math.random() * 1.2, jz = (Math.random() - 0.5) * 1.6;
      this.gas.emit(
        bx + (Math.random() - 0.5) * 0.4, by + Math.random() * 0.1, bz + (Math.random() - 0.5) * 0.4,
        -fx * sp + jx + vx * 0.6, jy + 0.5, -fz * sp + jz + vz * 0.6,
        0.9 + Math.random() * 0.8, 0.3 + Math.random() * 0.15, 1.0 + Math.random() * 0.9, Math.random() * 0.6,
      );
    }
    const r = (this.acc.get(id + ':r') || 0) + dt;
    if (r > 0.16) {
      this.acc.set(id + ':r', 0);
      this.rings.add(bx - fx * (0.4 + Math.random()), waterY, bz - fz * (0.4 + Math.random()), 0.9 + Math.random() * 0.7, 1.1);
    } else this.acc.set(id + ':r', r);
    const bub = Math.floor(dt * 40 + Math.random());
    for (let i = 0; i < bub; i++) {
      this.spray.emit(bx - fx * Math.random() * 0.8 + (Math.random() - 0.5) * 0.6, waterY + 0.02, bz - fz * Math.random() * 0.8 + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.2, 0.16, 0.05);
    }
  }

  burst(x, y, z, fx, fz, waterY) {
    for (let i = 0; i < 26; i++) {
      const a = (Math.random() - 0.5) * 1.6, sp = 4 + Math.random() * 4;
      const c = Math.cos(a), s = Math.sin(a);
      const dx = -(fx * c - fz * s), dz = -(fz * c + fx * s);
      this.gas.emit(x, y + Math.random() * 0.2, z, dx * sp, 0.6 + Math.random() * 1.6, dz * sp, 0.8 + Math.random() * 0.7, 0.4, 1.7 + Math.random() * 0.8, Math.random() * 0.6);
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
      this.spray.emit(x - fx * 0.3, waterY + 0.05, z - fz * 0.3, Math.cos(a) * sp - fx * 2, 2 + Math.random() * 3, Math.sin(a) * sp - fz * 2, 0.6 + Math.random() * 0.3, 0.2, 0.08);
    }
    this.rings.add(x - fx * 0.6, waterY, z - fz * 0.6, 2.4, 1.2);
  }

  speedSpray(x, y, z, vx, vz, k) {
    const sp = Math.hypot(vx, vz) || 1;
    const nx = vx / sp, nz = vz / sp;
    for (const side of [-1, 1]) {
      if (Math.random() > k) continue;
      const px = x + nx * 1.9 - nz * side * 1.2, pz = z + nz * 1.9 + nx * side * 1.2;
      this.spray.emit(px, y + 0.05, pz, -nz * side * (1.5 + Math.random() * 2) + vx * 0.3, 1.2 + Math.random() * 1.8, nx * side * (1.5 + Math.random() * 2) + vz * 0.3, 0.45 + Math.random() * 0.3, 0.16, 0.06);
    }
  }

  puff(x, y, z, fx, fz) {
    for (let i = 0; i < 5; i++) this.gas.emit(x, y, z, -fx * 1.5 + (Math.random() - 0.5), 0.3, -fz * 1.5 + (Math.random() - 0.5), 0.6, 0.2, 0.7, 0.8);
  }

  splash(x, y, z, n = 30, power = 4, ring = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = power * (0.3 + Math.random() * 0.7);
      this.spray.emit(x, y + 0.1, z, Math.cos(a) * s * 0.5, s * (0.8 + Math.random() * 0.6), Math.sin(a) * s * 0.5, 0.6 + Math.random() * 0.5, 0.18, 0.08);
    }
    if (ring) { this.rings.add(x, y, z, ring, 1.6); this.rings.add(x, y, z, ring * 0.6, 1.1); }
  }

  hiss(x, y, z, dx, dz) {
    for (let i = 0; i < 3; i++) {
      this.spray.emit(x, y, z, dx * 6 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, dz * 6 + (Math.random() - 0.5) * 2, 0.5, 0.25, 0.9);
    }
  }

  jet(x, y, z, h) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spray.emit(x + Math.cos(a) * 0.6, y + h, z + Math.sin(a) * 0.6, Math.cos(a) * 3, 2 + Math.random() * 3, Math.sin(a) * 3, 0.9, 0.3, 0.15);
    }
  }

  wake(x, y, z) { this.rings.add(x, y, z, 2.6, 1.8); }

  confetti(x, y, z) { this.confettiSys.burst(x, y, z); }

  update(dt) {
    this.gas.update(dt, 1.9, -0.25, 0);
    this.spray.update(dt, 0.4, 9.5, 0);
    this.rings.update(dt);
    this.confettiSys.update(dt);
  }
}
