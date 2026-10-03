import { existsSync, readFileSync } from 'node:fs';

const required=[
  'packages/db/migrations/0009_telegraph_live_discovery.sql',
  'packages/intelligence/src/telegraph.ts',
  'docs/MILESTONE-5B2.md',
  'docs/MILESTONE-5B2-TESTING.md',
  'docs/MILESTONE-5B2-DEPLOYMENT.md',
  'tests/milestone-5b2-telegraph.test.mjs',
];
for(const file of required) if(!existsSync(file)) throw new Error(`Milestone 5B.2 required file missing: ${file}`);

const migration=readFileSync('packages/db/migrations/0009_telegraph_live_discovery.sql','utf8');
for(const token of ['telegraph_discovery_snapshot','network_environment','miner_count','intent_count','daemon_health']) if(!migration.includes(token)) throw new Error(`M5B.2 migration missing ${token}`);
if(migration.includes('capability_implementation')) throw new Error('M5B.2.1 discovery must not make Telegraph routable yet');

const adapter=readFileSync('packages/intelligence/src/telegraph.ts','utf8');
for(const token of ['devnode.telegraphprotocol.com','/engine/v1/miners','/engine/v1/intents','/daemon/health','discoverTelegraphNetwork','refreshTelegraphDiscovery','persistTelegraphDiscovery']) if(!adapter.includes(token)) throw new Error(`M5B.2.1 adapter missing ${token}`);
if(adapter.includes('TELEGRAPH_EVM_PRIVATE_KEY')) throw new Error('M5B.2.1 must not consume a Telegraph payment private key');

const worker=readFileSync('apps/worker/src/index.ts','utf8');
for(const token of ['refreshTelegraphDiscovery','Telegraph live discovery refreshed','existing AgentPlace routing remains available']) if(!worker.includes(token)) throw new Error(`M5B.2.1 Worker integration missing ${token}`);

console.log('PASS: AgentPlace M5B.2.1 connects production to Telegraph live public discovery without paid inference, wallet authority or routing takeover.');
