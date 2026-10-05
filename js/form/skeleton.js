// Pure skeleton data and forward kinematics for the form viewer. No DOM, no three.js.
//
// WORLD FRAME (metres): y up, the floor is y = 0, a standing figure faces +z, figure's LEFT is +x.
// Rest pose: standing, arms hanging, feet flat, every angle 0, root at (0, STAND_Y, 0).
//
// POSE OBJECT:
//   { root: { pos: [x,y,z], rot: [rx,ry,rz] }, joints: { [name]: [rx,ry,rz] } }       angles in DEGREES
//   (the sampler also emits { q: [x,y,z,w] } instead of an angle array; fk() accepts both.)
//   Missing joints are 0.
//
// ROTATION ORDER: each rotation is applied X first, then Y, then Z, each about the PARENT's axes (q = Rz*Ry*Rx).
//
// root.rot is RAW (no sign changes): +rx pitches the body forward (head toward +z, lying prone face-down at +90),
//   +ry yaws toward the figure's left (+x), +rz tilts the head toward the figure's right (-x). Because Z is applied last
//   about the world z axis, a prone body (rx ~ 90, long axis = world z) rolls about its long axis with rz.
//
// JOINT ANGLES ARE ANATOMICAL, same numbers for left and right (mirrored for you):
//   rx  flexion is POSITIVE, extension negative.
//       hip/shoulder: limb swings forward.  elbow: forearm swings forward.  wrist: hand swings forward.
//       knee: shank swings BACK (heel to bottom).  ankle: dorsiflexion (+, toes up) / plantarflexion (-).
//       toe: curl down (+), extension (-).  spine/chest/neck/head: bend forward (+).
//   ry  swing about the vertical axis: for a limb pointing forward, + moves it OUTWARD (away from the midline);
//       for a hanging limb it is outward axial rotation.  spine/chest/neck/head: + turns toward the figure's left.
//   rz  hip/shoulder/elbow/wrist/ankle/knee/toe: + = ABDUCTION (limb swings outward in the frontal plane).
//       spine/chest/neck/head: + bends the top toward the figure's RIGHT (-x).
//
// END SITES (no rotation, positions only): palm_L/R, heel_L/R, toetip_L/R, head_top.
// Joint points sit on the skin surface at the hand and foot, so a planted contact has y = 0 on the floor.

export const STAND_Y = 0.96;
export const JOINT_NAMES = [
  'root', 'spine', 'chest', 'neck', 'head',
  'shoulder_L', 'elbow_L', 'wrist_L', 'shoulder_R', 'elbow_R', 'wrist_R',
  'hip_L', 'knee_L', 'ankle_L', 'toe_L', 'hip_R', 'knee_R', 'ankle_R', 'toe_R',
];
export const END_SITES = ['palm_L', 'palm_R', 'heel_L', 'heel_R', 'toetip_L', 'toetip_R', 'head_top'];

const mx = (v) => [-v[0], v[1], v[2]];
// [name, parent, rest offset from parent in parent frame, metres]
const TREE = [
  ['root', null, [0, 0, 0]],
  ['spine', 'root', [0, 0.10, 0]],
  ['chest', 'spine', [0, 0.22, 0]],
  ['neck', 'chest', [0, 0.22, 0]],
  ['head', 'neck', [0, 0.10, 0]],
  ['shoulder_L', 'chest', [0.19, 0.15, 0]], ['elbow_L', 'shoulder_L', [0, -0.33, 0]], ['wrist_L', 'elbow_L', [0, -0.26, 0]],
  ['shoulder_R', 'chest', mx([0.19, 0.15, 0])], ['elbow_R', 'shoulder_R', [0, -0.33, 0]], ['wrist_R', 'elbow_R', [0, -0.26, 0]],
  ['hip_L', 'root', [0.09, -0.03, 0]], ['knee_L', 'hip_L', [0, -0.43, 0]], ['ankle_L', 'knee_L', [0, -0.43, 0]], ['toe_L', 'ankle_L', [0, -0.07, 0.15]],
  ['hip_R', 'root', mx([0.09, -0.03, 0])], ['knee_R', 'hip_R', [0, -0.43, 0]], ['ankle_R', 'knee_R', [0, -0.43, 0]], ['toe_R', 'ankle_R', [0, -0.07, 0.15]],
  // end sites
  ['palm_L', 'wrist_L', [0, -0.07, 0]], ['palm_R', 'wrist_R', [0, -0.07, 0]],
  ['heel_L', 'ankle_L', [0, -0.07, -0.05]], ['heel_R', 'ankle_R', [0, -0.07, -0.05]],
  ['toetip_L', 'toe_L', [0, 0, 0.07]], ['toetip_R', 'toe_R', [0, 0, 0.07]],
  ['head_top', 'head', [0, 0.15, 0.01]],
];
export const TREE_DEF = TREE;
export const BONE_LENGTHS = { thigh: 0.43, shank: 0.43, upperArm: 0.33, forearm: 0.26, palm: 0.07, foot: Math.hypot(0.07, 0.15), toe: 0.07 };
const ANGLE_JOINTS = new Set(JOINT_NAMES.filter((n) => n !== 'root'));

