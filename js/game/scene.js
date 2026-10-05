import { PAL, hexA } from './sprites.js';
// Tower scenery: zones by floor band, deterministic enemy picks, and the pre-rendered isometric room for a floor. Pure helpers first (no DOM), drawing after.
export const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/* ---------- zones and enemies (pure) ---------- */
export const ZONE_SIZE = 10;
export const ZONES = [
  { id: 'cellar', trait: null, name: 'Cellar', boss: 'troll', pool: ['slime', 'rat', 'mushroom', 'bat'] },
  { id: 'barracks', trait: 'armour', name: 'Barracks', boss: 'knight', pool: ['goblin', 'imp', 'skeleton', 'mimic'] },
  { id: 'library', trait: 'arcane', name: 'Library', boss: 'lich', pool: ['wisp', 'cultist', 'spider', 'bat'] },
  { id: 'crypt', trait: 'regen', name: 'Crypt', boss: 'dknight', pool: ['skeleton', 'gargoyle', 'wisp', 'spider'] },
  { id: 'forge', trait: 'burn', name: 'Forge', boss: 'demon', pool: ['imp', 'ember', 'golem', 'goblin'] },
  { id: 'frost', trait: 'chill', name: 'Frost Hall', boss: 'frostdragon', pool: ['frost', 'bat', 'skeleton', 'gargoyle'] },
  { id: 'spire', trait: 'swift', name: 'Sky Spire', boss: 'golddragon', pool: ['gargoyle', 'wisp', 'imp', 'cultist'] }
];
// Enemy traits by zone. verb finishes 'enemies ...', hint says what counters it. The numbers live in CONFIG.trait (engine.js).
export const TRAITS = {
  armour: { verb: 'are armoured', hint: 'Attack beats Speed' }, arcane: { verb: 'hit harder', hint: 'Health and Guard help' }, regen: { verb: 'regenerate', hint: 'Burst damage helps' },
  burn: { verb: 'burn you', hint: 'Lifesteal helps' }, chill: { verb: 'chill you', hint: 'Swift helps' }, swift: { verb: 'strike twice a second', hint: 'Health and Guard help' }
};
export const NAMES = {
  slime: 'slime', rat: 'armoured rat', mushroom: 'mushroom creature', bat: 'bat', goblin: 'goblin', imp: 'imp', skeleton: 'skeleton', mimic: 'mimic', wisp: 'ghost', cultist: 'cultist',
  spider: 'spider', gargoyle: 'gargoyle', ember: 'fire elemental', golem: 'golem', frost: 'ice golem',
  troll: 'Troll King', knight: 'Iron Knight', lich: 'Lich', dknight: 'Death Knight', demon: 'Demon Lord', frostdragon: 'Frost Dragon', golddragon: 'Sky Dragon'
};
const LAPS = ['', 'Deep ', 'Abyssal '];
// Floors 1-9 Cellar, 10-19 Barracks, ... 60-69 Sky Spire, then it cycles with a new tint each lap (Deep, Abyssal).
export function zoneOf(floor) {
  const f = Math.max(1, Math.floor(floor) || 1), idx = Math.floor(f / ZONE_SIZE) % ZONES.length, lap = Math.floor(f / (ZONE_SIZE * ZONES.length)), z = ZONES[idx];
  return { ...z, idx, lap, name: LAPS[Math.min(lap, LAPS.length - 1)] + z.name };
}
// Cellar has none. Later laps add the trait of a zone further up the tower (never the same twice), so Deep and Abyssal floors carry two.
export function traitsOf(floor) {
  const z = zoneOf(floor), out = z.trait ? [z.trait] : [];
  if (z.lap > 0) for (let k = 1; k <= ZONES.length && out.length < 2; k++) { const t = ZONES[(z.idx + z.lap * k) % ZONES.length].trait; if (t && !out.includes(t)) out.push(t); }
  return out;
}
export function traitLine(floor) {
  const z = zoneOf(floor), tr = traitsOf(floor);
  return tr.length ? `${z.name}: enemies ${tr.map((t) => TRAITS[t].verb).join(' and ')}. ${[...new Set(tr.map((t) => TRAITS[t].hint))].join('. ')}.` : `${z.name}: no enemy tricks here.`;
}
export const isElite = (floor) => floor % 5 === 0 && floor % 10 !== 0;
const pick = (f, z) => Math.floor(hash(f, 31 + z.idx) * z.pool.length);
// Same floor, same enemy, always. Bosses are the zone's boss. A repeat of the floor before is nudged along.
export function enemyKind(floor, boss = floor % 10 === 0) {
  const z = zoneOf(floor); if (boss) return z.boss;
  let i = -1, prev = -1;
  for (let q = floor < ZONE_SIZE ? 1 : floor - floor % ZONE_SIZE + 1; q <= floor; q++) { i = pick(q, z); if (i === prev) i = (i + 1) % z.pool.length; prev = i; }   // walk the band so no floor repeats the one before
  return z.pool[i];
}
export const enemyName = (floor, boss) => { const k = enemyKind(floor, boss); return (!boss && isElite(floor) ? 'elite ' : '') + NAMES[k]; };

