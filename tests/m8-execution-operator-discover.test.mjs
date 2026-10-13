import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = readFileSync('apps/web/src/fixtures/FixtureAppContext.tsx', 'utf8');
const workspace = readFileSync('apps/web/src/components/WorkerWorkspace.tsx', 'utf8');
const discover = readFileSync('apps/web/src/components/Discover.tsx', 'utf8');

test('Execution Operator is installable from Discover for M8 authority testing', () => {
  assert.match(fixture, /id: 'ds-exec-operator'/);
  assert.match(fixture, /name: 'Execution Operator'/);
  assert.match(fixture, /category: 'Transactions'/);
  assert.match(fixture, /Signing and transaction submission remain separate and are not enabled in M8/);
});

test('contextual Worker Add from Discover opens the matching Worker listing when available', () => {
  assert.match(workspace, /item\.id\.replace\('ds-', 'w-'\) === worker\.id/);
  assert.match(workspace, /SET_ACTIVE_DISCOVER_ITEM/);
  assert.match(workspace, /Add from Discover/);
});

test('Discover exposes a Transactions filter for Execution Operator', () => {
  assert.match(discover, /label: 'Transactions'/);
  assert.match(discover, /cat\.includes\('transaction'\)/);
});
