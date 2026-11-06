/**
 * Browser entry point. It wires modules together and contains no game logic.
 *   /             → the game (currently the M1 map view)
 *   /?map=<id>    → a specific map from maps/index.json
 *   /?preview     → the style-preview diorama (keys 1 2 3 switch views)
 */
import { bootGame } from './host';
import { startStylePreview } from './ui';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container in index.html');

const params = new URLSearchParams(window.location.search);
if (params.has('preview')) startStylePreview(container);
else void bootGame(container, params.get('map'));
