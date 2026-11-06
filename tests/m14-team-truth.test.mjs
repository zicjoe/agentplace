import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
test('M14 Stage 3 team selection and execution-truth regression',()=>{
  execFileSync(process.execPath,['--experimental-strip-types',join(root,'m14-team-truth.spec.mjs')],{stdio:'pipe',timeout:20000});
});
