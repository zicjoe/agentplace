import {
  bindTelegraphSubjectPayload,
  loadTelegraphRuntimeCatalog,
  telegraphServicePaymentStatusFromEnv,
} from '../packages/telegraph/dist/runtime.js';

function subjectFromEnv(env = process.env) {
  const kind = (env.TELEGRAPH_ACCEPTANCE_SUBJECT_KIND ?? 'token').trim().toLowerCase();
  if (!['token', 'wallet', 'protocol', 'stablecoin'].includes(kind)) {
    throw new Error('TELEGRAPH_ACCEPTANCE_SUBJECT_KIND must be token, wallet, protocol or stablecoin.');
  }
  const query = (env.TELEGRAPH_ACCEPTANCE_QUERY ?? '').trim();
  if (!query) {
    throw new Error('TELEGRAPH_ACCEPTANCE_QUERY is required for the live acceptance plan.');
  }
  const network = (env.TELEGRAPH_ACCEPTANCE_NETWORK ?? '').trim();
  const address = (env.TELEGRAPH_ACCEPTANCE_ADDRESS ?? '').trim();
  return {
    kind,
    query,
    ...(network ? { network } : {}),
    ...(address ? { address } : {}),
  };
}

const subject = subjectFromEnv();
const status = telegraphServicePaymentStatusFromEnv(process.env);
const catalog = await loadTelegraphRuntimeCatalog({ env: process.env, forceRefresh: true });


const RELEVANT_TELEGRAPH_INTENTS = new Set([
  'CRYPTO_PRICE',
  'LIQUIDITY_DEPTH_VERIFY',
  'TOKEN_HOLDER_COUNT',
  'SMART_CONTRACT_AUDIT',
  'TVL_LOOKUP',
  'CRYPTO_YIELD_RATE',
  'ONCHAIN_METRIC_VERIFY',
  'WALLET_BALANCE_CHECK',
  'ONCHAIN_TX_LOOKUP',
  'TOKEN_TOTAL_SUPPLY_VERIFY',
  'ASSET_RESERVE_ATTESTATION',
  'WASH_TRADING_DETECTION',
  'CROSS_CHAIN_STATE_VERIFY',
  'CRYPTO_TRANSFER_VERIFY',
  'GAS_PRICE',
]);

const intentAvailability = catalog.snapshot.intents
  .filter((intent) => RELEVANT_TELEGRAPH_INTENTS.has(intent.name.trim().toUpperCase()))
  .map((intent) => ({ name: intent.name, minerCount: intent.minerCount ?? null }))
  .sort((left, right) => (right.minerCount ?? -1) - (left.minerCount ?? -1) || left.name.localeCompare(right.name));

const declaredRelevantSupply = catalog.snapshot.miners
  .filter((miner) => miner.supportedIntents.some((intent) => RELEVANT_TELEGRAPH_INTENTS.has(intent.trim().toUpperCase())))
  .slice(0, 50)
  .map((miner) => ({
    id: miner.id,
    slug: miner.slug,
    name: miner.name,
    activationStatus: miner.activationStatus ?? null,
    supportedIntents: miner.supportedIntents.filter((intent) => RELEVANT_TELEGRAPH_INTENTS.has(intent.trim().toUpperCase())),
    endpointCount: miner.endpoints.length,
  }));

