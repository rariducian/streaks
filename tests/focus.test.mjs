import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as G from '../js/game/engine.js';
import * as V from '../js/game/view.js';

const fresh = () => L.defaultState(new Date(2026, 1, 1, 12));
const game = (patch = {}) => { const g = G.ensureGame(fresh()); Object.assign(g, { keys: 5 }, patch); return g; };
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const STRONG = { atk: 60, hp: 60, spd: 20 };
const NEW = ['iron', 'hands', 'warlord', 'breath', 'thorn', 'mastery', 'sense', 'ring', 'overkill', 'dilation', 'ascendant', 'fortify', 'keen', 'gilded', 'echo'];
const NEED = { iron: 0, hands: 0, warlord: 10, breath: 20, thorn: 30, mastery: 40, sense: 50, ring: 60, overkill: 70, dilation: 80, ascendant: 100, fortify: 90, keen: 110, gilded: 130, echo: 150 };
const MAX = { iron: 10, hands: 10, warlord: 10, breath: 5, thorn: 10, mastery: 10, sense: 5, ring: 3, overkill: 10, dilation: 4, ascendant: 3, fortify: 10, keen: 10, gilded: 5, echo: 5 };
const BASE = { iron: 20, hands: 20, warlord: 25, breath: 30, thorn: 30, mastery: 40, sense: 40, ring: 50, overkill: 40, dilation: 60, ascendant: 100, fortify: 20, keen: 20, gilded: 80, echo: 100 };

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
  const none = game({ focus: 1e6, bossBest: 90 }); assert.equal(G.buyFocus(none, 'ascendant'), false); assert.equal(G.buyFocus(none, 'keen'), false);
});

