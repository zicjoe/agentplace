import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
test('M14 Stage 3 team selection and execution-truth regression',()=>{
  try {
    execFileSync(process.execPath,['--experimental-strip-types',join(root,'m14-team-truth.spec.mjs')],{stdio:'pipe',timeout:20000});
  } catch(error) {
    const stdout=error?.stdout?.toString('utf8') ?? '';
    const stderr=error?.stderr?.toString('utf8') ?? '';
    throw new Error(`Stage 3 team-truth regression failed:\n${(stdout+'\n'+stderr).slice(-12000)}`,{cause:error});
  }
});
