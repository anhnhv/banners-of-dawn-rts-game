/**
 * In-game HUD (PLAN §7.6), generated from the game data:
 *  - the selection panel shows the fields listed in the entity's `panel` config;
 *  - the command grid shows the entity's `actions`, each at the slot of its hotkey;
 *  - train buttons take icon, cost and time from the trained unit's config.
 * Also: resource bar with population, idle-worker button, message log, tile hover line.
 */
import {
  costEntries,
  type ActionDef,
  type BuildingView,
  type Command,
  type DecodedMap,
  type EntityId,
  type MapObject,
  type PanelField,
  type PlayerView,
  type ResourceView,
  type TerrainType,
  type UnitView,
} from '../../shared';
import terrainData from '../../data/terrain.json';
import { DATA, displayName } from '../data';
import { iconFor, iconImg, type IconName } from './pixelIcons';
import type { Minimap } from './Minimap';

const TERRAIN_INFO: Record<TerrainType, { name: string; passable: boolean; buildable: boolean }> =
  terrainData.types;
const GRID_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V'];
const MESSAGE_SECONDS = 4;

export type Selected =
  | { kind: 'units'; units: UnitView[]; own: boolean }
  | { kind: 'building'; building: BuildingView; own: boolean }
  | { kind: 'resource'; resource: ResourceView }
  | null;

export interface HudCallbacks {
  onCommand(cmd: Command): void;
  onSelectIdleWorker(): void;
  onBeginRally(building: EntityId): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Resolve the current selection against the view. */
export function resolveSelection(view: PlayerView, ids: ReadonlySet<EntityId>): Selected {
  if (ids.size === 0) return null;
  const units = view.units.filter((u) => ids.has(u.id));
  if (units.length > 0) return { kind: 'units', units, own: units.every((u) => u.owner === view.player) };
  const building = view.buildings.find((b) => ids.has(b.id));
  if (building) return { kind: 'building', building, own: building.owner === view.player };
  for (const id of ids) {
    const r = view.resources.get(id);
    if (r) return { kind: 'resource', resource: r };
  }
  return null;
}

export class GameHud {
  readonly root: HTMLElement;
  private readonly res: Record<'food' | 'wood' | 'gold' | 'pop', HTMLSpanElement>;
  private readonly idleBtn: HTMLButtonElement;
  private readonly idleCount: HTMLSpanElement;
  private readonly messages: HTMLElement;
  private readonly hover: HTMLElement;
  private readonly perf: HTMLElement;
  private readonly portrait: HTMLElement;
  private readonly info: HTMLElement;
  private readonly grid: HTMLElement;
  private signature = '';
  /** Elements updated every frame without a rebuild. */
  private live: Array<(view: PlayerView, sel: Selected) => void> = [];
  private actions: Array<{ key: string; run: () => void; enabled: () => boolean }> = [];

  constructor(
    container: HTMLElement,
    map: DecodedMap,
    minimap: Minimap,
    warnings: readonly string[],
    private readonly cb: HudCallbacks,
  ) {
    this.root = el('div', 'hud');

    // resource bar
    const bar = el('div', 'hud-resources');
    const pill = (icon: IconName): HTMLSpanElement => {
      const p = el('div', 'res-pill panel');
      const value = el('span', '', '0');
      p.append(iconImg(icon), value);
      bar.append(p);
      return value;
    };
    this.res = { food: pill('food'), wood: pill('wood'), gold: pill('gold'), pop: pill('pop') };

    const mapPanel = el('div', 'hud-minimap-live panel');
    mapPanel.append(minimap.element);

    this.idleBtn = el('button', 'px-btn hud-idle');
    this.idleBtn.type = 'button';
    this.idleBtn.title = 'Select an idle worker (.)';
    this.idleCount = el('span', 'idle-count', '0');
    this.idleBtn.append(iconImg('worker'), this.idleCount);
    this.idleBtn.addEventListener('click', () => this.cb.onSelectIdleWorker());

    this.messages = el('div', 'hud-messages');

    const help = el('div', 'hud-help panel');
    help.append(
      el('div', '', `${map.name} · Right click: move / gather / rally`),
      el('div', '', 'Click / drag: select · Double click: same type · Ctrl/Alt+1-9: group'),
      el('div', '', 'Arrows / edge / middle-drag: pan · Wheel: zoom · .: idle worker'),
    );
    this.perf = el('div', 'help-perf', '');
    help.append(this.perf);
    if (warnings.length > 0) warnings.forEach((w) => console.warn(`[map] ${w}`));

    this.hover = el('div', 'hud-hover panel', '');

    const bottom = el('div', 'hud-bottom panel');
    this.portrait = el('div', 'sel-portrait');
    this.info = el('div', 'sel-info');
    this.grid = el('div', 'cmd-grid');
    bottom.append(this.portrait, this.info, this.grid);

    this.root.append(bar, mapPanel, this.idleBtn, this.messages, help, this.hover, bottom);
    container.append(this.root);
  }

