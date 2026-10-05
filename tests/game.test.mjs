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
  let h = G.heroStats(g); close(h.atk, 25 * 1.5); close(h.hp, 200 * 1.5); close(h.spd, 3);   // milestone at level 10. Souls do nothing by themselves any more (Soul tree)
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
  const g = game({ floor: 15, runMax: 15 });   // an untrained hero cannot beat the elite on floor 15 (Barracks), even with full grit
  assert.equal(G.fight(g, 15).win, false);
  G.advance(g, 2 * 3600, () => 0.9);
  close(g.grit, G.CONFIG.gritMax); assert.equal(g.floor, 15);
  G.advance(g, 48 * 3600, () => 0.9); assert.equal(g.floor, 15);   // capped grit is not enough, no matter how long
  const h = game({ floor: 13, runMax: 13 }); assert.equal(G.fight(h, 13).win, false);   // a wall just inside the cap does fall
  assert.ok(G.advance(h, 3 * 3600, () => 0.9).floors >= 1);
  const day = game(); G.advance(day, 24 * 3600, () => 0.9); assert.equal(day.floor, 15);   // a whole day of idling reaches the same wall
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

test('gear: tiers, rarities, luck, auto-equip power compare, stash and scrap', () => {
  const g = game();
  assert.equal(G.rollDrop(g, 10, seq(0, 0.99)).rarity, 'common'); assert.equal(G.rollDrop(g, 10, seq(0.4, 0.04)).rarity, 'epic');
  assert.equal(G.rollDrop(g, 10, seq(0.4, 0.2)).rarity, 'rare');
  const it = G.rollDrop(g, 25, seq(0.7, 0.99));
  assert.deepEqual([it.slot, it.tier, it.rarity], ['boots', 3, 'common']); close(it.bonus, 0.15);
  assert.equal(G.rollDrop(g, 20, seq(0.4, 0.1)).rarity, 'rare'); close(G.rollDrop(g, 20, seq(0.4, 0.1)).bonus, 0.05 * 2 * 1.5);
  g.focusUp.luck = 5; assert.equal(G.rollDrop(g, 10, seq(0.4, 0.14)).rarity, 'epic');   // epic now 15%
  const a = G.giveDrop(g, { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05, floor: 10 });
  assert.equal(a.equipped, true); assert.equal(g.gear.weapon.bonus, 0.05);
  const b = G.giveDrop(g, { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05, floor: 10 });   // equal is not better: it goes to the stash, not scrapped
  assert.deepEqual([b.equipped, b.scrap, g.sweat, g.stash.length], [false, 0, 0, 1]);
  const c = G.giveDrop(g, { slot: 'weapon', tier: 3, rarity: 'rare', bonus: 0.225, floor: 30 }); assert.equal(c.equipped, true);
  assert.equal(g.stash.length, 2); assert.equal(g.stash[1].bonus, 0.05);   // the old weapon is kept too
  const d = G.giveDrop(g, { slot: 'weapon', tier: 2, rarity: 'common', bonus: 0.1, floor: 20 });
  assert.deepEqual([d.equipped, g.stash.length], [false, 3]);
  for (let i = 0; i < 8; i++) G.giveDrop(g, { slot: 'armour', tier: 1, rarity: 'common', bonus: 0.05, floor: 10 });
  assert.equal(g.drops.length, 5);
});

const lcg = (seed = 7) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const item = (slot, tier, rarity, aff = [], extra = {}) => ({ slot, tier, rarity, bonus: 0.05 * tier * G.CONFIG.rarity[rarity].mult, floor: tier * 10, lvl: 0, aff, lock: false, added: false, ...extra });
const wear = (g, slot, it) => { g.gear[slot] = { id: ++g.seq, ...it }; return g.gear[slot]; };

test('affix rolls: 1/2/3 by rarity, no duplicates, deterministic per rng, scaled by tier', () => {
  const g = game(), r = lcg(), seen = {};
  for (let i = 0; i < 400; i++) {
    const d = G.rollDrop(g, 10 * (1 + i % 9), r), ids = d.aff.map((x) => x.id); seen[d.rarity] = (seen[d.rarity] || 0) + 1;
    assert.equal(d.aff.length, { common: 1, rare: 2, epic: 3 }[d.rarity]); assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((x) => G.AFFIXES.includes(x)) && d.aff.every((x) => x.v > 0));
  }
  assert.ok(seen.common && seen.rare && seen.epic);
  assert.deepEqual(G.rollDrop(g, 50, lcg(3)), G.rollDrop(g, 50, lcg(3))); assert.notDeepEqual(G.rollDrop(g, 50, lcg(3)).aff, G.rollDrop(g, 50, lcg(4)).aff);
  assert.equal(G.AFFIXES.length, 8);
  close(G.affixValue('guard', 1, 0.5), 0.06); close(G.affixValue('guard', 11, 0.5), 0.06 * 1.6); close(G.affixValue('guard', 1, 0), 0.048); close(G.affixValue('guard', 1, 1), 0.072);
  const all = G.AFFIXES.map((id) => ({ id, v: 0.1 })); assert.equal(G.rollAffix(1, all.slice(1), () => 0.5).id, all[0].id);   // only one left to pick
});

