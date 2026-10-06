// Monthly recap: pure stats (monthRecap, no DOM) and the 1080 x 1350 share card (drawRecap, draws on a canvas it is given).
import { MOVES, MOVE_LIST } from './data.js';
import { todayStr, monthOf, trainingDates, fastingDates, computeStreak, restFn } from './logic.js';
import { CONFIG, ensureGame, power } from './game/engine.js';
import { getHero, PAL, hexA } from './game/sprites.js';
import { gearLooks } from './game/view.js';

const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] || ym;
export const monthLabel = (ym) => `${monthName(ym)} ${ym.slice(0, 4)}`;
const RANK = { epic: 3, rare: 2, common: 1 };
const setReps = (x) => (Number.isFinite(x && x.reps) ? x.reps : 0);

// Months to offer: every month with a session, a finished fast or an event, plus the current one. Newest first. Never a future month.
export function recapMonths(state, now = new Date()) {
  const cur = monthOf(now), set = new Set([cur]);
  for (const s of state.sessions || []) if (s.date) set.add(s.date.slice(0, 7));
  for (const f of state.fasts || []) if (f.end) set.add(monthOf(new Date(f.end)));
  for (const e of state.events || []) if (e.at) set.add(monthOf(new Date(e.at)));
  return [...set].filter((m) => /^\d{4}-\d{2}$/.test(m) && m <= cur).sort().reverse();
}
// Does this month have anything to show.
export const hasData = (r) => r.trainingDays > 0 || r.fasts.count > 0 || r.levelUps.length > 0;

export function monthRecap(state, ym, now = new Date()) {
  const [y, mo] = ym.split('-').map(Number), dim = new Date(y, mo, 0).getDate(), today = todayStr(now), cur = monthOf(now);
  const first = `${ym}-01`, last = `${ym}-${pad(dim)}`, inM = (d) => d >= first && d <= last;
  const sessions = (state.sessions || []).filter((s) => s.date && inM(s.date));
  const trained = new Set(sessions.map((s) => s.date)), isRest = restFn(state.settings), fasted = new Set(fastingDates(state, now).filter(inM));
  const upTo = last < today ? last : today;
  const frozen = new Set(computeStreak(trainingDates(state).filter((d) => d <= upTo), upTo, isRest).frozenDates.filter(inM));
  // calendar and longest streak. Rest days and freezes keep a streak without growing it, like computeStreak. Today untrained never breaks it.
  const cells = []; let run = 0, longest = 0, missed = 0, elapsed = 0;
  for (let d = 1; d <= dim; d++) {
    const date = `${ym}-${pad(d)}`, future = date > today;
    let s = 'n';
    if (trained.has(date)) { s = 't'; run++; longest = Math.max(longest, run); }
    else if (future) s = 'x';
    else if (isRest(date)) s = 'r';
    else if (frozen.has(date)) { s = 'z'; missed++; }   // a freeze covers a missed day: the streak lives, the day still counts as missed
    else if (date !== today) { run = 0; missed++; }
    if (!future) elapsed++;
    cells.push({ d, s, f: fasted.has(date) });
  }
  const repMap = {};
  for (const se of sessions) for (const x of se.sets || []) if (MOVES[x.moveId]) repMap[x.moveId] = (repMap[x.moveId] || 0) + setReps(x);
  const reps = MOVE_LIST.filter((m) => repMap[m.id] > 0).map((m) => ({ moveId: m.id, name: m.name, unit: m.unit, total: repMap[m.id] }));
  const evs = (state.events || []).filter((e) => e.at && monthOf(new Date(e.at)) === ym);
  const levelUps = evs.filter((e) => e.type === 'levelUp').sort((a, b) => a.at < b.at ? -1 : 1).map((e) => {
    const m = MOVES[e.moveId], lv = m && m.levels[e.level];
    return { moveId: e.moveId, move: m ? m.name : e.moveId, level: lv ? lv.name : (e.legacy || 'Retired exercise') };
  });
  const pbs = evs.filter((e) => e.type === 'pb').length;
  const fl = (state.fasts || []).filter((f) => f.end && monthOf(new Date(f.end)) === ym).map((f) => (new Date(f.end) - new Date(f.start)) / 3.6e6);
  const fasts = { count: fl.length, avgHours: fl.length ? fl.reduce((a, b) => a + b, 0) / fl.length : 0, longestHours: fl.length ? Math.max(...fl) : 0 };
  // Tower. floorLog says the floor each month started on. A month ends where the next logged one starts (floors only change when the Tower opens, which logs the month first),
  // or at the floor now. No log for the month: unknown, so null and the card shows a dash.
  const g = state.game && typeof state.game === 'object' ? state.game : null, log = (g && g.floorLog && typeof g.floorLog === 'object') ? g.floorLog : {};
  const tower = { floors: null, bosses: null, startFloor: null, endFloor: null, bestItem: null, sets: [] };
  if (ym <= cur && Number.isFinite(log[ym])) {
    const nx = Object.keys(log).filter((k) => k > ym && Number.isFinite(log[k])).sort()[0], end = nx ? log[nx] : Number.isFinite(g.floor) ? g.floor : null;
    if (end !== null) {
      tower.startFloor = log[ym]; tower.endFloor = end; tower.floors = Math.max(0, end - log[ym]);
      tower.bosses = end > log[ym] ? Math.floor((end - 1) / CONFIG.bossEvery) - Math.floor((log[ym] - 1) / CONFIG.bossEvery) : 0;
    }
  }
  if (g) {
    const best = (Array.isArray(g.drops) ? g.drops : []).filter((d) => Number.isFinite(d.at) && monthOf(new Date(d.at)) === ym && RANK[d.rarity]).sort((a, b) => RANK[b.rarity] - RANK[a.rarity] || power(b) - power(a))[0];
    if (best) tower.bestItem = { slot: best.slot, tier: best.tier, rarity: best.rarity, set: best.set || null };
    tower.sets = ((g.setLog && g.setLog[ym]) || []).filter((id) => CONFIG.sets[id]).map((id) => ({ moveId: id, name: CONFIG.sets[id].name }));
  }
  // earlier months' training days, for "Best month yet"
  const byMonth = {};
  for (const d of trainingDates(state)) if (d.slice(0, 7) < ym) byMonth[d.slice(0, 7)] = (byMonth[d.slice(0, 7)] || 0) + 1;
  const earlier = Object.values(byMonth), prevBest = earlier.length ? Math.max(...earlier) : 0;
  const r = {
    ym, label: monthLabel(ym), name: monthName(ym), daysInMonth: dim, elapsed, current: ym === cur,
    trainingDays: trained.size, sessions: sessions.length, full: sessions.filter((s) => !s.minimum).length, minimum: sessions.filter((s) => s.minimum).length,
    longestStreak: longest, missed, cells, offset: (new Date(y, mo - 1, 1).getDay() + 6) % 7,
    reps, repTotal: reps.filter((m) => m.unit !== 'sec').reduce((a, m) => a + m.total, 0), coreSec: reps.filter((m) => m.unit === 'sec').reduce((a, m) => a + m.total, 0),
    levelUps, pbs, fasts, tower, prevBest
  };
  r.headline = headline(r);
  return r;
}

