// Pixel sprites for the Tower: chibi 3/4 view units, drawn in code. Our own art.
// Maps are string rows, one char per pixel, '.' is clear. The maps are built from a few shapes, then shaded and outlined.
export const PALETTE = {
  k: '#1e1b26', s: '#f1c7a0', S: '#cf9a72', T: '#f9dcc0', h: '#9a4328', H: '#6a2a1b', J: '#c8683c',
  r: '#c2403f', R: '#8a2428', q: '#e0675a', o: '#d4a373', O: '#a07a4e', P: '#ecc99b',
  e: '#c9ccd6', E: '#8a8f9e', W: '#f1f2f6', n: '#7c553a', N: '#523626', m: '#a77b57',
  g: '#62b05c', G: '#3d7f41', y: '#a3dc8f', p: '#7b5fc4', u: '#4d3a8a', v: '#a891e6',
  b: '#e6dfca', B: '#b5ab91', c: '#fbf6e6', a: '#85858f', A: '#5c5c66', f: '#a9a9b3', z: '#3a3a42',
  d: '#ff5148', x: '#ffb347', X: '#e0701f', w: '#ffffff', l: '#5a7bd8', L: '#3b55a8',
  i: '#d8f3fb', I: '#8cc9e6', j: '#4f8fb8', Y: '#ffd76a', Z: '#dfeaff', U: '#9fb6f2', C: '#6fd06a', V: '#2f6b3a'
};
// base colour -> [shade on the lower/right rim, light on the upper/left rim]
const SHADE = { h: 'HJ', s: 'ST', r: 'Rq', o: 'OP', e: 'EW', n: 'Nm', g: 'Gy', p: 'uv', b: 'Bc', a: 'Af', E: 'ze', I: 'ji', Z: 'Uw', C: 'Vy' };

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
/* ---- knight boss: 32 x 40, horned helm, red plume and cape, greatsword on the left ---- */
function knight() {
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

/* ---- armoured rat: pink nose, little iron helm and back plate, faces left ---- */
function rat() {
  const g = grid(24, 28);
  line(g, 20, 23, 23, 20, 'q'); line(g, 23, 20, 22, 16, 'q');                  // tail
  ell(g, 13, 21, 8, 5.5, 'n'); ell(g, 7, 19, 5, 4.5, 'n'); rect(g, 1, 20, 4, 3, 'n'); px(g, 1, 21, 'q'); px(g, 1, 20, 'q');   // body, head, snout
  rect(g, 10, 15, 9, 3, 'e'); ell(g, 14.5, 18, 5, 2.5, 'e'); rect(g, 12, 17, 1, 3, 'E'); rect(g, 16, 17, 1, 3, 'E');          // back plate
  ell(g, 8, 15.5, 4.5, 3, 'e', (x, y) => y <= 16); rect(g, 4, 15, 2, 4, 'E'); rect(g, 9, 12, 1, 3, 'e');                       // helm, nose guard, spike
  ell(g, 10, 14, 1.6, 1.6, 'q'); px(g, 6, 19, 'd'); px(g, 5, 19, 'd'); rect(g, 3, 22, 2, 1, 'w');                              // ear, eye, tooth
  rect(g, 7, 25, 3, 3, 'N'); rect(g, 17, 25, 3, 3, 'N'); rect(g, 4, 26, 3, 1, 'N');
  return finish(g);
}
/* ---- mushroom: red cap with cream spots, cross little face ---- */
function mushroom() {
  const g = grid(24, 28);
  rect(g, 7, 14, 10, 10, 'b'); rect(g, 6, 23, 5, 4, 'B'); rect(g, 13, 23, 5, 4, 'B');                   // stem and feet
  ell(g, 12, 10, 11, 8, 'r', (x, y) => y <= 14); rect(g, 3, 13, 18, 2, 'R');                            // cap, underside
  for (const [x, y, w] of [[7, 5, 3], [14, 4, 3], [11, 9, 2], [4, 10, 2], [18, 9, 2], [9, 12, 2]]) { rect(g, x, y, w, w, 'c'); }
  rect(g, 9, 17, 2, 3, 'k'); rect(g, 13, 17, 2, 3, 'k'); px(g, 9, 17, 'w'); px(g, 13, 17, 'w'); rect(g, 11, 21, 3, 1, 'B');   // eyes, mouth
  rect(g, 4, 17, 3, 2, 'b'); rect(g, 17, 17, 3, 2, 'b');                                                // nubs
  return finish(g);
}
/* ---- goblin: green, big ears, dagger held out on the left ---- */
function goblin() {
  const g = grid(24, 28);
  rect(g, 9, 22, 3, 5, 'n'); rect(g, 13, 22, 3, 5, 'n'); rect(g, 7, 26, 5, 1, 'N'); rect(g, 12, 26, 5, 1, 'N');
  rect(g, 8, 14, 9, 9, 'n'); rect(g, 8, 19, 9, 1, 'N'); rect(g, 10, 14, 5, 2, 'o');                       // tunic, belt, collar
  ell(g, 12.5, 9, 6, 5.5, 'g'); rect(g, 2, 7, 6, 2, 'g'); rect(g, 17, 7, 6, 2, 'g'); px(g, 2, 6, 'g'); px(g, 22, 6, 'g'); px(g, 3, 9, 'G'); px(g, 21, 9, 'G');   // head, ears
  rect(g, 8, 8, 3, 3, 'x'); rect(g, 14, 8, 3, 3, 'x'); px(g, 9, 9, 'k'); px(g, 9, 10, 'k'); px(g, 15, 9, 'k'); px(g, 15, 10, 'k');
  rect(g, 10, 12, 5, 1, 'G'); px(g, 10, 13, 'w'); px(g, 14, 13, 'w'); px(g, 12, 11, 'G');
  rect(g, 4, 17, 5, 2, 'g'); rect(g, 17, 16, 3, 3, 'g');                                                    // arms
  rect(g, 3, 9, 1, 9, 'e'); px(g, 3, 8, 'W'); rect(g, 2, 17, 3, 1, 'o'); rect(g, 3, 18, 1, 2, 'n');       // dagger
  return finish(g);
}
/* ---- imp: red, horns, bat wings, pointed tail ---- */
function imp() {
  const g = grid(24, 28);
  ell(g, 4.5, 12, 4, 5, 'R', (x, y) => y < 16 - (x % 2)); mirror(g, 11.5);                                // wings
  rect(g, 8, 21, 3, 5, 'r'); rect(g, 13, 21, 3, 5, 'r'); rect(g, 6, 25, 5, 2, 'R'); rect(g, 12, 25, 5, 2, 'R');
  ell(g, 12, 17, 5, 5, 'r'); ell(g, 12, 9, 6.5, 5.5, 'r');
  line(g, 17, 20, 21, 22, 'r'); line(g, 21, 22, 22, 25, 'r'); rect(g, 21, 24, 3, 3, 'R'); px(g, 22, 23, 'R');   // tail and barb
  rect(g, 7, 2, 2, 4, 'b'); rect(g, 15, 2, 2, 4, 'b'); px(g, 7, 2, 'c'); px(g, 15, 2, 'c'); px(g, 8, 6, 'B'); px(g, 15, 6, 'B');
  rect(g, 8, 8, 3, 3, 'Y'); rect(g, 13, 8, 3, 3, 'Y'); px(g, 8, 9, 'k'); px(g, 8, 10, 'k'); px(g, 13, 9, 'k'); px(g, 13, 10, 'k');
  rect(g, 9, 12, 6, 1, 'k'); px(g, 9, 13, 'w'); px(g, 11, 13, 'w'); px(g, 13, 13, 'w'); px(g, 12, 15, 'q');
  rect(g, 7, 17, 2, 3, 'r'); rect(g, 15, 17, 2, 3, 'r');
  return finish(g);
}
/* ---- wisp: pale ghost, trailing wavy tail (the view lifts it) ---- */
function wisp() {
  const g = grid(24, 28);
  ell(g, 12, 11, 8, 8, 'Z'); rect(g, 4, 11, 17, 9, 'Z');
  for (let x = 4; x <= 20; x++) { const d = Math.round(Math.sin(x * 0.9) * 1.5); rect(g, x, 20, 1, 3 + d + (x % 3 === 0 ? 3 : 0), 'Z'); }   // ragged hem
  rect(g, 1, 14, 4, 3, 'Z'); rect(g, 20, 14, 3, 3, 'Z');                                                     // arms
  rect(g, 7, 8, 3, 5, 'k'); rect(g, 14, 8, 3, 5, 'k'); px(g, 7, 8, 'l'); px(g, 14, 8, 'l'); px(g, 8, 9, 'w'); px(g, 15, 9, 'w');
  rect(g, 10, 15, 4, 3, 'k'); px(g, 11, 14, 'k'); px(g, 12, 14, 'k');
  px(g, 11, 1, 'l'); px(g, 12, 2, 'l'); px(g, 12, 0, 'U');                                                    // spirit flame
  return finish(g);
}
/* ---- cultist: dark purple robe and hood, glowing eyes, orb staff on the left ---- */
function cultist() {
  const g = grid(24, 28);
  for (let y = 12; y < 27; y++) { const w = 4 + Math.floor((y - 12) * 0.55); rect(g, 12 - w, y, 2 * w, 1, 'p'); }   // robe flares out
  rect(g, 6, 25, 12, 2, 'u'); rect(g, 11, 14, 2, 12, 'u'); rect(g, 8, 19, 8, 1, 'o');
  ell(g, 12, 8, 6, 6.5, 'u'); ell(g, 12, 9, 3.6, 3.8, 'k');                                                     // hood, shadowed face
  rect(g, 9, 8, 2, 2, 'x'); rect(g, 13, 8, 2, 2, 'x'); px(g, 9, 8, 'w'); px(g, 13, 8, 'w');
  rect(g, 5, 15, 4, 3, 'p'); rect(g, 4, 17, 2, 2, 's');                                                        // sleeve and hand
  rect(g, 3, 6, 2, 21, 'n'); rect(g, 3, 6, 1, 21, 'm');                                                         // staff
  ell(g, 4, 4, 2.4, 2.4, 'd'); px(g, 3, 3, 'w');
  rect(g, 16, 15, 4, 3, 'p'); rect(g, 19, 17, 2, 2, 's');
  return finish(g);
}
/* ---- spider: dark body, eight legs, red hourglass ---- */
function spider() {
  const g = grid(24, 28), leg = (x0, y0, x1, y1, x2, y2) => { for (const d of [0, 1]) { line(g, x0, y0 + d, x1, y1 + d, 'a'); line(g, x1, y1 + d, x2, y2 + d, 'a'); } };
  for (const [y0, y1, y2, o] of [[16, 9, 15, 6], [17, 12, 20, 8], [18, 15, 24, 8], [19, 18, 26, 5]]) { leg(10, y0, 10 - o, y1, 10 - o - 3, y2); leg(14, y0, 14 + o, y1, 14 + o + 3, y2); }
  ell(g, 14, 19, 6, 5, 'p'); ell(g, 9, 17, 4.5, 4, 'u');                                                       // abdomen, head
  px(g, 14, 17, 'd'); px(g, 14, 18, 'd'); px(g, 13, 19, 'd'); px(g, 15, 19, 'd'); px(g, 14, 20, 'd'); px(g, 14, 21, 'd'); px(g, 12, 15, 'v'); px(g, 13, 15, 'v');
  rect(g, 6, 15, 2, 2, 'd'); rect(g, 10, 15, 2, 2, 'd'); px(g, 6, 15, 'w'); px(g, 10, 15, 'w'); rect(g, 5, 19, 1, 3, 'w'); rect(g, 8, 20, 1, 2, 'w');
  return finish(g);
}
/* ---- gargoyle: crouched grey stone, bat wings, horns, red eyes ---- */
function gargoyle() {
  const g = grid(24, 28);
  ell(g, 4, 12, 4, 7, 'A', (x, y) => y < 18 - (x % 2) * 2); mirror(g, 11.5);
  rect(g, 6, 24, 5, 3, 'a'); rect(g, 13, 24, 5, 3, 'a'); rect(g, 5, 26, 6, 1, 'A'); rect(g, 13, 26, 6, 1, 'A');
  ell(g, 12, 18, 6, 6, 'a'); ell(g, 12, 10, 5.5, 5, 'a');
  rect(g, 7, 2, 2, 5, 'a'); rect(g, 15, 2, 2, 5, 'a'); px(g, 7, 2, 'f'); px(g, 15, 2, 'f');
  rect(g, 8, 9, 3, 2, 'd'); rect(g, 13, 9, 3, 2, 'd'); px(g, 8, 9, 'w'); rect(g, 7, 7, 4, 1, 'z'); rect(g, 13, 7, 4, 1, 'z');
  rect(g, 9, 13, 6, 2, 'z'); px(g, 9, 15, 'w'); px(g, 14, 15, 'w');
  line(g, 9, 17, 11, 21, 'z'); line(g, 15, 17, 13, 21, 'z'); rect(g, 4, 19, 3, 4, 'a'); rect(g, 17, 19, 3, 4, 'a');
  return finish(g);
}
/* ---- ember: living flame, three layers ---- */
function ember() {
  const g = grid(24, 28);
  ell(g, 12, 18, 9, 8, 'X'); ell(g, 12, 11, 6, 8, 'X');
  for (const [x, y, h] of [[6, 5, 6], [10, 0, 8], [14, 3, 7], [18, 7, 6], [3, 12, 5], [21, 14, 5]]) { for (let k = 0; k < h; k++) rect(g, x - Math.floor(k / 4), y + h - k, Math.max(1, 4 - Math.floor(k * 0.7)), 1, 'X'); }
  ell(g, 12, 19, 6.5, 6, 'x'); ell(g, 12, 13, 4, 6, 'x'); ell(g, 12, 21, 3.5, 3.5, 'Y');
  rect(g, 8, 15, 3, 4, 'k'); rect(g, 14, 15, 3, 4, 'k'); px(g, 8, 15, 'w'); px(g, 14, 15, 'w'); rect(g, 10, 22, 5, 1, 'k'); px(g, 10, 21, 'k'); px(g, 14, 21, 'k');
  return finish(g);
}
/* ---- frost golem: blue ice blocks and crystal shoulders ---- */
function frost() {
  const g = grid(24, 28);
  rect(g, 6, 22, 5, 5, 'I'); rect(g, 13, 22, 5, 5, 'I');
  rect(g, 5, 11, 14, 11, 'I'); rect(g, 8, 4, 8, 7, 'I');
  rect(g, 0, 13, 5, 10, 'j'); rect(g, 19, 13, 5, 10, 'j'); rect(g, 0, 21, 5, 4, 'I'); rect(g, 19, 21, 5, 4, 'I');
  for (const [x, y, h] of [[5, 7, 5], [18, 7, 5], [10, 0, 4], [13, 1, 3]]) rect(g, x, y, 2, h, 'i');      // crystal spikes
  px(g, 5, 6, 'w'); px(g, 18, 6, 'w'); px(g, 10, 0, 'w');
  rect(g, 9, 6, 2, 2, 'l'); rect(g, 13, 6, 2, 2, 'l'); px(g, 9, 6, 'w'); px(g, 13, 6, 'w');
  rect(g, 10, 14, 4, 4, 'i'); px(g, 11, 15, 'w'); px(g, 12, 16, 'l');
  line(g, 7, 12, 9, 18, 'j'); line(g, 16, 13, 14, 20, 'j'); line(g, 1, 15, 2, 19, 'i');
  return finish(g);
}
/* ---- mimic: wooden chest with a tongue and teeth ---- */
function mimic() {
  const g = grid(24, 28);
  rect(g, 3, 15, 18, 11, 'n'); rect(g, 3, 20, 18, 2, 'o'); rect(g, 3, 15, 18, 1, 'o'); rect(g, 10, 20, 4, 4, 'Y');   // body, bands, lock
  ell(g, 12, 9, 10, 6, 'n', (x, y) => y <= 11); rect(g, 2, 9, 20, 2, 'o'); rect(g, 11, 4, 2, 7, 'o');            // lid, hinge band
  rect(g, 4, 11, 16, 5, 'k'); rect(g, 12, 12, 6, 4, 'q'); rect(g, 13, 15, 4, 1, 'd');                         // open mouth, tongue
  for (let x = 5; x < 20; x += 3) { rect(g, x, 11, 2, 2, 'w'); rect(g, x + 1, 14, 2, 2, 'w'); }                 // teeth
  rect(g, 6, 6, 3, 3, 'x'); rect(g, 15, 6, 3, 3, 'x'); px(g, 7, 7, 'k'); px(g, 16, 7, 'k');                   // eyes on the lid
  rect(g, 4, 26, 4, 2, 'N'); rect(g, 16, 26, 4, 2, 'N'); rect(g, 1, 17, 3, 4, 'q'); rect(g, 20, 17, 3, 4, 'q');
  return finish(g);
}

/* ---- bosses, 32 x 40 ---- */
/* troll king: huge green brute with a crown and a spiked club on the left */
function troll() {
  const g = grid(32, 40);
  rect(g, 10, 32, 6, 7, 'g'); rect(g, 18, 32, 6, 7, 'g'); rect(g, 9, 37, 8, 3, 'N'); rect(g, 17, 37, 8, 3, 'N');
  rect(g, 8, 18, 18, 15, 'g'); rect(g, 8, 28, 18, 5, 'n'); rect(g, 8, 28, 18, 1, 'o'); rect(g, 13, 22, 8, 2, 'G'); rect(g, 12, 25, 10, 1, 'G');   // belly, loincloth, belt, ribs
  ell(g, 6, 22, 5, 5, 'g'); ell(g, 28, 22, 5, 5, 'g'); rect(g, 3, 25, 6, 8, 'g'); rect(g, 25, 25, 5, 7, 'g'); rect(g, 2, 31, 6, 4, 'G');
  ell(g, 17, 11, 8.5, 8, 'g'); rect(g, 10, 17, 14, 3, 'G');
  rect(g, 10, 9, 3, 3, 'Y'); rect(g, 20, 9, 3, 3, 'Y'); px(g, 11, 10, 'k'); px(g, 21, 10, 'k'); rect(g, 9, 7, 5, 1, 'G'); rect(g, 19, 7, 5, 1, 'G');
  rect(g, 11, 15, 12, 3, 'k'); for (const x of [12, 14, 19, 21]) rect(g, x, 13, 1, 2, 'w'); rect(g, 15, 12, 3, 2, 'G');   // jaw, tusks
  rect(g, 9, 1, 16, 4, 'o'); for (const x of [9, 13, 17, 21, 24]) rect(g, x, 0, 2, 2, 'o'); rect(g, 12, 2, 2, 2, 'd'); rect(g, 19, 2, 2, 2, 'l');
  rect(g, 0, 8, 4, 24, 'n'); rect(g, 0, 8, 1, 24, 'm'); rect(g, -1 + 1, 4, 6, 6, 'N'); for (const [x, y] of [[0, 3], [5, 5], [5, 10], [-0, 12]]) px(g, x, y, 'e');   // club
  return finish(g);
}
/* lich: floating robed skeleton, crown, glowing eyes, orb staff on the left */
function lich() {
  const g = grid(32, 40);
  for (let y = 16; y < 40; y++) { const w = 6 + Math.floor((y - 16) * 0.5); rect(g, 17 - w, y, 2 * w, 1, 'p'); }
  rect(g, 6, 36, 22, 3, 'u'); rect(g, 15, 18, 4, 20, 'u'); rect(g, 9, 24, 16, 1, 'o'); rect(g, 12, 30, 10, 1, 'v');
  ell(g, 7, 20, 4.5, 3.5, 'u'); ell(g, 27, 20, 4.5, 3.5, 'u'); rect(g, 4, 22, 4, 6, 'p'); rect(g, 3, 27, 4, 3, 'b');     // pauldrons, arm, bone hand
  ell(g, 17, 10, 7, 7.5, 'b'); rect(g, 13, 15, 8, 3, 'b'); rect(g, 10, 8, 4, 4, 'k'); rect(g, 20, 8, 4, 4, 'k');
  rect(g, 11, 9, 2, 2, 'C'); rect(g, 21, 9, 2, 2, 'C'); px(g, 11, 9, 'w'); px(g, 21, 9, 'w'); px(g, 16, 12, 'k'); px(g, 17, 12, 'k');
  for (const x of [14, 16, 18, 20]) px(g, x, 16, 'k');
  rect(g, 10, 1, 14, 4, 'o'); for (const x of [10, 15, 20, 23]) rect(g, x, 0, 2, 2, 'o'); rect(g, 16, 1, 2, 3, 'C');       // crown
  rect(g, 1, 6, 2, 34, 'n'); rect(g, 1, 6, 1, 34, 'm'); ell(g, 2, 4, 3.6, 3.6, 'C'); px(g, 1, 3, 'w'); px(g, 3, 6, 'w');
  line(g, 0, 8, 5, 3, 'b'); line(g, 4, 8, 6, 1, 'b');
  return finish(g);
}
/* demon lord: red, huge curled horns, bat wings, trident on the left */
function demon() {
  const g = grid(32, 40);
  ell(g, 24, 16, 8, 12, 'R', (x, y) => y < 26 - (x % 3)); mirror(g, 17);
  rect(g, 11, 32, 5, 7, 'r'); rect(g, 18, 32, 5, 7, 'r'); rect(g, 9, 37, 8, 3, 'N'); rect(g, 17, 37, 8, 3, 'N');
  rect(g, 9, 17, 16, 16, 'r'); rect(g, 9, 29, 16, 2, 'N'); rect(g, 15, 21, 4, 3, 'q'); rect(g, 12, 20, 10, 1, 'R'); rect(g, 12, 24, 10, 1, 'R');
  ell(g, 8, 20, 4, 4, 'r'); ell(g, 26, 20, 4, 4, 'r'); rect(g, 5, 22, 4, 8, 'r'); rect(g, 4, 29, 5, 3, 'R');
  ell(g, 17, 10, 7.5, 7.5, 'r');
  line(g, 11, 5, 6, 1, 'b'); line(g, 11, 6, 5, 3, 'b'); line(g, 23, 5, 28, 1, 'b'); line(g, 23, 6, 29, 3, 'b'); rect(g, 6, 0, 2, 3, 'b'); rect(g, 26, 0, 2, 3, 'b');
  rect(g, 11, 8, 4, 3, 'Y'); rect(g, 19, 8, 4, 3, 'Y'); px(g, 12, 8, 'k'); px(g, 12, 9, 'k'); px(g, 20, 8, 'k'); px(g, 20, 9, 'k');
  rect(g, 12, 13, 10, 2, 'k'); for (const x of [13, 15, 18, 20]) px(g, x, 15, 'w'); rect(g, 15, 11, 4, 1, 'R');
  rect(g, 1, 4, 2, 36, 'n'); rect(g, 0, 2, 1, 6, 'e'); rect(g, 3, 2, 1, 6, 'e'); rect(g, 1, 0, 2, 8, 'e'); rect(g, 0, 8, 4, 2, 'o');   // trident
  return finish(g);
}
/* dragon whelp: big head and snout on the left, small wings, tail on the right */
function dragon() {
  const g = grid(32, 40);
  ell(g, 24, 12, 7, 10, 'u', (x, y) => y < 22 - (x % 3)); line(g, 24, 3, 30, 0, 'p');                       // wing
  line(g, 22, 34, 31, 36, 'p'); line(g, 31, 36, 31, 30, 'p'); rect(g, 26, 33, 6, 3, 'p');                    // tail
  rect(g, 10, 33, 6, 6, 'g'); rect(g, 18, 33, 6, 6, 'g'); rect(g, 8, 37, 8, 3, 'G'); rect(g, 17, 37, 8, 3, 'G');
  ell(g, 17, 26, 9, 9, 'g'); ell(g, 17, 29, 5, 6, 'y');                                                       // body, pale belly
  rect(g, 13, 20, 8, 12, 'g'); rect(g, 14, 22, 6, 9, 'y'); for (const y of [23, 26, 29]) rect(g, 14, y, 6, 1, 'G');
  rect(g, 12, 13, 8, 10, 'g'); ell(g, 14, 10, 8, 6.5, 'g'); rect(g, 2, 9, 9, 7, 'g'); rect(g, 1, 11, 3, 4, 'g');   // neck, head, snout
  for (const [x, y] of [[3, 10], [3, 13]]) px(g, x, y, 'k');
  rect(g, 11, 5, 4, 3, 'Y'); px(g, 12, 5, 'k'); px(g, 12, 6, 'k'); rect(g, 2, 15, 9, 2, 'w'); for (const x of [3, 6, 9]) px(g, x, 16, 'w');
  rect(g, 12, 14, 2, 2, 'x'); rect(g, 3, 6, 2, 3, 'o'); rect(g, 10, 1, 2, 5, 'o'); rect(g, 15, 1, 2, 5, 'o'); px(g, 10, 1, 'P'); px(g, 15, 1, 'P');
  rect(g, 6, 28, 5, 2, 'g'); rect(g, 3, 29, 4, 3, 'g'); for (const x of [3, 5, 7]) px(g, x, 32, 'w');          // claw
  return finish(g);
}

export const MAPS = {
  hero: { idle: hero(false), attack: hero(true) },
  slime: { idle: slime() }, bat: { idle: bat() }, skeleton: { idle: skeleton() }, golem: { idle: golem() },
  rat: { idle: rat() }, mushroom: { idle: mushroom() }, goblin: { idle: goblin() }, imp: { idle: imp() }, wisp: { idle: wisp() }, cultist: { idle: cultist() },
  spider: { idle: spider() }, gargoyle: { idle: gargoyle() }, ember: { idle: ember() }, frost: { idle: frost() }, mimic: { idle: mimic() },
  knight: { idle: knight() }, troll: { idle: troll() }, lich: { idle: lich() }, demon: { idle: demon() }, dragon: { idle: dragon() }
};
export const ENEMY_KINDS = ['slime', 'bat', 'skeleton', 'golem', 'rat', 'mushroom', 'goblin', 'imp', 'wisp', 'cultist', 'spider', 'gargoyle', 'ember', 'frost', 'mimic'];
export const BOSS_KINDS = ['troll', 'knight', 'lich', 'dknight', 'demon', 'frostdragon', 'golddragon'];
// Palette swaps: a boss variant redraws a base map with a few colours replaced (shade letters too, as shading runs before colouring).
const VARIANTS = {
  dknight: ['knight', { e: '#4a5a52', E: '#2e3a34', W: '#7d948a', o: '#6fd06a', O: '#3d7f41', P: '#a8e6a0', r: '#3d7f41', R: '#25502a', q: '#6fd06a', d: '#6fd06a' }],
  frostdragon: ['dragon', { g: '#8cc9e6', G: '#4f8fb8', y: '#d8f3fb', u: '#3b55a8', v: '#a891e6', p: '#5a7bd8', o: '#d8f3fb', P: '#ffffff', x: '#5a7bd8', Y: '#ffffff' }],
  golddragon: ['dragon', { g: '#e6c15a', G: '#a8802a', y: '#fff1b8', u: '#8a4fb8', p: '#c7a0f0', o: '#ffffff', P: '#ffffff', x: '#ff5148' }]
};

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
// kind may be a base map or a palette-swapped boss variant. elite (every 5th floor) gets a thin red outline and a faint aura, drawn on a canvas padded by `pad` px. w and h stay the plain sprite size.
export const ELITE_PAD = 2;
function eliteAura(img) {
  const P = ELITE_PAD, c = document.createElement('canvas'); c.width = img.width + 2 * P; c.height = img.height + 2 * P;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const ring = (r, col) => { const s = silhouette(img, col); for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && (dx === 0 || dy === 0 || r === 1)) x.drawImage(s, P + dx, P + dy); };
  ring(2, 'rgba(255,60,80,.2)'); ring(1, 'rgba(255,70,90,.7)'); x.drawImage(img, P, P);
  return c;
}
export function getSprite(kind, frame = 'idle', elite = false) {
  const k = kind + ':' + frame + (elite ? ':e' : '');
  if (!cache.has(k)) {
    const v = VARIANTS[kind], base = v ? v[0] : kind, map = MAPS[base][frame] || MAPS[base].idle;
    const plain = mapToCanvas(map, v ? { ...PALETTE, ...v[1] } : PALETTE), img = elite ? eliteAura(plain) : plain;
    cache.set(k, { img, flash: silhouette(img), w: plain.width, h: plain.height, pad: elite ? ELITE_PAD : 0 });
  }
  return cache.get(k);
}
