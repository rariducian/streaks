// Monthly recap: pure stats, the floor log in the engine, and a smoke test of the card (needs a canvas, so that part is skipped under plain node).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as G from '../js/game/engine.js';
import * as R from '../js/recap.js';
import { MOVES } from '../js/data.js';

const NOW = new Date(2026, 8, 20, 12);   // Sun 20 Sep 2026. 1 Aug 2026 is a Saturday, 3 Aug a Monday, 1 Sep a Tuesday
const fresh = () => L.defaultState(new Date(2026, 0, 1));
const sess = (st, date, extra = {}) => { const s = structuredClone(st); s.sessions.push({ id: 's' + s.sessions.length + date, date, startedAt: date + 'T07:00:00', minimum: false, sets: [], ...extra }); return s; };
const days = (st, dates, extra) => dates.reduce((s, d) => sess(s, d, extra), st);
const ev = (st, at, e) => { const s = structuredClone(st); s.events.push({ id: 'e' + s.events.length, at: at.toISOString(), ...e }); return s; };
const fast = (st, start, end) => { const s = structuredClone(st); s.fasts.push({ id: 'f' + s.fasts.length, start: start.toISOString(), end: end ? end.toISOString() : null, goalHours: 16, note: '', mood: null }); return s; };
const aug = (n) => `2026-08-${String(n).padStart(2, '0')}`;
const rec = (st, ym = '2026-08', now = NOW) => R.monthRecap(st, ym, now);

test('recap: month boundaries for sessions, events and fasts (local dates)', () => {
  let s = days(fresh(), ['2026-07-31', aug(1), aug(31), '2026-09-01']);
  s = ev(s, new Date(2026, 7, 31, 23, 30), { type: 'levelUp', moveId: 'hpush', level: 1, value: 1 });
  s = ev(s, new Date(2026, 8, 1, 0, 10), { type: 'levelUp', moveId: 'squat', level: 1, value: 1 });
  s = fast(s, new Date(2026, 7, 30, 18), new Date(2026, 7, 31, 23, 50));   // ends in Aug
  s = fast(s, new Date(2026, 7, 31, 20), new Date(2026, 8, 1, 12));          // ends in Sep
  const a = rec(s), b = rec(s, '2026-09');
  assert.equal(a.trainingDays, 2); assert.equal(a.sessions, 2); assert.equal(b.trainingDays, 1);
  assert.deepEqual(a.levelUps.map((x) => x.moveId), ['hpush']); assert.deepEqual(b.levelUps.map((x) => x.moveId), ['squat']);
  assert.equal(a.fasts.count, 1); assert.equal(b.fasts.count, 1);
  assert.equal(a.daysInMonth, 31); assert.equal(a.cells.length, 31); assert.equal(a.offset, 5, '1 Aug 2026 is a Saturday');
  assert.equal(b.daysInMonth, 30); assert.equal(rec(s, '2026-02').daysInMonth, 28);
  assert.equal(rec(s, '2024-02').daysInMonth, 29);
});

test('recap: full vs minimum sessions and two sessions on one day', () => {
  const s = sess(sess(sess(fresh(), aug(3)), aug(3), { minimum: true }), aug(4), { minimum: true });
  const r = rec(s);
  assert.equal(r.trainingDays, 2); assert.equal(r.sessions, 3); assert.equal(r.full, 1); assert.equal(r.minimum, 2);
});

test('recap: longest streak in the month counts rest days as kept, not grown', () => {
  // Mon 3 Aug ... Wed 5 is the planned rest day
  const base = L.setRestDays(fresh(), [2], '2000-01-01');
  const s = days(base, [aug(3), aug(4), aug(6), aug(7), aug(10)]);   // Mon Tue (Wed rest) Thu Fri, miss Sat 8 and Sun 9, then Mon 10
  const r = rec(s);
  assert.equal(r.longestStreak, 4); assert.equal(r.trainingDays, 5);
  assert.equal(r.cells[4].s, 'r', 'Wed 5 is a rest day'); assert.equal(r.cells[7].s, 'n', 'Sat 8 is missed');
  assert.equal(rec(days(fresh(), [aug(3), aug(4), aug(6), aug(7), aug(10)])).longestStreak, 2, 'without the rest day Tue to Thu breaks');
  assert.equal(rec(days(base, [aug(3), aug(4), aug(5), aug(6)])).longestStreak, 4, 'training on a rest day counts as normal');
});

