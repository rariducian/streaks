import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as G from '../js/game/engine.js';
import * as V from '../js/game/view.js';
import * as SP from '../js/game/sprites.js';

const C = G.CONFIG.pets;
const fresh = () => L.defaultState(new Date(2026, 0, 1, 12));
const addS = (s, n) => { const k = s.sessions.length; for (let i = 0; i < n; i++) s.sessions.push({ id: 'p' + (k + i), date: L.addDays('2026-02-01', k + i), startedAt: `2026-02-01T0${(k + i) % 10}:00:00`, minimum: false, sets: [] }); return s; };
const fastOf = (id, hours, done = true) => { const a = new Date(2026, 2, 1, 0, 0).getTime(); return { id, start: new Date(a).toISOString(), end: done ? new Date(a + hours * 3.6e6).toISOString() : null, goalHours: 16 }; };
const started = (extra = {}) => { const s = fresh(); G.syncRewards(s); Object.assign(s.game.pets, extra); return s; };   // a state past the history pass, with no sessions yet
const owns = (s, id, lv = 1, active = true) => { s.game.pets.owned[id] = { lv, xp: 0 }; if (active) s.game.pets.active = id; return s; };
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('an egg every 10 sessions, each session counted once', () => {
  const s = started(); assert.equal(s.game.pets.init, true);
  assert.equal(G.syncRewards(addS(s, 9)).eggs, 0); assert.equal(s.game.pets.eggs.length, 0);
  const r = G.syncRewards(addS(s, 1)); assert.equal(r.eggs, 1); assert.equal(r.ready, 0); assert.deepEqual(s.game.pets.eggs.map((e) => e.warm), [0]);
  assert.equal(G.syncRewards(addS(s, 10)).eggs, 1); assert.equal(s.game.pets.eggs.length, 2); assert.equal(s.game.pets.n, 20);
  assert.equal(G.sessionsToEgg(s.game), 10);
});

test('welcome grant: at most 2 eggs, the first one ready, history earns no warmth or XP', () => {
  let s = addS(fresh(), 35); s.fasts.push(fastOf('h', 20)); let r = G.syncRewards(s), p = s.game.pets;
  assert.equal(r.eggs, 2); assert.equal(r.ready, 1); assert.deepEqual(p.eggs.map((e) => e.warm), [C.need, 0]); assert.equal(p.n, 35); assert.equal(G.sessionsToEgg(s.game), 5);
  assert.equal(s.game.paid['pw:h'], 0); assert.equal(s.game.paid['pe:p0'], 0);
  assert.equal(G.syncRewards(addS(s, 5)).eggs, 1);   // the next one is on schedule
  s = addS(fresh(), 5); assert.equal(G.syncRewards(s).eggs, 0); assert.equal(s.game.pets.eggs.length, 0);
  s = addS(fresh(), 12); r = G.syncRewards(s); assert.equal(r.eggs, 1); assert.equal(s.game.pets.eggs[0].warm, C.need);
});

test('warmth: whole hours of completed fasts, overflow carries to the next egg', () => {
  const s = started({ eggs: [{ id: 1, warm: 0 }, { id: 2, warm: 0 }] }); s.fasts.push(fastOf('a', 10.9));
  let r = G.syncRewards(s); assert.deepEqual(s.game.pets.eggs.map((e) => e.warm), [10, 0]); assert.equal(r.ready, 0);
  s.fasts.push(fastOf('b', 10)); r = G.syncRewards(s); assert.deepEqual(s.game.pets.eggs.map((e) => e.warm), [C.need, 4]); assert.equal(r.ready, 1);
  s.fasts.push(fastOf('c', 30)); r = G.syncRewards(s); assert.deepEqual(s.game.pets.eggs.map((e) => e.warm), [C.need, C.need]); assert.equal(r.ready, 1);   // more than needed is lost
});

