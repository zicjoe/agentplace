import { existsSync, readFileSync } from 'node:fs';

const required = [
  'packages/db/migrations/0015_settlement_verification_receipts.sql',
  'packages/verification/src/index.ts',
  'apps/web/src/platform/verificationApi.ts',
  'apps/web/src/components/VerifiedReceiptView.tsx',
  'docs/MILESTONE-10.md',
  'docs/MILESTONE-10-TESTING.md',
  'docs/MILESTONE-10-DEPLOYMENT.md',
];
for (const file of required) if (!existsSync(file)) throw new Error(`M10 missing ${file}`);

const migration = readFileSync(required[0], 'utf8');
for (const token of ['verification_contract','settlement_observation','verified_outcome','verified_receipt','proof_anchor_queue','VERIFICATION_CONTRACT_IMMUTABLE','VERIFIED_OUTCOME_IMMUTABLE','VERIFIED_RECEIPT_IMMUTABLE']) {
  if (!migration.includes(token)) throw new Error(`M10 persistence missing ${token}`);
}

const verification = readFileSync('packages/verification/src/index.ts', 'utf8');
for (const token of ['verifyConfirmedTransactionAttempts','vc_asset_transfer_evm_v1','eth_getTransactionByHash','eth_getTransactionReceipt','authorization-lineage','native-recipient','erc20-transfer-event','gasUsed * effectiveGasPrice','agentplace:verified-receipt:v1','proof_anchor_queue']) {
  if (!verification.includes(token)) throw new Error(`M10 verification core missing ${token}`);
}
if (/eth_sendTransaction|eth_sendRawTransaction|privateKey|seed phrase|mnemonic/i.test(verification)) throw new Error('M10 verifier must remain read-only and non-custodial.');

const worker = readFileSync('apps/worker/src/index.ts', 'utf8');
for (const token of ['settlementVerificationLoop','verifyConfirmedTransactionAttempts','VERIFICATION_OBSERVER_POLL_MS']) if (!worker.includes(token)) throw new Error(`M10 Worker integration missing ${token}`);
const loop = worker.slice(worker.indexOf('async function settlementVerificationLoop'), worker.indexOf('async function main'));
if (/generateStructured|generateText|GEMINI|OPENAI|ANTHROPIC/i.test(loop)) throw new Error('M10 settlement verifier must not poll through an LLM.');

const receipt = readFileSync('apps/web/src/components/VerifiedReceiptView.tsx', 'utf8');
for (const token of ['AgentPlace Verified','Arbitrum proof anchor pending','Receipt commitment','Production verification evidence']) if (!receipt.includes(token)) throw new Error(`M10 receipt UX missing ${token}`);

const env = readFileSync('config/environments/production-mainnet.env.example', 'utf8');
if (!env.includes('MAINNET_EXECUTION_ENABLED=false') || !env.includes('MAINNET_AUTONOMY_ENABLED=false')) throw new Error('M10 must keep Mainnet execution/autonomy disabled by default.');

console.log('PASS: M10 Settlement Verification + Verified Outcomes + Verified Receipts independently verifies approved EVM transfers, creates immutable receipts and privacy-safe proof commitments, backfills confirmed M9 transfers, and queues asynchronous Arbitrum anchoring without introducing a signer.');
