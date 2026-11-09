# How the machine plays, by mode

The machine player has two modes:

| Mode               | Plays like                                  | How to pick it                                    |
| ------------------ | ------------------------------------------- | ------------------------------------------------- |
| **Easy** (default) | A primary-school child: anyone can beat it  | Match Setup → Opponent → Easy, or `/?ai=easy`     |
| **Normal**         | A careful player who counts before fighting | Match Setup → Opponent → Normal, or `/?ai=normal` |

Opponent → Idle (or `/?ai=off`) gives an opponent that does nothing. Match Setup lists every mode in `src/ai/profiles/index.ts` and shows its `persona` as the help text, so a new mode file appears in the menu by itself.

**Each mode is one config file**: `src/ai/profiles/easy.json` and `src/ai/profiles/normal.json`.

- Every number that shapes how a mode plays is in its file. The code is the same for all modes.
- The files are checked when the game starts (schema in `src/shared/aiProfile.ts`). A typo or an out-of-range value stops the game with a clear message.
- **To add a mode**, copy a file, change the numbers, and list it in `src/ai/profiles/index.ts`.
- A test fails if a setting is missing from the configuration table (Part 2).

Related files:

- the code is in `src/ai/`;
- how the AI was built (engine, host, tests) is in `docs/plans/m6-vs-machine.md`.

---

## Part 1. How the machine thinks (all modes)

Setting names in `code` refer to the configuration table in Part 2.

### 1.1 What it can see and do

- **It sees everything**, as you do: every unit, building and resource node, including yours. There is no fog.
- **It gets no bonuses**: same starting resources, gather rates and costs.
- **It acts only through commands**, the same ones your mouse and keyboard send: move, gather, attack, attack-move, train, build and set rally.
- **It is local code only**: rules written in TypeScript, running in a Web Worker in your browser. No network, no LLM, no outside service.
- **It reads the rules from the game data**:
  - a unit that can gather is a **worker**;
  - a unit with an attack that cannot gather is a **soldier**;
  - a building that trains soldiers is a **military building**;
  - a building that gives population and trains nothing is a **house**;
  - a building that shoots and trains nothing is a **tower**;
  - its **home** is its building listed in `game.json → victory.defeatWhenLost` (the Town Hall).
- New units and buildings in the data are used without code changes.

### 1.2 The think loop

Every `tempo.thinkSeconds` it does the following:

0. **Daydream?** With chance `tempo.daydreamChance`, it skips this think entirely. The status line then says `daydreaming…`.
1. **Analyze the situation** (1.3). This is a fresh picture every time, so any position works: the standard start, the scenario start or a half-destroyed base.
2. **Army posture** (1.6).
3. **Wish list → budget** (1.4).
4. **Workers** (1.5).
5. **Send the commands**:
   - at most `tempo.maxCommandsPerThink` per think;
   - they take effect `tempo.reactionSeconds` later, like a human's reaction time;
   - while a command is on its way, its cost counts as already spent and its building spot as taken.

### 1.3 Analysis

| Fact            | How it is worked out                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front           | The direction from its Town Hall to yours                                                                                                                                                                                                                                                |
| Staging point   | Where its army waits: at least `army.stagingDistance` toward you, on the first walkable spot outside the range of its own Town Hall and towers (+2 tiles). Its army waits in the open field, not under its own arrows                                                                    |
| Threats         | Your soldiers within `defence.threatRadius` of any of its buildings (workers do not count)                                                                                                                                                                                               |
| Free population | Pop cap − population − population already queued                                                                                                                                                                                                                                         |
| Safe nodes      | Resource nodes nearer its Town Hall than yours and more than (range + 3) tiles from any shooting building of yours                                                                                                                                                                       |
| Strength        | Each soldier: **hp × damage ÷ cooldown** (Militia 120, Archer 75, Scout Rider 133, Knight 667). Each shooting building: `army.defenceHp` × damage ÷ cooldown (Town Hall 300, Watch Tower 450 with 150). "Enemy base defence" = your shooting buildings within 14 tiles of your Town Hall |

### 1.4 What it buys: the wish list and the budget

Each think it lists what it wants. Each item has a priority from `priorities.*`. The budget goes from the highest priority down:

- it buys everything it can afford;
- the first item it cannot afford **reserves** its cost, so less important items cannot take that money. The status line shows `saving for …`.

