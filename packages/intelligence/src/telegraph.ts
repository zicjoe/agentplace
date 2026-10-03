import { createHash } from 'node:crypto';
import { getDatabasePool } from '@agent-place/db';

export type TelegraphNetworkEnvironment = 'public-testnet' | 'mainnet' | 'custom';
export type TelegraphDiscoveryStatus = 'healthy' | 'degraded' | 'unavailable';

export interface TelegraphMinerSummary {
  id: string;
  slug: string;
  name: string;
  capabilities: string[];
  supportedIntents: string[];
  protocol?: string;
  costPerCall?: string;
}

export interface TelegraphIntentSummary {
  intentId: string;
  intentName: string;
  minerCount: number;
}

export interface TelegraphDiscoverySnapshot {
  id: string;
  environment: TelegraphNetworkEnvironment;
  nodeUrl: string;
  status: TelegraphDiscoveryStatus;
  minerCount: number;
  intentCount: number;
  miners: TelegraphMinerSummary[];
  intents: TelegraphIntentSummary[];
  daemonHealth: Record<string, unknown>;
  errors: string[];
  fetchedAt: string;
}

export interface TelegraphDiscoveryConfig {
  enabled: boolean;
  environment: TelegraphNetworkEnvironment;
  nodeUrl: string;
  timeoutMs: number;
}

type JsonObject = Record<string, unknown>;
type FetchResult = { ok: true; value: unknown } | { ok: false; error: string };

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function strings(value: unknown): string[] {
  return array(value).map(string).filter((item): item is string => !!item);
}

function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

export function normalizeTelegraphNodeUrl(raw: string): string {
  const url = new URL(raw.trim());
  if (url.username || url.password) throw new Error('TELEGRAPH_NODE_URL must not contain embedded credentials.');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('TELEGRAPH_NODE_URL must use HTTP or HTTPS.');
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) throw new Error('Remote TELEGRAPH_NODE_URL values must use HTTPS.');
  if (url.pathname && url.pathname !== '/') throw new Error('TELEGRAPH_NODE_URL must be a node origin without a path.');
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function networkEnvironment(value: string | undefined): TelegraphNetworkEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'mainnet') return 'mainnet';
  if (normalized === 'custom') return 'custom';
  return 'public-testnet';
}

export function telegraphDiscoveryConfig(source: NodeJS.ProcessEnv = process.env): TelegraphDiscoveryConfig {
  const timeout = Number.parseInt(source.TELEGRAPH_DISCOVERY_TIMEOUT_MS?.trim() || '12000', 10);
  return {
    enabled: boolEnv(source.TELEGRAPH_DISCOVERY_ENABLED, true),
    environment: networkEnvironment(source.TELEGRAPH_NETWORK_ENVIRONMENT),
    nodeUrl: normalizeTelegraphNodeUrl(source.TELEGRAPH_NODE_URL?.trim() || 'https://devnode.telegraphprotocol.com'),
    timeoutMs: Math.max(3000, Number.isFinite(timeout) ? timeout : 12000),
  };
}

