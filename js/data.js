// Constants for streaks. No DOM, no dependencies.

// Level helper. opts may hold: perSide (two slots, left then right), range [min,max] (overrides the move range),
// requiresBar (needs a pull-up bar), rir2 (stop about 2 reps before failure).
const L = (name, cue, opts = {}) => ({ name, cue, ...opts });

export const TOE_RULE = 'Toe check: mild discomfort up to 3/10 is OK if it settles by next morning. Sharper pain: stop and drop a level. Confirm this rule with your physio.';
const TABLE_RULE = 'Test the table first. It must not tip.';

const MOVE_LIST = [
  {
    id: 'hpush', name: 'Horizontal push', unit: 'reps', range: [6, 15],
    levels: [
      L('Standard push-up', 'Hands under shoulders, body in one straight line.'),
      L('Deficit push-up (hands on books)', 'Hands on books, lower until your chest passes them.'),
      L('Diamond push-up', 'Hands close together under your chest, elbows tucked.'),
      L('Feet-elevated push-up', 'Feet on a chair, keep your hips level.'),
      L('Archer push-up', 'Lower over one arm while the other arm stays straight.', { range: [6, 12] }),
      L('Pseudo-planche push-up', 'Hands by your hips, lean forward over them.', { range: [5, 12] }),
      L('Assisted one-arm push-up', 'One hand under your chest, the other lightly on a book.', { perSide: true, range: [3, 8], rir2: true }),
    ],
  },
  {
    id: 'vpush', name: 'Overhead push', unit: 'reps', range: [6, 12],
    levels: [
      L('KB press 10kg', 'Press the bell straight up. Lower it back to your shoulder.', { perSide: true, range: [6, 12] }),
      L('Tempo KB press (3s down)', 'Press up fast, lower for a slow count of three.', { perSide: true, range: [4, 8] }),
      L('Pike push-up', 'Hips high, lower the top of your head to the floor.', { range: [6, 12] }),
      L('Elevated pike push-up', 'Feet on a chair, hips high, head to the floor.', { range: [5, 10] }),
      L('Wall handstand negatives', 'Kick up to the wall, lower slowly for five seconds.', { range: [2, 5], rir2: true }),
    ],
  },
  {
    id: 'squat', name: 'Squat', unit: 'reps', range: [8, 15],
    levels: [
      L('Goblet squat', 'Hold the bell at your chest. Sit between your knees.', { range: [8, 15] }),
      L('Tempo goblet squat (3s down, 1s pause)', 'Lower for three, pause one at the bottom, then stand.', { range: [4, 8] }),
      L('Split squat holding KB', 'Back knee drops straight down.', { perSide: true, range: [8, 15] }),
      L('Front-foot-elevated split squat', 'Front foot on a book, lower with control.', { perSide: true, range: [8, 15] }),
      L('Skater squat', 'Back foot behind you, tap the knee down softly.', { perSide: true, range: [5, 10] }),
      L('Pistol squat to box', 'Sit back to a box on one leg, then stand.', { perSide: true, range: [3, 8], rir2: true }),
    ],
  },
  {
    id: 'hinge', name: 'Hinge', unit: 'reps', range: [8, 15],
    levels: [
      L('Single-leg hip thrust (shoulders on couch)', 'Shoulders on the couch edge, one foot flat. Drive through the heel, squeeze at the top.', { perSide: true, range: [8, 15] }),
      L('Single-leg RDL with KB', 'Hinge on one leg, back flat, bell near the floor.', { perSide: true, range: [8, 12] }),
      L('Paused single-leg hip thrust (KB on hip, 2s at top)', 'Shoulders on the couch edge, bell on your hip. Hold the top for two seconds.', { perSide: true, range: [6, 12] }),
      L('Tempo single-leg RDL (3s down)', 'Lower for a slow count of three, then stand tall.', { perSide: true, range: [4, 8] }),
    ],
  },
  {
    id: 'hamcurl', name: 'Hamstring curl', unit: 'reps', range: [8, 15],
    levels: [
      L('Towel leg curl (both legs)', 'On your back, heels on a towel on a smooth floor. Hips up, pull your heels in, slide out slowly.', { range: [8, 15] }),
      L('Towel leg curl, slow return (3s out)', 'Same set-up. Pull your heels in fast, slide out for a slow count of three.', { range: [5, 10] }),
      L('Single-leg towel curl', 'One heel on the towel, the other leg up. Hips up, pull in, slide out slowly.', { perSide: true, range: [5, 10] }),
      L('Nordic negatives, short range (feet under the couch)', 'Kneel on a cushion, feet hooked under the couch. Lower slowly as far as you control, catch yourself with your hands.', { range: [3, 6], rir2: true }),
      L('Nordic negatives, full range', 'Kneel on a cushion, feet hooked under the couch. Lower slowly all the way, catch yourself with your hands.', { range: [3, 6], rir2: true }),
    ],
  },
  {
    id: 'calf', name: 'Calf raise', unit: 'reps', range: [10, 20],
    levels: [
      L('Calf raise off a book (both legs, 2s stretch)', `Balls of your feet on a book, heels down for a 2-second stretch, then rise high. ${TOE_RULE}`, { range: [12, 20] }),
      L('Single-leg calf raise off a book', `One foot on the book, heel down for a stretch, then rise high. ${TOE_RULE}`, { perSide: true, range: [8, 15] }),
      L('Slow single-leg calf raise (3s down, 2s stretch)', `Rise high, lower for three seconds, then hold the stretch for two. ${TOE_RULE}`, { perSide: true, range: [5, 8] }),
      L('Single-leg calf raise holding KB', `Hold the bell in the hand on the same side as your working foot, then rise high. ${TOE_RULE}`, { perSide: true, range: [8, 15] }),
    ],
  },
  {
    id: 'row', name: 'Row', unit: 'reps', range: [8, 15],
    levels: [
      L('Towel door row', 'Loop a towel around both handles of a solid, open door. Lean back, pull your chest to the door.', { range: [8, 15] }),
      L('Inverted row under a table, knees bent', `Lie under a sturdy table, grip the edge. Body straight from knees to head, pull your chest up. ${TABLE_RULE}`, { range: [8, 15] }),
      L('Inverted row, legs straight', `Same as the bent-knee row, but with straight legs and heels on the floor. ${TABLE_RULE}`, { range: [6, 12] }),
      L('Paused inverted row (2s at top)', `Pull your chest to the table edge and hold the top for two seconds. ${TABLE_RULE}`, { range: [5, 10] }),
      L('Feet-elevated inverted row', `Feet on a chair, body straight, pull your chest to the table edge. ${TABLE_RULE}`, { range: [6, 12] }),
      L('Negative pull-up (5s down)', 'Jump or step to the top, lower for five seconds.', { requiresBar: true, range: [2, 5] }),
      L('Chin-up', 'Palms facing you, pull your chin over the bar.', { requiresBar: true, range: [3, 8] }),
      L('Pull-up', 'Palms facing away, pull your chin over the bar.', { requiresBar: true, range: [3, 8] }),
    ],
  },
  {
    id: 'core', name: 'Core', unit: 'sec', range: [20, 40],
    levels: [
      L('Dead bug', 'Lower back flat, move opposite arm and leg slowly.'),
      L('Hollow hold', 'Lower back pressed down, arms and legs off the floor.'),
      L('KB suitcase carry (switch hands halfway)', 'Walk tall with the bell at your side.'),
      L('Hollow rocks', 'Hold the hollow shape and rock back and forth.'),
      L('Tuck L-sit (between two chairs)', 'Push down on the chairs, lift your knees off the floor.', { range: [10, 30] }),
    ],
  },
];

// MOVES is an object keyed by move id (use MOVE_LIST for an ordered array).
export const MOVES = Object.fromEntries(MOVE_LIST.map((m) => [m.id, m]));
export { MOVE_LIST };

export const DAYS = [
  { id: 'upper', name: 'Upper', moves: ['hpush', 'row', 'vpush', 'core', 'calf'] },
  { id: 'legs', name: 'Legs', moves: ['squat', 'hamcurl', 'calf', 'vpush', 'core'] },
  { id: 'full', name: 'Full body', moves: ['hinge', 'hpush', 'row', 'squat', 'hamcurl'] },
];

// Names for every day id ever stored, so old sessions (push, legs, pull) still display.
export const DAY_NAMES = { upper: 'Upper', legs: 'Legs', full: 'Full body', push: 'Push', pull: 'Pull + core' };
export const dayName = (id) => DAY_NAMES[id] || 'Session';

export const WORK_SEC_CHOICES = [30, 40, 45];
export const DEFAULT_WORK_SEC = 40;

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
