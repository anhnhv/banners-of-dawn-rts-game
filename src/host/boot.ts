/**
 * Boot sequence (M1): load the map index and a map, decode it, validate it with the engine,
 * then hand it to the UI. From M2 on this also creates the engine Game and the controllers.
 */
import { decodeMap, MapFormatError } from '../shared';
import { validateMap } from '../engine';
import { createMapView, showFatalError } from '../ui';
import { loadMapFile, loadMapIndex } from './loaders';

export async function bootGame(container: HTMLElement, requestedMapId?: string | null): Promise<void> {
  try {
    const index = await loadMapIndex();
    const entry =
      index.maps.find((m) => m.id === requestedMapId) ??
      index.maps.find((m) => m.recommended) ??
      index.maps[0];
    if (!entry) throw new Error('maps/index.json lists no maps');

    const map = decodeMap(await loadMapFile(entry.file));
    const result = validateMap(map);
    if (result.errors.length > 0) {
      showFatalError(container, `Map "${map.name}" is not valid`, result.errors);
      return;
    }
    createMapView(container, map, { warnings: result.warnings });
  } catch (err) {
    if (err instanceof MapFormatError) {
      showFatalError(container, 'The map file has errors', err.issues);
    } else {
      showFatalError(container, 'The game could not start', [
        err instanceof Error ? err.message : String(err),
      ]);
    }
  }
}