test('an in-progress fast adds no warmth until it ends', () => {
  const s = started({ eggs: [{ id: 1, warm: 0 }] }); s.fasts.push(fastOf('a', 20, false));
  G.syncRewards(s); assert.equal(s.game.pets.eggs[0].warm, 0); assert.equal(s.game.paid['pw:a'], undefined);
  s.fasts[0] = fastOf('a', 5); G.syncRewards(s); assert.equal(s.game.pets.eggs[0].warm, 5);
});

test('hatch is refused when no egg is ready', () => {
  const s = started({ eggs: [{ id: 1, warm: C.need - 1 }] }); assert.equal(G.hatchEgg(s.game, () => 0), null); assert.equal(s.game.pets.eggs.length, 1);
  assert.equal(G.hatchEgg(started().game), null);
});

test('hatching: new species until all 8 are owned, then a duplicate gives dupe XP; the first pet becomes active', () => {
  const s = started({ eggs: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, warm: C.need })) }), g = s.game, seen = new Set();
  for (let i = 0; i < 8; i++) { const r = G.hatchEgg(g, () => 0.999 - i * 0.1); assert.equal(r.dupe, false); assert.ok(!seen.has(r.species), r.species); seen.add(r.species); }
  assert.equal(seen.size, 8); assert.equal(g.pets.active, [...seen][0]); assert.equal(Object.keys(g.pets.owned).length, 8);
  const r = G.hatchEgg(g, () => 0); assert.equal(r.dupe, true); assert.equal(g.pets.eggs.length, 0);
  const o = g.pets.owned[r.species]; assert.equal(o.lv, 4); assert.equal(o.xp, 0);   // 60 XP: 10 + 20 + 30
  assert.equal(r.up, 3);
});

test('level and XP math, XP stops at max level', () => {
  const s = started(); owns(s, 'fox'); const g = s.game;
  assert.equal(G.petNeed(1), 10); assert.equal(G.petNeed(4), 40);
  assert.equal(G.addPetXp(g, 'fox', 9), 0); assert.deepEqual(g.pets.owned.fox, { lv: 1, xp: 9 });
  assert.equal(G.addPetXp(g, 'fox', 1), 1); assert.deepEqual(g.pets.owned.fox, { lv: 2, xp: 0 });
  assert.equal(G.addPetXp(g, 'fox', 25), 1); assert.deepEqual(g.pets.owned.fox, { lv: 3, xp: 5 });
  G.addPetXp(g, 'fox', 1e6); assert.deepEqual(g.pets.owned.fox, { lv: C.maxLv, xp: 0 }); assert.equal(G.addPetXp(g, 'fox', 50), 0);
  // sessions and fasts feed the active pet in a sync
  const t = owns(started(), 'fox'); t.fasts.push(fastOf('a', 7.5)); addS(t, 2); const r = G.syncRewards(t);
  assert.deepEqual(t.game.pets.owned.fox, { lv: 2, xp: 5 }); assert.equal(r.petLv, 1);   // 2 sessions (8) and 7 whole hours (15 in all)
});

test('a full nest turns the egg into XP; no active pet means no XP', () => {
  const s = owns(started({ eggs: [1, 2, 3].map((id) => ({ id, warm: 0 })), n: 9 }), 'fox'); G.syncRewards(addS(s, 1));
  assert.equal(s.game.pets.eggs.length, C.maxEggs); const o = s.game.pets.owned.fox; assert.equal(o.lv * 1000 + o.xp, 3 * 1000 + (C.overflowXp + C.sessionXp - 10 - 20));
  const t = started({ n: 9 }); G.syncRewards(addS(t, 1)); assert.equal(t.game.pets.eggs.length, 1);
});

