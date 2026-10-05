// Generates js/form/poses/hinge.gen.js (levels 0-3: two-hand swing, one-arm swing, single-leg RDL, tempo single-leg RDL).
// Run: node tools/author-hinge.mjs [--report]
import { writeFileSync } from 'node:fs';
import { solve, newPose, both, one, clonePose, keyframe, round } from './solve.mjs';
import { fk, flexionDeg, vsub, vangle, vmid } from '../js/form/skeleton.js';

const REPORT = process.argv.includes('--report');
const rad = (d) => d * Math.PI / 180;
const lerp = (a, b, s) => a + (b - a) * s;
const E = process.env;

/* ---------- shared helpers ---------- */
// piecewise-linear schedule: rows [t, ...values]; returns the values at time t
const sched = (rows, t) => {
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (t <= b[0] + 1e-9) { const f = b[0] === a[0] ? 1 : (t - a[0]) / (b[0] - a[0]); const s = f; return a.slice(1).map((v, k) => lerp(v, b[k + 1], s)); }
  }
  return rows[rows.length - 1].slice(1);
};
const smooth = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
// smooth schedule: ease inside each segment
const ssched = (rows, t) => {
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (t <= b[0] + 1e-9) { const f = b[0] === a[0] ? 1 : smooth((t - a[0]) / (b[0] - a[0])); return a.slice(1).map((v, k) => lerp(v, b[k + 1], f)); }
  }
  return rows[rows.length - 1].slice(1);
};
const jp = (p) => ({ root: { pos: p.root.pos.map((v) => round(v)), rot: p.root.rot.map((v) => round(v, 2)) }, joints: keyframe(0, p).joints });
const loopKfs = (frames, total) => { const k = frames.map((f) => keyframe(f.t, f.pose)); k.push({ ...k[0], t: total }); return k; };

/* =====================================================================================
   SWING (two-hand and one-arm). Both feet planted. h = hinge depth (0 = tall plank, 1 = hike), alpha = world arm angle
   from hanging (forward +). Torso stays neutral: all lean comes from the pelvis (root pitch).
   ===================================================================================== */
const ANK_X = 0.17, YAW = 12;
const toeX = ANK_X + 0.15 * Math.sin(rad(YAW)), heelX = ANK_X - 0.05 * Math.sin(rad(YAW));
const toeZ = 0.15 * Math.cos(rad(YAW)), heelZ = -0.05 * Math.cos(rad(YAW));
const TOP = { y: 0.956, z: 0, pitch: 0, kneeX: 0.135 };
const BOT = { y: +(E.BY || 0.87), z: +(E.BZ || -0.20), pitch: +(E.BP || 50), kneeX: +(E.BK || 0.19) };
const HX = 0.04; // hand spacing: wrists 4 cm either side of the midline on the handle

