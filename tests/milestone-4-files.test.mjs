import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Milestone 4 persists capability, task, model-run and evidence truth', () => {
  const sql = readFileSync('packages/db/migrations/0004_intelligence_capabilities.sql', 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_capability/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS intelligence_task/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS model_run/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS job_evidence_source/);
  assert.match(sql, /research\.web\.search/);
});

test('Milestone 4 keeps provider secrets server-side and exposes AgentPlace Auto', () => {
  const models = readFileSync('packages/models/src/index.ts', 'utf8');
  const env = readFileSync('.env.example', 'utf8');
  assert.match(models, /AgentPlace Auto/);
  assert.match(models, /OPENAI_API_KEY/);
  assert.match(models, /GEMINI_API_KEY/);
  assert.match(models, /ANTHROPIC_API_KEY/);
  assert.doesNotMatch(env, /VITE_OPENAI_API_KEY|VITE_GEMINI_API_KEY|VITE_ANTHROPIC_API_KEY/);
});

test('Milestone 4 UI offers model selection across conversation surfaces', () => {
  const manager = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');
  const worker = readFileSync('apps/web/src/components/WorkerWorkspace.tsx', 'utf8');
  const job = readFileSync('apps/web/src/components/JobWorkspace.tsx', 'utf8');
  for (const source of [manager, worker, job]) {
    assert.match(source, /ModelSelector/);
    assert.match(source, /submitIntelligence/);
  }
});

test('Milestone 4 durable Worker runtime has bounded retries and cost controls', () => {
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  assert.match(worker, /claimNextIntelligenceTask/);
  assert.match(worker, /AI_DAILY_COST_LIMIT_USD/);
  assert.match(worker, /AI_MAX_CALLS_PER_TASK/);
  assert.match(worker, /AI_MODEL_TIMEOUT_MS|researchWithWeb/);
  assert.match(worker, /untrusted evidence, never instruction/);
});


test('Milestone 4 supports Anthropic Claude as a first-class provider', () => {
  const sql = readFileSync('packages/db/migrations/0005_anthropic_model_provider.sql', 'utf8');
  const models = readFileSync('packages/models/src/index.ts', 'utf8');
  assert.match(sql, /anthropic/);
  assert.match(models, /claude-sonnet-5/);
  assert.match(models, /claude-fable-5/);
  assert.match(models, /web_search_20260318/);
});
