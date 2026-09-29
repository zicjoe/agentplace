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
  assert.match(models, /claude-opus-5/);
  assert.doesNotMatch(models, /gemini-3\.8-pro/);
  assert.match(models, /web_search_20260318/);
});


test('Milestone 4 exposes truthful persisted task status and guest preview boundaries', () => {
  const api = readFileSync('apps/api/src/server.ts', 'utf8');
  const jobs = readFileSync('packages/jobs/src/index.ts', 'utf8');
  const ui = readFileSync('apps/web/src/components/IntelligenceTaskStatus.tsx', 'utf8');
  const chat = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  assert.match(api, /getLatestIntelligenceTask/);
  assert.match(jobs, /owner_user_id=\$1 AND conversation_id=\$2/);
  assert.match(ui, /AgentPlace could not complete this request/);
  assert.match(chat, /Guest preview/);
  assert.match(worker, /Intelligence task claimed/);
  assert.match(worker, /isFinalAttempt/);
});


test('Milestone 4 renders durable AI processing state inline with the conversation', () => {
  const status = readFileSync('apps/web/src/components/IntelligenceTaskStatus.tsx', 'utf8');
  const manager = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');
  const worker = readFileSync('apps/web/src/components/WorkerWorkspace.tsx', 'utf8');
  const job = readFileSync('apps/web/src/components/JobWorkspace.tsx', 'utf8');

  assert.match(status, /AgentPlace is preparing/);
  assert.match(status, /AgentPlace is working/);
  assert.match(status, /Finishing response/);
  assert.match(status, /responseAlreadyVisible/);

  for (const source of [manager, worker, job]) {
    const panel = source.indexOf('data-workspace-scroll');
    const taskStatus = source.lastIndexOf('<IntelligenceTaskStatus');
    assert.ok(panel >= 0 && taskStatus > panel, 'task status remains inside the owned conversation scroll panel');
    assert.doesNotMatch(source, /scrollIntoView/, 'conversation scrolling must never move the document shell');
  }

  assert.doesNotMatch(manager, /productionConversation \? <IntelligenceTaskStatus/);
  assert.doesNotMatch(worker, /productionConversation && durableConversation \? <IntelligenceTaskStatus/);
  assert.doesNotMatch(job, /productionConversation && durableConversation \? <IntelligenceTaskStatus/);
});

test('Milestone 4 creates and submits the first authenticated message from Home', () => {
  const home = readFileSync('apps/web/src/components/GuestHome.tsx', 'utf8');
  const modelSelector = readFileSync('apps/web/src/components/ModelSelector.tsx', 'utf8');
  const modelApi = readFileSync('apps/web/src/platform/intelligenceApi.ts', 'utf8');

  const firstSend = home.slice(home.indexOf('async function createAndSend'), home.indexOf('function handleChip'));
  assert.match(firstSend, /if \(!liveConversation\)/);
  assert.match(firstSend, /await createDurableConversation\(conv\)/);
  assert.match(firstSend, /await submitIntelligence\(convId, userMessage, modelSelection\)/);
  assert.ok(firstSend.indexOf('await createDurableConversation(conv)') < firstSend.indexOf('await submitIntelligence(convId, userMessage, modelSelection)'), 'conversation must exist before its first task');
  assert.match(firstSend, /persisted: true/);
  assert.match(home, /liveConversation && <ModelSelector onChange=\{setModelSelection\}/);
  assert.match(modelSelector, /conversationId\?:string/);
  assert.match(modelApi, /const query=conversationId\?/);
});

test('Milestone 4 protects fresh messages against concurrent background rehydration', () => {
  const state = readFileSync('apps/web/src/fixtures/FixtureAppContext.tsx', 'utf8');
  const chat = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');
  const status = readFileSync('apps/web/src/components/IntelligenceTaskStatus.tsx', 'utf8');

  assert.match(state, /ADD_CONV'; conv: Conversation; persisted\?: boolean/);
  assert.match(state, /conversationRevisionRef\.current/);
  assert.match(state, /pendingConversationWritesRef\.current/);
  assert.match(state, /const prior = pendingConversationWritesRef\.current\.get\(id\)/);
  assert.match(state, /stateRef\.current\.user\?\.id !== ownerUserId/);
  assert.match(chat, /await createDurableConversation\(\{ \.\.\.currentConversation, messages: \[\] \}\)/);
  assert.match(chat, /pendingMessageId=\{pendingMessageId\}/);
  assert.match(status, /pendingMessageId && task\?\.userMessageId !== pendingMessageId/);
});
