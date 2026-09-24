import { readFile, stat } from 'node:fs/promises';

const required = [
  'packages/db/migrations/0002_identity_conversations.sql',
  'packages/db/src/migrate.ts',
  'packages/auth/src/index.ts',
  'packages/auth/src/migrate.ts',
  'packages/context/src/index.ts',
  'apps/api/src/server.ts',
  'apps/web/src/platform/authClient.ts',
  'apps/web/src/platform/conversationApi.ts',
  'apps/web/src/platform/identityResume.ts',
  'apps/web/src/components/IdentityCheckpoint.tsx',
  'apps/web/api/[...path].ts',
  'apps/web/vercel.json',
  'docs/MILESTONE-2.md',
  'docs/MILESTONE-2-TESTING.md',
  'docs/MILESTONE-2-DEPLOYMENT.md',
];
for (const path of required) {
  try { await stat(path); } catch { throw new Error(`Milestone 2 required file missing: ${path}`); }
}

const env = await readFile('.env.example', 'utf8');
for (const item of [
  'VITE_AGENT_PLACE_DATA_MODE=api',
  'MAINNET_EXECUTION_ENABLED=false',
  'MAINNET_AUTONOMY_ENABLED=false',
  'BETTER_AUTH_SECRET=',
  'BETTER_AUTH_URL=',
  'GOOGLE_CLIENT_ID=',
  'AGENT_PLACE_API_ORIGIN=',
]) {
  if (!env.includes(item)) throw new Error(`Milestone 2 environment contract missing: ${item}`);
}

const auth = await readFile('packages/auth/src/index.ts', 'utf8');
for (const item of ['betterAuth', 'schemaName: \'auth\'', 'siwe(', 'verifyMessage', 'requireAgentPlaceIdentity']) {
  if (!auth.includes(item)) throw new Error(`Auth foundation missing: ${item}`);
}
if (/CLERK|SUPABASE|AUTH0|WORKOS|PRIVY/i.test(auth)) throw new Error('Milestone 2 must not introduce a managed paid-auth dependency.');

const migration = await readFile('packages/db/migrations/0002_identity_conversations.sql', 'utf8');
for (const item of ['conversation', 'conversation_message', 'conversation_participant', 'conversation_object_link', 'pg_trgm', 'title_source']) {
  if (!migration.includes(item)) throw new Error(`Conversation migration missing: ${item}`);
}

const context = await readFile('packages/context/src/index.ts', 'utf8');
for (const item of ['listConversations', 'importConversations', 'patchConversation', "current.titleSource === 'user'", 'similarity(']) {
  if (!context.includes(item)) throw new Error(`Durable conversation repository missing: ${item}`);
}

const api = await readFile('apps/api/src/server.ts', 'utf8');
for (const item of ['/api/auth/', '/api/v1/me', '/api/v1/conversations', '/messages', 'requireIdentity', 'process.env.PORT', 'RAILWAY_ENVIRONMENT']) {
  if (!api.includes(item)) throw new Error(`API Milestone 2 contract missing: ${item}`);
}

const identity = await readFile('apps/web/src/components/IdentityCheckpoint.tsx', 'utf8');
for (const item of ['Continue with Google', 'Continue with wallet', 'does not connect that wallet for execution', 'importGuestConversations', 'getAgentPlaceIdentity']) {
  if (!identity.includes(item)) throw new Error(`Identity UX missing requirement: ${item}`);
}
if (/prototype — no real authentication|Enter any name and email/i.test(identity)) throw new Error('Prototype identity form must be removed in API-backed Milestone 2.');

const fixture = await readFile('apps/web/src/fixtures/FixtureAppContext.tsx', 'utf8');
for (const item of ['SET_CONVERSATIONS', 'fetchConversations', 'createDurableConversation', 'signOutAuth']) {
  if (!fixture.includes(item)) throw new Error(`Production state adapter missing durable conversation integration: ${item}`);
}

const proxy = await readFile('apps/web/api/[...path].ts', 'utf8');
if (!proxy.includes('AGENT_PLACE_API_ORIGIN') || !proxy.includes('set-cookie')) {
  throw new Error('Vercel same-origin API/Auth proxy is incomplete.');
}

console.log('PASS: AgentPlace Production Milestone 2 identity + durable conversations contract verified.');