test('recap: a streak does not carry in from the month before, and a freeze keeps it going', () => {
  const r = rec(days(fresh(), ['2026-07-29', '2026-07-30', '2026-07-31', aug(1)]));
  assert.equal(r.longestStreak, 1);
  // 6 days then 1 more earns a freeze (7th day), so a miss on day 8 is frozen and day 9 carries on
  const f = rec(days(fresh(), [aug(1), aug(2), aug(3), aug(4), aug(5), aug(6), aug(7), aug(9), aug(10)]));
  assert.equal(f.cells[7].s, 'z'); assert.equal(f.longestStreak, 9); assert.equal(f.missed > 0, true);
});

test('recap: reps by move, core in seconds, both sides and legacy sets', () => {
  let s = sess(fresh(), aug(3), { sets: [{ moveId: 'hpush', level: 0, reps: 10 }, { moveId: 'hpush', level: 0, reps: 12 }, { moveId: 'core', level: 0, reps: 40 }, { moveId: 'row', level: null, legacy: 'Old', reps: 5, side: 'L' }, { moveId: 'nope', reps: 99 }] });
  s = sess(s, aug(4), { minimum: true, sets: [{ moveId: 'hpush', level: 0, reps: 8 }, { moveId: 'core', level: 0, reps: 25 }] });
  s = sess(s, '2026-07-31', { sets: [{ moveId: 'hpush', level: 0, reps: 100 }] });
  const r = rec(s), by = Object.fromEntries(r.reps.map((x) => [x.moveId, x]));
  assert.equal(by.hpush.total, 30); assert.equal(by.core.total, 65); assert.equal(by.core.unit, 'sec'); assert.equal(by.row.total, 5);
  assert.equal(by.nope, undefined); assert.equal(r.repTotal, 35, 'core is left out of the rep total'); assert.equal(r.coreSec, 65);
  assert.equal(r.reps.length, 3);
});

test('recap: level-ups with move and level names, in order, and PBs', () => {
  let s = ev(fresh(), new Date(2026, 7, 20, 9), { type: 'levelUp', moveId: 'squat', level: 2, value: 2 });
  s = ev(s, new Date(2026, 7, 5, 9), { type: 'levelUp', moveId: 'hpush', level: 1, value: 1 });
  s = ev(s, new Date(2026, 7, 6, 9), { type: 'pb', moveId: 'hpush', level: 1, value: 15 });
  s = ev(s, new Date(2026, 7, 7, 9), { type: 'targetUp', moveId: 'hpush', level: 1, value: 9 });
  s = ev(s, new Date(2026, 7, 8, 9), { type: 'levelUp', moveId: 'hinge', level: null, legacy: 'Two-hand KB swing', value: null });
  const r = rec(s);
  assert.deepEqual(r.levelUps.map((x) => x.moveId), ['hpush', 'hinge', 'squat']);
  assert.equal(r.levelUps[0].level, MOVES.hpush.levels[1].name); assert.equal(r.levelUps[0].move, MOVES.hpush.name);
  assert.equal(r.levelUps[1].level, 'Two-hand KB swing'); assert.equal(r.levelUps[2].level, MOVES.squat.levels[2].name);
  assert.equal(r.pbs, 1);
});

