// Tower engine: pure logic, no DOM. Mutates the game object it is given (state.game). Spec: docs/TOWER.md
import { computeStreak, trainingDates, restFn, restBetween, monthOf } from '../logic.js';
import { traitsOf, isElite } from './scene.js';

export const CONFIG = {
  sessionSweat: 100, minimumSweat: 40, streakStep: 0.05, streakCap: 10, dailyLimit: 2, secondHalf: 0.5,
  levelUpSweat: 300, pbSweat: 100,
  focusBase: 30, focusPerHour: 5, focusCap: 80,
  atk: { base: 5, per: 2, cost: 20, grow: 1.038 }, hp: { base: 50, per: 15, cost: 20, grow: 1.038 },
  spd: { base: 1, per: 0.04, max: 3, cost: 25, grow: 1.05 },
  milestoneEvery: 10, milestoneMult: 1.5,   // every 10 levels of Attack or Health multiplies that stat (idle-game milestone), so late floors keep falling
  critMult: 2,   // a crit does double damage, Crit damage affixes add to this
  enemyHp: 20, enemyHpGrow: 1.075, enemyAtk: 2, enemyAtkGrow: 1.075, bossEvery: 10, bossHp: 1.2, bossAtk: 1,
  walk: 2, rest: 10, gritStep: 0.0007, gritMax: 0.25, bossTimer: 30, maxIter: 20000,   // grit compounds per failed try (10 s each) and hits the +25% cap in about 53 min. Boss enrage: not dead by bossTimer seconds is a loss. See tools/tower-sim.mjs
  offlineBaseH: 24, offlineMaxH: 24, staminaPer: 0.10,   // 'endurance' is the save key for Stamina: +10% Sweat from sessions per level
  focusUp: {
    endurance: { max: 5, cost: 30, grow: 1.4, capStep: 2 }, precision: { max: 20, cost: 30, grow: 1.25 }, luck: { max: 10, cost: 40, grow: 1.3, capStep: 5 },
    // New ones: per = effect per level, need = the boss floor that unlocks it (bossBest), 0 = always open. Listed in unlock order, the Focus section shows them in this order
    iron: { max: 10, cost: 20, grow: 1.25, per: 0.02, need: 0 }, hands: { max: 10, cost: 20, grow: 1.25, per: 0.02, need: 0 },
    warlord: { max: 10, cost: 25, grow: 1.25, per: 0.03, need: 10 }, breath: { max: 5, cost: 30, grow: 1.3, per: 0.01, need: 20, capStep: 2 },
    thorn: { max: 10, cost: 30, grow: 1.25, per: 0.02, need: 30 }, mastery: { max: 10, cost: 40, grow: 1.25, per: 0.03, need: 40, cap: 0.75 },
    sense: { max: 5, cost: 40, grow: 1.35, per: 0.04, need: 50, capStep: 2, cap: 0.6 }, ring: { max: 3, cost: 50, grow: 1.6, per: 1, need: 60, capStep: 1 },
    overkill: { max: 10, cost: 40, grow: 1.25, per: 0.05, need: 70 }, dilation: { max: 4, cost: 60, grow: 1.4, per: 5, need: 80, capStep: 1 },
    ascendant: { max: 3, cost: 100, grow: 1.8, per: 1, need: 100, capStep: 1 },
    fortify: { max: 10, cost: 20, grow: 1.2, per: 0.03, need: 90 }, keen: { max: 10, cost: 20, grow: 1.2, per: 0.03, need: 110 },   // +Health, +Attack
    gilded: { max: 5, cost: 80, grow: 1.35, per: 0.05, need: 130, cap: 1 }, echo: { max: 5, cost: 100, grow: 1.4, per: 0.03, need: 150, cap: 0.3 }   // chance of an extra key per paid session, of a second boss drop
  },
  // Level caps rise with lifetime bossBest: each milestone adds capStep levels to every upgrade (default: capPct of the base max, rounded up). `cap` = most the effect can ever give, so levels past it are never offered
  capBosses: [30, 60, 90, 120, 150], capPct: 0.5,
  dmgMin: 0.4, epicMax: 0.75, critMax: 1,   // guards: damage taken never under 40% (Guard and Iron Skin together), epic chance never over 75%, crit chance never over 100%
  precisionPer: 0.02, luckPer: 0.02,
  rarity: { common: { mult: 1, p: 0.70 }, rare: { mult: 1.5, p: 0.25 }, epic: { mult: 2.2, p: 0.05 } },
  gearPct: 0.05, scrapPer: 5, dropLog: 5, stash: 6, tierGrow: 0.06, affSpread: 0.2,   // stash: unequipped drops kept (Hoarder adds more). Affix value = base x (1 + tierGrow x (tier-1)) x (1 +/- affSpread)
  // Affixes: base value at tier 1, w = weight in the power score (per 1% of value), cap = most the whole kit can add up to
  affix: {
    lifesteal: { base: 0.08, w: 1.2, cap: 0.30 }, thorns: { base: 0.10, w: 0.8 }, critdmg: { base: 0.25, w: 0.4 }, boss: { base: 0.15, w: 0.6 },
    swift: { base: 0.06, w: 1.5 }, guard: { base: 0.06, w: 1.5, cap: 0.5 }, ward: { base: 0.12, w: 0.8 }, train: { base: 0.05, w: 1, cap: 0.30 }
  },
  maxAffix: { common: 1, rare: 2, epic: 3 },
  forge: { reroll: 40, add: 100, upgrade: 160, temper: 30, tierGrow: 1.35, temperGrow: 1.15, temperPct: 0.05 },   // Focus. cost = base x 1.35^tier x (1 - Ancestral forge); Temper also x 1.15^level
  trait: { armour: 0.015, armourMin: 0.3, arcane: 0.3, regen: 0.015, burn: 0.3, chill: 0.25, swiftHits: 2 },   // armour: flat cut per hit as a share of enemy HP, never below armourMin of the hit. regen: enemy HP/s. burn: x enemy attack per second, ignores Guard
  eliteHp: 1.15, eliteAtk: 1.1,   // every 5th floor that is not a boss. Higher values stalled daily trainers for up to 2 weeks in tools/tower-sim.mjs
  talents: {   // souls. cost = ceil(cost x grow^level). per = effect per level
    might: { max: 20, cost: 2, grow: 1.3, per: 0.08 }, vigour: { max: 20, cost: 2, grow: 1.3, per: 0.08 }, head: { max: 6, cost: 3, grow: 1.5, per: 5 },
    wind: { max: 3, cost: 3, grow: 1.6, per: 15 }, prospector: { max: 5, cost: 3, grow: 1.4, per: 0.10 }, hoarder: { max: 4, cost: 2, grow: 1.5, per: 1 },
    fortune: { max: 5, cost: 3, grow: 1.4, per: 0.02 }, ancestral: { max: 5, cost: 3, grow: 1.4, per: 0.05 }
  },
  keyCap: 5, sessionKeys: 1, levelUpKeys: 1, welcomeKeys: 3, migrateKeys: 1, fightAhead: 2,   // Boss Keys: a paid session and a level-up pay keys, history pays at most welcomeKeys, old saves start with migrateKeys. fightAhead: floors before a boss that still offer the live fight
  ascendMinFloor: 20,
  restedBonus: 0.10,   // 'Rested': the next session after a passed planned rest day pays +10% Sweat (added to Stamina and the like). One-off, never stacks
  welcomeSets: 3,   // history pays at most this many set pieces on the first sync, like welcomeKeys
  bounty: { daysMin: 3, daysMax: 5, fullMin: 2, fullMax: 4, fastMin: 2, fastMax: 4, weeks: 4, keys: 1, minRarity: 'rare' },   // Weekly bounty: targets scale to the last `weeks` weeks (average + 1). The chest gives a rare-or-better item at the current tier and `keys` boss key
  // Move-tied gear sets. A level-up of that move in real life gives one missing piece (weapon, armour or boots). 2 worn pieces give `two`, 3 give `three` on top.
  // Effect keys: atk, hp, spd (stat multipliers), crit (crit chance), timer (boss timer share), or any affix id (lifesteal, thorns, critdmg, boss, swift, guard, ward, train)
  sets: {
    hpush: { name: 'Vanguard', two: { atk: 0.10 }, three: { atk: 0.15, crit: 0.05 } },
    squat: { name: 'Bulwark', two: { hp: 0.10 }, three: { hp: 0.15, guard: 0.05 } },
    hinge: { name: 'Atlas', two: { atk: 0.05, hp: 0.05 }, three: { atk: 0.08, hp: 0.08, thorns: 0.08 } },
    row: { name: 'Tidecaller', two: { lifesteal: 0.05 }, three: { lifesteal: 0.05, spd: 0.05 } },
    core: { name: 'Keystone', two: { timer: 0.15 }, three: { timer: 0.15, boss: 0.10 } },
    vpush: { name: 'Skyward', two: { spd: 0.08 }, three: { spd: 0.08, ward: 0.12 } },
    calf: { name: 'Strider', two: { train: 0.05 }, three: { train: 0.05, spd: 0.08 } },
    hamcurl: { name: 'Coil', two: { crit: 0.04 }, three: { crit: 0.04, critdmg: 0.4 } }
  }
};
export const SET_IDS = Object.keys(CONFIG.sets);
export const SLOTS = ['weapon', 'armour', 'boots'];
export const SLOT_STAT = { weapon: 'atk', armour: 'hp', boots: 'spd' };
export const RARITIES = ['common', 'rare', 'epic'];
// Look: the art an item shows on the hero, the inventory icon and the battle sprite. Derived from slot, tier and rarity only, so it never needs saving (tidy() refills it on load).
// Weapons change every 2 tiers (short sword, longsword, axe, spear, greatsword from 9), armour every 2 (tunic, vest, chain, plate, plate and cape from 9), boots every 3.
export const LOOKS = { weapon: ['sword', 'longsword', 'axe', 'spear', 'greatsword'], armour: ['tunic', 'vest', 'chain', 'plate', 'cape'], boots: ['cloth', 'leather', 'iron'] };
const LOOK_STEP = { weapon: 2, armour: 2, boots: 3 };
export const lookOf = (it) => { const l = LOOKS[it.slot]; return `${it.slot}.${l[Math.min(l.length - 1, Math.floor((Math.max(1, it.tier) - 1) / LOOK_STEP[it.slot]))]}.${it.rarity}`; };
export const AFFIXES = Object.keys(CONFIG.affix);
export const TALENTS = Object.keys(CONFIG.talents);

