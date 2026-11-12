# Army units

This file describes the seven army units: six field units and one siege unit, the Catapult.

- what each one is for;
- where it is strong;
- how to beat it;
- why none of them is the best choice everywhere.

Workers are not army units. The Catapult is different from the other six: its targets are buildings, not armies, so it is not part of the counter system in §1 and has its own section, §6.

- The numbers live in `src/data/units.json`, which is the source of truth.
- `tests/docs/units.test.ts` checks that the tables in §4 and §5 match it.
- `tests/engine/balance.test.ts` checks the grid, the matchups, the counter table and the situations described here (§1–§3), and the Catapult's siege tests (§6).
- `ai/tests/no-gold.test.ts` plays whole matches on a map without gold (§1.4).

**The seven rules.** Every field unit must have:

1. a clear tactical role;
2. at least one weakness that can be exploited;
3. at least one situation where it has the advantage;
4. no unit, and no army mix, is the best choice in every situation (§3);
5. **at least two counters** (two units that beat it at equal cost), and it counters at least two units itself (§1.3);
6. **the game still works without gold** (§1.4): the units that need no gold counter each other in a closed cycle, every unit has a counter that needs no gold, and a town without gold can still build, train and win.
7. **every pair of unit types has an answer and a victim** (§3.1): any army of two unit types beats at least one other two-type army and loses to at least one. The two armies may share one unit type.

**Overview.** The details and measurements are in §1–§6.

| Unit            | Trained at     | Role               | Strong when                                                      | Weakness to exploit                                          |
| --------------- | -------------- | ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| **Militia**     | Barracks       | Cheap spear wall   | facing riders or Guards; gold runs out (needs none)              | Slingers and Archers; slowest unit, cannot catch anything    |
| **Guard**       | Barracks       | Shield wall        | facing Archers and riders: the answer to an Archer + Knight army | Slingers and massed Militia; costs gold                      |
| **Slinger**     | Barracks       | Cheap shooter      | facing foot soldiers; gold runs out (needs none); wood is plenty | Archers and riders; short range; 1 damage to buildings       |
| **Archer**      | Barracks       | Long-range shooter | facing Militia and Slingers; standing behind a front line        | Guards and riders; 1 damage to buildings                     |
| **Scout Rider** | Stable         | Fast raider        | raiding workers, hunting shooters; needs no gold                 | Militia, Guards, Knights; 1 damage to buildings              |
| **Knight**      | Stable         | Heavy hammer       | breaking shooters and Scouts; attacking a base under tower fire  | Militia and Guards; costs gold, 2 population, trains slowest |
| **Catapult**    | Siege Workshop | Siege engine       | towers and bases: it outranges them; clumps standing still       | riders; anything within 2 tiles; slowest and most expensive  |

## 1. The counter system

### 1.1 The grid

Three kinds of soldier, each in a version that needs **no gold** and a version that needs **gold**.

|             | Foot soldiers | Shooters | Riders      |
| ----------- | ------------- | -------- | ----------- |
| **No gold** | Militia       | Slinger  | Scout Rider |
| **Gold**    | Guard         | Archer   | Knight      |

- **No gold** (food and wood only): affordable from the first minute, and still affordable when the gold mines are empty.
- **Gold**: the stronger body of the two (more HP), and each has something its partner lacks: the Guard's shield against arrows, the Archer's range (5 against 3.5), the Knight's armor. You need workers on gold to keep them coming, and gold runs out.
- There are no eras and no upgrades. What you can field depends only on what your economy brings in.
- In the Barracks panel the left button of each row is the gold-free unit and the right one the gold unit (Q Militia, W Guard; A Slinger, S Archer). The Stable is the same (Q Scout Rider, W Knight).

### 1.2 Who beats whom

```
            beat                  beat
 Foot soldiers ──────► Riders ──────► Shooters
       ▲                                  │
       └────────────── beat ──────────────┘

 One exception: the Guard's shield. Guard beats Archer (but still loses to the Slinger).
 Inside a kind:  Knight beats Scout Rider · Archer beats Slinger · Militia beat Guard.
```

**Equal-cost fights.** Read a row as "the row unit against the column unit".

