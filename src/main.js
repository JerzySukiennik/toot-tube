// Toot Tube: boot, game loop, run flow (countdown, wipes, checkpoints, finish), camera, input, menu and HUD.

import * as THREE from 'three';
import { Track, CHECKPOINTS, FINISH_S, START_S, SECTION_NAMES } from './track.js';
import { Hazards, makeRaft, stepRaft, makePlayer, resetPlayer, stepPlayer, setSector } from './sim.js';
import { RAFT, PHYS, THRUST_MULT, NET, ANIMALS, ANIMAL_INFO, SLOT_COLORS, GAS, PLAYER } from './config.js';
import { buildWorld } from './world.js';
import { HazardViews } from './hazards3d.js';
import { Animal, RaftView } from './actors.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';
import { SoloNet, RoomNet, connectFirebase, sampleRemote, submitScore, fetchScores } from './net.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const NAMES = ['Bubbles', 'Puff', 'Rumble', 'Squeak', 'Breezy', 'Gusty', 'Pip', 'Wobble', 'Biscuit', 'Noodle'];
const TIPS = [
  'Toot from the back of the ring to go forward',
  'Thread the gaps between the spikes',
  'Duck with S when a bar sweeps over you',
  'Whirlpools spin the ring. Toot your way out',
  'Rapids ahead. Steer clear of the spikes',
  'Wait for the gates to open, then go',
  'Everything at once. Good luck',
  'Last stretch to the finish!',
];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function loadProfile() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('tt-profile') || '{}'); } catch {}
  if (!p.name) p.name = NAMES[(Math.random() * NAMES.length) | 0] + ((Math.random() * 90 + 10) | 0);
  if (!ANIMALS.includes(p.animal)) p.animal = ANIMALS[(Math.random() * ANIMALS.length) | 0];
  return p;
}
function saveProfile() {
  try { localStorage.setItem('tt-profile', JSON.stringify(G.profile)); } catch {}
}

const G = {
  mode: 'boot',
  profile: loadProfile(),
  net: null,
  raft: null,
  me: makePlayer(0, 1),
  meView: null,
  remotes: new Map(),
  runId: -1,
  wipeSeen: 0,
  cpSeen: 0,
  wiping: null,
  paused: false,
  pauseAt: 0,
  stats: { toots: 0 },
  scores: [],
  lastSend: 0,
  lastRaftSend: 0,
  corr: { x: 0, z: 0, a: 0, vx: 0, vz: 0, w: 0 },
  shake: 0,
  lastCount: null,
  doneShown: -1,
  geyserHit: new Map(),
  fallT: 0,
  T: 0,
  bubbleT: 0,
};
window.__tt = G;

const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 340);
const sound = new Sound();

let track, haz, world, hazViews, fx, raftView;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (fx) fx.setView(camera, renderer);
}
window.addEventListener('resize', resize);

const keys = new Set();
const pressed = new Set();
function typing() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
}
window.addEventListener('keydown', (e) => {
  if (typing()) return;
  if (e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyM') { sound.setMusic(!sound.musicOn); syncSoundButtons(); toast(sound.musicOn ? 'Music on' : 'Music off'); return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); });
window.addEventListener('blur', () => keys.clear());

const cam = { yaw: 0, yawOff: 0, dist: 11, height: 6.6, touched: 99, turn: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false };
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX }; cam.touched = 0; });
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  cam.yawOff -= (e.clientX - drag.x) * 0.006;
  drag.x = e.clientX;
  cam.touched = 0;
});
window.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(7, Math.min(15, cam.dist + e.deltaY * 0.01)); }, { passive: true });

function readInput() {
  const ctl = (G.mode === 'run' || G.mode === 'lobby' || G.mode === 'done') && !G.paused && $('pause').classList.contains('hidden') && !typing();
  const k = (c) => keys.has(c);
  cam.turn = ctl ? (k('KeyQ') ? 1 : 0) - (k('KeyE') ? 1 : 0) : 0;
  return {
    active: ctl,
    lr: (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0),
    duck: k('KeyS') || k('ArrowDown'),
    fart: k('Space') || k('ShiftLeft') || k('ShiftRight'),
    fartPressed: pressed.has('Space') || pressed.has('ShiftLeft') || pressed.has('ShiftRight'),
  };
}

function playerCount() { return Math.max(1, G.net ? G.net.players.size : 1); }
function slotOf(id) { const p = G.net?.players.get(id); return p ? p.slot : 0; }
function mySlot() { return slotOf(G.net?.selfId); }

function applySectors() {
  const n = playerCount();
  setSector(G.me, mySlot(), n);
  raftView.setSectors(n <= 1 ? [1] : SLOT_COLORS.slice(0, n));
}

function setRemoteView(id, info) {
  let r = G.remotes.get(id);
  if (r && r.animal !== info.animal) { raftView.deck.remove(r.view.root); r = null; }
  if (!r) {
    const view = new Animal(info.animal);
    raftView.deck.add(view.root);
    r = { animal: info.animal, view, st: null, wasFallen: false, dir: 0 };
    G.remotes.set(id, r);
  }
  r.view.setTag(info.name, SLOT_COLORS[info.slot % 3]);
  r.name = info.name;
  r.slot = info.slot;
}

