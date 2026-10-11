import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  discoverTelegraph,
  mapTelegraphCapabilities,
  normalizeTelegraphEvidence,
  telegraphAdapterConfigFromEnv,
} from '../packages/telegraph/dist/index.js';
import {
  bindTelegraphSubjectPayload,
  selectTelegraphPaymentChallenge,
  telegraphServicePaymentStatusFromEnv,
} from '../packages/telegraph/dist/runtime.js';

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
    if (url.endsWith('/api/miners')) return jsonResponse([{ id: '18', slug: 'bittensor-sn18-zeus', name: 'Zeus Weather', endpoints: [{ path: '/predict', method: 'GET', input_schema: { type: 'object' } }], supported_intents: ['WEATHER_FORECAST'], capabilities: ['weather'], min_price_usdc: 10000, activation_status: 'active' }]);
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
  assert.equal(calls.length, 7);
});

test('M5B.2.1 preserves partial discovery when the known testnet intent registry is unavailable', async () => {
  const fakeFetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/status')) return jsonResponse({ publicKey: '0xnode' });
    if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' });
    if (url.endsWith('/api/miners')) return jsonResponse([{ id: '102', slug: 'openai', name: 'OpenAI', endpoints: [], capabilities: ['language'], activation_status: 'active' }]);
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



test('M5B.2.4 current live catalogue semantics and top-level schemas remain discoverable without payment', async () => {
  const fakeFetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/status')) return jsonResponse({ publicKey: '0xnode' });
    if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' });
    if (url.endsWith('/api/miners')) return jsonResponse([
      {
        id: 501,
        slug: 'crypto-price-current',
        name: 'Crypto Price Current',
        activation_status: 'active',
        semantics: { supported_intents: ['CRYPTO_PRICE'] },
        endpoints: [{ path: '/price', method: 'POST', description: 'Crypto price lookup' }],
        input_schema: {
          type: 'object',
          required: ['symbol', 'network'],
          properties: {
            symbol: { type: 'string' },
            network: { type: 'string', enum: ['ethereum', 'base', 'arbitrum'] },
          },
        },
        output_schema: { type: 'object', properties: { price: { type: 'number' } } },
        min_price_usdc: 0.01,
      },
    ]);
    if (url.endsWith('/integrations')) return jsonResponse([]);
    if (url.endsWith('/engine/v1/miners')) return jsonResponse({ miners: [], count: 0 });
    if (url.endsWith('/engine/v1/intents')) return jsonResponse({
      count: 1,
      intents: [{ intent_id: '0xprice', intent_name: 'CRYPTO_PRICE', miner_count: 1 }],
    });
    if (url.endsWith('/openapi.json')) return jsonResponse({ openapi: '3.0.0', paths: {} });
    throw new Error(`unexpected URL ${url}`);
  };

  const result = await discoverTelegraph({ config, fetchImpl: fakeFetch });
  assert.equal(result.miners.length, 1);
  assert.deepEqual(result.miners[0].supportedIntents, ['CRYPTO_PRICE']);
  assert.deepEqual(result.miners[0].endpoints[0].inputSchema.required, ['symbol', 'network']);
  const report = mapTelegraphCapabilities(result);
  assert.equal(report.mappings.length, 1);
  assert.equal(report.mappings[0].canonicalCapabilityId, 'token.market.read');
  assert.equal(report.mappings[0].routerReady, true);
});

test('M5B.2.4 preserves richer live API endpoint schemas when dispatcher discovery repeats the same endpoint', async () => {
  const fakeFetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/status')) return jsonResponse({ publicKey: '0xnode' });
    if (url.endsWith('/healthz')) return jsonResponse({ status: 'ok' });
    if (url.endsWith('/api/miners')) return jsonResponse([
      {
        id: 777,
        slug: 'crypto-price-merge-regression',
        name: 'Crypto Price Merge Regression',
        activation_status: 'active',
        supported_intents: ['CRYPTO_PRICE'],
        endpoints: [{ path: '/price', method: 'POST', description: 'Crypto price lookup' }],
        input_schema: {
          type: 'object',
          required: ['symbol', 'network'],
          properties: {
            symbol: { type: 'string' },
            network: { type: 'string', enum: ['ethereum', 'base', 'arbitrum'] },
          },
        },
      },
    ]);
    if (url.endsWith('/integrations')) return jsonResponse([
      {
        id: '777',
        slug: 'crypto-price-merge-regression',
        name: 'Crypto Price Merge Regression',
        semantics: { supported_intents: ['CRYPTO_PRICE'] },
        endpoints: [{ path: '/price', method: 'POST', description: 'Crypto price lookup' }],
      },
    ]);
    if (url.endsWith('/engine/v1/miners')) return jsonResponse({ miners: [], count: 0 });
    if (url.endsWith('/engine/v1/intents')) return jsonResponse({
      count: 1,
      intents: [{ intent_id: '0xprice', intent_name: 'CRYPTO_PRICE', miner_count: 1 }],
    });
    if (url.endsWith('/openapi.json')) return jsonResponse({ openapi: '3.0.0', paths: {} });
    throw new Error(`unexpected URL ${url}`);
  };

  const result = await discoverTelegraph({ config, fetchImpl: fakeFetch });
  assert.equal(result.miners.length, 1);
  assert.deepEqual(result.miners[0].endpoints[0].inputSchema.required, ['symbol', 'network']);
  const report = mapTelegraphCapabilities(result);
  assert.equal(report.mappings.length, 1);
  assert.equal(report.mappings[0].routerReady, true);
  assert.equal(report.mappings[0].networkSupportSource, 'declared-schema');
});