/* ---------- geometry (shared with the view) ---------- */
export const AW = 176, PAD = 8, AH = 112, TW = 24, TH = 12, GI = 6, GJ = 4, OX = 76, OY = 44, DEPTH = 5, WALL = 50;
export const HERO_T = [1, 2], FOE_T = [3, 0];
export const HERO = [OX + (HERO_T[0] - HERO_T[1]) * TW / 2 + PAD, OY + (HERO_T[0] + HERO_T[1] + 1) * TH / 2], FOE = [OX + (FOE_T[0] - FOE_T[1]) * TW / 2 + PAD, OY + (FOE_T[0] + FOE_T[1] + 1) * TH / 2];
const tileTop = (i, j) => [OX + (i - j) * TW / 2, OY + (i + j) * TH / 2];
const tileMid = (i, j) => [OX + (i - j) * TW / 2, OY + (i + j + 1) * TH / 2];
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
const R = (x, c, X, Y, w, h) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
const E = (x, c, cx, cy, rx, ry) => { x.fillStyle = c; for (let d = -ry; d <= ry; d++) { const h = Math.round(rx * Math.sqrt(1 - (d / ry) ** 2)); x.fillRect(cx - h, cy + d, 2 * h, 1); } };
const L = (x, c, x0, y0, x1, y1) => { x.fillStyle = c; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) x.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1); };
// Flat 2:1 diamond, drawn row by row so it stays pixel exact. inset trims each row to leave mortar.
function diamond(x, c, tx, ty, inset = 0, hi = null, lo = null) {
  for (let r = inset ? 1 : 0; r < TH - (inset ? 1 : 0); r++) {
    const m = Math.min(r, TH - 1 - r), w = Math.max(2, 4 * m + 2 - inset * 2), x0 = tx - w / 2;
    R(x, c, x0, ty + r, w, 1);
    if (hi && r < TH / 2) R(x, hi, x0, ty + r, 1, 1); else if (lo && r >= TH / 2) R(x, lo, x0 + w - 1, ty + r, 1, 1);
  }
}

