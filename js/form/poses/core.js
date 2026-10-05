// Core ladder: form data for every level. Keyframes come from core.gen.js (see tools/author-core.mjs).
// Contract: see hpush.js. All levels are timed holds or slow cycles, so the loop shows the hold (calm breathing) or one movement cycle.
import GEN from './core.gen.js';

const SRC = [
  'ACE Exercise Library: Dead Bug, Plank and core-training exercises',
  'NSCA, Essentials of Strength Training and Conditioning: core and trunk exercise technique',
  'ACSM, Guidelines for Exercise Testing and Prescription: core muscular fitness',
];
const SRC_KB = [
  'StrongFirst: kettlebell carry technique (suitcase carry)',
  'NSCA, Essentials of Strength Training and Conditioning: loaded carries and trunk stability',
  'ACE Exercise Library: Farmer’s Walk',
];
const SRC_PROG = [...SRC, 'Hollow hold, hollow rocks and the tuck L-sit are gymnastics and calisthenics progressions. The sources above do not cover them in detail, so the pose applies their general core-bracing technique.'];
const mk = (i, extra) => {
  const { wrong = {}, ...rest } = GEN[i];
  const cues = extra.cues;
  return { loop: true, ...rest, ...extra, cues: { ...cues, mistakes: cues.mistakes.map(({ wp, ...o }) => (wp ? { ...o, wrongPose: wrong[wp] } : o)) } };
};
const BACK = ['spine', 'chest', 'hip_L', 'hip_R'];

