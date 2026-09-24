import { getMigrations } from 'better-auth/db/migration';
import { getDatabasePool } from '@agent-place/db';
import { getAuth } from './index.js';

await getDatabasePool().query('CREATE SCHEMA IF NOT EXISTS auth');
const auth = getAuth();
const { runMigrations } = await getMigrations(auth.options);
await runMigrations();
process.stdout.write('AgentPlace Better Auth schema migration complete.\n');
await getDatabasePool().end();
