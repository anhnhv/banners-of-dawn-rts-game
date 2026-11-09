/**
 * Pixel-art HUD icons of the active art collection (collections/*: character grids, one char =
 * one pixel). They are rasterised to tiny PNG data URLs and scaled up in CSS with
 * `image-rendering: pixelated`.
 */
import { art, artId, type IconName } from '../art/collections';

export type { IconName };

/** Data URLs by `collection:icon`. */
const cache = new Map<string, string>();

/** Every icon, in the order they are defined (model viewer). */
export function iconNames(): IconName[] {
  return Object.keys(art().icons) as IconName[];
}

/** Icon for a config icon name (falls back to a generic person icon). */
export function iconFor(name: string): IconName {
  return name in art().icons ? (name as IconName) : 'pop';
}

/** PNG data URL for an icon (native size; scale it up in CSS). */
export function iconUrl(name: IconName): string {
  const key = `${artId()}:${name}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { icons, iconInk } = art();
  const rows = icons[name] ?? icons.pop;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = iconInk[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function iconImg(name: IconName, className = 'px-icon'): HTMLImageElement {
  const img = document.createElement('img');
  img.src = iconUrl(name);
  img.className = className;
  img.alt = '';
  img.draggable = false;
  return img;
}
