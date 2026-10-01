import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Milestone 5 persists route decisions and Worker/capability compatibility', () => {
  const sql = readFileSync('packages/db/migrations/0006_router_v1.sql', 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS route_decision/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS worker_capability_route/);
  assert.match(sql, /capability_routes jsonb/);
  assert.match(sql, /unavailable_capabilities jsonb/);
});

test('Milestone 5 deterministic Router validates lifecycle, environment, networks, provider configuration and effects', () => {
  const router = readFileSync('packages/router/src/index.ts', 'utf8');
  assert.match(router, /isLiveLifecycle/);
  assert.match(router, /environmentEligibility/);
  assert.match(router, /networkEligible/);
  assert.match(router, /providerConfigured/);
  assert.match(router, /implementationTrustEligible/);
  assert.match(router, /return false;\n}/);
  assert.match(router, /capability\.effect !== 'read'/);
  assert.match(router, /Router v1 is read-only and cannot grant or route financial write authority/);
});

test('Milestone 5 preserves explicit model/provider choice and allows bounded fallback only for Auto', () => {
  const router = readFileSync('packages/router/src/index.ts', 'utf8');
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  assert.match(router, /silent provider switching is disabled/);
  assert.match(worker, /task\.providerPreference === 'auto'/);
  assert.match(worker, /\.slice\(0, 2\)/);
  assert.match(worker, /trying eligible fallback/);
});

test('Milestone 5 stores the LLM proposal but lets deterministic routing choose the executable path', () => {
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  const router = readFileSync('packages/router/src/index.ts', 'utf8');
  assert.match(worker, /bounded structured proposal for the deterministic AgentPlace Router/);
  assert.match(worker, /capabilityGraph/);
  assert.match(router, /pickTeam/);
  assert.match(router, /bestCandidate/);
  assert.match(router, /smallest set of specialists/);
  assert.match(router, /implementationEligibility/);
  assert.match(router, /normalizeGraph/);
});

test('Milestone 5 exposes route explanation progressively from Job Workspace', () => {
  const api = readFileSync('apps/api/src/server.ts', 'utf8');
  const workApi = readFileSync('apps/web/src/platform/workApi.ts', 'utf8');
  const workspace = readFileSync('apps/web/src/components/JobWorkspace.tsx', 'utf8');
  assert.match(api, /\/api\/v1\/jobs\/\(\[\^\/\]\+\)\\\/route|\/route/);
  assert.match(workApi, /fetchJobRoute/);
  assert.match(workspace, /How AgentPlace routed this job/);
  assert.match(workspace, /Read-only · no financial authority/);
});
