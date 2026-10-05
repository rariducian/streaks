// Squat ladder: all six levels. Keyframes come from squat.gen.js (tools/author-squat.mjs).
// Contract: see hpush.js. Keyframes come from squat.gen.js (tools/author-squat.mjs).
import GEN from './squat.gen.js';

const SRC = [
  'StrongFirst: goblet squat technique (kettlebell coaching)',
  'ACE Exercise Library: Squat',
  'NSCA, Essentials of Strength Training and Conditioning: squat technique',
];
const w = GEN[0].wrong;
const SRC_SPLIT = [
  'ACE Exercise Library: Lunge and split squat',
  'NSCA, Essentials of Strength Training and Conditioning: lunge and split squat technique',
  'StrongFirst: goblet squat technique (kettlebell coaching), for holding the bell at the chest',
];
const SRC_PROG = (what) => [...SRC_SPLIT, `${what} The sources above do not cover it in detail, so the pose applies their general squat and lunge technique.`];
const TOE_BACK = 'If your back toe complains, shorten the stance or put a folded towel under the back knee or foot.';
const SET_GOBLET = [
  'Stand with your feet about shoulder-width apart and your toes turned out a little.',
  'Hold the bell by the horns against your chest, with your elbows pointing down.',
  'Brace your belly. Stand tall with your chest up and your head neutral.',
];
const g = (i) => { const { wrong, ...rest } = GEN[i]; return rest; };
const mk = (i, wp) => (list) => list.map(({ wp: k, ...o }) => ({ ...o, wrongPose: GEN[i].wrong[k] }));

