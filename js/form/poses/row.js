// Row ladder: form data for every level. Keyframes come from row.gen.js (see tools/author-row.mjs).
// Levels 0-3: one-arm kettlebell row, split stance, free hand on a chair seat. Levels 4-6: doorway pull-up bar.
// Contract: see hpush.js.
import GEN from './row.gen.js';

const SRC_ROW = [
  'StrongFirst: kettlebell row technique (kettlebell coaching)',
  'ACE Exercise Library: Dumbbell one-arm row',
  'NSCA, Essentials of Strength Training and Conditioning: bent-over and one-arm row technique',
];
const SRC_BAR = [
  'ACE Exercise Library: Pull-up and Chin-up',
  'NSCA, Essentials of Strength Training and Conditioning: pull-up and chin-up technique',
];
const SRC_NEG = [...SRC_BAR, 'The negative (lowering-only) pull-up is a calisthenics progression. The sources above do not cover it in detail, so the pose applies their general pull-up technique.'];
const mk = (i, extra) => {
  const { wrong = {}, ...rest } = GEN[i];
  const cues = extra.cues;
  const mistakes = cues.mistakes.map(({ wp, ...o }) => (wp ? { ...o, wrongPose: wrong[wp] } : o));
  return { loop: true, ...rest, ...extra, cues: { ...cues, mistakes } };
};

const R_SETUP = [
  'Put a sturdy chair against a wall. Stand with your left foot forward and your right foot a long step back, both feet flat, and bend your front knee a little.',
  'Hinge at your hips until your back is flat and about 30 to 45° above the floor. Rest your left hand flat on the chair seat. Keep your neck in line with your spine.',
  'Hold the bell in your right hand with your arm straight below your shoulder. Brace your belly.',
];
const BACK = { wp: 'round', mistake: 'Your back rounds or your head drops.', fix: 'Hinge from the hips, brace your belly and keep your chest long. Use a lighter bell if you cannot hold a flat back.', highlight: ['spine', 'chest'] };
const TWIST = { wp: 'twist', mistake: 'Your chest twists open to lift the bell.', fix: 'Keep both shoulders level and facing the floor. Pull with your back, not by turning.', highlight: ['chest', 'shoulder_R'] };
const FLARE = { wp: 'flare', mistake: 'Your elbow flares out to the side and your shoulder shrugs up.', fix: 'Pull your elbow back toward your hip, close to your ribs. Slide your shoulder blade back and down, away from your ear.', highlight: ['elbow_R', 'shoulder_R'] };
const HEAVE = { wp: 'heave', mistake: 'You stand up and heave the bell with momentum.', fix: 'Keep your back at the same angle for the whole rep. Use a lighter bell and move smoothly.', highlight: ['spine', 'hip_L', 'hip_R'] };
const ROW_STOP = (easier) => ({ sign: 'Sharp or pinching pain in your lower back, shoulder or elbow, or numbness in your hand. Stop if you cannot keep your back flat.', easier });

const B_STOP = (sign, easier) => ({ sign, easier });
const SHRUG = { wp: 'shrug', mistake: 'Your shoulders shrug up to your ears at the bottom, and your chest and head slump forward.', fix: 'Before each rep, pull your shoulder blades down and back a little, away from your ears. Keep your arms straight but your shoulders active.', highlight: ['shoulder_L', 'shoulder_R', 'neck'] };
const KIP = { wp: 'kip', mistake: 'You swing or kick your legs to get up (kipping).', fix: 'Start from a still hang. Squeeze your glutes, keep your legs still and pull with your back. Use an easier level if you need momentum.', highlight: ['hip_L', 'hip_R', 'knee_L', 'knee_R'] };
const CRANE = { wp: 'crane', mistake: 'You poke your chin forward to reach the bar while your chest stays low.', fix: 'Pull your chest toward the bar and keep your neck long. Stop a little lower if your chest cannot get there.', highlight: ['neck', 'head'] };
const BAR_SETUP = (grip) => [
  `Use a doorway bar that is rated for your body weight and fixed firmly. Check it before every set. ${grip}`,
  'Hang with your arms straight, your knees bent behind you and your feet off the floor. Pull your shoulder blades down and back a little so your shoulders are not shrugged.',
];

