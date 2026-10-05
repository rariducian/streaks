// Generates js/form/poses/squat.gen.js (level 0: goblet squat). Run: node tools/author-squat.mjs [--report]
import { writeFileSync } from 'node:fs';
import { solve, newPose, both, one, clonePose, keyframe, phaseFn, round } from './solve.mjs';
import { fk, flexionDeg, vsub, vangle, vmid } from '../js/form/skeleton.js';

const REPORT = process.argv.includes('--report');
const SEGS = [[2, 0, 1], [0.5, 1, 1], [1, 1, 0], [0.5, 0, 0]];
const SEGS_TEMPO = [[3, 0, 1], [1, 1, 1], [1, 1, 0], [0.5, 0, 0]];
const DT = 0.125;
const lerp = (a, b, s) => a + (b - a) * s;
const ANK_X = 0.17, YAW = 20;                 // stance: ankles 17 cm either side of the midline, toes turned out 20 degrees
const BELL = [0, 0.08, 0.20];                 // bell centre in the chest frame (metres)

// 1) Static arm pose that holds the bell at the chest (arms are rigid to the chest, so this is the same for every frame).
function armPose() {
  const p = newPose(); p.joints.shoulder_L = [40, 0, 0]; p.joints.shoulder_R = [40, 0, 0]; p.joints.elbow_L = [100, 0, 0]; p.joints.elbow_R = [100, 0, 0];
  const r = solve(p, {
    free: [both('shoulder', 0), both('shoulder', 1), both('shoulder', 2), both('elbow', 0, { min: 20, max: 150 }), both('wrist', 0, { min: -30, max: 60 })],
    targets: [{ p: 'wrist_L', rel: 'chest', x: 0.075, y: 0.185, z: 0.20 }, { p: 'wrist_R', rel: 'chest', x: -0.075, y: 0.185, z: 0.20 }, { p: 'elbow_L', rel: 'chest', x: 0.18, y: -0.02, w: 0.2 }, { p: 'elbow_R', rel: 'chest', x: -0.18, y: -0.02, w: 0.2 }],
    priors: [{ path: 'joints.wrist_L.0', value: 10, w: 0.05 }],
  });
  if (r.err > 0.01) console.warn('arm err', r.err);
  return r.pose.joints;
}
const ARMS = armPose();

const stand = () => {
  const p = newPose();
  for (const k of ['shoulder_L', 'shoulder_R', 'elbow_L', 'elbow_R', 'wrist_L', 'wrist_R']) p.joints[k] = [...ARMS[k]];
  p.joints.ankle_L = [0, YAW, 0]; p.joints.ankle_R = [0, YAW, 0];
  return p;
};
const ROOT_FREE = ['root.pos.0', 'root.rot.1', 'root.rot.2'];
function frame(warm, o) {
  const pose = clonePose(warm);
  for (const S of ['L', 'R']) { const k = pose.joints['knee_' + S] || [0, 0, 0]; if (k[0] < 6) k[0] = 6; pose.joints['knee_' + S] = k; const h = pose.joints['hip_' + S] || [0, 0, 0]; if (h[0] < 6) h[0] = 6; pose.joints['hip_' + S] = h; }
  pose.root.pos[1] = o.rootY; pose.root.pos[2] = o.rootZ; pose.root.rot[0] = o.pitch;
  pose.joints.neck = [-0.35 * o.pitch, 0, 0]; pose.joints.head = [-0.2 * o.pitch, 0, 0];
  for (const [k, v] of Object.entries(o.extra || {})) pose.joints[k] = [...v];
  const frees = [...ROOT_FREE, both('hip', 0, { min: -10, max: 140 }), both('hip', 1, { min: -30, max: 40 }), both('hip', 2, { min: -10, max: 30 }), both('knee', 0, { min: 0, max: 150 })];
  if (!o.heelsUp) frees.push(both('ankle', 0, { min: -30, max: 45 }));
  else frees.push(both('ankle', 0, { min: -50, max: 45 }));
  frees.push(both('ankle', 1, { min: -10, max: 50 }));
  const T = [];
  for (const [S, sx] of [['L', 1], ['R', -1]]) {
    T.push({ p: `toe_${S}`, x: sx * o.toeX, y: 0, z: o.toeZ }, { p: `toetip_${S}`, y: 0 }, { p: `heel_${S}`, x: sx * o.heelX, y: o.heelY ?? 0, z: o.heelZ });
    T.push({ p: `knee_${S}`, x: sx * o.kneeX, w: 0.5 });
  }
  const priors = [{ path: 'root.rot.1', value: 0, w: 0.5 }, { path: 'root.rot.2', value: 0, w: 0.5 }, { path: 'root.pos.0', value: 0, w: 0.5 }, { path: 'joints.hip_L.1', value: 0, w: 0.03 }, { path: 'joints.hip_L.2', value: 0, w: 0.03 }];
  return solve(pose, { free: frees, targets: T, priors });
}

