import { WEB_RUNTIME_SETTINGS } from './runtime';

export type ApiTransactionAttemptStatus =
  | 'WALLET_PROMPTED'
  | 'USER_REJECTED'
  | 'PRE_SUBMISSION_FAILED'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'REVERTED'
  | 'MISMATCH'
  | 'UNKNOWN';

export interface ApiWalletTransactionRequest {
  from: string;
  to: string;
  chainId: string;
  data?: string;
  value?: string;
  gas?: string;
}

export interface ApiTransactionAttempt {
  id: string;
  actionId: string;
  preparedRevision: number;
  actionDigest: string;
  approvalId: string;
  executionKey: string;
  accountId: string;
  environment: 'mainnet' | 'testnet';
  network: { family: string; networkId: string };
  chainId: number;
  signerMode: 'connected-wallet';
  status: ApiTransactionAttemptStatus;
  fromAddress: string;
  transactionHash?: string;
  walletPromptedAt?: string;
  walletPromptExpiresAt?: string;
  submittedAt?: string;
  confirmedAt?: string;
  blockNumber?: string;
  receiptStatus?: string;
  observationProvider?: string;
  observationError?: string;
  createdAt: string;
  updatedAt: string;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function endpoint(path: string): string {
  return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(payload?.message || `AgentPlace execution request failed (${response.status})`);
  return payload as T;
}

function ethereumProvider(): Eip1193Provider {
  const provider = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) throw new Error('No EVM browser wallet was detected. Connect the exact wallet selected in Action Review.');
  return provider;
}

export async function startActionExecution(actionId: string): Promise<{ attempt: ApiTransactionAttempt; walletRequest: ApiWalletTransactionRequest; promptToken: string }> {
  const result = await request<{ execution: { attempt: ApiTransactionAttempt; walletRequest: ApiWalletTransactionRequest; promptToken: string } }>(
    `/api/v1/actions/${encodeURIComponent(actionId)}/execution/start`,
    { method: 'POST', body: '{}' },
  );
  return result.execution;
}

export async function fetchActionExecution(actionId: string): Promise<ApiTransactionAttempt | null> {
  return (await request<{ attempt: ApiTransactionAttempt | null }>(`/api/v1/actions/${encodeURIComponent(actionId)}/execution`)).attempt;
}

export async function fetchExecutionAttempt(attemptId: string): Promise<ApiTransactionAttempt> {
  return (await request<{ attempt: ApiTransactionAttempt }>(`/api/v1/executions/${encodeURIComponent(attemptId)}`)).attempt;
}

export async function reportExecutionAttempt(
  attemptId: string,
  input: { promptToken: string; outcome: 'SUBMITTED' | 'USER_REJECTED' | 'PRE_SUBMISSION_FAILED' | 'UNKNOWN'; transactionHash?: string; message?: string },
): Promise<ApiTransactionAttempt> {
  return (await request<{ attempt: ApiTransactionAttempt }>(`/api/v1/executions/${encodeURIComponent(attemptId)}/report`, {
    method: 'POST',
    body: JSON.stringify(input),
  })).attempt;
}

export async function submitConnectedWalletRequest(
  requestPayload: ApiWalletTransactionRequest,
): Promise<{ transactionHash: string }> {
  const provider = ethereumProvider();
  const accounts = await provider.request({ method: 'eth_accounts' });
  const current = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
  if (!current || current.toLowerCase() !== requestPayload.from.toLowerCase()) {
    const error = new Error('The browser wallet account does not match the exact Connected Wallet approved in AgentPlace. Switch accounts before trying again.');
    (error as Error & { agentPlaceSafePreSubmission?: boolean }).agentPlaceSafePreSubmission = true;
    throw error;
  }
  const chain = await provider.request({ method: 'eth_chainId' });
  if (typeof chain !== 'string' || chain.toLowerCase() !== requestPayload.chainId.toLowerCase()) {
    const error = new Error(`The browser wallet is on the wrong network. Switch it to chain ${Number.parseInt(requestPayload.chainId, 16)} before trying again.`);
    (error as Error & { agentPlaceSafePreSubmission?: boolean }).agentPlaceSafePreSubmission = true;
    throw error;
  }
  const tx: Record<string, string> = { from: requestPayload.from, to: requestPayload.to };
  if (requestPayload.data) tx.data = requestPayload.data;
  if (requestPayload.value) tx.value = requestPayload.value;
  if (requestPayload.gas) tx.gas = requestPayload.gas;
  const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('The wallet did not return a valid transaction hash. Submission status is uncertain.');
  return { transactionHash: hash };
}

export function walletErrorClassification(error: unknown): { outcome: 'USER_REJECTED' | 'PRE_SUBMISSION_FAILED' | 'UNKNOWN'; message: string } {
  const value = error as { code?: number | string; message?: string; agentPlaceSafePreSubmission?: boolean } | null;
  const message = typeof value?.message === 'string' && value.message.trim() ? value.message.trim().slice(0, 500) : 'The wallet could not complete the signing request.';
  if (value?.code === 4001 || value?.code === 'ACTION_REJECTED') return { outcome: 'USER_REJECTED', message: 'User rejected the wallet signature.' };
  if (value?.agentPlaceSafePreSubmission) return { outcome: 'PRE_SUBMISSION_FAILED', message };
  return { outcome: 'UNKNOWN', message: `${message} AgentPlace cannot prove whether submission occurred, so it will not automatically request another signature.` };
}