function syncRemotes() {
  const net = G.net;
  const ids = new Set();
  if (net && !net.solo) {
    for (const [id, p] of net.players) {
      if (id === net.selfId) continue;
      ids.add(id);
      setRemoteView(id, p);
    }
  }
  for (const [id, r] of G.remotes) {
    if (!ids.has(id)) { raftView.deck.remove(r.view.root); sound.dropVoice(id); G.remotes.delete(id); }
  }
  if (G.meView) {
    if (net && !net.solo) G.meView.setTag(G.profile.name, SLOT_COLORS[mySlot() % 3]);
    else if (G.meView.tag) { G.meView.root.remove(G.meView.tag); G.meView.tag = null; }
  }
  applySectors();
  if (G.mode === 'lobby') renderLobby();
}

function setMyAnimal(kind) {
  if (G.meView) raftView.deck.remove(G.meView.root);
  G.meView = new Animal(kind);
  raftView.deck.add(G.meView.root);
}

function bindNet(net) {
  G.net = net;
  net.on('players', () => syncRemotes());
  net.on('meta', (m) => onMeta(m));
  net.on('raft', (r) => onRaftSnap(r));
  net.on('closed', () => { toast('The room was closed.', true); backToMenu(); });
  net.on('error', (e) => console.warn('[net]', e));
}

function newRun(extra = {}) {
  const net = G.net;
  const now = net.serverNow();
  net.setMeta({ phase: 'run', run: (net.meta.run || 0) + 1, t0: now + 3400, cp: 0, wipe: 0, wcp: 0, wt: 0, why: '', n: playerCount(), ...extra });
}

function onMeta(m) {
  if (m.phase === 'run' || m.phase === 'done') {
    if (m.run !== G.runId) enterRun(m);
  } else if (m.phase === 'lobby' && G.mode !== 'lobby' && G.mode !== 'menu' && !G.net.solo) {
    showScreen('lobby');
    G.mode = 'lobby';
  }
  if ((m.wipe || 0) > G.wipeSeen) { G.wipeSeen = m.wipe; beginWipe(m); }
  if ((m.cp || 0) > G.cpSeen) {
    for (let c = G.cpSeen + 1; c <= m.cp; c++) celebrate(c, c === m.cp);
    G.cpSeen = m.cp;
  }
  if (m.phase === 'done' && G.doneShown !== m.run) { G.doneShown = m.run; finishRun(m); }
}

function enterRun(m) {
  G.runId = m.run;
  G.mode = m.phase === 'done' ? 'done' : 'run';
  G.wipeSeen = m.wipe || 0;
  G.cpSeen = m.cp || 0;
  G.wiping = null;
  G.lastCount = null;
  G.stats = { toots: 0 };
  G.raft = makeRaft(track, CHECKPOINTS[m.cp || 0]);
  Object.assign(G.corr, { x: 0, z: 0, a: 0, vx: 0, vz: 0, w: 0 });
  resetPlayer(G.me, mySlot(), playerCount());
  raftView.deflate = 0;
  cam.yawOff = 0;
  cam.init = false;
  showScreen(null);
  $('hud').classList.remove('hidden');
  $('big').className = 'big';
  buildTicks();
}

function onRaftSnap(r) {
  if (G.mode !== 'run' || G.wiping || !G.raft) return;
  const now = G.net.serverNow();
  if (now < (G.net.meta.t0 || 0)) return;
  const lag = Math.max(0, Math.min(0.5, (now - r.t) / 1000));
  const px = r.x + r.vx * lag, pz = r.z + r.vz * lag, pa = r.a + r.w * lag;
  const R = G.raft;
  const ex = px - R.x, ez = pz - R.z;
  const ea = wrap(pa - R.a);
  if (Math.hypot(ex, ez) > 4 || Math.abs(ea) > 1.5) {
    R.x = px; R.z = pz; R.a = pa; R.vx = r.vx; R.vz = r.vz; R.w = r.w;
    R.hint = undefined;
    Object.assign(G.corr, { x: 0, z: 0, a: 0, vx: 0, vz: 0, w: 0 });
    return;
  }
  Object.assign(G.corr, { x: ex, z: ez, a: ea, vx: r.vx - R.vx, vz: r.vz - R.vz, w: r.w - R.w });
}

function triggerWipe(why) {
  if (G.wiping || G.mode !== 'run' || G.godmode) return;
  const net = G.net;
  net.setMeta({ wipe: (net.meta.wipe || 0) + 1, wcp: net.meta.cp || 0, why: String(why).slice(0, 60), wt: net.serverNow() });
}

function beginWipe(m) {
  G.wiping = { wt: m.wt || G.net.serverNow(), why: m.why || '', cp: m.wcp || 0, reset: false, popped: false };
  G.me.fart = false;
  sound.play('wipe');
  if ((m.why || '').startsWith('spikes')) {
    sound.play('pop');
    G.wiping.popped = true;
    G.shake = Math.max(G.shake, 0.6);
    showBig('POP!', '', 'Spikes got the ring');
  } else {
    const who = (m.why || '').split(':')[1] || 'Someone';
    showBig('SPLASH!', '', `${who} got swept away`);
  }
}

