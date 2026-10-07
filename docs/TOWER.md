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
- A completed fast that reached the "counts after" hours pays 60 + 10 × whole hours over that minimum, capped at 160. A 16 h fast on the default 12 h minimum pays 100.
- Each boss kill pays ceil(floor × 0.2) Focus (floor 60: 12), so income keeps pace with forge costs.
- It pays once per fast id.

### Boss Keys
- A boss needs a key. Normal floors never do.
- **Earned by training:** each paid session gives 1 (the first 2 sessions on a date, minimum days count, same as Sweat) and each level-up gives 1 more. Paid through `syncRewards`, once each, recorded in `game.paid` as `ks:<session id>` and `ke:<event id>`.
- **Cap:** 5 held (`CONFIG.keyCap`), +1 per Key Ring level (`keyCap(g)`). Keys over the cap are lost, but still marked paid.
- **Welcome grant:** the first sync pays history at most 3 keys in total (`welcomeKeys`, flag `kw`), so an old save does not arrive with a pile. Saves from before keys also start with 1 (`migrateKeys`).
- **At the door:** `advance` on a boss floor with no key (and none already spent on it) waits: no tries, no Grit, time passes with no progress. `game.waiting` records it, `atDoor(g)` computes it. Offline catch-up follows the same rules and the away summary says "Waiting at the boss door. Train to earn a key."
- **Spending:** the key goes on the first try at that boss (`game.keyFor` = the boss floor). Retries of the same boss are free, so a lost fight never burns a second key. A win clears `keyFor`. Ascending clears it too.

## Hero
| Stat | Formula | Upgrade cost (Sweat) |
|---|---|---|
| Attack | (5 + 2·L) × 1.5^⌊L/10⌋ × gear × souls × set | 20 × 1.038^L |
| Health | (50 + 15·L) × 1.5^⌊L/10⌋ × gear × souls × set | 20 × 1.038^L |
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
Tap a gear slot to open the gear sheet: forge, lock, and the stash for that slot. Cost = base × 1.1^tier × (1 − 5% per Ancestral forge level) × (1 − 3% per Forge Mastery level).
| Action | Base | Effect |
|---|---|---|
| Reroll | 20 | Re-roll one affix you pick (no duplicates) |
| Add an affix | 50 | One extra, once per item, up to rarity max + 1 |
| Upgrade rarity | 80 | common → rare → epic, adds an affix, raises the base bonus |
| Temper | 15 × 1.15^level | +1 item level, +20% base bonus each, no limit |

## Focus upgrades
Costs are in Focus: ceil(base × grow^level). The first 5 are always open. The rest unlock when a boss floor has been beaten, tracked by `game.bossBest`.

| Upgrade (save key) | Effect per level | Max | Cost | Unlocks |
|---|---|---|---|---|
| Stamina (`endurance`) | +10% Sweat from sessions | 5 | 30 × 1.12^L | open |
| Precision | +2% crit chance | 20 | 30 × 1.06^L | open |
| Luck | +2% epic drop chance | 10 | 40 × 1.12^L | open |
| Iron Skin (`iron`) | −2% damage taken (multiplies Guard) | 10 | 20 × 1.12^L | open |
| Quick Hands (`hands`) | +2% speed, after the Speed cap like gear | 10 | 20 × 1.12^L | open |
| Warlord's Edge (`warlord`) | +3% damage to bosses (adds to Boss slayer) | 10 | 25 × 1.12^L | floor 10 boss |
| Second Breath (`breath`) | +1% lifesteal (counts like the affix) | 5 | 30 × 1.12^L | floor 20 boss |
| Thornmail (`thorn`) | +2% thorns (counts like the affix) | 10 | 30 × 1.12^L | floor 30 boss |
| Forge Mastery (`mastery`) | −3% forge cost, multiplies Ancestral forge | 10 | 40 × 1.12^L | floor 40 boss |
| Treasure Sense (`sense`) | +4% chance a boss drop is one tier higher | 5 | 40 × 1.12^L | floor 50 boss |
| Key Ring (`ring`) | +1 key cap | 3 | 50 × 1.12^L | floor 60 boss |
| Overkill (`overkill`) | +5% crit damage | 10 | 40 × 1.12^L | floor 70 boss |
| Time Dilation (`dilation`) | +5 s boss timer | 4 | 60 × 1.12^L | floor 80 boss |
| Ascendant (`ascendant`) | +1 soul per ascension | 3 | 100 × 1.12^L | floor 100 boss |
| Fortify (`fortify`) | +3% Health | 10 | 20 × 1.12^L | floor 90 boss |
| Keen Edge (`keen`) | +3% Attack | 10 | 20 × 1.12^L | floor 110 boss |
| Gilded Keys (`gilded`) | +5% chance a paid session gives 1 extra key (cap 100%) | 5 | 80 × 1.12^L | floor 130 boss |
| Echo (`echo`) | +3% chance a boss drops a second item (cap 30%) | 5 | 100 × 1.12^L | floor 150 boss |

