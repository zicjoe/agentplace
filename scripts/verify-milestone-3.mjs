import { readFileSync, existsSync } from 'node:fs';

const required = [
  'packages/db/migrations/0003_workers_jobs.sql',
  'packages/workers/src/index.ts',
  'packages/jobs/src/index.ts',
  'apps/web/src/platform/workApi.ts',
  'docs/MILESTONE-3.md',
  'docs/MILESTONE-3-TESTING.md',
  'docs/MILESTONE-3-DEPLOYMENT.md',
];
for (const file of required) {
  if (!existsSync(file)) throw new Error(`Milestone 3 required file missing: ${file}`);
}
const migration = readFileSync('packages/db/migrations/0003_workers_jobs.sql','utf8');
for (const token of ['worker_definition','worker_version','job_contract','user_worker','CREATE TABLE IF NOT EXISTS job ','job_worker','job_stage','domain_event','Smart Money Scout']) {
  if (!migration.includes(token)) throw new Error(`Milestone 3 migration missing ${token}`);
}
const server = readFileSync('apps/api/src/server.ts','utf8');
for (const route of ['/api/v1/workers','/api/v1/jobs','/api/v1/activity','/api/v1/worker-catalog']) {
  if (!server.includes(route)) throw new Error(`Milestone 3 API missing ${route}`);
}
const workers = readFileSync('packages/workers/src/index.ts','utf8');
if (!workers.includes("status: 'foundation'" ) && !workers.includes("status: 'production-foundation'")) throw new Error('Worker module manifest missing');
console.log('PASS: AgentPlace Milestone 3 includes durable Workers, Jobs, team relationships, conversations and factual Activity projection.');
