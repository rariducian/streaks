import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { MOVES, MOVE_LIST, WORK_SEC_CHOICES } from '../js/data.js';
import * as store from '../js/store.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const fresh = () => L.defaultState(D(2026, 1, 1));
const withMove = (st, id, patch) => { const s = structuredClone(st); Object.assign(s.moves[id], patch); return s; };
const sets = (moveId, level, reps, n = 5) => Array.from({ length: n }, () => ({ moveId, level, reps }));

// ---------- fit rep ranges to the work time ----------
test('fit: every level at every work time has lo <= hi and fits the window (or is the original max)', () => {
  for (const m of MOVE_LIST) m.levels.forEach((lv, i) => {
    if (m.unit !== 'sec') assert.ok(lv.sec > 0, `${m.id}[${i}] has sec`);
    for (const w of WORK_SEC_CHOICES) {
      const [lo, hi] = L.rangeOf(m.id, i, w), [, hi0] = L.rangeOf(m.id, i);
      assert.ok(lo >= 1 && lo <= hi, `${m.id}[${i}] @${w}: ${lo}-${hi}`);
      if (m.unit !== 'sec') assert.ok(hi * lv.sec + L.SETUP_SEC <= w || hi === hi0, `${m.id}[${i}] @${w}: ${hi} reps x ${lv.sec}s`);
      assert.ok(hi <= hi0);
    }
  });
});

test('fit: the examples from the brief', () => {
  assert.deepEqual(L.rangeOf('calf', 0, 40), [8, 10], 'calf raise, 2 s stretch');
  assert.deepEqual(L.rangeOf('hinge', 2, 40), [6, 9], 'paused single-leg hip thrust');
  assert.deepEqual(L.rangeOf('squat', 1, 40), [4, 7], 'tempo goblet squat');
  assert.deepEqual(L.rangeOf('squat', 1, 30), [3, 5]);
  assert.deepEqual(L.rangeOf('squat', 1, 45), [4, 8], 'already fits at 45 s');
  assert.deepEqual(L.rangeOf('hpush', 0, 40), [6, 15], 'a plain push-up already fits');
  assert.deepEqual(L.rangeOf('hpush', 0), [6, 15], 'no workSec: plain range');
  assert.deepEqual(L.rangeOf('vpush', 4, 30), [1, 3], 'lo comes down with hi but stays at least 1');
  assert.equal(L.isCapped('calf', 0, 40), true);
  assert.equal(L.isCapped('hpush', 0, 40), false);
  assert.equal(L.isCapped('core', 0, 30), true, 'core cap by seconds still counts as capped');
});

test('fit: core is unchanged', () => {
  assert.deepEqual(L.rangeOf('core', 0, 40), [20, 40]);
  assert.deepEqual(L.rangeOf('core', 0, 30), [20, 30]);
  assert.deepEqual(L.rangeOf('core', 0, 45), [20, 40]);
  assert.deepEqual(L.rangeOf('core', 4, 30), [10, 30]);
  assert.deepEqual(L.rangeOf('core', 4, 20), [10, 20]);
});

test('fit: sessionPlan and calibration use the fitted range', () => {
  const s = withMove(fresh(), 'calf', { target: 20, calibrated: true });
  const p = L.sessionPlan({ ...s, rotationIndex: 1 }).moves.find((m) => m.moveId === 'calf');
  assert.deepEqual(p.range, [8, 10]); assert.equal(p.target, 10);
  const c = L.placeFromCalibration(s, 'calf', 0, 30);
  assert.equal(c.target, 10); assert.equal(c.tooEasy, true);
  const mp = L.moveProgress(s).find((m) => m.moveId === 'calf');
  assert.deepEqual(mp.range, [8, 10]); assert.equal(mp.target, 10);
});

