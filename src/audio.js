// Toot Tube: all sound is synthesized. Farts are a lip-reed pulse model in an AudioWorklet so a toot lasts exactly as long as the key is held.

const WORKLET = `
class Toot extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'gate', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'pitch', defaultValue: 100, minValue: 30, maxValue: 400, automationRate: 'k-rate' },
      { name: 'rough', defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.ph = 0; this.env = 0; this.wan = 0; this.wanT = 0; this.wanN = 0;
    this.jit = 0; this.amp = 1; this.open = 0.35; this.skip = false;
    this.air = 0; this.lastGate = 0; this.held = 0; this.click = 0;
    this.b1 = [0, 0, 0, 0]; this.b2 = [0, 0, 0, 0]; this.lp = 0; this.lp2 = 0; this.hp = 0; this.hpx = 0;
    this.seed = Math.random() * 1e6;
  }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  coefs(f, q) {
    const w = 2 * Math.PI * f / sampleRate, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    return [al / a0, -al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0];
  }
  bp(st, c, x) {
    const y = c[0] * x + c[1] * st[1] - c[2] * st[2] - c[3] * st[3];
    st[1] = st[0]; st[0] = x; st[3] = st[2]; st[2] = y;
    return y;
  }
  process(inputs, outputs, params) {
    const out = outputs[0][0];
    if (!out) return true;
    const gate = params.gate[0], pitch = params.pitch[0], rough = params.rough[0];
    if (gate > 0.5 && this.lastGate <= 0.5) { this.air = 1; this.held = 0; this.click = 1; }
    this.lastGate = gate;
    if (gate < 0.5 && this.env < 0.0005) { out.fill(0); return true; }
    const c1 = this.coefs(Math.min(560, Math.max(210, pitch * 3.1)), 3.2);
    const c2 = this.coefs(Math.min(1300, Math.max(650, pitch * 8.5)), 2.4);
    const lpk = 1 - Math.exp(-2 * Math.PI * 1500 / sampleRate);
    const att = 1 - Math.exp(-1 / (0.012 * sampleRate));
    const rel = 1 - Math.exp(-1 / (0.09 * sampleRate));
    for (let i = 0; i < out.length; i++) {
      this.env += ((gate > 0.5 ? 1 : 0) - this.env) * (gate > 0.5 ? att : rel);
      if (gate > 0.5) this.held += 1 / sampleRate;
      if (--this.wanN <= 0) { this.wanT = (this.rnd() - 0.5) * (0.35 + rough * 0.3); this.wanN = (0.03 + this.rnd() * 0.07) * sampleRate; }
      this.wan += (this.wanT - this.wan) * 0.0009;
      const sag = gate > 0.5 ? 1 + Math.max(0, 0.18 - this.held) * 0.9 : 0.72 + this.env * 0.25;
      const f = pitch * (1 + this.wan) * (1 + this.jit) * sag;
      this.ph += f / sampleRate;
      if (this.ph >= 1) {
        this.ph -= 1;
        this.jit = (this.rnd() - 0.5) * (0.1 + rough * 0.16);
        this.amp = 0.55 + this.rnd() * 0.45;
        this.open = 0.22 + this.rnd() * 0.2 + rough * 0.15;
        this.skip = (gate < 0.5 && this.rnd() < 0.45) || this.rnd() < rough * 0.05;
      }
      let e = 0;
      if (!this.skip && this.ph < this.open) { const s = Math.sin(Math.PI * this.ph / this.open); e = s * s * this.amp; }
      const n = this.rnd() * 2 - 1;
      this.air *= 0.9993;
      this.click *= 0.992;
      const x = e + n * (0.08 + rough * 0.12) * e + n * this.air * 0.25 + n * this.click * 0.4;
      const r1 = this.bp(this.b1, c1, x);
      const r2 = this.bp(this.b2, c2, x);
      this.lp += (x - this.lp) * lpk;
      this.lp2 += (this.lp - this.lp2) * lpk;
      let y = this.lp2 * 0.9 + r1 * 1.6 + r2 * 0.45;
      const hpo = y - this.hpx + 0.995 * this.hp;
      this.hpx = y; this.hp = hpo;
      y = Math.tanh(hpo * 1.4) * this.env * 0.6;
      out[i] = y;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    return true;
  }
}
registerProcessor('toot', Toot);
`;

