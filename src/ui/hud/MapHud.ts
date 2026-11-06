/**
 * HUD for the map view (M1): interactive minimap, map info, the tile under the cursor,
 * controls help and performance numbers. Grows into the full game HUD in M3/M4.
 */
import type { DecodedMap, MapObject, TerrainType } from '../../shared';
import resourceData from '../../data/resources.json';
import terrainData from '../../data/terrain.json';
import type { Minimap } from './Minimap';

const RESOURCE_INFO: Record<string, { name: string; resource: string; amount: number }> = resourceData.nodes;
const TERRAIN_INFO: Record<TerrainType, { name: string; passable: boolean; buildable: boolean }> =
  terrainData.types;

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

export class MapHud {
  readonly root: HTMLElement;
  private readonly hover: HTMLElement;
  private readonly perf: HTMLElement;

  constructor(container: HTMLElement, map: DecodedMap, minimap: Minimap, warnings: readonly string[]) {
    this.root = el('div', 'hud');

    const mapPanel = el('div', 'hud-minimap-live panel');
    mapPanel.append(minimap.element);

    const info = el('div', 'hud-info panel');
    info.append(
      el('div', 'info-title', map.name),
      el('div', 'info-line', `${map.width} × ${map.height} tiles · ${map.description}`),
      el('div', 'info-line info-teams', 'You: blue base (bottom) · Machine: red base (top)'),
    );
    this.hover = el('div', 'info-hover', 'Hover the map to inspect a tile');
    info.append(this.hover);
    if (warnings.length > 0) {
      info.append(el('div', 'info-warn', `${warnings.length} map warning(s), see the console`));
      warnings.forEach((w) => console.warn(`[map] ${w}`));
    }

    const help = el('div', 'hud-help panel');
    help.append(
      el('div', '', 'Arrows / screen edge / middle-drag: pan'),
      el('div', '', 'Mouse wheel: zoom · Minimap: click or drag'),
    );
    this.perf = el('div', 'help-perf', '');
    help.append(this.perf);

    this.root.append(mapPanel, info, help);
    container.append(this.root);
  }

  showTile(x: number, y: number, terrain: TerrainType | null, object: MapObject | null): void {
    if (terrain === null) {
      this.hover.textContent = 'Outside the map';
      return;
    }
    const t = TERRAIN_INFO[terrain];
    const flags = [t.passable ? 'walkable' : 'blocked', t.buildable ? 'buildable' : null]
      .filter(Boolean)
      .join(', ');
    let text = `Tile ${x}, ${y} · ${t.name} (${flags})`;
    if (object) text += ` · ${describe(object)}`;
    this.hover.textContent = text;
  }

  clearTile(): void {
    this.hover.textContent = 'Hover the map to inspect a tile';
  }

  setPerf(fps: number, drawCalls: number, triangles: number): void {
    this.perf.textContent = `${fps} fps · ${drawCalls} draw calls · ${Math.round(triangles / 1000)}k tris`;
  }
}

function describe(o: MapObject): string {
  if (o.kind === 'spawn')
    return o.player === 1 ? 'Machine player start (Town Hall)' : 'Your start (Town Hall)';
  if (o.kind === 'stone') return 'Boulder';
  const info = RESOURCE_INFO[o.kind];
  if (!info) return o.kind;
  return `${info.name}: ${o.amount ?? info.amount} ${info.resource}`;
}
