// Pixel sprites for the Tower: chibi 3/4 view units, drawn in code. Our own art.
// Maps are string rows, one char per pixel, '.' is clear. Each unit is built from a few shapes (a body grid and a limb/weapon grid), then posed into six frames,
// shaded with a ramp, and outlined selectively. Light comes from the top left, so shade and ink sit on the bottom and right.

/* ---- the shared 32 colour palette. Ramps shift hue: shadows toward blue/purple, highlights toward yellow. Some ramps share steps (goldD = woodM, fireD = redM, bone shade = warmL). ---- */
export const PAL = {
  ink: '#1c1530',                                                       // darkest outline, very dark blue-purple (never #000)
  umber: '#4a2438', white: '#fff6e4',                                   // umber is the dark of hair, wood and warm stone
  skinD: '#bf7176', skinM: '#eeb08c', skinL: '#fcdcb0',
  hairM: '#98482c', hairL: '#d47c38',
  woodM: '#7c4e3c', woodL: '#b87c4c',                                   // woodM is also the shadow of gold
  redD: '#6c1c3c', redM: '#b83a44', redL: '#ec6c5c',                    // redM is also the shadow of fire
  goldM: '#e6aa3a', goldL: '#ffe47e',                                   // goldL is also the highlight of fire
  coolD: '#343a5a', coolM: '#646c90', coolL: '#98a0bc', steelL: '#dce6f6',   // cool stone, and steel = coolM / coolL / steelL
  warmM: '#8a6e6c', warmL: '#bea68e',                                   // warm stone, and the shadow of bone
  greenD: '#234c42', greenM: '#4e9c52', greenL: '#a0d67c',
  purD: '#3a2a70', purM: '#7458b8', purL: '#b49cf0',
  blueD: '#2a4688', blueM: '#5a8ad8', blueL: '#a6dcf2',
  fireM: '#f08a2c', boneM: '#e2d6ba'
};
// Gear set accents (the 3 piece trim on the hero): one flat palette colour per set, keyed by move id. Roles '1' to '8' carry them in a map.
export const SET_COLOR = { hpush: 'redM', squat: 'blueM', hinge: 'goldM', row: 'greenM', core: 'boneM', vpush: 'blueL', calf: 'fireM', hamcurl: 'purM' };
const SET_ROLE = Object.fromEntries(Object.keys(SET_COLOR).map((id, i) => [id, String(i + 1)]));
// Letters are roles in a pixel map; each points at a palette colour. Uppercase/lowercase pairs are base and shade.
const ROLE = {
  k: 'ink', s: 'skinM', S: 'skinD', T: 'skinL', h: 'hairM', H: 'umber', J: 'hairL', r: 'redM', R: 'redD', q: 'redL', o: 'goldM', O: 'woodM', P: 'goldL',
  e: 'coolL', E: 'coolM', W: 'steelL', n: 'woodM', N: 'umber', m: 'woodL', g: 'greenM', G: 'greenD', y: 'greenL', p: 'purM', u: 'purD', v: 'purL',
  b: 'boneM', B: 'warmL', c: 'white', K: 'warmM', a: 'coolM', A: 'coolD', f: 'coolL', z: 'ink', d: 'redL', x: 'goldM', X: 'fireM', w: 'white',
  l: 'blueM', L: 'blueD', i: 'white', I: 'blueL', j: 'blueM', Y: 'goldL', Z: 'white', U: 'blueL', C: 'greenL', V: 'greenD',
  ...Object.fromEntries(Object.entries(SET_COLOR).map(([id, n]) => [SET_ROLE[id], n]))
};
export const PALETTE = Object.fromEntries(Object.entries(ROLE).map(([k, n]) => [k, PAL[n]]));
// base role -> [shade on the lower/right rim, light on the upper/left rim]
const SHADE = { h: 'HJ', s: 'ST', r: 'Rq', o: 'OP', e: 'EW', n: 'Nm', g: 'Gy', p: 'uv', b: 'Bc', a: 'Af', E: 'Ae', I: 'jw', Z: 'Uw', C: 'Vy', X: 'rx' };
// base role -> role of the darkest step of its ramp: the outline colour on the lit (top and left) side
const OUTL = { s: 'S', S: 'S', T: 'S', h: 'H', J: 'H', H: 'k', r: 'R', q: 'R', R: 'k', o: 'O', P: 'O', O: 'H', e: 'A', E: 'A', W: 'A', n: 'H', m: 'H', N: 'k', g: 'G', y: 'G', G: 'k', p: 'u', v: 'u', u: 'k', b: 'K', B: 'K', c: 'K', a: 'A', f: 'A', A: 'k', X: 'r', x: 'X', Y: 'X', I: 'L', j: 'L', l: 'L', i: 'j', Z: 'j', U: 'j', C: 'V', V: 'k', K: 'k' };

/* ---- drawing helpers. g.ox shifts everything right, leaving room on the left for a swung weapon ---- */
let clips = 0;   // pixels lost off the edge of a limb grid (a weapon swung out of its frame); the tests expect 0
export const clipped = () => clips;
export const CLIPS = {};   // per unit and frame, for the tests
const grid = (w, h, ox = 0, strict = false) => { const g = Array.from({ length: h }, () => Array(w).fill('.')); g.ox = ox; g.strict = strict; return g; };
const px = (g, x, y, c) => {
  x = Math.round(x) + g.ox; y = Math.round(y);
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; else if (g.strict && c !== '.') clips++;
};
const rect = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, c); };
const ell = (g, cx, cy, rx, ry, c, clip) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (!clip || clip(x, y))) px(g, x, y, c);
};
const line = (g, x0, y0, x1, y1, c) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) px(g, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
};
const mirror = (g, cx) => { cx += g.ox; for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] !== '.') { const mx = 2 * cx - x; if (mx >= 0 && mx < g[0].length && g[y][mx] === '.') g[y][mx] = g[y][x]; } };
// A shaft of 1 to 4 px, first colour on the upper/left edge.
function stripe(g, x0, y0, x1, y1, cols) {
  const steep = Math.abs(y1 - y0) >= Math.abs(x1 - x0), o = Math.floor((cols.length - 1) / 2);
  cols.forEach((c, i) => { const d = i - o; line(g, x0 + (steep ? d : 0), y0 + (steep ? 0 : d), x1 + (steep ? d : 0), y1 + (steep ? 0 : d), c); });
}
// Weapons swing about a grip that stays put. A is the angle from straight up toward the foe in degrees, dir is the facing (+1 right, -1 left).
// u runs along the shaft toward the tip, f runs across it toward the foe side.
const frameOf = (A, dir) => { const a = A * Math.PI / 180; return { ux: dir * Math.sin(a), uy: -Math.cos(a), fx: dir * Math.cos(a), fy: Math.sin(a) }; };
const at = (G, gx, gy, along, across = 0) => [gx + G.ux * along + G.fx * across, gy + G.uy * along + G.fy * across];
function shaft(g, gx, gy, A, dir, from, to, cols) { const G = frameOf(A, dir), [x0, y0] = at(G, gx, gy, from), [x1, y1] = at(G, gx, gy, to); stripe(g, x0, y0, x1, y1, cols); }
function guard(g, gx, gy, A, dir, along, half, c) { const G = frameOf(A, dir), [x0, y0] = at(G, gx, gy, along, -half), [x1, y1] = at(G, gx, gy, along, half); line(g, x0, y0, x1, y1, c); }
const IDX = { idle: 0, windup: 1, strike: 2, hurt: 3 };

/* ---- poses: move the top of a map, leave everything from the split row down alone, so the feet never move ---- */
const copy = (g) => g.map((r) => r.slice());
// squash: rows above split move down n px
function bob(g, split, n = 1) { const o = copy(g); for (let y = split - 1; y >= 0; y--) o[y + n] = g[y].slice(); for (let y = 0; y < n; y++) o[y] = Array(g[0].length).fill('.'); return o; }
// lean: rows above split slide sideways, more the higher they are (a shear), dx is the shift at the top
function lean(g, split, dx) {
  const w = g[0].length, o = grid(w, g.length);
  for (let y = 0; y < g.length; y++) { const s = y < split ? Math.round(dx * (split - y) / split) : 0; for (let x = 0; x < w; x++) if (g[y][x] !== '.' && x + s >= 0 && x + s < w) o[y][x + s] = g[y][x]; }
  return o;
}
const overlay = (b, l) => { const o = copy(b); if (l) for (let y = 0; y < l.length; y++) for (let x = 0; x < l[0].length; x++) if (l[y][x] !== '.') o[y][x] = l[y][x]; return o; };
// Collapse: squash to about half height on the ground and slump away from the foe.
function crumple(src, dir) {
  const h = src.length, w = src[0].length, o = grid(w, h); let top = h, bot = -1;
  src.forEach((r, y) => { if (r.some((c) => c !== '.')) { top = Math.min(top, y); bot = y; } });
  const hh = bot - top + 1, th = Math.max(4, Math.round(hh * 0.5));
  for (let ty = 0; ty < th; ty++) {
    const sy = bot - Math.round(ty * (hh - 1) / (th - 1)), s = -dir * Math.round(ty * 0.35);
    for (let x = 0; x < w; x++) if (src[sy][x] !== '.' && x + s >= 0 && x + s < w) o[bot - ty][x + s] = src[sy][x];
  }
  return o;
}

/* ---- shading and selective outline ----
   Bevel: a base pixel on the lower or right edge takes its shade, on the upper or left edge its light (bosses get a 2 px shade band).
   Outline: a clear pixel touching a fill. If the fill is above or to the left of it (the shadow side) it is the darkest ink, so the shape reads on any floor;
   on the lit side it takes the darkest step of the neighbour's own ramp. */
function finish(g, thick = false) {
  const h = g.length, w = g[0].length, src = copy(g), get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : src[y][x]), out = copy(g);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = SHADE[src[y][x]]; if (!s) continue;
    if (get(x, y + 1) === '.' || get(x + 1, y) === '.' || (thick && (get(x, y + 2) === '.' || get(x + 2, y) === '.') && get(x, y + 1) === src[y][x])) out[y][x] = s[0];
    else if (get(x, y - 1) === '.' || get(x - 1, y) === '.') out[y][x] = s[1];
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[y][x] !== '.') continue;
    const up = get(x, y - 1), lf = get(x - 1, y), dn = get(x, y + 1), rt = get(x + 1, y);
    if (up !== '.' || lf !== '.') out[y][x] = 'k';
    else if (dn !== '.' || rt !== '.') { const f = dn !== '.' ? dn : rt; out[y][x] = OUTL[f] || 'k'; }
  }
  return out.map((r) => r.join(''));
}

