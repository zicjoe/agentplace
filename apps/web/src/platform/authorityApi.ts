import type { Action } from '../fixtures/FixtureAppContext';
import type { AuthorityControlStates, AuthorityDecisionRecord, AuthorityGrant, Mandate } from '../state/types';
import type { Dispatch } from 'react';
import { WEB_RUNTIME_SETTINGS } from './runtime';

export type ApiAuthorityLevel = 'OBSERVE' | 'PREPARE' | 'ACT_WITHIN_MANDATE';
export type ApiMandateStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'REVOKED';
export type ApiPolicyScope = 'ANY' | 'ALLOW_LIST';
export type ApiEnvironment = 'mainnet' | 'testnet';

export interface ApiNetworkRef { family: string; networkId: string }
export interface ApiApprovalPolicy {
  mode: 'ALWAYS' | 'THRESHOLD' | 'WITHIN_LIMITS';
  thresholdUsd?: string;
  askForNewProtocols: boolean;
  askForNewDestinations: boolean;
}

export interface ApiMandatePolicy {
  title: string;
  purpose: string;
  authorityLevel: ApiAuthorityLevel;
  allowedCapabilities: string[];
  allowedNetworks: ApiNetworkRef[];
  assetScope: ApiPolicyScope;
  allowedAssets: string[];
  protocolScope: ApiPolicyScope;
  allowedProtocols: string[];
  destinationScope: ApiPolicyScope;
  allowedDestinations: string[];
  capitalLimitUsd?: string;
  perActionLimitUsd?: string;
  periodBudget?: { limitUsd: string; period: 'day' | 'week' | 'month' };
  serviceBudget?: { limitUsd: string; period: 'day' | 'week' | 'month' };
  approvalPolicy: ApiApprovalPolicy;
  borrowingAllowed: boolean;
  leverageAllowed: boolean;
  validFrom?: string;
  validUntil?: string;
  changeSummary: string;
}

interface ApiMandateRevision extends ApiMandatePolicy {
  revision: number;
  validFrom: string;
  createdAt: string;
}

export interface ApiMandate {
  id: string;
  workerId: string;
  workerName: string;
  accountId: string;
  accountName: string;
  accountMode: 'watch-only' | 'connected' | 'agent-account';
  agentAccountId?: string;
  environment: ApiEnvironment;
  status: ApiMandateStatus;
  revision: ApiMandateRevision;
  createdAt: string;
  updatedAt: string;
}

interface ApiDecision {
  id: string;
  mandateId?: string;
  mandateRevision?: number;
  workerId: string;
  accountId: string;
  environment: ApiEnvironment;
  actionEnvelope: { capabilityId: string; operation: 'OBSERVE' | 'PREPARE' | 'EXECUTE'; valueUsd?: string };
  decision: 'ALLOWED' | 'APPROVAL_REQUIRED' | 'DENIED';
  reasons: Array<{ code: string; message: string; field?: string; expected?: string; actual?: string }>;
  createdAt: string;
}

export interface AuthorityStatePayload {
  mandates: Mandate[];
  authorityGrants: AuthorityGrant[];
  authorityDecisions: AuthorityDecisionRecord[];
  controls: AuthorityControlStates;
  rawMandates: ApiMandate[];
}

