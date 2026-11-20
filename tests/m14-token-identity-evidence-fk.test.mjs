import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const file = (name) => readFileSync(name, 'utf8');

test('Phase 2 read-only token identity has a canonical capability before FK-protected evidence is persisted', () => {
  const migration = file('packages/db/migrations/0025_token_identity_evidence_capability.sql');
  const evidenceSchema = file('packages/db/migrations/0007_core_intelligence_fabric.sql');
  const runtime = file('packages/intelligence/src/index.ts');
  assert.match(evidenceSchema, /capability_id text NOT NULL REFERENCES canonical_capability\(id\)/);
  assert.match(runtime, /capabilityId:'token\.identity\.resolve'/);
  assert.match(runtime, /await persistIntelligenceEvidence\(args\.ownerUserId,evidence\);/);
  assert.match(migration, /INSERT INTO canonical_capability\s*\(/);
  assert.match(migration, /'token\.identity\.resolve'/);
  assert.match(migration, /'read',\s*'none',\s*'none'/);
  assert.match(migration, /ON CONFLICT \(id\) DO NOTHING;/);
  assert.doesNotMatch(migration, /INSERT INTO capability_implementation|INSERT INTO authority_grant|ALTER TABLE/i);
});

test('the token identity registry repair is the next numbered migration and works with the existing migrator', () => {
  const migrations = readdirSync('packages/db/migrations').filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  assert.equal(migrations.at(-1), '0025_token_identity_evidence_capability.sql');
  const runner = file('packages/db/src/migrate.ts');
  assert.match(runner, /readdir\(migrationsDirectory\)/);
  assert.match(runner, /SELECT filename FROM schema_migration WHERE filename = \$1/);
  assert.match(runner, /client\.query\('BEGIN'\)/);
});
