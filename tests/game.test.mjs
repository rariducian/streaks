import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as store from '../js/store.js';
import * as G from '../js/game/engine.js';

const D = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi);
const fresh = () => L.defaultState(D(2026, 1, 1));
const sess = (st, date, extra = {}) => { const s = structuredClone(st); s.sessions.push({ id: 's' + s.sessions.length + date, date, startedAt: date + 'T0' + (s.sessions.length % 10) + ':00:00', minimum: false, sets: [], ...extra }); return s; };
const days = (st, from, n, extra) => { let s = st; for (let i = 0; i < n; i++) s = sess(s, L.addDays(from, i), extra); return s; };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const game = (patch = {}) => { const s = fresh(); const g = G.ensureGame(s); Object.assign(g, patch); return g; };
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('ensureGame is lazy, fills defaults and keeps existing data', () => {
  const s = fresh(); assert.equal(s.game, undefined);
  const g = G.ensureGame(s);
  assert.equal(g, s.game); assert.equal(g.floor, 1); assert.deepEqual(g.stats, { atk: 0, hp: 0, spd: 0 }); assert.equal(g.gear.weapon, null);
  g.sweat = 7; assert.equal(G.ensureGame(s).sweat, 7);
});

test('game survives store normalise, export and import', () => {
  const s = fresh(); G.ensureGame(s).sweat = 123; s.game.paid.x = 1;
  assert.equal(store.normalise(s).game.sweat, 123);
  const back = store.importJSON(store.exportJSON(s));
  assert.equal(back.game.sweat, 123); assert.equal(back.game.paid.x, 1);
  assert.equal(L.migrate(s).game.sweat, 123);
});

test('rewards: sync twice pays once', () => {
  const s = sess(fresh(), '2026-02-01');
  const a = G.syncRewards(s, 0), b = G.syncRewards(s, 0);
  assert.equal(a.sweat, 105); assert.equal(b.sweat, 0); assert.equal(s.game.sweat, 105);
  const s2 = store.importJSON(store.exportJSON(s));   // import and reload do not pay again
  assert.equal(G.syncRewards(s2, 0).sweat, 0);
});

test('rewards: minimum day, and 2nd session of a day pays half, 3rd nothing', () => {
  let s = sess(fresh(), '2026-02-01', { minimum: true });
  G.syncRewards(s); assert.equal(s.game.sweat, 42);       // 40 x 1.05
  s = sess(s, '2026-02-01'); G.syncRewards(s); assert.equal(s.game.sweat, 42 + 53);   // 100 x 1.05 / 2 = 52.5
  s = sess(s, '2026-02-01'); G.syncRewards(s); assert.equal(s.game.sweat, 95);
});

test('rewards: streak multiplier is taken at the session date and capped at x1.5', () => {
  const s = days(fresh(), '2026-02-01', 12); G.syncRewards(s);
  const paid = (i) => s.game.paid['s:' + s.sessions[i].id];
  assert.equal(paid(0), 105); assert.equal(paid(1), 110); assert.equal(paid(9), 150); assert.equal(paid(11), 150);
  assert.equal(G.streakMult(30), 1.5);
  // a gap resets the streak for later sessions
  let t = sess(sess(fresh(), '2026-02-01'), '2026-02-05'); G.syncRewards(t);
  assert.equal(t.game.paid['s:' + t.sessions[1].id], 105);
});

test('rewards: level-up gives 300 and a token, PB gives 100, once each', () => {
  const s = fresh(); s.events.push({ id: 'a', type: 'levelUp' }, { id: 'b', type: 'pb' }, { id: 'c', type: 'targetUp' });
  const r = G.syncRewards(s); assert.deepEqual([r.sweat, r.tokens], [400, 1]);
  assert.equal(s.game.tokens, 1); assert.equal(G.syncRewards(s).sweat, 0);
});