test('recap: fasts completed, average and longest hours; a running fast is not counted', () => {
  let s = fast(fresh(), new Date(2026, 7, 3, 20), new Date(2026, 7, 4, 12));   // 16 h
  s = fast(s, new Date(2026, 7, 10, 20), new Date(2026, 7, 11, 16));          // 20 h
  s = fast(s, new Date(2026, 7, 31, 20), null);                               // running, never finished
  const f = rec(s).fasts;
  assert.equal(f.count, 2); assert.equal(f.avgHours, 18); assert.equal(f.longestHours, 20);
  const none = rec(fresh()).fasts; assert.deepEqual(none, { count: 0, avgHours: 0, longestHours: 0 });
  const c = rec(s).cells;
  assert.equal(c[3].f, true, 'a fast ending 4 Aug marks that day'); assert.equal(c[4].f, false);
});

test('recap: floorLog gives floors and bosses; months without a log show null', () => {
  const s = fresh(); s.game = { floor: 25, floorLog: { '2026-08': 5, '2026-09': 12 } };
  const a = rec(s).tower, b = rec(s, '2026-09').tower, j = rec(s, '2026-07').tower;
  assert.equal(a.floors, 7); assert.equal(a.bosses, 1); assert.equal(a.startFloor, 5); assert.equal(a.endFloor, 12);
  assert.equal(b.floors, 13, 'the current month runs to the floor now'); assert.equal(b.bosses, 1, 'floor 20 only: 10 was beaten before 12');
  assert.equal(j.floors, null); assert.equal(j.bosses, null);
  assert.equal(rec(fresh()).tower.floors, null, 'no game at all');
  const t = fresh(); t.game = { floor: 12, floorLog: { '2026-07': 3 } };
  assert.equal(rec(t, '2026-07').tower.floors, 9, 'no later log: ends at the floor now (floors only move while the Tower is open, which logs the month)');
  assert.equal(rec(t, '2026-08').tower.floors, null);
  const u = fresh(); u.game = { floor: 10, floorLog: { '2026-08': 10 } };
  assert.equal(rec(u).tower.bosses, 0); u.game.floor = 11; assert.equal(rec(u).tower.bosses, 1, 'floor 10 beaten once the hero is on 11');
  const d = fresh(); d.game = { floor: 3, floorLog: { '2026-08': 30 } };   // ascended: floor went back down
  assert.equal(rec(d).tower.floors, 0); assert.equal(rec(d).tower.bosses, 0);
  assert.equal(rec(s, '2026-10').tower.floors, null, 'a future month');
});

test('engine: ensureGame logs the starting floor of the month once, and old saves still load', () => {
  const s = fresh(); s.game = { floor: 7, runMax: 7, bestFloor: 7 };   // an old save: no floorLog
  const g = G.ensureGame(s), ym = L.monthOf(new Date());
  assert.deepEqual(g.floorLog, { [ym]: 7 });
  g.floor = 9; G.ensureGame(s); assert.equal(g.floorLog[ym], 7, 'the month keeps the floor it began on');
  s.game.floorLog = { 'bad': 4, '2026-01': 'x', '2026-02': 3 }; G.ensureGame(s);
  assert.deepEqual(Object.keys(s.game.floorLog).sort(), ['2026-02', ym].sort());
  s.game.floorLog = [1, 2]; assert.doesNotThrow(() => G.ensureGame(s)); assert.deepEqual(Object.keys(s.game.floorLog), [ym]);
  assert.equal(L.monthOf(new Date(2026, 0, 31, 23, 59)), '2026-01');
});

test('engine: drops record when they fell, and the third set piece logs the completed set', () => {
  const g = G.ensureGame({}); g.floor = 10;
  const d = G.giveDrop(g, G.rollDrop(g, 10, () => 0.5));
  assert.equal(Number.isFinite(d.at), true); assert.equal(g.drops[0].at, d.at);
  const p = () => G.giveSetPiece(g, 'hpush', () => 0.5);
  p(); p(); assert.deepEqual(g.setLog, {}, 'two pieces is not a set');
  p(); assert.deepEqual(g.setLog[L.monthOf()], ['hpush']);
  p(); assert.deepEqual(g.setLog[L.monthOf()], ['hpush'], 'a duplicate upgrade does not log it again');
});