/* ---- the units. Each def: size, ox (left room for a swung weapon), dir (facing), split (row the idle bob and lean pivot on), draw(body, limb, pose) ----
   pose: { n: 'idle'|'windup'|'strike'|'hurt', alt: idle frame B, I: index into per-pose arrays }. */
const GRIPS = [[18, 18, 8], [18, 12, -22], [18, 15, 86], [16, 20, -40]];   // the hero's hand and sword angle per pose: idle, windup, strike, hurt. Every weapon overlay shares these, so swapping weapons never moves the hand
const HERO = {
  w: 32, h: 28, px: 12, dir: 1, split: 19, lean: [1, 2, 2],
  // the bare base: legs, simple shoes, red tunic, head and the sleeve. Weapon, armour and boots are overlays on top (see "the hero paper doll" below)
  draw(b, l, P) {
    const X = 4, hurt = P.n === 'hurt';
    rect(b, X + 2, 21, 3, 6, 'n'); rect(b, X + 7, 21, 3, 6, 'n');           // legs
    rect(b, X + 1, 25, 5, 2, 'N'); rect(b, X + 6, 25, 5, 2, 'N');            // boots, toes point right
    rect(b, X, 14, 11, 8, 'r'); rect(b, X, 19, 11, 1, 'o'); rect(b, X + 1, 14, 9, 1, 'o');   // tunic, belt, collar
    px(b, X + 5, 16, 'o'); px(b, X + 5, 17, 'o'); px(b, X + 4, 16, 'o'); px(b, X + 6, 16, 'o');
    rect(b, X - 2, 15, 3, 3, 'r'); rect(b, X - 2, 18, 2, 2, 's');            // back arm
    ell(b, X + 5.5, 8, 6.5, 6.5, 's');                                         // big head
    ell(b, X + 2, 9, 3.2, 5, 'h'); ell(b, X + 5.5, 6, 6.5, 4.5, 'h', (x, y) => y <= 7);   // hair: back and cap
    rect(b, X + 7, 5, 6, 2, 'h'); px(b, X + 12, 7, 'h'); px(b, X + 12, 8, 'h');            // fringe
    for (const ex of [X + 8, X + 11]) { if (hurt) { px(b, ex, 10, 'k'); px(b, ex + 1, 10, 'k'); } else { px(b, ex, 9, 'k'); px(b, ex, 10, 'k'); } }   // eyes (squeezed shut when hurt)
    if (hurt) { px(b, X + 10, 13, 'k'); px(b, X + 11, 13, 'k'); } else { px(b, X + 10, 13, 'S'); px(b, X + 11, 13, 'S'); }   // mouth
    px(b, X + 7, 12, 'q');                                                    // blush
    const [gx, gy] = GRIPS[P.I];
    stripe(l, X + 10, 15, gx - 1, gy - 1, ['r', 'r']);                        // sleeve from the shoulder
  },
  down(b) {   // lying on the back, head away from the foe
    ell(b, 7, 21.5, 5.5, 5.5, 's'); ell(b, 4.5, 22, 3.6, 5, 'h'); ell(b, 7, 18.5, 5.5, 3, 'h', (x, y) => y <= 19);
    px(b, 9, 21, 'k'); px(b, 10, 21, 'k'); px(b, 12, 21, 'k'); px(b, 13, 21, 'k'); px(b, 11, 24, 'S'); px(b, 12, 24, 'S');
    rect(b, 12, 19, 10, 8, 'r'); rect(b, 17, 19, 1, 8, 'o'); rect(b, 13, 20, 8, 1, 'o');   // tunic, belt
    rect(b, 14, 22, 4, 2, 's'); rect(b, 22, 22, 5, 5, 'n'); rect(b, 27, 21, 3, 6, 'N');
    rect(b, 12, 26, 18, 1, 'N');
  }
};
const slime = {
  w: 24, h: 28, split: 18, lean: [1, 3, 2],
  draw(b) {
    ell(b, 12, 21, 10, 7, 'g', (x, y) => y <= 27); ell(b, 11, 14.5, 4.5, 3, 'g');
    for (const [x, y] of [[7, 15], [8, 15], [7, 16], [14, 20], [15, 21]]) px(b, x, y, 'y');
    for (const ex of [6, 12]) { rect(b, ex, 18, 4, 4, 'w'); rect(b, ex, 19, 2, 3, 'k'); px(b, ex + 2, 18, 'w'); }
    rect(b, 8, 24, 4, 1, 'G'); px(b, 7, 23, 'G'); px(b, 12, 23, 'G');
    px(b, 20, 24, 'y'); px(b, 3, 26, 'y');
  }
};
const bat = {
  w: 24, h: 28, split: 17, lean: [1, 2, 2],
  draw(b, l, P) {
    const dy = P.alt ? 2 : { idle: 0, windup: -4, strike: 3, hurt: -1 }[P.n];    // wing beat: up on windup, swept down on the strike
    ell(b, 5, 13 + dy, 5, 4.5, 'u', (x, y) => y < 17 + dy - (x % 2)); mirror(b, 11.5);
    ell(b, 11.5, 15, 4, 5, 'p'); ell(b, 11.5, 10, 4.5, 4, 'p');
    rect(b, 7, 4, 2, 4, 'p'); rect(b, 15, 4, 2, 4, 'p'); px(b, 8, 4, 'v'); px(b, 15, 4, 'v');
    rect(b, 8, 10, 2, 2, 'd'); rect(b, 13, 10, 2, 2, 'd'); px(b, 8, 10, 'w');
    px(b, 10, 14, 'w'); px(b, 13, 14, 'w');
    line(b, 6, 12 + dy, 3, 16 + dy, 'u'); line(b, 17, 12 + dy, 20, 16 + dy, 'u');
  }
};
const skeleton = {
  w: 30, h: 28, ox: 6, dir: -1, split: 19, lean: [1, 2, 2],
  draw(b, l, P) {
    ell(b, 12, 8, 6.5, 6, 'b'); rect(b, 9, 13, 7, 2, 'b');
    rect(b, 8, 7, 3, 3, 'k'); rect(b, 13, 7, 3, 3, 'k'); px(b, 8, 8, 'd'); px(b, 13, 8, 'd'); px(b, 11, 11, 'k'); px(b, 12, 11, 'k');
    for (const x of [10, 12, 14]) px(b, x, 14, 'k');
    rect(b, 11, 15, 2, 6, 'b'); for (const y of [16, 18, 20]) rect(b, 8, y, 8, 1, 'b');
    rect(b, 7, 17, 1, 3, 'B'); rect(b, 16, 17, 1, 3, 'B');
    rect(b, 9, 21, 6, 2, 'b'); rect(b, 10, 23, 2, 4, 'b'); rect(b, 13, 23, 2, 4, 'b'); rect(b, 8, 26, 4, 1, 'b'); rect(b, 13, 26, 4, 1, 'b');
    rect(b, 9, 20, 6, 1, 'R');
    const [gx, gy, A] = [[4, 17, 8], [5, 14, -14], [4, 18, 60], [6, 19, -30]][P.I];
    line(l, 8, 16, gx + 1, gy, 'b'); line(l, 8, 17, gx + 1, gy + 1, 'B');     // arm bones
    shaft(l, gx, gy, A, -1, -2, 0, ['n']); shaft(l, gx, gy, A, -1, 2, 12, ['E']); guard(l, gx, gy, A, -1, 1, 2, 'O');
    for (const t of [5, 8]) { const G = frameOf(A, -1), [x, y] = at(G, gx, gy, t); px(l, x, y, 'R'); }   // rust
    rect(l, gx, gy - 1, 2, 3, 'b');
  }
};
const golem = {
  w: 28, h: 28, ox: 4, dir: -1, split: 22, lean: [1, 3, 2],
  draw(b, l, P) {
    rect(b, 6, 22, 5, 5, 'a'); rect(b, 13, 22, 5, 5, 'a');
    rect(b, 5, 11, 14, 11, 'a'); rect(b, 8, 3, 8, 8, 'a');
    rect(b, 19, 12, 5, 10, 'A'); rect(b, 19, 20, 5, 5, 'a'); rect(b, 4, 11, 2, 4, 'A');
    rect(b, 9, 6, 2, 2, 'x'); rect(b, 13, 6, 2, 2, 'x'); px(b, 9, 6, 'w');
    px(b, 11, 15, 'x'); px(b, 12, 15, 'x'); px(b, 11, 16, 'X'); px(b, 12, 16, 'X'); px(b, 11, 14, 'x'); px(b, 12, 17, 'X');
    line(b, 7, 12, 9, 18, 'z'); line(b, 16, 14, 14, 21, 'z');
    for (const [x, y] of [[6, 11], [7, 11], [14, 11], [15, 11], [20, 12], [8, 3], [9, 3]]) px(b, x, y, 'g');
    for (const [x, y] of [[6, 12], [15, 12]]) px(b, x, y, 'G');
    rect(b, 8, 10, 8, 1, 'A');
    const [ax, ay] = [[0, 12], [0, 4], [-3, 12], [1, 12]][P.I];             // the near arm: raised for the windup, slammed forward on the strike
    rect(l, ax, ay, 5, 10, 'A'); rect(l, ax, ay + 8, 5, 5, 'a'); line(l, ax + 1, ay + 2, ax + 2, ay + 6, 'z');
    if (P.I === 1 || P.I === 2) rect(l, 3, 11, 3, 4, 'A');                  // shoulder stays joined
    if (P.I === 3 || P.I === 0) line(l, 1, 14, 2, 18, 'z');
    px(l, 2, 24, 'g');
  }
};
const rat = {
  w: 24, h: 28, split: 22, lean: [1, 3, 2],
  draw(b) {
    line(b, 20, 23, 23, 20, 'q'); line(b, 23, 20, 22, 16, 'q');                  // tail
    ell(b, 13, 21, 8, 5.5, 'n'); ell(b, 7, 19, 5, 4.5, 'n'); rect(b, 1, 20, 4, 3, 'n'); px(b, 1, 21, 'q'); px(b, 1, 20, 'q');   // body, head, snout
    rect(b, 10, 15, 9, 3, 'e'); ell(b, 14.5, 18, 5, 2.5, 'e'); rect(b, 12, 17, 1, 3, 'E'); rect(b, 16, 17, 1, 3, 'E');          // back plate
    ell(b, 8, 15.5, 4.5, 3, 'e', (x, y) => y <= 16); rect(b, 4, 15, 2, 4, 'E'); rect(b, 9, 12, 1, 3, 'e');                       // helm, nose guard, spike
    ell(b, 10, 14, 1.6, 1.6, 'q'); px(b, 6, 19, 'd'); px(b, 5, 19, 'd'); rect(b, 3, 22, 2, 1, 'w');                              // ear, eye, tooth
    rect(b, 7, 25, 3, 3, 'N'); rect(b, 17, 25, 3, 3, 'N'); rect(b, 4, 26, 3, 1, 'N');
  }
};
const mushroom = {
  w: 24, h: 28, split: 14, lean: [1, 2, 2],
  draw(b) {
    rect(b, 7, 14, 10, 10, 'b'); rect(b, 6, 23, 5, 4, 'B'); rect(b, 13, 23, 5, 4, 'B');                   // stem and feet
    ell(b, 12, 10, 11, 8, 'r', (x, y) => y <= 14); rect(b, 3, 13, 18, 2, 'R');                            // cap, underside
    for (const [x, y, w] of [[7, 5, 3], [14, 4, 3], [11, 9, 2], [4, 10, 2], [18, 9, 2], [9, 12, 2]]) rect(b, x, y, w, w, 'c');
    rect(b, 9, 17, 2, 3, 'k'); rect(b, 13, 17, 2, 3, 'k'); px(b, 9, 17, 'w'); px(b, 13, 17, 'w'); rect(b, 11, 21, 3, 1, 'B');   // eyes, mouth
    rect(b, 4, 17, 3, 2, 'b'); rect(b, 17, 17, 3, 2, 'b');                                                // nubs
  }
};
const goblin = {
  w: 30, h: 28, ox: 6, dir: -1, split: 19, lean: [1, 2, 2],
  draw(b, l, P) {
    rect(b, 9, 22, 3, 5, 'n'); rect(b, 13, 22, 3, 5, 'n'); rect(b, 7, 26, 5, 1, 'N'); rect(b, 12, 26, 5, 1, 'N');
    rect(b, 8, 14, 9, 9, 'n'); rect(b, 8, 19, 9, 1, 'N'); rect(b, 10, 14, 5, 2, 'o');                       // tunic, belt, collar
    ell(b, 12.5, 9, 6, 5.5, 'g'); rect(b, 1, 6, 7, 2, 'g'); rect(b, 17, 6, 7, 2, 'g'); px(b, 0, 5, 'g'); px(b, 24, 5, 'g'); rect(b, 3, 8, 4, 1, 'g'); rect(b, 18, 8, 4, 1, 'g'); px(b, 2, 8, 'g'); px(b, 22, 8, 'g');   // head, long ears
    rect(b, 8, 8, 3, 3, 'x'); rect(b, 14, 8, 3, 3, 'x'); px(b, 9, 9, 'k'); px(b, 9, 10, 'k'); px(b, 15, 9, 'k'); px(b, 15, 10, 'k');
    rect(b, 10, 12, 5, 1, 'G'); px(b, 10, 13, 'w'); px(b, 14, 13, 'w'); rect(b, 11, 10, 3, 2, 'G');            // grin, fangs, big nose
    rect(b, 17, 16, 3, 3, 'g');                                                                              // far arm
    const [gx, gy, A] = [[4, 18, 6], [5, 15, -22], [3, 18, 70], [6, 19, -30]][P.I];
    line(l, 8, 17, gx + 1, gy, 'g'); line(l, 8, 18, gx + 1, gy + 1, 'g'); rect(l, gx, gy, 2, 2, 'g');
    shaft(l, gx, gy, A, -1, -2, 0, ['n']); shaft(l, gx, gy, A, -1, 2, 9, ['W']); guard(l, gx, gy, A, -1, 1, 2, 'o');   // dagger
  }
};
const imp = {
  w: 28, h: 28, ox: 4, dir: -1, split: 18, lean: [1, 2, 2],
  draw(b, l, P) {
    ell(b, 4.5, 12, 4, 5, 'R', (x, y) => y < 16 - (x % 2)); mirror(b, 11.5);                                // wings
    rect(b, 8, 21, 3, 5, 'r'); rect(b, 13, 21, 3, 5, 'r'); rect(b, 6, 25, 5, 2, 'R'); rect(b, 12, 25, 5, 2, 'R');
    ell(b, 12, 17, 5, 5, 'r'); ell(b, 12, 9, 6.5, 5.5, 'r');
    line(b, 17, 20, 21, 22, 'r'); line(b, 21, 22, 22, 25, 'r'); rect(b, 21, 24, 3, 3, 'R'); px(b, 22, 23, 'R');   // tail and barb
    rect(b, 7, 2, 2, 4, 'b'); rect(b, 15, 2, 2, 4, 'b'); px(b, 7, 2, 'c'); px(b, 15, 2, 'c'); px(b, 8, 6, 'B'); px(b, 15, 6, 'B');
    rect(b, 8, 8, 3, 3, 'Y'); rect(b, 13, 8, 3, 3, 'Y'); px(b, 8, 9, 'k'); px(b, 8, 10, 'k'); px(b, 13, 9, 'k'); px(b, 13, 10, 'k');
    rect(b, 9, 12, 6, 1, 'k'); px(b, 9, 13, 'w'); px(b, 11, 13, 'w'); px(b, 13, 13, 'w'); px(b, 12, 15, 'q');
    rect(b, 16, 17, 2, 3, 'r');
    const [hx, hy] = [[7, 19], [6, 12], [1, 17], [8, 20]][P.I];             // the clawing arm
    stripe(l, 9, 16, hx + 1, hy, ['r', 'r']); rect(l, hx, hy, 2, 2, 'R'); px(l, hx - 1, hy, 'c'); px(l, hx - 1, hy + 2, 'c');
  }
};
const wisp = {
  w: 28, h: 28, ox: 4, dir: -1, split: 19, lean: [1, 2, 2],
  draw(b, l, P) {
    ell(b, 12, 10, 8, 7.5, 'Z'); rect(b, 4, 10, 17, 10, 'Z');
    for (let x = 4; x <= 20; x++) { const d = Math.round(Math.sin(x * 0.9) * 1.5); rect(b, x, 20, 1, 3 + d + (x % 3 === 0 ? 3 : 0), 'Z'); }   // ragged hem
    rect(b, 20, 14, 3, 3, 'Z'); stripe(b, 19, 23, 23, 18, ['Z', 'Z']); px(b, 23, 17, 'Z');   // far arm, and a curl of tail
    rect(b, 7, 8, 3, 5, 'k'); rect(b, 14, 8, 3, 5, 'k'); px(b, 7, 8, 'l'); px(b, 14, 8, 'l'); px(b, 8, 9, 'w'); px(b, 15, 9, 'w');
    rect(b, 10, 15, 4, 3, 'k'); px(b, 11, 14, 'k'); px(b, 12, 14, 'k');
    for (const x of [8, 12, 16]) px(b, x, 3, 'Z');                                                             // tufted top, so it reads as a sheet and not a blob
    const [hx, hy] = [[1, 16], [2, 9], [-3, 15], [3, 17]][P.I];            // the reaching arm
    stripe(l, 6, 14, hx + 1, hy, ['Z', 'Z', 'Z']); rect(l, hx, hy - 1, 2, 3, 'Z');
  }
};
const cultist = {
  w: 30, h: 28, ox: 6, dir: -1, split: 18, lean: [1, 2, 2],
  draw(b, l, P) {
    for (let y = 12; y < 27; y++) { const w = 4 + Math.floor((y - 12) * 0.55); rect(b, 12 - w, y, 2 * w, 1, 'p'); }   // robe flares out
    rect(b, 6, 25, 12, 2, 'u'); rect(b, 11, 14, 2, 12, 'u'); rect(b, 8, 19, 8, 1, 'o');
    ell(b, 12, 9, 6, 6, 'u'); rect(b, 11, 0, 2, 3, 'u'); rect(b, 10, 2, 4, 2, 'u'); ell(b, 12, 9.5, 3.6, 3.8, 'k');   // pointed hood, shadowed face
    rect(b, 9, 8, 2, 2, 'x'); rect(b, 13, 8, 2, 2, 'x'); px(b, 9, 8, 'w'); px(b, 13, 8, 'w');
    rect(b, 16, 15, 4, 3, 'p'); rect(b, 19, 17, 2, 2, 's');
    const [gx, gy, A] = [[4, 17, 2], [5, 17, -22], [4, 17, 38], [6, 18, -30]][P.I];   // the staff pole is planted when idle and swings from the hand
    rect(l, gx, gy - 1, 5, 3, 'p'); rect(l, gx - 1, gy, 2, 2, 's');
    shaft(l, gx, gy, A, -1, -8, 11, ['n', 'm']);
    const G = frameOf(A, -1), [ox, oy] = at(G, gx, gy, 13); ell(l, ox, oy, 2.4, 2.4, 'd'); px(l, ox - 1, oy - 1, 'w');
  }
};
const spider = {
  w: 28, h: 28, ox: 4, dir: -1, split: 15, lean: [1, 2, 2], alt: true,
  draw(b, l, P) {
    const dy = P.alt || P.n === 'windup' ? -1 : 0, leg = (g, x0, y0, x1, y1, x2, y2) => { for (const d of [0, 1]) { line(g, x0, y0 + d + dy, x1, y1 + d, 'a'); line(g, x1, y1 + d, x2, y2 + d, 'a'); } };
    const L = [[16, 9, 15, 6], [17, 12, 20, 8], [18, 15, 24, 8], [19, 18, 26, 5]];
    L.forEach(([y0, y1, y2, o], i) => { if (i) leg(b, 10, y0, 10 - o, y1, 10 - o - 3, y2); leg(b, 14, y0, 14 + o, y1, 14 + o + 3, y2); });
    const [kx, ky, fx, fy] = [[4, 9, 1, 15], [3, 5, 1, 10], [-1, 11, -4, 15], [5, 10, 2, 16]][P.I];   // the front leg: raised for the windup, stabbed forward on the strike
    leg(l, 10, 16, kx, ky, fx, fy);
    ell(b, 14, 19 + dy, 6, 5, 'p'); ell(b, 9, 17 + dy, 4.5, 4, 'u');                                           // abdomen, head
    for (const [x, y] of [[14, 17], [14, 18], [13, 19], [15, 19], [14, 20], [14, 21]]) px(b, x, y + dy, 'd');
    px(b, 12, 15 + dy, 'v'); px(b, 13, 15 + dy, 'v');
    rect(b, 6, 15 + dy, 2, 2, 'd'); rect(b, 10, 15 + dy, 2, 2, 'd'); px(b, 6, 15 + dy, 'w'); px(b, 10, 15 + dy, 'w'); rect(b, 5, 19 + dy, 1, 3, 'w'); rect(b, 8, 20 + dy, 1, 2, 'w');
  }
};
const gargoyle = {
  w: 28, h: 28, ox: 4, dir: -1, split: 19, lean: [1, 2, 2],
  draw(b, l, P) {
    ell(b, 4, 12, 4, 7, 'A', (x, y) => y < 18 - (x % 2) * 2); mirror(b, 11.5);
    rect(b, 6, 24, 5, 3, 'a'); rect(b, 13, 24, 5, 3, 'a'); rect(b, 5, 26, 6, 1, 'A'); rect(b, 13, 26, 6, 1, 'A');
    ell(b, 12, 18, 6, 6, 'a'); ell(b, 12, 10, 5.5, 5, 'a');
    rect(b, 7, 2, 2, 5, 'a'); rect(b, 15, 2, 2, 5, 'a'); px(b, 7, 2, 'f'); px(b, 15, 2, 'f');
    rect(b, 8, 9, 3, 2, 'd'); rect(b, 13, 9, 3, 2, 'd'); px(b, 8, 9, 'w'); rect(b, 7, 7, 4, 1, 'z'); rect(b, 13, 7, 4, 1, 'z');
    rect(b, 9, 13, 6, 2, 'z'); px(b, 9, 15, 'w'); px(b, 14, 15, 'w');
    line(b, 9, 17, 11, 21, 'z'); line(b, 15, 17, 13, 21, 'z'); rect(b, 17, 19, 3, 4, 'a');
    const [hx, hy] = [[4, 20], [4, 12], [-1, 18], [5, 21]][P.I];            // the clawing arm
    stripe(l, 8, 17, hx + 1, hy, ['a', 'a']); rect(l, hx, hy, 3, 4, 'a'); px(l, hx, hy + 4, 'w'); px(l, hx + 2, hy + 4, 'w');
  }
};
const ember = {
  w: 24, h: 28, split: 16, lean: [1, 3, 2],
  draw(b) {
    ell(b, 12, 18, 9, 8, 'X'); ell(b, 12, 11, 6, 8, 'X');
    for (const [x, y, h] of [[6, 5, 6], [10, 0, 8], [14, 3, 7], [18, 7, 6], [3, 12, 5], [21, 14, 5]]) { for (let k = 0; k < h; k++) rect(b, x - Math.floor(k / 4), y + h - k, Math.max(1, 4 - Math.floor(k * 0.7)), 1, 'X'); }
    ell(b, 12, 19, 6.5, 6, 'x'); ell(b, 12, 13, 4, 6, 'x'); ell(b, 12, 21, 3.5, 3.5, 'Y');
    rect(b, 8, 15, 3, 4, 'k'); rect(b, 14, 15, 3, 4, 'k'); px(b, 8, 15, 'w'); px(b, 14, 15, 'w'); rect(b, 10, 22, 5, 1, 'k'); px(b, 10, 21, 'k'); px(b, 14, 21, 'k');
  }
};
const frost = {
  w: 28, h: 28, ox: 4, dir: -1, split: 22, lean: [1, 3, 2],
  draw(b, l, P) {
    rect(b, 6, 22, 5, 5, 'I'); rect(b, 13, 22, 5, 5, 'I');
    rect(b, 5, 11, 14, 11, 'I'); rect(b, 8, 4, 8, 7, 'I');
    rect(b, 19, 13, 5, 10, 'j'); rect(b, 19, 21, 5, 4, 'I'); rect(b, 4, 12, 2, 4, 'j');
    for (const [x, y, h] of [[4, 4, 8], [18, 4, 8], [9, 0, 5], [13, 0, 4]]) rect(b, x, y, 2, h, 'i');      // crystal spikes
    px(b, 4, 4, 'w'); px(b, 18, 4, 'w'); px(b, 9, 0, 'w');
    rect(b, 9, 6, 2, 2, 'L'); rect(b, 13, 6, 2, 2, 'L'); px(b, 9, 6, 'w'); px(b, 13, 6, 'w');
    rect(b, 10, 14, 4, 4, 'i'); px(b, 11, 15, 'w'); px(b, 12, 16, 'l');
    line(b, 7, 12, 9, 18, 'j'); line(b, 16, 13, 14, 20, 'j');
    const [ax, ay] = [[0, 13], [0, 5], [-3, 13], [1, 13]][P.I];
    rect(l, ax, ay, 5, 10, 'j'); rect(l, ax, ay + 8, 5, 4, 'I'); line(l, ax + 1, ay + 2, ax + 2, ay + 6, 'i');
    if (P.I === 1 || P.I === 2) rect(l, 3, 12, 3, 4, 'j');
  }
};
const mimic = {
  w: 24, h: 28, split: 18, lean: [1, 3, 2],
  draw(b) {
    rect(b, 3, 15, 18, 11, 'n'); rect(b, 3, 20, 18, 2, 'o'); rect(b, 3, 15, 18, 1, 'o'); rect(b, 10, 20, 4, 4, 'Y');   // body, bands, lock
    ell(b, 12, 9, 10, 6, 'n', (x, y) => y <= 11); rect(b, 2, 9, 20, 2, 'o'); rect(b, 11, 4, 2, 7, 'o');            // lid, hinge band
    rect(b, 4, 11, 16, 5, 'k'); rect(b, 12, 12, 6, 4, 'r'); rect(b, 13, 15, 4, 1, 'q');                         // open mouth, tongue
    for (let x = 5; x < 20; x += 3) { rect(b, x, 11, 2, 2, 'w'); rect(b, x + 1, 14, 2, 2, 'w'); }                 // teeth
    rect(b, 6, 6, 3, 3, 'x'); rect(b, 15, 6, 3, 3, 'x'); px(b, 7, 7, 'k'); px(b, 16, 7, 'k');                   // eyes on the lid
    rect(b, 4, 26, 4, 2, 'N'); rect(b, 16, 26, 4, 2, 'N'); rect(b, 1, 17, 3, 4, 'q'); rect(b, 20, 17, 3, 4, 'q');
  }
};

