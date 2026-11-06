# Banners of Dawn: Web RTS Game, Detailed Project Plan (v4, for review)

> **Banners of Dawn** is a 3D voxel-style (low-poly with pixel textures), 1v1 real-time strategy game played against the computer in the browser.
> Status: M0 done. A **style preview** is running (`npm run dev`) for review of the visual direction.

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

- A worker carries **10** units of a resource (15 with the *Wheelbarrow* tech) and returns them to a **drop site** (Town Hall or Storehouse).
- When a node runs out, the worker automatically looks for the nearest node of the same type within **8 tiles**. If none is found, the worker goes idle and the idle-worker indicator lights up.
- A farm takes **1 worker** and never runs out. Farms are **walkable**.
- **Starting state (Standard):** 200 Food, 200 Wood, 100 Gold, 1 Town Hall, 3 Workers, 1 Scout Rider.

### 2.2 Population
- Town Hall gives +5, House +5, Castle +10. The **cap is 100** at Standard pace (configurable, §2.11).
- If a unit would go over the cap, training pauses and the HUD shows "Need more houses".

### 2.3 Eras (3)
| Era | Cost | Research time | Requirement | Unlocks |
|---|---|---|---|---|
| **I. Settlement** | (start) | — | — | Worker, Militia. Town Hall\*, House, Storehouse, Farm, Barracks |
| **II. Kingdom** | 400 F, 80 G | 60 s | Barracks + Storehouse built | Archer, Scout Rider. Archery Range, Stable, Blacksmith, Watch Tower, Wall, Gate, additional Town Hall |
| **III. Empire** | 600 F, 300 G | 90 s | 2 of {Archery Range, Stable, Blacksmith} | Knight, Catapult. Siege Workshop, Castle. Tier-II techs |

\*An additional Town Hall can only be built from Era II.

Typical timings at Standard pace: Era II at about 7–9 minutes, Era III at about 14–16 minutes.

### 2.4 Units
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
| Town Hall | 3×3 | I (start) / II (extra) | 300 W, 150 G | 90 s | 1500 | Drop site for everything, trains Worker, researches Eras, +5 pop, shoots arrows (4 dmg, range 6, every 2 s) |
| House | 2×2 | I | 30 W | 15 s | 300 | +5 pop |
| Storehouse | 2×2 | I | 80 W | 20 s | 400 | Drop site for everything, economy techs |
| Farm | 2×2 | I | 60 W | 15 s | 200 | Infinite food, 1 worker, walkable |
| Barracks | 3×3 | I | 150 W | 40 s | 1000 | Trains Militia |
| Archery Range | 3×3 | II | 150 W | 40 s | 1000 | Trains Archer (requires Barracks) |
| Stable | 3×3 | II | 150 W | 40 s | 1000 | Trains Scout Rider, Knight (III) |
| Blacksmith | 3×3 | II | 150 W | 40 s | 900 | Attack and armor upgrades |
| Watch Tower | 1×1 | II | 125 W, 50 G | 35 s | 500 | 6 dmg, range 7, every 2 s, sight 9 |
| Wall | 1×1 per segment | II | 3 W per segment | 4 s per segment | 250 | Drag to place a line along a grid axis |
| Gate | 3×1 or 1×3 | II | 30 W | 15 s | 600 | Opens for its owner only; blocks the enemy |
| Siege Workshop | 3×3 | III | 200 W | 50 s | 1000 | Trains Catapult |
| Castle | 4×4 | III | 400 W, 300 G | 100 s | 3000 | Shoots 3 arrows (6 dmg, range 8), +10 pop |

\*Build time is for 1 worker. With more workers, the build rate is `1 + 0.6 × (n − 1)` times the base rate.
- All buildings have **armor 1**.
- A building under construction has HP in proportion to its progress.
- **Repair** costs 25% of the building's cost, scaled by the HP restored, and runs at half the build speed.
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
| After building | A worker that built a Storehouse or Farm starts gathering nearby automatically |
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
> **Current decision (2026-11-06):** there is no pace selection UI yet. The pace multipliers are fixed in `src/data/game.json` → `pace` (gatherRate, trainSpeed, buildSpeed; 1.0 = Standard). The presets and the Match Setup choice below come later and only need to fill in the same values.

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
| `Gatherer` | carryType, carryAmount, capacity, rates{}, targetNode, lastNodePos |
| `Builder` | buildRate, repairRate |
| `ResourceNode` | resType, amount, slots, infinite (farm) |
| `Building` | type, tileX, tileY, w, h, constructed, progress, dropSite, popProvided, gateOwnerPassable |
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
| 8 | GatherSystem | Harvest, carry, drop off. Handle depletion and auto-retarget |
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
| `ResourceClusters` | Wood lines, gold mines and berry clusters, each with distance to the nearest own drop site |
| `Own base` | Bounding region of own buildings plus 6 tiles, with "front" (toward the enemy) and "back" directions |
| `Army strength` | `Σ (hp × dps × counterFactor)` for own units and estimated enemy units |