- **Boss record:** `game.bossBest` is the highest boss floor ever beaten. It is set when a boss falls (live or offline) and survives ascension. Old saves start with the last multiple of 10 below `bestFloor`. A buy is refused while `bossBest` is under the upgrade's `need` (`focusOpen`).
- **Unlock news:** `advance()` returns `unlocked` (ids a new record opened). The live loot card adds "New Focus upgrade: Thornmail" and the away summary (`away.unlocked`) says the same.
- **Cost of everything** (all new ones at max, without Precision) is about 9,800 Focus, so about 2,000 buys the cheap survival upgrades and a few of the later ones, not the lot.

### Level caps
`CONFIG.capBosses` = [30, 60, 90, 120, 150]. Each milestone `game.bossBest` has reached raises every upgrade's max (`focusMax(g, up)`). Default: +50% of the base max, rounded up (10: 15, 20, 25, 30, 35; 5: 8, 11, 14, 17, 20). `capStep` overrides: Key Ring, Time Dilation, Ascendant +1 (Key Ring tops out at 8), Stamina +2, Second Breath +2, Treasure Sense +2, Luck +5. An upgrade with an effect `cap` (Forge Mastery 75%, Treasure Sense 60%, Echo 30%, Gilded Keys 100%) never offers levels past it. Cost keeps growing as grow^level, so the high levels are the Focus sink. Caps never fall (bossBest is lifetime) and saves are clamped to the current cap on load.
- **Guards:** damage taken never under 40% (Guard and Iron Skin together, `dmgMin`), lifesteal total (gear, sets, Second Breath) at most 30%, epic chance at most 75% (`epicMax`), crit chance at most 100% (`critMax`), Training bonus at most 30% (as before).
- **Gilded Keys:** the extra key is rolled once per session, when its key is first paid: a hash of the session id against the chance. The result is stored in `paid['ks:id']`, so re-syncing never changes it. Keys still stop at the key cap and the daily limit of 2 paying sessions.
- **Echo:** after a boss drop, one more roll; success gives a second item (it also rolls Treasure Sense).
- **News:** `advance()` also returns `capsUp` when a new record crossed a milestone. The loot card and the away summary say "Focus caps raised: max levels +50%". Rows at max with a higher cap coming say "Max for now. Rises to 20 at the floor 90 boss"; a line under the header says "Next cap raise: floor 60 boss (+50% max levels)".
- **Sense:** rolls one extra die per boss kill, only when the level is above 0.

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
- **Gives:** floor(√(highest floor this run)) Souls, plus 1 per Ascendant level. Kept forever.
- **Resets:** floor to 1 (or the Head start floor) and gear, except the single best item (highest power), which stays equipped. Locked items stay too. Unlocked stash items are scrapped for Sweat.
- **Keeps:** stat levels, Focus upgrades, Sweat, Focus, Souls and that best gear item.
- **Souls:** spent in the Soul tree.
- **Optional:** the token waits until you choose to spend it.

