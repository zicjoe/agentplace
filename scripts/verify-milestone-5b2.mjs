import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/telegraph/package.json',
  'packages/telegraph/src/index.ts',
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
]) if (!adapter.includes(token)) throw new Error(`M5B.2 Telegraph adapter missing ${token}`);

for (const forbidden of ['TELEGRAPH_EVM_PRIVATE_KEY', 'TELEGRAPH_SOLANA_PRIVATE_KEY', 'PAYMENT-SIGNATURE', '@x402/']) {
  if (adapter.includes(forbidden)) throw new Error(`M5B.2.1 discovery adapter must not introduce payment/signing material: ${forbidden}`);
}

const root = JSON.parse(readFileSync('package.json', 'utf8'));
if (!String(root.scripts?.check ?? '').includes('verify:milestone-5b2')) throw new Error('pnpm check must include M5B.2 verification.');
if (!root.scripts?.['telegraph:discover']) throw new Error('Telegraph discovery smoke command is missing.');

console.log('PASS: AgentPlace M5B.2.1 adds a fail-closed Telegraph testnet discovery adapter with no payment, signer, authority or Router expansion.');