test('pet effects: fox Attack, snail boss timer, beetle Sweat, owl Focus, tortoise Health', () => {
  const base = G.heroStats(started().game), bt = G.bossTimer(started().game);
  let s = owns(started(), 'fox'); close(G.heroStats(s.game).atk, base.atk * 1.03);
  s.game.pets.owned.fox.lv = 5; close(G.heroStats(s.game).atk, base.atk * 1.07); close(G.petFx(s.game).atk, 0.07);
  s = owns(started(), 'tortoise', 3); close(G.heroStats(s.game).hp, base.hp * 1.05); assert.equal(G.heroStats(s.game).atk, base.atk);
  s = owns(started(), 'snail'); close(G.bossTimer(s.game), bt * 1.05);
  s = owns(started(), 'hawk'); close(G.heroStats(s.game).spd, base.spd * 1.02);
  s = owns(started(), 'cat'); close(G.heroStats(s.game).crit, base.crit + 0.02);
  s = owns(started(), 'toad'); close(G.affixTotal(s.game, 'lifesteal'), 0.02);
  const sweat = (pet) => { const t = started(); if (pet) owns(t, pet); addS(t, 1); return G.syncRewards(t).sweat; };
  assert.equal(sweat(null), 105); assert.equal(sweat('beetle'), Math.round(100 * 1.05 * 1.03)); assert.equal(sweat('fox'), 105);
  const focus = (pet) => { const t = started(); if (pet) owns(t, pet, 4); t.fasts.push(fastOf('a', 16)); return G.syncRewards(t).focus; };
  assert.equal(focus(null), 100); assert.equal(focus('owl'), Math.round(100 * 1.11)); assert.equal(focus('fox'), 100);
});

test('only the active pet gives a bonus or grows', () => {
  const s = owns(owns(started(), 'fox', 5, false), 'tortoise', 1, true), base = G.heroStats(started().game);
  assert.equal(G.heroStats(s.game).atk, base.atk); close(G.heroStats(s.game).hp, base.hp * 1.03);
  addS(s, 3); G.syncRewards(s); assert.deepEqual(s.game.pets.owned.fox, { lv: 5, xp: 0 }); assert.deepEqual(s.game.pets.owned.tortoise, { lv: 2, xp: 2 });   // 12 XP
  assert.equal(G.setPet(s.game, 'fox'), true); assert.equal(G.activePet(s.game), 'fox'); assert.equal(G.setPet(s.game, 'owl'), false); assert.equal(s.game.pets.active, 'fox');
  assert.equal(G.petFx(started().game).atk, undefined);
});

test('syncing again changes nothing', () => {
  const s = owns(started({ eggs: [{ id: 1, warm: 3 }] }), 'cat'); addS(s, 23); s.fasts.push(fastOf('a', 9), fastOf('b', 12, false));
  const r1 = G.syncRewards(s), snap = JSON.stringify(s.game), r2 = G.syncRewards(s);
  assert.equal(r1.eggs, 2); assert.equal(JSON.stringify(s.game), snap); assert.deepEqual([r2.eggs, r2.ready, r2.petLv, r2.focus, r2.sweat], [0, 0, 0, 0, 0]);
});

test('ensureGame repairs a damaged pets object', () => {
  const s = fresh(); G.ensureGame(s); const junk = [null, 'x', [], 7];
  for (const j of junk) { s.game.pets = j; const p = G.ensureGame(s).pets; assert.deepEqual(p, { init: false, n: 0, eggs: [], owned: {}, active: null }); }
  s.game.pets = { init: 'yes', n: -4.5, eggs: [null, 5, { warm: 'a' }, { id: 9, warm: 99 }, { warm: 3.7 }, {}, {}], owned: { fox: { lv: 99, xp: -5 }, dragon: { lv: 3 }, cat: 'x', owl: { lv: 3, xp: 1000 }, toad: { lv: 'a', xp: 'b' } }, active: 'cat' };
  const p = G.ensureGame(s).pets;
  assert.equal(p.init, false); assert.equal(p.n, 0); assert.equal(p.eggs.length, C.maxEggs); assert.ok(p.eggs.every((e) => Number.isFinite(e.id) && Number.isFinite(e.warm) && e.warm >= 0 && e.warm <= C.need));
  assert.deepEqual(p.eggs.map((e) => e.warm), [0, C.need, 3]);
  assert.deepEqual(p.owned, { fox: { lv: C.maxLv, xp: 0 }, toad: { lv: 1, xp: 0 }, owl: { lv: 3, xp: 29 } }); assert.equal(p.active, null);
  s.game.pets.active = 'owl'; assert.equal(G.ensureGame(s).pets.active, 'owl');
});

