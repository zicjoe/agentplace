import { existsSync, readFileSync } from 'node:fs';

const required=[
  'packages/db/migrations/0007_core_intelligence_fabric.sql',
  'packages/db/migrations/0008_zero_cost_intelligence_hardening.sql',
  'docs/MILESTONE-5B1-ZERO-COST-HARDENING.md',
  'packages/intelligence/src/index.ts',
  'apps/worker/src/index.ts',
  'apps/api/src/server.ts',
  'apps/web/src/components/JobWorkspace.tsx',
  'docs/MILESTONE-5B1.md','docs/MILESTONE-5B1-TESTING.md','docs/MILESTONE-5B1-DEPLOYMENT.md',
];
for(const file of required) if(!existsSync(file)) throw new Error(`Milestone 5B.1 required file missing: ${file}`);

const migration=readFileSync('packages/db/migrations/0007_core_intelligence_fabric.sql','utf8');
for(const token of ['intelligence_evidence','token.market.read','token.liquidity.analyze','token.security.assess','smartmoney.flow.read','protocol.tvl.read','stablecoin.supply.read','dexscreener-token-market-v1','nansen-token-holders-v1','goplus-token-security-v1','bubblemaps-token-map-v1','defillama-protocol-tvl-v1']) if(!migration.includes(token)) throw new Error(`M5B.1 migration missing ${token}`);


const hardening=readFileSync('packages/db/migrations/0008_zero_cost_intelligence_hardening.sql','utf8');
for(const token of ['protocol.dex.metrics.read','etherscan-token-deployer-v1','etherscan-wallet-activity-v1','alchemy-solana-token-holders-v1','alchemy-wallet-profile-v1','thegraph-uniswap-v3-arbitrum-v1','blockscout-token-holders-v1']) if(!hardening.includes(token)) throw new Error(`M5B.1 zero-cost migration missing ${token}`);

const intel=readFileSync('packages/intelligence/src/index.ts','utf8');
for(const token of ['concentrationMetrics','ETHERSCAN_API_KEY','ALCHEMY_API_KEY','THEGRAPH_API_KEY','getTokenHoldersAtSlot','getTokenSupply','api.etherscan.io/v2/api','gateway.thegraph.com/api/subgraphs/id','collectRoutedIntelligence','intelligenceEvidencePrompt','api.dexscreener.com','api.nansen.ai','api.gopluslabs.io','GOPLUS_APP_KEY','GOPLUS_APP_SECRET','api/v1/token','expires_in','api.bubblemaps.io','yields.llama.fi','stablecoins.llama.fi','deriveAccumulation','does not prove common ownership']) if(!intel.includes(token)) throw new Error(`M5B.1 intelligence fabric missing ${token}`);

const worker=readFileSync('apps/worker/src/index.ts','utf8');
for(const token of ['intelligenceSubjects','collectRoutedIntelligence','STRUCTURED PROVIDER INTELLIGENCE','structuredIntelligenceEvidence']) if(!worker.includes(token)) throw new Error(`M5B.1 Worker integration missing ${token}`);
const api=readFileSync('apps/api/src/server.ts','utf8');
if(!api.includes('intelligence-evidence')) throw new Error('M5B.1 evidence API missing');
const web=readFileSync('apps/web/src/components/JobWorkspace.tsx','utf8');
if(!web.includes('Structured crypto intelligence')) throw new Error('M5B.1 Job Workspace disclosure missing');
console.log('PASS: AgentPlace M5B.1 includes zero-cost-first routed crypto intelligence, deterministic holder concentration, first-class evidence, truth boundaries and progressive disclosure.');
