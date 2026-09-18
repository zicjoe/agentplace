export const environmentNames = [
    "development",
    "testnet",
    "staging-mainnet-readonly",
    "production-mainnet",
];
export class EnvironmentContractError extends Error {
    constructor(message) {
        super(message);
        this.name = "EnvironmentContractError";
    }
}
export function isEnvironmentName(value) {
    return environmentNames.includes(value);
}
function parseBoolean(value, fallback) {
    if (value === undefined || value === "")
        return fallback;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    throw new EnvironmentContractError(`Expected boolean value, received: ${value}`);
}
export function parseEnvironmentContract(input) {
    const rawEnvironment = input.AGENT_PLACE_ENV ?? "development";
    if (!isEnvironmentName(rawEnvironment)) {
        throw new EnvironmentContractError(`Unsupported AGENT_PLACE_ENV: ${rawEnvironment}`);
    }
    const testnetExecutionEnabled = parseBoolean(input.TESTNET_EXECUTION_ENABLED, true);
    const mainnetExecutionEnabled = parseBoolean(input.MAINNET_EXECUTION_ENABLED, false);
    const mainnetAutonomyEnabled = parseBoolean(input.MAINNET_AUTONOMY_ENABLED, false);
    if (mainnetAutonomyEnabled && !mainnetExecutionEnabled) {
        throw new EnvironmentContractError("MAINNET_AUTONOMY_ENABLED requires MAINNET_EXECUTION_ENABLED=true.");
    }
    if (rawEnvironment === "staging-mainnet-readonly" && mainnetExecutionEnabled) {
        throw new EnvironmentContractError("staging-mainnet-readonly must never enable mainnet execution.");
    }
    return {
        environment: rawEnvironment,
        testnetExecutionEnabled,
        mainnetExecutionEnabled,
        mainnetAutonomyEnabled,
    };
}
