import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
test('M14 Manager retrieves persisted prior research report for grounded follow-ups',()=>{
  execFileSync(process.execPath,['--experimental-strip-types',join(root,'m14-manager-report-continuity.spec.mjs')],{stdio:'pipe',timeout:20000});
});
