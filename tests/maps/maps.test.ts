/** Every map shipped in maps/ must decode and pass validation (PLAN §8.2). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeMap, MapIndexSchema } from '../../src/shared';
import { validateMap } from '../../src/engine';

const dir = new URL('../../maps/', import.meta.url);
const index = MapIndexSchema.parse(JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')));

describe('shipped maps', () => {
  it('index lists at least one map and exactly one recommended map', () => {
    expect(index.maps.length).toBeGreaterThan(0);
    expect(index.maps.filter((m) => m.recommended)).toHaveLength(1);
  });

  it.each(index.maps.map((m) => [m.id, m.file] as const))('%s is valid', (id, file) => {
    const map = decodeMap(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
    expect(map.id).toBe(id);
    expect(validateMap(map).errors).toEqual([]);
  });
});
