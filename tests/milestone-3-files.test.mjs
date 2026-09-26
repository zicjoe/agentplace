import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Milestone 3 schema preserves Worker, Job and Activity boundaries', () => {
  const sql = readFileSync('packages/db/migrations/0003_workers_jobs.sql','utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS worker_definition/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS user_worker/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS job \(/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS domain_event/);
  assert.match(sql, /No financial authority|No execution until authority exists/);
});

test('Milestone 3 API scopes durable work behind authenticated identity', () => {
  const server = readFileSync('apps/api/src/server.ts','utf8');
  assert.match(server, /listUserWorkers\(identity\.appUserId\)/);
  assert.match(server, /listJobs\(identity\.appUserId\)/);
  assert.match(server, /listActivity\(identity\.appUserId\)/);
});