| ↓ vs →          | Militia | Guard | Slinger | Archer | Scout Rider | Knight |
| --------------- | ------- | ----- | ------- | ------ | ----------- | ------ |
| **Militia**     | —       | wins  | loses   | loses  | wins        | wins   |
| **Guard**       | loses   | —     | loses   | wins   | wins        | wins   |
| **Slinger**     | wins    | wins  | —       | loses  | loses       | loses  |
| **Archer**      | wins    | loses | wins    | —      | loses       | loses  |
| **Scout Rider** | loses   | loses | wins    | wins   | —           | loses  |
| **Knight**      | loses   | loses | wins    | wins   | wins        | —      |

How the numbers make it so (the formula is in §4):

- **Foot soldiers beat riders:** Militia and Guard both have +6 against cavalry.
- **Riders beat shooters:** shooters have little HP and no armor, riders reach them fast; the Scout Rider has +5 against shooters.
- **Shooters beat foot soldiers:** Slinger and Archer both have +6 against infantry (the Militia).
- **The Guard's shield:** the Guard is its own class, `heavy`. The Archer's +6 does not apply to it, so an arrow does 3 instead of 9. A sling stone still does 7 (+6 against heavy).
- **Militia beat the Guard** at equal cost because they are many: 800 resources buy 15 Militia or 9 Guards, and the Militia have +1 against heavy. A Guard is not an anti-infantry unit; its attack is the Militia's (4, +6 against cavalry).

### 1.3 Counter table

Rule 5: every unit has at least two counters, and counters at least two units.

| Unit            | Beats                        | Count | Beaten by (its counters)    | Count | Counters that need no gold |
| --------------- | ---------------------------- | ----- | --------------------------- | ----- | -------------------------- |
| **Militia**     | Guard, Scout Rider, Knight   | 3     | Slinger, Archer             | 2     | Slinger                    |
| **Guard**       | Archer, Scout Rider, Knight  | 3     | Militia, Slinger            | 2     | Militia, Slinger           |
| **Slinger**     | Militia, Guard               | 2     | Archer, Scout Rider, Knight | 3     | Scout Rider                |
| **Archer**      | Militia, Slinger             | 2     | Guard, Scout Rider, Knight  | 3     | Scout Rider                |
| **Scout Rider** | Slinger, Archer              | 2     | Militia, Guard, Knight      | 3     | Militia                    |
| **Knight**      | Slinger, Archer, Scout Rider | 3     | Militia, Guard              | 2     | Militia                    |

- Every unit is beaten by 2 or 3 of the other 5, and beats 2 or 3.
- Whatever the enemy builds, you have at least two answers, and at least one of them needs no gold.
- The unit descriptions in the game ("Strong vs … / Weak vs …") say the same; a test compares them with this table.

### 1.4 Without gold

Rule 6: when the gold is gone (or you never mined any), the game is still a game.

```
 Militia ──beat──► Scout Rider ──beat──► Slinger ──beat──► Militia
```

- **A closed cycle.** Among the three gold-free units, each beats one and loses to one. No gold-free unit is the best.
- **A gold-free counter for everything.** Every unit, gold or not, loses to at least one gold-free unit (last column of §1.3). A player without gold can still answer a player who has some.
- **A town without gold still runs.** Houses, Farms, the Barracks and the Stable cost only wood; workers and the three gold-free units cost only food and wood.
- **A gold-free army can win.** Militia do 3 damage to buildings and towers (Slingers and Scout Riders do 1).
- Not available without gold: Guard, Archer, Knight, the Watch Tower, the Siege Workshop and the Catapult, and a new Town Hall.

**Measured (2026-11-11), 800 resources a side, gold-free armies only.** Every gold-free army loses to another one:

| Army                    | Beaten by         | Winner's value left |
| ----------------------- | ----------------- | ------------------: |
| Militia                 | Militia + Slinger |                 54% |
| Slinger                 | Scout Rider       |                 79% |
| Scout Rider             | Militia           |                 91% |
| Militia + Slinger       | Slinger           |                 56% |
| Militia + Scout Rider   | Militia           |                 80% |
| Slinger + Scout Rider   | Militia           |                 72% |
| All three, a third each | Militia + Slinger |                 55% |

Other measurements:

