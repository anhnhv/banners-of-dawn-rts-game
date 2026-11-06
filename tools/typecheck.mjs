// Type-checks every module with its own tsconfig (and therefore its own `lib`).
// The engine, shared and AI configs have no DOM types, so DOM usage there fails here.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');

const projects = ['src/shared', 'src/engine', 'src/ai', 'src/ui', 'src/host', '.'];

let failed = 0;
for (const project of projects) {
  const result = spawnSync(process.execPath, [tsc, '-p', project, '--pretty'], { stdio: 'inherit' });
  if (result.status === 0) {
    console.log(`ok    ${project}`);
  } else {
    failed++;
    console.error(`FAIL  ${project}`);
  }
}

if (failed > 0) {
  console.error(`\nTypecheck failed in ${failed} project(s).`);
  process.exit(1);
}
console.log('\nTypecheck passed.');
