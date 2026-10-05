// Tower tab: HTML view plus the battle canvas. Isometric stone floor, chibi units, drawn at art resolution then scaled up crisp.
import { CONFIG, SLOTS, SLOT_STAT, ensureGame, heroStats, fight, advance, offlineCatchUp, statCost, focusCost, focusMax, canAscend, soulsFor, isBoss } from './engine.js';
import { getSprite, kindFor } from './sprites.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => { n = Math.round(n); if (n < 10000) return String(n); const u = ['k', 'M', 'B', 'T', 'Q']; let i = -1; let v = n; while (v >= 1000 && i < 4) { v /= 1000; i++; } return (v < 100 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)) + u[i]; };
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const SLOT_NAME = { weapon: 'Weapon', armour: 'Armour', boots: 'Boots' }, STAT_NAME = { atk: 'Attack', hp: 'Health', spd: 'Speed' };

/* ---------- HTML ---------- */
const statVal = (g, stat, lv) => { const h = heroStats({ ...g, stats: { ...g.stats, [stat]: lv } }); return stat === 'spd' ? `${h.spd.toFixed(2)}/s` : fmt(h[stat]); };
const spdMaxed = (g) => CONFIG.spd.base + CONFIG.spd.per * g.stats.spd >= CONFIG.spd.max;
const GL = { sweat: '&#9889;', focus: '&#9670;' };
const btnTxt = (max, gl, cost) => max ? 'Max' : `<span aria-hidden="true">${GL[gl]}</span> ${fmt(cost)}`;
function statParts(g, stat) {
  const lv = g.stats[stat], max = stat === 'spd' && spdMaxed(g), cost = statCost(stat, lv);
  return { cost, off: max || g.sweat < cost, main: `<div class="tw-nm">${STAT_NAME[stat]} <span class="tw-lv">Lv ${lv}</span></div><div class="tw-sub tnum">${statVal(g, stat, lv)}${max ? ' (max base)' : ` &rarr; ${statVal(g, stat, lv + 1)}`}</div>`,
    label: max ? `${STAT_NAME[stat]} is at max level` : `Upgrade ${STAT_NAME[stat]} to level ${lv + 1} for ${cost} Sweat`, txt: btnTxt(max, 'sweat', cost) };
}
function statRow(g, stat) {
  const p = statParts(g, stat);
  return `<div class="tw-row" data-row="stat:${stat}"><div class="tw-main">${p.main}</div>
    <button class="btn sm tw-buy tnum" data-act="buyStat" data-stat="${stat}" data-cost="${p.cost}" aria-label="${esc(p.label)}" ${p.off ? 'disabled' : ''}>${p.txt}</button></div>`;
}
const RCOL = { common: 'var(--muted)', rare: 'var(--blue-text)', epic: 'var(--purple-text)' };
export function gearHtml(g) {
  return SLOTS.map((s) => { const it = g.gear[s];
    return `<div class="tw-row" data-slot="${s}"><div class="tw-main"><div class="tw-nm">${SLOT_NAME[s]}</div><div class="tw-sub" style="color:${it ? RCOL[it.rarity] : 'var(--muted)'}">${it ? `Tier ${it.tier} ${esc(it.rarity)} &middot; +${pct(it.bonus)} ${STAT_NAME[SLOT_STAT[s]]}` : 'Empty. Bosses drop gear.'}</div></div></div>`; }).join('');
}
const FOCUS_ROWS = [['endurance', 'Stamina', (g) => `+10% Sweat from training (now +${g.focusUp.endurance * Math.round(CONFIG.staminaPer * 100)}%)`], ['precision', 'Precision', (g) => `+2% crit (now ${pct(heroStats(g).crit)})`], ['luck', 'Luck', (g) => `+2% epic drops (now ${pct(CONFIG.rarity.epic.p + CONFIG.luckPer * g.focusUp.luck)})`]];
function focusParts(g, [id, nm, desc]) {
  const lv = g.focusUp[id], max = lv >= focusMax(id), cost = max ? 0 : focusCost(id, lv);
  return { cost, off: max || g.focus < cost, main: `<div class="tw-nm">${nm} <span class="tw-lv">Lv ${lv}/${focusMax(id)}</span></div><div class="tw-sub">${desc(g)}</div>`,
    label: max ? `${nm} is at max level` : `Upgrade ${nm} to level ${lv + 1} for ${cost} Focus`, txt: btnTxt(max, 'focus', cost) };
}
function focusRow(g, row) {
  const id = row[0], p = focusParts(g, row);
  return `<div class="tw-row" data-row="up:${id}"><div class="tw-main">${p.main}</div>
    <button class="btn sm tw-buy tnum" data-act="buyFocus" data-up="${id}" data-fcost="${p.cost}" aria-label="${esc(p.label)}" ${p.off ? 'disabled' : ''}>${p.txt}</button></div>`;
}
export function awayHtml(a) {
  if (!a) return '';
  const hrs = a.seconds >= 3600 ? `${Math.round(a.seconds / 360) / 10} h` : `${Math.round(a.seconds / 60)} min`;
  const best = a.best ? ` Best drop: ${esc(a.best.rarity)} ${esc(SLOT_NAME[a.best.slot].toLowerCase())}, +${pct(a.best.bonus)}${a.best.equipped ? ' (equipped)' : ' (scrapped)'}.` : '';
  return `<div class="note tw-away"><h3>While you were away</h3><p>${hrs}${a.capped ? ' (the most it can count)' : ''}: your hero climbed ${a.floors} floor${a.floors === 1 ? '' : 's'} to floor ${a.to} and beat ${a.bosses} boss${a.bosses === 1 ? '' : 'es'}.${best}</p></div>`;
}
const badgeText = (g) => `Floor ${g.floor} &middot; ${isBoss(g.floor) ? 'Boss' : `boss in ${CONFIG.bossEvery - (g.floor % CONFIG.bossEvery)}`}${g.grit >= 0.005 ? ` &middot; Grit +${Math.round(g.grit * 100)}%` : ''}`;
export function viewTower(state) {
  const g = ensureGame(state);
  const cur = (ic, nm, key, v) => `<div class="tw-cur" role="group" data-twg="${key}" aria-label="${nm} ${Math.round(v)}"><span class="tw-ci" aria-hidden="true">${ic}</span><b class="tnum" data-tw="${key}" aria-hidden="true">${fmt(v)}</b><span aria-hidden="true">${nm}</span></div>`;
  const asc = g.tokens > 0 ? `<div class="section"><h2 class="title">Ascend</h2><div class="note tw-asc"><h3>Ascend token &times;${g.tokens}</h3><p>Reset to floor 1 for <b>+${soulsFor(g)} souls</b> (from floor ${g.runMax}). Souls add +10% attack and health each, forever. Your best gear item stays equipped, the other slots reset. Stats, Focus upgrades and currencies stay.</p>
    <button class="btn sm" data-act="ascend" data-tw-asc ${canAscend(g) ? '' : 'disabled'}>Ascend</button>${canAscend(g) ? '' : `<p class="small muted" style="margin:8px 0 0">Reach floor ${CONFIG.ascendMinFloor} first. You are at ${g.runMax}.</p>`}</div></div>` : '';
  return `<div class="section"><div class="tw-battle"><div class="tw-badge tnum" id="tw-badge">${badgeText(g)}</div><canvas id="tw-canvas" role="img" aria-label="Your hero fighting on the tower floor"></canvas></div>
    <div id="tw-away">${awayHtml(g.away)}</div>
    <div class="tw-curs">${cur('&#9889;', 'Sweat', 'sweat', g.sweat)}${cur('&#9670;', 'Focus', 'focus', g.focus)}${cur('&#10022;', 'Souls', 'souls', g.souls)}</div></div>
  <div class="section"><h2 class="title">Hero</h2><div class="tw-card">${['atk', 'hp', 'spd'].map((s) => statRow(g, s)).join('')}</div></div>
  <div class="section"><h2 class="title">Gear</h2><div class="tw-card" id="tw-gear">${gearHtml(g)}</div></div>
  <div class="section"><h2 class="title">Focus upgrades</h2><div class="tw-card">${FOCUS_ROWS.map((r) => focusRow(g, r)).join('')}</div></div>
  ${asc}
  <div class="section"><h2 class="title">How you earn</h2><div class="tw-card tw-how"><p><b><span aria-hidden="true">&#9889;</span> Sweat</b> from training. Full session 100, minimum day 40, times your streak bonus (up to &times;1.5). Only 2 sessions a day pay, the 2nd half.</p><p><b>&#9889; Bonus</b> level-up +300 and an Ascend token, new best +100.</p><p><b>&#9670; Focus</b> from fasts that reach your &ldquo;counts after&rdquo; hours: 30, plus 5 for each extra hour, up to 80.</p><p><b>&#10022; Souls</b> from ascending. Missed days cost nothing. The hero keeps climbing.</p></div></div>`;
}

