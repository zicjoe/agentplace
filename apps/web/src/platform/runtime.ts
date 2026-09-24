import type { PublicRuntimeConfig } from '@agent-place/shared';

export type WebDataMode = 'fixtures' | 'api';

export interface WebRuntimeSettings {
  readonly apiBaseUrl: string;
  readonly authBaseUrl: string;
  readonly dataMode: WebDataMode;
  readonly demoControlsEnabled: boolean;
  readonly persistFixtureState: boolean;
}

export interface RuntimeConnectionState {
  readonly status: 'checking' | 'ready' | 'unavailable';
  readonly publicConfig: PublicRuntimeConfig | null;
  readonly error: string | null;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return value === 'true';
}

function parseDataMode(value: string | undefined): WebDataMode {
  return value === 'fixtures' ? 'fixtures' : 'api';
}

export const WEB_RUNTIME_SETTINGS: WebRuntimeSettings = Object.freeze({
  apiBaseUrl: (import.meta.env.VITE_AGENT_PLACE_API_BASE_URL || '').replace(/\/$/, ''),
  authBaseUrl: (import.meta.env.VITE_AGENT_PLACE_AUTH_BASE_URL || '').replace(/\/$/, ''),
  dataMode: parseDataMode(import.meta.env.VITE_AGENT_PLACE_DATA_MODE),
  demoControlsEnabled: parseBoolean(import.meta.env.VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS, false),
  persistFixtureState: parseBoolean(import.meta.env.VITE_AGENT_PLACE_PERSIST_FIXTURES, true),
});
