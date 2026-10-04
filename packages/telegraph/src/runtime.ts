import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getDatabasePool, withTransaction } from '@agent-place/db';
import { isAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  discoverTelegraph,
  mapTelegraphCapabilities,
  normalizeTelegraphEvidence,
  telegraphAdapterConfigFromEnv,
  type TelegraphAdapterConfig,
  type TelegraphCapabilityMapping,
  type TelegraphCapabilityMappingReport,
  type TelegraphDiscoveryOptions,
  type TelegraphDiscoverySnapshot,
  type TelegraphEvidenceSubject,
  type TelegraphInferenceEnvelope,
  type TelegraphMinerDefinition,
  type TelegraphNormalizedEvidence,
  type TelegraphServicePaymentEvidence,
} from './index.js';

const TELEGRAPH_PAYMENT_NETWORK = 'eip155:84532' as const;
const TELEGRAPH_PROTOCOL_NETWORK = 'base-sepolia' as const;
const BASE_SEPOLIA_CHAIN_ID = 84_532;
const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const HARD_MAX_CALL_ATOMIC = 20_000n; // 0.02 USDC
const HARD_MAX_JOB_ATOMIC = 100_000n; // 0.10 USDC
const HARD_MAX_CALLS_PER_JOB = 10;
const DEFAULT_DISCOVERY_CACHE_MS = 120_000;

export interface TelegraphServicePaymentStatus {
  enabled: boolean;
  ready: boolean;
  network: typeof TELEGRAPH_PROTOCOL_NETWORK;
  caip2Network: typeof TELEGRAPH_PAYMENT_NETWORK;
  asset: typeof BASE_SEPOLIA_USDC;
  payerAddress?: string;
  maxCallUsdc: string;
  maxJobUsdc: string;
  maxCallsPerJob: number;
  reason?: string;
}

interface TelegraphServicePaymentConfig {
  enabled: boolean;
  privateKey?: Hex;
  payerAddress?: Address;
  maxCallAtomic: bigint;
  maxJobAtomic: bigint;
  maxCallsPerJob: number;
  configurationError?: string;
}

export interface TelegraphRouterImplementation {
  id: string;
  canonicalCapabilityId: string;
  provider: 'telegraph';
  name: string;
  version: string;
  supportedNetworks: string[];
  pricing: Record<string, unknown>;
  trustStatus: 'experimental';
  healthStatus: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
  invocationKind: 'telegraph-direct-x402';
  knownFailureStates: string[];
  priority: number;
  enabled: boolean;
  environmentEligibility: string[];
}

export interface TelegraphRuntimeCatalog {
  snapshot: TelegraphDiscoverySnapshot;
  report: TelegraphCapabilityMappingReport;
  mappings: TelegraphCapabilityMapping[];
  implementations: TelegraphRouterImplementation[];
  loadedAt: string;
}

export interface TelegraphSubjectBindingResult {
  ok: boolean;
  payload?: Record<string, unknown>;
  reason?: string;
}

export interface TelegraphMappedInvocationResult {
  response: TelegraphInferenceEnvelope;
  mapping?: TelegraphCapabilityMapping;
  service?: TelegraphMinerDefinition;
  servicePayment?: TelegraphServicePaymentEvidence;
}

export interface TelegraphMappedInvocationInput {
  ownerUserId: string;
  jobId: string;
  taskId: string;
  capabilityId: string;
  implementationId: string;
  subject: TelegraphEvidenceSubject;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  config?: Partial<TelegraphAdapterConfig>;
}

export interface TelegraphPaymentRequirement {
  scheme: 'exact';
  network: typeof TELEGRAPH_PAYMENT_NETWORK;
  amount: string;
  asset: Address;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra: {
    name: string;
    version: string;
    assetTransferMethod?: 'eip3009';
  };
}

export interface TelegraphPaymentChallenge {
  x402Version: 2;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: TelegraphPaymentRequirement[];
  extensions?: Record<string, unknown>;
}

type PaymentLedgerStatus = 'reserved' | 'settled' | 'failed' | 'released' | 'unknown';

type PaymentLedgerRow = {
  id: string;
  status: PaymentLedgerStatus;
  amount_atomic: string;
};

type PaymentBudgetRow = {
  amount_atomic: string;
  call_count: string;
};

let runtimeCatalogCache: { key: string; expiresAt: number; value: TelegraphRuntimeCatalog } | undefined;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function parseUsdcAtomic(value: string | undefined, fallback: bigint, maximum: bigint): bigint {
  if (!value?.trim()) return fallback;
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) return fallback;
  const whole = BigInt(match[1] ?? '0');
  const fractional = BigInt((match[2] ?? '').padEnd(6, '0'));
  const atomic = whole * 1_000_000n + fractional;
  if (atomic <= 0n) return fallback;
  return atomic > maximum ? maximum : atomic;
}

function formatUsdcAtomic(value: bigint): string {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function enabledFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}

function explicitUsdcLimitInvalid(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) return true;
  const whole = BigInt(match[1] ?? '0');
  const fractional = BigInt((match[2] ?? '').padEnd(6, '0'));
  return whole * 1_000_000n + fractional <= 0n;
}

