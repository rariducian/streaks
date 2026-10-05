// Generates js/form/poses/row.gen.js (7 levels of the row ladder). Run: node tools/author-row.mjs [--report]
//  levels 0-3: one-arm kettlebell row, split stance, free (left) hand on a chair seat, right arm rows.
//  levels 4-6: doorway pull-up bar: negative pull-up, chin-up, pull-up.
import { writeFileSync } from 'node:fs';
import { solve, newPose, both, one, clonePose, keyframe, phaseFn, round } from './solve.mjs';
import { fk, flexionDeg, vsub, vangle, vmid } from '../js/form/skeleton.js';

const REPORT = process.argv.includes('--report');
const DT = 0.125;
const lerp = (a, b, s) => a + (b - a) * s;
const jp = (p) => ({ root: { pos: p.root.pos.map((v) => round(v)), rot: p.root.rot.map((v) => round(v, 2)) }, joints: keyframe(0, p).joints });
const setJ = (pose, extra = {}) => { for (const [k, v] of Object.entries(extra)) pose.joints[k] = [...v]; return pose; };

/* ================= KB row (levels 0-3) ================= */
const SEAT = 0.45, PALM = { x: 0.20, z: 0.45 }, CHAIR_Z = 0.57;
const FOOT = { L: { x: 0.11, hz: 0.02 }, R: { x: -0.11, hz: -0.40 } };   // front foot = left, back foot = right (heel z)
const PITCH = 56;                                                         // torso 34 deg above the floor
// torso + legs + supporting arm. o: pitch, spine, chest, spineYaw, chestYaw, neck, head, rootYUp
function body(o = {}, warm) {
  const pose = warm ? clonePose(warm) : newPose();
  if (!warm) { pose.root.pos = [0, 0.78, 0]; pose.joints.hip_L = [75, 0, 0]; pose.joints.hip_R = [25, 0, 0]; pose.joints.knee_L = [45, 0, 0]; pose.joints.knee_R = [20, 0, 0]; pose.joints.shoulder_L = [50, 0, 0]; pose.joints.elbow_L = [10, 0, 0]; }
  pose.root.rot = [o.pitch ?? PITCH, 0, 0];
  setJ(pose, { spine: [o.spine ?? 0, o.spineYaw ?? 0, 0], chest: [o.chest ?? 0, o.chestYaw ?? 0, 0], neck: [o.neck ?? -25, 0, 0], head: [o.head ?? -15, 0, 0] });
  const free = ['root.pos.0', 'root.pos.1', 'root.pos.2', one('hip', 'L', 0, { min: -10, max: 140 }), one('hip', 'L', 1, { min: -20, max: 25 }), one('hip', 'L', 2, { min: -5, max: 25 }),
    one('hip', 'R', 0, { min: -25, max: 140 }), one('hip', 'R', 1, { min: -25, max: 20 }), one('hip', 'R', 2, { min: -5, max: 25 }),
    one('knee', 'L', 0, { min: 0, max: 100 }), one('knee', 'R', 0, { min: 0, max: 100 }), one('ankle', 'L', 0, { min: -30, max: 40 }), one('ankle', 'R', 0, { min: -30, max: 40 }),
    one('ankle', 'L', 1, { min: -10, max: 10 }), one('ankle', 'R', 1, { min: -10, max: 10 }),
    one('shoulder', 'L', 0), one('shoulder', 'L', 1), one('shoulder', 'L', 2), one('elbow', 'L', 0, { min: 3, max: 45 }), one('wrist', 'L', 0, { min: -70, max: 20 })];
  const T = [];
  for (const [S, f] of Object.entries(FOOT)) T.push({ p: `heel_${S}`, x: f.x, y: 0, z: f.hz }, { p: `toe_${S}`, x: f.x, y: 0, z: f.hz + 0.2 }, { p: `toetip_${S}`, y: 0 });
  T.push({ p: 'palm_L', x: PALM.x, y: SEAT, z: PALM.z });
  const priors = [{ path: 'root.pos.0', value: 0, w: 0.5 }, { path: 'joints.knee_L.0', value: 42, w: 0.04 }, { path: 'joints.knee_R.0', value: 18, w: 0.04 }, { path: 'joints.hip_L.1', value: 0, w: 0.03 }, { path: 'joints.hip_R.1', value: 0, w: 0.03 },
    { path: 'joints.hip_L.2', value: 0, w: 0.03 }, { path: 'joints.hip_R.2', value: 0, w: 0.03 }, { path: 'joints.shoulder_L.1', value: 0, w: 0.03 }, { path: 'joints.shoulder_L.2', value: 0, w: 0.03 },
    { path: 'joints.elbow_L.0', value: 8, w: 0.03 }, { path: 'joints.ankle_L.1', value: 0, w: 0.1 }, { path: 'joints.ankle_R.1', value: 0, w: 0.1 }];
  const r = solve(pose, { free, targets: T, priors, iters: 200 });
  return r;
}
// working (right) arm: s = 0 full extension (hangs straight under the shoulder), s = 1 elbow pulled back to the hip
function hangArm(pose) {
  const p = clonePose(pose); p.joints.elbow_R = [3, 0, 0]; p.joints.wrist_R = [0, 0, 0]; p.joints.shoulder_R = [PITCH, 0, 0];
  const r = solve(p, { free: [one('shoulder', 'R', 0), one('shoulder', 'R', 1), one('shoulder', 'R', 2)], targets: [{ p: 'wrist_R', rel: 'shoulder_R', x: 0, z: 0 }], priors: [{ path: 'joints.shoulder_R.2', value: 0, w: 0.05 }] });
  return { sh: r.pose.joints.shoulder_R, el: 3, err: r.err };
}
const TOP = { sh: [-8, 0, 8], el: 75 };
function withArm(pose, A, s) {
  const p = clonePose(pose);
  p.joints.shoulder_R = A.hang.sh.map((v, i) => lerp(v, TOP.sh[i], s)); p.joints.elbow_R = [lerp(A.hang.el, TOP.el, s), 0, 0]; p.joints.wrist_R = [0, 0, 0];
  return p;
}
const base = body();
if (base.err > 0.005) console.warn('row base err', base.err);
const A = { hang: hangArm(base.pose) };
if (A.hang.err > 0.005) console.warn('hang err', A.hang.err);
const rowFrame = (s) => withArm(base.pose, A, s);