test('rewards: fasts pay focus with cap, short fasts pay nothing', () => {
  const s = fresh(), mk = (id, h) => ({ id, start: new Date(2026, 1, 1).toISOString(), end: new Date(2026, 1, 1, h).toISOString(), goalHours: 16 });
  s.fasts.push(mk('a', 12), mk('b', 16), mk('c', 11), mk('d', 40), { id: 'run', start: D(2026, 2, 3).toISOString(), end: null });
  G.syncRewards(s);
  assert.equal(s.game.paid['f:a'], 30); assert.equal(s.game.paid['f:b'], 50); assert.equal(s.game.paid['f:c'], undefined); assert.equal(s.game.paid['f:d'], 80);
  assert.equal(s.game.focus, 160); assert.equal(G.syncRewards(s).focus, 0);
  s.settings.fastMinHours = 16; s.fasts.push(mk('e', 15)); assert.equal(G.syncRewards(s).focus, 0);
});

test('cost formulas and stats', () => {
  assert.equal(G.statCost('atk', 0), 20); assert.equal(G.statCost('atk', 10), Math.ceil(20 * 1.04 ** 10));
  assert.equal(G.statCost('spd', 5), Math.ceil(25 * 1.05 ** 5));
  assert.equal(G.focusCost('endurance', 2), Math.ceil(30 * 1.4 ** 2)); assert.equal(G.focusCost('precision', 1), Math.ceil(30 * 1.25)); assert.equal(G.focusCost('luck', 3), Math.ceil(40 * 1.3 ** 3));
  const g = game({ stats: { atk: 10, hp: 10, spd: 100 }, souls: 5 });
  let h = G.heroStats(g); close(h.atk, 25 * 1.5 * 1.5); close(h.hp, 200 * 1.5 * 1.5);   // milestone at level 10, then souls close(h.spd, 3);
  g.gear.boots = { slot: 'boots', tier: 1, rarity: 'common', bonus: 0.1 }; close(G.heroStats(g).spd, 3.3);
  g.focusUp.precision = 5; close(G.heroStats(g).crit, 0.1);
  const e = G.enemy(11); close(e.hp, 20 * 1.075 ** 10); close(e.atk, 2 * 1.075 ** 10);
  close(G.heroStats(game({ stats: { atk: 9, hp: 0, spd: 0 } })).atk, 23); close(G.heroStats(game({ stats: { atk: 20, hp: 0, spd: 0 } })).atk, 45 * 1.5 ** 2);   // no milestone at 9, two at 20
  const b = G.enemy(10); close(b.hp, 20 * 1.075 ** 9 * G.CONFIG.bossHp); close(b.atk, 2 * 1.075 ** 9 * G.CONFIG.bossAtk);
});

test('buying spends and respects limits', () => {
  const g = game({ sweat: 40, focus: 5000 });
  assert.equal(G.buyStat(g, 'atk'), true); assert.equal(g.sweat, 20); assert.equal(g.stats.atk, 1);
  assert.equal(G.buyStat(g, 'atk'), false);   // costs 21
  assert.equal(G.buyStat(g, 'nope'), false);
  for (let i = 0; i < 10; i++) G.buyFocus(g, 'luck');
  assert.equal(g.focusUp.luck, 10); assert.equal(G.buyFocus(g, 'luck'), false);
});

test('fight: win and loss, closed form', () => {
  const g = game();
  const f1 = G.fight(g, 1); assert.equal(f1.win, true); close(f1.t, 4); close(f1.dps, 5);
  const f2 = G.fight(g, 30); assert.equal(f2.win, false);
  g.grit = 1; close(G.fight(g, 1).t, 2);
  g.focusUp.precision = 10; close(G.fight(g, 1).dps, 5 * 2 * 1.2);
});

