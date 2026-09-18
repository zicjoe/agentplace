export const environmentNames = [
  "development",
  "testnet",
  "staging-mainnet-readonly",
  "production-mainnet",
] as const;

export type EnvironmentName = (typeof environmentNames)[number];

export interface EnvironmentContract {
  readonly environment: EnvironmentName;
  readonly testnetExecutionEnabled: boolean;
  readonly mainnetExecutionEnabled: boolean;
  readonly mainnetAutonomyEnabled: boolean;
}

export class EnvironmentContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EnvironmentContractError";
  }
}

export function isEnvironmentName(value: string): value is EnvironmentName {
  return (environmentNames as readonly string[]).includes(value);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new EnvironmentContractError(`Expected boolean value, received: ${value}`);
}

export function parseEnvironmentContract(
  input: Readonly<Record<string, string | undefined>>,
): EnvironmentContract {
  const rawEnvironment = input.AGENT_PLACE_ENV ?? "development";
  if (!isEnvironmentName(rawEnvironment)) {
    throw new EnvironmentContractError(`Unsupported AGENT_PLACE_ENV: ${rawEnvironment}`);
  }

  const testnetExecutionEnabled = parseBoolean(input.TESTNET_EXECUTION_ENABLED, true);
  const mainnetExecutionEnabled = parseBoolean(input.MAINNET_EXECUTION_ENABLED, false);
  const mainnetAutonomyEnabled = parseBoolean(input.MAINNET_AUTONOMY_ENABLED, false);

  if (mainnetAutonomyEnabled && !mainnetExecutionEnabled) {
    throw new EnvironmentContractError(
      "MAINNET_AUTONOMY_ENABLED requires MAINNET_EXECUTION_ENABLED=true.",
    );
  }

  if (rawEnvironment === "staging-mainnet-readonly" && mainnetExecutionEnabled) {
    throw new EnvironmentContractError(
      "staging-mainnet-readonly must never enable mainnet execution.",
    );
  }

  return {
    environment: rawEnvironment,
    testnetExecutionEnabled,
    mainnetExecutionEnabled,
    mainnetAutonomyEnabled,
  };
}
