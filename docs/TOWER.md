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
| Focus ◆ | Completed fasts | Focus upgrades and the Forge |
| Souls ✦ | Ascending | Soul tree talents (spent by you) |

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
- **Souls** do nothing by themselves. They are spent in the Soul tree (Might and Vigour add +8% Attack or Health per level).
- **Speed** also shortens the walk between floors (see below), so Attack is the DPS check, Health is survival and Speed is both pace and DPS.

## Tower and combat
Combat is deterministic and closed form per fight, so the offline sim is cheap.

- **Enemy on floor n:** HP = 20 × 1.075^(n−1), ATK = 2 × 1.075^(n−1), 1 hit per second.
- **Elite (every 5th floor that is not a boss):** HP × 1.15, ATK × 1.1 (`eliteHp`, `eliteAtk`). Higher values stalled daily trainers for up to 2 weeks.
- **Boss (every 10th floor):** HP × 1.2, ATK × 1. Bosses are mild by design: harder bosses made multi-week stalls in the sim.
- **Hero DPS:** ATK × SPD × (1 + crit chance) × (1 + Grit), where crit means double damage.
- **Time to kill:** t = enemyHP / heroDPS.
- **Win (normal floor):** enemyATK × t < heroHP. The hero heals fully on each new floor.
- **Win (boss):** the same, and also t ≤ 30 s (boss enrage timer). Too slow loses even if the hero would survive.
- **Floor time:** t + 2 s / hero speed (walk time).
- **Loss:** the hero rests 10 s, then retries. Each failed try on a floor compounds Grit (temporary attack) by 0.07%, capped at +25%, which is reached after about 53 minutes of failing. Grit resets on clear. Grit softens a wall a little, it cannot beat a big one: a player who never trains stalls (around floor 16).
- **Offline progress:** on load, simulate min(now − lastTick, 24 h) seconds. The sim loops floor by floor, with a safety limit of 20,000 iterations.
- **Live:** while the Tower tab is open, the sim runs in real time and the canvas animates the current fight.

## Enemy traits (by zone)
Cellar has none. Later laps (Deep, Abyssal) add the trait of a zone further up, so they carry two. Numbers are in `CONFIG.trait`; `traitsOf(floor)` in scene.js is the source.
| Zone | Trait | Effect | Counter |
|---|---|---|---|
| Barracks | Armoured | each hero hit loses 1.5% of enemy HP (never below 30% of the hit) | Attack beats Speed |
| Library | Arcane | enemy damage +30% | Health, Guard |
| Crypt | Regenerating | enemy heals 1.5% max HP/s | burst damage |
| Forge | Burning | extra 0.3 × enemy attack per second, ignores Guard | Lifesteal |
| Frost Hall | Chilling | hero speed −25% | Swift |
| Sky Spire | Swift | 2 hits a second | Guard, Health |

The line under the battle panel and the canvas label name the trait ("Crypt: enemies regenerate. Burst damage helps.").

## Gear (boss drops)
- Each boss kill drops one item.
- **Slot:** chosen at random from weapon (Attack%), armour (Health%) and boots (Speed%).
- **Tier:** ceil(floor / 10).
- **Rarity:** common ×1 (70%), rare ×1.5 (25%), epic ×2.2 (5%). Focus "Luck" shifts 2% per level from common to epic.
- **Bonus:** 5% × tier × rarity.
- **Affixes:** common 1, rare 2, epic 3, no duplicates. Value = base × (1 + 0.06 × (tier−1)) × (0.8 to 1.2). Lifesteal 8% (heal that share of damage dealt), Thorns 10% (reflect that share of damage taken), Crit damage +25% (crit multiplier), Boss slayer +15%, Swift +6% speed, Guard −6% damage taken (total cap 50%), Zone ward +12% damage on floors with an enemy trait, Training +5% session Sweat (total cap +30%).
- **Fight maths (still closed form):** `fight()` returns `dps` (hero hit with Boss slayer, Zone ward, crit and armour, times speed with Swift and chill, plus Thorns × incoming, minus regen) and `net` (incoming with Arcane, swift hits and Guard, plus burn, minus Lifesteal × damage dealt). Win needs net × t < Health (or net ≤ 0) and, for a boss, t within the timer.
- **Power score:** base bonus (in %) plus each affix value (in %) × its weight. Shown on every item.
- **Auto-equip:** a higher power replaces the equipped item, unless that one is locked. The loser goes to the **stash** (last 6 unequipped, +1 per Hoarder level). Over the limit, the oldest unlocked item is scrapped for 5 × tier Sweat (the new drop itself if all are locked).
- **Lock:** locked items are never replaced by drops, and the stash never scraps them. Manual equip from the stash also waits for an unlock.
- **Log:** keep the last 5 drops for the "while you were away" note.

