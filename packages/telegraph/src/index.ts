import { createHash, randomUUID } from 'node:crypto';

export type TelegraphTrustLevel = 'experimental';
export type TelegraphEnvironment = 'testnet';
export type TelegraphExecutionAuthority = 'none';
export type TelegraphDiscoveryStatus = 'healthy' | 'degraded' | 'unavailable';
export type TelegraphCapabilityMappingStatus = 'mapped' | 'ambiguous' | 'discovery-incomplete';
export type TelegraphNetworkSupportSource = 'declared-schema' | 'intent-name' | 'unknown';
export type TelegraphEvidenceStatus = 'verified' | 'partial' | 'unavailable' | 'error';
export type TelegraphEvidenceSubjectKind = 'token' | 'wallet' | 'protocol' | 'stablecoin';

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

export interface TelegraphSignalMapping {
  confidenceField?: string;
  labelField?: string;
  reasonField?: string;
}

export interface TelegraphMinerDocs {
  website?: string;
  documentation?: string;
  repository?: string;
}

export interface TelegraphMinerDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string;
  kind?: string;
  protocol?: string;
  upstreamBaseUrl?: string;
  capabilities: string[];
  supportedIntents: string[];
  endpoints: TelegraphEndpointDefinition[];
  costPerCall?: string;
  minPriceUsdc?: number;
  activationStatus?: string;
  signalMapping?: TelegraphSignalMapping;
  docs?: TelegraphMinerDocs;
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

export interface TelegraphCapabilityMapping {
  canonicalCapabilityId: string;
  implementationId: string;
  ruleId: string;
  status: TelegraphCapabilityMappingStatus;
  routerReady: boolean;
  service: {
    id: string;
    slug: string;
    name: string;
  };
  endpoint?: TelegraphEndpointDefinition;
  matchedIntents: string[];
  matchedCapabilities: string[];
  subjectNetworks: string[];
  networkSupportSource: TelegraphNetworkSupportSource;
  environment: TelegraphEnvironment;
  trustLevel: TelegraphTrustLevel;
  executionAuthority: TelegraphExecutionAuthority;
  protocolNetwork: 'base-sepolia';
  costPerCall?: string;
  minPriceUsdc?: number;
  limitations: string[];
}

export interface TelegraphUnmappedService {
  serviceId: string;
  slug: string;
  name: string;
  supportedIntents: string[];
  capabilities: string[];
  reason: string;
}

export interface TelegraphCapabilityMappingReport {
  provider: 'telegraph';
  environment: TelegraphEnvironment;
  trustLevel: TelegraphTrustLevel;
  executionAuthority: TelegraphExecutionAuthority;
  protocolNetwork: 'base-sepolia';
  discoveryStatus: TelegraphDiscoveryStatus;
  mappedAt: string;
  mappings: TelegraphCapabilityMapping[];
  unmapped: TelegraphUnmappedService[];
  limitations: string[];
}

export interface TelegraphInferenceEnvelope {
  minerId?: string | number;
  minerSlug?: string;
  minerName?: string;
  endpoint?: string;
  intent?: string;
  result?: unknown;
  costUsd?: string | number;
  durationMs?: number;
  timestamp?: string;
  signalHash?: string;
  warnings?: unknown[];
  error?: string;
}

export interface TelegraphEvidenceSubject {
  kind: TelegraphEvidenceSubjectKind;
  query: string;
  network?: string;
  address?: string;
}

export interface TelegraphEvidenceNormalizationInput {
  jobId: string;
  taskId: string;
  capabilityId: string;
  implementationId: string;
  subject: TelegraphEvidenceSubject;
  response: TelegraphInferenceEnvelope | Record<string, unknown>;
  service?: TelegraphMinerDefinition;
  mapping?: TelegraphCapabilityMapping;
  fetchedAt?: string;
  config?: Partial<TelegraphAdapterConfig>;
}

/**
 * Structurally matches AgentPlace IntelligenceEvidence so M5B.2.3 can persist it
 * through the existing owner-scoped intelligence_evidence path without creating
 * a second evidence model.
 */
export interface TelegraphNormalizedEvidence {
  id: string;
  jobId: string;
  taskId: string;
  capabilityId: string;
  implementationId: string;
  provider: 'telegraph';
  subjectKind: TelegraphEvidenceSubjectKind;
  subjectQuery: string;
  network?: string;
  address?: string;
  status: TelegraphEvidenceStatus;
  summary: string;
  data: Record<string, unknown>;
  sourceUrl?: string;
  observedAt: string;
  fetchedAt: string;
  providerConfidence?: number;
  derivationVersion: 'telegraph-testnet-evidence-v1';
  limitations: string[];
}

