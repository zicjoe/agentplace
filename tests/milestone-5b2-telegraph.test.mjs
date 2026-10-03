import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { discoverTelegraph, telegraphAdapterConfigFromEnv } from '../packages/telegraph/dist/index.js';

const config = {
  nodeUrl: 'https://telegraph.test',
  engineUrl: 'https://telegraph.test/engine',
  dispatcherUrl: 'https://telegraph.test/miner-dispatcher',
  timeoutMs: 2_000,
  maxResponseBytes: 512_000,
};

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}


test('M5B.2.1 defaults to Telegraph current devnode mounts without requiring secrets', () => {
  const resolved = telegraphAdapterConfigFromEnv({});
  assert.equal(resolved.nodeUrl, 'https://devnode.telegraphprotocol.com');
  assert.equal(resolved.engineUrl, 'https://devnode.telegraphprotocol.com/engine');
  assert.equal(resolved.dispatcherUrl, 'https://devnode.telegraphprotocol.com/miner-dispatcher');
});

test('M5B.2.1 discovers Telegraph miners without invoking or paying them', async () => {
  const calls = [];
  const fakeFetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/status')) return jsonResponse({ publicKey: '0xnode' });
    if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' });
    if (url.endsWith('/integrations')) return jsonResponse([
      {
        id: '18',
        slug: 'bittensor-sn18-zeus',
        name: 'Zeus Weather',
        kind: 'bittensor',
        protocol: 'rest',
        base_url: 'https://miner.invalid',
        endpoints: [{ path: '/predict', method: 'GET', input_schema: { type: 'object' } }],
        supported_intents: ['WEATHER_FORECAST'],
        capabilities: ['weather'],
        cost_per_call: '$0.01 USDC',
      },
    ]);
    if (url.endsWith('/engine/v1/miners')) return jsonResponse({
      count: 1,
      miners: [{ id: '18', slug: 'bittensor-sn18-zeus', name: 'Zeus Weather', capabilities: ['weather'], cost_per_call: '$0.01 USDC', protocol: 'rest' }],
    });
    if (url.endsWith('/engine/v1/intents')) return jsonResponse({
      count: 1,
      intents: [{ intent_id: '0xweather', intent_name: 'WEATHER_FORECAST', miner_count: 1 }],
    });
    if (url.endsWith('/openapi.json')) return jsonResponse({ openapi: '3.0.0', paths: { '/v1/bittensor-sn18-zeus/predict': {} } });
    throw new Error(`unexpected URL ${url}`);
  };

  const snapshot = await discoverTelegraph({ config, fetchImpl: fakeFetch });
  assert.equal(snapshot.status, 'healthy');
  assert.equal(snapshot.environment, 'testnet');
  assert.equal(snapshot.trustLevel, 'experimental');
  assert.equal(snapshot.executionAuthority, 'none');
  assert.equal(snapshot.protocolNetwork, 'base-sepolia');
  assert.equal(snapshot.miners.length, 1);
  assert.deepEqual(snapshot.miners[0].supportedIntents, ['WEATHER_FORECAST']);
  assert.equal(snapshot.miners[0].endpoints[0].path, '/predict');
  assert.equal(snapshot.intents[0].name, 'WEATHER_FORECAST');
  assert.equal(snapshot.dynamicOpenApiPathCount, 1);
  assert.equal(calls.some((url) => url.includes('miner.invalid')), false, 'discovered upstream URLs must never be invoked');
  assert.equal(calls.length, 6);
});

test('M5B.2.1 preserves partial discovery when the known testnet intent registry is unavailable', async () => {
  const fakeFetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/status')) return jsonResponse({ publicKey: '0xnode' });
    if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' });
    if (url.endsWith('/integrations')) return jsonResponse([{ id: '102', slug: 'openai', name: 'OpenAI', endpoints: [], capabilities: ['language'] }]);
    if (url.endsWith('/engine/v1/miners')) return jsonResponse({ miners: [{ id: '102', slug: 'openai', name: 'OpenAI', capabilities: ['language'] }], count: 1 });
    if (url.endsWith('/engine/v1/intents')) return jsonResponse({ error: 'intent_registry missing' }, 500);
    if (url.endsWith('/openapi.json')) return jsonResponse({ openapi: '3.0.0', paths: {} });
    throw new Error(`unexpected URL ${url}`);
  };

  const snapshot = await discoverTelegraph({ config, fetchImpl: fakeFetch });
  assert.equal(snapshot.status, 'degraded');
  assert.equal(snapshot.miners.length, 1);
  assert.equal(snapshot.intents.length, 0);
  assert.ok(snapshot.limitations.some((item) => item.includes('intent registry')));
});

test('M5B.2.1 fails closed when Telegraph discovery is unavailable', async () => {
  const fakeFetch = async () => jsonResponse({ error: 'offline' }, 503);
  const snapshot = await discoverTelegraph({ config, fetchImpl: fakeFetch });
  assert.equal(snapshot.status, 'unavailable');
  assert.equal(snapshot.miners.length, 0);
  assert.ok(snapshot.limitations.some((item) => item.includes('No Telegraph miners/services were discoverable')));
});

test('M5B.2.1 contains no Telegraph signer or x402 payment implementation', () => {
  const source = readFileSync('packages/telegraph/src/index.ts', 'utf8');
  for (const forbidden of ['TELEGRAPH_EVM_PRIVATE_KEY', 'TELEGRAPH_SOLANA_PRIVATE_KEY', 'PAYMENT-SIGNATURE', '@x402/']) {
    assert.equal(source.includes(forbidden), false, `unexpected payment/signing token ${forbidden}`);
  }
});