## Forge (Focus)
Tap a gear slot to open the gear sheet: forge, lock, and the stash for that slot. Cost = base × 1.35^tier × (1 − 5% per Ancestral forge level).
| Action | Base | Effect |
|---|---|---|
| Reroll | 40 | Re-roll one affix you pick (no duplicates) |
| Add an affix | 100 | One extra, once per item, up to rarity max + 1 |
| Upgrade rarity | 160 | common → rare → epic, adds an affix, raises the base bonus |
| Temper | 30 × 1.15^level | +1 item level, +5% base bonus each, no limit |

## Focus upgrades
Costs are in Focus.

| Upgrade | Effect | Max | Cost |
|---|---|---|---|
| Stamina (save key `endurance`) | +10% Sweat from sessions per level | 5 | 30 × 1.4^L |
| Precision | +2% crit chance | 20 | 30 × 1.25^L |
| Luck | +2% epic drop chance | 10 | 40 × 1.3^L |

## Soul tree
Souls are earned on ascend (floor(√ highest floor)). `game.souls` is the total earned, `game.soulsSpent` what is in talents, so old saves start with all their souls unspent. Cost = ceil(base × grow^level).
| Talent | Effect per level | Max | Base cost |
|---|---|---|---|
| Might | +8% Attack | 20 | 2 × 1.3^L |
| Vigour | +8% Health | 20 | 2 × 1.3^L |
| Head start | new runs start 5 floors higher (floor 1 + 5L), never past highest floor − 1 | 6 | 3 × 1.5^L |
| Second wind | +15 s boss timer | 3 | 3 × 1.6^L |
| Prospector | +10% session Sweat | 5 | 3 × 1.4^L |
| Hoarder | +1 stash slot | 4 | 2 × 1.5^L |
| Fortune | +2% epic chance | 5 | 3 × 1.4^L |
| Ancestral forge | −5% forge cost | 5 | 3 × 1.4^L |

Refund all talents is free, once per ascension (comes back when you ascend).

## Ascension
- **Needs:** 1 Ascend token (from a real level-up) and highest floor this run ≥ 20.
- **Gives:** floor(√(highest floor this run)) Souls, kept forever.
- **Resets:** floor to 1 (or the Head start floor) and gear, except the single best item (highest power), which stays equipped. Locked items stay too. Unlocked stash items are scrapped for Sweat.
- **Keeps:** stat levels, Focus upgrades, Sweat, Focus, Souls and that best gear item.
- **Souls:** spent in the Soul tree.
- **Optional:** the token waits until you choose to spend it.

## Session link
The end-of-session summary shows the Sweat that session paid (session plus level-up and PB bonuses), with an "Open Tower" button that closes the session and opens the Tower tab.

## Battery
The sim advances every frame, but painting is capped at about 20 fps and stops while the canvas is off screen (IntersectionObserver).

## Tuning
`node tools/tower-sim.mjs` simulates a daily trainer (greedy buyer, no events) and a player who never trains. The trainer also adds 60 Focus a day and spends it greedily on the Forge. See the sim output for the current numbers; the elite floors are the late walls.

## Tab UI (phone first)
1. **Battle panel:** a pixel canvas with the hero on the left and the enemy on the right. The badge reads like "Crypt · Floor 34 · boss in 6", shortened to "Crypt · F34 · boss 6" when the panel is under 340 px or the text would overflow. The trait line sits under the panel. The canvas label names the zone and enemy ("Crypt, floor 34: your hero fights a ghost"). It uses `image-rendering: pixelated`. See "Visual fight" and "Zones" below. With reduced motion it shows still frames: no lunges, floats, bobbing or flicker, and bars step instantly.
2. **"While you were away" banner:** shown once after the offline sim. Floors climbed, bosses beaten, best drop.
3. **Currency row:** Sweat, Focus, Souls. Tiles carry plain labels for VoiceOver and the glyphs are hidden from it.
4. **Stats:** 3 rows (level, current value, next value, cost button). The button is disabled when you can't afford it. Buying updates the rows in place (`refreshTowerUi`), so the canvas is never rebuilt. Buy buttons have labels like "Upgrade Attack to level 4 for 29 Sweat".
5. **Gear:** 3 slots (rarity colour, bonus, power, affix chips). Tap one for the gear sheet. A stash line sits underneath.
6. **Focus upgrades:** 3 rows. 6b. **Soul tree:** 8 rows like the stat rows, plus a refund row.
7. **Ascend card:** only when a token is held.
8. **"How you earn" footnote:** one line per source.

