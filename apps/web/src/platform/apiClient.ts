import type { ApiHealthResponse, PublicRuntimeConfig } from '@agent-place/shared';
import { WEB_RUNTIME_SETTINGS } from './runtime';

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`AgentPlace API request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export function getApiHealth(signal?: AbortSignal): Promise<ApiHealthResponse> {
  return getJson<ApiHealthResponse>('/health', signal);
}

export function getPublicRuntimeConfig(signal?: AbortSignal): Promise<PublicRuntimeConfig> {
  return getJson<PublicRuntimeConfig>('/api/v1/config', signal);
}
