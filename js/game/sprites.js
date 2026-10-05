// Pixel sprites for the Tower: chibi 3/4 view units, drawn in code. Our own art.
// Maps are string rows, one char per pixel, '.' is clear. The maps are built from a few shapes, then shaded and outlined.
export const PALETTE = {
  k: '#1e1b26', s: '#f1c7a0', S: '#cf9a72', T: '#f9dcc0', h: '#9a4328', H: '#6a2a1b', J: '#c8683c',
  r: '#c2403f', R: '#8a2428', q: '#e0675a', o: '#d4a373', O: '#a07a4e', P: '#ecc99b',
  e: '#c9ccd6', E: '#8a8f9e', W: '#f1f2f6', n: '#7c553a', N: '#523626', m: '#a77b57',
  g: '#62b05c', G: '#3d7f41', y: '#a3dc8f', p: '#7b5fc4', u: '#4d3a8a', v: '#a891e6',
  b: '#e6dfca', B: '#b5ab91', c: '#fbf6e6', a: '#85858f', A: '#5c5c66', f: '#a9a9b3', z: '#3a3a42',
  d: '#ff5148', x: '#ffb347', X: '#e0701f', w: '#ffffff', l: '#5a7bd8', L: '#3b55a8'
};
// base colour -> [shade on the lower/right rim, light on the upper/left rim]
const SHADE = { h: 'HJ', s: 'ST', r: 'Rq', o: 'OP', e: 'EW', n: 'Nm', g: 'Gy', p: 'uv', b: 'Bc', a: 'Af', E: 'ze' };

const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'));
const px = (g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; };
const rect = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, c); };
const ell = (g, cx, cy, rx, ry, c, clip) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (!clip || clip(x, y))) px(g, x, y, c);
};
const line = (g, x0, y0, x1, y1, c) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) px(g, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c);
};
const mirror = (g, cx) => { for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (g[y][x] !== '.') { const mx = 2 * cx - x; if (mx >= 0 && mx < g[0].length && g[y][mx] === '.') g[y][mx] = g[y][x]; } };
// Bevel shading, then a 1px dark outline around the whole shape.
function finish(g) {
  const h = g.length, w = g[0].length, src = g.map((r) => r.slice()), at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : src[y][x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = SHADE[src[y][x]]; if (!s) continue;
    if (at(x, y + 1) === '.' || at(x + 1, y) === '.') g[y][x] = s[0];
    else if (at(x, y - 1) === '.' || at(x - 1, y) === '.') g[y][x] = s[1];
  }
  const sh = g.map((r) => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sh[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && src[y + dy][x + dx] !== '.'))) g[y][x] = 'k';
  return g.map((r) => r.join(''));
}