function explicitCallLimitInvalid(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return !/^\d+$/.test(value.trim()) || Number.parseInt(value, 10) < 1;
}

function servicePaymentConfig(env: NodeJS.ProcessEnv = process.env): TelegraphServicePaymentConfig {
  const rawKey = env.TELEGRAPH_EVM_PRIVATE_KEY?.trim();
  const privateKey = rawKey && /^0x[0-9a-fA-F]{64}$/.test(rawKey) ? rawKey as Hex : undefined;
  let payerAddress: Address | undefined;
  if (privateKey) {
    try {
      payerAddress = privateKeyToAccount(privateKey).address;
    } catch {
      payerAddress = undefined;
    }
  }
  const invalidLimits = [
    explicitUsdcLimitInvalid(env.TELEGRAPH_X402_MAX_CALL_USDC) ? 'TELEGRAPH_X402_MAX_CALL_USDC' : '',
    explicitUsdcLimitInvalid(env.TELEGRAPH_X402_MAX_JOB_USDC) ? 'TELEGRAPH_X402_MAX_JOB_USDC' : '',
    explicitCallLimitInvalid(env.TELEGRAPH_X402_MAX_CALLS_PER_JOB) ? 'TELEGRAPH_X402_MAX_CALLS_PER_JOB' : '',
  ].filter(Boolean);
  const configurationError = invalidLimits.length ? `Invalid Telegraph service-spend limit: ${invalidLimits.join(', ')}.` : undefined;
  return {
    enabled: enabledFlag(env.TELEGRAPH_SERVICE_PAYMENT_ENABLED),
    ...(privateKey ? { privateKey } : {}),
    ...(payerAddress ? { payerAddress } : {}),
    maxCallAtomic: parseUsdcAtomic(env.TELEGRAPH_X402_MAX_CALL_USDC, HARD_MAX_CALL_ATOMIC, HARD_MAX_CALL_ATOMIC),
    maxJobAtomic: parseUsdcAtomic(env.TELEGRAPH_X402_MAX_JOB_USDC, HARD_MAX_JOB_ATOMIC, HARD_MAX_JOB_ATOMIC),
    maxCallsPerJob: boundedInteger(env.TELEGRAPH_X402_MAX_CALLS_PER_JOB, HARD_MAX_CALLS_PER_JOB, 1, HARD_MAX_CALLS_PER_JOB),
    ...(configurationError ? { configurationError } : {}),
  };
}

export function telegraphServicePaymentStatusFromEnv(env: NodeJS.ProcessEnv = process.env): TelegraphServicePaymentStatus {
  const config = servicePaymentConfig(env);
  const ready = config.enabled && !!config.privateKey && !!config.payerAddress && !config.configurationError;
  const reason = ready
    ? undefined
    : !config.enabled
      ? 'Telegraph service payment is disabled.'
      : config.configurationError ?? 'TELEGRAPH_EVM_PRIVATE_KEY is missing or invalid.';
  return {
    enabled: config.enabled,
    ready,
    network: TELEGRAPH_PROTOCOL_NETWORK,
    caip2Network: TELEGRAPH_PAYMENT_NETWORK,
    asset: BASE_SEPOLIA_USDC,
    ...(config.payerAddress ? { payerAddress: config.payerAddress } : {}),
    maxCallUsdc: formatUsdcAtomic(config.maxCallAtomic),
    maxJobUsdc: formatUsdcAtomic(config.maxJobAtomic),
    maxCallsPerJob: config.maxCallsPerJob,
    ...(reason ? { reason } : {}),
  };
}

export function telegraphServicePaymentReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return telegraphServicePaymentStatusFromEnv(env).ready;
}

function canonicalSubjectNetwork(value: string | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return '';
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
  return normalized;
}

function safeEndpoint(mapping: TelegraphCapabilityMapping): boolean {
  const endpoint = mapping.endpoint;
  if (!endpoint?.method || !endpoint.path) return false;
  const method = endpoint.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST') return false;
  if (!endpoint.path.startsWith('/') || endpoint.path.includes('://') || endpoint.path.includes('..')) return false;
  return endpoint.path.length <= 500;
}

const QUERY_KEYS = new Set(['query', 'q', 'search', 'term', 'name']);
const ADDRESS_KEYS = new Set(['address', 'token_address', 'contract_address', 'wallet_address', 'mint', 'token_mint']);
const NETWORK_KEYS = new Set(['network', 'chain', 'blockchain']);
const TOKEN_KEYS = new Set(['token', 'asset']);
const SYMBOL_KEYS = new Set(['symbol', 'ticker']);
const PROTOCOL_KEYS = new Set(['protocol', 'protocol_name']);
const WALLET_KEYS = new Set(['wallet', 'walletaddress']);
const STABLECOIN_KEYS = new Set(['stablecoin', 'coin']);

function normalizedInputKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s.-]+/g, '_');
}

function schemaDefault(schema: unknown): unknown {
  const item = record(schema);
  return item && 'default' in item ? item.default : undefined;
}