export default {
  0: mk(0, {
    tempoNote: 'Each arm and leg: about 2 seconds out, a short pause, about 2 seconds back.',
    cues: {
      setup: [
        'Lie on your back. Lift your knees over your hips, bent to 90°, and point both arms straight up at the ceiling.',
        'Press your lower back into the floor and brace your belly, as if a belt is pulled tight around your waist.',
        'Keep your head and neck relaxed on the floor.',
      ],
      movement: [
        'Breathe out slowly. For about 2 seconds, reach one arm back past your ear and straighten the opposite leg. Stop just above the floor.',
        'Pause for a moment. Then breathe in and bring both back to the start for about 2 seconds. Change sides.',
        'Move only as far as your lower back stays pressed down. A smaller range is fine.',
      ],
      mistakes: [
        { wp: 'back', mistake: 'Your lower back arches off the floor as the leg goes out.', fix: 'Lift the leg higher or bend the knee as you reach out. Keep your back pressed down. Make the move smaller.', highlight: BACK },
        { mistake: 'You rush and let your arm and leg flop.', fix: 'Count about 2 seconds out and 2 seconds back, and breathe out as you reach.', highlight: ['shoulder_R', 'hip_L'] },
        { mistake: 'You hold your breath.', fix: 'Breathe out through pursed lips as the arm and leg go out, and breathe in as they return.' },
      ],
      stopIf: { sign: 'Pain in your lower back or neck, or your lower back will not stay on the floor.', easier: 'Move only the legs, one heel tap at a time with your arms up, or keep your feet on the floor and slide one heel out.' },
    },
    sources: SRC,
  }),
  1: mk(1, {
    tempoNote: 'Hold the shape. Breathe calmly: about 3 seconds in, 3 seconds out.',
    cues: {
      setup: [
        'Lie on your back with your arms by your ears and your legs straight. Press your lower back into the floor and brace your belly.',
        'Tuck your chin a little. Lift your shoulders and your straight legs off the floor to make a shallow “banana” shape.',
        'Easier version: bend your knees, or keep your arms by your sides. Keep your lower back flat. A higher leg position is easier.',
      ],
      movement: [
        'Hold the shape with your lower back flat on the floor. Squeeze your legs together and point your toes.',
        'Breathe in and out calmly for about 3 seconds each way. Do not hold your breath.',
        'Raise your legs higher if your back starts to arch. A short, flat hold is better than a long, arched one.',
      ],
      mistakes: [
        { wp: 'arch', mistake: 'Your lower back arches and a gap opens under it.', fix: 'Raise your legs higher or bend your knees until your lower back is flat again. Bring your arms down by your sides.', highlight: BACK },
        { wp: 'neck', mistake: 'You pull your head forward and strain your neck.', fix: 'Keep your chin slightly tucked and your neck long. Lift with your ribs and belly, not your head.', highlight: ['neck', 'head'] },
      ],
      stopIf: { sign: 'Pain in your lower back, hips or neck, or you cannot keep your lower back flat.', easier: 'Dead bug, with your feet on the floor' },
    },
    sources: SRC_PROG,
  }),
  2: mk(2, {
    checks: { neutralSpine: 5, maxTorsoLeanDeg: 6 },
    tempoNote: 'Carry for the full time. Switch hands at the halfway point. Breathe steadily.',
    cues: {
      setup: [
        'Stand tall with your feet hip-width apart. Hold one bell by its handle at your side, like a suitcase.',
        'Brace your belly. Keep your shoulders level and your ribs stacked over your hips.',
        'Keep the bell by your side without touching your leg. Start with a lighter bell if you lean.',
      ],
      movement: [
        'Walk with slow, even steps of about 1 second each. Stay tall with your head up and your shoulders level.',
        'Breathe in and out steadily. Do not hold your breath.',
        'At the halfway point, stop, bring the bell in front of you, pass it to the other hand and carry on for the same time.',
      ],
      mistakes: [
        { wp: 'lean', mistake: 'You lean toward the bell and your shoulder drops.', fix: 'Stand tall. Squeeze the side of your belly opposite the bell and level your shoulders. Use a lighter bell if you cannot.', highlight: ['shoulder_R', 'spine', 'chest'] },
        { wp: 'slump', mistake: 'Your upper back rounds and your head moves forward.', fix: 'Lift your chest a little, look ahead and keep the bell beside your hip.', highlight: ['chest', 'neck'] },
      ],
      stopIf: { sign: 'Pain in your lower back, shoulder or hip, or your grip fails and you cannot stand tall.', easier: 'Dead bug, with your feet on the floor' },
    },
    sources: SRC_KB,
  }),
  3: mk(3, {
    tempoNote: 'About 2 seconds back and 2 seconds forward. Keep the shape.',
    cues: {
      setup: [
        'Lie on your back in a hollow hold: lower back flat, arms by your ears, legs straight and lifted.',
        'Squeeze your legs together and brace your belly. Tuck your chin a little.',
        'Use a mat or a carpet. Do not rock on a hard floor.',
      ],
      movement: [
        'Breathe out and rock back for about 2 seconds until your shoulder blades touch the floor. Keep the same shape.',
        'Breathe in and rock forward for about 2 seconds until your lower back is on the floor again. Keep your arms and legs still.',
        'Rock as one piece, like a boat. Your hips and knees do not bend. If your shape breaks, stop and rest.',
      ],
      mistakes: [
        { wp: 'hinge', mistake: 'You fold at the hips and swing your legs to rock.', fix: 'Keep the hollow shape and rock with your whole body as one piece. Make the rock smaller.', highlight: ['hip_L', 'hip_R'] },
        { wp: 'arch', mistake: 'Your lower back arches as you rock forward.', fix: 'Raise your legs a little higher, press your lower back down and make the rock smaller.', highlight: BACK },
      ],
      stopIf: { sign: 'Pain in your lower back, neck or tailbone, or you lose the hollow shape.', easier: 'Hollow hold' },
    },
    sources: SRC_PROG,
  }),
  4: mk(4, {
    checks: { neutralSpine: 8, maxTorsoLeanDeg: 10 },
    tempoNote: 'Hold the lift. Breathe calmly: about 3 seconds in, 3 seconds out.',
    cues: {
      setup: [
        'Put two sturdy chairs side by side, about one hip-width apart, with the backs on the outside. Place them on a rug or against a wall so they cannot slide.',
        'Sit between the chairs and hold the seats beside your hips, with your fingers pointing forward and your arms straight.',
        'Push down hard, so your shoulders move away from your ears. Lock your elbows.',
      ],
      movement: [
        'Breathe in, then push down on the seats and lift your feet and hips off the floor, with your knees tucked in toward your chest.',
        'Hold with your elbows locked and your shoulders pushed down. Breathe calmly for about 3 seconds in and 3 seconds out.',
        'Lower with control after the time ends. Stop early if your shoulders rise or your elbows bend.',
      ],
      mistakes: [
        { wp: 'sink', mistake: 'You sink into your shoulders and your elbows bend.', fix: 'Push the seats away to straighten your arms and move your shoulders down. Hold for less time.', highlight: ['shoulder_L', 'shoulder_R', 'elbow_L', 'elbow_R'] },
        { wp: 'drop', mistake: 'Your knees drop and your feet go back to the floor.', fix: 'Pull your knees up toward your chest and push down harder. If you cannot, lift one foot at a time.', highlight: ['hip_L', 'hip_R', 'knee_L', 'knee_R'] },
        { mistake: 'The chairs slide or tip.', fix: 'Use heavy chairs on a rug or against a wall. Do not use chairs with wheels.', highlight: ['wrist_L', 'wrist_R'] },
      ],
      stopIf: { sign: 'Pain in your wrists, shoulders or elbows, or the chairs move.', easier: 'Hollow rocks' },
    },
    sources: SRC_PROG,
  }),
};