/* ---------- themes ---------- */
// bricks, wall base, baseboard [fill, top], floor tiles, tile edge/hi/lo, slab faces [left, left-bottom, right, right-bottom], void, wood for props, lamp colours [flame, light rgb]
const T = {
  cellar: { bricks: [PAL.coolD, PAL.coolD, PAL.coolD, PAL.purD], wall: PAL.ink, base: [PAL.ink, PAL.coolM], floor: [PAL.coolM, PAL.coolM, PAL.coolM, PAL.coolL], edge: PAL.coolD, hi: PAL.coolL, lo: PAL.coolD, face: [PAL.coolD, PAL.ink, PAL.ink, PAL.ink], void: PAL.ink, stone: [PAL.coolL, PAL.coolM, PAL.coolD, PAL.ink], wood: [PAL.woodL, PAL.woodM, PAL.umber], lamp: [PAL.goldM, '255,170,70'] },
  barracks: { bricks: [PAL.umber, PAL.umber, PAL.umber, PAL.woodM], wall: PAL.ink, base: [PAL.ink, PAL.warmM], floor: [PAL.warmM, PAL.warmM, PAL.warmM, PAL.warmL], edge: PAL.umber, hi: PAL.warmL, lo: PAL.umber, face: [PAL.umber, PAL.ink, PAL.ink, PAL.ink], void: PAL.ink, stone: [PAL.warmL, PAL.warmM, PAL.umber, PAL.ink], wood: [PAL.woodL, PAL.woodM, PAL.umber], lamp: [PAL.goldM, '255,170,70'] },
  library: { bricks: [PAL.umber, PAL.umber, PAL.umber, PAL.woodM], wall: PAL.ink, base: [PAL.ink, PAL.woodM], floor: [PAL.woodM, PAL.woodM, PAL.woodM, PAL.woodL], edge: PAL.umber, hi: PAL.woodL, lo: PAL.umber, face: [PAL.umber, PAL.ink, PAL.ink, PAL.ink], void: PAL.ink, stone: [PAL.woodL, PAL.woodM, PAL.umber, PAL.ink], wood: [PAL.woodL, PAL.woodM, PAL.umber], lamp: [PAL.goldL, '255,200,100'] },
  crypt: { bricks: [PAL.greenD, PAL.greenD, PAL.greenD, PAL.coolD], wall: PAL.ink, base: [PAL.ink, PAL.greenD], floor: [PAL.coolM, PAL.coolM, PAL.coolM, PAL.coolL], edge: PAL.greenD, hi: PAL.coolL, lo: PAL.coolD, face: [PAL.greenD, PAL.ink, PAL.ink, PAL.ink], void: PAL.ink, stone: [PAL.coolL, PAL.coolM, PAL.greenD, PAL.ink], wood: [PAL.warmL, PAL.warmM, PAL.umber], lamp: [PAL.greenL, '110,230,120'] },
  forge: { bricks: [PAL.umber, PAL.umber, PAL.umber, PAL.redD], wall: PAL.ink, base: [PAL.ink, PAL.redD], floor: [PAL.warmM, PAL.warmM, PAL.warmM, PAL.umber], edge: PAL.umber, hi: PAL.warmL, lo: PAL.umber, face: [PAL.umber, PAL.ink, PAL.ink, PAL.ink], void: PAL.umber, stone: [PAL.warmL, PAL.warmM, PAL.umber, PAL.ink], wood: [PAL.woodL, PAL.woodM, PAL.umber], lamp: [PAL.fireM, '255,120,40'] },
  frost: { bricks: [PAL.blueM, PAL.blueM, PAL.blueM, PAL.blueD], wall: PAL.blueD, base: [PAL.blueD, PAL.white], floor: [PAL.blueL, PAL.blueL, PAL.blueL, PAL.steelL], edge: PAL.blueM, hi: PAL.white, lo: PAL.blueM, face: [PAL.blueM, PAL.blueD, PAL.blueD, PAL.ink], void: PAL.blueD, stone: [PAL.white, PAL.blueL, PAL.blueM, PAL.blueD], wood: [PAL.coolL, PAL.coolM, PAL.coolD], lamp: [PAL.blueL, '150,210,255'] },
  spire: { bricks: [PAL.steelL, PAL.steelL, PAL.steelL, PAL.coolL], wall: PAL.coolL, base: [PAL.coolL, PAL.white], floor: [PAL.steelL, PAL.steelL, PAL.steelL, PAL.white], edge: PAL.coolL, hi: PAL.white, lo: PAL.coolL, face: [PAL.coolM, PAL.coolM, PAL.coolD, PAL.coolD], void: PAL.blueL, stone: [PAL.white, PAL.steelL, PAL.coolL, PAL.coolM], wood: [PAL.warmL, PAL.warmM, PAL.umber], lamp: [PAL.goldL, '255,240,170'] }
};
// Whole-room tint for later laps (Deep, Abyssal)
const LAP_TINT = ['', hexA(PAL.purM, 0.17), hexA(PAL.redM, 0.2)];

