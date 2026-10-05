// Horizontal push ladder: form data for every level. Keyframes come from hpush.gen.js (see tools/author-hpush.mjs).
// Contract per level (all levels of every move follow this):
//   { duration, loop:true, keyT, contacts:[point names], support?:{point:y}, props:[...], keyframes:[{t, root:{pos,rot}, joints}],
//     toesCurled?, checks:{...}, cues:{ setup[2-3], movement[2-4], mistakes:[{mistake, fix, wrongPose?, highlight?}] (2-3), stopIf:{sign, easier} }, sources:[...] }
import GEN from './hpush.gen.js';
import { TOE_CUE } from '../cues-common.js';

const SRC = [
  'ACE Exercise Library: Push-up',
  'NSCA, Essentials of Strength Training and Conditioning: push-up technique',
  'ACSM, Guidelines for Exercise Testing and Prescription: push-up technique',
];
const SRC_PROGRESSION = [...SRC, 'Archer, pseudo-planche and one-arm push-ups are calisthenics progressions. The sources above do not cover them in detail, so the pose applies their general push-up technique.'];
const LINE = 'Body in one straight line from head to heels: squeeze your glutes and brace your belly.';
const HIPS = ['hip_L', 'hip_R', 'spine'];
const ELB = ['elbow_L', 'elbow_R', 'shoulder_L', 'shoulder_R'];
const g = (i) => GEN[i];
const mk = (i, extra) => {
  const { wrong = {}, ...rest } = g(i);
  const m = (list) => list.map(({ wp, ...o }) => (wp ? { ...o, wrongPose: wrong[wp] } : o));
  const cues = extra.cues;
  return { loop: true, toesCurled: true, ...rest, ...extra, cues: { ...cues, mistakes: m(cues.mistakes) } };
};
const SAG = { wp: 'sag', mistake: 'Your hips sag and your lower back arches.', fix: 'Squeeze your glutes and brace your belly. End the set when you cannot hold the line.', highlight: HIPS };
const FLARE = (more) => ({ wp: 'flare', mistake: 'Your elbows flare out wide, like the letter T.', fix: more || 'Point your elbows back at about 45° and keep your forearms close to upright.', highlight: ELB });
const PIKE = { wp: 'pike', mistake: 'Your hips pike up towards the ceiling.', fix: 'Lower your hips until your shoulders, hips and heels line up.', highlight: ['hip_L', 'hip_R'] };

