// Toot Tube: the river. A turtle path of straights and arcs with width, current and drop profiles.

export const DS = 0.5;
export const BANK_H = 2.2;

const SEGMENTS = [
  { len: 34, turn: 0, w: 18, cur: 0.9 },
  { len: 50, turn: 35, w: 16, cur: 1.0 },
  { len: 40, turn: -35, w: 15, cur: 1.2 },
  { len: 16, turn: 0, w: 13, cur: 1.5 },
  { len: 60, turn: -50, w: 13, cur: 1.5 },
  { len: 60, turn: 70, w: 13, cur: 1.6 },
  { len: 18, turn: 0, w: 14, cur: 1.3 },
  { len: 40, turn: 30, w: 15, cur: 1.1 },
  { len: 64, turn: 0, w: 15, cur: 1.1 },
  { len: 40, turn: -55, w: 14, cur: 1.2 },
  { len: 24, turn: 0, w: 30, cur: 0.6 },
  { len: 76, turn: -35, w: 32, cur: 0.5 },
  { len: 30, turn: 25, w: 14, cur: 1.2 },
  { len: 36, turn: 45, w: 10, cur: 3.0 },
  { len: 32, turn: 0, w: 10, cur: 3.4 },
  { len: 28, turn: -30, w: 10, cur: 3.4 },
  { len: 12, turn: 0, w: 11, cur: 4.5, drop: 4.5 },
  { len: 30, turn: 0, w: 20, cur: 1.0 },
  { len: 46, turn: -60, w: 12, cur: 1.2 },
  { len: 56, turn: 0, w: 12, cur: 1.2 },
  { len: 40, turn: 40, w: 13, cur: 1.3 },
  { len: 50, turn: 50, w: 11, cur: 1.7 },
  { len: 50, turn: -70, w: 11, cur: 1.7 },
  { len: 56, turn: 0, w: 12, cur: 1.6 },
  { len: 46, turn: 40, w: 15, cur: 1.3 },
  { len: 76, turn: 0, w: 15, cur: 1.2 },
  { len: 40, turn: -20, w: 24, cur: 0.5 },
];

export const START_S = 10;
export const CHECKPOINTS = [START_S, 122, 276, 420, 550, 688, 830, 986];
export const FINISH_S = 1104;

export const SECTION_NAMES = [
  'Launch Lagoon',
  'Spike Slalom',
  'Sweeper Alley',
  'Whirlpool Lake',
  'Rapids & Falls',
  'Gate Crusher',
  'Canyon Gauntlet',
  'Final Splash',
];