- 800 resources of Militia (15) destroy a Town Hall guarded by a Watch Tower in 73 s and keep 60% of their value.
- Militia alone beat the three gold units mixed (Guard + Archer + Knight, a third each) at equal cost.
- **Whole matches without gold** (`ai/tests/no-gold.test.ts`: Green Valley with the gold mines removed, no starting gold):
  - Normal against an idle opponent: it builds a Barracks, a Stable and Farms, and wins at about 8:10.
  - Normal against Normal: both train all three gold-free units (about 35 Militia, 35 Slingers and 10 Scout Riders each), no unit is more than 70% of an army, and the match ends with a winner at about 20:30.

### 1.5 Measured matchups

**Measured (2026-11-11).** Both armies of the same value attack-move at each other on open ground. The test runs the same fights at 400 and 800; `BALANCE_LOG=1 npx vitest run tests/engine/balance.test.ts --silent=false` prints the numbers again. Each cell gives the share of the winner's army value still standing at the end.

| Fight                  | Winner      | 400 a side | 800 a side | 1,600 a side |
| ---------------------- | ----------- | ---------: | ---------: | -----------: |
| Militia vs Guard       | Militia     |        55% |        55% |          58% |
| Militia vs Slinger     | Slinger     |        40% |        40% |          40% |
| Militia vs Archer      | Archer      |        82% |        43% |          59% |
| Militia vs Scout Rider | Militia     |        90% |        91% |          90% |
| Militia vs Knight      | Militia     |        69% |        63% |          72% |
| Guard vs Slinger       | Slinger     |        67% |        57% |          57% |
| Guard vs Archer        | Guard       |        33% |        65% |          61% |
| Guard vs Scout Rider   | Guard       |        86% |        88% |          89% |
| Guard vs Knight        | Guard       |        56% |        67% |          62% |
| Slinger vs Archer      | Archer      |        67% |        47% |          54% |
| Slinger vs Scout Rider | Scout Rider |        76% |        76% |          82% |
| Slinger vs Knight      | Knight      |        92% |        90% |          90% |
| Archer vs Scout Rider  | Scout Rider |        55% |        63% |          63% |
| Archer vs Knight       | Knight      |        81% |        80% |          82% |
| Scout Rider vs Knight  | Knight      |        83% |        83% |          83% |

A win counts only when more than 25% of the winner's value is left: a counter, not a coin flip.

## 2. The units

### Militia: the spear wall

- **Role:** the cheap front line. It holds the line, protects the shooters and stops riders.
- **Strong against:** Scout Rider and Knight (+6 against cavalry: 3 Militia, 165 resources, beat 1 Knight, 135), and the Guard, which it swarms.
- **Shines when:**
  - an enemy sends horses at you;
  - gold runs out, because Militia need none;
  - you need many bodies fast and cheap: it has the shortest training time of the six.
- **Weakness you can exploit:**
  - **Shooters.** Militia are slow (2.0 tiles/s) and take bonus damage from stones (7 per hit) and arrows (9). They lose a lot of HP walking up to a line of shooters.
  - **They cannot catch anything.** Every rider and shooter is faster, so a Scout Rider raid simply runs away from them.
- **How to beat it:** Slingers if you have no gold, Archers if you have. Keep them behind your own line. Never send riders into a Militia block.

### Guard: the shield wall

- **Role:** the front line that arrows cannot stop. It walks into an Archer line and holds against riders.
- **Strong against:** Archer (an arrow does 3 to it, against 9 to a Militia), Scout Rider and Knight (+6 against cavalry, 95 HP).
- **Shines when:**
  - the enemy relies on gold units: Guards beat an Archer + Knight army of the same cost with 57% left, where Militia alone keep 20%;
  - you need a front line that survives arrows: walking up to six Archers, Guards arrive with 91% of their value and Militia with 69%;
  - population is short: one Guard has more than twice the HP of a Militia for the same 1 population.
- **Weakness you can exploit:**
  - **Slingers.** A stone does 7 to it; Slingers cost no gold.
  - **Massed Militia.** For the same resources there are many more of them, and a Guard hits no harder than a Militia.
  - **Gold.** Every Guard costs 45 gold, and it is as slow as a Militia.
- **How to beat it:** the cheap units. Slingers behind a Militia line beat Guards of the same cost with 71% left.

### Slinger: the cheap shooter

- **Role:** the shooter that needs no gold. It kills foot soldiers and nothing else.
- **Strong against:** Militia and Guard (7 per stone to both). Per resource, no unit kills foot soldiers faster.
- **Shines when:**
  - the enemy army is foot soldiers, of either kind;
  - gold runs out or was never mined: with Militia in front, it is the gold-free answer to Militia (54% left against all-Militia);
  - wood piles up: it costs 40 wood and only 15 food.