export function ensureGame(state) {
  const had = !!state.game && typeof state.game === 'object', g = had ? state.game : (state.game = {});
  const num = (k, v) => { if (!Number.isFinite(g[k])) g[k] = v; };
  for (const k of ['sweat', 'focus', 'souls', 'tokens', 'grit', 'prog', 'lastTick']) num(k, 0);
  for (const k of ['floor', 'runMax', 'bestFloor']) num(k, 1);
  num('bossBest', 0); g.bossBest = Math.max(g.bossBest, Math.floor((g.bestFloor - 1) / CONFIG.bossEvery) * CONFIG.bossEvery);   // lifetime: the highest boss floor ever beaten. Old saves: the last boss below bestFloor
  const obj = (k, d) => { if (!g[k] || typeof g[k] !== 'object' || Array.isArray(g[k])) g[k] = d; };
  num('soulsSpent', 0); num('seq', 0); num('keyFor', 0);
  num('keys', had ? CONFIG.migrateKeys : 0); g.waiting = !!g.waiting; g.kw = !!g.kw;   // old saves start with a key. kw: the welcome grant has been paid
  obj('stats', {}); obj('focusUp', {}); obj('gear', {}); obj('paid', {}); obj('talents', {}); obj('floorLog', {}); obj('setLog', {});
  for (const k of Object.keys(g.floorLog)) if (!/^\d{4}-\d{2}$/.test(k) || !Number.isFinite(g.floorLog[k])) delete g.floorLog[k];
  const ym = monthOf(); if (g.floorLog[ym] === undefined) g.floorLog[ym] = g.floor;   // the floor a month started on (when it first saw the game). The monthly recap reads it
  for (const k of ['atk', 'hp', 'spd']) num2(g.stats, k);
  for (const k of Object.keys(CONFIG.focusUp)) { num2(g.focusUp, k); g.focusUp[k] = Math.min(Math.floor(g.focusUp[k]), focusMax(g, k)); }
  g.keys = Math.max(0, Math.min(keyCap(g), Math.floor(g.keys)));
  for (const k of TALENTS) { num2(g.talents, k); g.talents[k] = Math.min(Math.floor(g.talents[k]), CONFIG.talents[k].max); }
  g.soulsSpent = Math.min(g.soulsSpent, g.souls);   // old saves: every soul earned so far is unspent
  for (const s of SLOTS) if (g.gear[s] === undefined) g.gear[s] = null;
  if (!Array.isArray(g.stash)) g.stash = [];
  for (const s of SLOTS) if (g.gear[s]) tidy(g, g.gear[s]);
  g.stash = g.stash.filter((it) => it && SLOTS.includes(it.slot)); for (const it of g.stash) tidy(g, it);
  if (!Array.isArray(g.drops)) g.drops = [];
  if (g.away === undefined) g.away = null;
  const b = g.bounty; if (b !== undefined && !(b && typeof b === 'object' && typeof b.week === 'string' && ['days', 'best', 'level', 'full', 'fast'].includes(b.kind) && Number.isFinite(b.target))) delete g.bounty; else if (b) b.claimed = !!b.claimed;
  return g;
}
function num2(o, k) { if (!Number.isFinite(o[k])) o[k] = 0; }
// Old items have no affixes, level, lock, id or look. Fill them in without touching bonus.
function tidy(g, it) {
  it.look = lookOf(it);
  it.aff = Array.isArray(it.aff) ? it.aff.filter((a) => a && CONFIG.affix[a.id] && Number.isFinite(a.v)) : [];
  if (!Number.isFinite(it.lvl)) it.lvl = 0;
  it.lock = !!it.lock; it.added = !!it.added;
  if (it.set !== undefined && !CONFIG.sets[it.set]) delete it.set;
  if (!Number.isFinite(it.id)) it.id = ++g.seq;
}