test('affixes in fight(): lifesteal, thorns, crit damage, boss slayer, swift, guard, zone ward', () => {
  const base = () => game({ stats: { atk: 5, hp: 5, spd: 5 } }), W = (g, aff) => wear(g, 'weapon', item('weapon', 1, 'epic', aff));
  const f0 = G.fight(base(), 1), dps0 = f0.dps, e0 = f0.edps;
  let g, f;
  g = base(); const w = W(g, [{ id: 'lifesteal', v: 0.2 }]); w.bonus = 0;   // heals 20% of damage dealt
  f = G.fight(g, 1); close(f.net, e0 - 0.2 * f.dps, 1e-9); close(f.dps, dps0, 1e-9);
  g = base(); wear(g, 'weapon', item('weapon', 1, 'epic', [{ id: 'thorns', v: 0.25 }], { bonus: 0 })); f = G.fight(g, 1); close(f.dps, dps0 + 0.25 * e0); assert.ok(f.t < f0.t);   // reflected damage shortens the fight
  g = base(); g.focusUp.precision = 10; const c0 = G.fight(g, 1).dps; wear(g, 'weapon', item('weapon', 1, 'epic', [{ id: 'critdmg', v: 0.5 }], { bonus: 0 })); close(G.fight(g, 1).dps / c0, (1 + 0.2 * 1.5) / (1 + 0.2 * 1)); close(G.heroStats(g).critMult, 2.5);
  g = base(); wear(g, 'weapon', item('weapon', 1, 'epic', [{ id: 'boss', v: 0.3 }], { bonus: 0 }));
  close(G.fight(g, 20).dps / G.fight(base(), 20).dps, 1.3); close(G.fight(g, 29).dps / G.fight(base(), 29).dps, 1);   // bosses only
  g = base(); wear(g, 'boots', item('boots', 1, 'epic', [{ id: 'swift', v: 0.2 }], { bonus: 0 })); close(G.fight(g, 1).dps / dps0, 1.2);
  g = base(); wear(g, 'armour', item('armour', 1, 'epic', [{ id: 'guard', v: 0.25 }], { bonus: 0 })); close(G.fight(g, 1).edps, e0 * 0.75); close(G.fight(g, 1).dps, dps0);
  g = base(); wear(g, 'armour', item('armour', 1, 'epic', [{ id: 'guard', v: 0.4 }], { bonus: 0 })); wear(g, 'weapon', item('weapon', 1, 'epic', [{ id: 'guard', v: 0.4 }], { bonus: 0 })); close(G.affixTotal(g, 'guard'), 0.5);   // capped
  g = base(); wear(g, 'weapon', item('weapon', 1, 'epic', [{ id: 'ward', v: 0.2 }], { bonus: 0 }));
  close(G.fight(g, 1).dps / dps0, 1);   // the Cellar has no trait, so nothing to ward
  close(G.fight(g, 20).dps / G.fight(base(), 20).dps, 1.2);   // Library has one
  // affixes with the elite and a won fight: a fight that was lost can be won with Guard
  const lose = game({ floor: 13 }); assert.equal(G.fight(lose, 13).win, false); wear(lose, 'armour', item('armour', 1, 'epic', [{ id: 'guard', v: 0.5 }], { bonus: 0 })); assert.equal(G.fight(lose, 13).win, true);
});

test('Training affix: +% session Sweat, added to Stamina, capped at +30% over all gear', () => {
  const mk = (aff) => { const s = sess(fresh(), '2026-02-01'), g = G.ensureGame(s); for (const [i, sl] of G.SLOTS.entries()) if (aff[i]) wear(g, sl, item(sl, 1, 'epic', [{ id: 'train', v: aff[i] }])); return s; };
  const paid = (s) => { G.syncRewards(s); return s.game.paid['s:' + s.sessions[0].id]; };
  assert.equal(paid(mk([])), 105); assert.equal(paid(mk([0.1])), Math.round(105 * 1.1)); assert.equal(paid(mk([0.2, 0.2, 0.2])), Math.round(105 * 1.3));
  const s = mk([0.1]); s.game.focusUp.endurance = 2; assert.equal(paid(s), Math.round(105 * 1.3));
});

test('lock: auto-equip never replaces a locked item; locked stash items are not scrapped', () => {
  const g = game(), a = G.giveDrop(g, item('weapon', 1, 'common', [{ id: 'guard', v: 0.05 }])); assert.ok(a.equipped);
  assert.equal(G.toggleLock(g, g.gear.weapon.id), true); assert.equal(g.gear.weapon.lock, true);
  const big = G.giveDrop(g, item('weapon', 9, 'epic', [{ id: 'guard', v: 0.2 }])); assert.equal(big.equipped, false); assert.equal(g.gear.weapon.tier, 1); assert.equal(g.stash.length, 1);
  assert.equal(G.equip(g, g.stash[0].id), false);   // manual swap also waits for an unlock
  G.toggleLock(g, g.gear.weapon.id); const better = G.giveDrop(g, item('weapon', 9, 'epic', [{ id: 'guard', v: 0.2 }])); assert.equal(better.equipped, true);
  assert.equal(G.toggleLock(g, 99999), false);
  const h = game(); G.giveDrop(h, item('boots', 5, 'common')); G.giveDrop(h, item('boots', 1, 'common')); const keep = h.stash[0]; keep.lock = true;
  for (let i = 0; i < 10; i++) G.giveDrop(h, item('boots', 1, 'common'));
  assert.equal(h.stash.length, 6); assert.ok(h.stash.includes(keep));
  const all = game(); G.giveDrop(all, item('boots', 9, 'epic')); for (let i = 0; i < 6; i++) { G.giveDrop(all, item('boots', 1, 'common')); all.stash[all.stash.length - 1].lock = true; }
  const sw = all.sweat; G.giveDrop(all, item('boots', 1, 'common')); assert.equal(all.stash.length, 6); assert.equal(all.sweat, sw + 5);   // everything in the stash is locked: the new drop is scrapped instead
});

