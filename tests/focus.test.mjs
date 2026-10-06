import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as G from '../js/game/engine.js';
import * as V from '../js/game/view.js';

const fresh = () => L.defaultState(new Date(2026, 1, 1, 12));
const game = (patch = {}) => { const g = G.ensureGame(fresh()); Object.assign(g, { keys: 5 }, patch); return g; };
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const STRONG = { atk: 60, hp: 60, spd: 20 };
const NEW = ['iron', 'hands', 'warlord', 'breath', 'thorn', 'mastery', 'sense', 'ring', 'overkill', 'dilation', 'ascendant'];
const NEED = { iron: 0, hands: 0, warlord: 10, breath: 20, thorn: 30, mastery: 40, sense: 50, ring: 60, overkill: 70, dilation: 80, ascendant: 100 };
const MAX = { iron: 10, hands: 10, warlord: 10, breath: 5, thorn: 10, mastery: 10, sense: 5, ring: 3, overkill: 10, dilation: 4, ascendant: 3 };
const BASE = { iron: 20, hands: 20, warlord: 25, breath: 30, thorn: 30, mastery: 40, sense: 40, ring: 50, overkill: 40, dilation: 60, ascendant: 100 };

test('bossBest migrates from bestFloor: the last boss below it', () => {
  const b = (bestFloor, extra = {}) => G.ensureGame({ game: { bestFloor, ...extra } }).bossBest;
  assert.equal(b(1), 0); assert.equal(b(10), 0); assert.equal(b(11), 10); assert.equal(b(35), 30); assert.equal(b(100), 90); assert.equal(b(101), 100);
  assert.equal(b(12, { bossBest: 50 }), 50, 'a saved record is never lowered');
  assert.equal(G.ensureGame({}).bossBest, 0);
});

