// Generates js/form/poses/hpush.gen.js (plain keyframe data) for the horizontal-push ladder.
// Run: node tools/author-hpush.mjs   (add --report for a table of joint angles)
import { writeFileSync } from 'node:fs';
import { solve, newPose, both, one, clonePose, keyframe, phaseFn, mirrorPose, round } from './solve.mjs';
import { fk, flexionDeg, vsub, vangle } from '../js/form/skeleton.js';

const REPORT = process.argv.includes('--report');
const SEGS = [[2, 0, 1], [0.5, 1, 1], [1, 1, 0], [0.5, 0, 0]]; // lower 2 s, pause 0.5 s, press 1 s, top 0.5 s
const DT = 0.125;
const lerp = (a, b, s) => a + (b - a) * s;

const seedPose = () => {
  const p = newPose(); p.root.pos = [0, 0.5, 0.9]; p.root.rot = [72, 0, 0];
  for (const s of ['L', 'R']) { p.joints['shoulder_' + s] = [50, 0, 0]; p.joints['wrist_' + s] = [80, 0, 0]; p.joints['toe_' + s] = [-72, 0, 0]; p.joints['elbow_' + s] = [10, 0, 0]; }
  return p;
};
const ROOT = ['root.pos.0', 'root.pos.1', 'root.pos.2', 'root.rot.0', 'root.rot.1', 'root.rot.2'];
const withExtra = (pose, extra = {}) => { const p = clonePose(pose); for (const [path, v] of Object.entries(extra)) { const [, j, a] = path.split('.'); p.joints[j] = p.joints[j] || [0, 0, 0]; p.joints[j][+a] = v; } return p; };

/** Symmetric plank-type frame. o: toeX toeY handX handY palmZ chestY elbowX elbowFix topLean extra */
function symFrame(warm, o) {
  const pose = withExtra(warm, o.extra);
  const fixedPaths = new Set(Object.keys(o.extra || {}));
  const elbow = o.elbowFix !== undefined ? both('elbow', 0, { min: o.elbowFix, max: o.elbowFix }) : both('elbow', 0, { min: 3, max: 150 });
  const frees = [...ROOT, both('shoulder', 0), both('shoulder', 1), both('shoulder', 2), both('wrist', 0, { min: 0, max: 110 }), elbow];
  if (o.yaw) frees.push(both('wrist', 1, { min: 0, max: o.yaw }));
  if (!fixedPaths.has('joints.ankle_L.0')) frees.push(both('ankle', 0, { min: -45, max: 30 }));
  if (!fixedPaths.has('joints.toe_L.0')) frees.push(both('toe', 0, { min: -95, max: 20 }));
  const T = [
    { p: 'toe_L', x: o.toeX, y: o.toeY, z: 0 }, { p: 'toe_R', x: -o.toeX, y: o.toeY, z: 0 },
    { p: 'toetip_L', y: o.toeY }, { p: 'toetip_R', y: o.toeY },
    { p: 'palm_L', x: o.handX, y: o.handY }, { p: 'palm_R', x: -o.handX, y: o.handY },
    { p: 'wrist_L', y: o.handY }, { p: 'wrist_R', y: o.handY },
  ];
  if (o.palmZ !== undefined) T.push({ p: 'palm_L', z: o.palmZ }, { p: 'palm_R', z: o.palmZ });
  if (o.topLean !== undefined) T.push({ p: 'wrist_L', rel: 'shoulder_L', z: o.topLean }, { p: 'wrist_R', rel: 'shoulder_R', z: o.topLean });
  if (o.chestY !== undefined) T.push({ p: 'chest', y: o.chestY });
  if (o.elbowX !== undefined) T.push({ p: 'elbow_L', x: o.elbowX, w: 0.3 }, { p: 'elbow_R', x: -o.elbowX, w: 0.3 });
  const priors = [{ path: 'root.rot.1', value: 0, w: 0.5 }, { path: 'root.rot.2', value: 0, w: 0.5 }, { path: 'joints.shoulder_L.1', value: 0, w: 0.02 }, { path: 'joints.shoulder_L.2', value: 0, w: 0.02 }];
  if (!fixedPaths.has('joints.ankle_L.0')) priors.push({ path: 'joints.ankle_L.0', value: o.ankleP ?? 8, w: 0.05 });
  return solve(pose, { free: frees, targets: T, priors });
}

