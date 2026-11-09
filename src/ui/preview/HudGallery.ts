/**
 * HUD GALLERY (`/?hud`): the pictures of everything the game is built from, one collection at a
 * time, straight from the game data: units and buildings (3D model in both team colors, HUD
 * portrait, command buttons), construction, terrain, map objects and resource icons.
 * No text: the names and numbers are fixed, so only the art is shown (hover a tile for its name).
 * Switch sections with the sidebar, `1`-`9` or `[` / `]` (the hash keeps it: `/?hud#units`), and
 * the art collection (src/ui/art/collections) with the buttons on top or `,` / `.`
 * (`/?hud&art=autumn#terrain`).
 * Nothing here talks to the engine.
 */
import * as THREE from 'three';
import type { ActionDef, TerrainType } from '../../shared';
import terrainData from '../../data/terrain.json';
import {
  buildingGeometry,
  buildingModel,
  buildUnit,
  constructionCoreGeometry,
  constructionSiteGeometry,
  meshFrom,
  rockGeometry,
  rubbleGeometry,
  treeGeometry,
  unitModel,
  type BuildingModel,
  type TreeModel,
} from '../art/models';
import { ART_COLLECTIONS, artId, setArtCollection } from '../art/collections';
import { TEAMS } from '../art/palette';
import { DATA } from '../data';
import { iconFor, iconImg, type IconName } from '../hud/pixelIcons';
import { Thumbnailer } from './thumbnails';
import './gallery.css';

const SITE_HEIGHT = 1.1;

/** One page of the gallery (units, buildings, …). */
interface Section {
  id: string;
  name: string;
  render(shots: Thumbnailer): HTMLElement[];
}

function div(className: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  return d;
}

function picture(url: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'gallery-model';
  img.src = url;
  img.alt = '';
  img.draggable = false;
  return img;
}

/** The icon a command button shows (the same choice as the in-game command grid). */
function actionIcon(a: ActionDef): IconName {
  switch (a.type) {
    case 'train':
      return iconFor(DATA.units[a.unit]?.icon ?? '');
    case 'stop':
      return 'stop';
    case 'setRally':
      return 'flag';
    case 'attackMove':
      return 'sword';
    case 'stance':
      return a.stance === 'hold' ? 'shield' : 'spear';
  }
}

function tile(name: string, ...parts: HTMLElement[]): HTMLElement {
  const t = div('gallery-tile');
  t.title = name;
  t.append(...parts);
  return t;
}

function portrait(icon: string): HTMLElement {
  const p = div('sel-portrait');
  p.append(iconImg(iconFor(icon)));
  return p;
}

function buttons(actions: readonly ActionDef[]): HTMLElement {
  const grid = div('gallery-buttons');
  for (const a of actions) {
    const b = div('px-btn');
    b.append(iconImg(actionIcon(a)));
    grid.append(b);
  }
  return grid;
}

function bars(steps: number[]): HTMLElement {
  const column = div('gallery-bars');
  column.append(...steps.map(bar));
  return column;
}

function bar(progress: number): HTMLElement {
  const b = div('hp-bar build-bar');
  const fill = div('');
  fill.style.width = `${progress * 100}%`;
  b.append(fill);
  return b;
}

/** Trees drawn for each node model (mapScene picks one of these per tile). */
const TREES: Record<string, TreeModel[]> = { tree: ['oak', 'oakTall'], pine: ['pine', 'pineSmall'] };

function constructionSite(w: number, h: number): THREE.Object3D {
  const group = new THREE.Group();
  const core = meshFrom(constructionCoreGeometry(w, h));
  core.position.y = 0.08;
  group.add(meshFrom(constructionSiteGeometry(w, h, SITE_HEIGHT)), core);
  return group;
}