/* ---------- art: 176 x 112 buffer, scaled up by whole numbers ---------- */
const AW = 176, PAD = 8, AH = 112, TW = 24, TH = 12, GI = 6, GJ = 4, OX = 76, OY = 44, DEPTH = 5, WALL = 50;
const HERO_T = [1, 2], FOE_T = [3, 0];
const HERO = [OX + (HERO_T[0] - HERO_T[1]) * TW / 2 + PAD, OY + (HERO_T[0] + HERO_T[1] + 1) * TH / 2], FOE = [OX + (FOE_T[0] - FOE_T[1]) * TW / 2 + PAD, OY + (FOE_T[0] + FOE_T[1] + 1) * TH / 2];
const tileTop = (i, j) => [OX + (i - j) * TW / 2, OY + (i + j) * TH / 2];
const tileMid = (i, j) => [OX + (i - j) * TW / 2, OY + (i + j + 1) * TH / 2];
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
const R = (x, c, X, Y, w, h) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
// Flat 2:1 diamond, drawn row by row so it stays pixel exact. inset trims each row to leave mortar.
function diamond(x, c, tx, ty, inset = 0, hi = null, lo = null) {
  for (let r = inset ? 1 : 0; r < TH - (inset ? 1 : 0); r++) {
    const m = Math.min(r, TH - 1 - r), w = Math.max(2, 4 * m + 2 - inset * 2), x0 = tx - w / 2;
    R(x, c, x0, ty + r, w, 1);
    if (hi && r < TH / 2) R(x, hi, x0, ty + r, 1, 1); else if (lo && r >= TH / 2) R(x, lo, x0 + w - 1, ty + r, 1, 1);
  }
}
function block(x, i, j, hgt) {   // raised stone block on a tile
  const [tx, ty] = tileTop(i, j);
  for (let k = 0; k < TW / 2; k++) { const y0 = ty + TH / 2 + Math.floor(k / 2); R(x, '#4a4a52', tx - TW / 2 + k, y0 - hgt, 1, hgt + 1); R(x, '#3a3a42', tx + k, ty + TH - Math.ceil(k / 2) - hgt - 1, 1, hgt + 1); }
  R(x, '#2c2c33', tx - TW / 2, ty + TH / 2 - 1, 1, 1);
  diamond(x, '#8e8e96', tx, ty - hgt, 0, '#a8a8b0', '#6b6b73');
  diamond(x, '#7c7c84', tx, ty - hgt, 3);
}
function banner(x, bx) {
  R(x, '#6b6b73', bx - 3, 1, 22, 3); R(x, '#d4a373', bx - 3, 1, 22, 1);
  R(x, '#9b2226', bx, 4, 16, 28); R(x, '#7a1a1d', bx, 4, 2, 28); R(x, '#b3343a', bx + 14, 4, 2, 28);
  for (let k = 0; k < 6; k++) { R(x, '#9b2226', bx, 32 + k, 6 - k, 1); R(x, '#9b2226', bx + 10 + k, 32 + k, 6 - k, 1); }
  for (let k = 0; k < 6; k++) { R(x, '#d4a373', bx + 2 + k, 10 + k, 2, 2); R(x, '#d4a373', bx + 13 - k - 1, 10 + k, 2, 2); R(x, '#d4a373', bx + 2 + k, 18 + k, 2, 2); R(x, '#d4a373', bx + 13 - k - 1, 18 + k, 2, 2); }
  R(x, '#d4a373', bx + 6, 7, 4, 2);
}
function buildCore() {
  const [c, x] = mk(AW, AH);
  R(x, '#1d1d23', 0, 0, AW, AH);
  // back wall: grey bricks in running bond
  R(x, '#2a2a30', 0, 0, AW, WALL);
  const BR = ['#4a4a52', '#44444c', '#505058', '#3e3e46', '#48484f'];
  for (let r = 0; r * 6 < WALL; r++) for (let bx = -(r % 2) * 8; bx < AW; bx += 16) {
    const hsh = hash(bx, r), col = BR[Math.floor(hsh * BR.length)];
    R(x, col, bx + 1, r * 6 + 1, 15, 5); R(x, 'rgba(255,255,255,.06)', bx + 1, r * 6 + 1, 15, 1);
  }
  for (let k = 0; k < 14; k++) R(x, `rgba(0,0,0,${0.34 - k * 0.025})`, 0, k * 2, AW, 2);   // dark towards the ceiling
  R(x, '#2f2f36', 0, WALL - 5, AW, 5); R(x, '#5a5a62', 0, WALL - 5, AW, 1);               // baseboard
  // stained glass window
  R(x, '#6b6b73', 81, 5, 14, 33); R(x, '#8e8e96', 81, 5, 14, 1); R(x, '#8e8e96', 80, 36, 16, 2);
  R(x, '#5a7bd8', 84, 9, 8, 27); R(x, '#5a7bd8', 85, 7, 6, 2); R(x, '#3b55a8', 87, 7, 2, 29); R(x, '#3b55a8', 84, 17, 8, 1); R(x, '#3b55a8', 84, 27, 8, 1);
  R(x, '#9fb6f2', 85, 10, 1, 6); R(x, '#9fb6f2', 85, 19, 1, 7); R(x, '#7f9be6', 90, 20, 1, 6);
  R(x, 'rgba(90,123,216,.10)', 70, 38, 36, 12);
  banner(x, 30); banner(x, 130);
  // void under the floor
  R(x, '#1d1d23', 0, WALL, AW, AH - WALL);
  for (let k = 0; k < 8; k++) R(x, `rgba(255,255,255,${0.012 * k})`, 0, WALL + k * 8, AW, 8);
  // stone slab: front faces, then tiles
  for (let k = 0; k < 72; k++) {
    const lx = OX - 48 + k, ly = OY + 24 + Math.floor(k / 2); if (lx < OX + 24) { R(x, '#3b3b43', lx, ly - 1, 1, DEPTH + 1); R(x, '#33333a', lx, ly + 3, 1, 1); }
    const rx = OX + 24 + k, ry = OY + 60 - Math.floor(k / 2); if (rx < OX + 72) { R(x, '#2c2c33', rx, ry - 1, 1, DEPTH + 1); R(x, '#25252b', rx, ry + 3, 1, 1); }
  }
  for (let i = 0; i < GI; i++) for (let j = 0; j < GJ; j++) {
    const [tx, ty] = tileTop(i, j);
    diamond(x, '#4a4a52', tx, ty);
    const v = hash(i, j), base = v < 0.25 ? '#6b6b73' : v < 0.5 ? '#72727a' : v < 0.75 ? '#666670' : '#77777f';
    diamond(x, base, tx, ty, 2, '#8e8e96', '#55555d');
    if (hash(j, i + 9) > 0.7) { R(x, 'rgba(0,0,0,.14)', tx - 3, ty + 4, 5, 1); R(x, 'rgba(255,255,255,.07)', tx + 1, ty + 7, 3, 1); }
  }
  block(x, 0, 3, 8); block(x, 5, 2, 8);
  return c;
}
// The scene is a little wider than the play area; the sides are cropped on narrow screens so it always fills the panel.
export function buildScene() {
  const core = buildCore(), [c, x] = mk(AW + 2 * PAD, AH);
  x.drawImage(core, PAD, 0);
  x.drawImage(core, 0, 0, 1, AH, 0, 0, PAD, AH); x.drawImage(core, AW - 1, 0, 1, AH, AW + PAD, 0, PAD, AH);
  return c;
}

