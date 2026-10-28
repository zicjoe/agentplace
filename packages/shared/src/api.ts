import type { EnvironmentName } from "./environment.js";

export interface ApiHealthResponse {
  readonly service: string;
  readonly version: string;
  readonly milestone: number;
  readonly status: "ok" | "degraded";
  readonly environment: EnvironmentName;
  readonly timestamp: string;
}

export interface PublicRuntimeConfig {
  readonly apiVersion: "v1";
  readonly serviceVersion: string;
  readonly milestone: number;
  readonly deploymentEnvironment: EnvironmentName;
  readonly execution: {
    readonly testnetEnabled: boolean;
    readonly mainnetEnabled: boolean;
    readonly mainnetAutonomyEnabled: boolean;
  };
  readonly auth: {
    readonly configured: boolean;
    readonly google: boolean;
    readonly ethereumWallet: boolean;
  };
}

export interface ApiReadinessResponse {
  readonly service: string;
  readonly version: string;
  readonly milestone: number;
  readonly status: "ready" | "degraded" | "not_ready";
  readonly environment: EnvironmentName;
  readonly timestamp: string;
  readonly dependencies: {
    readonly database: "ok" | "unavailable";
    readonly authentication: "configured" | "not_configured";
    readonly workerRuntime: "ok" | "stale" | "unknown";
    readonly scheduler: "ok" | "stale" | "unknown";
  };
  readonly execution: {
    readonly testnetEnabled: boolean;
    readonly mainnetEnabled: boolean;
    readonly mainnetAutonomyEnabled: boolean;
  };
}