const SECTIONS: Section[] = [
  {
    id: 'units',
    name: 'Units',
    render: (shots) =>
      Object.values(DATA.units).map((u) =>
        tile(
          u.name,
          ...TEAMS.map((team) => picture(shots.shot(buildUnit(unitModel(u.model), team).group))),
          portrait(u.icon),
          buttons(u.actions),
        ),
      ),
  },
  {
    id: 'buildings',
    name: 'Buildings',
    render: (shots) =>
      Object.values(DATA.buildings).map((b) => {
        const model = buildingModel(b.model);
        const models = model
          ? TEAMS.map((team) => picture(shots.shotGeometry(buildingGeometry(model, team))))
          : [];
        return tile(b.name, ...models, portrait(b.icon), buttons(b.actions));
      }),
  },
  {
    id: 'construction',
    name: 'Construction',
    render: (shots) => {
      const sizes = [...new Set(Object.values(DATA.buildings).map((b) => b.footprint.join('x')))];
      return [
        ...sizes.map((size) => {
          const [w = 1, h = 1] = size.split('x').map(Number);
          return tile(`Construction site ${size}`, picture(shots.shot(constructionSite(w, h))));
        }),
        tile('Rubble', picture(shots.shotGeometry(rubbleGeometry(3, 3)))),
        tile('Progress 0-100%', bars([0, 0.25, 0.5, 0.75, 1])),
      ];
    },
  },
  {
    id: 'terrain',
    name: 'Terrain',
    render: (shots) =>
      (Object.keys(terrainData.types) as TerrainType[]).map((t) =>
        tile(terrainData.types[t].name, picture(shots.shotTerrain(t))),
      ),
  },
  {
    id: 'map-objects',
    name: 'Map objects',
    render: (shots) => [
      ...Object.values(DATA.nodes).flatMap((n) => {
        const trees = TREES[n.model];
        if (trees) return trees.map((m) => tile(n.name, picture(shots.shotGeometry(treeGeometry(m)))));
        const model = buildingModel(n.model);
        return model
          ? [tile(n.name, picture(shots.shotGeometry(buildingGeometry(model as BuildingModel, 'blue'))))]
          : [];
      }),
      tile('Boulder', picture(shots.shotGeometry(rockGeometry()))),
    ],
  },
  {
    id: 'resources',
    name: 'Resources',
    render: () => [
      ...Object.values(DATA.resources).map((r) => tile(r.name, portrait(r.icon))),
      tile('Population', portrait('pop')),
      ...Object.values(DATA.nodes).map((n) => tile(n.name, portrait(n.icon))),
    ],
  },
];

export class HudGallery {
  private readonly root: HTMLElement;
  private readonly artNav: HTMLElement;
  private readonly nav: HTMLElement;
  private readonly list: HTMLElement;
  private current = SECTIONS[0]?.id ?? '';
  private shots: Thumbnailer | null = null;
  /** Rendered tiles by `art:section`. */
  private readonly cache = new Map<string, HTMLElement[]>();

  constructor(container: HTMLElement) {
    this.root = div('gallery');
    const side = div('gallery-side');
    this.artNav = div('gallery-art');
    this.nav = div('gallery-nav');
    side.append(this.artNav, this.nav);
    const main = div('gallery-main hud');
    this.list = div('gallery-list');
    main.append(this.list);
    this.root.append(side, main);
    container.append(this.root);
    window.addEventListener('hashchange', () => this.show(window.location.hash.slice(1)));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  start(): void {
    this.show(window.location.hash.slice(1));
  }

  /** Switch the art collection (kept in the URL as `?hud&art=<id>`) and redraw. */
  private setArt(id: string): void {
    const now = setArtCollection(id);
    const query = now === 'classic' ? '?hud' : `?hud&art=${encodeURIComponent(now)}`;
    window.history.replaceState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
    this.show(this.current);
  }

  private show(id: string): void {
    const section = SECTIONS.find((c) => c.id === id) ?? SECTIONS.find((c) => c.id === this.current);
    if (!section) return;
    this.current = section.id;
    const button = (name: string, current: boolean, onClick: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = current ? 'gallery-nav-btn current' : 'gallery-nav-btn';
      b.textContent = name;
      b.addEventListener('click', onClick);
      return b;
    };
    this.artNav.replaceChildren(
      ...ART_COLLECTIONS.map((c) => button(c.name, c.id === artId(), () => this.setArt(c.id))),
    );
    this.nav.replaceChildren(
      ...SECTIONS.map((c) => button(c.name, c.id === this.current, () => (window.location.hash = c.id))),
    );
    const key = `${artId()}:${section.id}`;
    let tiles = this.cache.get(key);
    if (!tiles) {
      this.shots ??= new Thumbnailer();
      tiles = section.render(this.shots);
      this.cache.set(key, tiles);
    }
    this.list.replaceChildren(...tiles);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const at = SECTIONS.findIndex((c) => c.id === this.current);
    let next: Section | undefined;
    if (e.key === ']') next = SECTIONS[(at + 1) % SECTIONS.length];
    else if (e.key === '[') next = SECTIONS[(at + SECTIONS.length - 1) % SECTIONS.length];
    else if (/^Digit[1-9]$/.test(e.code)) next = SECTIONS[Number(e.code.slice(5)) - 1];
    if (next) window.location.hash = next.id;
    // , and . cycle the art collection
    if (e.key === ',' || e.key === '.') {
      const a = ART_COLLECTIONS.findIndex((c) => c.id === artId());
      const n = ART_COLLECTIONS.length;
      const art = ART_COLLECTIONS[(a + (e.key === '.' ? 1 : n - 1)) % n];
      if (art) this.setArt(art.id);
    }
  }
}