test('pets survive export and import', () => {
  const s = owns(started({ eggs: [{ id: 1, warm: 4 }] }), 'owl', 2); const t = JSON.parse(JSON.stringify(s));
  assert.deepEqual(G.ensureGame(t).pets, s.game.pets);
});

test('pet sprites: every species and the eggs have two frames of one size', () => {
  for (const k of [...SP.PET_SPECIES, 'egg', 'crack']) {
    const m = SP.PET_MAPS[k], w = m.idleA[0].length, h = m.idleA.length;
    assert.ok(w >= 10 && w <= 16 && h >= 10 && h <= 14, `${k} ${w}x${h}`);
    for (const f of ['idleA', 'idleB']) { assert.equal(m[f].length, h, k + f); assert.ok(m[f].every((r) => r.length === w), k + f); for (const ch of m[f].join('')) assert.ok(ch === '.' || SP.PALETTE[ch], `${k} role ${ch}`); }
    assert.notEqual(m.idleA.join(), m.idleB.join(), k);
  }
  assert.deepEqual(SP.PET_SPECIES, G.PET_IDS); assert.deepEqual(SP.CLIPS, {}); assert.equal(SP.petIcon('fox').url, '');   // no DOM here, so no data URL
});

test('Pets card in the Tower view', () => {
  const s = owns(started({ eggs: [{ id: 1, warm: 9 }, { id: 2, warm: C.need }], n: 3 }), 'fox', 2); s.game.pets.owned.owl = { lv: 1, xp: 0 };
  const html = V.viewTower(s), card = html.slice(html.indexOf('id="tw-pets"'), html.indexOf('<h2 class="title">Gear'));
  assert.ok(html.indexOf('>Hero<') < html.indexOf('>Pets<') && html.indexOf('>Pets<') < html.indexOf('>Gear<'));
  assert.match(card, /Ember Fox <span class="tw-lv">Lv 2/); assert.match(card, /role="progressbar"[^>]*aria-valuemax="20" aria-valuenow="0"/); assert.match(card, /\+4% Attack/);
  assert.match(card, /Egg: 9 of 16 fasting hours/); assert.match(card, /data-act="hatchEgg"/); assert.match(card, /data-act="setPet" data-id="owl"[^>]*>Choose/); assert.match(card, /disabled>Active/);
  assert.match(card, /Every 10 sessions lays an egg\. Fasting hours hatch it\. Your active pet grows from fasts and sessions\. Next egg in 7 sessions\./);
  assert.match(html, /Pets<\/b> every 10 sessions lays an egg/); assert.match(V.canvasLabel(s.game), /with their Ember Fox beside them/); assert.doesNotMatch(V.canvasLabel(started().game), /beside/);
  assert.doesNotMatch(V.viewTower(started()), /data-act="hatchEgg"/);
});

test('hatch sheet text', () => {
  const s = owns(started(), 'toad', 1, false); owns(s, 'fox'); const g = s.game;
  let r = V.petSheet(g, { species: 'toad', dupe: false }); assert.match(r.body, /A Moss Toad hatched!/); assert.match(r.body, /\+2% Lifesteal/); assert.match(r.body, /data-act="makeActive" data-id="toad"/);
  r = V.petSheet(g, { species: 'fox', dupe: false }); assert.match(r.body, /An Ember Fox hatched!/); assert.doesNotMatch(r.body, /makeActive/);
  r = V.petSheet(g, { species: 'toad', dupe: true, up: 0 }); assert.match(r.body, /Another Moss Toad\. Yours gained 60 XP\./);
});
