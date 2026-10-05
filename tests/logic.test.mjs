import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { MOVES, DAYS, FAST_STAGES } from '../js/data.js';
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
  for (const id of Object.keys(MOVES)) assert.deepEqual(s.moves[id], { level: 0, target: MOVES[id].range[0], calibrated: false, missStreak: 0 });
  assert.equal(s.version, 1);
  assert.equal(s.settings.fastMinHours, 12);
});

test('rotation order and currentDay', () => {
  let s = fresh();
  const seen = [];
  for (let i = 0; i < 4; i++) {
    seen.push(L.currentDay(s).id);
    s = finish(s, [], { minimum: true }).state;
  }
  assert.deepEqual(seen, ['push', 'legs', 'pull', 'push']);
});

test('calibration placement', () => {
  const s = fresh();
  assert.deepEqual(L.placeFromCalibration(s, 'hpush', 0, 30), { level: 0, target: 15, tooEasy: true, tooHard: false });
  assert.deepEqual(L.placeFromCalibration(s, 'hpush', 0, 15), { level: 0, target: 10, tooEasy: false, tooHard: false });
  assert.deepEqual(L.placeFromCalibration(s, 'hpush', 0, 3), { level: 0, target: 6, tooEasy: false, tooHard: false });
  const r = L.placeFromCalibration(s, 'hpush', 2, 3);
  assert.equal(r.tooHard, true); assert.equal(r.target, 6);
  const top = L.placeFromCalibration(s, 'hpush', 6, 40);
  assert.equal(top.tooEasy, false); assert.equal(top.target, 15);
  assert.equal(L.placeFromCalibration(s, 'row', 3, 40).tooEasy, false);
  const bar = L.setPullupBar(s, true);
  assert.equal(L.placeFromCalibration(bar, 'row', 3, 40).tooEasy, true);
});

test('applyCalibration sets state, no mutation', () => {
  const s = fresh();
  const n = L.applyCalibration(s, 'hpush', 2, 9);
  assert.deepEqual(n.moves.hpush, { level: 2, target: 9, calibrated: true, missStreak: 0 });
  assert.equal(s.moves.hpush.calibrated, false);
});

test('sessionPlan slot lengths for 3/10/15/20 minutes', () => {
  const s = fresh();
  const min = L.sessionPlan(s, { minimum: true });
  assert.equal(min.minutes, 3);
  assert.deepEqual(min.slots.map((x) => x.moveId), ['hpush', 'vpush', 'hpush']);
  assert.deepEqual(min.slots.map((x) => x.minute), [1, 2, 3]);
  assert.ok(min.moves.every((m) => !m.needsCalibration));

  const p10 = L.sessionPlan(s);
  assert.equal(p10.slots.length, 10);
  assert.equal(p10.moves.length, 2);
  assert.deepEqual(p10.slots.slice(0, 4).map((x) => x.moveId), ['hpush', 'vpush', 'hpush', 'vpush']);
  assert.equal(p10.dayId, 'push'); assert.equal(p10.dayName, 'Push');
  assert.ok(p10.moves.every((m) => m.needsCalibration));
  assert.ok(p10.moves[0].cue && p10.moves[0].levelName);

  s.settings.sessionMinutes = 15;
  const p15 = L.sessionPlan(s);
  assert.equal(p15.slots.length, 15); assert.equal(p15.moves.length, 3);
  assert.deepEqual(p15.slots.slice(0, 6).map((x) => x.moveId), ['hpush', 'vpush', 'row', 'hpush', 'vpush', 'row']);

  s.settings.sessionMinutes = 20;
  const p20 = L.sessionPlan(s);
  assert.equal(p20.slots.length, 20); assert.equal(p20.moves.length, 4);
  for (const m of p20.moves) assert.equal(p20.slots.filter((x) => x.moveId === m.moveId).length, 5);
});

test('requiresBar levels are skipped when no bar (plan clamps)', () => {
  let s = withMove(fresh(), 'row', { level: 5, target: 10, calibrated: true });
  s.rotationIndex = 2;
  assert.equal(L.sessionPlan(s).moves[0].level, 3);
  s = L.setPullupBar(s, true);
  assert.equal(L.sessionPlan(s).moves[0].level, 5);
});

