// Form-viewer trust tests: every pose must be physically sane. Do not loosen thresholds; fix the pose.
// Every level must have a pose, or be listed in GUIDE_PENDING (js/form/pending.js). Nothing in GUIDE_PENDING may have a pose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVES } from '../js/data.js';
import { fk, fkFull, flexionDeg, samplePose, vsub, vlen, vmid, vangle, qrot } from '../js/form/skeleton.js';
import { TOE_CUE } from '../js/form/cues-common.js';
import { GUIDE_PENDING } from '../js/form/pending.js';

const DRIFT_MAX = 0.02, FLOOR = -0.01;
const MOVE_IDS = Object.keys(MOVES);
const poses = {};
for (const id of MOVE_IDS) { try { poses[id] = (await import(`../js/form/poses/${id}.js`)).default; } catch { poses[id] = null; } }

const times = (lv, n) => Array.from({ length: n }, (_, i) => (i * lv.duration) / n);
const posesAt = (lv, n) => times(lv, n).map((t) => samplePose(lv, t));
const maxPairDist = (pts) => { let m = 0; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.max(m, vlen(vsub(pts[i], pts[j]))); return m; };
export function drifts(lv, n) {
  const fks = posesAt(lv, n).map(fk), out = {};
  for (const c of lv.contacts) out[c] = maxPairDist(fks.map((f) => f[c]));
  return out;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const LIMITS = { // authored rx (flexion +) per joint family, degrees
  hip: [-30, 140], shoulder: [-70, 200], wrist: [-80, 110], ankle: [-55, 45], toe: [-100, 60], spine: [-30, 45], chest: [-30, 45], neck: [-40, 50], head: [-40, 50],
};
const report = [];

for (const [id, idxs] of Object.entries(GUIDE_PENDING)) {
  for (const i of idxs) {
    test(`${id}[${i}]: is in GUIDE_PENDING so must have no pose`, () => {
      assert.ok(MOVES[id] && MOVES[id].levels[i], 'pending entry names a real level');
      assert.ok(!(poses[id] && poses[id][i]), 'has a pose, so remove it from GUIDE_PENDING');
    });
  }
}

for (const id of MOVE_IDS) {
  MOVES[id].levels.forEach((meta, i) => {
    const lv = poses[id] && poses[id][i];
    const name = `${id}[${i}] ${meta.name}`;
    if (!lv) { test(`${name}: has a pose entry or is in GUIDE_PENDING`, () => assert.ok((GUIDE_PENDING[id] || []).includes(i), 'no pose and not listed in GUIDE_PENDING')); return; }

    test(`${name}: keyframes are well formed and loop`, () => {
      assert.ok(lv.loop === true && lv.duration > 0, 'loop true and duration > 0');
      const k = lv.keyframes;
      assert.ok(k.length >= 8, 'at least 8 keyframes');
      assert.equal(k[0].t, 0); assert.equal(k[k.length - 1].t, lv.duration);
      for (let j = 1; j < k.length; j++) assert.ok(k[j].t > k[j - 1].t, 'times increase');
      assert.ok(same(k[0].root, k[k.length - 1].root) && same(k[0].joints, k[k.length - 1].joints), 'last keyframe equals the first (clean loop)');
      assert.ok(lv.keyT >= 0 && lv.keyT <= lv.duration, 'keyT inside the loop');
      assert.ok(Array.isArray(lv.contacts) && lv.contacts.length > 0, 'declares contacts');
    });

    test(`${name}: planted contacts drift < 2 cm and rest on their surface`, () => {
      const d20 = drifts(lv, 20), d200 = drifts(lv, 200);
      for (const c of lv.contacts) {
        assert.ok(d20[c] < DRIFT_MAX, `${c} drifts ${(d20[c] * 100).toFixed(2)} cm over 20 samples`);
        assert.ok(d200[c] < DRIFT_MAX, `${c} drifts ${(d200[c] * 100).toFixed(2)} cm over 200 samples`);
      }
      const fks = posesAt(lv, 20).map(fk);
      for (const c of lv.contacts) {
        const ys = fks.map((f) => f[c][1]), want = (lv.support && lv.support[c]) || 0;
        assert.ok(Math.min(...ys) >= FLOOR, `${c} below the floor`);
        const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
        assert.ok(Math.abs(mean - want) <= 0.02, `${c} should sit at y=${want} but is at ${mean.toFixed(3)}`);
      }
      report.push([name, Math.max(...Object.values(d200)), Math.max(...Object.values(d20))]);
    });

    test(`${name}: nothing goes below the floor, joints stay in human range`, () => {
      for (const p of posesAt(lv, 100)) {
        const f = fk(p);
        for (const [n, v] of Object.entries(f)) assert.ok(v[1] >= FLOOR, `${n} at y=${v[1].toFixed(3)}`);
        for (const s of ['L', 'R']) {
          const kn = flexionDeg(p, `knee_${s}`), el = flexionDeg(p, `elbow_${s}`);
          assert.ok(kn >= -5 && kn <= 155, `knee_${s} ${kn.toFixed(0)} deg`);
          assert.ok(el >= -5 && el <= 160, `elbow_${s} ${el.toFixed(0)} deg`);
        }
      }
      for (const kf of lv.keyframes) for (const [j, a] of Object.entries(kf.joints)) {
        const base = j.replace(/_[LR]$/, ''), lim = LIMITS[base];
        if (lim) assert.ok(a[0] >= lim[0] && a[0] <= lim[1], `${j} rx ${a[0]} outside ${lim}`);
      }
    });

    test(`${name}: held props stay near the hands`, () => {
      for (const pr of lv.props || []) {
        if (!pr.heldBy) continue;
        for (const p of posesAt(lv, 40)) {
          const F = fkFull(p), c = F.pos[pr.attach].map((v, k) => v + qrot(F.quat[pr.attach], pr.offset)[k]);
          for (const h of pr.heldBy) assert.ok(vlen(vsub(F.pos[h], c)) < 0.15, `${h} is ${(vlen(vsub(F.pos[h], c)) * 100).toFixed(0)} cm from the ${pr.type}`);
        }
      }
    });

    if (lv.checks && lv.checks.straightLine) test(`${name}: plank line is straight (shoulder, hip, ankle within 5 deg)`, () => {
      for (const p of posesAt(lv, 40)) {
        const f = fk(p), sh = vmid(f.shoulder_L, f.shoulder_R), an = vmid(f.ankle_L, f.ankle_R);
        const a = vangle(vsub(f.root, sh), vsub(an, f.root));
        assert.ok(a < 5, `body bends ${a.toFixed(1)} deg at the hips`);
        const h = vangle(vsub(f.head_top, sh), vsub(sh, f.root));
        assert.ok(h < 8, `head is ${h.toFixed(1)} deg off the body line`);
      }
    });
    if (lv.checks && lv.checks.armFlare) test(`${name}: elbows stay about 30-45 deg from the torso at the bottom`, () => {
      let low = null;
      for (const p of posesAt(lv, 200)) { const f = fk(p), y = vmid(f.shoulder_L, f.shoulder_R)[1]; if (!low || y < low.y) low = { y, f }; }
      const u = vsub(low.f.elbow_L, low.f.shoulder_L), ang = (Math.atan2(Math.abs(u[0]), Math.abs(u[2])) * 180) / Math.PI;
      assert.ok(ang >= lv.checks.armFlare[0] && ang <= lv.checks.armFlare[1], `arm flare ${ang.toFixed(0)} deg, wanted ${lv.checks.armFlare}`);
    });
    if (lv.checks && lv.checks.neutralSpine !== undefined) test(`${name}: spine stays neutral and the torso stays upright-ish`, () => {
      for (const kf of lv.keyframes) for (const j of ['spine', 'chest']) assert.ok(Math.abs((kf.joints[j] || [0])[0]) <= lv.checks.neutralSpine, `${j} flexes beyond ${lv.checks.neutralSpine} deg`);
      for (const p of posesAt(lv, 100)) { const f = fk(p), lean = vangle(vsub(f.neck, f.root), [0, 1, 0]); assert.ok(lean <= lv.checks.maxTorsoLeanDeg, `torso leans ${lean.toFixed(0)} deg from vertical`); }
    });
    if (lv.checks && lv.checks.kneesOverToes) test(`${name}: knees track over the toes and heels stay down`, () => {
      for (const p of posesAt(lv, 100)) {
        const f = fk(p);
        for (const s of ['L', 'R']) {
          assert.ok(Math.abs(f[`knee_${s}`][0]) >= (Math.abs(f[`hip_${s}`][0]) + Math.abs(f[`ankle_${s}`][0])) / 2 - 0.02, `knee_${s} collapses inward of the hip-ankle line`);
          assert.ok(f[`knee_${s}`][2] <= f[`toetip_${s}`][2] + 0.03, `knee_${s} travels well past the toes`);
          assert.ok(f[`heel_${s}`][1] <= 0.02, `heel_${s} lifts`);
        }
      }
    });
    if (lv.tempo) test(`${name}: keyframe timing matches the cued tempo`, () => {
      const T = lv.tempo, n = 400, ts = times(lv, n), v = ts.map((t) => fk(samplePose(lv, t))[T.point][T.axis]);
      const lo = Math.min(...v), hi = Math.max(...v), up90 = lo + 0.9 * (hi - lo), dn10 = lo + 0.1 * (hi - lo);
      const iB = v.findIndex((x) => x <= dn10); let iA = iB; while (iA > 0 && v[iA] < up90) iA--;
      let iC = iB; while (iC < n && v[iC] < up90) iC++; let iD = iC; while (iD > 0 && v[iD] > dn10) iD--;
      const down = ts[iB] - ts[iA], upT = ts[iC] - ts[iD];
      assert.ok(down >= 0.45 * T.lower && down <= 1.05 * T.lower, `lowering takes ${down.toFixed(2)} s for a cue of ${T.lower} s`);
      assert.ok(upT >= 0.45 * T.press && upT <= 1.05 * T.press, `pressing takes ${upT.toFixed(2)} s for a cue of ${T.press} s`);
    });

    test(`${name}: cues are complete`, () => {
      const c = lv.cues, str = (s) => typeof s === 'string' && s.trim().length > 8;
      assert.ok(c.setup.length >= 2 && c.setup.length <= 3 && c.setup.every(str), 'setup has 2-3 cues');
      assert.ok(c.movement.length >= 2 && c.movement.length <= 4 && c.movement.every(str), 'movement has 2-4 cues');
      assert.ok(c.mistakes.length >= 2 && c.mistakes.length <= 3, 'mistakes has 2-3 items');
      for (const m of c.mistakes) assert.ok(str(m.mistake) && str(m.fix), 'each mistake has a fix');
      assert.ok(str(c.stopIf.sign) && str(c.stopIf.easier), 'stopIf has a sign and an easier level');
      assert.ok(c.movement.some((s) => /breath|breathe/i.test(s)) && c.movement.some((s) => /second/i.test(s)), 'movement cues give breathing and tempo');
      assert.ok(Array.isArray(lv.sources) && lv.sources.length > 0, 'sources recorded');
      if (lv.toesCurled) assert.ok(c.setup.includes(TOE_CUE), 'toes-curled levels carry the toe cue');
      for (const m of c.mistakes) if (m.wrongPose) {
        assert.ok(m.wrongPose.root && m.wrongPose.joints, 'wrongPose has root and joints');
        const f = fk({ root: m.wrongPose.root, joints: m.wrongPose.joints });
        for (const [n, p] of Object.entries(f)) assert.ok(p.every(Number.isFinite) && p[1] >= -0.03, `wrongPose ${n} y=${p[1].toFixed(3)}`);
      }
    });
  });
}

test('report: contact drift per level (cm, worst of 200 samples / 20 samples)', (t) => {
  for (const [n, d200, d20] of report) t.diagnostic(`${n}: ${(d200 * 100).toFixed(2)} / ${(d20 * 100).toFixed(2)}`);
  assert.ok(true);
});

/* ---------- targeted checks from the visual review ---------- */
const lvOf = (id, i) => poses[id] && poses[id][i];
const minOver = (lv, n, fn) => Math.min(...posesAt(lv, n).map((p) => fn(fk(p))));

for (const i of [2, 3]) {
  const lv = lvOf('squat', i);
  if (lv) test(`squat[${i}] ${MOVES.squat.levels[i].name}: back knee hovers 2-6 cm above the floor at the bottom`, () => {
    const low = minOver(lv, 400, (f) => f.knee_R[1]);
    assert.ok(low >= 0.02 && low <= 0.06, `rear knee min y ${(low * 100).toFixed(1)} cm`);
  });
}

{
  const lv = lvOf('vpush', 4);
  if (lv) {
    const wall = lv.props.find((p) => p.type === 'wall'), cushion = lv.props.find((p) => p.type === 'box');
    const topKf = { root: lv.keyframes[0].root, joints: lv.keyframes[0].joints };
    test('vpush[4] wall negative: bottom is a tripod (head forward of the hands, on the cushion, elbows about 90 deg)', () => {
      const p = samplePose(lv, lv.keyT), f = fk(p), palm = vmid(f.palm_L, f.palm_R);
      // the wall is at +z behind the hands, so "farther from the wall" means smaller z
      assert.ok(palm[2] - f.head_top[2] >= 0.2, `head is only ${((palm[2] - f.head_top[2]) * 100).toFixed(0)} cm farther from the wall than the palms`);
      const cushionTop = cushion.pos[1] + cushion.size[1];
      assert.ok(Math.abs(f.head_top[1] - cushionTop) <= 0.03, `head_top y ${(f.head_top[1] * 100).toFixed(1)} cm, cushion top ${(cushionTop * 100).toFixed(1)} cm`);
      assert.ok(Math.abs(f.head_top[2] - cushion.pos[2]) <= 0.1, 'cushion sits under the head');
      for (const c of ['palm_L', 'palm_R']) assert.ok(lv.contacts.includes(c) && f[c][1] <= 0.02, `${c} planted`);
      for (const s of ['L', 'R']) { const el = flexionDeg(p, `elbow_${s}`); assert.ok(el >= 75 && el <= 105, `elbow_${s} flexion ${el.toFixed(0)} deg at the bottom`); }
      assert.ok(wall && wall.pos[2] - palm[2] >= 0.15 && wall.pos[2] - palm[2] <= 0.22, 'hands 15-20 cm from the wall');
    });
    test('vpush[4] wall negative: body is straight at the top (shoulder-hip-ankle within 10 deg)', () => {
      const f = fk(topKf), sh = vmid(f.shoulder_L, f.shoulder_R), an = vmid(f.ankle_L, f.ankle_R);
      const a = vangle(vsub(f.root, sh), vsub(an, f.root));
      assert.ok(a <= 10, `body bends ${a.toFixed(1)} deg at the hips at the top`);
    });
  }
}
