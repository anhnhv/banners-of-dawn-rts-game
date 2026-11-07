/**
 * Browser entry point. It wires modules together and contains no game logic.
 *   /             → the game
 *   /?map=<id>    → a specific map from maps/index.json
 *   /?army=<n>    → dev: give the human player n extra units to test movement
 *   /?enemy=<n>   → dev: n enemy units between the bases, to test combat
 *   /?preview     → the style-preview diorama (keys 1 2 3 switch views)
 */
import { bootGame } from './host';
import { startStylePreview } from './ui';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container in index.html');

const params = new URLSearchParams(window.location.search);
if (params.has('preview')) startStylePreview(container);
else {
  const army = Number(params.get('army') ?? 0);
  const enemy = Number(params.get('enemy') ?? 0);
  void bootGame(container, {
    mapId: params.get('map'),
    testArmy: Number.isFinite(army) ? Math.min(400, Math.max(0, army)) : 0,
    testEnemy: Number.isFinite(enemy) ? Math.min(400, Math.max(0, enemy)) : 0,
  });
}