function swingFrame(warm, o) {
  const pose = clonePose(warm);
  pose.root.pos[1] = o.rootY; pose.root.pos[2] = o.rootZ; pose.root.rot[0] = o.pitch;
  for (const S of ['L', 'R']) for (const j of ['hip', 'knee']) { const k = pose.joints[j + '_' + S] || [0, 0, 0]; if (k[0] < 6) k[0] = 6; pose.joints[j + '_' + S] = k; }
  pose.joints.neck = [-0.35 * o.pitch, 0, 0]; pose.joints.head = [-0.2 * o.pitch, 0, 0];
  for (const [k, v] of Object.entries(o.extra || {})) pose.joints[k] = [...v];
  const frees = ['root.pos.0', 'root.rot.1', 'root.rot.2', both('hip', 0, { min: -10, max: 140 }), both('hip', 1, { min: -30, max: 40 }), both('hip', 2, { min: -10, max: 30 }), both('knee', 0, { min: 0, max: 150 }), both('ankle', 0, { min: -30, max: 45 }), both('ankle', 1, { min: -10, max: 50 })];
  const T = [], priors = [{ path: 'root.rot.1', value: 0, w: 0.5 }, { path: 'root.rot.2', value: 0, w: 0.5 }, { path: 'root.pos.0', value: 0, w: 0.5 }, { path: 'joints.hip_L.1', value: 0, w: 0.03 }, { path: 'joints.hip_L.2', value: 0, w: 0.03 }];
  for (const [S, sx] of [['L', 1], ['R', -1]]) {
    T.push({ p: `toe_${S}`, x: sx * toeX, y: 0, z: toeZ }, { p: `toetip_${S}`, y: 0 }, { p: `heel_${S}`, x: sx * heelX, y: 0, z: heelZ }, { p: `knee_${S}`, x: sx * o.kneeX, w: 0.5 });
  }
  // arms: held side(s) reach the handle; the free arm of a one-arm swing hangs relaxed beside the body
  const held = o.hands; // ['L','R'] or ['R']
  const free = ['L', 'R'].filter((s) => !held.includes(s));
  for (const S of free) pose.joints['shoulder_' + S] = [o.freeRx ?? o.pitch, 0, 14]; // hangs straight down in the world, a little out
  for (const S of held) {
    pose.joints['shoulder_' + S] = [o.alpha + o.pitch, 0, 0]; pose.joints['elbow_' + S] = [o.elbow, 0, 0];
    frees.push(one('shoulder', S, 2, { min: -45, max: 10 }), one('shoulder', S, 1, { min: -45, max: 10 })); priors.push({ path: `joints.shoulder_${S}.1`, value: 0, w: 0.02 }, { path: `joints.shoulder_${S}.2`, value: 0, w: 0.02 });
    if (!process.env.NOARM) T.push({ p: `wrist_${S}`, x: held.length === 2 ? (S === 'L' ? HX : -HX) : (o.oneX ?? 0) });
    if (o.reach) { frees.push(one('shoulder', S, 0, { min: -70, max: 200 }), one('elbow', S, 0, { min: 0, max: 25 }));
      T.push({ p: `wrist_${S}`, rel: 'root', y: o.reach.y, z: o.reach.z }); priors.push({ path: `joints.elbow_${S}.0`, value: 0, w: 0.04 }); }
  }
  return solve(pose, { free: frees, targets: T, priors });
}