// sign maps (raw = sign * authored) per joint family; right side mirrors ry and rz
function signs(name) {
  const side = name.endsWith('_R') ? -1 : 1;
  const base = name.replace(/_[LR]$/, '');
  switch (base) {
    case 'hip': case 'shoulder': case 'elbow': case 'wrist': case 'ankle': return [-1, side, side];
    case 'knee': case 'toe': return [1, side, side];
    default: return [1, 1, 1]; // spine chest neck head
  }
}
const SIGNS = Object.fromEntries([...ANGLE_JOINTS].map((n) => [n, signs(n)]));

/* ---------- tiny vec3 / quaternion maths ---------- */
const D2R = Math.PI / 180;
export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vmid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
export const vangle = (a, b) => { const d = vlen(a) * vlen(b); return d < 1e-12 ? 0 : Math.acos(Math.max(-1, Math.min(1, vdot(a, b) / d))) / D2R; };
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const QID = [0, 0, 0, 1];
export function qaxis(ax, rad) { const s = Math.sin(rad / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(rad / 2)]; }
export function qeuler(rxd, ryd, rzd) { // X first, then Y, then Z
  return qmul(qaxis([0, 0, 1], rzd * D2R), qmul(qaxis([0, 1, 0], ryd * D2R), qaxis([1, 0, 0], rxd * D2R)));
}
export function qrot(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
export function qslerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  let s0, s1;
  if (d > 0.9995) { s0 = 1 - t; s1 = t; } else { const th = Math.acos(d), sn = Math.sin(th); s0 = Math.sin((1 - t) * th) / sn; s1 = Math.sin(t * th) / sn; }
  const r = [s0 * a[0] + s1 * bb[0], s0 * a[1] + s1 * bb[1], s0 * a[2] + s1 * bb[2], s0 * a[3] + s1 * bb[3]];
  const n = Math.hypot(...r) || 1; return r.map((c) => c / n);
}

/* ---------- forward kinematics ---------- */
const asQuat = (v, joint) => {
  if (!v) return QID;
  if (v.q) return v.q;
  const s = joint ? SIGNS[joint] : [1, 1, 1];
  return qeuler(v[0] * s[0], v[1] * s[1], v[2] * s[2]);
};
export function localQuat(pose, name) {
  if (name === 'root') return asQuat(pose.root && (pose.root.q ? { q: pose.root.q } : pose.root.rot), null);
  return asQuat(pose.joints && pose.joints[name], name);
}
/** Full FK: { pos: {name:[x,y,z]}, quat: {name:[x,y,z,w]} (world), local: {name:[x,y,z,w]} } */
export function fkFull(pose) {
  const pos = {}, quat = {}, local = {};
  const rp = (pose.root && pose.root.pos) || [0, STAND_Y, 0];
  for (const [name, parent, off] of TREE) {
    if (!parent) { local[name] = localQuat(pose, 'root'); quat[name] = local[name]; pos[name] = [rp[0], rp[1], rp[2]]; continue; }
    const isEnd = !ANGLE_JOINTS.has(name);
    local[name] = isEnd ? QID : localQuat(pose, name);
    quat[name] = isEnd ? quat[parent] : qmul(quat[parent], local[name]);
    pos[name] = vadd(pos[parent], qrot(quat[parent], off));
  }
  return { pos, quat, local };
}
/** fk(pose) -> { jointName: [x, y, z] } (joints and end sites). */
export const fk = (pose) => fkFull(pose).pos;

/** Signed flexion of a hinge joint in authored degrees (flexion +), read from the local rotation. */
export function flexionDeg(pose, name) {
  const q = fkFull(pose).local[name];
  let th = 2 * Math.atan2(q[0], q[3]); if (th > Math.PI) th -= 2 * Math.PI; if (th < -Math.PI) th += 2 * Math.PI;
  return (th / D2R) * SIGNS[name][0];
}

/* ---------- animation sampling (shared by viewer and tests) ---------- */
/** Sample a level at time t (seconds, wraps). Keyframes: first at t=0, last at t=duration (same pose as first). Linear root, slerp joints. */
export function samplePose(level, t) {
  const kfs = level.keyframes, d = level.duration;
  const tt = ((t % d) + d) % d;
  let i = 0; while (i < kfs.length - 2 && kfs[i + 1].t <= tt) i++;
  const a = kfs[i], b = kfs[i + 1], f = b.t === a.t ? 0 : Math.min(1, Math.max(0, (tt - a.t) / (b.t - a.t)));
  return blendPoses(a, b, f);
}
export function blendPoses(a, b, f) {
  const ap = (a.root && a.root.pos) || [0, STAND_Y, 0], bp = (b.root && b.root.pos) || ap;
  const joints = {};
  const names = new Set([...Object.keys(a.joints || {}), ...Object.keys(b.joints || {})]);
  for (const n of names) joints[n] = { q: qslerp(asQuat(a.joints && a.joints[n], n), asQuat(b.joints && b.joints[n], n), f) };
  const aq = asQuat(a.root && a.root.rot, null), bq = asQuat(b.root && b.root.rot, null);
  return { root: { pos: [0, 1, 2].map((k) => ap[k] + (bp[k] - ap[k]) * f), q: qslerp(aq, bq, f), rot: undefined }, joints };
}
export const emptyPose = () => ({ root: { pos: [0, STAND_Y, 0], rot: [0, 0, 0] }, joints: {} });