function matchEnum(value: unknown, schema: unknown): unknown {
  const item = record(schema);
  const values = Array.isArray(item?.enum) ? item.enum : undefined;
  if (!values?.length) return value;
  if (typeof value === 'string') {
    const found = values.find((candidate) => typeof candidate === 'string' && candidate.toLowerCase() === value.toLowerCase());
    return found;
  }
  return values.some((candidate) => candidate === value) ? value : undefined;
}

function schemaAcceptsString(schema: unknown): boolean {
  const item = record(schema);
  const type = text(item?.type);
  return !type || type === 'string';
}

function inputValueForKey(key: string, schema: unknown, subject: TelegraphEvidenceSubject): unknown {
  const normalized = normalizedInputKey(key);
  const query = subject.query.trim();
  const address = subject.address?.trim();
  const network = canonicalSubjectNetwork(subject.network);
  let candidate: unknown;
  if (ADDRESS_KEYS.has(normalized)) candidate = address;
  else if (NETWORK_KEYS.has(normalized)) candidate = network || undefined;
  else if (PROTOCOL_KEYS.has(normalized)) candidate = subject.kind === 'protocol' ? query : undefined;
  else if (WALLET_KEYS.has(normalized)) candidate = subject.kind === 'wallet' ? (address ?? (/^0x[a-fA-F0-9]{40}$/.test(query) ? query : undefined)) : undefined;
  else if (STABLECOIN_KEYS.has(normalized)) candidate = subject.kind === 'stablecoin' ? query : undefined;
  else if (TOKEN_KEYS.has(normalized)) candidate = subject.kind === 'token' || subject.kind === 'stablecoin' ? (address ?? query) : undefined;
  else if (SYMBOL_KEYS.has(normalized)) candidate = !/^0x[a-fA-F0-9]{40}$/.test(query) ? query : undefined;
  else if (QUERY_KEYS.has(normalized)) candidate = query || undefined;
  if (candidate === undefined) candidate = schemaDefault(schema);
  if (candidate === undefined) return undefined;
  if (typeof candidate === 'string' && !schemaAcceptsString(schema)) return undefined;
  return matchEnum(candidate, schema);
}

function schemaCanBindSubject(inputSchema: Record<string, unknown> | undefined): boolean {
  if (!inputSchema) return false;
  const properties = record(inputSchema.properties);
  if (!properties || Object.keys(properties).length === 0) return false;
  const required = stringArray(inputSchema.required);
  const supportedKey = (key: string): boolean => {
    const normalized = normalizedInputKey(key);
    return QUERY_KEYS.has(normalized)
      || ADDRESS_KEYS.has(normalized)
      || NETWORK_KEYS.has(normalized)
      || TOKEN_KEYS.has(normalized)
      || SYMBOL_KEYS.has(normalized)
      || PROTOCOL_KEYS.has(normalized)
      || WALLET_KEYS.has(normalized)
      || STABLECOIN_KEYS.has(normalized)
      || schemaDefault(properties[key]) !== undefined;
  };
  return Object.keys(properties).some(supportedKey) && required.every(supportedKey);
}

export function bindTelegraphSubjectPayload(mapping: TelegraphCapabilityMapping, subject: TelegraphEvidenceSubject): TelegraphSubjectBindingResult {
  if (!mapping.routerReady || !safeEndpoint(mapping)) return { ok: false, reason: 'Telegraph mapping is not safe for direct read-only invocation.' };
  const inputSchema = mapping.endpoint?.inputSchema;
  if (!inputSchema || !schemaCanBindSubject(inputSchema)) {
    return { ok: false, reason: 'Telegraph endpoint input schema cannot be bound deterministically from an AgentPlace intelligence subject.' };
  }
  const subjectNetwork = canonicalSubjectNetwork(subject.network);
  if (subjectNetwork && mapping.subjectNetworks.length && !mapping.subjectNetworks.includes(subjectNetwork)) {
    return { ok: false, reason: `Telegraph service does not declare support for subject network ${subjectNetwork}.` };
  }
  const properties = record(inputSchema.properties) ?? {};
  const required = new Set(stringArray(inputSchema.required));
  const payload: Record<string, unknown> = {};
  for (const [key, propertySchema] of Object.entries(properties)) {
    const value = inputValueForKey(key, propertySchema, subject);
    if (value !== undefined) payload[key] = value;
    else if (required.has(key)) return { ok: false, reason: `Required Telegraph input field ${key} cannot be derived safely from the AgentPlace subject.` };
  }
  if (!Object.keys(payload).length) return { ok: false, reason: 'Telegraph input binding produced no declared fields; AgentPlace will not invent a payload.' };
  return { ok: true, payload };
}

function mappingInvocationReady(mapping: TelegraphCapabilityMapping): boolean {
  return mapping.routerReady && safeEndpoint(mapping) && schemaCanBindSubject(mapping.endpoint?.inputSchema);
}

function catalogCacheKey(config: TelegraphAdapterConfig, payment: TelegraphServicePaymentConfig): string {
  return `${config.nodeUrl}|${config.engineUrl}|${config.dispatcherUrl}|${payment.enabled}|${!!payment.privateKey}`;
}

function discoveryCacheMs(env: NodeJS.ProcessEnv): number {
  return boundedInteger(env.TELEGRAPH_DISCOVERY_CACHE_MS, DEFAULT_DISCOVERY_CACHE_MS, 10_000, 10 * 60_000);
}

