# streaks

A personal iPhone web app for daily 10-minute EMOM training (bodyweight + one kettlebell) and fasting, with streaks and strength progression.

All data stays on the phone, in the browser's local storage. Use Settings → Export backup to save a copy.

Open the site in Safari, tap Share, then Add to Home Screen.

Tests: `node --test tests/`

## Rest days
In Settings, pick up to 2 weekdays as planned rest days (`settings.restDays`, Mon = 0). A rest day with no training keeps the training streak, like a free streak freeze: it does not grow the streak and costs no freeze. Training on one counts as normal. Each change is stored by the date it took effect (`settings.restHistory`), so changing your rest days later never rewrites past streaks. The heatmap and week dots show rest days in their own colour. Fasting streaks ignore rest days.

## Monthly recap
Progress has a "Monthly recap" card for any month with data: training days, sessions, best streak, reps, fasts, Tower floors, level-ups and a calendar, drawn on demand as a 1080 x 1350 PNG you can Share or Save (`js/recap.js`). In the first 3 days of a month, Today points at last month's. The Tower records `game.floorLog` (the floor each month started on) so floors climbed can be shown; months before that show a dash.

## How levelling works
Each level has a rep range (min to max). Each move shows a target for the next session.
- The target rises to your lowest set plus 1 (plus 5 s for core), up to the max.
- Level up when every set at the level reaches the max.
- Level down when the average of your sets is below the min in 2 sessions in a row.
- Per-side levels get one work slot per side. Minimum days never change targets.

The work time (30, 40 or 45 s, in Settings) is part of the maths. Every rep level has `sec`, the realistic seconds per rep at its tempo (`js/data.js`). `rangeOf` fits the range to the window: max = min(max, floor((work - 3 s setup) / sec)), and min comes down to stay within 2 of it. Core is timed, so its max is just capped at the work time. Levels that were cut say so ("Max 10 (fits 40 s work)") in the Levels list. On load, a stored target above the fitted max is clamped down; levels are never changed.

Fitness, Progress by move: tap a move for its trend. It plots the average reps (or seconds) per session at the current level, a least-squares trend line and the level-up mark; earlier levels are faded with a marker at each level-up. It needs 4 sessions at the level. The estimate ("About 5 sessions to level up") uses your latest lowest set, the max and the slope, rounds up and stops at "20+". A flat or falling line gets no estimate. It is a guide, not a promise. The maths is in `js/logic.js` (`leastSquares`, `sessionsToLevelUp`, `moveSeries`).