test('levels, caps and costs', () => {
  for (const id of NEW) {
    assert.equal(G.focusMax(game(), id), MAX[id], id); assert.equal(G.focusCost(id, 0), BASE[id], id);
    const d = G.CONFIG.focusUp[id]; assert.equal(G.focusCost(id, 2), Math.ceil(d.cost * d.grow ** 2));
    const g = game({ focus: 1e9, bossBest: Math.max(100, NEED[id]) }); for (let i = 0; i < 80; i++) G.buyFocus(g, id);
    assert.equal(g.focusUp[id], G.focusMax(g, id)); assert.equal(G.buyFocus(g, id), false);
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
  r = rows(90); assert.equal(r.open, 14); assert.equal(r.locked, 2);
  r = rows(150); assert.equal(r.open, 18); assert.equal(r.locked, 0); assert.doesNotMatch(r.sec, /tw-lock/);
  for (const b of r.sec.match(/<button[^>]*>/g)) assert.match(b, /aria-label="[^"]+"/); assert.equal(r.sec.match(/<button/g).length, 18);
  for (const row of r.sec.match(/<div class="tw-row"[^>]*>/g)) assert.match(row, /role="group" aria-label="[^"]+"/);
  assert.match(r.sec, /aria-label="Upgrade Key Ring to level 1 for 50 Focus"/); assert.match(r.sec, /aria-label="Key Ring, level 0 of 8\./);
  assert.match(r.html, /id="tw-capline"[^>]*aria-label="All level caps raised"/);
});

test('the loot card carries the unlock line', () => {
  assert.equal(V.unlockHtml([]), ''); assert.match(V.unlockHtml(['thorn']), /New Focus upgrade: Thornmail/); assert.match(V.unlockHtml(['thorn', 'mastery']), /New Focus upgrades: Thornmail, Forge Mastery/);
  const g = game({ floor: 30, stats: STRONG, bossBest: 20 }), sum = G.advance(g, 60, () => 0.9, { stopAt: 31 }); assert.deepEqual(sum.unlocked, ['thorn']);
  const card = V.lootHtml(g, sum.drops[0], 'Boss down', V.unlockHtml(sum.unlocked)); assert.match(card, /New Focus upgrade: Thornmail/);
});

test('Overkill row warns when there is no crit chance', async () => {
  const V = await import('../js/game/view.js'), G = await import('../js/game/engine.js');
  const s = { sessions: [], events: [], fasts: [], settings: {} }, g = G.ensureGame(s); g.bossBest = 100;
  assert.match(V.viewTower(s), /No effect until you have crit chance/);
  g.focusUp.precision = 1; assert.doesNotMatch(V.viewTower(s), /No effect until you have crit chance/);
});

// ---------- level caps that rise with bossBest ----------
const TABLE = { endurance: 5, precision: 20, luck: 10, iron: 10, hands: 10, warlord: 10, breath: 5, thorn: 10, mastery: 10, sense: 5, ring: 3, overkill: 10, dilation: 4, ascendant: 3, fortify: 10, keen: 10, gilded: 5, echo: 5 };
const STEP = { endurance: 2, luck: 5, breath: 2, sense: 2, ring: 1, dilation: 1, ascendant: 1 };   // overrides; the rest: +50% of base, rounded up
const MS = [30, 60, 90, 120, 150];
const expectMax = (id, n) => { let m = TABLE[id] + n * (STEP[id] || Math.ceil(TABLE[id] / 2)); const d = G.CONFIG.focusUp[id]; if (d.cap !== undefined && d.per) m = Math.min(m, Math.ceil(Math.round(d.cap / d.per * 1e6) / 1e6)); return m; };

test('caps at each milestone: default rule and every override', () => {
  assert.deepEqual(G.CONFIG.capBosses, MS);
  for (const id of Object.keys(TABLE)) for (let n = 0; n <= 5; n++) {
    const below = game({ bossBest: n ? MS[n - 1] - 10 + (n === 1 ? 0 : 0) : 0 }), at = game({ bossBest: n ? MS[n - 1] : 0 }), past = game({ bossBest: n ? MS[n - 1] + 9 : 9 });
    assert.equal(G.focusMax(at, id), expectMax(id, n), `${id} at milestone ${n}`); assert.equal(G.focusMax(past, id), expectMax(id, n), id + ' between milestones');
    if (n) assert.equal(G.focusMax(below, id), expectMax(id, n - 1), id + ' one boss short');
  }
  const m = (id, bb) => G.focusMax(game({ bossBest: bb }), id);
  assert.deepEqual(MS.map((b) => m('iron', b)), [15, 20, 25, 30, 35]); assert.deepEqual(MS.map((b) => m('gilded', b)), [8, 11, 14, 17, 20]);
  assert.deepEqual(MS.map((b) => m('ring', b)), [4, 5, 6, 7, 8]); assert.deepEqual(MS.map((b) => m('dilation', b)), [5, 6, 7, 8, 9]); assert.deepEqual(MS.map((b) => m('ascendant', b)), [4, 5, 6, 7, 8]);
  assert.deepEqual(MS.map((b) => m('endurance', b)), [7, 9, 11, 13, 15]); assert.deepEqual(MS.map((b) => m('luck', b)), [15, 20, 25, 30, 35]);
  assert.deepEqual(MS.map((b) => m('sense', b)), [7, 9, 11, 13, 15]); assert.deepEqual(MS.map((b) => m('breath', b)), [7, 9, 11, 13, 15]);
  assert.deepEqual(MS.map((b) => m('mastery', b)), [15, 20, 25, 25, 25], 'stops where the 75% discount is reached'); assert.deepEqual(MS.map((b) => m('echo', b)), [8, 10, 10, 10, 10], 'stops at the 30% cap');
});

test('buying above the base max once raised, refused before', () => {
  const g = game({ focus: 1e9, bossBest: 20 }); for (let i = 0; i < 12; i++) G.buyFocus(g, 'iron'); assert.equal(g.focusUp.iron, 10); assert.equal(G.buyFocus(g, 'iron'), false);
  g.bossBest = 29; assert.equal(G.buyFocus(g, 'iron'), false, 'one boss short');
  g.bossBest = 30; assert.equal(G.buyFocus(g, 'iron'), true); assert.equal(g.focusUp.iron, 11); const f = g.focus; assert.equal(G.focusCost('iron', 11), Math.ceil(20 * 1.25 ** 11)); G.buyFocus(g, 'iron'); assert.equal(f - g.focus, Math.ceil(20 * 1.25 ** 11));
  for (let i = 0; i < 20; i++) G.buyFocus(g, 'iron'); assert.equal(g.focusUp.iron, 15);
  assert.equal(G.ensureGame({ game: { bossBest: 30, focusUp: { iron: 99 } } }).focusUp.iron, 15, 'a save is clamped to the raised cap'); assert.equal(G.ensureGame({ game: { bossBest: 30, focusUp: { iron: 14 } } }).focusUp.iron, 14, 'never lowered below the cap');
  assert.equal(G.ensureGame({ game: { bestFloor: 61, focusUp: { luck: 99 } } }).focusUp.luck, 20, 'an old save reads its caps from bestFloor');
  assert.equal(G.capLevel(game({ bossBest: 29 })), 0); assert.equal(G.capLevel(game({ bossBest: 150 })), 5); assert.equal(G.nextCapFloor(game({ bossBest: 60 })), 90); assert.equal(G.nextCapFloor(game({ bossBest: 150 })), 0);
  assert.deepEqual(G.focusNextCap(game({ bossBest: 60 }), 'iron'), { floor: 90, max: 25 }); assert.equal(G.focusNextCap(game({ bossBest: 150 }), 'iron'), null);
  assert.equal(G.focusNextCap(game({ bossBest: 90 }), 'mastery'), null, 'already at its effect cap');
});

test('guards: damage taken, lifesteal, Treasure Sense, epic chance, crit', () => {
  const g = game({ stats: { atk: 5, hp: 5, spd: 5 } }), f0 = G.fight(g, 1); g.focusUp.iron = 35; g.gear.armour = { slot: 'armour', tier: 1, rarity: 'epic', bonus: 0, aff: [{ id: 'guard', v: 0.5 }] };
  close(G.fight(g, 1).edps / f0.edps, 0.4);   // 0.5 x 0.3 would be 0.15, held at 40%
  const h = game({ stats: { atk: 5, hp: 5, spd: 5 } }), h0 = G.fight(h, 1); h.focusUp.iron = 20; close(G.fight(h, 1).edps / h0.edps, 0.6, 1e-9);
  const l = game(); l.focusUp.breath = 15; l.gear.weapon = { slot: 'weapon', tier: 1, rarity: 'epic', bonus: 0, aff: [{ id: 'lifesteal', v: 0.4 }] }; close(G.affixTotal(l, 'lifesteal'), 0.3); l.gear.weapon = null; close(G.affixTotal(l, 'lifesteal'), 0.15);
  const s = game({ bossBest: 150 }); s.focusUp.sense = 15; assert.equal(G.focusMax(s, 'sense'), 15); s.focusUp.sense = 40; const run = (r) => { const x = game({ floor: 10, stats: STRONG, bossBest: 150, focusUp: { sense: 40 } }); return G.advance(x, 60, () => r, { stopAt: 11 }).drops[0].tier; };
  assert.equal(run(0.59), 2); assert.equal(run(0.61), 1, 'Sense chance stops at 60%');
  const e = game({ bossBest: 150 }); e.focusUp.luck = 35; e.talents.fortune = 5; const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  assert.equal(G.rollDrop(e, 10, seq(0.4, 0.74)).rarity, 'epic'); assert.equal(G.rollDrop(e, 10, seq(0.4, 0.76)).rarity, 'rare', 'epic chance stops at 75%');
  const c = game(); c.focusUp.precision = 70; close(G.heroStats(c).crit, 1);
  assert.equal(G.fight(game(), 1).win, true);
});

test('Fortify, Keen Edge and their unlock bosses', () => {
  const g = game({ stats: { atk: 5, hp: 5, spd: 5 } }), h0 = G.heroStats(g); g.focusUp.fortify = 10; g.focusUp.keen = 4;
  close(G.heroStats(g).hp, h0.hp * 1.3); close(G.heroStats(g).atk, h0.atk * 1.12); close(G.heroStats(g).spd, h0.spd);
  const lo = game({ focus: 1e6, bossBest: 80 }), hi = game({ focus: 1e6, bossBest: 90 }); assert.equal(G.buyFocus(lo, 'fortify'), false); assert.equal(G.buyFocus(hi, 'fortify'), true);
  assert.equal(G.buyFocus(hi, 'keen'), false); hi.bossBest = 110; assert.equal(G.buyFocus(hi, 'keen'), true);
  const k = game({ floor: 90, stats: { atk: 400, hp: 400, spd: 20 }, bossBest: 80 }); const sum = G.advance(k, 5, () => 0.9, { stopAt: 91 }); assert.deepEqual(sum.unlocked, ['fortify']); assert.equal(sum.capsUp, true);
  assert.equal(G.CONFIG.focusUp.fortify.cost, 20); assert.equal(G.CONFIG.focusUp.keen.cost, 20);
});

const sessions = (n) => Array.from({ length: n }, (_, i) => ({ id: 'g' + i, date: L.addDays('2026-01-01', i), startedAt: '2026-01-0' + (i % 9 + 1) + 'T07:00:00Z', minimum: false, sets: [] }));
test('Gilded Keys: +1 key by a hash of the session id, deterministic and idempotent', () => {
  const run = (lv, n = 40, cap = 99) => { const s = fresh(); const g = G.ensureGame(s); Object.assign(g, { kw: true, keys: 0, bossBest: 150 }); g.focusUp.gilded = lv; g.focusUp.ring = 0; s.sessions = sessions(n).map((x, i) => ({ ...x, date: L.addDays('2026-01-01', i) })); G.syncRewards(s); return s; };
  const base = run(0), mid = run(2), top = run(20), again = run(2);
  assert.equal(Object.values(base.game.paid).filter((v, i) => true).length > 0, true);
  const ks = (s) => Object.entries(s.game.paid).filter(([k]) => k.startsWith('ks:')).map(([, v]) => v);
  assert.ok(ks(base).every((v) => v === 1)); assert.ok(ks(top).every((v) => v === 2), '100% at level 20'); assert.deepEqual(ks(mid), ks(again), 'same ids, same result');
  const extra = ks(mid).filter((v) => v === 2).length; assert.ok(extra > 0 && extra < 40, 'about 10% of sessions: ' + extra);
  const s = run(2), snap = JSON.stringify(s.game.paid), keys = s.game.keys; for (let i = 0; i < 3; i++) G.syncRewards(s); assert.equal(JSON.stringify(s.game.paid), snap); assert.equal(s.game.keys, keys);
  s.game.focusUp.gilded = 20; G.syncRewards(s); assert.equal(JSON.stringify(s.game.paid), snap, 'buying more later never rewrites a paid session');
  const keep = G.ensureGame(run(0, 3)); assert.ok(keep.keys <= G.keyCap(keep), 'respects the key cap');
  const t = fresh(), tg = G.ensureGame(t); Object.assign(tg, { kw: true, keys: 4, bossBest: 150 }); tg.focusUp.gilded = 20; t.sessions = sessions(1); G.syncRewards(t); assert.equal(tg.keys, 5, 'capped at 5, not 6');
  const day2 = fresh(), d2 = G.ensureGame(day2); Object.assign(d2, { kw: true, keys: 0, bossBest: 150 }); d2.focusUp.gilded = 20; day2.sessions = [{ id: 'a', date: '2026-02-01', startedAt: '2026-02-01T07:00:00Z', sets: [] }, { id: 'b', date: '2026-02-01', startedAt: '2026-02-01T08:00:00Z', sets: [] }, { id: 'c', date: '2026-02-01', startedAt: '2026-02-01T09:00:00Z', sets: [] }]; G.syncRewards(day2); assert.equal(d2.keys, 4, 'the daily limit still holds: 2 sessions x 2 keys');
});

test('Echo: a second item from a boss', () => {
  const run = (lv, r) => { const g = game({ floor: 10, stats: STRONG, bossBest: 150 }); g.focusUp.echo = lv; const sum = G.advance(g, 60, () => r, { stopAt: 11 }); return { n: sum.drops.length, g }; };
  assert.equal(run(0, 0).n, 1); assert.equal(run(5, 0.9).n, 1, 'no echo on a high roll'); assert.equal(run(5, 0.1).n, 2); assert.equal(run(5, 0.15).n, 1, '15% at level 5'); assert.equal(run(5, 0.14).n, 2);
  assert.equal(run(40, 0.29).n, 2); assert.equal(run(40, 0.31).n, 1, 'capped at 30%');
  let calls = 0; const g = game({ floor: 10, stats: STRONG }); G.advance(g, 60, () => { calls++; return 0.9; }, { stopAt: 11 }); const c0 = calls; const h = game({ floor: 10, stats: STRONG, bossBest: 150 }); h.focusUp.echo = 3; calls = 0; G.advance(h, 60, () => { calls++; return 0.9; }, { stopAt: 11 }); assert.equal(calls, c0 + 1, 'one extra roll');
});

test('the cap-raise message: loot card, away summary, advance', () => {
  const g = game({ floor: 30, stats: STRONG, bossBest: 20 }), sum = G.advance(g, 60, () => 0.9, { stopAt: 31 }); assert.equal(sum.capsUp, true);
  const card = V.lootHtml(g, sum.drops[0], 'Boss down', V.unlockHtml(sum.unlocked, sum.capsUp)); assert.match(card, /Focus caps raised: max levels \+50%/); assert.match(card, /New Focus upgrade: Thornmail/);
  assert.doesNotMatch(V.unlockHtml([], false), /caps/); assert.match(V.unlockHtml([], true), /Focus caps raised/); assert.doesNotMatch(V.unlockHtml([], true), /New Focus/);
  const n = game({ floor: 40, stats: STRONG, bossBest: 30 }); assert.equal(G.advance(n, 60, () => 0.9, { stopAt: 41 }).capsUp, false, 'no milestone, no message');
  const o = fresh(), og = G.ensureGame(o); Object.assign(og, { floor: 30, stats: STRONG, bossBest: 20, keys: 5, lastTick: 1e12 - 8 * 3600e3 }); const a = G.offlineCatchUp(o, 1e12, () => 0.9); assert.equal(a.capsUp, true);
  assert.match(V.awayHtml(a), /Focus caps raised: max levels \+50%/); assert.doesNotMatch(V.awayHtml({ ...a, capsUp: false }), /caps raised/);
});

test('cap rows: Lv x/y, Max for now, cap line, aria-labels', () => {
  const view = (bossBest, up = {}) => { const s = fresh(), g = G.ensureGame(s); g.bossBest = bossBest; Object.assign(g.focusUp, up); g.focus = 1e6; const html = V.viewTower(s); return { g, html, sec: html.slice(html.indexOf('id="tw-focus"'), html.indexOf('Spend Focus on the Forge')) }; };
  let r = view(50, { iron: 15, hands: 15, warlord: 3 }); assert.match(r.sec, /Iron Skin <span class="tw-lv">Lv 15\/15<\/span>/); assert.match(r.sec, /Max for now\. Rises to 20 at the floor 60 boss/);
  assert.match(r.html, /id="tw-capline"[^>]*aria-label="Next cap raise: floor 60 boss \(\+50% max levels\)"/); assert.match(r.html, />Next cap raise: floor 60 boss \(\+50% max levels\)</);
  const iron = r.sec.slice(r.sec.indexOf('data-row="up:iron"')), ironRow = iron.slice(0, iron.indexOf('data-row="up:hands"'));
  assert.match(ironRow, /role="group" aria-label="Iron Skin, level 15 of 15\. [^"]*Max for now\. Rises to 20 at the floor 60 boss"/); assert.match(ironRow, /aria-label="Iron Skin is at max level\. Max for now\. Rises to 20 at the floor 60 boss" disabled>Max</);
  assert.match(r.sec, /Warlord's Edge <span class="tw-lv">Lv 3\/15<\/span>/); const w = r.sec.slice(r.sec.indexOf('data-row="up:warlord"'), r.sec.indexOf('data-row="up:breath"')); assert.doesNotMatch(w, /Max for now/); assert.match(w, /aria-label="Upgrade Warlord&#39;s Edge to level 4 for/);
  r = view(150, { iron: 35 }); assert.doesNotMatch(r.sec, /Max for now/); assert.match(r.html, /aria-label="All level caps raised"/); assert.match(r.sec, /Lv 35\/35/); assert.match(r.sec, /aria-label="Iron Skin is at max level" disabled>Max</);
  for (const b of r.sec.match(/<button[^>]*>/g)) assert.match(b, /aria-label="[^"]+"/);
  assert.match(r.sec, /Gilded Keys/); assert.match(r.sec, /Echo/); assert.match(r.sec, /Keen Edge/); assert.match(r.sec, /Fortify/);
  assert.equal(V.capLine(game({ bossBest: 0 })), 'Next cap raise: floor 30 boss (+50% max levels)');
});
