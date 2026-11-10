# M7b plan: Farm and Catapult in play (status: v2, approved and built 2026-11-09)

**Goal.** Two things that exist only on paper become part of the game:

1. **Farm**: a new, **much bigger** field building that gives food forever. It fixes the known
   limit that long games stall once the berries are gone (PLAN §12 M6 "Known limit").
2. **Catapult**: the siege unit already in `units.json` becomes trainable, from a new **Siege
   Workshop**, with a clear role, a weakness and a situation where it shines (the M6.5 roster rule).

Both machine-player modes learn to use them, and Easy must stay beatable by the novice script.

**Decisions from your review (2026-11-09):**

| #   | Question          | Answer                                                                                 |
| --- | ----------------- | -------------------------------------------------------------------------------------- |
| Q1  | Farm size         | 4×4                                                                                    |
| Q2  | Farmers           | **1 per farm**, no re-planting                                                         |
| Q3  | Walkable          | **No**: farms block like other buildings (easy implementation)                         |
| Q4  | Food              | Infinite, but **slower per worker than berries**, so the berries are still worth using |
| Q5  | Catapult producer | A new Siege Workshop                                                                   |
| Q6  | AI                | Normal uses farms and Catapults; Easy builds a late farm and no Catapults              |

**As built (2026-11-09), changes from the plan below:**

- **The farmer works on the field** (your request while it was being built). The farm still blocks
  everyone else. Its worker walks straight in `gather.workInside` tiles (0.45 for the Farm) from the
  edge and works there; before any other order it walks back out. A melee unit chasing a unit inside
  a building aims just outside the nearest edge, so farmers can still be raided (tested).
- The scarecrow got a dark hat and straw arms: the first version looked like a worker in the field.
- New AI setting **`priorities.siege`** (Easy 0, Normal 65): with farms feeding the army, Catapults
  at the soldier priority were never afforded.
- `buildings.farmDistance` is [5, 14] for Easy and [6, 18] for Normal: with [5, 12] the crowded
  Green Valley base had no room for a 4×4 field by 9:00.
- `buildings.maxFarms` for Easy is 2 (the plan said 1 in one place, 2 in another).
- Review: farm slots go first to workers already harvesting (no slot stealing by a newcomer); the
  UI rally onto a farm sends the farm as target; no Catapults while the AI's base is threatened.

**Rules that still apply:** everything is config (`src/data/*.json`, generic code: the
`config-first` rule); one shared work animation; the AI module (`ai/`) stays local, holds no config,
and reads units and buildings from the game data; every unit needs a role, a weakness and a
situation where it shines, and none is best everywhere (`docs/units.md`).

---

## 0. What exists today

| Thing          | Data                                                                   | Engine                                      | Art                                                                                             | AI      |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| Farm           | **none** (only in the original design, PLAN §2.1: 2×2, 1 worker, 60 W) | buildings cannot be gathered from           | a **2×2** model in `classic` and `aetherfall` (`/?models` lists it as "Farm (unused)"); no icon | —       |
| Catapult       | full stats in `units.json` (class `siege`, splash, min range 2)        | works: combat tests destroy a house with it | model + icon in both collections                                                                | ignored |
| Siege Workshop | none                                                                   | —                                           | none                                                                                            | —       |

Food today: berries only, 200 per bush, about 1,400 per side.

---

## 1. The Farm

### 1.1 Design

| Setting           | Value                                                         | Why                                                                              |
| ----------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Footprint         | **4×4** (16 tiles; the old model was 2×2; Town Hall is 3×3)   | "much bigger" (Q1)                                                               |
| Farmers           | **1 worker per farm**                                         | Q2                                                                               |
| Food              | **infinite**, never runs out, no re-planting                  | Q2, Q4                                                                           |
| Gather rate       | **0.35 food/s** (berries 0.45, trees 0.40, gold 0.35)         | slower than berries per worker, so berries stay worth using while they last (Q4) |
| Cost / build time | **60 wood**, 25 s                                             | the original design cost; one farm feeds only one worker                         |
| HP / armor        | 400 / 0, class `building`                                     | big but soft: a raid target, Catapult food                                       |
| Walkable          | **no**: it blocks like every other building                   | easy implementation (Q3); no grid change                                         |
| Population        | provides 0                                                    |                                                                                  |
| Who may gather    | only its owner's workers                                      | enemies can attack it like any building                                          |
| Build menu        | hotkey **S** (second row: A Stable, S Farm, D Siege Workshop) |                                                                                  |