test('fit: a capped level can be levelled up', () => {
  // tempo goblet squat reaches 7 at 40 s (the plain max of 8 is out of reach in the window)
  const s = withMove(fresh(), 'squat', { level: 1, target: 6, calibrated: true });
  const r = L.finishSession(s, { startedAt: D(2026, 2, 2), endedAt: D(2026, 2, 2), sets: sets('squat', 1, 7) });
  assert.equal(r.state.moves.squat.level, 2);
  assert.equal(r.state.moves.squat.target, 8);
  assert.ok(r.events.some((e) => e.type === 'levelUp'));
  // 6 of 7 is not enough
  const n = L.finishSession(s, { startedAt: D(2026, 2, 2), endedAt: D(2026, 2, 2), sets: [...sets('squat', 1, 7, 4), ...sets('squat', 1, 6, 1)] });
  assert.equal(n.state.moves.squat.level, 1);
  // a 30 s window needs only 5
  const t = withMove(withMove(fresh(), 'squat', { level: 1, target: 4, calibrated: true }), 'squat', {});
  t.settings.workSec = 30;
  assert.equal(L.finishSession(t, { startedAt: D(2026, 2, 2), endedAt: D(2026, 2, 2), sets: sets('squat', 1, 5) }).state.moves.squat.level, 2);
});

test('fit: stored targets above the fitted max are clamped on load; levels are kept', () => {
  const n = store.normalise({ version: 2, settings: { workSec: 40 }, moves: { calf: { level: 0, target: 20, calibrated: true, missStreak: 1 }, hpush: { level: 0, target: 15 }, core: { level: 0, target: 40 } } });
  assert.equal(n.moves.calf.target, 10); assert.equal(n.moves.calf.level, 0); assert.equal(n.moves.calf.calibrated, true);
  assert.equal(n.moves.hpush.target, 15, 'fitting targets are left alone');
  assert.equal(n.moves.core.target, 40);
  const m = store.normalise({ version: 2, settings: { workSec: 30 }, moves: { calf: { level: 2, target: 8 } } });
  assert.equal(m.moves.calf.target, 4); assert.equal(m.moves.calf.level, 2);
  const lo = store.normalise({ version: 2, settings: { workSec: 40 }, moves: { calf: { level: 0, target: 3 } } });
  assert.equal(lo.moves.calf.target, 3, 'targets below the range are not raised');
  const before = fresh(); before.moves.calf.target = 20;
  assert.equal(L.clampTargets(before).moves.calf.target, 10); assert.equal(before.moves.calf.target, 20, 'no mutation');
});

// ---------- trend maths ----------
test('leastSquares: fewer than 2 points, perfect line, flat, negative', () => {
  assert.equal(L.leastSquares([]), null);
  assert.equal(L.leastSquares([{ x: 0, y: 5 }]), null);
  assert.equal(L.leastSquares([{ x: 1, y: 5 }, { x: 1, y: 7 }]), null);
  const p = L.leastSquares([0, 1, 2, 3].map((x) => ({ x, y: 2 + 0.5 * x })));
  assert.ok(Math.abs(p.slope - 0.5) < 1e-9 && Math.abs(p.intercept - 2) < 1e-9);
  const f = L.leastSquares([0, 1, 2, 3].map((x) => ({ x, y: 8 })));
  assert.equal(f.slope, 0);
  const n = L.leastSquares([0, 1, 2, 3].map((x) => ({ x, y: 10 - x })));
  assert.ok(Math.abs(n.slope + 1) < 1e-9);
  const noisy = L.leastSquares([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 2 }]);
  assert.ok(Math.abs(noisy.slope - 0.5) < 1e-9);
});

test('sessionsToLevelUp: estimate, rounding up, cap, no gain', () => {
  assert.deepEqual(L.sessionsToLevelUp(8, 11, 0.6), { sessions: 5, over: false });
  assert.deepEqual(L.sessionsToLevelUp(8, 11, 1), { sessions: 3, over: false });
  assert.deepEqual(L.sessionsToLevelUp(10, 11, 2), { sessions: 1, over: false });
  assert.deepEqual(L.sessionsToLevelUp(11, 11, 0.5), { sessions: 1, over: false }, 'never zero');
  assert.deepEqual(L.sessionsToLevelUp(6, 15, 0.1), { sessions: 20, over: true }, 'capped at 20+');
  assert.deepEqual(L.sessionsToLevelUp(1, 21, 1), { sessions: 20, over: false }, 'exactly 20 is not 20+');
  assert.equal(L.sessionsToLevelUp(6, 12, 0), null);
  assert.equal(L.sessionsToLevelUp(6, 12, -0.4), null);
  assert.equal(L.sessionsToLevelUp(6, 12, 0.01), null, 'a trace of gain is flat');
});