/* ---- hero: auburn hair, red and gold tunic, small sword. Faces right. 24 x 28 ---- */
function hero(attack) {
  const g = grid(24, 28), X = 4 + (attack ? 1 : 0);
  rect(g, X + 2, 21, 3, 6, 'n'); rect(g, X + 7, 21, 3, 6, 'n');           // legs
  rect(g, X + 1, 25, 5, 2, 'N'); rect(g, X + 6, 25, 5, 2, 'N');            // boots, toes point right
  rect(g, X, 14, 11, 8, 'r'); rect(g, X, 19, 11, 1, 'o'); rect(g, X + 1, 14, 9, 1, 'o');   // tunic, belt, collar
  px(g, X + 5, 16, 'o'); px(g, X + 5, 17, 'o'); px(g, X + 4, 16, 'o'); px(g, X + 6, 16, 'o');
  rect(g, X - 2, 15, 3, 3, 'r'); rect(g, X - 2, 18, 2, 2, 's');            // back arm
  ell(g, X + 5.5, 8, 6.5, 6.5, 's');                                         // big head
  ell(g, X + 2, 9, 3.2, 5, 'h'); ell(g, X + 5.5, 6, 6.5, 4.5, 'h', (x, y) => y <= 7);   // hair: back and cap
  rect(g, X + 7, 5, 6, 2, 'h'); px(g, X + 12, 7, 'h'); px(g, X + 12, 8, 'h');            // fringe
  for (const ex of [X + 8, X + 11]) { px(g, ex, 9, 'k'); px(g, ex, 10, 'k'); }           // eyes
  px(g, X + 10, 13, 'S'); px(g, X + 11, 13, 'S'); px(g, X + 7, 12, 'q');                   // mouth, blush
  if (!attack) {
    rect(g, X + 11, 15, 3, 3, 'r'); rect(g, X + 13, 17, 2, 2, 's');           // front arm
    rect(g, X + 14, 6, 1, 10, 'e'); px(g, X + 14, 5, 'W'); rect(g, X + 12, 16, 5, 1, 'o'); rect(g, X + 14, 19, 1, 1, 'n'); // sword up
  } else {
    rect(g, X + 11, 14, 4, 2, 'r'); rect(g, X + 14, 14, 2, 2, 's');           // arm out
    rect(g, X + 15, 11, 1, 6, 'o'); rect(g, X + 16, 13, 6, 2, 'e'); px(g, X + 17, 13, 'W'); px(g, X + 18, 13, 'W'); px(g, X + 22, 13, 'W'); // sword thrust
  }
  return finish(g);
}
/* ---- slime: green blob, big eyes, looks left ---- */
function slime() {
  const g = grid(24, 28);
  ell(g, 12, 21, 10, 7, 'g', (x, y) => y <= 27); ell(g, 11, 14.5, 4.5, 3, 'g');
  for (let x = 0; x < 24; x++) px(g, x, 28, '.');
  for (const [x, y] of [[7, 15], [8, 15], [7, 16], [14, 20], [15, 21]]) px(g, x, y, 'y');
  for (const ex of [6, 12]) { rect(g, ex, 18, 4, 4, 'w'); rect(g, ex, 19, 2, 3, 'k'); px(g, ex + 2, 18, 'w'); }
  rect(g, 8, 24, 4, 1, 'G'); px(g, 7, 23, 'G'); px(g, 12, 23, 'G');
  px(g, 20, 24, 'y'); px(g, 3, 26, 'y');
  return finish(g);
}
/* ---- bat: floats (the view lifts it). Faces left ---- */
function bat() {
  const g = grid(24, 28);
  ell(g, 5, 13, 5, 4.5, 'u', (x, y) => y < 17 - (x % 2)); mirror(g, 11.5);
  ell(g, 11.5, 15, 4, 5, 'p'); ell(g, 11.5, 10, 4.5, 4, 'p');
  rect(g, 7, 4, 2, 4, 'p'); rect(g, 15, 4, 2, 4, 'p'); px(g, 8, 4, 'v'); px(g, 15, 4, 'v');
  rect(g, 8, 10, 2, 2, 'd'); rect(g, 13, 10, 2, 2, 'd'); px(g, 8, 10, 'w');
  px(g, 10, 14, 'w'); px(g, 13, 14, 'w');
  line(g, 6, 12, 3, 16, 'u'); line(g, 17, 12, 20, 16, 'u');
  return finish(g);
}
/* ---- skeleton: big skull, rusty sword on the left ---- */
function skeleton() {
  const g = grid(24, 28);
  ell(g, 12, 8, 6.5, 6, 'b'); rect(g, 9, 13, 7, 2, 'b');
  rect(g, 8, 7, 3, 3, 'k'); rect(g, 13, 7, 3, 3, 'k'); px(g, 8, 8, 'd'); px(g, 13, 8, 'd'); px(g, 11, 11, 'k'); px(g, 12, 11, 'k');
  for (const x of [10, 12, 14]) px(g, x, 14, 'k');
  rect(g, 11, 15, 2, 6, 'b'); for (const y of [16, 18, 20]) rect(g, 8, y, 8, 1, 'b');
  rect(g, 7, 17, 1, 3, 'B'); rect(g, 16, 17, 1, 3, 'B');
  rect(g, 9, 21, 6, 2, 'b'); rect(g, 10, 23, 2, 4, 'b'); rect(g, 13, 23, 2, 4, 'b'); rect(g, 8, 26, 4, 1, 'b'); rect(g, 13, 26, 4, 1, 'b');
  rect(g, 5, 15, 3, 1, 'b'); rect(g, 4, 16, 2, 3, 'b');                          // arm and hand
  rect(g, 3, 5, 1, 12, 'E'); rect(g, 2, 17, 3, 1, 'O'); px(g, 3, 4, 'e'); px(g, 3, 8, 'R'); px(g, 3, 12, 'R');   // rusty sword
  rect(g, 9, 20, 6, 1, 'R');
  return finish(g);
}
/* ---- golem: stone and moss, glowing eyes ---- */
function golem() {
  const g = grid(24, 28);
  rect(g, 6, 22, 5, 5, 'a'); rect(g, 13, 22, 5, 5, 'a');
  rect(g, 5, 11, 14, 11, 'a'); rect(g, 8, 3, 8, 8, 'a');
  rect(g, 0, 12, 5, 10, 'A'); rect(g, 19, 12, 5, 10, 'A'); rect(g, 0, 20, 5, 5, 'a'); rect(g, 19, 20, 5, 5, 'a');
  rect(g, 9, 6, 2, 2, 'x'); rect(g, 13, 6, 2, 2, 'x'); px(g, 9, 6, 'w');
  px(g, 11, 15, 'x'); px(g, 12, 15, 'x'); px(g, 11, 16, 'X'); px(g, 12, 16, 'X'); px(g, 11, 14, 'x'); px(g, 12, 17, 'X');
  line(g, 7, 12, 9, 18, 'z'); line(g, 16, 14, 14, 21, 'z'); line(g, 1, 14, 2, 18, 'z');
  for (const [x, y] of [[6, 11], [7, 11], [14, 11], [15, 11], [20, 12], [8, 3], [9, 3], [2, 24]]) px(g, x, y, 'g');
  for (const [x, y] of [[6, 12], [15, 12]]) px(g, x, y, 'G');
  rect(g, 8, 10, 8, 1, 'A');
  return finish(g);
}
/* ---- boss knight: 32 x 40, horned helm, red plume and cape, greatsword on the left ---- */
function boss() {
  const g = grid(32, 40);
  rect(g, 21, 17, 8, 20, 'R'); rect(g, 22, 17, 5, 19, 'r');                       // cape behind
  rect(g, 11, 30, 5, 8, 'E'); rect(g, 18, 30, 5, 8, 'E'); rect(g, 10, 36, 7, 3, 'z'); rect(g, 17, 36, 7, 3, 'z');   // legs, boots
  rect(g, 9, 17, 16, 14, 'E'); rect(g, 9, 26, 16, 2, 'o'); rect(g, 15, 19, 4, 5, 'o'); rect(g, 16, 20, 2, 3, 'r');   // armour, belt, crest
  ell(g, 8, 19, 4, 3.5, 'e'); ell(g, 26, 19, 4, 3.5, 'e'); px(g, 6, 15, 'o'); px(g, 5, 14, 'o'); px(g, 28, 15, 'o'); px(g, 29, 14, 'o');   // pauldrons, spikes
  rect(g, 5, 22, 4, 8, 'E'); rect(g, 4, 29, 5, 3, 'e');                          // sword arm
  ell(g, 17, 9, 8, 8.5, 'e'); rect(g, 11, 15, 12, 3, 'E');                        // helm
  rect(g, 9, 8, 10, 3, 'k'); rect(g, 10, 9, 2, 1, 'd'); rect(g, 15, 9, 2, 1, 'd');   // visor and eyes
  line(g, 10, 4, 6, 0, 'o'); line(g, 24, 4, 28, 0, 'o'); line(g, 10, 5, 6, 1, 'O'); line(g, 24, 5, 28, 1, 'O');   // horns
  rect(g, 16, 0, 3, 3, 'r'); px(g, 15, 1, 'q'); px(g, 19, 1, 'R');
  rect(g, 1, 4, 3, 26, 'e'); px(g, 2, 3, 'W'); rect(g, 0, 29, 6, 2, 'o'); rect(g, 2, 31, 2, 3, 'n');   // greatsword
  for (let y = 6; y < 28; y += 4) px(g, 2, y, 'W');
  return finish(g);
}

