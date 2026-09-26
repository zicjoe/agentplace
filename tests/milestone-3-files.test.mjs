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

test('Milestone 3 rehydrates Workers, Jobs and Activity after interactive sign-in', () => {
  const checkpoint = readFileSync('apps/web/src/components/IdentityCheckpoint.tsx','utf8');
  assert.match(checkpoint, /fetchWorkState\(\)/);
  assert.match(checkpoint, /SET_WORKERS/);
  assert.match(checkpoint, /SET_JOBS/);
  assert.match(checkpoint, /SET_ACTIVITY_EVENTS/);
});

test('Milestone 3 exposes durable pause, resume and remove Worker controls', () => {
  const api = readFileSync('apps/web/src/platform/workApi.ts','utf8');
  const workspace = readFileSync('apps/web/src/components/WorkerWorkspace.tsx','utf8');
  assert.match(api, /updateDurableWorkerStatus/);
  assert.match(api, /method:'PATCH'/);
  assert.match(workspace, /Pause Worker/);
  assert.match(workspace, /Resume Worker/);
  assert.match(workspace, /Remove Worker/);
  assert.match(workspace, /Existing Job and conversation history will be kept/);
  assert.match(workspace, /SET_ACTIVITY_EVENTS/);
});

