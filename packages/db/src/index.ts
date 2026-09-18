export type EnvironmentName =
  | "development"
  | "testnet"
  | "staging-mainnet-readonly"
  | "production-mainnet";

export interface DatabaseRuntimeContract {
  readonly environment: EnvironmentName;
  readonly migrationDirectory: "migrations";
  readonly requireTlsInProduction: true;
}

export const databaseRuntimeContract: DatabaseRuntimeContract = {
  environment: "development",
  migrationDirectory: "migrations",
  requireTlsInProduction: true,
};