### 6.5 Managers
| Manager | Responsibility | Key rules |
|---|---|---|
| **BudgetManager** | Share resources among competing requests | Priorities: emergency defense 100, house when ≤ 3 free pop 90, workers up to target 80, era advance 70, military 60, new buildings 50, techs 40. Reserved resources are not spent on lower priorities |
| **EconomyManager** | Workers and gathering | Worker target per era from the strategy (e.g. 16 / 26 / 32, capped at 40% of pop cap). Keep the Town Hall producing workers. Assign idle workers to the resource furthest below its target ratio. Request a Storehouse when a cluster is more than 6 tiles from a drop site. Request Farms as berries run low |
| **BuildManager** | Building requests → `build` commands | Spot from `Placement`. Nearest non-critical worker as builder (prefer wood). Helpers for important buildings. Retry if rejected |
| **Placement** | Where to build | Houses in the back ring 4–8 tiles from the Town Hall. Storehouses at the cluster centroid. Military buildings toward the front, 6–10 tiles out. Towers at chokepoints and resource lines. Always leave a **1-tile gap** and run a **flood-fill check** so the AI never walls itself in |
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
| Worker, page 1 "Economy" | Q House, W Storehouse, E Farm, R Town Hall, A Watch Tower, S Wall, D Gate · Z Repair, X Stop, C **Military page →** |
| Worker, page 2 "Military" | Q Barracks, W Archery Range, E Stable, R Blacksmith, A Siege Workshop, S Castle · V **← Back** |
| Military units | Q Attack-move, W Stop, E Hold, R Aggressive · V Delete |
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
| Ctrl + 1..9 / 1..9 / double-tap | Assign / select / center a control group |
| `.` / `,` | Cycle idle workers / idle production buildings |
| H | Select the Town Hall and center on it |
| Space | Jump to the last alert |
| Arrow keys / screen edge / middle-drag | Pan the camera |
| Mouse wheel | Zoom |
| Esc | Cancel placement or targeting, then open the pause menu |
| F1 / F3 | How to play / debug overlay (dev) |
| + / − | Game speed (1×, 1.5×, 2×) |
| P / Pause | Pause |

### 7.12 Screens & flow
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

### 8.3 Starter maps
| Map | Size | Layout | Feel |
|---|---|---|---|
| **Green Valley** | 80×80 | Open grassland. Forests on the edges, 2 gold mines per side, 1 rich center gold mine (1500) | Beginner, open fights |
| **Twin Rivers** | 96×96 | A river runs across the diagonal, with 3 shallow fords (wide middle, narrow sides). Extra gold near the outer fords | Chokepoints, towers at fords |
| **Forest Pass** | 96×96 | Dense central forest with 2 passes and a long open route around the edge | Walls, gates, defense, cutting through wood |

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
| `src/data/game.json` | Global rules: starting resources, pop cap, **pace multipliers (fixed here for now)**, queue size, gathering reach and retarget radius |
| `src/data/units.json` | Every unit: stats, cost, train time, pop, model, icon, **interactions**, **panel**, **actions** |
| `src/data/buildings.json` | Every building: footprint, hp, pop provided, **dropSite**, cost, build time, model, icon, **panel**, **actions** |
| `src/data/resources.json` | Resource types (food, wood, gold) and resource **nodes** (tree, pine, berry bush, gold mine): resource, amount, model, icon, panel |
| `src/data/terrain.json` | Terrain rules (walkable, buildable, speed) |
| `src/data/palette.json` | All colors and team color sets |

All of them are validated at startup by `shared/gameData.ts` (zod). The check covers the shape and the **cross-references**: a train action naming an unknown unit, a gather target naming an unknown node, or a duplicate hotkey stops the game with a clear list of problems. `tests/shared/gameData.test.ts` covers this.

### 9.2 Interactions (what a unit can do with other entities)
Right-click sends one generic command, `interact {units, target}`. The engine looks up each unit's `interactions` to decide what to do with the target. Units that cannot do anything with it just walk next to it.

```jsonc
"worker": {
  "interactions": {
    "gather": {
      "carry": 10,
      "targets": { "tree": 0.4, "pine": 0.4, "berry_bush": 0.45, "gold_mine": 0.35 }  // node kind → rate per second
    }
    // later: "build": { … }, "repair": { … }, "attack": { … }
  }
}
```
- What resource a node gives comes from the node config, `resources.json` → `nodes.<kind>.resource`.
- Where it can be dropped off comes from the building config: `buildings.json` → `dropSite: ["food","wood","gold"]`.
- Every kind of work uses **one shared "interacting" animation** (a rhythmic lean), plus a carried bundle tinted by resource type. No per-resource animation code.

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
- **Panel fields** (`PANEL_FIELDS` in `shared/gameData.ts`): `hp`, `armor`, `speed`, `sight`, `carry`, `task`, `pop`, `queue`, `amount`.
- **Action types today:** `train`, `stop`, `setRally`. Coming next: `build` (M4), `research` (M6), plus attack-move and stance (M5).
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
- [x] Generic `interact` command; gather loop (to node → harvest → to drop site → repeat), auto-retarget, depletion unblocks tiles; deposit at a chosen drop site.
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

