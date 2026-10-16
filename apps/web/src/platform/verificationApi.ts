import { WEB_RUNTIME_SETTINGS } from './runtime';
import type { VerifiedOutcome, VerifiedReceipt } from '../state/types';

export type ApiSettlementStatus = 'VERIFYING' | 'VERIFIED' | 'NOT_VERIFIED' | 'UNKNOWN' | 'PARTIAL';
export type ApiOutcomeStatus = 'VERIFIED' | 'NOT_VERIFIED' | 'PARTIAL';
export type ApiProofStatus = 'PENDING' | 'BATCHED' | 'ANCHORING' | 'ANCHORED' | 'FAILED';

export interface ApiSettlementObservation {
  id: string;
  transactionAttemptId: string;
  actionId: string;
  preparedRevision: number;
  verificationContractId: string;
  status: ApiSettlementStatus;
  retryable: boolean;
  attemptCount: number;
  nextCheckAt?: string;
  chainId: number;
  transactionHash: string;
  blockNumber?: string;
  blockHash?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  gasCostAtomic?: string;
  gasAsset?: string;
  evidenceHash?: string;
  reasonCode?: string;
  reasonSummary?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiVerifiedOutcome {
  id: string;
  transactionAttemptId: string;
  actionId: string;
  jobId?: string;
  verificationContractId: string;
  status: ApiOutcomeStatus;
  expectedOutcome: Record<string, unknown>;
  actualOutcome: Record<string, unknown>;
  checks: Array<{ code: string; label: string; status: 'PASS' | 'FAIL'; message: string }>;
  evidenceHash: string;
  verifiedAt: string;
}

export interface ApiVerifiedReceipt {
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
  costs: Array<{ category: string; label: string; amount: string; amountAtomic?: string; asset?: string; note?: string }>;
  transactionReferences: Array<{ label: string; hash: string; status: 'confirmed' | 'observed'; blockNumber?: string }>;
  verificationMethod: string;
  verificationEvidence: string[];
  verificationChecks: Array<{ code: string; label: string; status: 'PASS' | 'FAIL'; message: string }>;
  receiptCommitment: string;
  receiptSalt: string;
  evidenceRoot: string;
  proofAnchorStatus: ApiProofStatus;
  proofAnchorNote: string;
  proofAnchorTransactionHash?: string;
  createdAt: string;
}

export interface ApiActionVerificationState {
  observation: ApiSettlementObservation | null;
  outcome: ApiVerifiedOutcome | null;
  receipt: ApiVerifiedReceipt | null;
}

function endpoint(path: string): string { return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`; }

async function request<T>(path: string): Promise<T> {
  const response = await fetch(endpoint(path), { credentials: 'include', headers: { accept: 'application/json' } });
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(payload?.message || `AgentPlace verification request failed (${response.status})`);
  return payload as T;
}

export function toVerifiedOutcome(value: ApiVerifiedOutcome): VerifiedOutcome {
  const status: VerifiedOutcome['status'] = value.status === 'VERIFIED' ? 'verified' : value.status === 'NOT_VERIFIED' ? 'failed' : 'pending';
  const actual = value.actualOutcome;
  const expected = value.expectedOutcome;
  const out: VerifiedOutcome = {
    id: value.id,
    actionId: value.actionId,
    executionId: value.transactionAttemptId,
    status,
    expectedOutcome: `${String(expected.amountDisplay ?? expected.amountAtomic ?? 'Expected transfer')} to ${String(expected.recipient ?? 'approved destination')}`,
    actualOutcome: `${String(actual.amountAtomic ?? 'Observed transfer')} atomic units to ${String(actual.recipient ?? 'observed destination')}`,
    verificationMethod: `Verification Contract ${value.verificationContractId}`,
    evidenceSummary: value.checks.map((item) => `${item.label}: ${item.status}`).join(' · '),
    verifiedAt: new Date(value.verifiedAt),
  };
  if (value.jobId) out.jobId = value.jobId;
  return out;
}

export function toVerifiedReceipt(value: ApiVerifiedReceipt): VerifiedReceipt {
  const out: VerifiedReceipt = {
    id: value.id,
    actionId: value.actionId,
    executionId: value.transactionAttemptId,
    verifiedOutcomeId: value.verifiedOutcomeId,
    userGoal: value.userGoal,
    workerName: value.workerName,
    authorizedActionSummary: [
      `From: ${String(value.authorizedAction.sender ?? '—')}`,
      `To: ${String(value.authorizedAction.recipient ?? '—')}`,
      `Asset: ${String(value.authorizedAction.asset ?? '—')}`,
      `Amount: ${String(value.authorizedAction.amountDisplay ?? value.authorizedAction.amountAtomic ?? '—')}`,
      `Network: ${value.network.networkId}`,
      `Approval: ${String(value.authorizedAction.approvalId ?? '—')}`,
    ].join(' | '),
    actualEconomicOutcome: value.actualEconomicOutcome,
    costs: value.costs.map((item) => ({ label: item.label, amount: item.amount, ...(item.note ? { note: item.note } : {}) })),
    transactionReferences: value.transactionReferences.map((item) => ({ label: item.label, hash: item.hash, status: item.status, ...(item.blockNumber ? { blockNumber: item.blockNumber } : {}) })),
    verificationMethod: value.verificationMethod,
    verificationEvidence: value.verificationEvidence.join(' · '),
    verificationChecks: value.verificationChecks,
    proofAnchorStatus: value.proofAnchorStatus === 'ANCHORED' ? 'anchored' : value.proofAnchorStatus === 'FAILED' ? 'failed' : 'pending',
    proofAnchorNote: value.proofAnchorNote,
    environment: value.environment,
    createdAt: new Date(value.createdAt),
    receiptCommitment: value.receiptCommitment,
    receiptSalt: value.receiptSalt,
    evidenceRoot: value.evidenceRoot,
    network: value.network,
    workerAttribution: value.workerAttribution,
  };
  if (value.jobId) out.jobId = value.jobId;
  if (value.workerId) out.workerId = value.workerId;
  if (value.proofAnchorTransactionHash) out.proofAnchorTransactionHash = value.proofAnchorTransactionHash;
  return out;
}

export async function fetchVerificationState(): Promise<{ outcomes: VerifiedOutcome[]; receipts: VerifiedReceipt[] }> {
  const data = await request<{ outcomes: ApiVerifiedOutcome[]; receipts: ApiVerifiedReceipt[] }>('/api/v1/verification');
  return { outcomes: data.outcomes.map(toVerifiedOutcome), receipts: data.receipts.map(toVerifiedReceipt) };
}

export async function fetchActionVerification(actionId: string): Promise<{ observation: ApiSettlementObservation | null; outcome: VerifiedOutcome | null; receipt: VerifiedReceipt | null }> {
  const data = await request<ApiActionVerificationState>(`/api/v1/actions/${encodeURIComponent(actionId)}/outcome`);
  return {
    observation: data.observation,
    outcome: data.outcome ? toVerifiedOutcome(data.outcome) : null,
    receipt: data.receipt ? toVerifiedReceipt(data.receipt) : null,
  };
}

export async function fetchReceipt(receiptId: string): Promise<VerifiedReceipt> {
  const data = await request<{ receipt: ApiVerifiedReceipt }>(`/api/v1/receipts/${encodeURIComponent(receiptId)}`);
  return toVerifiedReceipt(data.receipt);
}