## Pets
Eggs come from sessions, fasting hours hatch them, and one active pet grows and gives a small bonus. All numbers are in `CONFIG.pets`. Save: `game.pets = { init, n, eggs: [{ id, warm }], owned: { species: { lv, xp } }, active }`, tidied by `ensureGame`.
- **Eggs:** every 10 sessions (`every`, any session, counted once each in `pets.n`) lays an egg. You hold at most 3 (`maxEggs`). Over that, the egg becomes `overflowXp` (30) for the active pet instead.
- **Warmth:** each completed fast (it has an end) adds floor(hours) to the first egg that is not ready. Warmth past `need` (16) carries to the next egg, and is lost if every egg is ready. A fast still running never counts, and a finished one counts once.
- **Hatch:** a tap (`hatchEgg`) on a ready egg (warm >= 16). The species is rolled from those you do not own yet. With all 8 owned it rolls any of them and gives that pet `dupeXp` (60) instead. The first pet ever is made active. The hatch sheet shows it with a pop-in (none under reduced motion) and a Make active button.
- **XP:** only the active pet grows: +floor(hours) per completed fast and +4 (`sessionXp`) per session. Level L needs 10 x L XP to reach L + 1. Max level 10 (`maxLv`), where XP stops. With no active pet, XP is lost.
- **Effect:** only the active pet counts. value = base + per x (Lv - 1). It uses the set-bonus keys and is added to them by `bonusFx(g)` (set bonuses plus `petFx(g)`), which `heroStats`, `affixTotal` and `bossTimer` read. `setFx` and the compare panel's set logic are unchanged. Owl's `focus` is read in `syncRewards`: Focus per fast = round(normal Focus x (1 + owl)). Lifesteal and Training stay under their usual caps. With no pet, every number is as before.
| Pet | Effect | Lv 1 | Per level | Lv 10 |
|---|---|---|---|---|
| Ember Fox | Attack | +3% | +1% | +12% |
| Shell Tortoise | Health | +3% | +1% | +12% |
| Gale Hawk | Speed | +2% | +0.6% | +7.4% |
| Lucky Cat | Crit chance | +2% | +0.5% | +6.5% |
| Moss Toad | Lifesteal | +2% | +0.5% | +6.5% |
| Gold Beetle | Sweat from sessions | +3% | +1% | +12% |
| Night Owl | Focus from fasts | +5% | +2% | +23% |
| Clock Snail | Boss timer | +5% | +2% | +23% |
- **Sync:** a pets pass at the end of `syncRewards`, keyed in `game.paid` by `pe:<session id>` and `pw:<fast id>`, so every item counts once and re-syncing changes nothing. It returns `eggs` (laid), `ready` (became ready) and `petLv` (levels gained). The app toasts "An egg was laid." and "An egg is ready to hatch."
- **First pass (history):** every existing session and completed fast is marked paid with no warmth or XP. You get min(floor(sessions / 10), 2) eggs (`welcomeEggs`), the first one already ready. `pets.n` starts at the session count, so the next egg comes on the usual schedule.
- **Pets card:** between Hero and Gear (`#tw-pets`): the active pet (sprite, level, XP bar, effect), each egg (a bar of warm hours, or a Hatch button), other owned pets (Choose) and a line on how eggs work with "Next egg in N sessions." The How you earn card has an eggs line.
- **Battle:** the active pet stands on the ground just behind and left of the hero (HERO x - 16), with a 2 frame idle bob and a small hop as the enemy falls. Reduced motion shows one still frame. The canvas label names it.
- **Art:** `PET_MAPS` in sprites.js (8 species plus `egg` and `crack`, 12 to 14 wide, two idle frames each, outlined in ink, light from the top left), kept apart from `MAPS` so the unit tests are unaffected. `getPet(kind, frame)` gives a cached canvas, `petIcon(kind)` a data URL for the UI.

