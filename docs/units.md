# Army units

This file describes the four army units:

- what each one is for;
- where it is strong;
- how to beat it;
- why none of them is the best choice everywhere.

Workers are not army units. The Catapult exists in `units.json` but cannot be trained, so it is not part of this roster.

- The numbers live in `src/data/units.json`, which is the source of truth.
- `tests/docs/units.test.ts` checks that the tables in §4 and §5 match it.
- `tests/engine/balance.test.ts` checks the matchups and situations described here.

| Unit            | Trained at | Role in one line                                               |
| --------------- | ---------- | -------------------------------------------------------------- |
| **Militia**     | Barracks   | Cheap spear wall that stops horses                             |
| **Archer**      | Barracks   | Back-line damage that melts infantry before it arrives         |
| **Scout Rider** | Stable     | Fast raider that hunts workers and archers, then runs          |
| **Knight**      | Stable     | Heavy shock cavalry that breaks archers and survives base fire |

## 1. The counter cycle

```
          beats                    beats
 Militia ───────► Scout Rider, Knight ───────► Archer
    ▲                                            │
    └──────────────────── beats ─────────────────┘
                 (Archer beats Militia)

 Inside the cavalry: Knight beats Scout Rider in a straight fight,
 but the Scout Rider is faster, cheaper, needs no gold and is the better raider.
```

**Equal-cost fights.** Read a row as "the row unit against the column unit".

| ↓ vs →          | Militia | Archer | Scout Rider | Knight |
| --------------- | ------- | ------ | ----------- | ------ |
| **Militia**     | —       | loses  | wins        | wins   |
| **Archer**      | wins    | —      | loses       | loses  |
| **Scout Rider** | loses   | wins   | —           | loses  |
| **Knight**      | loses   | wins   | wins        | —      |

**Measured (2026-11-07).** Both armies of the same value attack-move at each other on open ground. The test runs the same fights; `BALANCE_LOG=1 npx vitest run tests/engine/balance.test.ts --silent=false` prints the numbers again. Each cell gives the winner and the share of its army value still standing at the end, at 400 and at 800 resources a side.

| Fight                  | Winner      | 400 a side | 800 a side |
| ---------------------- | ----------- | ---------: | ---------: |
| Militia vs Archer      | Archer      |        82% |        43% |
| Militia vs Scout Rider | Militia     |        90% |        91% |
| Militia vs Knight      | Militia     |        69% |        63% |
| Archer vs Scout Rider  | Scout Rider |        55% |        63% |
| Archer vs Knight       | Knight      |        81% |        80% |
| Scout Rider vs Knight  | Knight      |        83% |        82% |

## 2. The units

### Militia: the spear wall

- **Role:** the cheap front line. It holds the line, protects the archers and stops cavalry.
- **Strong against:** Scout Rider and Knight. Its spear bonus against cavalry means 3 Militia (165 resources) beat 1 Knight (135).
- **Shines when:**
  - an enemy sends horses at you;
  - gold runs out, because Militia need none;
  - you need many bodies fast and cheap: it has the shortest training time of the four.
- **Weakness you can exploit:**
  - **Archers.** Militia are slow (2.0 tiles/s, the slowest of the four) and take bonus damage from arrows. They lose a lot of HP walking up to archers.
  - **They cannot catch anything.** Every other army unit is faster, so a Scout Rider raid simply runs away from them.
- **How to beat it:** keep archers behind your own line and shoot the Militia as they walk in. Never send cavalry into a Militia block.

### Archer: the back line

- **Role:** ranged damage from behind a front line. It shoots first, because its range is 5 and it sees 6.
- **Strong against:** Militia, with a bonus against infantry. A Militia takes 9 per arrow and dies in 5 hits.
- **Shines when:**
  - the enemy army is mostly Militia;
  - it stands behind your own Militia, which keep cavalry off it;
  - it defends next to your Town Hall and towers: the enemy walks in under fire from all of them.
- **Weakness you can exploit:**
  - **Cavalry.** It has only 30 HP and no armor. Scout Riders take 9 per hit off it and Knights 12. Arrows barely scratch a Knight (2 damage).
  - **Buildings.** Arrows do 1 damage to a building, so archers alone cannot take down a base.
- **How to beat it:** charge it with cavalry, around its front line if you can. Do not walk Militia into it.

### Scout Rider: the raider

- **Role:** speed. It scouts, raids workers, hunts archers and runs away from anything it cannot fight.
- **Strong against:** workers (+4 bonus, a worker dies in 4 hits) and Archers (+5 bonus).
- **Shines when:**
  - the enemy's workers gather far from their Town Hall and towers;
  - the enemy has archers without a front line;
  - gold is short, because it costs only food;
  - you need to be somewhere fast: at 3.6 tiles/s it outruns every unit in the game.
- **Weakness you can exploit:**
  - **Militia** shred it: 10 damage per hit against 60 HP.
  - **Knights** beat it in a straight fight.
  - **Buildings and towers:** it does 1 damage to a building, and a tower or Town Hall shoots it freely while it does nothing useful.
- **How to beat it:** keep a few Militia near your workers, or gather inside the range of your Town Hall and towers.

### Knight: the hammer