// foot geometry: toe-out yaw about the ankle
const rad = (d) => d * Math.PI / 180;
const toeX = ANK_X + 0.15 * Math.sin(rad(YAW)), heelX = ANK_X - 0.05 * Math.sin(rad(YAW));
const toeZ = 0.15 * Math.cos(rad(YAW)), heelZ = -0.05 * Math.cos(rad(YAW));
const ROOT_BOTTOM = +(process.env.RB || 0.48), ROOT_Z = +(process.env.RZ || -0.22), PITCH_TOP = 3, PITCH_BOTTOM = +(process.env.PB || 32);

function goblet(SEGS) {
const { total, at } = phaseFn(SEGS);
const frames = []; let warm = stand(); warm.root.pos = [0, 0.96, 0.0]; let worst = 0;
const n = Math.round(total / DT);
for (let i = 0; i < n; i++) {
  const t = i * DT, s = at(t);
  const rootY = lerp(0.957, ROOT_BOTTOM, s), u = s;
  const r = frame(warm, { rootZ: lerp(0.0, ROOT_Z, s), rootY, pitch: lerp(PITCH_TOP, PITCH_BOTTOM, u), toeX, toeZ, heelX, heelZ, kneeX: lerp(0.15, 0.215, s) });
  warm = r.pose; worst = Math.max(worst, r.err); frames.push({ t, s, pose: r.pose }); if (REPORT && r.err > 0.005 && t === 0.75) console.log(JSON.stringify(r.pose.joints.hip_L), JSON.stringify(r.pose.joints.knee_L), JSON.stringify(r.pose.joints.ankle_L), JSON.stringify(r.pose.root), 'frame', t, 's', s.toFixed(2), 'err', r.err.toFixed(3), r.misses.filter((m) => !/ -?0\.[0-4]cm/.test(m)).join(' '));
}
const bottom = frames.reduce((a, f) => (f.s > a.s ? f : a));
const kfs = frames.map((f) => keyframe(f.t, f.pose)); kfs.push({ ...kfs[0], t: total });

const jp = (p) => ({ root: { pos: p.root.pos.map((v) => round(v)), rot: p.root.rot.map((v) => round(v, 2)) }, joints: keyframe(0, p).joints });
const wrongBase = { rootZ: ROOT_Z, rootY: ROOT_BOTTOM, pitch: PITCH_BOTTOM, toeX, toeZ, heelX, heelZ, kneeX: 0.215 };
const wrong = {};
{ // heels lift: heel 5 cm off the floor, ankle plantar-flexed, toes planted
  const r = frame(bottom.pose, { ...wrongBase, heelY: 0.05, heelsUp: true }); wrong.heels = jp(r.pose); if (r.err > 0.012) console.warn('heels wrong err', r.err);
}
{ // knees cave in: knees well inside the line of the toes
  const r = frame(bottom.pose, { ...wrongBase, kneeX: 0.10 }); wrong.knees = jp(r.pose); if (r.err > 0.045) console.warn('knees wrong err', r.err);
}
{ // lower back rounds: lumbar flexion, pelvis tucks under, torso leans over more
  const r = frame(bottom.pose, { ...wrongBase, pitch: 52, extra: { spine: [24, 0, 0], chest: [8, 0, 0] } }); wrong.back = jp(r.pose); if (r.err > 0.012) console.warn('back wrong err', r.err);
}

return { total, bottom, kfs, wrong };
}
const G0 = goblet(SEGS), G1 = goblet(SEGS_TEMPO);
const KB = { type: 'kettlebell', attach: 'chest', offset: BELL, heldBy: ['wrist_L', 'wrist_R'] };
const out = {
  0: { duration: G0.total, keyT: round(G0.bottom.t, 2), contacts: ['heel_L', 'heel_R', 'toe_L', 'toe_R'], props: [KB], keyframes: G0.kfs, wrong: G0.wrong },
  1: { duration: G1.total, keyT: round(G1.bottom.t, 2), contacts: ['heel_L', 'heel_R', 'toe_L', 'toe_R'], props: [KB], keyframes: G1.kfs, wrong: G1.wrong },
};
/* ---------- levels 2-5: single-leg family. Figure faces +z; the LEFT leg is the working (front / standing) leg. ---------- */
const lim = (o) => o;
function frameG(warm, o) {
  const pose = clonePose(warm);
  pose.root.pos[1] = o.rootY; pose.root.pos[2] = o.rootZ; pose.root.rot[0] = o.pitch;
  pose.joints.neck = [-0.35 * o.pitch, 0, 0]; pose.joints.head = [-0.2 * o.pitch, 0, 0];
  for (const [k, v] of Object.entries(o.extra || {})) pose.joints[k] = [...v];
  for (const S of ['L', 'R']) { const k = pose.joints['knee_' + S] || [0, 0, 0]; if (k[0] < 8) k[0] = 8; pose.joints['knee_' + S] = k; }
  const free = ['root.pos.0', ...(o.zFree ? ['root.pos.2'] : []), 'root.rot.1', 'root.rot.2', ...(o.freeRoot || [])];
  for (const S of ['L', 'R']) {
    free.push(one('hip', S, 0, { min: -25, max: 140 }), one('hip', S, 1, { min: -30, max: 40 }), one('hip', S, 2, { min: -10, max: 30 }), one('knee', S, 0, { min: 0, max: 150 }),
      one('ankle', S, 0, { min: -50, max: 42 }), one('ankle', S, 1, { min: -25, max: 40 }), one('ankle', S, 2, { min: -15, max: 15 }));
  }
  free.push(one('toe', 'R', 0, { min: +(process.env.TMIN || -80), max: 10 }));
  const priors = [{ path: 'root.rot.1', value: 0, w: 0.5 }, { path: 'root.rot.2', value: 0, w: 0.5 }, { path: 'root.pos.0', value: o.rootX ?? 0, w: o.rootXw ?? 0.3 }, { path: 'root.pos.2', value: o.rootZ, w: o.rootZw ?? 0.05 },
    { path: 'joints.hip_L.1', value: 0, w: 0.03 }, { path: 'joints.hip_L.2', value: 0, w: 0.03 }, { path: 'joints.hip_R.1', value: 0, w: 0.03 }, { path: 'joints.hip_R.2', value: 0, w: 0.03 },
    { path: 'joints.ankle_L.2', value: 0, w: 0.03 }, { path: 'joints.ankle_R.2', value: 0, w: 0.03 }, ...(o.priors || [])];
  let R = solve(pose, { free, targets: o.targets, priors, iters: 300 });
  for (const guess of o.guesses || []) { if (R.err < 0.003) break; const p2 = clonePose(pose); Object.assign(p2.joints, JSON.parse(JSON.stringify(guess))); const R2 = solve(p2, { free, targets: o.targets, priors, iters: 300 }); if (R2.err < R.err) R = R2; }
  if (process.env.DBG && R.err > 0.01) console.log(R.misses.filter((m) => !/ -?0\.[0-4]cm/.test(m)).join(' '));
  return R;
}
const footFlat = (S, x, z, y, yaw = 0) => { // flat foot at height y, toes turned out by yaw degrees, ball of foot (toe joint) at z
  const sx = S === 'L' ? 1 : -1, s = Math.sin(rad(yaw)) * sx, c = Math.cos(rad(yaw));
  return [{ p: `toe_${S}`, x: sx * x, y, z }, { p: `toetip_${S}`, y, x: sx * x + 0.07 * s * 1, z: z + 0.07 * c }, { p: `heel_${S}`, y, x: sx * x - 0.20 * s, z: z - 0.20 * c }];
};
const mkKf = (frames, total) => { const k = frames.map((f) => keyframe(f.t, f.pose)); k.push({ ...k[0], t: total }); return k; };
const jpose = (p) => ({ root: { pos: p.root.pos.map((v) => round(v)), rot: p.root.rot.map((v) => round(v, 2)) }, joints: keyframe(0, p).joints });
function runLoop(segs, build, warm0) {
  const { total, at } = phaseFn(segs), n = Math.round(total / DT), frames = []; let warm = warm0, worst = 0;
  for (let k = 0; k < 4; k++) warm = frameG(warm, build(1)).pose; // settle at the bottom first (good starting guess)
  for (let i = 0; i < n; i++) { const t = i * DT, s = at(t), r = frameG(warm, build(s)); warm = r.pose; worst = Math.max(worst, r.err); frames.push({ t, s, pose: r.pose, err: r.err }); }
  return { total, frames, worst, bottom: frames.reduce((a, f) => (f.s > a.s ? f : a)) };
}
const DEG = 180 / Math.PI;
const tilt = (a, b) => Math.atan2(Math.hypot(a[0] - b[0], a[2] - b[2]), a[1] - b[1]) * DEG; // angle of vector b->a... from vertical
const metrics = (pose, front = 'L', back = 'R') => {
  const q = fk(pose), O = (k) => q[k + '_' + front], B = (k) => q[k + '_' + back];
  return {
    rootY: +pose.root.pos[1].toFixed(3), shinLean: +tilt(O('knee'), O('ankle')).toFixed(0), kneeFlex: +flexionDeg(pose, 'knee_' + front).toFixed(0), hipFlex: +flexionDeg(pose, 'hip_' + front).toFixed(0), ankleDF: +flexionDeg(pose, 'ankle_' + front).toFixed(0),
    kneePastToetip: +((O('knee')[2] - O('toetip')[2]) * 100).toFixed(1), kneeXoffToe: +((O('knee')[0] - O('toe')[0]) * 100 * (front === 'L' ? 1 : -1)).toFixed(1),
    backKneeY: +B('knee')[1].toFixed(3), backKneeFlex: +flexionDeg(pose, 'knee_' + back).toFixed(0), backHip: +flexionDeg(pose, 'hip_' + back).toFixed(0), backHeelY: +B('heel')[1].toFixed(3), backToeBend: +flexionDeg(pose, 'toe_' + back).toFixed(0),
    torsoLean: +tilt(q.neck, q.root).toFixed(0), headTopZ: +q.head_top[2].toFixed(2),
  };
};
const showM = (name, fr) => { if (REPORT) { console.log(name, 'max back toe ext', Math.min(...fr.frames.map((f) => flexionDeg(f.pose, 'toe_R'))).toFixed(0), 'max back heel', Math.max(...fr.frames.map((f) => fk(f.pose).heel_R[1])).toFixed(3)); const top = fr.frames[0], bot = fr.bottom; console.log(name, 'worst', fr.worst.toFixed(4), '\n top', JSON.stringify(metrics(top.pose)), '\n bot', JSON.stringify(metrics(bot.pose))); } };

