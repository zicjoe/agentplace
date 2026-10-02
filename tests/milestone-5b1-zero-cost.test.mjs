import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('M5B.1 zero-cost hardening registers free-tier and no-key implementations',()=>{
  const sql=readFileSync('packages/db/migrations/0008_zero_cost_intelligence_hardening.sql','utf8');
  for(const token of ['etherscan-token-deployer-v1','etherscan-wallet-activity-v1','alchemy-solana-token-holders-v1','alchemy-wallet-profile-v1','thegraph-uniswap-v3-arbitrum-v1']) assert.match(sql,new RegExp(token));
  assert.match(sql,/blockscout-token-holders-v1/);
  assert.match(sql,/protocol\.dex\.metrics\.read/);
});

test('M5B.1 zero-cost hardening keeps provider activation configuration-aware',()=>{
  const caps=readFileSync('packages/capabilities/src/index.ts','utf8');
  for(const key of ['ETHERSCAN_API_KEY','ALCHEMY_API_KEY','THEGRAPH_API_KEY','THEGRAPH_UNISWAP_V3_ARBITRUM_SUBGRAPH_ID']) assert.match(caps,new RegExp(key));
  assert.match(caps,/\['agentplace','dexscreener','defillama','blockscout'\]/);
});

test('M5B.1 calculates holder concentration deterministically from raw evidence',()=>{
  const intel=readFileSync('packages/intelligence/src/index.ts','utf8');
  assert.match(intel,/concentrationMetrics/);
  assert.match(intel,/top1Pct/);
  assert.match(intel,/top5Pct/);
  assert.match(intel,/top10Pct/);
  assert.match(intel,/top20Pct/);
  assert.match(intel,/getTokenHoldersAtSlot/);
  assert.match(intel,/getTokenSupply/);
  assert.match(intel,/getTokenHolders/);
});

test('M5B.1 free-tier adapters preserve bounded truth claims',()=>{
  const intel=readFileSync('packages/intelligence/src/index.ts','utf8');
  assert.match(intel,/Contract creator evidence does not establish real-world identity/);
  assert.match(intel,/not a complete behavioral or performance assessment/);
  assert.match(intel,/schema-pinned The Graph connector is limited to Uniswap V3 on Arbitrum/);
  assert.match(intel,/LP, treasury, burn, bridge, exchange and contract addresses are not automatically excluded/);
});


test('M5B.1 canonicalizes human network aliases before provider eligibility and intelligence resolution',()=>{
  const router=readFileSync('packages/router/src/index.ts','utf8');
  const intel=readFileSync('packages/intelligence/src/index.ts','utf8');
  assert.match(router,/arbitrum one/);
  assert.match(router,/42161/);
  assert.match(router,/args\.proposal\.requestedNetworks\.map\(normalizeNetwork\)/);
  assert.match(intel,/arbitrum one/);
  assert.match(intel,/42161/);
  assert.match(intel,/solana mainnet beta/);
});
