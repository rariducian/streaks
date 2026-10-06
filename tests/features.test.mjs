// Planned rest days, the weekly bounty and move-tied gear sets.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as store from '../js/store.js';
import * as G from '../js/game/engine.js';
import * as B from '../js/game/bounty.js';
import * as SP from '../js/game/sprites.js';
import * as V from '../js/game/view.js';
import { MOVES } from '../js/data.js';

const fresh = () => L.defaultState(new Date(2026, 0, 1));
const sess = (st, date, extra = {}) => { const s = structuredClone(st); s.sessions.push({ id: 's' + s.sessions.length + date, date, startedAt: date + 'T0' + (s.sessions.length % 10) + ':00:00', minimum: false, sets: [], ...extra }); return s; };
const withDays = (st, dates, extra) => dates.reduce((s, d) => sess(s, d, extra), st);
const range = (start, n) => Array.from({ length: n }, (_, i) => L.addDays(start, i));
const ev = (st, e) => { const s = structuredClone(st); s.events.push({ id: 'e' + s.events.length, at: new Date(2026, 2, 4, 9).toISOString(), ...e }); return s; };
// 2026-03-02 is a Monday: Tue 3, Wed 4, Thu 5, Fri 6, Sat 7, Sun 8
const MON = '2026-03-02', isRest = (...days) => (d) => days.includes((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7);   // Mon = 0
const keep = (st, days, from = '2000-01-01') => L.setRestDays(st, days, from);

/* ---------- rest days: computeStreak ---------- */
test('rest: a rest day in the middle of a streak keeps it, does not grow it and is listed', () => {
  const dates = ['2026-03-02', '2026-03-03', '2026-03-05'];   // Mon, Tue, Thu. Wed is the rest day
  const a = L.computeStreak(dates, '2026-03-05', isRest(2));
  assert.equal(a.current, 3); assert.equal(a.longest, 3); assert.deepEqual(a.restDates, ['2026-03-04']); assert.deepEqual(a.frozenDates, []);
  assert.equal(L.computeStreak(dates, '2026-03-05').current, 1, 'without the rest day the same dates break');
  assert.equal(L.computeStreak(dates, '2026-03-05', isRest(0)).current, 1, 'a rest day on another weekday changes nothing');
});
test('rest: training on a rest day counts as normal', () => {
  const a = L.computeStreak(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'], '2026-03-05', isRest(2));
  assert.equal(a.current, 4); assert.deepEqual(a.restDates, []);
});
test('rest: today being a rest day, trained or not', () => {
  const a = L.computeStreak(['2026-03-02', '2026-03-03'], '2026-03-04', isRest(2));
  assert.equal(a.current, 2); assert.equal(a.doneToday, false); assert.deepEqual(a.restDates, ['2026-03-04']);
  const b = L.computeStreak(['2026-03-02', '2026-03-03', '2026-03-04'], '2026-03-04', isRest(2));
  assert.equal(b.current, 3); assert.equal(b.doneToday, true); assert.deepEqual(b.restDates, []);
  const c = L.computeStreak([], '2026-03-04', isRest(2)); assert.equal(c.current, 0); assert.deepEqual(c.restDates, [], 'nothing before the first session');
});
test('rest: two rest days in a row, then a real miss still breaks', () => {
  const rest = isRest(2, 3), dates = ['2026-03-02', '2026-03-03', '2026-03-06'];   // Wed and Thu rest, Fri trained
  assert.equal(L.computeStreak(dates, '2026-03-06', rest).current, 3);
  assert.equal(L.computeStreak(dates, '2026-03-08', rest).current, 0, 'Sat was a real miss');
  assert.equal(L.computeStreak(dates, '2026-03-07', rest).current, 3, 'and Sat is only today');
});
test('rest: a rest day gives no streak day, so it does not earn a freeze either', () => {
  const six = range(MON, 6);   // Mon to Sat
  let r = L.computeStreak([...six, '2026-03-09'], '2026-03-09', isRest(6));   // Sun rest, then Mon: that is only the 7th trained day
  assert.equal(r.current, 7); assert.equal(r.freezes, 1);
  r = L.computeStreak(six, '2026-03-08', isRest(6)); assert.equal(r.current, 6); assert.equal(r.freezes, 0);
});
test('rest: freezes and rest days together. Rest costs nothing, a real miss spends the freeze', () => {
  const seven = range(MON, 7), dates = [...seven, '2026-03-09', '2026-03-12'];   // Mon 2 to Sun 8 earns a freeze. Mon 9 trained, Tue 10 rest, Wed 11 missed, Thu 12 trained
  let r = L.computeStreak(dates, '2026-03-12', isRest(1));
  assert.deepEqual(r.restDates, ['2026-03-10']); assert.deepEqual(r.frozenDates, ['2026-03-11'], 'the freeze went on the real miss, not the rest day'); assert.equal(r.current, 9); assert.equal(r.freezes, 0);
  r = L.computeStreak(dates, '2026-03-12'); assert.deepEqual(r.frozenDates, ['2026-03-10']); assert.equal(r.current, 1, 'without the rest day Tue takes the freeze and Wed breaks it');
  r = L.computeStreak(dates, '2026-03-14', isRest(1)); assert.equal(r.current, 0, 'Fri 13 was a real miss with no freeze left'); assert.equal(r.longest, 9);
  r = L.computeStreak([...seven, '2026-03-10'], '2026-03-10', isRest(0)); assert.deepEqual(r.restDates, ['2026-03-09']); assert.equal(r.current, 8); assert.equal(r.freezes, 1, 'the freeze is still there');
});
test('rest: fasting streaks are not affected (no rest argument is ever passed for them)', () => {
  const s = keep(fresh(), [2]); s.fasts.push({ id: 'f', start: '2026-03-03T00:00:00.000Z', end: '2026-03-04T00:00:00.000Z', goalHours: 16 });
  const fd = L.fastingDates(s, new Date('2026-03-10T12:00:00Z'));
  const st = L.computeStreak(fd, '2026-03-10'); assert.equal(st.current, 0); assert.equal(st.restDates, undefined);
});
test('rest: the result keeps its old shape when no rest days are given', () => {
  assert.deepEqual(Object.keys(L.computeStreak(['2026-03-02'], '2026-03-02')), ['current', 'longest', 'freezes', 'frozenDates', 'doneToday']);
});

/* ---------- rest days: settings and history ---------- */
test('rest: setRestDays keeps up to 2 valid weekdays, sorted and unique', () => {
  const s = L.setRestDays(fresh(), [4, 1, 1, 9, -1, 'x', 2], '2026-03-02');
  assert.deepEqual(s.settings.restDays, [1, 4]); assert.equal(L.MAX_REST_DAYS, 2);
  assert.deepEqual(L.setRestDays(fresh(), [], '2026-03-02').settings.restDays, []);
});
test('rest: a change counts from the day it was made and never rewrites the past', () => {
  let s = L.setRestDays(fresh(), [2], '2026-03-10');   // Wednesdays from Tue 10 March
  assert.deepEqual(L.restDaysAt(s.settings, '2026-03-09'), [], 'before the change');
  assert.deepEqual(L.restDaysAt(s.settings, '2026-03-10'), [2]);
  s = L.setRestDays(s, [4], '2026-03-20');   // then Fridays
  assert.deepEqual(L.restDaysAt(s.settings, '2026-03-19'), [2], 'the old rest day is still in force the day before');
  assert.deepEqual(L.restDaysAt(s.settings, '2026-03-20'), [4]);
  assert.deepEqual(s.settings.restHistory.map((e) => e.from), ['2026-03-10', '2026-03-20']);
  const f = L.restFn(s.settings);
  assert.equal(f('2026-03-04'), false); assert.equal(f('2026-03-11'), true, 'Wed 11 stays a rest day in the past'); assert.equal(f('2026-03-18'), true); assert.equal(f('2026-03-25'), false); assert.equal(f('2026-03-27'), true);
  // streaks of the past do not change when the rest days change later
  const dates = ['2026-03-09', '2026-03-10', '2026-03-12'];   // Mon, Tue, Thu: Wed 11 was rest
  const before = L.computeStreak(dates, '2026-03-12', L.restFn(L.setRestDays(fresh(), [2], '2026-03-10').settings));
  const after = L.computeStreak(dates, '2026-03-12', f);
  assert.deepEqual(after, before); assert.equal(after.current, 3);
  // and a day that was not a rest day when it passed stays a miss
  assert.equal(L.computeStreak(['2026-03-02', '2026-03-03', '2026-03-05'], '2026-03-05', f).current, 1, 'Wed 4 was before the first change');
});
test('rest: changing twice on one day keeps one entry, setting the same days again adds none', () => {
  let s = L.setRestDays(fresh(), [2], '2026-03-10'); s = L.setRestDays(s, [3], '2026-03-10');
  assert.equal(s.settings.restHistory.length, 1); assert.deepEqual(L.restDaysAt(s.settings, '2026-03-10'), [3]);
  const t = L.setRestDays(s, [3], '2026-03-15'); assert.equal(t.settings.restHistory.length, 1);
  assert.deepEqual(L.restDaysAt(L.setRestDays(s, [], '2026-03-12').settings, '2026-03-13'), [], 'clearing counts from that day');
  assert.deepEqual(L.restDaysAt(L.setRestDays(s, [], '2026-03-12').settings, '2026-03-11'), [3]);
  assert.deepEqual(fresh().settings.restDays, []); assert.equal(s.settings.restDays.join(), '3'); assert.notEqual(s, fresh());
});
test('rest: old saves and odd settings (no history, restDays without history, junk) are safe', () => {
  assert.deepEqual(L.restDaysAt(undefined, '2026-03-01'), []); assert.equal(L.restFn(null)('2026-03-04'), false);
  assert.deepEqual(L.restDaysAt({ restDays: [2] }, '2020-01-01'), [2], 'restDays alone applies throughout');
  assert.deepEqual(L.restDaysAt({ restHistory: [{ from: '2026-03-10', days: [1, 2, 3, 4] }] }, '2026-03-11'), [1, 2], 'capped at 2');
  assert.deepEqual(L.restDaysAt({ restHistory: [null, { from: 5 }, { from: '2026-03-10', days: [2] }] }, '2026-03-11'), [2]);
  const old = fresh(); delete old.settings.restDays; delete old.settings.restHistory;
  const n = store.normalise(old); assert.deepEqual(n.settings.restDays, []); assert.deepEqual(n.settings.restHistory, []);
  const s = L.setRestDays(old, [2], '2026-03-10'); assert.deepEqual(L.restDaysAt(s.settings, '2026-03-11'), [2]);
  const odd = { ...fresh(), settings: { ...fresh().settings, restDays: [4], restHistory: [] } };
  assert.deepEqual(L.restDaysAt(L.setRestDays(odd, [2], '2026-03-10').settings, '2026-03-09'), [4], 'what was set before keeps working until the change');
  const back = store.importJSON(store.exportJSON(L.setRestDays(fresh(), [1, 5], '2026-03-10')));
  assert.deepEqual(back.settings.restDays, [1, 5]); assert.deepEqual(L.restDaysAt(back.settings, '2026-03-12'), [1, 5]);
});
test('rest: the heatmap and week data mark rest days (not when trained)', () => {
  const dates = ['2026-03-02', '2026-03-03', '2026-03-05'], st = L.computeStreak(dates, '2026-03-06', isRest(2));
  const cols = L.heatmap(dates, st.frozenDates, '2026-03-06', 2, st.restDates), cells = cols.flat();
  assert.deepEqual(cells.filter((c) => c.rest).map((c) => c.date), ['2026-03-04']); assert.equal(cells.find((c) => c.date === '2026-03-05').rest, false);
  assert.equal(L.heatmap(dates, [], '2026-03-06', 2)[1][2].rest, false, 'no rest dates given, none shown');
});
test('rest: restedPending after a passed rest day, until the next session', () => {
  let s = L.setRestDays(fresh(), [2], '2026-03-01'); s = sess(s, '2026-03-03');   // Tue session, Wed rest
  assert.equal(L.restedPending(s, '2026-03-03'), false); assert.equal(L.restedPending(s, '2026-03-04'), false, 'today is the rest day: it has not passed yet');
  assert.equal(L.restedPending(s, '2026-03-05'), true); assert.equal(L.restedPending(s, '2026-03-12'), true);
  assert.equal(L.restedPending(sess(s, '2026-03-05'), '2026-03-05'), false, 'trained after it');
  assert.equal(L.restedPending(fresh(), '2026-03-05'), false, 'no sessions yet');
  assert.equal(L.restedPending(sess(L.setRestDays(fresh(), [2], '2026-03-01'), '2026-03-05'), '2026-03-06'), false, 'no rest day between');
});

/* ---------- Rested in the Tower ---------- */
test('Rested: +10% Sweat on the first session after a rest day, one-off, no stacking', () => {
  let s = L.setRestDays(fresh(), [1, 2], '2026-02-01');   // Tue and Wed rest
  s = withDays(s, ['2026-03-02', '2026-03-05', '2026-03-06']);   // Mon, then Thu after two rest days, then Fri
  G.syncRewards(s, 0);
  const paid = (i) => s.game.paid['s:' + s.sessions[i].id];
  assert.equal(paid(0), 105, 'the first session ever is not rested');
  assert.equal(paid(1), Math.round(100 * 1.10 * 1.10), 'x1.10 streak step and +10% Rested, once even with two rest days');
  assert.equal(paid(2), Math.round(100 * 1.15), 'the next session is back to normal');
  assert.equal(G.syncRewards(s, 0).sweat, 0, 'paid once');
});
test('Rested: a second session the same day, and a day with no rest day between, get nothing extra', () => {
  let s = L.setRestDays(fresh(), [2], '2026-02-01');
  s = withDays(s, ['2026-03-03', '2026-03-05', '2026-03-05', '2026-03-06']);   // Tue, Thu (Wed rest), Thu again, Fri
  G.syncRewards(s, 0);
  const p = (i) => s.game.paid['s:' + s.sessions[i].id];
  assert.equal(p(1), Math.round(110 * 1.10)); assert.equal(p(2), Math.round(110 * 0.5), '2nd session pays half, with no Rested');
  assert.equal(p(3), Math.round(100 * 1.15));
});
test('Rested: Stamina adds to it (it is one more +10%, not a multiplier on a multiplier)', () => {
  let s = L.setRestDays(fresh(), [2], '2026-02-01'); G.ensureGame(s).focusUp.endurance = 2;
  s = withDays(s, ['2026-03-03', '2026-03-05']); G.syncRewards(s, 0);
  assert.equal(s.game.paid['s:' + s.sessions[1].id], Math.round(110 * (1 + 0.2 + 0.1)));
});
test('Rested: the streak multiplier counts through rest days', () => {
  let s = L.setRestDays(fresh(), [2], '2026-02-01'); s = withDays(s, ['2026-03-02', '2026-03-03', '2026-03-05']);
  G.syncRewards(s, 0); assert.equal(s.game.paid['s:' + s.sessions[2].id], Math.round(100 * 1.15 * 1.10));
});

/* ---------- weekly bounty ---------- */
const WK = '2026-03-02';
const kindWeek = (st, kind, from = WK) => { for (let i = 0; i < 80; i++) { const ws = L.addDays(from, 7 * i), b = B.genBounty(st, ws); if (b.kind === kind) return b; } return null; };
const withHistory = (st) => { let s = st; for (let w = 1; w <= 4; w++) s = sess(s, L.addDays(WK, -7 * w), { sets: [{ moveId: 'hpush', level: 0, reps: 8 }] }); return s; };

test('bounty: generation is deterministic (same state and week, no dice), and varies by week', () => {
  const s = withHistory(fresh()), r = Math.random; Math.random = () => { throw new Error('no dice'); };
  try { assert.deepEqual(B.genBounty(s, WK), B.genBounty(structuredClone(s), WK)); assert.deepEqual(B.genBounty(s, WK), B.genBounty(s, WK)); } finally { Math.random = r; }
  const kinds = new Set(Array.from({ length: 30 }, (_, i) => B.genBounty(s, L.addDays(WK, 7 * i)).kind)); assert.ok(kinds.size >= 3, [...kinds].join());
  const b = B.genBounty(s, WK); assert.equal(b.week, WK); assert.equal(b.claimed, false); assert.ok(['days', 'best', 'level', 'full', 'fast'].includes(b.kind));
  const lv = structuredClone(s); lv.moves.squat.level = 3; assert.ok(Array.from({ length: 30 }, (_, i) => JSON.stringify(B.genBounty(lv, L.addDays(WK, 7 * i)))).join() !== Array.from({ length: 30 }, (_, i) => JSON.stringify(B.genBounty(s, L.addDays(WK, 7 * i)))).join(), 'level state is part of the seed');
});
test('bounty: kinds are only picked when they can be met', () => {
  const none = new Set(Array.from({ length: 60 }, (_, i) => B.genBounty(fresh(), L.addDays(WK, 7 * i)).kind)); assert.ok(!none.has('best') && !none.has('fast'), 'a new user has no best and no fasts');
  assert.ok(none.has('days') && none.has('level') && none.has('full'));
  let f = withHistory(fresh()); f.fasts.push({ id: 'f', start: '2026-02-20T00:00:00.000Z', end: '2026-02-20T15:00:00.000Z', goalHours: 16 });
  const withFast = new Set(Array.from({ length: 60 }, (_, i) => B.genBounty(f, L.addDays(WK, 7 * i)).kind)); assert.ok(withFast.has('best') && withFast.has('fast'));
  const short = withHistory(fresh()); short.fasts.push({ id: 'f', start: '2026-02-20T00:00:00.000Z', end: '2026-02-20T05:00:00.000Z', goalHours: 16 });
  assert.ok(![...Array.from({ length: 60 }, (_, i) => B.genBounty(short, L.addDays(WK, 7 * i)).kind)].includes('fast'), 'a fast under the minimum does not count');
  const b = kindWeek(f, 'best'); assert.ok(MOVES[b.move] && b.target === 1);
});
test('bounty: Train N days scales to the last 4 weeks (average + 1), 3 to 5', () => {
  const long = (st, per) => { let s = st; for (let w = 0; w < 80; w++) s = withDays(s, range(L.addDays('2025-12-01', 7 * w), per)); return s; };   // data in every week the scan looks at
  const heavy = long(fresh(), 7), light = long(fresh(), 1), none = fresh();
  assert.equal(kindWeek(heavy, 'days').target, 5, 'capped at 5');
  assert.equal(kindWeek(none, 'days').target, 3, 'at least 3'); assert.equal(kindWeek(light, 'days').target, 3);
  assert.equal(kindWeek(long(fresh(), 3), 'days').target, 4, '3 a week average + 1'); assert.equal(kindWeek(long(fresh(), 5), 'days').target, 5);
  assert.equal(kindWeek(heavy, 'full').target, 4); assert.equal(kindWeek(none, 'full').target, 2);
});
test('bounty: progress for each kind comes from real data in that week only', () => {
  const week = (kind, extra = {}) => ({ week: WK, kind, target: 3, claimed: false, ...extra });
  let s = fresh();
  assert.equal(B.bountyProgress(s, week('days')), 0);
  s = withDays(s, ['2026-03-02', '2026-03-04'], { minimum: true }); s = sess(s, '2026-03-04'); s = sess(s, '2026-03-04'); s = sess(s, '2026-03-01'); s = sess(s, '2026-03-09');   // the last two are outside the week
  assert.equal(B.bountyProgress(s, week('days')), 2, 'days, not sessions; minimum counts');
  assert.equal(B.bountyProgress(s, week('full')), 1, 'only Wed has a full session');
  s = sess(s, '2026-03-08'); assert.equal(B.bountyProgress(s, week('days')), 3); assert.equal(B.bountyProgress(sess(s, '2026-03-07'), week('days')), 3, 'capped at the target');
  assert.equal(B.bountyProgress(s, week('level', { target: 1 })), 0);
  s = ev(s, { type: 'levelUp', moveId: 'row', level: 1 }); s = ev(s, { type: 'targetUp', moveId: 'row' }); assert.equal(B.bountyProgress(s, week('level', { target: 1 })), 1);
  assert.equal(B.bountyProgress(s, week('best', { move: 'hpush', target: 1 })), 0);
  s = ev(s, { type: 'pb', moveId: 'squat', value: 9 }); assert.equal(B.bountyProgress(s, week('best', { move: 'hpush', target: 1 })), 0, 'a best on another move is not it');
  s = ev(s, { type: 'pb', moveId: 'hpush', value: 9 }); assert.equal(B.bountyProgress(s, week('best', { move: 'hpush', target: 1 })), 1);
  const old = ev(fresh(), { type: 'levelUp', moveId: 'row' }); old.events[0].at = new Date(2026, 1, 20, 9).toISOString(); assert.equal(B.bountyProgress(old, week('level', { target: 1 })), 0, 'last week does not count');
  s.fasts.push({ id: 'a', start: new Date(2026, 2, 3, 0).toISOString(), end: new Date(2026, 2, 3, 14).toISOString(), goalHours: 16 }, { id: 'b', start: new Date(2026, 2, 4, 0).toISOString(), end: new Date(2026, 2, 4, 6).toISOString(), goalHours: 16 }, { id: 'c', start: new Date(2026, 2, 5, 0).toISOString(), end: null, goalHours: 16 });
  assert.equal(B.bountyProgress(s, week('fast')), 1, 'only the completed fast past the minimum (12 h)');
  s.fasts.push({ id: 'd', start: new Date(2026, 2, 5, 0).toISOString(), end: new Date(2026, 2, 5, 20).toISOString(), goalHours: 16 }); assert.equal(B.bountyProgress(s, week('fast')), 2);
});
test('bounty: ensureBounty picks this week once, and replaces it a week later', () => {
  const s = withHistory(fresh()); assert.equal(B.ensureBounty(s, '2026-03-04'), true); const b = structuredClone(s.game.bounty);
  assert.equal(b.week, WK); assert.equal(B.ensureBounty(s, '2026-03-08'), false); assert.deepEqual(s.game.bounty, b, 'stays all week');
  assert.equal(B.ensureBounty(s, '2026-03-10'), true); assert.equal(s.game.bounty.week, '2026-03-09', 'an unfinished one is replaced on Tuesday');
  const t = withHistory(fresh()); B.ensureBounty(t, '2026-03-04'); B.ensureBounty(t, '2026-03-09'); assert.equal(t.game.bounty.week, '2026-03-09', 'and on Monday');
});
test('bounty: store only week, kind, target, move, claimed', () => {
  const s = withHistory(fresh()); B.ensureBounty(s, '2026-03-04'); const k = Object.keys(s.game.bounty).sort();
  assert.ok(k.every((x) => ['week', 'kind', 'target', 'move', 'claimed'].includes(x)), k.join());
  assert.equal(store.importJSON(store.exportJSON(s)).game.bounty.kind, s.game.bounty.kind);
});
const doneBounty = () => { let s = fresh(); s = withDays(s, range(WK, 6)); s.game = { ...G.ensureGame(s) }; s.game.bounty = { week: WK, kind: 'days', target: 3, claimed: false }; G.ensureGame(s); return s; };
test('bounty: claim gives a rare-or-better chest item at the current tier and a key, once only', () => {
  const s = doneBounty(), g = s.game; g.floor = 35; g.keys = 1;
  assert.equal(B.bountyStatus(s, '2026-03-05').claimable, true);
  const r = B.claimBounty(s, '2026-03-05', () => 0.5);
  assert.ok(r && r.item); assert.ok(['rare', 'epic'].includes(r.item.rarity)); assert.equal(r.item.tier, 4); assert.equal(r.keys, 1); assert.equal(g.keys, 2); assert.equal(g.bounty.claimed, true);
  assert.ok(r.item.aff.length >= 2, 'a normal rare has 2 affixes'); assert.equal(G.findItem(g, r.item.id).tier, 4, 'it is in the gear or the stash');
  const before = JSON.stringify(g);
  assert.equal(B.claimBounty(s, '2026-03-05', () => 0.5), null); assert.equal(JSON.stringify(g), before, 'a second claim changes nothing');
  assert.equal(B.bountyStatus(s, '2026-03-05').claimed, true); assert.equal(B.bountyStatus(s, '2026-03-05').claimable, false);
});
test('bounty: every roll is rare or better, even with a rng that would give common', () => {
  for (const v of [0, 0.3, 0.74, 0.95, 0.999]) { const s = doneBounty(); const r = B.claimBounty(s, '2026-03-05', () => v); assert.ok(r.item.rarity !== 'common', String(v)); }
});
test('bounty: the key respects the cap, and not finished means no claim', () => {
  const s = doneBounty(); s.game.keys = G.CONFIG.keyCap; const r = B.claimBounty(s, '2026-03-05'); assert.equal(r.keys, 0); assert.equal(s.game.keys, G.CONFIG.keyCap);
  const t = withDays(fresh(), range(WK, 2)); G.ensureGame(t).bounty = { week: WK, kind: 'days', target: 3, claimed: false };
  assert.equal(B.bountyStatus(t, '2026-03-05').claimable, false); assert.equal(B.claimBounty(t, '2026-03-05'), null); assert.equal(t.game.bounty.claimed, false);
});
test('bounty: expiry. Claimable until the next Monday ends, then gone', () => {
  const s = doneBounty();
  for (const d of ['2026-03-02', '2026-03-08', '2026-03-09']) assert.equal(B.bountyStatus(s, d).claimable, true, d);
  assert.equal(B.bountyStatus(s, '2026-03-10').claimable, false); assert.equal(B.bountyStatus(s, '2026-03-10').expired, true);
  assert.equal(B.bountyStatus(s, '2026-03-01').claimable, false, 'not before its week');
  const late = doneBounty(); assert.equal(B.claimBounty(late, '2026-03-10'), null); assert.equal(late.game.bounty.claimed, false);
  // ensureBounty holds a finished unclaimed one through Monday, then it goes
  const m = doneBounty(); assert.equal(B.ensureBounty(m, '2026-03-09'), false); assert.equal(m.game.bounty.week, WK); assert.equal(B.bountyStatus(m, '2026-03-09').last, true);
  assert.ok(B.claimBounty(m, '2026-03-09', () => 0.5), 'claimed on the Monday');
  assert.equal(B.ensureBounty(m, '2026-03-10'), true); assert.equal(m.game.bounty.week, '2026-03-09'); assert.equal(m.game.bounty.claimed, false);
  const t = doneBounty(); assert.equal(B.ensureBounty(t, '2026-03-10'), true); assert.equal(t.game.bounty.week, '2026-03-09', 'unclaimed and the Monday passed: gone');
  const u = doneBounty(); u.sessions = u.sessions.slice(0, 1); assert.equal(B.ensureBounty(u, '2026-03-09'), true, 'an unfinished one does not wait');
  const c = doneBounty(); c.game.bounty.claimed = true; assert.equal(B.ensureBounty(c, '2026-03-09'), true, 'a claimed one does not wait');
});
test('bounty: text and short form', () => {
  assert.equal(B.bountyText({ kind: 'days', target: 4 }), 'Train 4 days'); assert.equal(B.bountyText({ kind: 'best', move: 'hpush', target: 1 }), 'Beat your best on Push-up');
  assert.equal(B.bountyText({ kind: 'level', target: 1 }), 'Level up any move'); assert.equal(B.bountyText({ kind: 'full', target: 3 }), 'Do a full session (not minimum) on 3 days');
  assert.equal(B.bountyText({ kind: 'fast', target: 2 }), 'Fast 2 times past your minimum');
  assert.equal(B.bountyShort({ now: 2, target: 4, b: { kind: 'days' } }), '2/4 days');
});
test('bounty: a bad saved bounty is dropped on load, a missing one is fine (old saves)', () => {
  const s = fresh(); G.ensureGame(s).bounty = { week: 5, kind: 'nope' }; assert.equal(G.ensureGame(s).bounty, undefined);
  const t = fresh(); assert.equal(G.ensureGame(t).bounty, undefined);
  const u = fresh(); G.ensureGame(u).bounty = { week: WK, kind: 'days', target: 3 }; assert.equal(G.ensureGame(u).bounty.claimed, false);
});
test('bounty: the Tower card and the loot card render, and the chest card names itself', () => {
  const s = doneBounty(); s.game.floor = 12; const r = B.claimBounty(s, '2026-03-05', () => 0.5);
  const card = V.lootHtml(s.game, r.item, 'Bounty chest', '<div>x</div>'); assert.ok(card.includes('Bounty chest') && !card.includes('Boss down'));
  assert.ok(V.lootHtml(s.game, r.item).includes('Boss down'));
});

/* ---------- gear sets ---------- */
const MV = Object.keys(MOVES);
const piece = (g, slot, set, extra = {}) => { const it = { slot, tier: 1, rarity: 'common', bonus: 0, aff: [], lvl: 0, lock: false, added: false, set, ...extra }; g.gear[slot] = it; G.ensureGame({ game: g }); return it; };
const bareGame = () => { const s = fresh(); const g = G.ensureGame(s); g.stats = { atk: 0, hp: 0, spd: 0 }; return g; };
test('sets: 8 sets, one per move, named after it, 3 pieces each', () => {
  assert.deepEqual(G.SET_IDS.slice().sort(), MV.slice().sort()); assert.equal(G.SET_IDS.length, 8);
  const names = G.SET_IDS.map((id) => G.CONFIG.sets[id].name); assert.deepEqual(names.slice().sort(), ['Atlas', 'Bulwark', 'Coil', 'Keystone', 'Skyward', 'Strider', 'Tidecaller', 'Vanguard']); assert.equal(G.CONFIG.sets.hpush.name, 'Vanguard');
  for (const id of G.SET_IDS) { assert.ok(Object.keys(G.CONFIG.sets[id].two).length && Object.keys(G.CONFIG.sets[id].three).length, id); assert.ok(SP.SET_COLOR[id] && SP.PAL[SP.SET_COLOR[id]], `${id} has a PAL accent`); }
  assert.equal(new Set(Object.values(SP.SET_COLOR)).size, 8, 'each set has its own colour');
});
test('sets: drop only on levelUp events, once each, for that move', () => {
  let s = fresh(); G.ensureGame(s).kw = true; const g = () => s.game;   // sess and ev clone the state
  s = sess(s, '2026-03-02'); s = ev(s, { type: 'pb', moveId: 'hpush', value: 9 }); s = ev(s, { type: 'targetUp', moveId: 'hpush', value: 9 }); s = ev(s, { type: 'levelDown', moveId: 'hpush', value: 0 });
  assert.equal(G.syncRewards(s, 0).pieces.length, 0); assert.equal(G.setPieces(g(), 'hpush').length, 0);
  s = ev(s, { type: 'levelUp', moveId: 'hpush', value: 1 });
  const r = G.syncRewards(s, 0); assert.equal(r.pieces.length, 1); assert.equal(r.pieces[0].kind, 'piece'); assert.equal(r.pieces[0].set, 'hpush'); assert.equal(G.setPieces(g(), 'hpush').length, 1);
  assert.equal(g().paid['es:' + s.events[s.events.length - 1].id], 1);
  assert.equal(G.syncRewards(s, 0).pieces.length, 0, 'sync twice pays once'); assert.equal(G.setPieces(g(), 'hpush').length, 1);
  const back = store.importJSON(store.exportJSON(s)); assert.equal(G.syncRewards(back, 0).pieces.length, 0, 'import and reload pay nothing more');
  s = ev(s, { type: 'levelUp', moveId: 'nope', value: 1 }); assert.equal(G.syncRewards(s, 0).pieces.length, 0, 'an unknown move gives no piece');
  assert.ok(!SP.SET_COLOR.nope);
});
test('sets: no duplicate until the set is complete, then duplicates upgrade', () => {
  const s = fresh(), g = G.ensureGame(s); g.kw = true; g.floor = 12;
  const slots = []; for (let i = 0; i < 3; i++) { const r = G.giveSetPiece(g, 'squat', () => 0.3); assert.equal(r.kind, 'piece'); slots.push(r.slot); }
  assert.deepEqual(slots.slice().sort(), ['armour', 'boots', 'weapon'], 'three different slots'); assert.equal(G.setPieces(g, 'squat').length, 3);
  const w = G.setPieces(g, 'squat').sort((a, b) => a.id - b.id).map((x) => x.lvl); assert.deepEqual(w, [0, 0, 0]);
  const up = G.giveSetPiece(g, 'squat', () => 0.3); assert.equal(up.kind, 'upgrade'); assert.equal(G.setPieces(g, 'squat').length, 3, 'still 3 pieces');
  assert.equal(G.setPieces(g, 'squat').reduce((a, x) => a + (x.lvl || 0), 0), 1, 'one temper level');
  G.giveSetPiece(g, 'squat', () => 0.3); G.giveSetPiece(g, 'squat', () => 0.3); assert.equal(G.setPieces(g, 'squat').length, 3); assert.equal(G.setPieces(g, 'squat').reduce((a, x) => a + x.lvl, 0), 3);
  assert.deepEqual(Math.max(...G.setPieces(g, 'squat').map((x) => x.lvl)), 1, 'spread over the weakest first');
  assert.equal(G.setPieces(g, 'row').length, 0, 'another move is not affected');
});
test('sets: a duplicate raises the weakest piece to the current tier (affixes scale), else tempers', () => {
  const s = fresh(), g = G.ensureGame(s); g.kw = true; g.floor = 5;
  for (let i = 0; i < 3; i++) G.giveSetPiece(g, 'core', () => 0.5);
  const ps = () => G.setPieces(g, 'core'); assert.ok(ps().every((x) => x.tier === 1));
  g.floor = 25; const before = ps().map((x) => ({ id: x.id, a: x.aff.map((a) => a.v), b: x.bonus })); const up = G.giveSetPiece(g, 'core', () => 0.5);
  const it = ps().find((x) => x.tier === 3); assert.ok(it, 'one piece moved to tier 3'); assert.equal(up.id, it.id); assert.equal(ps().filter((x) => x.tier === 1).length, 2);
  const b0 = before.find((x) => x.id === it.id); assert.ok(it.bonus > b0.b); it.aff.forEach((a, i) => assert.ok(a.v > b0.a[i], 'affix scaled up'));
  assert.equal(it.look, G.lookOf(it)); assert.equal(it.lvl, 0);
});
test('sets: a piece is the current tier, rare or better, with normal affixes and a set field', () => {
  for (const v of [0, 0.5, 0.99]) {
    const s = fresh(), g = G.ensureGame(s); g.floor = 47; const r = G.giveSetPiece(g, 'hinge', () => v), it = G.findItem(g, r.id);
    assert.equal(it.set, 'hinge'); assert.equal(it.tier, 5); assert.ok(it.rarity === 'rare' || it.rarity === 'epic'); assert.equal(it.aff.length, G.CONFIG.maxAffix[it.rarity]); assert.ok(it.aff.every((a) => G.CONFIG.affix[a.id]));
    assert.equal(it.bonus, G.CONFIG.gearPct * 5 * G.CONFIG.rarity[it.rarity].mult); assert.equal(it.look, G.lookOf(it));
  }
  const g = G.ensureGame(fresh()); g.floor = 1; assert.equal(G.findItem(g, G.giveSetPiece(g, 'row').id).tier, 1);
});
test('sets: the first sync pays at most welcomeSets pieces from history, newest first', () => {
  let s = fresh(); s = sess(s, '2026-03-02'); const ids = [];
  for (let i = 0; i < 5; i++) { s = ev(s, { type: 'levelUp', moveId: MV[i], value: 1 }); ids.push(s.events[s.events.length - 1].id); }
  const r = G.syncRewards(s, 0, () => 0.4); assert.equal(r.pieces.length, G.CONFIG.welcomeSets);
  assert.deepEqual(r.pieces.map((p) => p.set), [MV[4], MV[3], MV[2]]); assert.equal(s.game.paid['es:' + ids[0]], 0); assert.equal(s.game.paid['es:' + ids[4]], 1);
  s = ev(s, { type: 'levelUp', moveId: 'row', value: 2 }); assert.equal(G.syncRewards(s, 0, () => 0.4).pieces.length, 1, 'after that every level-up pays');
});
test('sets: 2 and 3 piece bonus maths (stats)', () => {
  const g = bareGame(), base = G.heroStats(g);
  assert.equal(base.atk, 5); assert.equal(base.hp, 50); assert.equal(base.spd, 1);
  piece(g, 'weapon', 'hpush'); let h = G.heroStats(g); assert.equal(h.atk, base.atk, '1 piece: nothing');
  piece(g, 'armour', 'hpush'); h = G.heroStats(g); close(h.atk, 5 * 1.10); assert.equal(h.hp, base.hp);
  piece(g, 'boots', 'hpush'); h = G.heroStats(g); close(h.atk, 5 * 1.25); close(h.crit, 0.05);
  G.ensureGame({ game: g }); assert.equal(G.setFx(g).atk, 0.25);
  const m = bareGame(); piece(m, 'weapon', 'squat'); piece(m, 'boots', 'squat'); close(G.heroStats(m).hp, 50 * 1.10); piece(m, 'armour', 'squat'); close(G.heroStats(m).hp, 50 * 1.25); close(G.affixTotal(m, 'guard'), 0.05);
  const a = bareGame(); piece(a, 'weapon', 'hinge'); piece(a, 'armour', 'hinge'); close(G.heroStats(a).atk, 5 * 1.05); close(G.heroStats(a).hp, 50 * 1.05); piece(a, 'boots', 'hinge'); close(G.heroStats(a).atk, 5 * 1.13); close(G.affixTotal(a, 'thorns'), 0.08);
});
test('sets: themed effects (lifesteal, boss timer, speed, Sweat, crit, damage to bosses)', () => {
  const t = bareGame(); piece(t, 'weapon', 'row'); piece(t, 'armour', 'row'); close(G.affixTotal(t, 'lifesteal'), 0.05); close(G.heroStats(t).spd, 1); piece(t, 'boots', 'row'); close(G.affixTotal(t, 'lifesteal'), 0.10); close(G.heroStats(t).spd, 1.05);
  const k = bareGame(); piece(k, 'weapon', 'core'); piece(k, 'armour', 'core'); close(G.bossTimer(k), 30 * 1.15); close(G.fight(k, 10).timer, 30 * 1.15); piece(k, 'boots', 'core'); close(G.bossTimer(k), 30 * 1.30); close(G.affixTotal(k, 'boss'), 0.10);
  k.talents.wind = 2; close(G.bossTimer(k), 60 * 1.30, 1e-9);
  const sk = bareGame(); piece(sk, 'weapon', 'vpush'); piece(sk, 'armour', 'vpush'); close(G.heroStats(sk).spd, 1.08); piece(sk, 'boots', 'vpush'); close(G.heroStats(sk).spd, 1.16); close(G.affixTotal(sk, 'ward'), 0.12);
  const st = bareGame(); piece(st, 'weapon', 'calf'); piece(st, 'armour', 'calf'); close(G.trainBonus(st), 0.05); piece(st, 'boots', 'calf'); close(G.trainBonus(st), 0.10); close(G.heroStats(st).spd, 1.08);
  const co = bareGame(); piece(co, 'weapon', 'hamcurl'); piece(co, 'armour', 'hamcurl'); close(G.heroStats(co).crit, 0.04); piece(co, 'boots', 'hamcurl'); close(G.heroStats(co).crit, 0.08); close(G.heroStats(co).critMult, 2.4);
});
test('sets: bonuses add to affixes, share their caps, and mixed sets do not combine', () => {
  const g = bareGame(); piece(g, 'weapon', 'calf', { aff: [{ id: 'train', v: 0.28 }] }); piece(g, 'armour', 'calf'); close(G.affixTotal(g, 'train'), 0.30, 1e-9, 'capped at 30% over everything');
  const m = bareGame(); piece(m, 'weapon', 'hpush'); piece(m, 'armour', 'squat'); piece(m, 'boots', 'hinge'); assert.deepEqual(G.setFx(m), {}); assert.equal(G.activeSets(m).length, 3);
  assert.deepEqual(G.activeSets(m).map((x) => [x.name, x.n, x.two, x.three]).sort(), [['Atlas', 1, false, false], ['Bulwark', 1, false, false], ['Vanguard', 1, false, false]]);
  const n = bareGame(); piece(n, 'weapon', 'hpush'); piece(n, 'armour', 'hpush'); piece(n, 'boots', 'squat'); assert.deepEqual(G.activeSets(n).map((x) => [x.name, x.n, x.two, x.three]), [['Vanguard', 2, true, false], ['Bulwark', 1, false, false]]);
  assert.equal(G.setFx(bareGame()), G.setFx(bareGame()), 'no set means the shared empty object');
});
test('sets: fight uses the set (a 3 piece Vanguard hits harder)', () => {
  const g = bareGame(), a = G.fight(g, 3).dps; piece(g, 'weapon', 'hpush'); piece(g, 'armour', 'hpush'); piece(g, 'boots', 'hpush');
  assert.ok(G.fight(g, 3).dps > a * 1.25, 'attack x1.25 and a little crit');
});
test('sets: compare shows the set count and bonus change of a swap', () => {
  const g = bareGame(); piece(g, 'weapon', 'hpush'); piece(g, 'armour', 'hpush'); const boots = { slot: 'boots', tier: 1, rarity: 'rare', bonus: 0.075, aff: [], lvl: 0, lock: false, added: false, set: 'hpush', id: 91 }; g.stash.push(boots);
  const c = G.compareItem(g, boots); assert.deepEqual(c.sets, [{ id: 'hpush', name: 'Vanguard', from: 2, to: 3 }]);
  const plain = { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0, aff: [], lvl: 0, lock: false, added: false, id: 92 };
  assert.deepEqual(G.compareItem(g, plain).sets, [{ id: 'hpush', name: 'Vanguard', from: 2, to: 1 }], 'swapping a piece out loses it');
  const same = { ...g.gear.weapon, id: 93, aff: [] }; assert.deepEqual(G.compareItem(g, same).sets, [], 'a like for like piece changes no count');
  assert.deepEqual(G.compareItem(g, g.gear.weapon).sets, [], 'the worn item');
  g.stash.push(plain); const html = V.cmpHtml(g, { sel: boots.id, msg: '' }); assert.ok(html.includes('Vanguard') && html.includes('2/3') && html.includes('3/3') && html.includes('3 piece'), html);
  assert.ok(V.cmpHtml(g, { sel: plain.id, msg: '' }).includes('loses'));
  assert.ok(V.tileLabel(boots, false).includes('Vanguard set piece')); assert.ok(V.gearHtml(g).includes('Vanguard') && V.gearHtml(g).includes('2/3 worn'));
  assert.ok(V.gearHtml(bareGame()).includes('No set pieces worn'));
});
test('sets: set pieces are kept when the stash overflows and on ascend', () => {
  const s = fresh(), g = G.ensureGame(s); g.floor = 25; g.tokens = 1; g.runMax = 25;
  G.giveSetPiece(g, 'row', () => 0.2); G.giveSetPiece(g, 'row', () => 0.2); G.giveSetPiece(g, 'row', () => 0.2);
  for (let i = 0; i < 12; i++) G.giveDrop(g, { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05, aff: [], lvl: 0, lock: false, added: false, floor: 1 });
  assert.equal(G.setPieces(g, 'row').length, 3, 'plain items are scrapped first'); assert.ok(g.stash.length <= G.stashMax(g));
  G.ascend(g); assert.equal(G.setPieces(g, 'row').length, 3, 'ascending keeps them');
});
test('sets: the hero wears a set coloured trim only with all 3 pieces (the 4th look entry)', () => {
  const g = bareGame(); piece(g, 'weapon', 'row', { tier: 3, rarity: 'rare' }); piece(g, 'armour', 'row', { tier: 3, rarity: 'rare' });
  assert.equal(V.gearLooks(g).length, 3); const boots = { slot: 'boots', tier: 3, rarity: 'rare', bonus: 0, aff: [], lvl: 0, lock: false, added: false, set: 'row', id: 77 }; boots.look = G.lookOf(boots);
  const tried = V.gearLooks(g, boots); assert.equal(tried.length, 4); assert.equal(tried[3], 'row'); assert.equal(g.gear.boots, null, 'try-on does not equip');
  piece(g, 'boots', 'row', { tier: 3, rarity: 'rare' }); assert.equal(V.gearLooks(g)[3], 'row'); assert.equal(V.gearLooks(g).length, 4);
  const other = { ...boots, set: 'core' }; assert.equal(V.gearLooks(g, other).length, 3, 'trying on another set takes the trim off');
});
test('sets: the 3 piece trim is drawn from PAL in all 6 frames, nowhere clipped, and plain gear is unchanged', () => {
  const looks = ['weapon.longsword.rare', 'armour.chain.rare', 'boots.leather.rare'];
  for (const id of G.SET_IDS) for (const f of SP.FRAMES) {
    const a = SP.heroMap(f, looks), b = SP.heroMap(f, [...looks, id]), role = String(G.SET_IDS.indexOf(id) >= 0 ? Object.keys(SP.SET_COLOR).indexOf(id) + 1 : 0);
    assert.equal(b.length, a.length); assert.ok(b.every((r) => r.length === a[0].length)); assert.notEqual(b.join('/'), a.join('/'), `${id}:${f} differs`); assert.ok(b.join('').includes(role), `${id}:${f} uses its role`);
    assert.ok(!a.join('').includes(role), 'the plain doll has no trim');
    assert.equal(SP.PALETTE[role], SP.PAL[SP.SET_COLOR[id]]);
  }
  assert.deepEqual(SP.CLIPS, {});
  assert.deepEqual(SP.heroMaps(looks), SP.heroMaps([...looks, '']), 'an empty 4th entry changes nothing'); assert.deepEqual(SP.heroMap('idleA', looks), SP.heroMap('idleA', [...looks, 'nope']));
  assert.deepEqual(SP.heroMap('idleA', ['weapon.sword.rare', 'armour.chain.rare', '', 'row']), SP.heroMap('idleA', ['weapon.sword.rare', 'armour.chain.rare', '']), 'no trim without all 3 pieces');
  assert.equal(SP.heroSig(looks), 'weapon.longsword.rare|armour.chain.rare|boots.leather.rare'); assert.equal(SP.heroSig([...looks, 'row']), 'weapon.longsword.rare|armour.chain.rare|boots.leather.rare|row');
  for (const w of SP.HERO_LOOK_STYLES.weapon) for (const a of SP.HERO_LOOK_STYLES.armour) for (const f of SP.FRAMES) assert.ok(SP.heroMap(f, [`weapon.${w}.epic`, `armour.${a}.epic`, 'boots.iron.epic', 'hpush']).some((r) => /[^.]/.test(r)));
  assert.deepEqual(SP.CLIPS, {});
});
test('sets: save compatibility. Old items without a set load, a junk set is dropped, `set` survives export and import', () => {
  const s = fresh(), g = G.ensureGame(s); g.gear.weapon = { slot: 'weapon', tier: 2, rarity: 'rare', bonus: 0.15, floor: 20 };
  g.stash.push({ slot: 'boots', tier: 1, rarity: 'common', bonus: 0.05, set: 'unicorn' });
  const t = store.importJSON(store.exportJSON(s)), h = G.ensureGame(t);
  assert.equal(h.gear.weapon.set, undefined); assert.equal(h.stash[0].set, undefined, 'unknown set removed');
  const u = fresh(), q = G.ensureGame(u); q.floor = 15; G.giveSetPiece(q, 'hpush', () => 0.5); G.giveSetPiece(q, 'hpush', () => 0.5);
  const v = G.ensureGame(store.importJSON(store.exportJSON(u))); assert.equal(G.setPieces(v, 'hpush').length, 2); assert.ok(G.setPieces(v, 'hpush').every((x) => x.set === 'hpush' && x.look));
  assert.equal(G.heroStats(G.ensureGame(fresh())).atk, 5, 'no set, no change');
  assert.deepEqual(G.compareItem(g, g.gear.weapon).sets, []);
});

function close(a, b, e = 1e-9, m = '') { assert.ok(Math.abs(a - b) <= e, `${m} ${a} vs ${b}`); }
