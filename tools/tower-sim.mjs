// Pacing check: a daily trainer (1 full session a day, greedy buying, 60 Focus a day from fasting spent on the forge, a level-up every LEVELUP days) against a player who never trains. 24h away each day. Run: node tools/tower-sim.mjs [days]
// Boss Keys: the trainer earns them from sessions and level-ups through syncRewards. The non-trainer only has the welcome keys, so they are stuck at the first boss door they cannot afford a key for.
import { defaultState, addDays } from '../js/logic.js';
import { ensureGame, syncRewards, offlineCatchUp, buyStat, statCost, fight, forge, forgeCost, forgeBlock, FORGE, SLOTS, CONFIG } from '../js/game/engine.js';

const days = +process.argv[2] || 60, FOCUS_PER_DAY = process.env.FOCUS !== undefined ? +process.env.FOCUS : 60, LEVELUP = process.env.LEVELUP !== undefined ? +process.env.LEVELUP : 10;   // LEVELUP: days between level-ups, 0 for none
if (process.env.CFG) for (const [k, v] of Object.entries(JSON.parse(process.env.CFG))) { if (v && typeof v === 'object') Object.assign(CONFIG[k], v); else CONFIG[k] = v; }   // quick tuning experiments
function sim(trains) {
  let seed = 12345; const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const state = defaultState(new Date(2026, 0, 1)), g = ensureGame(state);
  if (!trains) g.keys = CONFIG.welcomeKeys;   // an old save's history grant, nothing more
  let spent = 0, fspent = 0, lastFloor = 1, still = 0, maxStill = 0, idle = 0, max30 = 0, maxTrain = 0; const rows = [];
  // the weakest margin (survival or boss timer) a few floors ahead. Buyers go for the best gain in it per cost.
  const margin = (gm, n) => { const f = fight({ ...gm, grit: 0 }, n); if (!isFinite(f.t)) return 1e-3 * Math.exp(5 * f.dps / f.enemy.hp); return Math.min(f.net > 0 ? f.hero.hp / (f.net * f.t) : Infinity, f.enemy.boss ? f.timer / f.t : Infinity); };
  for (let d = 0; d < days; d++) {
    const date = addDays('2026-01-01', d), [y, m, dd] = date.split('-').map(Number), now = new Date(y, m - 1, dd, 7, 0).getTime();
    if (trains) { state.sessions.push({ id: 's' + d, date, startedAt: new Date(now).toISOString(), minimum: false, sets: [] }); g.focus += FOCUS_PER_DAY; if (LEVELUP && d > 0 && d % LEVELUP === 0) state.events.push({ id: 'e' + d, type: 'levelUp', at: new Date(now).toISOString() }); }
    if (!g.lastTick) g.lastTick = now;
    offlineCatchUp(state, now, rng);   // the 24h since the last visit
    if (trains) syncRewards(state, now);
    for (;;) {
      const n = g.floor + 3, base = margin(g, n), opts = [];
      for (const k of ['atk', 'hp', 'spd']) {
        if (k === 'spd' && CONFIG.spd.base + CONFIG.spd.per * g.stats.spd >= CONFIG.spd.max) continue;
        const c = statCost(k, g.stats[k]); if (c <= g.sweat) opts.push([Math.log(margin({ ...g, stats: { ...g.stats, [k]: g.stats[k] + 1 } }, n) / base) / c, () => { spent += c; buyStat(g, k); }]);
      }
      if (trains) for (const s of SLOTS) { const it = g.gear[s]; if (!it) continue;
        for (const a of FORGE) for (let i = 0; i < (a === 'reroll' ? it.aff.length : 1); i++) {
          const c = forgeCost(g, a, it); if (c > g.focus || forgeBlock(it, a, i)) continue;
          const s0 = seed, c2 = structuredClone(g); forge(c2, s, a, i, rng); seed = s0;   // try it on a copy with the same dice
          opts.push([Math.log(margin(c2, n) / base) / c, () => { fspent += c; forge(g, s, a, i, rng); }]);
        } }
      opts.sort((x, y) => y[0] - x[0]);
      if (!opts.length || !(opts[0][0] > 1e-9)) break;
      opts[0][1]();
    }
    if (g.floor === lastFloor) { still++; idle++; maxStill = Math.max(maxStill, still); if (d < 30) max30 = maxStill; } else still = 0;
    lastFloor = g.floor;
    rows.push([d + 1, g.floor, spent, fspent, `${g.stats.atk}/${g.stats.hp}/${g.stats.spd}`, idle, g.keys + (g.waiting ? ' door' : '')]);
  }
  if (process.env.GEAR && trains) for (const s of SLOTS) console.log(s, JSON.stringify(g.gear[s]));
  return { rows, maxStill, max30 };
}
for (const [name, trains] of [['TRAINER (1 session a day, ' + FOCUS_PER_DAY + ' Focus a day)', true], ['NON-TRAINER (never earns)', false]]) {
  const { rows, maxStill, max30 } = sim(trains);
  console.log(`\n${name}\nday floor sweatSpent focusSpent atk/hp/spd daysNoNewFloorSoFar keys`);
  for (const r of rows) if (process.env.ALL || r[0] <= 10 || r[0] % 5 === 0 || r[0] === 7) console.log(r.join('\t'));
  console.log('max consecutive days without a new floor: first 30 days', max30, ', all', maxStill);
}
