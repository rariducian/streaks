// Weekly bounty. Pure logic, no DOM. Only { week, kind, target, move?, claimed } is saved (state.game.bounty): progress is worked out from sessions, events and fasts every time.
// Kinds: days (train N days), best (beat your best on a move), level (level up any move), full (full sessions, not minimum, on N days), fast (N fasts past your minimum).
import { MOVES } from '../data.js';
import { todayStr, addDays, weekStartOf } from '../logic.js';
import { CONFIG, ensureGame, rollDrop, giveDrop } from './engine.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dateOf = (iso) => todayStr(new Date(iso));
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };   // FNV-1a: the same text always gives the same number
const fastHours = (f) => (new Date(f.end) - new Date(f.start)) / 3.6e6;

// What the user did in the week starting `ws` (Monday). All from real data.
export function weekStats(state, ws) {
  const we = addDays(ws, 6), inW = (d) => d >= ws && d <= we, minH = (state.settings && state.settings.fastMinHours) || 12;
  const ses = (state.sessions || []).filter((s) => inW(s.date)), evs = (state.events || []).filter((e) => e.at && inW(dateOf(e.at)));
  return {
    days: new Set(ses.map((s) => s.date)).size, full: new Set(ses.filter((s) => !s.minimum).map((s) => s.date)).size,
    levelUps: evs.filter((e) => e.type === 'levelUp').length, pbs: evs.filter((e) => e.type === 'pb').map((e) => e.moveId),
    fasts: (state.fasts || []).filter((f) => f.end && inW(dateOf(f.end)) && fastHours(f) >= minH).length
  };
}

// A new bounty for the week starting `ws`: the same state and week always give the same one (a hash, no dice).
export function genBounty(state, ws) {
  const C = CONFIG.bounty, past = Array.from({ length: C.weeks }, (_, i) => weekStats(state, addDays(ws, -7 * (i + 1))));
  const avg = (k) => past.reduce((a, w) => a + w[k], 0) / C.weeks;
  const moved = Object.keys(MOVES).filter((id) => (state.sessions || []).some((s) => s.date < ws && (s.sets || []).some((x) => x.moveId === id && x.level != null)));
  const kinds = ['days', 'level', 'full']; if (moved.length) kinds.push('best'); if (past.some((w) => w.fasts > 0)) kinds.push('fast');
  const seed = hash(ws + '|' + Object.keys(MOVES).map((id) => (state.moves && state.moves[id] ? state.moves[id].level : 0)).join('')), kind = kinds[seed % kinds.length];
  const b = { week: ws, kind, target: 1, claimed: false };
  if (kind === 'days') b.target = clamp(Math.round(avg('days') + 1), C.daysMin, C.daysMax);
  if (kind === 'full') b.target = clamp(Math.round(avg('full') + 1), C.fullMin, C.fullMax);
  if (kind === 'fast') b.target = clamp(Math.round(avg('fasts') + 1), C.fastMin, C.fastMax);
  if (kind === 'best') b.move = moved[(seed >>> 8) % moved.length];
  return b;
}

// How far along a bounty is (from its own week's data).
export function bountyProgress(state, b) {
  const w = weekStats(state, b.week);
  return Math.min(b.target, b.kind === 'days' ? w.days : b.kind === 'full' ? w.full : b.kind === 'level' ? w.levelUps : b.kind === 'fast' ? w.fasts : w.pbs.filter((m) => m === b.move).length);
}
// Claimable through the end of the week it belongs to and the next Monday, then it is gone.
export const claimOpen = (b, today) => today >= b.week && today <= addDays(b.week, 7);

// Makes sure game.bounty is this week's. On Monday a finished, unclaimed bounty from last week stays (claim it before the day ends); anything else old is replaced.
// Returns true if game.bounty changed (so the caller can save).
export function ensureBounty(state, today = todayStr()) {
  const g = ensureGame(state), ws = weekStartOf(today), b = g.bounty;
  if (b && b.week === ws) return false;
  if (b && !b.claimed && b.week === addDays(ws, -7) && today === ws && bountyProgress(state, b) >= b.target) return false;
  g.bounty = genBounty(state, ws); return true;
}

// Everything the views need: the bounty, progress, and what can be done with it.
export function bountyStatus(state, today = todayStr()) {
  const g = ensureGame(state), b = g.bounty; if (!b) return null;
  const now = bountyProgress(state, b), done = now >= b.target, open = claimOpen(b, today), last = b.week < weekStartOf(today);
  return { b, now, target: b.target, done, claimed: !!b.claimed, claimable: done && !b.claimed && open, last, expired: !b.claimed && !open, endsOn: addDays(b.week, last ? 7 : 6) };
}
const mv = (b) => (MOVES[b.move] ? MOVES[b.move].name : 'a move');
export const bountyText = (b) => ({
  days: `Train ${b.target} days`, best: `Beat your best on ${mv(b)}`, level: 'Level up any move',
  full: `Do a full session (not minimum) on ${b.target} days`, fast: `Fast ${b.target} times past your minimum`
}[b.kind]);
// "2/4 days": the short form for Today.
export const bountyShort = (st) => `${st.now}/${st.target} ${{ days: 'days', best: 'new best', level: 'level-up', full: 'full days', fast: 'fasts' }[st.b.kind]}`;

// Opens the chest: a rare-or-better item at the current tier (auto-equipped if better, as any drop) and a boss key up to the cap. Once only. Returns null when it cannot be claimed.
export function claimBounty(state, today = todayStr(), rng = Math.random) {
  const st = bountyStatus(state, today); if (!st || !st.claimable) return null;
  const g = ensureGame(state); g.bounty.claimed = true;
  const item = giveDrop(g, rollDrop(g, g.floor, rng, { min: CONFIG.bounty.minRarity })), k0 = g.keys;
  g.keys = Math.min(CONFIG.keyCap, g.keys + CONFIG.bounty.keys);
  return { item, keys: g.keys - k0 };
}