## Session link
The end-of-session summary shows the Sweat that session paid (session plus level-up and PB bonuses), with an "Open Tower" button that closes the session and opens the Tower tab.

## Battery
The sim advances every frame, but painting is capped at about 20 fps and stops while the canvas is off screen (IntersectionObserver).

## Live boss fight
- After a session, if the hero is at a boss door or will reach one within 2 floors (`fightFloor`, `CONFIG.fightAhead`) and a key is held (or already spent on that boss), the summary shows "Fight the boss" next to Done and Open Tower.
- It opens the Tower, climbs to the door with the time away (`readyBoss`, stops at the door) and plays the fight in real time.
- **Kill:** an 80 ms hit-stop on the last hit, a 2.5 px screen shake for 240 ms (both skipped with reduced motion), then a loot card over the canvas: icon, rarity, power, traits, Equip (the existing `equip`) and Keep. A better item is already equipped by `giveDrop`, so Equip is then shown as done.
- **Loss:** "Not this time. Upgrade and try again. Your key is kept for this boss." The hero keeps retrying as usual.
- A short success or failure tone plays if sound is on.
- **UI:** the badge shows keys (key glyph aria-hidden, label "2 boss keys"). While waiting, the canvas draws a closed gate in front of the boss, the hero idles and a line says so. Today shows a chip under Today's session: "A boss is waiting: train to fight it", or "2 keys: fight the floor 30 boss". It opens the Tower.

## Rested (planned rest days)
Rest days are set in the main app (Settings, up to 2 weekdays, `settings.restDays` plus `restHistory`). A planned rest day that passes with no training gives the hero **Rested**: the next session after it pays +10% Sweat (`CONFIG.restedBonus`, added to Stamina and the like). It is worked out in `syncRewards` from the dates (a rest day between the previous session and this one), so it is a one-off, never stacks, and a 2nd session the same day gets none. A small badge in the Tower shows it until you train. The streak multiplier counts through rest days.