test('stash: keeps the last 6 unequipped drops, overflow scraps the oldest for Sweat; manual equip swaps', () => {
  const g = game(); G.giveDrop(g, item('armour', 9, 'epic'));   // equipped, strongest
  const ids = []; for (let i = 1; i <= 8; i++) { G.giveDrop(g, item('armour', 1 + (i % 3), 'common')); ids.push(g.seq); }
  assert.equal(g.stash.length, 6); assert.deepEqual(g.stash.map((x) => x.id), ids.slice(2));   // the first two were scrapped, oldest first
  const first = g.sweat; assert.equal(first, 5 * (1 + (1 % 3)) + 5 * (1 + (2 % 3)));   // tier 2 then tier 3
  const x = g.stash[2], cur = g.gear.armour; assert.equal(G.equip(g, x.id), true); assert.equal(g.gear.armour, x); assert.ok(g.stash.includes(cur) && !g.stash.includes(x)); assert.equal(g.stash.length, 6);
  assert.equal(G.equip(g, 424242), false);
  const e = game(); const o = item('weapon', 2, 'rare'); G.giveDrop(e, item('armour', 1, 'common')); e.stash.push({ id: 77, ...o }); assert.equal(G.equip(e, 77), true); assert.ok(e.gear.weapon && e.stash.length === 0);   // empty slot
  const h = game(); h.talents.hoarder = 4; assert.equal(G.stashMax(h), 10);
});

test('power score: base bonus plus weighted affixes', () => {
  close(G.power({ bonus: 0.1, aff: [] }), 10); close(G.power(null), 0); close(G.power({ bonus: 0.05 }), 5);
  close(G.power({ bonus: 0.05, aff: [{ id: 'swift', v: 0.1 }] }), 5 + 10 * 1.5);
  const g = game(); G.giveDrop(g, item('weapon', 2, 'common', [], {})); const hi = G.giveDrop(g, item('weapon', 1, 'common', [{ id: 'swift', v: 0.2 }, { id: 'guard', v: 0.2 }], {}));
  assert.equal(hi.equipped, true);   // a lower base bonus wins on affixes
});

test('forge: costs scale with tier, rise with Temper level, and Ancestral forge cuts them', () => {
  const g = game(), it = item('weapon', 3, 'common'), F = G.CONFIG.forge;
  for (const a of ['reroll', 'add', 'upgrade']) assert.equal(G.forgeCost(g, a, it), Math.ceil(F[a] * 1.35 ** 3));
  assert.equal(G.forgeCost(g, 'temper', it), Math.ceil(F.temper * 1.35 ** 3)); assert.equal(G.forgeCost(g, 'temper', { ...it, lvl: 4 }), Math.ceil(F.temper * 1.35 ** 3 * F.temperGrow ** 4));
  assert.ok(G.forgeCost(g, 'reroll', item('weapon', 6, 'common')) > G.forgeCost(g, 'reroll', it));
  g.talents.ancestral = 3; assert.equal(G.forgeCost(g, 'reroll', it), Math.ceil(F.reroll * 1.35 ** 3 * 0.85));
});

test('forge: reroll one affix (your pick, no duplicates, keeps the rest)', () => {
  const g = game({ focus: 1000 }); wear(g, 'weapon', item('weapon', 2, 'epic', [{ id: 'guard', v: 0.1 }, { id: 'swift', v: 0.1 }, { id: 'boss', v: 0.1 }]));
  const c = G.forgeCost(g, 'reroll', g.gear.weapon), keep = [g.gear.weapon.aff[0], g.gear.weapon.aff[2]];
  assert.equal(G.forge(g, 'weapon', 'reroll', 1, lcg(5)), true); assert.equal(g.focus, 1000 - c);
  const a = g.gear.weapon.aff; assert.deepEqual([a[0], a[2]], keep); assert.notEqual(a[1].id, 'swift'); assert.equal(new Set(a.map((x) => x.id)).size, 3);
  for (let i = 0; i < 40; i++) { G.forge(g, 'weapon', 'reroll', i % 3, lcg(i)); assert.equal(new Set(g.gear.weapon.aff.map((x) => x.id)).size, 3); }
  assert.equal(G.forge(g, 'weapon', 'reroll', 3), false); assert.equal(G.forge(g, 'boots', 'reroll', 0), false);   // no such affix, empty slot
  const poor = game({ focus: c - 1 }); wear(poor, 'weapon', item('weapon', 2, 'common', [{ id: 'guard', v: 0.1 }])); assert.equal(G.forge(poor, 'weapon', 'reroll', 0), false); assert.equal(poor.focus, c - 1);
});