test('M5B.2.4 recognizes only current Telegraph Web3 intents with exact existing AgentPlace boundaries', () => {
  const makeMiner = (id, intent, path, keyword) => ({
    id,
    slug: `miner-${id}`,
    name: `Miner ${id}`,
    capabilities: [],
    supportedIntents: [intent],
    endpoints: [{
      path,
      method: 'POST',
      summary: keyword,
      inputSchema: { type: 'object', properties: { network: { enum: ['ethereum', 'base'] } } },
    }],
    activationStatus: 'active',
    discoverySources: ['engine'],
  });

  const report = mapTelegraphCapabilities(snapshot([
    makeMiner('601', 'LIQUIDITY_DEPTH_VERIFY', '/liquidity', 'liquidity depth'),
    makeMiner('603', 'SMART_CONTRACT_AUDIT', '/audit', 'contract security audit'),
    makeMiner('604', 'TVL_LOOKUP', '/tvl', 'protocol tvl'),
    makeMiner('605', 'CRYPTO_YIELD_RATE', '/yield', 'yield apy'),
    makeMiner('607', 'WASH_TRADING_DETECTION', '/wash', 'wash trading'),
  ]));

  const mapped = new Map(report.mappings.map((item) => [item.matchedIntents[0], item.canonicalCapabilityId]));
  assert.equal(mapped.get('LIQUIDITY_DEPTH_VERIFY'), 'token.liquidity.analyze');
  assert.equal(mapped.get('SMART_CONTRACT_AUDIT'), 'token.security.assess');
  assert.equal(mapped.get('TVL_LOOKUP'), 'protocol.tvl.read');
  assert.equal(mapped.get('CRYPTO_YIELD_RATE'), 'protocol.yield.read');
  assert.equal(mapped.has('WASH_TRADING_DETECTION'), false);
  assert.ok(report.unmapped.some((item) => item.supportedIntents.includes('WASH_TRADING_DETECTION')));

  const deliberatelyUnmapped = mapTelegraphCapabilities(snapshot([
    makeMiner('608', 'TOKEN_HOLDER_COUNT', '/holders', 'holder count'),
    makeMiner('609', 'ONCHAIN_METRIC_VERIFY', '/metrics', 'onchain metric verify'),
  ]));
  assert.equal(deliberatelyUnmapped.mappings.length, 0);
  assert.equal(deliberatelyUnmapped.unmapped.length, 2);
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

test('M5B.2.3 service-payment status requires explicit enablement and a dedicated valid EVM key', () => {
  const disabled = telegraphServicePaymentStatusFromEnv({});
  assert.equal(disabled.ready, false);
  assert.equal(disabled.enabled, false);

  const testOnlyKey = `0x${'11'.repeat(32)}`;
  const enabled = telegraphServicePaymentStatusFromEnv({
    TELEGRAPH_SERVICE_PAYMENT_ENABLED: 'true',
    TELEGRAPH_EVM_PRIVATE_KEY: testOnlyKey,
  });
  assert.equal(enabled.ready, true);
  assert.equal(enabled.network, 'base-sepolia');
  assert.equal(enabled.caip2Network, 'eip155:84532');
  assert.equal(enabled.asset.toLowerCase(), '0x036cbd53842c5426634e7929541ec2318f3dcf7e');
  assert.equal(enabled.maxCallUsdc, '0.02');
  assert.equal(enabled.maxJobUsdc, '0.1');
  assert.equal(enabled.maxCallsPerJob, 10);
  assert.ok(/^0x[0-9a-fA-F]{40}$/.test(enabled.payerAddress));
  assert.equal(JSON.stringify(enabled).includes(testOnlyKey), false, 'status output must never reveal the private key');

  const invalidLimit = telegraphServicePaymentStatusFromEnv({
    TELEGRAPH_SERVICE_PAYMENT_ENABLED: 'true',
    TELEGRAPH_EVM_PRIVATE_KEY: testOnlyKey,
    TELEGRAPH_X402_MAX_CALL_USDC: 'not-a-number',
  });
  assert.equal(invalidLimit.ready, false, 'malformed explicit spend controls must fail closed');
  assert.match(invalidLimit.reason, /invalid telegraph service-spend limit/i);
});

test('M5B.2.3 x402 policy accepts only exact Base Sepolia test-USDC payment within hard per-call bounds', () => {
  const requestUrl = 'https://telegraph.test/engine/v1/ask/301';
  const valid = {
    x402Version: 2,
    resource: { url: requestUrl, description: 'Telegraph direct miner inference', mimeType: 'application/json' },
    accepts: [{
      scheme: 'exact',
      network: 'eip155:84532',
      amount: '10000',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      payTo: '0x1111111111111111111111111111111111111111',
      maxTimeoutSeconds: 60,
      extra: { name: 'USD Coin', version: '2', assetTransferMethod: 'eip3009' },
    }],
    extensions: {},
  };
  const accepted = selectTelegraphPaymentChallenge(valid, requestUrl, {});
  assert.equal(accepted.requirement?.amount, '10000');

  const documentedResourceShape = structuredClone(valid);
  documentedResourceShape.resource.url = 'http://telegraph.test/v1/ask/301';
  const documentedAccepted = selectTelegraphPaymentChallenge(documentedResourceShape, requestUrl, {});
  assert.equal(documentedAccepted.requirement?.amount, '10000', 'current Telegraph x402 resource.url may omit /engine and report http for the same node/path');

  const wrongNetwork = structuredClone(valid);
  wrongNetwork.accepts[0].network = 'eip155:8453';
  assert.equal(selectTelegraphPaymentChallenge(wrongNetwork, requestUrl, {}).requirement, undefined);

  const wrongAsset = structuredClone(valid);
  wrongAsset.accepts[0].asset = '0x2222222222222222222222222222222222222222';
  assert.equal(selectTelegraphPaymentChallenge(wrongAsset, requestUrl, {}).requirement, undefined);

  const tooExpensive = structuredClone(valid);
  tooExpensive.accepts[0].amount = '20001';
  assert.equal(selectTelegraphPaymentChallenge(tooExpensive, requestUrl, {}).requirement, undefined);

  const wrongResource = structuredClone(valid);
  wrongResource.resource.url = 'https://attacker.invalid/pay';
  assert.equal(selectTelegraphPaymentChallenge(wrongResource, requestUrl, {}).requirement, undefined);

  const unsupportedExtension = structuredClone(valid);
  unsupportedExtension.extensions = { arbitrary: { enabled: true } };
  assert.equal(selectTelegraphPaymentChallenge(unsupportedExtension, requestUrl, {}).requirement, undefined);
});

test('M5B.2.3 binds only declared Telegraph input fields from the AgentPlace intelligence subject', () => {
  const mapping = mapTelegraphCapabilities(snapshot([{
    id: '401',
    slug: 'holder-input-miner',
    name: 'Holder Input Miner',
    capabilities: ['TOKEN_HOLDERS'],
    supportedIntents: ['TOKEN_HOLDERS'],
    endpoints: [{
      path: '/holders',
      method: 'POST',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          network: { type: 'string', enum: ['ethereum', 'base', 'arbitrum'] },
        },
        required: ['address', 'network'],
      },
    }],
    discoverySources: ['dispatcher'],
  }])).mappings[0];
  const bound = bindTelegraphSubjectPayload(mapping, { kind: 'token', query: 'ARB', address: '0x1111111111111111111111111111111111111111', network: 'arbitrum' });
  assert.deepEqual(bound, { ok: true, payload: { address: '0x1111111111111111111111111111111111111111', network: 'arbitrum' } });

  const unknownRequired = structuredClone(mapping);
  unknownRequired.endpoint.inputSchema.required.push('apiSecret');
  unknownRequired.endpoint.inputSchema.properties.apiSecret = { type: 'string' };
  const rejected = bindTelegraphSubjectPayload(unknownRequired, { kind: 'token', query: 'ARB', address: '0x1111111111111111111111111111111111111111', network: 'arbitrum' });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /cannot be bound|cannot be derived/i);
});