export const HAZARDS = [
  { type: 'sign', s: 16, side: -1, text: 'SPACE\nTO TOOT' },
  { type: 'sign', s: 34, side: 1, text: 'TOOT FROM THE\nBACK TO GO' },
  { type: 'sign', s: 56, side: -1, text: 'A / D SWIM\nAROUND THE RING' },
  { type: 'sign', s: 86, side: 1, text: 'PURPLE SPIKES\n= POP!' },
  { type: 'sign', s: 112, side: -1, text: 'BEANS\nREFILL GAS' },
  { type: 'bean', s: 42, lat: -3 },
  { type: 'bean', s: 62, lat: 4 },
  { type: 'bean', s: 96, lat: 0 },
  { type: 'donut', s: 72, lat: -4 },
  { type: 'donut', s: 100, lat: 4 },
  { type: 'roller', s: 106, a: 7.6, b: 2.8 },

  { type: 'roller', s: 140, a: 6.8, b: 1.0 },
  { type: 'roller', s: 158, a: -6.8, b: -1.0 },
  { type: 'roller', s: 176, a: 6.8, b: 0.6 },
  { type: 'roller', s: 194, a: -6.8, b: -0.6 },
  { type: 'roller', s: 212, a: 6.8, b: 1.0 },
  { type: 'roller', s: 228, a: -6.8, b: -1.4 },
  { type: 'roller', s: 244, a: 6.8, b: 0.2 },
  { type: 'roller', s: 260, a: -6.8, b: -0.4 },
  { type: 'bean', s: 185, lat: 3 },
  { type: 'bean', s: 236, lat: -3 },

  { type: 'sign', s: 284, side: -1, text: 'SWEEPERS!\nS TO DUCK' },
  { type: 'sweeper', s: 300, lat: 0, len: 7.2, w: 1.1, arms: 1, phase: 0 },
  { type: 'roller', s: 315, a: 7.8, b: 4.6 },
  { type: 'sweeper', s: 332, lat: -2.4, len: 6, w: -1.35, arms: 2, phase: 1 },
  { type: 'roller', s: 346, a: -7.8, b: -4.8 },
  { type: 'sweeper', s: 362, lat: 2.4, len: 6, w: 1.55, arms: 2, phase: 2.2 },
  { type: 'roller', s: 380, a: 7.4, b: 4.6 },
  { type: 'sweeper', s: 398, lat: 0, len: 7.4, w: -0.9, arms: 3, phase: 0.5 },
  { type: 'bean', s: 320, lat: 4 },
  { type: 'bean', s: 372, lat: -3 },

  { type: 'sign', s: 428, side: 1, text: 'WHIRLPOOLS\nTOOT OUT!' },
  { type: 'whirl', s: 458, lat: -5, R: 8, str: 1.0 },
  { type: 'whirl', s: 494, lat: 6, R: 9, str: 1.1 },
  { type: 'whirl', s: 526, lat: -2, R: 6.5, str: 1.2 },
  { type: 'buoy', s: 458, lat: -5 },
  { type: 'buoy', s: 494, lat: 6 },
  { type: 'buoy', s: 526, lat: -2 },
  { type: 'buoy', s: 476, lat: 8, orbit: { r: 3, speed: 0.6, phase: 0 } },
  { type: 'buoy', s: 510, lat: -8, orbit: { r: 2.5, speed: -0.7, phase: 2 } },
  { type: 'bean', s: 470, lat: 9 },
  { type: 'bean', s: 505, lat: -6 },
  { type: 'bean', s: 542, lat: 0 },

  { type: 'sign', s: 556, side: 1, text: 'RAPIDS\nHOLD ON' },
  { type: 'donut', s: 576, lat: -2 },
  { type: 'donut', s: 598, lat: 2.4 },
  { type: 'roller', s: 610, a: -5.4, b: -2.6 },
  { type: 'donut', s: 624, lat: 2.2 },
  { type: 'roller', s: 636, a: 5.4, b: 2.8 },
  { type: 'bean', s: 586, lat: 2 },
  { type: 'bean', s: 680, lat: -4 },
  { type: 'bean', s: 680, lat: 4 },

  { type: 'slider', s: 712, len: 3, amp: 3.2, period: 4.2, phase: 0 },
  { type: 'geyser', s: 728, lat: 2.4, period: 5, phase: 0 },
  { type: 'doors', s: 746, period: 5, phase: 0.3 },
  { type: 'geyser', s: 760, lat: -2.4, period: 5, phase: 2.5 },
  { type: 'slider', s: 776, len: 3, amp: 3.2, period: 3.6, phase: 0.5 },
  { type: 'geyser', s: 790, lat: 2, period: 4, phase: 1 },
  { type: 'doors', s: 806, period: 4.2, phase: 0.6 },
  { type: 'bean', s: 735, lat: -3 },
  { type: 'bean', s: 786, lat: -3 },

  { type: 'roller', s: 848, a: 5.8, b: 1.9 },
  { type: 'roller', s: 866, a: -5.8, b: -1.9 },
  { type: 'sweeper', s: 890, lat: 0, len: 6, w: 1.3, arms: 2, phase: 0.7 },
  { type: 'buoy', s: 910, lat: 3.1 },
  { type: 'buoy', s: 922, lat: -3.1 },
  { type: 'slider', s: 940, len: 3, amp: 3.0, period: 3.8, phase: 0.2 },
  { type: 'geyser', s: 955, lat: -2, period: 4.5, phase: 1.5 },
  { type: 'sweeper', s: 970, lat: 1.5, len: 5, w: -1.8, arms: 1, phase: 0 },
  { type: 'bean', s: 900, lat: -3 },
  { type: 'bean', s: 950, lat: 3 },

  { type: 'sweeper', s: 1020, lat: 0, len: 7.6, w: 1.0, arms: 4, phase: 0.3 },
  { type: 'roller', s: 1045, a: 7.8, b: 2.5 },
  { type: 'roller', s: 1060, a: -7.8, b: -2.5 },
  { type: 'doors', s: 1078, period: 4.5, phase: 0 },
  { type: 'slider', s: 1092, len: 5, amp: 3.6, period: 3.4, phase: 0.4 },
  { type: 'bean', s: 1004, lat: -3 },
  { type: 'bean', s: 1070, lat: 3 },
];

const smooth = (t) => t * t * (3 - 2 * t);

