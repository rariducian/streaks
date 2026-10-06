// Data protection: persistent storage, a rolling IndexedDB snapshot ring, and backup/restore summaries.
// Everything is wrapped in try/catch and works without IndexedDB. The store is a tiny interface so tests can fake it.
export const SNAP_KEEP = 7;

// Local date as YYYY-MM-DD.
export const dateKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Counts shown on the backup card, the import confirm and the restore list.
export function summarise(st) {
  const s = st && typeof st === 'object' ? st : {};
  const floor = s.game && Number.isFinite(s.game.floor) ? s.game.floor : null;
  return { sessions: Array.isArray(s.sessions) ? s.sessions.length : 0, fasts: Array.isArray(s.fasts) ? s.fasts.length : 0, floor };
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export function summaryText(st) {
  const x = summarise(st);
  return `${plural(x.sessions, 'session')}, ${plural(x.fasts, 'fast')}${x.floor != null ? `, Tower floor ${x.floor}` : ''}`;
}
export const importConfirm = (next) => ({ title: 'Replace all data?', message: `The backup has ${summaryText(next)}. This replaces everything on this phone with it. Your current data is saved to a snapshot first.`, confirmLabel: 'Replace data' });
export const restoreConfirm = (snap) => ({ title: `Restore from ${snap.date}?`, message: `The snapshot has ${summaryText(snap.state)}. This replaces what is on this phone now.`, confirmLabel: 'Restore', destructive: true });
export const backupCardText = (st) => `Your data lives only on this phone, and losing it would cost you ${summaryText(st)}. One tap saves a copy to Files or iCloud.`;
export const fmtSize = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

// Ask Safari/Chrome not to evict our storage. Returns 'Protected' | 'Not protected' | 'Not supported'.
export async function ensurePersist(nav = globalThis.navigator) {
  try {
    const sm = nav && nav.storage;
    if (!sm || typeof sm.persisted !== 'function' || typeof sm.persist !== 'function') return 'Not supported';
    if (await sm.persisted()) return 'Protected';
    return (await sm.persist()) ? 'Protected' : 'Not protected';
  } catch (e) { return 'Not supported'; }
}

// Real IndexedDB store: db "streaks-bak", object store "snaps", keyed by `key`. Returns null if there is no IndexedDB.
export function idbStore(idb = globalThis.indexedDB) {
  if (!idb) return null;
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = idb.open('streaks-bak', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('snaps', { keyPath: 'key' });
    r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const run = (mode, fn) => open().then((db) => new Promise((res, rej) => {
    const t = db.transaction('snaps', mode), q = fn(t.objectStore('snaps'));
    t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error);
  }));
  return { all: () => run('readonly', (s) => s.getAll()).then((x) => x || []), put: (rec) => run('readwrite', (s) => s.put(rec)), del: (key) => run('readwrite', (s) => s.delete(key)) };
}

// Newest first.
export async function listSnaps(store) {
  try { return ((await store.all()) || []).slice().sort((a, b) => (a.key < b.key ? 1 : -1)); } catch (e) { return []; }
}

// Write a snapshot, one per date, and keep only the newest SNAP_KEEP. Daily writes skip if today already has one; `force` replaces it (before import).
// An empty state never writes a daily snapshot, so a fresh install cannot push out a good one.
export async function snapshot(store, state, now = new Date(), { label = 'daily', force = false } = {}) {
  try {
    if (!store) return false;
    const key = dateKey(now), s = summarise(state);
    if (!force && s.sessions + s.fasts === 0) return false;
    const have = await listSnaps(store);
    if (!force && have.some((x) => x.key === key)) return false;
    const json = JSON.stringify(state);
    await store.put({ key, date: key, label, at: new Date(now).toISOString(), size: json.length, state: JSON.parse(json) });
    const all = await listSnaps(store);
    for (const x of all.slice(SNAP_KEEP)) await store.del(x.key);
    return true;
  } catch (e) { return false; }
}

// Should we offer a restore on load? True when localStorage has nothing usable and a snapshot exists. Returns the newest snapshot or null.
export async function restoreOffer(text, store, parse = (t) => JSON.parse(t)) {
  try {
    let ok = false;
    if (text) { try { const d = parse(text); ok = !!d && typeof d === 'object' && !Array.isArray(d); } catch (e) { ok = false; } }
    if (ok || !store) return null;
    return (await listSnaps(store))[0] || null;
  } catch (e) { return null; }
}