type Attempt<T> = {
  source: TelegraphDiscoverySource;
  value?: T;
};

type MappingRule = {
  id: string;
  canonicalCapabilityId: string;
  intents: readonly string[];
  capabilities: readonly string[];
  endpointKeywords: readonly string[];
};

const DEFAULT_NODE_URL = 'https://devnode.telegraphprotocol.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

const MAPPING_RULES: readonly MappingRule[] = [
  {
    id: 'telegraph-token-market-v1',
    canonicalCapabilityId: 'token.market.read',
    intents: ['TOKEN_PRICE', 'CRYPTO_PRICE', 'TOKEN_MARKET_DATA', 'CRYPTO_MARKET_DATA', 'TOKEN_MARKET_READ'],
    capabilities: ['TOKEN_MARKET_READ', 'TOKEN_PRICE', 'CRYPTO_PRICE', 'MARKET_DATA'],
    endpointKeywords: ['price', 'market', 'token'],
  },
  {
    id: 'telegraph-token-liquidity-v1',
    canonicalCapabilityId: 'token.liquidity.analyze',
    intents: ['TOKEN_LIQUIDITY', 'DEX_LIQUIDITY', 'LIQUIDITY_ANALYSIS', 'TOKEN_LIQUIDITY_ANALYSIS'],
    capabilities: ['TOKEN_LIQUIDITY', 'DEX_LIQUIDITY', 'LIQUIDITY_ANALYSIS'],
    endpointKeywords: ['liquidity', 'pool', 'dex'],
  },
  {
    id: 'telegraph-token-holders-v1',
    canonicalCapabilityId: 'token.holders.analyze',
    intents: ['TOKEN_HOLDERS', 'TOKEN_HOLDER_DISTRIBUTION', 'HOLDER_DISTRIBUTION', 'TOKEN_HOLDERS_ANALYSIS'],
    capabilities: ['TOKEN_HOLDERS', 'HOLDER_DISTRIBUTION', 'TOKEN_HOLDERS_ANALYSIS'],
    endpointKeywords: ['holder', 'distribution', 'concentration'],
  },
  {
    id: 'telegraph-token-deployer-v1',
    canonicalCapabilityId: 'token.deployer.analyze',
    intents: ['TOKEN_DEPLOYER', 'TOKEN_CREATOR', 'CONTRACT_CREATOR', 'DEPLOYER_ANALYSIS'],
    capabilities: ['TOKEN_DEPLOYER', 'TOKEN_CREATOR', 'DEPLOYER_ANALYSIS'],
    endpointKeywords: ['deployer', 'creator', 'contract'],
  },
  {
    id: 'telegraph-token-security-v1',
    canonicalCapabilityId: 'token.security.assess',
    intents: ['TOKEN_SECURITY', 'TOKEN_RISK_ASSESSMENT', 'SMART_CONTRACT_SECURITY', 'CONTRACT_SECURITY'],
    capabilities: ['TOKEN_SECURITY', 'TOKEN_RISK', 'SMART_CONTRACT_SECURITY', 'CONTRACT_SECURITY'],
    endpointKeywords: ['security', 'risk', 'contract'],
  },
  {
    id: 'telegraph-wallet-profile-v1',
    canonicalCapabilityId: 'wallet.profile',
    intents: ['WALLET_PROFILE'],
    capabilities: ['WALLET_PROFILE'],
    endpointKeywords: ['wallet', 'profile'],
  },
  {
    id: 'telegraph-wallet-performance-v1',
    canonicalCapabilityId: 'wallet.performance.analyze',
    intents: ['WALLET_PERFORMANCE', 'WALLET_PNL', 'WALLET_PERFORMANCE_ANALYSIS'],
    capabilities: ['WALLET_PERFORMANCE', 'WALLET_PNL'],
    endpointKeywords: ['performance', 'pnl', 'wallet'],
  },
  {
    id: 'telegraph-wallet-activity-v1',
    canonicalCapabilityId: 'wallet.activity.analyze',
    intents: ['WALLET_ACTIVITY', 'WALLET_ACTIVITY_ANALYSIS', 'WALLET_TRANSACTIONS'],
    capabilities: ['WALLET_ACTIVITY', 'WALLET_TRANSACTIONS'],
    endpointKeywords: ['activity', 'transaction', 'wallet'],
  },
  {
    id: 'telegraph-smartmoney-flow-v1',
    canonicalCapabilityId: 'smartmoney.flow.read',
    intents: ['SMART_MONEY_FLOW', 'SMARTMONEY_FLOW', 'WHALE_FLOW'],
    capabilities: ['SMART_MONEY_FLOW', 'SMARTMONEY_FLOW'],
    endpointKeywords: ['smart', 'money', 'flow', 'whale'],
  },
  {
    id: 'telegraph-wallet-cluster-v1',
    canonicalCapabilityId: 'wallet.cluster.analyze',
    intents: ['WALLET_CLUSTER', 'WALLET_CLUSTERING', 'WALLET_RELATIONSHIPS'],
    capabilities: ['WALLET_CLUSTER', 'WALLET_CLUSTERING'],
    endpointKeywords: ['cluster', 'relationship', 'wallet'],
  },
  {
    id: 'telegraph-token-smartmoney-v1',
    canonicalCapabilityId: 'token.smartmoney.read',
    intents: ['TOKEN_SMART_MONEY', 'TOKEN_SMARTMONEY', 'SMART_MONEY_TOKEN'],
    capabilities: ['TOKEN_SMART_MONEY', 'TOKEN_SMARTMONEY'],
    endpointKeywords: ['smart', 'money', 'token'],
  },
  {
    id: 'telegraph-protocol-tvl-v1',
    canonicalCapabilityId: 'protocol.tvl.read',
    intents: ['PROTOCOL_TVL', 'DEFI_TVL', 'TVL_READ'],
    capabilities: ['PROTOCOL_TVL', 'DEFI_TVL'],
    endpointKeywords: ['tvl', 'protocol'],
  },
  {
    id: 'telegraph-protocol-yield-v1',
    canonicalCapabilityId: 'protocol.yield.read',
    intents: ['PROTOCOL_YIELD', 'DEFI_YIELD', 'YIELD_DATA', 'YIELD_ANALYSIS'],
    capabilities: ['PROTOCOL_YIELD', 'DEFI_YIELD', 'YIELD_DATA'],
    endpointKeywords: ['yield', 'apy', 'apr'],
  },
  {
    id: 'telegraph-protocol-metrics-v1',
    canonicalCapabilityId: 'protocol.metrics.read',
    intents: ['PROTOCOL_METRICS', 'DEFI_METRICS'],
    capabilities: ['PROTOCOL_METRICS', 'DEFI_METRICS'],
    endpointKeywords: ['protocol', 'metrics'],
  },
  {
    id: 'telegraph-dex-metrics-v1',
    canonicalCapabilityId: 'protocol.dex.metrics.read',
    intents: ['DEX_METRICS', 'DEX_PROTOCOL_METRICS'],
    capabilities: ['DEX_METRICS', 'DEX_PROTOCOL_METRICS'],
    endpointKeywords: ['dex', 'metrics', 'volume', 'fees'],
  },
  {
    id: 'telegraph-stablecoin-supply-v1',
    canonicalCapabilityId: 'stablecoin.supply.read',
    intents: ['STABLECOIN_SUPPLY', 'STABLECOIN_SUPPLY_READ'],
    capabilities: ['STABLECOIN_SUPPLY'],
    endpointKeywords: ['stablecoin', 'supply'],
  },
  {
    id: 'telegraph-stablecoin-market-v1',
    canonicalCapabilityId: 'stablecoin.market.read',
    intents: ['STABLECOIN_MARKET', 'STABLECOIN_PRICE', 'STABLECOIN_PEG'],
    capabilities: ['STABLECOIN_MARKET', 'STABLECOIN_PRICE', 'STABLECOIN_PEG'],
    endpointKeywords: ['stablecoin', 'market', 'price', 'peg'],
  },
] as const;

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
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
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