/* ---- bosses, 32 x 40 body, drawn in a 48 wide frame so a swung weapon has room ---- */
const TROLL = {
  w: 48, h: 40, ox: 16, dir: -1, split: 28, lean: [1, 3, 2], thick: true,
  draw(b, l, P) {
    rect(b, 10, 32, 6, 7, 'g'); rect(b, 18, 32, 6, 7, 'g'); rect(b, 9, 37, 8, 3, 'N'); rect(b, 17, 37, 8, 3, 'N');
    rect(b, 8, 18, 18, 15, 'g'); rect(b, 8, 28, 18, 5, 'n'); rect(b, 8, 28, 18, 1, 'o'); rect(b, 13, 22, 8, 2, 'G'); rect(b, 12, 25, 10, 1, 'G');   // belly, loincloth, belt, ribs
    ell(b, 6, 22, 5, 5, 'g'); ell(b, 28, 22, 5, 5, 'g'); rect(b, 3, 25, 6, 8, 'g'); rect(b, 25, 25, 5, 7, 'g');
    ell(b, 17, 11, 8.5, 8, 'g'); rect(b, 10, 17, 14, 3, 'G');
    rect(b, 10, 9, 3, 3, 'Y'); rect(b, 20, 9, 3, 3, 'Y'); px(b, 11, 10, 'k'); px(b, 21, 10, 'k'); rect(b, 9, 7, 5, 1, 'G'); rect(b, 19, 7, 5, 1, 'G');
    rect(b, 11, 15, 12, 3, 'k'); for (const x of [12, 14, 19, 21]) rect(b, x, 13, 1, 2, 'w'); rect(b, 15, 12, 3, 2, 'G');   // jaw, tusks
    rect(b, 9, 1, 16, 4, 'o'); for (const x of [9, 13, 17, 21, 24]) rect(b, x, 0, 2, 2, 'o'); rect(b, 12, 2, 2, 2, 'd'); rect(b, 19, 2, 2, 2, 'l');   // crown
    rect(b, 2, 31, 6, 4, 'G');                                                                                // fist
    const A = [4, -14, 38, -26][P.I], gx = 4, gy = 32;                      // club grip
    shaft(l, gx, gy, A, -1, -4, 8, ['n', 'n', 'N']); shaft(l, gx, gy, A, -1, 9, 28, ['m', 'n', 'n', 'N']);
    const G = frameOf(A, -1);
    for (const [t, s] of [[29, -3], [29, 3], [26, 4], [26, -4], [30, 0]]) { const [x, y] = at(G, gx, gy, t, s); px(l, x, y, 'e'); }   // spikes
    rect(l, gx - 2, gy - 1, 6, 4, 'g');                                                                     // fist over the grip
  }
};
const lich = {
  w: 48, h: 40, ox: 16, dir: -1, split: 26, lean: [1, 2, 2], thick: true,
  draw(b, l, P) {
    for (let y = 16; y < 40; y++) { const w = 6 + Math.floor((y - 16) * 0.5); rect(b, 17 - w, y, 2 * w, 1, 'p'); }
    rect(b, 6, 36, 22, 3, 'u'); rect(b, 15, 18, 4, 20, 'u'); rect(b, 9, 24, 16, 1, 'o'); rect(b, 12, 30, 10, 1, 'v');
    ell(b, 7, 20, 4.5, 3.5, 'u'); ell(b, 27, 20, 4.5, 3.5, 'u'); rect(b, 4, 22, 4, 6, 'p');
    ell(b, 17, 10, 7, 7.5, 'b'); rect(b, 13, 15, 8, 3, 'b'); rect(b, 10, 8, 4, 4, 'k'); rect(b, 20, 8, 4, 4, 'k');
    rect(b, 11, 9, 2, 2, 'C'); rect(b, 21, 9, 2, 2, 'C'); px(b, 11, 9, 'w'); px(b, 21, 9, 'w'); px(b, 16, 12, 'k'); px(b, 17, 12, 'k');
    for (const x of [14, 16, 18, 20]) px(b, x, 16, 'k');
    rect(b, 10, 1, 14, 4, 'o'); for (const x of [10, 15, 20, 23]) rect(b, x, 0, 2, 2, 'o'); rect(b, 16, 1, 2, 3, 'C');       // crown
    const A = [2, -14, 32, -24][P.I], gx = 4, gy = 29;                       // staff, held in the bone hand
    shaft(l, gx, gy, A, -1, -6, 21, ['n', 'm']);
    const G = frameOf(A, -1), [ox, oy] = at(G, gx, gy, 24); ell(l, ox, oy, 3.6, 3.6, 'C'); px(l, ox - 1, oy - 1, 'w'); px(l, ox + 1, oy + 2, 'w');
    for (const s of [-3, 3]) { const [x0, y0] = at(G, gx, gy, 21, s), [x1, y1] = at(G, gx, gy, 26, s * 1.5); line(l, x0, y0, x1, y1, 'b'); }   // bone claws holding the orb
    rect(l, gx - 2, gy - 1, 5, 4, 'b');
  }
};
// the Iron Knight and the Death Knight share a body; the Death Knight swaps horns and plume for a spiked crown, tatters the cape, and swings a scythe
const knightDef = (dark) => ({
  w: dark ? 52 : 48, h: 40, ox: dark ? 20 : 16, dir: -1, split: 28, lean: [1, 3, 2], thick: true,
  draw(b, l, P) {
    rect(b, 21, 17, 8, 20, 'R'); rect(b, 22, 17, 5, 19, 'r');                       // cape behind
    if (dark) for (let x = 21; x < 29; x += 2) { rect(b, x, 36, 1, 2, '.'); rect(b, x + 1, 33, 1, 5, '.'); }   // tatters
    rect(b, 11, 30, 5, 8, 'E'); rect(b, 18, 30, 5, 8, 'E'); rect(b, 10, 36, 7, 3, 'A'); rect(b, 17, 36, 7, 3, 'A');   // legs, boots
    rect(b, 9, 17, 16, 14, 'E'); rect(b, 9, 26, 16, 2, 'o'); rect(b, 15, 19, 4, 5, 'o'); rect(b, 16, 20, 2, 3, 'r');   // armour, belt, crest
    ell(b, 8, 19, 4, 3.5, 'e'); ell(b, 26, 19, 4, 3.5, 'e');
    rect(b, 5, 22, 4, 8, 'E');                                                      // sword arm
    ell(b, 17, 9, 8, 8.5, 'e'); rect(b, 11, 15, 12, 3, 'E');                        // helm
    rect(b, 9, 8, 10, 3, 'k'); rect(b, 10, 9, 2, 1, 'd'); rect(b, 15, 9, 2, 1, 'd');   // visor and eyes
    if (dark) { for (const x of [10, 13, 17, 21, 24]) { rect(b, x, 1, 2, 3, 'e'); px(b, x, 0, 'e'); } rect(b, 9, 2, 17, 3, 'e'); px(b, 6, 15, 'o'); px(b, 28, 15, 'o'); px(b, 5, 14, 'o'); px(b, 29, 14, 'o'); }
    else {
      px(b, 6, 15, 'o'); px(b, 5, 14, 'o'); px(b, 28, 15, 'o'); px(b, 29, 14, 'o');   // pauldron spikes
      line(b, 10, 4, 6, 0, 'o'); line(b, 24, 4, 28, 0, 'o'); line(b, 10, 5, 6, 1, 'O'); line(b, 24, 5, 28, 1, 'O');   // horns
      rect(b, 16, 0, 3, 3, 'r'); px(b, 15, 1, 'q'); px(b, 19, 1, 'R');             // plume
    }
    const A = (dark ? [4, -12, 26, -18] : [3, -12, 34, -20])[P.I], gx = 3, gy = 30;
    if (dark) {   // scythe: thin pole, a long blade hooked out to the front
      shaft(l, gx, gy, A, -1, -5, 27, ['n']); const G = frameOf(A, -1);
      const pts = [[26, 0], [28, 3], [29, 6], [28, 9], [25, 12]].map(([a, c]) => at(G, gx, gy, a, c));   // blade: a thick crescent
      for (let i = 0; i < pts.length - 1; i++) { stripe(l, ...pts[i], ...pts[i + 1], ['W', 'e']); }
      px(l, ...pts[4], 'E');
    } else {
      shaft(l, gx, gy, A, -1, -4, 0, ['n']); shaft(l, gx, gy, A, -1, 1, 26, ['W', 'e', 'E']); guard(l, gx, gy, A, -1, 0, 3, 'o'); guard(l, gx, gy, A, -1, 1, 3, 'O');   // greatsword
    }
    rect(l, 4, 29, 5, 3, 'e');                                                       // gauntlet over the grip
  }
});
const demon = {
  w: 48, h: 40, ox: 16, dir: -1, split: 28, lean: [1, 3, 2], thick: true,
  draw(b, l, P) {
    ell(b, 24, 16, 8, 12, 'R', (x, y) => y < 26 - (x % 3)); mirror(b, 17);
    rect(b, 11, 32, 5, 7, 'r'); rect(b, 18, 32, 5, 7, 'r'); rect(b, 9, 37, 8, 3, 'N'); rect(b, 17, 37, 8, 3, 'N');
    rect(b, 9, 17, 16, 16, 'r'); rect(b, 9, 29, 16, 2, 'N'); rect(b, 15, 21, 4, 3, 'q'); rect(b, 12, 20, 10, 1, 'R'); rect(b, 12, 24, 10, 1, 'R');
    ell(b, 8, 20, 4, 4, 'r'); ell(b, 26, 20, 4, 4, 'r'); rect(b, 5, 22, 4, 8, 'r'); rect(b, 4, 29, 5, 3, 'R');
    ell(b, 17, 10, 7.5, 7.5, 'r');
    line(b, 11, 5, 6, 1, 'b'); line(b, 11, 6, 5, 3, 'b'); line(b, 23, 5, 28, 1, 'b'); line(b, 23, 6, 29, 3, 'b'); rect(b, 6, 0, 2, 3, 'b'); rect(b, 26, 0, 2, 3, 'b');
    rect(b, 11, 8, 4, 3, 'Y'); rect(b, 19, 8, 4, 3, 'Y'); px(b, 12, 8, 'k'); px(b, 12, 9, 'k'); px(b, 20, 8, 'k'); px(b, 20, 9, 'k');
    rect(b, 12, 13, 10, 2, 'k'); for (const x of [13, 15, 18, 20]) px(b, x, 15, 'w'); rect(b, 15, 11, 4, 1, 'R');
    const A = [3, -12, 36, -22][P.I], gx = 3, gy = 30;                      // trident
    shaft(l, gx, gy, A, -1, -5, 22, ['n', 'N']);
    const G = frameOf(A, -1);
    for (const s of [-3, 0, 3]) { const [x0, y0] = at(G, gx, gy, 22, s), [x1, y1] = at(G, gx, gy, s ? 29 : 31, s); line(l, x0, y0, x1, y1, 'e'); }
    guard(l, gx, gy, A, -1, 22, 3, 'e'); guard(l, gx, gy, A, -1, 23, 3, 'W');
    rect(l, 4, 29, 5, 3, 'R');
  }
};
const dragon = {
  w: 36, h: 40, ox: 4, dir: -1, split: 24, lean: [1, 4, 2], thick: true,
  draw(b, l, P) {
    ell(b, 24, 12, 7, 10, 'u', (x, y) => y < 22 - (x % 3)); line(b, 24, 3, 30, 0, 'p');                       // wing
    line(b, 22, 34, 31, 36, 'p'); line(b, 31, 36, 31, 30, 'p'); rect(b, 26, 33, 6, 3, 'p');                    // tail
    rect(b, 10, 33, 6, 6, 'g'); rect(b, 18, 33, 6, 6, 'g'); rect(b, 8, 37, 8, 3, 'G'); rect(b, 17, 37, 8, 3, 'G');
    ell(b, 17, 26, 9, 9, 'g'); ell(b, 17, 29, 5, 6, 'y');                                                       // body, pale belly
    rect(b, 13, 20, 8, 12, 'g'); rect(b, 14, 22, 6, 9, 'y'); for (const y of [23, 26, 29]) rect(b, 14, y, 6, 1, 'G');
    rect(b, 12, 13, 8, 10, 'g'); ell(b, 14, 10, 8, 6.5, 'g'); rect(b, 2, 9, 9, 7, 'g'); rect(b, 1, 11, 3, 4, 'g');   // neck, head, snout
    for (const [x, y] of [[3, 10], [3, 13]]) px(b, x, y, 'k');
    rect(b, 11, 5, 4, 3, 'Y'); px(b, 12, 5, 'k'); px(b, 12, 6, 'k'); rect(b, 2, 15, 9, 2, 'w'); for (const x of [3, 6, 9]) px(b, x, 16, 'w');
    rect(b, 12, 14, 2, 2, 'x'); rect(b, 3, 6, 2, 3, 'o'); rect(b, 10, 1, 2, 5, 'o'); rect(b, 15, 1, 2, 5, 'o'); px(b, 10, 1, 'P'); px(b, 15, 1, 'P');
    const [cx, cy] = [[6, 28], [8, 26], [1, 27], [7, 29]][P.I];            // the clawing foreleg
    stripe(l, 11, 27, cx + 2, cy, ['g', 'g']); rect(l, cx, cy, 4, 3, 'g'); for (const x of [cx, cx + 2]) px(l, x, cy + 3, 'w');
  }
};
/* ---- the hero paper doll: base body + boots + armour + weapon overlays, composited per frame ----
   A look is 'slot.style.rarity' (engine.js lookOf). Each overlay draws into three grids the size of the hero: k behind the body (a cape), b on the body, l on the arm and weapon.
   They are posed with the same move() rules as the base, so a weapon follows the grip (GRIPS) and armour follows the idle bob, and boots stay on the ground.
   Stack, back to front: cape, base body, base sleeve, boots, armour, armour sleeve, weapon and hand. One finish() over the stack gives the shared outline.
   One pixel features use flat roles (no bevel entry in SHADE), or the bevel would turn them into their shade: x gold, Y light gold, v light purple, l blue, U light blue, f light steel, B and K stone. */