test('forge: add an affix once, up to max + 1; upgrade rarity adds one; temper is unbounded', () => {
  const g = game({ focus: 1e6 }); const w = wear(g, 'weapon', item('weapon', 2, 'common', [{ id: 'guard', v: 0.1 }]));
  assert.equal(G.forge(g, 'weapon', 'add', 0, lcg(1)), true); assert.equal(w.aff.length, 2); assert.equal(w.added, true);   // common max 1, so 2
  assert.equal(G.forge(g, 'weapon', 'add'), false); assert.equal(w.aff.length, 2);   // once per item
  const b0 = w.bonus; assert.equal(G.forge(g, 'weapon', 'upgrade', 0, lcg(2)), true); assert.equal(w.rarity, 'rare'); assert.equal(w.aff.length, 3); close(w.bonus, b0 * 1.5); close(w.bonus, 0.05 * 2 * 1.5);
  assert.equal(G.forge(g, 'weapon', 'upgrade', 0, lcg(3)), true); assert.equal(w.rarity, 'epic'); assert.equal(w.aff.length, 4); close(w.bonus, 0.05 * 2 * 2.2);
  assert.equal(G.forge(g, 'weapon', 'upgrade'), false); assert.equal(w.rarity, 'epic');   // nothing above epic
  assert.equal(new Set(w.aff.map((x) => x.id)).size, 4);
  const e = wear(g, 'armour', item('armour', 4, 'epic', [{ id: 'guard', v: 0.1 }, { id: 'swift', v: 0.1 }, { id: 'boss', v: 0.1 }]));
  assert.equal(G.forge(g, 'armour', 'add', 0, lcg(4)), true); assert.equal(e.aff.length, 4); assert.equal(G.forgeBlock(e, 'add'), 'Already added one');
  const r = wear(g, 'boots', item('boots', 1, 'rare', [{ id: 'guard', v: 0.1 }, { id: 'swift', v: 0.1 }], { added: false })); G.forge(g, 'boots', 'add', 0, lcg(9)); assert.equal(r.aff.length, 3);
  const t = wear(g, 'boots', item('boots', 1, 'common', [])), base = t.bonus, f0 = g.focus; let last = 0;
  for (let i = 1; i <= 12; i++) { const c = G.forgeCost(g, 'temper', t); assert.ok(c >= last); last = c; assert.equal(G.forge(g, 'boots', 'temper'), true); assert.equal(t.lvl, i); close(t.bonus, base * (1 + 0.05 * i)); }
  assert.ok(f0 > g.focus);
  const p = game({ focus: 1 }); wear(p, 'boots', item('boots', 1, 'common')); assert.equal(G.forge(p, 'boots', 'temper'), false); assert.equal(p.gear.boots.lvl, 0);
  assert.equal(G.forge(g, 'weapon', 'nope'), false);
});

test('tempered and upgraded items raise hero stats', () => {
  const g = game({ focus: 1e5 }); wear(g, 'weapon', item('weapon', 1, 'common')); const a0 = G.heroStats(g).atk;
  G.forge(g, 'weapon', 'temper'); close(G.heroStats(g).atk / a0, 1.0525 / 1.05);
});

test('zone traits: bands, laps and the text line', () => {
  assert.deepEqual(Z.traitsOf(1), []); assert.deepEqual(Z.traitsOf(15), ['armour']); assert.deepEqual(Z.traitsOf(25), ['arcane']); assert.deepEqual(Z.traitsOf(34), ['regen']);
  assert.deepEqual(Z.traitsOf(45), ['burn']); assert.deepEqual(Z.traitsOf(55), ['chill']); assert.deepEqual(Z.traitsOf(65), ['swift']);
  for (const f of [70, 75, 85, 95, 105, 135, 150, 200, 280]) { const t = Z.traitsOf(f); assert.ok(t.length >= 1 && t.length <= 2 && new Set(t).size === t.length, `floor ${f}: ${t}`); }
  assert.equal(Z.traitsOf(75).length, 2); assert.equal(Z.traitsOf(34 + 70).length, 2);   // later laps combine two
  assert.equal(Z.traitLine(34), 'Crypt: enemies regenerate. Burst damage helps.'); assert.match(Z.traitLine(1), /no enemy tricks/); assert.match(Z.traitLine(104), /^Deep Crypt: enemies regenerate and burn you\./);
  for (let f = 1; f < 400; f++) assert.ok(Z.traitLine(f).length < 115, Z.traitLine(f));
});