const armFlare = (pose) => { const q = fk(pose); const u = vsub(q.elbow_L, q.shoulder_L); return Math.atan2(Math.abs(u[0]), Math.abs(u[2])) * 180 / Math.PI; };

function measure(pose, label) {
  const q = fk(pose);
  return { label, err: 0, elbow: flexionDeg(pose, 'elbow_L'), shoulder: pose.joints.shoulder_L, wrist: pose.joints.wrist_L[0], wristYaw: (pose.joints.wrist_L[1] || 0), toe: pose.joints.toe_L[0], ankle: pose.joints.ankle_L ? pose.joints.ankle_L[0] : 0, pitch: 90 - pose.root.rot[0], chestY: q.chest[1], flare: armFlare(pose), shoulderY: q.shoulder_L[1] };
}

/** Build a symmetric level. cfg: toeX toeY handX handY topLean chestBottom flareBottom flareTop */
function buildSym(name, cfg) {
  const { total, at } = phaseFn(SEGS);
  const top = symFrame(seedPose(), { ...cfg, elbowFix: 3, elbowX: cfg.flareTop, chestY: undefined, palmZ: undefined, topLean: cfg.topLean });
  const palmZ = fk(top.pose).palm_L[2], chestTop = fk(top.pose).chest[1];
  if (top.err > 0.003) console.warn(name, 'TOP err', top.err);
  const frame = (s, warm, extra) => symFrame(warm, { ...cfg, palmZ, chestY: lerp(chestTop, cfg.chestBottom, s), elbowX: lerp(cfg.flareTop, cfg.flareBottom, s), topLean: undefined, extra });
  let warm = top.pose; const kfs = []; let worst = 0; const frames = [];
  const n = Math.round(total / DT);
  for (let i = 0; i < n; i++) { const t = i * DT, s = at(t); const r = frame(s, warm); warm = r.pose; worst = Math.max(worst, r.err); frames.push({ t, s, pose: r.pose }); }
  for (const f of frames) kfs.push(keyframe(f.t, f.pose));
  kfs.push({ ...kfs[0], t: total });
  const bottom = frames.reduce((a, f) => (f.s > a.s ? f : a));
  return { total, kfs, palmZ, bottomPose: bottom.pose, bottomS: bottom.s, bottomT: bottom.t, worst, top: top.pose, cfg, name, chestTop };
}

const levels = {};
const L = (i, name, cfg) => { levels[i] = buildSym(name, cfg); };
L(0, 'standard', { toeX: 0.09, toeY: 0, handX: 0.24, handY: 0, topLean: -0.04, chestBottom: 0.20, flareTop: 0.22, flareBottom: 0.36 });
L(1, 'deficit', { toeX: 0.09, toeY: 0, handX: 0.24, handY: 0.07, topLean: -0.06, chestBottom: 0.14, flareTop: 0.22, flareBottom: 0.36 });
L(2, 'diamond', { toeX: 0.09, toeY: 0, handX: 0.06, handY: 0, topLean: -0.12, chestBottom: 0.21, flareTop: 0.18, flareBottom: 0.26 });
L(3, 'feet-elevated', { ankleP: 22, toeX: 0.09, toeY: 0.45, handX: 0.24, handY: 0, topLean: -0.10, chestBottom: 0.26, flareTop: 0.22, flareBottom: 0.36 });
L(5, 'pseudo-planche', { toeX: 0.09, toeY: 0, handX: 0.17, handY: 0, topLean: -0.16, chestBottom: 0.21, flareTop: 0.20, flareBottom: 0.26, yaw: 70 });