// 3x5 pixel digits for damage numbers
const GLYPH = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111', k: '101101110101101', M: '101111111101101', '!': '010010010000010', B: '110101110101110', '.': '000000000000010', '-': '000000111000000' };
function text(x, s, X, Y, col = '#fff') {
  const draw = (ox, oy, c) => { x.fillStyle = c; let cx = X + ox; for (const ch of s) { const gl = GLYPH[ch]; if (gl) for (let i = 0; i < 15; i++) if (gl[i] === '1') x.fillRect(cx + i % 3, Y + oy + Math.floor(i / 3), 1, 1); cx += 4; } };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) draw(dx, dy, '#1e1b26');
  draw(0, 0, col);
}
const textW = (s) => s.length * 4 - 1;
function shadow(x, cx, cy, rx, ry) {
  x.fillStyle = 'rgba(10,8,16,.38)';
  for (let d = -ry; d <= ry; d++) { const h = Math.round(rx * Math.sqrt(1 - (d / ry) ** 2)); x.fillRect(cx - h, cy + d, 2 * h, 1); }
}
function bar(x, cx, y, w, f, col) {
  R(x, '#1e1b26', cx - w / 2 - 1, y - 1, w + 2, 5); R(x, '#3a3a42', cx - w / 2, y, w, 3);
  const fw = Math.max(f > 0 ? 1 : 0, Math.round(w * Math.max(0, Math.min(1, f)))); R(x, col, cx - w / 2, y, fw, 3); R(x, 'rgba(255,255,255,.35)', cx - w / 2, y, fw, 1);
}

