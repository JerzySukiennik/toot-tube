// Toot Tube: deterministic gameplay simulation (raft on water, hazards, characters on the raft). No rendering here.

import { RAFT, PHYS, PLAYER, GAS } from './config.js';
import { HAZARDS } from './track.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function segDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / (abx * abx + abz * abz || 1), 0, 1);
  const cx = ax + abx * t, cz = az + abz * t;
  return { d: Math.hypot(px - cx, pz - cz), cx, cz, t };
}

export function doorsClose(T, period, phase) {
  const u = ((T / period + phase) % 1 + 1) % 1;
  if (u < 0.5) return 0;
  if (u < 0.65) { const k = (u - 0.5) / 0.15; return k * k * (3 - 2 * k); }
  if (u < 0.82) return 1;
  const k = (u - 0.82) / 0.18;
  return 1 - k * k * (3 - 2 * k);
}

export function geyserState(T, period, phase) {
  const u = ((T + phase) % period + period) % period;
  if (u < 1.3) return { mode: 'warn', k: u / 1.3 };
  if (u < 2.5) return { mode: 'jet', k: (u - 1.3) / 1.2 };
  return { mode: 'idle', k: 0 };
}

export class Hazards {
  constructor(track) {
    this.track = track;
    this.list = [];
    this.beans = [];
    const f = {};
    for (const def of HAZARDS) {
      const h = { ...def };
      track.at(def.s, f);
      h.cx = f.x; h.cz = f.z; h.wy = f.y; h.tx = f.tx; h.tz = f.tz; h.hw = f.hw;
      h.rx = -f.tz; h.rz = f.tx;
      const W = (lat) => ({ x: f.x + h.rx * lat, z: f.z + h.rz * lat });
      if (def.lat !== undefined) { const p = W(def.lat); h.x = p.x; h.z = p.z; }
      if (def.type === 'roller') {
        const a = W(def.a), b = W(def.b);
        h.ax = a.x; h.az = a.z; h.bx = b.x; h.bz = b.z;
      }
      if (def.type === 'bean') { h.taken = -1e9; this.beans.push(h); }
      this.list.push(h);
    }
    this.sweepers = this.list.filter((h) => h.type === 'sweeper');
    this.dynamicRollers = [];
  }

  sliderLat(h, T) {
    return h.amp * Math.sin((T / h.period + h.phase) * TAU);
  }

  rollersAt(T, out = []) {
    out.length = 0;
    for (const h of this.list) {
      if (h.type === 'roller') out.push({ ax: h.ax, az: h.az, bx: h.bx, bz: h.bz, h });
      else if (h.type === 'slider') {
        const c = this.sliderLat(h, T);
        const l0 = c - h.len / 2, l1 = c + h.len / 2;
        out.push({ ax: h.cx + h.rx * l0, az: h.cz + h.rz * l0, bx: h.cx + h.rx * l1, bz: h.cz + h.rz * l1, h });
      } else if (h.type === 'doors') {
        const k = doorsClose(T, h.period, h.phase);
        const L = 0.6 + (h.hw - 0.25 - 0.6) * k;
        const e = h.hw + 0.4;
        out.push({ ax: h.cx - h.rx * e, az: h.cz - h.rz * e, bx: h.cx - h.rx * (e - L - 0.4), bz: h.cz - h.rz * (e - L - 0.4), h });
        out.push({ ax: h.cx + h.rx * e, az: h.cz + h.rz * e, bx: h.cx + h.rx * (e - L - 0.4), bz: h.cz + h.rz * (e - L - 0.4), h });
      }
    }
    return out;
  }

  buoyPos(h, T) {
    if (!h.orbit) return { x: h.x, z: h.z };
    const a = h.orbit.phase + T * h.orbit.speed;
    return { x: h.x + Math.cos(a) * h.orbit.r, z: h.z + Math.sin(a) * h.orbit.r };
  }

  sweeperAngle(h, T, k) {
    return h.phase + h.w * T + (k * TAU) / h.arms;
  }

