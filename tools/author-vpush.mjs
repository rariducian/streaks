// Generates js/form/poses/vpush.gen.js (plain keyframe data) for the vertical-push ladder.
// Levels: 0 KB press, 1 tempo KB press, 2 pike push-up, 3 elevated pike push-up, 4 wall handstand negatives.
// Run: node tools/author-vpush.mjs   (add --report for a table of joint angles)
import { writeFileSync } from 'node:fs';
import { solve, newPose, both, one, clonePose, keyframe, phaseFn, round } from './solve.mjs';
import { fk, flexionDeg, vsub, vangle, vmid } from '../js/form/skeleton.js';

const REPORT = process.argv.includes('--report');
const DT = 0.125;
const lerp = (a, b, s) => a + (b - a) * s;
const jp = (p) => ({ root: { pos: p.root.pos.map((v) => round(v)), rot: p.root.rot.map((v) => round(v, 2)) }, joints: keyframe(0, p).joints });
const out = {};

/* =====================================================================================================
   KB press (levels 0 and 1). Standing, feet flat and hip-width. Left arm presses; right arm hangs.
   s = 0 lockout (arm straight, bicep by the ear), s = 1 rack (elbow at the ribs, forearm vertical, wrist straight).
   ===================================================================================================== */
const FEET = ['toe_L', 'toe_R', 'heel_L', 'heel_R'];
const standBase = () => { const p = newPose(); p.joints.shoulder_R = [0, 0, 6]; p.joints.shoulder_L = [33, 0, 0]; p.joints.elbow_L = [140, 0, 0]; return p; };
const ARM_FREE = [one('shoulder', 'L', 0), one('shoulder', 'L', 1), one('shoulder', 'L', 2), one('elbow', 'L', 0, { min: 0, max: 158 })];
function armFrame(warm, o) {
  const pose = clonePose(warm);
  pose.joints.wrist_L = [0, 0, 0]; // wrist stays straight: hand continues the line of the forearm
  const T = [{ p: 'wrist_L', rel: 'shoulder_L', x: o.x, y: o.y, z: o.z }];
  if (o.vertical) T.push({ p: 'wrist_L', rel: 'elbow_L', x: 0, z: 0, w: 0.6 });
  if (o.elbowX !== undefined) T.push({ p: 'elbow_L', rel: 'shoulder_L', x: o.elbowX, w: 0.25 });
  const priors = [{ path: 'joints.shoulder_L.1', value: 0, w: 0.02 }, { path: 'joints.shoulder_L.2', value: 0, w: 0.02 }];
  if (o.up) priors.push({ path: 'joints.shoulder_L.0', value: 178, w: 0.05 }, { path: 'joints.elbow_L.0', value: 3, w: 0.05 });
  return solve(pose, { free: ARM_FREE, targets: [...T, ...(o.targets || [])], priors });
}
// rack and lockout positions of the wrist relative to the shoulder (metres)
const RACK = { x: -0.03, z: 0.18, y: -0.02, vertical: true, elbowX: -0.03 };
const LOCK = { x: -0.03, z: 0.0, y: 0.582, elbowX: -0.03 };
const armAt = (s, warm) => armFrame(warm, { x: lerp(LOCK.x, RACK.x, s), y: lerp(LOCK.y, RACK.y, s), z: lerp(LOCK.z, RACK.z, s), elbowX: s > 0.5 ? lerp(LOCK.elbowX, RACK.elbowX, s) : undefined, vertical: s > 0.97, up: s < 0.25 });
// continuation from the rack up to the lockout, so each solve starts close to its answer
const rackArm = armFrame(standBase(), RACK);
if (rackArm.err > 0.02) console.warn('rack err', rackArm.err, rackArm.misses.join(' '));
const GRID = 50, grid = [];
{ let warm = rackArm.pose; for (let k = 0; k <= GRID; k++) { const s = 1 - k / GRID, r = armAt(s, warm); warm = r.pose; grid[k] = { s, pose: r.pose, err: r.err }; if (process.env.DBG) console.log(k, s.toFixed(2), r.err.toFixed(3), r.pose.joints.shoulder_L.map((v) => v.toFixed(0)).join('/'), flexionDeg(r.pose, 'elbow_L').toFixed(0)); } }
const lockArm = grid[GRID];
if (lockArm.err > 0.01) console.warn('lock err', lockArm.err);