/* ---------- live loop ---------- */
let M = null;
const PAINT_MS = 1000 / 20 - 2;   // about 20 fps
export function unmountTower() {
  if (!M) return;
  cancelAnimationFrame(M.raf); document.removeEventListener('visibilitychange', M.onVis); if (M.io) M.io.disconnect();
  try { M.save(M.state); } catch (e) { /* ignore */ }
  M = null;
}
export function mountTower(state, save) {
  unmountTower();
  const cv = document.getElementById('tw-canvas'); if (!cv) return;
  const g = ensureGame(state), now = Date.now();
  const [art, a] = mk(AW + 2 * PAD, AH), ctx = cv.getContext('2d');
  const rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const m = M = { state, g, save, cv, ctx, art, a, scene: buildScene(), rm, raf: 0, floor: g.floor, spawnT: now - 1000, hitAcc: 0, foeAcc: 0, hLunge: -1e9, fLunge: -1e9, hFlash: -1e9, fFlash: -1e9, floats: [], lastSave: now, lastUi: 0, drawn: 0, vis: true, io: null, gearSig: '', cw: 0, ch: 0 };
  m.onVis = () => { if (document.visibilityState === 'hidden') { try { save(state); m.lastSave = Date.now(); } catch (e) { /* ignore */ } } };
  document.addEventListener('visibilitychange', m.onVis);
  if (g.away) { g.away = null; try { save(state); } catch (e) { /* ignore */ } }   // the banner shows once
  if (!g.lastTick) g.lastTick = now;
  if ('IntersectionObserver' in window) { m.io = new IntersectionObserver((es) => { const v = es[es.length - 1].isIntersecting; if (v && !m.vis) m.drawn = 0; m.vis = v; }); m.io.observe(cv); }   // no painting while the canvas is off screen
  paint(m, now);
  const loop = () => { m.raf = requestAnimationFrame(loop); tick(m); };
  m.raf = requestAnimationFrame(loop);
}
function tick(m) {
  const { g } = m, now = Date.now();
  let dt = (now - g.lastTick) / 1000;
  if (dt < 0) { g.lastTick = now; dt = 0; }
  if (dt > 30) {   // phone slept or tab was away: use the offline sim and show the banner
    const away = offlineCatchUp(m.state, now);
    const el = document.getElementById('tw-away'); if (el && away) { el.innerHTML = awayHtml(away); g.away = null; }
    m.hitAcc = m.foeAcc = 0; updateUi(m, now);
  } else if (dt > 0) {
    const s = advance(g, dt); g.lastTick = now;
    if (s.drops.length) m.lastUi = 0;
  }
  if (now - m.lastSave > 5000) { try { m.save(m.state); } catch (e) { /* ignore */ } m.lastSave = now; }
  if (now - m.lastUi > 1000) updateUi(m, now);
  if (!m.vis || now - m.drawn < (m.rm ? 500 : PAINT_MS)) return;   // sim runs every frame, painting is capped to save battery
  paint(m, now, m.drawn ? Math.min((now - m.drawn) / 1000, 0.25) : 0);
}
// Updates numbers, rows and button states in place, so the canvas and scene are never rebuilt (and VoiceOver keeps its focus).
export function refreshTowerUi(state) {
  const g = ensureGame(state);
  for (const [k, nm] of [['sweat', 'Sweat'], ['focus', 'Focus'], ['souls', 'Souls']]) {
    const e = document.querySelector(`[data-tw="${k}"]`), t = fmt(g[k]); if (e && e.textContent !== t) e.textContent = t;
    const gp = document.querySelector(`[data-twg="${k}"]`), l = `${nm} ${Math.round(g[k])}`; if (gp && gp.getAttribute('aria-label') !== l) gp.setAttribute('aria-label', l);
  }
  const patch = (key, p) => {
    const row = document.querySelector(`[data-row="${key}"]`); if (!row) return;
    const main = row.querySelector('.tw-main'), b = row.querySelector('.tw-buy');
    if (main.innerHTML !== p.main) main.innerHTML = p.main;
    if (b.innerHTML !== p.txt) b.innerHTML = p.txt;
    if (b.getAttribute('aria-label') !== p.label) b.setAttribute('aria-label', p.label);
    b.dataset.cost = p.cost; b.dataset.fcost = p.cost; b.disabled = p.off;
  };
  for (const st of ['atk', 'hp', 'spd']) patch('stat:' + st, statParts(g, st));
  for (const r of FOCUS_ROWS) patch('up:' + r[0], focusParts(g, r));
  document.querySelectorAll('[data-tw-asc]').forEach((e) => { e.disabled = !canAscend(g); });
}
function updateUi(m, now) {
  const { g } = m; m.lastUi = now;
  refreshTowerUi(m.state);
  const b = document.getElementById('tw-badge'); if (b) { const t = badgeText(g); if (b.innerHTML !== t) b.innerHTML = t; }
  const gs = JSON.stringify(g.gear), ge = document.getElementById('tw-gear'); if (ge && gs !== m.gearSig) { m.gearSig = gs; ge.innerHTML = gearHtml(g); }
}
const ease = (t) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
function paint(m, now, dt = 0) {
  const { g, a, cv } = m, f = fight(g, g.floor), e = f.enemy, boss = e.boss, kind = kindFor(g.floor, boss);
  if (g.floor !== m.floor) { m.floor = g.floor; m.spawnT = now; m.hitAcc = m.foeAcc = 0; }
  const win = f.win, fighting = win ? g.prog < f.t : g.prog < CONFIG.rest * 0.8;
  const fx = !m.rm;
  // enemy hp and hero hp from how far into the try we are
  let eF, hF;
  if (win) { eF = Math.max(0, 1 - g.prog / f.t); hF = Math.max(0, 1 - e.atk * Math.min(g.prog, f.t) / f.hero.hp); }
  else { const p = Math.min(1, g.prog / (CONFIG.rest * 0.8)), left = Math.max(0.02, 1 - f.dps * Math.min(f.tDie, CONFIG.bossTimer) / e.hp); eF = 1 - (1 - left) * p; hF = f.late ? 1 - p * 0.3 : 1 - p; }   // a boss that out-lasts the timer enrages: hero lives but loses
  if (fx && fighting && dt) {
    m.hitAcc += dt * f.hero.spd; m.foeAcc += dt;
    if (m.hitAcc >= 1) {
      m.hitAcc = m.hitAcc % 1; m.hLunge = now; m.fFlash = now;
      const crit = Math.random() < f.hero.crit, dmg = f.hero.atk * (1 + g.grit) * (crit ? 2 : 1);
      if (m.floats.length < 10) m.floats.push({ s: fmt(dmg) + (crit ? '!' : ''), x: FOE[0] + (Math.random() * 10 - 5), y: FOE[1] - (boss ? 44 : 32), t: now, c: crit ? '#ffd76a' : '#fff' });
    }
    if (m.foeAcc >= 1) { m.foeAcc %= 1; m.fLunge = now; m.hFlash = now; if (m.floats.length < 10) m.floats.push({ s: fmt(e.atk), x: HERO[0] + (Math.random() * 8 - 4), y: HERO[1] - 34, t: now, c: '#ffb3a8' }); }
  }
  a.imageSmoothingEnabled = false;
  a.drawImage(m.scene, 0, 0);
  const alive = win ? g.prog < f.t + 0.5 : true, dying = win && g.prog >= f.t;
  const spawn = Math.min(1, (now - m.spawnT) / 350), eA = fx ? (dying ? Math.max(0, 1 - (g.prog - f.t) / 0.5) : 1) * spawn : (dying ? 0 : 1);
  const down = !win && !f.late && g.prog > CONFIG.rest * 0.8;
  const walking = win && dying && fx;
  const bobH = fx && !down ? (walking ? (Math.floor(now / 120) % 2) : (Math.sin(now / 380) > 0.55 ? 1 : 0)) : 0, bobE = fx ? (Math.sin(now / 430 + 1) > 0.55 ? 1 : 0) : 0;
  const hl = fx ? ease((now - m.hLunge) / 200) : 0, fl = fx ? ease((now - m.fLunge) / 220) : 0;
  const hs = getSprite('hero', hl > 0.3 ? 'attack' : 'idle'), es = getSprite(kind);
  const lift = kind === 'bat' ? 9 + (fx ? Math.round(Math.sin(now / 260) * 2) : 0) : 0;
  shadow(a, HERO[0], HERO[1] + 1, 9, 3);
  if (alive && eA > 0) shadow(a, FOE[0], FOE[1] + 1, boss ? 13 : 9, boss ? 4 : 3);
  const hx = Math.round(HERO[0] - 10 + hl * 7), hy = HERO[1] - hs.h + 3 - bobH + (down ? 0 : 0);
  a.globalAlpha = down ? 0.55 : 1;
  a.drawImage(m.rm || now - m.hFlash > 80 ? hs.img : hs.flash, hx - 2, hy);
  a.globalAlpha = 1;
  const ex = Math.round(FOE[0] - es.w / 2 - fl * 6), ey = FOE[1] - es.h + 3 - bobE - lift;
  if (alive && eA > 0) { a.globalAlpha = eA; a.drawImage(m.rm || now - m.fFlash > 80 ? es.img : es.flash, ex, ey); a.globalAlpha = 1; }
  // bars
  bar(a, HERO[0], hy - 5, 20, hF, '#62b05c');
  if (alive && eA > 0.5) bar(a, FOE[0], ey - 5 + lift * 0, boss ? 28 : 20, eF, '#c2403f');
  // floating numbers
  m.floats = m.floats.filter((fo) => now - fo.t < 900);
  for (const fo of m.floats) { const age = (now - fo.t) / 900; a.globalAlpha = age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1; text(a, fo.s, Math.round(fo.x - textW(fo.s) / 2), Math.round(fo.y - 16 * (1 - (1 - age) ** 2)), fo.c); }
  a.globalAlpha = 1;
  blit(m); m.drawn = now;
}

// Scale the art buffer up by a whole number, centred and cropped at the sides, crisp on any pixel ratio.
function blit(m) {
  const { cv, ctx } = m, dpr = window.devicePixelRatio || 1, w = cv.clientWidth, bw = Math.max(1, Math.round(w * dpr));
  const s = Math.max(1, Math.ceil(bw / (AW + 2 * PAD))), bh = AH * s, ch = bh / dpr + 'px';
  if (cv.style.height !== ch) cv.style.height = ch;
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  ctx.imageSmoothingEnabled = false;
  const ox = Math.floor((bw - (AW + 2 * PAD) * s) / 2);
  ctx.fillStyle = '#1d1d23'; ctx.fillRect(0, 0, bw, bh);
  ctx.drawImage(m.art, 0, 0, AW + 2 * PAD, AH, ox, 0, (AW + 2 * PAD) * s, bh);
}
