# Banners of Dawn

3D voxel-style (low-poly with pixel textures) 1v1 real-time strategy game in the browser, played against a local
machine player. The full design is in [PLAN.md](PLAN.md).

`npm run dev` opens the **Main Menu**: Play → Match Setup (map, opponent Easy / Normal / Idle, ready-made battle or
standard start, pace, game speed), Quick start, Settings and How to Play. In a match, `Esc` opens the pause menu
(speed, settings, restart, surrender, quit), `P` pauses and `+` / `-` change the speed. Three maps: Green Valley,
Twin Rivers and Forest Pass. Everything is driven by the JSON in `src/data/` (see PLAN.md §9).

URL shortcuts (they skip the menu): `/?play` (last setup), `/?map=twin_rivers`, `/?ai=normal|easy|off`,
`/?setup=standard|scenario`, `/?pace=relaxed|standard|fast|blitz`, `/?speed=2`, `/?army=50&enemy=20` (test units).
`/?models` shows every model and HUD icon; `/?hud` is the HUD gallery (3D models, icons, buttons and bars of units,
buildings, construction, terrain, map objects and resources, one section at a time, e.g. `/?hud#terrain`);
`?art=<id>` draws any page with another art collection (see below); `/?preview` is the style-preview diorama (keys `1` `2` `3` switch views).
Screenshots: [docs/preview/](docs/preview/) and [docs/milestones/](docs/milestones/).

## Art collections

All drawing data (palette, HUD icons, every voxel model) lives in [src/ui/art/collections/](src/ui/art/collections/).
`classic/` defines everything; another collection only lists what it changes and takes the rest from
classic ([autumn.ts](src/ui/art/collections/autumn.ts) is a small example). To make one, copy `autumn.ts`, then add it to
`ART_COLLECTIONS` in `collections/index.ts`. Review it in `/?hud` (switch at the top of the sidebar, or `,` / `.`)
and play with it via `?art=<id>`.

## Setup

```bash
nvm install        # reads .nvmrc → Node 24 LTS
nvm use
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Script                  | What it does                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run dev`           | Dev server with hot reload                                             |
| `npm run build`         | Typecheck, then production build into `dist/`                          |
| `npm run preview`       | Serve the production build                                             |
| `npm run typecheck`     | Type-check every module with its own `tsconfig` (engine/AI get no DOM) |
| `npm run lint`          | ESLint, including the architecture rules                               |
| `npm test`              | Vitest                                                                 |
| `npm run check`         | typecheck + lint + validate-maps + test                                |
| `npm run validate-maps` | Validate every map in `maps/` (playable, fair, symmetric)              |
| `npm run maps:generate` | Regenerate every map in `maps/` from its generator in `tools/maps/`    |
| `npm run format`        | Prettier                                                               |

## Module layout

| Folder        | Module                                              | May import                   |
| ------------- | --------------------------------------------------- | ---------------------------- |
| `src/shared/` | Contracts shared by everyone                        | nothing                      |
| `src/engine/` | Deterministic simulation on a square grid           | shared, data                 |
| `src/ai/`     | Machine player (local, rule-based, in a Web Worker) | shared                       |
| `src/ui/`     | 3D voxel rendering (three.js), HUD, input, audio    | shared, data                 |
| `src/host/`   | Glue: game loop, wiring engine + UI + AI            | shared, engine, ai, ui, data |
| `src/data/`   | Balance data (JSON)                                 | —                            |
| `maps/`       | Map files (JSON)                                    | —                            |
| `assets/`     | Audio presets / music data                          | —                            |

These rules are enforced by `eslint.config.js`, and `tests/lint/architecture.test.ts` proves it.
The machine player and the engine **cannot use any network API**: no external AI, no third-party
services (PLAN §6.2). The page's Content Security Policy also limits connections to its own origin.