function routerImplementation(mapping: TelegraphCapabilityMapping, snapshot: TelegraphDiscoverySnapshot, payment: TelegraphServicePaymentConfig): TelegraphRouterImplementation {
  return {
    id: mapping.implementationId,
    canonicalCapabilityId: mapping.canonicalCapabilityId,
    provider: 'telegraph',
    name: `Telegraph · ${mapping.service.name}`,
    version: `testnet-${mapping.ruleId}`,
    supportedNetworks: [...mapping.subjectNetworks],
    pricing: {
      metered: true,
      keyRequired: false,
      servicePayment: true,
      protocol: 'x402',
      environment: 'testnet',
      protocolNetwork: TELEGRAPH_PROTOCOL_NETWORK,
      asset: BASE_SEPOLIA_USDC,
      maxCallUsdc: formatUsdcAtomic(payment.maxCallAtomic),
      maxJobUsdc: formatUsdcAtomic(payment.maxJobAtomic),
      maxCallsPerJob: payment.maxCallsPerJob,
      ...(mapping.costPerCall ? { advertisedCostPerCall: mapping.costPerCall } : {}),
      ...(mapping.minPriceUsdc === undefined ? {} : { advertisedMinPriceUsdc: mapping.minPriceUsdc }),
    },
    trustStatus: 'experimental',
    healthStatus: snapshot.status === 'healthy' ? 'healthy' : snapshot.status === 'degraded' ? 'degraded' : 'unavailable',
    invocationKind: 'telegraph-direct-x402',
    knownFailureStates: [
      'telegraph-discovery-unavailable',
      'telegraph-service-unavailable',
      'telegraph-input-schema-unbindable',
      'x402-payment-required-invalid',
      'x402-payment-budget-exceeded',
      'x402-payment-settlement-unknown',
      'telegraph-malformed-response',
    ],
    priority: 900,
    enabled: true,
    environmentEligibility: ['development', 'testnet', 'staging-mainnet-readonly', 'production-mainnet'],
  };
}

export async function loadTelegraphRuntimeCatalog(options: TelegraphDiscoveryOptions & { env?: NodeJS.ProcessEnv; forceRefresh?: boolean } = {}): Promise<TelegraphRuntimeCatalog> {
  const env = options.env ?? process.env;
  const payment = servicePaymentConfig(env);
  const config = options.config ? { ...telegraphAdapterConfigFromEnv(env), ...options.config } : telegraphAdapterConfigFromEnv(env);
  const key = catalogCacheKey(config, payment);
  const now = Date.now();
  if (!options.forceRefresh && !options.fetchImpl && runtimeCatalogCache && runtimeCatalogCache.key === key && runtimeCatalogCache.expiresAt > now) {
    return runtimeCatalogCache.value;
  }
  const snapshot = await discoverTelegraph({ config, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) });
  const report = mapTelegraphCapabilities(snapshot);
  const mappings = report.mappings.filter(mappingInvocationReady);
  const implementations = payment.enabled && payment.privateKey && payment.payerAddress && !payment.configurationError
    ? mappings.map((mapping) => routerImplementation(mapping, snapshot, payment))
    : [];
  const value: TelegraphRuntimeCatalog = { snapshot, report, mappings, implementations, loadedAt: new Date().toISOString() };
  if (!options.fetchImpl) runtimeCatalogCache = { key, expiresAt: now + discoveryCacheMs(env), value };
  return value;
}

export async function telegraphRouterImplementations(env: NodeJS.ProcessEnv = process.env): Promise<TelegraphRouterImplementation[]> {
  if (!telegraphServicePaymentReady(env)) return [];
  try {
    return (await loadTelegraphRuntimeCatalog({ env })).implementations;
  } catch {
    return [];
  }
}

export function resetTelegraphRuntimeCache(): void {
  runtimeCatalogCache = undefined;
}

async function readBoundedText(response: Response, maxResponseBytes: number): Promise<string> {
  const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) throw new Error('TELEGRAPH_RESPONSE_TOO_LARGE');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxResponseBytes) {
      await reader.cancel();
      throw new Error('TELEGRAPH_RESPONSE_TOO_LARGE');
    }
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

function parseJson(textValue: string): unknown {
  if (!textValue.trim()) return {};
  try {
    return JSON.parse(textValue) as unknown;
  } catch {
    return undefined;
  }
}

