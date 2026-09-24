import type { AppState } from '../state/types';
import { WEB_RUNTIME_SETTINGS } from './runtime';

const STORAGE_KEY = 'agentplace.m2.guest-state.v2';
const DATE_TAG = '__agentplaceDate';
const PERSISTENCE_VERSION = 2;

interface PersistedFixtureEnvelope {
  version: number;
  state: Partial<AppState>;
}

const transientKeys = new Set<keyof AppState>([
  'activeActionId',
  'activeReceiptId',
  'identityCheckpoint',
  'mobileDrawerOpen',
  'notificationInboxOpen',
  'showCreateMenu',
  'showDemoControls',
  'showSearch',
  'routeNotFound',
]);

function encode(value: unknown): unknown {
  if (value instanceof Date) return { [DATE_TAG]: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'function' || item === undefined) continue;
      output[key] = encode(item);
    }
    return output;
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record[DATE_TAG] === 'string') return new Date(record[DATE_TAG]);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) output[key] = decode(item);
    return output;
  }
  return value;
}

export function restoreFixtureState(base: AppState): AppState {
  if (
    typeof window === 'undefined' ||
    !WEB_RUNTIME_SETTINGS.persistFixtureState
  ) {
    return base;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const envelope = decode(JSON.parse(raw)) as PersistedFixtureEnvelope;
    if (envelope.version !== PERSISTENCE_VERSION || !envelope.state) return base;
    return { ...base, ...envelope.state, identityCheckpoint: null };
  } catch {
    return base;
  }
}

export function persistFixtureState(state: AppState): void {
  if (
    typeof window === 'undefined' ||
    !WEB_RUNTIME_SETTINGS.persistFixtureState ||
    (WEB_RUNTIME_SETTINGS.dataMode === 'api' && state.user !== null)
  ) {
    return;
  }

  const persisted: Partial<AppState> = {};
  for (const key of Object.keys(state) as (keyof AppState)[]) {
    if (transientKeys.has(key)) continue;
    (persisted as Record<string, unknown>)[key] = state[key];
  }

  const envelope: PersistedFixtureEnvelope = {
    version: PERSISTENCE_VERSION,
    state: persisted,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(encode(envelope)));
  } catch {
    // Fixture persistence is non-authoritative. Storage failure must not block the app.
  }
}

export function clearFixtureState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-authoritative local fixture storage.
  }
}
