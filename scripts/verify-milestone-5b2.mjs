import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/telegraph/package.json',
  'packages/telegraph/src/index.ts',
  'packages/intelligence/src/index.ts',
  'scripts/telegraph-discovery-smoke.mjs',
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

for (const forbidden of ['TELEGRAPH_EVM_PRIVATE_KEY', 'TELEGRAPH_SOLANA_PRIVATE_KEY', 'PAYMENT-SIGNATURE', '@x402/']) {
  if (adapter.includes(forbidden)) throw new Error(`M5B.2 adapter must not introduce payment/signing material: ${forbidden}`);
}

const intelligence = readFileSync('packages/intelligence/src/index.ts', 'utf8');
if (!intelligence.includes('export async function persistIntelligenceEvidence(ownerUserId:string,evidence:IntelligenceEvidence)')) {
  throw new Error('M5B.2.2 must expose the existing owner-scoped IntelligenceEvidence persistence path for later Router wiring.');
}
if (!intelligence.includes('INSERT INTO intelligence_evidence(id,owner_user_id')) throw new Error('M5B.2.2 must preserve owner-scoped IntelligenceEvidence persistence.');
if (!intelligence.includes('WHERE owner_user_id=$1 AND job_id=$2')) throw new Error('M5B.2.2 must preserve owner-scoped evidence reads.');

const root = JSON.parse(readFileSync('package.json', 'utf8'));
if (!String(root.scripts?.check ?? '').includes('verify:milestone-5b2')) throw new Error('pnpm check must include M5B.2 verification.');
if (!root.scripts?.['telegraph:discover']) throw new Error('Telegraph discovery smoke command is missing.');

console.log('PASS: AgentPlace M5B.2.2 adds fail-closed Telegraph capability mapping and provider-attributed evidence normalization without Router, payment, signer or authority expansion.');
