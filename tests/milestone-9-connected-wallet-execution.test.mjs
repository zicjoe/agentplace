import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('packages/db/migrations/0013_connected_wallet_execution.sql', 'utf8');
const execution = readFileSync('packages/execution/src/index.ts', 'utf8');
const api = readFileSync('apps/api/src/server.ts', 'utf8');
const web = readFileSync('apps/web/src/platform/executionApi.ts', 'utf8');
const review = readFileSync('apps/web/src/components/ActionReview.tsx', 'utf8');
const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
const chat = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');


test('M9 persists exact idempotent transaction attempts and explicit safety states', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS transaction_attempt/);
  assert.match(migration, /UNIQUE \(owner_user_id, execution_key\)/);
  assert.match(migration, /UNIQUE \(owner_user_id, action_id, prepared_revision\)/);
  for (const status of ['WALLET_PROMPTED','USER_REJECTED','PRE_SUBMISSION_FAILED','SUBMITTED','CONFIRMING','CONFIRMED','REVERTED','MISMATCH','UNKNOWN']) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
});


test('M9 trusted core revalidates exact approval, authority, environment and preflight before signing', () => {
  for (const token of [
    'startConnectedWalletExecution',
    'EXECUTION_EXACT_APPROVAL_REQUIRED',
    'evaluateAuthority',
    'EXECUTION_AUTHORITY_REVOKED',
    'MAINNET_EXECUTION_DISABLED',
    'EXECUTION_ENVIRONMENT_NETWORK_MISMATCH',
    'EXECUTION_CONNECTED_WALLET_REQUIRED',
    'eth_estimateGas',
    'EXECUTION_PREFLIGHT_FAILED',
  ]) assert.match(execution, new RegExp(token));
  assert.match(execution, /preparedRevision:prepared\.revision/);
  assert.match(execution, /actionDigest:prepared\.actionDigest/);
});


test('M9 keeps user signing in the browser wallet and raw secrets out of the backend execution core', () => {
  assert.doesNotMatch(execution, /eth_sendTransaction|eth_sendRawTransaction|privateKey|seed phrase/i);
  assert.match(web, /eth_sendTransaction/);
  assert.match(web, /eth_accounts/);
  assert.match(web, /eth_chainId/);
  assert.match(web, /browser wallet account does not match the exact Connected Wallet/);
  assert.match(web, /browser wallet is on the wrong network/);
});


test('M9 prevents duplicate execution and fails closed on uncertain wallet submission', () => {
  assert.match(execution, /EXECUTION_SIGNATURE_ALREADY_REQUESTED/);
  assert.match(execution, /EXECUTION_ALREADY_SUBMITTED_OR_UNCERTAIN/);
  assert.match(execution, /ON CONFLICT DO NOTHING RETURNING/);
  assert.match(execution, /EXECUTION_ATTEMPT_CONFLICT/);
  assert.match(execution, /ACTION_EXECUTION_LOCKED/);
  assert.match(execution, /status==='UNKNOWN'/);
  assert.match(execution, /will not request another signature automatically/i);
  assert.match(execution, /EXECUTION_UNKNOWN_AFTER_MS/);
  assert.match(review, /Do not resubmit/);
  assert.match(api, /will not resubmit it automatically/i);
});


test('M9 independently verifies the observed transaction payload before accepting confirmation', () => {
  assert.match(execution, /eth_getTransactionByHash/);
  assert.match(execution, /observedTransactionMatches/);
  assert.match(execution, /status='MISMATCH'/);
  assert.match(execution, /transaction\.mismatch/);
  assert.match(review, /does not match the exact approved action/);
});


test('M9 deterministic observation uses RPC receipt polling and no LLM loop', () => {
  assert.match(execution, /eth_getTransactionReceipt/);
  assert.match(execution, /rpcLookup/);
  assert.match(execution, /secondary-rpc/);
  assert.match(worker, /transactionObservationLoop/);
  assert.match(worker, /observePendingTransactionAttempts/);
  assert.match(worker, /Promise\.all\(\[loop\(\), transactionObservationLoop\(\)\]\)/);
  const observationStart = worker.indexOf('async function transactionObservationLoop');
  const observationEnd = worker.indexOf('async function loop', observationStart);
  const observation = worker.slice(observationStart, observationEnd > observationStart ? observationEnd : undefined);
  assert.doesNotMatch(observation, /generateStructured|generateText|GEMINI|OPENAI|ANTHROPIC/i);
});