function updateWipe(dt, now) {
  const w = G.wiping;
  if (!w) { $('iris').style.clipPath = 'circle(0% at 50% 50%)'; return; }
  const t = (now - w.wt) / 1000;
  if (w.popped) {
    raftView.deflate = Math.min(1, raftView.deflate + dt * 1.4);
    if (t < 1.1 && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      const R = G.raft;
      fx.hiss(R.x + Math.cos(a) * RAFT.ringR, R.y + 0.4, R.z + Math.sin(a) * RAFT.ringR, Math.cos(a), Math.sin(a));
    }
  }
  const ss = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const cover = ss(1.35, 1.85, t) - ss(2.05, 2.55, t);
  $('iris').style.clipPath = `circle(${(cover * 75).toFixed(2)}% at 50% 50%)`;
  if (t >= 1.9 && !w.reset) {
    w.reset = true;
    const cp = Math.min(w.cp, CHECKPOINTS.length - 1);
    G.raft = makeRaft(track, CHECKPOINTS[cp]);
    Object.assign(G.corr, { x: 0, z: 0, a: 0, vx: 0, vz: 0, w: 0 });
    resetPlayer(G.me, mySlot(), playerCount());
    raftView.deflate = 0;
    cam.init = false;
    cam.yawOff = 0;
    sound.silenceAll();
  }
  if (t >= 2.55) G.wiping = null;
}

function celebrate(c, popup) {
  const arch = world.arches.find((a) => a.kind === 'cp' && a.index === c);
  const f = track.at(CHECKPOINTS[c], {});
  if (arch) arch.hit();
  fx.confetti(f.x, f.y + 6, f.z);
  fx.confetti(f.x - f.tz * f.hw * 0.7, f.y + 8, f.z + f.tx * f.hw * 0.7);
  fx.confetti(f.x + f.tz * f.hw * 0.7, f.y + 8, f.z - f.tx * f.hw * 0.7);
  if (!popup) return;
  sound.play('checkpoint');
  showBig(`CHECKPOINT ${c}`, 'cp', `${c} of ${CHECKPOINTS.length - 1} · ${SECTION_NAMES[c] || ''}`, TIPS[c]);
  buildTicks();
}

function fmtTime(ms) {
  ms = Math.max(0, ms);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), d = Math.floor((ms % 1000) / 100);
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
}

function finishRun(m) {
  const fin = m.fin || G.net.serverNow();
  const ms = fin - (m.t0 || fin);
  sound.play('finish');
  const arch = world.arches.find((a) => a.kind === 'finish');
  if (arch) arch.hit();
  const f = track.at(FINISH_S, {});
  fx.confetti(f.x, f.y + 6, f.z);
  fx.confetti(f.x, f.y + 9, f.z);
  showBig('FINISH!', 'go', fmtTime(ms));
  G.mode = 'done';
  buildTicks();
  if (G.net.isHost && ms > 60000) {
    const names = [...G.net.players.values()].sort((a, b) => a.slot - b.slot).map((p) => p.name).join(', ');
    submitScore({ names: names.slice(0, 60), n: Math.min(3, Math.max(1, m.n || playerCount())), ms: Math.round(ms), wipes: m.wipe || 0, at: Date.now() })
      .catch((e) => console.warn('[scores] submit failed', e?.message))
      .finally(() => setTimeout(() => refreshScores(), 600));
  } else setTimeout(() => refreshScores(), 1500);
  setTimeout(() => {
    if (G.mode !== 'done' || G.doneShown !== m.run) return;
    $('res-time').textContent = fmtTime(ms);
    $('res-stats').innerHTML = `<span><b>${m.wipe || 0}</b> wipes</span><span><b>${G.stats.toots}</b> toots by you</span><span><b>${m.n || playerCount()}</b> on the ring</span>`;
    $('btn-again').classList.toggle('hidden', !G.net.isHost);
    $('res-wait').classList.toggle('hidden', G.net.isHost);
    renderScoreList($('res-scores'), m.n || playerCount(), ms);
    showScreen('results');
  }, 2800);
}

