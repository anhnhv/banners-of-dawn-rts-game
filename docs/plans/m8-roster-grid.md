# M8: Farm for two, the 3×2 army grid, rules 5 and 6

Done 2026-11-11, built straight from the discussion (the user asked for no confirmation step).
The unit design itself is in `docs/units.md`; this file records what was asked, what was decided
and what is still open.

## 1. The request

- Farm as discussed: berries keep only one advantage, they cost no wood.
- A 3×2 grid of field units: foot soldiers, shooters, riders, each with a unit that needs no gold
  and one that needs gold. No eras: the economy decides what you can field.
- Rule 5: every unit has at least two counters, with a clear counter table.
- Rule 6: the game must still be balanced when the gold has run out.

## 2. Farm

|                                                                   | Before | Now              |
| ----------------------------------------------------------------- | ------ | ---------------- |
| Workers per Farm (`buildings.json → farm.gather.slots`)           | 1      | 2                |
| Food per worker per second (`units.json → worker … targets.farm`) | 0.35   | 0.45 (= berries) |

Measured with the machine player capped at 8 Farms: 16 farmers bring in 432 food a minute
(13 workers on berries: about 300). The machine now counts Farms by slots (`ai/AIPlayer.ts`);
Easy's `buildings.maxFarms` went 2 → 1 so it keeps two farmers.

## 3. The grid and the two new units

|             | Foot soldiers | Shooters      | Riders      |
| ----------- | ------------- | ------------- | ----------- |
| **No gold** | Militia       | Slinger (new) | Scout Rider |
| **Gold**    | Guard (new)   | Archer        | Knight      |

- **Guard**: 45 food + 45 gold, 95 HP, armor 1, attack 4 (+6 vs cavalry), own class `heavy`, so
  the Archer's +6 vs infantry does not apply (an arrow does 3).
- **Slinger**: 15 food + 40 wood, 24 HP, range 3.5, attack 2 (+6 vs infantry, +6 vs heavy),
  projectile `pebble`.
- **Militia**: +1 vs heavy. Nothing else changed on the four old field units.
- Both are trained at the Barracks: Q Militia, W Guard, A Slinger, S Archer (left = no gold,
  right = gold). No new building.
- Art: models in both collections (classic, aetherfall), icons `guard` and `sling`, the sling
  stone. Screenshots: `docs/milestones/m8-models.png`, `docs/milestones/m8-barracks-panel.png`.

## 4. Decisions made on the way

| Question                                  | Decision                                        | Why                                                                      |
| ----------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| How does the Guard resist arrows?         | Its own class, not high armor                   | Armor would also stop Militia, and the Archer would lose its only target |
| Militia vs Guard was a coin flip          | Guard attack 5 → 4, Militia +1 vs heavy         | Now 55% left for the Militia at every army size                          |
| Slinger vs Militia / Archer margins       | Slinger 24 HP, range 3.5                        | Every matchup now leaves the winner at least 33%                         |
| The machine answered Militia with Militia | Normal `army.counterRangedEdge` 1.5 → 2         | Its pick now wins against all 22 enemy armies tried (singles and pairs)  |
| Catapults beat Slingers in the open       | Left as it is, documented in `docs/units.md` §6 | +2 vs siege on the Slinger fixes it but adds a third bonus               |

## 4b. Rule 7 (added 2026-11-11, after review)

The user's rule: any army of two unit types beats at least one other two-type army and is beaten
by at least one (the two may share one unit type). It already held with the M8 numbers; nothing
was retuned. Measured at 400, 800 and 1,600 a side: all 15 pairs pass at every size. The table is
in `docs/units.md` §3.1, tested at 400 and 800 (`tests/engine/balance.test.ts`, "rule 7").

## 5. Tests

- `tests/engine/balance.test.ts`: 15 matchups at 400 and 800, the grid, rule 5, rule 6 (cycle,
  gold-free counters, gold-free town, razing a Town Hall, gold-free army mixes), 17 army mixes,
  situations for all six units, doc and description sync.
- `ai/tests/no-gold.test.ts`: whole matches on a map with no gold.
- `ai/tests/farms-siege.test.ts`, `ai/tests/parts.test.ts`, `ai/tests/ai.test.ts`: updated.

## 6. Still open

- Starting gold (100) still pays for two Archers or Guards at once. 0 or 50 would make the first
  minutes gold-free; not changed, never agreed.
- Catapult vs Slinger (above).
- Scenario starts still field only the four old units.
- Normal still stops at 16 workers, and two Normals can stall when both run short of wood.

## 7. Review notes (2026-11-11)

Fixed in the review: the Barracks description called the shooters foot soldiers; `docs/ai-modes.md`
(strength values, counter examples, a typical game) and the README still described four units.

Follow-ups, in order of value:

1. **Class names are shown raw in the panel.** The Archer reads "+6 vs infantry", the Slinger
   "+6 vs infantry, +6 vs heavy", the Militia "+1 vs heavy". Nothing tells the player that the
   Guard is not "infantry", and the Guard's whole role rests on that. Give classes display names
   (e.g. "light foot", "shield") or show the bonus by unit name.
2. **Starting gold 100** buys two Guards or Archers at once, so the first minute is not gold-free.
3. **Balance is measured at equal cost only.** At the 100 pop cap with gold in the bank, gold
   units win per population (that is their point); gold running out is what limits them. Worth a
   test at equal population once a late-game scenario exists.
4. **Militia +1 vs heavy** is a tuning bonus (it turns a coin flip into a 55% win). It works but
   is the least readable number in the table; revisit with point 1.
5. **Catapult vs Slinger**, **scenario starts with only the four old units**, **Normal's 16
   workers**: see §6.
6. **Doc-sync tests are exact** (§1.3, §3, §3.1). A retune that flips a close fight turns them red
   even when every rule still holds: update the table, do not loosen the test.
