// Toot Tube: networking. SoloNet runs a room of one locally; RoomNet carries a room over the shared Firebase Realtime Database.

import { FIREBASE } from './firebase-config.js';
import { NET } from './config.js';

const ROOT = 'tootTube';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

class Emitter {
  constructor() { this.handlers = {}; }
  on(e, fn) { (this.handlers[e] ||= []).push(fn); }
  emit(e, ...a) { for (const fn of this.handlers[e] || []) fn(...a); }
}

let fbPromise = null;
export function connectFirebase() {
  if (fbPromise) return fbPromise;
  fbPromise = (async () => {
    const [{ initializeApp }, db, auth] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-database.js`),
      import(`${SDK}/firebase-auth.js`),
    ]);
    const app = initializeApp(FIREBASE);
    const database = db.getDatabase(app);
    const a = auth.getAuth(app);
    await auth.signInAnonymously(a);
    const fb = { ...db, db: database, uid: a.currentUser.uid, offset: 0 };
    db.onValue(db.ref(database, '.info/serverTimeOffset'), (s) => { fb.offset = s.val() || 0; });
    return fb;
  })();
  fbPromise.catch(() => { fbPromise = null; });
  return fbPromise;
}

function code4() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += A[(Math.random() * A.length) | 0];
  return s;
}

export class SoloNet extends Emitter {
  constructor(profile) {
    super();
    this.solo = true;
    this.selfId = 'me';
    this.isHost = true;
    this.code = null;
    this.players = new Map([['me', { name: profile.name, animal: profile.animal, joined: 0, slot: 0 }]]);
    this.remote = new Map();
    this.meta = { phase: 'lobby', cp: 0, wipe: 0 };
  }
  serverNow() { return Date.now(); }
  setMeta(patch) { Object.assign(this.meta, patch); this.emit('meta', this.meta); }
  sendState() {}
  sendRaft() {}
  updateProfile(p) { Object.assign(this.players.get('me'), p); this.emit('players', this.players); }
  leave() {}
}

export class RoomNet extends Emitter {
  constructor(fb, profile) {
    super();
    this.fb = fb;
    this.solo = false;
    this.selfId = fb.uid;
    this.profile = profile;
    this.isHost = false;
    this.players = new Map();
    this.remote = new Map();
    this.meta = {};
    this.unsubs = [];
    this.left = false;
  }

  serverNow() { return Date.now() + (this.fb.offset || 0); }
  ref(p) { return this.fb.ref(this.fb.db, `${ROOT}/rooms/${this.code}${p ? '/' + p : ''}`); }

  async create() {
    const { get, set, query, orderByChild, endAt, limitToFirst, ref, remove } = this.fb;
    try {
      const stale = await get(query(ref(this.fb.db, `${ROOT}/rooms`), orderByChild('meta/beat'), endAt(this.serverNow() - 6 * 3600e3), limitToFirst(12)));
      stale.forEach((c) => { remove(c.ref).catch(() => {}); });
    } catch (e) { console.warn('[net] sweep skipped', e?.message); }
    for (let k = 0; k < 6; k++) {
      const c = code4();
      const snap = await get(this.fb.ref(this.fb.db, `${ROOT}/rooms/${c}/meta`));
      if (snap.exists()) continue;
      this.code = c;
      const now = this.serverNow();
      await set(this.ref('meta'), { host: this.selfId, phase: 'lobby', cp: 0, wipe: 0, created: now, beat: now });
      await this.enter();
      return c;
    }
    throw new Error('Could not find a free room code. Try again.');
  }

  async join(code) {
    const { get } = this.fb;
    this.code = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (this.code.length !== 4) throw new Error('Room codes have 4 characters.');
    const meta = await get(this.ref('meta'));
    if (!meta.exists()) throw new Error(`No room called ${this.code}.`);
    const players = await get(this.ref('players'));
    const n = players.exists() ? Object.keys(players.val()).length : 0;
    if (n >= NET.maxPlayers && !(players.val() || {})[this.selfId]) throw new Error('That room is full (3 players).');
    await this.enter();
    return this.code;
  }

  async enter() {
    const { set, onDisconnect, onValue, onChildAdded, onChildChanged, onChildRemoved, update } = this.fb;
    const me = this.ref(`players/${this.selfId}`);
    await onDisconnect(me).remove();
    await onDisconnect(this.ref(`st/${this.selfId}`)).remove();
    await set(me, { name: this.profile.name, animal: this.profile.animal, joined: this.serverNow() });
    this.unsubs.push(onValue(this.ref('meta'), (s) => {
      const v = s.val();
      if (!v) { if (!this.left) this.emit('closed'); return; }
      this.meta = v;
      this.isHost = v.host === this.selfId;
      this.emit('meta', v);
    }));
    this.unsubs.push(onValue(this.ref('players'), (s) => {
      const v = s.val() || {};
      const list = Object.entries(v).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
      this.players = new Map(list.map(([id, p], i) => [id, { ...p, slot: i }]));
      for (const id of [...this.remote.keys()]) if (!this.players.has(id)) this.remote.delete(id);
      if (this.meta.host && !this.players.has(this.meta.host) && list.length && list[0][0] === this.selfId) {
        update(this.ref('meta'), { host: this.selfId }).catch(() => {});
      }
      this.emit('players', this.players);
    }));
    const onSt = (s) => {
      if (s.key === this.selfId) return;
      const v = s.val();
      if (!v) return;
      let buf = this.remote.get(s.key);
      if (!buf) { buf = []; this.remote.set(s.key, buf); }
      if (buf.length && v.t <= buf[buf.length - 1].t) return;
      buf.push(v);
      if (buf.length > 24) buf.shift();
    };
    this.unsubs.push(onChildAdded(this.ref('st'), onSt));
    this.unsubs.push(onChildChanged(this.ref('st'), onSt));
    this.unsubs.push(onChildRemoved(this.ref('st'), (s) => this.remote.delete(s.key)));
    this.unsubs.push(onValue(this.ref('raft'), (s) => {
      const v = s.val();
      if (v && !this.isHost) this.emit('raft', v);
    }));
    this.beat = setInterval(() => {
      if (this.isHost) update(this.ref('meta'), { beat: this.serverNow() }).catch(() => {});
    }, 20000);
  }

  setMeta(patch) {
    Object.assign(this.meta, patch);
    this.fb.update(this.ref('meta'), patch).catch((e) => this.emit('error', e));
    this.emit('meta', this.meta);
  }

  sendState(st) {
    if (!this.code || this.left) return;
    this.fb.set(this.ref(`st/${this.selfId}`), st).catch(() => {});
  }

  sendRaft(r) {
    if (!this.code || this.left || !this.isHost) return;
    this.fb.set(this.ref('raft'), r).catch(() => {});
  }

  updateProfile(p) {
    Object.assign(this.profile, p);
    if (this.code) this.fb.update(this.ref(`players/${this.selfId}`), p).catch(() => {});
  }

  async leave() {
    if (this.left) return;
    this.left = true;
    clearInterval(this.beat);
    for (const u of this.unsubs) try { u(); } catch {}
    const { remove } = this.fb;
    const others = [...this.players.keys()].filter((id) => id !== this.selfId);
    try {
      if (!others.length) await remove(this.ref());
      else {
        if (this.isHost) await this.fb.update(this.ref('meta'), { host: others[0] });
        await remove(this.ref(`players/${this.selfId}`));
        await remove(this.ref(`st/${this.selfId}`));
      }
    } catch (e) { console.warn('[net] leave', e?.message); }
  }
}

export function sampleRemote(buf, t) {
  if (!buf || !buf.length) return null;
  if (t <= buf[0].t) return buf[0];
  for (let i = buf.length - 1; i > 0; i--) {
    const a = buf[i - 1], b = buf[i];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / Math.max(1, b.t - a.t);
      let df = b.f - a.f;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      return { ...b, x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, y: a.y + (b.y - a.y) * k, f: a.f + df * k };
    }
  }
  return buf[buf.length - 1];
}

export async function submitScore(entry) {
  const fb = await connectFirebase();
  await fb.push(fb.ref(fb.db, `${ROOT}/scores`), entry);
}

export async function fetchScores() {
  const fb = await connectFirebase();
  const { get, query, orderByChild, limitToFirst, ref } = fb;
  const snap = await get(query(ref(fb.db, `${ROOT}/scores`), orderByChild('ms'), limitToFirst(120)));
  const out = [];
  snap.forEach((c) => { out.push(c.val()); });
  return out;
}
