import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('M5B.1 persists first-class owner-scoped intelligence evidence',()=>{
  const sql=readFileSync('packages/db/migrations/0007_core_intelligence_fabric.sql','utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS intelligence_evidence/);
  assert.match(sql,/owner_user_id uuid NOT NULL/);
  assert.match(sql,/provider_confidence/);
  assert.match(sql,/derivation_version/);
  assert.match(sql,/limitations jsonb/);
});

test('M5B.1 registers direct providers behind canonical capabilities',()=>{
  const sql=readFileSync('packages/db/migrations/0007_core_intelligence_fabric.sql','utf8');
  for(const provider of ['coingecko','dexscreener','nansen','goplus','birdeye','bubblemaps','defillama','blockscout']) assert.match(sql,new RegExp(`'${provider}'`));
  assert.match(sql,/wallet\.cluster\.analyze[^\n]+tested/);
});

test('M5B.1 Router provider eligibility is configuration-aware',()=>{
  const caps=readFileSync('packages/capabilities/src/index.ts','utf8');
  const router=readFileSync('packages/router/src/index.ts','utf8');
  assert.match(caps,/configuredIntelligenceProviders/);
  assert.match(caps,/NANSEN_API_KEY/);
  assert.match(caps,/GOPLUS_APP_KEY/);
  assert.match(caps,/GOPLUS_APP_SECRET/);
  assert.match(caps,/GOPLUS_ACCESS_TOKEN/);
  assert.match(caps,/\['agentplace','dexscreener','defillama','blockscout'\]/);
  assert.match(router,/configuredIntelligenceProviders/);
});

test('M5B.1 Worker sends structured provider evidence into grounded synthesis',()=>{
  const worker=readFileSync('apps/worker/src/index.ts','utf8');
  assert.match(worker,/intelligenceSubjects/);
  assert.match(worker,/collectRoutedIntelligence/);
  assert.match(worker,/intelligenceEvidencePrompt/);
  assert.match(worker,/Structured provider evidence is factual input attributed to its provider/);
});

test('M5B.1 exposes structured evidence progressively without authority expansion',()=>{
  const api=readFileSync('apps/api/src/server.ts','utf8');
  const web=readFileSync('apps/web/src/components/JobWorkspace.tsx','utf8');
  assert.match(api,/intelligence-evidence/);
  assert.match(web,/Structured crypto intelligence/);
  assert.match(web,/not an instruction or financial authorization/);
});


test('M5B.1 GoPlus supports console credentials with automatic token minting',()=>{
  const intel=readFileSync('packages/intelligence/src/index.ts','utf8');
  assert.match(intel,/GOPLUS_APP_KEY/);
  assert.match(intel,/GOPLUS_APP_SECRET/);
  assert.match(intel,/api\/v1\/token/);
  assert.match(intel,/createHash\('sha1'\)/);
  assert.match(intel,/expires_in/);
  assert.match(intel,/GOPLUS_ACCESS_TOKEN/);
});