// ---- split squat (levels 2 and 3) ----
const KNEE_HOVER = 0.04;                      // back knee hovers about 4 cm above the floor at the bottom (it nearly touches, never rests)
const ZF = +(process.env.ZF || 0.25), SX = 0.10; let ZB = -0.54;
function splitSquat(elev, bottomRootY, pitchB, topY, rzt, rzb) {
  const arm = stand();
  const warm0 = clonePose(arm); warm0.root.pos = [0, 0.88, -0.22]; Object.assign(warm0.joints, { hip_L: [85, 0, 0], knee_L: [95, 0, 0], ankle_L: [15, 0, 0], hip_R: [5, 0, 0], knee_R: [100, 0, 0], ankle_R: [28, 0, 0], toe_R: [-70, 0, 0] });
  const tgt = (extraF = {}) => [...footFlat('L', SX, ZF, elev), { p: 'toe_R', x: -SX, y: 0, z: ZB }, { p: 'toetip_R', y: 0, x: -SX, z: ZB + 0.068 }, { p: 'knee_L', x: SX, w: 0.5 }, { p: 'knee_R', x: -SX, w: 0.3 }];
  const build = (s) => ({ guesses: [{ hip_R: [5, 0, 0], knee_R: [100, 0, 0], ankle_R: [28, 0, 0], toe_R: [-65, 0, 0] }, { hip_R: [-10, 0, 0], knee_R: [60, 0, 0], ankle_R: [30, 0, 0], toe_R: [-80, 0, 0] }], priors: [{ path: 'joints.hip_R.0', value: 3, w: 0.05 }], rootY: lerp(topY, bottomRootY, s), rootZ: lerp(rzt, rzb, s), pitch: lerp(1, pitchB, s), targets: [...tgt(), { p: 'knee_R', y: KNEE_HOVER, w: 0.8 * s * s }] });
  const fr = runLoop([[2, 0, 1], [0.5, 1, 1], [1.5, 1, 0], [0.5, 0, 0]], build, warm0);
  const base = { rootZ: -0.06, rootY: bottomRootY, pitch: pitchB, targets: tgt() };
  const wrong = {};
  { const r = frameG(fr.bottom.pose, { ...base, targets: [...footFlat('L', SX, ZF, elev), { p: 'toe_R', x: -SX, y: 0, z: ZB }, { p: 'toetip_R', y: 0, x: -SX, z: ZB + 0.068 }, { p: 'knee_L', x: 0.0, w: 0.5 }, { p: 'knee_R', x: -SX, w: 0.3 }] }); wrong.knees = jpose(r.pose); if (r.err > 0.02) console.warn('split knees wrong err', r.err); }
  { const r = frameG(fr.bottom.pose, { ...base, pitch: 50, extra: { spine: [22, 0, 0], chest: [8, 0, 0] }, rootZ: 0.08 }); wrong.lean = jpose(r.pose); if (r.err > 0.02) console.warn('split lean wrong err', r.err); }
  { // front heel lifts and the knee shoots well past the toes (stance too short, weight on the toes)
    const tg = [{ p: 'toe_L', x: SX, y: elev, z: ZF }, { p: 'toetip_L', y: elev, x: SX }, { p: 'heel_L', y: elev + 0.05, x: SX }, { p: 'toe_R', x: -SX, y: 0, z: ZB }, { p: 'toetip_R', y: 0, x: -SX, z: ZB + 0.068 }, { p: 'knee_L', x: SX, w: 0.5 }, { p: 'knee_R', x: -SX, w: 0.3 }];
    const r = frameG(fr.bottom.pose, { ...base, rootZ: 0.10, pitch: pitchB + 6, targets: tg }); wrong.heel = jpose(r.pose); if (r.err > 0.02) console.warn('split heel wrong err', r.err); }
  return { ...fr, wrong };
}
const SS2 = splitSquat(0, +(process.env.RB2 || 0.50), 6, 0.87, +(process.env.RZT2 || -0.25), -0.18);
showM('level2', SS2);
ZB = +(process.env.ZB3 || -0.58);
const SS3 = splitSquat(0.10, +(process.env.RB3 || 0.50), 6, +(process.env.TY3 || 0.95), +(process.env.RZT3 || -0.26), +(process.env.RZB3 || -0.18));
showM('level3', SS3);
const BOOKS = { type: 'books', pos: [SX, 0, ZF - 0.07], size: [0.22, 0.10, 0.32], rotY: 0 };
const CUSHION = null;
const TOE_BACK = 'If your back toe complains, shorten the stance or put a folded towel under the back knee or foot.';
out[2] = { duration: SS2.total, keyT: round(SS2.bottom.t, 2), contacts: ['heel_L', 'toe_L', 'toetip_L', 'toe_R', 'toetip_R'], props: [KB], keyframes: mkKf(SS2.frames, SS2.total), wrong: SS2.wrong };
out[3] = { duration: SS3.total, keyT: round(SS3.bottom.t, 2), contacts: ['heel_L', 'toe_L', 'toetip_L', 'toe_R', 'toetip_R'], support: { heel_L: 0.10, toe_L: 0.10, toetip_L: 0.10 }, props: [KB, BOOKS], keyframes: mkKf(SS3.frames, SS3.total), wrong: SS3.wrong };