const RAR = { common: { t: 'K', h: 'B', g: 'E' }, rare: { t: 'l', h: 'U', g: 'l' }, epic: { t: 'x', h: 'Y', g: 'x' } };   // trim, trim highlight and weapon guard colour per rarity
const hand = (l, gx, gy) => rect(l, gx - 1, gy - 1, 2, 2, 's');
// a weapon drawn along its grip: S shaft, Gd guard bar, P one pixel (along, across)
const wpn = (l, gx, gy, A) => { const G = frameOf(A, 1); return { S: (f, t, cols) => shaft(l, gx, gy, A, 1, f, t, cols), Gd: (a, h, c) => guard(l, gx, gy, A, 1, a, h, c), P: (a, s, c) => { const [x, y] = at(G, gx, gy, a, s); px(l, x, y, c); } }; };
const WEAPON = {
  bare(w) { w.S(-2, 0, ['n']); w.S(3, 12, ['W', 'e']); w.Gd(2, 2, 'o'); },   // the starter blade, as the hero always had it
  sword(w, c) {
    w.S(-3, 0, ['n']); w.S(3, 12, ['W', 'e']); w.Gd(2, 3, RAR[c].g);
    if (c === 'rare') { w.P(6, 0, 'U'); w.P(10, 0, 'U'); w.P(-3, 0, 'l'); } if (c === 'epic') { w.P(2, 0, 'v'); w.P(8, 1, 'v'); w.P(-3, 0, 'x'); w.P(-2, 0, 'Y'); }
  },
  longsword(w, c) {
    w.S(-3, 0, ['n']); w.S(3, 12, ['W', 'e', 'E']); w.P(13, 0, 'W'); w.Gd(2, 4, RAR[c].g); w.Gd(3, 3, c === 'common' ? 'A' : RAR[c].t);
    if (c === 'rare') { w.P(6, 0, 'U'); w.P(10, 0, 'U'); w.P(-3, 0, 'l'); } if (c === 'epic') { w.P(2, 0, 'v'); w.P(8, 1, 'v'); w.P(-3, 0, 'x'); w.P(-2, 0, 'Y'); w.P(5, 0, 'v'); }
  },
  axe(w, c) {
    w.S(-3, 11, ['n', 'm']);
    for (let t = 6; t <= 12; t++) { const e = t === 6 || t === 12 ? 3 : t === 7 || t === 11 ? 4 : 5; for (let s = 2; s <= e; s++) w.P(t, s, s === e ? (c === 'rare' ? 'U' : 'W') : s === 2 ? 'E' : 'e'); }
    w.P(8, -1, 'E'); w.P(9, -1, 'E'); w.P(9, -2, 'E');
    if (c === 'rare') { w.P(9, 3, 'U'); } if (c === 'epic') { w.Gd(5, 1, 'x'); w.P(9, 3, 'v'); w.P(-3, 0, 'x'); }
  },
  spear(w, c) {
    w.S(-4, 10, ['n', 'm']);
    w.Gd(9, 2, c === 'common' ? 'E' : RAR[c].t);
    for (const [t, a, b] of [[10, -1, 2], [11, -1, 2], [12, 0, 1]]) for (let s = a; s <= b; s++) w.P(t, s, s <= 0 ? 'W' : 'e');
    w.P(13, 0, 'W');
    if (c === 'rare') { w.P(11, 0, 'U'); } if (c === 'epic') { w.P(11, 0, 'v'); w.P(-4, 0, 'x'); w.P(5, 0, 'x'); }
  },
  greatsword(w, c) {
    w.S(-4, 0, ['n', 'n']); w.S(3, 12, ['W', 'e', 'e', 'E']); w.P(13, 1, 'W'); w.P(13, 0, 'W'); w.Gd(2, 5, RAR[c].g); w.Gd(3, 4, c === 'common' ? 'A' : c === 'rare' ? 'L' : 'O');
    if (c === 'rare') { w.P(5, 1, 'U'); w.P(8, 1, 'U'); w.P(11, 1, 'U'); w.P(-4, 0, 'l'); w.P(-4, 1, 'l'); } if (c === 'epic') { w.P(2, 0, 'v'); w.P(6, 1, 'v'); w.P(10, 1, 'v'); w.P(-4, 0, 'x'); w.P(-4, 1, 'x'); w.P(2, 1, 'Y'); w.P(7, 2, 'v'); }
  }
};
const TRIM_GUARD = { sword: 3, longsword: 4, greatsword: 5, axe: 1, spear: 1 };   // half width of the set coloured guard bar
const DROPPED = { sword: 5, longsword: 7, axe: 7, spear: 9, greatsword: 9 };   // the weapon on the ground when the hero is down
// armour pieces. s is the style, c the rarity colours.
function torso(b, fill) { rect(b, 4, 14, 11, 8, fill); rect(b, 2, 15, 3, 3, fill); }   // the base tunic's footprint, and the back sleeve
const plateBody = (b, l, k, P, c, cape) => {
  const T = RAR[c];
  torso(b, 'e'); rect(b, 5, 15, 3, 4, 'W'); rect(b, 4, 17, 11, 1, 'E'); rect(b, 4, 21, 11, 1, 'E'); rect(b, 4, 19, 11, 1, 'n'); rect(b, 8, 19, 3, 1, T.t);   // plate, light panel, plate lines, belt and buckle
  rect(b, 5, 14, 9, 1, T.t); ell(b, 14, 15, 2.6, 2.4, 'e'); ell(b, 3, 15.5, 2.2, 2.2, 'e'); rect(b, 12, 13, 4, 1, T.t); rect(b, 1, 14, 3, 1, T.t);   // collar trim, pauldrons and their trim
  if (!P.ic) stripe(l, 14, 15, GRIPS[P.I][0] - 1, GRIPS[P.I][1] - 1, ['e', 'E']);
  // helmet: dome, back guard, nose guard, crest. The face (x 11 to 16, y 8 to 13) stays clear.
  ell(b, 9.5, 6, 7.2, 5.2, 'e', (x, y) => y <= 7); rect(b, 3, 7, 8, 1, 'E'); ell(b, 5.5, 10.5, 3, 4.2, 'E'); rect(b, 13, 7, 2, 4, 'E'); rect(b, 14, 7, 3, 1, 'E'); px(b, 16, 8, 'E');
  rect(b, 8, 2, 4, 1, 'W'); if (c !== 'common') { rect(b, 8, 0, 3, 2, T.t); px(b, 8, 0, T.h); } else rect(b, 8, 1, 3, 1, 'E');
  if (cape) { for (let y = 15; y < 27; y++) { const d = Math.floor((y - 15) / 3); rect(k, 0 + d, y, 5 - d, 1, y > 22 ? 'R' : 'r'); } if (c === 'epic') { rect(k, 0, 15, 5, 1, 'x'); for (let y = 15; y < 27; y++) px(k, Math.floor((y - 15) / 3), y, 'x'); } else if (c === 'rare') { for (let y = 15; y < 27; y++) px(k, Math.floor((y - 15) / 3), y, 'l'); } }
};
const ARMOUR = {
  tunic(b, l, k, P, c) {
    const T = RAR[c]; torso(b, 'g'); rect(b, 4, 19, 11, 1, 'n'); rect(b, 5, 14, 9, 1, T.t); rect(b, 4, 21, 11, 1, T.t);
    if (!P.ic) stripe(l, 14, 15, GRIPS[P.I][0] - 1, GRIPS[P.I][1] - 1, ['g', 'g']);
  },
  vest(b, l, k, P, c) {
    const T = RAR[c]; rect(b, 4, 14, 11, 8, 'n'); rect(b, 9, 15, 1, 5, 'm'); for (const y of [16, 18]) { px(b, 8, y, 'm'); px(b, 10, y, 'm'); }
    rect(b, 4, 19, 11, 1, 'N'); rect(b, 4, 21, 11, 1, 'N'); rect(b, 5, 14, 3, 1, 'r'); rect(b, 11, 14, 3, 1, 'r'); rect(b, 5, 20, 2, 1, T.t); rect(b, 12, 20, 2, 1, T.t); rect(b, 2, 15, 3, 3, 'r');   // red shirt shows at the neck and sleeves
    if (!P.ic) stripe(l, 14, 15, GRIPS[P.I][0] - 1, GRIPS[P.I][1] - 1, ['r', 'r']);
    if (c === 'epic') px(b, 9, 14, 'Y'); if (c === 'rare') px(b, 9, 14, 'U');
  },
  chain(b, l, k, P, c) {
    const T = RAR[c]; for (let y = 14; y < 22; y++) for (let x = 4; x < 15; x++) px(b, x, y, (x + y) % 2 ? 'E' : 'e');
    for (let y = 15; y < 18; y++) for (let x = 2; x < 5; x++) px(b, x, y, (x + y) % 2 ? 'E' : 'e');
    rect(b, 4, 19, 11, 1, 'n'); rect(b, 8, 19, 3, 1, T.t); rect(b, 5, 14, 9, 1, 'E'); rect(b, 4, 21, 11, 1, 'E'); rect(b, 4, 20, 11, 1, 'e');
    if (!P.ic) { stripe(l, 14, 15, GRIPS[P.I][0] - 1, GRIPS[P.I][1] - 1, ['e', 'E']); }
    if (c !== 'common') { rect(b, 6, 14, 5, 1, T.t); }
  },
  plate: (b, l, k, P, c) => plateBody(b, l, k, P, c, false),
  cape: (b, l, k, P, c) => plateBody(b, l, k, P, c, true)
};
const ARMOUR_DOWN = {
  tunic(b, k, c) { rect(b, 12, 19, 10, 8, 'g'); rect(b, 12, 20, 10, 1, 'n'); rect(b, 12, 19, 10, 1, RAR[c].t); rect(b, 14, 22, 4, 2, 'g'); },
  vest(b, k, c) { rect(b, 12, 19, 10, 8, 'n'); rect(b, 12, 20, 10, 1, 'N'); rect(b, 17, 21, 1, 5, 'm'); rect(b, 12, 26, 10, 1, RAR[c].t); rect(b, 14, 22, 4, 2, 'r'); },
  chain(b, k, c) { for (let y = 19; y < 27; y++) for (let x = 12; x < 22; x++) px(b, x, y, (x + y) % 2 ? 'E' : 'e'); rect(b, 12, 20, 10, 1, 'n'); rect(b, 12, 19, 10, 1, RAR[c].t); rect(b, 14, 22, 4, 2, 'e'); },
  plate(b, k, c, cape) {
    rect(b, 12, 19, 10, 8, 'e'); rect(b, 13, 21, 3, 3, 'W'); rect(b, 12, 20, 10, 1, 'n'); rect(b, 12, 23, 10, 1, 'E'); rect(b, 12, 19, 10, 1, RAR[c].t); rect(b, 14, 22, 4, 2, 'E');
    ell(b, 5.5, 20.5, 4.6, 5.2, 'e', (x, y) => x <= 7); rect(b, 8, 18, 2, 3, 'E'); if (c !== 'common') rect(b, 4, 15, 3, 1, RAR[c].t);   // helmet over the back of the head
    if (cape) { rect(k, 11, 17, 12, 2, 'r'); if (c === 'epic') rect(k, 11, 17, 12, 1, 'x'); else if (c === 'rare') rect(k, 11, 17, 12, 1, 'l'); }
  },
  cape: (b, k, c) => ARMOUR_DOWN.plate(b, k, c, true)
};
const BOOTS = {
  cloth(b, c) { const T = RAR[c]; for (const x of [5, 10]) { rect(b, x, 25, 5, 2, 'B'); rect(b, x + 1, 22, 3, 3, 'B'); rect(b, x + 1, 22, 3, 1, T.t); px(b, x + 4, 25, 'c'); } },
  leather(b, c) { const T = RAR[c]; for (const x of [5, 10]) { rect(b, x, 25, 5, 2, 'N'); rect(b, x + 1, 22, 3, 3, 'm'); rect(b, x + 1, 22, 3, 1, T.t); px(b, x + 4, 25, 'n'); rect(b, x + 1, 26, 4, 1, 'N'); } },
  iron(b, c) { const T = RAR[c]; for (const x of [5, 10]) { rect(b, x, 25, 5, 2, 'e'); rect(b, x + 1, 21, 3, 4, 'e'); rect(b, x, 21, 5, 1, T.t); px(b, x + 4, 25, 'W'); px(b, x + 1, 22, 'W'); rect(b, x + 1, 24, 3, 1, 'E'); } }
};
const BOOTS_DOWN = {
  cloth(b, c) { rect(b, 27, 21, 3, 6, 'B'); rect(b, 24, 22, 3, 5, 'B'); rect(b, 24, 22, 1, 5, RAR[c].t); },
  leather(b, c) { rect(b, 27, 21, 3, 6, 'N'); rect(b, 24, 22, 3, 5, 'm'); rect(b, 24, 22, 1, 5, RAR[c].t); rect(b, 27, 26, 3, 1, 'N'); },
  iron(b, c) { rect(b, 27, 21, 3, 6, 'e'); rect(b, 24, 22, 3, 5, 'e'); rect(b, 24, 22, 1, 5, RAR[c].t); px(b, 29, 21, 'W'); px(b, 25, 23, 'W'); }
};
export const parseLook = (look) => { const [slot, style, rarity] = String(look || '').split('.'); return (slot === 'weapon' && WEAPON[style] || slot === 'armour' && ARMOUR[style] || slot === 'boots' && BOOTS[style]) && RAR[rarity] ? { slot, style, rarity } : null; };
export const HERO_LOOK_STYLES = { weapon: Object.keys(WEAPON).filter((k) => k !== 'bare'), armour: Object.keys(ARMOUR), boots: Object.keys(BOOTS) };
const HERO_SLOTS = ['weapon', 'armour', 'boots'];
const heroLooks = (looks) => Object.fromEntries(HERO_SLOTS.map((s, i) => [s, parseLook((Array.isArray(looks) ? looks[i] : looks && looks[s]) || '')]).filter(([s, v]) => v && v.slot === s));
const trimOf = (looks) => { const id = Array.isArray(looks) ? looks[3] : looks && looks.set; return SET_ROLE[id] ? id : ''; };   // the set (move id) whose 3 piece trim the hero wears, or ''
export const heroSig = (looks) => HERO_SLOTS.map((s, i) => (Array.isArray(looks) ? looks[i] : looks && looks[s]) || '-').join('|') + (trimOf(looks) ? '|' + trimOf(looks) : '');
// One overlay in one frame, as raw grids {k, b, l}. icon: no arms, no hand (for the inventory icon).
function overlayGrids(slot, style, rarity, frame, icon = false, trim = '') {
  const d = HERO, k = grid(d.w, d.h), b = grid(d.w, d.h), l = grid(d.w, d.h, 0, true), c0 = clips;
  if (frame === 'down') {
    if (slot === 'weapon') { if (style === 'bare') { rect(b, 1, 25, 1, 1, 'e'); line(b, 1, 25, 5, 25, 'e'); } else { const n = DROPPED[style]; px(b, 0, 25, 'n'); line(b, 1, 25, n, 25, 'e'); px(b, 2, 24, RAR[rarity].g); px(b, 2, 26, RAR[rarity].g); px(b, n, 25, 'W'); if (style === 'axe') { rect(b, n - 2, 23, 2, 1, 'e'); rect(b, n - 2, 27, 2, 1, 'e'); } if (rarity !== 'common') px(b, n - 3, 25, rarity === 'epic' ? 'v' : 'U'); if (trim) { px(b, 0, 25, trim); px(b, 2, 24, trim); px(b, 2, 26, trim); } } }
    else if (slot === 'armour') { ARMOUR_DOWN[style](b, k, rarity); if (trim) { rect(b, 12, 19, 10, 1, trim); rect(b, 12, 26, 10, 1, trim); } } else { BOOTS_DOWN[style](b, rarity); if (trim) { rect(b, 24, 22, 1, 5, trim); px(b, 29, 21, trim); } }
    return { k, b, l };
  }
  const P = { ...poseOf(d, frame), ic: icon };
  if (slot === 'weapon') { const [gx, gy, A] = GRIPS[P.I], w = wpn(l, gx, gy, A); WEAPON[style](w, rarity); if (trim) { w.P(-3, 0, trim); w.P(-2, 0, trim); w.Gd(2, TRIM_GUARD[style] || 1, trim); } if (!icon) hand(l, gx, gy); }
  else if (slot === 'armour') { ARMOUR[style](b, l, k, P, rarity); if (trim) { rect(b, 9, 15, 1, 6, trim); rect(b, 4, 21, 11, 1, trim); rect(b, 2, 15, 3, 1, trim); } }
  else { BOOTS[style](b, rarity); if (trim) for (const x of [5, 10]) { rect(b, x + 1, 22, 3, 1, trim); px(b, x + 4, 25, trim); } }
  if (clips > c0) CLIPS[`${slot}.${style}.${rarity}:${frame}`] = clips - c0;
  return { k: move(d, k, frame, false), b: move(d, b, frame, false), l: move(d, l, frame, true) };
}
// raw (unfinished) frame of one look, its own parts stacked, for tests and icons
export function overlayFrame(look, frame, icon = false) {
  const p = parseLook(look); if (!p) return null;
  const g = overlayGrids(p.slot, p.style, p.rarity, frame, icon);
  return overlay(overlay(g.k, g.b), g.l).map((r) => r.join(''));
}
const doll = new Map();
// The finished hero frame for a set of looks (array [weapon, armour, boots] or {weapon, armour, boots} of look strings, '' for empty). Cached by equipment signature.
export function heroMap(frame, looks) {
  const key = heroSig(looks) + ':' + frame; if (doll.has(key)) return doll.get(key);
  const L = heroLooks(looks), d = HERO, P = poseOf(d, frame), parts = [];
  const tr = L.weapon && L.armour && L.boots ? SET_ROLE[trimOf(looks)] || '' : '';   // the 3 piece trim needs all three pieces on
  const og = (s, st) => L[st] ? overlayGrids(L[st].slot, L[st].style, L[st].rarity, frame, false, tr) : s === 'weapon' ? overlayGrids('weapon', 'bare', 'common', frame) : null;
  const wp = og('weapon', 'weapon'), ar = og('armour', 'armour'), bt = og('boots', 'boots');
  const b = grid(d.w, d.h), l = grid(d.w, d.h, 0, true);
  if (frame === 'down') d.down(b); else d.draw(b, l, P);
  const base = frame === 'down' ? [b] : [move(d, b, frame, false), move(d, l, frame, true)];
  let raw = ar ? ar.k : grid(d.w, d.h);
  for (const g of [...base, bt && bt.b, ar && ar.b, ar && ar.l, wp.b, wp.l]) raw = overlay(raw, g);
  const out = finish(raw, false); doll.set(key, out); if (doll.size > 400) doll.delete(doll.keys().next().value);
  return out;
}
export const heroMaps = (looks) => Object.fromEntries(FRAMES.map((f) => [f, heroMap(f, looks)]));
// Icon for the inventory: the item's own overlay (idle A, no arms or hand), finished and cropped to its pixels. s is the whole-number scale the view shows it at (boots are small, so 3).
export function iconMap(look) {
  const p = parseLook(look); if (!p) return null;
  const g = finish(overlayFrame(look, 'idleA', true).map((r) => [...r]), false);
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1; g.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  return g.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1));
}
const icons = new Map();
export function iconInfo(look) {
  if (!icons.has(look)) {
    const m = iconMap(look), no = typeof document === 'undefined';
    icons.set(look, !m ? { url: '', w: 0, h: 0, s: 2 } : { url: no ? '' : mapToCanvas(m).toDataURL(), w: m[0].length, h: m.length, s: look.startsWith('boots') ? 3 : 2 });
  }
  return icons.get(look);
}