// ---------- rewards ----------
export const streakMult = (streak) => 1 + CONFIG.streakStep * Math.min(streak, CONFIG.streakCap);
export const focusForFast = (hours, minH) => hours >= minH ? Math.min(CONFIG.focusCap, CONFIG.focusBase + CONFIG.focusPerHour * Math.floor(hours - minH + 1e-9)) : 0;

// Gilded Keys: a hash of the session id (FNV-1a, then a murmur mix so ids that differ by a digit still spread) against the chance, so the same session always rolls the same and re-syncing never changes it. More levels only widen the chance
const idRoll = (id) => { let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const gilded = (g, id) => idRoll(id) < flFx(g, 'gilded');
// Pays every session, event and fast not yet in game.paid. Safe to call any number of times.
// Boss Keys ride the same way ('ks:' per session, 'ke:' per level-up), so old saves with Sweat already paid still get theirs. The first sync is the welcome grant: history pays at most welcomeKeys.
export function syncRewards(state, now = Date.now(), rng = Math.random) {
  const g = ensureGame(state), out = { sweat: 0, focus: 0, tokens: 0, items: 0, keys: 0, pieces: [] }, rest = restFn(state.settings), stam = 1 + CONFIG.staminaPer * (g.focusUp.endurance || 0) + trainBonus(g) + talFx(g, 'prospector');
  const sessions = (state.sessions || []).map((s, i) => ({ s, i })).sort((a, b) => (a.s.date || '').localeCompare(b.s.date || '') || String(a.s.startedAt || '').localeCompare(String(b.s.startedAt || '')) || a.i - b.i);
  const dates = trainingDates(state), streakAt = new Map(), seen = new Map(); let kp = 0, prevDate = null;
  for (const { s } of sessions) {
    const before = prevDate; prevDate = s.date;   // 'Rested': a planned rest day passed since the last session (never true for a 2nd session on the same day)
    const nth = seen.get(s.date) || 0; seen.set(s.date, nth + 1);
    const key = 's:' + s.id;
    if (g.paid['ks:' + s.id] === undefined) { const k = nth < CONFIG.dailyLimit ? CONFIG.sessionKeys + (gilded(g, s.id) ? 1 : 0) : 0; g.paid['ks:' + s.id] = k; kp += k; }   // same daily limit as Sweat, minimum days count. Gilded Keys: one more key, rolled from the session id
    if (g.paid[key] !== undefined) continue;
    if (!streakAt.has(s.date)) streakAt.set(s.date, computeStreak(dates.filter((d) => d <= s.date), s.date, rest).current);
    let amt = (s.minimum ? CONFIG.minimumSweat : CONFIG.sessionSweat) * streakMult(streakAt.get(s.date));
    amt = nth === 0 ? amt : nth < CONFIG.dailyLimit ? amt * CONFIG.secondHalf : 0;
    const rested = !!before && before < s.date && restBetween(rest, before, s.date);
    amt = Math.round(amt * (stam + (rested ? CONFIG.restedBonus : 0))); g.paid[key] = amt; g.sweat += amt; out.sweat += amt; out.items++;
  }
  for (const e of state.events || []) {
    const key = 'e:' + e.id;
    if (e.type === 'levelUp' && g.paid['ke:' + e.id] === undefined) { g.paid['ke:' + e.id] = CONFIG.levelUpKeys; kp += CONFIG.levelUpKeys; }
    if (g.paid[key] !== undefined || (e.type !== 'levelUp' && e.type !== 'pb')) continue;
    const amt = e.type === 'levelUp' ? CONFIG.levelUpSweat : CONFIG.pbSweat;
    g.paid[key] = amt; g.sweat += amt; out.sweat += amt; out.items++;
    if (e.type === 'levelUp') { g.tokens++; out.tokens++; }
  }
  // Set pieces: only a real level-up of that move pays, once per event ('es:'). The first sync (history) pays at most welcomeSets, newest first.
  const lv = (state.events || []).filter((e) => e.type === 'levelUp' && g.paid['es:' + e.id] === undefined); if (!g.kw) lv.reverse();
  let sp = 0;
  for (const e of lv) {
    if (!CONFIG.sets[e.moveId] || (!g.kw && sp >= CONFIG.welcomeSets)) { g.paid['es:' + e.id] = 0; continue; }
    g.paid['es:' + e.id] = 1; sp++; out.pieces.push(giveSetPiece(g, e.moveId, rng));
  }
  if (!g.kw) { kp = Math.min(kp, CONFIG.welcomeKeys); g.kw = true; }
  const k0 = g.keys; g.keys = Math.min(keyCap(g), g.keys + kp); out.keys = g.keys - k0;   // keys over the cap are lost, but still marked paid
  const minH = state.settings && state.settings.fastMinHours || 12;
  for (const f of state.fasts || []) {
    const key = 'f:' + f.id;
    if (!f.end || g.paid[key] !== undefined) continue;
    const amt = focusForFast((new Date(f.end) - new Date(f.start)) / 3.6e6, minH);
    if (!amt) continue;   // short fast: not marked, so editing it longer can still pay
    g.paid[key] = amt; g.focus += amt; out.focus += amt; out.items++;
  }
  return out;
}

// ---------- costs and stats ----------
const upCost = (c, lv) => Math.ceil(c.cost * Math.pow(c.grow, lv));
export const statCost = (stat, lv) => upCost(CONFIG[stat], lv);
export const focusCost = (up, lv) => upCost(CONFIG.focusUp[up], lv);
// Level caps: bosses beaten (lifetime) raise every upgrade's max at each capBosses milestone
export const capLevel = (g) => CONFIG.capBosses.filter((b) => (g.bossBest || 0) >= b).length;
const maxAt = (d, n) => { let m = d.max + n * (d.capStep || Math.ceil(d.max * CONFIG.capPct)); if (d.cap !== undefined && d.per) m = Math.min(m, Math.ceil(Math.round(d.cap / d.per * 1e6) / 1e6)); return Math.max(d.max, m); };
export const focusMax = (g, up) => maxAt(CONFIG.focusUp[up], capLevel(g));
export const nextCapFloor = (g) => CONFIG.capBosses[capLevel(g)] || 0;   // the next milestone boss, 0 when all are raised
// The next raise of this upgrade: { floor, max } (some stop early at their effect cap), or null
export function focusNextCap(g, up) {
  const d = CONFIG.focusUp[up], cur = focusMax(g, up);
  for (let n = capLevel(g) + 1; n <= CONFIG.capBosses.length; n++) if (maxAt(d, n) > cur) return { floor: CONFIG.capBosses[n - 1], max: maxAt(d, n) };
  return null;
}
const fl = (g, k) => (g.focusUp && g.focusUp[k]) || 0, flFx = (g, k) => { const d = CONFIG.focusUp[k], v = fl(g, k) * d.per; return d.cap !== undefined ? Math.min(d.cap, v) : v; };   // Focus level and its effect, held to its cap
export const focusOpen = (g, up) => (g.bossBest || 0) >= (CONFIG.focusUp[up].need || 0);   // beaten the boss that unlocks it
export const focusIds = Object.keys(CONFIG.focusUp);
export const keyCap = (g) => CONFIG.keyCap + fl(g, 'ring') * CONFIG.focusUp.ring.per;
const gearMult = (g, slot) => 1 + ((g.gear && g.gear[slot]) ? g.gear[slot].bonus : 0);
const tal = (g, k) => (g.talents && g.talents[k]) || 0;
const talFx = (g, k) => tal(g, k) * CONFIG.talents[k].per;

// ---------- affixes ----------
// Sum of one affix over the three equipped items, capped where the config says so.
export function affixTotal(g, id) {   // Second Breath and Thornmail count like gear
  let t = (setFx(g)[id] || 0) + (id === 'lifesteal' ? flFx(g, 'breath') : id === 'thorns' ? flFx(g, 'thorn') : 0); for (const s of SLOTS) { const it = g.gear && g.gear[s]; if (it) for (const a of it.aff || []) if (a.id === id) t += a.v; }
  const c = CONFIG.affix[id].cap; return c ? Math.min(c, t) : t;
}
export const trainBonus = (g) => affixTotal(g, 'train');
export const affixValue = (id, tier, r) => Math.round(CONFIG.affix[id].base * (1 + CONFIG.tierGrow * (tier - 1)) * (1 - CONFIG.affSpread + 2 * CONFIG.affSpread * r) * 1000) / 1000;
export function rollAffix(tier, have, rng = Math.random) {
  const pool = AFFIXES.filter((id) => !have.some((a) => a.id === id)), id = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return { id, v: affixValue(id, tier, rng()) };
}
// Power score: base bonus plus weighted affixes, in percentage points. Used to compare gear.
export const power = (it) => !it ? 0 : Math.round(((it.bonus || 0) * 100 + (it.aff || []).reduce((p, a) => p + a.v * 100 * CONFIG.affix[a.id].w, 0)) * 10) / 10;
export const baseBonus = (it) => CONFIG.gearPct * it.tier * CONFIG.rarity[it.rarity].mult * (1 + CONFIG.forge.temperPct * (it.lvl || 0));

// ---------- gear sets ----------
// Worn pieces per set (swap: an item tried on over its slot). A set piece has `set` = the move id.
export function setCounts(g, swap = null) {
  const c = {}; for (const s of SLOTS) { const it = swap && swap.slot === s ? swap : g.gear && g.gear[s]; if (it && it.set && CONFIG.sets[it.set]) c[it.set] = (c[it.set] || 0) + 1; }
  return c;
}
const NOFX = Object.freeze({});
// All worn set bonuses added up: { atk, hp, spd, crit, timer, <affix id> }. 2 pieces give `two`, 3 give `two` and `three`.
export function setFx(g, swap = null) {
  const c = setCounts(g, swap), ids = Object.keys(c); if (!ids.length) return NOFX;
  const t = {}, add = (o) => { for (const k in o) t[k] = (t[k] || 0) + o[k]; };
  for (const id of ids) { const d = CONFIG.sets[id]; if (c[id] >= 2) add(d.two); if (c[id] >= 3) add(d.three); }
  return t;
}
// For the Gear section and the compare panel: every set with a worn piece, its count and which bonuses are on.
export const activeSets = (g, swap = null) => { const c = setCounts(g, swap); return Object.keys(c).map((id) => ({ id, name: CONFIG.sets[id].name, n: c[id], two: c[id] >= 2, three: c[id] >= 3 })); };

export function heroStats(g) {
  const L = g.stats, ms = (lv) => Math.pow(CONFIG.milestoneMult, Math.floor(lv / CONFIG.milestoneEvery)), F = setFx(g);
  return {
    atk: (CONFIG.atk.base + CONFIG.atk.per * L.atk) * ms(L.atk) * gearMult(g, 'weapon') * (1 + talFx(g, 'might')) * (1 + (F.atk || 0)) * (1 + flFx(g, 'keen')),
    hp: (CONFIG.hp.base + CONFIG.hp.per * L.hp) * ms(L.hp) * gearMult(g, 'armour') * (1 + talFx(g, 'vigour')) * (1 + (F.hp || 0)) * (1 + flFx(g, 'fortify')),
    spd: Math.min(CONFIG.spd.max, CONFIG.spd.base + CONFIG.spd.per * L.spd) * gearMult(g, 'boots') * (1 + (F.spd || 0)) * (1 + flFx(g, 'hands')),
    crit: Math.min(CONFIG.critMax, CONFIG.precisionPer * (g.focusUp.precision || 0) + (F.crit || 0)), critMult: CONFIG.critMult + affixTotal(g, 'critdmg') + flFx(g, 'overkill')
  };
}
export const isBoss = (n) => n % CONFIG.bossEvery === 0;
export function enemy(n) {
  const b = isBoss(n), el = isElite(n);
  return { floor: n, boss: b, elite: el, hp: CONFIG.enemyHp * Math.pow(CONFIG.enemyHpGrow, n - 1) * (b ? CONFIG.bossHp : 1) * (el ? CONFIG.eliteHp : 1), atk: CONFIG.enemyAtk * Math.pow(CONFIG.enemyAtkGrow, n - 1) * (b ? CONFIG.bossAtk : 1) * (el ? CONFIG.eliteAtk : 1) };
}
export const bossTimer = (g) => (CONFIG.bossTimer + talFx(g, 'wind') + flFx(g, 'dilation')) * (1 + (setFx(g).timer || 0));
// Closed form fight. Grit is temporary attack from failed tries on the current floor (capped). A boss also needs killing inside the boss timer.
// Affixes and zone traits fold into two numbers: dps (damage to the enemy per second, net of armour and regen) and net (damage to the hero per second, net of Lifesteal).
export function fight(g, n) {
  const h = heroStats(g), e = enemy(n), tr = traitsOf(n), T = CONFIG.trait, has = (t) => tr.includes(t), A = (id) => affixTotal(g, id), timer = bossTimer(g);
  const spd = h.spd * Math.max(0.25, 1 + A('swift') - (has('chill') ? T.chill : 0));
  let hit = h.atk * (1 + (g.grit || 0)) * (1 + (e.boss ? A('boss') + flFx(g, 'warlord') : 0)) * (1 + (tr.length ? A('ward') : 0));
  hit *= 1 + Math.min(1, h.crit) * (h.critMult - 1);   // average hit, crits included
  if (has('armour')) hit = Math.max(hit * T.armourMin, hit - T.armour * e.hp);
  const edps = e.atk * (has('swift') ? T.swiftHits : 1) * (has('arcane') ? 1 + T.arcane : 1) * Math.max(CONFIG.dmgMin, (1 - Math.min(A('guard'), CONFIG.affix.guard.cap)) * (1 - flFx(g, 'iron'))) + (has('burn') ? T.burn * e.atk : 0);
  const dealt = hit * spd, dps = dealt + A('thorns') * edps - (has('regen') ? T.regen * e.hp : 0);   // thorns: reflected damage also hurts the enemy
  const net = edps - A('lifesteal') * dealt;
  const t = dps > 0 ? e.hp / dps : Infinity;
  const live = net <= 0 || net * t < h.hp, late = e.boss && t > timer;
  return { win: live && !late && isFinite(t), late: live && late, t, dps, hero: h, enemy: e, edps, net, timer, tDie: net > 0 ? h.hp / net : Infinity, walk: CONFIG.walk / h.spd, traits: tr };
}

export function buyStat(g, stat) {
  if (!(stat in g.stats)) return false;
  const c = statCost(stat, g.stats[stat]);
  if (g.sweat < c) return false;
  g.sweat -= c; g.stats[stat]++; return true;
}
export function buyFocus(g, up) {
  const def = CONFIG.focusUp[up]; if (!def) return false;
  const lv = g.focusUp[up];
  if (lv >= focusMax(g, up) || !focusOpen(g, up)) return false;
  const c = focusCost(up, lv);
  if (g.focus < c) return false;
  g.focus -= c; g.focusUp[up]++; return true;
}

// ---------- gear ----------
// opts.slot: fixed slot (no dice for it). opts.min: lowest rarity ('rare' for chests and set pieces).
export function rollDrop(g, floor, rng = Math.random, opts = {}) {
  const slot = opts.slot || SLOTS[Math.min(2, Math.floor(rng() * 3))];
  const tier = Math.ceil(floor / CONFIG.bossEvery) + (opts.up ? 1 : 0);   // opts.up: Treasure Sense, one tier higher
  const shift = CONFIG.luckPer * (g.focusUp.luck || 0) + talFx(g, 'fortune'), r = rng();
  const epicP = Math.min(CONFIG.epicMax, CONFIG.rarity.epic.p + shift), rareP = CONFIG.rarity.rare.p;
  let rarity = r < epicP ? 'epic' : r < epicP + rareP ? 'rare' : 'common';
  if (opts.min && RARITIES.indexOf(rarity) < RARITIES.indexOf(opts.min)) rarity = opts.min;
  const aff = []; for (let i = 0; i < CONFIG.maxAffix[rarity]; i++) aff.push(rollAffix(tier, aff, rng));
  return { slot, tier, rarity, bonus: CONFIG.gearPct * tier * CONFIG.rarity[rarity].mult, floor, lvl: 0, aff, lock: false, added: false, look: lookOf({ slot, tier, rarity }) };
}
export const stashMax = (g) => CONFIG.stash + talFx(g, 'hoarder');
const scrapOf = (it) => CONFIG.scrapPer * it.tier;
const own = (it) => ({ ...(it.set ? { set: it.set } : {}), slot: it.slot, tier: it.tier, rarity: it.rarity, bonus: it.bonus, floor: it.floor, id: it.id, look: it.look || lookOf(it), lvl: it.lvl || 0, aff: (it.aff || []).map((a) => ({ ...a })), lock: !!it.lock, added: !!it.added });
// Puts an item in the stash. Over the limit, the oldest unlocked item is scrapped for Sweat (the new one itself if everything is locked). Returns Sweat scrapped.
function stow(g, it) {
  g.stash.push(it); let scrap = 0;
  while (g.stash.length > stashMax(g)) {
    let i = g.stash.findIndex((x) => !x.lock && !x.set); if (i < 0) i = g.stash.findIndex((x) => !x.lock); if (i < 0) break;   // set pieces go last
    scrap += scrapOf(g.stash[i]); g.stash.splice(i, 1);
  }
  g.sweat += scrap; return scrap;
}
// A better power score replaces the equipped item unless that one is locked. The loser goes to the stash.
export function giveDrop(g, item) {
  const cur = g.gear[item.slot], it = own(item); it.id = ++g.seq;
  const better = !cur || (!cur.lock && power(it) > power(cur));
  let scrap = 0;
  if (better) { g.gear[it.slot] = it; if (cur) scrap = stow(g, cur); } else scrap = stow(g, it);
  const rec = { ...own(it), equipped: better, scrap, at: Date.now() }; delete rec.id;   // at: when it dropped, for the monthly recap
  g.drops.push(rec); if (g.drops.length > CONFIG.dropLog) g.drops.splice(0, g.drops.length - CONFIG.dropLog);
  return { ...rec, id: it.id };   // the log keeps no id, the caller gets it (the loot card equips by it)
}
// A set piece for a level-up of `moveId`: one random missing piece at the current tier (rare or better). With all 3 owned the duplicate upgrades the weakest piece:
// its tier up to the current one (affixes scale with it), else +1 temper level. Returns { kind: 'piece' | 'upgrade', ...item record }.
export const tierNow = (g) => Math.max(1, Math.ceil(g.floor / CONFIG.bossEvery));
export const setPieces = (g, id) => [...SLOTS.map((s) => g.gear[s]), ...g.stash].filter((it) => it && it.set === id);
export function giveSetPiece(g, id, rng = Math.random) {
  if (!CONFIG.sets[id]) return null;
  const have = setPieces(g, id), missing = SLOTS.filter((s) => !have.some((it) => it.slot === s));
  if (missing.length) {
    const it = rollDrop(g, g.floor, rng, { slot: missing[Math.min(missing.length - 1, Math.floor(rng() * missing.length))], min: 'rare' }); it.set = id;
    const out = { kind: 'piece', ...giveDrop(g, it) };
    if (missing.length === 1) { const ym = monthOf(); g.setLog = g.setLog || {}; (g.setLog[ym] = g.setLog[ym] || []).push(id); }   // the third piece completes the set
    return out;
  }
  const it = have.slice().sort((a, b) => a.tier - b.tier || (a.lvl || 0) - (b.lvl || 0) || a.id - b.id)[0], t = tierNow(g), grow = (n) => 1 + CONFIG.tierGrow * (n - 1);
  if (it.tier < t) { for (const a of it.aff) a.v = Math.round(a.v * grow(t) / grow(it.tier) * 1000) / 1000; it.tier = t; } else it.lvl = (it.lvl || 0) + 1;
  it.bonus = baseBonus(it); it.look = lookOf(it);
  return { kind: 'upgrade', ...own(it), id: it.id, equipped: g.gear[it.slot] === it, scrap: 0 };
}
// Every item you own, equipped first. slot is 'all' or one of SLOTS. sort: 'power' (best first), 'rarity' (epic first, then power), 'newest' (highest id first).
export function inventory(g, slot = 'all', sort = 'power') {
  const rk = { epic: 3, rare: 2, common: 1 }, all = SLOTS.map((s) => g.gear[s]).filter(Boolean).map((it) => ({ it, equipped: true })).concat(g.stash.map((it) => ({ it, equipped: false })));
  const by = { power: (a, b) => power(b.it) - power(a.it), rarity: (a, b) => rk[b.it.rarity] - rk[a.it.rarity] || power(b.it) - power(a.it), newest: (a, b) => b.it.id - a.it.id }[sort] || ((a, b) => power(b.it) - power(a.it));
  return all.filter((x) => slot === 'all' || x.it.slot === slot).sort((a, b) => by(a, b) || b.it.id - a.it.id);
}
// What wearing `it` would change against what is equipped in its slot: power, and the slot's stat (Attack, Health or Speed) before and after.
export function compareItem(g, it) {
  const cur = g.gear[it.slot], stat = SLOT_STAT[it.slot], before = heroStats(g)[stat], after = heroStats({ ...g, gear: { ...g.gear, [it.slot]: it } })[stat];
  const r = (v) => Math.round(v * 10) / 10;
  const same = !!cur && cur.id === it.id, c0 = setCounts(g), c1 = setCounts(g, it), sets = same ? [] : [...new Set([it.set, cur && cur.set].filter(Boolean))].map((id) => ({ id, name: CONFIG.sets[id].name, from: c0[id] || 0, to: c1[id] || 0 })).filter((x) => x.from !== x.to);   // sets: the count change this swap makes
  return { cur, same, stat, power: power(it), dPower: r(power(it) - power(cur)), before, after, dStat: after - before, sets };
}
export const findItem = (g, id) => SLOTS.map((s) => g.gear[s]).concat(g.stash).find((it) => it && it.id === id) || null;
export function toggleLock(g, id) { const it = findItem(g, id); if (!it) return false; it.lock = !it.lock; return true; }
// Swap a stashed item with the equipped one in its slot. Refused while the equipped item is locked.
export function equip(g, id) {
  const i = g.stash.findIndex((x) => x.id === id); if (i < 0) return false;
  const it = g.stash[i], cur = g.gear[it.slot]; if (cur && cur.lock) return false;
  g.stash.splice(i, 1, ...(cur ? [cur] : [])); g.gear[it.slot] = it; return true;
}

// ---------- forge (Focus) ----------
export const FORGE = ['reroll', 'add', 'upgrade', 'temper'];
export function forgeCost(g, action, it) {
  const F = CONFIG.forge, c = F[action]; if (!c || !it) return 0;
  return Math.ceil(c * Math.pow(F.tierGrow, it.tier) * (action === 'temper' ? Math.pow(F.temperGrow, it.lvl || 0) : 1) * (1 - talFx(g, 'ancestral')) * (1 - flFx(g, 'mastery')));
}
// Why an action is not possible on an item ('' when it is). Cost is checked separately.
export function forgeBlock(it, action, i = 0) {
  if (!it) return 'No item';
  const max = CONFIG.maxAffix[it.rarity];
  if (action === 'reroll') return it.aff[i] ? '' : 'No such affix';
  if (action === 'add') return it.added ? 'Already added one' : it.aff.length >= max + 1 ? 'Full' : '';
  if (action === 'upgrade') return it.rarity === 'epic' ? 'Already epic' : '';
  return action === 'temper' ? '' : 'Unknown action';
}
// Spend Focus on the equipped item of a slot. i is the affix to reroll. Returns true if it worked.
// `item` forges a stashed item instead (the inventory does this); stats only change if it is equipped.
export function forge(g, slot, action, i = 0, rng = Math.random, item = null) {
  const it = item || g.gear[slot]; if (forgeBlock(it, action, i)) return false;
  const c = forgeCost(g, action, it); if (g.focus < c) return false;
  g.focus -= c;
  if (action === 'reroll') { const rest = it.aff.filter((_, k) => k !== i); it.aff[i] = rollAffix(it.tier, rest, rng); }
  else if (action === 'add') { it.aff.push(rollAffix(it.tier, it.aff, rng)); it.added = true; }
  else if (action === 'upgrade') { it.rarity = RARITIES[RARITIES.indexOf(it.rarity) + 1]; it.aff.push(rollAffix(it.tier, it.aff, rng)); it.bonus = baseBonus(it); it.look = lookOf(it); }
  else { it.lvl = (it.lvl || 0) + 1; it.bonus = baseBonus(it); }
  return true;
}

// ---------- soul tree ----------
export const soulsLeft = (g) => Math.max(0, g.souls - g.soulsSpent);
export const talentCost = (k, lv) => Math.ceil(CONFIG.talents[k].cost * Math.pow(CONFIG.talents[k].grow, lv));
export function buyTalent(g, k) {
  const d = CONFIG.talents[k]; if (!d || g.talents[k] >= d.max) return false;
  const c = talentCost(k, g.talents[k]); if (soulsLeft(g) < c) return false;
  g.soulsSpent += c; g.talents[k]++; return true;
}
export const canRespec = (g) => !g.respecUsed && g.soulsSpent > 0;
export function respec(g) { if (!canRespec(g)) return false; for (const k of TALENTS) g.talents[k] = 0; g.soulsSpent = 0; g.respecUsed = true; return true; }

// ---------- the climb ----------
// Boss Keys. The hero waits at a boss door with no key (and no key already spent on this boss). fightFloor: the boss floor the live fight can play now (this floor or the next 2) when a key is held or already spent, else 0.
export const atDoor = (g) => isBoss(g.floor) && g.keyFor !== g.floor && g.keys <= 0;
export const fightFloor = (g) => { const b = Math.ceil(g.floor / CONFIG.bossEvery) * CONFIG.bossEvery; return b - g.floor <= CONFIG.fightAhead && (g.keys > 0 || g.keyFor === b) ? b : 0; };
const bossDrop = (g, n, rng) => { const up = fl(g, 'sense') > 0 && rng() < flFx(g, 'sense'); return giveDrop(g, rollDrop(g, n, rng, up ? { up } : {})); };   // Treasure Sense: maybe a tier higher
// Runs the sim floor by floor for `seconds`. g.prog holds time already spent on the current attempt. opts.stopAt: stop on reaching that floor, leaving the rest of the time unspent.
// A boss floor takes a key on the first try. Retries of the same boss are free (g.keyFor). With no key the hero waits: no tries, no grit, time just passes (g.waiting).
export function advance(g, seconds, rng = Math.random, opts = {}) {
  const sum = { floors: 0, bosses: 0, drops: [], unlocked: [], capsUp: false }, stop = opts.stopAt || Infinity;
  let left = Math.max(0, seconds || 0), guard = CONFIG.maxIter;
  while (left > 1e-9 && guard-- > 0) {
    if (g.floor >= stop) break;
    if (isBoss(g.floor) && g.keyFor !== g.floor) { if (g.keys <= 0) { g.prog = 0; break; } g.keys--; g.keyFor = g.floor; }
    const n = g.floor, f = fight(g, n), dur = f.win ? f.t + f.walk : CONFIG.rest;
    const need = Math.max(0, dur - g.prog);
    if (left < need) { g.prog += left; break; }
    left -= need; g.prog = 0;
    if (!f.win) { g.grit = Math.min(CONFIG.gritMax, (1 + g.grit) * (1 + CONFIG.gritStep) - 1); continue; }   // grit compounds, to the cap
    g.grit = 0; g.keyFor = 0; sum.floors++;
    if (f.enemy.boss) {
      sum.bosses++; sum.drops.push(bossDrop(g, n, rng));
      if (fl(g, 'echo') > 0 && rng() < flFx(g, 'echo')) sum.drops.push(bossDrop(g, n, rng));   // Echo: a second item
      if (n > g.bossBest) { const c0 = capLevel(g); for (const k of focusIds) { const d = CONFIG.focusUp[k].need || 0; if (d > g.bossBest && d <= n) sum.unlocked.push(k); } g.bossBest = n; if (capLevel(g) > c0) sum.capsUp = true; }   // a new record: ids it unlocks, and whether it crossed a cap milestone
    }
    g.floor = n + 1; g.runMax = Math.max(g.runMax, g.floor); g.bestFloor = Math.max(g.bestFloor, g.floor);
  }
  g.waiting = atDoor(g);
  return sum;
}
// The live boss fight: climb to the door with the time away (stopping there), so the fight itself can play on screen. False if the hero cannot get that far yet.
export function readyBoss(state, floor, now = Date.now(), rng = Math.random) {
  const g = ensureGame(state), el = g.lastTick ? Math.max(0, Math.min((now - g.lastTick) / 1000, offlineCapSec())) : 0;
  advance(g, el, rng, { stopAt: floor }); g.lastTick = +now; g.away = null;
  return g.floor === floor;
}

export const offlineCapSec = () => Math.min(CONFIG.offlineMaxH, CONFIG.offlineBaseH) * 3600;

// Simulate time away (up to the cap), set the "while you were away" summary, move lastTick to now.
export function offlineCatchUp(state, now = Date.now(), rng = Math.random) {
  const g = ensureGame(state), t = +now;
  const el = (t - g.lastTick) / 1000;
  if (!g.lastTick || el <= 0) { g.lastTick = t; return null; }
  const cap = offlineCapSec(g), secs = Math.min(el, cap);
  const sum = advance(g, secs, rng);
  g.lastTick = t;
  const newDoor = g.waiting && g.doorNoted !== g.floor; if (g.waiting) g.doorNoted = g.floor;   // the door note shows once per door; the line under the battle keeps saying it
  if (secs < 60 || (!sum.floors && !sum.bosses && !newDoor)) return null;
  const rank = { epic: 3, rare: 2, common: 1 };
  const best = sum.drops.slice().sort((a, b) => rank[b.rarity] - rank[a.rarity] || power(b) - power(a))[0] || null;
  g.away = { seconds: Math.round(secs), capped: el > cap, floors: sum.floors, bosses: sum.bosses, best: best && { slot: best.slot, tier: best.tier, rarity: best.rarity, bonus: best.bonus, power: power(best), equipped: best.equipped }, to: g.floor, waiting: g.waiting, unlocked: sum.unlocked, capsUp: sum.capsUp };
  return g.away;
}

export function canAscend(g) { return g.tokens >= 1 && g.runMax >= CONFIG.ascendMinFloor; }
export const soulsFor = (g) => Math.floor(Math.sqrt(g.runMax)) + flFx(g, 'ascendant');
export const headStart = (g, from = g.runMax) => Math.max(1, Math.min(1 + talFx(g, 'head'), from - 1));   // never past the floor you reached, less one
export function ascend(g) {
  if (!canAscend(g)) return null;
  const gain = soulsFor(g), start = headStart(g);
  g.souls += gain; g.tokens -= 1; g.floor = start; g.runMax = start; g.grit = 0; g.prog = 0; g.keyFor = 0; g.waiting = false; g.respecUsed = false;
  let keep = null;   // the single best item stays equipped, and so do locked ones
  for (const s of SLOTS) if (g.gear[s] && (!keep || power(g.gear[s]) > power(g.gear[keep]))) keep = s;
  for (const s of SLOTS) if (s !== keep && !(g.gear[s] && (g.gear[s].lock || g.gear[s].set))) g.gear[s] = null;   // set pieces stay too: they came from real level-ups
  for (const it of g.stash) if (!it.lock && !it.set) g.sweat += scrapOf(it);   // unlocked stash items are scrapped; locked ones and set pieces stay
  g.stash = g.stash.filter((it) => it.lock || it.set);
  return gain;
}