/** Asymmetric plank frame. o: toe:{L:[x,y],R:[x,y]} palm:{L:[x,y,z?],R:[x,y,z?]} elbow:{L:number|[min,max],R:...} lean:{L,R} (wrist rel shoulder z) */
function asymFrame(warm, o) {
  const pose = withExtra(warm, o.extra);
  const frees = [...ROOT, ...['L', 'R'].flatMap((S) => [one('shoulder', S, 0), one('shoulder', S, 1), one('shoulder', S, 2), one('wrist', S, 0, { min: 0, max: 110 }), one('ankle', S, 0, { min: -45, max: 30 }), one('toe', S, 0, { min: -95, max: 20 }), one('hip', S, 2, { min: -5, max: 35 })])];
  for (const S of ['L', 'R']) { const e = o.elbow[S]; frees.push(Array.isArray(e) ? one('elbow', S, 0, { min: e[0], max: e[1] }) : one('elbow', S, 0, { min: e, max: e })); }
  const T = [];
  for (const S of ['L', 'R']) {
    const [tx, ty] = o.toe[S], [px, py, pz] = o.palm[S];
    T.push({ p: 'toe_' + S, x: tx, y: ty, z: 0 }, { p: 'toetip_' + S, y: ty }, { p: 'palm_' + S, x: px, y: py }, { p: 'wrist_' + S, y: py });
    if (pz !== undefined && pz !== null) T.push({ p: 'palm_' + S, z: pz });
    if (o.lean && o.lean[S] !== undefined) T.push({ p: 'wrist_' + S, rel: 'shoulder_' + S, z: o.lean[S] });
  }
  const priors = [{ path: 'root.rot.1', value: 0, w: 0.3 }, { path: 'root.rot.2', value: 0, w: 0.3 }];
  for (const S of ['L', 'R']) priors.push({ path: `joints.ankle_${S}.0`, value: o.ankleP ?? 8, w: 0.05 }, { path: `joints.shoulder_${S}.1`, value: 0, w: 0.02 }, { path: `joints.shoulder_${S}.2`, value: 0, w: 0.02 });
  if (o.priors) priors.push(...o.priors);
  return solve(pose, { free: frees, targets: [...T, ...(o.targets || [])], priors });
}

/** Build a one-sided cycle with asymFrame; drive(s) -> { elbow:{L,R}, targets? } ; topO = options for the top solve. */
function buildAsym(name, { top, drive, segs = SEGS, mirrorSecond = false }) {
  const { total, at } = phaseFn(segs);
  const t0 = asymFrame(seedPose(), top);
  const palmZ = { L: fk(t0.pose).palm_L[2], R: fk(t0.pose).palm_R[2] };
  if (t0.err > 0.004) console.warn(name, 'TOP err', t0.err.toFixed(4), t0.misses.filter((m) => !/ 0\.[0-4]cm| -0\.[0-4]cm/.test(m)).join(' '));
  let warm = t0.pose, worst = 0; const frames = [];
  const n = Math.round(total / DT);
  for (let i = 0; i < n; i++) {
    const t = i * DT, s = at(t), d = drive(s);
    const o = { ...top, lean: undefined, palm: { L: [top.palm.L[0], top.palm.L[1], palmZ.L], R: [top.palm.R[0], top.palm.R[1], palmZ.R] }, elbow: d.elbow, targets: d.targets, priors: d.priors, ankleP: top.ankleP };
    const r = asymFrame(warm, o); warm = r.pose; worst = Math.max(worst, r.err); frames.push({ t, s, pose: r.pose });
  }
  const bottom = frames.reduce((a, f) => (f.s > a.s ? f : a));
  return { total, frames, bottom, worst, top: t0.pose, palmZ, name };
}