async function fetchJsonResult(url: string, timeoutMs: number): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) return { ok: false, error: `HTTP_${response.status}:${text.slice(0, 240)}` };
    if (!text) return { ok: true, value: {} };
    try {
      return { ok: true, value: JSON.parse(text) as unknown };
    } catch {
      return { ok: false, error: 'INVALID_JSON_RESPONSE' };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeMiners(value: unknown): TelegraphMinerSummary[] {
  const payload = object(value);
  const rows = Array.isArray(value) ? array(value) : array(payload.miners);
  return rows.map(object).map((row) => {
    const slug = string(row.slug) ?? string(row.id) ?? string(row.subnet_id) ?? 'unknown';
    const id = string(row.id) ?? string(row.subnet_id) ?? slug;
    const name = string(row.name) ?? string(row.miner_name) ?? slug;
    const capabilities = strings(row.capabilities);
    const supportedIntents = strings(row.supported_intents);
    const protocol = string(row.protocol);
    const cost = string(row.cost_per_call) ?? string(row.min_price_usdc) ?? (number(row.min_price_usdc) === undefined ? undefined : String(number(row.min_price_usdc)));
    return {
      id,
      slug,
      name,
      capabilities,
      supportedIntents,
      ...(protocol ? { protocol } : {}),
      ...(cost ? { costPerCall: cost } : {}),
    };
  }).filter((row) => row.slug !== 'unknown');
}

function normalizeIntents(value: unknown): TelegraphIntentSummary[] {
  const payload = object(value);
  const rows = Array.isArray(value) ? array(value) : array(payload.intents);
  return rows.map(object).map((row) => {
    const intentId = string(row.intent_id) ?? string(row.id) ?? string(row.intent_name) ?? string(row.name) ?? '';
    const intentName = string(row.intent_name) ?? string(row.name) ?? intentId;
    const minerCount = Math.max(0, Math.trunc(number(row.miner_count) ?? number(row.count) ?? 0));
    return { intentId, intentName, minerCount };
  }).filter((row) => !!row.intentId);
}

function discoveryId(config: TelegraphDiscoveryConfig): string {
  const suffix = createHash('sha256').update(config.nodeUrl).digest('hex').slice(0, 12);
  return `telegraph:${config.environment}:${suffix}`;
}

export async function discoverTelegraphNetwork(config: TelegraphDiscoveryConfig = telegraphDiscoveryConfig()): Promise<TelegraphDiscoverySnapshot> {
  if (!config.enabled) {
    return {
      id: discoveryId(config),
      environment: config.environment,
      nodeUrl: config.nodeUrl,
      status: 'unavailable',
      minerCount: 0,
      intentCount: 0,
      miners: [],
      intents: [],
      daemonHealth: {},
      errors: ['Telegraph discovery is disabled by TELEGRAPH_DISCOVERY_ENABLED.'],
      fetchedAt: new Date().toISOString(),
    };
  }

  const [minersResult, intentsResult, daemonResult] = await Promise.all([
    fetchJsonResult(`${config.nodeUrl}/engine/v1/miners`, config.timeoutMs),
    fetchJsonResult(`${config.nodeUrl}/engine/v1/intents`, config.timeoutMs),
    fetchJsonResult(`${config.nodeUrl}/daemon/health`, config.timeoutMs),
  ]);

  const miners = minersResult.ok ? normalizeMiners(minersResult.value) : [];
  const intents = intentsResult.ok ? normalizeIntents(intentsResult.value) : [];
  const daemonHealth = daemonResult.ok ? object(daemonResult.value) : {};
  const errors = [
    ...(minersResult.ok ? [] : [`miners:${minersResult.error}`]),
    ...(intentsResult.ok ? [] : [`intents:${intentsResult.error}`]),
    ...(daemonResult.ok ? [] : [`daemon:${daemonResult.error}`]),
  ];
  const daemonOk = daemonResult.ok && string(daemonHealth.status)?.toLowerCase() === 'ok';
  const status: TelegraphDiscoveryStatus = minersResult.ok && intentsResult.ok && daemonOk
    ? 'healthy'
    : minersResult.ok || intentsResult.ok || daemonOk
      ? 'degraded'
      : 'unavailable';

  return {
    id: discoveryId(config),
    environment: config.environment,
    nodeUrl: config.nodeUrl,
    status,
    minerCount: miners.length,
    intentCount: intents.length,
    miners,
    intents,
    daemonHealth,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

export async function persistTelegraphDiscovery(snapshot: TelegraphDiscoverySnapshot): Promise<void> {
  await getDatabasePool().query(
    `INSERT INTO telegraph_discovery_snapshot(id,network_environment,node_url,status,miner_count,intent_count,miners,intents,daemon_health,errors,fetched_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,now())
     ON CONFLICT(id) DO UPDATE SET network_environment=EXCLUDED.network_environment,node_url=EXCLUDED.node_url,status=EXCLUDED.status,
       miner_count=EXCLUDED.miner_count,intent_count=EXCLUDED.intent_count,miners=EXCLUDED.miners,intents=EXCLUDED.intents,
       daemon_health=EXCLUDED.daemon_health,errors=EXCLUDED.errors,fetched_at=EXCLUDED.fetched_at,updated_at=now()`,
    [snapshot.id,snapshot.environment,snapshot.nodeUrl,snapshot.status,snapshot.minerCount,snapshot.intentCount,JSON.stringify(snapshot.miners),JSON.stringify(snapshot.intents),JSON.stringify(snapshot.daemonHealth),JSON.stringify(snapshot.errors),snapshot.fetchedAt],
  );
}

export async function refreshTelegraphDiscovery(config: TelegraphDiscoveryConfig = telegraphDiscoveryConfig()): Promise<TelegraphDiscoverySnapshot> {
  const snapshot = await discoverTelegraphNetwork(config);
  await persistTelegraphDiscovery(snapshot);
  return snapshot;
}