  /** Called every frame. Rebuilds panel and grid only when the selection or its state changed. */
  update(view: PlayerView, selected: ReadonlySet<EntityId>): void {
    const self = view.self;
    this.res.food.textContent = String(self.resources.food);
    this.res.wood.textContent = String(self.resources.wood);
    this.res.gold.textContent = String(self.resources.gold);
    this.res.pop.textContent = `${self.pop}/${self.popCap}`;
    this.res.pop.classList.toggle('capped', self.pop >= self.popCap);

    const idle = view.units.filter((u) => u.owner === view.player && isWorker(u) && !u.hasOrders).length;
    this.idleCount.textContent = String(idle);
    this.idleBtn.classList.toggle('empty', idle === 0);

    const sel = resolveSelection(view, selected);
    const sig = signature(view, sel);
    if (sig !== this.signature) {
      this.signature = sig;
      this.rebuild(view, sel);
    }
    for (const fn of this.live) fn(view, sel);

    const now = performance.now();
    for (const m of [...this.messages.children] as HTMLElement[]) {
      if (now - Number(m.dataset.time) > MESSAGE_SECONDS * 1000) m.remove();
    }
  }

  /** Command hotkeys of the current selection. Returns true if the key was used. */
  handleKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.altKey || e.metaKey) return false;
    const m = /^Key([A-Z])$/.exec(e.code);
    if (!m) return false;
    const action = this.actions.find((a) => a.key === m[1]);
    if (!action) return false;
    if (action.enabled()) action.run();
    return true;
  }

  message(text: string, kind: 'info' | 'warn' = 'info'): void {
    const m = el('div', `hud-message ${kind}`, text);
    m.dataset.time = String(performance.now());
    this.messages.append(m);
    while (this.messages.children.length > 5) this.messages.firstElementChild?.remove();
  }

  showTile(x: number, y: number, terrain: TerrainType | null, object: MapObject | null): void {
    if (terrain === null) {
      this.hover.textContent = '';
      this.hover.style.display = 'none';
      return;
    }
    const t = TERRAIN_INFO[terrain];
    let text = `${x}, ${y} · ${t.name}`;
    if (object && object.kind !== 'spawn')
      text += ` · ${object.kind === 'stone' ? 'Boulder' : displayName(object.kind)}`;
    this.hover.textContent = text;
    this.hover.style.display = 'block';
  }

  clearTile(): void {
    this.hover.style.display = 'none';
  }

  setPerf(fps: number, drawCalls: number, triangles: number): void {
    this.perf.textContent = `${fps} fps · ${drawCalls} draw calls · ${Math.round(triangles / 1000)}k tris`;
  }

  // ---- panel + grid -------------------------------------------------------------------------------

  private rebuild(view: PlayerView, sel: Selected): void {
    this.portrait.replaceChildren();
    this.info.replaceChildren();
    this.grid.replaceChildren();
    this.live = [];
    this.actions = [];
    if (!sel) {
      this.info.append(el('div', 'sel-hint', 'Select a unit or building'));
      this.fillGrid([]);
      return;
    }

    if (sel.kind === 'units' && sel.units.length > 1) {
      this.portrait.append(iconImg(iconFor(DATA.units[sel.units[0]?.type ?? '']?.icon ?? '')));
      this.multiUnitPanel(sel.units);
    } else if (sel.kind === 'units') {
      const u = sel.units[0] as UnitView;
      const def = DATA.units[u.type];
      this.portrait.append(iconImg(iconFor(def?.icon ?? '')));
      this.header(def?.name ?? u.type, sel.own ? '' : 'Enemy');
      this.fields(def?.panel ?? [], view, (v) => resolveUnit(v, u.id));
    } else if (sel.kind === 'building') {
      const b = sel.building;
      const def = DATA.buildings[b.type];
      this.portrait.append(iconImg(iconFor(def?.icon ?? '')));
      this.header(def?.name ?? b.type, sel.own ? '' : 'Enemy');
      this.fields(def?.panel ?? [], view, (v) => v.buildings.find((x) => x.id === b.id) ?? null);
    } else {
      const r = sel.resource;
      const def = DATA.nodes[r.kind];
      this.portrait.append(iconImg(iconFor(def?.icon ?? '')));
      this.header(def?.name ?? r.kind, def?.description ?? '');
      this.fields(def?.panel ?? [], view, (v) => v.resources.get(r.id) ?? null);
    }

    const actions =
      sel.kind === 'units' && sel.own
        ? commonUnitActions(sel.units)
        : sel.kind === 'building' && sel.own
          ? (DATA.buildings[sel.building.type]?.actions ?? [])
          : [];
    this.fillGrid(actions.map((a) => this.actionButton(a, view, sel)));
  }

  private header(name: string, sub: string): void {
    const h = el('div', 'sel-name', name);
    if (sub) h.append(el('span', sub === 'Enemy' ? 'sel-sub enemy' : 'sel-sub', ` ${sub}`));
    this.info.append(h);
  }

  private multiUnitPanel(units: UnitView[]): void {
    const counts = new Map<string, number>();
    for (const u of units) counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
    this.header(`${units.length} units`, '');
    const grid = el('div', 'unit-grid');
    for (const [type, n] of counts) {
      const cell = el('div', 'unit-cell');
      cell.title = displayName(type);
      cell.append(iconImg(iconFor(DATA.units[type]?.icon ?? '')), el('span', '', `×${n}`));
      grid.append(cell);
    }
    this.info.append(grid);
  }

  /** Render the configured panel fields; values refresh every frame through `live`. */
  private fields(
    fields: readonly PanelField[],
    view: PlayerView,
    current: (v: PlayerView) => UnitView | BuildingView | ResourceView | null,
  ): void {
    const stats = el('div', 'sel-stats');
    this.info.append(stats);
    for (const f of fields) {
      if (f === 'hp') {
        const bar = el('div', 'hp-bar');
        const fill = el('div');
        bar.append(fill);
        const label = el('span', 'stat', '');
        this.info.insertBefore(bar, stats);
        stats.append(label);
        this.live.push((v) => {
          const e = current(v);
          if (!e || !('hp' in e)) return;
          fill.style.width = `${(100 * e.hp) / e.maxHp}%`;
          label.textContent = `HP ${Math.ceil(e.hp)}/${e.maxHp}`;
        });
      } else if (f === 'queue') {
        const row = el('div', 'queue');
        this.info.append(row);
        const b = current(view);
        if (b && 'queue' in b) this.queueRow(row, view, b);
      } else {
        const span = el('span', 'stat', '');
        stats.append(span);
        this.live.push((v) => {
          const e = current(v);
          span.textContent = e ? fieldText(f, e, v) : '';
        });
      }
    }
  }

  private queueRow(row: HTMLElement, view: PlayerView, b: BuildingView): void {
    const max = DATA.game.production.queueMax;
    for (let i = 0; i < max; i++) {
      const item = b.queue[i];
      const slot = el('button', item ? 'px-btn' : 'px-btn empty');
      slot.type = 'button';
      if (item) {
        slot.title = `${displayName(item.unit)}: click to cancel (full refund)`;
        slot.append(iconImg(iconFor(DATA.units[item.unit]?.icon ?? '')));
        slot.addEventListener('click', () =>
          this.cb.onCommand({ type: 'cancelTrain', building: b.id, index: i }),
        );
        if (i === 0) {
          const progress = el('div', 'progress');
          const fill = el('div');
          progress.append(fill);
          slot.append(progress);
          this.live.push((v) => {
            const now = v.buildings.find((x) => x.id === b.id)?.queue[0];
            fill.style.width = `${Math.round((now?.progress ?? 0) * 100)}%`;
          });
        }
      }
      row.append(slot);
    }
    if (b.popBlocked) row.append(el('span', 'queue-warn', 'Need more houses'));
    void view;
  }

  private actionButton(
    a: ActionDef,
    view: PlayerView,
    sel: Selected,
  ): { key: string; button: HTMLButtonElement } {
    const button = el('button', 'px-btn');
    button.type = 'button';
    let run: () => void = () => {};
    let enabled: () => boolean = () => true;
    if (a.type === 'train' && sel?.kind === 'building') {
      const def = DATA.units[a.unit];
      const cost = costEntries(def?.cost ?? {});
      const costText = cost.map(([r, n]) => `${n} ${r}`).join(', ');
      button.title = `Train ${def?.name ?? a.unit} (${a.hotkey})\n${costText} · ${def?.trainTime ?? 0}s\n${def?.description ?? ''}`;
      button.append(iconImg(iconFor(def?.icon ?? '')));
      const building = sel.building.id;
      enabled = () =>
        cost.every(([r, n]) => view.self.resources[r] >= n) &&
        (resolveBuilding(view, building)?.queue.length ?? 0) < DATA.game.production.queueMax;
      run = () => this.cb.onCommand({ type: 'train', building, unit: a.unit });
      if (!enabled()) button.classList.add('disabled');
    } else if (a.type === 'stop' && sel?.kind === 'units') {
      button.title = `Stop (${a.hotkey})`;
      button.append(iconImg('stop'));
      const ids = sel.units.map((u) => u.id);
      run = () => this.cb.onCommand({ type: 'stop', units: ids });
    } else if (a.type === 'setRally' && sel?.kind === 'building') {
      button.title = `Set rally point (${a.hotkey})\nThen click the ground or a resource.`;
      button.append(iconImg('flag'));
      const building = sel.building.id;
      run = () => this.cb.onBeginRally(building);
    }
    button.append(el('span', 'hotkey', a.hotkey));
    button.addEventListener('click', () => {
      if (enabled()) run();
    });
    this.actions.push({ key: a.hotkey, run, enabled });
    return { key: a.hotkey, button };
  }

  private fillGrid(buttons: Array<{ key: string; button: HTMLButtonElement }>): void {
    for (const key of GRID_KEYS) {
      const found = buttons.find((b) => b.key === key);
      if (found) {
        this.grid.append(found.button);
      } else {
        const empty = el('div', 'px-btn empty');
        this.grid.append(empty);
      }
    }
  }
}