test('progression: targetUp when all sets hit target', () => {
  const s = withMove(fresh(), 'hpush', { target: 10, calibrated: true });
  const r = finish(s, sets('hpush', 0, 10));
  assert.equal(r.state.moves.hpush.target, 11);
  assert.deepEqual(r.events.map((e) => [e.type, e.moveId, e.value]), [['targetUp', 'hpush', 11]]);
  assert.equal(r.state.events.length, 1);
  assert.equal(s.moves.hpush.target, 10, 'input not mutated');
  assert.equal(s.sessions.length, 0);
});

test('progression: levelUp at range max', () => {
  const s = withMove(fresh(), 'hpush', { target: 15, calibrated: true });
  const r = finish(s, sets('hpush', 0, 15));
  assert.equal(r.state.moves.hpush.level, 1);
  assert.equal(r.state.moves.hpush.target, 6);
  assert.ok(r.events.some((e) => e.type === 'levelUp' && e.level === 1));
});

test('progression: no levelUp into bar levels without bar; caps at range max', () => {
  const s = withMove(fresh(), 'row', { level: 3, target: 15, calibrated: true });
  const r = finish(s, sets('row', 3, 15));
  assert.equal(r.state.moves.row.level, 3);
  assert.equal(r.state.moves.row.target, 15);
  assert.equal(r.events.length, 0);
});

test('progression: levelDown after 2 misses', () => {
  const s = withMove(fresh(), 'hpush', { level: 2, target: 10, calibrated: true });
  let r = finish(s, sets('hpush', 2, 3));
  assert.equal(r.state.moves.hpush.missStreak, 1);
  assert.equal(r.state.moves.hpush.level, 2);
  r = finish(r.state, sets('hpush', 2, 3));
  assert.equal(r.state.moves.hpush.level, 1);
  assert.equal(r.state.moves.hpush.target, Math.round((6 + 15) / 2));
  assert.equal(r.state.moves.hpush.missStreak, 0);
  assert.ok(r.events.some((e) => e.type === 'levelDown'));
});

test('progression: levelDown never goes below 0', () => {
  const s = withMove(fresh(), 'hpush', { level: 0, target: 6, calibrated: true, missStreak: 1 });
  const r = finish(s, sets('hpush', 0, 2));
  assert.equal(r.state.moves.hpush.level, 0);
});

test('progression: partial miss resets missStreak, no change', () => {
  const s = withMove(fresh(), 'hpush', { target: 10, calibrated: true, missStreak: 1 });
  const r = finish(s, [...sets('hpush', 0, 10, 4), { moveId: 'hpush', level: 0, reps: 8 }]);
  assert.equal(r.state.moves.hpush.target, 10);
  assert.equal(r.state.moves.hpush.missStreak, 0);
  assert.equal(r.events.length, 0);
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
  assert.equal(r.state.sessions[0].dayId, 'push');
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
  const s = withMove(fresh(), 'row', { level: 3, target: 15, calibrated: true });
  assert.equal(L.barUnlockDue(s), true);
  assert.equal(L.barUnlockDue(withMove(fresh(), 'row', { level: 3, target: 14 })), false);
  assert.equal(L.barUnlockDue(fresh()), false);
  const b = L.setPullupBar(s, true);
  assert.equal(b.settings.pullupBar, true);
  assert.equal(b.moves.row.level, 4);
  assert.equal(b.moves.row.target, 8);
  assert.equal(L.barUnlockDue(b), false);
  const c = L.setPullupBar(withMove(fresh(), 'row', { level: 2, target: 10 }), true);
  assert.equal(c.moves.row.level, 2);
  const d = L.setPullupBar(withMove(b, 'row', { level: 5 }), false);
  assert.equal(d.moves.row.level, 3);
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
  assert.equal(p.find((x) => x.moveId === 'row').levelsTotal, 4);
  assert.equal(L.moveProgress(L.setPullupBar(s, true)).find((x) => x.moveId === 'row').levelsTotal, 7);
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
  assert.throws(() => store.importJSON('{"version":2}'), /version/);
  assert.throws(() => store.importJSON('{"version":1,"sessions":5}'), /sessions/);
});

test('store: works without localStorage and with a fake one', () => {
  assert.equal(globalThis.localStorage, undefined);
  assert.equal(store.save(fresh()), false);
  assert.equal(store.load().version, 1);
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

test('data sanity', () => {
  assert.equal(DAYS.length, 3);
  for (const d of DAYS) for (const m of d.moves) assert.ok(MOVES[m]);
  assert.equal(MOVES.row.levels.filter((l) => l.requiresBar).length, 3);
});
