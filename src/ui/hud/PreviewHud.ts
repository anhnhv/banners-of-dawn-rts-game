/**
 * Mock HUD for the style preview: shows the planned layout and look (resource bar, minimap,
 * selection panel, production queue, command grid). The numbers are static placeholders;
 * the real HUD is driven by the game state from M3/M4 on.
 */
import { iconImg, type IconName } from './pixelIcons';

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

function pill(icon: IconName, value: string): HTMLElement {
  const p = el('div', 'res-pill panel');
  p.append(iconImg(icon), el('span', '', value));
  return p;
}

function button(icon: IconName | null, hotkey: string, title: string): HTMLElement {
  const b = el('button', icon ? 'px-btn' : 'px-btn empty');
  b.type = 'button';
  b.title = title;
  if (icon) b.append(iconImg(icon));
  if (hotkey) b.append(el('span', 'hotkey', hotkey));
  return b;
}

export class PreviewHud {
  readonly root: HTMLElement;
  private readonly stats: HTMLElement;

  constructor(container: HTMLElement, minimap: HTMLCanvasElement) {
    this.root = el('div', 'hud');

    const resources = el('div', 'hud-resources');
    resources.append(pill('food', '200'), pill('wood', '150'), pill('gold', '100'), pill('pop', '14/20'));
    const era = el('div', 'res-pill panel res-era', 'Era I');
    resources.append(era);

    const map = el('div', 'hud-minimap panel');
    map.append(minimap);

    const menu = el('div', 'hud-menu');
    const menuBtn = el('button', 'px-btn small', '≡');
    menuBtn.type = 'button';
    menuBtn.title = 'Menu';
    menu.append(menuBtn);

    const bottom = el('div', 'hud-bottom panel');
    const portrait = el('div', 'sel-portrait');
    portrait.append(iconImg('sword'));

    const info = el('div', 'sel-info');
    const hp = el('div', 'hp-bar');
    const hpFill = el('div');
    hpFill.style.width = '100%';
    hp.append(hpFill);
    const queue = el('div', 'queue');
    for (let i = 0; i < 5; i++) {
      const slot = button(i < 2 ? 'spear' : null, '', i < 2 ? 'Militia (in queue)' : 'Empty slot');
      if (i === 0) {
        const progress = el('div', 'progress');
        progress.append(el('div'));
        slot.append(progress);
      }
      queue.append(slot);
    }
    info.append(
      el('div', 'sel-name', 'Barracks'),
      hp,
      el('div', 'sel-stats', 'HP 1000/1000  ·  Training Militia 9s  ·  Rally: Town Hall'),
      queue,
    );

    const grid = el('div', 'cmd-grid');
    grid.append(
      button('spear', 'Q', 'Train Militia (35 food, 20 wood)'),
      button(null, 'W', ''),
      button(null, 'E', ''),
      button(null, 'R', ''),
      button('flag', 'Z', 'Set rally point'),
      button('hammer', 'X', 'Repair'),
      button(null, 'C', ''),
      button(null, 'V', ''),
    );
    bottom.append(portrait, info, grid);

    this.stats = el('div', 'hud-tag panel');
    this.root.append(resources, map, menu, bottom, this.stats);
    container.append(this.root);
    this.setStats(null, 0, 0);
  }

  setStats(fps: number | null, drawCalls: number, triangles: number): void {
    const perf =
      fps === null ? '' : `${fps} fps · ${drawCalls} draw calls · ${Math.round(triangles / 1000)}k tris`;
    this.stats.innerHTML =
      `<b>STYLE PREVIEW</b> (not gameplay yet)<br>` +
      `Arrows / edge / middle-drag: pan · Wheel: zoom · 1 2 3: views<br>` +
      perf;
  }
}