const DEFS = { hero: HERO, slime, bat, skeleton, golem, rat, mushroom, goblin, imp, wisp, cultist, spider, gargoyle, ember, frost, mimic, troll: TROLL, knight: knightDef(false), lich, dknight: knightDef(true), demon, dragon };

export const FRAMES = ['idleA', 'idleB', 'windup', 'strike', 'hurt', 'down'];
// How a frame moves a body grid or a limb/weapon grid. The weapon (limb) follows the grip and is not leaned on the windup and strike; the body is.
function move(d, g, frame, limb) {
  const dir = d.dir || 1, split = d.split, [lw, ls, lh] = d.lean || [1, 2, 2];
  if (frame === 'idleB') return d.alt ? g : bob(g, split);
  if (frame === 'windup') return limb ? (d.alt ? g : bob(g, split)) : lean(bob(g, split), split, -dir * lw);
  if (frame === 'strike') return limb ? g : lean(g, split, dir * ls);
  if (frame === 'hurt') return lean(g, split, -dir * lh);
  return g;
}
const poseOf = (d, frame) => { const n = frame === 'idleA' || frame === 'idleB' ? 'idle' : frame; return { n, alt: frame === 'idleB', I: IDX[n] ?? 0 }; };
// Build one frame. idle B bobs the head and torso 1 px (or the unit's own alt drawing); windup pulls back and crouches, strike leans in, hurt leans away.
function pose(d, frame) {
  const dir = d.dir || 1, P = poseOf(d, frame);
  const b = grid(d.w, d.h, d.ox || 0), l = grid(d.w, d.h, d.ox || 0, true);
  if (frame === 'down') {
    if (d.down) { d.down(b); return b; }
    d.draw(b, l, { n: 'idle', alt: false, I: 0 }); return crumple(overlay(b, l), dir);
  }
  d.draw(b, l, P);
  return overlay(move(d, b, frame, false), move(d, l, frame, true));
}
// MAPS[kind][frame] -> rows. frostdragon and golddragon are the dragon maps with another palette.
export const MAPS = {}, META = {};
for (const [k, d] of Object.entries(DEFS)) {
  MAPS[k] = k === 'hero' ? heroMaps([]) : Object.fromEntries(FRAMES.map((f) => { const c0 = clips, m = finish(pose(d, f), !!d.thick); if (clips > c0) CLIPS[k + ':' + f] = clips - c0; return [f, m]; }));
  META[k] = { w: d.w, h: d.h, px: d.px ?? (d.ox || 0) + (d.h > 30 ? 16 : 12) };
}
MAPS.frostdragon = MAPS.golddragon = MAPS.dragon; META.frostdragon = META.golddragon = META.dragon;
export const ENEMY_KINDS = ['slime', 'bat', 'skeleton', 'golem', 'rat', 'mushroom', 'goblin', 'imp', 'wisp', 'cultist', 'spider', 'gargoyle', 'ember', 'frost', 'mimic'];
export const BOSS_KINDS = ['troll', 'knight', 'lich', 'dknight', 'demon', 'frostdragon', 'golddragon'];
// Palette swaps for boss variants: a role -> palette colour name table laid over the base roles.
const VARIANTS = {
  dknight: { e: 'coolM', E: 'coolD', W: 'coolL', A: 'ink', o: 'greenM', O: 'greenD', P: 'greenL', r: 'purM', R: 'purD', q: 'purL', d: 'greenL', n: 'coolM', m: 'coolL', N: 'ink' },
  frostdragon: { g: 'blueL', G: 'blueM', y: 'white', u: 'blueD', v: 'purL', p: 'blueM', o: 'white', P: 'white', x: 'blueM', Y: 'white' },
  golddragon: { g: 'goldM', G: 'woodM', y: 'goldL', u: 'purM', p: 'purL', o: 'white', P: 'white', x: 'redL' }
};
export const paletteFor = (kind) => ({ ...PALETTE, ...Object.fromEntries(Object.entries(VARIANTS[kind] || {}).map(([r, n]) => [r, PAL[n]])) });

