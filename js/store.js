// localStorage persistence. Every access is wrapped in try/catch.
import { MOVES } from './data.js';
import { defaultState, migrate, clampTargets } from './logic.js';

export const STORAGE_KEY = 'streaks.v1';

// Merge a raw (possibly partial/old) state onto defaults. Never throws on missing fields.
export function normalise(raw) {
  const base = defaultState();
  const r = raw && typeof raw === 'object' ? raw : {};
  const s = {
    ...base,
    ...r,
    version: 2,
    settings: { ...base.settings, ...(r.settings && typeof r.settings === 'object' ? r.settings : {}) },
    rotationIndex: Number.isInteger(r.rotationIndex) ? r.rotationIndex : 0,
    moves: {},
    sessions: Array.isArray(r.sessions) ? r.sessions : [],
    fasts: Array.isArray(r.fasts) ? r.fasts : [],
    events: Array.isArray(r.events) ? r.events : [],
  };
  const rm = r.moves && typeof r.moves === 'object' ? r.moves : {};
  for (const id of Object.keys(MOVES)) {
    const m = { ...base.moves[id], ...(rm[id] && typeof rm[id] === 'object' ? rm[id] : {}) };
    m.level = Math.min(MOVES[id].levels.length - 1, Math.max(0, Number.isInteger(m.level) ? m.level : 0));
    s.moves[id] = m;
  }
  return clampTargets(s);   // targets above the fitted max for the work time come down to it
}

export function load() {
  let text = null;
  try {
    text = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (text) return normalise(migrate(JSON.parse(text)));
  } catch (e) {
    // Damaged data: keep the raw text aside before the next save replaces it. The first copy is never overwritten.
    try { if (text && globalThis.localStorage.getItem(STORAGE_KEY + '.corrupt') == null) globalThis.localStorage.setItem(STORAGE_KEY + '.corrupt', text); } catch (e2) { /* ignore */ }
  }
  return defaultState();
}

/* ---------- live session ----------
   The running EMOM session is saved on every phase change and log, so iOS closing the app does not lose it. */
export const LIVE_KEY = 'streaks.live';
const RESUME_PAUSED_MS = 3 * 3600e3;   // a paused session can be resumed for 3 hours
export function saveLive(live) {
  try { globalThis.localStorage.setItem(LIVE_KEY, JSON.stringify(live)); return true; } catch (e) { return false; }
}
export function loadLive() {
  try {
    const d = JSON.parse(globalThis.localStorage?.getItem(LIVE_KEY) || 'null');
    return d && typeof d === 'object' && d.plan && Number.isFinite(d.startMs) && Array.isArray(d.logs) ? d : null;
  } catch (e) { return null; }
}
export function clearLive() { try { globalThis.localStorage.removeItem(LIVE_KEY); } catch (e) { /* ignore */ } }
// completed: whole minutes done by the last save (or pause). canResume: the session window is still open now.
export function liveInfo(live, now = Date.now()) {
  const total = live.plan.minutes, off = live.pausedTotal || 0;
  const lastKnown = live.pausedAt ?? live.savedAt ?? live.startMs;
  const completed = Math.max(0, Math.min(total, Math.floor((lastKnown - live.startMs - off) / 60000)));
  const elNow = (live.pausedAt ?? now) - live.startMs - off;
  const canResume = live.pausedAt != null ? now - live.pausedAt < RESUME_PAUSED_MS && elNow < total * 60000 : elNow < total * 60000;
  // done is set when a finished session failed to save: it is complete, so it can only be saved, not resumed.
  if (live.done != null) return { completed: Math.min(total, live.done), canResume: false, minute: total };
  return { completed, canResume, minute: Math.min(total, Math.floor(Math.max(0, elNow) / 60000) + 1) };
}

// Returns true if saved, false if storage is missing or full.
export function save(state) {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('That file is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('That file is not a streaks backup.');
  if (data.version !== 1 && data.version !== 2) throw new Error(`Unsupported backup version: ${data.version ?? 'missing'}.`);
  for (const k of ['sessions', 'fasts', 'events']) {
    if (k in data && !Array.isArray(data[k])) throw new Error(`Backup is damaged: "${k}" should be a list.`);
  }
  for (const k of ['settings', 'moves']) {
    if (k in data && (typeof data[k] !== 'object' || data[k] === null || Array.isArray(data[k]))) throw new Error(`Backup is damaged: "${k}" is missing or wrong.`);
  }
  return normalise(migrate(data));
}
