/** Classic generic structures: walls, construction sites, rubble and projectiles. */
import type { ArtCollectionParts } from '../types';

export const wall: ArtCollectionParts['wall'] = (b, axis) => {
  if (axis === 'x') {
    b.box(0, 0, 0.22, 1, 0.95, 0.56, 'bricks', 'stone', { top: 'rock', topColor: 'stone-dark' });
    b.box(0.05, 0.95, 0.22, 0.34, 0.24, 0.56, 'bricks', 'stone');
    b.box(0.6, 0.95, 0.22, 0.34, 0.24, 0.56, 'bricks', 'stone');
  } else {
    b.box(0.22, 0, 0, 0.56, 0.95, 1, 'bricks', 'stone', { top: 'rock', topColor: 'stone-dark' });
    b.box(0.22, 0.95, 0.05, 0.56, 0.24, 0.34, 'bricks', 'stone');
    b.box(0.22, 0.95, 0.6, 0.56, 0.24, 0.34, 'bricks', 'stone');
  }
};

/**
 * A dirt-and-plank foundation, scaffold posts at the corners (and along long sides) and rails at
 * two heights. Used for EVERY building type while it is being built.
 */
export const constructionSite: ArtCollectionParts['constructionSite'] = (b, w, h, height) => {
  b.box(0.05, 0, 0.05, w - 0.1, 0.08, h - 0.1, 'soil', 'dirt', { top: 'planks', topColor: 'wood-light' });
  const posts: Array<[number, number]> = [];
  for (let x = 0; x <= w; x += Math.max(1, w / Math.ceil(w / 1.5))) {
    posts.push([x, 0], [x, h]);
  }
  for (let z = 0; z <= h; z += Math.max(1, h / Math.ceil(h / 1.5))) {
    posts.push([0, z], [w, z]);
  }
  for (const [px, pz] of posts) {
    const x = Math.min(w - 0.12, Math.max(0.04, px - 0.04));
    const z = Math.min(h - 0.12, Math.max(0.04, pz - 0.04));
    b.box(x, 0.08, z, 0.08, height, 0.08, 'planks', 'wood');
  }
  for (const y of [height * 0.45, height]) {
    b.box(0.04, y, 0.04, w - 0.08, 0.06, 0.06, 'planks', 'wood-dark');
    b.box(0.04, y, h - 0.1, w - 0.08, 0.06, 0.06, 'planks', 'wood-dark');
    b.box(0.04, y, 0.04, 0.06, 0.06, h - 0.08, 'planks', 'wood-dark');
    b.box(w - 0.1, y, 0.04, 0.06, 0.06, h - 0.08, 'planks', 'wood-dark');
  }
  // a few stacked planks and stones as building material
  b.box(0.2, 0.08, 0.2, Math.min(0.7, w * 0.3), 0.12, 0.25, 'planks', 'wood-light');
  b.box(w - 0.55, 0.08, h - 0.5, 0.35, 0.18, 0.3, 'rock', 'stone');
};

export const constructionCore: ArtCollectionParts['constructionCore'] = (b, w, h) => {
  b.box(0.25, 0, 0.25, w - 0.5, 1, h - 0.5, 'planks', 'wood-light', { top: 'planks', topColor: 'straw' });
};

/** Scorched ground, broken stones and charred beams, sized from the footprint. */
export const rubble: ArtCollectionParts['rubble'] = (b, w, h) => {
  b.box(0.05, 0, 0.05, w - 0.1, 0.05, h - 0.1, 'soil', 'dirt');
  let seed = w * 31 + h * 17;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const pieces = Math.round(w * h * 3);
  for (let i = 0; i < pieces; i++) {
    const s = 0.12 + rnd() * 0.22;
    const x = 0.1 + rnd() * (w - 0.2 - s);
    const z = 0.1 + rnd() * (h - 0.2 - s);
    const beam = rnd() < 0.3;
    if (beam) b.box(x, 0.05, z, s * 2.2, 0.08, 0.08, 'planks', 'wood-dark');
    else b.box(x, 0.05, z, s, s * (0.4 + rnd() * 0.5), s, 'rock', rnd() < 0.5 ? 'stone' : 'stone-dark');
  }
};

export const projectiles: ArtCollectionParts['projectiles'] = {
  arrow: (b) => {
    b.boxC(0, -0.012, -0.03, 0.025, 0.025, 0.42, 'bark', 'wood-light'); // shaft
    b.boxC(0, -0.02, 0.2, 0.04, 0.04, 0.07, 'plain', 'iron'); // tip
    b.boxC(0, -0.02, -0.22, 0.05, 0.04, 0.08, 'cloth', 'plaster'); // fletching
  },
  // a sling stone: small and round
  pebble: (b) => {
    b.boxC(0, -0.035, 0, 0.07, 0.07, 0.07, 'rock', 'stone');
  },
  stone: (b) => {
    b.boxC(0, -0.08, 0, 0.16, 0.16, 0.16, 'rock', 'stone');
    b.boxC(0.03, -0.04, 0.02, 0.1, 0.1, 0.1, 'rock', 'stone-light');
  },
};
