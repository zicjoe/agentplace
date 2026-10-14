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


test('M8 bridge preparation uses the same canonical EVM network family as mandates', () => {
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  assert.match(worker, /network:\s*\{\s*family:\s*'eip155',\s*networkId:\s*sourceNetwork\s*\}/);
  assert.match(worker, /destinationNetwork:\s*\{\s*family:\s*'eip155',\s*networkId:\s*destinationNetwork\s*\}/);
  assert.doesNotMatch(worker, /network:\s*\{\s*family:\s*'evm',\s*networkId:\s*sourceNetwork\s*\}/);
});

test('M8 Manager honors an explicit watch-only wallet request instead of silently substituting a connected wallet', () => {
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  const review = readFileSync('apps/web/src/components/ActionReview.tsx', 'utf8');
  assert.match(worker, /requestedWalletMode/);
  assert.match(worker, /watch\(\?:\[-\\s\]\+\)only/);
  assert.match(worker, /mode=\$2/);
  assert.match(worker, /watch-only preview/);
  assert.doesNotMatch(worker, /mode='connected' AND namespace='eip155'/);
  assert.match(review, /Watch-only · preview only/);
  assert.match(review, /Watch-only accounts are preview-only and cannot sign or execute financial actions/);
});


test('M8 Manager treats explicit Agent Account requests as a separate fail-closed account mode', () => {
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  assert.match(worker, /'watch-only' \| 'connected' \| 'agent-account'/);
  assert.match(worker, /agent\(\?:\[-\\s\]\+\)account/);
  assert.match(worker, /wr\.mode='agent-account'/);
  assert.match(worker, /not deployed and has no onchain address or signer/);
  assert.match(worker, /will not substitute your Connected Wallet/);
  assert.match(worker, /Agent Account signing and transaction submission are not enabled in M8/);
});

test('M8 Manager can disambiguate multiple Agent Account setups by exact name', () => {
  const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
  const wallets = readFileSync('apps/web/src/components/WalletsView.tsx', 'utf8');
  const walletCore = readFileSync('packages/wallets/src/index.ts', 'utf8');
  assert.match(worker, /requestedAgentAccountSelector/);
  assert.match(worker, /using Agent Account named <name>/);
  assert.match(worker, /wr\.name AS wallet_name/);
  assert.match(wallets, /Account name/);
  assert.match(wallets, /Rename/);
  assert.match(wallets, /Remove Agent Account setup/);
  assert.match(wallets, /using Agent Account named \{wallet\.name\}/);
  assert.match(walletCore, /UPDATE agent_account SET name=\$3/);
});