export default {
  0: mk(0, {
    checks: { straightLine: true, armFlare: [25, 50] },
    tempo: { point: 'chest', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: ['Hands on the floor just wider than your shoulders, fingers spread and pointing forward.', `Feet hip-width apart on your toes. ${LINE}`, TOE_CUE],
      movement: [
        'Breathe in. Lower for about 2 seconds with your elbows at about 30 to 45° from your body (an arrow shape, not a T).',
        'Stop when your chest is about a fist from the floor. Pause for a moment with your shoulder blades set.',
        'Breathe out and press the floor away for about 1 second until your arms are straight.',
        'Keep your neck long. Look at the floor just ahead of your hands.',
      ],
      mistakes: [SAG, FLARE(), PIKE],
      stopIf: { sign: 'Sharp or pinching pain in your wrists, shoulders, elbows or lower back, or pain in your big toe.', easier: 'Push-up from your knees, or with your hands on a bench or table.' },
    },
    sources: SRC,
  }),
  1: mk(1, {
    checks: { straightLine: true, armFlare: [25, 50] },
    tempo: { point: 'chest', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: ['Put each hand on a firm stack of books about 7 cm high, on carpet or a mat so they cannot slide. Hands just wider than your shoulders.', `Feet hip-width apart on your toes. ${LINE}`, TOE_CUE],
      movement: [
        'Breathe in. Lower for about 2 seconds with your elbows at about 30 to 45° from your body.',
        'Let your chest pass below your hands, but only as far as your shoulders feel comfortable. Keep your shoulder blades set.',
        'Breathe out and press up for about 1 second until your arms are straight.',
      ],
      mistakes: [SAG, FLARE(), { mistake: 'The books slide or tip.', fix: 'Use heavy hardcover books on a rug or mat, or two firm blocks.', highlight: ['wrist_L', 'wrist_R'] }],
      stopIf: { sign: 'Pain or pinching at the front of your shoulder at the bottom, or pain in your wrists, elbows or big toe.', easier: 'Standard push-up' },
    },
    sources: SRC,
  }),
  2: mk(2, {
    checks: { straightLine: true, armFlare: [5, 25] },
    tempo: { point: 'chest', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: ['Put your hands under your lower chest with your index fingers and thumbs close together. If your wrists complain, set your hands a hand width apart.', `Feet hip-width apart on your toes. ${LINE}`, TOE_CUE],
      movement: [
        'Breathe in. Lower for about 2 seconds with your elbows brushing your sides.',
        'Stop when your chest is about a fist from your hands.',
        'Breathe out and press up for about 1 second until your arms are straight.',
      ],
      mistakes: [FLARE('Keep your elbows close to your ribs, pointing back.'), SAG, { mistake: 'Your hands sit too far forward and your wrists bend sharply.', fix: 'Place your hands under your lower chest and turn your fingers out a little.', highlight: ['wrist_L', 'wrist_R'] }],
      stopIf: { sign: 'Pain in your wrists, elbows or the front of your shoulders, or pain in your big toe.', easier: 'Deficit push-up (hands on books)' },
    },
    sources: SRC,
  }),
  3: mk(3, {
    checks: { straightLine: true, armFlare: [25, 50] },
    tempo: { point: 'chest', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: ['Put your toes on a sturdy chair seat. Push the chair against a wall so it cannot slide.', `Hands on the floor just wider than your shoulders. ${LINE}`, TOE_CUE],
      movement: [
        'Breathe in. Lower for about 2 seconds with your elbows at about 30 to 45° from your body.',
        'Keep your belly braced so your hips do not drop. Stop when your chest is about a fist from the floor.',
        'Breathe out and press up for about 1 second until your arms are straight.',
        'Look at the floor just ahead of your hands.',
      ],
      mistakes: [PIKE, SAG, { mistake: 'The chair slides or wobbles.', fix: 'Put the chair against a wall, or use a firm box that cannot move.', highlight: ['toe_L', 'toe_R'] }],
      stopIf: { sign: 'Pain in your neck, shoulders, wrists, lower back or big toe, or you feel dizzy with your head low.', easier: 'Diamond push-up' },
    },
    sources: SRC,
  }),
  4: mk(4, {
    checks: { straightLine: true },
    tempo: { point: 'chest', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: ['Put your hands about twice shoulder-width apart, fingers turned slightly out. Feet hip-width apart on your toes.', LINE, TOE_CUE],
      movement: [
        'Breathe in. Shift your weight over one hand and lower for about 2 seconds, bending that elbow to about 45° from your body.',
        'Keep the other arm straight with its hand flat on the floor. It supports you and does not push hard.',
        'Breathe out and press back up for about 1 second to the middle. Then lower over the other side.',
      ],
      mistakes: [{ wp: 'bentArm', mistake: 'You bend the straight arm and turn it into a wide push-up.', fix: 'Keep that elbow long and let the working arm do the lowering.', highlight: ['elbow_R', 'wrist_R'] }, SAG, { mistake: 'You drop quickly to one side.', fix: 'Lower for the full 2 seconds and keep your hips level.', highlight: ['shoulder_L'] }],
      stopIf: { sign: 'Pain in your wrists, elbows or shoulders (especially in the straight arm), or pain in your big toe.', easier: 'Feet-elevated push-up' },
    },
    sources: SRC_PROGRESSION,
  }),
  5: mk(5, {
    checks: { straightLine: true, armFlare: [5, 30] },
    tempo: { point: 'chest', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: ['Warm up your wrists first. Put your hands by your lower ribs, fingers pointing a little out.', `Lean forward until your shoulders are ahead of your hands. ${LINE}`, TOE_CUE],
      movement: [
        'Breathe in. Lower for about 2 seconds with your elbows tucked close to your ribs and pointing back.',
        'Keep your shoulders ahead of your hands. Stop when your chest is about a fist from the floor.',
        'Breathe out and press up for about 1 second until your arms are straight.',
      ],
      mistakes: [SAG, { mistake: 'Your shoulders slide back over your hands, so you lose the lean.', fix: 'Shift your weight forward and keep your toes planted before you lower.', highlight: ['shoulder_L', 'shoulder_R'] }, { mistake: 'The heels of your hands lift off the floor.', fix: 'Press the whole palm into the floor and lean a little less.', highlight: ['wrist_L', 'wrist_R'] }],
      stopIf: { sign: 'Pain in your wrists, the front of your shoulder or the inside of your elbow, or pain in your big toe.', easier: 'Archer push-up' },
    },
    sources: SRC_PROGRESSION,
  }),
  6: mk(6, {
    checks: { straightLine: true },
    tempo: { point: 'chest', axis: 1, lower: 3, press: 1.5 },
    cues: {
      setup: ['Put one hand under your chest. Put the other hand on a book to the side and use it as lightly as you can.', `Feet wider than your hips for balance. ${LINE}`, TOE_CUE],
      movement: [
        'Breathe in. Lower for about 3 seconds, mostly on the working arm, with that elbow close to your ribs.',
        'Keep your shoulders and hips as square as you can. A small twist is fine.',
        'Breathe out and press up for about 1.5 seconds. Use the helper hand only to finish the rep.',
        'Do the same number of reps on each side. Swap hands each set.',
      ],
      mistakes: [SAG, { mistake: 'You push hard with the helper hand.', fix: 'Slide that hand further out or reduce the book height until it only touches.', highlight: ['wrist_R'] }],
      stopIf: { sign: 'Pain in your wrists, elbows, shoulders or lower back, or pain in your big toe.', easier: 'Pseudo-planche push-up' },
    },
    sources: SRC_PROGRESSION,
  }),
};
