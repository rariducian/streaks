// Silhouette test: every sprite as a solid dark shape on a light ground, at 1x and 2x game size, on one PNG. No dependencies.
// usage: node tools/silhouette-sheet.mjs [out.png] [--frames]    (--frames shows all six frames per sprite instead of idle A)
// 1x is 2 px per art pixel (about what a phone shows, 2.5 CSS px), 2x is 4 px. Sprites are bottom-aligned on their feet pivot, so they can be compared in size.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { MAPS, META, FRAMES, ENEMY_KINDS, BOSS_KINDS } from '../js/game/sprites.js';

const args = process.argv.slice(2), out = args.find((a) => !a.startsWith('--')) || 'silhouettes.png', all = args.includes('--frames');
const kinds = ['hero', ...ENEMY_KINDS, ...BOSS_KINDS], frames = all ? FRAMES : ['idleA'];
const BG = [236, 232, 220], FG = [28, 21, 48], PADX = 6, LAB = 1;
const GLYPH = { a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110', e: '111100110100111', f: '111100110100100', g: '011100101101011', h: '101101111101101', i: '111010010010111', j: '001001001101010', k: '101101110101101', l: '100100100100111', m: '101111111101101', n: '110101101101101', o: '010101101101010', p: '110101110100100', q: '010101101111011', r: '110101110101101', s: '011100010001110', t: '111010010010010', u: '101101101101111', v: '101101101101010', w: '101101111111101', x: '101101010101101', y: '101101010010010', z: '111001010100111', '1': '010110010010111', '2': '111001111100111', x2: '' };
// layout: a grid of cells, each with the sprite at 1x then 2x (every frame beside each other with --frames)
const COLS = all ? 1 : 6, cellW = (k) => 4 + frames.length * (META[k].w * 2 + PADX) + frames.length * (META[k].w * 4 + PADX), cellH = (k) => META[k].h * 4 + 14;
const CW = Math.max(...kinds.map(cellW)), CH = Math.max(...kinds.map(cellH));
const W = COLS * CW + 8, H = Math.ceil(kinds.length / COLS) * CH + 8;
const img = new Uint8Array(W * H * 3); for (let i = 0; i < W * H; i++) img.set(BG, i * 3);
const dot = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) img.set(c, (y * W + x) * 3); };
const text = (s, x0, y0) => { let x = x0; for (const ch of s) { const g = GLYPH[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') dot(x + (i % 3), y0 + Math.floor(i / 3), FG); x += 4; } };
kinds.forEach((k, n) => {
  const ox = 4 + (n % COLS) * CW, oy = 4 + Math.floor(n / COLS) * CH;
  text(k, ox, oy);
  let x = ox + 2;
  for (const s of [2, 4]) for (const f of frames) {
    const m = MAPS[k][f], h = m.length, base = oy + CH - 3;
    m.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) dot(x + i * s + a, base - (h - j) * s + b, FG); });
    x += META[k].w * s + PADX;
  }
});
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); Buffer.from(d).copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`wrote ${out} (${W}x${H}, ${kinds.length} sprites)`);