function normalizeSignalMapping(value: unknown): TelegraphSignalMapping | undefined {
  const item = record(value);
  if (!item) return undefined;
  const confidenceField = text(item.confidence_field ?? item.confidenceField);
  const labelField = text(item.label_field ?? item.labelField);
  const reasonField = text(item.reason_field ?? item.reasonField);
  if (!confidenceField && !labelField && !reasonField) return undefined;
  return {
    ...(confidenceField ? { confidenceField } : {}),
    ...(labelField ? { labelField } : {}),
    ...(reasonField ? { reasonField } : {}),
  };
}

function normalizeDocs(value: unknown): TelegraphMinerDocs | undefined {
  const item = record(value);
  if (!item) return undefined;
  const website = text(item.website);
  const documentation = text(item.documentation);
  const repository = text(item.repository);
  if (!website && !documentation && !repository) return undefined;
  return {
    ...(website ? { website } : {}),
    ...(documentation ? { documentation } : {}),
    ...(repository ? { repository } : {}),
  };
}

function normalizeDispatcherMiner(value: Record<string, unknown>): TelegraphMinerDefinition | undefined {
  const idValue = value.id;
  const id = text(idValue) ?? (typeof idValue === 'number' && Number.isFinite(idValue) ? String(idValue) : undefined) ?? text(value.slug);
  const slug = text(value.slug) ?? id;
  if (!id || !slug) return undefined;
  const endpoints = records(value.endpoints).map(endpointDefinition).filter((item): item is TelegraphEndpointDefinition => !!item).slice(0, 128);
  const name = text(value.name) ?? slug;
  const description = text(value.description);
  const kind = text(value.kind);
  const protocol = text(value.protocol);
  const upstreamBaseUrl = text(value.base_url) ?? text(value.baseUrl);
  const costPerCall = text(value.cost_per_call) ?? text(value.costPerCall);
  const onChainMetadata = record(value.on_chain) ?? record(value.onChain);
  const minPriceUsdc = numberValue(value.min_price_usdc ?? value.minPriceUsdc ?? onChainMetadata?.min_price_usdc ?? onChainMetadata?.minPriceUsdc);
  const activationStatus = text(value.activation_status ?? value.activationStatus ?? value.status);
  const signalMapping = normalizeSignalMapping(value.signal_mapping ?? value.signalMapping ?? record(value.semantics)?.signal_mapping);
  const docs = normalizeDocs(value.docs);
  return {
    id,
    slug,
    name,
    ...(description ? { description } : {}),
    ...(kind ? { kind } : {}),
    ...(protocol ? { protocol } : {}),
    ...(upstreamBaseUrl ? { upstreamBaseUrl } : {}),
    capabilities: texts(value.capabilities),
    supportedIntents: texts(value.supported_intents ?? value.supportedIntents ?? record(value.semantics)?.supported_intents),
    endpoints,
    ...(costPerCall ? { costPerCall } : {}),
    ...(minPriceUsdc === undefined ? {} : { minPriceUsdc }),
    ...(activationStatus ? { activationStatus } : {}),
    ...(signalMapping ? { signalMapping } : {}),
    ...(docs ? { docs } : {}),
    ...(onChainMetadata ? { onChainMetadata } : {}),
    discoverySources: ['dispatcher'],
  };
}

