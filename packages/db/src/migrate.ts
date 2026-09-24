import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabasePool } from './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(here, '..', 'migrations');
const pool = getDatabasePool();

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migration (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const files = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

for (const filename of files) {
  const seen = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migration WHERE filename = $1',
    [filename],
  );
  if (seen.rowCount) continue;

  const rawSql = await readFile(join(migrationsDirectory, filename), 'utf8');
  const sql = rawSql.replace(/^\s*BEGIN\s*;?/i, '').replace(/COMMIT\s*;?\s*$/i, '').trim();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migration (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    process.stdout.write(`Applied ${filename}\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

await pool.end();
process.stdout.write('AgentPlace database migrations complete.\n');
