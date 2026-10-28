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

export type RuntimeHeartbeatClass = 'api' | 'worker' | 'scheduler';
export interface RuntimeHeartbeatInput {
  instanceId: string;
  serviceName: string;
  runtimeClass: RuntimeHeartbeatClass;
  version: string;
  milestone: number;
  status?: 'ok' | 'degraded';
  metadata?: Readonly<Record<string, unknown>>;
}

export async function recordRuntimeHeartbeat(input: RuntimeHeartbeatInput): Promise<void> {
  await getDatabasePool().query(
    `INSERT INTO runtime_heartbeat(instance_id,service_name,runtime_class,version,milestone,status,metadata,started_at,last_seen_at)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,now(),now())
     ON CONFLICT(instance_id) DO UPDATE SET service_name=excluded.service_name,runtime_class=excluded.runtime_class,version=excluded.version,milestone=excluded.milestone,status=excluded.status,metadata=excluded.metadata,last_seen_at=now()`,
    [input.instanceId,input.serviceName,input.runtimeClass,input.version,input.milestone,input.status??'ok',JSON.stringify(input.metadata??{})],
  );
}

export interface RuntimeClassReadiness {
  runtimeClass: RuntimeHeartbeatClass;
  status: 'ok' | 'stale' | 'unknown';
  lastSeenAt?: string;
  serviceName?: string;
  version?: string;
  milestone?: number;
}

export async function getRuntimeClassReadiness(runtimeClass: RuntimeHeartbeatClass, maxAgeSeconds = 120): Promise<RuntimeClassReadiness> {
  const result = await getDatabasePool().query<{service_name:string;version:string;milestone:number;last_seen_at:Date;fresh:boolean}>(
    `SELECT service_name,version,milestone,last_seen_at,last_seen_at > now()-($2::text||' seconds')::interval AS fresh
     FROM runtime_heartbeat WHERE runtime_class=$1 ORDER BY last_seen_at DESC LIMIT 1`,
    [runtimeClass,String(Math.max(10,Math.min(3600,maxAgeSeconds)))],
  );
  const row=result.rows[0];
  if(!row)return {runtimeClass,status:'unknown'};
  return {runtimeClass,status:row.fresh?'ok':'stale',lastSeenAt:row.last_seen_at.toISOString(),serviceName:row.service_name,version:row.version,milestone:row.milestone};
}
