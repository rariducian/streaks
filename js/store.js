// localStorage persistence. Every access is wrapped in try/catch.
import { MOVES } from './data.js';
import { defaultState } from './logic.js';

export const STORAGE_KEY = 'streaks.v1';

// Merge a raw (possibly partial/old) state onto defaults. Never throws on missing fields.
export function normalise(raw) {
  const base = defaultState();
  const r = raw && typeof raw === 'object' ? raw : {};
  const s = {
    ...base,
    ...r,
    version: 1,
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
  return s;
}

export function load() {
  try {
    const text = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (text) return normalise(JSON.parse(text));
  } catch (e) { /* fall through to defaults */ }
  return defaultState();
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
  if (data.version !== 1) throw new Error(`Unsupported backup version: ${data.version ?? 'missing'}.`);
  for (const k of ['sessions', 'fasts', 'events']) {
    if (k in data && !Array.isArray(data[k])) throw new Error(`Backup is damaged: "${k}" should be a list.`);
  }
  for (const k of ['settings', 'moves']) {
    if (k in data && (typeof data[k] !== 'object' || data[k] === null || Array.isArray(data[k]))) throw new Error(`Backup is damaged: "${k}" is missing or wrong.`);
  }
  return normalise(data);
}
