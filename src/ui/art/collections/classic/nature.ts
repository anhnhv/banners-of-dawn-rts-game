/** Classic trees and rocks. */
import type { ArtCollectionParts, Draw } from '../types';

export const trees: ArtCollectionParts['trees'] = {
  oak: (b) => {
    b.boxC(0, 0, 0, 0.2, 0.55, 0.2, 'bark', 'bark');
    b.boxC(0, 0.42, 0, 0.86, 0.55, 0.86, 'leaves', 'leaf');
    b.boxC(0.06, 0.97, -0.04, 0.6, 0.32, 0.6, 'leaves', 'leaf-light');
  },
  oakTall: (b) => {
    b.boxC(0, 0, 0, 0.22, 0.75, 0.22, 'bark', 'bark');
    b.boxC(0, 0.6, 0, 0.95, 0.6, 0.95, 'leaves', 'leaf-dark');
    b.boxC(-0.05, 1.2, 0.05, 0.7, 0.4, 0.7, 'leaves', 'leaf');
    b.boxC(0.05, 1.6, 0, 0.36, 0.2, 0.36, 'leaves', 'leaf-light');
  },
  pine: (b) => {
    b.boxC(0, 0, 0, 0.16, 0.4, 0.16, 'bark', 'bark');
    b.boxC(0, 0.3, 0, 0.82, 0.38, 0.82, 'leaves', 'pine');
    b.boxC(0, 0.68, 0, 0.62, 0.36, 0.62, 'leaves', 'pine');
    b.boxC(0, 1.04, 0, 0.42, 0.34, 0.42, 'leaves', 'leaf-dark');
    b.boxC(0, 1.38, 0, 0.2, 0.22, 0.2, 'leaves', 'leaf-dark');
  },
  pineSmall: (b) => {
    b.boxC(0, 0, 0, 0.14, 0.3, 0.14, 'bark', 'bark');
    b.boxC(0, 0.22, 0, 0.6, 0.3, 0.6, 'leaves', 'pine');
    b.boxC(0, 0.52, 0, 0.42, 0.28, 0.42, 'leaves', 'pine');
    b.boxC(0, 0.8, 0, 0.22, 0.22, 0.22, 'leaves', 'leaf-dark');
  },
};

export const rockBlocks: [Draw, Draw, Draw] = [
  (b) => {
    b.boxC(0, 0, 0, 0.98, 0.5, 0.98, 'rock', 'stone', { topColor: 'stone-light' });
    b.boxC(0.12, 0.5, -0.06, 0.62, 0.32, 0.6, 'rock', 'stone', { topColor: 'stone-light' });
    b.boxC(-0.2, 0.82, 0.05, 0.3, 0.16, 0.3, 'rock', 'stone-light');
  },
  (b) => {
    b.boxC(0, 0, 0, 0.98, 0.34, 0.98, 'rock', 'stone-dark', { topColor: 'stone' });
    b.boxC(-0.15, 0.34, 0.1, 0.56, 0.42, 0.58, 'rock', 'stone', { topColor: 'stone-light' });
    b.boxC(0.28, 0.34, -0.25, 0.32, 0.22, 0.34, 'rock', 'stone');
  },
  (b) => {
    b.boxC(0, 0, 0, 0.98, 0.7, 0.98, 'rock', 'stone', { topColor: 'stone-light' });
    b.boxC(0.05, 0.7, 0.05, 0.7, 0.4, 0.66, 'rock', 'stone-dark', { topColor: 'stone' });
    b.boxC(-0.06, 1.1, -0.04, 0.36, 0.2, 0.36, 'rock', 'stone');
  },
];

export const boulder: Draw = (b) => {
  b.boxC(0, 0, 0, 0.5, 0.3, 0.42, 'rock', 'stone');
  b.boxC(0.12, 0.3, -0.02, 0.28, 0.16, 0.26, 'rock', 'stone-light');
  b.boxC(-0.22, 0, 0.15, 0.22, 0.16, 0.2, 'rock', 'stone-dark');
};