test('M9 confirmation remains separate from verified economic completion', () => {
  assert.match(review, /Transaction confirmed · Verifying outcome/);
  assert.match(review, /Confirmation is not AgentPlace Verified completion/);
  assert.match(execution, /confirmation is not completion/i);
  assert.doesNotMatch(execution, /Completed · AgentPlace Verified/);
});


test('M9 exposes execution through authenticated API endpoints and production gates', () => {
  assert.ok(api.includes('execution\\/start'));
  assert.ok(api.includes('executions\\/([^/]+)\\/report'));
  assert.match(api, /mainnetExecutionEnabled:environment\.mainnetExecutionEnabled/);
  assert.match(api, /testnetExecutionEnabled:environment\.testnetExecutionEnabled/);
  assert.match(api, /EXECUTION_PROMPT_TOKEN_INVALID/);
});


test('M9 Manager supports deterministic direct transfer preparation without weakening wallet modes', () => {
  assert.match(worker, /tryPrepareTransferRequest/);
  assert.match(worker, /asset\.transfer\.execute|actionType:\s*'transfer'/);
  assert.match(worker, /requestedWalletMode/);
  assert.match(worker, /requestedWalletSelector/);
  assert.match(worker, /using wallet named <name>/);
  assert.match(worker, /watch-only preview/);
  assert.match(worker, /M9 execution is Connected Wallet only/);
  assert.match(worker, /will not substitute your Connected Wallet/);
});



test('M9 conversation card reflects durable execution truth instead of stale prepared-only copy', () => {
  assert.match(chat, /DurableActionReviewCard/);
  assert.match(chat, /Transaction submitted/);
  assert.match(chat, /Transaction confirmed/);
  assert.match(chat, /Verifying outcome/);
  assert.match(chat, /Do not resubmit/);
  assert.match(chat, /fetchActionExecution/);
});

test('M9 keeps the production Mainnet execution gate fail-closed by default', () => {
  const env = readFileSync('.env.example', 'utf8');
  const mainnet = readFileSync('config/environments/production-mainnet.env.example', 'utf8');
  assert.match(env, /MAINNET_EXECUTION_ENABLED=false/);
  assert.match(mainnet, /MAINNET_EXECUTION_ENABLED=false/);
  assert.match(mainnet, /MAINNET_AUTONOMY_ENABLED=false/);
});


test('M9 exposes the canonical direct-transfer capability through the mandate capability registry', () => {
  const transferMigration = readFileSync('packages/db/migrations/0014_transfer_capability_alignment.sql', 'utf8');
  const workerSeed = readFileSync('packages/db/migrations/0003_workers_jobs.sql', 'utf8');
  assert.match(transferMigration, /'asset\.transfer'/);
  assert.match(transferMigration, /'economic-write'/);
  assert.match(workerSeed, /\[\"asset\.transfer\",\"swap\.execute\",\"bridge\.execute\"\]/);
  assert.match(execution, /kind==='transfer'\?'asset\.transfer'/);
  assert.doesNotMatch(execution, /asset\.transfer\.execute/);
});


test('M9 resolves deterministic USD value-at-risk for direct transfers before authority evaluation', () => {
  assert.match(execution, /resolveDeterministicValueUsd/);
  assert.match(execution, /CHAINLINK_USD_FEEDS/);
  assert.match(execution, /0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612/i);
  assert.match(execution, /stablecoin-nominal-usd/);
  assert.match(execution, /eth_call/);
  assert.match(execution, /0xfeaf968c/);
  assert.match(execution, /UPDATE financial_action SET value_usd=/);
  assert.match(execution, /valueUsdSource/);
  assert.match(review, /Value at risk/);
});


test('M9 distinguishes RPC transport failure from transaction preflight rejection', () => {
  assert.match(execution, /estimateExecutionGas/);
  assert.match(execution, /EXECUTION_PREFLIGHT_FAILED:/);
  assert.match(execution, /EXECUTION_RPC_UNAVAILABLE:/);
  assert.match(execution, /insufficient funds/i);
  assert.match(api, /Pre-sign transaction inspection failed:/);
  assert.match(api, /could not reach a usable execution RPC/);
});
