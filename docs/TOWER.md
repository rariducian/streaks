# Tower: idle battler spec (v1)

Your training and fasting fund a hero who climbs an endless tower on their own.
You check in for 1 to 2 minutes after a session, spend points, and look at the climb.

## Decisions (from the user)
- **Earning:** a mix. A steady pay for each session, plus big bonuses for real progress (level-ups, PBs). Reps are never counted.
- **Fantasy:** one hero climbs an endless tower. Every 10th floor has a boss.
- **Missed days:** the hero keeps climbing at its current power but earns no new points. Nothing decays.
- **Stats:** come from points only. Real training levels do not set stats directly.
- **Prestige:** an Ascend token is earned only by a real level-up on a move ladder.
- **Fasting:** earns a separate resource, Focus, with its own upgrades.
- **Placement:** its own bottom-nav tab, "Tower".
- **Look:** pixel sprites, drawn in code from pixel maps (our own art, no licence issues).
- **Upgrades:** stats plus gear drops from bosses.
- **Pace:** always moving, but power only comes from training. Grit helps a little (+25% at most), so a player who never trains stalls.
- **Check-in:** 1 to 2 minutes.

## Currencies
| Currency | Earned by | Spent on |
|---|---|---|
| Sweat ⚡ | Training | Hero stats |
| Focus ◆ | Completed fasts | Focus upgrades |
| Souls ✦ | Ascending | Permanent +% (automatic) |

### Sweat
- **Full session:** 100 × streak multiplier. The multiplier is 1 + 0.05 × min(training streak, 10), so the cap is ×1.5.
- **Minimum day:** 40 × streak multiplier.
- **Daily limit:** only the first 2 sessions on a date pay. The 2nd pays half. This stops points being farmed by repeating sessions.
- **Stamina:** session Sweat (not level-up or PB bonuses) is multiplied by 1 + 0.10 × Stamina level.
- **Level-up event:** +300, plus 1 Ascend token.
- **PB event:** +100.
- **History counts:** all past sessions and events pay once when the Tower first loads, as a welcome grant.
- **Idempotent:** every paid item is recorded by id in `game.paid`, so nothing ever pays twice. That includes re-sync, import and reload.

### Focus
- A completed fast that reached the "counts after" hours pays 30 + 5 × whole hours over that minimum, capped at 80.
- It pays once per fast id.

## Hero
| Stat | Formula | Upgrade cost (Sweat) |
|---|---|---|
| Attack | (5 + 2·L) × 1.5^⌊L/10⌋ × gear × souls | 20 × 1.04^L |
| Health | (50 + 15·L) × 1.5^⌊L/10⌋ × gear × souls | 20 × 1.04^L |
| Speed (hits/s) | min(3, 1 + 0.04·L) × gear | 25 × 1.05^L |

- **Milestones:** every 10 levels of Attack or Health multiplies that stat by 1.5. This keeps late floors falling for a daily trainer.
- **Gear** multiplies by (1 + slot bonus %).
- **Souls** multiply Attack and Health by (1 + 0.10 × souls).
- **Speed** also shortens the walk between floors (see below), so Attack is the DPS check, Health is survival and Speed is both pace and DPS.

## Tower and combat
Combat is deterministic and closed form per fight, so the offline sim is cheap.

- **Enemy on floor n:** HP = 20 × 1.075^(n−1), ATK = 2 × 1.075^(n−1), 1 hit per second.
- **Boss (every 10th floor):** HP × 1.2, ATK × 1. Bosses are mild by design: harder bosses made multi-week stalls in the sim.
- **Hero DPS:** ATK × SPD × (1 + crit chance) × (1 + Grit), where crit means double damage.
- **Time to kill:** t = enemyHP / heroDPS.
- **Win (normal floor):** enemyATK × t < heroHP. The hero heals fully on each new floor.
- **Win (boss):** the same, and also t ≤ 30 s (boss enrage timer). Too slow loses even if the hero would survive.
- **Floor time:** t + 2 s / hero speed (walk time).
- **Loss:** the hero rests 10 s, then retries. Each failed try on a floor compounds Grit (temporary attack) by 0.07%, capped at +25%, which is reached after about 53 minutes of failing. Grit resets on clear. Grit softens a wall a little, it cannot beat a big one: a player who never trains stalls (around floor 16).
- **Offline progress:** on load, simulate min(now − lastTick, 24 h) seconds. The sim loops floor by floor, with a safety limit of 20,000 iterations.
- **Live:** while the Tower tab is open, the sim runs in real time and the canvas animates the current fight.

