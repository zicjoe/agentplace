import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApiReadiness, getPublicRuntimeConfig } from './apiClient';
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
    readiness: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([getPublicRuntimeConfig(controller.signal), getApiReadiness(controller.signal)])
      .then(([configResult, readinessResult]) => {
        if (controller.signal.aborted) return;
        if (configResult.status === 'rejected') {
          setConnection({
            status: 'unavailable',
            publicConfig: null,
            readiness: null,
            error: configResult.reason instanceof Error ? configResult.reason.message : 'AgentPlace API unavailable',
          });
          return;
        }
        const readiness = readinessResult.status === 'fulfilled' ? readinessResult.value : null;
        setConnection({
          status: readiness?.status === 'ready' ? 'ready' : 'degraded',
          publicConfig: configResult.value,
          readiness,
          error: readinessResult.status === 'rejected'
            ? (readinessResult.reason instanceof Error ? readinessResult.reason.message : 'AgentPlace readiness check unavailable')
            : null,
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
