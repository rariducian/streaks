// Hinge ladder: form data for every level. Keyframes come from hinge.gen.js (see tools/author-hinge.mjs).
// Contract: see hpush.js.
import GEN from './hinge.gen.js';

const SRC_SWING = [
  'StrongFirst: hardstyle kettlebell swing technique (hip hinge, hike pass, plank at the top)',
  'NSCA, Essentials of Strength Training and Conditioning: hip-hinge and kettlebell swing technique',
];
const SRC_RDL = [
  'StrongFirst: hip hinge and single-leg deadlift technique',
  'NSCA, Essentials of Strength Training and Conditioning: Romanian deadlift and single-leg RDL technique',
];
const g = (i) => GEN[i];
const mk = (i, extra) => {
  const { wrong = {}, ...rest } = g(i);
  const cues = extra.cues;
  const m = cues.mistakes.map(({ wp, ...o }) => (wp ? { ...o, wrongPose: wrong[wp] } : o));
  return { loop: true, ...rest, ...extra, cues: { ...cues, mistakes: m } };
};
const BACK = ['spine', 'chest', 'hip_L', 'hip_R'];
const SQUAT = { wp: 'squat', mistake: 'You squat the swing: your knees bend deeply and your torso stays upright.', fix: 'Push your hips back, like closing a car door with your bottom. Keep your shins close to vertical and let your knees bend only a little.', highlight: ['knee_L', 'knee_R', 'hip_L', 'hip_R'] };
const ROUND = { wp: 'round', mistake: 'Your lower back rounds when the bell goes back.', fix: 'Keep your chest proud and your back flat. Hike the bell back no further than your back stays flat, and use a lighter bell if needed.', highlight: BACK };
const LEAN = { wp: 'lean', mistake: 'You lean back at the top and push your belly forward.', fix: 'Stand tall in one straight line from head to heels. Squeeze your glutes and keep your ribs down. The bell floats up only to chest height.', highlight: ['spine', 'chest', 'hip_L', 'hip_R'] };
const HIKE = 'Stand with your feet a little wider than your shoulders and your toes turned out a little. Put the bell on the floor about one foot-length in front of you.';

