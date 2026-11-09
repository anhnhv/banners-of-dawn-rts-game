/**
 * Browser entry point. It wires modules together and contains no game logic.
 *   /             → the Main Menu (Play → Match Setup, Quick start, Settings, How to Play)
 *   /?play        → start a match at once with the last setup (or the defaults)
 *   /?map=<id>    → start at once on that map (maps/index.json)
 *   /?ai=easy|normal|off → start at once against that opponent (off = idle)
 *   /?setup=scenario|standard → the map's ready-made battle, or Town Hall + start units
 *   /?pace=relaxed|standard|fast|blitz, /?speed=0.5|1|1.5|2 → pace preset and game speed
 *   /?army=<n>    → dev: give the human player n extra units to test movement
 *   /?enemy=<n>   → dev: n enemy units between the bases, to test combat
 *   /?preview     → the style-preview diorama (keys 1 2 3 switch views)
 *   /?models      → the model viewer (every model and HUD icon)
 *   /?hud         → the HUD gallery (units, buildings, construction, resources; #collection)
 *   ?art=<id>     → draw everything with that art collection (src/ui/art/collections), any page
 *                   (default: aetherfall; ?art=classic for the base look)
 * Any match parameter skips the menu; unspecified options come from the last setup.
 */
import { startApp } from './host';
import { setArtCollection, startHudGallery, startModelViewer, startStylePreview } from './ui';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container in index.html');

const params = new URLSearchParams(window.location.search);
setArtCollection(params.get('art'));
if (params.has('preview')) startStylePreview(container);
else if (params.has('models')) startModelViewer(container);
else if (params.has('hud')) startHudGallery(container);
else void startApp(container, window.location.search);
