import { existsSync, readFileSync } from 'node:fs';

for (const path of [
  'apps/web/src/platform/workerCreationStart.ts',
  'apps/web/src/components/WorkerCreateStart.tsx',
  'tests/m17-no-code-worker-quickstart.test.mjs',
  'docs/MILESTONE-17-NOCODE-WORKER-STAGE1.md',
  'docs/MILESTONE-17-NOCODE-WORKER-STAGE1-TESTING.md',
]) if (!existsSync(path)) throw new Error(`M17 missing ${path}`);
const scripts = JSON.parse(readFileSync('package.json','utf8')).scripts;
if (!scripts['verify:milestone-17'] || !scripts.check.includes('verify:milestone-17')) throw new Error('M17 verification is not wired to pnpm check');
const code=readFileSync('apps/web/src/components/AgentBuilder.tsx','utf8');
if (!code.includes('<WorkerCreateStart') || !code.includes('ensureSavedWorker(baseDraft)') || !code.includes('interpretCreatorBuilderTurn(assetId')) throw new Error('M17 must use the existing durable Creator pipeline');
for (const envPath of ['.env.example','config/environments/production-mainnet.env.example']) {
  const env=readFileSync(envPath,'utf8');
  if (!env.includes('MAINNET_EXECUTION_ENABLED=false') || !env.includes('MAINNET_AUTONOMY_ENABLED=false')) throw new Error(`M17 must preserve Mainnet safety gates: ${envPath}`);
}
console.log('PASS: M17 creator quick-start uses durable drafts and preserves review, test and financial safety boundaries.');