function stepSim(dt, inp, now) {
  const net = G.net;
  const R = G.raft;
  const running = G.mode === 'run' || G.mode === 'done';
  const t0 = net.meta.t0 || 0;
  const live = running && now >= t0 && !G.wiping && !G.paused;
  G.T = running ? (now - t0) / 1000 + 100 : performance.now() / 1000;

  if (!net.isHost && running) {
    const k = 1 - Math.exp(-dt * 5);
    const c = G.corr;
    R.x += c.x * k; R.z += c.z * k; R.a += c.a * k; R.vx += c.vx * k; R.vz += c.vz * k; R.w += c.w * k;
    c.x -= c.x * k; c.z -= c.z * k; c.a -= c.a * k; c.vx -= c.vx * k; c.vz -= c.vz * k; c.w -= c.w * k;
  }

  const ev = [];
  const inputs = [];
  const rnow = now - NET.interpDelay;
  for (const [id, r] of G.remotes) {
    r.st = sampleRemote(net.remote.get(id), rnow);
    if (r.st) inputs.push({ lx: r.st.x, lz: r.st.z, f: r.st.f, fart: !!(r.st.m & 2), onRaft: !(r.st.m & 28) });
  }

  const frozen = !!G.wiping || G.paused || G.mode === 'menu';
  if (!live) { R.dvx = 0; R.dvz = 0; R.w = live ? R.w : R.w * 0.9; }
  stepPlayer(G.me, frozen ? { active: false } : inp, R, haz, G.T, dt, ev);
  inputs.push({ lx: G.me.x, lz: G.me.z, f: G.me.f, fart: G.me.fart, onRaft: G.me.mode === 'ok' && G.me.duckK < 0.5 });

  if (live) {
    stepRaft(R, track, haz, G.T, inputs, THRUST_MULT[Math.min(3, playerCount())], dt, ev);
  } else {
    const L = track.locate(R.x, R.z, R.hint);
    R.y = L.y; R.s = L.s; R.hint = L.i; R.tx = L.tx; R.tz = L.tz; R.slope = L.slope; R.cur = L.cur;
  }

  for (const e of ev) handleEvent(e);

  if (live && net.isHost) {
    const cp = net.meta.cp || 0;
    if (cp + 1 < CHECKPOINTS.length && R.s > CHECKPOINTS[cp + 1]) net.setMeta({ cp: cp + 1 });
    if (G.mode === 'run' && R.s > FINISH_S) net.setMeta({ phase: 'done', fin: now, n: playerCount() });
  }

  if (live) {
    const tnow = performance.now() / 1000;
    for (const b of hazViews.beans) {
      const h = b.h;
      if (tnow - h.taken > 25 && Math.hypot(R.x - h.x, R.z - h.z) < RAFT.R + 0.5) {
        h.taken = tnow;
        G.me.gas = Math.min(1, G.me.gas + GAS.bean);
        sound.play('bean');
        flashGas();
        fx.splash(h.x, h.wy, h.z, 10, 2.5, 1.5);
      }
    }
  }
  if (G.me.mode === 'fallen') {
    G.fallT += dt;
    if (G.mode === 'lobby' || G.mode === 'menu' || (running && now < t0)) {
      if (G.fallT > 1.2) resetPlayer(G.me, mySlot(), playerCount());
    } else if (G.mode === 'run' && G.fallT > 0.35 && !G.wiping) {
      triggerWipe(`fell:${G.profile.name}`);
    }
  } else G.fallT = 0;
}

function handleEvent(e) {
  const R = G.raft;
  switch (e.type) {
    case 'bump':
      sound.play(e.donut ? 'boing' : 'bump', { mag: Math.min(1.5, e.mag / 2.5) });
      fx.splash(e.x, e.y, e.z, Math.round(6 + e.mag * 6), 2 + e.mag, 1.6);
      G.shake = Math.max(G.shake, Math.min(0.5, e.mag * 0.12));
      if (e.donut) hazViews.bumpDonut(e.x, e.z);
      break;
    case 'pop':
      if (G.net.isHost) triggerWipe('spikes');
      break;
    case 'geyser': {
      const last = G.geyserHit.get(e.h) || 0;
      if (G.T - last > 2) { G.geyserHit.set(e.h, G.T); sound.play('geyser'); G.shake = Math.max(G.shake, 0.3); }
      break;
    }
    case 'barrier': sound.play('barrier'); break;
    case 'duck': {
      sound.play('blub');
      const w = worldOf(G.me);
      fx.splash(w.x, R.y, w.z, 8, 2, 1.2);
      break;
    }
    case 'surface': sound.play('surface'); break;
    case 'fartStart': G.stats.toots++; break;
    case 'fartEmpty': sound.play('empty'); break;
    case 'knocked': sound.play('knock'); G.shake = Math.max(G.shake, 0.4); break;
    case 'fell': {
      const w = worldOf(G.me);
      fx.splash(w.x, R.y, w.z, 40, 5, 3);
      sound.play('splash');
      break;
    }
  }
}

const _w = { x: 0, z: 0 };
function worldOf(p, out = _w) {
  const R = G.raft, ca = Math.cos(R.a), sa = Math.sin(R.a);
  out.x = R.x + p.x * ca + p.z * sa;
  out.z = R.z - p.x * sa + p.z * ca;
  return out;
}