test('grit is capped at +25%, so a player who never trains stalls', () => {
  const g = game({ floor: 16, runMax: 16 });   // an untrained hero cannot beat floor 16, even with full grit
  assert.equal(G.fight(g, 16).win, false);
  G.advance(g, 2 * 3600, () => 0.9);
  close(g.grit, G.CONFIG.gritMax); assert.equal(g.floor, 16);
  G.advance(g, 48 * 3600, () => 0.9); assert.equal(g.floor, 16);   // capped grit is not enough, no matter how long
  const h = game({ floor: 14, runMax: 14 }); assert.equal(G.fight(h, 14).win, false);   // a wall just inside the cap does fall
  assert.ok(G.advance(h, 3 * 3600, () => 0.9).floors >= 1);
  const day = game(); G.advance(day, 24 * 3600, () => 0.9); assert.equal(day.floor, 16);   // a whole day of idling reaches the same wall
});

test('grit rises per failed try (compounding), reaches the cap in about an hour, and resets on a clear', () => {
  const g = game({ floor: 40 });
  G.advance(g, 35, () => 0);   // 3 failed tries of 10 s
  close(g.grit, 1.0007 ** 3 - 1, 1e-9); assert.equal(g.floor, 40); close(g.prog, 5, 1e-9);
  const h = game({ floor: 40 }); G.advance(h, 3000, () => 0); assert.ok(h.grit > 0.2 && h.grit < 0.25);
  G.advance(h, 600, () => 0); close(h.grit, 0.25);
  const w = game({ floor: 1, grit: 0.2 }); G.advance(w, 7, () => 0.9); assert.equal(w.floor, 2); assert.equal(w.grit, 0);
});

test('boss timer: a boss not dead in 30 s is lost even if the hero survives', () => {
  const T = G.CONFIG.bossTimer; assert.equal(T, 30);
  const g = game({ stats: { atk: 0, hp: 5000, spd: 0 } });   // tanky but weak
  const f = G.fight(g, 60); assert.ok(f.t > T); assert.ok(f.enemy.atk * f.t < f.hero.hp, 'would survive'); assert.equal(f.late, true); assert.equal(f.win, false);
  const n = G.fight(g, 59); assert.ok(n.t > T); assert.equal(n.win, true);   // a normal floor only checks survival
  const s = game({ floor: 60, stats: { atk: 0, hp: 5000, spd: 0 } }); G.advance(s, 600, () => 0.9); assert.equal(s.floor, 60);
  const strong = game({ stats: { atk: 80, hp: 5000, spd: 20 } }); const sf = G.fight(strong, 60); assert.ok(sf.t < T); assert.equal(sf.win, true);
  const frail = game({ stats: { atk: 20, hp: 0, spd: 20 } }); assert.equal(G.fight(frail, 60).win, false); assert.equal(G.fight(frail, 60).late, false);   // dies, not late
});

test('advance: floor time is t + walk/speed, partial progress carries', () => {
  const g = game();
  assert.equal(G.advance(g, 5, () => 0.9).floors, 0); close(g.prog, 5);
  const r = G.advance(g, 1.5, () => 0.9); assert.equal(r.floors, 1); assert.equal(g.floor, 2); close(g.prog, 0.5);
  assert.equal(g.bestFloor, 2); assert.equal(g.runMax, 2);
});

test('speed shortens the walk: walk = 2 s / hero speed', () => {
  const g = game({ stats: { atk: 0, hp: 0, spd: 50 } });   // speed 3
  const f = G.fight(g, 1); close(f.walk, 2 / 3); close(f.t, 20 / (5 * 3));
  assert.equal(G.advance(g, f.t + 0.7, () => 0.9).floors, 1);
  const slow = game(); close(G.fight(slow, 1).walk, 2); assert.equal(G.advance(slow, 4 + 0.7, () => 0.9).floors, 0);
});

