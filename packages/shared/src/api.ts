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
}
