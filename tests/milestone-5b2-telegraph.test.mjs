import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  discoverTelegraph,
  mapTelegraphCapabilities,
  normalizeTelegraphEvidence,
  telegraphAdapterConfigFromEnv,
} from '../packages/telegraph/dist/index.js';

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

function snapshot(miners) {
  return {
    provider: 'telegraph',
    environment: 'testnet',
    trustLevel: 'experimental',
    executionAuthority: 'none',
    protocolNetwork: 'base-sepolia',
    status: 'healthy',
    fetchedAt: '2026-10-03T12:00:00.000Z',
    miners,
    intents: [],
    sources: [],
    limitations: [],
  };
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

  const result = await discoverTelegraph({ config, fetchImpl: fakeFetch });
  assert.equal(result.status, 'healthy');
  assert.equal(result.environment, 'testnet');
  assert.equal(result.trustLevel, 'experimental');
  assert.equal(result.executionAuthority, 'none');
  assert.equal(result.protocolNetwork, 'base-sepolia');
  assert.equal(result.miners.length, 1);
  assert.deepEqual(result.miners[0].supportedIntents, ['WEATHER_FORECAST']);
  assert.equal(result.miners[0].endpoints[0].path, '/predict');
  assert.equal(result.intents[0].name, 'WEATHER_FORECAST');
  assert.equal(result.dynamicOpenApiPathCount, 1);
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

  const result = await discoverTelegraph({ config, fetchImpl: fakeFetch });
  assert.equal(result.status, 'degraded');
  assert.equal(result.miners.length, 1);
  assert.equal(result.intents.length, 0);
  assert.ok(result.limitations.some((item) => item.includes('intent registry')));
});

test('M5B.2.1 fails closed when Telegraph discovery is unavailable', async () => {
  const fakeFetch = async () => jsonResponse({ error: 'offline' }, 503);
  const result = await discoverTelegraph({ config, fetchImpl: fakeFetch });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.miners.length, 0);
  assert.ok(result.limitations.some((item) => item.includes('No Telegraph miners/services were discoverable')));
});

test('M5B.2.2 maps only exact compatible Telegraph semantics into existing AgentPlace capabilities', () => {
  const report = mapTelegraphCapabilities(snapshot([
    {
      id: '301',
      slug: 'token-price-miner',
      name: 'Token Price Miner',
      capabilities: ['TOKEN_PRICE'],
      supportedIntents: ['TOKEN_PRICE'],
      endpoints: [{
        path: '/price',
        method: 'POST',
        summary: 'Return token price',
        inputSchema: { type: 'object', properties: { network: { enum: ['ethereum', 'base', 'arbitrum', 'solana'] } } },
      }],
      discoverySources: ['dispatcher'],
    },
    {
      id: '18',
      slug: 'weather',
      name: 'Weather',
      capabilities: ['weather'],
      supportedIntents: ['WEATHER_FORECAST'],
      endpoints: [{ path: '/forecast', method: 'GET' }],
      discoverySources: ['dispatcher'],
    },
  ]));

  assert.equal(report.mappings.length, 1);
  assert.equal(report.mappings[0].canonicalCapabilityId, 'token.market.read');
  assert.equal(report.mappings[0].status, 'mapped');
  assert.equal(report.mappings[0].routerReady, true);
  assert.deepEqual(report.mappings[0].subjectNetworks.sort(), ['arbitrum', 'base', 'ethereum', 'solana']);
  assert.equal(report.mappings[0].protocolNetwork, 'base-sepolia');
  assert.equal(report.unmapped.length, 1);
  assert.equal(report.unmapped[0].slug, 'weather');
  assert.match(report.unmapped[0].reason, /did not create a new capability/i);
});

test('M5B.2.2 never treats Telegraph Base Sepolia settlement as the intelligence subject network', () => {
  const report = mapTelegraphCapabilities(snapshot([
    {
      id: '302',
      slug: 'holder-miner',
      name: 'Holder Miner',
      capabilities: ['TOKEN_HOLDERS'],
      supportedIntents: ['TOKEN_HOLDERS'],
      endpoints: [{ path: '/holders', method: 'POST', inputSchema: { type: 'object', properties: { address: { type: 'string' } } } }],
      discoverySources: ['dispatcher'],
    },
  ]));
  assert.equal(report.mappings[0].protocolNetwork, 'base-sepolia');
  assert.deepEqual(report.mappings[0].subjectNetworks, []);
  assert.equal(report.mappings[0].networkSupportSource, 'unknown');
  assert.ok(report.mappings[0].limitations.some((item) => item.includes('not treated as the intelligence subject network')));
});