function buildKB(segs) {
  const { total, at } = phaseFn(segs);
  let worst = Math.max(...grid.map((g) => g.err)); const frames = [];
  const n = Math.round(total / DT);
  for (let i = 0; i < n; i++) {
    const t = i * DT, s = at(t), g = grid[Math.round((1 - s) * GRID)];
    const r = armAt(s, g.pose);
    worst = Math.max(worst, r.err); frames.push({ t, s, pose: r.pose });
  }
  const kfs = frames.map((f) => keyframe(f.t, f.pose)); kfs.push({ ...kfs[0], t: total });
  const bottom = frames.reduce((a, f) => (f.s > a.s ? f : a));
  return { total, frames, kfs, bottom, worst };
}
// lower from lockout to the rack, pause, press back up fast, short hold at the top
const KB0 = buildKB([[2, 0, 1], [0.5, 1, 1], [1, 1, 0], [0.5, 0, 0]]);
const KB1 = buildKB([[3, 0, 1], [0.5, 1, 1], [1, 1, 0], [0.5, 0, 0]]);

// held bell: attached to the left wrist, flipped so the handle points the way the forearm points
const BELL = { type: 'kettlebell', attach: 'wrist_L', offset: [0, 0.07, 0.075], flipX: true, heldBy: ['wrist_L'] };

// wrong poses for the press: standing frame keeps the feet planted while the torso changes
function standWrong(base, extra, armOpts, rootRot = 0, rootZ = 0) {
  const pose = clonePose(base);
  for (const [k, v] of Object.entries(extra)) pose.joints[k] = [...v];
  pose.root.rot[0] = rootRot; pose.root.pos[2] = rootZ;
  const frees = ['root.pos.1', 'root.pos.2', both('hip', 0, { min: -25, max: 30 }), both('ankle', 0, { min: -10, max: 10 }), both('knee', 0, { min: 0, max: 5 })];
  const T = [];
  for (const S of ['L', 'R']) { const sx = S === 'L' ? 1 : -1; T.push({ p: 'toe_' + S, x: sx * 0.09, y: 0, z: 0.15 }, { p: 'heel_' + S, y: 0, z: -0.05 }); }
  let r = solve(pose, { free: frees, targets: T, priors: [{ path: 'root.pos.2', value: rootZ, w: 0.02 }] });
  if (r.err > 0.01) console.warn('stand wrong err', r.err.toFixed(3), r.misses.join(' '));
  if (armOpts) { r = { ...r, pose: armFrame(r.pose, armOpts).pose }; }
  return r.pose;
}
const wrongKB = (arm0) => {
  const arm = arm0.pose;
  const lean = standWrong(arm, { spine: [-14, 0, 0], chest: [-12, 0, 0] }, LOCK, -4, 0.04);
  const wrist = clonePose(KB0.bottom.pose); wrist.joints.wrist_L = [-38, 0, 0];
  const fwd = armFrame(arm, { x: -0.06, y: 0.56, z: 0.17, elbowX: -0.04 }).pose;
  return { lean: jp(lean), wrist: jp(wrist), forward: jp(fwd) };
};
const WRONG_KB = wrongKB(lockArm);

const kbLevel = (kb) => ({ duration: kb.total, keyT: round(kb.bottom.t, 2), contacts: FEET, keyframes: kb.kfs, props: [BELL], wrong: WRONG_KB });
out[0] = kbLevel(KB0); out[1] = kbLevel(KB1);