test('boss every 10th floor drops one item', () => {
  assert.equal(G.isBoss(10), true); assert.equal(G.isBoss(20), true); assert.equal(G.isBoss(11), false);
  const g = game({ floor: 9, stats: { atk: 200, hp: 200, spd: 50 } });
  const sum = G.advance(g, 60, seq(0.1, 0.5));
  assert.equal(sum.bosses >= 1, true); assert.equal(sum.drops.length, sum.bosses);
  assert.equal(sum.drops[0].floor, 10); assert.equal(sum.drops[0].tier, 1); assert.equal(sum.drops[0].slot, 'weapon');
  assert.equal(g.drops.length > 0, true);
});

test('gear: tiers, rarities, luck, auto-equip and scrap', () => {
  const g = game();
  assert.equal(G.rollDrop(g, 10, seq(0, 0.99)).rarity, 'common'); assert.equal(G.rollDrop(g, 10, seq(0.4, 0.04)).rarity, 'epic');
  assert.equal(G.rollDrop(g, 10, seq(0.4, 0.2)).rarity, 'rare');
  const it = G.rollDrop(g, 25, seq(0.7, 0.99));
  assert.deepEqual([it.slot, it.tier, it.rarity], ['boots', 3, 'common']); close(it.bonus, 0.15);
  assert.equal(G.rollDrop(g, 20, seq(0.4, 0.1)).rarity, 'rare'); close(G.rollDrop(g, 20, seq(0.4, 0.1)).bonus, 0.05 * 2 * 1.5);
  g.focusUp.luck = 5; assert.equal(G.rollDrop(g, 10, seq(0.4, 0.14)).rarity, 'epic');   // epic now 15%
  const a = G.giveDrop(g, { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05, floor: 10 });
  assert.equal(a.equipped, true); assert.equal(g.gear.weapon.bonus, 0.05);
  const b = G.giveDrop(g, { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05, floor: 10 });   // equal is not better
  assert.deepEqual([b.equipped, b.scrap, g.sweat], [false, 5, 5]);
  const c = G.giveDrop(g, { slot: 'weapon', tier: 3, rarity: 'rare', bonus: 0.225, floor: 30 }); assert.equal(c.equipped, true);
  const d = G.giveDrop(g, { slot: 'weapon', tier: 2, rarity: 'common', bonus: 0.1, floor: 20 });
  assert.deepEqual([d.equipped, g.sweat], [false, 15]);
  for (let i = 0; i < 8; i++) G.giveDrop(g, { slot: 'armour', tier: 1, rarity: 'common', bonus: 0.05, floor: 10 });
  assert.equal(g.drops.length, 5);
});

test('offline: simulates up to 24 h, Stamina does not change the cap', () => {
  const T = 1e12, mkg = (endurance) => { const s = fresh(), g = G.ensureGame(s); g.lastTick = T; g.focusUp.endurance = endurance; g.stats = { atk: 20, hp: 20, spd: 20 }; return s; };
  const run = (st, hours) => { G.offlineCatchUp(st, T + hours * 3600e3, () => 0.9); return st.game; };
  assert.equal(G.offlineCapSec(mkg(0).game), 24 * 3600); assert.equal(G.offlineCapSec(mkg(5).game), 24 * 3600);
  const g1 = run(mkg(0), 100), g2 = run(mkg(0), 24), g3 = run(mkg(5), 100), g4 = run(mkg(0), 12);
  assert.equal(g1.floor, g2.floor);   // anything past 24 h is ignored
  assert.equal(g3.floor, g1.floor); assert.ok(g2.floor >= g4.floor);
  assert.equal(G.ensureGame({ game: { focusUp: { endurance: 9 } } }).focusUp.endurance, 5);   // old saves are clamped to the new max
});

