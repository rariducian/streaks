import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { MOVES, DAYS, FAST_STAGES, TOE_RULE } from '../js/data.js';
import * as store from '../js/store.js';

const D = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi);
const fresh = () => L.defaultState(D(2026, 1, 1));
const sets = (moveId, level, reps, n = 5) => Array.from({ length: n }, () => ({ moveId, level, reps }));
const finish = (st, ss, extra = {}) =>
  L.finishSession(st, { startedAt: D(2026, 2, 2, 7), endedAt: D(2026, 2, 2, 7, 10), minimum: false, sets: ss, ...extra });
const withMove = (st, id, patch) => { const s = structuredClone(st); Object.assign(s.moves[id], patch); return s; };
const withSessions = (st, dates) => { const s = structuredClone(st); s.sessions = dates.map((date, i) => ({ id: 's' + i, date, sets: [], minimum: false })); return s; };
const range = (start, n) => Array.from({ length: n }, (_, i) => L.addDays(start, i));

test('todayStr uses local date parts', () => {
  assert.equal(L.todayStr(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(L.todayStr(new Date(2026, 11, 31, 0, 1)), '2026-12-31');
});

test('defaultState has every move', () => {
  const s = fresh();
  for (const id of Object.keys(MOVES)) assert.deepEqual(s.moves[id], { level: 0, target: L.rangeOf(id, 0)[0], calibrated: false, missStreak: 0 });
  assert.equal(s.version, 2);
  assert.equal(s.settings.workSec, 40);
  assert.equal(s.settings.fastMinHours, 12);
});

test('rotation order and currentDay', () => {
  let s = fresh();
  const seen = [];
  for (let i = 0; i < 4; i++) {
    seen.push(L.currentDay(s).id);
    s = finish(s, [], { minimum: true }).state;
  }
  assert.deepEqual(seen, ['upper', 'legs', 'full', 'upper']);
});

test('calibration placement', () => {
  const s = fresh();
  assert.deepEqual(L.placeFromCalibration(s, 'hpush', 0, 30), { level: 0, target: 15, tooEasy: true, tooHard: false });
  assert.deepEqual(L.placeFromCalibration(s, 'hpush', 0, 15), { level: 0, target: 10, tooEasy: false, tooHard: false });
  assert.deepEqual(L.placeFromCalibration(s, 'hpush', 0, 3), { level: 0, target: 6, tooEasy: false, tooHard: false });
  const r = L.placeFromCalibration(s, 'hpush', 2, 3);
  assert.equal(r.tooHard, true); assert.equal(r.target, 6);
  // uses the level range: archer is [6,12], one-arm is [3,8]
  assert.deepEqual(L.placeFromCalibration(s, 'hpush', 4, 30), { level: 4, target: 12, tooEasy: true, tooHard: false });
  const top = L.placeFromCalibration(s, 'hpush', 6, 40);
  assert.equal(top.tooEasy, false); assert.equal(top.target, 8);
  assert.equal(L.placeFromCalibration(s, 'row', 4, 40).tooEasy, false);
  assert.equal(L.placeFromCalibration(s, 'row', 4, 40).target, 12);
  const bar = L.setPullupBar(s, true);
  assert.equal(L.placeFromCalibration(bar, 'row', 4, 40).tooEasy, true);
});

test('applyCalibration sets state, no mutation', () => {
  const s = fresh();
  const n = L.applyCalibration(s, 'hpush', 2, 9);
  assert.deepEqual(n.moves.hpush, { level: 2, target: 9, calibrated: true, missStreak: 0 });
  assert.equal(s.moves.hpush.calibrated, false);
});

const ids = (p) => p.slots.map((x) => x.moveId + (x.side || ''));

test('sessionPlan: counts per minutes, blocks, per-side pairs', () => {
  const s = fresh();
  const min = L.sessionPlan(s, { minimum: true });
  assert.equal(min.minutes, 3);
  assert.deepEqual(ids(min), ['hpush', 'row', 'hpush']);
  assert.deepEqual(min.slots.map((x) => x.minute), [1, 2, 3]);
  assert.ok(min.moves.every((m) => !m.needsCalibration));
  assert.equal(min.moves.length, 2);

  // upper day: hpush (1 slot), row level 0 (1 slot), vpush KB press (per side, 2 slots)
  const p10 = L.sessionPlan(s);
  assert.equal(p10.moves.length, 3);
  assert.equal(p10.minutes, 10); assert.equal(p10.slots.length, 10);
  assert.deepEqual(ids(p10), ['hpush', 'row', 'vpushL', 'vpushR', 'hpush', 'row', 'vpushL', 'vpushR', 'hpush', 'row']);
  assert.deepEqual(p10.slots.map((x) => x.minute), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(p10.dayId, 'upper'); assert.equal(p10.dayName, 'Upper');
  assert.ok(p10.moves.every((m) => m.needsCalibration));
  assert.ok(p10.moves[0].cue && p10.moves[0].levelName);
  assert.equal(p10.moves.find((m) => m.moveId === 'vpush').perSide, true);
  assert.equal(p10.moves.find((m) => m.moveId === 'hpush').perSide, false);
  assert.ok(p10.slots.every((x) => x.side === null || x.side === 'L' || x.side === 'R'));

  s.settings.sessionMinutes = 15;
  const p15 = L.sessionPlan(s);
  assert.equal(p15.moves.length, 4); assert.equal(p15.slots.length, 15);
  s.settings.sessionMinutes = 20;
  const p20 = L.sessionPlan(s);
  assert.equal(p20.moves.length, 5); assert.equal(p20.slots.length, 20);
  assert.deepEqual(p20.moves.map((m) => m.moveId), DAYS[0].moves);
});

test('sessionPlan: a block that does not fit is skipped for one that fits; stops when none fits', () => {
  // hpush level 6 and vpush level 0 are per-side; row level 0 is not. Upper day: hpush, row, vpush.
  let s = withMove(withMove(fresh(), 'hpush', { level: 6, target: 5 }), 'row', { level: 0 });
  const p = L.sessionPlan(s);
  // hpush(2) row(1) vpush(2) = 5, again = 10
  assert.deepEqual(ids(p), ['hpushL', 'hpushR', 'row', 'vpushL', 'vpushR', 'hpushL', 'hpushR', 'row', 'vpushL', 'vpushR']);
  // minimum day (3 slots): hpush(2), row(1)
  assert.deepEqual(ids(L.sessionPlan(s, { minimum: true })), ['hpushL', 'hpushR', 'row']);
  // both moves per-side in a 3-minute plan: first block fills 2, nothing else fits in 1 slot, so the plan stops at 2
  s = withMove(fresh(), 'hpush', { level: 6, target: 5 });
  s.rotationIndex = 1;                           // legs: squat, hamcurl, calf
  s = withMove(withMove(s, 'squat', { level: 2 }), 'hamcurl', { level: 2 });
  s = withMove(s, 'calf', { level: 1 });
  const m = L.sessionPlan(s, { minimum: true });  // squat PS + hamcurl PS
  assert.equal(m.minutes, 2); assert.equal(m.slots.length, 2);
  assert.deepEqual(ids(m), ['squatL', 'squatR']);
  // a fitting bilateral move later in the order is used when the next block is too big
  s = withMove(withMove(fresh(), 'squat', { level: 2 }), 'hamcurl', { level: 0 });
  s.rotationIndex = 1;
  const m2 = L.sessionPlan(s, { minimum: true });
  assert.deepEqual(ids(m2), ['squatL', 'squatR', 'hamcurl']);
  // 10 min with 3 per-side moves of 2 slots each: 2+2+2+2+2
  s = withMove(withMove(withMove(fresh(), 'squat', { level: 2 }), 'hamcurl', { level: 2 }), 'calf', { level: 1 });
  s.rotationIndex = 1;
  const p3 = L.sessionPlan(s);
  assert.equal(p3.minutes, 10);
  assert.deepEqual(ids(p3), ['squatL', 'squatR', 'hamcurlL', 'hamcurlR', 'calfL', 'calfR', 'squatL', 'squatR', 'hamcurlL', 'hamcurlR']);
  // 15 min: block of 2 would not fit when 1 slot is left; the plan can end early
  s.settings.sessionMinutes = 15;
  const p4 = L.sessionPlan(s);   // squat, hamcurl, calf, vpush(level 0, per side): all 2-slot blocks -> 14 slots, 1 left, none fits
  assert.equal(p4.minutes, 14); assert.equal(p4.slots.length, 14);
  assert.deepEqual(p4.slots.map((x) => x.minute), Array.from({ length: 14 }, (_, i) => i + 1));
});

test('sessionPlan: sec target is capped by work time', () => {
  let s = withMove(fresh(), 'core', { level: 0, target: 40, calibrated: true });
  s.rotationIndex = 0; s.settings.sessionMinutes = 20;
  assert.equal(L.sessionPlan(s).moves.find((m) => m.moveId === 'core').target, 40);
  s.settings.workSec = 30;
  const c = L.sessionPlan(s).moves.find((m) => m.moveId === 'core');
  assert.equal(c.target, 30); assert.deepEqual(c.range, [20, 30]);
  assert.equal(L.sessionPlan(s).workSec, 30);
});

test('rangeOf: level range, move range, sec cap', () => {
  assert.deepEqual(L.rangeOf('hpush', 0), [6, 15]);
  assert.deepEqual(L.rangeOf('hpush', 4), [6, 12]);
  assert.deepEqual(L.rangeOf('hpush', 5), [5, 12]);
  assert.deepEqual(L.rangeOf('hpush', 6), [3, 8]);
  assert.deepEqual(L.rangeOf('core', 0), [20, 40]);
  assert.deepEqual(L.rangeOf('core', 0, 40), [20, 40]);
  assert.deepEqual(L.rangeOf('core', 0, 30), [20, 30]);
  assert.deepEqual(L.rangeOf('core', 4), [10, 30]);
  assert.deepEqual(L.rangeOf('core', 4, 30), [10, 30]);
  assert.deepEqual(L.rangeOf('core', 4, 20), [10, 20]);
  assert.deepEqual(L.rangeOf('row', 0, 30), [8, 15], 'cap applies to sec moves only');
  for (const m of Object.values(MOVES)) m.levels.forEach((_, i) => { const [a, b] = L.rangeOf(m.id, i, 30); assert.ok(a <= b, `${m.id}[${i}]`); });
});

test('requiresBar levels are skipped when no bar (plan clamps)', () => {
  let s = withMove(fresh(), 'row', { level: 6, target: 5, calibrated: true });
  assert.equal(L.sessionPlan(s).moves[1].moveId, 'row');
  assert.equal(L.sessionPlan(s).moves[1].level, 4);
  s = L.setPullupBar(s, true);
  assert.equal(L.sessionPlan(s).moves[1].level, 6);
});

test('progression: target = lowest set + 1 (double progression), never lowered', () => {
  const s = withMove(fresh(), 'hpush', { target: 10, calibrated: true });
  let r = finish(s, [...sets('hpush', 0, 12, 4), { moveId: 'hpush', level: 0, reps: 10 }]);
  assert.equal(r.state.moves.hpush.target, 11);
  assert.deepEqual(r.events.map((e) => [e.type, e.moveId, e.value]), [['targetUp', 'hpush', 11]]);
  assert.equal(r.state.events.length, 1);
  assert.equal(s.moves.hpush.target, 10, 'input not mutated');
  assert.equal(s.sessions.length, 0);
  // the lowest set is below the target: the target stays
  r = finish(s, [...sets('hpush', 0, 14, 4), { moveId: 'hpush', level: 0, reps: 8 }]);
  assert.equal(r.state.moves.hpush.target, 10);
  assert.equal(r.events.length, 0);
  // jumps by more than one
  r = finish(s, sets('hpush', 0, 14));
  assert.equal(r.state.moves.hpush.target, 15);
  // clamped to the max, and equal to target gives no event
  r = finish(withMove(s, 'hpush', { target: 15 }), [...sets('hpush', 0, 15, 4), { moveId: 'hpush', level: 0, reps: 14 }]);
  assert.equal(r.state.moves.hpush.target, 15); assert.equal(r.events.length, 0);
});

test('progression: sec moves step by 5', () => {
  let s = withMove(fresh(), 'core', { target: 20, calibrated: true });
  s.rotationIndex = 0;
  const r = finish(s, sets('core', 0, 25, 3));
  assert.equal(r.state.moves.core.target, 30);
  // all sets at the work-time cap level up
  const t = finish(withMove(s, 'core', { target: 35 }), sets('core', 0, 40, 3));
  assert.equal(t.state.moves.core.level, 1); assert.equal(t.state.moves.core.target, 20);
});

test('progression: levelUp when every set reaches range max', () => {
  const s = withMove(fresh(), 'hpush', { target: 12, calibrated: true });
  const r = finish(s, sets('hpush', 0, 15));
  assert.equal(r.state.moves.hpush.level, 1);
  assert.equal(r.state.moves.hpush.target, 6);
  assert.ok(r.events.some((e) => e.type === 'levelUp' && e.level === 1));
  // new level range min: archer is [6,12]; pseudo-planche [5,12]; one-arm [3,8]
  const a = finish(withMove(s, 'hpush', { level: 4, target: 10 }), sets('hpush', 4, 12));
  assert.equal(a.state.moves.hpush.level, 5); assert.equal(a.state.moves.hpush.target, 5);
  const b = finish(withMove(s, 'hpush', { level: 5, target: 10 }), sets('hpush', 5, 12));
  assert.equal(b.state.moves.hpush.level, 6); assert.equal(b.state.moves.hpush.target, 3);
  // not every set at max: no level up
  const c = finish(withMove(s, 'hpush', { level: 4, target: 10 }), [...sets('hpush', 4, 12, 4), { moveId: 'hpush', level: 4, reps: 11 }]);
  assert.equal(c.state.moves.hpush.level, 4);
});

test('progression: top level: target goes to max, no event', () => {
  const s = withMove(fresh(), 'hpush', { level: 6, target: 5, calibrated: true });
  const r = finish(s, sets('hpush', 6, 8));
  assert.equal(r.state.moves.hpush.level, 6);
  assert.equal(r.state.moves.hpush.target, 8);
  assert.ok(!r.events.some((e) => e.type === 'levelUp'));
});

test('progression: no levelUp into bar levels without bar; target caps at max', () => {
  const s = withMove(fresh(), 'row', { level: 4, target: 8, calibrated: true });
  const r = finish(s, sets('row', 4, 12));
  assert.equal(r.state.moves.row.level, 4);
  assert.equal(r.state.moves.row.target, 12);
  assert.ok(!r.events.some((e) => e.type === 'levelUp'));
  const b = finish(L.setPullupBar(s, true), sets('row', 4, 12));
  assert.equal(b.state.moves.row.level, 5); assert.equal(b.state.moves.row.target, 2);
});

test('progression: only sets at the current level count; null-level sets are ignored', () => {
  const s = withMove(fresh(), 'hpush', { level: 1, target: 8, calibrated: true });
  const r = finish(s, [...sets('hpush', 0, 15), { moveId: 'hpush', level: null, legacy: 'x', reps: 15 }]);
  assert.equal(r.state.moves.hpush.target, 8);
  assert.equal(r.events.length, 0);
});

test('progression: levelDown after 2 sessions with mean below range min', () => {
  const s = withMove(fresh(), 'hpush', { level: 2, target: 10, calibrated: true });
  let r = finish(s, sets('hpush', 2, 3));
  assert.equal(r.state.moves.hpush.missStreak, 1);
  assert.equal(r.state.moves.hpush.level, 2);
  assert.equal(r.state.moves.hpush.target, 10, 'the target is not lowered by one bad session');
  r = finish(r.state, sets('hpush', 2, 3));
  assert.equal(r.state.moves.hpush.level, 1);
  assert.equal(r.state.moves.hpush.target, Math.round((6 + 15) / 2));
  assert.equal(r.state.moves.hpush.missStreak, 0);
  assert.ok(r.events.some((e) => e.type === 'levelDown'));
  // level down uses the new level's range: from archer [6,12] to diamond/feet... level 3 has the move range
  const t = withMove(fresh(), 'hpush', { level: 5, target: 8, calibrated: true, missStreak: 1 });
  const d = finish(t, sets('hpush', 5, 2));
  assert.equal(d.state.moves.hpush.level, 4);
  assert.equal(d.state.moves.hpush.target, Math.round((6 + 12) / 2));
});

test('progression: levelDown never goes below 0', () => {
  const s = withMove(fresh(), 'hpush', { level: 0, target: 6, calibrated: true, missStreak: 1 });
  const r = finish(s, sets('hpush', 0, 2));
  assert.equal(r.state.moves.hpush.level, 0);
});

test('progression: a set at or above min but below max keeps missStreak at 0', () => {
  const s = withMove(fresh(), 'hpush', { target: 10, calibrated: true, missStreak: 1 });
  const r = finish(s, [...sets('hpush', 0, 10, 4), { moveId: 'hpush', level: 0, reps: 8 }]);
  assert.equal(r.state.moves.hpush.target, 10);
  assert.equal(r.state.moves.hpush.missStreak, 0);
  assert.equal(r.events.length, 0);
});

test('per-side sets are stored with their side and both count', () => {
  const s = withMove(fresh(), 'vpush', { target: 6, calibrated: true });
  const two = [{ moveId: 'vpush', level: 0, reps: 9, side: 'L' }, { moveId: 'vpush', level: 0, reps: 7, side: 'R' }];
  const r = finish(s, two);
  assert.equal(r.state.sessions[0].sets[0].side, 'L');
  assert.equal(r.state.moves.vpush.target, 8, 'lowest set (7) + 1');
  assert.equal(r.state.sessions[0].workSec, 40);
});

test('minimum session changes nothing but records and advances rotation', () => {
  const s = withMove(fresh(), 'hpush', { target: 10, calibrated: true });
  const r = finish(s, sets('hpush', 0, 12, 2), { minimum: true });
  assert.deepEqual(r.state.moves, s.moves);
  assert.equal(r.events.length, 0);
  assert.equal(r.state.sessions.length, 1);
  assert.equal(r.state.sessions[0].minimum, true);
  assert.equal(r.state.sessions[0].minutes, 3);
  assert.equal(r.state.rotationIndex, 1);
  assert.equal(r.state.sessions[0].date, '2026-02-02');
  assert.equal(r.state.sessions[0].dayId, 'upper');
});

test('pb event when beating prior best at same move+level', () => {
  const s = withMove(fresh(), 'hpush', { target: 20, calibrated: true });
  let r = finish(s, sets('hpush', 0, 8));
  assert.ok(!r.events.some((e) => e.type === 'pb'));
  r = finish(r.state, [...sets('hpush', 0, 8, 4), { moveId: 'hpush', level: 0, reps: 12 }]);
  const pb = r.events.find((e) => e.type === 'pb');
  assert.ok(pb); assert.equal(pb.value, 12);
});

test('barUnlockDue and setPullupBar', () => {
  const s = withMove(fresh(), 'row', { level: 4, target: 12, calibrated: true });
  assert.equal(L.barUnlockDue(s), true);
  assert.equal(L.barUnlockDue(withMove(fresh(), 'row', { level: 4, target: 11 })), false);
  assert.equal(L.barUnlockDue(withMove(fresh(), 'row', { level: 3, target: 10 })), false);
  assert.equal(L.barUnlockDue(fresh()), false);
  const b = L.setPullupBar(s, true);
  assert.equal(b.settings.pullupBar, true);
  assert.equal(b.moves.row.level, 5);
  assert.equal(b.moves.row.target, 2);
  assert.equal(L.barUnlockDue(b), false);
  const c = L.setPullupBar(withMove(fresh(), 'row', { level: 2, target: 8 }), true);
  assert.equal(c.moves.row.level, 2);
  const d = L.setPullupBar(withMove(b, 'row', { level: 6 }), false);
  assert.equal(d.moves.row.level, 4);
  assert.equal(d.moves.row.target, 12);
});

test('computeStreak: simple run, longest, doneToday', () => {
  const r = L.computeStreak(['2026-03-01', '2026-03-02', '2026-03-03'], '2026-03-03');
  assert.deepEqual(r, { current: 3, longest: 3, freezes: 0, frozenDates: [], doneToday: true });
});

test('computeStreak: today not done does not break', () => {
  const r = L.computeStreak(['2026-03-01', '2026-03-02'], '2026-03-03');
  assert.equal(r.current, 2); assert.equal(r.doneToday, false);
});

test('computeStreak: reset on miss without freeze, longest kept', () => {
  const r = L.computeStreak(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05'], '2026-03-05');
  assert.equal(r.current, 1); assert.equal(r.longest, 3); assert.deepEqual(r.frozenDates, []);
});

test('computeStreak: freeze earned at 7, consumed on a miss', () => {
  const seven = range('2026-03-01', 7);
  let r = L.computeStreak(seven, '2026-03-07');
  assert.equal(r.current, 7); assert.equal(r.freezes, 1);
  r = L.computeStreak([...seven, '2026-03-09'], '2026-03-09');
  assert.equal(r.current, 8); assert.equal(r.freezes, 0);
  assert.deepEqual(r.frozenDates, ['2026-03-08']);
  r = L.computeStreak([...seven, '2026-03-10'], '2026-03-10');
  assert.equal(r.current, 1); assert.equal(r.longest, 7); assert.deepEqual(r.frozenDates, ['2026-03-08']);
});

test('computeStreak: freeze cap 2', () => {
  const r = L.computeStreak(range('2026-03-01', 21), '2026-03-21');
  assert.equal(r.current, 21); assert.equal(r.freezes, 2);
  assert.equal(L.computeStreak(range('2026-03-01', 28), '2026-03-28').freezes, 2);
});

test('computeStreak: empty and DST-spanning ranges', () => {
  assert.deepEqual(L.computeStreak([], '2026-03-01'), { current: 0, longest: 0, freezes: 0, frozenDates: [], doneToday: false });
  assert.equal(L.computeStreak(range('2026-10-01', 10), '2026-10-10').current, 10);
});

test('fastingDates with min hours and running fast', () => {
  const s = fresh();
  s.fasts = [
    { id: 'a', start: D(2026, 3, 1, 20).toISOString(), end: D(2026, 3, 2, 12).toISOString(), goalHours: 16, note: '', mood: null },
    { id: 'b', start: D(2026, 3, 3, 20).toISOString(), end: D(2026, 3, 4, 6).toISOString(), goalHours: 16, note: '', mood: null },
    { id: 'c', start: D(2026, 3, 5, 18).toISOString(), end: null, goalHours: 16, note: '', mood: null },
  ];
  assert.deepEqual(L.fastingDates(s, D(2026, 3, 5, 20)), ['2026-03-02']);
  assert.deepEqual(L.fastingDates(s, D(2026, 3, 6, 8)), ['2026-03-02', '2026-03-06']);
  s.settings.fastMinHours = 10;
  assert.deepEqual(L.fastingDates(s, D(2026, 3, 5, 20)), ['2026-03-02', '2026-03-04']);
});

test('start/end/edit/delete fast', () => {
  let s = L.startFast(fresh(), D(2026, 3, 1, 20), 18);
  assert.equal(L.runningFast(s).goalHours, 18);
  assert.equal(L.startFast(s, D(2026, 3, 1, 21), 16).fasts.length, 1);
  s = L.endFast(s, D(2026, 3, 2, 12));
  assert.equal(L.runningFast(s), null);
  assert.equal(s.fasts[0].end, D(2026, 3, 2, 12).toISOString());
  const id = s.fasts[0].id;
  assert.throws(() => L.editFast(s, id, { end: D(2026, 3, 1, 20).toISOString() }), /after the start/);
  assert.throws(() => L.editFast(s, id, { end: D(2026, 3, 1, 10).toISOString() }), Error);
  assert.throws(() => L.editFast(s, id, { start: D(2026, 3, 3).toISOString() }), Error);
  assert.throws(() => L.editFast(s, id, { mood: 9 }), Error);
  const e = L.editFast(s, id, { note: 'ok', mood: 4, goalHours: 20, start: D(2026, 3, 1, 18).toISOString() });
  assert.equal(e.fasts[0].note, 'ok'); assert.equal(e.fasts[0].mood, 4); assert.equal(e.fasts[0].goalHours, 20);
  assert.equal(s.fasts[0].note, '');
  assert.equal(L.deleteFast(e, id).fasts.length, 0);
});

test('fastStage boundaries', () => {
  assert.equal(L.fastStage(0).label, 'Fed state');
  assert.equal(L.fastStage(3.99).label, 'Fed state');
  assert.equal(L.fastStage(4).label, 'Blood sugar settling');
  assert.equal(L.fastStage(11.9).label, 'Blood sugar settling');
  assert.equal(L.fastStage(12).label, 'Switching to fat');
  assert.equal(L.fastStage(16).label, 'Fat burning ramps up');
  assert.equal(L.fastStage(24).label, 'Deep fast');
  assert.equal(L.fastStage(80).nextH, null);
  const s = L.fastStage(5);
  assert.equal(s.fromH, 4); assert.equal(s.nextH, 12); assert.ok(s.detail);
  assert.equal(FAST_STAGES.length, 5);
});

test('fastStats', () => {
  const s = fresh();
  for (let i = 0; i < 16; i++) {
    const start = D(2026, 3, 1 + i, 20);
    s.fasts.push({ id: 'f' + i, start: start.toISOString(), end: new Date(start.getTime() + (10 + i) * 3600000).toISOString(), goalHours: 16, note: '', mood: null });
  }
  s.fasts.push({ id: 'run', start: D(2026, 4, 1).toISOString(), end: null, goalHours: 16, note: '', mood: null });
  const st = L.fastStats(s);
  assert.equal(st.total, 16);
  assert.equal(st.history.length, 14);
  assert.equal(st.history[0].id, 'f2'); assert.equal(st.history[13].id, 'f15');
  assert.equal(st.longestHours, 25);
  assert.equal(st.avg7Hours, (19 + 20 + 21 + 22 + 23 + 24 + 25) / 7);
  assert.deepEqual(Object.keys(st.history[0]).sort(), ['end', 'goalHours', 'hours', 'id', 'start']);
  assert.deepEqual(L.fastStats(fresh()), { avg7Hours: 0, longestHours: 0, total: 0, history: [] });
});

test('weeklyVolume uses Monday weeks', () => {
  const s = fresh();
  s.sessions = [
    { date: '2026-03-08', sets: sets('hpush', 0, 10) },
    { date: '2026-03-09', sets: sets('hpush', 0, 10, 4) },
    { date: '2026-03-15', sets: sets('hpush', 0, 5, 2) },
  ];
  const v = L.weeklyVolume(s, '2026-03-12', 3);
  assert.deepEqual(v.map((x) => x.weekStart), ['2026-02-23', '2026-03-02', '2026-03-09']);
  assert.deepEqual(v[1], { weekStart: '2026-03-02', sets: 5, reps: 50 });
  assert.deepEqual(v[2], { weekStart: '2026-03-09', sets: 6, reps: 50 });
  assert.equal(L.weeklyVolume(s, '2026-03-12').length, 8);
});

test('weeklyVolume reps leave out core seconds', () => {
  const s = fresh();
  s.sessions = [{ date: '2026-03-10', sets: [...sets('hpush', 0, 10, 2), ...sets('core', 0, 30, 2)] }];
  assert.deepEqual(L.weeklyVolume(s, '2026-03-12', 1)[0], { weekStart: '2026-03-09', sets: 4, reps: 20 });
});

test('moveTrend: null for weeks with no sets', () => {
  const t = L.moveTrend(fresh(), '2026-03-12', 3);
  assert.deepEqual(t[0].points, [{ weekStart: '2026-02-23', score: null }, { weekStart: '2026-03-02', score: null }, { weekStart: '2026-03-09', score: null }]);
});

test('moveTrend: highest level that week, best reps at that level', () => {
  const s = fresh();
  s.sessions = [{ date: '2026-03-10', sets: [...sets('hpush', 0, 15, 2), ...sets('hpush', 1, 8, 1), { moveId: 'hpush', level: 1, reps: 10 }] }];
  const [lo, hi] = L.rangeOf('hpush', 1, 40), p = L.moveTrend(s, '2026-03-12', 2).find((x) => x.moveId === 'hpush').points;
  assert.equal(p[0].score, null);
  assert.ok(Math.abs(p[1].score - (1 + (10 - lo) / (hi - lo) + 1)) < 1e-9);
});

test('moveTrend: legacy null-level sets are ignored', () => {
  const s = fresh();
  s.sessions = [{ date: '2026-03-10', sets: sets('hpush', null, 12, 3) }, { date: '2026-03-11', sets: sets('hpush', undefined, 12, 1) }];
  assert.equal(L.moveTrend(s, '2026-03-12', 1).find((x) => x.moveId === 'hpush').points[0].score, null);
});

test('moveTrend: one entry per move in moveProgress order, weeks oldest first', () => {
  const s = fresh(), t = L.moveTrend(s, '2026-03-12');
  assert.deepEqual(t.map((x) => x.moveId), L.moveProgress(s).map((x) => x.moveId));
  assert.deepEqual(t.map((x) => x.levelsTotal), L.moveProgress(s).map((x) => x.levelsTotal));
  for (const x of t) { assert.equal(x.points.length, 8); assert.equal(x.points[7].weekStart, '2026-03-09'); }
  assert.equal(L.moveTrend(s, '2026-03-12', 3)[0].points.length, 3);
});

test('growthOffer', () => {
  const today = '2026-03-18';
  const five = (ws) => range(ws, 5);
  const dates = ['2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09'].flatMap(five);
  const s = withSessions(fresh(), dates);
  assert.deepEqual(L.growthOffer(s, today), { minutes: 15 });
  assert.equal(L.growthOffer(withSessions(fresh(), dates.filter((d) => d !== '2026-03-03')), today), null);
  assert.equal(L.growthOffer(withSessions(fresh(), ['2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16'].flatMap(five)), today), null);
  assert.equal(L.growthOffer(L.dismissGrowth(s, D(2026, 3, 10)), today), null);
  assert.deepEqual(L.growthOffer(L.dismissGrowth(s, D(2026, 3, 1)), today), { minutes: 15 });
  let a = L.acceptGrowth(s); assert.equal(a.settings.sessionMinutes, 15);
  assert.deepEqual(L.growthOffer(a, today), { minutes: 20 });
  a = L.acceptGrowth(a); assert.equal(a.settings.sessionMinutes, 20);
  assert.equal(L.growthOffer(a, today), null);
  assert.equal(L.acceptGrowth(a).settings.sessionMinutes, 20);
});

test('backupDue', () => {
  const s = fresh();
  assert.equal(L.backupDue(s, D(2026, 1, 5)), false);
  assert.equal(L.backupDue(s, D(2026, 1, 9)), true);
  const b = L.markBackedUp(s, D(2026, 2, 1));
  assert.equal(L.backupDue(b, D(2026, 2, 5)), false);
  assert.equal(L.backupDue(b, D(2026, 2, 9)), true);
});

test('heatmap shape', () => {
  const today = '2026-03-18';
  const h = L.heatmap(['2026-03-17'], ['2026-03-16'], today);
  assert.equal(h.length, 17);
  assert.ok(h.every((c) => c.length === 7));
  const last = h[16];
  assert.equal(last[0].date, '2026-03-16');
  assert.equal(last[2].date, '2026-03-18');
  assert.equal(last[0].frozen, true); assert.equal(last[1].on, true);
  assert.deepEqual(last.map((c) => c.future), [false, false, false, true, true, true, true]);
  assert.equal(h[0][0].date, L.addDays('2026-03-16', -16 * 7));
  assert.equal(L.heatmap([], [], today, 5).length, 5);
});

test('moveProgress and recentEvents', () => {
  const s = withMove(fresh(), 'hpush', { level: 1, target: 15 });
  const p = L.moveProgress(s);
  assert.equal(p.length, Object.keys(MOVES).length);
  const h = p.find((x) => x.moveId === 'hpush');
  assert.equal(h.levelName, MOVES.hpush.levels[1].name);
  assert.equal(h.levelsTotal, 7);
  assert.equal(h.pct, Math.round((2 / 7) * 100));
  assert.deepEqual(h.range, [6, 15]);
  assert.deepEqual(L.moveProgress(withMove(fresh(), 'hpush', { level: 6, target: 8 })).find((x) => x.moveId === 'hpush').range, [3, 8]);
  assert.equal(p.find((x) => x.moveId === 'row').levelsTotal, 5);
  assert.equal(L.moveProgress(L.setPullupBar(s, true)).find((x) => x.moveId === 'row').levelsTotal, 8);
  const e = fresh(); e.events = [1, 2, 3].map((i) => ({ id: 'e' + i }));
  assert.deepEqual(L.recentEvents(e, 2).map((x) => x.id), ['e3', 'e2']);
});

test('store: normalise fills defaults; importJSON validates', () => {
  const n = store.normalise({ version: 1, settings: { soundOn: false }, moves: { hpush: { level: 2 } } });
  assert.equal(n.settings.soundOn, false);
  assert.equal(n.settings.fastMinHours, 12);
  assert.equal(n.moves.hpush.level, 2);
  assert.equal(n.moves.hpush.target, 6);
  for (const id of Object.keys(MOVES)) assert.ok(n.moves[id]);
  assert.deepEqual(store.importJSON(store.exportJSON(fresh())).moves, fresh().moves);
  assert.throws(() => store.importJSON('nope'), /valid JSON/);
  assert.throws(() => store.importJSON('[]'), Error);
  assert.throws(() => store.importJSON('{"version":3}'), /version/);
  assert.equal(store.importJSON('{"version":2}').version, 2);
  assert.throws(() => store.importJSON('{"version":1,"sessions":5}'), /sessions/);
});

test('store: works without localStorage and with a fake one', () => {
  assert.equal(globalThis.localStorage, undefined);
  assert.equal(store.save(fresh()), false);
  assert.equal(store.load().version, 2);
  const mem = {};
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  try {
    const s = withMove(fresh(), 'hpush', { target: 9 });
    assert.equal(store.save(s), true);
    assert.equal(store.load().moves.hpush.target, 9);
    mem[store.STORAGE_KEY] = '{broken';
    assert.equal(store.load().moves.hpush.target, 6);
  } finally { delete globalThis.localStorage; }
});

test('data sanity: DAYS integrity', () => {
  assert.equal(DAYS.length, 3);
  assert.deepEqual(DAYS.map((d) => d.id), ['upper', 'legs', 'full']);
  const used = new Set();
  for (const d of DAYS) for (const m of d.moves) { assert.ok(MOVES[m], `unknown move ${m}`); used.add(m); }
  for (const id of Object.keys(MOVES)) assert.ok(used.has(id), `move ${id} is not used by any day`);
  assert.equal(MOVES.row.levels.filter((l) => l.requiresBar).length, 3);
  for (const m of Object.values(MOVES)) {
    assert.equal('perSide' in m, false, 'perSide lives on levels');
    m.levels.forEach((l, i) => {
      assert.ok(l.name && l.cue, `${m.id}[${i}] name and cue`);
      const [a, b] = L.rangeOf(m.id, i);
      assert.ok(a > 0 && a < b, `${m.id}[${i}] range`);
    });
  }
  for (const l of MOVES.calf.levels) assert.ok(l.cue.endsWith(TOE_RULE), 'calf cues end with the toe rule');
  assert.ok(MOVES.row.levels.slice(1, 5).every((l) => l.cue.includes('Test the table first.')));
  assert.deepEqual(MOVES.hinge.levels.map((l) => !!l.perSide), [true, true, true, true]);
  assert.equal(L.defaultState(new Date()).moves.hamcurl.calibrated, false);
});

// ---------- migration v1 -> v2 ----------
const v1 = () => ({
  version: 1,
  settings: { fastMinHours: 12, fastGoalHours: 16, sessionMinutes: 10, soundOn: true, pullupBar: true, growthDismissedAt: null, lastBackupAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
  rotationIndex: 2,
  moves: {
    hpush: { level: 2, target: 9, calibrated: true, missStreak: 1 },
    vpush: { level: 0, target: 7, calibrated: true, missStreak: 0 },
    squat: { level: 3, target: 12, calibrated: true, missStreak: 0 },
    hinge: { level: 2, target: 14, calibrated: true, missStreak: 0 },
    row: { level: 5, target: 10, calibrated: true, missStreak: 0 },
    core: { level: 1, target: 45, calibrated: true, missStreak: 0 },
  },
  sessions: [{
    id: 's1', date: '2026-02-01', dayId: 'pull', minutes: 10, minimum: false,
    sets: [
      { moveId: 'row', level: 0, reps: 10 }, { moveId: 'row', level: 5, reps: 6 }, { moveId: 'row', level: 4, reps: 3 },
      { moveId: 'hinge', level: 1, reps: 15 }, { moveId: 'hinge', level: 2, reps: 12 }, { moveId: 'hinge', level: 3, reps: 8 },
      { moveId: 'hpush', level: 2, reps: 9 },
    ],
  }],
  fasts: [],
  events: [
    { id: 'e1', at: '2026-02-01T08:00:00.000Z', type: 'levelUp', moveId: 'row', level: 4, value: 4 },
    { id: 'e2', at: '2026-02-01T08:00:00.000Z', type: 'levelUp', moveId: 'hinge', level: 3, value: 3 },
    { id: 'e3', at: '2026-02-01T08:00:00.000Z', type: 'pb', moveId: 'hinge', level: 0, value: 20 },
    { id: 'e4', at: '2026-02-01T08:00:00.000Z', type: 'targetUp', moveId: 'row', level: 2, value: 11 },
    { id: 'e5', at: '2026-02-01T08:00:00.000Z', type: 'targetUp', moveId: 'hpush', level: 2, value: 10 },
  ],
});

test('migrate: version, settings, new moves', () => {
  const m = L.migrate(v1());
  assert.equal(m.version, 2);
  assert.equal(m.settings.workSec, 40);
  assert.equal(m.settings.pullupBar, true);
  assert.deepEqual(m.moves.hamcurl, { level: 0, target: 8, calibrated: false, missStreak: 0 });
  assert.deepEqual(m.moves.calf, { level: 0, target: 12, calibrated: false, missStreak: 0 });
  assert.equal(m.rotationIndex, 2);
  assert.equal(L.migrate({ ...v1(), settings: { workSec: 45 } }).settings.workSec, 45, 'keeps an existing workSec');
});

test('migrate: hinge and row level maps and calibration', () => {
  const m = L.migrate(v1());
  assert.equal(m.moves.hinge.level, 1); assert.equal(m.moves.hinge.calibrated, true);
  assert.equal(m.moves.hinge.target, 12, 'clamped into the new level range [8,12]');
  assert.equal(m.moves.row.level, 6); assert.equal(m.moves.row.calibrated, true);
  assert.equal(m.moves.row.target, 8, 'clamped into the new level range [3,8]');
  const hinge = (lv) => L.migrate({ ...v1(), moves: { hinge: { level: lv, target: 10, calibrated: true, missStreak: 1 } } }).moves.hinge;
  assert.deepEqual([0, 1, 2, 3].map((l) => hinge(l).level), [0, 0, 1, 3]);
  assert.deepEqual([0, 1, 2, 3].map((l) => hinge(l).calibrated), [false, false, true, true]);
  const row = (lv) => L.migrate({ ...v1(), moves: { row: { level: lv, target: 10, calibrated: true, missStreak: 0 } } }).moves.row;
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((l) => row(l).level), [1, 1, 1, 1, 5, 6, 7]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((l) => row(l).calibrated), [false, false, false, false, true, true, true]);
});

test('migrate: clamps every target into the new level range', () => {
  const m = L.migrate(v1());
  assert.equal(m.moves.core.target, 40, 'core max is now 40');
  for (const id of Object.keys(MOVES)) {
    const mv = m.moves[id], [lo, hi] = L.rangeOf(id, mv.level, 40);
    assert.ok(mv.target >= lo && mv.target <= hi, `${id} target ${mv.target} in [${lo},${hi}]`);
  }
  const big = L.migrate({ ...v1(), moves: { hpush: { level: 6, target: 15, calibrated: true, missStreak: 0 } } });
  assert.equal(big.moves.hpush.target, 8);
});

test('migrate: history is remapped; removed exercises get level null and a legacy name', () => {
  const m = L.migrate(v1());
  const st = m.sessions[0].sets;
  assert.deepEqual(st.map((x) => [x.moveId, x.level, x.legacy ?? null]), [
    ['row', null, 'One-arm KB row'], ['row', 6, null], ['row', 5, null],
    ['hinge', null, 'One-arm KB swing (alternate sets)'], ['hinge', 1, null], ['hinge', 3, null],
    ['hpush', 2, null],
  ]);
  assert.equal(m.sessions[0].dayId, 'pull', 'old day ids are kept');
  const ev = Object.fromEntries(m.events.map((e) => [e.id, e]));
  assert.equal(ev.e1.level, 5); assert.equal(ev.e1.value, 5);
  assert.equal(ev.e2.level, 3); assert.equal(ev.e2.value, 3);
  assert.equal(ev.e3.level, null); assert.equal(ev.e3.legacy, 'Two-hand KB swing'); assert.equal(ev.e3.value, 20, 'pb value is reps, not a level');
  assert.equal(ev.e4.level, null); assert.equal(ev.e4.legacy, 'Paused KB row (2s at top)'); assert.equal(ev.e4.value, 11);
  assert.equal(ev.e5.level, 2);
});

test('migrate: null-level sets never count for PB or per-level best, but weekly volume counts them', () => {
  let m = L.migrate(v1());
  m.sessions[0].date = '2026-03-09';
  assert.equal(L.weeklyVolume(m, '2026-03-12', 1)[0].sets, 7);
  // a PB for hinge level 1 (single-leg RDL): the old best at that level is 12 (the null swing set of 15 is ignored)
  m = withMove(m, 'hinge', { level: 1, target: 8, calibrated: true });
  const r = finish(m, [...sets('hinge', 1, 11, 4), { moveId: 'hinge', level: 1, reps: 13 }]);
  const pb = r.events.find((e) => e.type === 'pb');
  assert.ok(pb && pb.value === 13);
  assert.equal(L.moveProgress(m).find((x) => x.moveId === 'hinge').best, 12);
  assert.doesNotThrow(() => L.moveProgress(m));
  assert.doesNotThrow(() => L.recentEvents(m, 10));
});

test('migrate: idempotent, pure, tolerant of partial state', () => {
  const src = v1(), before = JSON.stringify(src);
  const once = L.migrate(src);
  assert.equal(JSON.stringify(src), before, 'input not mutated');
  const twice = L.migrate(once);
  assert.deepEqual(twice, once);
  assert.equal(L.migrate(twice).moves.row.level, once.moves.row.level);
  assert.doesNotThrow(() => L.migrate({ version: 1 }));
  assert.equal(L.migrate({ version: 1 }).version, 2);
  assert.doesNotThrow(() => L.migrate({ version: 1, moves: { hinge: 'x' }, sessions: [null, { sets: null }], events: [5] }));
  const fresh2 = fresh();
  assert.deepEqual(L.migrate(fresh2), fresh2);
});

test('store: load and importJSON migrate a v1 state', () => {
  const imp = store.importJSON(JSON.stringify(v1()));
  assert.equal(imp.version, 2);
  assert.equal(imp.moves.row.level, 6);
  assert.equal(imp.sessions[0].sets[0].level, null);
  assert.equal(imp.settings.workSec, 40);
  assert.ok(imp.moves.hamcurl && imp.moves.calf);
  assert.deepEqual(store.importJSON(store.exportJSON(imp)), imp, 'round trip is stable');
  const mem = { [store.STORAGE_KEY]: JSON.stringify(v1()) };
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  try {
    const l = store.load();
    assert.equal(l.version, 2); assert.equal(l.moves.hinge.level, 1); assert.equal(l.sessions[0].sets[3].legacy, 'One-arm KB swing (alternate sets)');
  } finally { delete globalThis.localStorage; }
});

// ---------- rep totals ----------
const sess = (date, ss, minimum = false) => ({ id: date, date, minimum, sets: ss });
const T = (rt, id) => rt.find((m) => m.moveId === id);

test('repTotals: today, week (Monday start), 30 days and all time windows', () => {
  const today = '2026-10-07'; // Wednesday. Week starts Mon 2026-10-05.
  const s = fresh();
  s.sessions = [
    sess('2026-10-07', [{ moveId: 'hpush', level: 0, reps: 10 }]),
    sess('2026-10-05', [{ moveId: 'hpush', level: 0, reps: 20 }]),          // Monday: in week
    sess('2026-10-04', [{ moveId: 'hpush', level: 1, reps: 30 }]),          // Sunday: out of week, in 30 days
    sess('2026-09-08', [{ moveId: 'hpush', level: 1, reps: 40 }]),          // 29 days back: in 30 days
    sess('2026-09-07', [{ moveId: 'hpush', level: 1, reps: 50 }]),          // 30 days back: out
  ];
  const h = T(L.repTotals(s, today), 'hpush');
  assert.equal(h.today, 10);
  assert.equal(h.week, 30);
  assert.equal(h.month, 100);
  assert.equal(h.allTime, 150);
  assert.equal(h.name, 'Push-up');
  assert.equal(h.unit, 'reps');
  assert.deepEqual(h.levels.map((l) => [l.level, l.name, l.allTime]), [[1, 'Deficit push-up (hands on books)', 120], [0, 'Standard push-up', 30]]);
  const sq = T(L.repTotals(s, today), 'squat');
  assert.deepEqual([sq.today, sq.week, sq.month, sq.allTime, sq.levels], [0, 0, 0, 0, []]);
  assert.equal(L.repTotals(s, today).length, Object.keys(MOVES).length);
});

test('repTotals: week boundary on a Monday and on a Sunday', () => {
  const s = fresh();
  s.sessions = [sess('2026-10-04', [{ moveId: 'row', level: 1, reps: 8 }]), sess('2026-10-05', [{ moveId: 'row', level: 1, reps: 9 }])];
  assert.equal(T(L.repTotals(s, '2026-10-05'), 'row').week, 9);   // Monday: only today
  assert.equal(T(L.repTotals(s, '2026-10-11'), 'row').week, 9);   // Sunday: Mon to Sun
  assert.equal(T(L.repTotals(s, '2026-10-12'), 'row').week, 0);   // next Monday
});

test('repTotals: legacy sets and minimum days count; per-side sets are summed', () => {
  const s = fresh();
  s.sessions = [
    sess('2026-10-05', [{ moveId: 'row', level: null, legacy: 'One-arm KB row', reps: 12 }, { moveId: 'row', level: 1, reps: 5 }]),
    sess('2026-10-05', [{ moveId: 'squat', level: 2, reps: 8, side: 'L' }, { moveId: 'squat', level: 2, reps: 7, side: 'R' }], true),
  ];
  const rt = L.repTotals(s, '2026-10-05');
  assert.equal(T(rt, 'row').allTime, 17);
  assert.deepEqual(T(rt, 'row').levels.map((l) => [l.level, l.name, l.allTime]), [[null, 'One-arm KB row', 12], [1, 'Inverted row under a table, knees bent', 5]]);
  assert.equal(T(rt, 'squat').today, 15);
  assert.equal(T(rt, 'squat').levels[0].allTime, 15);
  assert.equal(T(rt, 'squat').levels[0].name, 'Split squat holding KB');
});

test('repTotals: sec unit gives seconds; future sessions only count all time; input is not mutated', () => {
  const s = fresh();
  s.sessions = [sess('2026-10-05', [{ moveId: 'core', level: 1, reps: 40 }, { moveId: 'core', level: 1, reps: 35 }]), sess('2026-10-20', [{ moveId: 'core', level: 1, reps: 30 }])];
  const before = JSON.stringify(s);
  const c = T(L.repTotals(s, '2026-10-07'), 'core');
  assert.equal(c.unit, 'sec');
  assert.equal(c.week, 75);
  assert.equal(c.allTime, 105);
  assert.equal(JSON.stringify(s), before);
});

test('sessionTotals sums per move and flags both sides', () => {
  const t = L.sessionTotals([
    { moveId: 'hpush', level: 0, reps: 12 }, { moveId: 'row', level: 4, reps: 9, side: 'L' },
    { moveId: 'hpush', level: 0, reps: 10 }, { moveId: 'row', level: 4, reps: 8, side: 'R' }, { moveId: 'core', level: 1, reps: 30 },
  ]);
  assert.deepEqual(t.map((x) => [x.moveId, x.total, x.bothSides, x.unit]), [['hpush', 22, false, 'reps'], ['row', 17, true, 'reps'], ['core', 30, false, 'sec']]);
  assert.deepEqual(L.sessionTotals([]), []);
  assert.deepEqual(L.sessionTotals(undefined), []);
});