| Item                      | Priority                                                                | Wanted when                                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soldier                   | `priorities.defenceSoldier` while threatened, else `priorities.soldier` | Each finished military building of the kinds it uses keeps `army.militaryQueue` queued, with at least `army.trainEverySeconds` between two soldier orders, if there is population room. Which soldier: see 1.4.1                                                                       |
| House                     | `priorities.house`                                                      | Free population ≤ `buildings.houseBuffer` + `buildings.houseBufferPerProducer` × (military buildings + Town Halls), with no House under construction. Also when free population ≤ 0 and fewer than 2 are being built. Only while the pop cap is below 100                              |
| Worker                    | `priorities.worker`                                                     | Fewer than `economy.workerTarget` workers (queue included), up to `economy.workerQueue` queued per Town Hall. **Food reserve:** once it has `economy.minWorkers`, it stops when stock plus what is left in safe nodes, minus the worker's cost, would drop below `economy.armyReserve` |
| First military building   | `priorities.firstProducer`                                              | It has none of that kind, and it has at least `buildings.firstProducerAtWorkers` workers. It uses the first `buildings.militaryBuildingTypes` kinds in build-menu order (Barracks, then Stable); a kind is built only once the one before it stands                                    |
| Another military building | `priorities.extraProducer`                                              | It has fewer than `buildings.maxProducersPerType`, none is being built, all finished ones are full, and it holds more than `buildings.extraProducerBank` of each resource that building costs                                                                                          |
| Tower                     | `priorities.tower`                                                      | Game time ≥ `buildings.towerAfterSeconds` and fewer than `buildings.towers` towers                                                                                                                                                                                                     |

#### 1.4.1 Which soldier it trains (`army.unitChoice`)

| Value     | What it trains                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `first`   | Always the building's first button (the Barracks: Militia)                                                                                                   |
| `fewest`  | The type it has fewest of, so the army stays mixed                                                                                                           |
| `random`  | Any button, at random (seeded, so the same game plays the same way)                                                                                          |
| `counter` | The best answer to the soldiers of yours it sees, for `army.counterShare` of the picks; `fewest` for the rest. With none of your soldiers in sight, `fewest` |

**The counter pick** (`src/ai/counters.ts`) uses only the game data and the engine's damage formula (`docs/units.md` §4). For each soldier type it could train, against your soldiers weighted by their cost:

- **kill** = how much of your army's value it destroys per second;
- **hurt** = how much damage it takes per second, per resource of your army;
- **score** = kill × its HP ÷ hurt ÷ its cost².
  - Dividing by the square of the cost follows Lanchester's square law: for the same money a cheaper unit fields more bodies, and both its damage and its staying power grow with the count.
  - A ranged unit shooting at melee units gets free shots while they walk in, so its kill counts `army.counterRangedEdge` times.

It trains the type with the best score. A building whose best answer scores below `army.counterMinShare` × the best answer of all its army buildings **skips its turn**. So against a block of Militia, the Stable stays idle and the money goes to Archers.

A type it can never pay for any more is skipped: one that needs a resource gone from its stock and from every safe node.

What this gives (tested):

- against your Militia it trains Archers;
- against Knights, Militia;
- against Archers, cavalry.

**Placement:**

- It searches around its Town Hall: Houses at `buildings.houseDistance` to the back (away from you), military buildings at `buildings.militaryDistance` and towers at `buildings.towerDistance` to the front. Each value is [preferred, max]; the search goes up to max + 6.
- Every building keeps a **free walkable ring of one tile**, so it never walls itself in.
- A spot the game refused is never tried again.
- Military buildings rally new soldiers to the staging point.

### 1.5 Workers

- **Share per resource** = what it wants to spend:
  - everything on this think's wish list;
  - 3 × the cost of each soldier type it can train;
  - 2 × a worker's cost while below the worker target;
  - a military building if it has none.

  A resource it already holds more than `economy.plentyStock` of counts only 30%.

- **Idle workers:** up to `economy.idleWorkersPerThink` per think go to the resource most below its share.
  - The node: safe, of that resource, within `economy.gatherRadius` of its Town Hall if there is one.
  - Score = distance to its Town Hall + ½ × distance to the worker + 3 × workers already on it. Workers spread out.
- **Rebalancing:** every `economy.rebalanceSeconds` (0 = never), it moves one worker from the most over-staffed resource (≥ 1.5 too many) to the most under-staffed one (≥ 1.5 short).
- Workers never fight. When hit, they flee by themselves (`fleeWhenHit` in `units.json`).