test('M5B.2.2 refuses arbitrary endpoint selection when service discovery is ambiguous', () => {
  const report = mapTelegraphCapabilities(snapshot([
    {
      id: '303',
      slug: 'security-suite',
      name: 'Security Suite',
      capabilities: ['TOKEN_SECURITY'],
      supportedIntents: ['TOKEN_SECURITY'],
      endpoints: [
        { path: '/check-a', method: 'POST', summary: 'Run check' },
        { path: '/check-b', method: 'POST', summary: 'Run check' },
      ],
      discoverySources: ['dispatcher'],
    },
  ]));
  assert.equal(report.mappings[0].status, 'ambiguous');
  assert.equal(report.mappings[0].routerReady, false);
  assert.equal(report.mappings[0].endpoint, undefined);
});

test('M5B.2.2 normalizes Telegraph output into the AgentPlace IntelligenceEvidence contract with explicit provenance', () => {
  const service = {
    id: '304',
    slug: 'token-risk',
    name: 'Token Risk Miner',
    capabilities: ['TOKEN_SECURITY'],
    supportedIntents: ['TOKEN_SECURITY'],
    endpoints: [{ path: '/assess', method: 'POST' }],
    signalMapping: { confidenceField: 'confidence', labelField: 'label', reasonField: 'reason' },
    discoverySources: ['dispatcher'],
  };
  const mapping = mapTelegraphCapabilities(snapshot([service])).mappings[0];
  const evidence = normalizeTelegraphEvidence({
    jobId: 'job_1',
    taskId: 'task_1',
    capabilityId: 'token.security.assess',
    implementationId: mapping.implementationId,
    subject: { kind: 'token', query: '0xabc', network: 'base', address: '0xabc' },
    service,
    mapping,
    fetchedAt: '2026-10-03T12:10:00.000Z',
    config,
    response: {
      miner_used: 'token-risk',
      miner_name: 'Token Risk Miner',
      endpoint: '/assess',
      intent: 'TOKEN_SECURITY',
      result: { label: 'provider-label', reason: 'provider reason', confidence: 0.84, flags: ['example'] },
      cost_usd: 0.01,
      duration_ms: 124,
      timestamp: '2026-10-03T12:09:58.000Z',
      signal_hash: '0xsignal',
    },
  });

  assert.equal(evidence.provider, 'telegraph');
  assert.equal(evidence.status, 'verified');
  assert.equal(evidence.providerConfidence, 0.84);
  assert.equal(evidence.derivationVersion, 'telegraph-testnet-evidence-v1');
  assert.equal(evidence.data.telegraph.environment, 'testnet');
  assert.equal(evidence.data.telegraph.trustLevel, 'experimental');
  assert.equal(evidence.data.telegraph.executionAuthority, 'none');
  assert.equal(evidence.data.telegraph.service.slug, 'token-risk');
  assert.equal(evidence.data.telegraph.providerLabel, 'provider-label');
  assert.equal(evidence.data.result.flags[0], 'example');
  assert.equal(evidence.sourceUrl, 'https://telegraph.test/engine/v1/signal/0xsignal');
  assert.ok(evidence.limitations.some((item) => item.includes('not an AgentPlace Verified economic outcome')));
});

test('M5B.2.2 preserves warnings and errors instead of upgrading them into facts', () => {
  const partial = normalizeTelegraphEvidence({
    jobId: 'job_2',
    taskId: 'task_2',
    capabilityId: 'token.market.read',
    implementationId: 'telegraph:test',
    subject: { kind: 'token', query: 'TEST' },
    config,
    response: { result: { price: 1 }, warnings: ['stale sample'] },
  });
  const failed = normalizeTelegraphEvidence({
    jobId: 'job_3',
    taskId: 'task_3',
    capabilityId: 'token.market.read',
    implementationId: 'telegraph:test',
    subject: { kind: 'token', query: 'TEST' },
    config,
    response: { error: 'miner unavailable' },
  });
  assert.equal(partial.status, 'partial');
  assert.equal(failed.status, 'error');
  assert.equal(failed.data.telegraph.error, 'miner unavailable');
  assert.match(failed.summary, /no finding was asserted/i);
});

test('M5B.2.2 keeps Telegraph evidence persistence on the existing owner-scoped intelligence path', () => {
  const source = readFileSync('packages/intelligence/src/index.ts', 'utf8');
  assert.match(source, /export async function persistIntelligenceEvidence\(ownerUserId:string,evidence:IntelligenceEvidence\)/);
  assert.match(source, /INSERT INTO intelligence_evidence\(id,owner_user_id/);
  assert.match(source, /WHERE owner_user_id=\$1 AND job_id=\$2/);
});

test('M5B.2.2 contains no Telegraph signer or x402 payment implementation', () => {
  const source = readFileSync('packages/telegraph/src/index.ts', 'utf8');
  for (const forbidden of ['TELEGRAPH_EVM_PRIVATE_KEY', 'TELEGRAPH_SOLANA_PRIVATE_KEY', 'PAYMENT-SIGNATURE', '@x402/']) {
    assert.equal(source.includes(forbidden), false, `unexpected payment/signing token ${forbidden}`);
  }
});
