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
  q: '#2f6a3b',
  Q: '#5aa257',
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
  | 'knight'
  | 'stop'
  | 'shield'
  | 'barracks'
  | 'stable'
  | 'tower'
  | 'pine'
  | 'berryBush'
  | 'goldMine'
  | 'catapult'
  | 'menu';

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
// armored horse with a lance: the Knight (the plain horse is the Scout Rider)
ICONS.knight = [
  'k.......kk..',
  '.k.....kIIk.',
  '..k...kIiIIk',
  '...k.kIIkIk.',
  '.kkkkIIIk...',
  'kIiiiIIIk...',
  'kIttttIIk...',
  'kIttttIk....',
  '.kIIIIIk....',
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

/** Hold-ground stance. */
ICONS.shield = [
  '.kkkkkkkkkk.',
  'kttttkkttttk',
  'kttTtkytttTk',
  'kttttkkttttk',
  'kkkkkyykkkkk',
  'ktttkyyktttk',
  'kttTtkkttTtk',
  '.ktttkkttTk.',
  '.kttttttttk.',
  '..kttttttk..',
  '...kttttk...',
  '....kkkk....',
];

// ---- own icons for every building, node and unit (until M7a several reused another's icon) ----

/** A hall with team shields and two spears leaning on it. */
ICONS.barracks = [
  'ik........ki',
  '.ik......ki.',
  '..bk....kb..',
  '...bk..kb...',
  '.kkkkkkkkkk.',
  'kppppppppppk',
  'kkkkkkkkkkkk',
  '.kBBBBBBBBk.',
  '.kBttBBttBk.',
  '.kBttnnttBk.',
  '.kBBBnnBBBk.',
  'kkkkkkkkkkkk',
];
/** A barn with a horseshoe in the gable and braced double doors. */
ICONS.stable = [
  '.....kk.....',
  '....kppk....',
  '...kpiipk...',
  '..kpippipk..',
  '.kppippippk.',
  'kkkkkkkkkkkk',
  '.kBBBBBBBBk.',
  '.kBknnnnkBk.',
  '.kBknBBnkBk.',
  '.kBkBnnBkBk.',
  '.kBknBBnkBk.',
  'kkkkkkkkkkkk',
];
/** A stone watch tower with merlons, a window and a team flag. */
ICONS.tower = [
  '......kkk...',
  '.....nttTk..',
  '.....nttk...',
  '.....n......',
  '.kk.kkkk.kk.',
  '.kXkkXXkkXk.',
  '.kXXXXXXXXk.',
  '..kXXxXXXk..',
  '..kXXkkXXk..',
  '..kXXkkXXk..',
  '..kXXXXXxk..',
  '.kkkkkkkkkk.',
];
/** A layered conifer (the oak is `tree`). */
ICONS.pine = [
  '.....kk.....',
  '....kqqk....',
  '...kqQqqk...',
  '....kqqk....',
  '..kqQqqqqk..',
  '.kqqqqQqqqk.',
  '...kqqqqk...',
  '.kqQqqqqqqk.',
  'kqqqqqqqQqqk',
  'kkkkkbbkkkkk',
  '....kbbk....',
  '....kkkk....',
];
/** A round bush with red berries. */
ICONS.berryBush = [
  '............',
  '....kkkk....',
  '..kkEEEEkk..',
  '.kEERrEEEEk.',
  '.kEErdEERrk.',
  'kEEEEEEErdEk',
  'keRreeEEEEek',
  'kerdeeeRreek',
  '.keeeeerdek.',
  '..kkeeeeekk.',
  '....kkkkk...',
  '............',
];
/** A rock mound with a timbered entrance and gold inside. */
ICONS.goldMine = [
  '............',
  '....kkkk....',
  '..kkXXXXkk..',
  '.kXyXxXXyXk.',
  '.kXxkkkkxXk.',
  'kXXkbbbbkXXk',
  'kyxbkkkkbxXk',
  'kXXbkkkkbXyk',
  'kxXbkYykbXxk',
  'kXXbkyykbXXk',
  'kkkkkkkkkkkk',
  '............',
];
/** A wheeled frame with a raised throwing arm and a stone in the bucket. */
ICONS.catapult = [
  '.........kk.',
  '........kxXk',
  '.......kbkk.',
  '......kbk...',
  '.....kbk....',
  '....kbk.....',
  '.kkkbkkkkk..',
  'kBBBBBBBBBk.',
  '.kBkkkkkBk..',
  'kBnk...kBnk.',
  'knBk...knBk.',
  '.kk.....kk..',
];

/** The in-game menu button: three brass bars. */
ICONS.menu = [
  '............',
  '.kkkkkkkkkk.',
  '.kYYYYYYYYk.',
  '.kkkkkkkkkk.',
  '............',
  '.kkkkkkkkkk.',
  '.kYYYYYYYYk.',
  '.kkkkkkkkkk.',
  '............',
  '.kkkkkkkkkk.',
  '.kYYYYYYYYk.',
  '.kkkkkkkkkk.',
];

const cache = new Map<IconName, string>();

/** Every icon, in the order they are defined (model viewer). */
export function iconNames(): IconName[] {
  return Object.keys(ICONS) as IconName[];
}

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