## Weekly bounty
`js/game/bounty.js`. Each Monday a bounty is picked by a hash of the week start and your move levels (no dice): Train N days (3 to 5, last 4 weeks' average + 1), Beat your best on a move (a `pb` event that week), Level up any move, Full sessions (not minimum) on N days (2 to 4), or Fast N times past your minimum (2 to 4, only if you fasted in the last 4 weeks). Only `game.bounty = { week, kind, target, move?, claimed }` is saved. Progress is worked out from sessions, events and fasts of that week. A card in the Tower and a line on Today show it.
- **Claim:** a chest with a guaranteed rare-or-better item at the current tier (`rollDrop` with `min: 'rare'`, auto-equipped if better, shown on the loot card) and 1 boss key (up to the cap). Once only.
- **Expiry:** claimable through the Monday after its week. A finished unclaimed bounty stays on that Monday, then is replaced. An unfinished one is replaced on Monday.

## Gear sets
Each move has a 3 piece set (weapon, armour, boots) in `CONFIG.sets`: Vanguard (Push-up), Bulwark (Squat), Atlas (Hinge), Tidecaller (Row), Keystone (Core), Skyward (Overhead), Strider (Calf), Coil (Hamstring).
- **Drops:** only a real `levelUp` event of that move (paid once, `game.paid['es:<event id>']`) gives a piece: one random missing slot, current tier, rare or better, normal affixes, `set` = move id. With all 3 owned the duplicate upgrades the weakest piece (to the current tier, affixes scaling, else +1 Temper level). The first sync pays at most `welcomeSets` (3) history pieces, newest first. Set pieces are scrapped last, and ascending keeps them.
- **Bonus:** 2 worn pieces give `two`, 3 give `two` and `three`. Keys are atk, hp, spd (multipliers), crit, timer (boss timer) or an affix id, so they fold into `heroStats`, `affixTotal` (and its caps) and `bossTimer`, and so into `fight`. Vanguard +10% Attack, then +15% and +5% crit; Bulwark +10% Health, then +15% and 5% Guard; Atlas +5% Attack and Health, then +8% each and 8% Thorns; Tidecaller 5% Lifesteal, then 5% more and +5% Speed; Keystone +15% boss timer, then +15% more and +10% boss damage; Skyward +8% Speed, then +8% and +12% trait-floor damage; Strider +5% Sweat, then +5% and +8% Speed; Coil +4% crit, then +4% and +40% crit damage. (Tidecaller is a flat +5% lifesteal rather than "+15% of the lifesteal effect", so it works with no lifesteal affix.)
- **UI:** a coloured set badge on inventory tiles, "2/3 Vanguard" and the bonus gained or lost in the compare panel (`compareItem(...).sets`), and the Gear section lists worn sets and which bonuses are on.
- **Hero:** with 3 of a set worn the doll gets a set-coloured trim (4th entry of the looks array, `SET_COLOR` in sprites.js, palette roles `1` to `8`): sash, hem, shoulder, boot cuffs and weapon guard. Auto-equip still goes by power only, so wear a set piece from the inventory if you want the bonus.

## Tuning
`node tools/tower-sim.mjs` simulates a daily trainer (greedy buyer, a level-up every 10 days that gives a set piece (`LEVELUP=n`, `SETMOVES=a,b`), 1 planned rest day a week (`REST=0` for none), a weekly bounty claimed when done) and a player who never trains (they only hold the 3 welcome keys). The trainer earns keys from sessions and level-ups and also adds 60 Focus a day and spends it greedily on the Forge and the combat Focus upgrades (judged by their gain in the weakest survival or boss-timer margin); Forge Mastery and Treasure Sense take what is left, Key Ring and Ascendant are never bought (no key pressure, no ascending). The old Stamina, Precision and Luck are not bought. It prints `SUMMARY` lines with the floor at days 7, 30 and 60 and the longest stall. See the sim output for the current numbers; the elite floors and the boss at 110 are the late walls.

## Tab UI (phone first)
1. **Battle panel:** a pixel canvas with the hero on the left and the enemy on the right. The badge reads like "Crypt · Floor 34 · boss in 6", shortened to "Crypt · F34 · boss 6" when the panel is under 340 px or the text would overflow. The trait line sits under the panel. The canvas label names the zone and enemy ("Crypt, floor 34: your hero fights a ghost"). It uses `image-rendering: pixelated`. See "Visual fight" and "Zones" below. With reduced motion it shows still frames: no lunges, floats, bobbing or flicker, and bars step instantly.
2. **"While you were away" banner:** shown once after the offline sim. Floors climbed, bosses beaten, best drop.
3. **Currency row:** Sweat, Focus, Souls. Tiles carry plain labels for VoiceOver and the glyphs are hidden from it.
4. **Stats:** 3 rows (level, current value, next value, cost button). The button is disabled when you can't afford it. Buying updates the rows in place (`refreshTowerUi`), so the canvas is never rebuilt. Buy buttons have labels like "Upgrade Attack to level 4 for 29 Sweat".
5. **Gear:** 3 slots (rarity colour, bonus, power, affix chips). Tap one for the gear sheet. A stash line sits underneath, with an **Inventory** button (see "Inventory").
6. **Focus upgrades:** every open upgrade as a normal row, then the next 2 locked ones as dimmed rows ("Beat the floor 30 boss to unlock: Thornmail", label "Locked. Beat the floor 30 boss to unlock Thornmail"). The rest stay hidden. Rows are `role=group` with a label, buttons are 44 px high. `refreshTowerUi` patches rows in place and rebuilds the list only when the open or locked set changes (after a boss), keeping button focus. 6b. **Soul tree:** 8 rows like the stat rows, plus a refund row.
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
- **Palette:** one original 32-colour palette (`PAL` in `sprites.js`), hue-shifted ramps (shadows toward blue/purple, highlights toward yellow) for skin, hair, red cloth, gold, steel, cool and warm stone, wood, green, purple, blue, fire and bone, plus a dark blue-purple ink instead of black. Every sprite, boss recolour, prop, wall, floor and in-canvas UI colour comes from it. Only light and glow overlays (soft alpha tints) blend beyond it.
- **Maps:** code-built string grids (roles, not colours). `finish()` bevels each fill (shade on the bottom/right, light on the top/left, light from the top left) and outlines selectively: ink on the shadow side, the darkest step of the neighbouring ramp on the lit side.
- **Frames:** every unit (hero, 15 enemies, 7 bosses) has `idleA`, `idleB`, `windup`, `strike`, `hurt`, `down` at identical size, with the feet rows fixed. Units are drawn as a body grid plus a limb/weapon grid. Idle B bobs everything above a per-unit split row by 1 px. Windup and strike swing the weapon (or reach the arm) about a fixed grip and lean the body above the split; hurt leans away. Down is hand-drawn for the hero and a procedural collapse for the rest. Dev check: `node tools/silhouette-sheet.mjs out.png [--frames]` draws every sprite as a solid shape at two sizes.
- **View:** idle alternates at about 2 fps; each scheduled hit plays windup then strike with a 1 to 2 px step; being hit shows hurt (with the white flash); a KO or a kill shows down. With reduced motion only idle A (and down) is used.
- Boss recolours are palette swaps of a base map (the Death Knight has its own shape: spiked crown and a scythe). The elite outline is drawn on a padded copy. Sprites carry a feet pivot (`px`) that the view plants on the ground point.

## Inventory
One bottom sheet (`invSheet` in view.js), opened by the Inventory button in the Gear section or by tapping the hero on the battle canvas (`heroHit` reuses the canvas scaling maths; the Gear button is the keyboard and VoiceOver route).
- **Top:** a hero preview (canvas, x4, idle breathing and a swing every few seconds) beside the compare panel. Under them Equip, Lock and Forge.
- **Tabs and sort:** All, Weapon, Armour, Boots; sort by Power (default), Rarity (epic first) or Newest (highest id). `inventory(g, slot, sort)` in the engine returns equipped items and the stash together.
- **Tiles (3 across, fits 360 px):** pixel icon from the item's overlay art, border colour by rarity, "Tier N" and the item kind, an Equipped badge and a lock badge. Each is a button: "Tier 5 epic axe, power 120, equipped, locked".
- **Select and try-on:** tapping a tile selects it (tap again to clear). While selected, the preview wears it (`gearLooks(g, item)`); nothing is saved. The compare panel is `role="status"` (a live region) and shows power and the slot's stat against the equipped item, `compareItem(g, it)`: green up, red down, always with a sign and a screen-reader "up 6" or "down 3". Affixes show as chips.
- **Equip, Lock, Forge:** all patch the open sheet in place (`invPatch`), never the whole page, so the preview and the battle canvas are not rebuilt and focus stays on the tapped tile. The battle sprite and stats pick up the new gear on the next paint and `refreshTowerUi`. Equip is disabled for the worn item, or when the worn item in that slot is locked. Forge opens the existing forge sheet for that item (`forge(g, slot, action, i, rng, item)` takes a stashed item); closing it returns to the inventory. Forging a stashed item never changes stats.
- **Loop:** the inventory leaves the battle running behind it (paint stays capped at 20 fps with the IntersectionObserver pause), so closing needs no remount. The older gear sheet still unmounts and catches up. Reduced motion draws the preview as one still frame (redrawn when the look changes).

## Hero looks
The hero is a paper doll (`heroMap(frame, looks)` in sprites.js): cape (behind), base body, base sleeve, boots, armour, armour sleeve, then weapon and hand, stacked per frame and finished once so the outline is shared. Each overlay has all 6 frames at the hero's 32 x 28 size and is posed by the same `move()` rules as the base: weapons follow the grip (`GRIPS`) through windup, strike and hurt, armour follows the idle bob and lean, boots stay on the ground, and each has a lying "down" drawing. Composites are cached by equipment signature (`heroSig`) and frame. The empty outfit is pixel-identical to the old hero (red tunic, starter blade, plain shoes).
- **`look`:** `'slot.style.rarity'`, derived by `lookOf(item)` from slot, tier and rarity only. `ensureGame` recomputes it on load (old saves need nothing), `rollDrop`, `giveDrop` and the forge's rarity upgrade keep it right, and the icon, preview and battle sprite all read it.

| Tier | Weapon | Armour | Boots |
|---|---|---|---|
| 1-2 | short sword | tunic (green cloth) | cloth (tiers 1-3) |
| 3-4 | longsword | leather vest | leather (4-6) |
| 5-6 | axe | chainmail | leather |
| 7-8 | spear | plate and helmet | iron greaves (7+) |
| 9+ | greatsword | plate, helmet and cape | iron greaves |

- **Rarity:** common is plain steel and a stone trim. Rare adds blue: glints on the blade, blue guard, blue trim and a blue crest. Epic adds a gold hilt and guard with a purple glow pixel, gold trim and crest, and a gold cape edge.
- All overlay pixels use `PAL` roles. One pixel features use flat roles so `finish()` does not bevel them into their shade. `tools/silhouette-sheet.mjs` is unchanged and shows the empty hero.

## Data
- Save in `state.game`, created lazily by `ensureGame(state)`.
- **Fields:** `sweat`, `focus`, `souls`, `tokens`, `stats {atk, hp, spd}`, `focusUp {endurance, precision, luck, iron, hands, warlord, breath, thorn, mastery, sense, ring, overkill, dilation, ascendant}`, `floor`, `runMax`, `bestFloor`, `bossBest`, `grit`, `keys`, `keyFor`, `waiting`, `kw`, `gear {weapon, armour, boots}` (items: `id, slot, tier, rarity, bonus, lvl, aff[{id,v}], lock, added, look`; `look` is derived and refilled on load), `stash[]`, `talents{}`, `soulsSpent`, `respecUsed`, `seq`, `drops[]`, `paid{}`, `lastTick`, `away`.
- Export and import carry it automatically.

## Out of scope for v1
Sound, more than one hero, achievements.

## Tuning log (rest, bounty, sets)
With the trainer taking 1 rest day a week the longest stall rose to 6 days, so Attack and Health upgrade growth went from 1.04 to 1.038. Trainer: floor 51 at day 7, 85 at day 30, 108 at day 60, longest stall 4 days, 8 of 9 bounties claimed. Non-trainer stuck at 15. The sim trainer rarely has 2 pieces of a set worn in 60 days, so sets are a slow-burn bonus.

## Tuning log (Focus tree)
New Focus upgrades with the trainer spending 60 Focus a day: floor 54 at day 7 (main 51), 94 at day 30 (main 85), 110 at day 60 (main 108), longest stall 4 days. Non-trainer still stuck at 15. Base costs started at 40 to 200 and were halved after the first pass left the trainer stalling 6 to 8 days at the floor 110 boss; stalls near that wall are knife-edge (4 to 9 days when Focus a day varies 45 to 75), and the main build also stalls 9 to 11 days at floors 110 to 117 once the sim runs past day 60. Only the new `focusUp` entries were added, no other CONFIG value changed.


### Level caps and 4 more upgrades (sim, 120 days, 60 Focus a day)
Trainer: floor 54 at day 7, 93 at day 30, 113 at day 60 (main 110), 132 at day 120 (+19 over days 60 to 120). Longest stall before day 60: 4 days (9 days later on). Non-trainer stays on floor 15. Fortify and Keen Edge at 60 base / 1.25 stalled the trainer 8 to 11 days around floor 101, so they cost 20 base, growing 1.2.