export class Sound {
  constructor() {
    this.ctx = null;
    this.voices = new Map();
    this.musicOn = true;
    this.muted = false;
    try { this.musicOn = localStorage.getItem('tt-music') !== '0'; this.muted = localStorage.getItem('tt-mute') === '1'; } catch {}
  }

  async init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicOn ? 0.32 : 0; this.musicBus.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    try { await ctx.audioWorklet.addModule(url); this.worklet = true; } catch (e) { console.warn('[audio] worklet failed', e); }
    this.startRiver();
    this.startMusic();
    this.loadSamples();
  }

  async loadSamples() {
    const base = new URL('../assets/audio/', import.meta.url);
    try {
      const man = await (await fetch(new URL('manifest.json', base))).json();
      const get = async (file) => {
        const r = await fetch(new URL(file, base));
        return this.ctx.decodeAudioData(await r.arrayBuffer());
      };
      const jobs = [];
      this.buf = {};
      this.toots = [];
      for (const t of man.toots) jobs.push(get(t.file).then((b) => this.toots.push(b)).catch(() => {}));
      for (const [k, v] of Object.entries({ ...man.sfx, ...man.loops, ...man.music })) jobs.push(get(v.file).then((b) => { this.buf[k] = b; }).catch(() => {}));
      await Promise.all(jobs);
      this.samples = this.toots.length > 3;
      this.startLoops();
      this.startTracks();
    } catch (e) { console.warn('[audio] samples unavailable, using synthesis', e); }
  }

  sample(name, { vol = 1, rate = 1, pan = 0, delay = 0, bus, loop = false } = {}) {
    const b = typeof name === 'string' ? this.buf?.[name] : name;
    if (!b) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.loop = loop;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(g).connect(p).connect(bus || this.sfxBus);
    src.start(ctx.currentTime + delay);
    return { src, g };
  }

  startLoops() {
    if (!this.buf.river) return;
    this.loops = {};
    for (const k of ['river', 'rapids', 'waterfall']) {
      const l = this.sample(k, { vol: 0, loop: true });
      if (l) this.loops[k] = l;
    }
    if (this.river) { this.river.g.gain.value = 0; this.river.hg.gain.value = 0; this.river.off = true; }
  }

  startTracks() {
    if (!this.buf.music_run || !this.buf.music_menu) return;
    clearInterval(this.musicTimer);
    this.tracks = {
      menu: this.sample('music_menu', { vol: 0, loop: true, bus: this.musicBus }),
      run: this.sample('music_run', { vol: 0, loop: true, bus: this.musicBus }),
    };
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.5 : 0, this.ctx.currentTime, 0.2);
    this.setScene(this.scene || 'menu');
  }

  setScene(scene) {
    this.scene = scene;
    if (!this.tracks) return;
    const t = this.ctx.currentTime;
    this.tracks.menu.g.gain.setTargetAtTime(scene === 'menu' ? 0.9 : 0, t, 0.6);
    this.tracks.run.g.gain.setTargetAtTime(scene === 'run' ? 0.75 : 0, t, 0.6);
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('tt-mute', m ? '1' : '0'); } catch {}
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  setMusic(on) {
    this.musicOn = on;
    try { localStorage.setItem('tt-music', on ? '1' : '0'); } catch {}
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? (this.tracks ? 0.5 : 0.32) : 0, this.ctx.currentTime, 0.2);
  }

  voice(id, pitch) {
    if (!this.ctx || !this.worklet) return null;
    let v = this.voices.get(id);
    if (!v) {
      const node = new AudioWorkletNode(this.ctx, 'toot', { numberOfInputs: 0, outputChannelCount: [1] });
      const pan = this.ctx.createStereoPanner();
      const g = this.ctx.createGain();
      g.gain.value = 0.9;
      node.connect(g).connect(pan).connect(this.sfxBus);
      v = { node, pan, g, gate: 0, pitch, rough: 0.3 + Math.random() * 0.4 };
      node.parameters.get('pitch').value = pitch;
      node.parameters.get('rough').value = v.rough;
      this.voices.set(id, v);
    }
    return v;
  }

  sampleVoice(id, pitch, on, pan, vol) {
    const ctx = this.ctx;
    this.svoices ||= new Map();
    let v = this.svoices.get(id);
    if (!v) {
      const g = ctx.createGain();
      g.gain.value = 0;
      const p = ctx.createStereoPanner();
      g.connect(p).connect(this.sfxBus);
      v = { g, p, on: false, src: null, old: null, endAt: 0, last: -1 };
      this.svoices.set(id, v);
    }
    const t = ctx.currentTime;
    if (on && !v.on) {
      v.on = true;
      if (v.old) { try { v.old.stop(); } catch {} v.old = null; }
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(0.0001, t);
      v.g.gain.linearRampToValueAtTime(0.95 * vol, t + 0.012);
      this.nextToot(v, pitch, t);
      this.sample('bubbles', { vol: 0.32, rate: 0.85 + Math.random() * 0.3, pan });
    } else if (on && t > v.endAt - 0.04) {
      this.nextToot(v, pitch, t);
    } else if (!on && v.on) {
      v.on = false;
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(v.g.gain.value, t);
      v.g.gain.setTargetAtTime(0, t + 0.07, 0.06);
      v.old = v.src;
      if (v.src) v.src.stop(t + 0.7);
      v.src = null;
    }
    v.p.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, pan)), t, 0.05);
  }

  nextToot(v, pitch, t) {
    const n = this.toots.length;
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === v.last) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    v.last = i;
    const src = this.ctx.createBufferSource();
    src.buffer = this.toots[i];
    src.playbackRate.value = (pitch / 110) * (0.93 + Math.random() * 0.14);
    src.connect(v.g);
    src.start(t);
    if (v.src) { try { v.src.stop(t + 0.03); } catch {} }
    v.src = src;
    v.endAt = t + src.buffer.duration / src.playbackRate.value;
  }

  setVoice(id, pitch, on, pan = 0, vol = 1, gasLeft = 1) {
    if (this.samples) { this.sampleVoice(id, pitch, on, pan, vol); return; }
    const v = this.voice(id, pitch);
    if (!v) return;
    const t = this.ctx.currentTime;
    if (on !== v.gate) {
      v.gate = on;
      v.node.parameters.get('gate').setValueAtTime(on ? 1 : 0, t);
      if (on) {
        v.rough = Math.min(1, 0.25 + Math.random() * 0.5);
        v.node.parameters.get('rough').setValueAtTime(v.rough, t);
        v.node.parameters.get('pitch').setValueAtTime(pitch * (0.9 + Math.random() * 0.22), t);
      }
    }
    if (on) v.node.parameters.get('pitch').setTargetAtTime(pitch * (0.85 + gasLeft * 0.25), t, 0.3);
    v.pan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, pan)), t, 0.05);
    v.g.gain.setTargetAtTime(0.9 * vol, t, 0.05);
  }

  dropVoice(id) {
    const sv = this.svoices?.get(id);
    if (sv) { try { sv.src?.stop(); sv.old?.stop(); } catch {} sv.g.disconnect(); this.svoices.delete(id); }
    const v = this.voices.get(id);
    if (!v) return;
    v.node.disconnect(); v.g.disconnect(); v.pan.disconnect();
    this.voices.delete(id);
  }

  silenceAll() {
    for (const [id] of this.voices) this.setVoice(id, 100, false);
    if (this.svoices) for (const [id] of this.svoices) this.sampleVoice(id, 100, false, 0, 1);
  }

  noise(t, dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, vol = 0.5, attack = 0.005, pan = 0, bus } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(bus || this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  tone(t, dur, { type = 'sine', f0 = 440, f1 = f0, vol = 0.3, attack = 0.004, pan = 0, bus, curve = 'exp' } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      else o.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    o.connect(g).connect(p).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  play(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005;
    const pan = o.pan || 0;
    const v = o.vol ?? 1;
    if (this.samples && this.playSample(name, o, pan, v)) return;
    switch (name) {
      case 'jump':
        this.tone(t, 0.16, { type: 'sine', f0: 260, f1: 620, vol: 0.18 * v, pan });
        this.tone(t + 0.02, 0.12, { type: 'triangle', f0: 520, f1: 900, vol: 0.05 * v, pan });
        break;
      case 'land':
        this.tone(t, 0.12, { f0: 140, f1: 60, vol: 0.25 * v * (o.mag || 1), pan });
        this.noise(t, 0.08, { type: 'lowpass', f0: 900, f1: 300, vol: 0.12 * v, pan });
        break;
      case 'bump': {
        const m = Math.min(1.5, o.mag || 1);
        this.tone(t, 0.22, { type: 'triangle', f0: 170, f1: 105, vol: 0.32 * m * v, pan });
        this.tone(t, 0.14, { type: 'sine', f0: 90, f1: 55, vol: 0.4 * m * v, pan });
        this.noise(t, 0.25, { type: 'bandpass', f0: 1400, f1: 500, q: 1.2, vol: 0.3 * m * v, pan });
        break;
      }
      case 'boing':
        this.tone(t, 0.42, { type: 'sine', f0: 190, f1: 420, vol: 0.32 * v, pan, curve: 'lin' });
        this.tone(t, 0.42, { type: 'triangle', f0: 380, f1: 840, vol: 0.06 * v, pan, curve: 'lin' });
        break;
      case 'splash':
        this.noise(t, 0.9, { type: 'lowpass', f0: 4200, f1: 300, q: 0.7, vol: 0.55 * v, attack: 0.01, pan });
        this.noise(t, 0.35, { type: 'highpass', f0: 2500, f1: 1200, vol: 0.25 * v, pan });
        for (let i = 0; i < 7; i++) {
          const tt = t + 0.12 + Math.random() * 0.6;
          const f = 380 + Math.random() * 700;
          this.tone(tt, 0.08, { type: 'sine', f0: f, f1: f * 1.9, vol: 0.06 * v, pan });
        }
        break;
      case 'pop':
        this.noise(t, 0.08, { type: 'lowpass', f0: 3000, f1: 400, vol: 0.9 * v, attack: 0.001 });
        this.tone(t, 0.18, { f0: 120, f1: 40, vol: 0.6 * v });
        this.noise(t + 0.04, 1.3, { type: 'highpass', f0: 5200, f1: 2000, q: 0.8, vol: 0.38 * v, attack: 0.02 });
        this.tone(t + 0.05, 1.1, { type: 'sawtooth', f0: 900, f1: 180, vol: 0.05 * v });
        break;
      case 'knock':
        this.tone(t, 0.1, { type: 'square', f0: 220, f1: 110, vol: 0.12 * v, pan });
        this.noise(t, 0.12, { type: 'bandpass', f0: 800, f1: 400, q: 2, vol: 0.4 * v, pan });
        this.tone(t + 0.08, 0.7, { type: 'sine', f0: 1500, f1: 300, vol: 0.12 * v, pan });
        break;
      case 'bean':
        this.noise(t, 0.12, { type: 'highpass', f0: 6000, f1: 4000, vol: 0.3 * v });
        this.tone(t + 0.08, 0.14, { type: 'sine', f0: 520, f1: 780, vol: 0.2 * v });
        this.tone(t + 0.17, 0.2, { type: 'sine', f0: 780, f1: 1170, vol: 0.18 * v });
        break;
      case 'empty':
        this.noise(t, 0.09, { type: 'bandpass', f0: 1800, f1: 900, q: 3, vol: 0.18 * v, pan });
        break;
      case 'checkpoint': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, i) => {
          this.tone(t + i * 0.09, 0.5, { type: 'triangle', f0: f, vol: 0.2 * v });
          this.tone(t + i * 0.09, 0.3, { type: 'sine', f0: f * 2, vol: 0.05 * v });
        });
        this.noise(t + 0.3, 0.6, { type: 'highpass', f0: 7000, f1: 9000, vol: 0.06 * v });
        break;
      }
      case 'finish': {
        const seq = [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [1046.5, 0.36], [783.99, 0.6], [1046.5, 0.72], [1318.5, 0.84]];
        seq.forEach(([f, d]) => {
          this.tone(t + d, 0.6, { type: 'triangle', f0: f, vol: 0.2 * v });
          this.tone(t + d, 0.4, { type: 'square', f0: f / 2, vol: 0.03 * v });
        });
        break;
      }
      case 'beep':
        this.tone(t, 0.18, { type: 'triangle', f0: o.go ? 988 : 659, vol: 0.25 * v });
        break;
      case 'click':
        this.tone(t, 0.05, { type: 'triangle', f0: 1200, f1: 700, vol: 0.08 * v });
        break;
      case 'geyser':
        this.noise(t, 1.1, { type: 'bandpass', f0: 500, f1: 2400, q: 0.8, vol: 0.28 * v, attack: 0.1, pan });
        break;
      case 'barrier':
        this.tone(t, 0.12, { type: 'triangle', f0: 260, f1: 180, vol: 0.12 * v, pan });
        this.noise(t, 0.08, { type: 'bandpass', f0: 900, q: 2, vol: 0.08 * v, pan });
        break;
      case 'blub':
        this.noise(t, 0.3, { type: 'lowpass', f0: 1800, f1: 300, vol: 0.25 * v, pan });
        for (let i = 0; i < 4; i++) {
          const f = 220 + Math.random() * 260;
          this.tone(t + i * 0.05 + Math.random() * 0.03, 0.09, { type: 'sine', f0: f, f1: f * 2.2, vol: 0.12 * v, pan });
        }
        break;
      case 'surface':
        this.noise(t, 0.35, { type: 'bandpass', f0: 2600, f1: 900, q: 0.8, vol: 0.18 * v, pan });
        break;
      case 'bubble': {
        const f = 300 + Math.random() * 500;
        this.tone(t, 0.06 + Math.random() * 0.04, { type: 'sine', f0: f, f1: f * (1.8 + Math.random()), vol: (0.03 + Math.random() * 0.04) * v, pan: (Math.random() - 0.5) * 0.6 });
        break;
      }
      case 'whoosh':
        this.noise(t, 0.35, { type: 'bandpass', f0: 600, f1: 1600, q: 1.5, vol: 0.18 * v, attack: 0.08, pan });
        break;
      case 'wipe':
        this.tone(t, 0.6, { type: 'triangle', f0: 392, f1: 196, vol: 0.14 * v, curve: 'lin' });
        this.tone(t + 0.25, 0.7, { type: 'triangle', f0: 330, f1: 147, vol: 0.12 * v, curve: 'lin' });
        break;
    }
  }

  playSample(name, o, pan, v) {
    const S = (n, opt = {}) => this.sample(n, { pan, ...opt });
    const r = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'bump': {
        const m = Math.min(1.5, o.mag || 1);
        S(`bump${1 + Math.floor(Math.random() * 3)}`, { vol: 0.75 * m * v, rate: r(0.8, 1.05) });
        S('splash_mid', { vol: 0.45 * m * v, rate: r(0.9, 1.15) });
        return true;
      }
      case 'boing': S('boing2', { vol: 0.8 * v, rate: r(0.9, 1.1) }); S('splash_mid', { vol: 0.3 * v }); return true;
      case 'splash': S('splash_big', { vol: 1.8 * v, rate: r(0.92, 1.05) }); S('splash_mid', { vol: 0.8 * v, delay: 0.05 }); return true;
      case 'pop': S('pop', { vol: 1.0 * v }); S('deflate', { vol: 0.8 * v, delay: 0.06 }); S('hiss', { vol: 0.4 * v, delay: 0.1 }); return true;
      case 'knock': S('knock', { vol: 0.9 * v }); return true;
      case 'bean': S('can', { vol: 0.8 * v }); S('powerup', { vol: 0.45 * v, delay: 0.12 }); return true;
      case 'checkpoint': S('checkpoint', { vol: 0.9 * v }); return true;
      case 'finish': S('finish', { vol: 1.0 * v }); S('checkpoint', { vol: 0.6 * v, delay: 1.4 }); return true;
      case 'beep': S(o.go ? 'go' : 'tick', { vol: (o.go ? 0.8 : 0.55) * v }); return true;
      case 'click': S('click', { vol: 0.6 * v }); return true;
      case 'geyser': S('geyser', { vol: 0.7 * v, rate: r(0.95, 1.08) }); return true;
      case 'wipe': S('sad', { vol: 0.55 * v }); return true;
      case 'barrier': S('barrier', { vol: 0.6 * v, rate: r(0.9, 1.1) }); return true;
      case 'blub': S('splash_dive', { vol: 0.7 * v, rate: r(0.95, 1.1) }); S('bubbles_small', { vol: 0.4 * v, delay: 0.08 }); return true;
      case 'surface': S('splash_tiny', { vol: 0.7 * v, rate: r(0.95, 1.15) }); return true;
      case 'bubble': {
        const t = this.ctx.currentTime;
        if (t - (this.lastBubble || 0) < 0.45) return true;
        this.lastBubble = t;
        S('bubbles_small', { vol: 0.22 * v, rate: r(0.8, 1.3), pan: (Math.random() - 0.5) * 0.6 });
        return true;
      }
    }
    return false;
  }

  startRiver() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b = 0;
      for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
      const fadeN = 2000;
      for (let i = 0; i < fadeN; i++) { const k = i / fadeN; d[i] = d[i] * k + d[len - fadeN + i] * (1 - k); }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.loopEnd = (len - 2000) / ctx.sampleRate;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0.25;
    src.connect(lp).connect(g).connect(this.sfxBus);
    src.start();
    const hi = ctx.createBufferSource();
    hi.buffer = this.noiseBuf; hi.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
    const hg = ctx.createGain(); hg.gain.value = 0.0;
    hi.connect(bp).connect(hg).connect(this.sfxBus);
    hi.start();
    this.river = { lp, g, hg };
  }

  setRiver(cur, fall, near) {
    if (!this.river) return;
    const t = this.ctx.currentTime;
    if (this.loops) {
      const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
      this.loops.river?.g.gain.setTargetAtTime(0.45 + Math.min(1, cur / 3) * 0.25, t, 0.5);
      this.loops.rapids?.g.gain.setTargetAtTime(sm(2.0, 3.4, cur) * 0.85, t, 0.5);
      this.loops.waterfall?.g.gain.setTargetAtTime(fall * 1.1, t, 0.5);
      return;
    }
    const k = Math.min(1, cur / 4);
    this.river.g.gain.setTargetAtTime(0.16 + k * 0.25 + fall * 0.4, t, 0.4);
    this.river.lp.frequency.setTargetAtTime(500 + k * 900 + fall * 1500, t, 0.4);
    this.river.hg.gain.setTargetAtTime(Math.max(0, k - 0.5) * 0.08 + fall * 0.12 + near * 0.03, t, 0.4);
  }

  startMusic() {
    const ctx = this.ctx;
    const bpm = 104, beat = 60 / bpm, step = beat / 2;
    const chords = [
      [65.41, [261.63, 329.63, 392.0]],
      [98.0, [246.94, 293.66, 392.0]],
      [110.0, [261.63, 329.63, 440.0]],
      [87.31, [261.63, 349.23, 440.0]],
    ];
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    let next = ctx.currentTime + 0.2, n = 0;
    let mel = 0;
    const tick = () => {
      if (!this.ctx) return;
      while (next < ctx.currentTime + 0.25) {
        const bar = Math.floor(n / 8) % 4, s = n % 8;
        const [root, ch] = chords[bar];
        const b = this.musicBus;
        if (s === 0 || s === 3 || s === 4 || s === 6) {
          const f = s === 6 ? root * 1.5 : root;
          this.tone(next, step * 1.6, { type: 'triangle', f0: f, vol: 0.32, bus: b });
          this.tone(next, step * 1.2, { type: 'sine', f0: f * 2, vol: 0.12, bus: b });
        }
        if (s % 2 === 1 || s === 2) {
          for (const f of ch) {
            this.tone(next, 0.25, { type: 'sine', f0: f, vol: 0.06, bus: b });
            this.tone(next, 0.08, { type: 'sine', f0: f * 4, vol: 0.015, bus: b });
          }
        }
        this.noise(next, 0.05, { type: 'highpass', f0: 8000, vol: s % 2 ? 0.05 : 0.025, bus: b });
        if (s === 2 || s === 6) this.noise(next, 0.09, { type: 'bandpass', f0: 1800, q: 0.8, vol: 0.06, bus: b });
        const phrase = Math.floor(n / 32) % 2;
        if (phrase === 1 && (s === 0 || s === 3 || s === 5) && Math.random() < 0.8) {
          mel = Math.max(0, Math.min(scale.length - 1, mel + Math.floor(Math.random() * 3) - 1));
          const f = scale[mel];
          this.tone(next, 0.35, { type: 'sine', f0: f, vol: 0.07, bus: b });
          this.tone(next, 0.12, { type: 'sine', f0: f * 3.01, vol: 0.02, bus: b });
        }
        next += step; n++;
      }
    };
    this.musicTimer = setInterval(tick, 60);
    tick();
  }
}
