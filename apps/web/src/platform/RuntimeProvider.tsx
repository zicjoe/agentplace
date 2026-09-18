import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getPublicRuntimeConfig } from './apiClient';
import {
  WEB_RUNTIME_SETTINGS,
  type RuntimeConnectionState,
  type WebRuntimeSettings,
} from './runtime';

interface RuntimeContextValue {
  settings: WebRuntimeSettings;
  connection: RuntimeConnectionState;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<RuntimeConnectionState>({
    status: 'checking',
    publicConfig: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    getPublicRuntimeConfig(controller.signal)
      .then((publicConfig) => {
        setConnection({ status: 'ready', publicConfig, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setConnection({
          status: 'unavailable',
          publicConfig: null,
          error: error instanceof Error ? error.message : 'AgentPlace API unavailable',
        });
      });
    return () => controller.abort();
  }, []);

  const value = useMemo<RuntimeContextValue>(
    () => ({ settings: WEB_RUNTIME_SETTINGS, connection }),
    [connection],
  );

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeContextValue {
  const value = useContext(RuntimeContext);
  if (!value) throw new Error('useRuntime must be used within RuntimeProvider');
  return value;
}
