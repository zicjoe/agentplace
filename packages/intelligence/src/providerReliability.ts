/** M15 bounded provider retry and within-Job single-flight helpers. */
export class ProviderHttpError extends Error {
  readonly statusCode: number;
  readonly retryAfterMs: number | undefined;
  constructor(statusCode: number, retryAfterMs?: number) {
    super(`HTTP_${statusCode}`);
    this.name = 'ProviderHttpError';
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
  }
}

export function retryAfterMilliseconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value.trim())) return Math.max(0, Math.round(Number(value) * 1000));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

export async function withBoundedProviderRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts: number; maxWaitMs: number; defaultWaitMs?: number; sleep?: (durationMs: number) => Promise<void>; onRetry?: (waitMs: number, statusCode: number) => void },
): Promise<T> {
  const attempts = Math.max(1, Math.min(3, Math.floor(options.maxAttempts)));
  const maxWait = Math.max(0, Math.min(3000, Math.floor(options.maxWaitMs)));
  const sleep = options.sleep ?? ((durationMs: number) => new Promise<void>((resolve) => setTimeout(resolve, durationMs)));
  for (let attempt = 1; ; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      if (!(error instanceof ProviderHttpError) || attempt >= attempts || ![429, 502, 503, 504].includes(error.statusCode)) throw error;
      const waitMs = error.retryAfterMs ?? Math.min(maxWait, (options.defaultWaitMs ?? 400) * attempt);
      // Do not hammer a provider that requests a long cool-down; preserve the
      // failure so another configured provider may be considered by the router.
      if (waitMs > maxWait) throw error;
      options.onRetry?.(waitMs, error.statusCode);
      await sleep(waitMs);
    }
  }
}

/** Only share identical requests inside one research collection; never across Jobs. */
export function singleFlight<T>(cache: Map<string, Promise<unknown>>, key: string, operation: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing as Promise<T>;
  const promise = operation();
  cache.set(key, promise);
  return promise;
}