// Poses were authored for the v1 ladder. OLD is keyed by the v1 level index.
// The export re-keys them to the v2 ladder; levels with no v2 equivalent are left out.
const OLD = {
  0: mk(0, {
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 60, kneesOverToes: true },
    cues: {
      setup: [
        HIKE,
        'Hinge at your hips and take the handle with both hands. Pull your shoulder blades down, your back flat and your chest proud.',
        'Hike the bell back: put your forearms against your inner thighs, high up, with your arms long.',
      ],
      movement: [
        'Breathe in at the top and brace. Let the bell fall and hinge late: your hips go back and your shins stay close to vertical.',
        'Snap your hips forward fast, in about 0.3 second. Squeeze your glutes and stand in a tall, straight plank. Your arms stay relaxed and the bell floats to chest height.',
        'Breathe out sharply as you snap. Let the bell fall back on its own, with no pull from your arms. A full swing takes about 2 seconds.',
        'Keep your eyes forward and your feet flat on the floor. Do not jump.',
      ],
      mistakes: [SQUAT, ROUND, LEAN],
      stopIf: { sign: 'Sharp pain in your lower back, hips, knees or shoulders, or your back rounds and you cannot fix it.', easier: 'Kettlebell deadlift (bell on the floor between your feet, hinge down and stand up) with no swing.' },
    },
    sources: SRC_SWING,
  }),
  1: mk(1, {
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 60, kneesOverToes: true },
    cues: {
      setup: [
        `${HIKE} The bell stays on the midline.`,
        'Take the handle with one hand. Keep your shoulders level and square to the front. Let your free arm hang relaxed by your side.',
        'Hike the bell back: put your forearm against your inner thigh, high up, with your arm long and your back flat.',
      ],
      movement: [
        'Breathe in and brace. Let the bell fall and hinge late: your hips go back and your shins stay close to vertical.',
        'Snap your hips forward fast. Squeeze your glutes and stand in a tall plank. The bell floats to chest height with a relaxed arm. A full swing takes about 2 seconds.',
        'Breathe out sharply as you snap. Keep your shoulders square the whole time: do not let the bell turn your chest. Swap hands each set.',
      ],
      mistakes: [
        { wp: 'twist', mistake: 'Your chest and shoulders turn towards the bell hand.', fix: 'Brace your belly and keep both shoulders level and facing the front. Use a lighter bell or go back to the two-hand swing until you can stay square.', highlight: ['chest', 'spine', 'shoulder_L', 'shoulder_R'] },
        ROUND,
        LEAN,
      ],
      stopIf: { sign: 'Sharp pain in your lower back, hips, knees or shoulders, or your torso twists and you cannot stop it.', easier: 'Two-hand KB swing.' },
    },
    sources: SRC_SWING,
  }),
  2: mk(2, {
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 75 },
    tempo: { point: 'neck', axis: 1, lower: 2, press: 1.5 },
    cues: {
      setup: [
        'Stand on one leg with your foot flat and your knee soft, not locked. Hold the bell in the hand on the same side as your standing leg.',
        'Square your hips to the floor. Pull your shoulder blades down and keep your back flat.',
        'Hold on to a wall or a chair with your free hand for the first sets, if you need help with balance.',
      ],
      movement: [
        'Breathe in and brace. Push your hips back and lower for about 2 seconds. Your back leg stays in one line with your torso.',
        'Keep your hips square: do not open them to the side. The bell hangs under your shoulder, close to your standing leg. Stop where your back stays flat.',
        'Breathe out and drive your hips forward to stand tall in about 1.5 seconds. Squeeze your glutes at the top.',
      ],
      mistakes: [
        ROUND,
        { wp: 'open', mistake: 'Your hips open: the back leg swings out and your pelvis turns up to the side.', fix: 'Point your back toes at the floor. Keep both hip bones facing the floor, even if you must go a little less low.', highlight: ['hip_L', 'hip_R', 'spine'] },
        { wp: 'away', mistake: 'The bell drifts forward, away from your leg.', fix: 'Keep your arm long and let the bell hang straight down close to your standing leg. Keep your shoulder blades set.', highlight: ['shoulder_L', 'wrist_L'] },
      ],
      stopIf: { sign: 'Sharp pain in your lower back, hamstring, knee or standing ankle, or you cannot keep your balance and your back rounds.', easier: 'Single-leg RDL with no bell, with your fingertips on a wall or chair. Or the two-hand KB swing.' },
    },
    sources: SRC_RDL,
  }),
  3: mk(3, {
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 75 },
    tempo: { point: 'neck', axis: 1, lower: 3, press: 1.5 },
    cues: {
      setup: [
        'Stand on one leg with your foot flat and your knee soft, not locked. Hold the bell in the hand on the same side as your standing leg.',
        'Square your hips to the floor. Pull your shoulder blades down and keep your back flat.',
        'Pick a spot on the floor about two metres ahead and keep your head in line with your spine.',
      ],
      movement: [
        'Breathe in and brace. Lower for a slow count of 3 seconds: your hips go back and your back leg stays in one line with your torso.',
        'Keep your hips square. The bell hangs under your shoulder, close to your standing leg. Stop where your back stays flat and pause for a moment.',
        'Breathe out and drive your hips forward to stand tall in about 1.5 seconds. Squeeze your glutes at the top.',
      ],
      mistakes: [
        ROUND,
        { wp: 'open', mistake: 'Your hips open: the back leg swings out and your pelvis turns up to the side.', fix: 'Point your back toes at the floor. Keep both hip bones facing the floor, even if you must go a little less low.', highlight: ['hip_L', 'hip_R', 'spine'] },
        { wp: 'away', mistake: 'The bell drifts forward, away from your leg.', fix: 'Keep your arm long and let the bell hang straight down close to your standing leg. Keep your shoulder blades set.', highlight: ['shoulder_L', 'wrist_L'] },
      ],
      stopIf: { sign: 'Sharp pain in your lower back, hamstring, knee or standing ankle, or you cannot keep your balance and your back rounds.', easier: 'Single-leg RDL with KB (2 seconds down), or the same move with no bell and your fingertips on a wall.' },
    },
    sources: SRC_RDL,
  }),
};

export default { 1: OLD[2], 3: OLD[3] };