test('zone traits in fight(): armour, arcane, regen, burn, chill, swift hits', () => {
  const g = game({ stats: { atk: 30, hp: 30, spd: 10 } }), T = G.CONFIG.trait;
  // same enemy numbers, different zone: compare against the traitless maths
  const hs = G.heroStats(g), cell = G.fight(g, 4), e = (n) => G.enemy(n);
  close(cell.dps, hs.atk * hs.spd); close(cell.edps, e(4).atk);
  const arm = G.fight(g, 11), hit = hs.atk, cut = T.armour * e(11).hp; close(arm.dps, Math.max(hit * T.armourMin, hit - cut) * hs.spd); assert.ok(arm.dps < hit * hs.spd); close(arm.edps, e(11).atk);
  const lowHit = game({ stats: { atk: 0, hp: 30, spd: 30 } }); const f = G.fight(lowHit, 88), lh = G.heroStats(lowHit); close(f.dps, lh.atk * T.armourMin * lh.spd);   // many small hits: the cut is per hit, so Speed is worth less here
  const ar = G.fight(g, 21); close(ar.edps, e(21).atk * 1.3); close(ar.dps, hs.atk * hs.spd);
  const rg = G.fight(g, 34), reg = T.regen * e(34).hp; close(rg.dps, hs.atk * hs.spd - reg); assert.ok(rg.t > e(34).hp / (hs.atk * hs.spd));
  const weak = game({ stats: { atk: 0, hp: 500, spd: 0 } }); const wf = G.fight(weak, 108); assert.equal(wf.t, Infinity); assert.equal(wf.win, false);   // cannot out-damage the regen
  const bu = G.fight(g, 44); close(bu.edps, e(44).atk * (1 + T.burn)); close(bu.net, bu.edps);
  const ls = game({ stats: { atk: 30, hp: 30, spd: 10 } }); wear(ls, 'weapon', item('weapon', 1, 'epic', [{ id: 'lifesteal', v: 0.3 }], { bonus: 0 })); const lf = G.fight(ls, 44); close(lf.net, lf.edps - 0.3 * lf.dps);   // lifesteal counters the burn
  const ch = G.fight(g, 54); close(ch.dps, hs.atk * hs.spd * 0.75);
  const sw = game({ stats: { atk: 30, hp: 30, spd: 10 } }); wear(sw, 'boots', item('boots', 1, 'epic', [{ id: 'swift', v: 0.25 }], { bonus: 0 })); close(G.fight(sw, 54).dps, hs.atk * hs.spd * 1.0);   // Swift cancels the chill
  const sp = G.fight(g, 64); close(sp.edps, e(64).atk * T.swiftHits); assert.equal(T.swiftHits, 2);
  const two = G.fight(g, 104); assert.deepEqual(two.traits, ['regen', 'burn']);   // Deep Crypt: both
  close(two.edps, e(104).atk * (1 + T.burn)); assert.ok(two.dps < hs.atk * hs.spd);
  const guarded = game({ stats: { atk: 30, hp: 30, spd: 10 } }); wear(guarded, 'armour', item('armour', 1, 'epic', [{ id: 'guard', v: 0.4 }], { bonus: 0 })); close(G.fight(guarded, 44).edps, e(44).atk * 0.6 + T.burn * e(44).atk);   // burn ignores Guard
});

test('elites: every 5th non-boss floor has +15% HP and +10% attack', () => {
  const C = G.CONFIG, plain = (n) => ({ hp: C.enemyHp * C.enemyHpGrow ** (n - 1), atk: C.enemyAtk * C.enemyAtkGrow ** (n - 1) });
  for (const n of [5, 15, 25, 35, 65]) { const e = G.enemy(n); assert.equal(e.elite, true); close(e.hp, plain(n).hp * 1.15, 1e-6); close(e.atk, plain(n).atk * 1.1, 1e-6); }
  for (const n of [1, 4, 6, 10, 20, 50]) assert.equal(G.enemy(n).elite, false);
  close(G.enemy(10).hp, plain(10).hp * C.bossHp); close(G.enemy(11).hp, plain(11).hp);
  assert.equal(C.eliteHp, 1.15); assert.equal(C.eliteAtk, 1.1);
});

test('souls: old saves keep their count as unspent souls, old gear gets empty affixes', () => {
  const s = { game: { souls: 6, floor: 33, runMax: 40, stats: { atk: 5, hp: 5, spd: 1 }, gear: { weapon: { slot: 'weapon', tier: 2, rarity: 'rare', bonus: 0.15 }, armour: null }, drops: [{ slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05, equipped: false, scrap: 5 }] } };
  const g = G.ensureGame(s);
  assert.equal(g.souls, 6); assert.equal(g.soulsSpent, 0); assert.equal(G.soulsLeft(g), 6); assert.deepEqual(Object.values(g.talents), Array(8).fill(0)); assert.deepEqual(g.stash, []);
  assert.deepEqual(g.gear.weapon.aff, []); assert.equal(g.gear.weapon.lvl, 0); assert.equal(g.gear.weapon.lock, false); assert.equal(g.gear.weapon.bonus, 0.15); assert.ok(Number.isFinite(g.gear.weapon.id)); assert.equal(g.gear.boots, null);
  close(G.heroStats(g).atk, 15 * 1.15); assert.equal(G.fight(g, 33).hero.critMult, 2); assert.ok(Number.isFinite(G.fight(g, 33).t));
  assert.equal(G.ensureGame(s).souls, 6); G.advance(g, 3600, () => 0.5);   // a full run on the migrated save
  assert.equal(store.normalise(structuredClone(s)).game.souls, 6);
  const junk = G.ensureGame({ game: { souls: 2, soulsSpent: 99, talents: { might: 99, junk: 3 }, stash: [null, { slot: 'x' }, { slot: 'boots', tier: 1, rarity: 'common', bonus: 0.05, aff: [{ id: 'bogus', v: 1 }, { id: 'guard', v: 0.1 }, null] }], gear: { weapon: { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05, aff: 'x' } } } });
  assert.equal(junk.soulsSpent, 2); assert.equal(junk.talents.might, 20); assert.equal(junk.stash.length, 1); assert.deepEqual(junk.stash[0].aff, [{ id: 'guard', v: 0.1 }]); assert.deepEqual(junk.gear.weapon.aff, []);
  const ids = [junk.gear.weapon.id, junk.stash[0].id]; assert.equal(new Set(ids).size, 2);
});