export function mapToCanvas(map, palette = PALETTE) {
  const c = document.createElement('canvas'); c.width = map[0].length; c.height = map.length;
  const x = c.getContext('2d');
  map.forEach((row, y) => { for (let i = 0; i < row.length; i++) { const col = palette[row[i]]; if (col) { x.fillStyle = col; x.fillRect(i, y, 1, 1); } } });
  return c;
}
// Solid single-colour copy of a canvas, for the hit flash.
export function silhouette(src, color = PAL.white) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
export const hexA = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
const cache = new Map();
// elite (every 5th floor) gets a thin red outline and a faint aura, drawn on a canvas padded by `pad` px. w and h stay the plain sprite size.
export const ELITE_PAD = 2;
function eliteAura(img) {
  const P = ELITE_PAD, c = document.createElement('canvas'); c.width = img.width + 2 * P; c.height = img.height + 2 * P;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const ring = (r, col) => { const s = silhouette(img, col); for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && (dx === 0 || dy === 0 || r === 1)) x.drawImage(s, P + dx, P + dy); };
  ring(2, hexA(PAL.redL, 0.2)); ring(1, hexA(PAL.redL, 0.75)); x.drawImage(img, P, P);
  return c;
}
const ALIAS = { idle: 'idleA', attack: 'strike' };
// The hero in his current gear: same shape as getSprite, cached by equipment signature and frame.
const heroCache = new Map();
export function getHero(frame = 'idleA', looks = []) {
  frame = ALIAS[frame] || frame; const k = heroSig(looks) + ':' + frame;
  if (!heroCache.has(k)) {
    const img = mapToCanvas(heroMap(frame, looks)), base = getSprite('hero', 'idleA');
    heroCache.set(k, { img, flash: silhouette(img), w: img.width, h: img.height, px: META.hero.px, pad: 0, top: base.top });
    if (heroCache.size > 120) heroCache.delete(heroCache.keys().next().value);
  }
  return heroCache.get(k);
}
// frame is one of FRAMES (idle and attack still work). px is the column of the feet pivot in the sprite, so a view can plant it on a ground point.
export function getSprite(kind, frame = 'idleA', elite = false) {
  frame = ALIAS[frame] || frame;
  const k = kind + ':' + frame + (elite ? ':e' : '');
  if (!cache.has(k)) {
    const base = MAPS[kind][frame] || MAPS[kind].idleA, plain = mapToCanvas(base, paletteFor(kind)), img = elite ? eliteAura(plain) : plain;
    const pal = paletteFor(kind), idle = MAPS[kind].idleA, top = Math.max(0, idle.findIndex((row) => [...row].some((ch) => pal[ch])));   // first drawn row of idle A, so bars sit on the head, not on the frame's spare room
    cache.set(k, { img, flash: silhouette(img), w: plain.width, h: plain.height, px: META[kind].px, pad: elite ? ELITE_PAD : 0, top });
  }
  return cache.get(k);
}

