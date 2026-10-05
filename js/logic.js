// Pure logic for streaks. No DOM. Never mutates input.
import { DAYS, MOVES, MOVE_LIST, FAST_STAGES, SESSION_MINUTES_STEPS, MINIMUM_MINUTES, DEFAULT_WORK_SEC } from './data.js';

const clone = (x) => structuredClone(x);
const HOUR = 3600000;
const DAY_MS = 86400000;

// ---------- date helpers (local, DST safe: work on Y/M/D numbers) ----------
const pad = (n) => String(n).padStart(2, '0');

export function todayStr(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
const toDate = (v) => (v instanceof Date ? v : new Date(v));
const dayNum = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};
const fromDayNum = (n) => {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const addDays = (s, n) => fromDayNum(dayNum(s) + n);
// Monday-based day of week: Mon=0 ... Sun=6
const dowMon = (s) => (((dayNum(s) + 3) % 7) + 7) % 7; // 1970-01-01 was Thursday (3)
export const weekStartOf = (s) => addDays(s, -dowMon(s));

// ---------- ladder helpers ----------
const usableLevelIdx = (moveId, bar) =>
  MOVES[moveId].levels.map((l, i) => i).filter((i) => bar || !MOVES[moveId].levels[i].requiresBar);
const nextUsable = (moveId, level, bar) => usableLevelIdx(moveId, bar).find((i) => i > level);
const prevUsable = (moveId, level, bar) => usableLevelIdx(moveId, bar).filter((i) => i < level).pop();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Range [min,max] for a level: the level's own range, else the move's. For sec moves the max is capped at the work time.
// Pass workSec to apply the cap; without it the plain range is returned.
export function rangeOf(moveId, level, workSec = null) {
  const m = MOVES[moveId];
  const lv = m.levels[level];
  let [lo, hi] = (lv && lv.range) || m.range;
  if (m.unit === 'sec' && workSec) { hi = Math.min(hi, workSec); lo = Math.min(lo, hi); }
  return [lo, hi];
}
const workOf = (state) => state.settings.workSec || DEFAULT_WORK_SEC;
const defaultMove = (id) => ({ level: 0, target: rangeOf(id, 0)[0], calibrated: false, missStreak: 0 });
const makeId = (now = new Date()) => now.getTime().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- state ----------
export function defaultState(now = new Date()) {
  return {
    version: 2,
    settings: {
      fastMinHours: 12, fastGoalHours: 16, sessionMinutes: 10, workSec: DEFAULT_WORK_SEC, soundOn: true,
      pullupBar: false, growthDismissedAt: null, lastBackupAt: null, createdAt: now.toISOString(),
    },
    rotationIndex: 0,
    moves: Object.fromEntries(Object.keys(MOVES).map((id) => [id, defaultMove(id)])),
    sessions: [],
    fasts: [],
    events: [],
  };
}

export function currentDay(state) {
  return DAYS[((state.rotationIndex % DAYS.length) + DAYS.length) % DAYS.length];
}

// Effective level: if a bar level is stored but no bar, step down to the nearest usable level.
function effectiveLevel(state, moveId) {
  const ms = state.moves[moveId] || defaultMove(moveId);
  const usable = usableLevelIdx(moveId, state.settings.pullupBar);
  if (usable.includes(ms.level)) return ms.level;
  return usable.filter((i) => i < ms.level).pop() ?? 0;
}

export function sessionPlan(state, { minimum = false } = {}) {
  const day = currentDay(state);
  const wanted = minimum ? MINIMUM_MINUTES : state.settings.sessionMinutes;
  const count = minimum ? 2 : wanted >= 20 ? 5 : wanted >= 15 ? 4 : 3;
  const ids = day.moves.slice(0, count);
  const work = workOf(state);
  const moves = ids.map((moveId) => {
    const m = MOVES[moveId];
    const ms = state.moves[moveId] || defaultMove(moveId);
    const level = effectiveLevel(state, moveId);
    const lv = m.levels[level];
    const range = rangeOf(moveId, level, work);
    return {
      moveId, name: m.name, unit: m.unit, perSide: !!lv.perSide, rir2: !!lv.rir2, level,
      levelName: lv.name, cue: lv.cue,
      target: clamp(ms.target, range[0], range[1]), range,
      needsCalibration: !minimum && !ms.calibrated,
    };
  });
  // Round-robin blocks: 1 slot (both sides together) or 2 slots (left, then right).
  // A block that does not fit uses the next move whose block fits. If none fits, the plan stops early.
  const slots = [];
  let next = 0;
  while (slots.length < wanted) {
    const room = wanted - slots.length;
    let pick = -1;
    for (let k = 0; k < moves.length; k++) {
      const j = (next + k) % moves.length;
      if ((moves[j].perSide ? 2 : 1) <= room) { pick = j; break; }
    }
    if (pick < 0) break;
    const mv = moves[pick];
    if (mv.perSide) {
      slots.push({ minute: slots.length + 1, moveId: mv.moveId, side: 'L' });
      slots.push({ minute: slots.length + 1, moveId: mv.moveId, side: 'R' });
    } else {
      slots.push({ minute: slots.length + 1, moveId: mv.moveId, side: null });
    }
    next = (pick + 1) % moves.length;
  }
  return { dayId: day.id, dayName: day.name, minutes: slots.length, workSec: work, moves, slots };
}

export function placeFromCalibration(state, moveId, level, maxReps) {
  const [min, max] = rangeOf(moveId, level, workOf(state));
  const bar = state.settings.pullupBar;
  const raw = Math.round(maxReps * 0.65);
  let tooEasy = false, tooHard = false;
  if (raw > max && nextUsable(moveId, level, bar) !== undefined) tooEasy = true;
  if (raw < min && prevUsable(moveId, level, bar) !== undefined) tooHard = true;
  return { level, target: clamp(raw, min, max), tooEasy, tooHard };
}

export function applyCalibration(state, moveId, level, target) {
  const s = clone(state);
  s.moves[moveId] = { level, target, calibrated: true, missStreak: 0 };
  return s;
}

// ---------- sessions ----------
export function finishSession(state, { startedAt, endedAt, minimum = false, sets = [], minutes = null }) {
  const s = clone(state);
  const events = [];
  const day = currentDay(s);
  const at = toDate(endedAt || startedAt).toISOString();
  const session = {
    id: makeId(toDate(startedAt)),
    date: todayStr(toDate(startedAt)),
    startedAt: toDate(startedAt).toISOString(),
    endedAt: toDate(endedAt || startedAt).toISOString(),
    dayId: day.id,
    minutes: minimum ? MINIMUM_MINUTES : (minutes ?? s.settings.sessionMinutes),
    workSec: workOf(s),
    minimum: !!minimum,
    sets: clone(sets),
  };
  const prior = s.sessions.slice(); // before appending
  s.sessions.push(session);
  s.rotationIndex = (s.rotationIndex + 1) % DAYS.length;

  if (!minimum) {
    const bar = s.settings.pullupBar;
    const work = workOf(s);
    const ids = [...new Set(sets.map((x) => x.moveId))].filter((id) => MOVES[id]);
    for (const moveId of ids) {
      const mv = s.moves[moveId] || (s.moves[moveId] = defaultMove(moveId));
      const cur = effectiveLevel(s, moveId);
      // Only sets at the move's current level count (a set with level null is retired history and never counts).
      const mine = sets.filter((x) => x.moveId === moveId && x.level === cur);
      if (!mine.length) continue;
      const [min, max] = rangeOf(moveId, cur, work);
      const step = MOVES[moveId].unit === 'sec' ? 5 : 1;
      const reps = mine.map((x) => x.reps);
      const mean = reps.reduce((a, b) => a + b, 0) / reps.length;
      const lowest = Math.min(...reps);

      // PB: best single set at this move+level vs earlier sessions (needs a prior best).
      let prevBest = 0;
      for (const ps of prior) for (const x of ps.sets) if (x.moveId === moveId && x.level === cur) prevBest = Math.max(prevBest, x.reps);
      const best = Math.max(...reps);
      const pushEv = (type, level, value) => {
        const ev = { id: makeId(new Date(at)) + events.length, at, type, moveId, level, value };
        events.push(ev); s.events.push(ev);
      };

      mv.level = cur;
      if (reps.every((r) => r >= max)) {
        const nl = nextUsable(moveId, cur, bar);
        if (nl !== undefined) {
          mv.level = nl; mv.target = rangeOf(moveId, nl, work)[0]; mv.missStreak = 0;
          pushEv('levelUp', nl, nl);
        } else {
          mv.target = max; mv.missStreak = 0;
        }
      } else {
        const nt = clamp(lowest + step, min, max);
        if (nt > mv.target) {
          mv.target = nt;
          pushEv('targetUp', cur, nt);
        }
        if (mean < min) {
          mv.missStreak += 1;
          if (mv.missStreak >= 2) {
            const pl = prevUsable(moveId, cur, bar);
            if (pl !== undefined) mv.level = pl;
            const [lo, hi] = rangeOf(moveId, mv.level, work);
            mv.target = Math.round((lo + hi) / 2);
            mv.missStreak = 0;
            pushEv('levelDown', mv.level, mv.level);
          }
        } else {
          mv.missStreak = 0;
        }
      }
      if (prevBest > 0 && best > prevBest) pushEv('pb', cur, best);
    }
  }
  return { state: s, events };
}

export const trainingDates = (state) => [...new Set(state.sessions.map((x) => x.date))].sort();

export function fastingDates(state, now = new Date()) {
  const minMs = state.settings.fastMinHours * HOUR;
  const set = new Set();
  for (const f of state.fasts) {
    const start = new Date(f.start).getTime();
    if (f.end) {
      if (new Date(f.end).getTime() - start >= minMs) set.add(todayStr(new Date(f.end)));
    } else if (now.getTime() - start >= minMs) {
      set.add(todayStr(now));
    }
  }
  return [...set].sort();
}

// ---------- streaks ----------
export function computeStreak(dates, today) {
  const set = new Set(dates);
  const past = [...set].filter((d) => d <= today).sort();
  const out = { current: 0, longest: 0, freezes: 0, frozenDates: [], doneToday: set.has(today) };
  if (!past.length) return out;
  let streak = 0, longest = 0, freezes = 0;
  const frozen = [];
  const end = dayNum(today);
  for (let n = dayNum(past[0]); n <= end; n++) {
    const d = fromDayNum(n);
    if (set.has(d)) {
      streak += 1;
      if (streak % 7 === 0) freezes = Math.min(2, freezes + 1);
      longest = Math.max(longest, streak);
    } else if (d === today) {
      // today not done yet: never breaks the streak
    } else if (freezes > 0) {
      freezes -= 1; frozen.push(d);
    } else {
      streak = 0;
    }
  }
  return { current: streak, longest, freezes, frozenDates: frozen, doneToday: out.doneToday };
}

export function heatmap(dates, frozenDates, today, weeks = 17) {
  const on = new Set(dates), fr = new Set(frozenDates || []);
  const first = addDays(weekStartOf(today), -7 * (weeks - 1));
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(first, w * 7 + d);
      col.push({ date, on: on.has(date), frozen: fr.has(date), future: date > today });
    }
    cols.push(col);
  }
  return cols;
}

