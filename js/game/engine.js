// Tower engine: pure logic, no DOM. Mutates the game object it is given (state.game). Spec: docs/TOWER.md
import { computeStreak, trainingDates } from '../logic.js';

export const CONFIG = {
  sessionSweat: 100, minimumSweat: 40, streakStep: 0.05, streakCap: 10, dailyLimit: 2, secondHalf: 0.5,
  levelUpSweat: 300, pbSweat: 100,
  focusBase: 30, focusPerHour: 5, focusCap: 80,
  atk: { base: 5, per: 2, cost: 20, grow: 1.04 }, hp: { base: 50, per: 15, cost: 20, grow: 1.04 },
  spd: { base: 1, per: 0.04, max: 3, cost: 25, grow: 1.05 },
  milestoneEvery: 10, milestoneMult: 1.5,   // every 10 levels of Attack or Health multiplies that stat (idle-game milestone), so late floors keep falling
  soulBonus: 0.10, critDouble: 2,
  enemyHp: 20, enemyHpGrow: 1.075, enemyAtk: 2, enemyAtkGrow: 1.075, bossEvery: 10, bossHp: 1.2, bossAtk: 1,
  walk: 2, rest: 10, gritStep: 0.0007, gritMax: 0.25, bossTimer: 30, maxIter: 20000,   // grit compounds per failed try (10 s each) and hits the +25% cap in about 53 min. Boss enrage: not dead by bossTimer seconds is a loss. See tools/tower-sim.mjs
  offlineBaseH: 24, offlineMaxH: 24, staminaPer: 0.10,   // 'endurance' is the save key for Stamina: +10% Sweat from sessions per level
  focusUp: {
    endurance: { max: 5, cost: 30, grow: 1.4 }, precision: { max: 20, cost: 30, grow: 1.25 }, luck: { max: 10, cost: 40, grow: 1.3 }
  },
  precisionPer: 0.02, luckPer: 0.02,
  rarity: { common: { mult: 1, p: 0.70 }, rare: { mult: 1.5, p: 0.25 }, epic: { mult: 2.2, p: 0.05 } },
  gearPct: 0.05, scrapPer: 5, dropLog: 5,
  ascendMinFloor: 20
};
export const SLOTS = ['weapon', 'armour', 'boots'];
export const SLOT_STAT = { weapon: 'atk', armour: 'hp', boots: 'spd' };
export const RARITIES = ['common', 'rare', 'epic'];

export function ensureGame(state) {
  const g = state.game && typeof state.game === 'object' ? state.game : (state.game = {});
  const num = (k, v) => { if (!Number.isFinite(g[k])) g[k] = v; };
  for (const k of ['sweat', 'focus', 'souls', 'tokens', 'grit', 'prog', 'lastTick']) num(k, 0);
  for (const k of ['floor', 'runMax', 'bestFloor']) num(k, 1);
  const obj = (k, d) => { if (!g[k] || typeof g[k] !== 'object' || Array.isArray(g[k])) g[k] = d; };
  obj('stats', {}); obj('focusUp', {}); obj('gear', {}); obj('paid', {});
  for (const k of ['atk', 'hp', 'spd']) num2(g.stats, k);
  for (const k of Object.keys(CONFIG.focusUp)) { num2(g.focusUp, k); g.focusUp[k] = Math.min(g.focusUp[k], CONFIG.focusUp[k].max); }
  for (const s of SLOTS) if (g.gear[s] === undefined) g.gear[s] = null;
  if (!Array.isArray(g.drops)) g.drops = [];
  if (g.away === undefined) g.away = null;
  return g;
}
function num2(o, k) { if (!Number.isFinite(o[k])) o[k] = 0; }

// ---------- rewards ----------
export const streakMult = (streak) => 1 + CONFIG.streakStep * Math.min(streak, CONFIG.streakCap);
export const focusForFast = (hours, minH) => hours >= minH ? Math.min(CONFIG.focusCap, CONFIG.focusBase + CONFIG.focusPerHour * Math.floor(hours - minH + 1e-9)) : 0;