/* ---------- wall pieces ---------- */
function torch(x, tx, ty, lights, c = [PAL.goldM, PAL.goldL, PAL.hairL], rgb = '255,170,70') {   // wall sconce with a flame
  R(x, PAL.coolD, tx - 1, ty + 5, 3, 7); R(x, PAL.coolD, tx - 3, ty + 4, 7, 2);
  R(x, c[2], tx - 1, ty + 1, 3, 4); R(x, c[0], tx - 1, ty - 1, 3, 4); R(x, c[1], tx, ty, 1, 3); R(x, c[0], tx, ty - 3, 1, 3);
  lights.push({ x: tx, y: ty + 1, r: 24, rgb });
}
function banner(x, bx, a = PAL.hairM, b = PAL.redD, d = PAL.redM) {
  R(x, PAL.coolM, bx - 3, 1, 22, 3); R(x, PAL.warmL, bx - 3, 1, 22, 1);
  R(x, a, bx, 4, 16, 28); R(x, b, bx, 4, 2, 28); R(x, d, bx + 14, 4, 2, 28);
  for (let k = 0; k < 6; k++) { R(x, a, bx, 32 + k, 6 - k, 1); R(x, a, bx + 10 + k, 32 + k, 6 - k, 1); }
  for (let k = 0; k < 6; k++) { R(x, PAL.warmL, bx + 2 + k, 10 + k, 2, 2); R(x, PAL.warmL, bx + 13 - k - 1, 10 + k, 2, 2); R(x, PAL.warmL, bx + 2 + k, 18 + k, 2, 2); R(x, PAL.warmL, bx + 13 - k - 1, 18 + k, 2, 2); }
  R(x, PAL.warmL, bx + 6, 7, 4, 2);
}
function arch(x, cx, top, w, bot, fill, frame) {   // arched window opening, cx is its centre
  const r = w / 2;
  for (let xx = -r; xx < r; xx++) { const t = top + r - Math.round(Math.sqrt(Math.max(0, r * r - (xx + 0.5) * (xx + 0.5)))); R(x, frame, cx + xx - 1 * (xx === -r ? 1 : 0), t - 1, 1, bot - t + 1); R(x, fill, cx + xx, t, 1, bot - t); }
  R(x, frame, cx - r - 1, top + r, 1, bot - top - r + 1); R(x, frame, cx + r, top + r, 1, bot - top - r + 1);
}
function cloud(x, cx, cy, s, c = PAL.white, sh = PAL.steelL) { E(x, sh, cx, cy + 1, 7 * s, 2 * s); E(x, c, cx - 3 * s, cy, 4 * s, 2 * s); E(x, c, cx + 3 * s, cy, 5 * s, 2 * s + 1); E(x, c, cx, cy - 2 * s, 4 * s, 2 * s + 1); }
function bookshelf(x, bx, by, w, h, seed) {
  R(x, PAL.ink, bx, by, w, h); R(x, PAL.umber, bx, by, w, 1);
  const rows = Math.floor(h / 12), cols = [PAL.hairM, PAL.greenD, PAL.blueD, PAL.goldM, PAL.coolM, PAL.hairM, PAL.coolD];
  for (let r = 0; r < rows; r++) {
    const y0 = by + 2 + r * 12; R(x, PAL.ink, bx + 1, y0, w - 2, 10); let cx = bx + 2;
    while (cx < bx + w - 3) { const bw = 2 + Math.floor(hash(cx, r + seed) * 3), bh = 6 + Math.floor(hash(r, cx + seed) * 4); R(x, cols[Math.floor(hash(cx + seed, r) * cols.length)], cx, y0 + 10 - bh, bw, bh); R(x, 'rgba(255,246,228,.18)', cx, y0 + 10 - bh, 1, bh); cx += bw + (hash(cx, seed) > 0.85 ? 2 : 0); }
    R(x, PAL.umber, bx, y0 + 10, w, 2);
  }
}
function brickWall(x, t) {
  R(x, t.wall, 0, 0, AW, WALL);
  for (let r = 0; r * 6 < WALL; r++) for (let bx = -(r % 2) * 8; bx < AW; bx += 16) {
    const col = t.bricks[Math.floor(hash(bx, r) * t.bricks.length)];
    R(x, col, bx + 1, r * 6 + 1, 15, 5); R(x, 'rgba(255,246,228,.06)', bx + 1, r * 6 + 1, 15, 1);
  }
}
function wallDecor(x, id, lights) {
  const t = T[id];
  if (id === 'cellar') {
    arch(x, 88, 6, 16, 40, PAL.ink, PAL.coolM); for (const bx of [83, 87, 91]) R(x, PAL.coolD, bx, 12, 1, 28); R(x, PAL.coolD, 80, 22, 16, 1); for (const [sx, sy] of [[85, 14], [92, 18], [88, 28]]) R(x, PAL.steelL, sx, sy, 1, 1);
    R(x, PAL.coolL, 79, 40, 18, 2); torch(x, 40, 17, lights); torch(x, 136, 17, lights);
  } else if (id === 'barracks') {
    banner(x, 26); banner(x, 134);
    R(x, PAL.umber, 62, 12, 52, 30); R(x, PAL.umber, 63, 13, 50, 1);                                       // rack back board
    for (let k = 0; k < 6; k++) { const bx = 68 + k * 8, up = k % 2 * 3; R(x, PAL.woodM, bx, 8 + up, 2, 32 - up); R(x, PAL.boneM, bx, 5 + up, 2, 4); R(x, PAL.white, bx, 5 + up, 1, 2); }
    R(x, PAL.woodM, 60, 34, 56, 3); R(x, PAL.woodM, 60, 34, 56, 1); R(x, PAL.woodM, 60, 20, 56, 2);
    E(x, PAL.hairL, 88, 28, 6, 6); E(x, PAL.boneM, 88, 28, 3, 3); R(x, PAL.warmL, 87, 22, 2, 12);             // round shield with a boss
  } else if (id === 'library') {
    bookshelf(x, 6, 4, 50, 42, 1); bookshelf(x, 120, 4, 50, 42, 7);
    arch(x, 88, 8, 16, 38, PAL.ink, PAL.umber); R(x, PAL.steelL, 86, 16, 1, 1); R(x, PAL.steelL, 91, 22, 1, 1); E(x, PAL.white, 90, 16, 3, 3); R(x, PAL.ink, 91, 14, 3, 5);   // night window and moon
    R(x, PAL.umber, 79, 38, 18, 3);
    for (const cx of [82, 94]) { R(x, PAL.white, cx, 33, 3, 5); R(x, PAL.goldL, cx + 1, 30, 1, 3); lights.push({ x: cx + 1, y: 31, r: 20, rgb: '255,200,100' }); }
  } else if (id === 'crypt') {
    arch(x, 88, 8, 22, 40, PAL.ink, PAL.coolM); for (const [sx, sy, s] of [[82, 33, 4], [89, 34, 4], [94, 35, 3], [86, 28, 3], [91, 29, 3]]) { E(x, PAL.boneM, sx + 2, sy, s, s - 1); R(x, PAL.ink, sx, sy - 1, 1, 1); R(x, PAL.ink, sx + 3, sy - 1, 1, 1); }
    for (const lx of [44, 132]) { R(x, PAL.greenD, lx, 0, 1, 14); R(x, PAL.ink, lx - 3, 14, 7, 2); R(x, PAL.greenL, lx - 2, 16, 5, 7); R(x, PAL.boneM, lx - 1, 17, 2, 4); R(x, PAL.ink, lx - 3, 23, 7, 1); lights.push({ x: lx, y: 19, r: 22, rgb: '110,230,120' }); }
    for (const [cx, cy, dx] of [[0, 0, 1], [AW - 1, 0, -1]]) { for (let k = 1; k <= 3; k++) L(x, hexA(PAL.white, 0.32), cx, cy + k * 7, cx + dx * k * 7, cy); L(x, hexA(PAL.white, 0.32), cx, cy, cx + dx * 22, cy + 22); }   // cobwebs
  } else if (id === 'forge') {
    R(x, PAL.ink, 66, 12, 44, 32); R(x, PAL.umber, 64, 10, 48, 3); R(x, PAL.umber, 64, 10, 3, 34); R(x, PAL.umber, 109, 10, 3, 34);
    for (let r = 0; r < 28; r++) R(x, r < 8 ? PAL.goldL : r < 16 ? PAL.goldM : r < 23 ? PAL.hairL : PAL.hairM, 70, 15 + r, 36, 1);   // furnace mouth, hottest at the top
    for (const bx of [76, 85, 94]) R(x, PAL.ink, bx, 15, 2, 28);
    lights.push({ x: 88, y: 30, r: 46, rgb: '255,120,40' });
    for (const hx of [30, 146]) { R(x, PAL.coolD, hx, 6, 2, 22); R(x, PAL.coolD, hx - 4, 6, 10, 5); R(x, PAL.woodM, hx, 28, 2, 8); }   // hung hammers
  } else if (id === 'frost') {
    arch(x, 88, 6, 20, 40, PAL.blueL, PAL.steelL); R(x, PAL.steelL, 87, 12, 2, 28); R(x, PAL.steelL, 80, 24, 17, 2); for (const [sx, sy] of [[83, 14], [93, 30]]) R(x, PAL.white, sx, sy, 2, 2);
    lights.push({ x: 88, y: 24, r: 32, rgb: '150,210,255' });
    for (let k = 0; k < 18; k++) { const ix = 4 + k * 10 + Math.floor(hash(k, 5) * 6), h = 4 + Math.floor(hash(k, 9) * 10); for (let r = 0; r < h; r++) R(x, r < h - 2 ? PAL.steelL : PAL.blueL, ix - Math.floor((h - r) / 5), r, Math.max(1, 3 - Math.floor(r * 3 / h)), 1); }
    for (const [fx, fy] of [[14, 26], [150, 20], [60, 30], [118, 34]]) E(x, 'rgba(255,246,228,.16)', fx, fy, 9, 4);
  } else if (id === 'spire') {
    for (const cx of [26, 88, 150]) {
      arch(x, cx, 4, 40, 45, PAL.blueL, PAL.coolL);
      for (let y = 5; y < 45; y += 2) R(x, y < 20 ? PAL.blueL : y < 32 ? PAL.blueL : PAL.blueL, cx - 20, y, 40, 2);
    }
    cloud(x, 24, 30, 1); cloud(x, 92, 22, 1); cloud(x, 150, 34, 1); cloud(x, 130, 14, 1);
    for (const px of [4, 58, 118, 172]) { R(x, PAL.boneM, px - 4, 0, 8, 46); R(x, PAL.white, px - 4, 0, 1, 46); R(x, PAL.coolL, px + 3, 0, 1, 46); R(x, PAL.coolL, px - 5, 40, 10, 5); }
  }
  return t;
}