test('soul tree: buying spends souls, costs rise, max levels, and Might and Vigour scale Attack and Health', () => {
  const g = game({ souls: 100 }), C = G.CONFIG.talents;
  assert.equal(G.TALENTS.length, 8); assert.equal(G.talentCost('might', 0), 2); assert.equal(G.talentCost('might', 3), Math.ceil(2 * 1.3 ** 3));
  const a0 = G.heroStats(g).atk, h0 = G.heroStats(g).hp;
  assert.equal(G.buyTalent(g, 'might'), true); assert.equal(g.soulsSpent, 2); assert.equal(G.soulsLeft(g), 98); close(G.heroStats(g).atk, a0 * 1.08); close(G.heroStats(g).hp, h0);
  G.buyTalent(g, 'might'); close(G.heroStats(g).atk, a0 * 1.16);
  assert.equal(G.buyTalent(g, 'vigour'), true); close(G.heroStats(g).hp, h0 * 1.08);
  const poor = game({ souls: 1 }); assert.equal(G.buyTalent(poor, 'might'), false); assert.equal(poor.talents.might, 0); assert.equal(G.buyTalent(poor, 'nope'), false);
  const rich = game({ souls: 1e6 }); for (const k of G.TALENTS) { for (let i = 0; i < 40; i++) G.buyTalent(rich, k); assert.equal(rich.talents[k], C[k].max, k); assert.equal(G.buyTalent(rich, k), false); }
  assert.deepEqual([C.head.max, C.wind.max, C.prospector.max, C.hoarder.max, C.fortune.max, C.ancestral.max], [6, 3, 5, 4, 5, 5]);
});

test('talents: head start (never past runMax - 1), second wind, prospector, hoarder, fortune, ancestral forge', () => {
  const asc = (lv, runMax) => { const g = game({ tokens: 1, runMax, floor: runMax }); g.talents.head = lv; G.ascend(g); return g; };
  assert.equal(asc(0, 30).floor, 1); assert.equal(asc(1, 30).floor, 6); assert.equal(asc(6, 60).floor, 31); assert.equal(asc(6, 60).runMax, 31);
  assert.equal(asc(6, 20).floor, 19); assert.equal(asc(3, 20).floor, 16); assert.equal(asc(6, 30).floor, 29);   // capped at runMax - 1
  assert.equal(G.headStart({ talents: { head: 6 }, runMax: 22 }), 21);
  const w = game({ floor: 40, stats: { atk: 3, hp: 5000, spd: 0 } }); assert.equal(G.fight(w, 40).timer, 30); assert.equal(G.fight(w, 40).late, true);   // tanky, but too slow for the boss timer
  w.talents.wind = 3; const t = G.fight(w, 40); assert.equal(t.timer, 75); assert.ok(t.t > 30 && t.t < 75); assert.equal(t.win, true); assert.equal(G.bossTimer(w), 75);
  const pr = sess(fresh(), '2026-02-01'); G.ensureGame(pr).talents.prospector = 3; G.syncRewards(pr); assert.equal(pr.game.paid['s:' + pr.sessions[0].id], Math.round(105 * 1.3));
  const both = sess(fresh(), '2026-02-01'); Object.assign(G.ensureGame(both).talents, { prospector: 2 }); both.game.focusUp.endurance = 1; G.syncRewards(both); assert.equal(both.game.paid['s:' + both.sessions[0].id], Math.round(105 * 1.3));
  const h = game(); assert.equal(G.stashMax(h), 6); h.talents.hoarder = 2; assert.equal(G.stashMax(h), 8);
  const f = game(); assert.equal(G.rollDrop(f, 10, seq(0.4, 0.06)).rarity, 'rare'); f.talents.fortune = 3; assert.equal(G.rollDrop(f, 10, seq(0.4, 0.06)).rarity, 'epic');   // epic 5% + 6%
  f.focusUp.luck = 2; assert.equal(G.rollDrop(f, 10, seq(0.4, 0.1)).rarity, 'epic');   // they add
  const af = game(); af.talents.ancestral = 5; assert.equal(G.forgeCost(af, 'temper', item('weapon', 1, 'common')), Math.ceil(30 * 1.35 * 0.75));
});

