# streaks

A personal iPhone web app for daily 10-minute EMOM training (bodyweight + one kettlebell) and fasting, with streaks and strength progression.

All data stays on the phone, in the browser's local storage. Use Settings → Export backup to save a copy.

Open the site in Safari, tap Share, then Add to Home Screen.

Tests: `node --test tests/`

## Rest days
In Settings, pick up to 2 weekdays as planned rest days (`settings.restDays`, Mon = 0). A rest day with no training keeps the training streak, like a free streak freeze: it does not grow the streak and costs no freeze. Training on one counts as normal. Each change is stored by the date it took effect (`settings.restHistory`), so changing your rest days later never rewrites past streaks. The heatmap and week dots show rest days in their own colour. Fasting streaks ignore rest days.
