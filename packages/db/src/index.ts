import { Pool, type PoolClient, type QueryResult } from 'pg';

export type EnvironmentName =
  | 'development'
  | 'testnet'
  | 'staging-mainnet-readonly'
  | 'production-mainnet';

export interface DatabaseRuntimeContract {
  readonly environment: EnvironmentName;
  readonly migrationDirectory: 'migrations';
  readonly requireTlsInProduction: true;
}

export const databaseRuntimeContract: DatabaseRuntimeContract = {
  environment: 'development',
  migrationDirectory: 'migrations',
  requireTlsInProduction: true,
};

export interface SqlExecutor {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
}

let pool: Pool | null = null;

export function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error('DATABASE_URL is required for AgentPlace durable production data.');
  }
  return value;
}

function databaseSsl(): false | { rejectUnauthorized: boolean } {
  const raw = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (raw === 'true' || raw === 'require') return { rejectUnauthorized: false };
  return false;
}

export function getDatabasePool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: requireDatabaseUrl(),
    ssl: databaseSsl(),
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'agentplace',
  });
  pool.on('error', (error) => {
    process.stderr.write(
      `${JSON.stringify({ level: 'error', service: 'agentplace-db', message: 'PostgreSQL pool error', error: error.message })}\n`,
    );
  });
  return pool;
}

export async function withDatabaseClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDatabasePool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withDatabaseClient(async (client) => {
    await client.query('BEGIN');
    try {
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function checkDatabase(): Promise<boolean> {
  try {
    const result = await getDatabasePool().query<{ ok: number }>('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

export async function closeDatabasePool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}
