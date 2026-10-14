import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  getAuthAvailability,
  getAuthNodeHandler,
  requireAgentPlaceIdentity,
  toAuthHeaders,
} from '@agent-place/auth';
import {
  addMessage,
  createConversation,
  getConversation,
  getConversationModelPreference,
  importConversations,
  listConversations,
  patchConversation,
  patchMessage,
  setConversationModelPreference,
  type ConversationDraft,
  type DurableConversationMessage,
} from '@agent-place/context';
import { checkDatabase } from '@agent-place/db';
import { listCanonicalCapabilities, listCapabilityImplementations } from '@agent-place/capabilities';
import { getModelCatalog } from '@agent-place/models';
import {
  createMandate,
  evaluateAuthority,
  getAuthorityControlState,
  getMandate,
  listAuthorityDecisions,
  listMandateRevisions,
  listMandates,
  reviseMandate,
  revokeAllMandates,
  setAutonomousExecutionPaused,
  setMandateStatus,
  translateMandateIntent,
  type ActionEnvelope,
  type AuthorityEnvironment,
  type MandatePolicyInput,
  type NetworkPolicyRef,
} from '@agent-place/authority';
import {
  createFinancialAction,
  decideActionApproval,
  getFinancialAction,
  listFinancialActions,
  prepareFinancialAction,
  createServiceCostReview,
  decideServiceCostReview,
  startConnectedWalletExecution,
  reportConnectedWalletResult,
  getLatestTransactionAttemptForAction,
  getTransactionAttempt,
  type CreateFinancialActionInput,
  type FinancialActionKind,
} from '@agent-place/execution';
import { getRouteDecisionForJob } from '@agent-place/router';
import { listJobIntelligenceEvidence } from '@agent-place/intelligence';
import { createJob, enqueueIntelligenceTask, getIntelligenceTask, getLatestIntelligenceTask, getJob, getJobEvidence, jobStatuses, listActivity, listJobs, setJobConversation, type JobDraft } from '@agent-place/jobs';
import { getUserWorker, installWorker, listUserWorkers, listWorkerCatalog, updateUserWorker, type UserWorkerStatus } from '@agent-place/workers';
import { createAgentAccount, createWatchWallet, connectWallet, getWallet, listAgentAccounts, listWallets, observeWalletNetwork, updateWallet, type WalletNamespace } from '@agent-place/wallets';
import {
  createRequestId,
  parseEnvironmentContract,
  type ApiHealthResponse,
  type PublicRuntimeConfig,
} from '@agent-place/shared';
import { service } from './index.js';

