# Banners of Dawn: Web RTS Game, Detailed Project Plan (v4, for review)

> **Banners of Dawn** is a 3D voxel-style (low-poly with pixel textures), 1v1 real-time strategy game played against the computer in the browser.
> Status (2026-11-08): playable against the machine from a Main Menu, on 3 maps, with match settings (difficulty, start, pace, game speed), a pause menu and player settings. Progress per milestone: §12; how to resume: §14.

### Changes since v3 (graphics direction corrected)
| What | v3 | v4 |
|---|---|---|
| World graphics | 2D isometric pixel art at 640×360 | **3D low-poly "voxel" models with pixel textures**, real lighting and shadows (three.js) |
| Camera | 2D iso projection | Perspective camera, fixed 45° yaw, 52° pitch, 30° FOV; zoom and pan |
| HUD | Drawn into the pixel canvas | **HTML/CSS overlay** in a pixel style: Pixelify Sans font, pixel-art icons, slate and brass panels |
| Art pipeline | Sprite sheets compiled from `.px` text | Models and textures **generated in code** (VoxelBuilder + procedural pixel textures); no binary art files |
| Depth sorting / sprite picking | Custom topological sort, alpha-mask picking | Not needed (z-buffer); picking by ray and screen projection |
| Unchanged | Engine, AI, maps, rules, pace, milestones order | Isometric was always UI-only, so nothing else moves |

### Changes since v2 (your answers applied)
| # | Your answer | What changed in the plan |
|---|---|---|
| 1 | TypeScript + Vite is OK; you use nvm | `.nvmrc` pins **Node 24 LTS**. Your current nvm default (v20.16) is too old for current Vite; `nvm install` will fetch 24 |
| 2 | Web Worker is OK, but no AI agent called through a 3rd-party API | The machine player is **100% local, rule-based code**. No LLM, no external service, no network. This is enforced by lint, by a Content Security Policy and by a test (§6.2) |
| 3 | Isometric | First done as 2D iso pixel art, **then corrected in v4 to a 3D voxel style** with a fixed iso-like camera (§7) |
| 4 | One shared faction | Kept |
| 5 | I do everything | All models, textures, icons, sfx and music are made in code (§7.8) |
| 6 | No Insane level, keep it simple | Difficulties are **Easy / Normal / Hard** only. Every AI level uses fog of war with no bonuses |
| 7 | English | English only, with an ASCII bitmap font |
| 8 | I choose the name | **Banners of Dawn** |
| 9 | Pace should be configurable | **Match pace presets** (Relaxed, Standard, Fast, Blitz) plus **Custom** sliders (§2.11) |

---

