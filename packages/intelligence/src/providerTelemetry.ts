/**
 * M15 Stage 2 — privacy-bounded outbound provider request accounting.
 * Do not persist raw URLs, headers, bodies, API keys or wallet addresses.
 * Every collection receives its own AsyncLocalStorage ledger.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type ProviderRequestOutcome = 'ok' | 'http_error' | 'timeout' | 'network_error' | 'invalid_json';
export interface ProviderRequestEvent {
  provider: string;
  operation: string;
  outcome: ProviderRequestOutcome;
  durationMs: number;
  statusCode?: number;
}
export interface ProviderTelemetryCheckpoint { attempts: number; reuses: number; retries: number; }
export interface ProviderRequestSummary {
  version: 'm15-stage2-v1';
  outboundAttempts: number;
  cacheReuses: number;
  scheduledRetries: number;
  retryWaitMs: number;
  elapsedMs: number;
  requests: ProviderRequestEvent[];
}

/** Fixed operation names avoid exposing API keys in URL paths and query strings. */
export function classifyProviderEndpoint(rawUrl: string): { provider: string; operation: string } {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (host === 'api.dexscreener.com') return { provider: 'dexscreener', operation: path.includes('/token-pairs/') ? 'token-pairs' : 'other' };
    if (host === 'api.nansen.ai') return { provider: 'nansen', operation: path.includes('/flow-intelligence') ? 'flow-intelligence' : 'other' };
    if (host.endsWith('.alchemy.com')) return { provider: 'alchemy', operation: path.includes('/v2/') ? 'solana-rpc' : 'portfolio' };
    if (host === 'api.gopluslabs.io') return { provider: 'goplus', operation: path.includes('/token_security/') ? 'token-security' : 'other' };
    if (host === 'api.coingecko.com' || host === 'pro-api.coingecko.com') return { provider: 'coingecko', operation: 'market-api' };
    if (host.endsWith('llama.fi')) return { provider: 'defillama', operation: 'public-api' };
    if (host === 'public-api.birdeye.so') return { provider: 'birdeye', operation: 'public-api' };
    if (host.includes('bubblemaps.io')) return { provider: 'bubblemaps', operation: 'public-api' };
    if (host.includes('etherscan') || host.includes('bscscan') || host.includes('basescan') || host.includes('arbiscan')) return { provider: 'etherscan', operation: 'explorer-api' };
    if (host.includes('blockscout.com')) return { provider: 'blockscout', operation: 'explorer-api' };
    if (host === 'gateway.thegraph.com') return { provider: 'thegraph', operation: 'subgraph-query' };
    return { provider: 'other', operation: 'external-request' };
  } catch { return { provider: 'other', operation: 'external-request' }; }
}

export class ProviderRequestLedger {
  private readonly attempts: ProviderRequestEvent[] = [];
  private readonly reuses: string[] = [];
  private readonly retries: Array<{ provider: string; waitMs: number }> = [];

  checkpoint(): ProviderTelemetryCheckpoint {
    return { attempts: this.attempts.length, reuses: this.reuses.length, retries: this.retries.length };
  }

  recordAttempt(rawUrl: string, outcome: ProviderRequestOutcome, durationMs: number, statusCode?: number): void {
    const endpoint = classifyProviderEndpoint(rawUrl);
    this.attempts.push({ ...endpoint, outcome, durationMs: Math.max(0, Math.round(durationMs)),
      ...(typeof statusCode === 'number' ? { statusCode } : {}) });
  }

  recordReuse(provider: string): void {
    // Never store cache keys; keys can include wallet addresses.
    this.reuses.push(['dexscreener', 'nansen'].includes(provider) ? provider : 'other');
  }

  recordRetry(provider: string, waitMs: number): void {
    this.retries.push({ provider: ['dexscreener', 'nansen'].includes(provider) ? provider : 'other',
      waitMs: Math.max(0, Math.round(waitMs)) });
  }

  since(mark: ProviderTelemetryCheckpoint): ProviderRequestSummary {
    const requests = this.attempts.slice(mark.attempts);
    const retries = this.retries.slice(mark.retries);
    return { version: 'm15-stage2-v1', outboundAttempts: requests.length,
      cacheReuses: this.reuses.length - mark.reuses,
      scheduledRetries: retries.length,
      retryWaitMs: retries.reduce((total, retry) => total + retry.waitMs, 0),
      elapsedMs: requests.reduce((total, request) => total + request.durationMs, 0),
      requests };
  }
}

const requestContext = new AsyncLocalStorage<ProviderRequestLedger>();
export function currentProviderRequestLedger(): ProviderRequestLedger | undefined { return requestContext.getStore(); }
export async function withProviderRequestLedger<T>(ledger: ProviderRequestLedger, operation: () => Promise<T>): Promise<T> {
  return requestContext.run(ledger, operation);
}

/** Error classification only; never return provider response text or exception messages. */
export function classifyProviderFailure(error: unknown): { category: string; httpStatus?: number } {
  const candidate = error && typeof error === 'object' ? error as { statusCode?: unknown; name?: unknown } : {};
  const code = candidate.statusCode;
  if (typeof code === 'number' && Number.isInteger(code) && code >= 400 && code <= 599) {
    const category = code === 429 ? 'rate_limited' : [401, 403].includes(code) ? 'access_denied' : code >= 500 ? 'upstream_failure' : 'http_error';
    return { category, httpStatus: code };
  }
  if (candidate.name === 'AbortError') return { category: 'timeout' };
  if (candidate.name === 'SyntaxError') return { category: 'invalid_json' };
  return { category: 'network_or_provider_error' };
}
