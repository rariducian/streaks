// Generates js/form/poses/core.gen.js (all five core levels). Run: node tools/author-core.mjs [--report]
//   0 dead bug  1 hollow hold  2 KB suitcase carry  3 hollow rocks  4 tuck L-sit between two chairs
import { writeFileSync } from 'node:fs';
import { solve, newPose, both, one, clonePose, keyframe, phaseFn, round } from './solve.mjs';
import { fk, flexionDeg, vsub, vangle } from '../js/form/skeleton.js';

const REPORT = process.argv.includes('--report');
const lerp = (a, b, s) => a + (b - a) * s;
const jp = (p) => ({ root: { pos: p.root.pos.map((v) => round(v)), rot: p.root.rot.map((v) => round(v, 2)) }, joints: keyframe(0, p).joints });
const setJ = (p, k, v) => { p.joints[k] = [...v]; return p; };
const loopKfs = (frames, total) => { const k = frames.map((f) => keyframe(f.t, f.pose)); k.push({ ...k[0], t: total }); return k; };
const out = {};

/* ---------- supine base: back on the floor, head toward -z, face up ---------- */
const BACK_Y = 0.11;      // pelvis and chest centres rest this high (ellipsoid half-thickness)
const supine = () => { const p = newPose(); p.root.pos = [0, BACK_Y, 0]; p.root.rot = [-90, 0, 0]; return p; };
const heights = (p) => { const f = fk(p); return { heel: Math.min(f.heel_L[1], f.heel_R[1]).toFixed(2), palm: Math.min(f.palm_L[1], f.palm_R[1]).toFixed(2), chest: f.chest[1].toFixed(2), head: f.head[1].toFixed(2) }; };

/* ================= 0. DEAD BUG ================= */
{
  const A_UP = 90, A_OUT = 170, H_UP = 90, K_UP = 90, H_OUT = 8, K_OUT = 8; // arm flex, hip flex, knee flex
  const seg = phaseFn([[2, 0, 1], [0.5, 1, 1], [2, 1, 0], [0.5, 0, 0]]);
  const side = 5, total = 10, DT = 0.25;
  const pose = (sa, sb) => { // sa: right arm + left leg; sb: left arm + right leg
    const p = supine();
    for (const [arm, leg, s] of [['R', 'L', sa], ['L', 'R', sb]]) {
      setJ(p, 'shoulder_' + arm, [lerp(A_UP, A_OUT, s), 0, 0]);
      setJ(p, 'hip_' + leg, [lerp(H_UP, H_OUT, s), 0, 0]); setJ(p, 'knee_' + leg, [lerp(K_UP, K_OUT, s), 0, 0]);
      setJ(p, 'ankle_' + leg, [lerp(0, -10, s), 0, 0]);
    }
    for (const a of ['L', 'R']) { const o = a === 'L' ? 'R' : 'L'; if (!p.joints['hip_' + a]) p.joints['hip_' + a] = [H_UP, 0, 0]; }
    return p;
  };
  const frames = []; for (let i = 0; i < total / DT; i++) { const t = i * DT; frames.push({ t, pose: pose(t < side ? seg.at(t) : 0, t >= side ? seg.at(t - side) : 0) }); }
  const top = pose(1, 0);
  const wrong = {
    // lower back arches: pelvis tips, ribs flare, the extended leg drops too low
    back: (() => { const p = pose(1, 0); p.root.rot = [-70, 0, 0]; p.root.pos = [0, 0.13, 0]; setJ(p, 'spine', [-14, 0, 0]); setJ(p, 'chest', [-6, 0, 0]); setJ(p, 'hip_L', [22, 0, 0]); setJ(p, 'knee_L', [4, 0, 0]); return jp(p); })(),
  };
  out[0] = { duration: total, keyT: 2, contacts: ['root', 'chest'], support: { root: BACK_Y, chest: BACK_Y }, props: [], keyframes: loopKfs(frames, total), wrong };
  if (REPORT) console.log('deadbug extended', heights(top), 'wrong', heights(pose(1, 0)));
}