function buildSwing(hands, wrongSet) {
  const hold = (a) => ({ y: lerp(TOP.y, BOT.y, a), z: lerp(TOP.z, BOT.z, a), pitch: lerp(TOP.pitch, BOT.pitch, a), kneeX: lerp(TOP.kneeX, BOT.kneeX, a) });
  const reach = { y: +(E.RY || -0.12), z: +(E.RZ || -0.05) };
  // 1) hike pose: hands high between the thighs, arms as straight as the reach allows
  let warm = newPose(); warm.root.pos = [0, 0.95, 0];
  const b = hold(1);
  warm.joints.ankle_L = [0, YAW, 0]; warm.joints.ankle_R = [0, YAW, 0];
  let hike, topWarm;
  for (const a of [0, 0.2, 0.4, 0.6, 0.8, 1]) { const g = hold(a); hike = swingFrame(warm, { rootY: g.y, rootZ: g.z, pitch: g.pitch, kneeX: g.kneeX, hands, alpha: lerp(80, -45, a), elbow: 8 * a, reach: a === 1 ? reach : null }); warm = hike.pose; if (a === 0) topWarm = hike.pose; }
  if (REPORT) console.log('hike err', hike.err.toFixed(4), hike.misses.filter((m) => !/ -?0\.[0-4]cm/.test(m)).join(' '));
  const hp = hike.pose, S0 = hands[hands.length - 1];
  const alphaB = hp.joints['shoulder_' + S0][0] - b.pitch, elbB = hp.joints['elbow_' + S0][0];
  // 2) schedule: [t, h, alpha, elbow]
  const A1 = 84;
  const rows = [[0, 0, A1, 0], [0.15, 0, A1, 0], [0.4, 0.02, 40, 0], [0.62, 0.3, 0, 0], [0.8, 0.9, alphaB + 4, elbB * 0.5], [0.92, 1, alphaB, elbB], [1.0, 1, alphaB, elbB],
    [1.1, 0.55, alphaB * 0.5, elbB * 0.5], [1.2, 0.05, 20, 0], [1.28, 0, 50, 0], [1.42, 0, A1, 0], [1.8, 0, A1, 0]];
  const total = 1.8, DT = 0.0625, frames = []; warm = clonePose(topWarm); let worst = 0;
  for (let i = 0; i < Math.round(total / DT); i++) {
    const t = i * DT, [h, al, el] = sched(rows, t), g = hold(h);
    const r = swingFrame(warm, { rootY: g.y, rootZ: g.z, pitch: g.pitch, kneeX: g.kneeX, hands, alpha: al, elbow: el, reach: h > 0.95 ? reach : null });
    warm = r.pose; worst = Math.max(worst, r.err); frames.push({ t, h, pose: r.pose });
    if (REPORT && r.err > 0.02) console.log('frame', t, 'err', r.err.toFixed(3), r.misses.filter((m) => !/ -?[0-1]\.[0-9]cm/.test(m)).slice(0, 4).join(' '));
  }
  const bottom = frames.reduce((a, f) => (f.h > a.h ? f : a)), topF = frames[0];
  const out = { duration: total, keyT: round(topF.t, 2), contacts: ['heel_L', 'heel_R', 'toe_L', 'toe_R'], keyframes: loopKfs(frames, total) };
  // wrong poses
  const wr = {};
  const bw = { rootY: BOT.y, rootZ: BOT.z, pitch: BOT.pitch, kneeX: BOT.kneeX, hands, reach };
  if (wrongSet.squat) { // squatting the swing: deep knee bend, upright torso, hands out in front
    const r = swingFrame(bottom.pose, { rootY: +(E.SY || 0.56), rootZ: +(E.SZ || -0.26), pitch: 28, kneeX: 0.2, hands, alpha: 25, elbow: 20 }); wr.squat = jp(r.pose); if (r.err > 0.012) console.warn('squat err', r.err);
  }
  if (wrongSet.round) { // rounded back at the hike
    const r = swingFrame(bottom.pose, { ...bw, extra: { spine: [26, 0, 0], chest: [16, 0, 0] }, reach: null }); wr.round = jp(r.pose); if (r.err > 0.02) console.warn('round err', r.err);
  }
  if (wrongSet.lean) { // leaning back at the top: pelvis pushed forward, ribs flared, bell too high
    const r = swingFrame(topF.pose, { rootY: 0.956, rootZ: 0.05, pitch: -8, kneeX: 0.135, hands, alpha: 100, elbow: 0, extra: { spine: [-8, 0, 0], chest: [-10, 0, 0] } }); wr.lean = jp(r.pose); if (r.err > 0.012) console.warn('lean err', r.err);
  }
  if (wrongSet.twist) { // one-arm: torso rotates toward the bell hand
    const r = swingFrame(bottom.pose, { ...bw, extra: { spine: [0, -14, 0], chest: [0, -26, 0], neck: [-0.35 * BOT.pitch, 8, 0] } }); wr.twist = jp(r.pose); if (r.err > 0.02) console.warn('twist err', r.err);
  }
  return { out: { ...out, wrong: wr }, frames, bottom, topF, worst, alphaB, elbB };
}

const SW0 = buildSwing(['L', 'R'], { squat: 1, round: 1, lean: 1 });
const SW1 = buildSwing(['R'], { twist: 1, round: 1, lean: 1 });

/* =====================================================================================
   SINGLE-LEG RDL. Stand on the left leg, bell in the left hand (same side as the standing leg, so it hangs close to it).
   Hips square: no root yaw or roll. Back leg is in line with the torso.
   ===================================================================================== */