test('recap: best item found that month, and sets completed', () => {
  const s = fresh(), t = (m, d) => new Date(2026, m, d).getTime();
  s.game = { floor: 5, floorLog: { '2026-08': 1 }, drops: [
    { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05, aff: [], at: t(7, 3) }, { slot: 'armour', tier: 2, rarity: 'epic', bonus: 0.2, aff: [], at: t(7, 9) },
    { slot: 'boots', tier: 3, rarity: 'rare', bonus: 0.2, aff: [], at: t(7, 12) }, { slot: 'boots', tier: 9, rarity: 'epic', bonus: 0.9, aff: [], at: t(8, 2) }, { slot: 'boots', tier: 1, rarity: 'rare', bonus: 0.1, aff: [] }
  ], setLog: { '2026-08': ['hpush', 'zzz'] } };
  const a = rec(s).tower, b = rec(s, '2026-09').tower;
  assert.equal(a.bestItem.rarity, 'epic'); assert.equal(a.bestItem.slot, 'armour'); assert.equal(b.bestItem.tier, 9);
  assert.deepEqual(a.sets, [{ moveId: 'hpush', name: G.CONFIG.sets.hpush.name }]); assert.deepEqual(b.sets, []);
  assert.equal(rec(s, '2026-07').tower.bestItem, null, 'drops with no date are never placed in a month');
});

