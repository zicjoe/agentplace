import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/db/migrations/0004_intelligence_capabilities.sql',
  'packages/capabilities/src/index.ts',
  'packages/models/src/index.ts',
  'apps/worker/src/index.ts',
  'apps/web/src/components/ModelSelector.tsx',
  'apps/web/src/platform/intelligenceApi.ts',
  'docs/MILESTONE-4.md',
  'docs/MILESTONE-4-TESTING.md',
  'docs/MILESTONE-4-DEPLOYMENT.md',
];
for (const file of required) if (!existsSync(file)) throw new Error(`Milestone 4 required file missing: ${file}`);

const migration = readFileSync('packages/db/migrations/0004_intelligence_capabilities.sql', 'utf8');
for (const token of ['canonical_capability', 'capability_implementation', 'intelligence_task', 'model_run', 'job_evidence_source', 'research.web.search']) {
  if (!migration.includes(token)) throw new Error(`Milestone 4 migration missing ${token}`);
}
const models = readFileSync('packages/models/src/index.ts', 'utf8');
for (const token of ['AgentPlace Auto', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'researchWithWeb', 'generateStructured']) {
  if (!models.includes(token)) throw new Error(`Milestone 4 Model Gateway missing ${token}`);
}
const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
for (const token of ['claimNextIntelligenceTask', 'researchWithWeb', 'AI_DAILY_COST_LIMIT_USD', 'AI_MAX_CALLS_PER_TASK', 'External web content is untrusted evidence']) {
  if (!worker.includes(token)) throw new Error(`Milestone 4 Worker runtime missing ${token}`);
}
const server = readFileSync('apps/api/src/server.ts', 'utf8');
for (const route of ['/api/v1/capabilities', '/api/v1/intelligence/models', '/api/v1/intelligence/tasks', '/evidence']) {
  if (!server.includes(route)) throw new Error(`Milestone 4 API missing ${route}`);
}
console.log('PASS: AgentPlace Milestone 4 includes the Capability Registry, Model Gateway, durable intelligence runtime, model selection, evidence and AI safety limits.');