/* =====================================================================================================
   Inverted frames (pike levels 2-3 and the wall negatives). Hands planted, arms symmetric, spine neutral.
   o: toeX toeY handX palmZ elbowFix|elbowMax hipY head:{y,z} elbowX extra wall:{z} ankleP
   ===================================================================================================== */
const ROOT = ['root.pos.0', 'root.pos.1', 'root.pos.2', 'root.rot.0', 'root.rot.1', 'root.rot.2'];
function invFrame(warm, o) {
  const pose = clonePose(warm);
  for (const [path, v] of Object.entries(o.extra || {})) { const [, j, a] = path.split('.'); pose.joints[j] = pose.joints[j] || [0, 0, 0]; pose.joints[j][+a] = v; }
  const fixed = new Set(Object.keys(o.extra || {}));
  const elbow = o.elbowFix !== undefined ? both('elbow', 0, { min: o.elbowFix, max: o.elbowFix }) : both('elbow', 0, { min: 3, max: o.elbowMax ?? 150 });
  const frees = [...ROOT, both('shoulder', 0, { min: -60, max: 190 }), both('shoulder', 1, { min: -45, max: 60 }), both('shoulder', 2, { min: -30, max: 100 }), both('wrist', 0, { min: 0, max: 100 }), elbow, both('hip', 0, { min: -10, max: 140 }), both('knee', 0, { min: 0, max: 6 })];
  if (!o.noFeet) { frees.push(both('ankle', 0, { min: -50, max: 30 }), both('toe', 0, { min: -95, max: 20 })); }
  if (o.wall) frees.push(both('ankle', 0, { min: -50, max: 30 }));
  for (const j of ['neck', 'head']) if (!fixed.has(`joints.${j}.0`)) frees.push({ paths: [`joints.${j}.0`], min: o.neckMin ?? -12, max: o.neckMax ?? 25 });
  const T = [
    { p: 'palm_L', x: o.handX, y: 0, z: o.palmZ }, { p: 'palm_R', x: -o.handX, y: 0, z: o.palmZ }, { p: 'wrist_L', y: 0 }, { p: 'wrist_R', y: 0 },
  ];
  if (!o.noFeet) T.push({ p: 'toe_L', x: o.toeX, y: o.toeY, z: 0 }, { p: 'toe_R', x: -o.toeX, y: o.toeY, z: 0 }, { p: 'toetip_L', y: o.toeY }, { p: 'toetip_R', y: o.toeY });
  if (o.wall) T.push({ p: 'heel_L', z: o.wall.z, w: o.wallW ?? 1 }, { p: 'heel_R', z: o.wall.z, w: o.wallW ?? 1 });
  if (o.hipY !== undefined) T.push({ p: 'root', y: o.hipY, w: o.hipW ?? 0.3 });
  if (o.head) T.push({ p: 'head_top', y: o.head.y }, { p: 'head_top', z: o.head.z, w: o.headZW ?? 0.4 }, { p: 'head_top', x: 0, w: 0.5 });
  if (o.elbowX !== undefined) T.push({ p: 'elbow_L', x: o.elbowX, w: 0.3 }, { p: 'elbow_R', x: -o.elbowX, w: 0.3 });
  if (o.fv) T.push({ p: 'elbow_L', rel: 'wrist_L', z: o.fvz ?? 0.02, w: o.fv }, { p: 'elbow_R', rel: 'wrist_R', z: o.fvz ?? 0.02, w: o.fv });
  if (o.eb && o.eb.w > 0) T.push({ p: 'elbow_L', rel: 'shoulder_L', z: o.eb.z, w: o.eb.w }, { p: 'elbow_R', rel: 'shoulder_R', z: o.eb.z, w: o.eb.w });
  if (o.lean !== undefined) T.push({ p: 'wrist_L', rel: 'shoulder_L', z: o.lean, w: o.leanW ?? 1 }, { p: 'wrist_R', rel: 'shoulder_R', z: o.lean, w: o.leanW ?? 1 });
  if (o.targets) T.push(...o.targets);
  const priors = [{ path: 'root.rot.1', value: 0, w: 0.5 }, { path: 'root.rot.2', value: 0, w: 0.5 }, { path: 'joints.shoulder_L.1', value: 0, w: 0.02 }, { path: 'joints.shoulder_L.2', value: 0, w: 0.02 },
    { path: 'joints.neck.0', value: 0, w: 0.03 }, { path: 'joints.head.0', value: 0, w: 0.03 }, { path: 'joints.knee_L.0', value: 1, w: 0.2 }, { path: 'root.pos.0', value: 0, w: 0.3 }];
  if (!o.noFeet && !fixed.has('joints.ankle_L.0')) priors.push({ path: 'joints.ankle_L.0', value: o.ankleP ?? -10, w: 0.03 });
  if (o.priors) priors.push(...o.priors);
  return solve(pose, { free: frees, targets: T, priors });
}
const invSeed = (o) => {
  const p = newPose(); p.root.pos = [0, o.hipY ?? 0.8, o.palmZ * 0.75]; p.root.rot = [125, 0, 0];
  for (const S of ['L', 'R']) { p.joints['hip_' + S] = [95, 0, 0]; p.joints['shoulder_' + S] = [150, 0, 0]; p.joints['wrist_' + S] = [60, 0, 0]; p.joints['elbow_' + S] = [8, 0, 0]; p.joints['ankle_' + S] = [-20, 0, 0]; p.joints['toe_' + S] = [-60, 0, 0]; p.joints['knee_' + S] = [2, 0, 0]; }
  return p;
};
const armFlare = (pose) => { const q = fk(pose), u = vsub(q.elbow_L, q.shoulder_L); return Math.atan2(Math.abs(u[0]), Math.abs(u[2])) * 180 / Math.PI; };