  hitSweeper(px, pz, y0, y1, T) {
    for (const h of this.sweepers) {
      const dx = px - h.x, dz = pz - h.z;
      const dist = Math.hypot(dx, dz);
      if (dist > h.len + 0.8) continue;
      const armY0 = h.wy + 0.72, armY1 = h.wy + 1.02;
      if (y1 < armY0 || y0 > armY1) continue;
      for (let k = 0; k < h.arms; k++) {
        const a = this.sweeperAngle(h, T, k);
        const ex = h.x + Math.cos(a) * h.len, ez = h.z + Math.sin(a) * h.len;
        const r = segDist(px, pz, h.x, h.z, ex, ez);
        if (r.d < PLAYER.radius + 0.36) {
          const sgn = Math.sign(h.w) || 1;
          const tx = -Math.sin(a) * sgn, tz = Math.cos(a) * sgn;
          return { tx, tz, ox: dx / (dist || 1), oz: dz / (dist || 1) };
        }
      }
    }
    return null;
  }
}

export function makeRaft(track, s) {
  const f = track.at(s, {});
  return {
    x: f.x, z: f.z, a: Math.atan2(f.tx, f.tz), vx: 0, vz: 0, w: 0,
    y: f.y, s, lat: 0, hint: Math.round(s / 0.5), slope: 0, hw: f.hw, cur: f.cur,
    tx: f.tx, tz: f.tz, dvx: 0, dvz: 0,
  };
}

const _rollers = [];

