import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/telegraph/package.json',
  'packages/telegraph/src/index.ts',
  'packages/telegraph/src/runtime.ts',
  'packages/intelligence/src/index.ts',
  'packages/router/src/index.ts',
  'apps/worker/src/index.ts',
  'packages/db/migrations/0009_telegraph_service_payments.sql',
  'scripts/telegraph-discovery-smoke.mjs',
  'scripts/telegraph-payment-status.mjs',
  'docs/MILESTONE-5B2.md',
  'docs/MILESTONE-5B2-TESTING.md',
  'docs/MILESTONE-5B2-DEPLOYMENT.md',
  'tests/milestone-5b2-telegraph.test.mjs',
];
for (const file of required) if (!existsSync(file)) throw new Error(`Milestone 5B.2 required file missing: ${file}`);

const adapter = readFileSync('packages/telegraph/src/index.ts', 'utf8');
for (const token of [
  'discoverTelegraph',
  'mapTelegraphCapabilities',
  'normalizeTelegraphEvidence',
  '/integrations',
  '/v1/miners',
  '/v1/intents',
  '/openapi.json',
  '/healthz',
  '/status',
  "trustLevel: 'experimental'",
  "executionAuthority: 'none'",
  "protocolNetwork: 'base-sepolia'",
  'No Telegraph capability should be considered routable',
  'never calls arbitrary miner URLs directly',
  'No exact mapping exists to the current AgentPlace canonical capability vocabulary',
  'Telegraph protocol settlement runs on Base Sepolia, but that payment/protocol network is not treated as the intelligence subject network',
  'telegraph-testnet-evidence-v1',
]) if (!adapter.includes(token)) throw new Error(`M5B.2 Telegraph adapter missing ${token}`);

// Discovery/evidence normalization remains secret-free. The one dedicated x402 key is isolated in runtime.ts only.
for (const forbidden of ['TELEGRAPH_EVM_PRIVATE_KEY', 'TELEGRAPH_SOLANA_PRIVATE_KEY', 'PAYMENT-SIGNATURE', 'NANSEN_API_KEY', 'GOPLUS_APP_SECRET']) {
  if (adapter.includes(forbidden)) throw new Error(`Base Telegraph adapter must remain payment/provider-secret free: ${forbidden}`);
}

const runtime = readFileSync('packages/telegraph/src/runtime.ts', 'utf8');
for (const token of [
  "const TELEGRAPH_PAYMENT_NETWORK = 'eip155:84532'",
  "const TELEGRAPH_PROTOCOL_NETWORK = 'base-sepolia'",
  "const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'",
  'HARD_MAX_CALL_ATOMIC = 20_000n',
  'HARD_MAX_JOB_ATOMIC = 100_000n',
  'HARD_MAX_CALLS_PER_JOB = 10',
  'TELEGRAPH_SERVICE_PAYMENT_ENABLED',
  'TELEGRAPH_EVM_PRIVATE_KEY',
  "invocationKind: 'telegraph-direct-x402'",
  '/v1/ask/',
  "'PAYMENT-SIGNATURE'",
  "redirect: 'error'",
  'pg_advisory_xact_lock',
  'PAID_REQUEST_OUTCOME_UNKNOWN',
  'AgentPlace will not retry or issue another payment for the same request',
  'service-payment-only',
]) if (!runtime.includes(token)) throw new Error(`M5B.2.3 Telegraph runtime missing ${token}`);
for (const forbidden of ['NANSEN_API_KEY', 'GOPLUS_APP_SECRET', 'ALCHEMY_API_KEY', 'ETHERSCAN_API_KEY', 'VITE_TELEGRAPH_EVM_PRIVATE_KEY']) {
  if (runtime.includes(forbidden)) throw new Error(`M5B.2.3 runtime must not couple Telegraph payment authority to provider/browser credentials: ${forbidden}`);
}

const router = readFileSync('packages/router/src/index.ts', 'utf8');
for (const token of [
  'telegraphRouterImplementations',
  "implementation.provider === 'telegraph' && implementation.invocationKind === 'telegraph-direct-x402'",
  'implementationTrustRank',
  'const allImplementations: CapabilityImplementation[] = [...implementations, ...telegraphImplementations]',
]) if (!router.includes(token)) throw new Error(`M5B.2.3 Router wiring missing ${token}`);
if (router.includes("trustStatus === 'experimental') return true")) throw new Error('Router must not broadly authorize all experimental implementations.');

const intelligence = readFileSync('packages/intelligence/src/index.ts', 'utf8');
for (const token of [
  'normalizeTelegraphMappedInvocation',
  'collectRoutedIntelligenceWithFallback',
  "if(evidence.status==='verified'||evidence.status==='partial') break",
  'INSERT INTO intelligence_evidence(id,owner_user_id',
  'WHERE owner_user_id=$1 AND job_id=$2',
]) if (!intelligence.includes(token)) throw new Error(`M5B.2.3 intelligence/fallback path missing ${token}`);

const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
for (const token of [
  'routedProvidersForCapability(route, capability.capabilityId)',
  'collectRoutedIntelligenceWithFallback',
]) if (!worker.includes(token)) throw new Error(`M5B.2.3 Worker fallback wiring missing ${token}`);

const migration = readFileSync('packages/db/migrations/0009_telegraph_service_payments.sql', 'utf8');
for (const token of [
  'CREATE TABLE IF NOT EXISTS telegraph_service_payment',
  "payment_network = 'eip155:84532'",
  'UNIQUE(owner_user_id, job_id, request_fingerprint)',
  "status IN ('reserved','settled','failed','released','unknown')",
]) if (!migration.includes(token)) throw new Error(`M5B.2.3 service-payment ledger missing ${token}`);
for (const forbidden of ['authority_grant', 'wallet_connection', 'agent_account']) {
  if (migration.toLowerCase().includes(forbidden)) throw new Error(`Telegraph service-spend ledger must not grant user financial authority: ${forbidden}`);
}

const envExample = readFileSync('.env.example', 'utf8');
for (const token of [
  'TELEGRAPH_SERVICE_PAYMENT_ENABLED=false',
  'TELEGRAPH_EVM_PRIVATE_KEY=',
  'TELEGRAPH_X402_MAX_CALL_USDC=0.02',
  'TELEGRAPH_X402_MAX_JOB_USDC=0.10',
  'TELEGRAPH_X402_MAX_CALLS_PER_JOB=10',
]) if (!envExample.includes(token)) throw new Error(`M5B.2.3 environment contract missing ${token}`);
if (envExample.includes('VITE_TELEGRAPH_EVM_PRIVATE_KEY')) throw new Error('Telegraph service-payment key must never be browser-visible.');

const root = JSON.parse(readFileSync('package.json', 'utf8'));
if (root.version !== '0.8.2') throw new Error('M5B.2.3 root version must be 0.8.2.');
if (!String(root.scripts?.check ?? '').includes('verify:milestone-5b2')) throw new Error('pnpm check must include M5B.2 verification.');
if (!root.scripts?.['telegraph:discover']) throw new Error('Telegraph discovery smoke command is missing.');
if (!root.scripts?.['telegraph:payment-status']) throw new Error('Safe Telegraph payment-status command is missing.');

console.log('PASS: AgentPlace M5B.2.3 keeps AgentPlace Router authoritative, adds bounded Base-Sepolia x402 service payment, owner/job spend accounting, direct Telegraph invocation, and Router-ordered fallback without user-wallet authority.');