const short = (n) => n.replace(/\s*\([^)]*\)\s*$/, '');   // 'Deficit push-up (hands on books)' -> 'Deficit push-up', so it fits the card
// One line, first rule that fits: best month, unbroken, then the biggest single achievement.
export function headline(r) {
  const T = r.tower;
  if (r.trainingDays === 0 && !r.fasts.count && !r.levelUps.length) return 'A quiet month';
  if (r.prevBest > 0 && r.trainingDays > r.prevBest && r.trainingDays >= 3) return 'Best month yet';
  if (r.trainingDays >= 7 && r.missed === 0) return 'Unbroken';
  if (r.levelUps.length === 1) return `Unlocked ${short(r.levelUps[0].level)}`;
  if (r.levelUps.length > 1) return `${r.levelUps.length} level-ups`;
  if (T.sets.length) return `${T.sets[0].name} set complete`;
  if (T.bosses > 0) return `Beat ${T.bosses} boss${T.bosses === 1 ? '' : 'es'}`;
  if (r.pbs > 0) return `${r.pbs} new best${r.pbs === 1 ? '' : 's'}`;
  if (r.longestStreak >= 7) return `${r.longestStreak} day streak`;
  if (r.fasts.longestHours >= 20) return `${Math.round(r.fasts.longestHours)} hour fast`;
  if (r.trainingDays > 0) return `${r.trainingDays} day${r.trainingDays === 1 ? '' : 's'} trained`;
  return `${r.fasts.count} fast${r.fasts.count === 1 ? '' : 's'} done`;
}

const fmtN = (n) => n.toLocaleString('en-AU');
const fh = (h) => `${Math.round(h * 10) / 10}h`;
const fmtSec = (n) => n < 60 ? `${n} s` : `${Math.floor(n / 60)}:${pad(n % 60)}`;
// Plain sentence for the preview's aria-label (and the share text).
export function summaryText(r) {
  const p = [`${r.label} recap. ${r.headline}.`, `${r.trainingDays} of ${r.elapsed} days trained, ${r.sessions} session${r.sessions === 1 ? '' : 's'} (${r.full} full, ${r.minimum} minimum), best streak ${r.longestStreak}.`, `${fmtN(r.repTotal)} reps${r.coreSec ? ` and ${fmtSec(r.coreSec)} of core` : ''}.`];
  p.push(r.fasts.count ? `${r.fasts.count} fast${r.fasts.count === 1 ? '' : 's'}, average ${fh(r.fasts.avgHours)}, longest ${fh(r.fasts.longestHours)}.` : 'No fasts.');
  if (r.tower.floors !== null) p.push(`Tower: ${r.tower.floors} floor${r.tower.floors === 1 ? '' : 's'} climbed${r.tower.bosses ? `, ${r.tower.bosses} boss${r.tower.bosses === 1 ? '' : 'es'} beaten` : ''}.`);
  if (r.levelUps.length) p.push(`Level-ups: ${r.levelUps.map((x) => x.level).join(', ')}.`);
  return p.join(' ');
}

