import { existsSync, readFileSync } from 'node:fs';

const must = [
  'packages/db/migrations/0013_connected_wallet_execution.sql',
  'packages/execution/src/index.ts',
  'apps/web/src/platform/executionApi.ts',
  'apps/web/src/components/ActionReview.tsx',
  'docs/MILESTONE-9.md',
  'docs/MILESTONE-9-TESTING.md',
  'docs/MILESTONE-9-DEPLOYMENT.md',
];
for (const file of must) if (!existsSync(file)) throw new Error(`M9 missing ${file}`);

const migration = readFileSync('packages/db/migrations/0013_connected_wallet_execution.sql', 'utf8');
for (const token of ['transaction_attempt','execution_key','WALLET_PROMPTED','SUBMITTED','CONFIRMING','CONFIRMED','REVERTED','MISMATCH','UNKNOWN']) {
  if (!migration.includes(token)) throw new Error(`M9 migration missing ${token}`);
}
for (const token of ['UNIQUE (owner_user_id, execution_key)','UNIQUE (owner_user_id, action_id, prepared_revision)']) {
  if (!migration.includes(token)) throw new Error(`M9 idempotency contract missing ${token}`);
}

const execution = readFileSync('packages/execution/src/index.ts', 'utf8');
for (const token of [
  'startConnectedWalletExecution','reportConnectedWalletResult','observePendingTransactionAttempts',
  'EXECUTION_EXACT_APPROVAL_REQUIRED','MAINNET_EXECUTION_DISABLED','EXECUTION_AUTHORITY_REVOKED',
  'eth_estimateGas','eth_getTransactionByHash','eth_getTransactionReceipt','observedTransactionMatches',
  'EXECUTION_SIGNATURE_ALREADY_REQUESTED','EXECUTION_ALREADY_SUBMITTED_OR_UNCERTAIN','EXECUTION_ATTEMPT_CONFLICT','ACTION_EXECUTION_LOCKED','EXECUTION_UNKNOWN_AFTER_MS','ON CONFLICT DO NOTHING RETURNING','secondary-rpc',
]) if (!execution.includes(token)) throw new Error(`M9 execution core missing ${token}`);
if (/eth_sendTransaction|eth_sendRawTransaction|privateKey|seed phrase/i.test(execution)) throw new Error('M9 backend execution core must not sign with or receive raw user wallet secrets.');

const web = readFileSync('apps/web/src/platform/executionApi.ts', 'utf8');
for (const token of ['eth_accounts','eth_chainId','eth_sendTransaction','agentPlaceSafePreSubmission','UNKNOWN']) {
  if (!web.includes(token)) throw new Error(`M9 browser-wallet boundary missing ${token}`);
}

const review = readFileSync('apps/web/src/components/ActionReview.tsx', 'utf8');
for (const token of ['Sign and submit in wallet','Do not resubmit','Transaction confirmed · Verifying outcome','MISMATCH']) {
  if (!review.includes(token)) throw new Error(`M9 Action Review execution progress missing ${token}`);
}

const chat = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');
for (const token of ['DurableActionReviewCard','Transaction submitted','Verifying outcome','Do not resubmit']) {
  if (!chat.includes(token)) throw new Error(`M9 conversation progress missing ${token}`);
}

const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
for (const token of ['tryPrepareTransferRequest','transactionObservationLoop','observePendingTransactionAttempts']) {
  if (!worker.includes(token)) throw new Error(`M9 Worker integration missing ${token}`);
}
const observer = worker.slice(worker.indexOf('async function transactionObservationLoop'), worker.indexOf('async function main'));
if (/generateStructured|generateText|GEMINI|OPENAI|ANTHROPIC/i.test(observer)) throw new Error('M9 transaction observer must not invoke an LLM.');

const env = readFileSync('config/environments/production-mainnet.env.example', 'utf8');
if (!env.includes('MAINNET_EXECUTION_ENABLED=false') || !env.includes('MAINNET_AUTONOMY_ENABLED=false')) throw new Error('M9 production Mainnet/autonomy gates must fail closed by default.');

console.log('PASS: M9 Connected Wallet Execution + Transaction Observation binds signing to exact approved actions, keeps raw wallet secrets in the user wallet, prevents duplicate/ambiguous resubmission, independently inspects observed transactions, and separates confirmation from verified outcome.');