export default {
  0: {
    loop: true, ...GEN[0], wrong: undefined,
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 45, kneesOverToes: true, heelsDown: true },
    tempo: { point: 'root', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: [
        'Stand with your feet about shoulder-width apart and your toes turned out a little.',
        'Hold the bell by the horns against your chest, with your elbows pointing down.',
        'Brace your belly. Stand tall with your chest up and your head neutral.',
      ],
      movement: [
        'Breathe in and brace. Lower for about 2 seconds, pushing your knees out and sitting down between them.',
        'Keep your heels down, your knees over your toes and the bell close to your chest. Stop at the lowest point where your back stays flat.',
        'Breathe out and push the floor away to stand up for about 1 second.',
      ],
      mistakes: [
        { mistake: 'Your heels lift off the floor.', fix: 'Turn your toes out a little, use a slightly wider stance, or stop a little higher.', wrongPose: w.heels, highlight: ['ankle_L', 'ankle_R'] },
        { mistake: 'Your knees cave in.', fix: 'Push your knees out so they point the same way as your toes.', wrongPose: w.knees, highlight: ['knee_L', 'knee_R'] },
        { mistake: 'Your lower back rounds at the bottom.', fix: 'Stop higher, where your back stays flat. Keep your chest up and the bell close.', wrongPose: w.back, highlight: ['spine', 'chest'] },
      ],
      stopIf: { sign: 'Sharp pain in your knees, hips or lower back, or your back rounds and you cannot fix it.', easier: 'Sit down to a chair and stand up, with no bell, then try again.' },
    },
    sources: SRC,
  },
  1: {
    loop: true, ...g(1),
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 45, kneesOverToes: true, heelsDown: true },
    tempo: { point: 'root', axis: 1, lower: 3, press: 1 },
    cues: {
      setup: SET_GOBLET,
      movement: [
        'Breathe in and brace. Lower for 3 seconds, pushing your knees out and sitting down between them.',
        'Pause for 1 second at the bottom. Keep your heels down, your back flat and the bell close to your chest. Do not bounce.',
        'Breathe out and push the floor away to stand up for about 1 second.',
      ],
      mistakes: [
        { mistake: 'Your heels lift off the floor.', fix: 'Turn your toes out a little, use a slightly wider stance, or stop a little higher.', wrongPose: w.heels, highlight: ['ankle_L', 'ankle_R'] },
        { mistake: 'Your knees cave in during the pause.', fix: 'Push your knees out so they point the same way as your toes.', wrongPose: w.knees, highlight: ['knee_L', 'knee_R'] },
        { mistake: 'Your lower back rounds at the bottom.', fix: 'Stop higher, where your back stays flat. Keep your chest up and the bell close.', wrongPose: w.back, highlight: ['spine', 'chest'] },
      ],
      stopIf: { sign: 'Sharp pain in your knees, hips or lower back, or your back rounds and you cannot fix it.', easier: 'Go back to the goblet squat at a normal speed.' },
    },
    sources: SRC,
  },
  2: {
    loop: true, ...g(2),
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 20 },
    tempo: { point: 'root', axis: 1, lower: 2, press: 1.5 },
    cues: {
      setup: [
        'Take a long step forward, with your feet hip-width apart. Keep your front foot flat and your back heel up. Do this on both legs, one leg at a time.',
        'Hold the bell by the horns against your chest, with your elbows pointing down. Brace your belly and stand tall.',
        TOE_BACK,
      ],
      movement: [
        'Breathe in and brace. Lower for about 2 seconds. Your back knee drops straight down until it nearly touches the floor, under control.',
        'Keep your chest tall, your front shin close to vertical and your front knee over your second toe. Stop when your back knee is about 3 to 5 cm above the floor. Do not rest it down.',
        'Breathe out and push through your whole front foot to stand up for about 1.5 seconds. Do all the reps on one leg, then swap.',
      ],
      mistakes: mk(2)([
        { mistake: 'Your front knee caves in.', fix: 'Push your front knee out so it stays over your second toe.', wp: 'knees', highlight: ['knee_L'] },
        { mistake: 'You lean forward and your chest drops.', fix: 'Stand tall, keep the bell close and drop your back knee straight down, not forward.', wp: 'lean', highlight: ['spine', 'chest'] },
        { mistake: 'Your front heel lifts and your knee shoots far past your toes.', fix: 'Take a longer step, keep your front heel down and drop straight down.', wp: 'heel', highlight: ['ankle_L', 'knee_L'] },
      ]),
      stopIf: { sign: 'Sharp pain in your front knee, hip or lower back, or pain in your back toe that a shorter stance does not fix.', easier: 'Go back to the tempo goblet squat.' },
    },
    sources: SRC_SPLIT,
  },
  3: {
    loop: true, ...g(3),
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 20 },
    tempo: { point: 'root', axis: 1, lower: 2, press: 1.5 },
    cues: {
      setup: [
        'Put your front foot flat on a firm stack of books about 10 cm high. Take a long step back with your other foot and keep that heel up. Use a stack that does not slide.',
        'Hold the bell by the horns at your chest (optional). Brace your belly and stand tall.',
        TOE_BACK,
      ],
      movement: [
        'Breathe in and brace. Lower for about 2 seconds. Your back knee drops straight down until it nearly touches the floor, under control.',
        'Keep your whole front foot on the books, your torso tall and your front knee over your second toe. Stop where your back stays flat and while your back knee is still about 3 to 5 cm above the floor.',
        'Breathe out and push through your whole front foot to stand up for about 1.5 seconds. Do all the reps on one leg, then swap.',
      ],
      mistakes: mk(3)([
        { mistake: 'Your front knee caves in.', fix: 'Push your front knee out so it stays over your second toe.', wp: 'knees', highlight: ['knee_L'] },
        { mistake: 'You lean forward and your chest drops.', fix: 'Stop higher, stand tall and drop your back knee straight down.', wp: 'lean', highlight: ['spine', 'chest'] },
        { mistake: 'Your front heel lifts off the books.', fix: 'Take a longer step and keep your whole front foot pressed into the books.', wp: 'heel', highlight: ['ankle_L'] },
      ]),
      stopIf: { sign: 'Sharp pain in your front knee, hip or lower back, a wobbly stack, or pain in your back toe that a shorter stance does not fix.', easier: 'Go back to the split squat holding the bell, with both feet on the floor.' },
    },
    sources: SRC_PROG('The front-foot-elevated split squat is a common progression of the split squat.'),
  },
  4: {
    loop: true, ...g(4),
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 45 },
    tempo: { point: 'root', axis: 1, lower: 2, press: 2 },
    cues: {
      setup: [
        'Stand on one foot with your foot flat and your toes pointing forward. Put a cushion or folded towel on the floor behind you. Do all the reps on one leg, then swap.',
        'Lift your other foot behind you with your knee bent. Keep your standing knee soft and over your second toe.',
        'Hold your arms out in front of you to balance. Brace your belly and look ahead.',
      ],
      movement: [
        'Breathe in and brace. Lower for about 2 seconds: sit your hips back, lean your chest forward with a flat back and bend your standing knee.',
        'Lower your back knee toward the cushion and tap it softly. Do not drop onto it. Pause for a moment, with your standing heel down.',
        'Breathe out and push through your whole standing foot to stand up for about 2 seconds.',
      ],
      mistakes: mk(4)([
        { mistake: 'Your standing knee caves in.', fix: 'Push your standing knee out so it stays over your second toe.', wp: 'knees', highlight: ['knee_L'] },
        { mistake: 'Your standing heel lifts.', fix: 'Sit your hips back and press your whole foot into the floor. Stop a little higher.', wp: 'heel', highlight: ['ankle_L'] },
        { mistake: 'Your back rounds and you fall forward onto the cushion.', fix: 'Keep your chest up with a flat back. Lower slowly and stop higher if you cannot control it.', wp: 'back', highlight: ['spine', 'chest'] },
      ]),
      stopIf: { sign: 'Sharp pain in your standing knee, hip or lower back, or you cannot stay balanced and you fall onto the cushion.', easier: 'Go back to the front-foot-elevated split squat, or hold a wall with one hand.' },
    },
    sources: SRC_PROG('The skater squat is a single-leg squat progression.'),
  },
  5: {
    loop: true, ...g(5),
    checks: { neutralSpine: 10, maxTorsoLeanDeg: 45 },
    tempo: { point: 'root', axis: 1, lower: 2.5, press: 1.5 },
    cues: {
      setup: [
        'Put a sturdy box or chair about 40 cm high behind you. Stand on one foot in front of it, with your foot flat. Do all the reps on one leg, then swap.',
        'Hold your other leg out in front of you, off the floor, with your knee almost straight. Reach your arms forward to balance.',
        'Brace your belly, stand tall and look ahead.',
      ],
      movement: [
        'Breathe in and brace. Sit back for about 2.5 seconds, with your knee out over your second toe and your heel down.',
        'Touch the box lightly. Do not drop onto it. Keep your chest up and your back flat.',
        'Breathe out and push through your whole foot to stand up for about 1.5 seconds. Do not rock back to get up.',
      ],
      mistakes: mk(5)([
        { mistake: 'Your standing knee caves in.', fix: 'Push your standing knee out so it stays over your second toe.', wp: 'knees', highlight: ['knee_L'] },
        { mistake: 'Your standing heel lifts.', fix: 'Reach your arms forward, sit back and press your whole foot into the floor. Use a higher box.', wp: 'heel', highlight: ['ankle_L'] },
        { mistake: 'You collapse onto the box with a rounded back.', fix: 'Lower more slowly with your chest up. Use a higher box until you can control it.', wp: 'back', highlight: ['spine', 'chest'] },
      ]),
      stopIf: { sign: 'Sharp pain in your standing knee, hip or lower back, or you cannot control the descent and drop onto the box.', easier: 'Go back to the skater squat, or use a higher box.' },
    },
    sources: SRC_PROG('The pistol squat to a box is a single-leg squat progression.'),
  },
};