function decodeBase64Json(value: string | null): unknown {
  if (!value?.trim()) return undefined;
  try {
    return JSON.parse(Buffer.from(value.trim(), 'base64').toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function requestResourceMatches(resourceUrl: string, requestUrl: string): boolean {
  try {
    const resource = new URL(resourceUrl);
    const request = new URL(requestUrl);
    return resource.protocol === request.protocol && resource.host === request.host && resource.pathname.replace(/\/$/, '') === request.pathname.replace(/\/$/, '');
  } catch {
    return false;
  }
}

function paymentRequirement(value: unknown, policy: TelegraphServicePaymentConfig): TelegraphPaymentRequirement | undefined {
  const item = record(value);
  if (!item || item.scheme !== 'exact' || item.network !== TELEGRAPH_PAYMENT_NETWORK) return undefined;
  const amount = text(item.amount);
  const asset = text(item.asset);
  const payTo = text(item.payTo);
  const timeout = typeof item.maxTimeoutSeconds === 'number' ? item.maxTimeoutSeconds : Number(item.maxTimeoutSeconds);
  const extra = record(item.extra) ?? {};
  const name = text(extra.name);
  const version = text(extra.version);
  const transferMethod = text(extra.assetTransferMethod)?.toLowerCase();
  if (!amount || !/^\d+$/.test(amount) || BigInt(amount) <= 0n || BigInt(amount) > policy.maxCallAtomic) return undefined;
  if (!asset || asset.toLowerCase() !== BASE_SEPOLIA_USDC.toLowerCase() || !isAddress(asset)) return undefined;
  if (!payTo || !isAddress(payTo)) return undefined;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 300) return undefined;
  if (!name || name.length > 80 || !version || version.length > 32) return undefined;
  if (transferMethod && transferMethod !== 'eip3009') return undefined;
  return {
    scheme: 'exact',
    network: TELEGRAPH_PAYMENT_NETWORK,
    amount,
    asset,
    payTo,
    maxTimeoutSeconds: Math.floor(timeout),
    extra: {
      name,
      version,
      ...(transferMethod === 'eip3009' ? { assetTransferMethod: 'eip3009' } : {}),
    },
  };
}

export function selectTelegraphPaymentChallenge(value: unknown, requestUrl: string, env: NodeJS.ProcessEnv = process.env): { challenge?: TelegraphPaymentChallenge; requirement?: TelegraphPaymentRequirement; reason?: string } {
  const policy = servicePaymentConfig(env);
  const root = record(value);
  if (!root || root.x402Version !== 2) return { reason: 'Telegraph returned an unsupported or malformed x402 challenge.' };
  const resource = record(root.resource);
  const resourceUrl = text(resource?.url);
  if (!resourceUrl || !requestResourceMatches(resourceUrl, requestUrl)) return { reason: 'Telegraph x402 resource did not match the exact Engine request URL.' };
  const extensions = record(root.extensions);
  if (extensions && Object.keys(extensions).length > 0) return { reason: 'Telegraph requested unsupported x402 extensions; AgentPlace failed closed.' };
  const requirements = Array.isArray(root.accepts) ? root.accepts.map((item) => paymentRequirement(item, policy)).filter((item): item is TelegraphPaymentRequirement => !!item) : [];
  requirements.sort((left, right) => {
    const amountDelta = BigInt(left.amount) - BigInt(right.amount);
    return amountDelta < 0n ? -1 : amountDelta > 0n ? 1 : left.payTo.localeCompare(right.payTo);
  });
  const requirement = requirements[0];
  if (!requirement) return { reason: 'No x402 requirement matched AgentPlace Base Sepolia USDC, exact/EIP-3009 and per-call limits.' };
  const challenge: TelegraphPaymentChallenge = {
    x402Version: 2,
    resource: {
      url: resourceUrl,
      ...(text(resource?.description) ? { description: text(resource?.description)! } : {}),
      ...(text(resource?.mimeType) ? { mimeType: text(resource?.mimeType)! } : {}),
    },
    accepts: requirements,
    ...(extensions ? { extensions } : {}),
  };
  return { challenge, requirement };
}

function base64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

async function signEip3009Payment(args: {
  challenge: TelegraphPaymentChallenge;
  requirement: TelegraphPaymentRequirement;
  privateKey: Hex;
}): Promise<{ header: string; payerAddress: Address }> {
  const account = privateKeyToAccount(args.privateKey);
  const now = Math.floor(Date.now() / 1000);
  // x402's current EIP-3009 client guidance uses validAfter=0 to avoid
  // clock/block-timestamp skew while retaining a short validBefore expiry.
  const validAfter = 0n;
  const validBefore = BigInt(now + Math.max(5, Math.min(args.requirement.maxTimeoutSeconds, 120)));
  const nonce = `0x${randomBytes(32).toString('hex')}` as Hex;
  const value = BigInt(args.requirement.amount);
  const signature = await account.signTypedData({
    domain: {
      name: args.requirement.extra.name,
      version: args.requirement.extra.version,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      verifyingContract: args.requirement.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: account.address,
      to: args.requirement.payTo,
      value,
      validAfter,
      validBefore,
      nonce,
    },
  });
  const payload = {
    x402Version: 2,
    resource: args.challenge.resource,
    accepted: args.requirement,
    payload: {
      signature,
      authorization: {
        from: account.address,
        to: args.requirement.payTo,
        value: args.requirement.amount,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
    extensions: {},
  };
  return { header: base64Json(payload), payerAddress: account.address };
}

async function reserveServicePayment(args: {
  ownerUserId: string;
  jobId: string;
  taskId: string;
  capabilityId: string;
  implementationId: string;
  serviceId: string;
  requestFingerprint: string;
  requirement: TelegraphPaymentRequirement;
  payerAddress: Address;
  policy: TelegraphServicePaymentConfig;
}): Promise<string> {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`telegraph:${args.ownerUserId}:${args.jobId}`]);
    const existing = await client.query<PaymentLedgerRow>(
      `SELECT id,status,amount_atomic::text FROM telegraph_service_payment WHERE owner_user_id=$1 AND job_id=$2 AND request_fingerprint=$3 LIMIT 1`,
      [args.ownerUserId, args.jobId, args.requestFingerprint],
    );
    if (existing.rows[0]) throw new Error(`TELEGRAPH_PAYMENT_DUPLICATE:${existing.rows[0].status}`);
    const budget = await client.query<PaymentBudgetRow>(
      `SELECT COALESCE(SUM(amount_atomic),0)::text AS amount_atomic,COUNT(*)::text AS call_count
       FROM telegraph_service_payment
       WHERE owner_user_id=$1 AND job_id=$2 AND status IN ('reserved','settled','unknown')`,
      [args.ownerUserId, args.jobId],
    );
    const committedAtomic = BigInt(budget.rows[0]?.amount_atomic ?? '0');
    const callCount = Number.parseInt(budget.rows[0]?.call_count ?? '0', 10) || 0;
    const amountAtomic = BigInt(args.requirement.amount);
    if (amountAtomic > args.policy.maxCallAtomic) throw new Error('TELEGRAPH_PAYMENT_CALL_LIMIT');
    if (committedAtomic + amountAtomic > args.policy.maxJobAtomic) throw new Error('TELEGRAPH_PAYMENT_JOB_LIMIT');
    if (callCount >= args.policy.maxCallsPerJob) throw new Error('TELEGRAPH_PAYMENT_JOB_CALL_LIMIT');
    const id = `tpay_${randomUUID()}`;
    await client.query(
      `INSERT INTO telegraph_service_payment(id,owner_user_id,job_id,task_id,capability_id,implementation_id,service_id,request_fingerprint,payment_network,asset_address,pay_to,payer_address,amount_atomic,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'reserved')`,
      [id,args.ownerUserId,args.jobId,args.taskId,args.capabilityId,args.implementationId,args.serviceId,args.requestFingerprint,TELEGRAPH_PAYMENT_NETWORK,args.requirement.asset,args.requirement.payTo,args.payerAddress,args.requirement.amount],
    );
    return id;
  });
}