test('bossBest survives ascension and rises on every boss kill, live or offline', () => {
  const g = game({ tokens: 1, runMax: 25, floor: 25, bestFloor: 25, bossBest: 20 }); assert.equal(G.ascend(g) > 0, true); assert.equal(g.bossBest, 20); assert.equal(g.bestFloor, 25);
  const h = game({ floor: 10, stats: STRONG }); const sum = G.advance(h, 60, () => 0.9, { stopAt: 11 }); assert.equal(h.bossBest, 10); assert.deepEqual(sum.unlocked, ['warlord']);
  assert.ok(h.floor > 10);
  const again = game({ floor: 10, stats: STRONG, bossBest: 10 }); assert.deepEqual(G.advance(again, 60, () => 0.9, { stopAt: 11 }).unlocked, [], 'a boss already beaten unlocks nothing');
  const off = fresh(), og = G.ensureGame(off); Object.assign(og, { floor: 10, stats: STRONG, keys: 5, lastTick: 1e12 }); const a = G.offlineCatchUp(off, 1e12 + 3600e3, () => 0.9);
  assert.ok(og.bossBest >= 10); assert.equal(a.unlocked[0], 'warlord');
  assert.match(V.awayHtml({ ...a, unlocked: ['warlord'] }), /New Focus upgrade: Warlord&#39;s Edge\./); assert.match(V.awayHtml(a), /New Focus upgrades: Warlord&#39;s Edge, Second Breath/);
  assert.doesNotMatch(V.awayHtml({ ...a, unlocked: [] }), /New Focus upgrade/);
  const big = game({ floor: 40, stats: { atk: 200, hp: 200, spd: 20 }, bossBest: 0 }); assert.deepEqual(G.advance(big, 5, () => 0.9, { stopAt: 41 }).unlocked, ['warlord', 'breath', 'thorn', 'mastery'], 'a record that jumps unlocks everything it passed');
});

test('each gate: locked below its boss, open at it', () => {
  for (const id of NEW) {
    const lo = game({ focus: 1e6, bossBest: Math.max(0, NEED[id] - 10) }), hi = game({ focus: 1e6, bossBest: NEED[id] });
    assert.equal(G.focusOpen(hi, id), true, id); assert.equal(G.buyFocus(hi, id), true, id + ' at its boss');
    if (NEED[id]) { assert.equal(G.focusOpen(lo, id), false, id); assert.equal(G.buyFocus(lo, id), false, id + ' below'); assert.equal(lo.focus, 1e6); }
    else assert.equal(G.buyFocus(lo, id), true);
  }
  assert.equal(G.focusOpen(game({ bossBest: 0 }), 'luck'), true);
  const kill = game({ floor: 20, stats: STRONG, bossBest: 10 }); assert.deepEqual(G.advance(kill, 60, () => 0.9, { stopAt: 21 }).unlocked, ['breath']);
  const none = game({ focus: 1e6, bossBest: 90 }); assert.equal(G.buyFocus(none, 'ascendant'), false);
});

test('levels, caps and costs', () => {
  for (const id of NEW) {
    assert.equal(G.focusMax(id), MAX[id], id); assert.equal(G.focusCost(id, 0), BASE[id], id);
    const d = G.CONFIG.focusUp[id]; assert.equal(G.focusCost(id, 2), Math.ceil(d.cost * d.grow ** 2));
    const g = game({ focus: 1e9, bossBest: 100 }); for (let i = 0; i < MAX[id] + 3; i++) G.buyFocus(g, id);
    assert.equal(g.focusUp[id], MAX[id]); assert.equal(G.buyFocus(g, id), false);
    assert.equal(G.ensureGame({ game: { focusUp: { [id]: 99 } } }).focusUp[id], MAX[id], 'old or edited saves are clamped');
  }
  const g = game({ focus: 25, bossBest: 100 }); assert.equal(G.buyFocus(g, 'iron'), true); assert.equal(g.focus, 5); assert.equal(G.buyFocus(g, 'iron'), false, 'costs 25');
});

test('Iron Skin and Quick Hands', () => {
  const g = game({ stats: { atk: 5, hp: 5, spd: 5 } }), f0 = G.fight(g, 20); g.focusUp.iron = 10;
  const f1 = G.fight(g, 20); close(f1.edps, f0.edps * 0.8); close(f1.net, f0.net * 0.8);
  const h = game({ stats: { atk: 5, hp: 5, spd: 5 } }), s0 = G.heroStats(h).spd; h.focusUp.hands = 5; close(G.heroStats(h).spd, s0 * 1.1);
  h.stats.spd = 100; close(G.heroStats(h).spd, 3 * 1.1, 1e-9);   // after the Speed cap, like gear
});

test("Warlord's Edge hits bosses only and adds to Boss slayer", () => {
  const g = game({ stats: STRONG }); const b0 = G.fight(g, 20).dps, n0 = G.fight(g, 19).dps; g.focusUp.warlord = 10;
  close(G.fight(g, 20).dps / b0, 1.3); close(G.fight(g, 19).dps, n0);
  g.gear.weapon = { slot: 'weapon', tier: 1, rarity: 'rare', bonus: 0, aff: [{ id: 'boss', v: 0.2 }], lvl: 0, lock: false, added: false }; close(G.fight(g, 20).dps / (b0 * 1.2), 1.5 / 1.2 * 1.2 / 1.2 * 1.0 * (1.5 / 1.5), 0.3);
  const c = game({ stats: STRONG }), c0 = G.fight(c, 20).dps; c.focusUp.warlord = 10; c.gear.weapon = g.gear.weapon; const withBoth = G.fight(c, 20).dps; c.focusUp.warlord = 0; close(withBoth / G.fight(c, 20).dps, 1.5 / 1.2);
  assert.ok(c0 > 0);
});

test('Second Breath and Thornmail use the lifesteal and thorns maths', () => {
  const g = game({ stats: { atk: 5, hp: 5, spd: 5 } }), f0 = G.fight(g, 1); g.focusUp.breath = 5;
  close(G.affixTotal(g, 'lifesteal'), 0.05); const f1 = G.fight(g, 1); close(f1.net, f0.net - 0.05 * f0.dps);
  const t = game({ stats: { atk: 5, hp: 5, spd: 5 } }); t.focusUp.thorn = 10; close(G.affixTotal(t, 'thorns'), 0.2); const ft = G.fight(t, 1); close(ft.dps, G.fight(game({ stats: { atk: 5, hp: 5, spd: 5 } }), 1).dps + 0.2 * ft.edps);
  g.gear.armour = { slot: 'armour', tier: 1, rarity: 'rare', bonus: 0, aff: [{ id: 'lifesteal', v: 0.1 }], lvl: 0, lock: false, added: false }; close(G.affixTotal(g, 'lifesteal'), 0.15);
});

test('Forge Mastery stacks multiplicatively with Ancestral forge', () => {
  const it = { tier: 2, lvl: 0, rarity: 'common', aff: [] }, g = game(), c0 = G.forgeCost(g, 'reroll', it);
  g.focusUp.mastery = 10; assert.equal(G.forgeCost(g, 'reroll', it), Math.ceil(40 * 1.35 ** 2 * 0.7));
  g.talents.ancestral = 2; assert.equal(G.forgeCost(g, 'reroll', it), Math.ceil(40 * 1.35 ** 2 * 0.9 * 0.7)); assert.ok(G.forgeCost(g, 'reroll', it) < c0);
  assert.equal(G.forgeCost(g, 'temper', { ...it, lvl: 2 }), Math.ceil(30 * 1.35 ** 2 * 1.15 ** 2 * 0.9 * 0.7));
});

test('Treasure Sense lifts a boss drop one tier, only on a lucky roll', () => {
  const run = (lv, r) => { const g = game({ floor: 10, stats: STRONG }); g.focusUp.sense = lv; return G.advance(g, 60, () => r, { stopAt: 11 }).drops[0]; };
  assert.equal(run(0, 0).tier, 1); assert.equal(run(5, 0).tier, 2); assert.equal(run(5, 0.19).tier, 2); assert.equal(run(5, 0.21).tier, 1); assert.equal(run(1, 0.05).tier, 1); assert.equal(run(1, 0.03).tier, 2);
  let n = 0; const g = game({ floor: 10, stats: STRONG }); G.advance(g, 60, () => { n++; return 0.9; }, { stopAt: 11 }); const calls = n; const h = game({ floor: 10, stats: STRONG }); h.focusUp.sense = 1; n = 0; G.advance(h, 60, () => { n++; return 0.9; }, { stopAt: 11 }); assert.equal(n, calls + 1, 'no extra dice without the upgrade');
  assert.equal(G.rollDrop(game(), 10, () => 0.9, { up: true }).tier, 2);
});

test('Key Ring raises the key cap', () => {
  const g = game(); assert.equal(G.keyCap(g), 5); g.focusUp.ring = 3; assert.equal(G.keyCap(g), 8);
  const s = fresh(), x = G.ensureGame(s); x.focusUp.ring = 2; x.keys = 7; G.ensureGame(s); assert.equal(x.keys, 7, 'not trimmed to 5');
  x.focusUp.ring = 0; G.ensureGame(s); assert.equal(x.keys, 5);
  const days = []; for (let i = 0; i < 9; i++) days.push({ id: 'k' + i, date: L.addDays('2026-02-01', i), startedAt: L.addDays('2026-02-01', i) + 'T07:00:00', minimum: false, sets: [] });
  const t = fresh(); G.ensureGame(t).focusUp.ring = 3; t.game.kw = true; t.game.keys = 0; t.sessions = days; G.syncRewards(t); assert.equal(t.game.keys, 8);
});

test('Overkill adds crit damage, Time Dilation the boss timer', () => {
  const g = game({ stats: STRONG }); g.focusUp.precision = 10; const d0 = G.fight(g, 20).dps; g.focusUp.overkill = 10; close(G.heroStats(g).critMult, 2.5); close(G.fight(g, 20).dps / d0, (1 + 0.2 * 1.5) / (1 + 0.2 * 1));
  const t = game(); assert.equal(G.bossTimer(t), 30); t.focusUp.dilation = 4; assert.equal(G.bossTimer(t), 50); assert.equal(G.fight(t, 20).timer, 50);
  t.talents.wind = 1; t.gear.weapon = null; assert.equal(G.bossTimer(t), 65);
});

test('Ascendant adds souls per ascension', () => {
  const g = game({ tokens: 1, runMax: 25, floor: 25 }); g.focusUp.ascendant = 3; assert.equal(G.soulsFor(g), 8); assert.equal(G.ascend(g), 8); assert.equal(g.souls, 8);
});

test('the Focus section: open rows, 2 locked rows, hidden rest, labels', () => {
  const rows = (bossBest) => { const s = fresh(), g = G.ensureGame(s); g.bossBest = bossBest; const html = V.viewTower(s); const sec = html.slice(html.indexOf('id="tw-focus"'), html.indexOf('Spend Focus on the Forge')); return { html, sec, open: (sec.match(/data-row="up:/g) || []).length, locked: (sec.match(/data-row="lock:/g) || []).length }; };
  let r = rows(0); assert.equal(r.open, 5); assert.equal(r.locked, 2);
  assert.match(r.sec, /aria-label="Locked\. Beat the floor 10 boss to unlock Warlord&#39;s Edge"/); assert.match(r.sec, /Beat the floor 20 boss to unlock: Second Breath/); assert.doesNotMatch(r.sec, /Thornmail/);
  r = rows(10); assert.equal(r.open, 6); assert.equal(r.locked, 2); assert.match(r.sec, /aria-label="Locked\. Beat the floor 30 boss to unlock Thornmail"/); assert.match(r.sec, /Beat the floor 20 boss to unlock: Second Breath/); assert.doesNotMatch(r.sec, /Treasure Sense/);
  r = rows(90); assert.equal(r.open, 13); assert.equal(r.locked, 1);
  r = rows(100); assert.equal(r.open, 14); assert.equal(r.locked, 0); assert.doesNotMatch(r.sec, /tw-lock/);
  for (const b of r.sec.match(/<button[^>]*>/g)) assert.match(b, /aria-label="[^"]+"/); assert.equal(r.sec.match(/<button/g).length, 14);
  for (const row of r.sec.match(/<div class="tw-row"[^>]*>/g)) assert.match(row, /role="group" aria-label="[^"]+"/);
  assert.match(r.sec, /aria-label="Upgrade Key Ring to level 1 for 50 Focus"/); assert.match(r.sec, /aria-label="Key Ring, level 0 of 3\./);
});

test('the loot card carries the unlock line', () => {
  assert.equal(V.unlockHtml([]), ''); assert.match(V.unlockHtml(['thorn']), /New Focus upgrade: Thornmail/); assert.match(V.unlockHtml(['thorn', 'mastery']), /New Focus upgrades: Thornmail, Forge Mastery/);
  const g = game({ floor: 30, stats: STRONG, bossBest: 20 }), sum = G.advance(g, 60, () => 0.9, { stopAt: 31 }); assert.deepEqual(sum.unlocked, ['thorn']);
  const card = V.lootHtml(g, sum.drops[0], 'Boss down', V.unlockHtml(sum.unlocked)); assert.match(card, /New Focus upgrade: Thornmail/);
});