### 1.6 The army: postures

```
            your soldiers near its base (if it notices: defence.defendChance)
   ┌─────────────────────────────────────────────────┐
   ▼                                                 │
 build ──can attack──► stage ──arrived / timeout──► attack
   ▲                                                 │
   └──── back at staging / timeout ◄── retreat ◄─too weak┘
           (army wiped during stage/attack → build, next wave bigger, cooldown)
```

| Posture     | What the army does                                                                                 | Leaves it when                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **build**   | Idle soldiers more than 5 tiles from the staging point walk there                                  | It can attack (1.7) → **stage**                                                                                               |
| **stage**   | Soldiers more than 6 tiles from staging walk there                                                 | `attack.regroupArrivedShare` of the army is within 6 tiles, or `attack.regroupSeconds` have passed (0 = at once) → **attack** |
| **attack**  | The **squad** attacks (see below)                                                                  | Too weak → **retreat**; army wiped → **build**                                                                                |
| **retreat** | The whole army walks back to staging                                                               | Its center is within 6 tiles of staging, or `retreat.retreatGiveUpSeconds` have passed → **build**                            |
| **defend**  | Every `army.reissueSeconds`, soldiers not already fighting attack-move to the center of the threat | No more threats → **build**                                                                                                   |

**During an attack:**

- **The squad** is the whole army when `attack.groupSize` is 0. Otherwise at most `attack.groupSize` soldiers attack at the same time: those already fighting, topped up from the rest. The others stay home.
- **The target:**
  - with `attack.target` = `townHall`, it goes for your Town Hall, because that wins the game;
  - with `nearestBuilding`, it goes for whatever building of yours is nearest to the squad.
- **The orders:**
  - every `army.reissueSeconds`, idle or walking squad members attack-move toward the target and fight what they meet;
  - when the squad is within 9 tiles of the target and none of your soldiers are within 8 tiles, every squad member attacks the target itself.
- **Too weak:** your soldiers and shooting buildings within 10 tiles of the squad × `retreat.retreatRatio` exceed the squad's strength (`retreatRatio` 0 = never retreats).
- **After a retreat or a wiped army:** the next wave needs `attack.waveGrowth` more population, and it waits at least `retreat.retreatCooldownSeconds`.

**Defence:** a threat interrupts any posture, but only if:

- it **notices** the attack: a roll of `defence.defendChance`, made once per attack on its base;
- and either its army is within `defence.homeRadius` of home, or the threat is at least `defence.raidShare` of its army strength.

### 1.7 When it decides to attack

All of these must hold:

1. Game time ≥ `attack.earliestAttackSeconds`, and the cooldown after its last retreat or lost wave is over.
2. **Size:** army population ≥ the wave size (starts at `attack.minWavePop`, grows by `attack.waveGrowth`). Or it is **stuck**: no army growth for `attack.stalledSeconds` and at least `attack.minStalledWavePop` population.
3. **Strength:** its army strength ≥ ratio × (your army + your base defence).
   - Normally the ratio is `attack.attackRatio`; 0 = it does not compare at all.
   - When stuck, it starts at `attack.stalledAttackRatio` and drops steadily to `attack.desperateRatio` over `attack.desperationSeconds`. The longer the standoff, the more risk it accepts.
4. You still have a Town Hall.

### 1.8 The status line

The bottom-right info box shows what the machine is doing:

```
Easy AI · attack · army 7 (687 vs 433) · workers 8/8 · next wave 4 · saving for train militia
```

It shows, in order: the mode, the posture, its army population, its strength vs your army plus base defence, workers now / target, the next wave size, and what it is saving for. `daydreaming…` means it skipped this think.

---

## Part 2. Configuration table

Values as of 2026-11-07. Times are seconds, distances tiles, chances 0–1.