/** Build a pike-type level. cfg: toeY handX palmZ hipY headFwd headY flareTop flareBottom elbowBottom */
function buildPike(name, cfg, segs) {
  const { total, at } = phaseFn(segs);
  const base = { toeX: 0.09, ...cfg };
  const top = invFrame(invSeed(cfg), { ...base, elbowFix: 3, elbowX: cfg.flareTop, lean: cfg.lean });
  if (top.err > 0.004) console.warn(name, 'TOP err', top.err.toFixed(4), top.misses.filter((m) => !/ -?0\.[0-4]cm/.test(m)).join(' '));
  const headTopZ = fk(top.pose).head_top[2], headTopY = fk(top.pose).head_top[1];
  const bottomHead = { y: cfg.headY, z: cfg.palmZ + cfg.headFwd };
  const frame = (s, warm, extra, over = {}) => invFrame(warm, { ...base, head: { y: lerp(headTopY, bottomHead.y, s), z: lerp(headTopZ, bottomHead.z, s) }, elbowX: lerp(cfg.flareTop, cfg.flareBottom, s), lean: lerp(cfg.lean, cfg.leanBottom, s), leanW: 0.6, extra, ...over });
  // continuation grid (top to bottom) gives every frame a close starting guess
  const GR = 40, grid = []; let warm = top.pose;
  for (let k = 0; k <= GR; k++) { const r = frame(k / GR, warm); warm = r.pose; grid[k] = r; }
  const frames = []; let worst = Math.max(...grid.map((g) => g.err));
  const n = Math.round(total / DT);
  for (let i = 0; i < n; i++) { const t = i * DT, s = at(t), r = frame(s, grid[Math.round(s * GR)].pose); worst = Math.max(worst, r.err); frames.push({ t, s, pose: r.pose }); }
  const kfs = frames.map((f) => keyframe(f.t, f.pose)); kfs.push({ ...kfs[0], t: total });
  const bottom = frames.reduce((a, f) => (f.s > a.s ? f : a));
  return { total, kfs, frames, bottom, worst, top: top.pose, cfg: base, frame, name };
}

