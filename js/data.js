// Constants for streaks. No DOM, no dependencies.

const L = (name, cue, requiresBar) => (requiresBar ? { name, cue, requiresBar: true } : { name, cue });

const MOVE_LIST = [
  {
    id: 'hpush', name: 'Horizontal push', unit: 'reps', range: [6, 15], perSide: false,
    levels: [
      L('Standard push-up', 'Hands under shoulders, body in one straight line.'),
      L('Deficit push-up (hands on books)', 'Hands on books, lower until your chest passes them.'),
      L('Diamond push-up', 'Hands close together under your chest, elbows tucked.'),
      L('Feet-elevated push-up', 'Feet on a chair, keep your hips level.'),
      L('Archer push-up', 'Lower over one arm while the other arm stays straight.'),
      L('Pseudo-planche push-up', 'Hands by your hips, lean forward over them.'),
      L('Assisted one-arm push-up', 'One hand under your chest, the other lightly on a book.'),
    ],
  },
  {
    id: 'vpush', name: 'Overhead push', unit: 'reps', range: [6, 12], perSide: false,
    levels: [
      L('KB press 10kg (each arm)', 'Press the bell straight up. Reps count per arm.'),
      L('Tempo KB press (3s down, each arm)', 'Press up fast, lower for a slow count of three.'),
      L('Pike push-up', 'Hips high, lower the top of your head to the floor.'),
      L('Elevated pike push-up', 'Feet on a chair, hips high, head to the floor.'),
      L('Wall handstand negatives', 'Kick up to the wall, lower slowly for five seconds.'),
    ],
  },
  {
    id: 'squat', name: 'Squat', unit: 'reps', range: [8, 15], perSide: true,
    levels: [
      L('Goblet squat', 'Hold the bell at your chest. Sit between your knees. Reps count for both legs.'),
      L('Tempo goblet squat (3s down, 1s pause)', 'Lower for three, pause one at the bottom, then stand.'),
      L('Split squat holding KB', 'Back knee drops straight down. Reps count per leg.'),
      L('Front-foot-elevated split squat', 'Front foot on a book, lower with control.'),
      L('Skater squat', 'Back foot behind you, tap the knee down softly.'),
      L('Pistol squat to box', 'Sit back to a box on one leg, then stand.'),
    ],
  },
  {
    id: 'hinge', name: 'Hinge', unit: 'reps', range: [10, 20], perSide: false,
    levels: [
      L('Two-hand KB swing', 'Push your hips back, then snap them forward.'),
      L('One-arm KB swing (alternate sets)', 'One hand on the bell. Swap hands each set.'),
      L('Single-leg RDL with KB', 'Hinge on one leg, back flat, bell near the floor.'),
      L('Tempo single-leg RDL (3s down)', 'Lower for a slow count of three, then stand tall.'),
    ],
  },
  {
    id: 'row', name: 'Row', unit: 'reps', range: [8, 15], perSide: true,
    levels: [
      L('One-arm KB row', 'Hand on a chair, pull the bell to your hip.'),
      L('Tempo KB row (3s down)', 'Pull up fast, lower for a slow count of three.'),
      L('Paused KB row (2s at top)', 'Hold the top of each rep for two seconds.'),
      L('1.5-rep KB row', 'Pull up, lower halfway, pull up again, then lower.'),
      L('Negative pull-up (5s down)', 'Jump or step to the top, lower for five seconds.', true),
      L('Chin-up', 'Palms facing you, pull your chin over the bar.', true),
      L('Pull-up', 'Palms facing away, pull your chin over the bar.', true),
    ],
  },
  {
    id: 'core', name: 'Core', unit: 'sec', range: [20, 45], perSide: false,
    levels: [
      L('Dead bug', 'Lower back flat, move opposite arm and leg slowly.'),
      L('Hollow hold', 'Lower back pressed down, arms and legs off the floor.'),
      L('KB suitcase carry (switch hands halfway)', 'Walk tall with the bell at your side.'),
      L('Hollow rocks', 'Hold the hollow shape and rock back and forth.'),
      L('Tuck L-sit (between two chairs)', 'Push down on the chairs, lift your knees off the floor.'),
    ],
  },
];

// MOVES is an object keyed by move id (use MOVE_LIST for an ordered array).
export const MOVES = Object.fromEntries(MOVE_LIST.map((m) => [m.id, m]));
export { MOVE_LIST };

export const DAYS = [
  { id: 'push', name: 'Push', moves: ['hpush', 'vpush', 'row', 'core'] },
  { id: 'legs', name: 'Legs', moves: ['squat', 'hinge', 'core', 'hpush'] },
  { id: 'pull', name: 'Pull + core', moves: ['row', 'core', 'squat', 'vpush'] },
];

export const FAST_STAGES = [
  { fromH: 0, label: 'Fed state', detail: 'Your body is still digesting and using the energy from your last meal.' },
  { fromH: 4, label: 'Blood sugar settling', detail: 'Insulin falls and your body starts using stored sugar.' },
  { fromH: 12, label: 'Switching to fat', detail: 'Stored sugar runs low and fat use starts to rise.' },
  { fromH: 16, label: 'Fat burning ramps up', detail: 'Fat is now a main fuel source for your body.' },
  { fromH: 24, label: 'Deep fast', detail: 'A long fast. Drink water and listen to your body.' },
];

export const FAST_PRESETS = [
  { id: 'circadian', label: 'Circadian', hours: 13 },
  { id: '16-8', label: '16:8', hours: 16 },
  { id: '18-6', label: '18:6', hours: 18 },
  { id: '20-4', label: '20:4', hours: 20 },
  { id: 'custom', label: 'Custom', hours: null },
];

export const SESSION_MINUTES_STEPS = [10, 15, 20];
export const MINIMUM_MINUTES = 3;