| Setting                                 | What it does                                                                                            | Easy            | Normal   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------- | -------- |
| **tempo**                               |                                                                                                         |                 |          |
| `tempo.thinkSeconds`                    | Time between two thinks                                                                                 | 2               | 1        |
| `tempo.reactionSeconds`                 | Delay before its commands take effect                                                                   | 3               | 1.5      |
| `tempo.maxCommandsPerThink`             | Most commands per think                                                                                 | 4               | 12       |
| `tempo.daydreamChance`                  | Chance to skip a think entirely                                                                         | 0.3             | 0        |
| **economy**                             |                                                                                                         |                 |          |
| `economy.workerTarget`                  | Workers it aims for                                                                                     | 8               | 16       |
| `economy.minWorkers`                    | Always trains at least this many, whatever is left                                                      | 5               | 6        |
| `economy.armyReserve`                   | Food (etc.) kept for the army instead of more workers                                                   | 150             | 300      |
| `economy.workerQueue`                   | Workers queued per Town Hall                                                                            | 1               | 2        |
| `economy.idleWorkersPerThink`           | Idle workers sent to work per think                                                                     | 1               | 99       |
| `economy.gatherRadius`                  | Prefers nodes this close to its Town Hall                                                               | 14              | 18       |
| `economy.rebalanceSeconds`              | How often one worker moves to a needier resource (0 = never)                                            | 0               | 12       |
| `economy.plentyStock`                   | Above this stock a resource is wanted less                                                              | 500             | 500      |
| **buildings**                           |                                                                                                         |                 |          |
| `buildings.houseBuffer`                 | Build a House when free population is at most this…                                                     | 0               | 3        |
| `buildings.houseBufferPerProducer`      | …plus this per military building and Town Hall                                                          | 0               | 2        |
| `buildings.firstProducerAtWorkers`      | Workers needed before the first Barracks                                                                | 8               | 6        |
| `buildings.maxProducersPerType`         | Most military buildings of each type                                                                    | 1               | 2        |
| `buildings.militaryBuildingTypes`       | How many kinds of military building it uses, in build-menu order (Barracks, Stable)                     | 1               | 2        |
| `buildings.extraProducerBank`           | Stock needed before building another one                                                                | 99999           | 350      |
| `buildings.towers`                      | Towers it builds                                                                                        | 0               | 1        |
| `buildings.towerAfterSeconds`           | Not before this game time                                                                               | 99999           | 300      |
| `buildings.houseDistance`               | [preferred, max] from its Town Hall, to the back                                                        | [5, 10]         | [5, 10]  |
| `buildings.militaryDistance`            | Same for military buildings, to the front                                                               | [7, 12]         | [7, 12]  |
| `buildings.towerDistance`               | Same for towers, to the front                                                                           | [5, 9]          | [5, 9]   |
| **priorities** (higher is bought first) |                                                                                                         |                 |          |
| `priorities.defenceSoldier`             | Soldiers while its base is threatened                                                                   | 95              | 95       |
| `priorities.house`                      | Houses                                                                                                  | 90              | 90       |
| `priorities.worker`                     | Workers                                                                                                 | 80              | 80       |
| `priorities.firstProducer`              | First military building                                                                                 | 70              | 70       |
| `priorities.soldier`                    | Soldiers                                                                                                | 60              | 60       |
| `priorities.extraProducer`              | More military buildings                                                                                 | 45              | 45       |
| `priorities.tower`                      | Towers                                                                                                  | 40              | 40       |
| **army**                                |                                                                                                         |                 |          |
| `army.trainEverySeconds`                | Minimum time between two soldier orders (0 = no limit)                                                  | 40              | 0        |
| `army.militaryQueue`                    | Soldiers queued per military building                                                                   | 1               | 2        |
| `army.stagingDistance`                  | Minimum distance of the staging point from its Town Hall                                                | 7               | 7        |
| `army.defenceHp`                        | A shooting building counts as this much hp of army                                                      | 150             | 150      |
| `army.reissueSeconds`                   | Minimum time between army orders                                                                        | 6               | 4        |
| `army.unitChoice`                       | Which soldier to train: `first`, `fewest`, `random` or `counter` (1.4.1)                                | first           | counter  |
| `army.counterShare`                     | With `counter`: share of picks that follow the counter pick                                             | 0               | 0.7      |
| `army.counterRangedEdge`                | With `counter`: a ranged unit's kill counts this many times against melee units                         | 1               | 1.5      |
| `army.counterMinShare`                  | With `counter`: a building whose best answer scores below this share of the best overall skips its turn | 0               | 0.5      |
| **attack**                              |                                                                                                         |                 |          |
| `attack.earliestAttackSeconds`          | No attack before this game time                                                                         | 360             | 300      |
| `attack.minWavePop`                     | Army population for the first wave                                                                      | 4               | 8        |
| `attack.waveGrowth`                     | Added to the wave size after each retreat or lost army                                                  | 1               | 4        |
| `attack.attackRatio`                    | Needed strength vs you (0 = does not compare)                                                           | 0               | 1.6      |
| `attack.stalledSeconds`                 | No army growth for this long = stuck                                                                    | 60              | 60       |
| `attack.minStalledWavePop`              | Smallest army it attacks with when stuck                                                                | 3               | 3        |
| `attack.stalledAttackRatio`             | Needed strength when stuck…                                                                             | 0               | 1.0      |
| `attack.desperationSeconds`             | …falling over this long…                                                                                | 180             | 180      |
| `attack.desperateRatio`                 | …to this                                                                                                | 0               | 0.6      |
| `attack.regroupSeconds`                 | Longest gathering at staging before an attack (0 = none)                                                | 0               | 25       |
| `attack.regroupArrivedShare`            | Share of the army at staging that ends gathering                                                        | 0.8             | 0.8      |
| `attack.groupSize`                      | Most soldiers attacking at the same time (0 = the whole army)                                           | 4               | 0        |
| `attack.target`                         | `townHall` or `nearestBuilding`                                                                         | nearestBuilding | townHall |
| **retreat**                             |                                                                                                         |                 |          |
| `retreat.retreatRatio`                  | Retreats when the squad's strength < this × enemy strength around it (0 = never)                        | 0               | 0.6      |
| `retreat.retreatCooldownSeconds`        | Wait before attacking again after a retreat or lost army                                                | 60              | 40       |
| `retreat.retreatGiveUpSeconds`          | A retreat ends after this long anyway                                                                   | 20              | 20       |
| **defence**                             |                                                                                                         |                 |          |
| `defence.threatRadius`                  | Your soldiers this close to its buildings are a threat                                                  | 6               | 12       |
| `defence.defendChance`                  | Chance to notice an attack on its base at all                                                           | 0.25            | 1        |
| `defence.homeRadius`                    | Army counts as "home" within this distance                                                              | 20              | 20       |
| `defence.raidShare`                     | When away, comes back only for threats at least this share of its army                                  | 0.3             | 0.3      |