The farmer stands at the field's edge (the nearest free tile, as at a berry bush) and uses the
shared work animation, facing the field.

### 1.2 How farming works in play

- **Right-click your finished Farm** with workers: the first one farms it. The others go to the
  nearest own farm that is free within `gathering.retargetRadius` (8 tiles), else the nearest food
  node, else they walk next to it.
- **Town Hall rally on a Farm**: new workers farm it (or, if it is taken, do the search above).
- **Berries run out**: the existing "find another node of the same resource" step also looks at
  own free farms, so workers move to farms by themselves.
- **Farm destroyed**: its farmer does the same search, from the farm's position.
- **Info panel:** HP, armor and a new field **Farmer 0/1** (`gatherers`). A farmer's task reads
  "Gathering food".
- Nobody can farm a construction site.

### 1.3 Data (config, not code)

`src/data/buildings.json`:

```json
"farm": {
  "name": "Farm",
  "description": "A big field. One worker gathers food here, a little slower than at berries, but it never runs out.",
  "model": "farm",
  "icon": "farm",
  "footprint": [4, 4],
  "hp": 400,
  "armor": 0,
  "popProvided": 0,
  "cost": { "wood": 60 },
  "buildTime": 25,
  "gather": { "resource": "food", "slots": 1 },
  "panel": ["hp", "armor", "gatherers"],
  "actions": []
}
```

- `src/data/units.json` → worker: `interactions.gather.targets` gains `"farm": 0.35`. A gather
  target may now be **a node kind or a building type that has `gather`**.
- `src/data/game.json` → `buildMenu` gains `{ "building": "farm", "hotkey": "S" }`.

New schema fields (`src/shared/gameData.ts`, zod + cross-checks):

| Field                                      | Type                                         | Check                                                           |
| ------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| `buildings.*.gather`                       | `{ resource, slots: int ≥ 1 }`               | `resource` is a resource type. A gather building never runs out |
| `units.*.interactions.gather.targets` keys | node kind **or** building type with `gather` | an unknown key is an error, as today                            |
| panel field `gatherers`                    | new panel field id                           | only on buildings with `gather`                                 |

`slots` is config (the Farm has 1), so a bigger field with more farmers stays a data change.

### 1.4 Engine changes (generic: the code never says "farm")

| Part                    | Change                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities/Building.ts`  | `gatherers: EntityId[]`: the workers holding its slots (empty for buildings without `gather`)                                                                                                                                                                                                     |
| `systems/orders.ts`     | gather works on a **gather source**: a node, or an own finished building with `gather`. A helper `sourceOf(state, id, unit)` returns rect, resource, and whether it runs out. A worker takes a free slot when it starts on a building; harvesting a building adds food and never lowers an amount |
| slot bookkeeping        | a slot is free again when its worker dies, gets another order, or the building is destroyed. It is checked every tick in a fixed order (deterministic)                                                                                                                                            |
| `findNode()`            | also returns own gather buildings with a free slot (same resource, same radius, ties by id)                                                                                                                                                                                                       |
| `Game.ts` `interact`    | a right-click on an own building with `gather` gives workers a gather order (today only nodes do)                                                                                                                                                                                                 |
| `systems/production.ts` | a rally target may be an own building with `gather`                                                                                                                                                                                                                                               |
| `Game.observe()`        | `ObservedBuilding.gatherers: number`, so the AI sees free farms                                                                                                                                                                                                                                   |
| combat, victory, stats  | unchanged; farm food counts as gathered food                                                                                                                                                                                                                                                      |
| `stateHash`             | includes the slot holders                                                                                                                                                                                                                                                                         |

### 1.5 The new Farm model ("much bigger" redesign)

A new **4×4** model in both art collections (`aetherfall`, the default look, and `classic`). The old
2×2 drawings are replaced. Farms block, so the model may have height.

```
 top view, 4×4 tiles (+x →, +z ↓)
 ┌──────────────────────────────┐   ── wooden fence all round, gate on the camera side
 │ ┌────┐ ≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡ │   ┌┐  small thatched barn in the back corner
 │ │barn│ ≡≡ wheat (ripe) ≡≡≡≡≡ │   ≡  long crop rows: ripe wheat, green crops, young sprouts
 │ └────┘ ≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡ │
 │ ▒▒▒▒▒▒▒▒▒▒ green ▒▒▒▒▒▒  ✝  │   ✝  team-colored scarecrow
 │ ,,,,,,,,,, sprouts ,,,,,,,,,, │
 │ ◘◘ hay bales      ,,,,,,,,,, │
 └──────────── gate ─────────────┘   team pennant on a gate post
