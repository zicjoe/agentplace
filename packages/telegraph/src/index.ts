export type TelegraphTrustLevel = 'experimental';
export type TelegraphEnvironment = 'testnet';
export type TelegraphExecutionAuthority = 'none';
export type TelegraphDiscoveryStatus = 'healthy' | 'degraded' | 'unavailable';

export interface TelegraphAdapterConfig {
  nodeUrl: string;
  engineUrl: string;
  dispatcherUrl: string;
  timeoutMs: number;
  maxResponseBytes: number;
}

export interface TelegraphDiscoverySource {
  kind: 'node-status' | 'dispatcher-health' | 'integrations' | 'engine-miners' | 'engine-intents' | 'dynamic-openapi';
  url: string;
  ok: boolean;
  fetchedAt: string;
  statusCode?: number;
  error?: string;
}

export interface TelegraphEndpointDefinition {
  path: string;
  method?: string;
  summary?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface TelegraphMinerDefinition {
  id: string;
  slug: string;
  name: string;
  kind?: string;
  protocol?: string;
  upstreamBaseUrl?: string;
  capabilities: string[];
  supportedIntents: string[];
  endpoints: TelegraphEndpointDefinition[];
  costPerCall?: string;
  onChainMetadata?: Record<string, unknown>;
  discoverySources: Array<'dispatcher' | 'engine'>;
}

export interface TelegraphIntentDefinition {
  id: string;
  name: string;
  minerCount?: number;
}

export interface TelegraphDiscoverySnapshot {
  provider: 'telegraph';
  environment: TelegraphEnvironment;
  trustLevel: TelegraphTrustLevel;
  executionAuthority: TelegraphExecutionAuthority;
  protocolNetwork: 'base-sepolia';
  status: TelegraphDiscoveryStatus;
  fetchedAt: string;
  miners: TelegraphMinerDefinition[];
  intents: TelegraphIntentDefinition[];
  dynamicOpenApiPathCount?: number;
  sources: TelegraphDiscoverySource[];
  limitations: string[];
}

export interface TelegraphDiscoveryOptions {
  config?: Partial<TelegraphAdapterConfig>;
  fetchImpl?: typeof fetch;
}

type Attempt<T> = {
  source: TelegraphDiscoverySource;
  value?: T;
};

const DEFAULT_NODE_URL = 'https://devnode.telegraphprotocol.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function httpBaseUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute http(s) URL.`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label} must use http or https.`);
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

function urlFor(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function telegraphAdapterConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TelegraphAdapterConfig {
  const nodeUrl = httpBaseUrl(env.TELEGRAPH_NODE_URL?.trim() || DEFAULT_NODE_URL, 'TELEGRAPH_NODE_URL');
  const engineUrl = httpBaseUrl(env.TELEGRAPH_ENGINE_URL?.trim() || `${nodeUrl}/engine`, 'TELEGRAPH_ENGINE_URL');
  const dispatcherUrl = httpBaseUrl(env.TELEGRAPH_DISPATCHER_URL?.trim() || `${nodeUrl}/miner-dispatcher`, 'TELEGRAPH_DISPATCHER_URL');
  return {
    nodeUrl,
    engineUrl,
    dispatcherUrl,
    timeoutMs: boundedInteger(env.TELEGRAPH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 60_000),
    maxResponseBytes: boundedInteger(env.TELEGRAPH_MAX_RESPONSE_BYTES, DEFAULT_MAX_RESPONSE_BYTES, 64 * 1024, 16 * 1024 * 1024),
  };
}

function mergeConfig(override: Partial<TelegraphAdapterConfig> | undefined): TelegraphAdapterConfig {
  const base = telegraphAdapterConfigFromEnv();
  return {
    nodeUrl: httpBaseUrl(override?.nodeUrl ?? base.nodeUrl, 'Telegraph node URL'),
    engineUrl: httpBaseUrl(override?.engineUrl ?? base.engineUrl, 'Telegraph engine URL'),
    dispatcherUrl: httpBaseUrl(override?.dispatcherUrl ?? base.dispatcherUrl, 'Telegraph dispatcher URL'),
    timeoutMs: override?.timeoutMs === undefined ? base.timeoutMs : Math.min(60_000, Math.max(1_000, override.timeoutMs)),
    maxResponseBytes: override?.maxResponseBytes === undefined
      ? base.maxResponseBytes
      : Math.min(16 * 1024 * 1024, Math.max(64 * 1024, override.maxResponseBytes)),
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is Record<string, unknown> => !!item) : [];
}

function texts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter((item): item is string => !!item))].slice(0, 128);
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'Request timed out.';
    const cause = record(error.cause);
    const causeCode = text(cause?.code);
    return `${error.message}${causeCode ? ` (${causeCode})` : ''}`.slice(0, 300);
  }
  return String(error).slice(0, 300);
}