// ---- single-leg levels: skater squat (4) and pistol squat to box (5). The LEFT leg stands, the RIGHT leg is free. ----
const FX = 0.04;                                   // standing foot, 4 cm left of the midline; the pelvis shifts over it
const armsFwd = (pitch) => { const a = [85 - pitch, 0, 6], e = [8, 0, 0]; return { shoulder_L: a, shoulder_R: a, elbow_L: e, elbow_R: e }; };
function singleLeg(o) {
  const warm0 = newPose(); warm0.root.pos = [FX, 0.9, -0.2];
  Object.assign(warm0.joints, { hip_L: [30, 0, 0], knee_L: [50, 0, 0], ankle_L: [15, 0, 0], hip_R: [20, 0, 0], knee_R: [60, 0, 0] });
  const support = (elev = 0, heelUp = 0) => [{ p: 'toe_L', x: FX, y: 0, z: 0 }, { p: 'toetip_L', y: 0, x: FX }, { p: 'heel_L', y: heelUp, x: FX, z: -0.20 }];
  const spec = (s, over = {}) => {
    const pitch = lerp(o.pitchT, o.pitchB, s), kx = over.kneeX ?? FX;
    return {
      rootY: lerp(o.topY, o.rootYB, s), rootZ: lerp(-0.2, -0.3, s), zFree: true, rootX: FX, rootXw: 0.4, pitch, extra: { ...armsFwd(pitch), ...(over.extra || {}) },
      targets: [...support(0, over.heelY || 0), { p: 'knee_L', x: kx, w: 0.5 }, { p: 'knee_L', z: over.kneeZ ?? lerp(-0.04, o.kneeZB, s), w: 0.4 * Math.min(1, s * 2) }, ...o.free(s)],
      priors: [{ path: 'joints.knee_R.0', value: o.kneeR, w: 0.1 }, { path: 'joints.ankle_R.0', value: 12, w: 0.05 }, { path: 'joints.toe_R.0', value: 0, w: 0.05 }, { path: 'joints.hip_R.0', value: o.hipR ?? 0, w: 0.02 }, { path: 'root.pos.2', value: -0.25, w: 0.01 }],
      guesses: [{ hip_L: [90, 0, 0], knee_L: [105, 0, 0], ankle_L: [20, 0, 0], hip_R: [o.hipRg, 0, 0], knee_R: [o.kneeR, 0, 0] }],
      ...(over.o || {}),
    };
  };
  const fr = runLoop(o.segs, (s) => spec(s), warm0);
  const bs = (over) => { const r = frameG(fr.bottom.pose, { ...spec(1, over) }); return jpose(r.pose); };
  const wrong = {
    knees: bs({ kneeX: -0.03 }),
    heel: bs({ heelY: 0.05 }),
    back: bs({ extra: { spine: [24, 0, 0], chest: [8, 0, 0] }, o: { pitch: o.pitchB + 18 } }),
  };
  return { ...fr, wrong };
}
const mSL = (pose) => { const q = fk(pose); return { rootY: +pose.root.pos[1].toFixed(3), rootX: +pose.root.pos[0].toFixed(3), shinLean: +tilt(q.knee_L, q.ankle_L).toFixed(0), kneeFlex: +flexionDeg(pose, 'knee_L').toFixed(0), hipFlex: +flexionDeg(pose, 'hip_L').toFixed(0), ankleDF: +flexionDeg(pose, 'ankle_L').toFixed(0), kneePastToetip: +((q.knee_L[2] - q.toetip_L[2]) * 100).toFixed(1), kneeXoff: +((q.knee_L[0] - q.toe_L[0]) * 100).toFixed(1), torsoLean: +tilt(q.neck, q.root).toFixed(0), freeKnee: q.knee_R.map((v) => +v.toFixed(2)), freeAnkle: q.ankle_R.map((v) => +v.toFixed(2)), freeToeY: +Math.min(q.toe_R[1], q.toetip_R[1], q.heel_R[1]).toFixed(3), freeKneeFlex: +flexionDeg(pose, 'knee_R').toFixed(0), headTopZ: q.head_top[2].toFixed(2) }; };
const showSL = (name, fr) => { if (REPORT) console.log(name, 'worst', fr.worst.toFixed(4), '\n top', JSON.stringify(mSL(fr.frames[0].pose)), '\n bot', JSON.stringify(mSL(fr.bottom.pose)), '\n minY', Math.min(...fr.frames.flatMap((f) => Object.entries(fk(f.pose)).filter(([n]) => /_R$|_R$/.test(n)).map(([, v]) => v[1]))).toFixed(3)); };
const SEGS_SL = [[2, 0, 1], [0.5, 1, 1], [2, 1, 0], [0.5, 0, 0]];