test('refund all talents: free, once per ascension, resets on ascend', () => {
  const g = game({ souls: 20, tokens: 2, runMax: 30, floor: 30 });
  assert.equal(G.canRespec(g), false); assert.equal(G.respec(g), false);   // nothing spent
  G.buyTalent(g, 'might'); G.buyTalent(g, 'head'); G.buyTalent(g, 'might');
  assert.equal(G.canRespec(g), true); const left = G.soulsLeft(g); assert.ok(left < 20);
  assert.equal(G.respec(g), true); assert.equal(G.soulsLeft(g), 20); assert.equal(g.soulsSpent, 0); assert.deepEqual(Object.values(g.talents), Array(8).fill(0)); assert.equal(g.souls, 20);
  G.buyTalent(g, 'vigour'); assert.equal(G.canRespec(g), false); assert.equal(G.respec(g), false); assert.equal(g.talents.vigour, 1);   // once only
  assert.ok(G.ascend(g)); assert.equal(g.respecUsed, false); assert.equal(G.canRespec(g), true); assert.equal(G.respec(g), true); assert.equal(g.talents.vigour, 0);
  assert.equal(G.soulsLeft(g), g.souls);
});

test('ascend: souls are a currency, unlocked stash is scrapped, best and locked items stay', () => {
  const g = game({ tokens: 1, runMax: 30, floor: 30 }); wear(g, 'weapon', item('weapon', 1, 'common', [{ id: 'swift', v: 0.3 }])); wear(g, 'armour', item('armour', 2, 'common'));   // weapon power 5 + 45
  g.stash.push({ id: 900, ...item('boots', 3, 'common') }, { id: 901, ...item('boots', 1, 'common'), lock: true });
  G.ascend(g); assert.equal(g.gear.weapon.aff[0].id, 'swift'); assert.equal(g.gear.armour, null); assert.deepEqual(g.stash.map((x) => x.id), [901]); assert.equal(g.sweat, 15);
  assert.equal(g.souls, 5); assert.equal(G.soulsLeft(g), 5);
  const h = game({ tokens: 1, runMax: 30 }); wear(h, 'weapon', item('weapon', 3, 'common')); wear(h, 'armour', { ...item('armour', 1, 'common'), lock: true });
  G.ascend(h); assert.ok(h.gear.weapon); assert.ok(h.gear.armour, 'locked gear stays equipped');
});