const SL = { top: { y: 0.958, z: 0, pitch: 0 }, bot: { y: +(E.LY || 0.915), z: +(E.LZ || -0.14), pitch: +(E.LP || 66) } };
function slFrame(warm, o) {
  const pose = clonePose(warm);
  const stX = 0.0;                          // standing ankle on the midline
  pose.root.pos[0] = stX - 0.09; pose.root.pos[1] = o.rootY; pose.root.pos[2] = o.rootZ; pose.root.rot = [o.pitch, o.rotY || 0, o.rotZ || 0];
  pose.joints.neck = [-0.35 * o.pitch, 0, 0]; pose.joints.head = [-0.2 * o.pitch, 0, 0];
  pose.joints.hip_R = [o.backHip, o.backHipY || 0, o.backHipZ || 0]; pose.joints.knee_R = [o.backKnee, 0, 0]; pose.joints.ankle_R = [-25, 0, 0];
  pose.joints.shoulder_L = [o.alpha + o.pitch, 0, 0]; pose.joints.elbow_L = [0, 0, 0];
  pose.joints.shoulder_R = [o.pitch, 0, 16]; pose.joints.elbow_R = [8, 0, 0];
  for (const [k, v] of Object.entries(o.extra || {})) pose.joints[k] = [...v];
  const frees = [one('hip', 'L', 0, { min: -10, max: 140 }), one('hip', 'L', 1, o.wide ? { min: -40, max: 40 } : { min: -15, max: 15 }), one('hip', 'L', 2, o.wide ? { min: -30, max: 30 } : { min: -8, max: 8 }), one('knee', 'L', 0, { min: 0, max: 60 }), one('ankle', 'L', 0, { min: -30, max: 45 }), one('shoulder', 'L', 2, { min: -45, max: 10 })];
  if (o.rootFree) frees.push('root.rot.1', 'root.rot.2');
  const T = [{ p: 'toe_L', x: 0, y: 0, z: 0.15 }, { p: 'toetip_L', y: 0 }, { p: 'heel_L', x: 0, y: 0, z: -0.05 }, { p: 'knee_L', x: 0.0, w: 0.4 }, { p: 'wrist_L', x: o.wristX ?? 0.05 }];
  const priors = [{ path: 'joints.hip_L.1', value: 0, w: 0.1 }, { path: 'joints.hip_L.2', value: 0, w: 0.05 }, { path: 'joints.knee_L.0', value: 10, w: 0.03 }];
  return solve(pose, { free: frees, targets: T, priors });
}
function buildSL(rows, total, tempoPoint, wrongOn) {
  const hold = (a) => ({ y: lerp(SL.top.y, SL.bot.y, a), z: lerp(SL.top.z, SL.bot.z, a), pitch: lerp(SL.top.pitch, SL.bot.pitch, a), backHip: lerp(-6, -4, a), backKnee: lerp(62, 4, a), alpha: lerp(0, 2, a) });
  const DT = 0.125, frames = []; let warm = newPose(); let worst = 0;
  warm.root.pos = [-0.09, 0.95, 0];
  for (let i = 0; i < Math.round(total / DT); i++) {
    const t = i * DT, [h] = ssched(rows, t), g = hold(h);
    const r = slFrame(warm, { rootY: g.y, rootZ: g.z, pitch: g.pitch, backHip: g.backHip, backKnee: g.backKnee, alpha: g.alpha });
    warm = r.pose; worst = Math.max(worst, r.err); frames.push({ t, h, pose: r.pose });
    if (REPORT && r.err > 0.005) console.log('SL frame', t, 'err', r.err.toFixed(3), r.misses.filter((m) => !/ -?0\.[0-4]cm/.test(m)).join(' '));
  }
  const bottom = frames.reduce((a, f) => (f.h > a.h ? f : a)), topF = frames[0];
  const out = { duration: total, keyT: round(bottom.t, 2), contacts: ['heel_L', 'toe_L'], keyframes: loopKfs(frames, total) };
  const wr = {}, g1 = hold(1);
  const base = { rootY: g1.y, rootZ: g1.z, pitch: g1.pitch, backHip: g1.backHip, backKnee: g1.backKnee, alpha: g1.alpha };
  { const r = slFrame(bottom.pose, { ...base, extra: { spine: [26, 0, 0], chest: [16, 0, 0] } }); wr.round = jp(r.pose); if (r.err > 0.02) console.warn('SL round err', r.err); }
  { // hips open: pelvis rolls toward the lifted leg's side, back leg turns out and rises
    const r = slFrame(bottom.pose, { ...base, wide: true, rotZ: +(E.OZ || -30), backHipZ: 8, backHip: -10 }); wr.open = jp(r.pose); if (r.err > 0.03) console.warn('SL open err', r.err); }
  { // bell drifts forward, away from the standing leg
    const r = slFrame(bottom.pose, { ...base, alpha: 28, wristX: 0.05, extra: {} }); wr.away = jp(r.pose); if (r.err > 0.02) console.warn('SL away err', r.err); }
  return { out: { ...out, wrong: wr }, frames, bottom, topF, worst };
}
const SL2 = buildSL([[0, 0], [0.5, 0], [2.5, 1], [2.9, 1], [4.4, 0], [5.0, 0]], 5.0, 'neck');
const SL3 = buildSL([[0, 0], [0.5, 0], [3.5, 1], [4.0, 1], [5.5, 0], [6.0, 0]], 6.0, 'neck');