// Poses were authored for the v1 ladder. OLD is keyed by the v1 level index.
// The export re-keys them to the v2 ladder; levels with no v2 equivalent are left out.
const OLD = {
  0: mk(0, {
    checks: { neutralSpine: 5, maxTorsoLeanDeg: 60, kneesOverToes: true },
    tempo: { point: 'palm_R', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: R_SETUP,
      movement: [
        'Breathe out and pull your right elbow back toward your hip for about 1 second. Keep your elbow close to your ribs and slide your shoulder blade back and down.',
        'Breathe in and lower the bell for about 2 seconds, under control, until your arm is fully straight. Keep your chest facing the floor and do not twist.',
        'Finish all reps, then swap sides and use the other hand on the chair.',
      ],
      mistakes: [BACK, TWIST, FLARE],
      stopIf: ROW_STOP('Row with a lighter bell or no bell, with the same chair support, then add weight slowly.'),
    },
    sources: SRC_ROW,
  }),
  1: mk(1, {
    checks: { neutralSpine: 5, maxTorsoLeanDeg: 60, kneesOverToes: true },
    tempo: { point: 'palm_R', axis: 1, lower: 3, press: 1 },
    cues: {
      setup: R_SETUP,
      movement: [
        'Breathe out and pull your elbow back toward your hip for about 1 second.',
        'Breathe in and lower the bell for a slow count of 3 seconds, until your arm is fully straight. Do not drop it at the end.',
        'Keep your back flat and your chest facing the floor for the whole rep.',
      ],
      mistakes: [BACK, TWIST, HEAVE],
      stopIf: ROW_STOP('One-arm KB row'),
    },
    sources: SRC_ROW,
  }),
  2: mk(2, {
    checks: { neutralSpine: 5, maxTorsoLeanDeg: 60, kneesOverToes: true },
    tempo: { point: 'palm_R', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: R_SETUP,
      movement: [
        'Breathe out and pull your elbow back toward your hip for about 1 second.',
        'Hold the top for 2 seconds. Keep your shoulder blade back and down, and keep breathing in short, calm breaths.',
        'Lower for about 2 seconds, under control, until your arm is fully straight.',
      ],
      mistakes: [BACK, TWIST, HEAVE],
      stopIf: ROW_STOP('One-arm KB row'),
    },
    sources: SRC_ROW,
  }),
  3: mk(3, {
    checks: { neutralSpine: 5, maxTorsoLeanDeg: 60, kneesOverToes: true },
    tempo: { point: 'palm_R', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: R_SETUP,
      movement: [
        'Breathe out and pull your elbow to your hip. Breathe in and lower halfway, for about 1 second.',
        'Breathe out and pull to your hip again. Breathe in and lower for about 2 seconds until your arm is straight. That is 1 rep.',
        'Keep your back flat and do not let your torso rise or twist as you tire.',
      ],
      mistakes: [BACK, TWIST, FLARE],
      stopIf: ROW_STOP('Paused KB row (2s at top)'),
    },
    sources: SRC_ROW,
  }),
  4: mk(4, {
    checks: { neutralSpine: 8, maxTorsoLeanDeg: 25 },
    tempo: { point: 'neck', axis: 1, lower: 5, press: 2 },
    cues: {
      setup: [
        ...BAR_SETUP('Use an overhand grip (palms away) a little wider than your shoulders.'),
        'Put a sturdy step or chair under the bar so you can start at the top with your chin over the bar. Do not jump if you feel unstable.',
      ],
      movement: [
        'Step or jump up so your chin is over the bar. Breathe in and brace.',
        'Lower for about 5 seconds, as smooth as you can, until your arms are straight. Keep your legs still and your shoulders down.',
        'Breathe out at the bottom, then step back up for the next rep. Do not just drop.',
      ],
      mistakes: [SHRUG, KIP, { mistake: 'You drop quickly in the last part of the lowering.', fix: 'Pull your shoulder blades down and keep resisting the whole way. Shorten the lowering to 3 seconds if you lose control.' }],
      stopIf: B_STOP('Sharp pain in your shoulder, elbow or wrist, pain in your grip, or you cannot control the lowering.', 'One-arm KB row'),
    },
    sources: SRC_NEG,
  }),
  5: mk(5, {
    checks: { neutralSpine: 8, maxTorsoLeanDeg: 25 },
    tempo: { point: 'neck', axis: 1, lower: 3, press: 1.5 },
    cues: {
      setup: [
        ...BAR_SETUP('Use an underhand grip (palms toward you), about shoulder-width apart.'),
        'Keep your feet still and your belly braced so your body does not swing.',
      ],
      movement: [
        'Breathe out and pull your chest toward the bar for about 1.5 seconds. Lead with your chest and drive your elbows down and back.',
        'Get your chin over the bar without poking your head forward. Pause for a moment.',
        'Breathe in and lower for about 3 seconds until your arms are straight and your shoulders are still active.',
      ],
      mistakes: [SHRUG, KIP, CRANE],
      stopIf: B_STOP('Sharp pain in your elbows, shoulders or wrists, or pain at the front of your upper arm. Stop if you cannot keep your body still.', 'Negative pull-up (5s down)'),
    },
    sources: SRC_BAR,
  }),
  6: mk(6, {
    checks: { neutralSpine: 8, maxTorsoLeanDeg: 25 },
    tempo: { point: 'neck', axis: 1, lower: 3, press: 1.5 },
    cues: {
      setup: [
        ...BAR_SETUP('Use an overhand grip (palms away), a little wider than your shoulders.'),
        'Keep your feet still and your belly braced so your body does not swing.',
      ],
      movement: [
        'Breathe out and pull your chest toward the bar for about 1.5 seconds. Drive your elbows down toward your ribs.',
        'Get your chin over the bar without poking your head forward. Pause for a moment.',
        'Breathe in and lower for about 3 seconds until your arms are straight and your shoulders are still active.',
      ],
      mistakes: [SHRUG, KIP, CRANE],
      stopIf: B_STOP('Sharp pain in your shoulders, elbows or wrists, or pain at the front of your shoulder. Stop if you cannot keep your body still.', 'Chin-up, with palms toward you'),
    },
    sources: SRC_BAR,
  }),
};

export default { 5: OLD[4], 6: OLD[5], 7: OLD[6] };