test('view: gear rows and the gear sheet label every button; chips show affixes and power', () => {
  const g = game({ focus: 500, souls: 6 }); wear(g, 'weapon', item('weapon', 3, 'epic', [{ id: 'lifesteal', v: 0.08 }, { id: 'guard', v: 0.06 }])); g.stash.push({ id: 50, ...item('weapon', 1, 'common') });
  for (const html of [V.gearHtml(g), V.gearSheet(g, 'weapon', 'Hi').body, V.gearSheet(g, 'boots').body]) {
    const btns = html.match(/<button[^>]*>/g) || []; assert.ok(btns.length > 0 || html.includes('Nothing stashed')); assert.ok(btns.every((b) => /aria-label="[^"]+"/.test(b)), btns.find((b) => !/aria-label/.test(b)));
  }
  const h = V.gearHtml(g); assert.match(h, /Lifesteal 8%/); assert.match(h, /Power /); assert.match(h, /Stash 1\/6/);
  const sh = V.gearSheet(g, 'weapon'); assert.equal(sh.title, 'Weapon'); assert.match(sh.body, /Reroll Lifesteal for \d+ Focus/); assert.match(sh.body, /Temper for \d+ Focus/); assert.match(sh.body, /Equip /);
  assert.match(V.canvasLabel(game({ floor: 34 })), /Crypt: enemies regenerate\. Burst damage helps\./);
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

test('ascend: needs a token and floor 20, gives sqrt souls to spend, keeps only the best gear', () => {
  const g = game({ tokens: 0, runMax: 50, floor: 50 });
  assert.equal(G.canAscend(g), false); assert.equal(G.ascend(g), null);
  g.tokens = 1; g.runMax = 19; assert.equal(G.canAscend(g), false); assert.equal(G.ascend(g), null); assert.equal(g.tokens, 1);
  Object.assign(g, { runMax: 50, floor: 47, bestFloor: 55, sweat: 99, focus: 12, souls: 2, grit: 0.2, prog: 3, stats: { atk: 4, hp: 5, spd: 6 } });
  g.focusUp.luck = 2; g.gear.weapon = { slot: 'weapon', tier: 1, rarity: 'common', bonus: 0.05 }; g.gear.armour = { slot: 'armour', tier: 3, rarity: 'rare', bonus: 0.225 }; g.gear.boots = { slot: 'boots', tier: 2, rarity: 'common', bonus: 0.1 };
  assert.equal(G.ascend(g), 7);
  assert.deepEqual([g.souls, g.tokens, g.floor, g.runMax, g.grit, g.prog], [9, 0, 1, 1, 0, 0]); assert.equal(G.soulsLeft(g), 9);
  assert.equal(g.gear.weapon, null); assert.equal(g.gear.boots, null); assert.equal(g.gear.armour.bonus, 0.225);   // best item stays
  assert.equal(g.bestFloor, 55);
  assert.deepEqual([g.sweat, g.focus, g.focusUp.luck, g.stats.hp], [99, 12, 2, 5]);
  close(G.heroStats(g).atk, 5 + 2 * 4); close(G.heroStats(g).hp, (50 + 15 * 5) * 1.225);   // unspent souls add nothing until spent
  const e = game({ tokens: 1, runMax: 25 }); G.ascend(e); assert.deepEqual(Object.values(e.gear), [null, null, null]);   // nothing to keep
});

test('advance respects the iteration limit', () => {
  const g = game({ stats: { atk: 500, hp: 500, spd: 80 } });
  const t0 = Date.now(); G.advance(g, 1e9, () => 0.9); assert.ok(Date.now() - t0 < 3000); assert.ok(g.floor > 1);
});

// ---------- scenery and the visual fight ----------
import * as Z from '../js/game/scene.js';
import * as V from '../js/game/view.js';
import { MAPS, ENEMY_KINDS, BOSS_KINDS } from '../js/game/sprites.js';

test('zoneOf: bands of 10 floors, cycles with a lap tint, never throws', () => {
  assert.equal(Z.zoneOf(1).id, 'cellar'); assert.equal(Z.zoneOf(9).id, 'cellar'); assert.equal(Z.zoneOf(10).id, 'barracks');
  assert.equal(Z.zoneOf(34).name, 'Crypt'); assert.equal(Z.zoneOf(65).id, 'spire');
  assert.equal(Z.zoneOf(70).id, 'cellar'); assert.equal(Z.zoneOf(70).name, 'Deep Cellar'); assert.equal(Z.zoneOf(140).name, 'Abyssal Cellar');
  assert.equal(Z.zoneOf(0).id, 'cellar'); assert.equal(Z.zoneOf(NaN).id, 'cellar');
});
test('enemyKind: same floor, same enemy; from its zone pool; bosses are the zone boss; all have sprites', () => {
  for (let f = 1; f <= 300; f++) {
    const k = Z.enemyKind(f), z = Z.zoneOf(f);
    assert.equal(k, Z.enemyKind(f));
    assert.ok(f % 10 === 0 ? k === z.boss : z.pool.includes(k), `floor ${f}: ${k}`);
    assert.ok(MAPS[k] || BOSS_KINDS.includes(k), k);
    if (f % 10 && f % 10 !== 1 && f > 1) assert.notEqual(k, Z.enemyKind(f - 1), `floor ${f} repeats the one before`);
  }
  assert.ok(new Set(Array.from({ length: 70 }, (_, i) => Z.enemyKind(i + 1))).size >= 14, 'plenty of variety in one lap');
  assert.ok(ENEMY_KINDS.length >= 12 && Z.ZONES.every((z) => z.pool.length >= 3 && z.pool.every((k) => ENEMY_KINDS.includes(k))));
  assert.equal(Z.isElite(5), true); assert.equal(Z.isElite(10), false); assert.equal(Z.isElite(12), false);
});
test('floorProps: deterministic per floor, never on the fighters, differs between floors', () => {
  const sig = (f) => JSON.stringify(Z.floorProps(f));
  assert.equal(sig(12), sig(12)); assert.notEqual(sig(1), sig(2));
  for (let f = 1; f <= 80; f++) for (const p of Z.floorProps(f)) {
    assert.ok(Math.abs(p.i - Z.HERO_T[0]) + Math.abs(p.j - Z.HERO_T[1]) > 1 && Math.abs(p.i - Z.FOE_T[0]) + Math.abs(p.j - Z.FOE_T[1]) > 1, `floor ${f}`);
  }
  assert.ok(Z.floorProps(45).some((p) => p.kind === 'anvil'));
  assert.ok(new Set(Array.from({ length: 60 }, (_, i) => sig(i + 1))).size > 50);
});
test('visual fight: a won fight ends at the kill with damage summing to enemy HP, and hits come at hero speed', () => {
  const g = game({ floor: 12, stats: { atk: 12, hp: 12, spd: 5 } }), f = G.fight(g, 12), S = V.schedule(f, 12);
  assert.ok(f.win); const n = S.hero.length;
  close(S.hero.reduce((p, h) => p + h.d, 0), f.enemy.hp, 1e-6); close(S.hero[n - 1].t, f.t);
  assert.ok(Math.abs(n - f.t * f.hero.spd) <= 0.5 + 1e-9);
  assert.ok(S.foe.every((h) => h.t <= f.t && h.d === f.enemy.atk) && S.ko === null);
  const fake = { win: true, t: 10, hero: { spd: 2, crit: 0.5, atk: 1, hp: 100 }, enemy: { hp: 1000, atk: 1, boss: false } }, Sc = V.schedule(fake, 12);
  close(Sc.hero.reduce((p, h) => p + h.d, 0), 1000, 1e-6); const c = Sc.hero.filter((h) => h.c), nc = Sc.hero.filter((h) => !h.c);
  assert.ok(c.length && nc.length); close(c[0].d, 2 * nc[0].d);
});
test('visual fight: a lost try plays out then the hero falls; the foe keeps some HP', () => {
  const g = game({ floor: 30 }), f = G.fight(g, 30), S = V.schedule(f, 30);
  assert.ok(!f.win && S.ko > S.hero[S.hero.length - 1].t);
  assert.ok(S.hero.reduce((p, h) => p + h.d, 0) < f.enemy.hp);
  close(S.foe.reduce((p, h) => p + h.d, 0), f.hero.hp * (f.late ? Math.min(0.9, f.enemy.atk * CONFIG30(f) / f.hero.hp) : 1), 1e-6);
  assert.deepEqual(V.schedule(f, 30), S);
});
const CONFIG30 = (f) => (f.late ? G.CONFIG.bossTimer : f.tDie);