## Visual fight
Bars move only on hits. `schedule()` in view.js turns the sim's closed-form fight into discrete hits, so the visual fight ends exactly when the sim says.
- **Won fight:** round(t x hero speed) hero hits, the last one at the kill (time t). Damage per hit is enemy HP split evenly. Crits (a hash of floor and hit number against crit chance, so a floor always replays the same) weigh double, so the total is still enemy HP. The foe hits once a second for its full attack.
- **Lost try (hero would die, or boss timer):** 7 s of hits at the real rate, with damage scaled to what the sim says was dealt and taken, then the hero is knocked down ("KO") and stays down for the rest pause. The foe keeps the HP it had left.
- **Each hit:** lunge, target flash, floating number (crits are bigger and yellow), the bar eases down over about 130 ms, and a pale "recent damage" segment holds then catches up.
- Hits are applied from the sim's `prog` clock. After a new floor or try, a bought upgrade, or a gap of over 1.5 s, the schedule is rebuilt and caught up quietly (no effects), so it never drifts from the sim.

## Zones and scenery
`js/game/scene.js` (pure helpers `zoneOf`, `enemyKind`, `floorProps`, then drawing). Zones are 10-floor bands: 1-9 Cellar, 10-19 Barracks, 20-29 Library, 30-39 Crypt, 40-49 Forge, 50-59 Frost Hall, 60-69 Sky Spire. It then cycles, tinted ("Deep", then "Abyssal").
- Each zone has its own wall and floor palette and wall decor (torches, banners and weapon rack, bookshelves, green lanterns and cobwebs, furnace, icicles, open arches over clouds).
- **Per-floor props:** 2 to 4 props (barrel, crate, chest, crack, rug, lamp, bones, puddle, pile, and an anvil in the Forge) picked from the floor number, never on the fighters' tiles.
- The room is drawn once per floor and cached (4 floors kept). Lights (torches, lamps, candles, furnace) flicker with a cheap glow overlay, skipped with reduced motion.

## Enemies
- Each zone has a pool of 4. Within a zone the pick is a hash of the floor, so the same floor always shows the same enemy, and no floor repeats the one before. Every 5th floor that is not a boss is an **elite**: the same sprite with a thin red outline and faint aura, and +15% HP, +10% attack.
- Cellar: slime, armoured rat, mushroom creature, bat. Barracks: goblin, imp, skeleton, mimic. Library: ghost, cultist, spider, bat. Crypt: skeleton, gargoyle, ghost, spider. Forge: imp, fire elemental, golem, goblin. Frost Hall: ice golem, bat, skeleton, gargoyle. Sky Spire: gargoyle, ghost, imp, cultist.
- **Bosses** (32 x 40, the zone's boss on every 10th floor): Troll King (Cellar, from floor 70), Iron Knight (Barracks), Lich (Library), Death Knight (Crypt, a recolour), Demon Lord (Forge), Frost Dragon (Frost Hall), Sky Dragon (Sky Spire).

## Sprites
- Pixel maps stored as code-built string grids with a small palette, shaded and outlined by `finish()`. Enemies are about 24 x 28 and bosses 32 x 40, all in the same 3/4 chibi look, facing left.
- **Hero:** idle and attack frames. Knocked down is the idle frame rotated.
- Boss recolours are palette swaps of a base map; the elite outline is drawn on a padded copy.
- Drawn with the canvas `drawImage` call from small offscreen canvases, scaled by a whole number to the panel.

## Data
- Save in `state.game`, created lazily by `ensureGame(state)`.
- **Fields:** `sweat`, `focus`, `souls`, `tokens`, `stats {atk, hp, spd}`, `focusUp {endurance, precision, luck}`, `floor`, `runMax`, `bestFloor`, `grit`, `gear {weapon, armour, boots}` (items: `id, slot, tier, rarity, bonus, lvl, aff[{id,v}], lock, added`), `stash[]`, `talents{}`, `soulsSpent`, `respecUsed`, `seq`, `drops[]`, `paid{}`, `lastTick`, `away`.
- Export and import carry it automatically.

## Out of scope for v1
Sound, more than one hero, achievements.
