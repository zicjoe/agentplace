import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Milestone 2 keeps identity separate from execution authority', async () => {
  const identity = await readFile('apps/web/src/components/IdentityCheckpoint.tsx', 'utf8');
  assert.match(identity, /does not connect that wallet for execution/i);
  assert.match(identity, /permission to move funds/i);
});

test('manual conversation titles cannot be silently replaced by auto titles', async () => {
  const repository = await readFile('packages/context/src/index.ts', 'utf8');
  assert.match(repository, /current\.titleSource === 'user'/);
  assert.match(repository, /requestedSource === 'auto'/);
});

test('durable conversation APIs always resolve an authenticated owner', async () => {
  const api = await readFile('apps/api/src/server.ts', 'utf8');
  assert.match(api, /requireAgentPlaceIdentity/);
  assert.match(api, /identity\.appUserId/);
});

test('authenticated conversation state is not persisted as authoritative browser fixture state', async () => {
  const store = await readFile('apps/web/src/platform/fixtureStore.ts', 'utf8');
  assert.match(store, /dataMode === 'api' && state\.user !== null/);
});


test('frontend projects the AgentPlace application user rather than treating the auth-provider id as the domain user id', async () => {
  const authClient = await readFile('apps/web/src/platform/authClient.ts', 'utf8');
  const checkpoint = await readFile('apps/web/src/components/IdentityCheckpoint.tsx', 'utf8');
  assert.match(authClient, /appUserId/);
  assert.match(checkpoint, /getAgentPlaceIdentity/);
});

test('authentication rate limiting is database-backed for multi-replica consistency', async () => {
  const auth = await readFile('packages/auth/src/index.ts', 'utf8');
  assert.match(auth, /rateLimit:/);
  assert.match(auth, /storage: 'database'/);
});


test('Railway API can bind to the platform port and production interface', async () => {
  const api = await readFile('apps/api/src/server.ts', 'utf8');
  assert.match(api, /process\.env\.PORT/);
  assert.match(api, /RAILWAY_ENVIRONMENT/);
  assert.match(api, /0\.0\.0\.0/);
});

test('deployment guide keeps Railway Postgres private by default', async () => {
  const deployment = await readFile('docs/MILESTONE-2-DEPLOYMENT.md', 'utf8');
  assert.match(deployment, /Keep the database private/);
  assert.match(deployment, /DATABASE_URL=\$\{\{Postgres\.DATABASE_URL\}\}/);
  assert.match(deployment, /Pre-Deploy Command: pnpm migrate/);
});

test('Better Auth singleton uses a portable public instance type while retaining SIWE at runtime', async () => {
  const auth = await readFile('packages/auth/src/index.ts', 'utf8');
  assert.match(auth, /type AgentPlaceAuth = ReturnType<typeof betterAuth>/);
  assert.match(auth, /function createAuth\(\): AgentPlaceAuth/);
  assert.match(auth, /siwe\(\{/);
  assert.match(auth, /as unknown as AgentPlaceAuth/);
  assert.match(auth, /let authInstance: AgentPlaceAuth \| undefined/);
  assert.match(auth, /export function getAuth\(\): AgentPlaceAuth/);
  assert.doesNotMatch(auth, /type AgentPlaceAuth = ReturnType<typeof createAuth>/);
});