/* ================= 1. HOLLOW HOLD ================= */
const hollow = (o = {}) => { // o: hip, spine, chest, neck, arm
  const p = supine();
  const h = o.hip ?? 18, sp = o.spine ?? 10, ch = o.chest ?? 12;
  setJ(p, 'spine', [sp, 0, 0]); setJ(p, 'chest', [ch, 0, 0]); setJ(p, 'neck', [o.neck ?? 6, 0, 0]); setJ(p, 'head', [o.head ?? 0, 0, 0]);
  for (const s of ['L', 'R']) {
    setJ(p, 'hip_' + s, [h, 0, 0]); setJ(p, 'knee_' + s, [o.knee ?? 0, 0, 0]); setJ(p, 'ankle_' + s, [-12, 0, 0]);
    setJ(p, 'shoulder_' + s, [o.arm ?? 195, 0, 0]);
  }
  return p;
};
{
  const total = 6, N = 12; // one calm breath: 3 s in, 3 s out. The hold itself does not move.
  const frames = [];
  for (let i = 0; i < N; i++) { const b = Math.sin((2 * Math.PI * i) / N); frames.push({ t: (i * total) / N, pose: hollow({ chest: 12 + 1.5 * b, spine: 10 + 1 * b, hip: 18 + 1.5 * b }) }); }
  const wrong = {
    // lower back arches off the floor: legs dropped low, shoulders drop back, belly pushes out
    arch: (() => { const p = hollow({ hip: 20, spine: -6, chest: 8, neck: 4, arm: 180 }); p.root.rot = [-72, 0, 0]; p.root.pos = [0, 0.13, 0]; return jp(p); })(),
    // neck cranes: chin jammed forward, shoulders curled with the head leading
    neck: jp(hollow({ neck: 38, head: 6, chest: 20, spine: 14 })),
  };
  out[1] = { duration: total, keyT: 0, contacts: ['root'], support: { root: BACK_Y }, props: [], keyframes: loopKfs(frames, total), wrong };
  if (REPORT) console.log('hollow hold', heights(hollow()), 'wrong arch', heights(hollow({ hip: 12, spine: -6, chest: 8 })));
}

/* ================= 3. HOLLOW ROCKS ================= */
{
  const total = 4, N = 16, AMP = 9; // rock back 2 s, rock forward 2 s; the whole shape turns as one piece about the sacrum
  const frames = [];
  for (let i = 0; i < N; i++) { const t = (i * total) / N, ph = Math.cos((2 * Math.PI * t) / total); /* +1 forward, -1 back */ const p = hollow({ hip: 16 }); p.root.rot = [-90 + AMP * ph - 1, 0, 0]; p.root.pos = [0, BACK_Y, 0]; frames.push({ t, pose: p }); }
  const wrong = {
    // hinges at the hips: legs fold up and the shape opens into a V
    hinge: (() => { const p = hollow({ hip: 55 }); p.root.rot = [-90 + 6, 0, 0]; return jp(p); })(),
    // loses the hollow: back arches and legs drop
    arch: (() => { const p = hollow({ hip: 20, spine: -6, chest: 6, neck: 4, arm: 180 }); p.root.rot = [-72, 0, 0]; p.root.pos = [0, 0.13, 0]; return jp(p); })(),
  };
  out[3] = { duration: total, keyT: 0, contacts: ['root'], support: { root: BACK_Y }, props: [], keyframes: loopKfs(frames, total), wrong };
  if (REPORT) { const lo = frames.reduce((a, f) => (f.pose.root.rot[0] < a.pose.root.rot[0] ? f : a)), hi = frames.reduce((a, f) => (f.pose.root.rot[0] > a.pose.root.rot[0] ? f : a)); console.log('rock back', heights(lo.pose), 'rock fwd', heights(hi.pose)); }
}