const out = {
  0: { ...SW0.out, props: [{ type: 'kettlebell', attach: 'wrist_L', offset: [-HX, -0.115, 0], heldBy: ['wrist_L', 'wrist_R'] }] },
  1: { ...SW1.out, props: [{ type: 'kettlebell', attach: 'wrist_R', offset: [0, -0.115, 0], heldBy: ['wrist_R'] }] },
  2: { ...SL2.out, props: [{ type: 'kettlebell', attach: 'wrist_L', offset: [0, -0.115, 0], heldBy: ['wrist_L'] }] },
  3: { ...SL3.out, props: [{ type: 'kettlebell', attach: 'wrist_L', offset: [0, -0.115, 0], heldBy: ['wrist_L'] }] },
};
writeFileSync(new URL('../js/form/poses/hinge.gen.js', import.meta.url), `// GENERATED by tools/author-hinge.mjs. Do not edit by hand; edit the author script and re-run it.\nexport default ${JSON.stringify(out)};\n`);

if (REPORT) {
  const show = (name, P) => {
    const q = fk(P), sh = vmid(q.shoulder_L, q.shoulder_R), hp = vmid(q.hip_L, q.hip_R);
    console.log(name, 'rootY', P.root.pos[1].toFixed(2), 'rootZ', P.root.pos[2].toFixed(2), 'pitch', P.root.rot[0].toFixed(0), 'hipL', flexionDeg(P, 'hip_L').toFixed(0), 'kneeL', flexionDeg(P, 'knee_L').toFixed(0), 'ankL', flexionDeg(P, 'ankle_L').toFixed(0),
      'shank from vertical', (Math.atan2(q.knee_L[2] - q.ankle_L[2], q.knee_L[1] - q.ankle_L[1]) * 180 / Math.PI).toFixed(0), 'elbowR', flexionDeg(P, 'elbow_R').toFixed(0), 'wristR', q.wrist_R.map((v) => v.toFixed(2)).join(','), 'palmR', q.palm_R.map((v) => v.toFixed(2)).join(','),
      'hipsY L/R', q.hip_L[1].toFixed(2), q.hip_R[1].toFixed(2), 'shoulders y L/R', q.shoulder_L[1].toFixed(2), q.shoulder_R[1].toFixed(2), 'shoulder z L/R', q.shoulder_L[2].toFixed(2), q.shoulder_R[2].toFixed(2),
      'toetipR', q.toetip_R.map((v) => v.toFixed(2)).join(','), 'knee', q.knee_L.map((v) => v.toFixed(2)).join(','));
  };
  for (const [n, X] of [['swing2', SW0], ['swing1', SW1]]) { console.log(n, 'worst', X.worst.toFixed(4), 'alphaB', X.alphaB.toFixed(0), 'elbB', X.elbB.toFixed(0)); show(' top', X.topF.pose); show(' bot', X.bottom.pose); for (const [k, w] of Object.entries(X.out.wrong)) show(' wrong ' + k, w); }
  for (const [n, X] of [['sl2', SL2], ['sl3', SL3]]) { console.log(n, 'worst', X.worst.toFixed(4)); show(' top', X.topF.pose); show(' bot', X.bottom.pose); for (const [k, w] of Object.entries(X.out.wrong)) show(' wrong ' + k, w); }
}
console.log('wrote hinge.gen.js');