async function readBoundedText(response: Response, maxResponseBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maxResponseBytes) {
      await reader.cancel();
      throw new Error('Response exceeded configured size limit.');
    }
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

async function getJson<T>(args: {
  kind: TelegraphDiscoverySource['kind'];
  url: string;
  timeoutMs: number;
  maxResponseBytes: number;
  fetchImpl: typeof fetch;
}): Promise<Attempt<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  const fetchedAt = new Date().toISOString();
  try {
    const response = await args.fetchImpl(args.url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
      redirect: 'error',
    });
    const statusCode = response.status;
    const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
    if (Number.isFinite(declaredLength) && declaredLength > args.maxResponseBytes) {
      return { source: { kind: args.kind, url: args.url, ok: false, fetchedAt, statusCode, error: 'Response exceeded configured size limit.' } };
    }
    const body = await readBoundedText(response, args.maxResponseBytes);
    if (!response.ok) {
      return { source: { kind: args.kind, url: args.url, ok: false, fetchedAt, statusCode, error: `HTTP ${statusCode}.` } };
    }
    try {
      const value = JSON.parse(body) as T;
      return { source: { kind: args.kind, url: args.url, ok: true, fetchedAt, statusCode }, value };
    } catch {
      return { source: { kind: args.kind, url: args.url, ok: false, fetchedAt, statusCode, error: 'Response was not valid JSON.' } };
    }
  } catch (error) {
    return { source: { kind: args.kind, url: args.url, ok: false, fetchedAt, error: safeError(error) } };
  } finally {
    clearTimeout(timer);
  }
}

function endpointDefinition(value: Record<string, unknown>): TelegraphEndpointDefinition | undefined {
  const path = text(value.path) ?? text(value.endpoint);
  if (!path) return undefined;
  const method = text(value.method)?.toUpperCase();
  const summary = text(value.summary) ?? text(value.description);
  const inputSchema = record(value.input_schema) ?? record(value.inputSchema) ?? record(value.request_schema) ?? record(value.requestSchema);
  const outputSchema = record(value.output_schema) ?? record(value.outputSchema) ?? record(value.response_schema) ?? record(value.responseSchema);
  return {
    path: path.slice(0, 500),
    ...(method ? { method: method.slice(0, 16) } : {}),
    ...(summary ? { summary: summary.slice(0, 1000) } : {}),
    ...(inputSchema ? { inputSchema } : {}),
    ...(outputSchema ? { outputSchema } : {}),
  };
}

function normalizeDispatcherMiner(value: Record<string, unknown>): TelegraphMinerDefinition | undefined {
  const id = text(value.id) ?? text(value.slug);
  const slug = text(value.slug) ?? id;
  if (!id || !slug) return undefined;
  const endpoints = records(value.endpoints).map(endpointDefinition).filter((item): item is TelegraphEndpointDefinition => !!item).slice(0, 128);
  const name = text(value.name) ?? slug;
  const kind = text(value.kind);
  const protocol = text(value.protocol);
  const upstreamBaseUrl = text(value.base_url) ?? text(value.baseUrl);
  const costPerCall = text(value.cost_per_call) ?? text(value.costPerCall);
  const onChainMetadata = record(value.on_chain) ?? record(value.onChain);
  return {
    id,
    slug,
    name,
    ...(kind ? { kind } : {}),
    ...(protocol ? { protocol } : {}),
    ...(upstreamBaseUrl ? { upstreamBaseUrl } : {}),
    capabilities: texts(value.capabilities),
    supportedIntents: texts(value.supported_intents ?? value.supportedIntents),
    endpoints,
    ...(costPerCall ? { costPerCall } : {}),
    ...(onChainMetadata ? { onChainMetadata } : {}),
    discoverySources: ['dispatcher'],
  };
}

function normalizeEngineMiner(value: Record<string, unknown>): TelegraphMinerDefinition | undefined {
  const id = text(value.id) ?? text(value.slug);
  const slug = text(value.slug) ?? id;
  if (!id || !slug) return undefined;
  const name = text(value.name) ?? slug;
  const protocol = text(value.protocol);
  const upstreamBaseUrl = text(value.base_url) ?? text(value.baseUrl);
  const costPerCall = text(value.cost_per_call) ?? text(value.costPerCall);
  return {
    id,
    slug,
    name,
    ...(protocol ? { protocol } : {}),
    ...(upstreamBaseUrl ? { upstreamBaseUrl } : {}),
    capabilities: texts(value.capabilities),
    supportedIntents: [],
    endpoints: [],
    ...(costPerCall ? { costPerCall } : {}),
    discoverySources: ['engine'],
  };
}

