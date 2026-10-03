import {
  discoverTelegraph,
  mapTelegraphCapabilities,
  telegraphAdapterConfigFromEnv,
} from '../packages/telegraph/dist/index.js';

const config = telegraphAdapterConfigFromEnv();
const snapshot = await discoverTelegraph({ config });
const mapping = mapTelegraphCapabilities(snapshot);

const summary = {
  provider: snapshot.provider,
  environment: snapshot.environment,
  trustLevel: snapshot.trustLevel,
  executionAuthority: snapshot.executionAuthority,
  protocolNetwork: snapshot.protocolNetwork,
  status: snapshot.status,
  miners: snapshot.miners.length,
  intents: snapshot.intents.length,
  mappedImplementations: mapping.mappings.length,
  routerReadyMappings: mapping.mappings.filter((item) => item.routerReady).length,
  unmappedServices: mapping.unmapped.length,
  mappings: mapping.mappings.map((item) => ({
    capabilityId: item.canonicalCapabilityId,
    implementationId: item.implementationId,
    service: item.service.slug,
    status: item.status,
    routerReady: item.routerReady,
    endpoint: item.endpoint ? `${item.endpoint.method ?? 'ANY'} ${item.endpoint.path}` : null,
    subjectNetworks: item.subjectNetworks,
    networkSupportSource: item.networkSupportSource,
  })),
  dynamicOpenApiPathCount: snapshot.dynamicOpenApiPathCount ?? null,
  sources: snapshot.sources.map((source) => ({
    kind: source.kind,
    ok: source.ok,
    statusCode: source.statusCode ?? null,
    error: source.error ?? null,
  })),
  limitations: [...snapshot.limitations, ...mapping.limitations],
};

console.log(JSON.stringify(summary, null, 2));
if (snapshot.status === 'unavailable') process.exit(1);