/* ---------- the card ---------- */
export const CARD_W = 1080, CARD_H = 1350;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MIN_PX = 28;   // nothing on the card is smaller, so it reads on a phone feed
const font = (px, w = 600) => `${w} ${px}px ${FONT}`;
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
// Draws text, shrinking to fit maxW (never below MIN_PX), and cutting with an ellipsis if it still does not.
function fit(c, text, x, y, maxW, px, w = 600, align = 'left') {
  c.textAlign = align; c.font = font(px, w);
  while (c.measureText(text).width > maxW && px > MIN_PX) c.font = font(--px, w);
  let t = text; while (c.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1);
  c.fillText(t === text ? t : t.trimEnd() + '…', x, y);
}
// Greedy word wrap to at most `max` lines at this size.
function wrap(c, text, maxW, px, max) {
  c.font = font(px, 800); const words = text.split(' '), lines = [''];
  for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (c.measureText(t).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w); }
  return lines.length <= max && lines.every((l) => c.measureText(l).width <= maxW) ? lines : null;
}

export function drawRecap(canvas, r, state) {
  canvas.width = CARD_W; canvas.height = CARD_H;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.textBaseline = 'alphabetic';
  const M = 64, IW = CARD_W - 2 * M, T = r.tower;
  c.fillStyle = PAL.ink; c.fillRect(0, 0, CARD_W, CARD_H);
  c.fillStyle = hexA(PAL.purD, 0.5); c.fillRect(0, 0, CARD_W, 8);   // top edge accent
  // header
  c.fillStyle = PAL.white; fit(c, 'streaks✦', M, 96, 460, 52, 800);
  c.fillStyle = PAL.coolL; fit(c, r.label, CARD_W - M, 96, 460, 40, 600, 'right');
  // headline: up to 2 lines, centred in its block
  let px = 88, lines = null;
  while (px >= 60 && !((lines = wrap(c, r.headline, IW, px, 2)) && lines.length * (px + 6) <= 156)) px -= 4;
  if (!lines) { px = 60; lines = [r.headline]; }
  c.fillStyle = PAL.goldL; c.textAlign = 'left'; c.font = font(px, 800);
  const bh = lines.length * (px + 6), by = 124 + (156 - bh) / 2 + px - 6;
  lines.forEach((l, i) => fit(c, l, M, by + i * (px + 6), IW, px, 800));
  // six tiles
  const tw = 304, th = 176, tg = 20, ty = 312;
  const sess = r.sessions ? `${r.full} full, ${r.minimum} min` : 'none yet';
  const tiles = [
    ['Days trained', String(r.trainingDays), `of ${r.elapsed} days`, PAL.greenM],
    ['Sessions', String(r.sessions), sess, PAL.blueM],
    ['Best streak', String(r.longestStreak), r.longestStreak === 1 ? 'day in a row' : 'days in a row', PAL.fireM],
    ['Reps', fmtN(r.repTotal), r.coreSec ? `+ ${fmtSec(r.coreSec)} core` : 'all moves', PAL.goldM],
    ['Fasts', String(r.fasts.count), r.fasts.count ? `avg ${fh(r.fasts.avgHours)}, top ${fh(r.fasts.longestHours)}` : 'none yet', PAL.purM],
    ['Tower', T.floors === null ? '—' : `+${T.floors}`, T.floors === null ? 'floors climbed' : T.bosses ? `floors, ${T.bosses} boss${T.bosses === 1 ? '' : 'es'}` : 'floors climbed', PAL.redL]
  ];
  tiles.forEach(([label, val, sub, col], i) => {
    const x = M + (i % 3) * (tw + tg), y = ty + Math.floor(i / 3) * (th + tg);
    c.fillStyle = hexA(PAL.coolD, 0.6); rr(c, x, y, tw, th, 24); c.fill();
    c.fillStyle = col; rr(c, x + 22, y + 18, 44, 7, 3.5); c.fill();
    c.fillStyle = PAL.white; fit(c, val, x + 22, y + 90, tw - 44, 64, 800);
    c.fillStyle = PAL.warmL; fit(c, label, x + 22, y + 126, tw - 44, 28, 600);
    c.fillStyle = PAL.coolL; fit(c, sub, x + 22, y + 160, tw - 44, 28, 500);
  });
  // calendar: 7 columns, Monday first
  const sy = ty + 2 * th + tg + 40, cs = 50, cg = 8, cx = M;
  c.fillStyle = PAL.coolL; 'MTWTFSS'.split('').forEach((l, i) => fit(c, l, cx + i * (cs + cg) + cs / 2, sy + 22, cs, 28, 600, 'center'));
  const col = { t: PAL.greenM, r: PAL.goldM, z: PAL.blueL, n: PAL.coolD, x: hexA(PAL.coolD, 0.35) };
  r.cells.forEach((cell) => {
    const k = r.offset + cell.d - 1, x = cx + (k % 7) * (cs + cg), y = sy + 36 + Math.floor(k / 7) * (cs + cg);
    c.fillStyle = col[cell.s]; rr(c, x, y, cs, cs, 10); c.fill();
    if (cell.f) { c.fillStyle = PAL.ink; c.beginPath(); c.arc(x + cs / 2, y + cs / 2, 13, 0, 7); c.fill(); c.fillStyle = PAL.purL; c.beginPath(); c.arc(x + cs / 2, y + cs / 2, 9, 0, 7); c.fill(); }
  });
  // hero on a stone tile, drawn at a whole-number scale so the pixels stay sharp
  const g = ensureGame({ game: structuredClone((state && state.game) || {}) }), sc = 8, PW = 36, PH = 32, hx = 500 + Math.floor((IW + M - 500 - PW * sc) / 2), hy = sy;
  const ell = (ecx, ecy, rx, ry) => { for (let d = -ry; d <= ry; d++) { const h = Math.round(rx * Math.sqrt(1 - (d / (ry + 0.5)) ** 2)); c.fillRect(hx + (ecx - h) * sc, hy + (ecy + d) * sc, 2 * h * sc, sc); } };
  c.fillStyle = PAL.coolM; ell(12, 28, 13, 4); c.fillStyle = PAL.coolL; ell(12, 27, 11, 2);   // stone tile
  c.fillStyle = hexA(PAL.ink, 0.4); ell(12, 29, 9, 2);   // shadow
  c.drawImage(getHero('idleA', gearLooks(g)).img, hx + 2 * sc, hy + 2 * sc, 32 * sc, 28 * sc);
  c.fillStyle = PAL.white; fit(c, `Floor ${g.floor}`, hx + PW * sc / 2, hy + PH * sc + 46, 440, 44, 800, 'center');
  // legend, 2 by 2
  const lx = 520, ly = hy + PH * sc + 96;
  [['Trained', PAL.greenM], ['Rest day', PAL.goldM], ['Freeze', PAL.blueL], ['Fasted', PAL.purL]].forEach(([l, cl], i) => {
    const x = lx + (i % 2) * 250, y = ly + Math.floor(i / 2) * 38;
    c.fillStyle = i < 3 ? cl : PAL.coolD; rr(c, x, y - 22, 26, 26, 6); c.fill();
    if (i === 3) { c.fillStyle = PAL.purL; c.beginPath(); c.arc(x + 13, y - 9, 7, 0, 7); c.fill(); }
    c.fillStyle = PAL.coolL; fit(c, l, x + 40, y, 200, 28, 500);
  });
  // level-ups: 4 cells, 2 by 2. Over 4, the 4th says how many more.
  const dy = 1150; c.fillStyle = hexA(PAL.coolD, 0.9); c.fillRect(M, dy, IW, 3);
  c.fillStyle = PAL.coolL; fit(c, `Level-ups${r.pbs ? ` · ${r.pbs} new best${r.pbs === 1 ? '' : 's'}` : ''}`, M, dy + 46, IW, 28, 600);
  const lu = r.levelUps, show = lu.length > 4 ? [...lu.slice(0, 3).map((x) => short(x.level)), `+${lu.length - 3} more`] : lu.map((x) => short(x.level));
  if (!show.length) { c.fillStyle = PAL.coolL; fit(c, 'None this month. Next one is coming.', M, dy + 92, IW, 30, 500); }
  show.forEach((t, i) => {
    const x = M + (i % 2) * (IW / 2), y = dy + 92 + Math.floor(i / 2) * 44, more = lu.length > 4 && i === 3;
    if (!more) { c.fillStyle = PAL.goldM; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 24, y); c.lineTo(x + 12, y - 22); c.closePath(); c.fill(); }
    c.fillStyle = more ? PAL.coolL : PAL.white; fit(c, t, x + (more ? 0 : 38), y, IW / 2 - (more ? 20 : 58), 30, 600);
  });
  return canvas;
}