const tmpV = new THREE.Vector3();
function updateViews(dt, now) {
  const R = G.raft;
  const plist = [G.me];
  for (const [, r] of G.remotes) if (r.st) plist.push({ x: r.st.x, z: r.st.z, mode: r.st.m & 12 ? 'gone' : 'ok' });
  raftView.update(R, plist, dt, Math.sin(performance.now() / 700) * 0.03);

  const me = G.me, mv = G.meView;
  mv.root.position.set(me.x, me.y, me.z);
  mv.root.rotation.y = me.f;
  mv.root.visible = !(me.mode === 'fallen');
  mv.animate({ speed: me.speed, walkPhase: me.walkPhase, dir: Math.sign(me.vphi) * (Math.abs(me.vphi) > 0.1 ? 1 : 0), fart: me.fart, duck: me.duck, mode: me.mode }, dt);

  for (const [id, r] of G.remotes) {
    const st = r.st;
    r.view.root.visible = !!st && !(st.m & 8);
    if (!st) { sound.setVoice(id, ANIMAL_INFO[r.animal].pitch, false); continue; }
    r.view.root.position.set(st.x, st.y, st.z);
    r.view.root.rotation.y = st.f;
    const prev = r.prevSt || st;
    const dphi = wrap((st.p ?? 0) - (prev.p ?? 0));
    const sp = (Math.abs(dphi) * RAFT.hangR) / Math.max(dt, 1e-3);
    r.speed = (r.speed || 0) + (Math.min(4, sp) - (r.speed || 0)) * Math.min(1, dt * 10);
    if (Math.abs(dphi) > 1e-4) r.dir = Math.sign(dphi);
    else r.dir *= Math.exp(-dt * 6);
    r.phase = (r.phase || 0) + r.speed * dt * 2.6;
    r.prevSt = st;
    const fallen = !!(st.m & 8);
    r.view.animate({ speed: r.speed, walkPhase: r.phase, dir: r.speed > 0.3 ? Math.sign(r.dir) : 0, fart: !!(st.m & 2), duck: !!(st.m & 16), mode: st.m & 4 ? 'knocked' : fallen ? 'fallen' : 'ok' }, dt);
    if (fallen && !r.wasFallen) {
      r.view.root.getWorldPosition(tmpV);
      fx.splash(tmpV.x, R.y, tmpV.z, 40, 5, 3);
      sound.play('splash', { vol: 0.8 });
    }
    r.wasFallen = fallen;
  }

  scene.updateMatrixWorld();
  const ca = Math.cos(R.a), sa = Math.sin(R.a);
  const emit = (id, p, on, gas, pitch) => {
    const wx = R.x + p.x * ca + p.z * sa, wz = R.z - p.x * sa + p.z * ca;
    const fa = p.f + R.a;
    const dx = Math.sin(fa), dz = Math.cos(fa);
    if (on) fx.fart(id, dt, wx - dx * 0.35, R.y + 0.05, wz - dz * 0.35, dx, dz, R.vx, R.vz, R.y);
    tmpV.set(wx, R.y, wz).project(camera);
    sound.setVoice(id, pitch, on, tmpV.x * 0.7, 1, gas);
    return on;
  };
  let anyToot = emit('me', me, me.fart && !G.paused, me.gas, ANIMAL_INFO[G.profile.animal].pitch);
  for (const [id, r] of G.remotes) {
    if (!r.st) continue;
    anyToot = emit(id, r.st, !!(r.st.m & 2) && !G.wiping, (r.st.g || 0) / 100, ANIMAL_INFO[r.animal].pitch) || anyToot;
  }
  if (me.duck) {
    G.duckBub = (G.duckBub || 0) - dt;
    if (G.duckBub < 0) {
      G.duckBub = 0.12;
      const w = worldOf(me);
      fx.spray.emit(w.x + (Math.random() - 0.5) * 0.5, R.y + 0.02, w.z + (Math.random() - 0.5) * 0.5, 0, 1.2, 0, 0.3, 0.14, 0.05);
      if (Math.random() < 0.3) fx.rings.add(w.x, R.y, w.z, 0.8, 0.9);
    }
  }
  G.bubbleT -= dt;
  if (anyToot && G.bubbleT < 0) { G.bubbleT = 0.06 + Math.random() * 0.12; sound.play('bubble'); }

  const wake = Math.hypot(R.vx, R.vz);
  G.wakeT = (G.wakeT || 0) + dt * Math.min(1.5, wake * 0.4);
  if (G.wakeT > 1 && (G.mode === 'run' || G.mode === 'done')) { G.wakeT = 0; fx.wake(R.x - R.vx * 0.4, R.y, R.z - R.vz * 0.4); }

  for (const h of haz.list) {
    if (h.type !== 'geyser' || Math.abs(h.s - R.s) > 40) continue;
    const u = ((G.T + h.phase) % h.period + h.period) % h.period;
    if (u > 1.3 && u < 2.4 && Math.random() < 0.7) fx.jet(h.x, h.wy, h.z, 0.3 + Math.sin(Math.min(1, (u - 1.3) / 1.2 * 1.15) * Math.PI) * 5);
  }

  const cp = G.net?.meta.cp || 0;
  const inRun = G.mode === 'run' || G.mode === 'done';
  world.beacons.forEach((b, i) => {
    const idx = i + 1;
    b.set(!inRun ? 'idle' : idx <= cp || (b.finish && G.mode === 'done') ? 'done' : idx === cp + 1 ? 'next' : 'idle');
  });
}

function updateCamera(dt) {
  const R = G.raft;
  cam.touched += dt;
  if (cam.turn) { cam.yawOff += cam.turn * 1.8 * dt; cam.touched = 0; }
  if (G.mode === 'menu' || G.mode === 'boot') {
    const t = performance.now() / 1000;
    const base = Math.atan2(-(R.tx || 0), -(R.tz || -1));
    const a = base + Math.sin(t * 0.18) * 0.5 - 0.2;
    const target = tmpV.set(R.x, R.y + 0.4, R.z);
    camera.position.set(R.x + Math.sin(a) * 8.2, R.y + 3.0, R.z + Math.cos(a) * 8.2);
    camera.lookAt(target);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    camera.lookAt(target.addScaledVector(right, window.innerWidth > 1100 ? -1.2 : -2.4));
    cam.init = false;
    return;
  }
  const f = track.at(Math.min(track.length, R.s + 7), {});
  const targetYaw = Math.atan2(f.tx, f.tz);
  const d = wrap(targetYaw - cam.yaw);
  cam.yaw += d * (cam.init ? 1 - Math.exp(-dt * 1.6) : 1);
  if (cam.touched > 4) cam.yawOff *= Math.exp(-dt * 0.7);
  const yaw = cam.yaw + cam.yawOff;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const look = tmpV.set(R.x + dx * 4.2, R.y + 0.6, R.z + dz * 4.2);
  if (cam.look.distanceTo(look) > 25) cam.init = false;
  const desired = new THREE.Vector3(look.x - dx * cam.dist, R.y + cam.height * (cam.dist / 11), look.z - dz * cam.dist);
  if (!cam.init) { cam.pos.copy(desired); cam.look.copy(look); cam.init = true; }
  cam.pos.lerp(desired, 1 - Math.exp(-dt * 5));
  cam.look.lerp(look, 1 - Math.exp(-dt * 8));
  G.shake *= Math.exp(-dt * 5);
  const s = G.shake;
  const t = performance.now() / 1000;
  camera.position.set(cam.pos.x + Math.sin(t * 41) * s * 0.3, cam.pos.y + Math.sin(t * 37) * s * 0.25, cam.pos.z + Math.cos(t * 43) * s * 0.3);
  camera.lookAt(cam.look);
}