export const MAPS = {
  hero: { idle: hero(false), attack: hero(true) },
  slime: { idle: slime() }, bat: { idle: bat() }, skeleton: { idle: skeleton() }, golem: { idle: golem() }, boss: { idle: boss() }
};
export const ENEMY_KINDS = ['slime', 'bat', 'skeleton', 'golem'];
// The enemy type cycles with the floor band (5 floors a band). Every 10th floor is the boss.
export const kindFor = (floor, boss) => boss ? 'boss' : ENEMY_KINDS[Math.floor((floor - 1) / 5) % ENEMY_KINDS.length];

export function mapToCanvas(map, palette = PALETTE) {
  const c = document.createElement('canvas'); c.width = map[0].length; c.height = map.length;
  const x = c.getContext('2d');
  map.forEach((row, y) => { for (let i = 0; i < row.length; i++) { const col = palette[row[i]]; if (col) { x.fillStyle = col; x.fillRect(i, y, 1, 1); } } });
  return c;
}
// Solid single-colour copy of a canvas, for the hit flash.
export function silhouette(src, color = '#fff') {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
const cache = new Map();
export function getSprite(kind, frame = 'idle') {
  const k = kind + ':' + frame;
  if (!cache.has(k)) { const img = mapToCanvas(MAPS[kind][frame] || MAPS[kind].idle); cache.set(k, { img, flash: silhouette(img), w: img.width, h: img.height }); }
  return cache.get(k);
}