function mergeMiner(left: TelegraphMinerDefinition, right: TelegraphMinerDefinition): TelegraphMinerDefinition {
  const endpointKey = (endpoint: TelegraphEndpointDefinition) => `${endpoint.method ?? ''}:${endpoint.path}`;
  const endpoints = new Map<string, TelegraphEndpointDefinition>();
  for (const endpoint of [...left.endpoints, ...right.endpoints]) endpoints.set(endpointKey(endpoint), endpoint);
  const discoverySources = [...new Set([...left.discoverySources, ...right.discoverySources])] as Array<'dispatcher' | 'engine'>;
  return {
    id: left.id || right.id,
    slug: left.slug || right.slug,
    name: left.name || right.name,
    ...(left.kind ?? right.kind ? { kind: left.kind ?? right.kind } : {}),
    ...(left.protocol ?? right.protocol ? { protocol: left.protocol ?? right.protocol } : {}),
    ...(left.upstreamBaseUrl ?? right.upstreamBaseUrl ? { upstreamBaseUrl: left.upstreamBaseUrl ?? right.upstreamBaseUrl } : {}),
    capabilities: [...new Set([...left.capabilities, ...right.capabilities])].slice(0, 128),
    supportedIntents: [...new Set([...left.supportedIntents, ...right.supportedIntents])].slice(0, 128),
    endpoints: [...endpoints.values()].slice(0, 128),
    ...(left.costPerCall ?? right.costPerCall ? { costPerCall: left.costPerCall ?? right.costPerCall } : {}),
    ...(left.onChainMetadata ?? right.onChainMetadata ? { onChainMetadata: left.onChainMetadata ?? right.onChainMetadata } : {}),
    discoverySources,
  };
}

function normalizeIntegrations(value: unknown): TelegraphMinerDefinition[] {
  const rows = Array.isArray(value) ? records(value) : records(record(value)?.integrations);
  return rows.map(normalizeDispatcherMiner).filter((item): item is TelegraphMinerDefinition => !!item);
}

function normalizeEngineMiners(value: unknown): TelegraphMinerDefinition[] {
  const root = record(value);
  const rows = records(root?.miners ?? value);
  return rows.map(normalizeEngineMiner).filter((item): item is TelegraphMinerDefinition => !!item);
}

function normalizeIntents(value: unknown): TelegraphIntentDefinition[] {
  const rows = records(record(value)?.intents ?? value);
  return rows.flatMap((row): TelegraphIntentDefinition[] => {
    const id = text(row.intent_id) ?? text(row.id);
    const name = text(row.intent_name) ?? text(row.name);
    if (!id || !name) return [];
    const minerCount = numberValue(row.miner_count ?? row.minerCount);
    return [{ id, name, ...(minerCount === undefined ? {} : { minerCount }) }];
  });
}

function countOpenApiPaths(value: unknown): number | undefined {
  const paths = record(record(value)?.paths);
  return paths ? Object.keys(paths).length : undefined;
}

function sourceLimitation(source: TelegraphDiscoverySource): string | undefined {
  if (source.ok) return undefined;
  const label: Record<TelegraphDiscoverySource['kind'], string> = {
    'node-status': 'Telegraph node status',
    'dispatcher-health': 'Telegraph dispatcher health',
    integrations: 'Telegraph integration registry',
    'engine-miners': 'Telegraph Engine miner catalog',
    'engine-intents': 'Telegraph Engine intent registry',
    'dynamic-openapi': 'Telegraph dynamic OpenAPI catalog',
  };
  return `${label[source.kind]} was unavailable${source.statusCode ? ` (HTTP ${source.statusCode})` : ''}; AgentPlace did not infer missing discovery data.`;
}