// level 4: skater squat. Rear knee lowers to a cushion 6 cm high; torso leans to counterbalance; arms reach forward.
const SK = singleLeg({ segs: SEGS_SL, topY: 0.95, rootYB: +(process.env.SKY || 0.54), pitchT: 2, pitchB: +(process.env.SKP || 38), kneeZB: 0.0, kneeR: 100, hipRg: -5,
  free: (s) => [{ p: 'knee_R', y: lerp(0.45, 0.10, s), w: 0.6 }, { p: 'knee_R', x: lerp(-0.05, -0.04, s), w: 0.4 }] });
showSL('level4', SK);
const skKnee = fk(SK.bottom.pose).knee_R;
const CUSHION_P = { type: 'box', pos: [round(skKnee[0]), 0, round(skKnee[2])], size: [0.30, 0.06, 0.30], rotY: 0 };
out[4] = { duration: SK.total, keyT: round(SK.bottom.t, 2), contacts: ['heel_L', 'toe_L', 'toetip_L'], props: [CUSHION_P], keyframes: mkKf(SK.frames, SK.total), wrong: SK.wrong };

// level 5: pistol squat to a box. Free leg stays straight and off the floor; hips sit back until they lightly touch the box.
const BOXH = 0.42;
const PI5 = singleLeg({ segs: [[2.5, 0, 1], [0.5, 1, 1], [1.5, 1, 0], [0.5, 0, 0]], topY: 0.95, rootYB: +(process.env.PY || 0.54), pitchT: 2, pitchB: +(process.env.PP || 36), kneeZB: 0.0, kneeR: 8, hipRg: 70,
  free: (s) => [{ p: 'ankle_R', y: lerp(0.30, 0.50, s), w: 1 }, { p: 'ankle_R', x: -0.06, w: 0.5 }] });
showSL('level5', PI5);
const pb = PI5.bottom.pose;
const BOX_P = { type: 'box', pos: [round(pb.root.pos[0]), 0, round(pb.root.pos[2] - 0.10)], size: [0.40, BOXH, 0.36], rotY: 0 };
out[5] = { duration: PI5.total, keyT: round(PI5.bottom.t, 2), contacts: ['heel_L', 'toe_L', 'toetip_L'], props: [BOX_P], keyframes: mkKf(PI5.frames, PI5.total), wrong: PI5.wrong };

writeFileSync(new URL('../js/form/poses/squat.gen.js', import.meta.url), `// GENERATED by tools/author-squat.mjs. Do not edit by hand; edit the author script and re-run it.\nexport default ${JSON.stringify(out)};\n`);
console.log('wrote squat.gen.js');