- **Weakness you can exploit:**
  - **Archers** outrange it (5 against 3.5) and a stone does only 2 to an Archer.
  - **Riders.** It has 24 HP and no armor; a stone does 2 to a Scout Rider and 1 to a Knight.
  - **Short range.** Every building that shoots outranges it, and it does 1 damage to buildings.
- **How to beat it:** Scout Riders if you have no gold, Archers or Knights if you have.

### Archer: the long-range shooter

- **Role:** ranged damage from behind a front line. It shoots first, because its range is 5 and it sees 6.
- **Strong against:** Militia (9 per arrow, a Militia dies in 5 hits) and Slingers, which it outranges.
- **Shines when:**
  - the enemy army is mostly Militia, Slingers or both;
  - it stands behind your own front line, which keeps riders off it;
  - it defends next to your Town Hall and towers: the enemy walks in under fire from all of them.
- **Weakness you can exploit:**
  - **Riders.** It has only 30 HP and no armor. Scout Riders take 9 per hit off it and Knights 12. Arrows barely scratch a Knight (2 damage).
  - **Guards.** Its bonus against infantry does not work on the shield: 3 per arrow.
  - **Buildings.** Arrows do 1 damage to a building, so archers alone cannot take down a base.
- **How to beat it:** charge it with riders, around its front line if you can, or walk Guards into it. Do not walk Militia into it.

### Scout Rider: the raider

- **Role:** speed. It scouts, raids workers, hunts shooters and runs away from anything it cannot fight.
- **Strong against:** workers (+4 bonus, a worker dies in 4 hits), Slingers and Archers (+5 bonus), and a lone Catapult (+6).
- **Shines when:**
  - the enemy's workers gather far from their Town Hall and towers;
  - the enemy has shooters without a front line;
  - gold is short, because it costs only food;
  - you need to be somewhere fast: at 3.6 tiles/s it outruns every unit in the game.
- **Weakness you can exploit:**
  - **Foot soldiers** shred it: 10 damage per hit against 60 HP.
  - **Knights** beat it in a straight fight.
  - **Buildings and towers:** it does 1 damage to a building, and a tower or Town Hall shoots it freely while it does nothing useful.
- **How to beat it:** keep a few Militia near your workers, or gather inside the range of your Town Hall and towers.

### Knight: the hammer

- **Role:** the heavy fighter. It breaks shooter lines, kills raiders and leads an assault on a base.
- **Strong against:** Slingers and Archers (12 per hit) and Scout Riders. Its 2 armor halves the arrows of the Town Hall (4 → 2) and cuts tower arrows (6 → 4).
- **Shines when:**
  - the enemy relies on shooters or scouts;
  - you attack a base under Town Hall and tower fire: it takes the least damage and hits buildings hardest (9 per hit);
  - a few strong units are better than many small ones.
- **Weakness you can exploit:**
  - **Foot soldiers.** It costs as much as 2.5 Militia or 1.5 Guards and loses to both.
  - **Price and supply.** It needs 75 gold, and the gold mines near each base hold only about 2,000, so a whole game gives at most about 26 Knights. It also uses 2 population and trains slowly (28 s).
- **How to beat it:** mass Militia, or Guards if you have gold. Do not spend gold on Archers against it.

### Situations, measured (2026-11-11, `tests/engine/balance.test.ts`)

| Unit        | Situation                                                                   | Result                                                                                                                  |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Militia     | A Knight charge into a Militia block of the same cost (600)                 | the Militia win                                                                                                         |
| Guard       | Against an Archer + Knight army (half each), 800 a side                     | Guards win with 57% left; Militia alone win with 20% left                                                               |
| Guard       | Walking 12 tiles up to six Archers, 360 resources of walkers                | Guards arrive with 91% of their value, Militia with 69%                                                                 |
| Slinger     | Militia + Slinger (half each) against all-Militia and all-Guard, 800 a side | Militia + Slinger win with 54% and 71% left                                                                             |
| Slinger     | Damage per second per resource against a Militia or a Guard                 | higher than any other unit's                                                                                            |
| Archer      | Militia + Archer (half each) against all-Militia, 800 a side                | Militia + Archer win with 61% left                                                                                      |
| Scout Rider | A 15 s raid on 8 gathering workers with 400 resources of raiders            | Scout Riders kill 4 workers, Knights 3                                                                                  |
| Scout Rider | A Militia, a Guard or a Knight chases a Scout Rider that runs away          | never catches it                                                                                                        |
| Knight      | Razing a House next to a Town Hall and a tower, 600 resources of attackers  | army value lost per point of damage: Knight 0.20, Militia 0.28, Guard 0.37, Archer 1.45, Slinger 1.86, Scout Rider 2.17 |
| Catapult    | see §6                                                                      |                                                                                                                         |

