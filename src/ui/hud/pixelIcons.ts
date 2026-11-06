/**
 * Pixel-art HUD icons, authored as character grids (one char = one pixel).
 * They are rasterised to tiny PNG data URLs and scaled up in CSS with `image-rendering: pixelated`.
 */
const INK: Record<string, string> = {
  k: '#14111c',
  w: '#ffffff',
  r: '#d9413a',
  R: '#ff8f7a',
  d: '#8a1f22',
  g: '#4a8f3c',
  b: '#8a5a32',
  B: '#b98552',
  n: '#5a3820',
  y: '#f6c945',
  Y: '#fff0a0',
  o: '#c48f22',
  s: '#f1c39a',
  t: '#3d6fe0',
  T: '#7fb6ff',
  i: '#d9dee5',
  I: '#8a929e',
  h: '#d9a95a',
  p: '#b4553a',
  e: '#4a8f3c',
  E: '#7ab84c',
  x: '#6f6b78',
  X: '#d6d3db',
};

export type IconName =
  | 'food'
  | 'wood'
  | 'gold'
  | 'pop'
  | 'spear'
  | 'hammer'
  | 'flag'
  | 'sword'
  | 'worker'
  | 'townHall'
  | 'house'
  | 'tree'
  | 'bow'
  | 'horse'
  | 'stop';

const ICONS: Record<string, string[]> & Partial<Record<IconName, string[]>> = {
  food: [
    '......kk....',
    '.....kgk....',
    '...kkkgkkk..',
    '..krRrrrrrk.',
    '.krRRrrrrrrk',
    '.krRrrrrrrrk',
    '.krrrrrrrrrk',
    '.krrrrrrrrdk',
    '.krrrrrrrddk',
    '..krrrrrddk.',
    '...kkrrdkk..',
    '.....kkk....',
  ],
  wood: [
    '............',
    '............',
    '.kkkkkkkkk..',
    'kBBBBBBBBkkk',
    'kbbbbbbbkBBk',
    'kbbbbbbbkBnk',
    'kbbbbbbbkBBk',
    'knnnnnnnnkkk',
    '.kkkkkkkkk..',
    '...kkkkkkk..',
    '..kBBBBBBkk.',
    '..knnnnnnkk.',
  ],
  gold: [
    '............',
    '....kkkk....',
    '..kkYYYYkk..',
    '.kyYyyyyyyk.',
    '.koyyyyyyok.',
    '.kkooooookk.',
    '.kyYyyyyyyk.',
    '.koyyyyyyok.',
    '.kkooooookk.',
    '.kyyyyyyyyk.',
    '..kkooookk..',
    '....kkkk....',
  ],
  pop: [
    '....kkkk....',
    '...kssssk...',
    '...kssssk...',
    '...kssssk...',
    '....kkkk....',
    '..kkttttkk..',
    '.kttTTTTttk.',
    '.kttttttttk.',
    '.ktkttttktk.',
    '.kk.kttk.kk.',
    '....kttk....',
    '....kkkk....',
  ],
  spear: [
    '..........kk',
    '.........kik',
    '........kiik',
    '.......kiik.',
    '......kbkk..',
    '.....kbk....',
    '....kbk.....',
    '...kbk......',
    '..kbk.......',
    '.kbk........',
    'kbk.........',
    'kk..........',
  ],
  hammer: [
    '..kkkkkkkk..',
    '.kiiiiiiiik.',
    '.kIIIIIIIIk.',
    '..kkkbbkkk..',
    '....kbbk....',
    '....kbbk....',
    '....kbbk....',
    '....kbbk....',
    '....kbbk....',
    '....knnk....',
    '....knnk....',
    '....kkkk....',
  ],
  flag: [
    '.kk.........',
    '.knkkkkkk...',
    '.kntttttTk..',
    '.knttttttTk.',
    '.kntttttTk..',
    '.knkkkkkk...',
    '.knk........',
    '.knk........',
    '.knk........',
    '.knk........',
    'kkkkk.......',
    'knnnk.......',
  ],
  sword: [
    '..........kk',
    '.........kik',
    '........kiik',
    '.......kiik.',
    '..kk..kiik..',
    '..kykkiik...',
    '...kyiik....',
    '...kkyk.....',
    '..knkkyk....',
    '.knk..kk....',
    'knk.........',
    'kk..........',
  ],
};

ICONS.worker = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '....kkkk....',
  '...kssssk...',
  '...ksksk.k..',
  '...kssssk...',
  '..kkTTTTkk..',
  '.kTTTTTTTTk.',
  '.kTkTTTTkTk.',
  '.ks.kTTk.sk.',
  '....kbbk....',
  '....kkkk....',
];
ICONS.townHall = [
  '.....tt.....',
  '....kttk....',
  '...kttttk...',
  '..kkkkkkkk..',
  '.kpppppppppk',
  'kppppppppppk',
  'kkkkkkkkkkkk',
  '.kXXXXXXXXk.',
  '.kXkkXXkkXk.',
  '.kXkkXXnnXk.',
  '.kXXXXXnnXk.',
  'kkkkkkkkkkkk',
];
ICONS.house = [
  '............',
  '.....kk.....',
  '....khhk....',
  '...khhhhk...',
  '..khhhhhhk..',
  '.khhhhhhhhk.',
  'kkkkkkkkkkkk',
  '.kBBBBBBBBk.',
  '.kBkkBBnnBk.',
  '.kBkkBBnnBk.',
  '.kBBBBBnnBk.',
  '.kkkkkkkkkk.',
];
ICONS.tree = [
  '....kkkk....',
  '..kkEEEEkk..',
  '.kEEeEEEEEk.',
  '.kEeeeEEeEk.',
  'kEEeEEEeeeEk',
  'keeeEEEeeEek',
  '.keeeeeeeek.',
  '..kkkeekkk..',
  '....kbbk....',
  '....kbbk....',
  '...kbbbbk...',
  '...kkkkkk...',
];
ICONS.bow = [
  '...kk.......',
  '..kBk.k.....',
  '..kBk..k....',
  '.kBk....k...',
  '.kBk.....k..',
  '.kBk......k.',
  '.kBk......k.',
  '.kBk.....k..',
  '.kBk....k...',
  '..kBk..k....',
  '..kBk.k.....',
  '...kk.......',
];
ICONS.horse = [
  '........kk..',
  '.......kbbk.',
  '......kbbbbk',
  '.....kbbkbk.',
  '.kkkkbbbk...',
  'kbbbbbbbk...',
  'kbttttbbk...',
  'kbttttbk....',
  '.kbbbbbk....',
  '.kbk.kbk....',
  '.kbk.kbk....',
  '.kk..kk.....',
];
ICONS.stop = [
  '...kkkkkk...',
  '..krrrrrrk..',
  '.krrrrrrrrk.',
  'krrwwrrwwrrk',
  'krrrwwwwrrrk',
  'krrrrwwrrrrk',
  'krrrwwwwrrrk',
  'krrwwrrwwrrk',
  '.krrrrrrrrk.',
  '..krrrrrrk..',
  '...kkkkkk...',
  '............',
];

const cache = new Map<IconName, string>();

/** Icon for a config icon name (falls back to a generic person icon). */
export function iconFor(name: string): IconName {
  return name in ICONS ? (name as IconName) : 'pop';
}

/** PNG data URL for an icon (native size; scale it up in CSS). */
export function iconUrl(name: IconName): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const rows = ICONS[name] ?? ICONS.pop ?? [];
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = INK[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  const url = canvas.toDataURL('image/png');
  cache.set(name, url);
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