export function stepRaft(raft, track, haz, T, inputs, mult, dt, ev) {
  const L = track.locate(raft.x, raft.z, raft.hint);
  raft.hint = L.i; raft.s = L.s; raft.lat = L.lat; raft.y = L.y; raft.slope = L.slope;
  raft.hw = L.hw; raft.cur = L.cur; raft.tx = L.tx; raft.tz = L.tz;

  let cvx = L.tx * L.cur, cvz = L.tz * L.cur;
  let spinTarget = 0, spinK = 0;
  for (const h of haz.list) {
    if (h.type !== 'whirl') continue;
    const dx = raft.x - h.x, dz = raft.z - h.z;
    const d = Math.hypot(dx, dz);
    if (d > h.R || d < 0.01) continue;
    const f = 1 - d / h.R;
    const ux = dx / d, uz = dz / d;
    cvx += (-uz * 2.4 * f - ux * 1.1 * f) * h.str;
    cvz += (ux * 2.4 * f - uz * 1.1 * f) * h.str;
    spinTarget += PHYS.whirlSpin * f * h.str;
    spinK = Math.max(spinK, f);
  }

  let ax = 0, az = 0, torque = 0;
  const ca = Math.cos(raft.a), sa = Math.sin(raft.a);
  for (const p of inputs) {
    if (!p.fart || !p.onRaft) continue;
    const fwa = p.f + raft.a;
    const Fx = Math.sin(fwa) * PHYS.thrust * mult, Fz = Math.cos(fwa) * PHYS.thrust * mult;
    const rx = p.lx * ca + p.lz * sa, rz = -p.lx * sa + p.lz * ca;
    ax += Fx; az += Fz;
    torque += (rz * Fx - rx * Fz) * PHYS.torqueK;
  }

  const rvx = raft.vx - cvx, rvz = raft.vz - cvz;
  const rs = Math.hypot(rvx, rvz);
  ax += -PHYS.linDrag * rvx - PHYS.quadDrag * rs * rvx;
  az += -PHYS.linDrag * rvz - PHYS.quadDrag * rs * rvz;

  const ovx = raft.vx, ovz = raft.vz;
  raft.vx += ax * dt; raft.vz += az * dt;
  raft.w += (torque / PHYS.inertia) * dt;
  raft.w *= Math.exp(-PHYS.angDrag * dt);
  if (spinK > 0) raft.w += (spinTarget - raft.w) * Math.min(1, spinK * 1.6 * dt);
  raft.x += raft.vx * dt; raft.z += raft.vz * dt;
  raft.a += raft.w * dt;

  const R = RAFT.R;
  const L2 = track.locate(raft.x, raft.z, raft.hint);
  const lim = L2.hw - PHYS.bankInset - R;
  if (Math.abs(L2.lat) > lim) {
    const side = Math.sign(L2.lat);
    const pen = Math.abs(L2.lat) - lim;
    const nx = -L2.tz * side, nz = L2.tx * side;
    raft.x -= nx * pen; raft.z -= nz * pen;
    const vn = raft.vx * nx + raft.vz * nz;
    if (vn > 0) {
      raft.vx -= nx * vn * (1 + PHYS.wallRest);
      raft.vz -= nz * vn * (1 + PHYS.wallRest);
      const vt = raft.vx * L2.tx + raft.vz * L2.tz;
      raft.w -= vt * side * 0.18;
      if (vn > 0.6) ev.push({ type: 'bump', mag: vn, x: raft.x + nx * R, z: raft.z + nz * R, y: L2.y });
    }
  }
  if (L2.s < R + 0.6) {
    const pen = R + 0.6 - L2.s;
    raft.x += L2.tx * pen; raft.z += L2.tz * pen;
    const vn = raft.vx * L2.tx + raft.vz * L2.tz;
    if (vn < 0) { raft.vx -= L2.tx * vn * 1.4; raft.vz -= L2.tz * vn * 1.4; }
  }
  if (L2.s > track.length - R - 0.6) {
    const pen = L2.s - (track.length - R - 0.6);
    raft.x -= L2.tx * pen; raft.z -= L2.tz * pen;
    const vn = raft.vx * L2.tx + raft.vz * L2.tz;
    if (vn > 0) { raft.vx -= L2.tx * vn * 1.4; raft.vz -= L2.tz * vn * 1.4; }
  }

  for (const h of haz.list) {
    if (Math.abs(h.s - L2.s) > 22) continue;
    if (h.type === 'donut' || h.type === 'sweeper') {
      const r = h.type === 'donut' ? 1.15 : 0.55;
      const rest = h.type === 'donut' ? 1.15 : 0.6;
      const dx = raft.x - h.x, dz = raft.z - h.z;
      const d = Math.hypot(dx, dz);
      if (d < R + r && d > 0.001) {
        const nx = dx / d, nz = dz / d;
        raft.x += nx * (R + r - d); raft.z += nz * (R + r - d);
        const vn = raft.vx * nx + raft.vz * nz;
        if (vn < 0) {
          raft.vx -= nx * vn * (1 + rest); raft.vz -= nz * vn * (1 + rest);
          if (h.type === 'donut') { raft.vx += nx * 0.8; raft.vz += nz * 0.8; }
          ev.push({ type: 'bump', mag: -vn + 0.5, x: h.x + nx * r, z: h.z + nz * r, y: L2.y, donut: h.type === 'donut' });
        }
      }
    } else if (h.type === 'buoy') {
      const p = haz.buoyPos(h, T);
      if (Math.hypot(raft.x - p.x, raft.z - p.z) < R + 0.62) ev.push({ type: 'pop', why: 'spikes', x: p.x, z: p.z });
    } else if (h.type === 'geyser') {
      const g = geyserState(T, h.period, h.phase);
      if (g.mode === 'jet') {
        const dx = raft.x - h.x, dz = raft.z - h.z;
        const d = Math.hypot(dx, dz);
        if (d < R + 1.6) {
          const nx = d > 0.01 ? dx / d : L2.tx, nz = d > 0.01 ? dz / d : L2.tz;
          raft.vx += nx * 16 * dt; raft.vz += nz * 16 * dt;
          raft.w += 2.5 * dt * (h.lat > 0 ? 1 : -1);
          ev.push({ type: 'geyser', h });
        }
      }
    }
  }
  haz.rollersAt(T, _rollers);
  for (const r of _rollers) {
    if (Math.abs(r.h.s - L2.s) > 16) continue;
    const q = segDist(raft.x, raft.z, r.ax, r.az, r.bx, r.bz);
    if (q.d < R + 0.58) { ev.push({ type: 'pop', why: 'spikes', x: q.cx, z: q.cz }); break; }
  }

  raft.dvx = raft.vx - ovx; raft.dvz = raft.vz - ovz;
  const L3 = track.locate(raft.x, raft.z, raft.hint);
  raft.hint = L3.i; raft.s = L3.s; raft.lat = L3.lat; raft.y = L3.y; raft.slope = L3.slope;
  raft.hw = L3.hw; raft.cur = L3.cur; raft.tx = L3.tx; raft.tz = L3.tz;
}