async function updateServicePayment(args: {
  id: string;
  ownerUserId: string;
  status: PaymentLedgerStatus;
  transactionHash?: string;
  errorCode?: string;
  settlement?: Record<string, unknown>;
}): Promise<void> {
  await getDatabasePool().query(
    `UPDATE telegraph_service_payment
     SET status=$3,transaction_hash=$4,error_code=$5,settlement_response=$6::jsonb,updated_at=now()
     WHERE id=$1 AND owner_user_id=$2`,
    [args.id,args.ownerUserId,args.status,args.transactionHash??null,args.errorCode??null,JSON.stringify(args.settlement ?? {})],
  );
}

function safeSettlement(value: unknown): Record<string, unknown> | undefined {
  const item = record(value);
  if (!item) return undefined;
  const result: Record<string, unknown> = {};
  if (typeof item.success === 'boolean') result.success = item.success;
  const transaction = text(item.transaction);
  const network = text(item.network);
  const payer = text(item.payer);
  const amount = text(item.amount);
  const errorReason = text(item.errorReason ?? item.error_reason);
  if (transaction) result.transaction = transaction;
  if (network) result.network = network;
  if (payer) result.payer = payer;
  if (amount) result.amount = amount;
  if (errorReason) result.errorReason = errorReason;
  return result;
}

function paymentEvidence(args: {
  status: PaymentLedgerStatus;
  requirement: TelegraphPaymentRequirement;
  payerAddress: Address;
  transactionHash?: string;
}): TelegraphServicePaymentEvidence {
  return {
    status: args.status,
    protocol: 'x402',
    environment: 'testnet',
    network: TELEGRAPH_PROTOCOL_NETWORK,
    caip2Network: TELEGRAPH_PAYMENT_NETWORK,
    asset: args.requirement.asset,
    amountAtomic: args.requirement.amount,
    amountUsdc: formatUsdcAtomic(BigInt(args.requirement.amount)),
    payTo: args.requirement.payTo,
    payerAddress: args.payerAddress,
    ...(args.transactionHash ? { transactionHash: args.transactionHash } : {}),
  };
}

async function fetchDirect(args: {
  url: string;
  body: Record<string, unknown>;
  config: TelegraphAdapterConfig;
  fetchImpl: typeof fetch;
  paymentSignature?: string;
}): Promise<{ response: Response; text: string; parsed: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.config.timeoutMs);
  try {
    const response = await args.fetchImpl(args.url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(args.paymentSignature ? { 'PAYMENT-SIGNATURE': args.paymentSignature } : {}),
      },
      body: JSON.stringify(args.body),
      signal: controller.signal,
      redirect: 'error',
    });
    const bodyText = await readBoundedText(response, args.config.maxResponseBytes);
    return { response, text: bodyText, parsed: parseJson(bodyText) };
  } finally {
    clearTimeout(timer);
  }
}

function errorEnvelope(message: string): TelegraphInferenceEnvelope {
  return { error: message, timestamp: new Date().toISOString() };
}