---

## Part 3. Easy: plays like a primary-school child

> Persona (`easy.json → persona`): _a primary-school child: slow and often distracted; few workers; forgets houses until it is full; one Barracks, no towers, always presses the same button; does not count before fighting; attacks late, in small groups, running off one by one at the nearest building; never retreats; often does not notice when its base is attacked._

The goal of Easy: **anyone can win**. A player who only trains some Militia, stays home and attacks once wins.

### 3.1 How a child thinks, and the setting for each habit

| The child…                                    | So Easy…                                                                                                                              | Settings                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| is slow and often looks away                  | Thinks every 2 s, reacts 3 s late, does nothing 30% of the time, and sends at most 4 commands at a time                               | `tempo.*`                                                                                                                          |
| does not like boring work                     | Keeps only 8 workers, queues one at a time, sends one idle worker per think, never rebalances                                         | `economy.workerTarget` 8, `economy.workerQueue` 1, `economy.idleWorkersPerThink` 1, `economy.rebalanceSeconds` 0                   |
| forgets houses until it is stuck              | Builds a House only when it is already full, so production stalls for a while                                                         | `buildings.houseBuffer` 0, `buildings.houseBufferPerProducer` 0                                                                    |
| has one plan and sticks to it                 | One Barracks, late (at 8 workers), no Stable, no tower ever                                                                           | `buildings.firstProducerAtWorkers` 8, `buildings.maxProducersPerType` 1, `buildings.militaryBuildingTypes` 1, `buildings.towers` 0 |
| presses the same button every time            | Trains only Militia, the Barracks' first button; never thinks about what you have. A Stable it is given (scenario start) stays unused | `army.unitChoice` first                                                                                                            |
| trains soldiers slowly                        | One Militia queued, at least 40 s between two                                                                                         | `army.militaryQueue` 1, `army.trainEverySeconds` 40                                                                                |
| plays in its base first                       | No attack before 6:00                                                                                                                 | `attack.earliestAttackSeconds` 360                                                                                                 |
| does not count before fighting                | Attacks with 4 soldiers, never compares strength, never gathers its army first                                                        | `attack.minWavePop` 4, `attack.attackRatio` 0, `attack.regroupSeconds` 0                                                           |
| runs in a few at a time                       | At most 4 soldiers attack at once; the rest wait at home and join one by one as others fall                                           | `attack.groupSize` 4                                                                                                               |
| goes for what is closest                      | Attacks the nearest building (a House, the Barracks), not the Town Hall that would win                                                | `attack.target` nearestBuilding                                                                                                    |
| never gives up a fight                        | Never retreats; after losing everything it waits 60 s                                                                                 | `retreat.retreatRatio` 0, `retreat.retreatCooldownSeconds` 60                                                                      |
| often does not notice its base being attacked | Notices only enemies right next to its buildings (6 tiles), and only one time in four                                                 | `defence.threatRadius` 6, `defence.defendChance` 0.25                                                                              |

