/**
 * Validates every map listed in maps/index.json (PLAN §8.2). Exit code 1 if any map has errors.
 *   npm run validate-maps
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodeMap, MapFormatError, MapIndexSchema } from '../src/shared';
import { validateMap } from '../src/engine';

const mapsDir = fileURLToPath(new URL('../maps/', import.meta.url));
const index = MapIndexSchema.parse(JSON.parse(readFileSync(`${mapsDir}index.json`, 'utf8')));

let failed = 0;
for (const entry of index.maps) {
  try {
    const decoded = decodeMap(JSON.parse(readFileSync(`${mapsDir}${entry.file}`, 'utf8')));
    if (decoded.id !== entry.id)
      throw new Error(`index says "${entry.id}" but the file's id is "${decoded.id}"`);
    const result = validateMap(decoded);
    const status = result.errors.length === 0 ? 'ok  ' : 'FAIL';
    console.log(
      `${status}  ${entry.file}  (${decoded.width}×${decoded.height}, ${decoded.objects.length} objects)`,
    );
    result.errors.forEach((e) => console.log(`        error: ${e}`));
    result.warnings.forEach((w) => console.log(`        warning: ${w}`));
    if (result.errors.length > 0) failed++;
  } catch (err) {
    failed++;
    console.log(`FAIL  ${entry.file}`);
    console.log(`        ${err instanceof MapFormatError ? err.message : String(err)}`);
  }
}

if (failed > 0) {
  console.log(`\n${failed} map(s) failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${index.maps.length} map(s) valid.`);