// ---- helpers ------------------------------------------------------------------------------------

function isWorker(u: UnitView): boolean {
  return !!DATA.units[u.type]?.interactions.gather;
}

function resolveUnit(view: PlayerView, id: EntityId): UnitView | null {
  return view.units.find((u) => u.id === id) ?? null;
}

function resolveBuilding(view: PlayerView, id: EntityId): BuildingView | null {
  return view.buildings.find((b) => b.id === id) ?? null;
}

/** Actions shared by every selected unit type (same type and hotkey). */
function commonUnitActions(units: UnitView[]): ActionDef[] {
  const types = [...new Set(units.map((u) => u.type))];
  const first = DATA.units[types[0] ?? '']?.actions ?? [];
  return first.filter((a) =>
    types.every((t) => DATA.units[t]?.actions.some((b) => b.type === a.type && b.hotkey === a.hotkey)),
  );
}

function fieldText(f: PanelField, e: UnitView | BuildingView | ResourceView, view: PlayerView): string {
  if ('amount' in e && 'resource' in e) {
    if (f === 'amount') return `${DATA.resources[e.resource].name} left: ${e.amount}`;
    return '';
  }
  if ('task' in e) {
    const def = DATA.units[e.type];
    switch (f) {
      case 'armor':
        return `Armor ${def?.armor ?? 0}`;
      case 'speed':
        return `Speed ${def?.speed ?? 0}`;
      case 'sight':
        return `Sight ${def?.sight ?? 0}`;
      case 'carry': {
        const cap = def?.interactions.gather?.carry ?? 0;
        return e.carry ? `Carrying ${e.carry.amount}/${cap} ${e.carry.resource}` : `Carries ${cap}`;
      }
      case 'task':
        return e.task;
      default:
        return '';
    }
  }
  const def = DATA.buildings[e.type];
  switch (f) {
    case 'armor':
      return `Armor ${def?.armor ?? 0}`;
    case 'pop':
      return `Population ${view.self.pop}/${view.self.popCap} (+${def?.popProvided ?? 0} here)`;
    default:
      return '';
  }
}

/** Changes whenever the panel/grid needs a rebuild (selection, queue length, affordability, …). */
function signature(view: PlayerView, sel: Selected): string {
  if (!sel) return 'none';
  if (sel.kind === 'units') return `u:${sel.units.map((u) => u.id).join(',')}`;
  if (sel.kind === 'resource') return `r:${sel.resource.id}`;
  const b = sel.building;
  const afford = (DATA.buildings[b.type]?.actions ?? [])
    .map((a) =>
      a.type === 'train'
        ? costEntries(DATA.units[a.unit]?.cost ?? {}).every(([r, n]) => view.self.resources[r] >= n)
          ? 1
          : 0
        : 1,
    )
    .join('');
  return `b:${b.id}:${b.queue.map((q) => q.unit).join(',')}:${b.popBlocked}:${afford}`;
}