## 3. Why no unit is the best choice everywhere

- Each unit loses at least two equal-cost matchups in §1.
- The strongest single unit, the Knight, loses to the cheapest one, the Militia. It is also limited by gold, population and training time.
- The Guard beats every gold unit it meets and loses to both cheap answers, Slingers and Militia.
- The best cheap unit, the Militia, cannot catch anything and loses to both shooters.
- Shooters win only with a front line or against foot soldiers, and cannot take down buildings.
- Scout Riders lose every straight fight except against shooters. They win by choosing where to fight.
- A good army is therefore a mix, and the right mix depends on what the enemy brings.

No mix wins everything either. Each army below loses an equal-cost fight to the answer next to it (800 a side, tested):

| Army                      | Beaten by         |
| ------------------------- | ----------------- |
| Militia                   | Militia + Slinger |
| Guard                     | Militia + Slinger |
| Slinger                   | Scout Rider       |
| Archer                    | Guard             |
| Scout Rider               | Militia           |
| Knight                    | Militia           |
| Militia + Guard           | Slinger           |
| Militia + Slinger         | Archer            |
| Militia + Archer          | Guard + Archer    |
| Militia + Knight          | Militia           |
| Guard + Slinger           | Knight            |
| Guard + Archer            | Knight            |
| Guard + Knight            | Militia           |
| Archer + Knight           | Guard             |
| The three gold-free units | Knight            |
| The three gold units      | Guard             |
| All six                   | Militia           |

Mixed armies split their value evenly between the units named.

### 3.1 Pairs of unit types

Rule 7: every army of two unit types (half of the budget each) beats at least one other two-type army and is beaten by at least one. The other army may share one unit type with it (Militia + Guard against Militia + Slinger counts).

Letters: **M** Militia, **G** Guard, **S** Slinger, **A** Archer, **R** Scout Rider, **K** Knight.

**Measured (2026-11-12, after the no-pushing movement), 800 a side.** A pair is listed only for a **clear win**: it wins from either side of the field, and keeps more than 25% of its value both times. Close fights are in neither list, so the two counts of a row do not always add up to 14.

| Pair    | Beats                                       | Count | Beaten by                                                  | Count |
| ------- | ------------------------------------------- | ----- | ---------------------------------------------------------- | ----- |
| **M+G** | M+R, M+K, G+R, G+K, S+R, A+R, A+K, R+K      | 8     | M+S, M+A, G+S, G+A, S+A                                    | 5     |
| **M+S** | M+G, M+R, G+R, S+R                          | 4     | M+A, G+A, S+A, S+K, A+K                                    | 5     |
| **M+A** | M+G, M+S, M+R, M+K, G+R, G+K, S+R, A+R, R+K | 9     | G+S, G+A, S+A, A+K                                         | 4     |
| **M+R** | G+R, S+R, R+K                               | 3     | M+G, M+S, M+A, M+K, G+S, G+A, G+K, A+K                     | 8     |
| **M+K** | M+R, G+R, S+A, S+R, S+K, A+R, R+K           | 7     | M+G, M+A                                                   | 2     |
| **G+S** | M+G, M+A, M+R, G+A, G+R, A+R                | 6     | S+A, S+K, A+K                                              | 3     |
| **G+A** | M+G, M+S, M+A, M+R, G+R, S+A, S+R, A+R, R+K | 9     | G+S, S+K                                                   | 2     |
| **G+R** | S+A, S+R                                    | 2     | M+G, M+S, M+A, M+R, M+K, G+S, G+A, G+K, S+K, A+K           | 10    |
| **G+K** | M+R, G+R, S+A, S+R, S+K, A+R, A+K, R+K      | 8     | M+G, M+A                                                   | 2     |
| **S+A** | M+G, M+S, M+A, G+S                          | 4     | M+K, G+A, G+R, G+K, S+K, A+R, A+K, R+K                     | 8     |
| **S+R** |                                             | 0     | M+G, M+S, M+A, M+R, M+K, G+A, G+R, G+K, S+K, A+R, A+K, R+K | 12    |
| **S+K** | M+S, G+S, G+A, G+R, S+A, S+R, A+R           | 7     | M+K, G+K, A+K                                              | 3     |
| **A+R** | S+A, S+R                                    | 2     | M+G, M+A, M+K, G+S, G+A, G+K, S+K, A+K, R+K                | 9     |
| **A+K** | M+S, M+A, M+R, G+S, G+R, S+A, S+R, S+K, A+R | 9     | M+G, G+K                                                   | 2     |
| **R+K** | S+A, S+R, A+R                               | 3     | M+G, M+A, M+R, M+K, G+A, G+K                               | 6     |