function requestFingerprint(args: TelegraphMappedInvocationInput, mapping: TelegraphCapabilityMapping, payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify({
    ownerUserId: args.ownerUserId,
    jobId: args.jobId,
    taskId: args.taskId,
    capabilityId: args.capabilityId,
    implementationId: args.implementationId,
    serviceId: mapping.service.id,
    method: mapping.endpoint?.method,
    endpoint: mapping.endpoint?.path,
    subject: args.subject,
    payload,
  })).digest('hex');
}

function directResponseEnvelope(value: unknown, mapping: TelegraphCapabilityMapping): TelegraphInferenceEnvelope {
  const root = record(value);
  if (!root) return errorEnvelope('Telegraph returned a non-JSON or malformed direct inference response.');
  const result = 'result' in root ? root.result : undefined;
  const minerIdValue = root.miner_id ?? root.minerId ?? root.miner_used ?? root.minerUsed ?? mapping.service.id;
  const minerId = typeof minerIdValue === 'number' ? minerIdValue : text(minerIdValue);
  return {
    ...(minerId === undefined ? {} : { minerId }),
    minerSlug: mapping.service.slug,
    minerName: text(root.miner_name ?? root.minerName) ?? mapping.service.name,
    ...(mapping.endpoint?.path ? { endpoint: mapping.endpoint.path } : {}),
    ...(mapping.matchedIntents[0] ? { intent: mapping.matchedIntents[0] } : {}),
    ...(result === undefined ? {} : { result }),
    ...(typeof root.cost_usd === 'number' || typeof root.cost_usd === 'string' ? { costUsd: root.cost_usd as number | string } : {}),
    ...(typeof root.duration_ms === 'number' ? { durationMs: root.duration_ms } : {}),
    ...(text(root.timestamp) ? { timestamp: text(root.timestamp)! } : { timestamp: new Date().toISOString() }),
    ...(text(root.signal_hash ?? root.signalHash) ? { signalHash: text(root.signal_hash ?? root.signalHash)! } : {}),
    ...(Array.isArray(root.warnings) ? { warnings: root.warnings.slice(0, 32) } : {}),
    ...(text(root.error) ? { error: text(root.error)! } : {}),
  };
}