/* ================= 2. KB SUITCASE CARRY ================= */
// The harness only supports contacts that stay planted for the whole loop, so the carry is shown as the stance with a
// hand switch halfway: feet stay planted, the bell hangs by the side, then it passes to the other hand. The bell
// prop is shown on one wrist per half of the loop (prop.show window; see viewer.js).
{
  const total = 12, N = 24, HALF = 6;
  const base = () => { const p = newPose(); p.root.pos = [0, 0.957, 0]; return p; };
  const armsDown = (p, loaded) => { for (const s of ['L', 'R']) setJ(p, 'shoulder_' + s, [0, 0, s === loaded ? 4 : 7]); };
  const front = (p) => { for (const s of ['L', 'R']) { setJ(p, 'shoulder_' + s, [6, 0, -8]); setJ(p, 'elbow_' + s, [88, 0, 0]); setJ(p, 'wrist_' + s, [10, 0, 0]); } };
  const arms = (t) => { // raise hands to the front at t=0 and t=HALF, lower to the sides in between
    const u = t % HALF, k = u < 1 ? 1 - u : u > HALF - 1 ? u - (HALF - 1) : 0, s = 0.5 - 0.5 * Math.cos(Math.PI * k);
    const loaded = t < HALF ? 'R' : 'L', p = base();
    for (const S of ['L', 'R']) { setJ(p, 'shoulder_' + S, [lerp(0, 6, s), 0, lerp(S === loaded ? 4 : 7, -8, s)]); setJ(p, 'elbow_' + S, [lerp(2, 88, s), 0, 0]); setJ(p, 'wrist_' + S, [lerp(0, 10, s), 0, 0]); }
    const b = Math.sin((2 * Math.PI * t) / 3) * (1 - s); // slow breath, 3 s
    setJ(p, 'chest', [0.8 * b, 0, 0]);
    return p;
  };
  const frames = []; for (let i = 0; i < N; i++) { const t = (i * total) / N; frames.push({ t, pose: arms(t) }); }
  const wrong = {
    // leans away from... toward the bell: top of the body bends to the loaded (right) side, shoulder drops
    lean: (() => { const p = arms(3); setJ(p, 'spine', [0, 0, 6]); setJ(p, 'chest', [0, 0, 9]); setJ(p, 'neck', [0, 0, -4]); p.root.rot = [0, 0, 2]; setJ(p, 'hip_R', [0, 0, -3]); return jp(p); })(),
    // slumps: rounded upper back, head forward, bell hanging forward of the hip
    slump: (() => { const p = arms(3); setJ(p, 'spine', [8, 0, 0]); setJ(p, 'chest', [18, 0, 0]); setJ(p, 'neck', [14, 0, 0]); setJ(p, 'shoulder_R', [14, 0, 6]); return jp(p); })(),
  };
  const bell = (side, show) => ({ type: 'kettlebell', attach: 'wrist_' + side, offset: [0, -0.14, 0], heldBy: ['wrist_' + side], show });
  out[2] = { duration: total, keyT: 3, contacts: ['heel_L', 'heel_R', 'toe_L', 'toe_R'], props: [bell('R', [0, HALF]), bell('L', [HALF, total])], keyframes: loopKfs(frames, total), wrong };
  if (REPORT) { const f = fk(arms(0)); console.log('switch pose palms', f.palm_L.map((v) => v.toFixed(2)), f.palm_R.map((v) => v.toFixed(2)), 'hang palm_R', fk(arms(3)).palm_R.map((v) => v.toFixed(2))); }
}

