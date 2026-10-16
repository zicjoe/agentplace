import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getDatabasePool, withTransaction, type SqlExecutor } from '@agent-place/db';
import { formatUnits, keccak256, toHex } from 'viem';

export type SettlementVerificationStatus = 'VERIFYING' | 'VERIFIED' | 'NOT_VERIFIED' | 'UNKNOWN' | 'PARTIAL';
export type VerifiedOutcomeStatus = 'VERIFIED' | 'NOT_VERIFIED' | 'PARTIAL';
export type ProofAnchorStatus = 'PENDING' | 'BATCHED' | 'ANCHORING' | 'ANCHORED' | 'FAILED';

export interface VerificationCheck {
  code: string;
  label: string;
  status: 'PASS' | 'FAIL';
  message: string;
}

export interface DurableSettlementObservation {
  id: string;
  transactionAttemptId: string;
  actionId: string;
  preparedRevision: number;
  verificationContractId: string;
  status: SettlementVerificationStatus;
  retryable: boolean;
  attemptCount: number;
  nextCheckAt?: string;
  chainId: number;
  transactionHash: string;
  blockNumber?: string;
  blockHash?: string;
  observedFrom?: string;
  observedTo?: string;
  observedValueAtomic?: string;
  receiptStatus?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  gasCostAtomic?: string;
  gasAsset?: string;
  evidenceHash?: string;
  reasonCode?: string;
  reasonSummary?: string;
  firstCheckedAt?: string;
  lastCheckedAt?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DurableVerifiedOutcome {
  id: string;
  transactionAttemptId: string;
  actionId: string;
  jobId?: string;
  verificationContractId: string;
  status: VerifiedOutcomeStatus;
  expectedOutcome: Record<string, unknown>;
  actualOutcome: Record<string, unknown>;
  checks: VerificationCheck[];
  evidenceHash: string;
  verifiedAt: string;
}

export interface ReceiptCostItem {
  category: 'capital' | 'network-gas' | 'external-service' | 'agentplace-service';
  label: string;
  amount: string;
  amountAtomic?: string;
  asset?: string;
  note?: string;
}

export interface ReceiptTransactionReference {
  label: string;
  hash: string;
  status: 'confirmed' | 'observed';
  blockNumber?: string;
}

export interface DurableVerifiedReceipt {
  id: string;
  verifiedOutcomeId: string;
  transactionAttemptId: string;
  actionId: string;
  jobId?: string;
  receiptVersion: 1;
  userGoal: string;
  workerId?: string;
  workerName: string;
  workerAttribution: 'explicit' | 'execution-path-default';
  environment: 'mainnet' | 'testnet';
  network: { family: string; networkId: string; chainId: number };
  authorizedAction: Record<string, unknown>;
  actualEconomicOutcome: string;
  costs: ReceiptCostItem[];
  transactionReferences: ReceiptTransactionReference[];
  verificationMethod: string;
  verificationEvidence: string[];
  verificationChecks: VerificationCheck[];
  receiptCommitment: string;
  receiptSalt: string;
  evidenceRoot: string;
  proofAnchorStatus: ProofAnchorStatus;
  proofAnchorNote: string;
  proofAnchorTransactionHash?: string;
  createdAt: string;
}

export interface ActionVerificationState {
  observation: DurableSettlementObservation | null;
  outcome: DurableVerifiedOutcome | null;
  receipt: DurableVerifiedReceipt | null;
}

const CONTRACT_ID = 'vc_asset_transfer_evm_v1';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TRANSFER_SELECTOR = '0xa9059cbb';
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH = /^0x[a-fA-F0-9]{64}$/;
const SUPPORTED_ERC20_TRANSFERS: Record<number, Record<string, { symbol: string; decimals: number }>> = {
  1: { '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 } },
  42161: { '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6 } },
  8453: { '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 } },
};

interface CandidateRow {
  observation_id: string;
  observation_attempt_count: number;
  previous_observation_status: SettlementVerificationStatus | null;
  owner_user_id: string;
  transaction_attempt_id: string;
  action_id: string;
  prepared_revision: number;
  action_digest: string;
  approval_id: string;
  account_id: string;
  environment: 'mainnet' | 'testnet';
  network_family: string;
  network_id: string;
  chain_id: string | number;
  from_address: string;
  transaction_request: unknown;
  transaction_hash: string;
  wallet_prompted_at: Date | null;
  submitted_at: Date | null;
  confirmed_at: Date | null;
  action_type: string;
  capability_id: string;
  title: string;
  rationale: string;
  asset: string;
  asset_address: string | null;
  amount_display: string;
  amount_atomic: string | null;
  destination: string | null;
  worker_id: string | null;
  job_id: string | null;
  action_network_family: string;
  action_network_id: string;
  prepared_digest: string;
  prepared_payload: unknown;
  prepared_expires_at: Date | null;
  approval_action_id: string;
  approval_revision: number;
  approval_digest: string;
  approval_decision: string;
  approval_expires_at: Date | null;
  approval_decided_at: Date;
  approval_invalidated_at: Date | null;
  worker_name: string | null;
}

interface RpcProvider {
  url: string;
  label: string;
}

interface RpcTransaction {
  hash?: string;
  from?: string;
  to?: string | null;
  input?: string;
  data?: string;
  value?: string;
  blockNumber?: string | null;
  blockHash?: string | null;
}

interface RpcLog {
  address?: string;
  topics?: string[];
  data?: string;
  transactionHash?: string;
  blockNumber?: string;
  logIndex?: string;
}

interface RpcReceipt {
  transactionHash?: string;
  status?: string;
  blockNumber?: string;
  blockHash?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  logs?: RpcLog[];
}

interface ChainEvidence {
  provider: string;
  chainId: number;
  transaction: RpcTransaction;
  receipt: RpcReceipt;
}

interface NormalizedEvidence {
  providers: string[];
  crossChecked: boolean;
  chainId: number;
  transactionHash: string;
  from: string;
  to: string;
  valueAtomic: string;
  input: string;
  blockNumber: string;
  blockHash: string;
  receiptStatus: string;
  gasUsed: string;
  effectiveGasPrice: string;
  gasCostAtomic: string;
  matchingLogs: Array<{ address: string; topics: string[]; data: string; logIndex?: string }>;
}

interface VerificationResult {
  status: 'VERIFIED' | 'NOT_VERIFIED';
  checks: VerificationCheck[];
  expectedOutcome: Record<string, unknown>;
  actualOutcome: Record<string, unknown>;
  normalizedEvidence: NormalizedEvidence;
  evidenceHash: string;
  actualEconomicOutcome: string;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function commitment(domain: string, salt: string, value: unknown): string {
  return keccak256(toHex(`${domain}|${salt}|${canonicalJson(value)}`));
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function bigintValue(value: unknown): bigint | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try { return BigInt(value); } catch { return null; }
}

function decimalString(value: unknown): string | null {
  const parsed = bigintValue(value);
  return parsed === null ? null : parsed.toString();
}

function nativeGasAsset(chainId: number): string {
  if (chainId === 56 || chainId === 97) return 'BNB';
  if (chainId === 137 || chainId === 80002) return 'POL';
  if (chainId === 43114 || chainId === 43113) return 'AVAX';
  return 'ETH';
}

function rpcProviders(chainId: number): RpcProvider[] {
  const named: Record<number, string> = {
    1: 'ETHEREUM_MAINNET_RPC_URL',
    56: 'BNB_MAINNET_RPC_URL',
    97: 'BNB_TESTNET_RPC_URL',
    8453: 'BASE_MAINNET_RPC_URL',
    42161: 'ARBITRUM_MAINNET_RPC_URL',
    84532: 'BASE_SEPOLIA_RPC_URL',
    421614: 'ARBITRUM_SEPOLIA_RPC_URL',
    11155111: 'ETHEREUM_SEPOLIA_RPC_URL',
  };
  const candidates: Array<{ value: string | undefined; label: string }> = [
    { value: process.env[`AGENTPLACE_EVM_RPC_${chainId}_SECONDARY`], label: 'verification-secondary-rpc' },
    { value: process.env[`AGENTPLACE_EVM_RPC_${chainId}`], label: 'verification-primary-rpc' },
    { value: named[chainId] ? process.env[named[chainId]!] : undefined, label: 'verification-network-rpc' },
  ];
  const seen = new Set<string>();
  const result: RpcProvider[] = [];
  for (const candidate of candidates) {
    const url = candidate.value?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({ url, label: candidate.label });
  }
  return result;
}

async function rpcCall<T>(provider: RpcProvider, method: string, params: unknown[]): Promise<T | null> {
  const response = await fetch(provider.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => null) as { result?: T | null; error?: { message?: string } } | null;
  if (!response.ok || body?.error) throw new Error(body?.error?.message ?? `RPC_HTTP_${response.status}`);
  return body?.result ?? null;
}

async function readFromProvider(provider: RpcProvider, expectedChainId: number, transactionHash: string): Promise<ChainEvidence> {
  const [chainHex, transaction, receipt] = await Promise.all([
    rpcCall<string>(provider, 'eth_chainId', []),
    rpcCall<RpcTransaction>(provider, 'eth_getTransactionByHash', [transactionHash]),
    rpcCall<RpcReceipt>(provider, 'eth_getTransactionReceipt', [transactionHash]),
  ]);
  const observedChainId = chainHex ? Number(BigInt(chainHex)) : 0;
  if (observedChainId !== expectedChainId) throw new Error(`RPC_CHAIN_MISMATCH:${observedChainId}`);
  if (!transaction || !receipt) throw new Error('RPC_TRANSACTION_OR_RECEIPT_MISSING');
  return { provider: provider.label, chainId: observedChainId, transaction, receipt };
}

function criticalEvidenceSignature(evidence: ChainEvidence): string {
  const tx = evidence.transaction;
  const receipt = evidence.receipt;
  return canonicalJson({
    chainId: evidence.chainId,
    hash: lower(tx.hash),
    from: lower(tx.from),
    to: lower(tx.to),
    input: lower(tx.input ?? tx.data ?? '0x'),
    value: decimalString(tx.value),
    transactionBlock: lower(tx.blockHash),
    receiptHash: lower(receipt.transactionHash),
    status: lower(receipt.status),
    receiptBlock: lower(receipt.blockHash),
    gasUsed: decimalString(receipt.gasUsed),
    effectiveGasPrice: decimalString(receipt.effectiveGasPrice),
  });
}

async function readIndependentEvidence(chainId: number, transactionHash: string): Promise<{ primary: ChainEvidence; providers: string[]; crossChecked: boolean }> {
  const providers = rpcProviders(chainId);
  if (providers.length === 0) throw new Error('VERIFICATION_RPC_REQUIRED');
  const successes: ChainEvidence[] = [];
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      successes.push(await readFromProvider(provider, chainId, transactionHash));
      if (successes.length === 2) break;
    } catch (error) {
      errors.push(`${provider.label}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const first = successes[0];
  if (!first) throw new Error(`VERIFICATION_RPC_UNAVAILABLE:${errors.join(';').slice(0, 400)}`);
  const second = successes[1];
  if (second && criticalEvidenceSignature(first) !== criticalEvidenceSignature(second)) {
    throw new Error('VERIFICATION_RPC_CONFLICT');
  }
  return { primary: first, providers: successes.map((item) => item.provider), crossChecked: Boolean(second) };
}

function check(code: string, label: string, ok: boolean, pass: string, fail: string): VerificationCheck {
  return { code, label, status: ok ? 'PASS' : 'FAIL', message: ok ? pass : fail };
}

function requestRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseErc20Transfer(input: string): { recipient: string; amount: bigint } | null {
  const normalized = input.toLowerCase();
  if (!normalized.startsWith(TRANSFER_SELECTOR) || normalized.length !== 138) return null;
  const recipientWord = normalized.slice(10, 74);
  const amountWord = normalized.slice(74, 138);
  const recipient = `0x${recipientWord.slice(24)}`;
  if (!ADDRESS.test(recipient)) return null;
  try { return { recipient, amount: BigInt(`0x${amountWord}`) }; } catch { return null; }
}

function topicAddress(topic: string | undefined): string | null {
  if (!topic || !/^0x[a-fA-F0-9]{64}$/.test(topic)) return null;
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function matchingTransferLogs(receipt: RpcReceipt, token: string, from: string, destination: string, amount: bigint): Array<{ address: string; topics: string[]; data: string; logIndex?: string }> {
  const matches: Array<{ address: string; topics: string[]; data: string; logIndex?: string }> = [];
  for (const log of receipt.logs ?? []) {
    const topics = log.topics ?? [];
    if (lower(log.address) !== token.toLowerCase() || lower(topics[0]) !== TRANSFER_TOPIC) continue;
    if (topicAddress(topics[1]) !== from.toLowerCase() || topicAddress(topics[2]) !== destination.toLowerCase()) continue;
    const eventAmount = bigintValue(log.data);
    if (eventAmount !== amount) continue;
    const value: { address: string; topics: string[]; data: string; logIndex?: string } = {
      address: lower(log.address), topics: topics.map(lower), data: lower(log.data),
    };
    if (log.logIndex) value.logIndex = log.logIndex;
    matches.push(value);
  }
  return matches;
}

function preparedPayloadMatches(candidate: CandidateRow): boolean {
  const payload = requestRecord(candidate.prepared_payload);
  if (!payload) return false;
  const network = requestRecord(payload.network);
  return payload.kind === 'transfer'
    && payload.capabilityId === candidate.capability_id
    && payload.accountId === candidate.account_id
    && payload.environment === candidate.environment
    && lower(network?.family) === lower(candidate.action_network_family)
    && lower(network?.networkId) === lower(candidate.action_network_id)
    && String(payload.asset ?? '').toUpperCase() === candidate.asset.toUpperCase()
    && lower(payload.assetAddress) === lower(candidate.asset_address)
    && String(payload.amountAtomic ?? '') === String(candidate.amount_atomic ?? '')
    && lower(payload.destination) === lower(candidate.destination);
}

function verificationResult(candidate: CandidateRow, read: { primary: ChainEvidence; providers: string[]; crossChecked: boolean }): VerificationResult {
  const evidence = read.primary;
  const transaction = evidence.transaction;
  const receipt = evidence.receipt;
  const request = requestRecord(candidate.transaction_request);
  const expectedAmount = candidate.amount_atomic && /^\d+$/.test(candidate.amount_atomic) ? BigInt(candidate.amount_atomic) : null;
  const destination = candidate.destination?.toLowerCase() ?? '';
  const from = candidate.from_address.toLowerCase();
  const transactionHash = candidate.transaction_hash.toLowerCase();
  const txInput = lower(transaction.input ?? transaction.data ?? '0x') || '0x';
  const txValue = bigintValue(transaction.value);
  const gasUsed = bigintValue(receipt.gasUsed);
  const effectiveGasPrice = bigintValue(receipt.effectiveGasPrice);
  const checks: VerificationCheck[] = [];

  const approvalWasActive = candidate.wallet_prompted_at !== null
    && candidate.approval_decision === 'APPROVED'
    && candidate.approval_action_id === candidate.action_id
    && candidate.approval_revision === candidate.prepared_revision
    && candidate.approval_digest === candidate.action_digest
    && candidate.prepared_digest === candidate.action_digest
    && candidate.approval_decided_at.getTime() <= candidate.wallet_prompted_at.getTime()
    && (!candidate.approval_expires_at || candidate.wallet_prompted_at <= candidate.approval_expires_at)
    && (!candidate.approval_invalidated_at || candidate.approval_invalidated_at > candidate.wallet_prompted_at)
    && (!candidate.prepared_expires_at || candidate.wallet_prompted_at <= candidate.prepared_expires_at);

  checks.push(check('authorization-lineage', 'Exact authorization lineage', approvalWasActive, 'Prepared revision, digest and exact approval correspond.', 'Prepared revision, digest or exact historical approval does not correspond.'));
  checks.push(check('prepared-payload', 'Prepared action correspondence', preparedPayloadMatches(candidate), 'Prepared transfer payload matches the durable Financial Action.', 'Prepared transfer payload does not match the durable Financial Action.'));
  checks.push(check('chain', 'Exact chain', evidence.chainId === Number(candidate.chain_id), `Observed on chain ${evidence.chainId}.`, 'Observed chain does not match the approved execution chain.'));
  checks.push(check('transaction-hash', 'Exact transaction hash', lower(transaction.hash) === transactionHash && lower(receipt.transactionHash) === transactionHash, 'Transaction and receipt match the recorded hash.', 'Transaction or receipt hash does not match the recorded hash.'));
  checks.push(check('sender', 'Exact sender', lower(transaction.from) === from, 'Onchain sender matches the approved Connected Wallet.', 'Onchain sender does not match the approved Connected Wallet.'));
  checks.push(check('receipt-success', 'Successful receipt', lower(receipt.status) === '0x1', 'Receipt status is successful.', 'Receipt status is not successful.'));
  checks.push(check('receipt-block', 'Canonical receipt block', Boolean(receipt.blockNumber && receipt.blockHash && transaction.blockHash && lower(receipt.blockHash) === lower(transaction.blockHash)), 'Transaction and receipt agree on block evidence.', 'Transaction and receipt block evidence is missing or inconsistent.'));
  checks.push(check('gas-evidence', 'Exact receipt gas', gasUsed !== null && effectiveGasPrice !== null, 'gasUsed and effectiveGasPrice are present for exact gas accounting.', 'Receipt is missing gasUsed or effectiveGasPrice.'));

  const requestFrom = lower(request?.from);
  const requestTo = lower(request?.to);
  const requestInput = lower(request?.data ?? '0x') || '0x';
  const requestValue = bigintValue(request?.value ?? '0x0');
  const requestChainId = bigintValue(request?.chainId);
  const requestMatches = requestFrom === from
    && requestTo === lower(transaction.to)
    && requestInput === txInput
    && requestValue === txValue
    && requestChainId === BigInt(candidate.chain_id);
  checks.push(check('submitted-request', 'Submitted request correspondence', requestMatches, 'Observed transaction matches the exact wallet request AgentPlace prepared.', 'Observed transaction differs from the exact wallet request AgentPlace prepared.'));

  let matchingLogs: Array<{ address: string; topics: string[]; data: string; logIndex?: string }> = [];
  if (candidate.asset_address) {
    const token = candidate.asset_address.toLowerCase();
    const supportedToken = SUPPORTED_ERC20_TRANSFERS[Number(candidate.chain_id)]?.[token];
    checks.push(check('supported-token-contract', 'Supported token contract', Boolean(supportedToken) && supportedToken?.symbol === candidate.asset.toUpperCase(), supportedToken ? `${supportedToken.symbol} contract is in the M10 production verification allowlist.` : 'Token contract is not in the M10 production verification allowlist.', 'Token contract is not supported by the M10 transfer Verification Contract.'));
    const decoded = parseErc20Transfer(txInput);
    checks.push(check('token-contract', 'Exact token contract', lower(transaction.to) === token && txValue === 0n, 'Transaction targets the approved token contract with zero native value.', 'Transaction token target or native value does not match the approved token transfer.'));
    checks.push(check('erc20-transfer-call', 'ERC-20 transfer semantics', Boolean(decoded) && decoded?.recipient.toLowerCase() === destination && decoded?.amount === expectedAmount, 'transfer(address,uint256) calldata matches the approved recipient and amount.', 'ERC-20 transfer calldata does not match the approved recipient and amount.'));
    if (expectedAmount !== null && decoded) matchingLogs = matchingTransferLogs(receipt, token, from, destination, expectedAmount);
    checks.push(check('erc20-transfer-event', 'ERC-20 Transfer event', matchingLogs.length > 0, 'Receipt contains the matching token Transfer event.', 'Receipt does not contain the expected token Transfer event.'));
  } else {
    checks.push(check('native-recipient', 'Exact recipient', lower(transaction.to) === destination, 'Native transfer recipient matches the approved destination.', 'Native transfer recipient does not match the approved destination.'));
    checks.push(check('native-value', 'Exact amount', expectedAmount !== null && txValue === expectedAmount, 'Native transfer value matches the exact approved atomic amount.', 'Native transfer value does not match the exact approved atomic amount.'));
    checks.push(check('native-calldata', 'Direct native transfer semantics', txInput === '0x', 'Native transfer has empty calldata.', 'Native transfer contains unexpected calldata.'));
  }

  const gasCost = gasUsed !== null && effectiveGasPrice !== null ? gasUsed * effectiveGasPrice : null;
  const normalized: NormalizedEvidence = {
    providers: read.providers,
    crossChecked: read.crossChecked,
    chainId: evidence.chainId,
    transactionHash,
    from: lower(transaction.from),
    to: lower(transaction.to),
    valueAtomic: txValue?.toString() ?? '',
    input: txInput,
    blockNumber: receipt.blockNumber ?? transaction.blockNumber ?? '',
    blockHash: lower(receipt.blockHash),
    receiptStatus: lower(receipt.status),
    gasUsed: gasUsed?.toString() ?? '',
    effectiveGasPrice: effectiveGasPrice?.toString() ?? '',
    gasCostAtomic: gasCost?.toString() ?? '',
    matchingLogs,
  };
  const expectedOutcome: Record<string, unknown> = {
    capabilityId: candidate.capability_id,
    chainId: Number(candidate.chain_id),
    sender: from,
    recipient: destination,
    asset: candidate.asset,
    assetAddress: candidate.asset_address,
    amountDisplay: candidate.amount_display,
    amountAtomic: candidate.amount_atomic,
  };
  const actualOutcome: Record<string, unknown> = {
    chainId: evidence.chainId,
    sender: normalized.from,
    recipient: candidate.asset_address ? (parseErc20Transfer(txInput)?.recipient ?? null) : normalized.to,
    asset: candidate.asset,
    assetAddress: candidate.asset_address,
    amountAtomic: candidate.asset_address ? (parseErc20Transfer(txInput)?.amount.toString() ?? null) : normalized.valueAtomic,
    receiptStatus: normalized.receiptStatus,
    matchingTransferEventCount: matchingLogs.length,
  };
  const status = checks.every((item) => item.status === 'PASS') ? 'VERIFIED' : 'NOT_VERIFIED';
  const evidenceHash = sha256({ normalized, checks });
  return {
    status,
    checks,
    expectedOutcome,
    actualOutcome,
    normalizedEvidence: normalized,
    evidenceHash,
    actualEconomicOutcome: `${candidate.amount_display} transferred to ${candidate.destination ?? 'the approved destination'} on ${candidate.action_network_id}.`,
  };
}

function mapObservation(row: Record<string, unknown>): DurableSettlementObservation {
  const value: DurableSettlementObservation = {
    id: String(row.id),
    transactionAttemptId: String(row.transaction_attempt_id),
    actionId: String(row.action_id),
    preparedRevision: Number(row.prepared_revision),
    verificationContractId: String(row.verification_contract_id),
    status: row.status as SettlementVerificationStatus,
    retryable: Boolean(row.retryable),
    attemptCount: Number(row.attempt_count),
    chainId: Number(row.chain_id),
    transactionHash: String(row.transaction_hash),
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
  if (row.next_check_at instanceof Date) value.nextCheckAt = row.next_check_at.toISOString();
  if (row.first_checked_at instanceof Date) value.firstCheckedAt = row.first_checked_at.toISOString();
  if (row.last_checked_at instanceof Date) value.lastCheckedAt = row.last_checked_at.toISOString();
  if (row.verified_at instanceof Date) value.verifiedAt = row.verified_at.toISOString();
  if (typeof row.block_number === 'string') value.blockNumber = row.block_number;
  if (typeof row.block_hash === 'string') value.blockHash = row.block_hash;
  if (typeof row.observed_from === 'string') value.observedFrom = row.observed_from;
  if (typeof row.observed_to === 'string') value.observedTo = row.observed_to;
  if (typeof row.observed_value_atomic === 'string') value.observedValueAtomic = row.observed_value_atomic;
  if (typeof row.receipt_status === 'string') value.receiptStatus = row.receipt_status;
  if (typeof row.gas_used === 'string') value.gasUsed = row.gas_used;
  if (typeof row.effective_gas_price === 'string') value.effectiveGasPrice = row.effective_gas_price;
  if (typeof row.gas_cost_atomic === 'string') value.gasCostAtomic = row.gas_cost_atomic;
  if (typeof row.gas_asset === 'string') value.gasAsset = row.gas_asset;
  if (typeof row.evidence_hash === 'string') value.evidenceHash = row.evidence_hash;
  if (typeof row.reason_code === 'string') value.reasonCode = row.reason_code;
  if (typeof row.reason_summary === 'string') value.reasonSummary = row.reason_summary;
  return value;
}

function mapOutcome(row: Record<string, unknown>): DurableVerifiedOutcome {
  const value: DurableVerifiedOutcome = {
    id: String(row.id),
    transactionAttemptId: String(row.transaction_attempt_id),
    actionId: String(row.action_id),
    verificationContractId: String(row.verification_contract_id),
    status: row.status as VerifiedOutcomeStatus,
    expectedOutcome: row.expected_outcome as Record<string, unknown>,
    actualOutcome: row.actual_outcome as Record<string, unknown>,
    checks: row.checks as VerificationCheck[],
    evidenceHash: String(row.evidence_hash),
    verifiedAt: (row.verified_at as Date).toISOString(),
  };
  if (typeof row.job_id === 'string') value.jobId = row.job_id;
  return value;
}

function mapReceipt(row: Record<string, unknown>): DurableVerifiedReceipt {
  const core = row.receipt_core as {
    authorizedAction: Record<string, unknown>;
    actualEconomicOutcome: string;
    costs: ReceiptCostItem[];
    transactionReferences: ReceiptTransactionReference[];
    verification: {
      method: string;
      evidence: string[];
      checks: VerificationCheck[];
    };
  };
  const value: DurableVerifiedReceipt = {
    id: String(row.id),
    verifiedOutcomeId: String(row.verified_outcome_id),
    transactionAttemptId: String(row.transaction_attempt_id),
    actionId: String(row.action_id),
    receiptVersion: 1,
    userGoal: String(row.user_goal),
    workerName: String(row.worker_name),
    workerAttribution: row.worker_attribution as 'explicit' | 'execution-path-default',
    environment: row.environment as 'mainnet' | 'testnet',
    network: { family: String(row.network_family), networkId: String(row.network_id), chainId: Number(row.chain_id) },
    authorizedAction: core.authorizedAction,
    actualEconomicOutcome: core.actualEconomicOutcome,
    costs: core.costs,
    transactionReferences: core.transactionReferences,
    verificationMethod: core.verification.method,
    verificationEvidence: core.verification.evidence,
    verificationChecks: core.verification.checks,
    receiptCommitment: String(row.receipt_commitment),
    receiptSalt: String(row.receipt_salt),
    evidenceRoot: String(row.evidence_root),
    proofAnchorStatus: (row.proof_status ?? 'PENDING') as ProofAnchorStatus,
    proofAnchorNote: (row.proof_status ?? 'PENDING') === 'ANCHORED'
      ? 'Receipt commitment anchored on Arbitrum.'
      : (row.proof_status ?? 'PENDING') === 'FAILED'
        ? 'Arbitrum proof anchoring is delayed. Verified completion remains valid and does not depend on anchoring.'
        : 'Arbitrum proof anchor pending. Verified completion does not wait for anchoring.',
    createdAt: (row.created_at as Date).toISOString(),
  };
  if (typeof row.job_id === 'string') value.jobId = row.job_id;
  if (typeof row.worker_id === 'string') value.workerId = row.worker_id;
  if (typeof row.anchor_transaction_hash === 'string') value.proofAnchorTransactionHash = row.anchor_transaction_hash;
  return value;
}

async function verificationEvent(db: SqlExecutor, candidate: CandidateRow, eventType: string, objectType: string, objectId: string, summary: string, status: string, metadata: Record<string, unknown>): Promise<void> {
  await db.query(
    `INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,worker_id,job_id,origin_type,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'agentplace',$11::jsonb)`,
    [`evt_${randomUUID()}`, candidate.owner_user_id, eventType, objectType, objectId, candidate.title, summary, status, candidate.worker_id ?? 'w-execution', candidate.job_id, JSON.stringify(metadata)],
  );
}

async function claimNextCandidate(): Promise<CandidateRow | null> {
  return withTransaction(async (db) => {
    const selected = await db.query<CandidateRow>(
      `SELECT
         COALESCE(so.id,'') AS observation_id,
         COALESCE(so.attempt_count,0) AS observation_attempt_count,
         so.status AS previous_observation_status,
         ta.owner_user_id::text,ta.id AS transaction_attempt_id,ta.action_id,ta.prepared_revision,ta.action_digest,ta.approval_id,ta.account_id,
         ta.environment,ta.network_family,ta.network_id,ta.chain_id,ta.from_address,ta.transaction_request,ta.transaction_hash,
         ta.wallet_prompted_at,ta.submitted_at,ta.confirmed_at,
         fa.action_type,fa.capability_id,fa.title,fa.rationale,fa.asset,fa.asset_address,fa.amount_display,fa.amount_atomic,fa.destination,fa.worker_id,fa.job_id,
         fa.network_family AS action_network_family,fa.network_id AS action_network_id,
         pr.action_digest AS prepared_digest,pr.prepared_payload,pr.expires_at AS prepared_expires_at,
         ap.action_id AS approval_action_id,ap.prepared_revision AS approval_revision,ap.action_digest AS approval_digest,ap.decision AS approval_decision,
         ap.expires_at AS approval_expires_at,ap.decided_at AS approval_decided_at,ap.invalidated_at AS approval_invalidated_at,
         wd.name AS worker_name
       FROM transaction_attempt ta
       JOIN financial_action fa ON fa.id=ta.action_id AND fa.owner_user_id=ta.owner_user_id
       JOIN prepared_action_revision pr ON pr.action_id=ta.action_id AND pr.revision=ta.prepared_revision AND pr.owner_user_id=ta.owner_user_id
       JOIN action_approval ap ON ap.id=ta.approval_id AND ap.owner_user_id=ta.owner_user_id
       LEFT JOIN worker_definition wd ON wd.id=fa.worker_id
       LEFT JOIN settlement_observation so ON so.owner_user_id=ta.owner_user_id AND so.transaction_attempt_id=ta.id AND so.verification_contract_id=$1
       WHERE ta.status='CONFIRMED' AND ta.transaction_hash IS NOT NULL
         AND fa.action_type='transfer' AND fa.capability_id='asset.transfer' AND fa.network_family IN ('eip155','evm')
         AND NOT EXISTS (
           SELECT 1 FROM verified_outcome vo
           WHERE vo.owner_user_id=ta.owner_user_id AND vo.transaction_attempt_id=ta.id AND vo.verification_contract_id=$1
         )
         AND (
           so.id IS NULL OR (
             so.status IN ('VERIFYING','UNKNOWN')
             AND (so.next_check_at IS NULL OR so.next_check_at<=now())
             AND (so.lease_until IS NULL OR so.lease_until<now())
           )
         )
       ORDER BY ta.confirmed_at ASC NULLS FIRST,ta.created_at ASC
       FOR UPDATE OF ta SKIP LOCKED
       LIMIT 1`,
      [CONTRACT_ID],
    );
    const row = selected.rows[0];
    if (!row) return null;
    const observationId = row.observation_id || `settle_${randomUUID()}`;
    const observation = await db.query<{ id: string; attempt_count: number }>(
      `INSERT INTO settlement_observation(
         id,owner_user_id,transaction_attempt_id,action_id,prepared_revision,verification_contract_id,status,retryable,attempt_count,lease_until,
         chain_id,transaction_hash,first_checked_at,last_checked_at
       ) VALUES($1,$2,$3,$4,$5,$6,'VERIFYING',true,1,now()+interval '90 seconds',$7,$8,now(),now())
       ON CONFLICT(owner_user_id,transaction_attempt_id,verification_contract_id) DO UPDATE SET
         status='VERIFYING',retryable=true,attempt_count=settlement_observation.attempt_count+1,next_check_at=NULL,lease_until=now()+interval '90 seconds',last_checked_at=now(),updated_at=now()
       RETURNING id,attempt_count`,
      [observationId, row.owner_user_id, row.transaction_attempt_id, row.action_id, row.prepared_revision, CONTRACT_ID, row.chain_id, row.transaction_hash],
    );
    row.observation_id = observation.rows[0]!.id;
    row.observation_attempt_count = observation.rows[0]!.attempt_count;
    return row;
  });
}

async function markUnknown(candidate: CandidateRow, reasonCode: string, reasonSummary: string): Promise<void> {
  const base = Math.max(5_000, Number.parseInt(process.env.VERIFICATION_RETRY_BASE_MS ?? '15000', 10) || 15_000);
  const max = Math.max(base, Number.parseInt(process.env.VERIFICATION_MAX_RETRY_MS ?? '300000', 10) || 300_000);
  const delay = Math.min(max, base * (2 ** Math.min(5, Math.max(0, candidate.observation_attempt_count - 1))));
  const next = new Date(Date.now() + delay);
  await withTransaction(async (db) => {
    await db.query(
      `UPDATE settlement_observation SET status='UNKNOWN',retryable=true,next_check_at=$2,lease_until=NULL,reason_code=$3,reason_summary=$4,last_checked_at=now(),updated_at=now()
       WHERE id=$1`,
      [candidate.observation_id, next, reasonCode, reasonSummary.slice(0, 1000)],
    );
    if (candidate.job_id) {
      await db.query(`UPDATE job SET status='VERIFYING',current_stage='Verification delayed · Outcome unknown',updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [candidate.owner_user_id, candidate.job_id]);
    }
    if (candidate.previous_observation_status !== 'UNKNOWN') {
      await verificationEvent(db, candidate, 'outcome.verification_unknown', 'settlement-observation', candidate.observation_id, 'Transaction confirmed, but independent outcome verification is temporarily unknown. AgentPlace is retrying without resubmitting anything.', 'working', { actionId: candidate.action_id, transactionAttemptId: candidate.transaction_attempt_id, reasonCode });
    }
  });
}

async function persistObservationEvidence(candidate: CandidateRow, result: VerificationResult): Promise<void> {
  const evidence = result.normalizedEvidence;
  await getDatabasePool().query(
    `UPDATE settlement_observation SET
       block_number=$2,block_hash=$3,observed_from=$4,observed_to=$5,observed_value_atomic=$6,observed_input=$7,receipt_status=$8,
       gas_used=$9,effective_gas_price=$10,gas_cost_atomic=$11,gas_asset=$12,relevant_logs=$13::jsonb,rpc_evidence=$14::jsonb,evidence_hash=$15,
       last_checked_at=now(),updated_at=now()
     WHERE id=$1`,
    [candidate.observation_id, evidence.blockNumber || null, evidence.blockHash || null, evidence.from || null, evidence.to || null, evidence.valueAtomic || null, evidence.input || null,
      evidence.receiptStatus || null, evidence.gasUsed || null, evidence.effectiveGasPrice || null, evidence.gasCostAtomic || null, nativeGasAsset(Number(candidate.chain_id)),
      JSON.stringify(evidence.matchingLogs), JSON.stringify({ providers: evidence.providers, crossChecked: evidence.crossChecked }), result.evidenceHash],
  );
}

async function finalizeNotVerified(candidate: CandidateRow, result: VerificationResult): Promise<void> {
  const outcomeId = `outcome_${randomUUID()}`;
  const failed = result.checks.filter((item) => item.status === 'FAIL').map((item) => item.code);
  await withTransaction(async (db) => {
    await db.query(
      `UPDATE settlement_observation SET status='NOT_VERIFIED',retryable=false,next_check_at=NULL,lease_until=NULL,reason_code='VERIFICATION_CONTRACT_FAILED',reason_summary=$2,verified_at=now(),last_checked_at=now(),updated_at=now() WHERE id=$1`,
      [candidate.observation_id, `Independent transfer verification failed: ${failed.join(', ')}`.slice(0, 1000)],
    );
    await db.query(
      `INSERT INTO verified_outcome(id,owner_user_id,transaction_attempt_id,action_id,job_id,verification_contract_id,status,expected_outcome,actual_outcome,checks,evidence_hash)
       VALUES($1,$2,$3,$4,$5,$6,'NOT_VERIFIED',$7::jsonb,$8::jsonb,$9::jsonb,$10)`,
      [outcomeId, candidate.owner_user_id, candidate.transaction_attempt_id, candidate.action_id, candidate.job_id, CONTRACT_ID, JSON.stringify(result.expectedOutcome), JSON.stringify(result.actualOutcome), JSON.stringify(result.checks), result.evidenceHash],
    );
    if (candidate.job_id) {
      await db.query(`UPDATE job SET status='FAILED_FINAL',current_stage='Outcome not verified',updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [candidate.owner_user_id, candidate.job_id]);
    }
    await verificationEvent(db, candidate, 'outcome.not_verified', 'verified-outcome', outcomeId, 'Transaction confirmed, but the requested transfer did not satisfy AgentPlace’s independent Verification Contract. No Verified Receipt was produced.', 'failed', { actionId: candidate.action_id, transactionAttemptId: candidate.transaction_attempt_id, failedChecks: failed });
  });
}

async function finalizeVerified(candidate: CandidateRow, result: VerificationResult): Promise<void> {
  const gasCostAtomic = result.normalizedEvidence.gasCostAtomic;
  if (!/^\d+$/.test(gasCostAtomic)) throw new Error('VERIFICATION_GAS_ACCOUNTING_UNAVAILABLE');
  const gasSymbol = nativeGasAsset(Number(candidate.chain_id));
  const gasDisplay = `${formatUnits(BigInt(gasCostAtomic), 18)} ${gasSymbol}`;
  const outcomeId = `outcome_${randomUUID()}`;
  const receiptId = `receipt_${randomUUID()}`;
  const proofQueueId = `proof_${randomUUID()}`;
  const receiptSalt = randomBytes(32).toString('hex');
  const workerId = candidate.worker_id ?? 'w-execution';
  const workerName = candidate.worker_name ?? 'Execution Operator';
  const workerAttribution = candidate.worker_id ? 'explicit' : 'execution-path-default';
  const costs: ReceiptCostItem[] = [
    { category: 'capital', label: 'Capital transferred', amount: candidate.amount_display, ...(candidate.amount_atomic ? { amountAtomic: candidate.amount_atomic } : {}), asset: candidate.asset, note: 'Transferred capital is not a fee.' },
    { category: 'network-gas', label: 'Network gas (receipt)', amount: gasDisplay, amountAtomic: gasCostAtomic, asset: gasSymbol, note: 'Exact EVM receipt calculation: gasUsed × effectiveGasPrice.' },
    { category: 'external-service', label: 'External service', amount: 'Not applicable', note: 'Direct transfer uses no paid external execution capability.' },
    { category: 'agentplace-service', label: 'AgentPlace service', amount: 'Not billed', note: 'No AgentPlace service charge is recorded for this action.' },
  ];
  const transactionReferences: ReceiptTransactionReference[] = [{
    label: `${candidate.action_network_id} transaction`,
    hash: candidate.transaction_hash,
    status: 'confirmed',
    ...(result.normalizedEvidence.blockNumber ? { blockNumber: result.normalizedEvidence.blockNumber } : {}),
  }];
  const authorizedAction: Record<string, unknown> = {
    capabilityId: candidate.capability_id,
    accountId: candidate.account_id,
    environment: candidate.environment,
    network: { family: candidate.action_network_family, networkId: candidate.action_network_id, chainId: Number(candidate.chain_id) },
    sender: candidate.from_address.toLowerCase(),
    recipient: candidate.destination,
    asset: candidate.asset,
    assetAddress: candidate.asset_address,
    amountDisplay: candidate.amount_display,
    amountAtomic: candidate.amount_atomic,
    preparedRevision: candidate.prepared_revision,
    actionDigest: candidate.action_digest,
    approvalId: candidate.approval_id,
  };
  const verificationEvidence = [
    'Exact historical approval and prepared revision correspond',
    'Onchain sender matches the approved Connected Wallet',
    'Recipient and exact amount match the approved transfer',
    candidate.asset_address ? 'ERC-20 transfer calldata and Transfer event match' : 'Direct native transfer value and empty calldata match',
    'Successful transaction receipt independently re-read from configured RPC evidence',
    result.normalizedEvidence.crossChecked ? 'Critical transaction evidence cross-checked across two configured RPC providers' : 'One configured verification RPC provider supplied canonical chain evidence',
  ];
  const receiptCore = {
    receiptVersion: 1,
    userGoal: candidate.rationale,
    worker: { id: workerId, name: workerName, attribution: workerAttribution },
    authorizedAction,
    actualEconomicOutcome: result.actualEconomicOutcome,
    actualOutcome: result.actualOutcome,
    costs,
    transactionReferences,
    verification: { contractId: CONTRACT_ID, method: 'EVM Transfer Verification Contract v1', evidence: verificationEvidence, checks: result.checks, evidenceHash: result.evidenceHash },
    proofPolicy: { target: 'Arbitrum', chainId: 42161, mode: 'BATCH', userCompletionWaitsForAnchor: false },
  };
  const receiptCommitment = commitment('agentplace:verified-receipt:v1', receiptSalt, receiptCore);
  const evidenceRoot = keccak256(toHex(canonicalJson({ evidenceHash: result.evidenceHash, checks: result.checks, normalizedEvidence: result.normalizedEvidence })));
  const subjectCommitment = commitment('agentplace:receipt-subject:v1', receiptSalt, { actionDigest: candidate.action_digest, transactionHash: candidate.transaction_hash });

  await withTransaction(async (db) => {
    await db.query(
      `UPDATE settlement_observation SET status='VERIFIED',retryable=false,next_check_at=NULL,lease_until=NULL,reason_code=NULL,reason_summary='Independent economic transfer verification passed.',verified_at=now(),last_checked_at=now(),updated_at=now() WHERE id=$1`,
      [candidate.observation_id],
    );
    await db.query(
      `INSERT INTO verified_outcome(id,owner_user_id,transaction_attempt_id,action_id,job_id,verification_contract_id,status,expected_outcome,actual_outcome,checks,evidence_hash)
       VALUES($1,$2,$3,$4,$5,$6,'VERIFIED',$7::jsonb,$8::jsonb,$9::jsonb,$10)`,
      [outcomeId, candidate.owner_user_id, candidate.transaction_attempt_id, candidate.action_id, candidate.job_id, CONTRACT_ID, JSON.stringify(result.expectedOutcome), JSON.stringify(result.actualOutcome), JSON.stringify(result.checks), result.evidenceHash],
    );
    await db.query(
      `INSERT INTO verified_receipt(id,owner_user_id,verified_outcome_id,transaction_attempt_id,action_id,job_id,receipt_version,user_goal,worker_id,worker_name,worker_attribution,environment,network_family,network_id,chain_id,receipt_core,receipt_salt,receipt_commitment,evidence_root)
       VALUES($1,$2,$3,$4,$5,$6,1,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18)`,
      [receiptId, candidate.owner_user_id, outcomeId, candidate.transaction_attempt_id, candidate.action_id, candidate.job_id, candidate.rationale, workerId, workerName, workerAttribution, candidate.environment, candidate.action_network_family, candidate.action_network_id, candidate.chain_id, JSON.stringify(receiptCore), receiptSalt, receiptCommitment, evidenceRoot],
    );
    await db.query(
      `INSERT INTO proof_anchor_queue(id,owner_user_id,receipt_id,receipt_commitment,subject_commitment,evidence_root,target_network_family,target_network_id,target_chain_id,anchor_mode,status)
       VALUES($1,$2,$3,$4,$5,$6,'eip155','arbitrum',42161,'BATCH','PENDING')`,
      [proofQueueId, candidate.owner_user_id, receiptId, receiptCommitment, subjectCommitment, evidenceRoot],
    );
    if (candidate.job_id) {
      await db.query(`UPDATE job SET status='COMPLETED',current_stage='Completed · AgentPlace Verified',updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [candidate.owner_user_id, candidate.job_id]);
    }
    await verificationEvent(db, candidate, 'outcome.verified', 'verified-outcome', outcomeId, `Completed · AgentPlace Verified. ${result.actualEconomicOutcome}`, 'complete', { actionId: candidate.action_id, transactionAttemptId: candidate.transaction_attempt_id, receiptId, evidenceHash: result.evidenceHash });
    await verificationEvent(db, candidate, 'receipt.anchor_queued', 'verified-receipt', receiptId, 'Verified Receipt created. Arbitrum proof anchor pending; anchoring is asynchronous and does not block completion.', 'working', { receiptId, receiptCommitment, proofQueueId, targetChainId: 42161 });
  });
}

async function verifyCandidate(candidate: CandidateRow): Promise<'verified' | 'not-verified' | 'unknown'> {
  if (!TX_HASH.test(candidate.transaction_hash) || !ADDRESS.test(candidate.from_address) || !candidate.destination || !ADDRESS.test(candidate.destination)) {
    await markUnknown(candidate, 'INVALID_DURABLE_EVIDENCE', 'Durable transaction/action evidence is incomplete or malformed; AgentPlace cannot safely verify the outcome.');
    return 'unknown';
  }
  try {
    const evidence = await readIndependentEvidence(Number(candidate.chain_id), candidate.transaction_hash);
    const result = verificationResult(candidate, evidence);
    await persistObservationEvidence(candidate, result);
    if (result.status === 'VERIFIED') {
      await finalizeVerified(candidate, result);
      return 'verified';
    }
    await finalizeNotVerified(candidate, result);
    return 'not-verified';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.startsWith('VERIFICATION_RPC_CONFLICT') ? 'RPC_EVIDENCE_CONFLICT'
      : message.startsWith('VERIFICATION_GAS_ACCOUNTING_UNAVAILABLE') ? 'GAS_ACCOUNTING_UNAVAILABLE'
        : 'RPC_EVIDENCE_UNAVAILABLE';
    await markUnknown(candidate, code, message);
    return 'unknown';
  }
}

export async function verifyConfirmedTransactionAttempts(limit = 25): Promise<{ checked: number; verified: number; notVerified: number; unknown: number }> {
  const bounded = Math.max(1, Math.min(100, limit));
  let checked = 0;
  let verified = 0;
  let notVerified = 0;
  let unknown = 0;
  for (let index = 0; index < bounded; index += 1) {
    const candidate = await claimNextCandidate();
    if (!candidate) break;
    checked += 1;
    const result = await verifyCandidate(candidate);
    if (result === 'verified') verified += 1;
    else if (result === 'not-verified') notVerified += 1;
    else unknown += 1;
  }
  return { checked, verified, notVerified, unknown };
}

async function readObservation(ownerUserId: string, where: string, value: string): Promise<DurableSettlementObservation | null> {
  const result = await getDatabasePool().query<Record<string, unknown>>(
    `SELECT * FROM settlement_observation WHERE owner_user_id=$1 AND ${where}=$2 ORDER BY updated_at DESC LIMIT 1`,
    [ownerUserId, value],
  );
  return result.rows[0] ? mapObservation(result.rows[0]) : null;
}

async function readOutcome(ownerUserId: string, where: string, value: string): Promise<DurableVerifiedOutcome | null> {
  const result = await getDatabasePool().query<Record<string, unknown>>(
    `SELECT * FROM verified_outcome WHERE owner_user_id=$1 AND ${where}=$2 ORDER BY verified_at DESC LIMIT 1`,
    [ownerUserId, value],
  );
  return result.rows[0] ? mapOutcome(result.rows[0]) : null;
}

const RECEIPT_SELECT = `SELECT vr.*,paq.status AS proof_status,paq.anchor_transaction_hash
  FROM verified_receipt vr
  LEFT JOIN proof_anchor_queue paq ON paq.owner_user_id=vr.owner_user_id AND paq.receipt_id=vr.id`;

async function readReceipt(ownerUserId: string, where: string, value: string): Promise<DurableVerifiedReceipt | null> {
  const result = await getDatabasePool().query<Record<string, unknown>>(
    `${RECEIPT_SELECT} WHERE vr.owner_user_id=$1 AND vr.${where}=$2 ORDER BY vr.created_at DESC LIMIT 1`,
    [ownerUserId, value],
  );
  return result.rows[0] ? mapReceipt(result.rows[0]) : null;
}

export async function getActionVerification(ownerUserId: string, actionId: string): Promise<ActionVerificationState> {
  const [observation, outcome, receipt] = await Promise.all([
    readObservation(ownerUserId, 'action_id', actionId),
    readOutcome(ownerUserId, 'action_id', actionId),
    readReceipt(ownerUserId, 'action_id', actionId),
  ]);
  return { observation, outcome, receipt };
}

export async function getTransactionVerification(ownerUserId: string, transactionAttemptId: string): Promise<ActionVerificationState> {
  const [observation, outcome, receipt] = await Promise.all([
    readObservation(ownerUserId, 'transaction_attempt_id', transactionAttemptId),
    readOutcome(ownerUserId, 'transaction_attempt_id', transactionAttemptId),
    readReceipt(ownerUserId, 'transaction_attempt_id', transactionAttemptId),
  ]);
  return { observation, outcome, receipt };
}

export async function getVerifiedReceipt(ownerUserId: string, receiptId: string): Promise<DurableVerifiedReceipt | null> {
  return readReceipt(ownerUserId, 'id', receiptId);
}

export async function listVerifiedOutcomes(ownerUserId: string, limit = 100): Promise<DurableVerifiedOutcome[]> {
  const result = await getDatabasePool().query<Record<string, unknown>>(
    `SELECT * FROM verified_outcome WHERE owner_user_id=$1 ORDER BY verified_at DESC LIMIT $2`,
    [ownerUserId, Math.max(1, Math.min(500, limit))],
  );
  return result.rows.map(mapOutcome);
}

export async function listVerifiedReceipts(ownerUserId: string, limit = 100): Promise<DurableVerifiedReceipt[]> {
  const result = await getDatabasePool().query<Record<string, unknown>>(
    `${RECEIPT_SELECT} WHERE vr.owner_user_id=$1 ORDER BY vr.created_at DESC LIMIT $2`,
    [ownerUserId, Math.max(1, Math.min(500, limit))],
  );
  return result.rows.map(mapReceipt);
}

export const moduleManifest = {
  name: 'verification',
  layer: 'trusted-core',
  milestone: 10,
  status: 'deterministic-settlement-verification-and-receipts',
  contract: CONTRACT_ID,
} as const;
