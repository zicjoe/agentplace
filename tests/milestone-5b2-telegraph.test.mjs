import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('M5B.2.1 registers durable Telegraph live discovery without capability routing',()=>{
  const sql=readFileSync('packages/db/migrations/0009_telegraph_live_discovery.sql','utf8');
  assert.match(sql,/telegraph_discovery_snapshot/);
  assert.match(sql,/network_environment/);
  assert.match(sql,/miner_count/);
  assert.match(sql,/intent_count/);
  assert.doesNotMatch(sql,/capability_implementation/);
});

test('M5B.2.1 discovers the live public Telegraph network through read-only surfaces',()=>{
  const source=readFileSync('packages/intelligence/src/telegraph.ts','utf8');
  assert.match(source,/https:\/\/devnode\.telegraphprotocol\.com/);
  assert.match(source,/\/engine\/v1\/miners/);
  assert.match(source,/\/engine\/v1\/intents/);
  assert.match(source,/\/daemon\/health/);
  assert.match(source,/Promise\.all/);
  assert.match(source,/status: 'unavailable'/);
  assert.doesNotMatch(source,/TELEGRAPH_EVM_PRIVATE_KEY/);
});

test('M5B.2.1 Worker refreshes discovery without making Telegraph a configured intelligence provider',()=>{
  const worker=readFileSync('apps/worker/src/index.ts','utf8');
  const caps=readFileSync('packages/capabilities/src/index.ts','utf8');
  assert.match(worker,/refreshTelegraphDiscovery/);
  assert.match(worker,/Telegraph live discovery refreshed/);
  assert.doesNotMatch(caps,/providers\.add\('telegraph'\)/);
});

test('M5B.2.1 runtime URL guard rejects credential-bearing and insecure remote node URLs', async()=>{
  const { normalizeTelegraphNodeUrl } = await import('../packages/intelligence/dist/telegraph.js');
  assert.equal(normalizeTelegraphNodeUrl('https://devnode.telegraphprotocol.com/'), 'https://devnode.telegraphprotocol.com');
  assert.equal(normalizeTelegraphNodeUrl('http://localhost:7044/'), 'http://localhost:7044');
  assert.throws(()=>normalizeTelegraphNodeUrl('https://user:pass@example.com'));
  assert.throws(()=>normalizeTelegraphNodeUrl('http://example.com'));
  assert.throws(()=>normalizeTelegraphNodeUrl('https://example.com/engine'));
});