function rowLevel(segs, name) {
  const { total, at } = phaseFn(segs), kfs = [];
  const n = Math.round(total / DT);
  for (let i = 0; i < n; i++) kfs.push(keyframe(i * DT, rowFrame(at(i * DT))));
  kfs.push({ ...kfs[0], t: total });
  return { duration: total, keyT: round(segs.slice(0, 1).reduce((a, g) => a + g[0], 0), 2), kfs, name };
}
// keyT: show the top (pulled) position, t = 0 in every row level
const ROW = {
  0: rowLevel([[2, 1, 0], [0.5, 0, 0], [1, 0, 1], [0.5, 1, 1]], 'one-arm'),
  1: rowLevel([[3, 1, 0], [0.5, 0, 0], [1, 0, 1], [0.5, 1, 1]], 'tempo'),
  2: rowLevel([[2, 1, 0], [0.5, 0, 0], [1, 0, 1], [2, 1, 1]], 'paused'),
  3: rowLevel([[1, 1, 0.5], [1, 0.5, 1], [2, 1, 0], [0.5, 0, 0], [1, 0, 1]], '1.5-rep'),
};
for (const l of Object.values(ROW)) l.keyT = 0;

// wrong poses (all at the top of the rep, same contacts)
const wr = (o, s = 1, armFn) => {
  const r = body(o, base.pose); if (r.err > 0.012) console.warn('row wrong err', JSON.stringify(o), r.err);
  let p = withArm(r.pose, A, s); if (armFn) p = armFn(p); return jp(p);
};
const wrongRow = {
  round: wr({ spine: 16, chest: 12, neck: 0, head: -5 }),
  twist: wr({ spineYaw: 12, chestYaw: 28 }, 1, (p) => { p.joints.shoulder_R = [...p.joints.shoulder_R]; return p; }),
  flare: wr({}, 1, (p) => { p.joints.shoulder_R = [-5, 0, 70]; p.joints.elbow_R = [85, 0, 0]; return p; }),
  heave: wr({ pitch: 34 }),
};
const rowProps = (bell) => [{ type: 'chair', pos: [PALM.x, 0, CHAIR_Z], rotY: 180, seat: SEAT }, { type: 'kettlebell', attach: 'palm_R', offset: [0, -0.14, 0], heldBy: ['palm_R'] }];
const ROWC = ['heel_L', 'heel_R', 'toe_L', 'toe_R', 'palm_L'];