function updateHud(dt, now) {
  if (G.mode !== 'run' && G.mode !== 'done') return;
  const m = G.net.meta;
  const ms = G.mode === 'done' && m.fin ? m.fin - m.t0 : now - (m.t0 || now);
  $('timer').textContent = fmtTime(ms);
  const prog = Math.max(0, Math.min(1, (G.raft.s - START_S) / (FINISH_S - START_S)));
  $('prog-fill').style.width = `${(prog * 100).toFixed(1)}%`;
  const g = G.me.gas;
  $('gas-fill').style.transform = `scaleX(${Math.max(0.001, g).toFixed(3)})`;
  $('gas').classList.toggle('low', g < 0.18);
  const br = G.me.breath / PLAYER.breath;
  $('breath').classList.toggle('show', G.me.duck || br < 0.98);
  $('breath-fill').style.transform = `scaleX(${Math.max(0.001, br).toFixed(3)})`;
  if (now < (m.t0 || 0)) {
    const n = Math.ceil((m.t0 - now) / 1000);
    if (n !== G.lastCount && n <= 3 && n >= 1) { G.lastCount = n; showBig(String(n)); sound.play('beep'); }
  } else if (G.lastCount !== 0 && G.lastCount !== null && G.mode === 'run') {
    G.lastCount = 0;
    showBig('TOOT!', 'go', '', TIPS[m.cp || 0]);
    sound.play('beep', { go: true });
  }
}

function buildTicks() {
  const el = $('prog-ticks');
  const cp = G.net?.meta.cp || 0;
  const span = FINISH_S - START_S;
  let html = '';
  for (let i = 1; i < CHECKPOINTS.length; i++) html += `<i class="${i <= cp ? 'on' : ''}" style="left:${(((CHECKPOINTS[i] - START_S) / span) * 100).toFixed(1)}%"></i>`;
  html += `<i class="fin ${G.mode === 'done' ? 'on' : ''}" style="left:100%"></i>`;
  el.innerHTML = html;
}

function flashGas() {
  const el = $('gas');
  el.classList.remove('bean');
  void el.offsetWidth;
  el.classList.add('bean');
}

function showBig(text, cls = '', sub = '', tip = '') {
  const el = $('big');
  el.className = 'big';
  void el.offsetWidth;
  el.innerHTML = '';
  el.append(document.createTextNode(text));
  if (sub) { const s = document.createElement('small'); s.textContent = sub; el.append(s); }
  if (tip) { const t = document.createElement('em'); t.textContent = tip; el.append(t); }
  el.className = `big ${cls} show`;
}

let toastTimer = 0;
function toast(msg, error = false) {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, error ? 4200 : 1800);
}

