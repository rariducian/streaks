// Vertical push ladder: form data for every level. Keyframes come from vpush.gen.js (see tools/author-vpush.mjs).
// Contract: see hpush.js.
import GEN from './vpush.gen.js';
import { TOE_CUE } from '../cues-common.js';

const SRC_KB = [
  'StrongFirst: kettlebell press technique (rack position, straight wrist, glutes and belly braced, bicep by the ear)',
  'ACE Exercise Library: Shoulder press',
  'NSCA, Essentials of Strength Training and Conditioning: overhead press technique',
];
const SRC_PIKE = [
  'ACE Exercise Library: Push-up (hand placement and elbow angle)',
  'NSCA, Essentials of Strength Training and Conditioning: push-up and overhead pressing technique',
  'The pike push-up and the wall handstand negative are calisthenics progressions. The sources above do not cover them in detail, so the pose applies their general pressing technique.',
];
const g = (i) => GEN[i];
const mk = (i, extra) => {
  const { wrong = {}, ...rest } = g(i);
  const m = (list) => list.map(({ wp, ...o }) => (wp ? { ...o, wrongPose: wrong[wp] } : o));
  return { loop: true, ...rest, ...extra, cues: { ...extra.cues, mistakes: m(extra.cues.mistakes) } };
};

const RACK_SETUP = 'Stand with your feet hip-width apart and flat. Bring the bell to the rack with a clean you know (do not swing it up): elbow by your ribs, forearm vertical, wrist straight, bell resting on your forearm and chest.';
const BRACE_SETUP = 'Squeeze your glutes and brace your belly. Pull your ribs down so your lower back stays long and does not arch. Keep your other arm relaxed by your side.';
const LEAN = { wp: 'lean', mistake: 'You lean back and your lower back arches.', fix: 'Squeeze your glutes, brace your belly and pull your ribs down. Use a lighter bell or end the set when you start to lean.', highlight: ['spine', 'chest'] };
const WRIST = { wp: 'wrist', mistake: 'Your wrist bends back and the bell pulls on it.', fix: 'Keep your wrist straight, in line with your forearm. Hold the handle across the heel of your palm and grip firmly.', highlight: ['wrist_L'] };
const FORWARD = { wp: 'forward', mistake: 'The bell finishes in front of your head.', fix: 'Press up and slightly back, past your face. Finish with your bicep by your ear.', highlight: ['shoulder_L', 'elbow_L'] };

const HEAD_SETUP = 'Fold a towel or put a mat under the spot where your head will land. Your head only touches it lightly.';
const FLARE = { wp: 'flare', mistake: 'Your elbows flare out wide, like the letter T.', fix: 'Point your elbows back at about 45° from your body and keep your forearms close to upright.', highlight: ['elbow_L', 'elbow_R', 'shoulder_L', 'shoulder_R'] };
const LOW = { wp: 'low', mistake: 'Your hips sink and the move turns into a normal push-up.', fix: 'Walk your feet in a little and push your hips up and back towards the ceiling.', highlight: ['hip_L', 'hip_R'] };
const BOUNCE = { mistake: 'You drop onto your head or put your weight on it.', fix: 'Lower for the full count and touch the towel lightly. Keep the weight in your arms. Stop higher if you cannot control it.', highlight: ['neck', 'head'] };