// Sessions on consecutive days, one summary per session: sets of the given reps at a level.
function history(plan, extra = {}) {
  let s = fresh(); Object.assign(s.settings, extra);
  s.sessions = plan.map(([level, ...reps], i) => ({ id: 's' + i, date: L.addDays('2026-03-01', i), startedAt: D(2026, 3, 1 + i).toISOString(), minimum: false, sets: reps.map((r) => ({ moveId: 'hpush', level, reps: r })) }));
  return s;
}

test('moveSeries: fewer than 4 sessions is not enough', () => {
  const t = L.moveSeries(history([[0, 8, 8], [0, 9, 9], [0, 10, 10]]), 'hpush');
  assert.equal(t.enough, false); assert.equal(t.cur.length, 3); assert.equal(t.need, 4);
  assert.equal(t.slope, null); assert.equal(t.est, null); assert.equal(t.fit, null);
});

test('moveSeries: rising line, estimate from the lowest set and the slope', () => {
  const t = L.moveSeries(history([[0, 8, 8], [0, 9, 9], [0, 10, 10], [0, 11, 11]]), 'hpush');   // max 15 at 40 s
  assert.equal(t.enough, true); assert.ok(Math.abs(t.slope - 1) < 1e-9);
  assert.equal(t.max, 15);
  assert.deepEqual(t.est, { sessions: 4, over: false });   // (15 - 11) / 1
  assert.deepEqual(t.fit.map((v) => Math.round(v)), [8, 9, 10, 11]);
});

test('moveSeries: flat and falling are flat, not an estimate', () => {
  const f = L.moveSeries(history([[0, 9, 9], [0, 9, 9], [0, 9, 9], [0, 9, 9]]), 'hpush');
  assert.equal(f.flat, true); assert.equal(f.est, null);
  const n = L.moveSeries(history([[0, 12, 12], [0, 11, 11], [0, 10, 10], [0, 9, 9]]), 'hpush');
  assert.equal(n.flat, true); assert.ok(n.slope < 0); assert.equal(n.est, null);
});

test('moveSeries: slow gains hit the 20+ cap', () => {
  const t = L.moveSeries(history([[0, 6, 6], [0, 6, 6], [0, 6, 7], [0, 6, 7]]), 'hpush');
  assert.equal(t.est.over, true); assert.equal(t.est.sessions, 20);
});

test('moveSeries: mean per session, earlier levels kept faded with a marker at the level-up, minimum days left out', () => {
  const s = history([[0, 14, 15], [0, 15, 15], [1, 6, 8], [1, 7, 9], [1, 8, 10], [1, 9, 11], [1, 10, 12]]);
  s.sessions[1].minimum = true;
  s.moves.hpush.level = 1;
  const t = L.moveSeries(s, 'hpush');
  assert.equal(t.points.length, 6, 'the minimum day is skipped');
  assert.equal(t.cur.length, 5); assert.equal(t.cur[0].mean, 7); assert.equal(t.cur[0].lowest, 6);
  assert.deepEqual(t.markers, [1]);
  assert.equal(t.points[0].level, 0);
  assert.equal(t.max, 14, 'deficit push-up 15 fitted to 14 at 40 s'); assert.equal(t.capped, false, 'a 1-rep cut is not worth a note');
});

test('moveSeries: core works in seconds with the same maths', () => {
  const s = fresh();
  s.sessions = [20, 25, 25, 30].map((v, i) => ({ id: 'c' + i, date: L.addDays('2026-03-01', i), startedAt: D(2026, 3, 1 + i).toISOString(), minimum: false, sets: [{ moveId: 'core', level: 0, reps: v }] }));
  const t = L.moveSeries(s, 'core');
  assert.equal(t.unit, 'sec'); assert.equal(t.max, 40); assert.ok(t.slope > 0);
  assert.equal(L.moveSeries({ ...s, settings: { ...s.settings, workSec: 30 } }, 'core').max, 30);
});
