import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('M8 production Manager bridge requests hand off to durable action preparation', () => {
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  assert.match(worker, /tryPrepareBridgeRequest/);
  assert.match(worker, /createFinancialAction/);
  assert.match(worker, /prepareFinancialAction/);
  assert.match(worker, /action-review:/);
  assert.doesNotMatch(worker, /Router v1 is read-only: if the user asks AgentPlace to move funds or execute a financial action/);
});

test('M8 conversation renders a durable Action Review handoff', () => {
  const chat = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');
  const types = readFileSync('apps/web/src/state/types.ts', 'utf8');
  assert.match(chat, /Open Action Review/);
  assert.match(chat, /SET_ACTIVE_ACTION/);
  assert.match(types, /action-review:\$\{string\}/);
});