/** Wall handstand negative (back to the wall). Hands at z = 0, wall behind the hands at z = wallZ (+z). The belly faces -z, so "forward" is -z. */
const WALL_Z = 0.18;   // heels touch the wall 18 cm behind the palms (hands 15-20 cm from the wall)
const CUSHION_H = 0.10; // folded cushion under the head
function buildWall(name, cfg, segs) {
  const { total, at } = phaseFn(segs);
  const base = { handX: 0.22, palmZ: 0, wall: { z: WALL_Z }, noFeet: true, priors: [{ path: 'joints.hip_L.0', value: 0, w: 0.15 }, { path: 'joints.ankle_L.0', value: -15, w: 0.03 }, { path: 'joints.knee_L.0', value: 1, w: 0.5 }], ...cfg };
  const seed = newPose(); seed.root.pos = [0, 1.0, 0.1]; seed.root.rot = [186, 0, 0];
  for (const S of ['L', 'R']) { seed.joints['shoulder_' + S] = [170, 0, 0]; seed.joints['wrist_' + S] = [85, 0, 0]; seed.joints['elbow_' + S] = [4, 0, 0]; seed.joints['ankle_' + S] = [-15, 0, 0]; }
  const top = invFrame(seed, { ...base, elbowFix: 3, elbowX: cfg.flareTop, lean: cfg.lean });
  if (top.err > 0.004) console.warn(name, 'TOP err', top.err.toFixed(4), top.misses.filter((m) => !/ -?0\.[0-4]cm/.test(m)).join(' '));
  const headTopY = fk(top.pose).head_top[1];
  const frame = (s, warm, extra, over = {}) => invFrame(warm, { ...base, head: { y: lerp(headTopY, cfg.headY, s), z: lerp(fk(top.pose).head_top[2], -cfg.headFwd, s) }, elbowX: lerp(cfg.flareTop, cfg.flareBottom, s), lean: lerp(cfg.lean, cfg.leanBottom, s), leanW: 0, headZW: 0.3 + 0.7 * s, fv: s * s * (cfg.fvBottom ?? 0.5), fvz: 0.06, wall: { z: lerp(WALL_Z, cfg.heelBottomZ ?? WALL_Z, s) }, neckMin: -10, neckMax: 10, ...(cfg.elbowBottom ? { elbowFix: lerp(3, cfg.elbowBottom, s) } : {}), targets: [{ p: 'elbow_L', y: cfg.elbowH ?? 0.26, w: cfg.elbowH === 0 ? 0 : s * s }, { p: 'elbow_R', y: cfg.elbowH ?? 0.26, w: cfg.elbowH === 0 ? 0 : s * s }], extra, ...over });
  const GR = 50, grid = [];
  let best = null;
  for (const sh of [0, 60, 120, 150, 170, 185]) for (const el of [70, 90, 110]) for (const rz of [0, 25, -20]) for (const rx of [194, 203]) for (const pz of [-0.12, -0.25]) {
    const sd = clonePose(top.pose); sd.root.pos = [0, 0.85, pz]; sd.root.rot = [rx, 0, 0];
    for (const S of ['L', 'R']) { sd.joints['shoulder_' + S] = [sh, 0, rz]; sd.joints['elbow_' + S] = [el, 0, 0]; }
    const r = frame(1, sd); if (process.env.DBG2) console.log(sh, el, rz, rx, pz, r.err.toFixed(3));
    if (!best || r.err < best.err) best = r;
  }
  if (process.env.DBG3) console.log("BEST", best.err.toFixed(3), best.misses.join(" "), JSON.stringify(best.pose.joints.shoulder_L), JSON.stringify(best.pose.root));
  if (!process.env.MULTI) { let w = top.pose; for (let k = 0; k <= GR; k++) { const r = frame(k / GR, w); w = r.pose; grid[k] = r; if (process.env.DBG4) console.log(k, r.err.toFixed(3), flexionDeg(r.pose, 'elbow_L').toFixed(0), fk(r.pose).head_top.slice(1).map((v) => v.toFixed(2)).join('/')); } }
  else {
  grid[GR] = best; let warm = best.pose;
  for (let k = GR - 1; k >= 0; k--) { const r = frame(k / GR, warm); warm = r.pose; grid[k] = r; }
  }
  const frames = []; let worst = Math.max(...grid.map((g) => g.err));
  const n = Math.round(total / DT);
  for (let i = 0; i < n; i++) { const t = i * DT, s = at(t), r = frame(s, grid[Math.round(s * GR)].pose); worst = Math.max(worst, r.err); frames.push({ t, s, pose: r.pose }); }
  const kfs = frames.map((f) => keyframe(f.t, f.pose)); kfs.push({ ...kfs[0], t: total });
  const bottom = frames.reduce((a, f) => (f.s > a.s ? f : a));
  return { total, kfs, frames, bottom, worst, top: top.pose, cfg: base, frame, name, grid };
}
const SEGS_PIKE = [[2, 0, 1], [0.5, 1, 1], [1, 1, 0], [0.5, 0, 0]];
const PIKE = buildPike('pike', { toeY: 0, handX: 0.22, palmZ: 0.80, hipY: 0.88, lean: 0.04, leanBottom: -0.14, headFwd: 0.08, headY: 0.025, flareTop: 0.22, flareBottom: 0.36 }, SEGS_PIKE);
const PIKE_E = buildPike('elevated pike', { toeY: 0.45, ankleP: -20, handX: 0.22, palmZ: 1.0, hipY: 0.98, lean: 0.03, leanBottom: -0.14, headFwd: 0.08, headY: 0.025, flareTop: 0.22, flareBottom: 0.36 }, SEGS_PIKE);
const SEGS_WALL = [[5, 0, 1], [1, 1, 1], [2.5, 1, 0], [0.5, 0, 0]];
const WALL = buildWall('wall negative', { lean: -0.03, leanBottom: +(process.env.LB ?? 0.2), headFwd: +(process.env.HF || 0.25), headY: +(process.env.HY || 0.115), heelBottomZ: +(process.env.HZ ?? 0), flareTop: 0.22, flareBottom: +(process.env.FB || 0.30), elbowBottom: +(process.env.EB || 0), elbowH: +(process.env.EH ?? 0.14), fvBottom: +(process.env.FV ?? 0.1) }, SEGS_WALL);