function showScreen(id) {
  for (const s of ['menu', 'lobby', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id);
}

function sendNet(now) {
  const net = G.net;
  if (!net || net.solo) return;
  if (now - G.lastSend >= NET.rate * 1000) {
    G.lastSend = now;
    const me = G.me;
    const m = (me.fart ? 2 : 0) | (me.mode === 'knocked' ? 4 : 0) | (me.mode === 'fallen' ? 8 : 0) | (me.duck ? 16 : 0);
    const r3 = (v) => Math.round(v * 1000) / 1000;
    net.sendState({ x: r3(me.x), z: r3(me.z), y: r3(me.y), f: r3(me.f), p: r3(me.phi), m, g: Math.round(me.gas * 100), t: now });
  }
  if (net.isHost && (G.mode === 'run' || G.mode === 'done') && now - G.lastRaftSend >= NET.rate * 1000) {
    G.lastRaftSend = now;
    const R = G.raft;
    const r3 = (v) => Math.round(v * 1000) / 1000;
    net.sendRaft({ x: r3(R.x), z: r3(R.z), a: r3(R.a), vx: r3(R.vx), vz: r3(R.vz), w: r3(R.w), t: now });
  }
}

let last = performance.now(), acc = 0, frames = 0, ftAcc = 0;
function frame() {
  requestAnimationFrame(frame);
  const tnow = performance.now();
  let dt = (tnow - last) / 1000;
  last = tnow;
  if (dt > 0.25) dt = 0.25;
  ftAcc += dt; frames++;
  if (ftAcc > 2) {
    const avg = ftAcc / frames;
    if (avg > 0.024 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
    ftAcc = 0; frames = 0;
  }
  if (G.mode === 'boot') return;
  const now = G.net.serverNow();
  const inp = readInput();
  acc += dt;
  const step = PHYS.dt;
  let n = 0;
  while (acc >= step && n < 8) {
    if (!G.paused || !G.net.solo) stepSim(step, inp, G.net.serverNow());
    inp.fartPressed = false;
    acc -= step; n++;
  }
  if (n === 8) acc = 0;
  pressed.clear();
  updateWipe(dt, now);
  updateViews(dt, now);
  updateCamera(dt);
  hazViews.update(G.T, dt, performance.now() / 1000, G.raft.s);
  world.update(dt, tmpV.set(G.raft.x, G.raft.y, G.raft.z), camera, G.raft.s);
  fx.update(dt);
  updateHud(dt, now);
  sendNet(now);
  if (sound.ctx) {
    const s = G.raft.s;
    const fall = s > 630 && s < 690 ? Math.max(0, 1 - Math.abs(s - 656) / 34) : 0;
    sound.setRiver(G.raft.cur || 1, fall, 0);
  }
  renderer.render(scene, camera);
}

function togglePause() {
  if (G.mode !== 'run' && G.mode !== 'done' && G.mode !== 'lobby') return;
  const open = $('pause').classList.contains('hidden');
  if (open) {
    $('btn-restart').classList.toggle('hidden', !(G.net.isHost && G.mode !== 'lobby'));
    syncSoundButtons();
    $('pause').classList.remove('hidden');
    if (G.net.solo && G.mode === 'run') { G.paused = true; G.pauseAt = Date.now(); sound.silenceAll(); }
  } else resume();
}

function resume() {
  $('pause').classList.add('hidden');
  if (G.paused) {
    const d = Date.now() - G.pauseAt;
    const m = G.net.meta;
    if (m.t0) m.t0 += d;
    if (m.wt) m.wt += d;
    if (G.wiping) G.wiping.wt += d;
    G.paused = false;
  }
}

function syncSoundButtons() {
  $('btn-sound').textContent = `Sound: ${sound.muted ? 'off' : 'on'}`;
  $('btn-music').textContent = `Music: ${sound.musicOn ? 'on' : 'off'}`;
}

async function backToMenu() {
  const net = G.net;
  G.mode = 'menu';
  G.paused = false;
  G.wiping = null;
  G.runId = -1;
  G.doneShown = -1;
  sound.silenceAll();
  if (net && !net.solo) await net.leave();
  G.net = new SoloNet(G.profile);
  syncRemotes();
  G.raft = makeRaft(track, START_S);
  menuPose();
  raftView.deflate = 0;
  $('hud').classList.add('hidden');
  $('big').className = 'big';
  showScreen('menu');
  history.replaceState(null, '', location.pathname);
  refreshScores();
}

function menuPose() {
  resetPlayer(G.me, 0, 1);
  G.me.phi = 0;
  G.me.x = 0; G.me.z = RAFT.hangR; G.me.f = Math.PI;
}

function renderLobby() {
  const net = G.net;
  if (!net || net.solo) return;
  $('room-code').textContent = net.code || '----';
  const ul = $('lobby-players');
  ul.innerHTML = '';
  const rows = [...net.players.entries()].sort((a, b) => a[1].slot - b[1].slot);
  for (const [id, p] of rows) {
    const li = document.createElement('li');
    li.innerHTML = `<i style="background:${SLOT_COLORS[p.slot % 3]}"></i><span class="who"></span>${id === net.meta.host ? '<span class="badge">HOST</span>' : ''}`;
    li.querySelector('.who').textContent = `${p.name}${id === net.selfId ? ' (you)' : ''} · ${ANIMAL_INFO[p.animal]?.name || ''}`;
    ul.append(li);
  }
  for (let i = rows.length; i < NET.maxPlayers; i++) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Free spot';
    ul.append(li);
  }
  $('btn-start').classList.toggle('hidden', !net.isHost);
  $('lobby-wait').classList.toggle('hidden', net.isHost);
}

function renderScoreList(el, n, mineMs) {
  const list = G.scores.filter((s) => s.n === n).sort((a, b) => a.ms - b.ms).slice(0, 10);
  el.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = G.scoresErr ? 'Scores are offline right now.' : 'No runs yet. Be the first!';
    el.append(li);
    return;
  }
  for (const s of list) {
    const li = document.createElement('li');
    if ((mineMs && Math.abs(s.ms - mineMs) < 2) || s.names.split(', ').includes(G.profile.name)) li.className = 'me';
    li.innerHTML = '<span class="nm"></span><span class="tm"></span>';
    li.querySelector('.nm').textContent = s.names;
    li.querySelector('.tm').textContent = fmtTime(s.ms);
    el.append(li);
  }
}

let boardN = 1;
async function refreshScores() {
  try { G.scores = await fetchScores(); G.scoresErr = false; } catch (e) { G.scoresErr = true; console.warn('[scores]', e?.message); }
  renderScoreList($('scores'), boardN);
}

function pickAnimal(kind) {
  G.profile.animal = kind;
  saveProfile();
  $('animal-name').textContent = ANIMAL_INFO[kind].name;
  for (const b of $('animal-dots').children) b.classList.toggle('on', b.dataset.a === kind);
  setMyAnimal(kind);
}