- **Role:** the heavy fighter. It breaks archer lines, kills raiders and leads an assault on a base.
- **Strong against:** Archers (12 per hit) and Scout Riders. Its 2 armor halves the arrows of the Town Hall (4 → 2) and cuts tower arrows (6 → 4).
- **Shines when:**
  - the enemy relies on archers or scouts;
  - you attack a base under Town Hall and tower fire: it takes the least damage and hits buildings hardest (9 per hit);
  - a few strong units are better than many small ones.
- **Weakness you can exploit:**
  - **Militia.** It costs as much as 2.5 Militia and loses badly to them.
  - **Price and supply.** It needs 75 gold, and the gold mines near each base hold only about 2,000, so a whole game gives at most about 26 Knights. It also uses 2 population and trains slowly (28 s).
- **How to beat it:** mass Militia. Do not spend gold on archers against it.

### Situations, measured (2026-11-07, `tests/engine/balance.test.ts`)

| Unit        | Situation                                                                  | Result                                                                                        |
| ----------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Militia     | A Knight charge into a Militia block of the same cost (600)                | the Militia win                                                                               |
| Archer      | Militia + Archer (half each) against all-Militia, 800 a side               | Militia + Archer win with 61% left                                                            |
| Scout Rider | A 15 s raid on 8 gathering workers with 400 resources of raiders           | Scout Riders kill 4 workers, Knights 3                                                        |
| Scout Rider | A Militia or a Knight chases a Scout Rider that runs away                  | never catches it                                                                              |
| Knight      | Razing a House next to a Town Hall and a tower, 600 resources of attackers | army value lost per point of damage: Knight 0.20, Militia 0.28, Archer 1.45, Scout Rider 2.17 |

## 3. Why no unit is the best choice everywhere

- Each unit loses at least one equal-cost matchup in §1.
- The strongest single unit, the Knight, is the worst choice against the cheapest one, the Militia. It is also limited by gold, population and training time.
- The best anti-cavalry unit, the Militia, cannot catch anything and loses to archers.
- Archers win only with a front line or against infantry, and cannot take down buildings.
- Scout Riders lose every straight fight except against archers. They win by choosing where to fight.
- A good army is therefore a mix, and the right mix depends on what the enemy brings.

No mix wins everything either. Each army below loses an equal-cost fight to the answer next to it (800 a side, tested):

| Army                     | Beaten by        |
| ------------------------ | ---------------- |
| Militia                  | Militia + Archer |
| Archer                   | Archer + Knight  |
| Scout Rider              | Militia          |
| Knight                   | Militia          |
| Militia + Archer         | Archer + Knight  |
| Militia + Knight         | Militia + Archer |
| Archer + Knight          | Militia + Knight |
| All four, a quarter each | Militia + Archer |

## 4. Damage per hit

Damage = max(1, attack + bonus against the target's class − target armor) (`game.json → combat.minDamage` = 1).

| Attacker ↓ / target → | Militia | Archer | Scout Rider | Knight | Worker | Building |
| --------------------- | ------: | -----: | ----------: | -----: | -----: | -------: |
| **Militia**           |       3 |      4 |          10 |      8 |      4 |        3 |
| **Archer**            |       9 |      4 |           4 |      2 |      4 |        1 |
| **Scout Rider**       |       3 |      9 |           4 |      2 |      8 |        1 |
| **Knight**            |       9 |     12 |          10 |      8 |     10 |        9 |

"Building" includes towers. Buildings and towers have armor 1, and the −2 bonus of the Archer and the Scout Rider is set for both classes (`building` and `tower`).

## 5. Stats

The bonuses are listed in the order of `units.json`. The Scout Rider's +6 against siege only matters if the Catapult is ever made trainable.

| Stat            | Militia               | Archer                                      | Scout Rider                                                          | Knight                 |
| --------------- | --------------------- | ------------------------------------------- | -------------------------------------------------------------------- | ---------------------- |
| Trained at      | Barracks              | Barracks                                    | Stable                                                               | Stable                 |
| Cost            | 35 food, 20 wood      | 30 wood, 40 gold                            | 80 food                                                              | 60 food, 75 gold       |
| Train time      | 15 s                  | 18 s                                        | 20 s                                                                 | 28 s                   |
| Population      | 1                     | 1                                           | 1                                                                    | 2                      |
| HP              | 45                    | 30                                          | 60                                                                   | 120                    |
| Armor           | 1                     | 0                                           | 0                                                                    | 2                      |
| Speed (tiles/s) | 2                     | 2.2                                         | 3.6                                                                  | 3                      |
| Sight           | 4                     | 6                                           | 7                                                                    | 5                      |
| Attack          | 4, melee, every 1.5 s | 4, range 5, every 1.6 s                     | 4, melee, every 1.8 s                                                | 10, melee, every 1.8 s |
| Bonus damage    | +6 vs cavalry         | +6 vs infantry, −2 vs building, −2 vs tower | +5 vs ranged, +4 vs worker, +6 vs siege, −2 vs building, −2 vs tower | +2 vs ranged           |

**Changed in M6.5** (from the earlier numbers):

- Militia: speed 2.2 → 2.0, bonus vs cavalry +8 → +6.
- Archer: bonus vs infantry +4 → +6, new −2 vs buildings and towers.
- Scout Rider: bonus vs ranged +4 → +5 and vs workers +3 → +4, new −2 vs buildings and towers.
- Knight: unchanged.