test('recap: headline rules', () => {
  const all = Array.from({ length: 31 }, (_, i) => aug(i + 1)), noSun = all.filter((d) => ![2, 9, 16, 23, 30].includes(Number(d.slice(8))));
  // best month yet: more training days than every earlier month
  let s = days(fresh(), ['2026-07-01', '2026-07-02', '2026-07-03', aug(3), aug(4), aug(6), aug(7)]);
  assert.equal(rec(s).headline, 'Best month yet');
  assert.notEqual(rec(days(fresh(), ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', aug(3), aug(4), aug(6), aug(7)])).headline, 'Best month yet', 'a tie is not a record');
  assert.notEqual(rec(days(fresh(), [aug(3), aug(4), aug(6)])).headline, 'Best month yet', 'the first month has nothing to beat');
  // unbroken: every day trained or a rest day
  const sun = L.setRestDays(fresh(), [6], '2000-01-01');
  assert.equal(rec(days(sun, noSun)).headline, 'Unbroken');
  assert.notEqual(rec(days(sun, noSun.filter((d) => d !== aug(12)))).headline, 'Unbroken', 'one missed day');
  assert.notEqual(rec(days(fresh(), noSun)).headline, 'Unbroken', 'Sundays are missed without the rest day');
  assert.notEqual(rec(days(sun, [aug(3), aug(4)])).headline, 'Unbroken', 'too few days');
  // best wins over unbroken
  assert.equal(rec(days(days(sun, ['2026-07-01', '2026-07-02']), noSun)).headline, 'Best month yet');
  // biggest single achievement
  let a = days(fresh(), [aug(3), aug(4)]);
  assert.equal(rec(a).headline, '2 days trained');
  assert.equal(rec(days(fresh(), [aug(3)])).headline, '1 day trained');
  assert.equal(rec(ev(a, new Date(2026, 7, 5), { type: 'pb', moveId: 'hpush', level: 0, value: 12 })).headline, '1 new best');
  const lu = (st, n) => ev(st, new Date(2026, 7, 5 + n), { type: 'levelUp', moveId: 'hpush', level: 1, value: 1 });
  assert.equal(rec(lu(a, 0)).headline, `Unlocked ${MOVES.hpush.levels[1].name.replace(/\s*\([^)]*\)\s*$/, '')}`);
  assert.equal(rec(lu(lu(a, 0), 1)).headline, '2 level-ups');
  const g = structuredClone(a); g.game = { floor: 25, floorLog: { '2026-08': 5 }, setLog: { '2026-08': ['squat'] } };
  assert.equal(rec(g).headline, `${G.CONFIG.sets.squat.name} set complete`);
  g.game.setLog = {}; assert.equal(rec(g).headline, 'Beat 2 bosses'); g.game.floor = 11; assert.equal(rec(g).headline, 'Beat 1 boss');
  assert.equal(rec(days(fresh(), [aug(3), aug(4), aug(5), aug(6), aug(7), aug(8), aug(9)])).headline, '7 day streak');
  assert.equal(rec(fast(fresh(), new Date(2026, 7, 3, 12), new Date(2026, 7, 4, 12))).headline, '24 hour fast');
  assert.equal(rec(fast(fresh(), new Date(2026, 7, 3, 12), new Date(2026, 7, 4, 4))).headline, '1 fast done');
});

test('recap: an empty month has zeros, null tower numbers and a plain headline', () => {
  const r = rec(fresh());
  assert.equal(r.trainingDays, 0); assert.equal(r.sessions, 0); assert.equal(r.longestStreak, 0); assert.deepEqual(r.reps, []); assert.equal(r.repTotal, 0);
  assert.deepEqual(r.levelUps, []); assert.equal(r.pbs, 0); assert.equal(r.fasts.count, 0); assert.equal(r.tower.floors, null); assert.deepEqual(r.tower.sets, []);
  assert.equal(r.headline, 'A quiet month'); assert.equal(R.hasData(r), false); assert.equal(r.cells.length, 31);
  assert.equal(r.elapsed, 31); assert.equal(r.missed, 31);
  assert.match(R.summaryText(r), /^August 2026 recap\./);
});

test('recap: the current month only counts days so far, and today untrained is not a miss', () => {
  const s = days(fresh(), ['2026-09-18', '2026-09-19']);
  const r = rec(s, '2026-09');
  assert.equal(r.current, true); assert.equal(r.elapsed, 20); assert.equal(r.cells[19].s, 'n', 'today, not trained yet'); assert.equal(r.cells[20].s, 'x', 'tomorrow');
  assert.equal(r.longestStreak, 2); assert.equal(r.missed, 17, '1 to 17 Sep missed, today is not');
  assert.equal(rec(days(s, ['2026-09-20']), '2026-09').cells[19].s, 't');
});

test('recapMonths: months with data plus this one, newest first, never the future', () => {
  let s = days(fresh(), ['2026-06-10', aug(3), '2026-11-02']);
  s = fast(s, new Date(2026, 3, 29, 20), new Date(2026, 3, 30, 14));
  s = ev(s, new Date(2026, 4, 2), { type: 'pb', moveId: 'hpush', level: 0, value: 3 });
  assert.deepEqual(R.recapMonths(s, NOW), ['2026-09', '2026-08', '2026-06', '2026-05', '2026-04']);
  assert.deepEqual(R.recapMonths(fresh(), NOW), ['2026-09']);
});

test('recap: summary text reads out the stats', () => {
  let s = days(fresh(), [aug(3), aug(4)], { sets: [{ moveId: 'hpush', level: 0, reps: 10 }, { moveId: 'core', level: 0, reps: 70 }] });
  s = fast(s, new Date(2026, 7, 3, 20), new Date(2026, 7, 4, 12));
  s.game = { floor: 12, floorLog: { '2026-08': 5 } };
  const t = R.summaryText(rec(s));
  assert.match(t, /August 2026 recap\. [^.]+\./); assert.match(t, /2 of 31 days trained, 2 sessions \(2 full, 0 minimum\), best streak 2/);
  assert.match(t, /20 reps and 2:20 of core/); assert.match(t, /1 fast, average 16h, longest 16h/); assert.match(t, /7 floors climbed, 1 boss beaten/);
});

test('recap: drawRecap makes a 1080 x 1350 card (browser only)', { skip: typeof document === 'undefined' }, () => {
  const cv = document.createElement('canvas'); R.drawRecap(cv, rec(fresh()), fresh());
  assert.equal(cv.width, 1080); assert.equal(cv.height, 1350);
});