const mappingDiagnostics = catalog.report.mappings
  .filter((mapping) => mapping.matchedIntents.some((intent) => RELEVANT_TELEGRAPH_INTENTS.has(intent.trim().toUpperCase())))
  .slice(0, 50)
  .map((mapping) => {
    const binding = bindTelegraphSubjectPayload(mapping, subject);
    const schema = mapping.endpoint?.inputSchema;
    const properties = schema && typeof schema.properties === 'object' && schema.properties && !Array.isArray(schema.properties)
      ? Object.keys(schema.properties)
      : [];
    const required = schema && Array.isArray(schema.required)
      ? schema.required.filter((item) => typeof item === 'string')
      : [];
    return {
      implementationId: mapping.implementationId,
      capabilityId: mapping.canonicalCapabilityId,
      serviceId: mapping.service.id,
      serviceSlug: mapping.service.slug,
      matchedIntents: mapping.matchedIntents,
      status: mapping.status,
      routerReady: mapping.routerReady,
      endpoint: mapping.endpoint ? `${mapping.endpoint.method ?? 'ANY'} ${mapping.endpoint.path}` : null,
      hasInputSchema: Boolean(schema),
      inputKeys: properties,
      requiredInputKeys: required,
      subjectNetworks: mapping.subjectNetworks,
      networkSupportSource: mapping.networkSupportSource,
      bindingOk: binding.ok,
      bindingReason: binding.reason ?? null,
    };
  });

const candidates = catalog.mappings
  .filter((mapping) => mapping.routerReady)
  .map((mapping) => ({ mapping, binding: bindTelegraphSubjectPayload(mapping, subject) }))
  .filter((item) => item.binding.ok)
  .map(({ mapping, binding }) => ({
    implementationId: mapping.implementationId,
    capabilityId: mapping.canonicalCapabilityId,
    serviceId: mapping.service.id,
    serviceSlug: mapping.service.slug,
    serviceName: mapping.service.name,
    endpoint: mapping.endpoint ? `${mapping.endpoint.method ?? 'ANY'} ${mapping.endpoint.path}` : null,
    subjectNetworks: mapping.subjectNetworks,
    networkSupportSource: mapping.networkSupportSource,
    costPerCall: mapping.costPerCall ?? null,
    minPriceUsdc: mapping.minPriceUsdc ?? null,
    boundInputKeys: Object.keys(binding.payload ?? {}),
  }));

const output = {
  milestone: 'M5B.2.4',
  mode: 'live-testnet-acceptance-plan',
  generatedAt: new Date().toISOString(),
  discovery: {
    provider: catalog.snapshot.provider,
    environment: catalog.snapshot.environment,
    trustLevel: catalog.snapshot.trustLevel,
    executionAuthority: catalog.snapshot.executionAuthority,
    protocolNetwork: catalog.snapshot.protocolNetwork,
    status: catalog.snapshot.status,
    miners: catalog.snapshot.miners.length,
    intents: catalog.snapshot.intents.length,
    semanticMappings: catalog.report.mappings.length,
    semanticRouterReadyMappings: catalog.report.mappings.filter((item) => item.routerReady).length,
    mappedImplementations: catalog.mappings.length,
    routerReadyMappings: catalog.mappings.filter((item) => item.routerReady).length,
    sourceHealth: catalog.snapshot.sources.map((source) => ({
      kind: source.kind,
      ok: source.ok,
      statusCode: source.statusCode ?? null,
      error: source.error ?? null,
    })),
    intentAvailability,
    declaredRelevantSupply,
    mappingDiagnostics,
  },
  paymentBoundary: {
    enabled: status.enabled,
    ready: status.ready,
    network: status.network,
    caip2Network: status.caip2Network,
    asset: status.asset,
    payerAddress: status.payerAddress ?? null,
    maxCallUsdc: status.maxCallUsdc,
    maxJobUsdc: status.maxJobUsdc,
    maxCallsPerJob: status.maxCallsPerJob,
    reason: status.reason ?? null,
  },
  subject: {
    kind: subject.kind,
    network: subject.network ?? null,
    hasAddress: Boolean(subject.address),
    queryLength: subject.query.length,
  },
  candidates,
  nextStep: candidates.length
    ? 'Choose exactly one implementationId and set TELEGRAPH_ACCEPTANCE_IMPLEMENTATION_ID before the live run.'
    : 'No router-ready Telegraph mapping can safely bind this subject. Do not run a paid acceptance call.',
};

console.log(JSON.stringify(output, null, 2));

if (catalog.snapshot.status === 'unavailable') process.exitCode = 2;
else if (!candidates.length) process.exitCode = 3;