/* ================= bar levels (4-6) ================= */
const BAR_Y = 2.15, BAR_Z = 0.12;
function legs(p, kfx = {}) { // hang with knees bent behind, ankles relaxed
  for (const S of ['L', 'R']) { p.joints['hip_' + S] = [-5, 0, 0]; p.joints['knee_' + S] = [75, 0, 0]; p.joints['ankle_' + S] = [-25, 0, 0]; }
  return setJ(p, kfx);
}
function barFrame(warm, o) {
  const pose = clonePose(warm);
  legs(pose, o.extra || {});
  pose.root.rot[0] = o.pitch ?? 0;
  pose.joints.neck = pose.joints.neck || [0, 0, 0];
  const free = ['root.pos.0', 'root.pos.1', 'root.pos.2', both('shoulder', 0, { min: 20, max: 200 }), both('shoulder', 1), both('shoulder', 2), both('wrist', 0, { min: -60, max: 60 })];
  free.push(o.elbowFix !== undefined ? both('elbow', 0, { min: o.elbowFix, max: o.elbowFix }) : both('elbow', 0, { min: 3, max: 158 }));
  const T = [{ p: 'palm_L', x: o.grip, y: BAR_Y, z: BAR_Z }, { p: 'palm_R', x: -o.grip, y: BAR_Y, z: BAR_Z }, { p: 'wrist_L', y: BAR_Y - 0.06, w: 0.3 }, { p: 'wrist_R', y: BAR_Y - 0.06, w: 0.3 }];
  if (o.neckY !== undefined) T.push({ p: 'neck', y: o.neckY });
  if (o.neckZ !== undefined) T.push({ p: 'neck', z: o.neckZ, w: o.neckZw ?? 1 });
  T.push({ p: 'root', x: 0, w: 0.5 });
  const priors = [{ path: 'root.pos.0', value: 0, w: 0.3 }, { path: 'joints.shoulder_L.1', value: 0, w: 0.03 }, { path: 'joints.shoulder_L.2', value: o.abd ?? 8, w: 0.04 }, { path: 'joints.wrist_L.0', value: 0, w: 0.05 }];
  return solve(pose, { free, targets: T, priors, iters: 200 });
}
const barSeed = () => { const p = newPose(); p.root.pos = [0, 1.15, 0]; for (const S of ['L', 'R']) p.joints['shoulder_' + S] = [170, 0, 5]; return p; };

function barLevel(name, cfg) {
  const { grip, topLean, neckZTop, hangZ = BAR_Z - 0.04 } = cfg;
  // hang (s = 0): arms straight; top (s = 1): chin over the bar
  const hang = barFrame(barSeed(), { grip, elbowFix: 3, neckZ: hangZ, neckZw: 0.3, pitch: 0, abd: 6 });
  const neckHang = fk(hang.pose).neck[1], neckTop = BAR_Y - 0.015;
  if (hang.err > 0.004) console.warn(name, 'hang err', hang.err);
  const frame = (s, warm, extra = {}) => barFrame(warm, { grip, neckY: lerp(neckHang, neckTop, s), neckZ: lerp(hangZ, neckZTop, s), pitch: lerp(0, topLean, s), abd: 10, ...extra });
  const { total, at } = phaseFn(cfg.segs);
  // solve a grid of s values from the hang upward (each warm-started from the last), then interpolate joint angles in s
  const G = 40, grid = []; let warm = hang.pose, worst = 0;
  for (let g = 0; g <= G; g++) { const r = frame(g / G, warm); warm = r.pose; worst = Math.max(worst, r.err); grid.push(r.pose); }
  const poseAt = (s) => { const x = Math.min(G - 1e-9, s * G), i = Math.floor(x), f = x - i, a = grid[i], b = grid[i + 1], p = clonePose(a);
    for (let k = 0; k < 3; k++) p.root.pos[k] = lerp(a.root.pos[k], b.root.pos[k], f); p.root.rot[0] = lerp(a.root.rot[0], b.root.rot[0], f);
    for (const j of Object.keys(a.joints)) p.joints[j] = a.joints[j].map((v, k) => lerp(v, b.joints[j][k], f)); return p; };
  const frames = [], n = Math.round(total / DT);
  for (let i = 0; i < n; i++) { const t = i * DT, s = at(t); frames.push({ t, s, pose: poseAt(s) }); }
  const top = { pose: grid[G], err: 0 };
  const kfs = frames.map((f) => keyframe(f.t, f.pose)); kfs.push({ ...kfs[0], t: total });
  return { name, total, kfs, frames, worst, hangPose: hang.pose, topPose: top.pose, frame, grip, neckHang, neckTop };
}
const TOPS = (lean, nz) => ({ topLean: lean, neckZTop: nz });
// loops start at the top: lower, hold at the bottom, pull, hold at the top
const BARS = {
  4: barLevel('negative', { grip: 0.21, ...TOPS(-8, BAR_Z - 0.13), segs: [[5, 1, 0], [1, 0, 0], [2, 0, 1], [0.5, 1, 1]] }),
  5: barLevel('chin-up', { grip: 0.19, ...TOPS(-12, BAR_Z - 0.12), segs: [[3, 1, 0], [0.5, 0, 0], [1.5, 0, 1], [0.5, 1, 1]] }),
  6: barLevel('pull-up', { grip: 0.29, ...TOPS(-10, BAR_Z - 0.12), segs: [[3, 1, 0], [0.5, 0, 0], [1.5, 0, 1], [0.5, 1, 1]] }),
};
const barWrong = (L) => {
  const w = {};
  // shrug / passive hang: shoulders roll up and forward, head pokes out (hang position, arms straight)
  { const r = barFrame(L.hangPose, { grip: L.grip, elbowFix: 3, neckZ: BAR_Z - 0.06, neckZw: 0.3, pitch: 4, abd: 6, extra: { chest: [16, 0, 0], neck: [28, 0, 0], head: [-12, 0, 0] } }); w.shrug = jp(r.pose); if (r.err > 0.012) console.warn(L.name, 'shrug err', r.err); }
  // kip / swing: body swings back, hips and knees thrown forward, pulled halfway with momentum
  { const mid = L.frame(0.5, L.hangPose);
    const r = barFrame(mid.pose, { grip: L.grip, pitch: -24, neckY: undefined, neckZ: undefined, abd: 8, extra: { hip_L: [38, 0, 0], hip_R: [38, 0, 0], knee_L: [20, 0, 0], knee_R: [20, 0, 0], spine: [-8, 0, 0] } });
    w.kip = jp(r.pose); if (r.err > 0.012) console.warn(L.name, 'kip err', r.err); }
  // craning: chin reaches over the bar by poking the neck; chest stays low
  { const r = barFrame(L.hangPose, { grip: L.grip, neckY: lerp(L.neckHang, L.neckTop, 0.72), neckZ: BAR_Z - 0.10, pitch: -4, abd: 8, extra: { neck: [-38, 0, 0], head: [-14, 0, 0] } }); w.crane = jp(r.pose); if (r.err > 0.02) console.warn(L.name, 'crane err', r.err); }
  return w;
};
for (const L of Object.values(BARS)) L.wrong = barWrong(L);
const barProp = { type: 'bar', pos: [0, 0, BAR_Z], h: BAR_Y - 0.016, width: 0.8 };
const BARC = ['palm_L', 'palm_R'];