/* ================= 4. TUCK L-SIT BETWEEN TWO CHAIRS ================= */
{
  const SEAT = 0.45, PX = 0.22, total = 6, N = 12;
  // locked arms: shoulders stay directly over the hands, so the shoulders are pushed away from the ears
  const base = (() => {
    const p = newPose(); p.root.pos = [0, 0.57, 0];
    for (const s of ['L', 'R']) { setJ(p, 'wrist_' + s, [80, 0, 0]); setJ(p, 'hip_' + s, [115, 0, 0]); setJ(p, 'knee_' + s, [130, 0, 0]); setJ(p, 'ankle_' + s, [-15, 0, 0]); }
    const free = ['root.pos.1', 'root.pos.2', both('shoulder', 0), both('shoulder', 1), both('shoulder', 2), both('wrist', 0, { min: 0, max: 110 }), both('elbow', 0, { min: 0, max: 0 })];
    const T = [];
    for (const [S, sx] of [['L', 1], ['R', -1]]) T.push({ p: `palm_${S}`, x: sx * PX, y: SEAT }, { p: `wrist_${S}`, y: SEAT }, { p: `wrist_${S}`, rel: `shoulder_${S}`, z: 0.0, w: 0.5 }, { p: `palm_${S}`, z: 0.0, w: 0.3 });
    return solve(p, { free, targets: T, priors: [{ path: 'joints.shoulder_L.1', value: 0, w: 0.02 }, { path: 'joints.shoulder_L.2', value: 0, w: 0.02 }] });
  })();
  if (base.err > 0.005) console.warn('L-sit arms err', base.err, base.misses);
  const frames = [];
  for (let i = 0; i < N; i++) {
    const b = Math.sin((2 * Math.PI * i) / N), p = clonePose(base.pose); // calm breath: knees rise a touch on the breath out
    for (const s of ['L', 'R']) { setJ(p, 'hip_' + s, [115 + 3 * b, 0, 0]); setJ(p, 'knee_' + s, [130 + 3 * b, 0, 0]); }
    frames.push({ t: (i * total) / N, pose: p });
  }
  const wrong = {};
  { // sinks into the shoulders: elbows bend, hips drop, shoulders ride up
    const p = clonePose(base.pose); p.root.pos[1] = 0.5;
    const free = ['root.pos.2', both('shoulder', 0), both('shoulder', 1), both('shoulder', 2), both('wrist', 0, { min: 0, max: 110 }), both('elbow', 0, { min: 25, max: 60 })];
    const T = []; for (const [S, sx] of [['L', 1], ['R', -1]]) T.push({ p: `palm_${S}`, x: sx * PX, y: SEAT }, { p: `wrist_${S}`, y: SEAT }, { p: `palm_${S}`, z: fk(base.pose)[`palm_${S}`][2] });
    const r = solve(p, { free, targets: T, priors: [{ path: 'joints.shoulder_L.2', value: 0, w: 0.02 }] });
    if (r.err > 0.012) console.warn('sink wrong err', r.err, r.misses);
    wrong.sink = jp(r.pose);
  }
  { // knees drop: feet come back toward the floor
    const p = clonePose(base.pose); for (const s of ['L', 'R']) { setJ(p, 'hip_' + s, [88, 0, 0]); setJ(p, 'knee_' + s, [75, 0, 0]); } wrong.drop = jp(p);
  }
  const chair = (sx) => ({ type: 'chair', pos: [round(sx * 0.38), 0, 0], rotY: sx > 0 ? -90 : 90, seat: SEAT });
  out[4] = { duration: total, keyT: 1.5, contacts: ['palm_L', 'palm_R'], support: { palm_L: SEAT, palm_R: SEAT }, props: [chair(1), chair(-1)], keyframes: loopKfs(frames, total), wrong };
  if (REPORT) { const f = fk(base.pose); console.log('L-sit root', base.pose.root.pos.map((v) => v.toFixed(3)), 'shoulder', JSON.stringify(base.pose.joints.shoulder_L), 'wrist', base.pose.joints.wrist_L, 'ankle y', f.ankle_L[1].toFixed(2), 'knee y', f.knee_L[1].toFixed(2), 'toe y', f.toetip_L[1].toFixed(2), 'elbow', flexionDeg(base.pose, 'elbow_L'), 'shoulderY', f.shoulder_L[1].toFixed(2)); }
}

writeFileSync(new URL('../js/form/poses/core.gen.js', import.meta.url), `// GENERATED by tools/author-core.mjs. Do not edit by hand; edit the author script and re-run it.\nexport default ${JSON.stringify(out)};\n`);
console.log('wrote core.gen.js');