test('M5B.2.3 Router registers Telegraph only as the narrow experimental direct-x402 implementation and orders trusted supply first', () => {
  const source = readFileSync('packages/router/src/index.ts', 'utf8');
  assert.match(source, /telegraphRouterImplementations/);
  assert.match(source, /implementation\.provider === 'telegraph' && implementation\.invocationKind === 'telegraph-direct-x402'/);
  assert.match(source, /implementationTrustRank/);
  assert.match(source, /trust !== 0/);
  assert.doesNotMatch(source, /trustStatus === 'experimental'\) return true/);
});

test('M5B.2.3 Worker executes Router-ordered structured-intelligence fallback instead of a Telegraph-only path', () => {
  const intelligence = readFileSync('packages/intelligence/src/index.ts', 'utf8');
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  assert.match(intelligence, /collectRoutedIntelligenceWithFallback/);
  assert.match(intelligence, /if\(evidence\.status==='verified'\|\|evidence\.status==='partial'\) break/);
  assert.match(worker, /routedProvidersForCapability\(route, capability\.capabilityId\)/);
  assert.match(worker, /collectRoutedIntelligenceWithFallback/);
});

test('M5B.2.3 keeps x402 payment authority isolated from user wallets and provider credentials', () => {
  const runtime = readFileSync('packages/telegraph/src/runtime.ts', 'utf8');
  assert.match(runtime, /PAYMENT-SIGNATURE/);
  assert.match(runtime, /redirect: 'error'/);
  assert.match(runtime, /\/v1\/ask\//);
  assert.match(runtime, /pg_advisory_xact_lock/);
  assert.match(runtime, /HARD_MAX_CALL_ATOMIC = 20_000n/);
  assert.match(runtime, /HARD_MAX_JOB_ATOMIC = 100_000n/);
  assert.match(runtime, /HARD_MAX_CALLS_PER_JOB = 10/);
  for (const forbidden of ['NANSEN_API_KEY', 'GOPLUS_APP_SECRET', 'ALCHEMY_API_KEY', 'ETHERSCAN_API_KEY', 'privateKey: input.subject', 'miner.upstream']) {
    assert.equal(runtime.includes(forbidden), false, `unexpected secret/authority coupling: ${forbidden}`);
  }
});

test('M5B.2.3 adds an owner/job-scoped replay-safe service-spend ledger without user-capital authority', () => {
  const migration = readFileSync('packages/db/migrations/0009_telegraph_service_payments.sql', 'utf8');
  assert.match(migration, /owner_user_id uuid NOT NULL REFERENCES app_user/);
  assert.match(migration, /UNIQUE\(owner_user_id, job_id, request_fingerprint\)/);
  assert.match(migration, /payment_network = 'eip155:84532'/);
  assert.match(migration, /status IN \('reserved','settled','failed','released','unknown'\)/);
  assert.doesNotMatch(migration, /authority_grant|wallet_connection|agent_account/i);
});

test('M5B.2.4 acceptance planning is discovery-only and cannot send a payment authorization', () => {
  const source = readFileSync('scripts/telegraph-live-acceptance-plan.mjs', 'utf8');
  assert.match(source, /loadTelegraphRuntimeCatalog/);
  assert.match(source, /bindTelegraphSubjectPayload/);
  assert.match(source, /Choose exactly one implementationId/);
  assert.doesNotMatch(source, /normalizeTelegraphMappedInvocation|invokeTelegraphMappedService|PAYMENT-SIGNATURE|TELEGRAPH_EVM_PRIVATE_KEY/);
});

test('M5B.2.4 live acceptance requires explicit arming and one exact planned implementation', () => {
  const source = readFileSync('scripts/telegraph-live-acceptance-run.mjs', 'utf8');
  assert.match(source, /TELEGRAPH_LIVE_ACCEPTANCE_ENABLED/);
  assert.match(source, /ONE_BOUNDED_TESTNET_X402_CALL/);
  assert.match(source, /TELEGRAPH_ACCEPTANCE_IMPLEMENTATION_ID/);
  assert.match(source, /The chosen Telegraph implementation is not currently present as a router-ready live mapping/);
  assert.match(source, /Expected exactly one settled service-payment row/);
  assert.match(source, /Duplicate-payment protection failed/);
  assert.match(source, /Job-budget rejection failed/);
  assert.match(source, /executionAuthority: 'none'/);
  assert.match(source, /userWalletAuthorityGranted: false/);
  assert.match(source, /agentAccountAuthorityGranted: false/);
  assert.doesNotMatch(source, /console\.log\(process\.env|console\.error\(process\.env|privateKey:/);
});

test('M5B.2.4 stays unfrozen until a real live settlement report passes review', () => {
  const milestone = readFileSync('docs/MILESTONE-5B2.md', 'utf8');
  const acceptance = readFileSync('docs/MILESTONE-5B2-ACCEPTANCE.md', 'utf8');
  const root = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(milestone, /one controlled live testnet pass \+ review is still required before freeze/i);
  assert.match(acceptance, /M5B\.2 remains unfrozen until one deliberate live run passes/i);
  assert.match(acceptance, /do not automatically retry it/i);
  assert.ok(root.scripts['telegraph:acceptance:plan']);
  assert.ok(root.scripts['telegraph:acceptance:run']);
});