// Pays every session, event and fast not yet in game.paid. Safe to call any number of times.
export function syncRewards(state, now = Date.now()) {
  const g = ensureGame(state), out = { sweat: 0, focus: 0, tokens: 0, items: 0 }, stam = 1 + CONFIG.staminaPer * (g.focusUp.endurance || 0);
  const sessions = (state.sessions || []).map((s, i) => ({ s, i })).sort((a, b) => (a.s.date || '').localeCompare(b.s.date || '') || String(a.s.startedAt || '').localeCompare(String(b.s.startedAt || '')) || a.i - b.i);
  const dates = trainingDates(state), streakAt = new Map(), seen = new Map();
  for (const { s } of sessions) {
    const nth = seen.get(s.date) || 0; seen.set(s.date, nth + 1);
    const key = 's:' + s.id;
    if (g.paid[key] !== undefined) continue;
    if (!streakAt.has(s.date)) streakAt.set(s.date, computeStreak(dates.filter((d) => d <= s.date), s.date).current);
    let amt = (s.minimum ? CONFIG.minimumSweat : CONFIG.sessionSweat) * streakMult(streakAt.get(s.date));
    amt = nth === 0 ? amt : nth < CONFIG.dailyLimit ? amt * CONFIG.secondHalf : 0;
    amt = Math.round(amt * stam); g.paid[key] = amt; g.sweat += amt; out.sweat += amt; out.items++;
  }
  for (const e of state.events || []) {
    const key = 'e:' + e.id;
    if (g.paid[key] !== undefined || (e.type !== 'levelUp' && e.type !== 'pb')) continue;
    const amt = e.type === 'levelUp' ? CONFIG.levelUpSweat : CONFIG.pbSweat;
    g.paid[key] = amt; g.sweat += amt; out.sweat += amt; out.items++;
    if (e.type === 'levelUp') { g.tokens++; out.tokens++; }
  }
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
export const focusMax = (up) => CONFIG.focusUp[up].max;
const gearMult = (g, slot) => 1 + ((g.gear && g.gear[slot]) ? g.gear[slot].bonus : 0);

export function heroStats(g) {
  const L = g.stats, souls = 1 + CONFIG.soulBonus * (g.souls || 0), ms = (lv) => Math.pow(CONFIG.milestoneMult, Math.floor(lv / CONFIG.milestoneEvery));
  return {
    atk: (CONFIG.atk.base + CONFIG.atk.per * L.atk) * ms(L.atk) * gearMult(g, 'weapon') * souls,
    hp: (CONFIG.hp.base + CONFIG.hp.per * L.hp) * ms(L.hp) * gearMult(g, 'armour') * souls,
    spd: Math.min(CONFIG.spd.max, CONFIG.spd.base + CONFIG.spd.per * L.spd) * gearMult(g, 'boots'),
    crit: CONFIG.precisionPer * (g.focusUp.precision || 0)
  };
}
export const isBoss = (n) => n % CONFIG.bossEvery === 0;
export function enemy(n) {
  const b = isBoss(n);
  return { floor: n, boss: b, hp: CONFIG.enemyHp * Math.pow(CONFIG.enemyHpGrow, n - 1) * (b ? CONFIG.bossHp : 1), atk: CONFIG.enemyAtk * Math.pow(CONFIG.enemyAtkGrow, n - 1) * (b ? CONFIG.bossAtk : 1) };
}
// Closed form fight. Grit is temporary attack from failed tries on the current floor (capped). A boss also needs killing inside bossTimer.
export function fight(g, n) {
  const h = heroStats(g), e = enemy(n);
  const dps = h.atk * (1 + (g.grit || 0)) * h.spd * (1 + h.crit);
  const t = e.hp / dps;
  const live = e.atk * t < h.hp, late = e.boss && t > CONFIG.bossTimer;
  return { win: live && !late, late: live && late, t, dps, hero: h, enemy: e, tDie: h.hp / e.atk, walk: CONFIG.walk / h.spd };
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
  if (lv >= def.max) return false;
  const c = focusCost(up, lv);
  if (g.focus < c) return false;
  g.focus -= c; g.focusUp[up]++; return true;
}

// ---------- gear ----------
export function rollDrop(g, floor, rng = Math.random) {
  const slot = SLOTS[Math.min(2, Math.floor(rng() * 3))];
  const tier = Math.ceil(floor / CONFIG.bossEvery);
  const shift = CONFIG.luckPer * (g.focusUp.luck || 0), r = rng();
  const epicP = CONFIG.rarity.epic.p + shift, rareP = CONFIG.rarity.rare.p;
  const rarity = r < epicP ? 'epic' : r < epicP + rareP ? 'rare' : 'common';
  return { slot, tier, rarity, bonus: CONFIG.gearPct * tier * CONFIG.rarity[rarity].mult, floor };
}
export function giveDrop(g, item) {
  const cur = g.gear[item.slot];
  const better = !cur || item.bonus > cur.bonus;
  const rec = { ...item, equipped: better, scrap: better ? 0 : CONFIG.scrapPer * item.tier };
  if (better) g.gear[item.slot] = { slot: item.slot, tier: item.tier, rarity: item.rarity, bonus: item.bonus };
  else g.sweat += rec.scrap;
  g.drops.push(rec); if (g.drops.length > CONFIG.dropLog) g.drops.splice(0, g.drops.length - CONFIG.dropLog);
  return rec;
}

// ---------- the climb ----------
// Runs the sim floor by floor for `seconds`. g.prog holds time already spent on the current attempt.
export function advance(g, seconds, rng = Math.random) {
  const sum = { floors: 0, bosses: 0, drops: [] };
  let left = Math.max(0, seconds || 0), guard = CONFIG.maxIter;
  while (left > 1e-9 && guard-- > 0) {
    const n = g.floor, f = fight(g, n), dur = f.win ? f.t + f.walk : CONFIG.rest;
    const need = Math.max(0, dur - g.prog);
    if (left < need) { g.prog += left; break; }
    left -= need; g.prog = 0;
    if (!f.win) { g.grit = Math.min(CONFIG.gritMax, (1 + g.grit) * (1 + CONFIG.gritStep) - 1); continue; }   // grit compounds, to the cap
    g.grit = 0; sum.floors++;
    if (f.enemy.boss) { sum.bosses++; sum.drops.push(giveDrop(g, rollDrop(g, n, rng))); }
    g.floor = n + 1; g.runMax = Math.max(g.runMax, g.floor); g.bestFloor = Math.max(g.bestFloor, g.floor);
  }
  return sum;
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
  if (secs < 60 || (!sum.floors && !sum.bosses)) return null;
  const rank = { epic: 3, rare: 2, common: 1 };
  const best = sum.drops.slice().sort((a, b) => rank[b.rarity] - rank[a.rarity] || b.bonus - a.bonus)[0] || null;
  g.away = { seconds: Math.round(secs), capped: el > cap, floors: sum.floors, bosses: sum.bosses, best: best && { slot: best.slot, tier: best.tier, rarity: best.rarity, bonus: best.bonus, equipped: best.equipped }, to: g.floor };
  return g.away;
}

export function canAscend(g) { return g.tokens >= 1 && g.runMax >= CONFIG.ascendMinFloor; }
export const soulsFor = (g) => Math.floor(Math.sqrt(g.runMax));
export function ascend(g) {
  if (!canAscend(g)) return null;
  const gain = soulsFor(g);
  g.souls += gain; g.tokens -= 1; g.floor = 1; g.runMax = 1; g.grit = 0; g.prog = 0;
  let keep = null;   // the single best item stays equipped
  for (const s of SLOTS) if (g.gear[s] && (!keep || g.gear[s].bonus > g.gear[keep].bonus)) keep = s;
  for (const s of SLOTS) if (s !== keep) g.gear[s] = null;
  return gain;
}
