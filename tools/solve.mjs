// DEV TOOL (not shipped, not cached by the service worker). A small damped least-squares solver that finds root
// position and joint angles so chosen points land on chosen coordinates (planted hands, feet, held props).
// Author scripts in tools/author-*.mjs call it and write plain-data keyframes into js/form/poses/*.gen.js.
import { fk, STAND_Y } from '../js/form/skeleton.js';

const D2R = Math.PI / 180;
export const clonePose = (p) => ({
  root: { pos: [...p.root.pos], rot: [...(p.root.rot || [0, 0, 0])] },
  joints: Object.fromEntries(Object.entries(p.joints || {}).map(([k, v]) => [k, [...v]])),
});
export const newPose = () => ({ root: { pos: [0, STAND_Y, 0], rot: [0, 0, 0] }, joints: {} });

// path: 'root.pos.1' | 'root.rot.0' | 'joints.knee_L.0'
function getP(pose, path) {
  const s = path.split('.');
  if (s[0] === 'root') return pose.root[s[1]][+s[2]];
  return (pose.joints[s[1]] || [0, 0, 0])[+s[2]];
}
function setP(pose, path, v) {
  const s = path.split('.');
  if (s[0] === 'root') { pose.root[s[1]][+s[2]] = v; return; }
  if (!pose.joints[s[1]]) pose.joints[s[1]] = [0, 0, 0];
  pose.joints[s[1]][+s[2]] = v;
}
const isAngle = (path) => !path.startsWith('root.pos');
// a free parameter is a path string, or { paths:[...], signs:[...] } for coupled values (e.g. both elbows)
function norm(p) { return typeof p === 'string' ? { paths: [p], signs: [1] } : { paths: p.paths, signs: p.signs || p.paths.map(() => 1), min: p.min, max: p.max }; }

function gauss(A, b) { // solve A x = b (A is n x n, modified)
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    const d = A[i][i] || 1e-12;
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / d; if (!f) continue; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / (A[i][i] || 1e-12); }
  return x;
}

// target error on one axis; with t.rel the target is the offset of point p from point rel
const miss = (pos, t, a) => { const i = 'xyz'.indexOf(a); return pos[t.p][i] - (t.rel ? pos[t.rel][i] : 0) - t[a]; };

/**
 * solve(pose, { free, targets, priors, iters })
 *   free:    [path | {paths, signs}]
 *   targets: [{ p: 'palm_L', rel?: 'shoulder_L', x?, y?, z?, w? }]   goals in metres (weight w, default 1); with rel the goal is p minus rel
 *   priors:  [{ path, value (deg or m), w }]     soft preferences (weight w in metres-per-radian terms; 0.02 is gentle)
 * returns { pose, err } where err = largest target miss in metres.
 */