### M4: Construction & production (M)
- [ ] Placement ghost (translucent model + green/red tiles), foundations, multi-builder construction, repair, construction-stage models.
- [ ] House, Storehouse, Farm, Barracks, Militia, rally points.
- [ ] Selection panel, command grid with pages, hotkeys and tooltips (showing derived values).

**Done when:** the full Era I loop works from the UI using only the mouse, or only hotkeys.

### M5: Combat (M)
- [ ] Attack, attack-move, stances, targeting, leash.
- [ ] Melee, arcing arrows, attack and death animations, HP bars, hit flash and sparks.
- [ ] Town Hall arrows, Watch Tower, damage formula and bonuses.

**Done when:** the counter scenario tests pass (for example, 3 Militia beat 1 Knight) and fights are readable on screen.

### M6: Full content (L)
- [ ] Eras and all techs.
- [ ] Archery Range, Stable, Blacksmith, Siege Workshop, Castle; Archer, Scout Rider, Knight, Catapult.
- [ ] Wall drag along the grid axes with auto-joining wall models (posts, corners, T-joins); owner-only gates with 2 orientations.

**Done when:** everything in §2 is playable and data-driven.

### M7: Fog, victory, screens & pace setup (M)
- [ ] Visibility, explored areas, ghosts, the fog-of-war shader chunk, and the fog-filtered `PlayerView`.
- [ ] VictorySystem, surrender, MatchStats.
- [ ] Main Menu, **Match Setup (including pace presets and custom sliders)**, Loading, Pause, Settings, Result, How to Play (text).

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
- [ ] Final models and polish: Scout Rider, Catapult and every remaining building with stages; decor; effects (dust, sparks, fire, smoke); icons and portraits for everything; cursors; model viewer page.
- [ ] Graphics settings (shadows, render scale, pixel filter) tested on a low-end GPU.
- [ ] All sfx presets; music tracks (menu, 2 in-game loops, stingers).
- [ ] Illustrated How to Play, first-match tips, colorblind team colors.

**Done when:** no placeholder art remains, you have reviewed and approved the model viewer, and a new player can win an Easy match without help.

### M11: Maps, balance & release (M)
- [ ] Finish Green Valley, Twin Rivers and Forest Pass.
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
| Pace | Configurable later (presets plus Custom). **For now fixed in `src/data/game.json`; no setup UI** (2026-11-06) |
| Data-driven design | **Config first, no hard-coding** (2026-11-06): interactions, info panels, actions, train/build lists, costs and times all live in `src/data/*.json` (§9). One shared "interacting" animation for every unit |
| Priorities | Game logic and units first; map polish later (2026-11-06) |

### Current status (updated 2026-11-06)
| Milestone | State |
|---|---|
| M0 setup, M0.5 style preview, M1 maps, M2 units & movement | ✅ done and committed |
| M3 Economy (data-driven) | ✅ done and committed |
| **Next: M4 Construction** | not started |

**How to resume:**
1. `nvm use && npm install && npm run dev`, then open `/?army=50` to see the current state.
2. `npm run check` must stay green (typecheck, lint with module boundaries, map validation, tests).
3. Continue with the first unchecked milestone in §12.
4. After each milestone: tick its checklist, add implementation notes under it, update this table, commit.

**Agreed priorities (2026-11-06):** focus on game logic and units. Map polish (forest density, layout) can wait and is not worth time now.

**M4 plan in short (keep it config-first):**
1. New action type `build` in `shared/gameData.ts` (`{ "type": "build", "building": "<id>", "hotkey": "Q" }`) on the Worker, with command grid pages (Economy / Military) also described in config.
2. A `build` interaction on units (`interactions.build: { rate }`) so the engine knows who can construct and repair.
3. Command `build {units, building, at}`: validate the footprint (buildable, explored, free), pay the cost, place a foundation entity.
4. The order `construct`: builders walk to the foundation and add progress at `1 + 0.6·(n−1)` speed, using `buildTime` and `pace.buildSpeed`. Repair works the same way.
5. UI: placement ghost (translucent model + green/red tiles), construction-stage models, House / Storehouse / Farm / Barracks usable.
6. Farm as an infinite, walkable food node created by a building. Storehouse as a drop site (config only).