/* ================= assemble ================= */
const out = {};
for (const i of [0, 1, 2, 3]) out[i] = { duration: ROW[i].duration, keyT: 0, contacts: ROWC, support: { palm_L: SEAT }, props: rowProps(), keyframes: ROW[i].kfs, wrong: wrongRow };
for (const i of [4, 5, 6]) { const L = BARS[i]; out[i] = { duration: L.total, keyT: 0, contacts: BARC, support: { palm_L: BAR_Y, palm_R: BAR_Y }, props: [barProp], keyframes: L.kfs, wrong: L.wrong }; }
writeFileSync(new URL('../js/form/poses/row.gen.js', import.meta.url), `// GENERATED by tools/author-row.mjs. Do not edit by hand; edit the author script and re-run it.\nexport default ${JSON.stringify(out)};\n`);

if (REPORT) {
  const show = (nm, p) => { const q = fk(p); console.log(nm, 'root', p.root.pos.map((v) => v.toFixed(2)).join(','), 'rot', p.root.rot.map((v) => v.toFixed(0)).join(','), 'kneeL', flexionDeg(p, 'knee_L').toFixed(0), 'kneeR', flexionDeg(p, 'knee_R').toFixed(0), 'hipL', flexionDeg(p, 'hip_L').toFixed(0), 'hipR', flexionDeg(p, 'hip_R').toFixed(0), 'elbL', flexionDeg(p, 'elbow_L').toFixed(0), 'elbR', flexionDeg(p, 'elbow_R').toFixed(0), 'shR', (p.joints.shoulder_R || []).map((v) => v.toFixed(0)).join('/'), 'palmR', q.palm_R.map((v) => v.toFixed(2)).join(','), 'shoulderL', q.shoulder_L.map((v) => v.toFixed(2)).join(','), 'knee_L', q.knee_L.map((v) => v.toFixed(2)).join(','), 'toetip_L', q.toetip_L.map((v) => v.toFixed(2)).join(',')); };
  show('row top', rowFrame(1)); show('row bottom', rowFrame(0));
  for (const [k, w] of Object.entries(wrongRow)) show('wrong ' + k, w);
  for (const [i, L] of Object.entries(BARS)) { show(i + ' hang', L.hangPose); show(i + ' top', L.topPose); const q = fk(L.topPose); console.log('   neck top y', q.neck[1].toFixed(2), 'z', q.neck[2].toFixed(2), 'head_top', q.head_top.map((v) => v.toFixed(2)).join(','), 'worst', L.worst.toFixed(4)); for (const [k, w] of Object.entries(L.wrong)) show('   wrong ' + k, w); }
}
console.log('wrote row.gen.js');