export function solve(pose0, { free, targets = [], priors = [], iters = 120 }) {
  const pose = clonePose(pose0);
  const P = free.map(norm);
  const unit = (pa) => (isAngle(pa) ? D2R : 1);
  let x = P.map((p) => getP(pose, p.paths[0]) * p.signs[0] * unit(p.paths[0]));
  const clamp = (v, p) => { const u = unit(p.paths[0]); return Math.min(p.max === undefined ? Infinity : p.max * u, Math.max(p.min === undefined ? -Infinity : p.min * u, v)); };
  const apply = (xv) => P.forEach((p, i) => { const v = clamp(xv[i], p); p.paths.forEach((pa, k) => setP(pose, pa, (v * p.signs[k]) / unit(pa))); });
  const prior = priors.map((pr) => { const pi = P.findIndex((p) => p.paths.includes(pr.path)); const k = pi < 0 ? 0 : P[pi].paths.indexOf(pr.path); return pi < 0 ? null : { i: pi, v: pr.value * unit(pr.path) * P[pi].signs[k], w: pr.w ?? 0.02 }; }).filter(Boolean);
  const resid = (xv) => {
    apply(xv);
    const pos = fk(pose), r = [];
    for (const t of targets) for (const a of ['x', 'y', 'z']) if (t[a] !== undefined) r.push((t.w ?? 1) * (miss(pos, t, a)));
    for (const pr of prior) r.push(pr.w * (xv[pr.i] - pr.v));
    return r;
  };
  const cost = (r) => r.reduce((s, v) => s + v * v, 0);
  let lam = 1e-3, r = resid(x), c = cost(r);
  const n = x.length;
  for (let it = 0; it < iters; it++) {
    const J = []; const e = 1e-6;
    for (let j = 0; j < n; j++) { const xp = x.slice(); xp[j] += e; const rp = resid(xp); J.push(rp.map((v, k) => (v - r[k]) / e)); }
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, k) => J[i].reduce((s, v, m) => s + v * J[k][m], 0)));
    const g = J.map((col) => col.reduce((s, v, m) => s + v * r[m], 0));
    let improved = false;
    for (let tries = 0; tries < 8; tries++) {
      const A2 = A.map((row, i) => row.map((v, k) => v + (i === k ? lam * (1 + A[i][i]) : 0)));
      const dx = gauss(A2, g.map((v) => -v));
      const xn = x.map((v, i) => clamp(v + dx[i], P[i])), rn = resid(xn), cn = cost(rn);
      if (cn < c) { const step = Math.max(...dx.map(Math.abs)); x = xn; r = rn; c = cn; lam = Math.max(1e-9, lam / 4); improved = true; if (step < 1e-9) it = iters; break; }
      lam *= 5;
    }
    if (!improved || c < 1e-18) break;
  }
  apply(x);
  const pos = fk(pose);
  let err = 0; for (const t of targets.filter((t) => (t.w ?? 1) >= 1)) for (const a of ['x', 'y', 'z']) if (t[a] !== undefined) err = Math.max(err, Math.abs(miss(pos, t, a)));
  const misses = []; for (const t of targets) for (const a of ['x', 'y', 'z']) if (t[a] !== undefined) misses.push(`${t.p}${t.rel ? '-' + t.rel : ''}.${a} ${(miss(pos, t, a) * 100).toFixed(1)}cm`);
  return { pose, err, misses };
}

/** Shorthand: both sides share one value ('elbow', 0 -> joints.elbow_L.0 and joints.elbow_R.0). */
export const both = (joint, axis, lim = {}) => ({ paths: [`joints.${joint}_L.${axis}`, `joints.${joint}_R.${axis}`], signs: [1, 1], ...lim });
/** One side only, with optional bounds {min,max} in degrees. */
export const one = (joint, side, axis, lim = {}) => ({ paths: [`joints.${joint}_${side}.${axis}`], signs: [1], ...lim });
export const set = (pose, path, v) => { setP(pose, path, v); return pose; };
export const get = getP;

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** Turn a solved pose into a plain keyframe object at time t. */
export function keyframe(t, pose) {
  const joints = {};
  for (const [k, v] of Object.entries(pose.joints)) { const a = v.map((q) => Math.round(q * 100) / 100); if (a.some((q) => q !== 0)) joints[k] = a; }
  return { t: r4(t), root: { pos: pose.root.pos.map(r4), rot: pose.root.rot.map((q) => Math.round(q * 100) / 100) }, joints };
}
/** Smooth 0..1 easing and a loop-phase helper: segs = [[seconds, fromS, toS, 'ease'|'hold'], ...] -> function of t giving s. */
export const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
export function phaseFn(segs) {
  const total = segs.reduce((s, g) => s + g[0], 0);
  return { total, at(t) { let a = 0; for (const [d, s0, s1] of segs) { if (t <= a + d + 1e-9) return s0 + (s1 - s0) * (d ? ease((t - a) / d) : 1); a += d; } return segs[segs.length - 1][2]; } };
}
/** Mirror a pose left <-> right (authored angles are already side-mirrored, so swap entries; negate raw root/central yaw and roll). */
export function mirrorPose(p) {
  const out = clonePose(p);
  out.root.pos[0] = -p.root.pos[0]; out.root.rot[1] = -p.root.rot[1]; out.root.rot[2] = -p.root.rot[2];
  out.joints = {};
  for (const [k, v] of Object.entries(p.joints)) {
    if (/_L$/.test(k)) out.joints[k.replace(/_L$/, '_R')] = [...v];
    else if (/_R$/.test(k)) out.joints[k.replace(/_R$/, '_L')] = [...v];
    else out.joints[k] = [v[0], -v[1], -v[2]];
  }
  return out;
}
export const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;