- Every pair but one beats between 2 and 9 pairs and loses to between 2 and 12. None wins everything.
- **Rule 7 is broken for Slinger + Scout Rider (800 a side):** it beats no pair since units stopped pushing through each other (2026-11-12). At 400 a side it still beats Guard + Slinger and Slinger + Archer. Known failure in `balance.test.ts`; open until the user decides on a retune.
- The test checks the rule at 400 and 800 a side, and this table at 800.
- **Weakest pairs:** a pair of two light units with no front line. Slinger + Scout Rider beats nothing at 800, and Archer + Scout Rider only the two pairs of shooters without a front line. They are raiding parties, not armies.
- **Strongest pairs:** a foot soldier or shooter with an Archer or a Knight (Militia + Archer, Guard + Archer, Archer + Knight: 9 wins). Each still loses to 2 to 4 pairs.

## 4. Damage per hit

Damage = max(1, attack + bonus against the target's class − target armor) (`game.json → combat.minDamage` = 1).

| Attacker ↓ / target → | Militia | Guard | Slinger | Archer | Scout Rider | Knight | Catapult | Worker | Building |
| --------------------- | ------: | ----: | ------: | -----: | ----------: | -----: | -------: | -----: | -------: |
| **Militia**           |       3 |     4 |       4 |      4 |          10 |      8 |        3 |      4 |        3 |
| **Guard**             |       3 |     3 |       4 |      4 |          10 |      8 |        3 |      4 |        3 |
| **Slinger**           |       7 |     7 |       2 |      2 |           2 |      1 |        1 |      2 |        1 |
| **Archer**            |       9 |     3 |       4 |      4 |           4 |      2 |        3 |      4 |        1 |
| **Scout Rider**       |       3 |     3 |       9 |      9 |           4 |      2 |        9 |      8 |        1 |
| **Knight**            |       9 |     9 |      12 |     12 |          10 |      8 |        9 |     10 |        9 |
| **Catapult**          |      11 |    11 |      12 |     12 |          12 |     10 |       11 |     12 |       41 |

"Building" includes towers. Buildings and towers have armor 1, and the −2 bonus of the Archer and the Scout Rider is set for both classes (`building` and `tower`). The Slinger needs no such bonus: its base damage is 2.

The classes: Militia `infantry`, Guard `heavy`, Slinger and Archer `ranged`, Scout Rider and Knight `cavalry`, Catapult `siege`, Worker `worker`.

## 5. Stats

The bonuses are listed in the order of `units.json`. The Catapult's attack also has a minimum range of 2 and a 1-tile splash (50% at the edge); its stone lands where the target was, so moving units can dodge it.

| Stat            | Militia                    | Guard                 | Slinger                     | Archer                                      | Scout Rider                                                          | Knight                 | Catapult                      |
| --------------- | -------------------------- | --------------------- | --------------------------- | ------------------------------------------- | -------------------------------------------------------------------- | ---------------------- | ----------------------------- |
| Trained at      | Barracks                   | Barracks              | Barracks                    | Barracks                                    | Stable                                                               | Stable                 | Siege Workshop                |
| Cost            | 35 food, 20 wood           | 45 food, 45 gold      | 15 food, 40 wood            | 30 wood, 40 gold                            | 80 food                                                              | 60 food, 75 gold       | 150 wood, 120 gold            |
| Train time      | 15 s                       | 22 s                  | 16 s                        | 18 s                                        | 20 s                                                                 | 28 s                   | 40 s                          |
| Population      | 1                          | 1                     | 1                           | 1                                           | 1                                                                    | 2                      | 3                             |
| HP              | 45                         | 95                    | 24                          | 30                                          | 60                                                                   | 120                    | 70                            |
| Armor           | 1                          | 1                     | 0                           | 0                                           | 0                                                                    | 2                      | 1                             |
| Speed (tiles/s) | 2                          | 2                     | 2.2                         | 2.2                                         | 3.6                                                                  | 3                      | 1.2                           |
| Sight           | 4                          | 4                     | 5                           | 6                                           | 7                                                                    | 5                      | 9                             |
| Attack          | 4, melee, every 1.5 s      | 4, melee, every 1.6 s | 2, range 3.5, every 1.5 s   | 4, range 5, every 1.6 s                     | 4, melee, every 1.8 s                                                | 10, melee, every 1.8 s | 12, range 8, every 5 s        |
| Bonus damage    | +6 vs cavalry, +1 vs heavy | +6 vs cavalry         | +6 vs infantry, +6 vs heavy | +6 vs infantry, −2 vs building, −2 vs tower | +5 vs ranged, +4 vs worker, +6 vs siege, −2 vs building, −2 vs tower | +2 vs ranged           | +30 vs building, +30 vs tower |

**Changed in M8** (2026-11-11, the 3×2 grid):

- New: Guard and Slinger, both trained at the Barracks. New class `heavy` (the Guard) and new projectile `pebble` (the sling stone).
- Militia: +1 against heavy.
- Archer, Scout Rider, Knight, Catapult: numbers unchanged. The Knight's description says "armored" now, so that "heavy" means the Guard's class only.

**Changed in M6.5** (from the earlier numbers):

- Militia: speed 2.2 → 2.0, bonus vs cavalry +8 → +6.
- Archer: bonus vs infantry +4 → +6, new −2 vs buildings and towers.
- Scout Rider: bonus vs ranged +4 → +5 and vs workers +3 → +4, new −2 vs buildings and towers.
- Knight: unchanged.

## 6. The Catapult: siege

Trained at the **Siege Workshop** (build menu D: 200 wood, 50 gold). The Catapult is not a field
unit: it is there to take down what the other units cannot, from where it cannot be shot back.

- **Role:** breaks towers and bases from outside their range. Its range is 8; the Watch Tower
  shoots 7 and the Town Hall 6. One stone does 41 damage to a building.
- **Target priority** (its own, `units.json → catapult.combat.targetPriority`): towers first, then
  other buildings, then siege, then soldiers, workers last. On attack-move it shells the tower, not
  the Militia standing next to it.
- **Shines when:**
  - the enemy turtles behind Watch Towers and the Town Hall;
  - enemy units stand still in a clump (splash).
- **Weakness you can exploit:**
  - **Riders.** Scout Riders deal +6 against siege; one Scout Rider kills a lone Catapult.
  - **Up close it is helpless:** it cannot shoot anything within 2 tiles.
  - **Slow and expensive:** the slowest unit (1.2 tiles/s), the most expensive (270 resources,
    3 population), and its stones miss moving units.
- **How to beat it:** send riders at it before it gets in range, or catch it without an escort.

### Siege, measured (2026-11-11, `tests/engine/balance.test.ts`)

| Situation                                                                | Result                                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 2 Catapults against a lone Watch Tower                                   | the tower falls in about 40 s; both Catapults are untouched                                                                   |
| 1,100 resources of Catapults or Knights against a Town Hall with a tower | the Catapults lose a smaller share of their value                                                                             |
| One stone into 4 Militia standing still                                  | at least 3 of them are hurt                                                                                                   |
| Equal-cost field battle (810 a side) against each of the six field units | the Catapults lose to five of them; riders keep more than 75% of their value. **They beat Slingers** (69% left): see the note |
| 1 Scout Rider against a lone Catapult                                    | the Catapult dies, the Scout Rider lives                                                                                      |

**Note on Slingers.** A sling stone does 1 damage to a Catapult (2 − 1 armor), and Slingers stand still in a clump inside its splash, which is exactly what the Catapult is good against. Three Catapults therefore beat fifteen Slingers. Send anything else. (Tried: +2 against siege for the Slinger turns this fight around, 52% left for the Slingers, at the price of a third bonus on the unit. Not done.)