const environment = parseEnvironmentContract(process.env);
const host = process.env.API_HOST?.trim() || (process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1');
const port = Number.parseInt(process.env.API_PORT ?? process.env.PORT ?? '8787', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid API_PORT: ${process.env.API_PORT ?? ''}`);
}

const allowedOrigins = new Set(
  (process.env.WEB_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

function writeCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('vary', 'Origin');
  }
  res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,x-agent-place-trace-id');
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(`${JSON.stringify(body)}\n`);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let total = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 2 * 1024 * 1024) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}

function isMessage(value: unknown): value is DurableConversationMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string'
    && (v.role === 'user' || v.role === 'manager' || v.role === 'specialist')
    && typeof v.content === 'string'
    && typeof v.createdAt === 'string'
    && typeof v.updatedAt === 'string';
}

function isConversationDraft(value: unknown): value is ConversationDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string'
    && v.id.length <= 128
    && (v.scope === 'manager' || v.scope === 'worker' || v.scope === 'job')
    && typeof v.title === 'string'
    && v.title.length > 0
    && v.title.length <= 200
    && (v.titleSource === 'auto' || v.titleSource === 'user')
    && typeof v.pinned === 'boolean'
    && typeof v.archived === 'boolean'
    && typeof v.createdAt === 'string'
    && (v.scope !== 'worker' || (typeof v.workerId === 'string' && v.workerId.length > 0 && v.workerId.length <= 128))
    && (v.scope !== 'job' || (typeof v.jobId === 'string' && v.jobId.length > 0 && v.jobId.length <= 128))
    && Array.isArray(v.messages)
    && v.messages.length <= 500
    && v.messages.every(isMessage);
}



const workerStatuses = new Set<UserWorkerStatus>(['working','monitoring','standby','needs-you','paused','limited','blocked','issue','removed']);
const jobStatusSet = new Set<string>(jobStatuses);

function asOptionalString(value: unknown, max = 500): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > max) throw new Error('INVALID_STRING');
  return value;
}

function requiredString(value: unknown, code: string, max = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(code);
  return value;
}

function stringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.length > 128 || !value.every((item) => typeof item === 'string')) throw new Error(code);
  return value as string[];
}

function parseNetworks(value: unknown): NetworkPolicyRef[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) throw new Error('INVALID_MANDATE_NETWORKS');
  return value.map((item) => {
    const row = asRecord(item);
    return { family: requiredString(row.family, 'INVALID_MANDATE_NETWORKS', 128), networkId: requiredString(row.networkId, 'INVALID_MANDATE_NETWORKS', 128) };
  });
}

function parseMandatePolicy(value: unknown): MandatePolicyInput {
  const row = asRecord(value);
  const approval = asRecord(row.approvalPolicy);
  if (row.authorityLevel !== 'OBSERVE' && row.authorityLevel !== 'PREPARE' && row.authorityLevel !== 'ACT_WITHIN_MANDATE') throw new Error('INVALID_AUTHORITY_LEVEL');
  if (row.assetScope !== 'ANY' && row.assetScope !== 'ALLOW_LIST') throw new Error('INVALID_MANDATE_SCOPE');
  if (row.protocolScope !== 'ANY' && row.protocolScope !== 'ALLOW_LIST') throw new Error('INVALID_MANDATE_SCOPE');
  if (row.destinationScope !== 'ANY' && row.destinationScope !== 'ALLOW_LIST') throw new Error('INVALID_MANDATE_SCOPE');
  if (approval.mode !== 'ALWAYS' && approval.mode !== 'THRESHOLD' && approval.mode !== 'WITHIN_LIMITS') throw new Error('INVALID_APPROVAL_POLICY');
  if (typeof approval.askForNewProtocols !== 'boolean' || typeof approval.askForNewDestinations !== 'boolean') throw new Error('INVALID_APPROVAL_POLICY');
  if (typeof row.borrowingAllowed !== 'boolean' || typeof row.leverageAllowed !== 'boolean') throw new Error('INVALID_MANDATE_POLICY');
  const policy: MandatePolicyInput = {
    title: requiredString(row.title, 'INVALID_MANDATE_TITLE', 160),
    purpose: requiredString(row.purpose, 'INVALID_MANDATE_PURPOSE', 2000),
    authorityLevel: row.authorityLevel,
    allowedCapabilities: stringArray(row.allowedCapabilities, 'INVALID_MANDATE_CAPABILITIES'),
    allowedNetworks: parseNetworks(row.allowedNetworks),
    assetScope: row.assetScope,
    allowedAssets: stringArray(row.allowedAssets, 'INVALID_MANDATE_ASSETS'),
    protocolScope: row.protocolScope,
    allowedProtocols: stringArray(row.allowedProtocols, 'INVALID_MANDATE_PROTOCOLS'),
    destinationScope: row.destinationScope,
    allowedDestinations: stringArray(row.allowedDestinations, 'INVALID_MANDATE_DESTINATIONS'),
    approvalPolicy: {
      mode: approval.mode,
      askForNewProtocols: approval.askForNewProtocols,
      askForNewDestinations: approval.askForNewDestinations,
    },
    borrowingAllowed: row.borrowingAllowed,
    leverageAllowed: row.leverageAllowed,
    changeSummary: requiredString(row.changeSummary, 'INVALID_MANDATE_CHANGE_SUMMARY', 500),
  };
  const optionalPolicyString = (key: 'capitalLimitUsd' | 'perActionLimitUsd' | 'validFrom' | 'validUntil'): string | undefined => {
    const raw = row[key];
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'string') throw new Error('INVALID_MANDATE_POLICY');
    return raw;
  };
  const capitalLimitUsd = optionalPolicyString('capitalLimitUsd'); if (capitalLimitUsd !== undefined) policy.capitalLimitUsd = capitalLimitUsd;
  const perActionLimitUsd = optionalPolicyString('perActionLimitUsd'); if (perActionLimitUsd !== undefined) policy.perActionLimitUsd = perActionLimitUsd;
  const validFrom = optionalPolicyString('validFrom'); if (validFrom !== undefined) policy.validFrom = validFrom;
  const validUntil = optionalPolicyString('validUntil'); if (validUntil !== undefined) policy.validUntil = validUntil;
  if (approval.thresholdUsd !== undefined && approval.thresholdUsd !== null) {
    if (typeof approval.thresholdUsd !== 'string') throw new Error('INVALID_APPROVAL_POLICY');
    policy.approvalPolicy.thresholdUsd = approval.thresholdUsd;
  }
  if (row.periodBudget !== undefined && row.periodBudget !== null) {
    const budget = asRecord(row.periodBudget);
    if (typeof budget.limitUsd !== 'string' || (budget.period !== 'day' && budget.period !== 'week' && budget.period !== 'month')) throw new Error('INVALID_PERIOD_BUDGET');
    policy.periodBudget = { limitUsd: budget.limitUsd, period: budget.period };
  }
  if (row.serviceBudget !== undefined && row.serviceBudget !== null) {
    const budget = asRecord(row.serviceBudget);
    if (typeof budget.limitUsd !== 'string' || (budget.period !== 'day' && budget.period !== 'week' && budget.period !== 'month')) throw new Error('INVALID_SERVICE_BUDGET');
    policy.serviceBudget = { limitUsd: budget.limitUsd, period: budget.period };
  }
  return policy;
}

function parseEnvironment(value: unknown): AuthorityEnvironment {
  if (value !== 'mainnet' && value !== 'testnet') throw new Error('INVALID_MANDATE_ENVIRONMENT');
  return value;
}

function parseActionEnvelope(value: unknown): ActionEnvelope {
  const row = asRecord(value);
  const network = asRecord(row.network);
  if (row.operation !== 'OBSERVE' && row.operation !== 'PREPARE' && row.operation !== 'EXECUTE') throw new Error('INVALID_AUTHORITY_ENVELOPE');
  const envelope: ActionEnvelope = {
    workerId: requiredString(row.workerId, 'INVALID_AUTHORITY_ENVELOPE', 128),
    accountId: requiredString(row.accountId, 'INVALID_AUTHORITY_ENVELOPE', 160),
    capabilityId: requiredString(row.capabilityId, 'INVALID_AUTHORITY_ENVELOPE', 128),
    operation: row.operation,
    environment: parseEnvironment(row.environment),
    network: { family: requiredString(network.family, 'INVALID_AUTHORITY_ENVELOPE', 128), networkId: requiredString(network.networkId, 'INVALID_AUTHORITY_ENVELOPE', 128) },
  };
  const optionalEnvelopeString = (key: 'asset' | 'protocol' | 'destination' | 'valueUsd' | 'leverageMultiplier' | 'reason' | 'jobId'): string | undefined => {
    const raw = row[key];
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'string') throw new Error('INVALID_AUTHORITY_ENVELOPE');
    return raw;
  };
  const asset = optionalEnvelopeString('asset'); if (asset !== undefined) envelope.asset = asset;
  const protocol = optionalEnvelopeString('protocol'); if (protocol !== undefined) envelope.protocol = protocol;
  const destination = optionalEnvelopeString('destination'); if (destination !== undefined) envelope.destination = destination;
  const valueUsd = optionalEnvelopeString('valueUsd'); if (valueUsd !== undefined) envelope.valueUsd = valueUsd;
  const leverageMultiplier = optionalEnvelopeString('leverageMultiplier'); if (leverageMultiplier !== undefined) envelope.leverageMultiplier = leverageMultiplier;
  const reason = optionalEnvelopeString('reason'); if (reason !== undefined) envelope.reason = reason;
  const jobId = optionalEnvelopeString('jobId'); if (jobId !== undefined) envelope.jobId = jobId;
  if (row.borrowing !== undefined) {
    if (typeof row.borrowing !== 'boolean') throw new Error('INVALID_AUTHORITY_ENVELOPE');
    envelope.borrowing = row.borrowing;
  }
  return envelope;
}

function parseFinancialActionInput(value: unknown): CreateFinancialActionInput {
  const body=asRecord(value);
  const actionType=body.actionType;
  if(actionType!=='transfer'&&actionType!=='swap'&&actionType!=='bridge') throw new Error('INVALID_FINANCIAL_ACTION_TYPE');
  const env=parseEnvironment(body.environment);
  const parseNet=(raw:unknown)=>{const n=asRecord(raw);return {family:requiredString(n.family,'INVALID_ACTION_NETWORK',64),networkId:requiredString(n.networkId,'INVALID_ACTION_NETWORK',128)};};
  const out:CreateFinancialActionInput={
    accountId:requiredString(body.accountId,'INVALID_ACTION_ACCOUNT',160), environment:env, actionType:actionType as FinancialActionKind,
    title:requiredString(body.title,'INVALID_ACTION_TITLE',200), rationale:requiredString(body.rationale,'INVALID_ACTION_RATIONALE',2000),
    network:parseNet(body.network), asset:requiredString(body.asset,'INVALID_ACTION_ASSET',128), amountDisplay:requiredString(body.amountDisplay,'INVALID_ACTION_AMOUNT',128),
  };
  if(body.workerId!==undefined) out.workerId=requiredString(body.workerId,'INVALID_ACTION_WORKER',128);
  if(body.jobId!==undefined) out.jobId=requiredString(body.jobId,'INVALID_ACTION_JOB',128);
  if(body.destinationNetwork!==undefined) out.destinationNetwork=parseNet(body.destinationNetwork);
  if(body.assetAddress!==undefined) out.assetAddress=requiredString(body.assetAddress,'INVALID_ACTION_ASSET_ADDRESS',160);
  if(body.outputAsset!==undefined) out.outputAsset=requiredString(body.outputAsset,'INVALID_ACTION_OUTPUT_ASSET',128);
  if(body.outputAssetAddress!==undefined) out.outputAssetAddress=requiredString(body.outputAssetAddress,'INVALID_ACTION_OUTPUT_ASSET_ADDRESS',160);
  if(body.amountAtomic!==undefined) out.amountAtomic=requiredString(body.amountAtomic,'INVALID_ACTION_ATOMIC_AMOUNT',100);
  if(body.valueUsd!==undefined) out.valueUsd=requiredString(body.valueUsd,'INVALID_ACTION_VALUE',64);
  if(body.protocol!==undefined) out.protocol=requiredString(body.protocol,'INVALID_ACTION_PROTOCOL',128);
  if(body.destination!==undefined) out.destination=requiredString(body.destination,'INVALID_ACTION_DESTINATION',256);
  if(body.slippageBps!==undefined){ if(typeof body.slippageBps!=='number'||!Number.isInteger(body.slippageBps)) throw new Error('INVALID_ACTION_SLIPPAGE'); out.slippageBps=body.slippageBps; }
  return out;
}

function isJobDraft(value: unknown): value is JobDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !v.id || v.id.length > 128) return false;
  if (typeof v.title !== 'string' || !v.title.trim() || v.title.length > 200) return false;
  if (typeof v.goal !== 'string' || !v.goal.trim() || v.goal.length > 4000) return false;
  if (typeof v.status !== 'string' || !jobStatusSet.has(v.status)) return false;
  if (v.environment !== 'mainnet' && v.environment !== 'testnet') return false;
  if (v.kind !== 'research' && v.kind !== 'operational' && v.kind !== 'financial') return false;
  if (v.originType !== 'user' && v.originType !== 'worker' && v.originType !== 'routine' && v.originType !== 'agentplace') return false;
  if (typeof v.leadWorkerId !== 'string' || !v.leadWorkerId || v.leadWorkerId.length > 128) return false;
  if (!Array.isArray(v.supportingWorkerIds) || v.supportingWorkerIds.length > 16 || !v.supportingWorkerIds.every((x) => typeof x === 'string' && x.length > 0 && x.length <= 128)) return false;
  if (typeof v.currentStage !== 'string' || !v.currentStage || v.currentStage.length > 200) return false;
  if (!Array.isArray(v.stages) || v.stages.length > 64) return false;
  if (!v.stages.every((stage) => {
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) return false;
    const row = stage as Record<string, unknown>;
    return typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 128
      && typeof row.label === 'string' && row.label.length > 0 && row.label.length <= 200
      && Number.isInteger(row.ordinal) && Number(row.ordinal) >= 0
      && (row.status === 'done' || row.status === 'active' || row.status === 'pending');
  })) return false;
  for (const key of ['originWorkerId','originConversationId','jobConversationId','createdAt','updatedAt']) {
    if (v[key] !== undefined && v[key] !== null && typeof v[key] !== 'string') return false;
  }
  return true;
}


function scopedId(prefix: string, ownerUserId: string, objectId: string): string {
  const digest = createHash('sha256').update(`${ownerUserId}:${objectId}`).digest('hex').slice(0, 24);
  return `${prefix}_${digest}`;
}

async function requireIdentity(req: IncomingMessage) {
  return requireAgentPlaceIdentity(toAuthHeaders(req.headers));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL, requestId: string): Promise<void> {
  if (req.method === 'GET' && url.pathname === '/health') {
    const auth = getAuthAvailability();
    const dbOk = !process.env.DATABASE_URL?.trim() ? false : await checkDatabase();
    const body: ApiHealthResponse = {
      service: service.name,
      version: service.version,
      milestone: service.milestone,
      status: auth.configured && !dbOk ? 'degraded' : 'ok',
      environment: environment.environment,
      timestamp: new Date().toISOString(),
    };
    writeJson(res, 200, body);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/config') {
    const body: PublicRuntimeConfig = {
      apiVersion: 'v1',
      serviceVersion: service.version,
      milestone: service.milestone,
      deploymentEnvironment: environment.environment,
      execution: {
        testnetEnabled: environment.testnetExecutionEnabled,
        mainnetEnabled: environment.mainnetExecutionEnabled,
        mainnetAutonomyEnabled: environment.mainnetAutonomyEnabled,
      },
      auth: getAuthAvailability(),
    };
    writeJson(res, 200, body);
    return;
  }

  if (url.pathname.startsWith('/api/auth/')) {
    if (!getAuthAvailability().configured) {
      writeJson(res, 503, { error: 'auth_not_configured', message: 'AgentPlace authentication is not configured.', requestId });
      return;
    }
    await getAuthNodeHandler()(req, res);
    return;
  }

  if (url.pathname === '/api/v1/me' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    writeJson(res, 200, { user: identity });
    return;
  }



  if (url.pathname === '/api/v1/wallets' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const [wallets, agentAccounts] = await Promise.all([listWallets(identity.appUserId), listAgentAccounts(identity.appUserId)]);
    writeJson(res, 200, { wallets, agentAccounts });
    return;
  }

  if (url.pathname === '/api/v1/wallets/watch' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (typeof body.name !== 'string' || typeof body.address !== 'string') throw new Error('INVALID_WALLET_INPUT');
    if (body.namespace !== 'eip155' && body.namespace !== 'solana') throw new Error('INVALID_WALLET_NAMESPACE');
    const networks = Array.isArray(body.networks) ? body.networks.map((value) => {
      const row = asRecord(value);
      if (typeof row.networkId !== 'string' || typeof row.chainReference !== 'string') throw new Error('INVALID_WALLET_NETWORK');
      return { networkId: row.networkId, chainReference: row.chainReference };
    }) : [];
    const wallet = await createWatchWallet(identity.appUserId, { name: body.name, address: body.address, namespace: body.namespace as WalletNamespace, networks });
    writeJson(res, 201, { wallet });
    return;
  }

  if (url.pathname === '/api/v1/wallets/connect' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    const network = asRecord(body.network);
    if (typeof body.name !== 'string' || typeof body.address !== 'string') throw new Error('INVALID_WALLET_INPUT');
    if (body.namespace !== 'eip155') throw new Error('UNSUPPORTED_CONNECTED_WALLET_NAMESPACE');
    if (typeof network.networkId !== 'string' || typeof network.chainReference !== 'string') throw new Error('INVALID_WALLET_NETWORK');
    const nativeBalanceAtomic = network.nativeBalanceAtomic === undefined ? undefined : asOptionalString(network.nativeBalanceAtomic, 100);
    const wallet = await connectWallet(identity.appUserId, {
      name: body.name,
      address: body.address,
      namespace: body.namespace as WalletNamespace,
      network: { networkId: network.networkId, chainReference: network.chainReference, ...(nativeBalanceAtomic ? { nativeBalanceAtomic } : {}) },
    });
    writeJson(res, 201, { wallet });
    return;
  }

  if (url.pathname === '/api/v1/agent-accounts' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (typeof body.name !== 'string' || typeof body.ownerWalletId !== 'string' || !Array.isArray(body.preferredNetworkIds) || !body.preferredNetworkIds.every((value) => typeof value === 'string')) throw new Error('INVALID_AGENT_ACCOUNT_INPUT');
    const created = await createAgentAccount(identity.appUserId, {
      name: body.name,
      ownerWalletId: body.ownerWalletId,
      preferredNetworkIds: body.preferredNetworkIds as string[],
    });
    writeJson(res, 201, created);
    return;
  }

  const walletNetworkMatch = url.pathname.match(/^\/api\/v1\/wallets\/([^/]+)\/network-state$/);
  if (walletNetworkMatch && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const walletId = decodeURIComponent(walletNetworkMatch[1] ?? '');
    const body = asRecord(await readJson(req));
    if (typeof body.networkId !== 'string' || typeof body.chainReference !== 'string' || typeof body.address !== 'string' || typeof body.connected !== 'boolean') throw new Error('INVALID_WALLET_NETWORK');
    const nativeBalanceAtomic = body.nativeBalanceAtomic === undefined ? undefined : asOptionalString(body.nativeBalanceAtomic, 100);
    const wallet = await observeWalletNetwork(identity.appUserId, walletId, {
      networkId: body.networkId,
      chainReference: body.chainReference,
      address: body.address,
      connected: body.connected,
      ...(nativeBalanceAtomic ? { nativeBalanceAtomic } : {}),
    });
    if (!wallet) return writeJson(res, 404, { error: 'not_found', message: 'Wallet not found.', requestId });
    writeJson(res, 200, { wallet });
    return;
  }

  const walletMatch = url.pathname.match(/^\/api\/v1\/wallets\/([^/]+)$/);
  if (walletMatch) {
    const identity = await requireIdentity(req);
    const walletId = decodeURIComponent(walletMatch[1] ?? '');
    if (req.method === 'GET') {
      const wallet = await getWallet(identity.appUserId, walletId);
      if (!wallet) return writeJson(res, 404, { error: 'not_found', message: 'Wallet not found.', requestId });
      writeJson(res, 200, { wallet });
      return;
    }
    if (req.method === 'PATCH') {
      const body = asRecord(await readJson(req));
      const patch: { name?: string; status?: 'active' | 'disconnected' | 'removed' } = {};
      if (body.name !== undefined) {
        if (typeof body.name !== 'string') throw new Error('INVALID_WALLET_INPUT');
        patch.name = body.name;
      }
      if (body.status !== undefined) {
        if (body.status !== 'active' && body.status !== 'disconnected' && body.status !== 'removed') throw new Error('INVALID_WALLET_STATUS');
        patch.status = body.status;
      }
      const wallet = await updateWallet(identity.appUserId, walletId, patch);
      if (!wallet && patch.status !== 'removed') return writeJson(res, 404, { error: 'not_found', message: 'Wallet not found.', requestId });
      writeJson(res, 200, { wallet });
      return;
    }
  }

  if (url.pathname === '/api/v1/capabilities' && req.method === 'GET') {
    await requireIdentity(req);
    const [capabilities, implementations] = await Promise.all([listCanonicalCapabilities(), listCapabilityImplementations()]);
    writeJson(res, 200, { capabilities, implementations });
    return;
  }

  if (url.pathname === '/api/v1/intelligence/models' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const conversationId = url.searchParams.get('conversationId');
    const preference = conversationId ? await getConversationModelPreference(identity.appUserId, conversationId) : { provider: 'auto' as const };
    writeJson(res, 200, { catalog: getModelCatalog(), preference });
    return;
  }

  if (url.pathname === '/api/v1/intelligence/tasks' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const conversationId = url.searchParams.get('conversationId') ?? '';
    if (!conversationId || conversationId.length > 128) throw new Error('INVALID_CONVERSATION_ID');
    const conversation = await getConversation(identity.appUserId, conversationId);
    if (!conversation) return writeJson(res, 404, { error: 'not_found', message: 'Conversation not found.', requestId });
    const task = await getLatestIntelligenceTask(identity.appUserId, conversationId);
    writeJson(res, 200, { task });
    return;
  }

  if (url.pathname === '/api/v1/intelligence/tasks' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (typeof body.conversationId !== 'string' || !body.conversationId || body.conversationId.length > 128) throw new Error('INVALID_CONVERSATION_ID');
    if (!isMessage(body.message) || body.message.role !== 'user') throw new Error('INVALID_INTELLIGENCE_MESSAGE');
    const conversation = await getConversation(identity.appUserId, body.conversationId);
    if (!conversation) return writeJson(res, 404, { error: 'not_found', message: 'Conversation not found.', requestId });
    const provider = body.provider === 'openai' || body.provider === 'gemini' || body.provider === 'anthropic' ? body.provider : 'auto';
    const requestedModel = body.model === undefined || body.model === null || body.model === '' ? undefined : asOptionalString(body.model, 200);
    const model = provider === 'auto' ? undefined : requestedModel;
    if (provider !== 'auto') {
      const providerCatalog = getModelCatalog().providers.find((item) => item.provider === provider);
      if (!providerCatalog?.configured) throw new Error('MODEL_PROVIDER_NOT_CONFIGURED');
      if (model && !providerCatalog.models.some((item) => item.model === model)) throw new Error('INVALID_MODEL_SELECTION');
    }
    await addMessage(identity.appUserId, conversation.id, body.message);
    await setConversationModelPreference(identity.appUserId, conversation.id, provider, model);
    const task = await enqueueIntelligenceTask({
      ownerUserId: identity.appUserId,
      conversationId: conversation.id,
      userMessageId: body.message.id,
      scope: conversation.scope,
      ...(conversation.workerId ? { workerId: conversation.workerId } : {}),
      ...(conversation.jobId ? { jobId: conversation.jobId } : {}),
      providerPreference: provider,
      ...(model ? { modelPreference: model } : {}),
    });
    writeJson(res, 202, { task });
    return;
  }

  const intelligenceTaskMatch = url.pathname.match(/^\/api\/v1\/intelligence\/tasks\/([^/]+)$/);
  if (intelligenceTaskMatch && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const task = await getIntelligenceTask(identity.appUserId, decodeURIComponent(intelligenceTaskMatch[1] ?? ''));
    if (!task) return writeJson(res, 404, { error: 'not_found', message: 'Intelligence task not found.', requestId });
    writeJson(res, 200, { task });
    return;
  }

  const routeMatch = url.pathname.match(/^\/api\/v1\/jobs\/([^/]+)\/route$/);
  if (routeMatch && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const jobId = decodeURIComponent(routeMatch[1] ?? '');
    const job = await getJob(identity.appUserId, jobId);
    if (!job) return writeJson(res, 404, { error: 'not_found', message: 'Job not found.', requestId });
    const route = await getRouteDecisionForJob(identity.appUserId, jobId);
    writeJson(res, 200, { route });
    return;
  }

  const intelligenceEvidenceMatch = url.pathname.match(/^\/api\/v1\/jobs\/([^/]+)\/intelligence-evidence$/);
  if (intelligenceEvidenceMatch && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const jobId = decodeURIComponent(intelligenceEvidenceMatch[1] ?? '');
    const job = await getJob(identity.appUserId, jobId);
    if (!job) return writeJson(res, 404, { error: 'not_found', message: 'Job not found.', requestId });
    const evidence = await listJobIntelligenceEvidence(identity.appUserId, jobId);
    writeJson(res, 200, { evidence });
    return;
  }

  const evidenceMatch = url.pathname.match(/^\/api\/v1\/jobs\/([^/]+)\/evidence$/);
  if (evidenceMatch && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const jobId = decodeURIComponent(evidenceMatch[1] ?? '');
    const job = await getJob(identity.appUserId, jobId);
    if (!job) return writeJson(res, 404, { error: 'not_found', message: 'Job not found.', requestId });
    const sources = await getJobEvidence(identity.appUserId, jobId);
    writeJson(res, 200, { sources });
    return;
  }

  if (url.pathname === '/api/v1/worker-catalog' && req.method === 'GET') {
    await requireIdentity(req);
    const workers = await listWorkerCatalog();
    writeJson(res, 200, { workers });
    return;
  }

  if (url.pathname === '/api/v1/workers' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const workers = await listUserWorkers(identity.appUserId);
    writeJson(res, 200, { workers });
    return;
  }

  if (url.pathname === '/api/v1/workers' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (typeof body.definitionId !== 'string' || !body.definitionId || body.definitionId.length > 128) throw new Error('INVALID_WORKER_DEFINITION');
    let worker = await installWorker(identity.appUserId, body.definitionId);
    const conversationId = scopedId('workerconv', identity.appUserId, worker.id);
    await createConversation(identity.appUserId, {
      id: conversationId,
      scope: 'worker',
      workerId: worker.id,
      title: worker.name,
      titleSource: 'auto',
      pinned: false,
      archived: false,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    worker = (await updateUserWorker(identity.appUserId, worker.id, { primaryConversationId: conversationId })) ?? worker;
    writeJson(res, 201, { worker });
    return;
  }

  const workerMatch = url.pathname.match(/^\/api\/v1\/workers\/([^/]+)$/);
  if (workerMatch) {
    const workerId = decodeURIComponent(workerMatch[1] ?? '');
    const identity = await requireIdentity(req);
    if (req.method === 'GET') {
      const worker = await getUserWorker(identity.appUserId, workerId);
      if (!worker || worker.status === 'removed') return writeJson(res, 404, { error: 'not_found', message: 'Worker not found.', requestId });
      writeJson(res, 200, { worker });
      return;
    }
    if (req.method === 'PATCH') {
      const body = asRecord(await readJson(req));
      const patch: { status?: UserWorkerStatus; currentFocus?: string | null; currentJobId?: string | null } = {};
      if (body.status !== undefined) {
        if (typeof body.status !== 'string' || !workerStatuses.has(body.status as UserWorkerStatus)) throw new Error('INVALID_WORKER_STATUS');
        patch.status = body.status as UserWorkerStatus;
      }
      if (body.currentFocus !== undefined) {
        if (body.currentFocus === null) patch.currentFocus = null;
        else { const value = asOptionalString(body.currentFocus, 1000); if (value !== undefined) patch.currentFocus = value; }
      }
      if (body.currentJobId !== undefined) {
        if (body.currentJobId === null) patch.currentJobId = null;
        else { const value = asOptionalString(body.currentJobId, 128); if (value !== undefined) patch.currentJobId = value; }
      }
      const worker = await updateUserWorker(identity.appUserId, workerId, patch);
      if (!worker) return writeJson(res, 404, { error: 'not_found', message: 'Worker not found.', requestId });
      writeJson(res, 200, { worker });
      return;
    }
  }


  if (url.pathname === '/api/v1/authority' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const [mandates, decisions, controls] = await Promise.all([
      listMandates(identity.appUserId),
      listAuthorityDecisions(identity.appUserId, 100),
      getAuthorityControlState(identity.appUserId),
    ]);
    writeJson(res, 200, { mandates, decisions, controls });
    return;
  }

  if (url.pathname === '/api/v1/mandates' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    const workerId = requiredString(body.workerId, 'INVALID_MANDATE_WORKER', 128);
    const accountId = requiredString(body.accountId, 'INVALID_MANDATE_ACCOUNT', 160);
    const environmentValue = parseEnvironment(body.environment);
    const status = body.status === undefined ? 'DRAFT' : body.status;
    if (status !== 'DRAFT' && status !== 'ACTIVE') throw new Error('INVALID_MANDATE_STATUS');
    const mandate = await createMandate(identity.appUserId, { workerId, accountId, environment: environmentValue, status, policy: parseMandatePolicy(body.policy) });
    writeJson(res, 201, { mandate });
    return;
  }

  if (url.pathname === '/api/v1/mandates/translate' && req.method === 'POST') {
    await requireIdentity(req);
    const body = asRecord(await readJson(req));
    const draft = translateMandateIntent(requiredString(body.intent, 'INVALID_MANDATE_INTENT', 4000));
    writeJson(res, 200, { draft });
    return;
  }

  const mandateRevisionsMatch = url.pathname.match(/^\/api\/v1\/mandates\/([^/]+)\/revisions$/);
  if (mandateRevisionsMatch && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const mandateId = decodeURIComponent(mandateRevisionsMatch[1] ?? '');
    const mandate = await getMandate(identity.appUserId, mandateId);
    if (!mandate) return writeJson(res, 404, { error: 'not_found', message: 'Mandate not found.', requestId });
    writeJson(res, 200, { revisions: await listMandateRevisions(identity.appUserId, mandateId) });
    return;
  }

  const mandateStatusMatch = url.pathname.match(/^\/api\/v1\/mandates\/([^/]+)\/status$/);
  if (mandateStatusMatch && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (body.status !== 'ACTIVE' && body.status !== 'PAUSED' && body.status !== 'REVOKED') throw new Error('INVALID_MANDATE_STATUS');
    const mandate = await setMandateStatus(identity.appUserId, decodeURIComponent(mandateStatusMatch[1] ?? ''), body.status);
    if (!mandate) return writeJson(res, 404, { error: 'not_found', message: 'Mandate not found.', requestId });
    writeJson(res, 200, { mandate });
    return;
  }

  const mandateMatch = url.pathname.match(/^\/api\/v1\/mandates\/([^/]+)$/);
  if (mandateMatch) {
    const identity = await requireIdentity(req);
    const mandateId = decodeURIComponent(mandateMatch[1] ?? '');
    if (req.method === 'GET') {
      const mandate = await getMandate(identity.appUserId, mandateId);
      if (!mandate) return writeJson(res, 404, { error: 'not_found', message: 'Mandate not found.', requestId });
      writeJson(res, 200, { mandate });
      return;
    }
    if (req.method === 'PATCH') {
      const body = asRecord(await readJson(req));
      if (typeof body.expectedRevision !== 'number' || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 1) throw new Error('INVALID_MANDATE_REVISION');
      const mandate = await reviseMandate(identity.appUserId, mandateId, body.expectedRevision, parseMandatePolicy(body.policy));
      if (!mandate) return writeJson(res, 404, { error: 'not_found', message: 'Mandate not found.', requestId });
      writeJson(res, 200, { mandate });
      return;
    }
  }

  if (url.pathname === '/api/v1/authority/evaluate' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    const decision = await evaluateAuthority(identity.appUserId, parseActionEnvelope(body.action), { mainnetAutonomyEnabled: environment.mainnetAutonomyEnabled });
    writeJson(res, 200, { decision });
    return;
  }

  if (url.pathname === '/api/v1/authority/control' && req.method === 'PATCH') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    const targetEnvironment = parseEnvironment(body.environment);
    if (typeof body.paused !== 'boolean') throw new Error('INVALID_AUTHORITY_CONTROL');
    const controls = await setAutonomousExecutionPaused(identity.appUserId, targetEnvironment, body.paused);
    writeJson(res, 200, { controls });
    return;
  }

  if (url.pathname === '/api/v1/authority/revoke-all' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    const targetEnvironment = body.environment === undefined || body.environment === null ? undefined : parseEnvironment(body.environment);
    const revokedCount = await revokeAllMandates(identity.appUserId, targetEnvironment);
    const [mandates, controls] = await Promise.all([listMandates(identity.appUserId), getAuthorityControlState(identity.appUserId)]);
    writeJson(res, 200, { revokedCount, mandates, controls });
    return;
  }


  if (url.pathname === '/api/v1/actions' && req.method === 'GET') {
    const identity=await requireIdentity(req);
    writeJson(res,200,{actions:await listFinancialActions(identity.appUserId,100)}); return;
  }
  if (url.pathname === '/api/v1/actions' && req.method === 'POST') {
    const identity=await requireIdentity(req); const body=asRecord(await readJson(req));
    const action=await createFinancialAction(identity.appUserId,parseFinancialActionInput(body.action));
    writeJson(res,201,{action}); return;
  }
  const actionExecutionStartMatch=url.pathname.match(/^\/api\/v1\/actions\/([^/]+)\/execution\/start$/);
  if(actionExecutionStartMatch&&req.method==='POST'){
    const identity=await requireIdentity(req);
    const intent=await startConnectedWalletExecution(identity.appUserId,decodeURIComponent(actionExecutionStartMatch[1]??''),{
      mainnetExecutionEnabled:environment.mainnetExecutionEnabled,
      testnetExecutionEnabled:environment.testnetExecutionEnabled,
      mainnetAutonomyEnabled:environment.mainnetAutonomyEnabled,
    });
    writeJson(res,200,{execution:intent}); return;
  }
  const actionExecutionMatch=url.pathname.match(/^\/api\/v1\/actions\/([^/]+)\/execution$/);
  if(actionExecutionMatch&&req.method==='GET'){
    const identity=await requireIdentity(req); const attempt=await getLatestTransactionAttemptForAction(identity.appUserId,decodeURIComponent(actionExecutionMatch[1]??''));
    writeJson(res,200,{attempt}); return;
  }
  const executionReportMatch=url.pathname.match(/^\/api\/v1\/executions\/([^/]+)\/report$/);
  if(executionReportMatch&&req.method==='POST'){
    const identity=await requireIdentity(req); const body=asRecord(await readJson(req));
    if(body.outcome!=='SUBMITTED'&&body.outcome!=='USER_REJECTED'&&body.outcome!=='PRE_SUBMISSION_FAILED'&&body.outcome!=='UNKNOWN') throw new Error('INVALID_EXECUTION_OUTCOME');
    const promptToken=requiredString(body.promptToken,'INVALID_EXECUTION_PROMPT_TOKEN',128);
    const input:{promptToken:string;outcome:'SUBMITTED'|'USER_REJECTED'|'PRE_SUBMISSION_FAILED'|'UNKNOWN';transactionHash?:string;message?:string}={promptToken,outcome:body.outcome};
    if(body.transactionHash!==undefined)input.transactionHash=requiredString(body.transactionHash,'INVALID_EXECUTION_TRANSACTION_HASH',100);
    if(body.message!==undefined)input.message=requiredString(body.message,'INVALID_EXECUTION_MESSAGE',500);
    writeJson(res,200,{attempt:await reportConnectedWalletResult(identity.appUserId,decodeURIComponent(executionReportMatch[1]??''),input)}); return;
  }
  const executionMatch=url.pathname.match(/^\/api\/v1\/executions\/([^/]+)$/);
  if(executionMatch&&req.method==='GET'){
    const identity=await requireIdentity(req); const attempt=await getTransactionAttempt(identity.appUserId,decodeURIComponent(executionMatch[1]??''));
    if(!attempt)return writeJson(res,404,{error:'not_found',message:'Transaction attempt not found.',requestId}); writeJson(res,200,{attempt}); return;
  }
  const actionPrepareMatch=url.pathname.match(/^\/api\/v1\/actions\/([^/]+)\/prepare$/);
  if(actionPrepareMatch&&req.method==='POST'){
    const identity=await requireIdentity(req); const action=await prepareFinancialAction(identity.appUserId,decodeURIComponent(actionPrepareMatch[1]??''),{mainnetAutonomyEnabled:environment.mainnetAutonomyEnabled});
    writeJson(res,200,{action}); return;
  }
  const actionApprovalMatch=url.pathname.match(/^\/api\/v1\/actions\/([^/]+)\/approval$/);
  if(actionApprovalMatch&&req.method==='POST'){
    const identity=await requireIdentity(req); const body=asRecord(await readJson(req));
    if(body.decision!=='APPROVED'&&body.decision!=='REJECTED') throw new Error('INVALID_ACTION_APPROVAL_DECISION');
    writeJson(res,200,await decideActionApproval(identity.appUserId,decodeURIComponent(actionApprovalMatch[1]??''),body.decision)); return;
  }
  const actionMatch=url.pathname.match(/^\/api\/v1\/actions\/([^/]+)$/);
  if(actionMatch&&req.method==='GET'){
    const identity=await requireIdentity(req); const action=await getFinancialAction(identity.appUserId,decodeURIComponent(actionMatch[1]??''));
    if(!action)return writeJson(res,404,{error:'not_found',message:'Financial action not found.',requestId}); writeJson(res,200,{action}); return;
  }
  if(url.pathname==='/api/v1/service-cost-reviews'&&req.method==='POST'){
    const identity=await requireIdentity(req); const body=asRecord(await readJson(req));
    const review=await createServiceCostReview(identity.appUserId,{provider:requiredString(body.provider,'INVALID_SERVICE_PROVIDER',128),serviceDescription:requiredString(body.serviceDescription,'INVALID_SERVICE_DESCRIPTION',500),amountUsd:requiredString(body.amountUsd,'INVALID_SERVICE_COST',64),...(body.thresholdUsd!==undefined?{thresholdUsd:requiredString(body.thresholdUsd,'INVALID_SERVICE_THRESHOLD',64)}:{}),...(body.expiresAt!==undefined?{expiresAt:requiredString(body.expiresAt,'INVALID_SERVICE_EXPIRY',80)}:{}),...(body.workerId!==undefined?{workerId:requiredString(body.workerId,'INVALID_SERVICE_WORKER',128)}:{}),...(body.jobId!==undefined?{jobId:requiredString(body.jobId,'INVALID_SERVICE_JOB',128)}:{})});
    writeJson(res,201,{review}); return;
  }
  const serviceReviewMatch=url.pathname.match(/^\/api\/v1\/service-cost-reviews\/([^/]+)\/decision$/);
  if(serviceReviewMatch&&req.method==='POST'){
    const identity=await requireIdentity(req); const body=asRecord(await readJson(req)); if(body.decision!=='APPROVED'&&body.decision!=='REJECTED')throw new Error('INVALID_SERVICE_COST_DECISION');
    writeJson(res,200,{review:await decideServiceCostReview(identity.appUserId,decodeURIComponent(serviceReviewMatch[1]??''),body.decision)}); return;
  }

  if (url.pathname === '/api/v1/jobs' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const jobs = await listJobs(identity.appUserId);
    writeJson(res, 200, { jobs });
    return;
  }

  if (url.pathname === '/api/v1/jobs' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (!isJobDraft(body.job)) throw new Error('INVALID_JOB');
    let job = await createJob(identity.appUserId, body.job);
    const conversationId = job.jobConversationId ?? `job-${job.id}`;
    await createConversation(identity.appUserId, {
      id: conversationId,
      scope: 'job',
      jobId: job.id,
      title: job.title,
      titleSource: 'auto',
      pinned: false,
      archived: false,
      createdAt: job.createdAt,
      messages: [],
    });
    job = (await setJobConversation(identity.appUserId, job.id, conversationId)) ?? job;
    writeJson(res, 201, { job });
    return;
  }

  const jobMatch = url.pathname.match(/^\/api\/v1\/jobs\/([^/]+)$/);
  if (jobMatch && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const job = await getJob(identity.appUserId, decodeURIComponent(jobMatch[1] ?? ''));
    if (!job) return writeJson(res, 404, { error: 'not_found', message: 'Job not found.', requestId });
    writeJson(res, 200, { job });
    return;
  }

  if (url.pathname === '/api/v1/activity' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const activity = await listActivity(identity.appUserId);
    writeJson(res, 200, { activity });
    return;
  }

  if (url.pathname === '/api/v1/conversations' && req.method === 'GET') {
    const identity = await requireIdentity(req);
    const query = url.searchParams.get('q')?.trim().slice(0, 200);
    const conversations = await listConversations(identity.appUserId, query || undefined);
    writeJson(res, 200, { conversations });
    return;
  }

  if (url.pathname === '/api/v1/conversations' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (!isConversationDraft(body.conversation)) throw new Error('INVALID_CONVERSATION');
    const conversation = await createConversation(identity.appUserId, body.conversation);
    writeJson(res, 201, { conversation });
    return;
  }

  if (url.pathname === '/api/v1/conversations/import' && req.method === 'POST') {
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (!Array.isArray(body.conversations) || body.conversations.length > 100 || !body.conversations.every(isConversationDraft)) {
      throw new Error('INVALID_CONVERSATION_IMPORT');
    }
    const conversations = await importConversations(identity.appUserId, body.conversations);
    writeJson(res, 200, { conversations });
    return;
  }

  const conversationMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)$/);
  if (conversationMatch) {
    const id = decodeURIComponent(conversationMatch[1] ?? '');
    const identity = await requireIdentity(req);
    if (req.method === 'GET') {
      const conversation = await getConversation(identity.appUserId, id);
      if (!conversation) return writeJson(res, 404, { error: 'not_found', message: 'Conversation not found.', requestId });
      writeJson(res, 200, { conversation });
      return;
    }
    if (req.method === 'PATCH') {
      const body = asRecord(await readJson(req));
      const patch: { title?: string; titleSource?: 'auto' | 'user'; pinned?: boolean; archived?: boolean } = {};
      if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200) throw new Error('INVALID_TITLE');
        patch.title = body.title.trim();
      }
      if (body.titleSource !== undefined) {
        if (body.titleSource !== 'auto' && body.titleSource !== 'user') throw new Error('INVALID_TITLE_SOURCE');
        patch.titleSource = body.titleSource;
      }
      if (body.pinned !== undefined) {
        if (typeof body.pinned !== 'boolean') throw new Error('INVALID_PIN');
        patch.pinned = body.pinned;
      }
      if (body.archived !== undefined) {
        if (typeof body.archived !== 'boolean') throw new Error('INVALID_ARCHIVE');
        patch.archived = body.archived;
      }
      const conversation = await patchConversation(identity.appUserId, id, patch);
      if (!conversation) return writeJson(res, 404, { error: 'not_found', message: 'Conversation not found.', requestId });
      writeJson(res, 200, { conversation });
      return;
    }
  }

  const messagesMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/);
  if (messagesMatch && req.method === 'POST') {
    const conversationId = decodeURIComponent(messagesMatch[1] ?? '');
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (!isMessage(body.message)) throw new Error('INVALID_MESSAGE');
    const message = await addMessage(identity.appUserId, conversationId, body.message);
    if (!message) return writeJson(res, 404, { error: 'not_found', message: 'Conversation not found.', requestId });
    writeJson(res, 201, { message });
    return;
  }

  const messageMatch = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages\/([^/]+)$/);
  if (messageMatch && req.method === 'PATCH') {
    const conversationId = decodeURIComponent(messageMatch[1] ?? '');
    const messageId = decodeURIComponent(messageMatch[2] ?? '');
    const identity = await requireIdentity(req);
    const body = asRecord(await readJson(req));
    if (typeof body.content !== 'string' || typeof body.updatedAt !== 'string') throw new Error('INVALID_MESSAGE_UPDATE');
    const updated = await patchMessage(identity.appUserId, conversationId, messageId, { content: body.content, updatedAt: body.updatedAt });
    if (!updated) return writeJson(res, 404, { error: 'not_found', message: 'Message not found.', requestId });
    writeJson(res, 200, { ok: true });
    return;
  }

  writeJson(res, 404, {
    error: 'not_found',
    message: 'The requested AgentPlace API resource does not exist.',
    requestId,
  });
}

const server = createServer((req, res) => {
  const requestId = createRequestId();
  res.setHeader('x-agent-place-request-id', requestId);
  writeCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${host}:${port}`}`);
  void handleApi(req, res, url, requestId).catch((error: unknown) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    if (code === 'UNAUTHENTICATED') {
      writeJson(res, 401, { error: 'unauthenticated', message: 'Sign in to continue.', requestId });
      return;
    }
    if (code === 'MANDATE_REVISION_CONFLICT') {
      writeJson(res, 409, { error: 'conflict', message: code, requestId });
      return;
    }
    if (['REVOKED_MANDATE_CANNOT_RESURRECT','MANDATE_EXPIRED','INVALID_MANDATE_STATUS_TRANSITION'].includes(code)) {
      writeJson(res, 409, { error: 'conflict', message: code, requestId });
      return;
    }
    const actionApprovalConflicts: Record<string, string> = {
      ACTION_NOT_PREPARED: 'Prepare this action before approving it.',
      ACTION_PREPARATION_EXPIRED: 'This action preparation expired. Refresh it before approving.',
      ACTION_APPROVAL_NOT_REQUIRED: 'This action does not require one-time approval.',
      ACTION_NOT_APPROVABLE: 'This action is not ready for approval. Refresh its quote or preflight first.',
      ACTION_EXECUTION_LOCKED: 'This financial action already has a live, submitted, uncertain or completed execution attempt. AgentPlace will not re-prepare it into a duplicate execution path.',
    };
    if (actionApprovalConflicts[code]) {
      writeJson(res, 409, { error: 'action_not_approvable', message: actionApprovalConflicts[code], requestId });
      return;
    }
    const executionConflicts: Record<string,string> = {
      EXECUTION_ACTION_NOT_PREPARED: 'Prepare this action before execution.',
      EXECUTION_ACTION_NOT_READY: 'This action is not ready for execution. Review and approve the current preparation first.',
      EXECUTION_PREPARATION_EXPIRED: 'This preparation expired. Refresh the action and approve the new exact preparation.',
      EXECUTION_SAFETY_CHECK_FAILED: 'A current safety check blocks execution. Refresh the action before trying again.',
      EXECUTION_QUOTE_UNAVAILABLE: 'This action does not have a current executable quote.',
      EXECUTION_QUOTE_EXPIRED: 'The executable quote expired. Refresh the action before signing.',
      MAINNET_EXECUTION_DISABLED: 'Mainnet execution is disabled by the AgentPlace production gate.',
      TESTNET_EXECUTION_DISABLED: 'Testnet execution is disabled by the AgentPlace environment gate.',
      EXECUTION_ENVIRONMENT_NETWORK_MISMATCH: 'The action environment does not match the selected network.',
      EXECUTION_CONNECTED_WALLET_REQUIRED: 'This execution path requires the exact Connected Wallet selected in Action Review.',
      EXECUTION_EXACT_APPROVAL_REQUIRED: 'Approve this exact prepared action before asking the wallet to sign.',
      EXECUTION_AUTHORITY_REVOKED: 'Current authority no longer permits this action. Nothing was submitted.',
      EXECUTION_RPC_REQUIRED: 'A server-side RPC is required for pre-sign execution inspection.',
      EXECUTION_PREFLIGHT_FAILED: 'Pre-sign transaction inspection failed. Nothing was submitted.',
      EXECUTION_SIGNATURE_ALREADY_REQUESTED: 'A wallet signature was already requested for this exact action. AgentPlace will not request a duplicate signature automatically.',
      EXECUTION_ALREADY_SUBMITTED_OR_UNCERTAIN: 'This exact action is already submitted or its submission state is uncertain. AgentPlace will not resubmit it automatically.',
      EXECUTION_ATTEMPT_TERMINAL: 'This exact execution attempt cannot be submitted again.',
      EXECUTION_ATTEMPT_CONFLICT: 'Another request already created this exact execution attempt. AgentPlace will not create a duplicate.',
      EXECUTION_REPORT_NOT_ACCEPTED: 'This wallet result no longer matches the active execution attempt.',
      EXECUTION_PROMPT_TOKEN_INVALID: 'The wallet result does not match the active signing request.',
    };
    if (executionConflicts[code] || code.startsWith('EXECUTION_RPC_UNAVAILABLE:')) {
      writeJson(res, 409, { error: 'execution_conflict', message: executionConflicts[code] ?? 'AgentPlace could not safely verify the execution RPC. Nothing was resubmitted.', requestId });
      return;
    }
    if (['INVALID_JSON','INVALID_BODY','INVALID_CONVERSATION','INVALID_CONVERSATION_IMPORT','INVALID_TITLE','INVALID_TITLE_SOURCE','INVALID_PIN','INVALID_ARCHIVE','INVALID_MESSAGE','INVALID_MESSAGE_UPDATE','INVALID_WORKER_DEFINITION','INVALID_WORKER_STATUS','INVALID_JOB','INVALID_STRING','INVALID_MODEL_SELECTION','MODEL_PROVIDER_NOT_CONFIGURED','JOB_LEAD_REQUIRED','JOB_WORKER_NOT_AVAILABLE','WORKER_DEFINITION_NOT_FOUND','INVALID_WALLET_INPUT','INVALID_WALLET_NAMESPACE','INVALID_WALLET_NETWORK','INVALID_WALLET_NAME','INVALID_EVM_ADDRESS','INVALID_SOLANA_ADDRESS','INVALID_NATIVE_BALANCE','WALLET_ADDRESS_MISMATCH','INVALID_WALLET_STATUS','INVALID_AGENT_ACCOUNT_INPUT','CONNECTED_OWNER_WALLET_REQUIRED','AGENT_ACCOUNT_EVM_OWNER_REQUIRED','AGENT_ACCOUNT_NETWORK_REQUIRED','UNSUPPORTED_CONNECTED_WALLET_NAMESPACE','INVALID_MANDATE_WORKER','INVALID_MANDATE_ACCOUNT','INVALID_MANDATE_ENVIRONMENT','INVALID_MANDATE_STATUS','INVALID_MANDATE_REVISION','INVALID_MANDATE_TITLE','INVALID_MANDATE_PURPOSE','INVALID_AUTHORITY_LEVEL','INVALID_MANDATE_SCOPE','INVALID_MANDATE_POLICY','INVALID_MANDATE_CAPABILITIES','MANDATE_CAPABILITY_REQUIRED','INVALID_MANDATE_NETWORKS','INVALID_MANDATE_ASSETS','INVALID_MANDATE_PROTOCOLS','INVALID_MANDATE_DESTINATIONS','ACT_MANDATE_ASSET_ALLOWLIST_REQUIRED','ACT_MANDATE_REQUIRES_AGENT_ACCOUNT','INVALID_CAPITAL_LIMIT','INVALID_PER_ACTION_LIMIT','INVALID_PERIOD_BUDGET','INVALID_SERVICE_BUDGET','ACT_MANDATE_HARD_LIMITS_REQUIRED','INVALID_APPROVAL_POLICY','INVALID_APPROVAL_THRESHOLD','INVALID_MANDATE_VALIDITY','ACT_MANDATE_EXPIRY_REQUIRED','INVALID_MANDATE_CHANGE_SUMMARY','MANDATE_WORKER_NOT_OWNED','MANDATE_ACCOUNT_NOT_OWNED','MANDATE_ACCOUNT_NOT_AVAILABLE','UNKNOWN_MANDATE_CAPABILITY','INVALID_AUTHORITY_ENVELOPE','INVALID_AUTHORITY_VALUE','INVALID_AUTHORITY_LEVERAGE','INVALID_AUTHORITY_CONTROL','INVALID_MANDATE_INTENT','INVALID_EXECUTION_OUTCOME','INVALID_EXECUTION_PROMPT_TOKEN','INVALID_EXECUTION_TRANSACTION_HASH','INVALID_EXECUTION_MESSAGE','EXECUTION_TRANSACTION_HASH_INVALID','EXECUTION_PROVIDER_PAYLOAD_INVALID','EXECUTION_PROVIDER_CHAIN_MISMATCH','EXECUTION_DESTINATION_INVALID','EXECUTION_AMOUNT_ATOMIC_REQUIRED','EXECUTION_ASSET_ADDRESS_INVALID','EXECUTION_CHAIN_UNSUPPORTED','EXECUTION_EVM_WALLET_REQUIRED','EXECUTION_WALLET_ADDRESS_INVALID','EXECUTION_INVALID_QUANTITY'].includes(code)) {
      writeJson(res, 400, { error: 'invalid_request', message: code, requestId });
      return;
    }
    if (code === 'PAYLOAD_TOO_LARGE') {
      writeJson(res, 413, { error: 'payload_too_large', message: code, requestId });
      return;
    }
    process.stderr.write(`${JSON.stringify({ level: 'error', service: service.name, requestId, message: 'Request failed', error: code })}\n`);
    writeJson(res, 500, { error: 'internal_error', message: 'AgentPlace could not complete this request.', requestId });
  });
});

server.listen(port, host, () => {
  process.stdout.write(
    `${JSON.stringify({
      level: 'info',
      service: service.name,
      version: service.version,
      milestone: service.milestone,
      message: 'AgentPlace API listening',
      host,
      port,
      environment: environment.environment,
    })}\n`,
  );
});