// 4 Archer: wide hands, lower over the left arm (right arm stays straight), then mirror for the other side.
const ARC = { toe: { L: [0.09, 0], R: [-0.09, 0] }, palm: { L: [0.50, 0], R: [-0.50, 0] }, elbow: { L: 3, R: 3 }, lean: { L: -0.04, R: -0.04 } };
const ARC_SPEC = () => ({ top: ARC, drive: (s) => ({ elbow: { L: [3 + 105 * s, 3 + 105 * s], R: 3 }, priors: [{ path: 'joints.wrist_R.0', value: 70, w: 0.05 }] }) });
const archer = buildAsym('archer', {
  top: ARC,
  drive: (s) => ({ elbow: { L: [3 + 105 * s, 3 + 105 * s], R: 3 }, priors: [{ path: 'joints.wrist_R.0', value: 70, w: 0.05 }] }),
  segs: [[2, 0, 1], [0.5, 1, 1], [1, 1, 0], [0.5, 0, 0]],
});
// 6 Assisted one-arm push-up: left hand under the chest does the work, right hand rests on a book and helps only a little.
const mkOap = (o) => buildAsym('assisted one-arm', {
  top: { toe: { L: [o.fx + (o.fs || 0), 0], R: [-o.fx + (o.fs || 0), 0] }, palm: { L: [o.lx, 0], R: [o.rx, 0.06] }, elbow: { L: 3, R: 5 }, lean: { L: o.ll, R: o.rl }, ankleP: 8 },
  drive: (s) => ({ elbow: { L: [3 + o.eL * s, 3 + o.eL * s], R: [5 + o.eR * s, 5 + o.eR * s] } }),
  segs: [[3, 0, 1], [0.5, 1, 1], [1.5, 1, 0], [0.5, 0, 0]],
});
let oap; const OAP_CFG = { fs: -0.03, fx: 0.2, lx: 0.16, rx: -0.44, ll: -0.1, rl: -0.04, eL: 115, eR: 90 };
const OAP_SPEC = () => ({ top: { toe: { L: [OAP_CFG.fx + OAP_CFG.fs, 0], R: [-OAP_CFG.fx + OAP_CFG.fs, 0] }, palm: { L: [OAP_CFG.lx, 0], R: [OAP_CFG.rx, 0.06] }, elbow: { L: 3, R: 5 }, ankleP: 8 }, drive: (s) => ({ elbow: { L: [3 + OAP_CFG.eL * s, 3 + OAP_CFG.eL * s], R: [5 + OAP_CFG.eR * s, 5 + OAP_CFG.eR * s] } }) });
if (process.env.SWEEP) {
  for (const o of [{ fx: 0.2, lx: 0.14, rx: -0.42, ll: -0.1, rl: -0.04, eL: 110, eR: 80 }, { fx: 0.2, lx: 0.14, rx: -0.44, ll: -0.1, rl: -0.04, eL: 115, eR: 90 }, { fx: 0.2, lx: 0.16, rx: -0.44, ll: -0.1, rl: -0.04, eL: 115, eR: 90 }]) {
    const r = mkOap(o), m = r.bottom.pose, q = fk(m);
    console.log(JSON.stringify(o), 'worst', r.worst.toFixed(4), 'L sh', m.joints.shoulder_L.map((v) => v.toFixed(0)).join('/'), 'R sh', m.joints.shoulder_R.map((v) => v.toFixed(0)).join('/'), 'wr', m.joints.wrist_L[0].toFixed(0), m.joints.wrist_R[0].toFixed(0), 'shY', q.shoulder_L[1].toFixed(2), q.shoulder_R[1].toFixed(2), 'root', m.root.pos.map((v) => v.toFixed(2)).join(','), m.root.rot.map((v) => v.toFixed(0)).join(','), 'chestY', q.chest[1].toFixed(2));
  }
}
oap = mkOap(OAP_CFG);
for (const r of [archer, oap]) {
  const m = r.bottom.pose, q = fk(m);
  console.log(r.name, 'total', r.total, 'worst', r.worst.toFixed(4), 'palmZ', r.palmZ);
  for (const S of ['L', 'R']) console.log('   ', S, 'elbow', flexionDeg(m, 'elbow_' + S).toFixed(0), 'sh', m.joints['shoulder_' + S].map((v) => v.toFixed(0)).join('/'), 'wrist', m.joints['wrist_' + S][0].toFixed(0), 'toe', m.joints['toe_' + S][0].toFixed(0), 'shoulderY', q['shoulder_' + S][1].toFixed(2));
  console.log('    root', m.root.pos.map((v) => v.toFixed(2)), m.root.rot.map((v) => v.toFixed(1)), 'chest', q.chest.map((v) => v.toFixed(2)));
}


for (const [i, r] of Object.entries(levels)) {
  if (!REPORT) break;
  const m = measure(r.bottomPose, 'bottom'), t = measure(r.top, 'top');
  console.log(i, r.name, 'dur', r.total, 'palmZ', r.palmZ.toFixed(3), 'worstErr', r.worst.toFixed(4));
  for (const x of [t, m]) console.log('   ', x.label, 'elbow', x.elbow.toFixed(0), 'sh', x.shoulder.map((v) => v.toFixed(0)).join('/'), 'wrist', x.wrist.toFixed(0), 'toe', x.toe.toFixed(0), 'ankle', x.ankle.toFixed(0), 'pitch', x.pitch.toFixed(1), 'chestY', x.chestY.toFixed(3), 'shY', x.shoulderY.toFixed(3), 'flare', x.flare.toFixed(0));
}