function buildMenu() {
  $('name').value = G.profile.name;
  $('name').addEventListener('input', () => {
    G.profile.name = $('name').value.trim().slice(0, 16) || 'Tooter';
    saveProfile();
  });
  const dots = $('animal-dots');
  for (const a of ANIMALS) {
    const b = document.createElement('button');
    b.dataset.a = a;
    b.style.background = ANIMAL_INFO[a].color;
    b.title = ANIMAL_INFO[a].name;
    b.addEventListener('click', () => { pickAnimal(a); sound.init().then(() => sound.play('click')); });
    dots.append(b);
  }
  const step = (d) => {
    const i = ANIMALS.indexOf(G.profile.animal);
    pickAnimal(ANIMALS[(i + d + ANIMALS.length) % ANIMALS.length]);
    sound.init().then(() => sound.play('click'));
  };
  $('prev-animal').addEventListener('click', () => step(-1));
  $('next-animal').addEventListener('click', () => step(1));
  pickAnimal(G.profile.animal);

  $('tabs').addEventListener('click', (e) => {
    const t = e.target.closest('button')?.dataset.tab;
    if (!t) return;
    for (const c of $('tabs').children) c.classList.toggle('on', c.dataset.tab === t);
    $('tab-how').classList.toggle('hidden', t !== 'how');
    $('tab-runs').classList.toggle('hidden', t !== 'runs');
  });
  $('seg').addEventListener('click', (e) => {
    const n = Number(e.target.dataset.n);
    if (!n) return;
    boardN = n;
    for (const c of $('seg').children) c.classList.toggle('on', c === e.target);
    renderScoreList($('scores'), boardN);
  });
  const code = params.get('room');
  if (code) $('code').value = code.toUpperCase().slice(0, 4);
  $('code').addEventListener('input', () => { $('code').value = $('code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); });
  $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });

  const busy = (on) => { for (const id of ['btn-solo', 'btn-create', 'btn-join']) $(id).disabled = on; };
  const err = (m) => { $('menu-err').textContent = m || ''; };

  $('btn-solo').addEventListener('click', () => {
    err('');
    document.activeElement?.blur();
    sound.init();
    G.net = new SoloNet(G.profile);
    bindNet(G.net);
    syncRemotes();
    const cp = Math.max(0, Math.min(CHECKPOINTS.length - 1, Number(params.get('cp')) || 0));
    newRun({ cp });
  });
  const online = async (fn) => {
    err('');
    busy(true);
    sound.init();
    try {
      const fb = await connectFirebase();
      const net = new RoomNet(fb, { name: G.profile.name, animal: G.profile.animal });
      bindNet(net);
      await fn(net);
      document.activeElement?.blur();
      history.replaceState(null, '', `?room=${net.code}`);
      busy(false);
      if (G.mode === 'run' || G.mode === 'done') return;
      G.mode = 'lobby';
      G.raft = makeRaft(track, START_S);
      resetPlayer(G.me, mySlot(), playerCount());
      cam.init = false;
      showScreen('lobby');
      $('hud').classList.add('hidden');
      renderLobby();
      if (net.meta.phase === 'run' || net.meta.phase === 'done') onMeta(net.meta);
      return;
    } catch (e) {
      console.warn(e);
      err(e?.message?.includes('PERMISSION') ? 'The room service refused us. Try again in a moment.' : (e?.message || 'Could not connect.'));
      if (G.net && !G.net.solo) G.net.leave();
      G.net = new SoloNet(G.profile);
    }
    busy(false);
  };
  $('btn-create').addEventListener('click', () => online((net) => net.create()));
  $('btn-join').addEventListener('click', () => {
    const c = $('code').value.trim();
    if (c.length !== 4) { err('Type the 4-letter room code first.'); return; }
    online((net) => net.join(c));
  });

  $('btn-copy').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?room=${G.net.code}`;
    try { await navigator.clipboard.writeText(url); toast('Invite link copied'); } catch { toast(G.net.code); }
  });
  $('btn-start').addEventListener('click', () => { if (G.net.isHost) newRun(); });
  $('btn-leave').addEventListener('click', () => backToMenu());
  $('btn-resume').addEventListener('click', () => resume());
  $('btn-sound').addEventListener('click', () => { sound.setMuted(!sound.muted); syncSoundButtons(); });
  $('btn-music').addEventListener('click', () => { sound.setMusic(!sound.musicOn); syncSoundButtons(); });
  $('btn-restart').addEventListener('click', () => { resume(); if (G.net.isHost) newRun(); });
  $('btn-quit').addEventListener('click', () => { $('pause').classList.add('hidden'); backToMenu(); });
  $('btn-again').addEventListener('click', () => { if (G.net.isHost) newRun(); });
  $('btn-menu').addEventListener('click', () => backToMenu());
  document.addEventListener('pointerdown', () => { if (sound.ctx && sound.ctx.state !== 'running') sound.ctx.resume(); });
}

async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('80px "Lilita One"'), document.fonts.load('800 16px "Nunito"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {}
  track = new Track();
  haz = new Hazards(track);
  world = buildWorld(scene, track, haz);
  hazViews = new HazardViews(scene, track, haz);
  fx = new FX(scene);
  raftView = new RaftView();
  scene.add(raftView.root);
  G.raft = makeRaft(track, START_S);
  G.track = track;
  G.haz = haz;
  G.scene = scene;
  G.renderer = renderer;
  G.net = new SoloNet(G.profile);
  resize();
  buildMenu();
  applySectors();
  menuPose();
  G.mode = 'menu';
  showScreen('menu');
  renderer.compile(scene, camera);
  requestAnimationFrame(frame);
  setTimeout(() => $('loading').classList.add('out'), 150);
  setTimeout(() => $('loading').remove(), 900);
  refreshScores();
}

boot().catch((e) => {
  console.error(e);
  $('loading').innerHTML = `<div>Something broke while loading: ${String(e?.message || e)}</div>`;
});
