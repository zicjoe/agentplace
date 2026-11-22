import { existsSync, readFileSync } from 'node:fs';

for (const file of [
  'apps/web/src/platform/workerStarterTasks.ts',
  'tests/m16-worker-first-task.test.mjs',
  'docs/MILESTONE-16-WORKER-FIRST-TASK.md',
  'docs/MILESTONE-16-WORKER-FIRST-TASK-TESTING.md',
]) {
  if (!existsSync(file)) throw new Error(`M16 first-task review candidate missing ${file}`);
}
const root = JSON.parse(readFileSync('package.json','utf8'));
if (!root.scripts['verify:milestone-16'] || !root.scripts.check.includes('verify:milestone-16')) throw new Error('M16 first-task verifier not wired into pnpm check');
const fixture=readFileSync('apps/web/src/fixtures/FixtureAppContext.tsx','utf8');
const workspace=readFileSync('apps/web/src/components/WorkerWorkspace.tsx','utf8');
if (!fixture.includes("action.worker.isOriginal && !action.persisted")) throw new Error('M16 must prevent duplicate Worker installations');
if (!workspace.includes('if (productionConversation && !durableConversation) return')) throw new Error('M16 must fail closed before production chat');
const source=readFileSync('apps/web/src/components/DiscoverDetail.tsx','utf8');
if (!source.includes('openInstalledWorker') || !source.includes('Give work')) throw new Error('M16 Worker handoff missing');
for (const name of ['.env.example','config/environments/production-mainnet.env.example']) {
  const env=readFileSync(name,'utf8');
  if (!env.includes('MAINNET_EXECUTION_ENABLED=false') || !env.includes('MAINNET_AUTONOMY_ENABLED=false')) throw new Error(`M16 Mainnet gate regression in ${name}`);
}
console.log('PASS: M16 first-task path preserves durable Worker conversation, read-only defaults and financial safety boundaries.');