/* ---------- floor props ---------- */
function prop(x, kind, mx, my, t, seed, lights) {
  const w = t.wood;
  if (kind === 'barrel') { R(x, w[1], mx - 4, my - 9, 9, 10); R(x, w[0], mx - 4, my - 9, 2, 10); R(x, w[2], mx + 3, my - 9, 2, 10); R(x, PAL.coolD, mx - 4, my - 7, 9, 1); R(x, PAL.coolD, mx - 4, my - 2, 9, 1); R(x, w[0], mx - 3, my - 10, 7, 2); R(x, w[2], mx - 2, my - 10, 5, 1); R(x, 'rgba(28,21,48,.25)', mx - 5, my + 1, 11, 1); }
  else if (kind === 'crate') { R(x, w[1], mx - 5, my - 9, 11, 10); R(x, w[0], mx - 5, my - 9, 11, 1); R(x, w[2], mx - 5, my - 9, 1, 10); R(x, w[2], mx + 5, my - 9, 1, 10); R(x, w[2], mx - 5, my, 11, 1); L(x, w[2], mx - 4, my - 8, mx + 4, my - 1); L(x, w[2], mx + 4, my - 8, mx - 4, my - 1); R(x, 'rgba(28,21,48,.25)', mx - 6, my + 1, 13, 1); }
  else if (kind === 'chest') { R(x, w[1], mx - 5, my - 6, 11, 7); R(x, w[0], mx - 5, my - 8, 11, 3); R(x, w[0], mx - 4, my - 9, 9, 1); R(x, PAL.warmL, mx - 5, my - 5, 11, 1); R(x, PAL.goldL, mx, my - 6, 2, 3); R(x, w[2], mx - 5, my, 11, 1); R(x, 'rgba(28,21,48,.25)', mx - 6, my + 1, 13, 1); }
  else if (kind === 'crack') { const a = hash(seed, 3) > 0.5 ? 1 : -1, c = t.lava || 'rgba(28,21,48,.5)'; L(x, c, mx - 6 * a, my - 5, mx - 1, my - 2); L(x, c, mx - 1, my - 2, mx + 2 * a, my + 1); L(x, c, mx - 1, my - 2, mx + 4 * a, my - 4); L(x, c, mx + 2 * a, my + 1, mx + 6 * a, my + 2); }
  else if (kind === 'rug') { const [tx, ty] = [mx, my - TH / 2]; diamond(x, PAL.redD, tx, ty, 2); diamond(x, PAL.hairM, tx, ty, 4); diamond(x, PAL.warmL, tx, ty, 8); diamond(x, PAL.hairM, tx, ty, 10); }
  else if (kind === 'lamp') { R(x, PAL.coolD, mx, my - 12, 2, 13); R(x, PAL.coolD, mx - 2, my - 1, 6, 2); R(x, PAL.coolD, mx - 3, my - 16, 8, 2); R(x, t.lamp[0], mx - 2, my - 15, 6, 4); R(x, PAL.white, mx, my - 14, 2, 2); R(x, PAL.coolD, mx - 3, my - 11, 8, 1); lights.push({ x: mx + 1, y: my - 13, r: 20, rgb: t.lamp[1] }); }
  else if (kind === 'bones') { R(x, PAL.boneM, mx - 5, my - 2, 8, 2); R(x, PAL.warmL, mx - 5, my, 8, 1); E(x, PAL.boneM, mx + 3, my - 3, 3, 3); R(x, PAL.ink, mx + 2, my - 4, 1, 1); R(x, PAL.ink, mx + 4, my - 4, 1, 1); L(x, PAL.boneM, mx - 6, my - 5, mx - 1, my - 4); R(x, PAL.warmL, mx + 3, my - 1, 2, 1); }
  else if (kind === 'pile') { const cols = { library: [PAL.hairM, PAL.blueD, PAL.goldM], forge: [PAL.ink, PAL.coolD, PAL.fireM], frost: [PAL.steelL, PAL.blueL, PAL.white], spire: [PAL.white, PAL.steelL, PAL.white] }[t.id] || [PAL.coolM, PAL.coolD, PAL.coolL]; for (let k = 0; k < 6; k++) E(x, cols[k % 3], mx - 4 + Math.floor(hash(seed, k) * 8), my - 1 - Math.floor(hash(k, seed) * 3), 2, 1 + (k % 2)); }
  else if (kind === 'puddle') { E(x, t.puddle, mx, my - 3, 7, 2); R(x, 'rgba(255,246,228,.35)', mx - 3, my - 4, 3, 1); if (t.puddleGlow) lights.push({ x: mx, y: my - 3, r: 14, rgb: t.puddleGlow }); }
  else if (kind === 'anvil') { R(x, PAL.coolD, mx - 3, my - 3, 7, 4); R(x, PAL.coolD, mx - 6, my - 8, 13, 3); R(x, PAL.coolL, mx - 6, my - 8, 13, 1); R(x, PAL.coolD, mx + 6, my - 7, 3, 1); R(x, PAL.coolD, mx - 4, my - 5, 9, 2); R(x, 'rgba(28,21,48,.25)', mx - 6, my + 1, 13, 1); }
}
const PROPS = {
  cellar: ['barrel', 'crate', 'chest', 'crack', 'rug', 'lamp', 'puddle', 'pile'], barracks: ['barrel', 'crate', 'chest', 'crack', 'rug', 'lamp', 'pile'], library: ['crate', 'chest', 'rug', 'lamp', 'pile', 'crack'],
  crypt: ['bones', 'bones', 'crack', 'lamp', 'puddle', 'pile'], forge: ['barrel', 'crate', 'crack', 'crack', 'lamp', 'pile', 'puddle'], frost: ['crack', 'crate', 'barrel', 'lamp', 'pile', 'puddle'], spire: ['rug', 'crack', 'lamp', 'pile', 'chest']
};
const EXTRA = { cellar: { puddle: hexA(PAL.blueM, 0.45) }, crypt: { puddle: hexA(PAL.greenM, 0.4) }, forge: { puddle: PAL.fireM, puddleGlow: '255,120,40', lava: PAL.fireM }, frost: { puddle: hexA(PAL.blueL, 0.7) }, barracks: { puddle: hexA(PAL.blueM, 0.4) }, library: { puddle: hexA(PAL.blueM, 0.4) }, spire: { puddle: hexA(PAL.white, 0.6) } };
const rngFor = (seed) => { let s = Math.floor(hash(seed, 77) * 4294967296) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const BLOCKS = [[0, 3], [5, 2]];
function pickTiles(floor, n) {
  const rng = rngFor(floor), free = [];
  for (let i = 0; i < GI; i++) for (let j = 0; j < GJ; j++) {
    if (BLOCKS.some(([a, b]) => a === i && b === j) || Math.abs(i - HERO_T[0]) + Math.abs(j - HERO_T[1]) <= 1 || Math.abs(i - FOE_T[0]) + Math.abs(j - FOE_T[1]) <= 1) continue;
    free.push([i, j]);
  }
  for (let k = free.length - 1; k > 0; k--) { const m = Math.floor(rng() * (k + 1)); [free[k], free[m]] = [free[m], free[k]]; }
  return { tiles: free.slice(0, n), rng };
}
// What the room holds on a floor (pure, so it is testable): the prop kind and tile for each slot.
export function floorProps(floor) {
  const z = zoneOf(floor), n = 2 + Math.floor(hash(floor, 5) * 3), { tiles, rng } = pickTiles(floor, n), set = PROPS[z.id], out = [];
  if (z.id === 'forge') out.push({ kind: 'anvil', i: 4, j: 3 });   // the forge always has its anvil
  for (const [i, j] of tiles) { if (out.some((o) => o.i === i && o.j === j)) continue; let k = set[Math.floor(rng() * set.length)]; if (k === 'rug' && out.some((o) => o.kind === 'rug')) k = 'crack'; out.push({ kind: k, i, j }); }
  return out;
}

/* ---------- the room ---------- */
function block(x, t, i, j, hgt) {   // raised block on a tile
  const [tx, ty] = tileTop(i, j), s = t.stone;
  for (let k = 0; k < TW / 2; k++) { const y0 = ty + TH / 2 + Math.floor(k / 2); R(x, s[2], tx - TW / 2 + k, y0 - hgt, 1, hgt + 1); R(x, s[3], tx + k, ty + TH - Math.ceil(k / 2) - hgt - 1, 1, hgt + 1); }
  R(x, 'rgba(28,21,48,.4)', tx - TW / 2, ty + TH / 2 - 1, 1, 1);
  diamond(x, s[0], tx, ty - hgt, 0, hexA(PAL.white, 0.2), 'rgba(28,21,48,.25)'); diamond(x, s[1], tx, ty - hgt, 3);
}
function buildCore(floor) {
  const z = zoneOf(floor), t = { ...T[z.id], ...EXTRA[z.id], id: z.id }, lights = [], [c, x] = mk(AW, AH);
  R(x, t.void, 0, 0, AW, AH);
  brickWall(x, t);
  for (let k = 0; k < 14; k++) R(x, `rgba(28,21,48,${(z.id === 'spire' ? 0.12 : 0.34) - k * (z.id === 'spire' ? 0.008 : 0.025)})`, 0, k * 2, AW, 2);   // dark towards the ceiling
  if (z.id !== 'spire') { R(x, t.base[0], 0, WALL - 5, AW, 5); R(x, t.base[1], 0, WALL - 5, AW, 1); }
  wallDecor(x, z.id, lights);
  if (z.id === 'spire') { R(x, t.base[0], 0, WALL - 5, AW, 5); R(x, t.base[1], 0, WALL - 5, AW, 1); }
  // void under the floor
  R(x, t.void, 0, WALL, AW, AH - WALL);
  if (z.id === 'spire') { for (let k = 0; k < AH - WALL; k += 2) R(x, k < 20 ? PAL.blueL : k < 40 ? PAL.blueL : PAL.steelL, 0, WALL + k, AW, 2); for (const [cx, cy, s] of [[20, 96, 2], [150, 88, 2], [90, 106, 2], [60, 78, 1], [170, 104, 1]]) cloud(x, cx, cy, s); }
  else if (z.id === 'forge') for (let k = 0; k < 10; k++) R(x, hexA(k < 5 ? PAL.redM : PAL.fireM, 0.03 + k * 0.012), 0, AH - 40 + k * 4, AW, 4);
  else for (let k = 0; k < 8; k++) R(x, `rgba(255,246,228,${0.012 * k})`, 0, WALL + k * 8, AW, 8);
  // slab front faces, then tiles
  for (let k = 0; k < 72; k++) {
    const lx = OX - 48 + k, ly = OY + 24 + Math.floor(k / 2); if (lx < OX + 24) { R(x, t.face[0], lx, ly - 1, 1, DEPTH + 1); R(x, t.face[1], lx, ly + 3, 1, 1); }
    const rx = OX + 24 + k, ry = OY + 60 - Math.floor(k / 2); if (rx < OX + 72) { R(x, t.face[2], rx, ry - 1, 1, DEPTH + 1); R(x, t.face[3], rx, ry + 3, 1, 1); }
  }
  for (let i = 0; i < GI; i++) for (let j = 0; j < GJ; j++) {
    const [tx, ty] = tileTop(i, j);
    diamond(x, t.edge, tx, ty);
    diamond(x, t.floor[Math.floor(hash(i, j) * 4)], tx, ty, 2, t.hi, t.lo);
    if (hash(j, i + 9) > 0.7) { R(x, 'rgba(28,21,48,.14)', tx - 3, ty + 4, 5, 1); R(x, 'rgba(255,246,228,.07)', tx + 1, ty + 7, 3, 1); }
  }
  for (const [i, j] of BLOCKS) block(x, t, i, j, 8);
  const props = floorProps(floor).sort((a, b) => a.i + a.j - b.i - b.j);
  props.forEach((p, k) => { const [mx, my] = tileMid(p.i, p.j); prop(x, p.kind, mx, my, t, floor * 7 + k, lights); });
  // baked glow, so the room is lit even with no flicker
  for (const l of lights) glow(x, l, 0.1);
  if (z.id === 'forge') { R(x, hexA(PAL.fireM, 0.07), 0, 0, AW, AH); }
  if (z.id === 'frost') { R(x, hexA(PAL.blueM, 0.08), 0, 0, AW, AH); }
  if (z.lap && LAP_TINT[Math.min(z.lap, 2)]) R(x, LAP_TINT[Math.min(z.lap, 2)], 0, 0, AW, AH);
  return [c, lights];
}
// Soft pixel glow, three nested ellipses
export function glow(x, l, a) { for (let k = 0; k < 3; k++) { const s = 1 - k * 0.3; x.fillStyle = `rgba(${l.rgb},${(a / 2.2).toFixed(3)})`; for (let d = -Math.round(l.r * 0.7 * s); d <= Math.round(l.r * 0.7 * s); d++) { const h = Math.round(l.r * s * Math.sqrt(1 - (d / (l.r * 0.7 * s)) ** 2)); x.fillRect(l.x - h, l.y + d, 2 * h, 1); } } }
// The scene is a little wider than the play area; the sides are cropped on narrow screens so it always fills the panel. Cached per floor.
const cache = new Map();
export function sceneFor(floor) {
  if (cache.has(floor)) { const s = cache.get(floor); cache.delete(floor); cache.set(floor, s); return s; }
  const [core, lights] = buildCore(floor), [c, x] = mk(AW + 2 * PAD, AH);
  x.drawImage(core, PAD, 0);
  x.drawImage(core, 0, 0, 1, AH, 0, 0, PAD, AH); x.drawImage(core, AW - 1, 0, 1, AH, AW + PAD, 0, PAD, AH);
  const s = { canvas: c, lights: lights.map((l) => ({ ...l, x: l.x + PAD })) };
  cache.set(floor, s); if (cache.size > 4) cache.delete(cache.keys().next().value);
  return s;
}