/* ---- pets: small raw maps (12 wide, no outline), padded by 1 px and finished like the units: bevel, ink outline, light from the top left. Facing right, like the hero.
   Two idle frames: B squashes the body 1 px (the legs lose a row). Kept apart from MAPS so the unit tests, which loop over every unit and its six frames, never see them. ---- */
export const PET_SPECIES = ['fox', 'tortoise', 'hawk', 'cat', 'toad', 'beetle', 'owl', 'snail'];
const PET_RAW = {
  fox: ['........X..X', '........XXXX', '......XXXXXX', 'c.....XXXkXX', 'XX..XXXXXXXk', 'XXXXXXXXXccc', '.XXXXXXXXXcc', '..XXXXXXXXX.', '...XX..XX...', '...XX..XX...'],
  tortoise: ['...ggggg....', '..ggygggg...', '.gggggyggCCC', '.ggygggggCkC', '.gggggggggCC', '.gggggggggg.', '..gggggggg..', '..CC....CC..', '..CC....CC..'],
  hawk: ['....aaaa....', '...aaaaaa...', '...aaakaaoo.', '...aaaaaao..', '..aaacccaa..', '.aaaaccccaa.', 'aaaaaccccaa.', '.aaaaacccaa.', '..aaaccca...', '....o..o....'],
  cat: ['...b...b....', '...bbbbb....', '...bkbkb....', '...bbrbb....', '..rrrrrrr...', '..bbbobbb.b.', '.bbbbbbbbbbb', '.bbbbbbbbbb.', '..bb....bb..'],
  toad: ['.....gg.gg..', '.....ck.ck..', '..gggyggggyg', '.gggggggggkk', '.ggCCCCCCggg', '.gCCCCCCCCgg', '.ggCCCCCCgg.', '..ggggggggg.', '.ggg....ggg.'],
  beetle: ['...ooooo....', '..oPoooooo..', '.oPPooooooNN', '.oooooooooNN', '.oooooPoooo.', '..oooooooo..', '..k.k..k.k..', '.k..k..k..k.'],
  owl: ['...p....p...', '...pp..pp...', '...pppppp...', '..ppoopoopp.', '..ppkopkopp.', '...ppPPpp...', '..ppvvvvpp..', '.pppvvvvppp.', '.pppvvvvppp.', '...oo..oo...'],
  snail: ['..........k..k', '...oooo...g..g', '..oPccco...gg.', '.oPcckcco..ggg', '.occckkco.gggg', '.occcccco.ggg.', '..ooooooOggg..', 'yyyyyyyyyyyy..', '.gggggggggg...'],
  egg: ['...bb...', '..bbbb..', '.bcbbbb.', '.bcbbBb.', 'bbbbbbbb', 'bbBbbbbb', 'bbbbbbBb', 'bbbBbbbb', '.bbbbbb.', '..bbbb..'],
  crack: ['...bb...', '..bbbk..', '.bcbbkb.', '.bcbkbb.', 'bbbbkkbb', 'bbBbbkkb', 'bbbbbkbb', 'bbbBbbbb', '.bbbbbb.', '..bbbb..']
};
export const PET_MAPS = {}, PET_META = {};
for (const [k, raw] of Object.entries(PET_RAW)) {
  const w = raw[0].length, a = [Array(w + 2).fill('.'), ...raw.map((r) => ['.', ...r, '.']), Array(w + 2).fill('.')], b = bob(a, a.length - 3);
  PET_MAPS[k] = { idleA: finish(a), idleB: finish(b) }; PET_META[k] = { w: w + 2, h: a.length, px: Math.floor((w + 2) / 2) };
}
const petCache = new Map(), PFR = { 0: 'idleA', 1: 'idleB', a: 'idleA', b: 'idleB', idleA: 'idleA', idleB: 'idleB' };
// A species (or 'egg' / 'crack') as a cached canvas, same shape as getSprite: { img, flash, w, h, px, pad, top }. px is the feet pivot column. frame 0 or 1 (idle A or B).
export function getPet(kind, frame = 0) {
  const f = PFR[frame] || 'idleA', k = kind + ':' + f;
  if (!petCache.has(k)) {
    const m = PET_MAPS[kind][f], img = mapToCanvas(m);
    petCache.set(k, { img, flash: silhouette(img), w: img.width, h: img.height, px: PET_META[kind].px, pad: 0, top: Math.max(0, m.findIndex((r) => /[^.]/.test(r))) });
  }
  return petCache.get(k);
}
// Icon for the UI, like iconInfo: { url (data URL), w, h, s (scale to show it at) }. The url is empty without a DOM.
const petIcons = new Map();
export function petIcon(kind) {
  if (!petIcons.has(kind)) { const m = PET_MAPS[kind] && PET_MAPS[kind].idleA, no = typeof document === 'undefined'; petIcons.set(kind, !m ? { url: '', w: 0, h: 0, s: 3 } : { url: no ? '' : mapToCanvas(m).toDataURL(), w: m[0].length, h: m.length, s: 3 }); }
  return petIcons.get(kind);
}