export class Track {
  constructor() {
    let total = 0;
    for (const seg of SEGMENTS) total += seg.len;
    this.length = total;
    const n = Math.round(total / DS) + 1;
    this.n = n;
    this.X = new Float32Array(n);
    this.Z = new Float32Array(n);
    this.Y = new Float32Array(n);
    this.TX = new Float32Array(n);
    this.TZ = new Float32Array(n);
    this.HW = new Float32Array(n);
    this.CUR = new Float32Array(n);
    this.SLOPE = new Float32Array(n);
    this.HEAD = new Float32Array(n);

    let x = 0, z = 0, h = -Math.PI / 2, y = 0;
    let prevW = SEGMENTS[0].w, prevC = SEGMENTS[0].cur;
    let i = 0;
    const put = (w, c, yy) => {
      this.X[i] = x; this.Z[i] = z; this.Y[i] = yy; this.HEAD[i] = h;
      this.TX[i] = Math.cos(h); this.TZ[i] = Math.sin(h);
      this.HW[i] = w / 2; this.CUR[i] = c;
      i++;
    };
    put(prevW, prevC, 0);
    for (const seg of SEGMENTS) {
      const steps = Math.round(seg.len / DS);
      const k = (seg.turn * Math.PI / 180) / steps;
      const y0 = y;
      for (let j = 1; j <= steps && i < n; j++) {
        const t = smooth(j / steps);
        h += k;
        x += Math.cos(h - k / 2) * DS;
        z += Math.sin(h - k / 2) * DS;
        const yy = y0 - (seg.drop || 0) * t;
        put(prevW + (seg.w - prevW) * t, prevC + (seg.cur - prevC) * t, yy);
      }
      y = y0 - (seg.drop || 0);
      prevW = seg.w; prevC = seg.cur;
    }
    while (i < n) { put(prevW, prevC, y); }
    for (let j = 0; j < n; j++) {
      const a = Math.max(0, j - 1), b = Math.min(n - 1, j + 1);
      this.SLOPE[j] = (this.Y[b] - this.Y[a]) / ((b - a) * DS);
    }

    this.cell = 16;
    this.grid = new Map();
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let j = 0; j < n; j += 2) {
      const key = this.key(this.X[j], this.Z[j]);
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(j);
      minX = Math.min(minX, this.X[j]); maxX = Math.max(maxX, this.X[j]);
      minZ = Math.min(minZ, this.Z[j]); maxZ = Math.max(maxZ, this.Z[j]);
    }
    this.bounds = { minX, maxX, minZ, maxZ };
    this._out = { i: 0, s: 0, lat: 0, hw: 0, cur: 0, y: 0, tx: 1, tz: 0, slope: 0, d: 0 };
  }

  key(x, z) {
    return Math.floor(x / this.cell) * 73856093 ^ Math.floor(z / this.cell) * 19349663;
  }

  idx(s) {
    return Math.min(this.n - 1.001, Math.max(0, s / DS));
  }

  at(s, out = {}) {
    const f = this.idx(s);
    const i = Math.floor(f), t = f - i, j = Math.min(this.n - 1, i + 1);
    const L = (A) => A[i] + (A[j] - A[i]) * t;
    out.x = L(this.X); out.z = L(this.Z); out.y = L(this.Y);
    let tx = L(this.TX), tz = L(this.TZ);
    const m = Math.hypot(tx, tz) || 1;
    out.tx = tx / m; out.tz = tz / m;
    out.hw = L(this.HW); out.cur = L(this.CUR); out.slope = L(this.SLOPE);
    out.head = Math.atan2(out.tz, out.tx);
    return out;
  }

  toWorld(s, lat, out = {}) {
    const a = this.at(s, out);
    out.x = a.x - a.tz * lat;
    out.z = a.z + a.tx * lat;
    return out;
  }

  nearestIndex(x, z, hint) {
    let best = -1, bd = Infinity;
    if (hint !== undefined && hint !== null && hint >= 0) {
      const lo = Math.max(0, hint - 90), hi = Math.min(this.n - 1, hint + 90);
      for (let j = lo; j <= hi; j++) {
        const dx = x - this.X[j], dz = z - this.Z[j];
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = j; }
      }
      if (best > lo + 2 && best < hi - 2) return best;
    }
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    for (let r = 1; r <= 4 && best < 0; r++) {
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
        const list = this.grid.get(((cx + a) * 73856093) ^ ((cz + b) * 19349663));
        if (!list) continue;
        for (const j of list) {
          const dx = x - this.X[j], dz = z - this.Z[j];
          const d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = j; }
        }
      }
    }
    if (best < 0) {
      for (let j = 0; j < this.n; j += 4) {
        const dx = x - this.X[j], dz = z - this.Z[j];
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = j; }
      }
    }
    const lo = Math.max(0, best - 6), hi = Math.min(this.n - 1, best + 6);
    for (let j = lo; j <= hi; j++) {
      const dx = x - this.X[j], dz = z - this.Z[j];
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }

  locate(x, z, hint, out = this._out) {
    const i = this.nearestIndex(x, z, hint);
    const dx = x - this.X[i], dz = z - this.Z[i];
    const along = dx * this.TX[i] + dz * this.TZ[i];
    const s = Math.min(this.length, Math.max(0, i * DS + along));
    this.at(s, out);
    out.i = i;
    out.s = s;
    out.lat = (x - out.x) * -out.tz + (z - out.z) * out.tx;
    return out;
  }
}
