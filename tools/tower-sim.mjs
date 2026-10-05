// Pacing check: a daily trainer (1 full session a day, greedy stat buying) against a player who never trains. 24h away each day. Run: node tools/tower-sim.mjs [days]
import { defaultState, addDays } from '../js/logic.js';
import { ensureGame, syncRewards, offlineCatchUp, buyStat, statCost, fight, CONFIG } from '../js/game/engine.js';

const days = +process.argv[2] || 60;
if (process.env.CFG) Object.assign(CONFIG, JSON.parse(process.env.CFG));   // quick tuning experiments
function sim(trains) {
  let seed = 12345; const rng = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const state = defaultState(new Date(2026, 0, 1)), g = ensureGame(state);
  let spent = 0, lastFloor = 1, still = 0, maxStill = 0, idle = 0, max30 = 0; const rows = [];
  for (let d = 0; d < days; d++) {
    const date = addDays('2026-01-01', d), [y, m, dd] = date.split('-').map(Number), now = new Date(y, m - 1, dd, 7, 0).getTime();
    if (trains) state.sessions.push({ id: 's' + d, date, startedAt: new Date(now).toISOString(), minimum: false, sets: [] });
    if (!g.lastTick) g.lastTick = now;
    offlineCatchUp(state, now, rng);   // the 24h since the last visit
    if (trains) syncRewards(state, now);
    for (;;) {   // a sensible buyer: best gain in the weakest margin (survival or boss timer) a few floors ahead, per Sweat. Speed stops at its cap.
      const n = g.floor + 3, margin = (st) => { const f = fight({ ...g, stats: st, grit: 0 }, n); return Math.min(f.hero.hp / (f.enemy.atk * f.t), f.enemy.boss ? CONFIG.bossTimer / f.t : Infinity); };
      const base = margin(g.stats), opts = ['atk', 'hp', 'spd'].filter((k) => k !== 'spd' || CONFIG.spd.base + CONFIG.spd.per * g.stats.spd < CONFIG.spd.max).map((k) => [k, statCost(k, g.stats[k]), Math.log(margin({ ...g.stats, [k]: g.stats[k] + 1 }) / base) / statCost(k, g.stats[k])]).filter((o) => o[1] <= g.sweat).sort((x, y) => y[2] - x[2]);
      if (!opts.length) break;
      spent += opts[0][1]; buyStat(g, opts[0][0]);
    }
    if (g.floor === lastFloor) { still++; idle++; maxStill = Math.max(maxStill, still); if (d < 30) max30 = maxStill; } else still = 0;
    lastFloor = g.floor;
    rows.push([d + 1, g.floor, spent, `${g.stats.atk}/${g.stats.hp}/${g.stats.spd}`, idle]);
  }
  return { rows, maxStill, max30 };
}
for (const [name, trains] of [['TRAINER (1 session a day)', true], ['NON-TRAINER (never earns)', false]]) {
  const { rows, maxStill, max30 } = sim(trains);
  console.log(`\n${name}\nday floor sweatSpent atk/hp/spd daysNoNewFloorSoFar`);
  for (const r of rows) if (r[0] <= 10 || r[0] % 5 === 0 || r[0] === 7) console.log(r.join('\t'));
  console.log('max consecutive days without a new floor: first 30 days', max30, ', all', maxStill);
}