function endpoint(path: string): string { return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`; }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || `AgentPlace authority request failed (${response.status})`);
  }
  return await response.json() as T;
}

function mapStatus(status: ApiMandateStatus): Mandate['status'] {
  return status.toLowerCase() as Mandate['status'];
}

function mapMandate(value: ApiMandate): Mandate {
  const r = value.revision;
  const expiry = r.validUntil ? new Date(r.validUntil) : new Date('9999-12-31T23:59:59.000Z');
  const restrictions: string[] = [];
  if (!r.borrowingAllowed) restrictions.push('No borrowing');
  if (!r.leverageAllowed) restrictions.push('No leverage');
  if (r.assetScope === 'ALLOW_LIST') restrictions.push(`Assets: ${r.allowedAssets.join(', ') || 'none'}`);
  if (r.protocolScope === 'ALLOW_LIST') restrictions.push(`Protocols: ${r.allowedProtocols.join(', ') || 'none'}`);
  return {
    id: value.id,
    workerId: value.workerId,
    workerName: value.workerName,
    accountId: value.accountId,
    accountName: value.accountName,
    accountMode: value.accountMode,
    ...(value.agentAccountId ? { agentAccountId: value.agentAccountId } : {}),
    environment: value.environment,
    revision: r.revision,
    authorityLevel: r.authorityLevel,
    title: r.title,
    purpose: r.purpose,
    goal: r.purpose,
    managedCapital: r.capitalLimitUsd ? `$${r.capitalLimitUsd}` : 'Not separately capped',
    reserveCapital: 'Not configured',
    preferredProtocols: r.allowedProtocols,
    riskPosture: r.approvalPolicy.mode === 'ALWAYS' ? 'Always ask' : r.approvalPolicy.mode === 'THRESHOLD' ? `Ask above $${r.approvalPolicy.thresholdUsd ?? '0'}` : 'Within approved limits',
    restrictions,
    allowedCapabilities: r.allowedCapabilities,
    allowedNetworks: r.allowedNetworks,
    assetScope: r.assetScope,
    allowedAssets: r.allowedAssets,
    protocolScope: r.protocolScope,
    allowedProtocols: r.allowedProtocols,
    destinationScope: r.destinationScope,
    allowedDestinations: r.allowedDestinations,
    ...(r.capitalLimitUsd ? { capitalLimitUsd: r.capitalLimitUsd } : {}),
    ...(r.perActionLimitUsd ? { perActionLimitUsd: r.perActionLimitUsd } : {}),
    ...(r.periodBudget ? { periodBudget: r.periodBudget } : {}),
    ...(r.serviceBudget ? { serviceBudget: r.serviceBudget } : {}),
    approvalPolicy: r.approvalPolicy,
    borrowingAllowed: r.borrowingAllowed,
    leverageAllowed: r.leverageAllowed,
    validFrom: new Date(r.validFrom),
    expiry,
    status: mapStatus(value.status),
    changeSummary: r.changeSummary,
    createdAt: new Date(value.createdAt),
  };
}

function mapGrant(value: ApiMandate): AuthorityGrant | null {
  if (value.revision.authorityLevel !== 'ACT_WITHIN_MANDATE') return null;
  return {
    id: `grant:${value.id}`,
    workerId: value.workerId,
    workerName: value.workerName,
    agentAccountId: value.agentAccountId ?? value.accountId,
    networks: value.revision.allowedNetworks.map((network) => network.networkId),
    allowedActions: value.revision.allowedCapabilities,
    allowedProtocols: value.revision.allowedProtocols,
    singleActionLimit: value.revision.perActionLimitUsd ? `$${value.revision.perActionLimitUsd}` : 'None',
    totalManagedCapital: value.revision.capitalLimitUsd ? `$${value.revision.capitalLimitUsd}` : value.revision.periodBudget ? `$${value.revision.periodBudget.limitUsd}/${value.revision.periodBudget.period}` : 'Not set',
    borrowingAllowed: value.revision.borrowingAllowed,
    leverageAllowed: value.revision.leverageAllowed,
    expiry: value.revision.validUntil ? new Date(value.revision.validUntil) : new Date('9999-12-31T23:59:59.000Z'),
    status: mapStatus(value.status),
    environment: value.environment,
    mandateId: value.id,
    createdAt: new Date(value.createdAt),
  };
}

function mapDecision(value: ApiDecision): AuthorityDecisionRecord {
  return {
    id: value.id,
    ...(value.mandateId ? { mandateId: value.mandateId } : {}),
    ...(value.mandateRevision !== undefined ? { mandateRevision: value.mandateRevision } : {}),
    workerId: value.workerId,
    accountId: value.accountId,
    environment: value.environment,
    capabilityId: value.actionEnvelope.capabilityId,
    operation: value.actionEnvelope.operation,
    decision: value.decision,
    reasons: value.reasons,
    ...(value.actionEnvelope.valueUsd ? { valueUsd: value.actionEnvelope.valueUsd } : {}),
    createdAt: new Date(value.createdAt),
  };
}

export async function fetchAuthorityState(): Promise<AuthorityStatePayload> {
  const data = await request<{ mandates: ApiMandate[]; decisions: ApiDecision[]; controls: AuthorityControlStates }>('/api/v1/authority');
  return {
    mandates: data.mandates.map(mapMandate),
    authorityGrants: data.mandates.map(mapGrant).filter((value): value is AuthorityGrant => Boolean(value)),
    authorityDecisions: data.decisions.map(mapDecision),
    controls: data.controls,
    rawMandates: data.mandates,
  };
}

export function applyAuthorityState(dispatch: Dispatch<Action>, state: AuthorityStatePayload): void {
  dispatch({ type: 'SET_MANDATES', mandates: state.mandates });
  dispatch({ type: 'SET_AUTHORITY_GRANTS', grants: state.authorityGrants });
  dispatch({ type: 'SET_AUTHORITY_DECISIONS', decisions: state.authorityDecisions });
  dispatch({ type: 'SET_AUTHORITY_CONTROLS', controls: state.controls });
}

export async function createDurableMandate(input: { workerId: string; accountId: string; environment: ApiEnvironment; status: 'DRAFT' | 'ACTIVE'; policy: ApiMandatePolicy }): Promise<ApiMandate> {
  const data = await request<{ mandate: ApiMandate }>('/api/v1/mandates', { method: 'POST', body: JSON.stringify(input) });
  return data.mandate;
}

export async function reviseDurableMandate(mandateId: string, expectedRevision: number, policy: ApiMandatePolicy): Promise<ApiMandate> {
  const data = await request<{ mandate: ApiMandate }>(`/api/v1/mandates/${encodeURIComponent(mandateId)}`, { method: 'PATCH', body: JSON.stringify({ expectedRevision, policy }) });
  return data.mandate;
}

export async function setDurableMandateStatus(mandateId: string, status: 'ACTIVE' | 'PAUSED' | 'REVOKED'): Promise<ApiMandate> {
  const data = await request<{ mandate: ApiMandate }>(`/api/v1/mandates/${encodeURIComponent(mandateId)}/status`, { method: 'POST', body: JSON.stringify({ status }) });
  return data.mandate;
}

export async function translateMandateDraft(intent: string): Promise<{ draft: { authorityLevel: ApiAuthorityLevel; networks: ApiNetworkRef[]; assets: string[]; protocols: string[]; approvalPolicy: ApiApprovalPolicy; perActionLimitUsd?: string; periodBudget?: { limitUsd: string; period: 'day' | 'week' | 'month' }; borrowingAllowed: boolean; leverageAllowed: boolean; warnings: string[] } }> {
  return request('/api/v1/mandates/translate', { method: 'POST', body: JSON.stringify({ intent }) });
}

export async function setAuthorityControl(environment: ApiEnvironment, paused: boolean): Promise<AuthorityControlStates> {
  const data = await request<{ controls: AuthorityControlStates }>('/api/v1/authority/control', { method: 'PATCH', body: JSON.stringify({ environment, paused }) });
  return data.controls;
}

export async function revokeAllDurableAuthority(environment?: ApiEnvironment): Promise<number> {
  const data = await request<{ revokedCount: number }>('/api/v1/authority/revoke-all', { method: 'POST', body: JSON.stringify({ ...(environment ? { environment } : {}) }) });
  return data.revokedCount;
}

export interface AuthorityCapabilityOption { id: string; name: string; purpose: string; effect: 'read' | 'write' | 'economic-write'; authorityRequirement: string }

export async function fetchAuthorityCapabilities(): Promise<AuthorityCapabilityOption[]> {
  const data = await request<{ capabilities: AuthorityCapabilityOption[] }>('/api/v1/capabilities');
  return data.capabilities;
}