function normalizeEngineMiner(value: Record<string, unknown>): TelegraphMinerDefinition | undefined {
  const idValue = value.id;
  const id = text(idValue) ?? (typeof idValue === 'number' && Number.isFinite(idValue) ? String(idValue) : undefined) ?? text(value.slug);
  const slug = text(value.slug) ?? id;
  if (!id || !slug) return undefined;
  const name = text(value.name) ?? slug;
  const description = text(value.description);
  const protocol = text(value.protocol);
  const upstreamBaseUrl = text(value.base_url) ?? text(value.baseUrl);
  const costPerCall = text(value.cost_per_call) ?? text(value.costPerCall);
  const minPriceUsdc = numberValue(value.min_price_usdc ?? value.minPriceUsdc);
  const activationStatus = text(value.activation_status ?? value.activationStatus ?? value.status);
  const signalMapping = normalizeSignalMapping(value.signal_mapping ?? value.signalMapping);
  return {
    id,
    slug,
    name,
    ...(description ? { description } : {}),
    ...(protocol ? { protocol } : {}),
    ...(upstreamBaseUrl ? { upstreamBaseUrl } : {}),
    capabilities: texts(value.capabilities),
    supportedIntents: texts(value.supported_intents ?? value.supportedIntents),
    endpoints: records(value.endpoints).map(endpointDefinition).filter((item): item is TelegraphEndpointDefinition => !!item).slice(0, 128),
    ...(costPerCall ? { costPerCall } : {}),
    ...(minPriceUsdc === undefined ? {} : { minPriceUsdc }),
    ...(activationStatus ? { activationStatus } : {}),
    ...(signalMapping ? { signalMapping } : {}),
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
    ...(left.description ?? right.description ? { description: left.description ?? right.description } : {}),
    ...(left.kind ?? right.kind ? { kind: left.kind ?? right.kind } : {}),
    ...(left.protocol ?? right.protocol ? { protocol: left.protocol ?? right.protocol } : {}),
    ...(left.upstreamBaseUrl ?? right.upstreamBaseUrl ? { upstreamBaseUrl: left.upstreamBaseUrl ?? right.upstreamBaseUrl } : {}),
    capabilities: [...new Set([...left.capabilities, ...right.capabilities])].slice(0, 128),
    supportedIntents: [...new Set([...left.supportedIntents, ...right.supportedIntents])].slice(0, 128),
    endpoints: [...endpoints.values()].slice(0, 128),
    ...(left.costPerCall ?? right.costPerCall ? { costPerCall: left.costPerCall ?? right.costPerCall } : {}),
    ...((left.minPriceUsdc ?? right.minPriceUsdc) === undefined ? {} : { minPriceUsdc: left.minPriceUsdc ?? right.minPriceUsdc! }),
    ...(left.activationStatus ?? right.activationStatus ? { activationStatus: left.activationStatus ?? right.activationStatus } : {}),
    ...(left.signalMapping ?? right.signalMapping ? { signalMapping: left.signalMapping ?? right.signalMapping } : {}),
    ...(left.docs ?? right.docs ? { docs: left.docs ?? right.docs } : {}),
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
    const idValue = row.intent_id ?? row.id;
    const id = text(idValue) ?? (typeof idValue === 'number' && Number.isFinite(idValue) ? String(idValue) : undefined);
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
  limitations.push('M5B.2.1 discovery does not invoke paid Telegraph inference, sign x402 payments, or grant Telegraph financial authority.');
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

function normalizedSignal(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function endpointSearchText(endpoint: TelegraphEndpointDefinition): string {
  return `${endpoint.method ?? ''} ${endpoint.path} ${endpoint.summary ?? ''}`.toLowerCase();
}

function selectEndpoint(miner: TelegraphMinerDefinition, rule: MappingRule): { endpoint?: TelegraphEndpointDefinition; status: TelegraphCapabilityMappingStatus; limitation?: string } {
  if (!miner.endpoints.length) {
    return { status: 'discovery-incomplete', limitation: 'Telegraph discovery did not expose a concrete endpoint for this service; AgentPlace will not invent one.' };
  }
  if (miner.endpoints.length === 1) {
    const endpoint = miner.endpoints[0];
    return endpoint ? { endpoint, status: 'mapped' } : { status: 'discovery-incomplete', limitation: 'Telegraph discovery exposed an empty endpoint slot; AgentPlace will not invent one.' };
  }
  const scored = miner.endpoints.map((endpoint) => {
    const haystack = endpointSearchText(endpoint);
    const score = rule.endpointKeywords.reduce((total, keyword) => total + (haystack.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    return { endpoint, score };
  }).sort((left, right) => right.score - left.score || `${left.endpoint.method ?? ''}:${left.endpoint.path}`.localeCompare(`${right.endpoint.method ?? ''}:${right.endpoint.path}`));
  const first = scored[0];
  const second = scored[1];
  if (!first || first.score === 0 || (second && second.score === first.score)) {
    return { status: 'ambiguous', limitation: 'Multiple Telegraph endpoints were available and AgentPlace could not select one deterministically from the declared semantics.' };
  }
  return { endpoint: first.endpoint, status: 'mapped' };
}

function collectSchemaStrings(value: unknown, depth = 0): string[] {
  if (depth > 7 || value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectSchemaStrings(item, depth + 1));
  if (typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [key, ...collectSchemaStrings(child, depth + 1)]);
}

function canonicalNetworkFromText(value: string): string | undefined {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (/\barbitrum\b/.test(normalized) && /\bsepolia\b|\btestnet\b/.test(normalized)) return 'arbitrum-sepolia';
  if (/\bbase\b/.test(normalized) && /\bsepolia\b|\btestnet\b/.test(normalized)) return 'base-sepolia';
  if (/\b(?:ethereum|eth)\b/.test(normalized) && /\bsepolia\b|\btestnet\b/.test(normalized)) return 'ethereum-sepolia';
  if (/\b(?:bnb|bsc)\b/.test(normalized) && /\btestnet\b/.test(normalized)) return 'bnb-testnet';
  if (/\bsolana\b/.test(normalized) && /\bdevnet\b/.test(normalized)) return 'solana-devnet';
  if (/\bsolana\b/.test(normalized) && /\btestnet\b/.test(normalized)) return 'solana-testnet';
  if (/\barbitrum\b|\barb\b/.test(normalized)) return 'arbitrum';
  if (/\bbase\b/.test(normalized)) return 'base';
  if (/\b(?:bnb|bsc|binance smart chain)\b/.test(normalized)) return 'bnb';
  if (/\b(?:ethereum|eth)\b/.test(normalized)) return 'ethereum';
  if (/\bsolana\b/.test(normalized)) return 'solana';
  return undefined;
}

function subjectNetworkHints(miner: TelegraphMinerDefinition, endpoint: TelegraphEndpointDefinition | undefined): { networks: string[]; source: TelegraphNetworkSupportSource } {
  if (endpoint?.inputSchema) {
    const schemaNetworks = unique(collectSchemaStrings(endpoint.inputSchema).map(canonicalNetworkFromText).filter((item): item is string => !!item));
    if (schemaNetworks.length) return { networks: schemaNetworks, source: 'declared-schema' };
  }
  const intentNetworks = unique(miner.supportedIntents.map(canonicalNetworkFromText).filter((item): item is string => !!item));
  if (intentNetworks.length) return { networks: intentNetworks, source: 'intent-name' };
  return { networks: [], source: 'unknown' };
}

function stableImplementationId(miner: TelegraphMinerDefinition, endpoint: TelegraphEndpointDefinition | undefined, capabilityId: string): string {
  const endpointKey = endpoint ? `${endpoint.method ?? 'ANY'}:${endpoint.path}` : 'unresolved';
  const endpointHash = createHash('sha256').update(endpointKey).digest('hex').slice(0, 10);
  const slug = miner.slug.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'service';
  const capability = capabilityId.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 80);
  return `telegraph:${slug}:${capability}:${endpointHash}`;
}

function serviceActive(miner: TelegraphMinerDefinition): boolean {
  if (!miner.activationStatus) return true;
  const value = miner.activationStatus.trim().toLowerCase();
  return !['inactive', 'disabled', 'deregistered', 'unavailable', 'offline', 'failed'].includes(value);
}

export function mapTelegraphCapabilities(snapshot: TelegraphDiscoverySnapshot): TelegraphCapabilityMappingReport {
  const mappings: TelegraphCapabilityMapping[] = [];
  const unmapped: TelegraphUnmappedService[] = [];

  for (const miner of snapshot.miners) {
    const normalizedIntents = new Set(miner.supportedIntents.map(normalizedSignal));
    const normalizedCapabilities = new Set(miner.capabilities.map(normalizedSignal));
    const matchingRules = MAPPING_RULES.filter((rule) =>
      rule.intents.some((intent) => normalizedIntents.has(intent)) || rule.capabilities.some((capability) => normalizedCapabilities.has(capability)),
    );

    if (!matchingRules.length) {
      unmapped.push({
        serviceId: miner.id,
        slug: miner.slug,
        name: miner.name,
        supportedIntents: miner.supportedIntents,
        capabilities: miner.capabilities,
        reason: 'No exact mapping exists to the current AgentPlace canonical capability vocabulary; AgentPlace did not create a new capability or broaden semantics.',
      });
      continue;
    }

    for (const rule of matchingRules) {
      const selected = selectEndpoint(miner, rule);
      const networkHints = subjectNetworkHints(miner, selected.endpoint);
      const matchedIntents = miner.supportedIntents.filter((intent) => rule.intents.includes(normalizedSignal(intent)));
      const matchedCapabilities = miner.capabilities.filter((capability) => rule.capabilities.includes(normalizedSignal(capability)));
      const limitations = [
        'Telegraph is experimental/testnet supply; mapping compatibility does not promote the service to production trust.',
        'Telegraph protocol settlement runs on Base Sepolia, but that payment/protocol network is not treated as the intelligence subject network.',
      ];
      if (selected.limitation) limitations.push(selected.limitation);
      if (networkHints.source === 'unknown') limitations.push('Telegraph discovery did not declare a reliable intelligence subject-network set for this service, so AgentPlace does not mark it Router-ready.');
      if (!serviceActive(miner)) limitations.push(`Telegraph service activation state is ${miner.activationStatus ?? 'inactive'}; it is not router-ready.`);
      const routerReady = snapshot.status !== 'unavailable' && selected.status === 'mapped' && serviceActive(miner) && networkHints.source !== 'unknown';
      mappings.push({
        canonicalCapabilityId: rule.canonicalCapabilityId,
        implementationId: stableImplementationId(miner, selected.endpoint, rule.canonicalCapabilityId),
        ruleId: rule.id,
        status: selected.status,
        routerReady,
        service: { id: miner.id, slug: miner.slug, name: miner.name },
        ...(selected.endpoint ? { endpoint: selected.endpoint } : {}),
        matchedIntents,
        matchedCapabilities,
        subjectNetworks: networkHints.networks,
        networkSupportSource: networkHints.source,
        environment: 'testnet',
        trustLevel: 'experimental',
        executionAuthority: 'none',
        protocolNetwork: 'base-sepolia',
        ...(miner.costPerCall ? { costPerCall: miner.costPerCall } : {}),
        ...(miner.minPriceUsdc === undefined ? {} : { minPriceUsdc: miner.minPriceUsdc }),
        limitations,
      });
    }
  }

  mappings.sort((left, right) => left.canonicalCapabilityId.localeCompare(right.canonicalCapabilityId) || left.implementationId.localeCompare(right.implementationId));
  unmapped.sort((left, right) => left.slug.localeCompare(right.slug));

  return {
    provider: 'telegraph',
    environment: 'testnet',
    trustLevel: 'experimental',
    executionAuthority: 'none',
    protocolNetwork: 'base-sepolia',
    discoveryStatus: snapshot.status,
    mappedAt: new Date().toISOString(),
    mappings,
    unmapped,
    limitations: [
      'M5B.2.2 uses an explicit allowlist of semantic mappings to existing AgentPlace canonical capabilities. Unknown Telegraph intents remain unmapped.',
      'A mapped service is not automatically routable: M5B.2.3 still owns deterministic Router registration, eligibility, health, trust and fallback.',
      'No paid Telegraph inference or x402 signing is enabled by capability mapping.',
    ],
  };
}

function responseEnvelope(value: TelegraphInferenceEnvelope | Record<string, unknown>): TelegraphInferenceEnvelope {
  const root = value as Record<string, unknown>;
  const minerIdValue = root.minerId ?? root.miner_id ?? root.subnet_id;
  const minerId = typeof minerIdValue === 'number' && Number.isFinite(minerIdValue) ? minerIdValue : text(minerIdValue);
  const warningsRaw = root.warnings;
  return {
    ...(minerId === undefined ? {} : { minerId }),
    ...(text(root.minerSlug ?? root.miner_slug ?? root.miner_used) ? { minerSlug: text(root.minerSlug ?? root.miner_slug ?? root.miner_used)! } : {}),
    ...(text(root.minerName ?? root.miner_name) ? { minerName: text(root.minerName ?? root.miner_name)! } : {}),
    ...(text(root.endpoint) ? { endpoint: text(root.endpoint)! } : {}),
    ...(text(root.intent) ? { intent: text(root.intent)! } : {}),
    ...('result' in root ? { result: root.result } : {}),
    ...(numberValue(root.costUsd ?? root.cost_usd) !== undefined ? { costUsd: numberValue(root.costUsd ?? root.cost_usd)! } : text(root.costUsd ?? root.cost_usd) ? { costUsd: text(root.costUsd ?? root.cost_usd)! } : {}),
    ...(numberValue(root.durationMs ?? root.duration_ms) === undefined ? {} : { durationMs: numberValue(root.durationMs ?? root.duration_ms)! }),
    ...(text(root.timestamp) ? { timestamp: text(root.timestamp)! } : {}),
    ...(text(root.signalHash ?? root.signal_hash) ? { signalHash: text(root.signalHash ?? root.signal_hash)! } : {}),
    ...(Array.isArray(warningsRaw) ? { warnings: warningsRaw.slice(0, 32) } : {}),
    ...(text(root.error) ? { error: text(root.error)! } : {}),
  };
}

function boundedJson(value: unknown, max = 100_000): unknown {
  if (value === undefined) return null;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { unavailable: true, reason: 'Telegraph result was not JSON-serializable.' };
  }
  if (serialized.length <= max) return value;
  return {
    truncated: true,
    sha256: createHash('sha256').update(serialized).digest('hex'),
    excerpt: serialized.slice(0, max),
  };
}

function fieldAtPath(value: unknown, path: string | undefined): unknown {
  if (!path?.trim()) return undefined;
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  let current: unknown = value;
  for (const part of parts) {
    const item = record(current);
    if (!item || !(part in item)) return undefined;
    current = item[part];
  }
  return current;
}

function ISODate(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function inferProviderConfidence(result: unknown, service: TelegraphMinerDefinition | undefined): number | undefined {
  const raw = fieldAtPath(result, service?.signalMapping?.confidenceField);
  const value = numberValue(raw);
  return value !== undefined && value >= 0 && value <= 1 ? value : undefined;
}

function evidenceSourceUrl(nodeUrl: string, signalHash: string | undefined): string | undefined {
  if (!signalHash) return undefined;
  return urlFor(nodeUrl, `/engine/v1/signal/${encodeURIComponent(signalHash)}`);
}

export function normalizeTelegraphEvidence(input: TelegraphEvidenceNormalizationInput): TelegraphNormalizedEvidence {
  const response = responseEnvelope(input.response);
  const config = mergeConfig(input.config);
  const fetchedAt = ISODate(input.fetchedAt, new Date().toISOString());
  const observedAt = ISODate(response.timestamp, fetchedAt);
  const resultPresent = response.result !== undefined && response.result !== null;
  const warnings = response.warnings ?? [];
  const mappingMismatch = input.mapping && input.mapping.canonicalCapabilityId !== input.capabilityId;
  const responseError = response.error?.trim();
  const status: TelegraphEvidenceStatus = responseError
    ? 'error'
    : !resultPresent
      ? 'unavailable'
      : warnings.length || mappingMismatch
        ? 'partial'
        : 'verified';
  const serviceName = input.service?.name ?? response.minerName ?? input.mapping?.service.name ?? 'Telegraph service';
  const serviceSlug = input.service?.slug ?? response.minerSlug ?? input.mapping?.service.slug;
  const endpoint = response.endpoint ?? input.mapping?.endpoint?.path;
  const intent = response.intent ?? input.mapping?.matchedIntents[0];
  const providerConfidence = inferProviderConfidence(response.result, input.service);
  const sourceUrl = evidenceSourceUrl(config.nodeUrl, response.signalHash);
  const limitations = [
    'Telegraph is experimental/testnet evidence. A successful provider response is not an AgentPlace Verified economic outcome or financial authorization.',
    'The specific Telegraph miner/service remains the source of the returned assertion; AgentPlace preserves attribution rather than adopting the assertion as its own.',
    'Telegraph has no signing, wallet, Agent Account, policy or capital-moving authority in M5B.2.',
  ];
  if (warnings.length) limitations.push('Telegraph returned warnings; evidence is marked partial and the warnings are preserved in provenance.');
  if (mappingMismatch) limitations.push(`The supplied Telegraph mapping targets ${input.mapping?.canonicalCapabilityId ?? 'another capability'}, not ${input.capabilityId}; evidence is marked partial.`);
  if (!input.service?.signalMapping?.confidenceField) limitations.push('No Telegraph service confidence-field mapping was available; AgentPlace did not invent a confidence score.');
  if (responseError) limitations.push('Telegraph returned an error; AgentPlace preserved it rather than converting it into a factual result.');
  if (!resultPresent && !responseError) limitations.push('Telegraph returned no result payload; AgentPlace marks the evidence unavailable.');

  const labelValue = fieldAtPath(response.result, input.service?.signalMapping?.labelField);
  const reasonValue = fieldAtPath(response.result, input.service?.signalMapping?.reasonField);
  const summary = responseError
    ? `${serviceName} on Telegraph testnet returned an error; no finding was asserted.`
    : !resultPresent
      ? `${serviceName} on Telegraph testnet returned no usable result.`
      : warnings.length || mappingMismatch
        ? `${serviceName} returned Telegraph testnet evidence with limitations preserved.`
        : `${serviceName} returned Telegraph testnet evidence for ${input.capabilityId}.`;

  return {
    id: `iev_${randomUUID()}`,
    jobId: input.jobId,
    taskId: input.taskId,
    capabilityId: input.capabilityId,
    implementationId: input.implementationId,
    provider: 'telegraph',
    subjectKind: input.subject.kind,
    subjectQuery: input.subject.query,
    ...(input.subject.network?.trim() ? { network: canonicalNetworkFromText(input.subject.network) ?? input.subject.network.trim() } : {}),
    ...(input.subject.address?.trim() ? { address: input.subject.address.trim() } : {}),
    status,
    summary,
    data: {
      telegraph: {
        environment: 'testnet',
        trustLevel: 'experimental',
        executionAuthority: 'none',
        protocolNetwork: 'base-sepolia',
        service: {
          ...(response.minerId === undefined && !input.service?.id && !input.mapping?.service.id ? {} : { id: String(response.minerId ?? input.service?.id ?? input.mapping?.service.id) }),
          ...(serviceSlug ? { slug: serviceSlug } : {}),
          name: serviceName,
          ...(endpoint ? { endpoint } : {}),
        },
        ...(intent ? { intent } : {}),
        ...(input.mapping ? { mappingRuleId: input.mapping.ruleId } : {}),
        ...(response.signalHash ? { signalHash: response.signalHash } : {}),
        ...(response.costUsd === undefined ? {} : { costUsd: response.costUsd }),
        ...(response.durationMs === undefined ? {} : { durationMs: response.durationMs }),
        warnings: boundedJson(warnings),
        ...(labelValue === undefined ? {} : { providerLabel: boundedJson(labelValue) }),
        ...(reasonValue === undefined ? {} : { providerReason: boundedJson(reasonValue) }),
        ...(responseError ? { error: responseError } : {}),
      },
      result: boundedJson(response.result),
    },
    ...(sourceUrl ? { sourceUrl } : {}),
    observedAt,
    fetchedAt,
    ...(providerConfidence === undefined ? {} : { providerConfidence }),
    derivationVersion: 'telegraph-testnet-evidence-v1',
    limitations,
  };
}

export const moduleManifest = {
  name: 'telegraph',
  layer: 'controlled-runtime',
  milestone: '5B.2.2',
  status: 'testnet-capability-mapping-and-evidence-normalization',
  authority: 'none',
} as const;