/* ---------- wrong poses (faults), solved at the bottom of the rep with the same planted contacts ---------- */
const jp = (p) => ({ root: { pos: p.root.pos.map((v) => round(v)), rot: p.root.rot.map((v) => round(v, 2)) }, joints: keyframe(0, p).joints });
const SAG = { 'joints.hip_L.0': -22, 'joints.hip_R.0': -22, 'joints.spine.0': -10 };
const PIKE = { 'joints.hip_L.0': 38, 'joints.hip_R.0': 38 };
function symWrong(r, extra, flareX, lift = 0.02) {
  const x = symFrame(r.bottomPose, { ...r.cfg, palmZ: r.palmZ, chestY: r.cfg.chestBottom + lift, elbowX: flareX ?? r.cfg.flareBottom, extra });
  if (x.err > 0.01) console.warn(r.name, 'wrong pose err', x.err.toFixed(3));
  return jp(x.pose);
}
levels[0].wrong = { sag: symWrong(levels[0], SAG), flare: symWrong(levels[0], {}, 0.56), pike: symWrong(levels[0], PIKE) };
levels[1].wrong = { sag: symWrong(levels[1], SAG), flare: symWrong(levels[1], {}, 0.48) };
levels[2].wrong = { sag: symWrong(levels[2], SAG), flare: symWrong(levels[2], {}, 0.45) };
levels[3].wrong = { pike: symWrong(levels[3], PIKE, undefined, 0.09), sag: symWrong(levels[3], SAG, undefined, 0.09) };
levels[5].wrong = { sag: symWrong(levels[5], SAG) };

const asymWrong = (spec, build, extra, elbowOverride) => {
  const d = spec.drive(1);
  const o = { ...spec.top, lean: undefined, palm: { L: [spec.top.palm.L[0], spec.top.palm.L[1], build.palmZ.L], R: [spec.top.palm.R[0], spec.top.palm.R[1], build.palmZ.R] }, elbow: { ...d.elbow, ...(elbowOverride || {}) }, extra, priors: d.priors };
  const x = asymFrame(build.bottom.pose, o);
  if (x.err > 0.01) console.warn(build.name, 'wrong pose err', x.err.toFixed(3));
  return jp(x.pose);
};
archer.wrong = { bentArm: asymWrong(ARC_SPEC(), archer, undefined, { R: [60, 60] }), sag: asymWrong(ARC_SPEC(), archer, SAG) };
oap.wrong = { sag: asymWrong(OAP_SPEC(), oap, SAG) };

/* ---------- assemble ---------- */
const PLANK = ['palm_L', 'palm_R', 'toe_L', 'toe_R'];
const frameList = (frames) => frames.map((f) => keyframe(f.t, f.pose));
const out = {};
const sym = (i, r, extra = {}) => { out[i] = { duration: r.total, keyT: round(r.bottomT, 2), contacts: PLANK, keyframes: r.kfs, wrong: r.wrong, ...extra }; };
sym(0, levels[0]);
sym(1, levels[1], { support: { palm_L: 0.07, palm_R: 0.07 }, props: [0.24, -0.24].map((x) => ({ type: 'books', pos: [x, 0, round(levels[1].palmZ - 0.04)], size: [0.16, 0.07, 0.22] })) });
sym(2, levels[2]);
sym(3, levels[3], { support: { toe_L: 0.45, toe_R: 0.45 }, props: [{ type: 'chair', pos: [0, 0, -0.12], rotY: 0, seat: 0.45 }] });
sym(5, levels[5]);
{ // archer: lower over the left arm, then over the right arm (mirrored)
  const a = frameList(archer.frames), half = archer.total;
  const b = archer.frames.map((f) => keyframe(f.t + half, mirrorPose(f.pose)));
  out[4] = { duration: 2 * half, keyT: round(archer.bottom.t, 2), contacts: PLANK, keyframes: [...a, ...b, { ...a[0], t: 2 * half }], wrong: archer.wrong };
}
out[6] = { duration: oap.total, keyT: round(oap.bottom.t, 2), contacts: PLANK, support: { palm_R: 0.06 }, keyframes: [...frameList(oap.frames), { ...keyframe(0, oap.frames[0].pose), t: oap.total }], wrong: oap.wrong,
  props: [{ type: 'books', pos: [-0.44, 0, round(oap.palmZ.R - 0.04)], size: [0.18, 0.06, 0.22] }] };

const src = `// GENERATED by tools/author-hpush.mjs. Do not edit by hand; edit the author script and re-run it.\nexport default ${JSON.stringify(out)};\n`;
writeFileSync(new URL('../js/form/poses/hpush.gen.js', import.meta.url), src);
console.log('wrote hpush.gen.js', (src.length / 1024).toFixed(0) + ' KB');
