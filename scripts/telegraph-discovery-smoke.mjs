import { discoverTelegraph, telegraphAdapterConfigFromEnv } from '../packages/telegraph/dist/index.js';

const config = telegraphAdapterConfigFromEnv();
const snapshot = await discoverTelegraph({ config });

const summary = {
  provider: snapshot.provider,
  environment: snapshot.environment,
  trustLevel: snapshot.trustLevel,
  executionAuthority: snapshot.executionAuthority,
  protocolNetwork: snapshot.protocolNetwork,
  status: snapshot.status,
  miners: snapshot.miners.length,
  intents: snapshot.intents.length,
  dynamicOpenApiPathCount: snapshot.dynamicOpenApiPathCount ?? null,
  sources: snapshot.sources.map((source) => ({
    kind: source.kind,
    ok: source.ok,
    statusCode: source.statusCode ?? null,
    error: source.error ?? null,
  })),
  limitations: snapshot.limitations,
};

console.log(JSON.stringify(summary, null, 2));
if (snapshot.status === 'unavailable') process.exit(1);