export default {
  0: mk(0, {
    toesCurled: false,
    checks: { neutralSpine: 6, maxTorsoLeanDeg: 8 },
    tempo: { point: 'wrist_L', axis: 1, lower: 2, press: 1 },
    props: [{ type: 'kettlebell', attach: 'wrist_L', offset: [0, 0.07, 0.075], flipX: true, heldBy: ['wrist_L'] }],
    cues: {
      setup: [RACK_SETUP, BRACE_SETUP],
      movement: [
        'Breathe in at the rack. Press the bell straight up for about 1 second, keeping your wrist straight and your forearm vertical.',
        'Finish with your arm straight and your bicep by your ear, ribs down. Pause for a moment.',
        'Breathe out as you press. Then lower the bell back to the rack for about 2 seconds, under control. Do not let it drop.',
        'Do all your reps on one arm, then swap. The reps count per arm.',
      ],
      mistakes: [LEAN, WRIST, FORWARD],
      stopIf: { sign: 'Sharp pain or pinching in your shoulder, neck, wrist or lower back, or you cannot keep your ribs down.', easier: 'Use a lighter bell, or a light dumbbell, with the same form.' },
    },
    sources: SRC_KB,
  }),
  1: mk(1, {
    toesCurled: false,
    checks: { neutralSpine: 6, maxTorsoLeanDeg: 8 },
    tempo: { point: 'wrist_L', axis: 1, lower: 3, press: 1 },
    props: [{ type: 'kettlebell', attach: 'wrist_L', offset: [0, 0.07, 0.075], flipX: true, heldBy: ['wrist_L'] }],
    cues: {
      setup: [RACK_SETUP, BRACE_SETUP],
      movement: [
        'Breathe in at the rack. Press the bell straight up for about 1 second, keeping your wrist straight and your forearm vertical.',
        'Finish with your arm straight and your bicep by your ear, ribs down. Pause for a moment.',
        'Breathe out as you press. Then lower the bell for a slow count of 3 seconds, keeping your ribs down all the way to the rack.',
        'Do all your reps on one arm, then swap. The reps count per arm.',
      ],
      mistakes: [LEAN, { mistake: 'You drop the bell fast and it crashes into your forearm.', fix: 'Lower for the full 3 seconds. If you cannot control it, use a lighter bell or press with the normal tempo first.', highlight: ['elbow_L', 'wrist_L'] }, WRIST],
      stopIf: { sign: 'Sharp pain or pinching in your shoulder, neck, wrist or lower back, or you cannot keep your ribs down while you lower.', easier: 'KB press 10kg (each arm) at the normal tempo.' },
    },
    sources: SRC_KB,
  }),
  2: mk(2, {
    toesCurled: true,
    checks: { neutralSpine: 6, maxTorsoLeanDeg: 180, armFlare: [25, 50] },
    tempo: { point: 'head_top', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: ['Put your hands on the floor a little wider than your shoulders, fingers spread and pointing forward. Put your feet hip-width apart with your hips high, in an upside-down V.', HEAD_SETUP, TOE_CUE],
      movement: [
        'Breathe in. Lower for about 2 seconds with your elbows at about 45° from your body. Keep your hips high and your back flat.',
        'Let your head travel forward of your hands so your head and hands make a triangle. Touch the top of your head lightly to the towel.',
        'Breathe out and press the floor away for about 1 second until your arms are straight and your hips are high again.',
      ],
      mistakes: [LOW, FLARE, BOUNCE],
      stopIf: { sign: 'Pain or pressure in your neck, shoulders or wrists, pain in your big toe, or you feel dizzy with your head low.', easier: 'Tempo KB press (3s down, each arm).' },
    },
    sources: SRC_PIKE,
  }),
  3: mk(3, {
    toesCurled: true,
    checks: { neutralSpine: 6, maxTorsoLeanDeg: 180, armFlare: [25, 50] },
    tempo: { point: 'head_top', axis: 1, lower: 2, press: 1 },
    cues: {
      setup: ['Put your toes on a sturdy chair seat and push the chair against a wall so it cannot slide. Put your hands on the floor a little wider than your shoulders, with your hips high.', HEAD_SETUP, TOE_CUE],
      movement: [
        'Breathe in. Lower for about 2 seconds with your elbows at about 45° from your body. Keep your hips high and your back flat.',
        'Let your head travel forward of your hands so your head and hands make a triangle. Touch the top of your head lightly to the towel.',
        'Breathe out and press the floor away for about 1 second until your arms are straight.',
      ],
      mistakes: [LOW, FLARE, { mistake: 'The chair slides or wobbles.', fix: 'Put the chair against a wall, or use a firm box that cannot move.', highlight: ['toe_L', 'toe_R'] }],
      stopIf: { sign: 'Pain or pressure in your neck, shoulders or wrists, pain in your big toe, or you feel dizzy with your head low.', easier: 'Pike push-up.' },
    },
    sources: SRC_PIKE,
  }),
  4: mk(4, {
    // The bottom tripod position is not yet credible on this rig (body drifts off the wall,
    // forearms ~55° from vertical), so the viewer shows the written cues only.
    textOnly: true,
    toesCurled: false,
    checks: { neutralSpine: 6, maxTorsoLeanDeg: 180 },
    tempo: { point: 'head_top', axis: 1, lower: 5, press: 2.5 },
    cues: {
      setup: [
        'Use a clear wall, a firm floor and nothing hard nearby. Put a folded cushion or mat about 10 cm thick where your head will land. Ask someone to watch you if you can.',
        'Put your hands shoulder-width apart, about 15 to 20 cm from the wall. Kick up gently, one leg and then the other, until your heels touch the wall. Do not kick hard.',
        'Push the floor away to keep your shoulders tall. Squeeze your glutes, brace your belly and look at the floor between your hands.',
      ],
      movement: [
        'Breathe in. Lower for about 5 seconds with your elbows at about 45° from your body. Keep your belly braced so your back does not arch.',
        'Let your head touch the cushion lightly so your head and hands make a triangle. Pause for about 1 second without resting your weight on your head.',
        'Breathe out. The animation shows the press back up (about 2 seconds). If you cannot press up, tuck your knees and step down one foot at a time. Never fall or roll out.',
      ],
      mistakes: [
        { wp: 'arch', mistake: 'Your lower back arches and your ribs flare.', fix: 'Squeeze your glutes, brace your belly and keep your ribs down. End the set when you cannot hold the line.', highlight: ['spine', 'chest'] },
        { mistake: 'You drop fast instead of lowering under control.', fix: 'Stop the set. Go back to the elevated pike push-up until you can lower for the full 5 seconds.', highlight: ['elbow_L', 'elbow_R'] },
        BOUNCE,
      ],
      stopIf: { sign: 'Pain or pressure in your neck or head, pain in your shoulders, wrists or lower back, dizziness, or you cannot control the descent.', easier: 'Elevated pike push-up.' },
    },
    sources: SRC_PIKE,
  }),
};