export async function discoverTelegraph(options: TelegraphDiscoveryOptions = {}): Promise<TelegraphDiscoverySnapshot> {
  const config = mergeConfig(options.config);
  const fetchImpl = options.fetchImpl ?? fetch;
  const requests = await Promise.all([
    getJson<unknown>({ kind: 'node-status', url: urlFor(config.nodeUrl, '/status'), timeoutMs: config.timeoutMs, maxResponseBytes: config.maxResponseBytes, fetchImpl }),
    getJson<unknown>({ kind: 'dispatcher-health', url: urlFor(config.dispatcherUrl, '/healthz'), timeoutMs: config.timeoutMs, maxResponseBytes: config.maxResponseBytes, fetchImpl }),
    getJson<unknown>({ kind: 'integrations', url: urlFor(config.dispatcherUrl, '/integrations'), timeoutMs: config.timeoutMs, maxResponseBytes: config.maxResponseBytes, fetchImpl }),
    getJson<unknown>({ kind: 'engine-miners', url: urlFor(config.engineUrl, '/v1/miners'), timeoutMs: config.timeoutMs, maxResponseBytes: config.maxResponseBytes, fetchImpl }),
    getJson<unknown>({ kind: 'engine-intents', url: urlFor(config.engineUrl, '/v1/intents'), timeoutMs: config.timeoutMs, maxResponseBytes: config.maxResponseBytes, fetchImpl }),
    getJson<unknown>({ kind: 'dynamic-openapi', url: urlFor(config.dispatcherUrl, '/openapi.json'), timeoutMs: config.timeoutMs, maxResponseBytes: config.maxResponseBytes, fetchImpl }),
  ]);

  const byKind = new Map(requests.map((request) => [request.source.kind, request]));
  const dispatcherHealth = byKind.get('dispatcher-health');
  const dispatcherHealthValue = record(dispatcherHealth?.value);
  const dispatcherHealthStatus = text(dispatcherHealthValue?.status)?.toLowerCase();
  if (dispatcherHealth?.source.ok && dispatcherHealthStatus && !['ok', 'healthy', 'ready'].includes(dispatcherHealthStatus)) {
    dispatcherHealth.source.ok = false;
    dispatcherHealth.source.error = `Dispatcher reported status ${dispatcherHealthStatus.slice(0, 64)}.`;
  }
  const dispatcherMiners = normalizeIntegrations(byKind.get('integrations')?.value);
  const engineMiners = normalizeEngineMiners(byKind.get('engine-miners')?.value);
  const merged = new Map<string, TelegraphMinerDefinition>();
  for (const miner of [...dispatcherMiners, ...engineMiners]) {
    const key = miner.slug.toLowerCase();
    const prior = merged.get(key);
    merged.set(key, prior ? mergeMiner(prior, miner) : miner);
  }
  const miners = [...merged.values()].sort((left, right) => left.slug.localeCompare(right.slug));
  const intents = normalizeIntents(byKind.get('engine-intents')?.value).sort((left, right) => left.name.localeCompare(right.name));
  const dynamicOpenApiPathCount = countOpenApiPaths(byKind.get('dynamic-openapi')?.value);
  const sources = requests.map((request) => request.source);
  const catalogAvailable = miners.length > 0;
  const coreHealthAvailable = sources.some((source) => (source.kind === 'node-status' || source.kind === 'dispatcher-health') && source.ok);
  const discoveryFailures = sources.filter((source) => !source.ok);
  const status: TelegraphDiscoveryStatus = !catalogAvailable
    ? 'unavailable'
    : coreHealthAvailable && discoveryFailures.length === 0
      ? 'healthy'
      : 'degraded';
  const limitations = discoveryFailures.map(sourceLimitation).filter((item): item is string => !!item);
  if (!intents.length && byKind.get('engine-intents')?.source.ok) {
    limitations.push('Telegraph returned no registered intents in this discovery snapshot. AgentPlace did not synthesize intent mappings.');
  }
  if (!miners.length) {
    limitations.push('No Telegraph miners/services were discoverable. No Telegraph capability should be considered routable from this snapshot.');
  }
  limitations.push('M5B.2.1 is discovery-only: AgentPlace does not invoke paid Telegraph inference, sign x402 payments, or grant Telegraph financial authority.');
  limitations.push('Discovered upstream miner URLs and endpoint schemas are metadata only; this adapter never calls arbitrary miner URLs directly.');

  return {
    provider: 'telegraph',
    environment: 'testnet',
    trustLevel: 'experimental',
    executionAuthority: 'none',
    protocolNetwork: 'base-sepolia',
    status,
    fetchedAt: new Date().toISOString(),
    miners,
    intents,
    ...(dynamicOpenApiPathCount === undefined ? {} : { dynamicOpenApiPathCount }),
    sources,
    limitations,
  };
}

export const moduleManifest = {
  name: 'telegraph',
  layer: 'controlled-runtime',
  milestone: '5B.2.1',
  status: 'testnet-discovery-adapter',
  authority: 'none',
} as const;