/* ---------- wrong poses for the inverted levels (solved at the bottom of the rep with the same planted contacts) ---------- */
function pikeWrong(r, over, label) {
  const x = r.frame(1, r.bottom.pose, undefined, over);
  if (x.err > 0.05) console.warn(r.name, label, 'wrong pose err', x.err.toFixed(3), x.misses.filter((m) => !/ -?0\.[0-4]cm/.test(m)).join(' '));
  return jp(x.pose);
}
// frame(s, warm, extra, over): "over" replaces options of the solve (hipY, elbowX, ...)
PIKE.wrong = { low: pikeWrong(PIKE, { hipY: 0.62, hipW: 1, head: { y: 0.14, z: 0.9 }, lean: undefined, leanW: 0 }, 'low'), flare: pikeWrong(PIKE, { elbowX: 0.6 }, 'flare') };
PIKE_E.wrong = { low: pikeWrong(PIKE_E, { hipY: 0.78, hipW: 1, head: { y: 0.14, z: 1.0 }, lean: undefined, leanW: 0 }, 'low'), flare: pikeWrong(PIKE_E, { elbowX: 0.6 }, 'flare') };
WALL.wrong = {
  arch: pikeWrong(WALL, { extra: { 'joints.spine.0': -16, 'joints.chest.0': -10 } }, 'arch'),
};