test('Stamina (endurance): +10% Sweat per level on session sweat only', () => {
  const mk = (lv) => { const s = sess(fresh(), '2026-02-01'); s.events.push({ id: 'lv', type: 'levelUp' }); G.ensureGame(s).focusUp.endurance = lv; return s; };
  const a = mk(0), b = mk(3), c = mk(5);
  G.syncRewards(a); G.syncRewards(b); G.syncRewards(c);
  assert.equal(a.game.paid['s:' + a.sessions[0].id], 105); assert.equal(b.game.paid['s:' + b.sessions[0].id], Math.round(105 * 1.3)); assert.equal(c.game.paid['s:' + c.sessions[0].id], Math.round(105 * 1.5));
  assert.equal(c.game.paid['e:lv'], 300);   // events are not multiplied
  assert.equal(G.focusMax('endurance'), 5);
});

test('offline: sets the away summary once, moves lastTick, skips short trips', () => {
  const T = 1e12, s = fresh(), g = G.ensureGame(s); g.lastTick = T; g.stats = { atk: 30, hp: 30, spd: 30 };
  const a = G.offlineCatchUp(s, T + 3 * 3600e3, () => 0.9);
  assert.ok(a.floors > 0); assert.equal(a.seconds, 3 * 3600); assert.equal(a.capped, false); assert.equal(g.away, a); assert.equal(g.lastTick, T + 3 * 3600e3); assert.equal(a.to, g.floor);
  const g2 = G.ensureGame(fresh()); const s2 = { game: g2 }; assert.equal(G.offlineCatchUp(s2, 5000), null); assert.equal(g2.lastTick, 5000);   // first load
  g2.lastTick = 1e6; assert.equal(G.offlineCatchUp(s2, 1e6 + 30000, () => 0.9), null); assert.equal(g2.away, null);
  assert.equal(G.offlineCatchUp(s2, 5e5), null); assert.equal(g2.lastTick, 5e5);   // clock went backwards
  const cap = fresh(); G.ensureGame(cap).lastTick = T; assert.equal(G.offlineCatchUp(cap, T + 40 * 3600e3, () => 0.9).capped, true);
});

test('ascend: needs a token and floor 20, gives sqrt souls (+10% each), keeps only the best gear', () => {
  const g = game({ tokens: 0, runMax: 50, floor: 50 });
  assert.equal(G.canAscend(g), false); assert.equal(G.ascend(g), null);
  g.tokens = 1; g.runMax = 19; assert.equal(G.canAscend(g), false); assert.equal(G.ascend(g), null); assert.equal(g.tokens, 1);
  Object.assign(g, { runMax: 50, floor: 47, bestFloor: 55, sweat: 99, focus: 12, souls: 2, grit: 0.2, prog: 3, stats: { atk: 4, hp: 5, spd: 6 } });
  g.focusUp.luck = 2; g.gear.weapon = { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05 }; g.gear.armour = { slot: 'armour', tier: 3, rarity: 'rare', bonus: 0.225 }; g.gear.boots = { slot: 'boots', tier: 2, rarity: 'common', bonus: 0.1 };
  assert.equal(G.ascend(g), 7);
  assert.deepEqual([g.souls, g.tokens, g.floor, g.runMax, g.grit, g.prog], [9, 0, 1, 1, 0, 0]);
  assert.equal(g.gear.weapon, null); assert.equal(g.gear.boots, null); assert.equal(g.gear.armour.bonus, 0.225);   // best item stays
  assert.equal(g.bestFloor, 55);
  assert.deepEqual([g.sweat, g.focus, g.focusUp.luck, g.stats.hp], [99, 12, 2, 5]);
  close(G.heroStats(g).atk, (5 + 2 * 4) * 1.9); close(G.heroStats(g).hp, (50 + 15 * 5) * 1.225 * 1.9);
  const e = game({ tokens: 1, runMax: 25 }); G.ascend(e); assert.deepEqual(Object.values(e.gear), [null, null, null]);   // nothing to keep
});

test('advance respects the iteration limit', () => {
  const g = game({ stats: { atk: 500, hp: 500, spd: 80 } });
  const t0 = Date.now(); G.advance(g, 1e9, () => 0.9); assert.ok(Date.now() - t0 < 3000); assert.ok(g.floor > 1);
});