export async function invokeTelegraphMappedService(input: TelegraphMappedInvocationInput): Promise<TelegraphMappedInvocationResult> {
  const env = input.env ?? process.env;
  const payment = servicePaymentConfig(env);
  if (!payment.enabled || !payment.privateKey || !payment.payerAddress || payment.configurationError) {
    return { response: errorEnvelope('Telegraph service payment is not configured for the Worker runtime.') };
  }
  const baseConfig = telegraphAdapterConfigFromEnv(env);
  const config: TelegraphAdapterConfig = {
    nodeUrl: input.config?.nodeUrl ?? baseConfig.nodeUrl,
    engineUrl: input.config?.engineUrl ?? baseConfig.engineUrl,
    dispatcherUrl: input.config?.dispatcherUrl ?? baseConfig.dispatcherUrl,
    timeoutMs: input.config?.timeoutMs ?? baseConfig.timeoutMs,
    maxResponseBytes: input.config?.maxResponseBytes ?? baseConfig.maxResponseBytes,
  };
  let catalog: TelegraphRuntimeCatalog;
  try {
    catalog = await loadTelegraphRuntimeCatalog({ env, config, ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}) });
  } catch {
    return { response: errorEnvelope('Telegraph discovery was unavailable; AgentPlace will use another eligible implementation when available.') };
  }
  const mapping = catalog.mappings.find((candidate) => candidate.implementationId === input.implementationId && candidate.canonicalCapabilityId === input.capabilityId);
  if (!mapping) return { response: errorEnvelope('The selected Telegraph implementation is no longer present in current eligible discovery.') };
  const service = catalog.snapshot.miners.find((miner) => miner.id === mapping.service.id || miner.slug === mapping.service.slug);
  const binding = bindTelegraphSubjectPayload(mapping, input.subject);
  if (!binding.ok || !binding.payload) return { response: errorEnvelope(binding.reason ?? 'Telegraph input binding failed.'), mapping, ...(service ? { service } : {}) };
  const method = mapping.endpoint?.method?.toUpperCase();
  const endpoint = mapping.endpoint?.path;
  if (!method || !endpoint || (method !== 'GET' && method !== 'POST')) {
    return { response: errorEnvelope('Telegraph endpoint method is not allowed by the read-only AgentPlace integration.'), mapping, ...(service ? { service } : {}) };
  }
  const url = `${config.engineUrl.replace(/\/$/, '')}/v1/ask/${encodeURIComponent(mapping.service.id)}`;
  const body = { method, endpoint, payload: binding.payload };
  const fetchImpl = input.fetchImpl ?? fetch;
  let initial: { response: Response; text: string; parsed: unknown };
  try {
    initial = await fetchDirect({ url, body, config, fetchImpl });
  } catch {
    return { response: errorEnvelope('Telegraph direct inference was unreachable before any payment authorization was sent.'), mapping, ...(service ? { service } : {}) };
  }
  if (initial.response.ok) {
    return { response: directResponseEnvelope(initial.parsed, mapping), mapping, ...(service ? { service } : {}) };
  }
  if (initial.response.status !== 402) {
    return { response: errorEnvelope(`Telegraph direct inference returned HTTP ${initial.response.status} before payment.`), mapping, ...(service ? { service } : {}) };
  }
  const challengeValue = decodeBase64Json(initial.response.headers.get('payment-required')) ?? initial.parsed;
  const selected = selectTelegraphPaymentChallenge(challengeValue, url, env);
  if (!selected.challenge || !selected.requirement) {
    return { response: errorEnvelope(selected.reason ?? 'Telegraph x402 challenge failed AgentPlace validation.'), mapping, ...(service ? { service } : {}) };
  }
  let signed: { header: string; payerAddress: Address };
  try {
    signed = await signEip3009Payment({ challenge: selected.challenge, requirement: selected.requirement, privateKey: payment.privateKey });
  } catch {
    return { response: errorEnvelope('AgentPlace could not form the bounded Telegraph x402 authorization.'), mapping, ...(service ? { service } : {}) };
  }
  const fingerprint = requestFingerprint(input, mapping, binding.payload);
  let reservationId: string;
  try {
    reservationId = await reserveServicePayment({
      ownerUserId: input.ownerUserId,
      jobId: input.jobId,
      taskId: input.taskId,
      capabilityId: input.capabilityId,
      implementationId: input.implementationId,
      serviceId: mapping.service.id,
      requestFingerprint: fingerprint,
      requirement: selected.requirement,
      payerAddress: signed.payerAddress,
      policy: payment,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(':')[0] : 'TELEGRAPH_PAYMENT_RESERVATION_FAILED';
    return { response: errorEnvelope(`Telegraph service payment was not authorized by AgentPlace service-spend policy (${code}).`), mapping, ...(service ? { service } : {}) };
  }
  let paid: { response: Response; text: string; parsed: unknown };
  try {
    paid = await fetchDirect({ url, body, config, fetchImpl, paymentSignature: signed.header });
  } catch {
    await updateServicePayment({ id: reservationId, ownerUserId: input.ownerUserId, status: 'unknown', errorCode: 'PAID_REQUEST_OUTCOME_UNKNOWN' });
    return {
      response: errorEnvelope('Telegraph paid request outcome is unknown. AgentPlace will not retry or issue another payment for the same request.'),
      mapping,
      ...(service ? { service } : {}),
      servicePayment: paymentEvidence({ status: 'unknown', requirement: selected.requirement, payerAddress: signed.payerAddress }),
    };
  }
  const settlement = safeSettlement(decodeBase64Json(paid.response.headers.get('payment-response')));
  const settlementSuccess = settlement?.success === true;
  const settlementFailure = settlement?.success === false;
  const transactionHash = text(settlement?.transaction);
  let ledgerStatus: PaymentLedgerStatus;
  if (settlementSuccess && paid.response.ok) ledgerStatus = 'settled';
  else if (settlementFailure) ledgerStatus = 'failed';
  else ledgerStatus = 'unknown';
  await updateServicePayment({
    id: reservationId,
    ownerUserId: input.ownerUserId,
    status: ledgerStatus,
    ...(transactionHash ? { transactionHash } : {}),
    ...(!paid.response.ok ? { errorCode: `HTTP_${paid.response.status}` } : {}),
    ...(settlement ? { settlement } : {}),
  });
  const servicePayment = paymentEvidence({ status: ledgerStatus, requirement: selected.requirement, payerAddress: signed.payerAddress, ...(transactionHash ? { transactionHash } : {}) });
  if (!paid.response.ok) {
    return { response: errorEnvelope(`Telegraph paid inference returned HTTP ${paid.response.status}.`), mapping, ...(service ? { service } : {}), servicePayment };
  }
  if (!settlementSuccess) {
    return { response: errorEnvelope('Telegraph returned inference data without a confirmed x402 settlement receipt; evidence is not accepted as successful.'), mapping, ...(service ? { service } : {}), servicePayment };
  }
  return { response: directResponseEnvelope(paid.parsed, mapping), mapping, ...(service ? { service } : {}), servicePayment };
}

export async function normalizeTelegraphMappedInvocation(input: TelegraphMappedInvocationInput): Promise<TelegraphNormalizedEvidence> {
  const result = await invokeTelegraphMappedService(input);
  return normalizeTelegraphEvidence({
    jobId: input.jobId,
    taskId: input.taskId,
    capabilityId: input.capabilityId,
    implementationId: input.implementationId,
    subject: input.subject,
    response: result.response,
    ...(result.service ? { service: result.service } : {}),
    ...(result.mapping ? { mapping: result.mapping } : {}),
    ...(result.servicePayment ? { servicePayment: result.servicePayment } : {}),
    ...(input.config ? { config: input.config } : {}),
  });
}

export const telegraphRuntimeManifest = {
  name: 'telegraph-runtime',
  milestone: '5B.2.3',
  mode: 'direct-miner-x402-read-only',
  protocolNetwork: TELEGRAPH_PROTOCOL_NETWORK,
  paymentAsset: BASE_SEPOLIA_USDC,
  authority: 'service-payment-only',
} as const;