```

- One big plowed field with long furrows in three crop bands. It reads as one large farm, not four
  small ones.
- A small thatched barn (about 1×1.3, 1.2 tall) in the back corner, so it does not hide units in front.
- Fence rails, the gate pennant and the scarecrow's shirt use the team colors (the only team
  markings).
- Not in this step: crops that change when farmed (growth stages). The model is static.

Also new: a **`farm` HUD icon** (a wheat sheaf) in both collections, for the build menu and info
panel. `/?models` drops the "(unused)" label. The style diorama (`/?preview`), which places two 2×2
farms, gets one 4×4 farm.

### 1.6 Placement and space

The Farm is placed like any building (16 free buildable tiles). The AI keeps its usual free ring
around it. The headless AI tests on all three maps check that both sides can place several farms
near their Town Hall.

---

## 2. The Catapult and the Siege Workshop

### 2.1 Siege Workshop (new building)

```json
"siege_workshop": {
  "name": "Siege Workshop",
  "description": "Builds Catapults.",
  "model": "siegeWorkshop",
  "icon": "workshop",
  "footprint": [3, 3],
  "hp": 1000,
  "armor": 1,
  "popProvided": 0,
  "cost": { "wood": 200, "gold": 50 },
  "buildTime": 50,
  "panel": ["hp", "armor", "queue"],
  "actions": [
    { "type": "train", "unit": "catapult", "hotkey": "Q" },
    { "type": "setRally", "hotkey": "Z" }
  ]
}
```

- Build menu hotkey **D**, listed after the Stable (so the AI's "army building kinds in build-menu
  order" stays Barracks → Stable → Workshop).
- No prerequisite (like the Stable; there are no eras).
- New voxel model (3×3): an open timber shed with a half-built catapult frame inside, a
  log pile, a big wheel leaning on the wall, a team banner. New icon `workshop` (hammer and wheel),
  both collections.

### 2.2 Catapult: stats and role

The stats stay as they are in `units.json`; only the description and the target priority change.

| Stat                | Value                                                                                                                                                                               | Compared with                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Cost                | 150 wood, 120 gold, **3 pop**                                                                                                                                                       | the most expensive unit                                                 |
| HP / armor          | 70 / 1                                                                                                                                                                              | dies fast when caught                                                   |
| Speed               | 1.2 tiles/s                                                                                                                                                                         | slowest unit (Militia 2.0)                                              |
| Attack              | 12 dmg, every 5 s, range **8**, **min range 2**; **+30 vs building and tower**; 1-tile splash (50% at the edge); the stone lands where the target was, so moving units can dodge it | Tower range 7, Town Hall range 6                                        |
| Damage to buildings | 41 per shot (after armor 1)                                                                                                                                                         | Watch Tower (500 HP): 13 shots ≈ 65 s alone; Town Hall (1500): 37 shots |

**Role (for `docs/units.md`):**

| Role                                             | Weakness                                                                                                                           | Shines when                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Breaks towers and bases from outside their range | can't hit anything within 2 tiles; slow; Scout Riders deal +6 vs siege and kill a lone Catapult in about 14 s; misses moving units | the enemy turtles behind Watch Towers and the Town Hall; a clump of units stands still |

It is not best everywhere: against an army in the field it does 2.4 damage per second and needs
an escort.

**New per-unit target priority** (config, generic): `units.*.combat.targetPriority` overrides
`game.json → combat.targetPriority` for that unit. For the Catapult:

```json
"combat": {
  "autoAttack": true,
  "stance": "aggressive",
  "targetPriority": { "tower": 1, "building": 2, "siege": 3, "infantry": 4, "ranged": 4, "cavalry": 4, "worker": 5 }
}
```

So a Catapult on attack-move shoots the tower, not the Militia standing next to it. Without this,
the global priority (units first) would waste its 5-second shots on soldiers.

New description: _"Siege engine that breaks towers and bases from out of their range. Strong vs
buildings, towers and clumped units. Weak up close (min range 2), slow, and easy prey for Scout
Riders."_

---

## 3. Machine player (`ai/` code + `src/ai/profiles/*.json` settings)

The AI code stays generic: it learns about **gather buildings** and **siege units** from the game
data (`StaticMapInfo.data`), never the words "farm" or "catapult".

### 3.1 Farms

- **When:** it builds a farm when the food left in **safe** berry bushes drops below
  `economy.farmWhenFoodBelow`. It then keeps one farm per food worker beyond what the berries
  can hold, up to `buildings.maxFarms`, one at a time.
- **Where:** `buildings.farmDistance` = [preferred, max] tiles from the Town Hall, like houses,
  with the usual free ring.
- **Workers:** the worker-assignment step treats a free farm like a food node. It is "safe" while
  it stands inside the home radius, and it never runs out.
- **Priority:** `priorities.farm`.

### 3.2 Siege

- **Workshop:** comes as the 3rd army building kind (`buildings.militaryBuildingTypes`: Easy 1,
  Normal **3**, was 2), after `buildings.siegeAfterSeconds`.
- **Catapults:** trained up to `army.maxSiege` alive at a time. They are **not** part of the counter
  pick (they lose every unit-vs-unit comparison by design), so the `counterMinShare` rule does not
  stop the Workshop. A siege unit is trained when the enemy has a Watch Tower or when the next
  attack target is a building.
- **Attacks:** Catapults join the wave like other soldiers. The army regroups, as today, so the
  slow Catapults are not left behind (`attack.regroupSeconds`). Their target priority does the rest.
- **Against your Catapults:** nothing special. The counter pick already values the Scout Rider's
  +6 vs siege.

### 3.3 New profile settings

| Setting                           | Easy     | Normal        | Meaning                                                    |
| --------------------------------- | -------- | ------------- | ---------------------------------------------------------- |
| `economy.farmWhenFoodBelow`       | 150      | 400           | build the first farm when safe berry food drops below this |
| `buildings.maxFarms`              | 2        | 6             | one farmer each                                            |
| `buildings.farmDistance`          | [5, 10]  | [5, 12]       | [preferred, max] tiles from the Town Hall                  |
| `priorities.farm`                 | 40       | 75            | between house and worker (Normal); Easy is lazy about it   |
| `buildings.militaryBuildingTypes` | 1 (same) | **3** (was 2) | Normal now builds a Workshop too                           |
| `buildings.siegeAfterSeconds`     | —        | 480           | no Workshop before 8 minutes                               |
| `army.maxSiege`                   | 0        | 3             | Catapults alive at a time                                  |

Each new setting gets a row in the configuration table of `docs/ai-modes.md` (a test fails
otherwise), and Part 1 of that doc gets a "Farms" and a "Siege" paragraph.

**Easy stays relaxed:** at most two late farms (so it does not stall forever), no Workshop, no Catapults.

---

## 4. UI changes

| Where           | Change                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| Build menu      | Farm (S) and Siege Workshop (D) buttons with their icons; costs from data    |
| Placement ghost | none needed: it already uses the footprint from the data (4×4 for the Farm)  |
| Right-click     | workers over an own farm show the gather cursor/marker (same as over a node) |
| Info panel      | `gatherers` field: "Farmer 1/1"                                              |
| Minimap         | unchanged (buildings are drawn from their rect)                              |
| How to Play     | one line each for Farm and Siege Workshop / Catapult                         |

---

## 5. Tests

| File                              | New / changed                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/shared/gameData.test.ts`   | `gather`, gather target may be a gather building, unknown target still fails, `gatherers` panel field only with `gather`, per-unit `targetPriority`                                                                                                                                                                                                                                                    |
| `tests/engine/farm.test.ts` (new) | a farmer gathers 0.35 food/s, slower than at berries; a 2nd worker sent to a taken farm goes to another free farm or food node; food never runs out over 30 min; the slot frees on death and on a new order; berries running out sends a farmer to a free farm; a destroyed farm frees its slot; rally onto a farm; only the owner can farm it; a site cannot be farmed; determinism (same hash twice) |
| `tests/engine/combat.test.ts`     | Catapult prefers a tower over the Militia next to it (per-unit priority)                                                                                                                                                                                                                                                                                                                               |
| `tests/engine/balance.test.ts`    | 2 Catapults destroy a Watch Tower from outside its range and both live; 1 Scout Rider kills a lone Catapult; 4 Catapults bring a Town Hall down faster than the same cost of Knights; Catapult splash hurts 5 clumped standing Militia; against moving Archers it does little                                                                                                                          |
| `tests/docs/units.test.ts`        | the units doc table includes the Catapult and the Workshop (the existing sync test)                                                                                                                                                                                                                                                                                                                    |
| `tests/ui/art.test.ts`            | passes as is: new icons `farm`, `workshop` and model `siegeWorkshop` must exist, no icon shared                                                                                                                                                                                                                                                                                                        |
| `ai/tests/ai.test.ts`             | Normal builds a farm after berries run low and farms it; Normal builds a Workshop and Catapults in a long match; Easy never trains Catapults                                                                                                                                                                                                                                                           |
| `ai/tests/maps.test.ts`           | Normal places its farms on every map                                                                                                                                                                                                                                                                                                                                                                   |
| `ai/tests/novice.test.ts`         | **must still pass** on several seeds: the novice beats Easy                                                                                                                                                                                                                                                                                                                                            |
| new long match (slow, own file)   | Normal vs Normal for 30 minutes: food income does not stop after the berries are gone (the stall is fixed)                                                                                                                                                                                                                                                                                             |

---

## 6. Docs

- `docs/units.md`: the roster grows to five army units (Catapult row in the overview table, role /
  weakness / shines, the new balance proofs), plus the Siege Workshop.
- `docs/ai-modes.md`: new settings and the Farms / Siege paragraphs.
- PLAN.md: §2.1 farm numbers (4×4, 1 farmer, 60 W, 0.35 food/s) replace the old 2×2 design; §12 M7b checklist
  and notes; §14 status.
- Screenshots in `docs/milestones/m7b-*.png`: a farm with its farmer, the build menu, Catapults
  shelling a tower, the Workshop.

---

## 7. Steps and done criteria

| #   | Step                                                                                                          | Done when                                                               |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Schema: `gather`, gather targets, `gatherers` panel field, per-unit `targetPriority`                          | `gameData.test.ts` passes                                               |
| 2   | (dropped: farms block like other buildings, so no grid change)                                                | —                                                                       |
| 3   | Gather sources: farm slots, interact, rally, retarget, slot bookkeeping, observation                          | `farm.test.ts` passes                                                   |
| 4   | Data: Farm, Siege Workshop, Catapult priority + description, build menu                                       | both buildable and trainable in a headless game                         |
| 5   | Art: new 4×4 Farm model (both collections), Workshop model, `farm` + `workshop` icons, viewer/preview updates | `/?models` and `/?hud` look right (screenshots); `art.test.ts` passes   |
| 6   | UI: build menu, gather cursor on farms, Farmer panel field, How to Play                                       | checked in the browser                                                  |
| 7   | Balance tests for the Catapult; `docs/units.md`                                                               | `balance.test.ts` passes; units doc test passes                         |
| 8   | AI: farms, Workshop, siege limits, new profile settings, `docs/ai-modes.md`                                   | AI tests pass; **novice beats Easy** on seeds 1–8 on all maps as before |
| 9   | Long match: the food stall is gone                                                                            | the 30-minute test passes                                               |
| 10  | Browser check: play a Standard start vs Normal to ~12 min (farms, Workshop, Catapults)                        | screenshots in `docs/milestones/`                                       |
| 11  | PLAN.md, `npm run check`, stop for your review; commit when you say so                                        | all green                                                               |

---

## 8. Risks

| Risk                                                                                | Answer                                                                                                                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Infinite food makes Normal much stronger in long games, or lets Easy win more often | AI farm settings are per mode; the novice test runs on 8 seeds × 3 maps                                                             |
| Catapults out-ranging the Town Hall make turtling useless                           | that is the point; they are slow and fragile, and Scout Riders punish them. Balance tests prove both sides                          |
| 4×4 farms take a lot of room (one worker each)                                      | the scenario does not place farms; the AI places them in the open around the base, and the maps test checks it manages on every map |
| AI Catapults trail behind the wave and die alone                                    | the existing regroup step waits for 80% of the army; `maxSiege` keeps their number small                                            |
| Slot bookkeeping drifts (a farm stays "taken")                                      | slots are re-checked every tick from the workers' real orders; a test kills, re-orders and destroys                                 |

---

## 9. Questions for you

All answered (see the decisions table at the top).
