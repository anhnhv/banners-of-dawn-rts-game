/**
 * Example collection: the classic look in autumn. It only changes colors, two trees and one icon;
 * everything else comes from `classic`. Copy this file to start a new collection.
 */
import type { ArtCollection } from './types';

export const autumn: ArtCollection = {
  id: 'autumn',
  name: 'Autumn',
  colors: {
    grass: '#a8a347',
    'grass-dark': '#8f8a3a',
    'grass-light': '#c2b85c',
    leaf: '#d9822b',
    'leaf-dark': '#a8501f',
    'leaf-light': '#f0b240',
    pine: '#3f5e3a',
  },
  trees: {
    // a bare oak with a few leaves left
    oakTall: (b) => {
      b.boxC(0, 0, 0, 0.22, 1.1, 0.22, 'bark', 'bark');
      b.boxC(0.18, 0.7, 0, 0.36, 0.08, 0.08, 'bark', 'bark');
      b.boxC(-0.16, 0.9, 0.04, 0.3, 0.08, 0.08, 'bark', 'bark');
      b.boxC(0.05, 1.1, 0, 0.6, 0.3, 0.6, 'leaves', 'leaf-dark');
    },
  },
  iconInk: { e: '#d9822b', E: '#f0b240' },
};