What a child still does right: workers gather and avoid danger (safe nodes), and buildings never block each other. Its Town Hall still shoots arrows; that is the building, not the child.

### 3.2 A typical game against Easy

- **Standard start** (`/?setup=standard`):
  - 8 workers by about 2:00, Barracks at about 2:00;
  - about 1 Militia per 40 s, so about 6 by 6:00;
  - from 6:00, groups of up to 4 Militia walk to your nearest building.
  - If you do **nothing at all**, they wear your Town Hall down at about 12:30 (16 Militia trained).
- **Scenario start** (`/`):
  - it starts with an army as big as yours, but uses it 4 soldiers at a time;
  - its groups run into your base and are beaten by your army, Town Hall and tower one group after another.

### 3.3 How to beat Easy (what the tests prove)

- Train Militia now and then and keep them near your Town Hall. Its groups of 4 die there.
- Then attack its Town Hall. Three times in four it does not even notice.
- The test `tests/ai/novice.test.ts` plays exactly that on the scenario start: queue 5 Militia every minute, stay home, attack once at 12:00.
  - The novice wins (14:06 with seed 1).
  - Measured on 2026-11-07 after the army roster (M6.5): it won with all 8 seeds tried, between 14:06 and 15:54.
  - Before Easy was retuned for M6.5 it won only 3 of 8. Two changes were needed:
    - the scenario Stables moved behind the bases, out of the novice's way;
    - `defence.defendChance` went from 0.5 to 0.25.
- Normal beats Easy too (`tests/ai/ai.test.ts`): all 3 seeds tried, at about 6:00.

---

## Part 4. Normal: a careful player

> Persona (`normal.json → persona`): _a careful player who counts before fighting: builds a full economy, keeps houses ahead, gathers its army before attacking, retreats when losing and always defends._

This was Easy's behavior before 2026-11-07.

| The careful player…                                                                        | Settings                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Thinks every second and reacts in 1.5 s; never daydreams                                   | `tempo.*`                                                                 |
| Builds 16 workers (2 queued) and moves workers to whatever resource it needs               | `economy.workerTarget` 16, `economy.rebalanceSeconds` 12                  |
| Builds Houses early, keeping 3 + 2 per producer of free population                         | `buildings.houseBuffer` 3, `buildings.houseBufferPerProducer` 2           |
| Barracks at 6 workers, then a Stable, a second of each when rich, a Watch Tower after 5:00 | `buildings.*`                                                             |
| Trains the answer to what you have (7 picks in 10), and does not send horses into spears   | `army.unitChoice` counter, `army.counter*`                                |
| Keeps 2 soldiers queued per Barracks, with no pause                                        | `army.militaryQueue` 2, `army.trainEverySeconds` 0                        |
| Attacks after 5:00 with at least 8 population and 1.6× your strength                       | `attack.earliestAttackSeconds`, `attack.minWavePop`, `attack.attackRatio` |
| When it cannot grow any more (food gone), attacks at 1.0× and slowly accepts down to 0.6×  | `attack.stalled*`, `attack.desperate*`                                    |
| Gathers the whole army before attacking (80% arrived or 25 s) and attacks with all of it   | `attack.regroup*`, `attack.groupSize` 0                                   |
| Goes straight for your Town Hall                                                           | `attack.target` townHall                                                  |
| Retreats when below 0.6× of the enemy around it, then comes back with a bigger wave        | `retreat.*`                                                               |
| Always notices your soldiers within 12 tiles of its buildings and defends with everything  | `defence.threatRadius` 12, `defence.defendChance` 1                       |

**A typical game against Normal (you do nothing):**

- **Standard start:** 13 workers, a Barracks and then a Stable. It trains a mixed army (9 Militia, 6 Archers, 2 Knights, 1 Scout Rider by the end), and your Town Hall falls at about 7:30.
- **Scenario start:** it uses the Barracks and the Stable from the start (5 Militia, 5 Archers, 5 Scout Riders and 6 Knights trained), and your Town Hall falls at about 6:00.

Measured on 2026-11-07, after the army roster (M6.5).