/* ---------- assemble pike and wall levels ---------- */
const PLANK = ['palm_L', 'palm_R', 'toe_L', 'toe_R'];
const inv = (r, extra) => ({ duration: r.total, keyT: round(r.bottom.t, 2), contacts: PLANK, keyframes: r.kfs, wrong: r.wrong, ...extra });
out[2] = inv(PIKE);
out[3] = inv(PIKE_E, { support: { toe_L: 0.45, toe_R: 0.45 }, props: [{ type: 'chair', pos: [0, 0, -0.12], rotY: 0, seat: 0.45 }] });
{
  const hz = fk(WALL.bottom.pose).head_top[2];
  out[4] = inv(WALL, { contacts: ['palm_L', 'palm_R'], props: [{ type: 'wall', pos: [0, 0, round(WALL_Z + 0.02)], size: [2.4, 2.6] }, { type: 'box', pos: [0, 0, round(hz)], size: [0.42, CUSHION_H, 0.34] }] });
}

/* ---------- report and write ---------- */
if (REPORT) {
  for (const r of [PIKE, PIKE_E, WALL]) {
    console.log(r.name, 'dur', r.total, 'worst', r.worst.toFixed(4));
    for (const [lab, P] of [['top', r.top], ['bottom', r.bottom.pose]]) {
      const q = fk(P);
      console.log('  ', lab, 'elbow', flexionDeg(P, 'elbow_L').toFixed(0), 'sh', P.joints.shoulder_L.map((v) => v.toFixed(0)).join('/'), 'wrist', P.joints.wrist_L[0].toFixed(0), 'hip', flexionDeg(P, 'hip_L').toFixed(0), 'knee', flexionDeg(P, 'knee_L').toFixed(0), 'ankle', flexionDeg(P, 'ankle_L').toFixed(0), 'toe', (P.joints.toe_L || [0])[0].toFixed(0), 'neck/head', (P.joints.neck || [0])[0].toFixed(0), (P.joints.head || [0])[0].toFixed(0), 'spine', (P.joints.spine || [0])[0], 'flare', armFlare(P).toFixed(0), 'rootYZ', q.root[1].toFixed(2), q.root[2].toFixed(2), 'shY', q.shoulder_L[1].toFixed(2), 'headTop', q.head_top.map((v) => v.toFixed(2)).join(','), 'palm', q.palm_L.map((v) => v.toFixed(2)).join(','), 'heel', q.heel_L.slice(1).map((v) => v.toFixed(2)).join('/'), '\n      pts', ['root', 'chest', 'shoulder_L', 'elbow_L', 'wrist_L', 'head', 'ankle_L', 'knee_L'].map((n) => n + ' ' + q[n].slice(1).map((v) => v.toFixed(2)).join('/')).join('  '));
    }
  }
  for (const [name, kb] of [['kb0', KB0], ['kb1', KB1]]) {
    console.log(name, 'worst', kb.worst.toFixed(4));
    for (const [lab, f] of [['lock', kb.frames[0]], ['rack', kb.bottom]]) {
      const P = f.pose, q = fk(P);
      console.log('  ', lab, 'sh', P.joints.shoulder_L.map((v) => v.toFixed(0)).join('/'), 'elbow', flexionDeg(P, 'elbow_L').toFixed(0), 'wrist', P.joints.wrist_L.map((v) => v.toFixed(0)).join('/'),
        'wrist-elbow xz', (q.wrist_L[0] - q.elbow_L[0]).toFixed(3), (q.wrist_L[2] - q.elbow_L[2]).toFixed(3), 'wrist', q.wrist_L.map((v) => v.toFixed(2)).join(','), 'elbow', q.elbow_L.map((v) => v.toFixed(2)).join(','));
    }
  }
}
const src = `// GENERATED by tools/author-vpush.mjs. Do not edit by hand; edit the author script and re-run it.\nexport default ${JSON.stringify(out)};\n`;
writeFileSync(new URL('../js/form/poses/vpush.gen.js', import.meta.url), src);
console.log('wrote vpush.gen.js', (src.length / 1024).toFixed(0) + ' KB');