## Table of Contents
1. [Vision & Scope](#1-vision--scope)
2. [Gameplay Design](#2-gameplay-design)
3. [Architecture Overview](#3-architecture-overview)
4. [Shared Contracts (protocol)](#4-shared-contracts-protocol)
5. [Game Engine](#5-game-engine)
6. [Machine Player (AI): separate module](#6-machine-player-ai--separate-module)
7. [UI & Rendering (3D voxel style)](#7-ui--rendering-3d-voxel-style-with-pixel-textures)
8. [Maps](#8-maps)
9. [Game Data Files](#9-game-data-files)
10. [Host / Glue Layer](#10-host--glue-layer)
11. [Tooling, Testing & Quality](#11-tooling-testing--quality)
12. [Milestones (tasks + acceptance criteria)](#12-milestones)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Decisions Log & Next Step](#14-decisions-log--next-step)

---

## 1. Vision & Scope

| Requirement | Decision |
|---|---|
| Genre | Classic base-building RTS: gather → build → train → fight |
| Mode | **1 vs 1 only**, human vs machine. No multiplayer, no networking |
| Inspiration | The economy and era progression of classic "age" RTS games, played at the **pace and simplicity of small pixel RTS games** |
| Visual style | **3D voxel / low-poly models with pixel textures**, fixed iso-like 3D camera, real shadows; pixel-styled HUD |
| Architecture | **UI, game engine, AI (machine player) and maps are separate modules/folders** with enforced boundaries |
| Machine player | Local, rule-based TypeScript running in a Web Worker. **No external AI services or APIs** |
| Pace | Configurable per match. The Standard preset targets 12–20 minutes |
| Language | English |
| Platform | Desktop browsers (Chrome, Firefox, Edge, Safari) with mouse and keyboard. Mobile is out of scope for v1 |
| Connectivity | Fully offline once loaded. The only network requests are for the game's own static files |

All names, art, units and maps are **original**. We borrow genre mechanics, not any specific game's content or look.

### Design pillars
1. **Easy to learn.** 6 unit types, 13 buildings, 3 resources. A new player understands the whole game in 5 minutes.
2. **Short, adjustable matches.** You pick the pace.
3. **Readable.** Each unit can be identified at a glance: chunky models, strong team colors, clear health bars, and silhouettes for units behind buildings.
4. **Fair machine opponent.** The AI follows the same rules and the same fog of war as the player, with no bonuses at any difficulty.

### Out of scope for v1 (possible later)
Multiplayer, campaign, multiple factions, naval units, garrisoning, trading, alternate victory types, terrain elevation, mobile and touch controls, other languages.

---

## 2. Gameplay Design

> All numbers below are **Standard pace** base values. The pace settings (§2.11) apply multipliers on top of them.

### 2.1 Resources
| Resource | Sources | Base gather rate (per worker) | Main use |
|---|---|---|---|
| **Food** | Berry bush (100 each, in clusters of 6), Farm (infinite) | Berries 0.45/s, Farm 0.35/s | Workers, cavalry, era advances |
| **Wood** | Tree (100 each) | 0.40/s | Buildings, archers, siege |
| **Gold** | Gold mine (2×2, 800 each) | 0.35/s | Advanced units, techs, era advances |

- **No carrying, no drop-off (decided 2026-11-06):** every unit of resource a worker harvests goes **straight into the stockpile**. Workers stay at the node until it runs out. There are no drop sites.
- When a node runs out, the worker automatically looks for the nearest node of the same type within **8 tiles**. If none is found, the worker goes idle and the idle-worker indicator lights up.
- A farm takes **1 worker** and never runs out. Farms are **walkable**.
- **Starting state (Standard):** 200 Food, 200 Wood, 100 Gold, 1 Town Hall, 3 Workers, 1 Scout Rider.

### 2.2 Population
- Town Hall gives +5, House +5, Castle +10. The **cap is 100** at Standard pace (configurable, §2.11).
- If a unit would go over the cap, training pauses and the HUD shows "Need more houses".

### 2.3 Eras (3): **dropped 2026-11-07, there is a single era**
> Decision (2026-11-07): no eras. Every unit, building and tech is available once its production building exists. The table below is kept only as history; the `era` field and all era rules are removed in M6 (see `docs/plans/m6-vs-machine.md`).

| Era | Cost | Research time | Requirement | Unlocks |
|---|---|---|---|---|
| **I. Settlement** | (start) | — | — | Worker, Militia. Town Hall\*, House, Storehouse, Farm, Barracks |
| **II. Kingdom** | 400 F, 80 G | 60 s | Barracks + Storehouse built | Archer, Scout Rider. Archery Range, Stable, Blacksmith, Watch Tower, Wall, Gate, additional Town Hall |
| **III. Empire** | 600 F, 300 G | 90 s | 2 of {Archery Range, Stable, Blacksmith} | Knight, Catapult. Siege Workshop, Castle. Tier-II techs |

\*An additional Town Hall can only be built from Era II.

Typical timings at Standard pace: Era II at about 7–9 minutes, Era III at about 14–16 minutes.

### 2.4 Units
> **Updated 2026-11-07 (M6.5):** the four army units, their roles, counters and current numbers are in `docs/units.md` (kept in sync with `units.json` by a test). The Barracks trains Militia and Archers; the Stable trains Scout Riders and Knights. The table below is the original design, kept as history.

Damage formula:
```
damage = max(1, attack + bonus[target.class] + attackUpgrades - (target.armor + armorUpgrades))
```

| Unit | Trained at | Era | Cost | Time | Pop | HP | Atk | Armor | Range | Cooldown | Speed (tiles/s) | Sight | Class | Bonus damage |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Worker | Town Hall | I | 50 F | 12 s | 1 | 25 | 3 | 0 | melee | 1.5 s | 2.0 | 4 | worker | — |
| Militia | Barracks | I | 35 F, 20 W | 15 s | 1 | 45 | 4 | 1 | melee | 1.5 s | 2.2 | 4 | infantry | +8 vs cavalry |
| Archer | Archery Range | II | 30 W, 40 G | 18 s | 1 | 30 | 4 | 0 | 5 | 1.6 s | 2.2 | 6 | ranged | +4 vs infantry |
| Scout Rider | Stable | II | 80 F | 20 s | 1 | 60 | 4 | 0 | melee | 1.8 s | 3.6 | 7 | cavalry | +4 vs ranged, +3 vs worker, +6 vs siege |
| Knight | Stable | III | 60 F, 75 G | 28 s | 2 | 120 | 10 | 2 | melee | 1.8 s | 3.0 | 5 | cavalry | +2 vs ranged |
| Catapult | Siege Workshop | III | 150 W, 120 G | 40 s | 3 | 70 | 12 | 1 | 8 (min 2) | 5.0 s | 1.2 | 9 | siege | +30 vs building; splash 1 tile (50% at edge) |

Counter triangle, checked against the numbers above:
- **Militia beats cavalry.** 1 Militia beats 1 Scout easily, and 3 Militia beat 1 Knight.
- **Archers beat infantry.** They get free shots on approach plus bonus damage.
- **Cavalry beats archers and siege.**
- **Catapults beat buildings and clumped units**, but they are helpless up close because of the 2-tile minimum range.

### 2.5 Buildings
| Building | Footprint | Era | Cost | Build time\* | HP | Function |
|---|---|---|---|---|---|---|
| Town Hall | 3×3 | I (start) / II (extra) | 300 W, 150 G | 90 s | 1500 | Trains Worker, researches Eras, +5 pop, shoots arrows (4 dmg, range 6, every 2 s) |
| House | 2×2 | I | 30 W | 15 s | 300 | +5 pop |
| Storehouse | 2×2 | I | 80 W | 20 s | 400 | Economy techs (no drop-off role any more) |
| Farm | 2×2 | I | 60 W | 15 s | 200 | Infinite food, 1 worker, walkable |
| Barracks | 3×3 | I | 150 W | 40 s | 1000 | Trains Militia |
| Archery Range | 3×3 | II | 150 W | 40 s | 1000 | Trains Archer (requires Barracks) |
| Stable | 3×3 | II | 150 W | 40 s | 1000 | Trains Scout Rider, Knight (III). **Built in M6.5:** 175 W, 45 s, 900 HP, no era or prerequisite; the Barracks trains Archers, so there is no Archery Range |
| Blacksmith | 3×3 | II | 150 W | 40 s | 900 | Attack and armor upgrades |
| Watch Tower | 1×1 | II | 125 W, 50 G | 35 s | 500 | 6 dmg, range 7, every 2 s, sight 9 |
| Wall | 1×1 per segment | II | 3 W per segment | 4 s per segment | 250 | Drag to place a line along a grid axis |
| Gate | 3×1 or 1×3 | II | 30 W | 15 s | 600 | Opens for its owner only; blocks the enemy |
| Siege Workshop | 3×3 | III | 200 W | 50 s | 1000 | Trains Catapult |
| Castle | 4×4 | III | 400 W, 300 G | 100 s | 3000 | Shoots 3 arrows (6 dmg, range 8), +10 pop |

\***Construction needs no workers (decided 2026-11-06).** The player presses **Build**, picks a building from the build menu and places it. The cost is paid immediately and the construction site finishes on its own after `buildTime` seconds (× `pace.buildSpeed`).
- All buildings have **armor 1**.
- A building under construction has HP in proportion to its progress.
- **Repair** (later) will also be a button on the building, not a worker job.
- **Destroyed buildings** leave rubble for 30 s.
- **Deleting your own building** refunds nothing, except a building not yet started, which is refunded 100%.

### 2.6 Technologies
| Tech | Building | Era | Cost | Time | Effect |
|---|---|---|---|---|---|
| Sharp Axes | Storehouse | I | 100 F, 50 W | 25 s | +20% wood gather rate |
| Wheelbarrow | Storehouse | II | 150 F, 50 W | 35 s | +5 carry, +10% worker speed |
| Gold Picks | Storehouse | II | 100 F, 75 W | 30 s | +20% gold gather rate |
| Irrigation | Storehouse | II | 100 W, 50 G | 30 s | +25% farm rate |
| Weapons I | Blacksmith | II | 100 F, 50 G | 30 s | +1 attack (all military except siege) |
| Armor I | Blacksmith | II | 100 F, 50 G | 30 s | +1 armor (all military) |
| Weapons II | Blacksmith | III | 200 F, 120 G | 45 s | +1 more attack |
| Armor II | Blacksmith | III | 200 F, 120 G | 45 s | +1 more armor |

### 2.7 Production rules
- Each building has a queue of **at most 5** items. The cost is paid when an item is queued and refunded in full if it is cancelled.
- A new unit appears on a free tile next to the building, on the side facing the **rally point**, and then moves to the rally point.
  - If the rally point is a resource, a new worker starts gathering it automatically.
- A building researches one tech at a time. Research uses the same queue as training.

### 2.8 Unit behavior rules
| Behavior | Rule |
|---|---|
| Stances | **Aggressive** (default): auto-acquire targets within sight. **Hold**: only attack within range, never move |
| Auto-target priority | 1) a unit attacking me, 2) military units, 3) workers, 4) towers, 5) other buildings |
| Leash | An auto-acquired chase stops after 12 tiles, then the unit returns. Explicit attack orders have no leash |
| Workers | Never auto-attack. They flee 4 tiles when hit while idle |
| Order queue | Shift + command appends to the unit's order queue (max 16) |

### 2.9 Win / Lose
- **Win:** the enemy has **no Town Hall, no Castle and no production buildings left**, **or** the enemy surrenders.
- **AI resign:** the machine player surrenders when it has no production buildings, no military and fewer than 3 workers.
- **Result screen statistics:** match time, units trained and lost, kills, resources gathered, buildings built and destroyed, era timings, and an army-size-over-time graph.

### 2.10 "Easy to play" simplifications
- Few unit types, a short tech list, and one faction (team colors only).
- Idle-worker button and hotkey, plus an idle-production warning.
- Rally points everywhere, including "rally to a resource".
- Farms never run out; there is no reseeding.
- No formations. Only two stances.
- Context-sensitive right click does everything.
- A **How to Play** screen with illustrated pages, plus optional first-match tips.

### 2.11 Match pace (configurable)
> **Current state (2026-11-08, M7a):** the four presets below are in `src/data/pace.json` and are picked in Match Setup (or `/?pace=fast`). They set gather, build and train speed, starting resources and pop cap; there are no research or era columns (no eras), and **no Custom sliders yet**. `src/data/game.json` → `pace`, `startingResources`, `popCap` stay as the engine default and must equal the Standard preset (a test checks it). The engine keeps the chosen rules in its state (`GameOptions.rules`); the machine player receives game data with them already applied (`applyRules`), and the HUD shows the real times. The AI does not yet scale its own timings by pace. Details: `docs/plans/m7-menus-art-maps.md` §3.

Pace is chosen in Match Setup and **fixed for the whole match**. It is separate from **game speed** (1×, 1.5×, 2×), which is a time scale you can change at any moment during play.

**Presets**
| Preset | Gather rate | Build speed | Train speed | Research speed | Era cost | Starting resources | Pop cap | Target length |
|---|---|---|---|---|---|---|---|---|
| Relaxed | ×0.8 | ×0.8 | ×0.8 | ×0.8 | ×1.0 | Standard | 100 | 20–30 min |
| **Standard** (default) | ×1.0 | ×1.0 | ×1.0 | ×1.0 | ×1.0 | Standard | 100 | 12–20 min |
| Fast | ×1.5 | ×1.5 | ×1.5 | ×1.5 | ×0.75 | High | 100 | 8–12 min |
| Blitz | ×2.0 | ×2.5 | ×2.0 | ×2.5 | ×0.5 | Very High | 125 | 5–8 min |
| Custom | 0.5–3.0 | 0.5–3.0 | 0.5–3.0 | 0.5–3.0 | 0.5–1.5 | any | 50–200 (step 25) | — |

**Starting resources:** Low 100 F / 100 W / 0 G, Standard 200/200/100, High 500/500/300, Very High 1000/1000/600.

**How it works:**
- `MatchRules` (§4.5) is passed to `createGame`.
- `engine/rules/applyRules.ts` produces a **derived data bundle** in which times, rates and costs are already scaled.
- The UI (tooltips show the real times and costs) and the AI (which receives the derived data and the rules) both use this derived data, so nobody multiplies numbers separately.
- The AI scales its own timing parameters (earliest attack, re-scout interval, timeouts in its build order) by the **pace factor** = average of the gather, train and research multipliers.
- The last used pace and custom values are remembered in `localStorage`.
- Presets live in `src/data/pace.json`, so new presets are just data.

---

## 3. Architecture Overview

### 3.1 Modules
| Module | Folder | Responsibility | Runs in |
|---|---|---|---|
| **Shared contracts** | `src/shared/` | Types and pure helpers everyone agrees on: Commands, Events, Observation, MatchRules, IDs, data schemas | anywhere |
| **Game engine** | `src/engine/` | The authoritative simulation on a **square tile grid**: rules, systems, pathfinding, fog, victory | main thread / Node |
| **Machine player (AI)** | `src/ai/` | Local rule-based AI. Decides commands using **only** fog-filtered Observations | **Web Worker** / Node |
| **UI** | `src/ui/` | **3D voxel rendering (three.js)**, HTML HUD, menus, input → Commands, audio | browser main thread |
| **Host (glue)** | `src/host/` | Creates the match and wires the engine, UI controller and AI controller together. Owns the game loop and the command log | browser main thread / Node |
| **Game data** | `src/data/` | Balance data as JSON: units, buildings, techs, eras, pace presets, palette | loaded by all |
| **Maps** | `maps/` (top level) | Map files as pure data, plus an index | loaded at runtime |
| **Assets** | `assets/` (top level) | SFX presets and music note data (models and textures are generated in code, §7.8) | loaded by the UI |

### 3.2 Data flow
```
            maps/*.json      src/data/*.json + MatchRules (pace)
                 │                    │
                 ▼                    ▼
         ┌──────────────────────────────────────┐
         │                HOST                  │  creates match, applies rules,
         │   (GameHost, command log, clock)     │  fixed-step loop, routes commands
         └──┬───────────────┬────────────────┬──┘
            │ step()        │ Observation    │ PlayerView (read-only, fog-filtered,
            ▼               ▼ (postMessage)  ▼  grid coordinates)
     ┌────────────┐  ┌─────────────────┐  ┌───────────────────────────────┐
     │  ENGINE    │  │  AI (Worker)    │  │              UI               │
     │ square-grid│  │ local, rule-    │  │ three.js voxel world, HTML    │
     │ simulation │  │ based, offline  │  │ HUD, input → Commands         │
     │  no DOM    │  │ no engine import│  │ (ray picking ↔ grid coords)   │
     └────────────┘  └───────┬─────────┘  └──────────────┬────────────────┘
            ▲                │ Command[]                 │ Command[]
            └────────────────┴────────── HOST ───────────┘
```
**3D lives only in the UI.** The engine, the AI and the maps all use plain grid coordinates (x to the right, y downward). This paid off already: switching from 2D iso to 3D voxel graphics in v4 changed no engine, AI or map code.

### 3.3 Dependency rules (enforced by lint)
| Module | May import | Must NOT import / use |
|---|---|---|
| `shared` | nothing (pure TS) | everything else |
| `engine` | `shared` | `ui`, `ai`, `host`, DOM/Window, **network APIs** |
| `ai` | `shared` | **`engine`**, `ui`, `host`, DOM, **any network API** (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `importScripts` with external URLs, `navigator.sendBeacon`), any npm package |
| `ui` | `shared` | `engine` internals, `ai` |
| `host` | `shared`, `engine` (public API), `ai` (`ai/index.ts` + worker entry), `ui` (public API) | — |

These rules are enforced with **`eslint-plugin-boundaries`** plus `no-restricted-globals` and `no-restricted-imports`, and with separate `tsconfig` project references. A violation fails `npm run lint` and the build.

**Why the AI is a separate module:**
- **It is fair by construction.** It only ever receives Observations.
- **It can be swapped.** Several implementations can sit behind the same `AIPlayer` interface.
- **It performs well.** In a Worker, AI thinking never stalls rendering.
- **It can be tested on its own** with fake Observations, with no engine at all.

### 3.4 Folder structure
```
webgame/
├── PLAN.md
├── .nvmrc                              # "24"  (Node 24 LTS)
├── index.html                          # includes CSP meta (connect-src 'self')
├── package.json  tsconfig.base.json  vite.config.ts  eslint.config.js  .prettierrc
│
├── src/
│   ├── main.ts                         # browser entry: boot UI → App
│   │
│   ├── shared/                         # ★ CONTRACTS
│   │   ├── ids.ts  geometry.ts  rng.ts
│   │   ├── commands.ts                 # Command union + shape validators
│   │   ├── events.ts                   # GameEvent union
│   │   ├── observation.ts              # Observation, ObservedEntity, StaticMapInfo
│   │   ├── controller.ts               # PlayerController interface
│   │   ├── rules.ts                    # MatchRules, PacePreset types
│   │   ├── dataSchema.ts  mapSchema.ts # zod schemas + inferred types
│   │
│   ├── engine/                         # ★ GAME ENGINE (no DOM, no network, grid space)
│   │   ├── index.ts                    # public API: createGame(), Game, PlayerView
│   │   ├── Game.ts  World.ts  PlayerState.ts
│   │   ├── rules/
│   │   │   ├── applyRules.ts           # base data × MatchRules → derived data bundle
│   │   │   └── damage.ts               # damage formula, bonus table
│   │   ├── entities/  Entity.ts  components.ts  factory.ts
│   │   ├── commands/  validate.ts  apply.ts
│   │   ├── orders/    MoveOrder.ts AttackOrder.ts GatherOrder.ts BuildOrder.ts
│   │   │              RepairOrder.ts AttackMoveOrder.ts
│   │   ├── systems/   ProductionSystem.ts ConstructionSystem.ts OrderSystem.ts
│   │   │              PathfindingSystem.ts MovementSystem.ts SeparationSystem.ts
│   │   │              GatherSystem.ts TargetingSystem.ts CombatSystem.ts
│   │   │              ProjectileSystem.ts DeathSystem.ts VisionSystem.ts VictorySystem.ts
│   │   ├── map/       Grid.ts  loadMap.ts  validateMap.ts
│   │   ├── path/      astar.ts  smoothing.ts  groupMove.ts
│   │   ├── spatial/   SpatialHash.ts
│   │   ├── fog/       Visibility.ts
│   │   └── stats/     MatchStats.ts
│   │
│   ├── ai/                             # ★ MACHINE PLAYER (local, rule-based, see §6)
│   │   ├── index.ts                    # createAIPlayer(): AIPlayer
│   │   ├── worker.ts                   # Web Worker entry (postMessage bridge)
│   │   ├── AIPlayer.ts                 # think-loop orchestrator
│   │   ├── model/     WorldModel.ts EnemyMemory.ts ThreatMap.ts
│   │   │              ResourceClusters.ts Blackboard.ts
│   │   ├── strategy/  StrategySelector.ts  Posture.ts  strategies/*.json
│   │   ├── managers/  BudgetManager.ts EconomyManager.ts BuildManager.ts
│   │   │              ProductionManager.ts ResearchManager.ts ScoutManager.ts
│   │   │              MilitaryManager.ts TacticsManager.ts
│   │   ├── planning/  BuildOrderRunner.ts  buildorders/*.json  CounterTable.ts
│   │   │              Composition.ts  Placement.ts
│   │   ├── profiles/  easy.json  normal.json  hard.json
│   │   ├── util/      squad.ts  apm.ts  paceScale.ts
│   │   └── debug/     AIDebugInfo.ts
│   │
│   ├── host/                           # ★ GLUE
│   │   ├── GameHost.ts  HumanController.ts  AIWorkerController.ts
│   │   ├── AIInlineController.ts  CommandLog.ts  loaders.ts
│   │
│   ├── data/                           # ★ GAME DATA (balance)
│   │   ├── units.json  buildings.json  techs.json  eras.json  bonuses.json
│   │   ├── pace.json                   # pace presets + starting resource levels
│   │   └── palette.json
│   │
│   └── ui/                             # ★ UI (browser only)
│       ├── index.ts  style.css  settings.ts  strings.ts (English text table)
│       ├── three/
│       │   ├── World3D.ts              # renderer, scene, sun + shadows, fog, resize
│       │   ├── CameraRig.ts            # fixed 45° RTS camera, pan/zoom, ground picking
│       │   ├── Picker.ts               # unit/building picking by screen projection
│       │   ├── FogOfWar.ts             # visibility texture + shared shader chunk
│       │   └── Silhouettes.ts          # x-ray pass for hidden units
│       ├── art/
│       │   ├── VoxelBuilder.ts         # boxes + roofs → merged geometry (groups per texture)
│       │   ├── textures.ts             # procedural 16×16 pixel textures
│       │   ├── materials.ts            # shared materials (one per texture)
│       │   ├── palette.ts              # palette.json access + team colors
│       │   ├── models.ts               # every building / unit / tree / resource model
│       │   └── terrain.ts              # ground texture, water, banks, map-edge sides
│       ├── render/
│       │   ├── EntityRenderer.ts       # instanced units/buildings from the PlayerView
│       │   ├── Animator.ts             # procedural walk / attack / work / death
│       │   ├── EffectsRenderer.ts      # projectiles, markers, sparks, dust, fire
│       │   └── OverlayRenderer.ts      # selection rings, HP bars, rally flags, ghosts
│       ├── hud/        HUD.ts hud.css pixelIcons.ts TopBar.ts Minimap.ts SelectionPanel.ts
│       │               CommandGrid.ts MessageLog.ts Alerts.ts Tooltip.ts
│       ├── input/      InputManager.ts SelectionController.ts CommandController.ts
│       │               PlacementController.ts hotkeys.ts
│       ├── screens/    MainMenu.ts MatchSetup.ts LoadingScreen.ts GameScreen.ts PauseMenu.ts
│       │               SettingsScreen.ts HowToPlay.ts ResultScreen.ts CreditsScreen.ts
│       ├── preview/    StylePreview.ts (the current style preview diorama)
│       ├── audio/      Sound.ts  sfxSynth.ts  MusicPlayer.ts
│       └── debug/      DebugOverlay.ts
│
├── maps/                               # ★ MAPS (pure data, grid space)
│   ├── index.json  green_valley.json  twin_rivers.json  forest_pass.json
│
├── assets/                             # sfx presets + music note data
│   ├── sfx/presets.json  music/*.json
│
├── docs/preview/                       # style preview screenshots
│
├── tools/
│   ├── art-viewer/                     # model viewer page (orbit, animations) – M10
│   ├── sim.ts                          # headless AI-vs-AI simulator
│   ├── validate-maps.ts
│   └── map-editor/ (later)
│
└── tests/  engine/  ai/  shared/  ui/  host/  lint/  integration/
```

---

## 4. Shared Contracts (protocol)

These types are the **only** language the engine, AI, UI and host share. All positions are in **grid space**.

### 4.1 Commands (`src/shared/commands.ts`)
```ts
export type Command =
  | { type: 'move';       units: EntityId[]; to: WorldPos; queue?: boolean }
  | { type: 'attackMove'; units: EntityId[]; to: WorldPos; queue?: boolean }
  | { type: 'attack';     units: EntityId[]; target: EntityId; queue?: boolean }
  | { type: 'gather';     units: EntityId[]; target: EntityId; queue?: boolean }
  | { type: 'build';      units: EntityId[]; building: BuildingTypeId; at: TilePos; rotated?: boolean; queue?: boolean }
  | { type: 'buildWall';  units: EntityId[]; from: TilePos; to: TilePos }
  | { type: 'assist';     units: EntityId[]; target: EntityId }       // help construct / repair
  | { type: 'stop';       units: EntityId[] }
  | { type: 'setStance';  units: EntityId[]; stance: 'aggressive' | 'hold' }
  | { type: 'train';      building: EntityId; unit: UnitTypeId; count: number }
  | { type: 'research';   building: EntityId; tech: TechId }        // includes era advance
  | { type: 'cancelQueue';building: EntityId; index: number }
  | { type: 'setRally';   building: EntityId; to: WorldPos | EntityId }
  | { type: 'delete';     target: EntityId }
  | { type: 'surrender' };

export interface CommandEnvelope { player: PlayerId; tick: number; cmd: Command }
```
- Every command is **validated by the engine**. If it is invalid, the engine emits `commandRejected { reason }` (for example `NOT_ENOUGH_WOOD`, `INVALID_PLACEMENT`, `POP_CAPPED`, `NOT_OWNER`, `LOCKED_BY_ERA`), which the UI shows as a message.
- A command for a group of units counts as **one action** toward the AI's APM limit.

### 4.2 Events (`src/shared/events.ts`)
`unitTrained`, `unitDied`, `buildingPlaced`, `buildingCompleted`, `buildingDestroyed`, `researchCompleted`, `eraAdvanced`, `underAttack {player, pos}` (throttled to once per 10 s per area), `resourceDepleted`, `popCapped`, `idleProduction`, `commandRejected`, `gameOver {winner, reason}`.

Each event carries **audience** information, so players only receive events they are allowed to know about.

### 4.3 Observation (`src/shared/observation.ts`), the AI's view of the world
```ts
export interface StaticMapInfo {          // sent once at init
  width: number; height: number;
  terrain: Uint8Array; passable: Uint8Array; buildable: Uint8Array;
  spawnCandidates: TilePos[];              // both spawns (enemy is "the other one")
  rules: MatchRules;                       // pace settings for this match
  data: GameDataBundle;                    // DERIVED data (already scaled by rules)
}

export interface Observation {             // sent every think interval
  tick: number;
  self: { resources: { food: number; wood: number; gold: number };
          pop: number; popCap: number; era: 1 | 2 | 3; techs: TechId[] };
  own: OwnEntity[];                        // full detail: orders, carry, queues, progress
  visibleEnemies: ObservedEntity[];        // only those inside own vision right now
  enemyBuildingGhosts: ObservedEntity[];   // last-seen state of enemy buildings
  visibleResources: ObservedResource[];
  exploredDelta: number[];                 // newly explored tile indices
  events: GameEvent[];                     // since last observation (audience-filtered)
}
```

### 4.4 PlayerController (`src/shared/controller.ts`)
```ts
export interface PlayerController {
  readonly player: PlayerId;
  readonly thinkIntervalTicks: number;
  init(info: StaticMapInfo, config: unknown): Promise<void>;
  update(obs: Observation): Promise<Command[]>;  // AI: thinks; Human: drains UI queue
  dispose(): void;
}
```

### 4.5 MatchRules (`src/shared/rules.ts`)
```ts
export interface MatchRules {
  pace: 'relaxed' | 'standard' | 'fast' | 'blitz' | 'custom';
  gatherRate: number;      // 0.5–3.0
  buildSpeed: number;      // 0.5–3.0
  trainSpeed: number;      // 0.5–3.0
  researchSpeed: number;   // 0.5–3.0 (techs and eras)
  eraCost: number;         // 0.5–1.5
  startingResources: 'low' | 'standard' | 'high' | 'veryHigh';
  popCap: number;          // 50–200
  revealMap: 'off' | 'explored' | 'all';
  seed: number;
}
```

---

## 5. Game Engine

### 5.1 Principles
- **Pure TypeScript with no DOM and no network.** It runs in the browser and in Node.
- **Grid space only.** The engine knows nothing about 3D or the camera.
- **Fixed timestep of 20 ticks per second** (50 ms). Data values are in seconds and converted to ticks after the rules are applied.
- **Deterministic:** seeded RNG only, and no `Math.random()` or `Date.now()` in the engine. The same map, rules, seed and command log always give the same result.
- **World coordinates** are floats in tile units (1.0 = 1 tile). Tile positions are integers.

### 5.2 Entity model
| Component | Key fields |
|---|---|
| `Transform` | x, y, radius, facing (8 directions in grid space; the UI maps them to sprite facings) |
| `Health` | hp, maxHp, armor |
| `Mover` | speed, path[], pathIndex, goal, stuckTicks, repathCooldown |
| `Attacker` | attack, range, minRange, cooldownTicks, cooldownLeft, targetId, projectileType?, splash? |
| `Gatherer` | rates{} (from config), targetNode, lastNodePos, work progress |
| `Builder` | buildRate, repairRate |
| `ResourceNode` | resType, amount, slots, infinite (farm) |
| `Building` | type, tileX, tileY, w, h, constructed, build progress, queue, rally, gateOwnerPassable |
| `Producer` | queue[{kind, id, progressTicks}], rally |
| `Vision` | sight |
| `Orders` | queue: Order[], stance |
| `Projectile` | sourceId, targetId or targetPos, speed, damage, splash, homing, arcHeight |

Entity storage: `Map<EntityId, Entity>` plus per-component index arrays. IDs are never reused within a match.

### 5.3 Tick pipeline (fixed order)
| # | System | What it does |
|---|---|---|
| 1 | Command apply | Validate the queued `CommandEnvelope`s for this tick and turn them into orders |
| 2 | ProductionSystem | Advance training and research. Spawn units (with a pop check). Apply techs |
| 3 | ConstructionSystem | Add builder contributions to foundations. Mark completion |
| 4 | OrderSystem | Run each unit's order state machine. Issue path requests |
| 5 | PathfindingSystem | Process path requests within a per-tick budget (20k expanded nodes) |
| 6 | MovementSystem | Follow paths. Apply terrain speed. Detect stuck units (no progress for 1 s → repath) |
| 7 | SeparationSystem | Soft push between units through the spatial hash |
| 8 | GatherSystem | Harvest straight into the stockpile. Handle depletion and auto-retarget |
| 9 | TargetingSystem | Every 4 ticks: idle or aggressive units acquire targets |
| 10 | CombatSystem | Count down cooldowns. Melee deals damage immediately; ranged spawns a projectile |
| 11 | ProjectileSystem | Arrows home in (always hit). Catapult stones land at a point (can miss) and deal splash damage |
| 12 | DeathSystem | Remove dead entities, free their tiles, emit events, record stats |
| 13 | VisionSystem | Every 4 ticks: incremental visibility update per player |
| 14 | VictorySystem | Every 20 ticks: check the win conditions |

### 5.4 Order state machines (examples)
```
GatherOrder:  ToNode → Harvesting → (full) → ToDropSite → Dropping → ToNode …
              └ node depleted → FindNearestSameType(8 tiles) → ToNode | Idle
BuildOrder:   ToSite → Constructing → (done) → [auto-gather if farm/storehouse] | Idle
AttackOrder:  Chase (repath every 1 s if target moved > 1 tile) → InRange → Attack → dead → Idle
AttackMove:   Move along path; every 4 ticks scan → engage → resume move
```

### 5.5 Map grid & pathfinding
- **Layers:** terrain type, static passability (deep water, rocks), dynamic blockers (buildings, trees, gold, berries), `buildable`, and gate masks per player.
- **Terrain speed:** shallow water costs 0.7× speed, everything else 1.0×.
- **A\*:** 8-directional with an octile heuristic and no corner-cutting. It uses a binary heap and a search cap of 6000 nodes. If no path exists, it returns a path to the closest reachable tile.
- **Smoothing:** a line-of-sight check removes unnecessary waypoints.
- **Group moves:** destination slots are assigned in a spiral around the target, closest unit to closest slot.
- **Building and resource targets:** units path to the nearest free tile next to the footprint.
- **Repathing:** when the next tile becomes blocked, or after being stuck for 1 s.
- **Future optimization, only if profiling needs it:** HPA\* over 16×16 clusters.

### 5.6 Fog of war
- Each player has a `visibleCount` grid (Uint8) and an `explored` grid (bit).
- Vision is a circle (in grid space) with no line-of-sight occlusion.
- Each tile is **unexplored**, **explored** (darkened, with ghosts of last-seen enemy buildings) or **visible**.
- Updates are incremental: only entities that changed tile, or were added or removed, update the counts.

### 5.7 Building placement rules
- Every footprint tile must be explored, buildable (grass, dirt or sand) and free of buildings and resources. Units on the footprint are pushed out when construction starts.
- Walls are placed in lines along the grid x or y axis. A drag that is not aligned is split into an L-shape.
- Gates are 3×1 or 1×3, can attach to walls, and are passable only for their owner.

### 5.8 Public engine API (`src/engine/index.ts`)
```ts
export function createGame(map: MapData, baseData: GameDataBundle, rules: MatchRules): Game;

export interface Game {
  readonly tick: number;
  readonly result: GameResult | null;
  readonly data: GameDataBundle;               // derived (rules applied)
  enqueue(env: CommandEnvelope): void;
  step(): GameEvent[];
  getView(player: PlayerId): PlayerView;       // zero-copy, read-only, fog-aware (UI)
  observe(player: PlayerId): Observation;      // serializable snapshot (AI)
  staticInfo(player: PlayerId): StaticMapInfo;
  stats(): MatchStats;
}
```

### 5.9 Performance budget
| Item | Target |
|---|---|
| Entities | 2 × 100 pop (up to 2 × 200 in Custom) + about 60 buildings + about 600 resource nodes |
| Engine tick | < 4 ms average on a mid-range laptop at 200 units |
| Path requests | Budgeted per tick; a big group move is spread over 2–3 ticks |
| AI observation | Built at 2–4 Hz; about 20–40 KB |

---

## 6. Machine Player (AI): separate module
> **2026-11-07:** this section is the original long-term design (with eras, fog and three difficulties). What is actually built (Easy only, no eras, no fog, situation-driven instead of build orders) is described in `docs/plans/m6-vs-machine.md`; how the machine plays in each mode is in `docs/ai-modes.md`. The isolation rules in §6.1–6.2 apply unchanged.

### 6.1 Isolation guarantees
- **It lives only in `src/ai/`.** Lint stops it from importing the engine, UI or host.
- **It is a black box with one interface:**
  ```ts
  // src/ai/index.ts
  export interface AIConfig { difficulty: 'easy' | 'normal' | 'hard'; strategy?: StrategyId | 'random'; seed: number; debug?: boolean }
  export interface AIPlayer {
    init(info: StaticMapInfo, config: AIConfig): void;
    think(obs: Observation): Command[];
    debugInfo(): AIDebugInfo;                 // dev builds only
  }
  export function createAIPlayer(): AIPlayer;
  ```
- **It runs in a Web Worker** (`src/ai/worker.ts`) by default:

  | Direction | Message | Payload |
  |---|---|---|
  | host → AI | `init` | `StaticMapInfo`, `AIConfig` |
  | host → AI | `observe` | `Observation` |
  | AI → host | `commands` | `{ forTick, commands: Command[] }` |
  | AI → host | `debug` (dev only) | `AIDebugInfo` |
  | host → AI | `dispose` | — |

- **Inline mode** (`AIInlineController`) runs the same `AIPlayer` synchronously for tests, the simulator and deterministic replays.
- **Reaction delay:** commands for observation tick `t` apply at `t + reactionDelayTicks`. Applied commands are written to the `CommandLog` with their tick, so replays stay exact.

### 6.2 No external AI, no network (hard rule)
The machine player is **ordinary local TypeScript**: heuristics, state machines and data-driven scripts. It never calls an LLM, an AI agent, a cloud service or any third-party API. This is guaranteed in four ways:
1. **Lint:**
   - `no-restricted-globals` bans `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `importScripts` and `navigator.sendBeacon` inside `src/ai/**` and `src/engine/**`.
   - `no-restricted-imports` bans every npm package inside `src/ai/**`, so the AI uses only `shared` and its own code.
2. **Content Security Policy:** `index.html` sets `connect-src 'self'` and `worker-src 'self'`. Even by accident, the page cannot reach any other host.
3. **Test:** a build test scans the bundled AI worker chunk for network APIs and fails if it finds any.
4. **Data in, commands out:** the worker only receives `init` and `observe` messages and only sends `commands` and `debug`.

### 6.3 Think loop (each `think(obs)` call)
```
1. WorldModel.update(obs)        – merge sightings, decay intel, update threat map,
                                   refresh resource clusters, own base area, idle lists
2. StrategySelector.tick()       – (every ~5 s × paceScale) re-evaluate posture:
                                   BOOM / BUILD_ARMY / ATTACK / DEFEND / RETREAT
3. BuildOrderRunner.tick()       – while the opening is active, emit scripted requests
4. Managers.tick() in order:     – Economy → Build → Research → Production → Scout → Military → Tactics
                                   each posts REQUESTS (with priority) to the Blackboard
5. BudgetManager.allocate()      – sort by priority, reserve resources, approve affordable,
                                   keep saving for top items
6. Emit commands                 – approved requests + unit control → Commands, trimmed to APM
7. Return Command[]
```

### 6.4 World model (the AI's beliefs)
| Part | Content |
|---|---|
| `EnemyMemory` | Every enemy unit ever seen: type, last position, last-seen tick. A unit counts as "probably alive" for 90 s. Enemy buildings come from the ghost list |
| `Enemy base estimate` | The other spawn candidate, confirmed by scouting |
| `ThreatMap` | Grid at 4×4-tile resolution. Each cell stores estimated enemy strength, decaying over time |
| `ResourceClusters` | Wood lines, gold mines and berry clusters, each with distance to the own base |
| `Own base` | Bounding region of own buildings plus 6 tiles, with "front" (toward the enemy) and "back" directions |
| `Army strength` | `Σ (hp × dps × counterFactor)` for own units and estimated enemy units |

### 6.5 Managers
| Manager | Responsibility | Key rules |
|---|---|---|
| **BudgetManager** | Share resources among competing requests | Priorities: emergency defense 100, house when ≤ 3 free pop 90, workers up to target 80, era advance 70, military 60, new buildings 50, techs 40. Reserved resources are not spent on lower priorities |
| **EconomyManager** | Workers and gathering | Worker target per era from the strategy (e.g. 16 / 26 / 32, capped at 40% of pop cap). Keep the Town Hall producing workers. Assign idle workers to the resource furthest below its target ratio. Request Farms as berries run low |
| **BuildManager** | Building requests → `build` commands | Spot from `Placement`. Nearest non-critical worker as builder (prefer wood). Helpers for important buildings. Retry if rejected |
| **Placement** | Where to build | Houses in the back ring 4–8 tiles from the Town Hall.  Military buildings toward the front, 6–10 tiles out. Towers at chokepoints and resource lines. Always leave a **1-tile gap** and run a **flood-fill check** so the AI never walls itself in |
| **ResearchManager** | Eras and techs | Advance an era when worker target ≥ 80%, requirements are met and posture ≠ DEFEND. Research the strategy's tech list in priority order |
| **ProductionManager** | Fill production queues | Keep ≤ 2 items queued per building. Follow the target mix. Request extra production buildings when the bank is over 600 |
| **ScoutManager** | Information | Use the starting Scout Rider to circle the enemy base early. Re-scout every 3 min × paceScale |
| **MilitaryManager** | Strategy for the army | Composition from `CounterTable` against observed enemies. ATTACK when own strength > enemy × `attackRatio` and time > `earliestAttack × paceScale`. DEFEND when the threat map shows enemies in the base. RETREAT when the ratio drops below `retreatRatio`. Manages squads (defense, main army, harass) |
| **TacticsManager** | Squad micro | Stage before attacking (80% arrived or 20 s). Attack-move toward a target (military buildings, then Town Hall). Focus fire on low-HP targets. Pull back units under 25% HP (Hard). Escort catapults. Militia intercept cavalry hitting archers |

### 6.6 Strategies (data in `src/ai/strategy/strategies/*.json`)
| Strategy | Plan | First attack (Standard pace) | Army focus | Available on |
|---|---|---|---|---|
| **Militia Rush** | 2 Barracks early, attack with 6–8 Militia, then go to Era II | ~5:00 | Militia → Archers | Normal, Hard |
| **Balanced** | Standard economy, Era II at ~8:00, mixed army | ~10:00 | Militia + Archers → Knights | Easy, Normal, Hard |
| **Boom** | 2nd Town Hall, towers for defense, fast Era III | ~14:00 | Knights + Catapults | Normal, Hard |
| **Raider** | Fast Era II, Scout Riders raid workers, Archers hold the front | ~8:00 harass | Scouts, Archers | Hard |

The strategy is chosen at random (seeded) from those available, unless one is set in Match Setup. Attack times scale with the pace.

### 6.7 Build order format (example: `planning/buildorders/balanced.json`)
```jsonc
{
  "id": "balanced",
  "workerTarget": [16, 26, 32],
  "gatherRatio": {
    "1": { "food": 0.55, "wood": 0.45, "gold": 0.00 },
    "2": { "food": 0.45, "wood": 0.35, "gold": 0.20 },
    "3": { "food": 0.40, "wood": 0.30, "gold": 0.30 }
  },
  "steps": [
    { "when": { "workers": 4 },               "do": { "build": "house" } },
    { "when": { "workers": 6 },               "do": { "build": "storehouse", "near": "wood" } },
    { "when": { "workers": 8 },               "do": { "build": "house" } },
    { "when": { "workers": 10 },              "do": { "build": "barracks", "at": "front" } },
    { "when": { "workers": 11 },              "do": { "research": "sharp_axes" } },
    { "when": { "built": "barracks" },        "do": { "train": "militia", "count": 3 } },
    { "when": { "workers": 13 },              "do": { "build": "farm", "count": 2 } },
    { "when": { "workers": 14 },              "do": { "research": "era_2" } },
    { "when": { "era": 2 },                   "do": { "build": "archery_range", "at": "front" } },
    { "when": { "era": 2, "workers": 18 },    "do": { "build": "blacksmith" } },
    { "when": { "era": 2 },                   "do": "handoff" }
  ]
}
```
- Steps are triggered by game state (worker count, era, buildings), not by clock time, so they work the same at any pace.
- If the AI is attacked during the opening, it switches to DEFEND posture and the build order pauses.
- Starting resources above Standard let the runner fast-forward steps it can afford straight away.

### 6.8 Difficulty profiles (data in `src/ai/profiles/*.json`)
| Parameter | Easy | Normal | Hard |
|---|---|---|---|
| Think interval | 1.0 s | 0.5 s | 0.25 s |
| Reaction delay | 2.0 s | 0.8 s | 0.3 s |
| APM cap | 30 | 80 | 160 |
| Worker target multiplier | 0.6 | 0.9 | 1.0 |
| Strategies | Balanced | Balanced, Rush, Boom | all |
| Earliest attack (× paceScale) | 10:00 | 5:00 | none |
| Attack ratio (own / enemy) | 2.0 | 1.3 | 1.1 |
| Retreat ratio | never | 0.5 | 0.6 |
| Uses counters | partly (50%) | yes | yes |
| Micro | none | focus fire | focus fire, retreat hurt units, peel, siege escort |
| Builds towers and walls | no | towers | towers + walls |
| Re-scouting | no | yes | yes |
| Vision and bonuses | fog, none | fog, none | fog, none |
| Resigns when hopeless | yes | yes | yes |

### 6.9 AI quality targets (headless simulator, run at Standard and Fast pace)
- Normal beats Easy in **≥ 80%** of games, and Hard beats Normal in **≥ 75%**, across all 3 maps and 50 games each.
- **No stalls:** never 60 s without a command while holding more than 200 of any resource and having idle workers or production.
- Hard AI keeps worker idle time **under 5%**.
- AI-vs-AI games finish within the target length for their pace preset (±30%).
- The AI thinks in under **2 ms per call** on average, and never over 10 ms.

### 6.10 AI debug tools (dev builds)
- In the F3 overlay: posture, build-order step, budget reservations, squads, threat-map heatmap (tinted ground tiles), planned building spots.
- **AI-vs-AI spectator mode** (dev flag in Match Setup).

---

## 7. UI & Rendering (3D voxel style with pixel textures)

> Style reference: the screenshots in [docs/preview/](docs/preview/) from the style preview (`npm run dev`, keys `1` `2` `3`).

### 7.1 Visual direction
- **3D low-poly "voxel" models.** Everything is built from boxes and simple roofs, with chunky, toy-like proportions, a warm saturated palette, soft sunlight and real shadows.
- **Pixel textures on every surface.**
  - Planks, bricks, shingles, thatch, leaves, rock, soil and cloth are 16×16 grayscale patterns, tinted by the model's colors.
  - They are sampled with nearest filtering up close, so you can see the pixels. Mipmaps keep them from shimmering far away.
  - The ground is painted at 8 texels per tile with **ragged, blocky borders** between grass, sand, dirt and water.
- **Diorama feel:** a fixed 45° camera, water sunk below the land, and earthy cut-away sides at the map edge.
- **All designs are original:** our own buildings, units, palette and UI. The look is in the general voxel / low-poly genre and does not copy any specific game.

### 7.2 Renderer (three.js)
| Item | Choice |
|---|---|
| Library | **three.js** (WebGL 2), bundled locally. No CDN, which fits the CSP |
| Lighting | Hemisphere sky light plus a warm directional sun. The sun's **shadow map (2048²)** follows the camera target, so shadows stay sharp at any zoom |
| Color | sRGB output and Neutral tone mapping. Distance fog in the sky color gives depth |
| Anti-aliasing | MSAA (`antialias: true`). Pixel ratio is capped at 2 |
| Materials | One shared Lambert material per pixel texture, with vertex colors. That means a handful of shader programs for the whole world |
| Graphics settings | Shadows High / Low / Off; Render scale 100% / 75% / 50%; optional **"Pixel filter"** (renders at low resolution and upscales with nearest filtering, for a retro look) |

### 7.3 Camera
- Perspective camera with a **30° field of view**, a **fixed yaw of 45°** and a **pitch of 52°**. This reads like isometric but is truly 3D.
- **Zoom:** mouse wheel, distance 10–64 tiles. **Pan:** arrow keys, screen edge, or middle-drag. The camera is clamped to the map.
- **Mapping:** grid x → world x, grid y → world z, 1 tile = 1 world unit. The engine and AI never see 3D coordinates.
- **Backlog:** camera rotation in 90° steps, and zooming to the cursor.

### 7.4 World rendering & performance
| Thing | How it is drawn |
|---|---|
| Terrain | One mesh of tile quads plus the painted ground texture. Water tiles sit lower, under a translucent animated surface. Bank sides and map-edge sides. Built once when the map loads |
| Trees, rocks, wall segments, resources | **InstancedMesh per model type**, so a few draw calls for hundreds of objects. A felled tree becomes a stump instance |
| Buildings | One merged mesh per type, team and construction stage (foundation, scaffold, done), instanced. Damaged buildings get fire and smoke particles below 50% HP |
| Units | Rigid parts: a body plus 2 legs (people) or 4 legs (horses), each **instanced per unit type and team**. Each frame, instance matrices are updated from engine positions interpolated between ticks |
| Unit animation (procedural) | Walk: leg swing and bob. Attack: lunge or weapon swing. Work: chop, mine or farm bob. Death: tip over, then sink into the ground |
| Projectiles | Instanced arrows and stones on parabolic arcs |
| Overlays | Selection rings (instanced ground decals), building footprint outline, HP bars (instanced camera-facing quads), rally flag model plus a dashed line, move and attack markers |
| Hidden units | Units behind buildings or trees get a team-colored **x-ray silhouette** (a second pass drawn where the depth test fails) |
| Fog of war | A per-tile visibility texture is sampled by a **shared shader chunk** (`onBeforeCompile`) in every material. Unexplored tiles are black; explored but unseen tiles are darkened and desaturated. Enemy units outside vision are hidden. Enemy buildings show as last-seen ghosts |
| Placement ghost | A translucent building mesh plus green or red tile quads under its footprint |

**Budget:** under 150 draw calls and under 300k triangles, at 60 fps with 200 units, on an integrated GPU at 1080p.

### 7.5 Picking & selection
- **Ground:** a camera ray against the plane y = 0 gives an exact grid point. It is used for move, attack-move, rally and placement.
- **Units and buildings:** each candidate's bounding sphere is projected to the screen, and the one nearest the cursor within its screen radius wins. Units are preferred over buildings when they overlap. A raycast against the building's box breaks ties.
- **Box select:** project each unit's foot position to the screen and test it against the dragged rectangle.
- **Double-click / Ctrl + click:** selects all units of that type that are visible on screen.

### 7.6 HUD (DOM overlay, pixel-styled)
- The HUD is **HTML/CSS layered over the 3D canvas**. It stays crisp at any resolution and is easy to lay out.
- **Font:** **Pixelify Sans** (open licence, bundled locally with the game).
- **Icons:** pixel art authored as character grids and scaled up with `image-rendering: pixelated`.
- **Theme:** slate panels with brass trim, and square brass buttons with a pixel bevel.
- **Layout** (as in the preview):

```
+--------------------------------------------------------------------------------------+
| [minimap   ]          [food 200][wood 150][gold 100][pop 14/20][Era I]          [≡]  |
| [ diamond  ]                                                                          |
| message log                                                                           |
|                                 3D WORLD                                              |
|                                                                       [idle: 2]      |
+---------+------------------------------------------------------+---------------------+
| portrait| name · HP bar · stats · current task                 |  Q   W   E   R      |
|         | production queue [x][x][ ][ ][ ]                     |  A   S   D   F      |
|         | (multi-select: unit icon grid with mini HP)          |  Z   X   C   V      |
+---------+------------------------------------------------------+---------------------+
```
- **Tooltips** (300 ms hover) show the name, cost icons with numbers (red if unaffordable), hotkey, a description and the requirement. Values come from the **pace-adjusted derived data**.
- **HUD scale** setting: 80–150%.

### 7.7 Command grid contents
| Selection | Grid (positional hotkeys) |
|---|---|
| **Build menu** (Build button / B, any time) | One button per entry of `game.json → buildMenu`, at the slot of its hotkey (Q House, W Barracks, E Town Hall, …). Esc or the Back button closes it |
| Worker | W Stop (gathering is right-click) |
| Military units | Q Attack-move, W Stop, E Hold, R Aggressive (from each unit's `actions`) · V Delete (later) |
| Mixed selection | Every action any selected type has; each button acts only on the units whose config has it |
| Town Hall | Q Worker, W Advance Era · Z Set rally |
| Barracks / Range / Stable / Workshop | Q, W units · Z Set rally |
| Storehouse / Blacksmith | Q W E R techs |
| Gate (selected while placing) | R Rotate |
| Enemy or resource | Information only |

Locked buttons are greyed out with a lock icon. Unaffordable buttons are drawn with a red tint.

### 7.8 Art pipeline (all made in code)
| Piece | File | What it does |
|---|---|---|
| Geometry builder | `src/ui/art/VoxelBuilder.ts` | `box`, `gableRoof`, `pyramidRoof`, `quad`: merged into one geometry with one group per pixel texture, vertex-color tints and world-scaled UVs (16 texels per tile). Unit-tested |
| Pixel textures | `src/ui/art/textures.ts` | Procedural 16×16 grayscale patterns (planks, bricks, shingles, thatch, leaves, bark, rock, soil, cloth, water) |
| Models | `src/ui/art/models.ts` | One function per building, unit, tree and resource. Team parts use the palette slots `team`, `team-light` and `team-dark` |
| Terrain | `src/ui/art/terrain.ts` | Ground texture painter (ragged borders), water, banks, map-edge sides |
| Palette | `src/data/palette.json` | Every color in the game, plus the team color sets |
| HUD icons | `src/ui/hud/pixelIcons.ts` | Pixel icons as character grids |
| Model viewer (M10) | `tools/art-viewer/` | A page with an orbit view of every model and animation, for review |

- There are **no binary art files**. Everything is generated at load time, in under 100 ms.
- **Model list for v1:**
  - Units: worker, militia, archer, scout rider, knight, catapult.
  - Buildings: all 13, each with construction stages.
  - Resources: 4 tree variants plus a stump, berry bush, gold mine (full, half, depleted).
  - Decor: rocks, flowers, fences, crates.
  - Effects: dust puff, hit sparks, fire and smoke, rubble.

### 7.9 Visual feedback
- **Right-click marker** on the ground (green move, red attack, yellow gather), plus an acknowledgement sound.
- **Selection rings** under units: green for own, red for enemy, white for neutral. A footprint outline marks a selected building.
- **Hits:** a white flash on the model, sparks, and dust when a unit dies. Buildings below 50% HP burn.
- **Hover:** the object under the cursor gets an outline highlight.
- **Under attack:** a horn, a red minimap ping and a clickable message. **Space** jumps the camera there.

### 7.10 Minimap
- A 2D canvas of the grid, **rotated 45° and flattened** to match the camera.
- It shows terrain, resources, buildings, unit dots in team colors, fog, and the **camera view** (the screen corners projected onto the ground, so it is a trapezoid).
- Left click or drag moves the camera. Right click sends a command for the selection.
- It is redrawn at 4 Hz.

### 7.11 Controls
| Input | Action |
|---|---|
| Left click / drag | Select / box select (own units first; buildings only if no units in the box) |
| Shift + left click | Add to or remove from the selection |
| Double-click / Ctrl + click | Select all units of the same type on screen |
| Right click | Context command: move, attack, gather, assist or repair, set rally |
| Shift + right click | Queue the command |
| Q W E R / A S D F / Z X C V | Command grid positions |
| B | Open/close the build menu (no worker needed); then a menu hotkey starts placement |
| Ctrl + 1..9 / 1..9 / double-tap | Assign / select / center a control group |
| `.` / `,` | Cycle idle workers / idle production buildings |
| H | Select the Town Hall and center on it |
| Space | Jump to the last alert |
| Arrow keys / screen edge / middle-drag | Pan the camera |
| Mouse wheel | Zoom |
| Esc | Cancel placement, targeting or the build menu; otherwise open the pause menu (M7a) |
| F1 / F3 | How to play / debug overlay (dev) |
| + / − | Game speed (0.5×, 1×, 1.5×, 2×) (M7a) |
| P / Pause | Pause (M7a) |

### 7.12 Screens & flow
> **Built in M7a (2026-11-08):** Main Menu (Play, Quick start, Settings, How to Play), Match Setup (map with preview, opponent, start, pace, game speed), Loading, pause menu (Resume, speed, Settings, How to Play, Restart, Surrender, Quit), Settings (edge scroll, scroll speed, shadows, render quality, FPS line, machine's plan line), Result (Play again, Main menu), How to Play as text. Not yet: the orbiting 3D menu background, illustrated How to Play, Credits, custom pace sliders, reveal map, player color, AI-vs-AI spectator, volumes and HUD scale. Details: `docs/plans/m7-menus-art-maps.md` §2 and §4.

```
Boot (build models/textures) → Main Menu ─┬─ Play → Match Setup → Loading → Game ⇄ Pause → Result → Main Menu
                                          ├─ How to Play (6 illustrated pages)
                                          ├─ Settings
                                          └─ Credits
```
- Menus are DOM screens in the same pixel style. The 3D world slowly orbits in the background of the Main Menu.

**Match Setup screen:**
| Option | Values |
|---|---|
| Map | List with a minimap preview and description |
| AI difficulty | Easy / Normal / Hard |
| AI strategy | Random (default) / Rush / Balanced / Boom / Raider (if available at that difficulty) |
| **Pace** | Relaxed / **Standard** / Fast / Blitz / Custom. The target match length is shown next to each preset |
| Custom pace (shown when Custom is selected) | Sliders: gather rate, build speed, train speed, research speed, era cost; starting resources; pop cap |
| Reveal map | Off / Explored / All |
| Player color | Blue (default) / other team colors |
| Dev only | AI vs AI spectator |

- **Pause menu:** Resume, Settings, How to Play, Surrender, Quit.
- **Settings:** volumes, scroll speed, edge scroll, HUD scale, graphics (shadows, render scale, pixel filter), HP bar mode, colorblind team colors. Stored in `localStorage` with try/catch and defaults.

### 7.13 Audio (all made in code)
- **SFX:** a tiny sfxr-style synthesizer (`sfxSynth.ts`) plays presets from `assets/sfx/presets.json`. Sounds: select, acknowledgement, sword hit, arrow, stone impact, chop, mine, building complete, unit trained, era fanfare, under-attack horn, victory and defeat jingles, UI click.
- **Music:** a small WebAudio chiptune sequencer (`MusicPlayer.ts`) plays tracks stored as note data in `assets/music/*.json`: a menu theme, 2 in-game loops (calm, and battle intensity based on recent combat), and the victory and defeat stingers.
- No external audio files or services.

### 7.14 Text
English only. All UI strings sit in one table (`ui/strings.ts`).

---

## 8. Maps

### 8.1 Map file format (`maps/<id>.json`)
Maps are stored in **grid space** as character grids (grid x → world x, grid y → world z). The camera looks from the +x/+z corner, so the grid's (0,0) corner is at the top of the screen.
```jsonc
{
  "id": "green_valley",
  "name": "Green Valley",
  "description": "Open grassland. Good first map.",
  "version": 1,
  "size": { "w": 80, "h": 80 },
  "players": 2,
  "symmetry": "rotate180",
  "legend": {
    "terrain": { ".": "grass", ",": "dirt", ":": "sand", "~": "shallow", "W": "water", "#": "rock" },
    "objects": { "T": "tree", "P": "pine", "G": "gold_mine", "B": "berry_bush", "r": "stone", "1": "spawn_p1", "2": "spawn_p2" }
  },
  "terrain": [ "................................................................................", "..." ],
  "objects": [ "TTTTTTTTT.......................................................................", "..." ],
  "overrides": [ { "at": [18, 70], "amount": 1000 } ],
  "start": { "units": [["worker", 3], ["scout_rider", 1]] }
}
```
- Starting resources come from `MatchRules` (pace), not from the map.
- A spawn marker is the top-left (grid) tile of that player's 3×3 Town Hall. A `G` marker is the top-left tile of a 2×2 gold mine.
- `maps/index.json` lists the maps in menu order.
- **Rotate-180 symmetry** means the two bases mirror each other. The player always starts at the spawn nearer the camera (bottom of the screen), and the camera centers on it.
- **`scenario`** (optional, added 2026-11-07): a ready-made start so testing does not begin from an empty base. **It is the default start in the browser**; `/?setup=standard` gives the plain start (Town Hall + `start.units`). In the engine it is opt-in (`GameOptions.scenario`), so tests get the standard start unless they ask. When used, it replaces `start.units` (the Town Halls at the spawns always stay). Per player:
  ```jsonc
  "scenario": {
    "name": "Skirmish test",
    "players": [{
      "player": 1,                                   // 1 = spawn_p1 (human), 2 = spawn_p2 (machine)
      "resources": { "food": 600, "wood": 600, "gold": 400 },   // replaces startingResources
      "buildings": [{ "type": "house", "at": [64, 57] }, { "type": "barracks", "at": [55, 53], "constructed": true }],
      "units": [
        { "type": "worker", "at": [65, 61], "count": 4, "gather": "wood" },  // starts gathering at once
        { "type": "militia", "at": [49, 54], "count": 6, "stance": "aggressive" }
      ]
    }]
  }
  ```
  `at` is a tile: the top-left of a building footprint, or the center of a unit group's formation. Gatherers get a normal `interact` command on tick 0, spread over the nearest nodes of that resource. Green Valley's scenario is written by `tools/maps/generate-green-valley.ts` (edit it there, then `npm run maps:generate`): both bases have 4–5 Houses, a Barracks and a Watch Tower, 10 workers gathering food/wood/gold, and an army (6 Militia, 4 Archers, 2 Knights, 1–2 Scout Riders). The enemy army waits in the middle of the map (around 39,35), about 20 tiles from its Town Hall and well outside its Town Hall and tower range, so it can be fought without base fire.

### 8.2 Map validator (`engine/map/validateMap.ts`, run by `tools/validate-maps.ts`)
1. The grid sizes match `size`, and every character is in the legend.
2. There are exactly 2 spawns, and each Town Hall footprint is buildable.
3. The spawns can reach each other by land, and each spawn can reach its own resources.
4. **Fair resources** for each spawn:
   - within 8 tiles: ≥ 1 gold mine and ≥ 6 berry bushes
   - within 12 tiles: ≥ 40 trees
   - within 20 tiles: a 2nd gold mine
   - totals for both sides within 5% of each other
5. The symmetry claim holds (decor may differ).
6. Unreachable resources are reported as warnings.
7. The spawn distance is ≥ 40 tiles.
8. `scenario` (if present): unit, building and resource names exist; every footprint is inside the map, buildable and free (also of earlier scenario buildings); unit groups are inside the map; `gather` names a resource the unit can gather on this map; a stance needs an attack; population above the room the scenario gives is a warning.

### 8.3 Starter maps
| Map | Size | Layout | Feel |
|---|---|---|---|
| **Green Valley** | 80×80 | Open grassland. Forests on the edges, 2 gold mines per side, 1 rich center gold mine (1500) | Beginner, open fights |
| **Twin Rivers** ✅ M7a | 96×96 | A river runs across the diagonal, with 3 shallow fords (wide middle about 9 tiles, narrow ones of about 3 near each end). Rock outcrops flank the way to the middle ford. 2 gold mines per base plus an extra one near each outer ford on each side | Chokepoints, towers at fords |
| **Forest Pass** ✅ M7a | 96×96 | A dense forest belt (about 14 tiles thick) on the diagonal, with 2 passes (about 5 wide, each 14 tiles off the center) framed by rock outcrops, and a long open road around each end of the belt. A rich gold mine (1200) at one pass mouth per side | Defending passes, cutting through wood (walls and gates come later) |

All three are made by scripts in `tools/maps/` (`npm run maps:generate`; shared helpers in `mapgen.ts`) and each has a ready-made `scenario`. On every map a novice beats Easy and Normal beats Easy in the headless tests (`tests/ai/maps.test.ts`, `novice.test.ts`).

### 8.4 Loading pipeline
`host/loaders.ts` fetches `maps/index.json`, then the map file. The engine's `validateMap` checks it and `loadMap` builds the Grid and the entities. The UI builds the terrain mesh, instanced trees and resources, and the minimap.

### 8.5 Later: map tools
A map editor page (3D view, tile painting, symmetry mirroring, live validation, JSON export); and a random map generator that uses the same format.

---

## 9. Game Data Files (config first, no hard-coding)

> **Principle (user requirement, 2026-11-06):** behavior is described in config, not in code. Every entity type (unit, building, resource node) has a config entry that says what it can interact with, what its info panel shows, which buttons it has, what it can train or build, how long that takes and what it costs. Code only implements generic mechanics (gather, train, rally, …) that read this config. Adding a unit, a building or a resource should normally be a JSON change.

### 9.1 Files
| File | Contents |
|---|---|
| `src/data/game.json` | Global rules: starting resources, pop cap, **default pace multipliers** (= the Standard preset of `pace.json`), queue size, gathering reach and retarget radius, **buildMenu** (what the Build button offers, with hotkeys), construction settings |
| `src/data/units.json` | Every unit: stats, cost, train time, pop, model, icon, **interactions**, **panel**, **actions** |
| `src/data/buildings.json` | Every building: footprint, hp, pop provided, cost, build time, model, icon, **panel**, **actions** |
| `src/data/resources.json` | Resource types (food, wood, gold) and resource **nodes** (tree, pine, berry bush, gold mine): resource, amount, model, icon, panel |
| `src/data/projectiles.json` | Projectile types (arrow, stone): speed, arc, homing, model, launch height (M5) |
| `src/data/terrain.json` | Terrain rules (walkable, buildable, speed) |
| `src/data/palette.json` | All colors and team color sets |
| `src/data/pace.json` | Match pace presets (M7a): gather, build and train speed, starting resource set, pop cap, target length; picked in Match Setup (§2.11) |

All of them are validated at startup by `shared/gameData.ts` (zod). The check covers the shape and the **cross-references**: a train action naming an unknown unit, a gather target naming an unknown node, or a duplicate hotkey stops the game with a clear list of problems. `tests/shared/gameData.test.ts` covers this.

### 9.2 Interactions (what a unit can do with other entities)
Right-click sends one generic command, `interact {units, target}`. The engine looks up each unit's `interactions` to decide what to do with the target. Units that cannot do anything with it just walk next to it.

```jsonc
"worker": {
  "interactions": {
    "gather": {
      "targets": { "tree": 0.4, "pine": 0.4, "berry_bush": 0.45, "gold_mine": 0.35 }  // node kind → rate per second
    }
    // later: "build": { … }, "repair": { … }, "attack": { … }
  }
}
```
- What resource a node gives comes from the node config, `resources.json` → `nodes.<kind>.resource`.
- Harvested resources go **straight into the stockpile**; there is no carrying and no drop site.
- Every kind of work uses **one shared "interacting" animation**: the body sways gently from side to side and the arms swing (the worker's tool is held in the right arm). There is no strong forward/back lean and no per-resource animation code.

### 9.2b Building (no workers)
```jsonc
// game.json
"buildMenu": [
  { "building": "house",     "hotkey": "Q" },
  { "building": "barracks",  "hotkey": "W" },
  { "building": "town_hall", "hotkey": "E" }
],
"construction": { "startHpFraction": 0.1 }
```
- The **Build** button (hotkey B) shows this menu in the command grid at any time. Each button's cost, time and icon come from the building's config.
- Placing a building pays its cost at once and creates a **construction site**. The site finishes on its own after `buildTime / pace.buildSpeed` seconds, and its HP grows from `startHpFraction` to full.
- A site does not give population or actions until it is finished. It can be cancelled for a full refund.
- **One generic construction-site visual for every building type:** a foundation slab, corner scaffold posts and a wooden block that rises with progress, generated from the footprint size, plus a progress bar. There are no per-building construction models.

### 9.3 Panel and actions (what clicking an entity shows)
```jsonc
"town_hall": {
  "panel": ["hp", "armor", "pop", "queue"],            // info fields, rendered generically
  "actions": [
    { "type": "train", "unit": "worker", "hotkey": "Q" },  // cost/time/pop come from units.json → worker
    { "type": "setRally", "hotkey": "Z" }
  ]
}
```
- **Panel fields** (`PANEL_FIELDS` in `shared/gameData.ts`): `hp`, `armor`, `speed`, `sight`, `gatherRate`, `task`, `pop`, `queue`, `amount`, `construction`, `attack`, `stance`.
- **Action types today:** `train`, `stop`, `setRally`, `attackMove`, `stance` (M5). Building is not a unit action; it is the global build menu (§9.2b). Coming later: `research` (M6).
- The command grid, hotkeys, tooltips (cost and time) and affordability tinting are all generated from these lists.

### 9.4 Example unit entry
```jsonc
"militia": {
  "name": "Militia", "description": "Cheap spear infantry. Strong against cavalry.",
  "model": "militia", "icon": "spear", "class": "infantry", "era": 1,
  "cost": { "food": 35, "wood": 20 }, "trainTime": 15, "pop": 1,
  "hp": 45, "armor": 1, "speed": 2.2, "sight": 4, "radius": 0.25,
  "attack": { "damage": 4, "range": 0, "cooldown": 1.5 },
  "interactions": {},
  "panel": ["hp", "armor", "speed", "task"],
  "actions": [{ "type": "stop", "hotkey": "W" }]
}
```
The `model` and `icon` names are resolved by the UI (`ui/art/models.ts`, `ui/hud/pixelIcons.ts`), with a safe fallback for names that have no art yet.

### 9.5 Combat config (M5)
```jsonc
// units.json → militia
"attack": {
  "damage": 4, "range": 0, "cooldown": 1.5,   // range 0 = melee (game.json → combat.meleeReach)
  "bonus": { "cavalry": 8 },                  // extra damage by TARGET class (unit or building class)
  "projectile": "arrow",                      // optional: ranged attacks fly a projectile from projectiles.json
  "minRange": 2,                              // optional: cannot hit closer than this
  "splash": { "radius": 1, "edge": 0.5 }      // optional: area damage, 50% at the edge
},
"combat": {
  "autoAttack": true,          // acquires targets by itself (worker: false)
  "stance": "aggressive",      // starting stance: aggressive | hold
  "fleeWhenHit": 0             // tiles to run away when hit while idle (worker: 4)
},
"interactions": { "attack": { "targets": ["unit", "building"] } },   // right-click on an enemy
"actions": [
  { "type": "attackMove", "hotkey": "Q" },
  { "type": "stop", "hotkey": "W" },
  { "type": "stance", "stance": "hold", "hotkey": "E" },
  { "type": "stance", "stance": "aggressive", "hotkey": "R" }
]

// buildings.json → town_hall (any building may have an attack; construction sites never shoot)
"class": "building", "sight": 7,
"attack": { "damage": 4, "range": 6, "cooldown": 2, "projectile": "arrow", "launchHeight": 2.2 }

// projectiles.json
"arrow": { "speed": 11, "arc": 0.18, "homing": true,  "model": "arrow", "launchHeight": 0.5 },
"stone": { "speed": 7,  "arc": 0.4,  "homing": false, "model": "stone", "launchHeight": 0.6 }

// game.json
"combat": {
  "minDamage": 1, "meleeReach": 0.3, "acquireEveryTicks": 4, "leash": 12,
  "attackerPriority": 0,
  "targetPriority": { "infantry": 1, "ranged": 1, "cavalry": 1, "siege": 1, "worker": 2, "tower": 3, "building": 4 },
  "defaultPriority": 5,
  "retaliateSeconds": 2,          // an idle unit hit this recently goes for its attacker
  "underAttackAlertSeconds": 10
},
"effects": { "corpseSeconds": 5, "rubbleSeconds": 30 }
```
- **Classes** are free names. Unit `class` and building `class` (default `building`) are what `bonus` and `targetPriority` refer to; the validator rejects a bonus or priority naming a class no entity has.
- **Panel fields** added: `attack` (damage, bonuses, range, rate) and `stance`.
- **Action types** added: `attackMove`, `stance` (with `stance`).
- Adding a new ranged unit, a new tower or a new projectile is a JSON change.

---

## 10. Host / Glue Layer

`GameHost` responsibilities:
1. **Create the match:** load the map, the base data and the `MatchRules` from Match Setup. Call `createGame(map, data, rules)`. Create `HumanController` (player 0) and `AIWorkerController` (player 1, or `AIInlineController` headless).
2. **Run the fixed-step loop:** keep an accumulator of real time × game speed, call `game.step()` every 50 ms of game time, and do at most 5 steps per frame. The UI renders every animation frame and interpolates between ticks.
3. **Schedule controllers:** every `thinkIntervalTicks`, send `game.observe(p)` to the AI and receive commands. Human UI commands are applied on the next tick.
4. **Route events:** engine events go to the UI (messages, sounds, alerts) and into the next AI observation.
5. **Record the command log:** rules, seed, map id, data version and tick-stamped commands. This is ready for replays later.
6. **Handle pause and speed:** pausing stops `step()` and AI thinking.
7. **Clean up:** stop the loop, `dispose()` the controllers (terminating the worker) and show the Result screen.

---

## 11. Tooling, Testing & Quality

### 11.1 Tech stack
| Concern | Choice |
|---|---|
| Node | **Node 24 LTS via nvm** (`.nvmrc` = `24`; run `nvm install && nvm use` in the project). The current nvm default, v20.16, is too old for current Vite |
| Language | TypeScript (strict) |
| Dev server / build | Vite. The top-level `maps/` and `assets/` are served in dev and copied into `dist/` by a small copy plugin |
| Rendering | **three.js** (WebGL 2) for the world; HTML/CSS for the HUD. No game framework |
| Font | Pixelify Sans via `@fontsource` (bundled locally, open licence) |
| Validation | zod |
| Unit tests | Vitest |
| Headless tools | `tsx` for `tools/*.ts` |
| Lint / format | ESLint (flat config) + `eslint-plugin-boundaries` + restricted globals/imports, Prettier |
| Deploy | Static `dist/` to any static host |

### 11.2 Scripts
| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm test` | Vitest (all modules) |
| `npm run lint` | ESLint, including the boundary and no-network rules |
| `npm run validate-maps` | Validate every map |
| `npm run sim -- --map twin_rivers --p0 hard --p1 normal --pace fast --games 50 --seed 1` | Headless AI vs AI. Prints win rate, average length and a stall report |

### 11.3 Test plan
| Area | Tests |
|---|---|
| shared | Command validators, RNG determinism, MatchRules bounds |
| engine | A\* (blocked targets, per-player gates), gathering and depletion, construction with N builders, production queue, pop cap, refunds, damage and bonuses, splash, fog, victory, placement, **applyRules** (scaling is correct at every preset), **determinism** (same state hash after 10k ticks) |
| ui | VoxelBuilder (faces outward, winding, texture groups, team colors, UVs), CameraRig (center ray hits target, pan directions, clamping), picking and box selection by screen projection |
| maps | Validator on shipped maps plus broken fixtures |
| ai | Placement never blocks a path, CounterTable choices, BuildOrderRunner triggers, BudgetManager reservation, pace scaling of timings, managers tested with **fake Observations**, **no-network check** on the bundled worker |
| integration | A full headless AI-vs-AI match on each map and each pace preset produces a winner with no exceptions |
| art | Every unit, building and resource id in the data files has a model function (no missing models) |
| manual | A playtest checklist per milestone |

### 11.4 Dev / debug features (dev builds only)
F3 overlay:
- FPS, tick time and entity count
- grid passability (tinted tiles), paths, draw calls and triangles
- the AI panel

Dev cheats: reveal map, +1000 resources, instant build, spawn unit at cursor.

---

## 12. Milestones

Sizes: **S** ≈ small, **M** ≈ medium, **L** ≈ large (relative effort).

### M0: Project setup (S) ✅ done 2026-11-06
- [x] `.nvmrc` (24), `nvm install`, then scaffold Vite + TS strict, ESLint (boundaries + no-network rules), Prettier, Vitest.
- [x] Every module folder with an `index.ts`; a CSP meta tag in `index.html`.
- [x] ~~`PixelCanvas` at 640×360 with integer scaling and a test pattern~~. This was replaced by M0.5 when the graphics direction changed.

**Done when:** lint fails on an `ai → engine` import and on `fetch` in `src/ai` (proved by `tests/lint/architecture.test.ts`).

*Implementation notes:*
- TypeScript is pinned to **6.0**, because typescript-eslint does not support TS 7 yet.
- Each module has its own `tsconfig` (engine, shared and AI have no DOM types), and `npm run typecheck` checks all of them.
- Vite's JS/CSS bundle goes to `dist/bundle/`, so it stays separate from the game's `assets/`.

### M0.5: 3D style preview (S) ✅ done 2026-11-06, waiting for your approval of the look
- [x] three.js renderer, sun + shadows, fog, fixed 45° `CameraRig` (pan, zoom, ground picking).
- [x] `VoxelBuilder`, procedural pixel textures, palette, first models (Town Hall, House, Barracks, Farm, Tower, Wall, Gold Mine, Berry Bush, 4 trees, rock, Worker, Militia, Archer, Knight) with team colors.
- [x] Terrain with ragged pixel borders, water, banks, map-edge sides; instanced forest.
- [x] Mock HUD in the planned layout (resource bar, diamond minimap, selection panel, queue, command grid) with pixel icons and the Pixelify Sans font.
- [x] Tests for VoxelBuilder and CameraRig; screenshots in `docs/preview/`.

**Done when:** you confirm the visual direction.

### M1: Terrain from map files, camera & minimap (M) ✅ done 2026-11-06
- [x] Map schema, loader, validator, `validate-maps` tool; a rough first version of Green Valley.
- [x] Terrain, trees and resources built from the loaded map (instanced); camera clamped to the map.
- [x] Ground picking: highlight the tile under the cursor; the minimap with the camera trapezoid, click to move the camera.

**Done when:** Green Valley loads from `maps/`, renders in the voxel style, and the hovered tile and the minimap camera view are correct.

*Implementation notes:*
- **Map pipeline:** `shared/mapSchema.ts` (zod) and `shared/map.ts` (`decodeMap`) → `engine/map/loadMap.ts` (Grid + resource nodes + spawns) → `engine/map/validateMap.ts` → host `boot.ts` → UI `MapViewScreen`.
- **Green Valley** is produced by `tools/maps/generate-green-valley.ts` (`npm run maps:generate`). The script designs one half and mirrors it, so both sides are equal: 7 berry bushes, 125 trees within 12 tiles and 2 gold mines each, plus a rich 1500-gold center mine. The output is a normal, hand-editable map file.
- **Rule data:** terrain rules live in `src/data/terrain.json` (shallow water is walkable but not buildable), resource amounts in `src/data/resources.json`.
- **Validator:** decorative stones block movement. Trees count as cuttable when checking whether a resource can be reached, but the path between the two bases must exist without cutting anything.
- **Checks:** `npm run check` now also runs the map validator, and `tests/maps/maps.test.ts` validates every shipped map.
- **Screenshots:** `docs/milestones/m1-*.png`. The style preview is still available at `/?preview`.

### M2: Units, selection & movement (M) ✅ done 2026-11-06
- [x] Entities, World, fixed-tick `GameHost` with interpolation between ticks.
- [x] `EntityRenderer` with instanced unit parts, team colors, walk animation, facing from movement.
- [x] `Picker` (screen projection), box select, control groups, selection rings, x-ray silhouettes.
- [x] A\*, smoothing, group slots, separation, stuck detection.

**Done when:** 50 units move around obstacles, can be selected precisely (including when partly hidden behind buildings), and the frame stays under the draw-call budget.

*Implementation notes:*
- **Shared contracts:** `shared/commands.ts` defines `move` (with `queue`) and `stop`; `shared/view.ts` defines `PlayerView` / `UnitView` (current and previous position for interpolation).
- **Engine:**
  - `engine/Game.ts` exposes `createGame(map, {seed, testArmy})`, `enqueue`, `step`, `getView` (cached per tick), `stateHash` and `debugSpawn` (for tests).
  - Starting units come from the map's `start.units` and spawn around each Town Hall.
  - Unit stats live in `src/data/units.json`.
- **Movement** (`engine/systems/movement.ts`):
  - Each unit's order turns into a path request. Pathfinding is budgeted at 20k A\* nodes per tick.
  - Paths are smoothed by a line-of-sight check that refuses corner squeezing.
  - Units follow their path at terrain speed.
  - A unit with no progress for 24 ticks requests a new path, up to 3 times. In a crowd at the destination it counts as arrived once within 1 tile.
  - Soft separation: a standing unit yields to a moving one, and no unit is ever pushed onto a blocked tile.
- **Group moves:** `formationSlots` and `assignSlots` give every unit its own spot around the click. Each unit walks at its own speed, so cavalry arrives first.
- **Host:** `host/GameHost.ts` owns the `requestAnimationFrame` loop. `FixedStepClock` runs 20 ticks/s; the host stamps UI commands with the current tick (and logs them), then calls `GameScreen.frame(dt, view, alpha)`.
- **UI:**
  - `ui/screens/GameScreen.ts` replaces the M1 map view.
  - `render/UnitRenderer.ts` draws each (unit type, team) with one InstancedMesh for the body and one for all legs, plus an x-ray silhouette pass.
  - The silhouette pass draws after the world and before the units, with an inverted depth test. It shows only where terrain, trees or buildings hide a unit, never the hidden inner faces of the voxel models.
  - `input/SelectionController.ts` and `input/picking.ts` handle click, box, shift, double-click, Ctrl/Alt+1-9 groups, right-click move, W stop and Esc.
  - `render/MoveMarkers.ts` shows the move marker. The minimap shows unit dots.
- **Models:** added a Scout Rider. The catapult still uses the militia model until M6.
- **Dev:** `/?army=50` adds 50 mixed units in front of your base.
- **Results:** 50 units around 130 draw calls including shadow passes. 87 tests, including a 50-unit group walking around a wall, determinism (same seed and commands give the same state hash) and command rejection for enemy units.
- **Screenshots:** `docs/milestones/m2-*.png`.

### M3: Economy, data-driven (M) ✅ done 2026-11-06
Everything here is driven by config (§9); no per-unit or per-building logic in code.
- [x] Game data schema + validation with cross-references (`shared/gameData.ts`); `game.json`, `buildings.json`, extended `units.json` and `resources.json`.
- [x] Engine entities: resource nodes and Town Halls (from map spawns); player stockpiles; population and pop cap from `popProvided`.
- [x] Generic `interact` command; gather loop (to node → harvest → to drop site → repeat), auto-retarget, depletion unblocks tiles; deposit at a chosen drop site. *(Changed in M4: drop-off removed, resources go straight to the stockpile.)*
- [x] Training from building `actions` (cost, time, pop from the unit config), queue max, cancel with refund, pop-cap stall, rally point (to a resource = start gathering).
- [x] Pace multipliers fixed in `game.json` (no setup UI).
- [x] UI: buildings drawn from the engine (model from config), resources disappear when used up, one shared work animation, carried bundles.
- [x] UI: selecting buildings and resources; generic info panel from `panel`; command grid and hotkeys from `actions`; production queue (click to cancel); right-click interact and rally.
- [x] HUD: resource bar, population, idle-worker button, message log.

**Done when:** workers gather all three resources and drop them off, the Town Hall trains workers from its config, and a new unit or building can be added through JSON alone.

*Implementation notes:*
- **Config files:** `src/data/game.json`, `buildings.json`, `units.json`, `resources.json` (§9), validated by `shared/gameData.ts`. The engine and the UI each parse the same JSON (`engine/data.ts`, `ui/data.ts`).
- **Engine:**
  - `systems/orders.ts`: the order state machines `move`, `gather` (phases toNode → harvest → toDrop, auto-retarget within `retargetRadius`) and `deposit`.
  - `systems/production.ts`: training queue, population, rally points.
  - `systems/reach.ts`: reach and approach-point helpers.
  - Movement is now goal-based: orders set `unit.goal`, and movement sets `arrived`/`blocked`.
  - Resource nodes and buildings are entities. A depleted node unblocks its tile and bumps `resourcesVersion`.
- **Commands:** `interact` (generic right-click, resolved from the unit's `interactions`), `train`, `cancelTrain`, `setRally`, plus the existing `move` and `stop`. Rejections carry reasons (`NOT_ENOUGH_FOOD`, `QUEUE_FULL`, `NOT_AVAILABLE`, …) that the HUD shows as messages.
- **PlayerView:** adds `self` (stockpile, pop, popCap), `buildings` (with queue progress and rally), live `resources` and `resourcesVersion`. Unit views carry `activity` (idle, walk or work), `task` text, `carry` and `hasOrders`.
- **UI:**
  - `hud/GameHud.ts` builds the info panel from `panel` and the command grid from `actions`; each button sits at the grid slot of its hotkey.
  - Train buttons show cost and time from the unit config and are greyed out when unaffordable. The queue row cancels with a full refund.
  - Resource bar (population turns red when full), idle-worker button and `.` hotkey, message log.
  - `render/BuildingRenderer.ts` draws buildings with the model from config, a selection outline and the rally flag.
  - `render/UnitRenderer.ts` gives every unit the one shared work animation, plus a carried bundle tinted by resource.
  - Resources are picked by raycasting the instanced models (`mapScene.pickObject`), and used-up ones are hidden.
- **Adding content through JSON:**
  - A new unit: add it to `units.json` and reference it in a building's `actions` with `{ "type": "train", "unit": "<id>", "hotkey": "W" }`.
  - A new resource node: add it to `resources.json` and to the gatherer's `interactions.gather.targets`.
  - A model or icon name that has no art yet falls back to a default.
- **Results:** 100 tests, including the full gather loop, retargeting, depletion, deposit, training (cost, time, queue max, cancel refund, pop-cap stall), rally-to-resource, and data cross-reference validation.
- **Screenshots:** `docs/milestones/m3-*.png`.
- **Not done yet (later milestones):** construction of new buildings (M4), Storehouse model, stumps for felled trees, custom tooltips (native `title` tooltips for now).

### M4: Construction without workers + economy changes (M) ✅ done 2026-11-07
User decisions of 2026-11-06 (replacing the original worker-built design):
- [x] **Build menu:** a Build button (B, under the idle-worker button) opens `game.json → buildMenu` in the command grid. No worker needs to be selected.
- [x] **Placement:** a translucent ghost of the building plus green/red tiles; click to place (Shift places more), right-click or Esc cancels.
- [x] **Engine:** `build {building, at}` validates the footprint, pays the cost and creates a construction site. It finishes by itself after `buildTime / pace.buildSpeed`. `cancelBuild` refunds in full. Units standing on the footprint are moved aside.
- [x] **Construction site:** no population and no actions until finished; HP grows from `construction.startHpFraction` to full.
- [x] **One generic construction-site visual** for every building type (foundation, scaffold posts, rising block, progress bar), sized from the footprint.
- [x] **Gathering:** remove carrying and drop sites. Harvested resources go straight into the stockpile (remove `carry`, `dropSite`, the deposit order and the carried bundle).
- [x] **Work animation:** separate arm parts; gentle side-to-side sway with swinging arms while working (tool in the right arm); arms also swing while walking.
- [x] House and Barracks usable (more pop; Barracks trains Militia from its config).

**Done when:** a player can build houses and barracks from the Build button, sites show the generic construction UI and finish on time, population grows, workers gather straight into the stockpile, and the work animation is the gentle sway.

**Implementation notes (M4):**
- **Engine:** `engine/systems/construction.ts` holds `buildTicks`, `inBuildMenu`, `canPlace` (grid `isAreaBuildable`: terrain buildable, no building/resource/boulder) and `clearFootprint` (moves units on the new footprint to the nearest free spot). `constructionSystem` runs first in each tick; it advances every site by one tick and emits `buildingCompleted` when done. `Building` has `constructed`, `buildProgress`, `buildTotal`; `BuildingView` exposes `constructed` and `buildProgress` (0..1). `train`, `setRally` and production ignore unfinished sites; pop cap counts finished buildings only. New reject reason `BAD_PLACEMENT`.
- **Gathering:** the gather order is just `toNode → harvest`; each whole unit harvested is added to the owner's stockpile at once. `carry`, `dropSite`, the `deposit` order and the carried bundle are gone; the worker panel field `carry` became `gatherRate` (best rate per resource, from `interactions.gather.targets`).
- **Data:** `game.json` has `buildMenu` (building + hotkey, validated: known building, no duplicate hotkey) and `construction.startHpFraction`.
- **UI:**
  - `GameHud`: Build button + build menu (one button per `buildMenu` entry, greyed when unaffordable); the menu closes when the selection changes, and a toggle rebuilds the grid at once so a hotkey right after B works. A site shows ONE generic panel for every building type: name, "Under construction", HP bar, a gold construction bar with "Building N% · Ns left", and Cancel (C, full refund).
  - `input/PlacementController.ts`: ghost = the finished-building mesh with cloned translucent materials; one tile quad per footprint tile, green when free and red when blocked (drawn on top, so a spot over a building still shows red); the ghost tints red when blocked or unaffordable. Free tiles are checked in `GameScreen.tileFree` (terrain rules, boulders, live resource nodes, buildings in the view); the engine re-checks.
  - `SelectionController` routes clicks to the placement while it is active; Esc cancels placement, then rally targeting, then the build menu, then clears the selection.
  - `BuildingRenderer`: construction sites use `constructionSiteGeometry` + `constructionCoreGeometry` (cached per footprint size); the core block rises with progress and a progress bar floats above, facing the camera. Messages: "Can't build there", "<Building> finished".
  - `UnitRenderer`: arms are separate instanced parts pivoting at the shoulder (the axe is part of the right arm). Walk: legs and arms swing in opposite rhythm. Work (shared by every unit): body rolls about ±0.09 rad side to side, arms swing alternately; walk/work weights blend so switching never pops.
- **Results:** 104 tests (new `tests/engine/construction.test.ts`: cost, timing, HP growth, pop only when finished, bad placement, unknown building, not enough wood, cancel refund + tiles freed, no training until finished, units moved off the footprint). Checked in the browser: build menu, ghost, red tiles over the Town Hall, house and barracks sites, pop 5 → 10 after a house, gathering straight into the stockpile, work sway.
- **Screenshots:** `docs/milestones/m4-*.png`.
- **Not done yet:** a site under attack (M5 combat), the AI using `build` (M8), custom tooltips.

### M5: Combat (M) ✅ done 2026-11-07
Everything below is **config first**: who can attack what, how hard, how far, with which projectile, how a unit behaves when it sees or is hit by an enemy, and which buttons it shows all live in `src/data/*.json` (§9.5). Code only implements generic mechanics.

- [x] **Data:** `attack` block on units AND buildings (damage, range, minRange, cooldown, bonus per target class, projectile, splash); `combat` behavior block on units (autoAttack, stance, fleeWhenHit); `interactions.attack.targets`; building `class` and `sight`; new `src/data/projectiles.json`; `game.json → combat` (min damage, melee reach, acquire interval, leash, target priority by class, alert throttle) and `game.json → effects` (corpse and rubble times). All validated with cross-references.
- [x] **Commands:** right-click an enemy (`interact`) = attack when the unit's `interactions.attack.targets` allow it; new `attackMove {units, to, queue}` and `setStance {units, stance}`.
- [x] **Orders:** `attack {target, auto, homeX, homeY}` (chase → in range → strike on cooldown; auto-acquired chases obey the leash) and `attackMove {x, y}` (move; engage enemies met on the way; resume).
- [x] **Targeting** (every `acquireEveryTicks`, staggered by id): idle aggressive units scan their sight, hold units scan their range, attack-movers scan their sight; buildings with an `attack` scan their range. Pick by priority (`attacker` first, then `targetPriority[class]`), then distance, then id.
- [x] **Damage formula** (§2.4): `max(minDamage, damage + bonus[target.class] − target.armor)`. Melee hits at once; ranged spawns a projectile from `projectiles.json` (homing arrows always hit; non-homing stones land on a point and deal splash with edge falloff).
- [x] **Death:** units and buildings at 0 HP are removed (building tiles freed); events `unitDied`, `buildingDestroyed`, `underAttack` (throttled per player).
- [x] **Workers** never auto-attack (config) and flee `fleeWhenHit` tiles when hit while idle; they can still attack on an explicit right-click.
- [x] **Town Hall arrows and Watch Tower** (new building, model `tower`, in the build menu) come from their `attack` config; construction sites never shoot.
- [x] **UI:** red ring for selected enemies, red attack marker, Attack-move button (targeting mode, then click), Hold/Aggressive buttons with the active one highlighted, `attack` and `stance` panel fields, HP bars over damaged or selected units and buildings, arcing arrow and stone projectiles, ONE shared strike animation (arms chop, body lunges; mounted units lunge), hit flash and sparks, death animation (topple and sink), dust and rubble for destroyed buildings, fire on buildings below 50% HP, "You are under attack!" message and a minimap ping.
- [x] **Dev:** `/?enemy=N` spawns N enemy units between the bases for testing fights.

**Done when:** the counter scenario tests pass (3 Militia beat 1 Knight, 1 Militia beats 1 Scout Rider, Archers beat Militia, a Scout Rider beats an Archer, a Catapult wrecks a building), plus targeting, leash, hold, attack-move, worker flee, tower/Town Hall arrows, death and determinism tests; and fights are readable on screen.

**Implementation notes (M5):**
- **Engine files:** `systems/combat.ts` (combatant helpers, edge-to-edge `gap`, damage formula, `strike`, `applyDamage`, tower/Town Hall fire in `combatSystem`, `projectileSystem`, `deathSystem`), `systems/targeting.ts` (`targetingSystem`, `bestTarget`), `entities/Projectile.ts`; orders `attack` and `attackMove` in `systems/orders.ts`. Tick order: commands → construction → production → targeting → combat → orders → pathfinding → movement → separation → projectiles → deaths.
- **Config added** (all validated, see §9.5): unit `attack` (now optional; `targets`, `bonus`, `projectile`, `minRange`, `splash`, `launchHeight`), unit `combat` (`autoAttack`, `stance`, `fleeWhenHit`), `interactions.attack.targets`, building `class`/`sight`/`attack`, `projectiles.json`, `game.json → combat` (incl. `retaliateSeconds`) and `effects`. Town Hall shoots arrows (`targets: ["unit"]`); new **Watch Tower** (`watch_tower`, build menu R; era gating comes with M6).
- **Rules as built:** an idle aggressive unit scans its sight (hold: its reach); an idle unit hit within `retaliateSeconds` goes for its attacker; attack-movers scan their sight and insert an auto attack; auto chases give up beyond `leash` and walk back (or resume the attack-move); hold-stance units never chase. Ranged units step back when a target is inside their `minRange`. Homing arrows whose target dies land harmlessly. Construction sites can be attacked but never shoot or burn.
- **Commands:** `interact` on an enemy = attack (per `interactions.attack.targets`); `attackMove` (units without an attack just move); `setStance`.
- **View/events:** `UnitView.stance`, `UnitView.strikeTick`, `PlayerView.projectiles`; events `unitDied`, `buildingDestroyed`, `underAttack`. `stateHash` now includes HP, cooldowns and projectiles.
- **UI:** `render/HealthBars.ts` (shared instanced bars), `render/Effects.ts` (sparks, dust, fire/smoke particles), `render/ProjectileRenderer.ts` (models from `projectiles.json → model`, `art/models.ts → projectileGeometry`), `art/models.ts → rubbleGeometry` (ONE rubble look for every building). `UnitRenderer`: shared strike animation timed from `strikeTick`, white hit flash, corpses that topple and sink, red rings for enemies. `BuildingRenderer`: HP bar, sparks, fire below 50% HP (finished buildings only), rubble + dust. `SelectionController`: right-click prefers the enemy unit under the cursor (red marker); attack-move targeting mode. `GameHud`: Attack-move / Hold (new shield icon) / Aggressive buttons with the active stance highlighted, `attack` and `stance` panel fields; a mixed selection now shows every action any selected type has, and each button only affects the units whose config has it. Messages and a red minimap ping on `underAttack`.
- **Dev:** `/?enemy=N` spawns N enemy units between the bases (`GameOptions.testEnemy`).
- **Results:** 128 tests (new `tests/engine/combat.test.ts`: damage formula and floor, 3 Militia beat 1 Knight, Knight beats 1 Militia, Militia beats Scout, Archers beat Militia, Scout beats Archer, Catapult destroys a house and respects its min range, projectile flight time, sight-limited auto-acquire, target priority, hold, leash, attack-move, explicit attack without leash, worker no-auto-attack + flee + explicit attack, Town Hall arrows, sites do not shoot, Watch Tower, building death frees tiles and pop, unit death events and throttled alert, determinism of a 32-unit battle; plus combat config validation in `gameData.test.ts`). Checked in the browser: a 20 vs 20 attack-move battle and a 31-unit siege of the enemy Town Hall (arrows, HP bars, strikes, corpses, smoke, rubble).
- **Screenshots:** `docs/milestones/m5-*.png`.
- **Not done yet:** Catapult model (falls back to the militia model), era gating of the Watch Tower (M6), upgrades in the damage formula (M6 Blacksmith), victory (M7), fog (M7).

### M6: Play against the machine (L) ✅ done 2026-11-07, details in `docs/plans/m6-vs-machine.md`
User decisions (2026-11-07): the machine plays by default and decides from the current situation (no scripted build order); no new units or buildings; full vision for both (no fog); **losing the Town Hall loses the game**; one difficulty, Easy, hard-coded. Eras are dropped.
- [x] Victory (`game.json → victory.defeatWhenLost`), match stats, frozen simulation after game over, result screen (Victory / Defeat / Draw, stats, Play again).
- [x] `game.observe()` and `game.staticInfo()`; shared contracts in `src/shared/ai.ts`.
- [x] `src/ai/`: situation analysis → army posture (build / stage / attack / retreat / defend) → prioritized budget (workers, houses, Barracks, tower, soldiers) → worker assignment by need, only to safe nodes; placement with a free ring.
- [x] Host: Web Worker controller (default), inline controller (tests), `?ai=off`; the AI's status line in the info box.
- [x] Tests: victory, observation, budget, placement, headless matches (economy, safe gathering, wins against an idle opponent from both starts, defends a raid, determinism).

**Known limit:** food is finite (berries only, about 700 per side), so long games stall once both sides have spent it. A Farm or more berries would fix it (user decision).

### M6.5: Army roster (M) ✅ done 2026-11-07, details in `docs/plans/m6.5-army-roster.md`, units in `docs/units.md`
User decisions (2026-11-07): the Barracks trains Archers too; a new Stable trains Scout Rider and Knight; every unit needs a clear role, an exploitable weakness and a situation where it shines, and no unit may be best everywhere. No Stable prerequisite; berries 100 → 200; the Catapult stays untrainable.
- [x] Combat fix: an attack-moving unit hit from beyond its sight strikes back (archers no longer walk past Militia unanswered).
- [x] Data: Barracks Q Militia / W Archer, Stable (175 W, 45 s, 900 HP) Q Scout Rider / W Knight, build menu A; rebalanced bonuses (`docs/units.md` §5); negative bonus = weak against buildings.
- [x] Voxel Stable model and a Knight HUD icon; a finished Stable behind each base in the scenario.
- [x] Tests: equal-cost matrix at 400 and 800 a side, rule 4, eight army mixes each beaten by another, one situation per unit, weaknesses; `docs/units.md` tables checked against the data.
- [x] Machine player: `buildings.militaryBuildingTypes`, `army.unitChoice` (`first` / `fewest` / `random` / `counter`), `army.counterShare`, `army.counterRangedEdge`, `army.counterMinShare`; Normal answers what it sees, Easy presses the Militia button.

*Implementation notes:*
- The counter pick (`src/ai/counters.ts`) scores by Lanchester's square law (cost²); with plain cost it would answer Knights with Knights, which the fights disprove.
- Easy had to be retuned: with the scenario Stables on the novice's path and archers at home, the novice won only 3 of 8 seeds. The Stables moved behind the bases, Easy only trains Militia (`unitChoice: first`) and notices attacks 1 time in 4 (`defence.defendChance` 0.25): 8 of 8.
- Normal now beats Easy in all 3 seeds tried, at about 6:00.

### M7a: Menus & match settings, art clean-up, two new maps (M) ✅ done 2026-11-08, details in `docs/plans/m7-menus-art-maps.md`
User request (2026-11-08): a main menu, match setup, pause and simple settings (difficulty, speed, …) instead of opening straight into a match; replace the temporary art; add 2 more maps. This takes the screens part of M7 and pieces of M10 and M11.
- [x] **Flow:** `/` opens the Main Menu (Play → Match Setup, Quick start with the last setup, Settings, How to Play). Any match parameter in the URL (`?play`, `?map=`, `?ai=`, `?setup=`, `?pace=`, `?speed=`, `?army=`, `?enemy=`) skips the menu, so the dev shortcuts still work. A Loading panel shows while the scene is built.
- [x] **Match Setup:** map list with a minimap preview, size and description; opponent Easy / Normal (from `src/ai/profiles/`, help text = the profile's `persona`) / Idle; start Ready-made battle / Standard (the first is disabled on a map without a scenario); pace Relaxed / Standard / Fast / Blitz; game speed 0.5× / 1× / 1.5× / 2×. The last setup is remembered (`localStorage` key `bod.setup.v1`).
- [x] **Pace per match:** `src/data/pace.json` (validated by `shared/rules.ts`); `GameOptions.rules` replaces the global `game.json → pace / popCap / startingResources` in gathering, construction, training, pop cap and the starting stockpile; the AI gets the same rules inside its game data; HUD tooltips and timers show the real times.
- [x] **In the match:** speed pill and a menu button (≡) at the top; `P` pauses ("Paused" banner); `+` / `-` change the speed; `Esc` cancels placement, targeting or the build menu, otherwise opens the **pause menu** (Resume, speed, Settings, How to Play, Restart, Surrender, Quit to menu; Surrender and Quit ask for a second click). Game input is blocked while it is open.
- [x] **Surrender:** a new `surrender` command; the engine ends the match at once (`MatchResult.reason: 'surrender'`); the result screen says "You surrendered" and has Play again and Main menu.
- [x] **Settings** (`src/ui/settings.ts`, key `bod.settings.v1`, all storage access wrapped): edge scrolling, scroll speed, shadows, render quality, FPS line, machine's plan line. They apply at once in a running match.
- [x] **Art:** own HUD icons for Barracks, Stable, Watch Tower, Pine, Berry Bush, Gold Mine and Catapult (before they reused the Attack-move, Scout Rider, Archer, oak, food and gold icons and the Build hammer); a voxel Catapult model (before: the Militia); a menu icon. **Model viewer** at `/?models`: every model on a turntable in both team colors, plus every HUD icon.
- [x] **Maps:** Twin Rivers and Forest Pass (96×96, §8.3), both with a ready-made scenario, generated by `tools/maps/generate-twin-rivers.ts` and `generate-forest-pass.ts`. The generator helpers moved to `tools/maps/mapgen.ts` (Green Valley regenerates byte for byte the same); `npm run maps:generate` writes all three.
- [x] Tests: pace presets and rules (`tests/shared/rules.test.ts`, `tests/engine/pace.test.ts`), surrender (`victory.test.ts`), grid regions and the pocket-tree fix (`pathing.test.ts`, `economy.test.ts`), no placeholder icons or models (`tests/ui/art.test.ts`), settings storage (`tests/ui/settings.test.ts`), setup URL (`tests/host/setupUrl.test.ts`), the AI on the new maps (`tests/ai/maps.test.ts`). 234 tests; `npm run check` takes about 26 s (was 40 s).

*Implementation notes:*
- **Engine fix found by the new maps:** workers sent to a tree whose only free neighbour is a pocket enclosed by other trees searched A* to its 6000-node cap, failed, and retried several hundred times a minute. That used up the whole path budget every tick (one simulated minute took 10–20 s on Forest Pass). `Grid.regionAt()` now labels connected land (recomputed lazily after blockers change), and `approachPoint()` only offers tiles in the unit's own region, so such trees are skipped. Green Valley had the same problem on a smaller scale: the test suite went from 25 s to 11 s.
- Leaving a match (Restart, Play again, Quit) **reloads the page**, with the match URL or `/`. That is the simplest way to be sure no WebGL context, AI worker or listener of the old match survives. The match URL is written into the address bar when a match starts, so a browser refresh restarts the same match.
- Headless results after the change (scenario start, seeds 1–8): a novice beats Easy 8/8 on Green Valley, 7/8 on Twin Rivers and 6/8 on Forest Pass. The other games were still running at the 20-minute cutoff, and the novice never lost. Normal beats Easy 3/3 on every map (standard start, at 8–10 min).
- The pause menu stops every key in the capture phase while it is open, and the camera ignores edge scrolling then. Surrender closes the menu first, because commands only apply while time runs.
- Shadows are switched with `sun.castShadow`; three.js swaps the shaders by itself. Render quality Low uses a pixel ratio of 0.75.

### Later: Remaining content (was M6)
- [ ] Eras and all techs.
- [ ] Blacksmith, Siege Workshop, Castle; Catapult. (Archer, Scout Rider, Knight and the Stable are done in M6.5; the Barracks trains Archers, so there is no Archery Range.)
- [ ] Wall drag along the grid axes with auto-joining wall models (posts, corners, T-joins); owner-only gates with 2 orientations.

**Done when:** everything in §2 is playable and data-driven.

### M7: Fog, victory, screens & pace setup (M)
- [ ] Visibility, explored areas, ghosts, the fog-of-war shader chunk, and the fog-filtered `PlayerView`.
- [x] VictorySystem (M6) and surrender (M7a). [ ] MatchStats beyond the four counters (kills, resources gathered, army graph).
- [x] Main Menu, Match Setup with pace presets, Loading, Pause, Settings, Result, How to Play (text): done in M7a. [ ] Custom pace sliders.

**Done when:** a full match can be played from the menu to the result screen at any pace preset (against an idle opponent).

### M8: Machine player, foundation (L), the separate `src/ai/` module
- [ ] `observe()` with audience-filtered events; `StaticMapInfo` with rules and derived data.
- [ ] `AIPlayer`, worker bridge, `AIWorkerController`, `AIInlineController`, reaction delay; the no-network bundle test.
- [ ] WorldModel, Blackboard, BudgetManager, EconomyManager, BuildManager + Placement, ResearchManager, BuildOrderRunner (Balanced).
- [ ] A simple ProductionManager and MilitaryManager (attack waves); `tools/sim.ts`.

**Done when:** the AI builds a full economy, reaches Era III and attacks. Headless AI-vs-AI games finish at Standard and Fast pace with no stalls, and lint shows zero imports from the engine and zero network APIs in the AI.

### M9: Machine player, strategy & difficulty (L)
- [ ] EnemyMemory, ThreatMap, CounterTable, Composition.
- [ ] Posture state machine and squads; TacticsManager; ScoutManager.
- [ ] Rush, Boom and Raider strategies; Easy, Normal and Hard profiles; pace scaling of timings.
- [ ] AI debug overlay; AI-vs-AI spectator mode.

**Done when:** the §6.9 quality targets are met in the simulator.

### M10: Final art, audio & polish (L)
- [x] Catapult model, own icons for everything, model viewer page (`/?models`): done in M7a.
- [ ] Remaining polish: decor; cursors; portraits; per-building construction stages (for now one generic construction site, a user decision of 2026-11-06).
- [x] Shadows and render quality settings (M7a). [ ] Pixel filter; test on a low-end GPU.
- [ ] All sfx presets; music tracks (menu, 2 in-game loops, stingers).
- [ ] Illustrated How to Play, first-match tips, colorblind team colors.

**Done when:** no placeholder art remains, you have reviewed and approved the model viewer, and a new player can win an Easy match without help.

### M11: Maps, balance & release (M)
- [x] Twin Rivers and Forest Pass exist (M7a, generated, validated, with scenarios). [ ] Finish all three (decor, balance from playtests).
- [ ] Balance pass using simulator statistics and playtests at every pace preset; performance profiling.
- [ ] Production build and deploy.

**Done when:** a public build runs at 60 fps with 200 units, every test passes, and the pace presets hit their target match lengths.

### Later (backlog)
Map editor, random maps, save/load, replay viewer, camera rotation, terrain elevation, a second faction, garrisoning, an interactive tutorial, a "starting era" option.

**First playable against the machine:** end of **M8**. **Feature complete:** end of **M9**.

---

## 13. Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Too many draw calls (hundreds of models) | FPS drops | InstancedMesh per model type and team, shared materials, merged geometry; draw-call counter in the debug overlay; budget test in M2 |
| Weak GPUs (integrated graphics, old laptops) | Unplayable | Graphics settings: shadows Low/Off, render scale, pixel ratio cap; profile on integrated graphics in M10 |
| Hard to click small units in 3D | Frustrating | Screen-projection picking with a generous radius, units preferred over buildings, x-ray silhouettes for hidden units |
| Large art workload (every model by hand) | Polish is delayed | Code-driven VoxelBuilder and shared pixel textures; models are short functions; the first set already exists from M0.5 |
| Units stuck or jammed in chokepoints | Feels bad, AI gets confused | Destination slots, soft separation, stuck detection, path tests |
| The AI walls itself in | AI stalls | Flood-fill check in `Placement`, 1-tile gaps, simulator stall detection |
| Extreme custom pace values break AI timings | AI too passive or too rushed | AI timings scale by paceScale; build orders are triggered by game state, not clock time; simulator runs at every preset; custom sliders are bounded |
| The worker's asynchronous timing breaks determinism | Replays break | Tick-stamped command log; inline mode for tests and simulator |
| Scope creep | Never finished | Strict v1 scope (§1); everything else goes in the backlog |

---

## 14. Decisions Log & Next Step

### Decisions (resolved 2026-11-06)
| Topic | Decision |
|---|---|
| Tech stack | TypeScript + Vite, Node 24 LTS through nvm (`.nvmrc`) |
| AI runtime | Web Worker, local rule-based code. **No third-party AI or API, no network** |
| Graphics | **3D voxel / low-poly models with pixel textures** (three.js), fixed iso-like camera, flat terrain. Corrected from 2D pixel art on 2026-11-06 |
| HUD | HTML/CSS overlay in a pixel style (Pixelify Sans, pixel icons) |
| Factions | One shared faction; team colors only |
| Art, audio, music | All made in code (VoxelBuilder models, procedural pixel textures, synth/sequencer) |
| Difficulties | Easy / Normal / Hard. No cheating level |
| Language | English |
| Name | **Banners of Dawn** |
| Pace | Configurable (presets plus Custom). Fixed in `src/data/game.json` until 2026-11-08; since M7a the four presets of `src/data/pace.json` are picked in Match Setup. Custom sliders not yet |
| Data-driven design | **Config first, no hard-coding** (2026-11-06): interactions, info panels, actions, train/build lists, costs and times all live in `src/data/*.json` (§9). One shared "interacting" animation for every unit |
| Priorities | Game logic and units first; map polish later (2026-11-06) |
| Construction | **No workers needed**: Build button → build menu from `game.json` → place → the site builds itself; one generic construction-site visual for all buildings (2026-11-06) |
| Gathering | **No carrying or drop sites**: harvested resources go straight to the stockpile (2026-11-06) |
| Work animation | Gentle side-to-side sway and swinging arms, not a strong forward/back lean (2026-11-06) |
| Combat config | Every entity is configurable (2026-11-07): attacks, bonuses, projectiles, behavior near enemies, target priority and combat rules live in `src/data/*.json` (§9.5); code stays generic |
| Eras | **None, a single era** (2026-11-07). Everything is available once its production building exists |
| Machine player | Plays by default, decides from the current situation (no scripted build order); full vision, no fog; **losing the Town Hall loses** (2026-11-07). **Each mode has its own config file** `src/ai/profiles/<mode>.json` (2026-11-07): Easy = a primary-school child anyone can beat (default), Normal = the earlier careful logic. Rules and the configuration table: `docs/ai-modes.md` |
| Default start for testing | The map's `scenario` (§8.1) is the default start (2026-11-07): built-up bases, gathering workers, an army each; the enemy army stands away from its base so it can be fought without base fire. `/?setup=standard` = plain start. Since M7a it is the default of the Start option in Match Setup |
| Menus and settings | (2026-11-08, M7a) `/` opens a Main Menu; Match Setup picks map, opponent (Easy / Normal / Idle), start, pace preset and game speed; simple settings only (edge scroll, scroll speed, shadows, render quality, FPS line, machine's plan line). Pace = presets only for now (no custom sliders). Leaving a match reloads the page |
| Placeholder art | (2026-11-08, M7a) Every entity has its own HUD icon and model (a test enforces it); `/?models` shows them all for review |

### Current status (updated 2026-11-08)
| Milestone | State |
|---|---|
| M0 setup, M0.5 style preview, M1 maps, M2 units & movement | ✅ done and committed |
| M3 Economy (data-driven) | ✅ done and committed |
| M4 Construction without workers + economy changes | ✅ done (2026-11-07) |
| M5 Combat | ✅ done (2026-11-07) |
| Test scenario start (map `scenario`, §8.1) | ✅ done (2026-11-07) |
| M6 Play against the machine (Easy) | ✅ done (2026-11-07) |
| M6.5 Army roster (Barracks: Militia + Archer; new Stable: Scout Rider + Knight) | ✅ done (2026-11-07); details in `docs/plans/m6.5-army-roster.md`, units in `docs/units.md` |
| M7a Menus & match settings, art clean-up, Twin Rivers + Forest Pass | ✅ done (2026-11-08), waiting for review; details in `docs/plans/m7-menus-art-maps.md`, screenshots `docs/milestones/m7-*.png` |
| **Next** | user's choice: e.g. a Farm for infinite food, a Hard mode, fog of war, custom pace sliders, sound |

**How to resume:**
1. `nvm use && npm install && npm run dev`, then open `/`: the **Main Menu**. Play → Match Setup (map, opponent, start, pace, speed), or Quick start with the last setup. For quick testing, `/?play` starts the last setup at once and any match parameter does too: `/?map=forest_pass`, `/?ai=normal` (or `off`), `/?setup=standard`, `/?pace=blitz`, `/?speed=2`, `/?army=20&enemy=20`. `/?models` = model viewer, `/?preview` = style diorama.
2. `npm run check` must stay green (typecheck, lint with module boundaries, map validation, tests).
3. Continue with the first unchecked milestone in §12.
4. After each milestone: tick its checklist, add implementation notes under it, update this table, commit.
5. Browser check without a GUI: run `npx vite --port 5199`, start `google-chrome --headless=new --remote-debugging-port=9333 --use-angle=swiftshader --enable-unsafe-swiftshader`, and drive it over CDP (keys, clicks, screenshots) with a small Node 24 script (Node 24 has a global `WebSocket`).

**Agreed priorities (2026-11-06):** focus on game logic and units. Map polish (forest density, layout) can wait and is not worth time now.

**Where we are (2026-11-08):** the game opens on a Main Menu; a match is set up in Match Setup (Green Valley, Twin Rivers or Forest Pass; Easy, Normal or Idle; ready-made battle or standard start; Relaxed / Standard / Fast / Blitz pace; 0.5×–2× speed) and can be paused, sped up, restarted, surrendered or quit from the pause menu (Esc). Each AI mode's numbers are in `src/ai/profiles/<mode>.json`; `docs/ai-modes.md` explains the logic. Every entity has its own icon and model; `/?models` shows them all.

**Army (M6.5, 2026-11-07):** the Barracks trains Militia and Archers, and the new Stable (build menu A) trains Scout Riders and Knights. Each unit's role, weakness and best situation are in `docs/units.md`; `tests/engine/balance.test.ts` proves the counter cycle. Normal picks counters to what it sees; Easy only presses the Militia button.

**Next:** ask the user. Open points: Farm (food is still finite, berries now 200 each); a Hard mode (the menu lists modes from `src/ai/profiles/` by itself); fog of war; custom pace sliders and AI timings scaled by pace; sound and music; illustrated How to Play. No eras (decision 2026-11-07).
