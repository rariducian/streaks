// 3D form viewer (rendering and sheet UI only). Pose data and maths live in skeleton.js and poses/*.js.
// three.js is imported lazily, only when a viewer is opened, from the import map in index.html.
import { MOVES } from '../data.js';
import { DISCLAIMER } from './cues-common.js';
import { isGuidePending } from './pending.js';
import { fk, fkFull, samplePose, qrot, qmul, vsub, vlen, vangle } from './skeleton.js';

const FIG_LIFT = 0.02;   // figure is lifted so the mitten hands rest on the floor plane (foot soles reach 2 cm below the heel points)
const VIEWS = { front: [0, 0.12, 1], side: [-1, 0.12, 0], back: [0, 0.12, -1], top: [0, 1, -0.001] };
const DEFAULT_DIR = (() => { const e = (28 * Math.PI) / 180, n = Math.hypot(0.62, 0.72); return [(-0.62 / n) * Math.cos(e), Math.sin(e), (0.72 / n) * Math.cos(e)]; })();   // museum-model 3/4 view, 28 deg up
const isCompact = () => matchMedia('(max-width: 499px)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON_X = '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_PLAY = '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5z"/></svg>';
const ICON_PAUSE = '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.4z"/></svg>';

const poseCache = {};
async function loadPoses(moveId) {
  if (!(moveId in poseCache)) { try { poseCache[moveId] = (await import(`./poses/${moveId}.js`)).default; } catch { poseCache[moveId] = null; } }
  return poseCache[moveId];
}

let S = null; // active viewer
let SESSION = 0; // token: bumps on every open, so a stale open or close never touches a newer sheet

/** Open the viewer for a move level. opener: element to return focus to. */
export async function openForm({ moveId, level = 0, opener = null }) {
  if (S) return;
  const root = document.getElementById('form-root');
  if (!root || !MOVES[moveId]) return;
  const token = ++SESSION;
  S = { token, root, moveId, level, opener, playing: true, speed: 1, t: 0, raf: 0, ready: false, closed: false, three: null, hl: null, wrongTimer: 0, wire: false, names: false, path: false, cleanups: [], reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  if (S.reduced) S.playing = false;
  document.body.classList.add('fv-lock');
  const mine = S;
  mine.poses = await loadPoses(moveId);
  if (S !== mine || mine.closed || mine.token !== SESSION) return;   // closed (or replaced by a newer open) while loading
  buildShell();
  selectLevel(level, true);
  startScene();
}

export function closeForm(token) {
  if (!S || S.closed) return;
  if (token !== undefined && token !== S.token) return;   // a close that belongs to an older session must not close a newer one
  const s = S; s.closed = true;
  cancelAnimationFrame(s.raf); clearTimeout(s.wrongTimer);
  s.cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  disposeScene(s);
  s.root.innerHTML = '';
  document.body.classList.remove('fv-lock');
  const op = s.opener; if (S === s) S = null;
  if (op && op.focus && document.contains(op)) op.focus({ preventScroll: true });
}

/* ---------- sheet UI ---------- */
function buildShell() {
  const { root } = S, tok = S.token;
  root.innerHTML = `<div class="fv-scrim" data-fv="close"></div>
  <div class="fv-sheet" role="dialog" aria-modal="true" aria-labelledby="fv-title" tabindex="-1">
    <div class="fv-top"><div class="fv-grab" aria-hidden="true"></div>
      <div class="fv-head"><div class="fv-kicker" id="fv-kicker"></div><button class="fv-x" data-fv="close" aria-label="Close form guide">${ICON_X}</button></div></div>
    <div class="fv-stage"><canvas class="fv-canvas" role="img" aria-label=""></canvas><div class="fv-msg" id="fv-msg">Loading 3D view...</div>
      <div class="fv-frame" aria-hidden="true"></div>
      <div class="fv-labels" id="fv-labels" aria-hidden="true" hidden></div>
      <div class="fv-ov fv-tools" role="group" aria-label="Camera and display options">${['front', 'side', 'back', 'top'].map((v) => `<button class="fv-tg" data-fv="view" data-view="${v}" aria-pressed="false">${v}</button>`).join('')}<button class="fv-tg" data-fv="wire" aria-pressed="false">wireframe</button><button class="fv-tg" data-fv="names" aria-pressed="false">names</button><button class="fv-tg" data-fv="path" aria-pressed="false">path</button></div>
      <div class="fv-ov fv-ttl" aria-hidden="true"><div class="fv-ttl-h" id="fv-ttl-h"></div><div class="fv-ttl-c" id="fv-ttl-c"></div></div>
      <div class="fv-ov fv-ro" id="fv-ro" aria-hidden="true"></div>
      <div class="fv-ov fv-br"><div class="fv-dh" aria-hidden="true">DRAG THE DIAL TO TURN THE MODEL</div><div class="fv-brr"><div class="fv-dial" role="slider" tabindex="0" aria-label="Turn the model" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0"><svg aria-hidden="true" viewBox="0 0 60 60"><circle cx="30" cy="30" r="28"/><path class="tk" d="M30 2v5M58 30h-5M30 58v-5M2 30h5"/><g class="kn"><path d="M30 5l4 9h-8z"/></g></svg><span class="dg" aria-hidden="true">0&deg;</span></div><button class="fv-reset" data-fv="reset">Reset view</button></div></div>
      <div class="fv-live" id="fv-live" role="status" aria-live="polite"></div></div>
    <div class="fv-ctrl" id="fv-ctrl">
      <button class="fv-round" data-fv="play" aria-label="Pause">${ICON_PAUSE}</button>
      <input class="fv-scrub" id="fv-scrub" type="range" min="0" max="1000" value="0" aria-label="Position in the movement">
      <div class="fv-speed" role="group" aria-label="Speed"><button class="fv-cap sm" data-fv="speed" data-speed="0.5" aria-pressed="false">0.5&times;</button><button class="fv-cap sm" data-fv="speed" data-speed="1" aria-pressed="true">1&times;</button></div>
    </div>
    <div class="fv-body" id="fv-body"></div>
  </div>`;
  const sheet = root.querySelector('.fv-sheet');
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); S.cleanups.push(() => el.removeEventListener(ev, fn, o)); };
  on(root, 'click', (e) => {
    const b = e.target.closest('[data-fv]'); if (!b) return;
    const a = b.dataset.fv;
    if (a === 'close') closeForm(tok);
    else if (a === 'play') setPlaying(!S.playing);
    else if (a === 'speed') setSpeed(Number(b.dataset.speed));
    else if (a === 'view') goView(b.dataset.view);
    else if (a === 'reset') goView('default');
    else if (a === 'wire' || a === 'names' || a === 'path') setToggle(a, !S[a]);
    else if (a === 'mistake') showMistake(Number(b.dataset.i));
    else if (a === 'level') selectLevel(Number(b.dataset.level));
  });
  const scrub = root.querySelector('#fv-scrub'); let was = false;
  on(scrub, 'input', () => { if (!S.scrubbing) { S.scrubbing = true; was = S.playing; setPlaying(false); } const lv = curLevel(); if (lv) { S.t = (scrub.value / 1000) * lv.duration; drawFrame(); } });
  on(scrub, 'change', () => { S.scrubbing = false; if (was) setPlaying(true); });
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('#ask-root .asksheet')) { e.preventDefault(); closeForm(tok); }
    else if (e.key === 'Tab') { const f = [...sheet.querySelectorAll('button:not([disabled]), input, [role=slider]')].filter((x) => x.offsetParent !== null); if (!f.length) return; const i = f.indexOf(document.activeElement), n = e.shiftKey ? i - 1 : i + 1; if (i === -1 || n < 0 || n >= f.length) { e.preventDefault(); f[(n + f.length) % f.length].focus(); } }
  }, true);
  // drag the grabber / header down to dismiss
  const top = root.querySelector('.fv-top'); let y0 = null;
  on(top, 'pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; top.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
  on(top, 'pointermove', (e) => { if (y0 === null) return; sheet.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  const end = (e) => { if (y0 === null) return; const dy = e.clientY - y0; y0 = null; sheet.style.transition = ''; if (dy > 110) closeForm(tok); else sheet.style.transform = ''; };
  on(top, 'pointerup', end); on(top, 'pointercancel', end);
  sheet.focus({ preventScroll: true });
}

const curMeta = () => MOVES[S.moveId].levels[S.level];
const curLevel = () => (S.poses && S.poses[S.level]) || null;

function selectLevel(i, first) {
  S.level = i; S.t = 0; S.wrongIdx = null; clearWrong();
  const meta = curMeta(), lv = curLevel(), move = MOVES[S.moveId];
  S.root.querySelector('#fv-kicker').textContent = `Form guide · ${move.name}`;
  const canvas = S.root.querySelector('canvas');
  canvas.setAttribute('aria-label', lv ? `3D figure doing ${meta.name}. ${lv.cues.movement.join(' ')}` : `3D figure for ${meta.name} is not available yet.`);
  S.root.querySelector('.fv-sheet').setAttribute('aria-label', `Form guide: ${meta.name}`);
  S.root.querySelector('#fv-ctrl').hidden = !lv;
  buildChrome();
  if (S.reduced && lv) S.t = lv.keyT || 0;
  renderBody();
  syncControls();
  if (S.ready) { rebuildLevelScene(); } else if (!first) { /* scene not ready yet */ }
  if (!first) S.root.querySelector('#fv-body').scrollTop = 0;
}

function renderBody() {
  const meta = curMeta(), lv = curLevel(), move = MOVES[S.moveId];
  const list = (a) => `<ol class="fv-list">${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  let h = `<h2 class="fv-title" id="fv-title">${esc(meta.name)}</h2><p class="fv-sub">${esc(meta.cue)}</p>`;
  if (lv) {
    const c = lv.cues;
    h += `<section><h3>Setup</h3>${list(c.setup)}</section><section><h3>Movement</h3>${list(c.movement)}</section>
    <section><h3>Common mistakes</h3><p class="fv-hint">Tap a mistake to see it on the figure.</p>${c.mistakes.map((m, i) => `<button class="fv-mistake" data-fv="mistake" data-i="${i}"><span class="mk">${esc(m.mistake)}</span><span class="fx">Fix: ${esc(m.fix)}</span></button>`).join('')}</section>
    <section><h3>Stop if</h3><p>${esc(c.stopIf.sign)}</p><p class="fv-drop">Drop to: ${esc(c.stopIf.easier)}</p></section>`;
  } else {
    h += `<section><p class="fv-soft">The 3D guide and full form notes for this level are coming soon.</p></section>`;
  }
  // Levels with no 3D guide yet (GUIDE_PENDING) are skipped here. The current level always shows.
  const lvBtns = move.levels.map((l, i) => (isGuidePending(S.moveId, i) && i !== S.level ? '' : `<button class="fv-lv ${i === S.level ? 'on' : ''}" data-fv="level" data-level="${i}"${i === S.level ? ' aria-current="true"' : ''}><span class="n">${i + 1}</span><span class="t">${esc(l.name)}${S.poses && S.poses[i] ? '' : ' <i>soon</i>'}</span></button>`)).join('');
  if (lvBtns) h += `<section><h3>See every level</h3><div class="fv-levels">${lvBtns}</div></section>`;
  if (lv) h += `<p class="fv-src">Sources: ${lv.sources.map(esc).join('; ')}</p>`;
  h += `<p class="fv-note">${esc(DISCLAIMER)}</p>`;
  S.root.querySelector('#fv-body').innerHTML = h;
}

function syncControls() {
  const r = S.root; if (!r.querySelector('.fv-sheet')) return;
  const p = r.querySelector('[data-fv="play"]'); p.innerHTML = S.playing ? ICON_PAUSE : ICON_PLAY; p.setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
  r.querySelectorAll('[data-fv="speed"]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === S.speed)));
}
function setPlaying(v) { S.playing = v; syncControls(); }
function setSpeed(v) { S.speed = v; syncControls(); }
function live(msg) { const el = S.root.querySelector('#fv-live'); if (el) { el.textContent = msg || ''; el.classList.toggle('on', !!msg); } }

/* ---------- mistakes: ghosted wrong pose for 1.5 s ---------- */
function clearWrong() {
  if (!S) return;
  clearTimeout(S.wrongTimer); S.wrongPose = null; S.hlJoints = null;
  if (S.three) { S.three.ghost.group.visible = false; S.three.hl.group.visible = false; }
  S.wrongF = null;
  S.root.querySelectorAll('.fv-mistake.on').forEach((b) => b.classList.remove('on'));
  live('');
}
function showMistake(i) {
  const lv = curLevel(); if (!lv || lv.textOnly) return;
  const m = lv.cues.mistakes[i]; if (!m) return;
  clearWrong();
  S.root.querySelector(`.fv-mistake[data-i="${i}"]`).classList.add('on');
  S.wrongPose = m.wrongPose || null; S.hlJoints = m.highlight || null;
  S.wrongF = S.wrongPose ? fkFull({ root: S.wrongPose.root, joints: S.wrongPose.joints }) : null;
  live(`Wrong form shown in red: ${m.mistake}`);
  { const own = S; S.wrongTimer = setTimeout(() => { if (S === own && !own.closed) clearWrong(); }, 1500); }
}

/* ---------- 3D scene ---------- */
async function startScene() {
  const s = S;
  try {
    const THREE = await import('three');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    if (S !== s || s.closed) return;
    initScene(s, THREE, OrbitControls);
  } catch (e) {
    console.error("form viewer:", e);
    const m = s.root && s.root.querySelector('#fv-msg');
    if (m) m.textContent = 'The 3D view needs an internet connection the first time. The form notes below still work.';
    if (s.root) { const c = s.root.querySelector('#fv-ctrl'); if (c) c.hidden = true; s.root.querySelectorAll('.fv-ov').forEach((e) => { e.hidden = true; }); }
  }
}

/* ---------- procedural textures (canvas, <= 512 px) ---------- */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvasTex(THREE, T, w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = T.aniso; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  T.tex.push(t); return t;
}
/** wood grain: wavy lines running down the canvas (vertical) in a w x h box at the current transform */
function grain(ctx, w, h, dark, light, n, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * w, amp = 1 + r() * 4, f = 0.01 + r() * 0.03, ph = r() * 6.28, d = r() < 0.7;
    ctx.strokeStyle = d ? dark : light; ctx.globalAlpha = 0.05 + r() * 0.16; ctx.lineWidth = 0.5 + r() * 1.6;
    ctx.beginPath(); for (let y = 0; y <= h; y += 8) { const px = x + Math.sin(y * f + ph) * amp; if (y === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y); } ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function woodTex(THREE, T, base, dark, light, seed) {
  return canvasTex(THREE, T, 128, 256, (ctx, w, h) => { ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, dark, light, 46, seed); });
}
function floorTex(THREE, T, W, D, fx, fz) { // planks run along x; rubber mat sized to the footprint. Drawn in a 213 px/m virtual frame, scaled to 512 px.
  const vw = W * 213.33, vd = D * 213.33;
  return canvasTex(THREE, T, 512, 512, (ctx) => {
    ctx.scale(512 / vw, 512 / vd);
    const r = rng(7), ph = 26, tones = ['#dcbd8e', '#d6b583', '#e0c395', '#d2b07c', '#dfc08f'];
    for (let row = 0; row * ph < vd; row++) {
      let x = -r() * 190;
      while (x < vw) {
        const len = 150 + r() * 90, y = row * ph;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, len, ph); ctx.clip();
        ctx.fillStyle = tones[(r() * tones.length) | 0]; ctx.fillRect(x, y, len, ph);
        ctx.translate(x, y + ph); ctx.rotate(-Math.PI / 2); grain(ctx, ph, len, '#8a6030', '#f3dcae', 7, (row * 31 + x) | 0); ctx.restore();
        ctx.strokeStyle = 'rgba(92,60,28,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, len, ph);
        x += len;
      }
    }
    const mw = Math.min(vw - 40, (fx + 0.2) * 213.33), mh = Math.min(vd - 40, (fz + 0.2) * 213.33), mx = (vw - mw) / 2, my = (vd - mh) / 2;
    ctx.save(); ctx.shadowColor = 'rgba(30,20,10,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; ctx.fillStyle = '#42528a'; ctx.fillRect(mx, my, mw, mh); ctx.restore();
    ctx.fillStyle = '#42528a'; ctx.fillRect(mx, my, mw, mh);
    for (let i = 0; i < 1400; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'; ctx.fillRect(mx + r() * mw, my + r() * mh, 1.5, 1.5); }
    ctx.strokeStyle = 'rgba(190,205,255,.55)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.strokeRect(mx + 8, my + 8, mw - 16, mh - 16); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, vw - 3, vd - 3);   // edge highlight
  });
}
function strataTex(THREE, T) { // 512 x 128 px = 2.4 m x 0.35 m: floorboard, joist band, concrete, soil, gravel
  return canvasTex(THREE, T, 512, 128, (ctx, W) => {
    const r = rng(11), L = [[0, 11], [11, 33], [44, 33], [77, 29], [106, 22]];
    // floorboard
    ctx.fillStyle = '#d9b985'; ctx.fillRect(0, 0, W, 11); ctx.save(); ctx.translate(0, 11); ctx.rotate(-Math.PI / 2); grain(ctx, 11, W, '#8a6030', '#f3dcae', 8, 3); ctx.restore();
    // joist band: timber joists with dark gaps
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(0, 11, W, 33);
    for (let x = 6; x < W; x += 64) { ctx.fillStyle = '#b98d5a'; ctx.fillRect(x, 12, 40, 31); ctx.strokeStyle = 'rgba(80,50,20,.5)'; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + 20, 27.5, k * 5, k * 4, 0, 0, 6.3); ctx.stroke(); } }
    // concrete
    ctx.fillStyle = '#a9acb4'; ctx.fillRect(0, 44, W, 33);
    for (let i = 0; i < 700; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(40,44,60,.18)'; ctx.fillRect(r() * W, 44 + r() * 33, 1 + r() * 2, 1 + r() * 2); }
    // soil
    ctx.fillStyle = '#6b4a2f'; ctx.fillRect(0, 77, W, 29);
    for (let i = 0; i < 600; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(30,18,8,.35)' : 'rgba(160,120,80,.3)'; ctx.fillRect(r() * W, 77 + r() * 29, 1 + r() * 3, 1 + r() * 2); }
    // gravel
    ctx.fillStyle = '#8b8d93'; ctx.fillRect(0, 106, W, 22);
    for (let i = 0; i < 260; i++) { const g = 90 + r() * 110; ctx.fillStyle = `rgb(${g},${g - 4},${g + 6})`; ctx.beginPath(); ctx.ellipse(r() * W, 106 + r() * 22, 2 + r() * 4, 1.5 + r() * 2.5, 0, 0, 6.3); ctx.fill(); }
    // layer seams, edge highlight
    ctx.strokeStyle = 'rgba(20,14,8,.55)'; ctx.lineWidth = 1.2; for (const [y] of L.slice(1)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, 0, W, 2);
  });
}
function stoneTex(THREE, T) { // dressed stone courses, ~1 m per tile
  return canvasTex(THREE, T, 512, 512, (ctx, W) => {
    const r = rng(5), rows = 6, rh = W / rows; ctx.fillStyle = '#efe9dc'; ctx.fillRect(0, 0, W, W);
    for (let row = 0; row < rows; row++) {
      let x = -r() * 120, y = row * rh;
      while (x < W) {
        const bw = 100 + r() * 70, g = 196 + r() * 26;
        ctx.fillStyle = `rgb(${g + 10},${g + 2},${g - 18})`; ctx.fillRect(x + 2, y + 2, bw - 4, rh - 4);
        for (let i = 0; i < 40; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(90,70,40,.14)'; ctx.fillRect(x + r() * bw, y + r() * rh, 2, 2); }
        x += bw;
      }
    }
  });
}
function fabricTex(THREE, T) {
  return canvasTex(THREE, T, 128, 128, (ctx, W) => {
    ctx.fillStyle = '#c8765f'; ctx.fillRect(0, 0, W, W);
    for (let i = 0; i < W; i += 3) { ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(i, 0, 1, W); ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0, i, W, 1); }
  });
}
function steelTex(THREE, T) {
  return canvasTex(THREE, T, 64, 256, (ctx, w, h) => { ctx.fillStyle = '#b4b9c4'; ctx.fillRect(0, 0, w, h); grain(ctx, w, h, '#6d7380', '#ffffff', 60, 9); });
}

/* ---------- artist's wooden manikin ---------- */
const rest = fk({ root: { pos: [0, 0.96, 0], rot: [0, 0, 0] }, joints: {} });
// [from, to, radius at "from", radius at "to"]. Tapered, thicker at the proximal end. Hands and feet are separate shapes.
const BONES = [];
for (const s of ['L', 'R']) BONES.push(
  [`shoulder_${s}`, `elbow_${s}`, 0.046, 0.036], [`elbow_${s}`, `wrist_${s}`, 0.036, 0.027],
  [`hip_${s}`, `knee_${s}`, 0.078, 0.054], [`knee_${s}`, `ankle_${s}`, 0.054, 0.038]);
BONES.push(['neck', 'head', 0.05, 0.044]);
const BALLS = [['shoulder_L', 0.058], ['shoulder_R', 0.058], ['elbow_L', 0.044], ['elbow_R', 0.044], ['wrist_L', 0.032], ['wrist_R', 0.032], ['hip_L', 0.082], ['hip_R', 0.082], ['knee_L', 0.06], ['knee_R', 0.06], ['ankle_L', 0.046], ['ankle_R', 0.046], ['neck', 0.05]];
const ELLIPSOIDS = [['root', [0, 0.02, 0], [0.16, 0.105, 0.11]], ['spine', [0, 0.11, 0], [0.145, 0.13, 0.095]], ['chest', [0, 0.13, 0], [0.178, 0.15, 0.115]]];
const HEAD = ['head', [0, 0.08, 0.012], [0.076, 0.1, 0.09]];

function makeManGeoms(THREE) {
  const lathe = (len, r0, r1) => {
    const pts = [new THREE.Vector2(0, -len / 2)];
    for (let k = 0; k <= 4; k++) { const t = k / 4, r = (r0 + (r1 - r0) * t) * (1 + 0.1 * Math.sin(Math.PI * t)); pts.push(new THREE.Vector2(k === 0 ? r * 0.8 : k === 4 ? r * 0.8 : r, -len / 2 + t * len)); }
    pts.push(new THREE.Vector2(0, len / 2));
    return new THREE.LatheGeometry(pts, 14);
  };
  const ball = new THREE.SphereGeometry(1, 16, 12);
  const egg = new THREE.SphereGeometry(1, 20, 16), pa = egg.attributes.position;   // wider cranium, narrower chin
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i), k = 1 + 0.12 * y; pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); }
  egg.computeVertexNormals();
  const foot = new THREE.BoxGeometry(0.09, 0.1, 0.2); foot.translate(0, -0.04, 0.05);   // sole 2 cm below the heel point (figure is lifted by FIG_LIFT)
  const fp = foot.attributes.position;
  for (let i = 0; i < fp.count; i++) if (fp.getY(i) > -0.03 && fp.getZ(i) > 0.1) fp.setY(i, -0.055);   // wedge: slopes down to the toes
  foot.computeVertexNormals();
  const toe = new THREE.BoxGeometry(0.086, 0.034, 0.07); toe.translate(0, -0.003, 0.035);
  return { bones: BONES.map(([a, b, r0, r1]) => lathe(vlen(vsub(rest[a], rest[b])), r0, r1)), ball, egg, foot, toe };
}

function buildMannequin(THREE, G, wood, joint, shadows) {
  const group = new THREE.Group(); group.position.y = FIG_LIFT;
  const parts = [];
  const add = (mesh, upd) => { mesh.castShadow = shadows; group.add(mesh); parts.push(upd); };
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
  BONES.forEach(([a, b], i) => {
    const m = new THREE.Mesh(G.bones[i], wood);
    add(m, (F) => { const pa = F.pos[a], pb = F.pos[b]; d.set(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]); d.normalize(); m.position.set((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2); m.quaternion.setFromUnitVectors(up, d); });
  });
  for (const [j, r] of BALLS) { const m = new THREE.Mesh(G.ball, joint); m.scale.setScalar(r); add(m, (F) => m.position.set(...F.pos[j])); }
  const ell = (geo, mat, j, off, rad) => { const m = new THREE.Mesh(geo, mat); m.scale.set(...rad); add(m, (F) => { const o = qrot(F.quat[j], off), p = F.pos[j]; m.position.set(p[0] + o[0], p[1] + o[1], p[2] + o[2]); m.quaternion.set(...F.quat[j]); }); };
  for (const [j, off, rad] of ELLIPSOIDS) ell(G.ball, wood, j, off, rad);
  ell(G.egg, wood, HEAD[0], HEAD[1], HEAD[2]);
  for (const s of ['L', 'R']) {
    ell(G.ball, wood, `wrist_${s}`, [0, -0.035, 0], [0.03, 0.047, 0.026]);   // mitten hand, from wrist toward the palm point
    const f = new THREE.Mesh(G.foot, wood), t = new THREE.Mesh(G.toe, wood);
    add(f, (F) => { f.position.set(...F.pos[`ankle_${s}`]); f.quaternion.set(...F.quat[`ankle_${s}`]); });
    add(t, (F) => { t.position.set(...F.pos[`toe_${s}`]); t.quaternion.set(...F.quat[`toe_${s}`]); });
  }
  return { group, update(F) { for (const u of parts) u(F); } };
}

/* ---------- scene ---------- */
function initScene(s, THREE, OrbitControls) {
  const canvas = s.root.querySelector('canvas'), stage = s.root.querySelector('.fv-stage');
  const dark = matchMedia('(prefers-color-scheme: dark)').matches, phone = matchMedia('(pointer: coarse)').matches;
  const css = getComputedStyle(stage), cv = (n, d) => css.getPropertyValue(n).trim() || d;
  const bg = new THREE.Color(cv('--fv-bg', dark ? '#0e1430' : '#e8ebf8')), ink = new THREE.Color(cv('--fv-ink', dark ? '#8fa4ff' : '#1f3fd6'));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = dark ? 1.0 : 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = bg;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  const T = { THREE, renderer, scene, camera, ink, tex: [], mats: [], aniso: Math.min(4, renderer.capabilities.getMaxAnisotropy()) };
  const std = (o) => { const m = new THREE.MeshStandardMaterial(o); T.mats.push(m); return m; };
  scene.add(new THREE.HemisphereLight(dark ? 0xaab6ee : 0xdfe4ff, 0xc9a77a, dark ? 1.15 : 1.35));
  const sun = new THREE.DirectionalLight(0xfff1dc, dark ? 2.0 : 2.4); sun.position.set(-1.6, 3.2, 2.0); sun.castShadow = true;
  const ms = phone ? 1024 : 2048; sun.shadow.mapSize.set(ms, ms); sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01;
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 9 });
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xdfe4ff, 0.45); fill.position.set(2.2, 1.6, -1.8); scene.add(fill);
  // plinth: one box, six material slots (+x, -x, top, bottom, +z, -z). Top face is y = 0 (the FK floor).
  const sideM = std({ map: strataTex(THREE, T), roughness: 0.92 }), topM = std({ roughness: 0.7 }), botM = std({ color: 0x3a2a1c, roughness: 1 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), [sideM, sideM, topM, botM, sideM, sideM]); floor.receiveShadow = true; scene.add(floor);
  // manikin materials
  const wood = std({ map: woodTex(THREE, T, '#e2c28f', '#9a6c36', '#f6e3bd', 21), roughness: 0.62 });
  const joint = std({ map: woodTex(THREE, T, '#6c4630', '#2e1a0e', '#9a6c4c', 33), roughness: 0.55 });
  const ghostMat = std({ color: 0xff3b30, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }); ghostMat.userData.noWire = true;
  const hlMat = std({ color: 0xff453a, transparent: true, opacity: 0.9, depthTest: false }); hlMat.userData.noWire = true;
  const G = makeManGeoms(THREE);
  const fig = buildMannequin(THREE, G, wood, joint, true); scene.add(fig.group);
  const ghost = buildMannequin(THREE, G, ghostMat, ghostMat, false); ghost.group.visible = false; scene.add(ghost.group);
  const hl = { group: new THREE.Group(), balls: [] }; hl.group.visible = false; hl.group.renderOrder = 10; scene.add(hl.group);
  const hlGeo = new THREE.SphereGeometry(0.075, 16, 12);
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(hlGeo, hlMat); m.renderOrder = 10; hl.group.add(m); hl.balls.push(m); }
  // shared prop materials (props never dispose these)
  const timberTex = woodTex(THREE, T, '#b98d5a', '#6d4720', '#e0b886', 41);
  const pm = {
    iron: std({ color: 0x2b2d31, roughness: 0.6, metalness: 0.25 }), timber: std({ map: timberTex, roughness: 0.8 }),
    stone: std({ map: stoneTex(THREE, T), roughness: 0.92 }), fabric: std({ map: fabricTex(THREE, T), roughness: 1 }),
    steel: std({ map: steelTex(THREE, T), roughness: 0.38, metalness: 0.45 }), pages: std({ color: 0xf1e8d2, roughness: 1 }),
    covers: [0x3f5fb0, 0xb9503f, 0x4f8a60].map((c) => std({ color: c, roughness: 0.75 })),
  };
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.09; controls.rotateSpeed = 0.9; controls.zoomSpeed = 0.9;
  Object.assign(T, { topM, controls, fig, ghost, hl, floor, sun, hlGeo, pm, path: null });
  Object.assign(s, { three: T, propObjs: [], ready: true, tween: null });
  controls.addEventListener('start', () => { s.tween = null; s.root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false')); });
  // double tap / double click resets the view
  let last = 0, lx = 0, ly = 0;
  const up = (e) => { const now = performance.now(); if (now - last < 320 && Math.hypot(e.clientX - lx, e.clientY - ly) < 24) { goView('default'); last = 0; } else { last = now; lx = e.clientX; ly = e.clientY; } };
  canvas.addEventListener('pointerup', up); s.cleanups.push(() => canvas.removeEventListener('pointerup', up));
  canvas.style.touchAction = 'none';
  setupDial(s, stage);
  const fit = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; s.sw = w; s.sh = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (s.level !== undefined) frameBounds(false); };
  const ro = new ResizeObserver(fit); ro.observe(stage); s.cleanups.push(() => ro.disconnect());
  s.root.querySelector('#fv-msg').hidden = true;
  rebuildLevelScene(); fit();
  goView(s.pendingView || 'default', true); s.pendingView = null;
  let prev = performance.now();
  const loop = (now) => {
    if (S !== s || s.closed) return;
    s.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
    const lv = curLevel();
    if (lv && s.playing) { s.t = (s.t + dt * s.speed) % lv.duration; const sc = s.root.querySelector('#fv-scrub'); if (sc && !s.scrubbing) sc.value = Math.round((s.t / lv.duration) * 1000); }
    if (s.tween) stepTween(now);
    drawFrame();
  };
  s.raf = requestAnimationFrame(loop);
}

/** circular dial: drag to turn the camera around the figure (azimuth) */
function setupDial(s, stage) {
  const dial = stage.querySelector('.fv-dial'); if (!dial) return;
  let a0 = null;
  const ang = (e) => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  const on = (ev, fn) => { dial.addEventListener(ev, fn); s.cleanups.push(() => dial.removeEventListener(ev, fn)); };
  on('pointerdown', (e) => { a0 = ang(e); s.tween = null; dial.setPointerCapture(e.pointerId); e.preventDefault(); });
  on('pointermove', (e) => { if (a0 === null) return; const a = ang(e); let d = a - a0; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; a0 = a; spinCamera(d); });
  const end = () => { a0 = null; };
  on('pointerup', end); on('pointercancel', end);
  on('keydown', (e) => { const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (k) { e.preventDefault(); s.tween = null; spinCamera(k * Math.PI / 18); } });
}
function spinCamera(d) {
  const s = S, T = s && s.three; if (!T) return;
  const off = T.camera.position.clone().sub(T.controls.target), az = Math.atan2(off.x, off.z), r = Math.hypot(off.x, off.z);
  off.x = r * Math.sin(az + d); off.z = r * Math.cos(az + d);
  T.camera.position.copy(T.controls.target).add(off); T.controls.update();
  s.root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
}

function disposeScene(s) {
  const T = s.three; if (!T) return;
  T.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const o of s.propObjs || []) disposeObj(o.obj);
  clearPath(T);
  for (const m of T.mats) m.dispose();
  for (const t of T.tex) t.dispose();
  T.controls.dispose(); T.renderer.dispose();
  if (T.renderer.forceContextLoss) T.renderer.forceContextLoss();
  s.three = null;
}
// props own their geometry; only materials/textures flagged userData.own are theirs (the rest are shared and freed on close)
function disposeObj(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m.userData.own) { if (m.map) m.map.dispose(); if (m.userData.o && m.userData.o.map) m.userData.o.map.dispose(); m.dispose(); }
  });
}
function clearPath(T) { if (T.path) { T.scene.remove(T.path); T.path.geometry.dispose(); T.path.material.dispose(); T.path = null; } }

/** wireframe toggle: every shared material becomes blue lines. Original colour and map are stashed in userData.o. */
function applyWire() {
  const s = S, T = s && s.three; if (!T) return;
  const seen = new Set();
  T.scene.traverse((o) => {
    if (!o.material) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (seen.has(m) || m.userData.noWire) continue; seen.add(m);
      if (s.wire) { if (!m.userData.o) m.userData.o = { color: m.color.clone(), map: m.map, wf: m.wireframe }; m.wireframe = true; m.map = null; m.color.copy(T.ink); }
      else if (m.userData.o) { const q = m.userData.o; m.color.copy(q.color); m.map = q.map; m.wireframe = q.wf; m.userData.o = null; }
      m.needsUpdate = true;
    }
  });
}

/* ---------- props ---------- */
function makeProp(THREE, p, pm) {
  const g = new THREE.Group();
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  if (p.type === 'kettlebell') { // matte cast iron: flat base, round body, torus-segment handle
    const pts = [[0, -0.09], [0.05, -0.09], [0.075, -0.08], [0.088, -0.05], [0.092, 0], [0.085, 0.05], [0.065, 0.082], [0.03, 0.093], [0, 0.094]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), pm.iron); body.castShadow = true; g.add(body);
    const arc = Math.PI * 1.25, handle = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0125, 10, 24, arc), pm.iron);
    handle.position.y = 0.094; handle.rotation.z = Math.PI / 2 - arc / 2; handle.castShadow = true; g.add(handle);
  } else if (p.type === 'books') { // stack of 3 hardbacks with page edges
    const [w, h, d] = p.size, bh = h / 3, t = 0.004;
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group(), cov = pm.covers[i % pm.covers.length], by = i * bh;
      const part = (bw, bhh, bd, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(bw, bhh, bd), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; b.add(o); };
      part(w, t, d, cov, 0, t / 2, 0); part(w, t, d, cov, 0, bh - t / 2, 0);
      part(w, bh, 0.008, cov, 0, bh / 2, -d / 2 + 0.004);
      part(w - 0.012, bh - 2 * t - 0.001, d - 0.016, pm.pages, 0, bh / 2, 0.004);
      b.position.y = by; b.rotation.y = (i - 1) * 0.07; g.add(b);
    }
  } else if (p.type === 'chair') {
    const seat = p.seat || 0.45;
    box(0.42, 0.04, 0.42, pm.timber, 0, seat - 0.02, 0);
    for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) box(0.04, seat - 0.04, 0.04, pm.timber, x, (seat - 0.04) / 2, z);
    box(0.42, 0.34, 0.03, pm.timber, 0, seat + 0.17, -0.2);
  } else if (p.type === 'box') {
    const [w, h, d] = p.size; box(w, h, d, pm.timber, 0, h / 2, 0);
  } else if (p.type === 'cushion') {
    const [w, h, d] = p.size || [0.4, 0.1, 0.4], c = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), pm.fabric); c.scale.set(w / 2, h / 2, d / 2); c.position.y = h / 2; c.castShadow = true; c.receiveShadow = true; g.add(c);
  } else if (p.type === 'bar') { // doorway pull-up bar: p.h = height of the bar centre, p.width = door width (default 0.8 m)
    const w = p.width || 0.8, bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, w, 16), pm.steel);
    bar.rotation.z = Math.PI / 2; bar.position.y = p.h; bar.castShadow = true; g.add(bar);
    for (const x of [-1, 1]) { // jambs are see-through so they never hide the figure from the Side camera; the bar stays opaque
      const jm = new THREE.MeshStandardMaterial({ map: pm.timber.map, roughness: 0.8, transparent: true, opacity: 0.25, depthWrite: false }); jm.userData.own = true;
      const jamb = box(0.05, p.h + 0.12, 0.1, jm, x * (w / 2 + 0.025), (p.h + 0.12) / 2, 0.0);
      jamb.castShadow = false; jamb.receiveShadow = false; jamb.renderOrder = 1;
    }
  } else if (p.type === 'wall') { // dressed stone block, 0.12 m thick, extending away from the figure (+z)
    const [w, h] = p.size || [2, 2.4], tex = pm.stone.map.clone(); tex.repeat.set(w, h / 1.0); tex.needsUpdate = true;
    const wm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }); wm.userData.own = true;
    box(w, h, 0.12, wm, 0, h / 2, 0.06);
  }
  return g;
}

function rebuildLevelScene() {
  const s = S, T = s.three; if (!T) return;
  for (const o of s.propObjs) { o.obj.parent && o.obj.parent.remove(o.obj); disposeObj(o.obj); }
  s.propObjs = []; clearPath(T);
  const lv = curLevel(), msg = s.root.querySelector('#fv-msg');
  T.fig.group.visible = !!lv && !lv.textOnly; clearWrong();
  if (!lv) { msg.hidden = false; msg.textContent = '3D guide coming soon for this level.'; return; }
  if (lv.textOnly) { msg.hidden = false; msg.textContent = 'No 3D view for this level yet. Follow the steps below carefully, and ask someone to spot you.'; return; }
  msg.hidden = true;
  for (const p of lv.props || []) {
    const obj = makeProp(T.THREE, p, T.pm);
    if (p.attach) T.fig.group.add(obj); else { obj.position.set(p.pos[0], p.pos[1], p.pos[2]); obj.rotation.y = ((p.rotY || 0) * Math.PI) / 180; T.scene.add(obj); }
    s.propObjs.push({ obj, p });
  }
  // bounds over the whole loop
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < 24; i++) for (const v of Object.values(fk(samplePose(lv, (i / 24) * lv.duration)))) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
  for (const p of lv.props || []) if (!p.attach) for (const [dx, dy, dz] of [[-0.3, 0, -0.3], [0.3, 0.6, 0.3]]) for (let k = 0; k < 3; k++) { const v = p.pos[k] + [dx, dy, dz][k]; min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v); }
  for (const p of lv.props || []) if (p.type === 'bar') max[1] = Math.max(max[1], p.h + 0.12);
  const c = [0, 1, 2].map((k) => (min[k] + max[k]) / 2), r = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  s.bounds = { c, r: Math.max(r, 1.0) };
  // everything that must stay in frame: the figure's box over the loop (+ props) and the whole plinth with its cutaway faces
  s.tgt = new T.THREE.Vector3(c[0], c[1] * 0.9 + FIG_LIFT, c[2]); s.fitPts = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1] + FIG_LIFT, max[1] + FIG_LIFT]) for (const z of [min[2], max[2]]) s.fitPts.push(new T.THREE.Vector3(x, y, z));
  const fx = max[0] - min[0], fz = max[2] - min[2], PW = Math.max(1.2, fx + 0.6), PD = Math.max(1.2, fz + 0.6);   // plinth: footprint + 0.3 m each side
  T.floor.geometry.dispose(); T.floor.geometry = new T.THREE.BoxGeometry(PW, 0.3, PD); T.floor.geometry.translate(0, -0.15, 0);
  const ft = floorTex(T.THREE, T, PW, PD, fx, fz);
  if (T.topM.map) { T.topM.map.dispose(); T.tex.splice(T.tex.indexOf(T.topM.map), 1); }
  if (T.topM.userData.o) { const old = T.topM.userData.o.map; if (old) { old.dispose(); T.tex.splice(T.tex.indexOf(old), 1); } T.topM.userData.o.map = ft; } else T.topM.map = ft;
  T.topM.needsUpdate = true;
  T.floor.position.set(c[0], 0, c[2]);
  for (const x of [-PW / 2, PW / 2]) for (const y of [0, -0.3]) for (const z of [-PD / 2, PD / 2]) s.fitPts.push(new T.THREE.Vector3(c[0] + x, y, c[2] + z));
  T.sun.target.position.set(c[0], 0, c[2]); T.sun.position.set(c[0] - 1.6, 3.2, c[2] + 2.0);
  T.controls.target.set(c[0], c[1] * 0.9 + FIG_LIFT, c[2]);
  buildPath(s, lv);
  applyWire();
  frameBounds(true);
  const sc = s.root.querySelector('#fv-scrub'); if (sc) sc.value = Math.round((s.t / lv.duration) * 1000);
}

/** dotted trajectory of the key moving point (kettlebell centre if held, else the tempo point, else the head) over one loop */
function buildPath(s, lv) {
  const T = s.three, { THREE } = T, N = 72, kb = (lv.props || []).find((p) => p.type === 'kettlebell' && p.attach);
  const pt = (lv.tempo && lv.tempo.point) || 'head_top', pos = new Float32Array((N + 1) * 3);
  for (let i = 0; i <= N; i++) {
    const F = fkFull(samplePose(lv, (i / N) * lv.duration));
    let v;
    if (kb) { const o = qrot(F.quat[kb.attach], kb.offset), j = F.pos[kb.attach]; v = [j[0] + o[0], j[1] + o[1], j[2] + o[2]]; } else v = F.pos[pt] || F.pos.head_top;
    pos.set([v[0], v[1] + FIG_LIFT, v[2]], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineDashedMaterial({ color: T.ink, dashSize: 0.018, gapSize: 0.024, depthTest: false, transparent: true }); mat.userData.noWire = true;
  const line = new THREE.Line(geo, mat); line.computeLineDistances(); line.renderOrder = 6; line.visible = !!s.path; line.frustumCulled = false;
  T.scene.add(line); T.path = line;
}

/** px bands covered by chrome (top toggles/title, bottom strip/dial) that the fit must keep clear */
function measureBands(s) {
  const st = s.root.querySelector('.fv-stage'), sr = st.getBoundingClientRect(), vis = (e) => e && !e.hidden && e.offsetParent !== null;
  let top = 10, bot = 12;
  const tb = st.querySelector('.fv-tools'); if (vis(tb)) top = tb.getBoundingClientRect().bottom - sr.top + 8;
  if (isCompact()) {
    const tt = st.querySelector('.fv-ttl'); if (vis(tt)) top = Math.max(top, tt.getBoundingClientRect().bottom - sr.top + 6);
    for (const q of ['.fv-ro', '.fv-br']) { const e = st.querySelector(q); if (vis(e)) bot = Math.max(bot, sr.bottom - e.getBoundingClientRect().top + 8); }
  }
  return { top, bot };
}
/** smallest camera distance for direction dir that keeps every fit point inside the clear area, plus the view offset that centres it */
function fitFor(dir) {
  const s = S, T = s.three, { THREE, camera } = T, w = s.sw, h = s.sh, tgt = s.tgt, band = measureBands(s);
  const clearW = w - 20, clearH = Math.max(60, h - band.top - band.bot);
  const cam = new THREE.PerspectiveCamera(camera.fov, w / h, 0.05, 60), v = new THREE.Vector3();
  const probe = (D) => {
    cam.position.copy(tgt).addScaledVector(dir, D); cam.lookAt(tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of s.fitPts) { v.copy(p).applyMatrix4(cam.matrixWorldInverse); if (v.z > -0.1) return null; v.copy(p).project(cam); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    return { x0, x1, y0, y1 };
  };
  const ok = (D) => { const b = probe(D); return !!b && ((b.x1 - b.x0) / 2) * w <= clearW && ((b.y1 - b.y0) / 2) * h <= clearH; };
  let lo = 0.5, hi = 40; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
  const b = probe(hi) || { x0: -1, x1: 1, y0: -1, y1: 1 };
  const cx = ((b.x0 + b.x1) / 4 + 0.5) * w, cy = (0.5 - (b.y0 + b.y1) / 4) * h;   // bbox centre, px
  return { dist: hi, x: -(w / 2 - cx), y: -(band.top + clearH / 2 - cy) };
}
function applyVO(o) { const s = S; s.vo = { x: o.x, y: o.y }; s.three.camera.setViewOffset(s.sw, s.sh, o.x, o.y, s.sw, s.sh); }
const viewDir = (THREE, name) => new THREE.Vector3(...(name === 'default' ? DEFAULT_DIR : VIEWS[name])).normalize();
function frameBounds(reset) {
  const s = S, T = s.three; if (!T || !s.bounds || !s.sw) return;
  const { camera, controls, THREE } = T;
  s.dist = fitFor(viewDir(THREE, 'default')).dist;
  controls.minDistance = s.dist * 0.45; controls.maxDistance = s.dist * 2.2;
  if (reset) goView('default', true);
  else applyVO(fitFor(camera.position.clone().sub(controls.target).normalize()));   // resize: keep the camera, re-centre in the clear area
}

/* ---------- camera presets ---------- */
function goView(name, instant) {
  const s = S, T = s.three;
  if (!T || !s.bounds || !s.sw) { if (name !== 'default') { s.pendingView = name; s.root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name))); } return; }
  const { THREE, camera, controls } = T, dir = viewDir(THREE, name), fit = fitFor(dir), tgt = s.tgt.clone();
  s.root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  if (instant || s.reduced) { controls.target.copy(tgt); camera.position.copy(tgt).addScaledVector(dir, fit.dist); applyVO(fit); controls.update(); s.tween = null; return; }
  const startOff = camera.position.clone().sub(controls.target), startDir = startOff.clone().normalize(), q = new THREE.Quaternion().setFromUnitVectors(startDir, dir);
  s.tween = { t0: performance.now(), dur: 420, startDir, startLen: startOff.length(), q, endLen: fit.dist, tgt, from: controls.target.clone(), vo0: s.vo || { x: 0, y: 0 }, vo1: fit };
}
function stepTween(now) {
  const s = S, T = s.three, tw = s.tween, { THREE, camera, controls } = T;
  const u = Math.min(1, (now - tw.t0) / tw.dur), e = u * u * (3 - 2 * u);
  const qq = new THREE.Quaternion().slerp(tw.q, e), dir = tw.startDir.clone().applyQuaternion(qq);
  controls.target.lerpVectors(tw.from, tw.tgt, e);
  camera.position.copy(controls.target).addScaledVector(dir, tw.startLen + (tw.endLen - tw.startLen) * e);
  applyVO({ x: tw.vo0.x + (tw.vo1.x - tw.vo0.x) * e, y: tw.vo0.y + (tw.vo1.y - tw.vo0.y) * e });
  if (u >= 1) s.tween = null;
}

/* ---------- readouts and joint labels ---------- */
const SIDE = (lv) => (lv.tempo && /_R$/.test(lv.tempo.point) ? 'R' : 'L');
const HIP_A = ['HIP', 'shoulder', 'hip', 'knee'], KNEE_A = ['KNEE', 'hip', 'knee', 'ankle'], ELB_A = ['ELBOW', 'shoulder', 'elbow', 'wrist'], SHO_A = ['SHOULDER', 'hip', 'shoulder', 'elbow'];
const ANGLES = { squat: [KNEE_A, HIP_A], hinge: [HIP_A, KNEE_A], hpush: [ELB_A, SHO_A, HIP_A], vpush: [ELB_A, SHO_A], row: [ELB_A, SHO_A, HIP_A], core: [HIP_A, SHO_A, KNEE_A] };
const NAMES = { squat: [['HIP', 'hip'], ['KNEE', 'knee'], ['ANKLE', 'ankle']], hinge: [['HIP', 'hip'], ['KNEE', 'knee'], ['ANKLE', 'ankle']], hpush: [['SHOULDER', 'shoulder'], ['ELBOW', 'elbow'], ['WRIST', 'wrist']], vpush: [['SHOULDER', 'shoulder'], ['ELBOW', 'elbow'], ['WRIST', 'wrist']], row: [['SHOULDER', 'shoulder'], ['ELBOW', 'elbow'], ['WRIST', 'wrist']], core: [['SHOULDER', 'shoulder'], ['HIP', 'hip'], ['KNEE', 'knee']] };

/** Build the title, readout rows and joint labels for the current level (HTML only, no WebGL). */
function buildChrome() {
  const lv = curLevel(), meta = curMeta(), r = S.root;
  r.querySelector('#fv-ttl-h').textContent = meta.name.toUpperCase();
  r.querySelector('#fv-ttl-c').textContent = meta.cue || '';
  const ro = r.querySelector('#fv-ro'), lab = r.querySelector('#fv-labels');
  ro.innerHTML = ''; lab.innerHTML = ''; S.ro = null; S.nm = null; S.roLast = {};
  r.querySelectorAll('.fv-ov').forEach((e) => { e.hidden = !lv; });
  if (!lv) return;
  const side = SIDE(lv), row = (k, v, x) => { const d = document.createElement('div'); if (x) d.className = 'x'; d.innerHTML = `<span>${k}</span><b>${v}</b>`; ro.appendChild(d); return d.lastChild; };
  S.ro = { ang: (ANGLES[S.moveId] || [HIP_A, KNEE_A]).map((a) => ({ def: a, el: row(a[0], '--') })), phase: row('PHASE', '--', 1), side };
  if (lv.tempo && lv.tempo.lower) row('TEMPO', `${lv.tempo.lower}-${lv.tempo.press || 1}`, 1);
  S.nm = (NAMES[S.moveId] || NAMES.squat).map(([label, j]) => { const e = document.createElement('div'); e.className = 'fv-nm'; e.innerHTML = `<span>${label}</span>`; lab.appendChild(e); return { el: e, joint: `${j}_${side}` }; });
  lab.hidden = !S.names;
}
function setToggle(name, on) {
  S[name] = on;
  const b = S.root.querySelector(`[data-fv="${name}"]`); if (b) b.setAttribute('aria-pressed', String(on));
  const T = S.three;
  if (name === 'wire') applyWire();
  else if (name === 'path' && T && T.path) T.path.visible = on;
  else if (name === 'names') { const l = S.root.querySelector('#fv-labels'); if (l) l.hidden = !on; }
}
function setText(s, key, el, v) { if (s.roLast[key] !== v) { s.roLast[key] = v; el.textContent = v; } }
function phaseOf(lv, t) {
  const pt = (lv.tempo && lv.tempo.point) || 'head_top', ax = lv.tempo && lv.tempo.axis != null ? lv.tempo.axis : 1, e = 0.06;
  const a = fk(samplePose(lv, t - e))[pt], b = fk(samplePose(lv, t + e))[pt];
  if (!a || !b) return 'HOLD';
  const v = (b[ax] - a[ax]) / (2 * e);
  return Math.abs(v) < 0.015 ? 'HOLD' : v < 0 ? 'LOWER' : 'RISE';
}
function updateReadouts(s, lv, F) {
  const ro = s.ro; if (!ro) return;
  ro.ang.forEach(({ def: [k, a, b, c], el }) => { const P = (n) => F.pos[`${n}_${ro.side}`]; setText(s, k, el, `${Math.round(vangle(vsub(P(a), P(b)), vsub(P(c), P(b))))}°`); });
  setText(s, 'phase', ro.phase, phaseOf(lv, s.t));
}
function updateLabels(s, T, F) {
  if (!s.names || !s.nm || !s.sw) return;
  const v = new T.THREE.Vector3();
  for (const { el, joint } of s.nm) { const p = F.pos[joint]; v.set(p[0], p[1] + FIG_LIFT, p[2]).project(T.camera); el.style.transform = `translate(${((v.x * 0.5 + 0.5) * s.sw).toFixed(1)}px,${((-v.y * 0.5 + 0.5) * s.sh).toFixed(1)}px)`; }
}

/* ---------- per-frame drawing ---------- */
function drawFrame() {
  const s = S; if (!s || !s.three) return;
  const T = s.three, lv = curLevel();
  let F = null;
  if (lv) {
    F = fkFull(samplePose(lv, s.t));
    T.fig.update(F);
    for (const { obj, p } of s.propObjs) if (p.show) obj.visible = s.t >= p.show[0] && s.t < p.show[1]; // optional time window (e.g. the carry's bell changes hands)
    for (const { obj, p } of s.propObjs) if (p.attach) { const o = qrot(F.quat[p.attach], p.offset), j = F.pos[p.attach]; obj.position.set(j[0] + o[0], j[1] + o[1], j[2] + o[2]); obj.quaternion.set(...(p.flipX ? qmul(F.quat[p.attach], [1, 0, 0, 0]) : F.quat[p.attach])); }
    let hlF = F;
    if (s.wrongF) { T.ghost.update(s.wrongF); T.ghost.group.visible = true; hlF = s.wrongF; } else T.ghost.group.visible = false;
    if (s.hlJoints) { T.hl.group.visible = true; T.hl.group.position.y = FIG_LIFT; T.hl.balls.forEach((b, i) => { const j = s.hlJoints[i]; b.visible = !!j; if (j && hlF.pos[j]) b.position.set(...hlF.pos[j]); }); } else T.hl.group.visible = false;
    updateReadouts(s, lv, F);
  }
  T.controls.update();
  T.renderer.render(T.scene, T.camera);
  if (F) updateLabels(s, T, F);
  // dial: camera azimuth in degrees
  const d = s.root.querySelector('.fv-dial');
  if (d) { const o = T.camera.position, c = T.controls.target, deg = ((Math.round((Math.atan2(o.x - c.x, o.z - c.z) * 180) / Math.PI) % 360) + 360) % 360; if (s.deg !== deg) { s.deg = deg; d.style.setProperty('--a', `${deg}deg`); d.setAttribute('aria-valuenow', String(deg)); d.querySelector('.dg').textContent = `${deg}°`; } }
}