export function surfaceY(r) {
  if (r <= RAFT.deckR) return RAFT.deckY;
  const d = r - RAFT.ringR;
  if (Math.abs(d) <= RAFT.tubeR) return Math.max(RAFT.deckY, RAFT.tubeCY + Math.sqrt(RAFT.tubeR * RAFT.tubeR - d * d));
  return r < RAFT.ringR ? RAFT.deckY : -10;
}

export function makePlayer(slot) {
  const ang = [Math.PI, Math.PI * 0.35, -Math.PI * 0.35][slot % 3];
  const r = 0.75;
  return {
    x: Math.sin(ang) * r, z: Math.cos(ang) * r, y: RAFT.deckY,
    vx: 0, vz: 0, vy: 0, f: 0, grounded: true, mode: 'ok', airT: 0,
    gas: 1, gasIdle: 0, fart: false, fartHold: 0, coyote: 0, jumpBuf: 0,
    walkPhase: 0, speed: 0, landK: 0, knockT: 0, fallen: false, fartT: 0,
  };
}

export function resetPlayer(p, slot) {
  const n = makePlayer(slot);
  Object.assign(p, n);
}

export function stepPlayer(p, inp, raft, haz, T, dt, others, ev) {
  const ca = Math.cos(raft.a), sa = Math.sin(raft.a);
  const dvx = raft.dvx, dvz = raft.dvz;
  const dlx = dvx * ca - dvz * sa, dlz = dvx * sa + dvz * ca;

  if (p.mode === 'fallen') return;

  let mx = 0, mz = 0;
  if (p.mode === 'ok' && inp.active) {
    const wx = inp.mx, wz = inp.mz;
    mx = wx * ca - wz * sa; mz = wx * sa + wz * ca;
  }
  const mlen = Math.hypot(mx, mz);
  if (mlen > 1) { mx /= mlen; mz /= mlen; }

  const wantFart = p.mode === 'ok' && inp.active && inp.fart;
  if (wantFart && p.gas > 0.02) {
    if (!p.fart) { p.fart = true; p.fartHold = 0; ev.push({ type: 'fartStart' }); }
  }
  if (p.fart) {
    p.fartHold += dt;
    p.gas = Math.max(0, p.gas - GAS.drain * dt);
    p.gasIdle = 0;
    if ((!wantFart && p.fartHold >= GAS.minPuff) || p.gas <= 0 || p.mode !== 'ok') {
      p.fart = false; ev.push({ type: 'fartEnd', empty: p.gas <= 0 });
    }
  } else {
    p.gasIdle += dt;
    if (p.gasIdle > GAS.delay) p.gas = Math.min(1, p.gas + GAS.regen * dt);
    if (wantFart && p.gas <= 0.02 && inp.fartPressed) ev.push({ type: 'fartEmpty' });
  }
  p.fartT = p.fart ? p.fartT + dt : 0;

  if (mlen > 0.05) {
    const target = Math.atan2(mx, mz);
    let d = target - p.f;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.f += d * Math.min(1, dt * (p.fart ? 7 : 14));
  }

  const speed = PLAYER.walk * (p.fart ? PLAYER.fartWalk : 1);
  if (p.grounded) {
    const k = 1 - Math.exp(-PLAYER.accel * dt);
    p.vx += (mx * speed - p.vx) * k;
    p.vz += (mz * speed - p.vz) * k;
    p.vx -= dlx * 0.28; p.vz -= dlz * 0.28;
  } else {
    if (p.mode === 'ok') {
      const k = 1 - Math.exp(-PLAYER.accel * PLAYER.airControl * dt);
      p.vx += (mx * speed - p.vx) * k;
      p.vz += (mz * speed - p.vz) * k;
    }
    p.vx -= dlx; p.vz -= dlz;
    const rot = -raft.w * dt;
    const c = Math.cos(rot), s = Math.sin(rot);
    const nx = p.x * c + p.z * s, nz = -p.x * s + p.z * c;
    p.x = nx; p.z = nz;
    const nvx = p.vx * c + p.vz * s, nvz = -p.vx * s + p.vz * c;
    p.vx = nvx; p.vz = nvz;
    p.f += rot;
    if (p.fart) {
      p.vx += Math.sin(p.f) * PLAYER.airFart * dt;
      p.vz += Math.cos(p.f) * PLAYER.airFart * dt;
      p.vy += PLAYER.airLift * dt;
    }
  }

  p.coyote = p.grounded ? PLAYER.coyote : p.coyote - dt;
  p.jumpBuf = inp.active && inp.jumpPressed && p.mode === 'ok' ? PLAYER.jumpBuffer : p.jumpBuf - dt;
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = PLAYER.jumpV; p.grounded = false; p.coyote = 0; p.jumpBuf = 0;
    ev.push({ type: 'jump' });
  }

  p.x += p.vx * dt; p.z += p.vz * dt;

  for (const o of others) {
    if (!o || o.mode === 'fallen') continue;
    const dx = p.x - o.x, dz = p.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = PLAYER.radius * 2;
    if (d < min && Math.abs(p.y - o.y) < 0.8) {
      const nx = d > 0.001 ? dx / d : 1, nz = d > 0.001 ? dz / d : 0;
      p.x += nx * (min - d) * 0.7; p.z += nz * (min - d) * 0.7;
      const vn = p.vx * nx + p.vz * nz;
      if (vn < 0) { p.vx -= nx * vn; p.vz -= nz * vn; }
    }
  }

  let r = Math.hypot(p.x, p.z);
  if (p.grounded) {
    if (r > PLAYER.rMax) {
      p.x *= PLAYER.rMax / r; p.z *= PLAYER.rMax / r;
      const nx = p.x / PLAYER.rMax, nz = p.z / PLAYER.rMax;
      const vn = p.vx * nx + p.vz * nz;
      if (vn > 0) { p.vx -= nx * vn; p.vz -= nz * vn; }
      r = PLAYER.rMax;
    }
    const sy = surfaceY(r);
    p.y += (sy - p.y) * Math.min(1, dt * 20);
    p.vy = 0;
  } else {
    p.vy -= PLAYER.gravity * dt;
    p.y += p.vy * dt;
    const sy = surfaceY(r);
    if (p.vy <= 0 && r <= RAFT.ringR + RAFT.tubeR * 0.85 && p.y <= sy) {
      p.y = sy; p.grounded = true; p.landK = Math.min(1, -p.vy / 7);
      if (p.mode === 'knocked') p.mode = 'ok';
      ev.push({ type: 'land', mag: -p.vy });
      p.vy = 0;
      if (r > PLAYER.rMax) { p.x *= PLAYER.rMax / r; p.z *= PLAYER.rMax / r; }
    } else if (p.y < -0.25 && r > RAFT.ringR) {
      p.mode = 'fallen';
      p.fart = false;
      ev.push({ type: 'fell' });
      return;
    }
  }
  if (p.grounded) p.airT = 0; else p.airT += dt;

  if (p.mode === 'ok' || p.mode === 'knocked') {
    const wx = raft.x + p.x * ca + p.z * sa, wz = raft.z - p.x * sa + p.z * ca;
    const wy = raft.y + p.y;
    const hit = p.mode === 'ok' ? haz.hitSweeper(wx, wz, wy + 0.05, wy + PLAYER.height, T) : null;
    if (hit) {
      p.mode = 'knocked'; p.knockT = 0; p.grounded = false; p.fart = false;
      const kx = hit.tx * 7 + hit.ox * 2.5, kz = hit.tz * 7 + hit.oz * 2.5;
      p.vx = kx * ca - kz * sa; p.vz = kx * sa + kz * ca;
      p.vy = 5.5;
      ev.push({ type: 'knocked' });
    }
  }
  if (p.mode === 'knocked') p.knockT += dt;

  const hs = Math.hypot(p.vx, p.vz);
  p.speed = p.grounded ? hs : 0;
  p.walkPhase += p.speed * dt * 3.2;
  p.landK *= Math.exp(-dt * 8);
}

export function geyserHop(p, strength) {
  if (p.grounded && p.mode === 'ok') { p.vy = strength; p.grounded = false; }
}