// ---------- fasting ----------
export const runningFast = (state) => state.fasts.find((f) => !f.end) || null;

export function startFast(state, now, goalHours) {
  if (runningFast(state)) return clone(state);
  const s = clone(state);
  s.fasts.push({
    id: makeId(now), start: toDate(now).toISOString(), end: null,
    goalHours: goalHours ?? s.settings.fastGoalHours, note: '', mood: null,
  });
  return s;
}

export function endFast(state, now) {
  const s = clone(state);
  const f = runningFast(s);
  if (!f) return s;
  const start = new Date(f.start).getTime();
  f.end = new Date(Math.max(toDate(now).getTime(), start + 60000)).toISOString();
  return s;
}

const isoOrThrow = (v, label) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} is not a valid date and time.`);
  return d.toISOString();
};

export function editFast(state, id, patch = {}) {
  const s = clone(state);
  const f = s.fasts.find((x) => x.id === id);
  if (!f) throw new Error('Fast not found.');
  const next = { ...f };
  if ('start' in patch) next.start = isoOrThrow(patch.start, 'Start');
  if ('end' in patch) next.end = patch.end == null ? null : isoOrThrow(patch.end, 'End');
  if ('note' in patch) next.note = String(patch.note ?? '');
  if ('mood' in patch) {
    if (patch.mood != null && !(Number.isInteger(patch.mood) && patch.mood >= 1 && patch.mood <= 5)) throw new Error('Mood must be 1 to 5.');
    next.mood = patch.mood ?? null;
  }
  if ('goalHours' in patch) {
    if (!(Number(patch.goalHours) > 0)) throw new Error('Goal must be more than 0 hours.');
    next.goalHours = Number(patch.goalHours);
  }
  if (next.end && new Date(next.end) <= new Date(next.start)) throw new Error('The end must be after the start.');
  if (!next.end && s.fasts.some((x) => x.id !== id && !x.end)) throw new Error('Only one fast can be running.');
  Object.assign(f, next);
  return s;
}

export function deleteFast(state, id) {
  const s = clone(state);
  s.fasts = s.fasts.filter((f) => f.id !== id);
  return s;
}

export function fastStage(hours) {
  let st = FAST_STAGES[0], i = 0;
  FAST_STAGES.forEach((x, k) => { if (hours >= x.fromH) { st = x; i = k; } });
  const nx = FAST_STAGES[i + 1];
  return { label: st.label, detail: st.detail, fromH: st.fromH, nextH: nx ? nx.fromH : null };
}

export function fastStats(state, now = new Date()) {
  const done = state.fasts
    .filter((f) => f.end)
    .map((f) => ({ id: f.id, start: f.start, end: f.end, hours: (new Date(f.end) - new Date(f.start)) / HOUR, goalHours: f.goalHours }))
    .sort((a, b) => new Date(a.end) - new Date(b.end));
  const last7 = done.slice(-7);
  return {
    avg7Hours: last7.length ? last7.reduce((a, b) => a + b.hours, 0) / last7.length : 0,
    longestHours: done.length ? Math.max(...done.map((x) => x.hours)) : 0,
    total: done.length,
    history: done.slice(-14),
  };
}

// ---------- progress ----------
export function weeklyVolume(state, today, weeks = 8) {
  const thisWeek = weekStartOf(today);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(thisWeek, -7 * i);
    const weekEnd = addDays(weekStart, 6);
    let sets = 0, reps = 0;
    for (const se of state.sessions) {
      if (se.date >= weekStart && se.date <= weekEnd) {
        sets += se.sets.length;
        // Reps only: core is logged in seconds, so it is left out.
        reps += se.sets.reduce((a, b) => a + (MOVES[b.moveId] && MOVES[b.moveId].unit === 'sec' ? 0 : (b.reps || 0)), 0);
      }
    }
    out.push({ weekStart, sets, reps });
  }
  return out;
}

// Ladder position per move per week: level index + progress through that level's rep range, plus 1 (level 1 at the bottom = 1.0).
export function moveTrend(state, today, weeks = 8) {
  const thisWeek = weekStartOf(today), work = workOf(state);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, -7 * (weeks - 1 - i)));
  return Object.values(MOVES).map((m) => {
    const usable = usableLevelIdx(m.id, state.settings.pullupBar);
    const points = starts.map((weekStart) => {
      const weekEnd = addDays(weekStart, 6);
      let top = -1, best = 0;
      for (const se of state.sessions) if (se.date >= weekStart && se.date <= weekEnd) for (const x of se.sets) {
        if (x.moveId !== m.id || x.level == null) continue;
        if (x.level > top) { top = x.level; best = 0; }
        if (x.level === top) best = Math.max(best, x.reps || 0);
      }
      if (top < 0) return { weekStart, score: null };
      let idx = usable.indexOf(top);
      if (idx < 0) idx = Math.max(0, usable.filter((i) => i < top).length - 1);
      const range = rangeOf(m.id, top, work);
      const frac = range[1] > range[0] ? clamp((best - range[0]) / (range[1] - range[0]), 0, 1) : 1;
      return { weekStart, score: idx + frac + 1, idx, frac };
    });
    return { moveId: m.id, name: m.name, unit: m.unit, levelsTotal: usable.length, points };
  });
}

export function moveProgress(state) {
  return Object.values(MOVES).map((m) => {
    const ms = state.moves[m.id] || defaultMove(m.id);
    const usable = usableLevelIdx(m.id, state.settings.pullupBar);
    const level = effectiveLevel(state, m.id);
    const idx = Math.max(0, usable.indexOf(level));
    const range = rangeOf(m.id, level, workOf(state));
    const frac = range[1] > range[0] ? clamp((ms.target - range[0]) / (range[1] - range[0]), 0, 1) : 1;
    let best = 0;
    for (const se of state.sessions) for (const x of se.sets) if (x.moveId === m.id && x.level === level) best = Math.max(best, x.reps);
    return {
      moveId: m.id, name: m.name, unit: m.unit, level, levelName: m.levels[level].name, idx, frac,
      levelsTotal: usable.length, target: clamp(ms.target, range[0], range[1]), range,
      pct: Math.round(clamp(((idx + frac) / usable.length) * 100, 0, 100)), best,
    };
  });
}

// ---------- rep totals ----------
// Reps (or seconds for 'sec' moves) per move. Every set counts: minimum days, legacy sets, and both sides of per-side sets.
const setReps = (x) => (Number.isFinite(x && x.reps) ? x.reps : 0);
export function repTotals(state, today) {
  const wk = weekStartOf(today), mo = addDays(today, -29);
  const acc = Object.fromEntries(MOVE_LIST.map((m) => [m.id, { today: 0, week: 0, month: 0, allTime: 0, lv: new Map() }]));
  for (const se of state.sessions) {
    for (const x of se.sets || []) {
      const a = acc[x.moveId];
      if (!a) continue;
      const r = setReps(x);
      a.allTime += r;
      if (se.date <= today) {
        if (se.date === today) a.today += r;
        if (se.date >= wk) a.week += r;
        if (se.date >= mo) a.month += r;
      }
      const key = x.level == null ? `legacy:${x.legacy || ''}` : `lv:${x.level}`;
      const e = a.lv.get(key) || { level: x.level ?? null, name: x.level == null ? (x.legacy || 'Retired exercise') : (MOVES[x.moveId].levels[x.level] || {}).name || `Level ${x.level + 1}`, allTime: 0 };
      e.allTime += r;
      a.lv.set(key, e);
    }
  }
  return MOVE_LIST.map((m) => {
    const a = acc[m.id];
    const levels = [...a.lv.values()].sort((p, q) => q.allTime - p.allTime || (p.level ?? 99) - (q.level ?? 99));
    return { moveId: m.id, name: m.name, unit: m.unit, today: a.today, week: a.week, month: a.month, allTime: a.allTime, levels };
  });
}

// Totals for one session's sets: [{ moveId, name, unit, total, bothSides }] in first-seen order.
export function sessionTotals(sets) {
  const out = new Map();
  for (const x of sets || []) {
    if (!MOVES[x.moveId]) continue;
    const e = out.get(x.moveId) || { moveId: x.moveId, name: MOVES[x.moveId].name, unit: MOVES[x.moveId].unit, total: 0, bothSides: false };
    e.total += setReps(x);
    if (x.side) e.bothSides = true;
    out.set(x.moveId, e);
  }
  return [...out.values()];
}

export const recentEvents = (state, n = 10) => state.events.slice().reverse().slice(0, n);

// ---------- growth ----------
export function growthOffer(state, today) {
  const cur = state.settings.sessionMinutes;
  const i = SESSION_MINUTES_STEPS.indexOf(cur);
  if (i === -1 || i >= SESSION_MINUTES_STEPS.length - 1) return null;
  const dis = state.settings.growthDismissedAt;
  if (dis && dayNum(today) - dayNum(todayStr(new Date(dis))) <= 14) return null;
  const days = new Set(trainingDates(state));
  const thisWeek = weekStartOf(today);
  for (let w = 1; w <= 4; w++) {
    const ws = addDays(thisWeek, -7 * w);
    let n = 0;
    for (let d = 0; d < 7; d++) if (days.has(addDays(ws, d))) n++;
    if (n < 5) return null;
  }
  return { minutes: SESSION_MINUTES_STEPS[i + 1] };
}

export function acceptGrowth(state) {
  const s = clone(state);
  const i = SESSION_MINUTES_STEPS.indexOf(s.settings.sessionMinutes);
  if (i !== -1 && i < SESSION_MINUTES_STEPS.length - 1) s.settings.sessionMinutes = SESSION_MINUTES_STEPS[i + 1];
  s.settings.growthDismissedAt = null;
  return s;
}

export function dismissGrowth(state, now) {
  const s = clone(state);
  s.settings.growthDismissedAt = toDate(now).toISOString();
  return s;
}

// ---------- pull-up bar ----------
export function barUnlockDue(state) {
  if (state.settings.pullupBar) return false;
  const ms = state.moves.row || defaultMove('row');
  const usable = usableLevelIdx('row', false);
  return ms.level === usable[usable.length - 1] && ms.target >= rangeOf('row', ms.level)[1];
}

export function setPullupBar(state, on) {
  const s = clone(state);
  const due = barUnlockDue(state);
  s.settings.pullupBar = !!on;
  for (const m of Object.values(MOVES)) {
    if (!m.levels.some((l) => l.requiresBar)) continue;
    const ms = s.moves[m.id];
    if (on && due && m.id === 'row') {
      ms.level = nextUsable('row', ms.level, true);
      ms.target = rangeOf('row', ms.level)[0]; ms.missStreak = 0;
    } else if (!on && m.levels[ms.level].requiresBar) {
      ms.level = prevUsable(m.id, ms.level, false) ?? 0;
      ms.target = rangeOf(m.id, ms.level)[1]; ms.missStreak = 0;
    }
  }
  return s;
}

// ---------- backup ----------
export function backupDue(state, now) {
  const { lastBackupAt, createdAt } = state.settings;
  const t = toDate(now).getTime();
  if (!lastBackupAt) return !!createdAt && t - new Date(createdAt).getTime() > 7 * DAY_MS;
  return t - new Date(lastBackupAt).getTime() > 7 * DAY_MS;
}

export function markBackedUp(state, now) {
  const s = clone(state);
  s.settings.lastBackupAt = toDate(now).toISOString();
  return s;
}

// ---------- migration (state.version 1 -> 2) ----------
// v2 replaces the hinge and row ladders. Old level -> new level. Levels marked removed have no new equivalent.
const LEGACY = {
  hinge: {
    map: { 0: 0, 1: 0, 2: 1, 3: 3 },
    names: ['Two-hand KB swing', 'One-arm KB swing (alternate sets)', 'Single-leg RDL with KB', 'Tempo single-leg RDL (3s down)'],
    removed: (old) => old <= 1,
  },
  row: {
    map: { 0: 1, 1: 1, 2: 1, 3: 1, 4: 5, 5: 6, 6: 7 },
    names: ['One-arm KB row', 'Tempo KB row (3s down)', 'Paused KB row (2s at top)', '1.5-rep KB row', 'Negative pull-up (5s down)', 'Chin-up', 'Pull-up'],
    removed: (old) => old <= 3,
  },
};
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// New level for an old level index, or null if the exercise was removed.
function newLevel(moveId, old) {
  const lg = LEGACY[moveId];
  if (!lg || !Number.isInteger(old)) return old;
  return lg.removed(old) ? null : (lg.map[old] ?? old);
}
function remapRecord(rec, moveId, withValue) {
  const lg = LEGACY[moveId];
  if (!isObj(rec) || !lg || !Number.isInteger(rec.level)) return;
  const old = rec.level;
  const nl = newLevel(moveId, old);
  if (nl === null) rec.legacy = lg.names[old] ?? `Level ${old + 1}`;
  rec.level = nl;
  if (withValue && Number.isInteger(rec.value)) rec.value = newLevel(moveId, rec.value);
}

// Pure and idempotent: a state at version 2 or higher is returned unchanged (as a copy).
export function migrate(state) {
  if (!isObj(state)) return state;
  if ((state.version ?? 1) >= 2) return clone(state);
  const s = clone(state);
  s.version = 2;
  s.settings = isObj(s.settings) ? s.settings : {};
  if (s.settings.workSec == null) s.settings.workSec = DEFAULT_WORK_SEC;
  s.moves = isObj(s.moves) ? s.moves : {};
  for (const [id, lg] of Object.entries(LEGACY)) {
    const mv = s.moves[id];
    if (!isObj(mv)) continue;
    const old = Number.isInteger(mv.level) ? mv.level : 0;
    mv.level = newLevel(id, old) ?? (lg.map[old] ?? 0);
    if (lg.removed(old)) { mv.calibrated = false; mv.missStreak = 0; }
  }
  for (const id of ['hamcurl', 'calf']) if (!isObj(s.moves[id])) s.moves[id] = defaultMove(id);
  for (const id of Object.keys(MOVES)) {
    const mv = s.moves[id];
    if (!isObj(mv)) continue;
    mv.level = clamp(Number.isInteger(mv.level) ? mv.level : 0, 0, MOVES[id].levels.length - 1);
    const [lo, hi] = rangeOf(id, mv.level, s.settings.workSec);
    mv.target = clamp(Number.isFinite(mv.target) ? mv.target : lo, lo, hi);
  }
  for (const se of Array.isArray(s.sessions) ? s.sessions : []) {
    for (const x of Array.isArray(se && se.sets) ? se.sets : []) if (isObj(x)) remapRecord(x, x.moveId, false);
  }
  for (const e of Array.isArray(s.events) ? s.events : []) {
    if (isObj(e)) remapRecord(e, e.moveId, e.type === 'levelUp' || e.type === 'levelDown');
  }
  return s;
}