## Gear (boss drops)
- Each boss kill drops one item.
- **Slot:** chosen at random from weapon (Attack%), armour (Health%) and boots (Speed%).
- **Tier:** ceil(floor / 10).
- **Rarity:** common ×1 (70%), rare ×1.5 (25%), epic ×2.2 (5%). Focus "Luck" shifts 2% per level from common to epic.
- **Bonus:** 5% × tier × rarity.
- **Better item:** auto-equipped.
- **Worse item:** scrapped for 5 × tier Sweat.
- **Log:** keep the last 5 drops for the "while you were away" note.

## Focus upgrades
Costs are in Focus.

| Upgrade | Effect | Max | Cost |
|---|---|---|---|
| Stamina (save key `endurance`) | +10% Sweat from sessions per level | 5 | 30 × 1.4^L |
| Precision | +2% crit chance | 20 | 30 × 1.25^L |
| Luck | +2% epic drop chance | 10 | 40 × 1.3^L |

## Ascension
- **Needs:** 1 Ascend token (from a real level-up) and highest floor this run ≥ 20.
- **Gives:** floor(√(highest floor this run)) Souls, kept forever.
- **Resets:** floor to 1 and gear, except the single best item (highest bonus), which stays equipped.
- **Keeps:** stat levels, Focus upgrades, Sweat, Focus, Souls and that best gear item.
- **Souls:** each gives +10% Attack and Health.
- **Optional:** the token waits until you choose to spend it.

## Session link
The end-of-session summary shows the Sweat that session paid (session plus level-up and PB bonuses), with an "Open Tower" button that closes the session and opens the Tower tab.

## Battery
The sim advances every frame, but painting is capped at about 20 fps and stops while the canvas is off screen (IntersectionObserver).

## Tuning
`node tools/tower-sim.mjs` simulates a daily trainer (greedy buyer, no events) and a player who never trains. Aim: trainer at floor 30 to 60 by day 30 and no 3 day gap in new floors across those 30 days. Non-trainer stalls by the end of week one.

## Tab UI (phone first)
1. **Battle panel:** a pixel canvas with the hero on the left and the enemy on the right. HP bars, a floor badge ("Floor 23 · boss in 7"), floating damage numbers, an attack lunge and a hit flash. It uses `image-rendering: pixelated`. With reduced motion it shows still frames and no floating numbers.
2. **"While you were away" banner:** shown once after the offline sim. Floors climbed, bosses beaten, best drop.
3. **Currency row:** Sweat, Focus, Souls. Tiles carry plain labels for VoiceOver and the glyphs are hidden from it.
4. **Stats:** 3 rows (level, current value, next value, cost button). The button is disabled when you can't afford it. Buying updates the rows in place (`refreshTowerUi`), so the canvas is never rebuilt. Buy buttons have labels like "Upgrade Attack to level 4 for 29 Sweat".
5. **Gear:** 3 slots (name, rarity colour, bonus).
6. **Focus upgrades:** 3 rows.
7. **Ascend card:** only when a token is held.
8. **"How you earn" footnote:** one line per source.

## Sprites
- 16×16 pixel maps stored as strings with a small palette.
- **Hero:** idle and attack frames.
- **Enemies:** slime, bat, skeleton, golem.
- **Boss:** a 24×24 knight or dragon.
- The enemy type cycles with the floor band.
- Drawn with the canvas `drawImage` call from small offscreen canvases scaled ×4 to ×6.

## Data
- Save in `state.game`, created lazily by `ensureGame(state)`.
- **Fields:** `sweat`, `focus`, `souls`, `tokens`, `stats {atk, hp, spd}`, `focusUp {endurance, precision, luck}`, `floor`, `runMax`, `bestFloor`, `grit`, `gear {weapon, armour, boots}`, `drops[]`, `paid{}`, `lastTick`, `away`.
- Export and import carry it automatically.

## Out of scope for v1
Skill tree, sound, more than one hero, achievements.
