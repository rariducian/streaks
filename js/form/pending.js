// Levels that have no 3D pose yet, by move id. Keep this in step with the pose files:
// when a pose is authored, remove its level here (tests/form.test.mjs checks both ways).
export const GUIDE_PENDING = {
  hinge: [0, 2],
  row: [0, 1, 2, 3, 4],
  hamcurl: [0, 1, 2, 3, 4],
  calf: [0, 1, 2, 3],
};

export const isGuidePending = (moveId, level) => (GUIDE_PENDING[moveId] || []).includes(level);
