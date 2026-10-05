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
// Letters are roles in a pixel map; each points at a palette colour. Uppercase/lowercase pairs are base and shade.
const ROLE = {
  k: 'ink', s: 'skinM', S: 'skinD', T: 'skinL', h: 'hairM', H: 'umber', J: 'hairL', r: 'redM', R: 'redD', q: 'redL', o: 'goldM', O: 'woodM', P: 'goldL',
  e: 'coolL', E: 'coolM', W: 'steelL', n: 'woodM', N: 'umber', m: 'woodL', g: 'greenM', G: 'greenD', y: 'greenL', p: 'purM', u: 'purD', v: 'purL',
  b: 'boneM', B: 'warmL', c: 'white', K: 'warmM', a: 'coolM', A: 'coolD', f: 'coolL', z: 'ink', d: 'redL', x: 'goldM', X: 'fireM', w: 'white',
  l: 'blueM', L: 'blueD', i: 'white', I: 'blueL', j: 'blueM', Y: 'goldL', Z: 'white', U: 'blueL', C: 'greenL', V: 'greenD'
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
const HERO = {
  w: 32, h: 28, px: 12, dir: 1, split: 19, lean: [1, 2, 2],
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
    const [gx, gy, A] = [[18, 18, 8], [18, 12, -22], [18, 15, 86], [16, 20, -40]][P.I];   // the grip: hand and sword
    stripe(l, X + 10, 15, gx - 1, gy - 1, ['r', 'r']);                        // sleeve from the shoulder
    shaft(l, gx, gy, A, 1, -2, 0, ['n']); shaft(l, gx, gy, A, 1, 3, 12, ['W', 'e']); guard(l, gx, gy, A, 1, 2, 2, 'o');   // pommel, blade, crossguard
    rect(l, gx - 1, gy - 1, 2, 2, 's');                                       // hand
  },
  down(b) {   // lying on the back, head away from the foe, sword dropped
    ell(b, 7, 21.5, 5.5, 5.5, 's'); ell(b, 4.5, 22, 3.6, 5, 'h'); ell(b, 7, 18.5, 5.5, 3, 'h', (x, y) => y <= 19);
    px(b, 9, 21, 'k'); px(b, 10, 21, 'k'); px(b, 12, 21, 'k'); px(b, 13, 21, 'k'); px(b, 11, 24, 'S'); px(b, 12, 24, 'S');
    rect(b, 12, 19, 10, 8, 'r'); rect(b, 17, 19, 1, 8, 'o'); rect(b, 13, 20, 8, 1, 'o');   // tunic, belt
    rect(b, 14, 22, 4, 2, 's'); rect(b, 22, 22, 5, 5, 'n'); rect(b, 27, 21, 3, 6, 'N');
    rect(b, 12, 26, 18, 1, 'N');
    rect(b, 1, 25, 1, 1, 'e'); line(b, 1, 25, 5, 25, 'e');
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
const DEFS = { hero: HERO, slime, bat, skeleton, golem, rat, mushroom, goblin, imp, wisp, cultist, spider, gargoyle, ember, frost, mimic, troll: TROLL, knight: knightDef(false), lich, dknight: knightDef(true), demon, dragon };

export const FRAMES = ['idleA', 'idleB', 'windup', 'strike', 'hurt', 'down'];
// Build one frame. idle B bobs the head and torso 1 px (or the unit's own alt drawing); windup pulls back and crouches, strike leans in, hurt leans away.
function pose(d, frame) {
  const dir = d.dir || 1, split = d.split, n = frame === 'idleA' || frame === 'idleB' ? 'idle' : frame, P = { n, alt: frame === 'idleB', I: IDX[n] ?? 0 };
  const b = grid(d.w, d.h, d.ox || 0), l = grid(d.w, d.h, d.ox || 0, true);
  if (frame === 'down') {
    if (d.down) { d.down(b); return b; }
    d.draw(b, l, { n: 'idle', alt: false, I: 0 }); return crumple(overlay(b, l), dir);
  }
  d.draw(b, l, P);
  const [lw, ls, lh] = d.lean || [1, 2, 2];
  if (frame === 'idleB') return d.alt ? overlay(b, l) : overlay(bob(b, split), bob(l, split));
  if (frame === 'windup') return overlay(lean(bob(b, split), split, -dir * lw), d.alt ? l : bob(l, split));
  if (frame === 'strike') return overlay(lean(b, split, dir * ls), l);
  if (frame === 'hurt') return overlay(lean(b, split, -dir * lh), lean(l, split, -dir * lh));
  return overlay(b, l);
}
// MAPS[kind][frame] -> rows. frostdragon and golddragon are the dragon maps with another palette.
export const MAPS = {}, META = {};
for (const [k, d] of Object.entries(DEFS)) {
  MAPS[k] = Object.fromEntries(FRAMES.map((f) => { const c0 = clips, m = finish(pose(d, f), !!d.thick); if (clips > c0) CLIPS[k + ':' + f] = clips - c0; return [f, m]; }));
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
