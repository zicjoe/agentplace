import { randomUUID } from 'node:crypto';
import { getDatabasePool, withTransaction, type SqlExecutor } from '@agent-place/db';

export type MandateStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'REVOKED';
export type AuthorityLevel = 'OBSERVE' | 'PREPARE' | 'ACT_WITHIN_MANDATE';
export type AuthorityDecisionValue = 'ALLOWED' | 'APPROVAL_REQUIRED' | 'DENIED';
export type AuthorityOperation = 'OBSERVE' | 'PREPARE' | 'EXECUTE';
export type AuthorityEnvironment = 'mainnet' | 'testnet';
export type PolicyScope = 'ANY' | 'ALLOW_LIST';
export type BudgetPeriod = 'day' | 'week' | 'month';
export type WalletMode = 'watch-only' | 'connected' | 'agent-account';
export type CapabilityEffect = 'read' | 'write' | 'economic-write';

export interface NetworkPolicyRef {
  family: string;
  networkId: string;
}

export interface ApprovalPolicy {
  mode: 'ALWAYS' | 'THRESHOLD' | 'WITHIN_LIMITS';
  thresholdUsd?: string;
  askForNewProtocols: boolean;
  askForNewDestinations: boolean;
}

export interface MandatePolicyInput {
  title: string;
  purpose: string;
  authorityLevel: AuthorityLevel;
  allowedCapabilities: string[];
  allowedNetworks: NetworkPolicyRef[];
  assetScope: PolicyScope;
  allowedAssets: string[];
  protocolScope: PolicyScope;
  allowedProtocols: string[];
  destinationScope: PolicyScope;
  allowedDestinations: string[];
  capitalLimitUsd?: string;
  perActionLimitUsd?: string;
  periodBudget?: { limitUsd: string; period: BudgetPeriod };
  serviceBudget?: { limitUsd: string; period: BudgetPeriod };
  approvalPolicy: ApprovalPolicy;
  borrowingAllowed: boolean;
  leverageAllowed: boolean;
  validFrom?: string;
  validUntil?: string;
  changeSummary: string;
}

export interface CreateMandateInput {
  id?: string;
  workerId: string;
  accountId: string;
  environment: AuthorityEnvironment;
  status?: 'DRAFT' | 'ACTIVE';
  policy: MandatePolicyInput;
}

export interface DurableMandateRevision extends Omit<MandatePolicyInput, 'validFrom' | 'validUntil'> {
  revision: number;
  validFrom: string;
  validUntil?: string;
  createdAt: string;
}

export interface DurableMandate {
  id: string;
  workerId: string;
  workerName: string;
  accountId: string;
  accountName: string;
  accountMode: WalletMode;
  agentAccountId?: string;
  environment: AuthorityEnvironment;
  status: MandateStatus;
  revision: DurableMandateRevision;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  pausedAt?: string;
  expiredAt?: string;
  revokedAt?: string;
}

export interface ActionEnvelope {
  workerId: string;
  accountId: string;
  capabilityId: string;
  operation: AuthorityOperation;
  environment: AuthorityEnvironment;
  network: NetworkPolicyRef;
  asset?: string;
  protocol?: string;
  destination?: string;
  valueUsd?: string;
  borrowing?: boolean;
  leverageMultiplier?: string;
  reason?: string;
  jobId?: string;
}

export interface AuthorityReason {
  code: string;
  message: string;
  field?: string;
  expected?: string;
  actual?: string;
}

export interface AuthorityPolicyEvaluation {
  decision: AuthorityDecisionValue;
  reasons: AuthorityReason[];
  periodSpentBeforeUsd: string;
}

export interface DurableAuthorityDecision extends AuthorityPolicyEvaluation {
  id: string;
  mandateId?: string;
  mandateRevision?: number;
  workerId: string;
  accountId: string;
  environment: AuthorityEnvironment;
  actionEnvelope: ActionEnvelope;
  evaluatedValueUsd?: string;
  createdAt: string;
}

export interface AuthorityControlState {
  mainnetPaused: boolean;
  testnetPaused: boolean;
}

export interface IntentTranslationDraft {
  authorityLevel: AuthorityLevel;
  networks: NetworkPolicyRef[];
  assets: string[];
  protocols: string[];
  approvalPolicy: ApprovalPolicy;
  perActionLimitUsd?: string;
  periodBudget?: { limitUsd: string; period: BudgetPeriod };
  borrowingAllowed: boolean;
  leverageAllowed: boolean;
  warnings: string[];
}

export interface MandatePolicySnapshot extends DurableMandateRevision {
  mandateId: string;
  workerId: string;
  accountId: string;
  environment: AuthorityEnvironment;
  status: MandateStatus;
}

export interface PureEvaluationInput {
  mandate: MandatePolicySnapshot | null;
  envelope: ActionEnvelope;
  capabilityKnown: boolean;
  capabilityEffect?: CapabilityEffect;
  accountMode?: WalletMode;
  globalAutonomyPaused: boolean;
  mainnetAutonomyEnabled: boolean;
  periodSpentUsd: string;
  now?: Date;
}

type MandateRow = {
  id: string;
  worker_id: string;
  worker_name: string;
  account_id: string;
  account_name: string;
  account_mode: WalletMode;
  agent_account_id: string | null;
  environment: AuthorityEnvironment;
  status: MandateStatus;
  current_revision: number;
  created_at: Date;
  updated_at: Date;
  activated_at: Date | null;
  paused_at: Date | null;
  expired_at: Date | null;
  revoked_at: Date | null;
  revision: number;
  title: string;
  purpose: string;
  authority_level: AuthorityLevel;
  allowed_capabilities: unknown;
  allowed_networks: unknown;
  asset_scope: PolicyScope;
  allowed_assets: unknown;
  protocol_scope: PolicyScope;
  allowed_protocols: unknown;
  destination_scope: PolicyScope;
  allowed_destinations: unknown;
  capital_limit_usd: string | null;
  per_action_limit_usd: string | null;
  period_budget_limit_usd: string | null;
  period_budget_period: BudgetPeriod | null;
  service_budget_limit_usd: string | null;
  service_budget_period: BudgetPeriod | null;
  approval_policy: unknown;
  borrowing_allowed: boolean;
  leverage_allowed: boolean;
  valid_from: Date;
  valid_until: Date | null;
  change_summary: string;
  revision_created_at: Date;
};

type DecisionRow = {
  id: string;
  mandate_id: string | null;
  mandate_revision: number | null;
  worker_id: string;
  account_id: string;
  environment: AuthorityEnvironment;
  action_envelope: unknown;
  decision: AuthorityDecisionValue;
  reasons: unknown;
  period_spent_before_usd: string;
  evaluated_value_usd: string | null;
  created_at: Date;
};

const CAPABILITY_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const NETWORK_PART = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const ASSET_OR_PROTOCOL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const DESTINATION = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const DECIMAL = /^(0|[1-9][0-9]{0,21})(?:\.([0-9]{1,8}))?$/;
const SCALE = 100_000_000n;

function text(value: string, max: number, code: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

function uniqueStrings(values: readonly string[], pattern: RegExp, code: string, uppercase = false): string[] {
  if (!Array.isArray(values) || values.length > 128) throw new Error(code);
  const out = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== 'string') throw new Error(code);
    const value = raw.trim();
    if (!pattern.test(value)) throw new Error(code);
    out.add(uppercase ? value.toUpperCase() : value.toLowerCase());
  }
  return [...out];
}

function networks(values: readonly NetworkPolicyRef[]): NetworkPolicyRef[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 32) throw new Error('INVALID_MANDATE_NETWORKS');
  const out = new Map<string, NetworkPolicyRef>();
  for (const raw of values) {
    const family = raw.family.trim().toLowerCase();
    const networkId = raw.networkId.trim().toLowerCase();
    if (!NETWORK_PART.test(family) || !NETWORK_PART.test(networkId)) throw new Error('INVALID_MANDATE_NETWORKS');
    out.set(`${family}:${networkId}`, { family, networkId });
  }
  return [...out.values()];
}

function decimal(value: string | undefined, code: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!DECIMAL.test(normalized) || units(normalized) <= 0n) throw new Error(code);
  return canonicalDecimal(normalized);
}

function canonicalDecimal(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${BigInt(whole).toString()}.${trimmed}` : BigInt(whole).toString();
}

function units(value: string): bigint {
  const match = DECIMAL.exec(value.trim());
  if (!match) throw new Error('INVALID_DECIMAL');
  const whole = BigInt(match[1] ?? '0');
  const fraction = (match[2] ?? '').padEnd(8, '0');
  return whole * SCALE + BigInt(fraction || '0');
}

function addDecimal(a: string, b: string): string {
  return fromUnits(units(a) + units(b));
}

function fromUnits(value: bigint): string {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

function greaterThan(a: string, b: string): boolean {
  return units(a) > units(b);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asNetworkArray(value: unknown): NetworkPolicyRef[] {
  if (!Array.isArray(value)) return [];
  const out: NetworkPolicyRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (typeof row.family === 'string' && typeof row.networkId === 'string') out.push({ family: row.family, networkId: row.networkId });
  }
  return out;
}

function asApprovalPolicy(value: unknown): ApprovalPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { mode: 'ALWAYS', askForNewProtocols: true, askForNewDestinations: true };
  }
  const row = value as Record<string, unknown>;
  const mode = row.mode === 'THRESHOLD' || row.mode === 'WITHIN_LIMITS' ? row.mode : 'ALWAYS';
  const out: ApprovalPolicy = {
    mode,
    askForNewProtocols: row.askForNewProtocols !== false,
    askForNewDestinations: row.askForNewDestinations !== false,
  };
  if (typeof row.thresholdUsd === 'string') out.thresholdUsd = row.thresholdUsd;
  return out;
}

function dateIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

function mapRevision(row: MandateRow): DurableMandateRevision {
  const revision: DurableMandateRevision = {
    revision: row.revision,
    title: row.title,
    purpose: row.purpose,
    authorityLevel: row.authority_level,
    allowedCapabilities: asStringArray(row.allowed_capabilities),
    allowedNetworks: asNetworkArray(row.allowed_networks),
    assetScope: row.asset_scope,
    allowedAssets: asStringArray(row.allowed_assets),
    protocolScope: row.protocol_scope,
    allowedProtocols: asStringArray(row.allowed_protocols),
    destinationScope: row.destination_scope,
    allowedDestinations: asStringArray(row.allowed_destinations),
    approvalPolicy: asApprovalPolicy(row.approval_policy),
    borrowingAllowed: row.borrowing_allowed,
    leverageAllowed: row.leverage_allowed,
    validFrom: row.valid_from.toISOString(),
    changeSummary: row.change_summary,
    createdAt: row.revision_created_at.toISOString(),
  };
  if (row.capital_limit_usd !== null) revision.capitalLimitUsd = canonicalDecimal(row.capital_limit_usd);
  if (row.per_action_limit_usd !== null) revision.perActionLimitUsd = canonicalDecimal(row.per_action_limit_usd);
  if (row.period_budget_limit_usd !== null && row.period_budget_period) revision.periodBudget = { limitUsd: canonicalDecimal(row.period_budget_limit_usd), period: row.period_budget_period };
  if (row.service_budget_limit_usd !== null && row.service_budget_period) revision.serviceBudget = { limitUsd: canonicalDecimal(row.service_budget_limit_usd), period: row.service_budget_period };
  const validUntil = dateIso(row.valid_until);
  if (validUntil) revision.validUntil = validUntil;
  return revision;
}

function mapMandate(row: MandateRow): DurableMandate {
  const mandate: DurableMandate = {
    id: row.id,
    workerId: row.worker_id,
    workerName: row.worker_name,
    accountId: row.account_id,
    accountName: row.account_name,
    accountMode: row.account_mode,
    environment: row.environment,
    status: row.status,
    revision: mapRevision(row),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
  if (row.agent_account_id) mandate.agentAccountId = row.agent_account_id;
  const activatedAt = dateIso(row.activated_at); if (activatedAt) mandate.activatedAt = activatedAt;
  const pausedAt = dateIso(row.paused_at); if (pausedAt) mandate.pausedAt = pausedAt;
  const expiredAt = dateIso(row.expired_at); if (expiredAt) mandate.expiredAt = expiredAt;
  const revokedAt = dateIso(row.revoked_at); if (revokedAt) mandate.revokedAt = revokedAt;
  return mandate;
}

const mandateSelect = `SELECT m.id,m.worker_id,d.name AS worker_name,m.account_id,w.name AS account_name,w.mode AS account_mode,
  aa.id AS agent_account_id,m.environment,m.status,m.current_revision,m.created_at,m.updated_at,m.activated_at,m.paused_at,m.expired_at,m.revoked_at,
  r.revision,r.title,r.purpose,r.authority_level,r.allowed_capabilities,r.allowed_networks,r.asset_scope,r.allowed_assets,
  r.protocol_scope,r.allowed_protocols,r.destination_scope,r.allowed_destinations,r.capital_limit_usd,r.per_action_limit_usd,
  r.period_budget_limit_usd,r.period_budget_period,r.service_budget_limit_usd,r.service_budget_period,r.approval_policy,
  r.borrowing_allowed,r.leverage_allowed,r.valid_from,r.valid_until,r.change_summary,r.created_at AS revision_created_at
  FROM mandate m
  JOIN worker_definition d ON d.id=m.worker_id
  JOIN wallet_resource w ON w.id=m.account_id AND w.owner_user_id=m.owner_user_id
  LEFT JOIN agent_account aa ON aa.wallet_id=m.account_id AND aa.owner_user_id=m.owner_user_id
  JOIN mandate_revision r ON r.mandate_id=m.id AND r.owner_user_id=m.owner_user_id AND r.revision=m.current_revision`;

function normalizePolicy(policy: MandatePolicyInput, accountMode?: WalletMode, requireActivationReady = true): MandatePolicyInput {
  const authorityLevel = policy.authorityLevel;
  if (!['OBSERVE','PREPARE','ACT_WITHIN_MANDATE'].includes(authorityLevel)) throw new Error('INVALID_AUTHORITY_LEVEL');
  const allowedCapabilities = uniqueStrings(policy.allowedCapabilities, CAPABILITY_ID, 'INVALID_MANDATE_CAPABILITIES');
  if (allowedCapabilities.length === 0) throw new Error('MANDATE_CAPABILITY_REQUIRED');
  const allowedNetworks = networks(policy.allowedNetworks);
  const assetScope = policy.assetScope;
  const protocolScope = policy.protocolScope;
  const destinationScope = policy.destinationScope;
  if (!['ANY','ALLOW_LIST'].includes(assetScope) || !['ANY','ALLOW_LIST'].includes(protocolScope) || !['ANY','ALLOW_LIST'].includes(destinationScope)) throw new Error('INVALID_MANDATE_SCOPE');
  const allowedAssets = uniqueStrings(policy.allowedAssets, ASSET_OR_PROTOCOL, 'INVALID_MANDATE_ASSETS', true);
  const allowedProtocols = uniqueStrings(policy.allowedProtocols, ASSET_OR_PROTOCOL, 'INVALID_MANDATE_PROTOCOLS');
  const allowedDestinations = uniqueStrings(policy.allowedDestinations, DESTINATION, 'INVALID_MANDATE_DESTINATIONS');
  if (requireActivationReady && authorityLevel === 'ACT_WITHIN_MANDATE' && (assetScope !== 'ALLOW_LIST' || allowedAssets.length === 0)) throw new Error('ACT_MANDATE_ASSET_ALLOWLIST_REQUIRED');
  if (accountMode && authorityLevel === 'ACT_WITHIN_MANDATE' && accountMode !== 'agent-account') throw new Error('ACT_MANDATE_REQUIRES_AGENT_ACCOUNT');

  const capitalLimitUsd = decimal(policy.capitalLimitUsd, 'INVALID_CAPITAL_LIMIT');
  const perActionLimitUsd = decimal(policy.perActionLimitUsd, 'INVALID_PER_ACTION_LIMIT');
  const periodBudget = policy.periodBudget ? { limitUsd: decimal(policy.periodBudget.limitUsd, 'INVALID_PERIOD_BUDGET')!, period: policy.periodBudget.period } : undefined;
  const serviceBudget = policy.serviceBudget ? { limitUsd: decimal(policy.serviceBudget.limitUsd, 'INVALID_SERVICE_BUDGET')!, period: policy.serviceBudget.period } : undefined;
  if (periodBudget && !['day','week','month'].includes(periodBudget.period)) throw new Error('INVALID_PERIOD_BUDGET');
  if (serviceBudget && !['day','week','month'].includes(serviceBudget.period)) throw new Error('INVALID_SERVICE_BUDGET');
  if (requireActivationReady && authorityLevel === 'ACT_WITHIN_MANDATE' && (!perActionLimitUsd || !periodBudget)) throw new Error('ACT_MANDATE_HARD_LIMITS_REQUIRED');

  const approvalPolicy: ApprovalPolicy = {
    mode: policy.approvalPolicy.mode,
    askForNewProtocols: Boolean(policy.approvalPolicy.askForNewProtocols),
    askForNewDestinations: Boolean(policy.approvalPolicy.askForNewDestinations),
  };
  if (!['ALWAYS','THRESHOLD','WITHIN_LIMITS'].includes(approvalPolicy.mode)) throw new Error('INVALID_APPROVAL_POLICY');
  if (approvalPolicy.mode === 'THRESHOLD') {
    const thresholdUsd = decimal(policy.approvalPolicy.thresholdUsd, 'INVALID_APPROVAL_THRESHOLD');
    if (!thresholdUsd) throw new Error('INVALID_APPROVAL_THRESHOLD');
    approvalPolicy.thresholdUsd = thresholdUsd;
  }

  const validFromDate = policy.validFrom ? new Date(policy.validFrom) : new Date();
  if (Number.isNaN(validFromDate.getTime())) throw new Error('INVALID_MANDATE_VALIDITY');
  const validUntilDate = policy.validUntil ? new Date(policy.validUntil) : undefined;
  if (validUntilDate && (Number.isNaN(validUntilDate.getTime()) || validUntilDate <= validFromDate)) throw new Error('INVALID_MANDATE_VALIDITY');
  if (requireActivationReady && validUntilDate && validUntilDate <= new Date()) throw new Error('MANDATE_EXPIRED');
  if (requireActivationReady && authorityLevel === 'ACT_WITHIN_MANDATE' && !validUntilDate) throw new Error('ACT_MANDATE_EXPIRY_REQUIRED');

  const out: MandatePolicyInput = {
    title: text(policy.title, 160, 'INVALID_MANDATE_TITLE'),
    purpose: text(policy.purpose, 2000, 'INVALID_MANDATE_PURPOSE'),
    authorityLevel,
    allowedCapabilities,
    allowedNetworks,
    assetScope,
    allowedAssets,
    protocolScope,
    allowedProtocols,
    destinationScope,
    allowedDestinations,
    approvalPolicy,
    borrowingAllowed: Boolean(policy.borrowingAllowed),
    leverageAllowed: Boolean(policy.leverageAllowed),
    validFrom: validFromDate.toISOString(),
    changeSummary: text(policy.changeSummary, 500, 'INVALID_MANDATE_CHANGE_SUMMARY'),
  };
  if (capitalLimitUsd) out.capitalLimitUsd = capitalLimitUsd;
  if (perActionLimitUsd) out.perActionLimitUsd = perActionLimitUsd;
  if (periodBudget) out.periodBudget = periodBudget;
  if (serviceBudget) out.serviceBudget = serviceBudget;
  if (validUntilDate) out.validUntil = validUntilDate.toISOString();
  return out;
}

async function validateMandateReferences(db: SqlExecutor, ownerUserId: string, workerId: string, accountId: string, policy: MandatePolicyInput): Promise<WalletMode> {
  const worker = await db.query<{ id: string }>(`SELECT uw.id FROM user_worker uw WHERE uw.owner_user_id=$1 AND uw.id=$2 AND uw.status<>'removed'`, [ownerUserId, workerId]);
  if (!worker.rows[0]) throw new Error('MANDATE_WORKER_NOT_OWNED');
  const account = await db.query<{ mode: WalletMode; status: string }>(`SELECT mode,status FROM wallet_resource WHERE owner_user_id=$1 AND id=$2 AND removed_at IS NULL`, [ownerUserId, accountId]);
  const mode = account.rows[0]?.mode;
  if (!mode) throw new Error('MANDATE_ACCOUNT_NOT_OWNED');
  if (account.rows[0]?.status === 'removed') throw new Error('MANDATE_ACCOUNT_NOT_AVAILABLE');
  if (policy.authorityLevel === 'ACT_WITHIN_MANDATE' && mode !== 'agent-account') throw new Error('ACT_MANDATE_REQUIRES_AGENT_ACCOUNT');
  const capabilities = await db.query<{ id: string }>(`SELECT id FROM canonical_capability WHERE id=ANY($1::text[])`, [policy.allowedCapabilities]);
  if (new Set(capabilities.rows.map((row) => row.id)).size !== new Set(policy.allowedCapabilities).size) throw new Error('UNKNOWN_MANDATE_CAPABILITY');
  return mode;
}

async function insertRevision(db: SqlExecutor, ownerUserId: string, mandateId: string, revision: number, policy: MandatePolicyInput): Promise<void> {
  await db.query(`INSERT INTO mandate_revision(
    mandate_id,owner_user_id,revision,title,purpose,authority_level,allowed_capabilities,allowed_networks,asset_scope,allowed_assets,
    protocol_scope,allowed_protocols,destination_scope,allowed_destinations,capital_limit_usd,per_action_limit_usd,
    period_budget_limit_usd,period_budget_period,service_budget_limit_usd,service_budget_period,approval_policy,
    borrowing_allowed,leverage_allowed,valid_from,valid_until,change_summary)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb,$11,$12::jsonb,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23,$24,$25,$26)`, [
    mandateId, ownerUserId, revision, policy.title, policy.purpose, policy.authorityLevel,
    JSON.stringify(policy.allowedCapabilities), JSON.stringify(policy.allowedNetworks), policy.assetScope, JSON.stringify(policy.allowedAssets),
    policy.protocolScope, JSON.stringify(policy.allowedProtocols), policy.destinationScope, JSON.stringify(policy.allowedDestinations),
    policy.capitalLimitUsd ?? null, policy.perActionLimitUsd ?? null, policy.periodBudget?.limitUsd ?? null, policy.periodBudget?.period ?? null,
    policy.serviceBudget?.limitUsd ?? null, policy.serviceBudget?.period ?? null, JSON.stringify(policy.approvalPolicy),
    policy.borrowingAllowed, policy.leverageAllowed, policy.validFrom ?? new Date().toISOString(), policy.validUntil ?? null, policy.changeSummary,
  ]);
}

async function recordDomainEvent(db: SqlExecutor, args: { ownerUserId: string; eventType: string; objectType: string; objectId: string; title: string; summary: string; effect?: string; status: string; workerId?: string; metadata?: Record<string, unknown> }): Promise<void> {
  await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,worker_id,origin_type,metadata)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'user',$11::jsonb)`, [
    `evt_${randomUUID()}`, args.ownerUserId, args.eventType, args.objectType, args.objectId, args.title, args.summary,
    args.effect ?? null, args.status, args.workerId ?? null, JSON.stringify(args.metadata ?? {}),
  ]);
}

export async function expireMandates(ownerUserId: string): Promise<void> {
  await withTransaction(async (db) => {
    const expired = await db.query<{ id: string; worker_id: string; current_revision: number; title: string }>(`SELECT m.id,m.worker_id,m.current_revision,r.title
      FROM mandate m JOIN mandate_revision r ON r.mandate_id=m.id AND r.owner_user_id=m.owner_user_id AND r.revision=m.current_revision
      WHERE m.owner_user_id=$1 AND m.status IN ('ACTIVE','PAUSED') AND r.valid_until IS NOT NULL AND r.valid_until<=now()
      FOR UPDATE OF m`, [ownerUserId]);
    for (const row of expired.rows) {
      await db.query(`UPDATE mandate SET status='EXPIRED',expired_at=COALESCE(expired_at,now()),updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, row.id]);
      await recordDomainEvent(db, {
        ownerUserId, eventType: 'mandate.expired', objectType: 'mandate', objectId: row.id,
        title: 'Authority mandate expired', summary: `${row.title} · Standing authority is no longer usable.`,
        effect: 'Expiration fails closed. A new or revised mandate must be deliberately activated before authority can be used again.',
        status: 'expired', workerId: row.worker_id, metadata: { mandateId: row.id, revision: row.current_revision },
      });
    }
  });
}

export async function listMandates(ownerUserId: string): Promise<DurableMandate[]> {
  await expireMandates(ownerUserId);
  const result = await getDatabasePool().query<MandateRow>(`${mandateSelect} WHERE m.owner_user_id=$1 ORDER BY m.updated_at DESC,m.id`, [ownerUserId]);
  return result.rows.map(mapMandate);
}

export async function getMandate(ownerUserId: string, mandateId: string): Promise<DurableMandate | null> {
  await expireMandates(ownerUserId);
  const result = await getDatabasePool().query<MandateRow>(`${mandateSelect} WHERE m.owner_user_id=$1 AND m.id=$2`, [ownerUserId, mandateId]);
  return result.rows[0] ? mapMandate(result.rows[0]) : null;
}

export async function createMandate(ownerUserId: string, input: CreateMandateInput): Promise<DurableMandate> {
  const id = input.id ? text(input.id, 128, 'INVALID_MANDATE_ID') : `mnd_${randomUUID()}`;
  const workerId = text(input.workerId, 128, 'INVALID_MANDATE_WORKER');
  const accountId = text(input.accountId, 160, 'INVALID_MANDATE_ACCOUNT');
  if (input.environment !== 'mainnet' && input.environment !== 'testnet') throw new Error('INVALID_MANDATE_ENVIRONMENT');
  const requestedStatus = input.status ?? 'DRAFT';
  if (requestedStatus !== 'DRAFT' && requestedStatus !== 'ACTIVE') throw new Error('INVALID_MANDATE_STATUS');

  await withTransaction(async (db) => {
    const mode = await validateMandateReferences(db, ownerUserId, workerId, accountId, input.policy);
    const policy = normalizePolicy(input.policy, mode, requestedStatus === 'ACTIVE');
    await db.query(`INSERT INTO mandate(id,owner_user_id,worker_id,account_id,environment,status,current_revision,activated_at)
      VALUES($1,$2,$3,$4,$5,'DRAFT',1,NULL)`, [id, ownerUserId, workerId, accountId, input.environment]);
    await insertRevision(db, ownerUserId, id, 1, policy);
    if (requestedStatus === 'ACTIVE') {
      await db.query(`UPDATE mandate SET status='ACTIVE',activated_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, id]);
    }
    await recordDomainEvent(db, {
      ownerUserId, eventType: requestedStatus === 'ACTIVE' ? 'mandate.activated' : 'mandate.created', objectType: 'mandate', objectId: id,
      title: requestedStatus === 'ACTIVE' ? 'Authority mandate activated' : 'Authority mandate drafted',
      summary: `${policy.title} · ${policy.authorityLevel.replaceAll('_', ' ')}`,
      effect: requestedStatus === 'ACTIVE' ? 'Standing authority is now governed by this structured mandate.' : 'Draft only · No standing authority granted yet.',
      status: requestedStatus.toLowerCase(), workerId, metadata: { mandateId: id, revision: 1, accountId, environment: input.environment },
    });
  });
  const created = await getMandate(ownerUserId, id);
  if (!created) throw new Error('MANDATE_CREATE_FAILED');
  return created;
}

export async function reviseMandate(ownerUserId: string, mandateId: string, expectedRevision: number, policyInput: MandatePolicyInput): Promise<DurableMandate | null> {
  await withTransaction(async (db) => {
    const current = await db.query<{ worker_id: string; account_id: string; status: MandateStatus; current_revision: number }>(`SELECT worker_id,account_id,status,current_revision FROM mandate WHERE owner_user_id=$1 AND id=$2 FOR UPDATE`, [ownerUserId, mandateId]);
    const row = current.rows[0];
    if (!row) return;
    if (row.status === 'REVOKED') throw new Error('REVOKED_MANDATE_CANNOT_RESURRECT');
    if (row.current_revision !== expectedRevision) throw new Error('MANDATE_REVISION_CONFLICT');
    const mode = await validateMandateReferences(db, ownerUserId, row.worker_id, row.account_id, policyInput);
    const policy = normalizePolicy(policyInput, mode, row.status === 'ACTIVE' || row.status === 'PAUSED');
    const nextRevision = row.current_revision + 1;
    await insertRevision(db, ownerUserId, mandateId, nextRevision, policy);
    const nextStatus: MandateStatus = row.status === 'EXPIRED' ? 'DRAFT' : row.status;
    await db.query(`UPDATE mandate SET current_revision=$3,status=$4,expired_at=CASE WHEN $4='DRAFT' THEN NULL ELSE expired_at END,updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, mandateId, nextRevision, nextStatus]);
    await recordDomainEvent(db, {
      ownerUserId, eventType: 'mandate.revised', objectType: 'mandate', objectId: mandateId,
      title: 'Authority mandate updated', summary: `${policy.title} · Revision ${nextRevision}`,
      effect: policy.changeSummary, status: nextStatus.toLowerCase(), workerId: row.worker_id,
      metadata: { mandateId, previousRevision: row.current_revision, revision: nextRevision },
    });
  });
  return getMandate(ownerUserId, mandateId);
}

export async function setMandateStatus(ownerUserId: string, mandateId: string, nextStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED'): Promise<DurableMandate | null> {
  await expireMandates(ownerUserId);
  await withTransaction(async (db) => {
    const current = await db.query<{ status: MandateStatus; worker_id: string; current_revision: number; valid_until: Date | null; authority_level: AuthorityLevel; asset_scope: PolicyScope; allowed_assets: unknown; per_action_limit_usd: string | null; period_budget_limit_usd: string | null; period_budget_period: BudgetPeriod | null; account_mode: WalletMode }>(`SELECT m.status,m.worker_id,m.current_revision,r.valid_until,r.authority_level,r.asset_scope,r.allowed_assets,r.per_action_limit_usd::text,r.period_budget_limit_usd::text,r.period_budget_period,w.mode AS account_mode
      FROM mandate m JOIN mandate_revision r ON r.mandate_id=m.id AND r.owner_user_id=m.owner_user_id AND r.revision=m.current_revision
      JOIN wallet_resource w ON w.id=m.account_id AND w.owner_user_id=m.owner_user_id
      WHERE m.owner_user_id=$1 AND m.id=$2 FOR UPDATE OF m`, [ownerUserId, mandateId]);
    const row = current.rows[0];
    if (!row) return;
    if (row.status === 'REVOKED') throw new Error('REVOKED_MANDATE_CANNOT_RESURRECT');
    if (row.valid_until && row.valid_until <= new Date()) throw new Error('MANDATE_EXPIRED');
    if (nextStatus === 'ACTIVE' && row.authority_level === 'ACT_WITHIN_MANDATE') {
      if (row.account_mode !== 'agent-account') throw new Error('ACT_MANDATE_REQUIRES_AGENT_ACCOUNT');
      if (row.asset_scope !== 'ALLOW_LIST' || asStringArray(row.allowed_assets).length === 0) throw new Error('ACT_MANDATE_ASSET_ALLOWLIST_REQUIRED');
      if (!row.per_action_limit_usd || !row.period_budget_limit_usd || !row.period_budget_period) throw new Error('ACT_MANDATE_HARD_LIMITS_REQUIRED');
      if (!row.valid_until) throw new Error('ACT_MANDATE_EXPIRY_REQUIRED');
    }
    const allowed = (row.status === 'DRAFT' && nextStatus === 'ACTIVE')
      || (row.status === 'ACTIVE' && (nextStatus === 'PAUSED' || nextStatus === 'REVOKED'))
      || (row.status === 'PAUSED' && (nextStatus === 'ACTIVE' || nextStatus === 'REVOKED'))
      || (row.status === 'EXPIRED' && nextStatus === 'REVOKED');
    if (!allowed) throw new Error('INVALID_MANDATE_STATUS_TRANSITION');
    await db.query(`UPDATE mandate SET status=$3,updated_at=now(),
      activated_at=CASE WHEN $3='ACTIVE' THEN COALESCE(activated_at,now()) ELSE activated_at END,
      paused_at=CASE WHEN $3='PAUSED' THEN now() ELSE paused_at END,
      revoked_at=CASE WHEN $3='REVOKED' THEN now() ELSE revoked_at END
      WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, mandateId, nextStatus]);
    await recordDomainEvent(db, {
      ownerUserId, eventType: nextStatus === 'ACTIVE' ? 'mandate.activated' : nextStatus === 'PAUSED' ? 'mandate.paused' : 'mandate.revoked',
      objectType: 'mandate', objectId: mandateId,
      title: nextStatus === 'ACTIVE' ? 'Authority mandate activated' : nextStatus === 'PAUSED' ? 'Authority mandate paused' : 'Authority mandate revoked',
      summary: nextStatus === 'ACTIVE' ? 'Standing authority can be evaluated again.' : nextStatus === 'PAUSED' ? 'Standing authority is immediately unusable until resumed.' : 'Standing authority is permanently unusable. A new mandate is required to delegate again.',
      ...(nextStatus === 'REVOKED' ? { effect: 'Revoked authority cannot silently return.' } : {}),
      status: nextStatus.toLowerCase(), workerId: row.worker_id, metadata: { mandateId, revision: row.current_revision },
    });
  });
  return getMandate(ownerUserId, mandateId);
}

export async function revokeAllMandates(ownerUserId: string, environment?: AuthorityEnvironment): Promise<number> {
  let revokedCount = 0;
  await withTransaction(async (db) => {
    const rows = await db.query<{ id: string; worker_id: string; current_revision: number }>(`SELECT id,worker_id,current_revision FROM mandate
      WHERE owner_user_id=$1 AND status IN ('ACTIVE','PAUSED') AND ($2::text IS NULL OR environment=$2) FOR UPDATE`, [ownerUserId, environment ?? null]);
    for (const row of rows.rows) {
      await db.query(`UPDATE mandate SET status='REVOKED',revoked_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, row.id]);
      await recordDomainEvent(db, {
        ownerUserId, eventType: 'mandate.revoked', objectType: 'mandate', objectId: row.id,
        title: 'Authority mandate revoked', summary: 'Revoked by global authority control.',
        effect: 'Revoked authority cannot silently return.', status: 'revoked', workerId: row.worker_id,
        metadata: { mandateId: row.id, revision: row.current_revision, globalRevoke: true, ...(environment ? { environment } : {}) },
      });
      revokedCount += 1;
    }
    await recordDomainEvent(db, {
      ownerUserId, eventType: 'authority.revoke_all', objectType: 'authority-control', objectId: environment ?? 'all',
      title: 'AgentPlace authority revoked',
      summary: environment ? `${environment === 'mainnet' ? 'Mainnet' : 'Testnet'} · ${revokedCount} mandate${revokedCount === 1 ? '' : 's'} revoked` : `${revokedCount} mandate${revokedCount === 1 ? '' : 's'} revoked across environments`,
      effect: 'Monitoring and research may continue, but revoked standing financial authority cannot be reused.', status: 'revoked', metadata: { environment: environment ?? 'all', revokedCount },
    });
  });
  return revokedCount;
}

export async function listMandateRevisions(ownerUserId: string, mandateId: string): Promise<DurableMandateRevision[]> {
  const rows = await getDatabasePool().query<Omit<MandateRow, 'worker_id'|'worker_name'|'account_id'|'account_name'|'account_mode'|'agent_account_id'|'environment'|'status'|'current_revision'|'created_at'|'updated_at'|'activated_at'|'paused_at'|'expired_at'|'revoked_at'> & { revision_created_at: Date }>(`SELECT
    r.revision,r.title,r.purpose,r.authority_level,r.allowed_capabilities,r.allowed_networks,r.asset_scope,r.allowed_assets,r.protocol_scope,r.allowed_protocols,
    r.destination_scope,r.allowed_destinations,r.capital_limit_usd,r.per_action_limit_usd,r.period_budget_limit_usd,r.period_budget_period,
    r.service_budget_limit_usd,r.service_budget_period,r.approval_policy,r.borrowing_allowed,r.leverage_allowed,r.valid_from,r.valid_until,r.change_summary,
    r.created_at AS revision_created_at
    FROM mandate_revision r JOIN mandate m ON m.id=r.mandate_id AND m.owner_user_id=r.owner_user_id
    WHERE r.owner_user_id=$1 AND r.mandate_id=$2 ORDER BY r.revision DESC`, [ownerUserId, mandateId]);
  return rows.rows.map((row) => mapRevision(row as MandateRow));
}

function periodStart(period: BudgetPeriod, now: Date): Date {
  const date = new Date(now);
  if (period === 'day') {
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
  if (period === 'week') {
    const day = date.getUTCDay();
    const offset = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - offset);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function reason(code: string, message: string, extra?: Pick<AuthorityReason, 'field' | 'expected' | 'actual'>): AuthorityReason {
  return { code, message, ...(extra ?? {}) };
}

function matchesNetwork(allowed: readonly NetworkPolicyRef[], actual: NetworkPolicyRef): boolean {
  const family = actual.family.trim().toLowerCase();
  const networkId = actual.networkId.trim().toLowerCase();
  return allowed.some((item) => item.family.toLowerCase() === family && item.networkId.toLowerCase() === networkId);
}

function normalizedMembership(values: readonly string[], actual: string | undefined, uppercase = false): boolean {
  if (!actual) return false;
  const normalized = uppercase ? actual.trim().toUpperCase() : actual.trim().toLowerCase();
  return values.some((value) => (uppercase ? value.toUpperCase() : value.toLowerCase()) === normalized);
}

export function evaluateAuthorityPolicy(input: PureEvaluationInput): AuthorityPolicyEvaluation {
  const now = input.now ?? new Date();
  const deny = (r: AuthorityReason): AuthorityPolicyEvaluation => ({ decision: 'DENIED', reasons: [r], periodSpentBeforeUsd: canonicalDecimal(input.periodSpentUsd) });
  const mandate = input.mandate;
  if (!mandate) return deny(reason('NO_MANDATE', 'No mandate grants this Worker authority over the selected account.'));
  if (mandate.workerId !== input.envelope.workerId || mandate.accountId !== input.envelope.accountId || mandate.environment !== input.envelope.environment) {
    return deny(reason('MANDATE_SCOPE_MISMATCH', 'The mandate does not belong to this Worker, account and environment.'));
  }
  if (mandate.status === 'DRAFT') return deny(reason('MANDATE_NOT_ACTIVE', 'The mandate is still a draft.'));
  if (mandate.status === 'PAUSED') return deny(reason('MANDATE_PAUSED', 'The mandate is paused and immediately unusable.'));
  if (mandate.status === 'REVOKED') return deny(reason('MANDATE_REVOKED', 'The mandate has been revoked and cannot be used.'));
  if (mandate.status === 'EXPIRED' || (mandate.validUntil && new Date(mandate.validUntil) <= now)) return deny(reason('MANDATE_EXPIRED', 'The mandate has expired.'));
  if (new Date(mandate.validFrom) > now) return deny(reason('MANDATE_NOT_YET_VALID', 'The mandate validity window has not started.'));
  if (!input.capabilityKnown) return deny(reason('UNKNOWN_CAPABILITY', 'The requested canonical capability is unknown to AgentPlace.'));
  if (!mandate.allowedCapabilities.includes(input.envelope.capabilityId)) return deny(reason('CAPABILITY_NOT_ALLOWED', 'This capability is outside the mandate.', { field: 'capability', actual: input.envelope.capabilityId }));
  if (!matchesNetwork(mandate.allowedNetworks, input.envelope.network)) return deny(reason('NETWORK_NOT_ALLOWED', 'This network is outside the mandate.', { field: 'network', actual: `${input.envelope.network.family}:${input.envelope.network.networkId}` }));

  if (mandate.assetScope === 'ALLOW_LIST' && (
    (Boolean(input.envelope.asset) && !normalizedMembership(mandate.allowedAssets, input.envelope.asset, true))
    || (input.envelope.operation === 'EXECUTE' && mandate.allowedAssets.length > 0 && !input.envelope.asset)
  )) {
    return deny(reason('ASSET_NOT_ALLOWED', input.envelope.asset ? 'This asset is outside the mandate.' : 'The financial action requires a known allowed asset.', { field: 'asset', actual: input.envelope.asset ?? 'missing' }));
  }
  if (mandate.protocolScope === 'ALLOW_LIST' && (
    (Boolean(input.envelope.protocol) && !normalizedMembership(mandate.allowedProtocols, input.envelope.protocol))
    || (input.envelope.operation === 'EXECUTE' && mandate.allowedProtocols.length > 0 && !input.envelope.protocol)
  )) {
    return deny(reason('PROTOCOL_NOT_ALLOWED', input.envelope.protocol ? 'This protocol is outside the mandate.' : 'The financial action requires a known allowed protocol.', { field: 'protocol', actual: input.envelope.protocol ?? 'missing' }));
  }
  if (mandate.destinationScope === 'ALLOW_LIST' && (
    (Boolean(input.envelope.destination) && !normalizedMembership(mandate.allowedDestinations, input.envelope.destination))
    || (input.envelope.operation === 'EXECUTE' && mandate.allowedDestinations.length > 0 && !input.envelope.destination)
  )) {
    return deny(reason('DESTINATION_NOT_ALLOWED', input.envelope.destination ? 'This destination is outside the mandate.' : 'The financial action requires a known allowed destination.', { field: 'destination', actual: input.envelope.destination ?? 'missing' }));
  }
  if (input.envelope.borrowing && !mandate.borrowingAllowed) return deny(reason('BORROWING_NOT_ALLOWED', 'Borrowing is prohibited by this mandate.'));
  if (input.envelope.leverageMultiplier && greaterThan(input.envelope.leverageMultiplier, '1') && !mandate.leverageAllowed) return deny(reason('LEVERAGE_NOT_ALLOWED', 'Leverage is prohibited by this mandate.'));

  if (input.envelope.operation === 'OBSERVE' && input.capabilityEffect && input.capabilityEffect !== 'read') {
    return deny(reason('CAPABILITY_OPERATION_MISMATCH', 'A write capability cannot be treated as a read-only observation.'));
  }
  if (input.envelope.operation === 'EXECUTE' && input.capabilityEffect === 'read') {
    return deny(reason('CAPABILITY_NOT_EXECUTABLE', 'A read-only capability cannot be treated as financial execution.'));
  }
  if (mandate.authorityLevel === 'OBSERVE' && input.envelope.operation !== 'OBSERVE') return deny(reason('OBSERVE_ONLY', 'This mandate permits observation only.'));
  if (input.envelope.operation === 'EXECUTE' && input.accountMode === 'watch-only') return deny(reason('WATCH_ONLY_CANNOT_EXECUTE', 'Watch-only accounts can never execute financial actions.'));

  const requiresValue = input.envelope.operation === 'EXECUTE';
  const valueUsd = input.envelope.valueUsd ? canonicalDecimal(input.envelope.valueUsd) : undefined;
  if (requiresValue && !valueUsd) return deny(reason('VALUE_REQUIRED', 'Financial execution requires a deterministic value-at-risk amount.'));
  if (valueUsd && mandate.capitalLimitUsd && greaterThan(valueUsd, mandate.capitalLimitUsd)) return deny(reason('CAPITAL_AUTHORITY_EXCEEDED', 'The action exceeds the capital authority ceiling.', { field: 'valueUsd', expected: `<= ${mandate.capitalLimitUsd}`, actual: valueUsd }));
  if (valueUsd && mandate.perActionLimitUsd && greaterThan(valueUsd, mandate.perActionLimitUsd)) return deny(reason('PER_ACTION_LIMIT_EXCEEDED', 'The action exceeds the hard per-action limit.', { field: 'valueUsd', expected: `<= ${mandate.perActionLimitUsd}`, actual: valueUsd }));
  if (valueUsd && mandate.periodBudget) {
    const after = addDecimal(input.periodSpentUsd, valueUsd);
    if (greaterThan(after, mandate.periodBudget.limitUsd)) return deny(reason('PERIOD_BUDGET_EXCEEDED', `The ${mandate.periodBudget.period} period budget would be exceeded.`, { field: 'periodBudget', expected: `<= ${mandate.periodBudget.limitUsd}`, actual: after }));
  }

  const approvals: AuthorityReason[] = [];
  if (input.envelope.operation === 'EXECUTE') {
    if (mandate.authorityLevel === 'PREPARE') approvals.push(reason('PREPARE_REQUIRES_APPROVAL', 'This mandate may prepare the action, but execution still requires human approval.'));
    if (input.accountMode === 'connected') approvals.push(reason('CONNECTED_WALLET_REQUIRES_SIGNATURE', 'Connected Wallet actions require the user to approve and sign.'));
    if (input.globalAutonomyPaused) approvals.push(reason('AUTONOMY_PAUSED', 'Autonomous execution is globally paused; human approval is required.'));
    if (input.envelope.environment === 'mainnet' && !input.mainnetAutonomyEnabled) approvals.push(reason('MAINNET_AUTONOMY_GATED', 'Mainnet autonomy is disabled by the production safety gate.'));
    if (mandate.approvalPolicy.mode === 'ALWAYS') approvals.push(reason('APPROVAL_POLICY_ALWAYS', 'This mandate is configured to always ask before execution.'));
    if (mandate.approvalPolicy.mode === 'THRESHOLD' && mandate.approvalPolicy.thresholdUsd && valueUsd && greaterThan(valueUsd, mandate.approvalPolicy.thresholdUsd)) approvals.push(reason('APPROVAL_THRESHOLD_EXCEEDED', 'The action is above the autonomous approval threshold.', { field: 'valueUsd', expected: `<= ${mandate.approvalPolicy.thresholdUsd} without asking`, actual: valueUsd }));
    if (mandate.protocolScope === 'ANY' && mandate.approvalPolicy.askForNewProtocols && input.envelope.protocol && !normalizedMembership(mandate.allowedProtocols, input.envelope.protocol)) approvals.push(reason('NEW_PROTOCOL_REQUIRES_APPROVAL', 'This protocol is not in the pre-approved protocol list.'));
    if (mandate.destinationScope === 'ANY' && mandate.approvalPolicy.askForNewDestinations && input.envelope.destination && !normalizedMembership(mandate.allowedDestinations, input.envelope.destination)) approvals.push(reason('NEW_DESTINATION_REQUIRES_APPROVAL', 'This destination is not in the pre-approved destination list.'));
  }

  if (approvals.length > 0) return { decision: 'APPROVAL_REQUIRED', reasons: approvals, periodSpentBeforeUsd: canonicalDecimal(input.periodSpentUsd) };
  return { decision: 'ALLOWED', reasons: [reason('WITHIN_MANDATE', 'The proposed action is inside the active deterministic mandate.')], periodSpentBeforeUsd: canonicalDecimal(input.periodSpentUsd) };
}

function normalizeEnvelope(raw: ActionEnvelope): ActionEnvelope {
  const workerId = text(raw.workerId, 128, 'INVALID_AUTHORITY_ENVELOPE');
  const accountId = text(raw.accountId, 160, 'INVALID_AUTHORITY_ENVELOPE');
  const capabilityId = text(raw.capabilityId, 128, 'INVALID_AUTHORITY_ENVELOPE').toLowerCase();
  if (!CAPABILITY_ID.test(capabilityId)) throw new Error('INVALID_AUTHORITY_ENVELOPE');
  if (!['OBSERVE','PREPARE','EXECUTE'].includes(raw.operation)) throw new Error('INVALID_AUTHORITY_ENVELOPE');
  if (raw.environment !== 'mainnet' && raw.environment !== 'testnet') throw new Error('INVALID_AUTHORITY_ENVELOPE');
  const network = networks([raw.network])[0]!;
  const envelope: ActionEnvelope = { workerId, accountId, capabilityId, operation: raw.operation, environment: raw.environment, network };
  if (raw.asset !== undefined) envelope.asset = uniqueStrings([raw.asset], ASSET_OR_PROTOCOL, 'INVALID_AUTHORITY_ENVELOPE', true)[0]!;
  if (raw.protocol !== undefined) envelope.protocol = uniqueStrings([raw.protocol], ASSET_OR_PROTOCOL, 'INVALID_AUTHORITY_ENVELOPE')[0]!;
  if (raw.destination !== undefined) envelope.destination = uniqueStrings([raw.destination], DESTINATION, 'INVALID_AUTHORITY_ENVELOPE')[0]!;
  if (raw.valueUsd !== undefined) envelope.valueUsd = decimal(raw.valueUsd, 'INVALID_AUTHORITY_VALUE')!;
  if (raw.borrowing !== undefined) envelope.borrowing = Boolean(raw.borrowing);
  if (raw.leverageMultiplier !== undefined) envelope.leverageMultiplier = decimal(raw.leverageMultiplier, 'INVALID_AUTHORITY_LEVERAGE')!;
  if (raw.reason !== undefined) envelope.reason = text(raw.reason, 1000, 'INVALID_AUTHORITY_ENVELOPE');
  if (raw.jobId !== undefined) envelope.jobId = text(raw.jobId, 128, 'INVALID_AUTHORITY_ENVELOPE');
  return envelope;
}

function toSnapshot(mandate: DurableMandate): MandatePolicySnapshot {
  return {
    ...mandate.revision,
    mandateId: mandate.id,
    workerId: mandate.workerId,
    accountId: mandate.accountId,
    environment: mandate.environment,
    status: mandate.status,
  };
}

export async function getAuthorityControlState(ownerUserId: string): Promise<AuthorityControlState> {
  const result = await getDatabasePool().query<{ environment: AuthorityEnvironment; autonomous_execution_paused: boolean }>(`SELECT environment,autonomous_execution_paused FROM authority_control_state WHERE owner_user_id=$1`, [ownerUserId]);
  return {
    mainnetPaused: result.rows.find((row) => row.environment === 'mainnet')?.autonomous_execution_paused ?? false,
    testnetPaused: result.rows.find((row) => row.environment === 'testnet')?.autonomous_execution_paused ?? false,
  };
}

export async function setAutonomousExecutionPaused(ownerUserId: string, environment: AuthorityEnvironment, paused: boolean): Promise<AuthorityControlState> {
  await withTransaction(async (db) => {
    await db.query(`INSERT INTO authority_control_state(owner_user_id,environment,autonomous_execution_paused,updated_at) VALUES($1,$2,$3,now())
      ON CONFLICT(owner_user_id,environment) DO UPDATE SET autonomous_execution_paused=EXCLUDED.autonomous_execution_paused,updated_at=now()`, [ownerUserId, environment, paused]);
    await recordDomainEvent(db, {
      ownerUserId, eventType: paused ? 'authority.autonomy.paused' : 'authority.autonomy.resumed', objectType: 'authority-control', objectId: environment,
      title: paused ? 'Autonomous execution paused' : 'Autonomous execution resumed',
      summary: `${environment === 'mainnet' ? 'Mainnet' : 'Testnet'} · Standing mandates preserved`,
      effect: paused ? 'New autonomous financial actions require human approval while paused.' : 'Still-valid mandates can be evaluated again.',
      status: paused ? 'paused' : 'active', metadata: { environment, paused },
    });
  });
  return getAuthorityControlState(ownerUserId);
}

export async function evaluateAuthority(ownerUserId: string, rawEnvelope: ActionEnvelope, options: { mainnetAutonomyEnabled: boolean }): Promise<DurableAuthorityDecision> {
  const envelope = normalizeEnvelope(rawEnvelope);
  await expireMandates(ownerUserId);
  const [mandates, capability, account, controls] = await Promise.all([
    getDatabasePool().query<{ id: string }>(`SELECT id FROM mandate WHERE owner_user_id=$1 AND worker_id=$2 AND account_id=$3 AND environment=$4 ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 WHEN 'EXPIRED' THEN 2 WHEN 'DRAFT' THEN 3 ELSE 4 END,updated_at DESC LIMIT 1`, [ownerUserId, envelope.workerId, envelope.accountId, envelope.environment]),
    getDatabasePool().query<{ effect: CapabilityEffect }>(`SELECT effect FROM canonical_capability WHERE id=$1`, [envelope.capabilityId]),
    getDatabasePool().query<{ mode: WalletMode }>(`SELECT mode FROM wallet_resource WHERE owner_user_id=$1 AND id=$2 AND removed_at IS NULL`, [ownerUserId, envelope.accountId]),
    getAuthorityControlState(ownerUserId),
  ]);
  const mandateId = mandates.rows[0]?.id;
  const mandate = mandateId ? await getMandate(ownerUserId, mandateId) : null;
  let periodSpentUsd = '0';
  if (mandate?.revision.periodBudget) {
    const start = periodStart(mandate.revision.periodBudget.period, new Date());
    const spent = await getDatabasePool().query<{ total: string }>(`SELECT COALESCE(sum(value_usd),0)::text AS total FROM authority_budget_usage WHERE owner_user_id=$1 AND mandate_id=$2 AND occurred_at >= $3`, [ownerUserId, mandate.id, start.toISOString()]);
    periodSpentUsd = canonicalDecimal(spent.rows[0]?.total ?? '0');
  }
  const evaluation = evaluateAuthorityPolicy({
    mandate: mandate ? toSnapshot(mandate) : null,
    envelope,
    capabilityKnown: Boolean(capability.rows[0]),
    ...(capability.rows[0] ? { capabilityEffect: capability.rows[0].effect } : {}),
    ...(account.rows[0] ? { accountMode: account.rows[0].mode } : {}),
    globalAutonomyPaused: envelope.environment === 'mainnet' ? controls.mainnetPaused : controls.testnetPaused,
    mainnetAutonomyEnabled: options.mainnetAutonomyEnabled,
    periodSpentUsd,
  });
  const id = `authdec_${randomUUID()}`;
  const evaluatedValueUsd = envelope.valueUsd;
  await withTransaction(async (db) => {
    await db.query(`INSERT INTO authority_decision(id,owner_user_id,mandate_id,mandate_revision,worker_id,account_id,environment,action_envelope,decision,reason_codes,reasons,period_spent_before_usd,evaluated_value_usd)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12,$13)`, [
      id, ownerUserId, mandate?.id ?? null, mandate?.revision.revision ?? null, envelope.workerId, envelope.accountId, envelope.environment,
      JSON.stringify(envelope), evaluation.decision, JSON.stringify(evaluation.reasons.map((item) => item.code)), JSON.stringify(evaluation.reasons), evaluation.periodSpentBeforeUsd, evaluatedValueUsd ?? null,
    ]);
    const primaryReason = evaluation.reasons[0]?.message ?? 'Authority decision recorded.';
    await recordDomainEvent(db, {
      ownerUserId, eventType: 'authority.decision', objectType: 'authority-decision', objectId: id,
      title: `Authority ${evaluation.decision === 'ALLOWED' ? 'allowed' : evaluation.decision === 'APPROVAL_REQUIRED' ? 'requires approval' : 'denied'}`,
      summary: `${envelope.capabilityId} · ${primaryReason}`,
      effect: evaluation.decision === 'DENIED' ? 'Nothing was submitted. No funds moved.' : evaluation.decision === 'APPROVAL_REQUIRED' ? 'No execution may continue without human approval.' : 'Authority policy allows this proposal; execution eligibility is evaluated separately.',
      status: evaluation.decision.toLowerCase(), workerId: envelope.workerId,
      metadata: { decisionId: id, mandateId: mandate?.id ?? null, mandateRevision: mandate?.revision.revision ?? null, accountId: envelope.accountId, environment: envelope.environment, reasons: evaluation.reasons },
    });
  });
  const result: DurableAuthorityDecision = {
    id,
    workerId: envelope.workerId,
    accountId: envelope.accountId,
    environment: envelope.environment,
    actionEnvelope: envelope,
    decision: evaluation.decision,
    reasons: evaluation.reasons,
    periodSpentBeforeUsd: evaluation.periodSpentBeforeUsd,
    createdAt: new Date().toISOString(),
  };
  if (mandate) { result.mandateId = mandate.id; result.mandateRevision = mandate.revision.revision; }
  if (evaluatedValueUsd) result.evaluatedValueUsd = evaluatedValueUsd;
  return result;
}

function mapDecision(row: DecisionRow): DurableAuthorityDecision {
  const envelope = row.action_envelope as ActionEnvelope;
  const decision: DurableAuthorityDecision = {
    id: row.id, workerId: row.worker_id, accountId: row.account_id, environment: row.environment,
    actionEnvelope: envelope, decision: row.decision,
    reasons: Array.isArray(row.reasons) ? row.reasons.filter((item): item is AuthorityReason => Boolean(item) && typeof item === 'object') : [],
    periodSpentBeforeUsd: canonicalDecimal(row.period_spent_before_usd), createdAt: row.created_at.toISOString(),
  };
  if (row.mandate_id) decision.mandateId = row.mandate_id;
  if (row.mandate_revision !== null) decision.mandateRevision = row.mandate_revision;
  if (row.evaluated_value_usd !== null) decision.evaluatedValueUsd = canonicalDecimal(row.evaluated_value_usd);
  return decision;
}

export async function listAuthorityDecisions(ownerUserId: string, limit = 100): Promise<DurableAuthorityDecision[]> {
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const result = await getDatabasePool().query<DecisionRow>(`SELECT id,mandate_id,mandate_revision,worker_id,account_id,environment,action_envelope,decision,reasons,period_spent_before_usd,evaluated_value_usd,created_at
    FROM authority_decision WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT $2`, [ownerUserId, bounded]);
  return result.rows.map(mapDecision);
}

export async function recordAuthorityUsage(ownerUserId: string, authorityDecisionId: string): Promise<void> {
  await withTransaction(async (db) => {
    const decision = await db.query<{ mandate_id: string | null; mandate_revision: number | null; decision: AuthorityDecisionValue; evaluated_value_usd: string | null }>(`SELECT mandate_id,mandate_revision,decision,evaluated_value_usd FROM authority_decision WHERE owner_user_id=$1 AND id=$2 FOR UPDATE`, [ownerUserId, authorityDecisionId]);
    const row = decision.rows[0];
    if (!row) throw new Error('AUTHORITY_DECISION_NOT_FOUND');
    if (row.decision !== 'ALLOWED' || !row.mandate_id || row.mandate_revision === null || !row.evaluated_value_usd) throw new Error('AUTHORITY_USAGE_NOT_RECORDABLE');

    const existing = await db.query<{ id: string }>(`SELECT id FROM authority_budget_usage WHERE owner_user_id=$1 AND authority_decision_id=$2`, [ownerUserId, authorityDecisionId]);
    if (existing.rows[0]) return;

    const mandate = await db.query<{ status: MandateStatus; current_revision: number; period_budget_limit_usd: string | null; period_budget_period: BudgetPeriod | null }>(`SELECT m.status,m.current_revision,r.period_budget_limit_usd::text,r.period_budget_period
      FROM mandate m JOIN mandate_revision r ON r.mandate_id=m.id AND r.owner_user_id=m.owner_user_id AND r.revision=m.current_revision
      WHERE m.owner_user_id=$1 AND m.id=$2 FOR UPDATE OF m`, [ownerUserId, row.mandate_id]);
    const current = mandate.rows[0];
    if (!current || current.status !== 'ACTIVE' || current.current_revision !== row.mandate_revision) throw new Error('AUTHORITY_DECISION_STALE');
    if (!current.period_budget_limit_usd || !current.period_budget_period) throw new Error('AUTHORITY_PERIOD_BUDGET_REQUIRED');

    const start = periodStart(current.period_budget_period, new Date());
    const spent = await db.query<{ total: string }>(`SELECT COALESCE(sum(value_usd),0)::text AS total FROM authority_budget_usage WHERE owner_user_id=$1 AND mandate_id=$2 AND occurred_at >= $3`, [ownerUserId, row.mandate_id, start.toISOString()]);
    const after = addDecimal(canonicalDecimal(spent.rows[0]?.total ?? '0'), canonicalDecimal(row.evaluated_value_usd));
    if (greaterThan(after, canonicalDecimal(current.period_budget_limit_usd))) throw new Error('AUTHORITY_PERIOD_BUDGET_EXCEEDED_AT_RECORD');

    await db.query(`INSERT INTO authority_budget_usage(id,owner_user_id,mandate_id,mandate_revision,authority_decision_id,value_usd)
      VALUES($1,$2,$3,$4,$5,$6)`, [`authuse_${randomUUID()}`, ownerUserId, row.mandate_id, row.mandate_revision, authorityDecisionId, row.evaluated_value_usd]);
  });
}

export function translateMandateIntent(intent: string): IntentTranslationDraft {
  const source = text(intent, 4000, 'INVALID_MANDATE_INTENT');
  const lower = source.toLowerCase();
  const warnings: string[] = ['This is a structured draft only. Review every field before activating authority.'];
  const networkCatalog: Array<[string, NetworkPolicyRef]> = [
    ['ethereum', { family: 'eip155', networkId: 'ethereum' }], ['base', { family: 'eip155', networkId: 'base' }],
    ['arbitrum', { family: 'eip155', networkId: 'arbitrum' }], ['bnb', { family: 'eip155', networkId: 'bnb' }],
    ['polygon', { family: 'eip155', networkId: 'polygon' }], ['robinhood', { family: 'eip155', networkId: 'robinhood' }],
    ['solana', { family: 'solana', networkId: 'solana' }],
  ];
  const networksFound = networkCatalog.filter(([name]) => new RegExp(`\\b${name}\\b`, 'i').test(source)).map(([, value]) => value);
  const assets = ['USDC','USDT','DAI','ETH','WETH','BTC','WBTC','SOL'].filter((asset) => new RegExp(`\\b${asset}\\b`, 'i').test(source));
  const protocols = ['Aave','Compound','Morpho','Spark','Uniswap','Jupiter'].filter((protocol) => new RegExp(`\\b${protocol}\\b`, 'i').test(source)).map((value) => value.toLowerCase());
  const explicitAutonomy = /without asking|automatically|autonom(?:ous|ously)|manage within|within (?:my |these )?rules|may act|can act/i.test(source);
  const observeOnly = /observe only|monitor only|research only|read[- ]only/i.test(source);
  const authorityLevel: AuthorityLevel = observeOnly ? 'OBSERVE' : explicitAutonomy ? 'ACT_WITHIN_MANDATE' : 'PREPARE';

  const moneyMatches = [...source.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map((match) => match[1]).filter((value): value is string => Boolean(value));
  const withoutAsking = source.match(/(?:up to|more than|above|max(?:imum)?(?: of)?)?\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:without asking|before asking|without (?:my )?approval)/i)
    ?? source.match(/(?:without asking|without (?:my )?approval)[^$]{0,40}\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  let approvalPolicy: ApprovalPolicy = { mode: 'ALWAYS', askForNewProtocols: true, askForNewDestinations: true };
  if (/always ask|ask me every|approve every|each move/i.test(source)) approvalPolicy = { ...approvalPolicy, mode: 'ALWAYS' };
  else if (withoutAsking?.[1]) approvalPolicy = { ...approvalPolicy, mode: 'THRESHOLD', thresholdUsd: canonicalDecimal(withoutAsking[1]) };
  else if (explicitAutonomy) approvalPolicy = { ...approvalPolicy, mode: 'WITHIN_LIMITS' };

  const hardLimit = source.match(/(?:hard (?:ceiling|limit)|absolute (?:ceiling|limit)|maximum transaction|per transaction|per action)[^$]{0,30}\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const daily = source.match(/(?:daily|per day|a day)[^$]{0,30}\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ?? source.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)[^$]{0,20}(?:daily|per day|a day)/i);
  const weekly = source.match(/(?:weekly|per week|a week)[^$]{0,30}\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ?? source.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)[^$]{0,20}(?:weekly|per week|a week)/i);
  const monthly = source.match(/(?:monthly|per month|a month)[^$]{0,30}\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ?? source.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)[^$]{0,20}(?:monthly|per month|a month)/i);

  const draft: IntentTranslationDraft = {
    authorityLevel,
    networks: networksFound,
    assets,
    protocols,
    approvalPolicy,
    borrowingAllowed: /(?:allow|may|can|permitted to)\s+borrow(?:ing)?/i.test(source) && !/no borrow|never borrow|do not borrow|without borrowing/i.test(source),
    leverageAllowed: /(?:allow|may|can|permitted to)\s+(?:use\s+)?leverage/i.test(source) && !/no leverage|never use leverage|do not use leverage|without leverage/i.test(source),
    warnings,
  };
  if (hardLimit?.[1]) draft.perActionLimitUsd = canonicalDecimal(hardLimit[1]);
  if (daily?.[1]) draft.periodBudget = { limitUsd: canonicalDecimal(daily[1]), period: 'day' };
  else if (weekly?.[1]) draft.periodBudget = { limitUsd: canonicalDecimal(weekly[1]), period: 'week' };
  else if (monthly?.[1]) draft.periodBudget = { limitUsd: canonicalDecimal(monthly[1]), period: 'month' };
  if (authorityLevel === 'ACT_WITHIN_MANDATE' && !draft.perActionLimitUsd) warnings.push('A hard per-action ceiling is still required before ACT WITHIN MANDATE can be activated.');
  if (authorityLevel === 'ACT_WITHIN_MANDATE' && !draft.periodBudget) warnings.push('A day/week/month period budget is still required before ACT WITHIN MANDATE can be activated.');
  if (networksFound.length === 0) warnings.push('No network was confidently identified. Select at least one network.');
  if (assets.length === 0 && authorityLevel === 'ACT_WITHIN_MANDATE') warnings.push('No asset was confidently identified. Select an explicit asset allow-list.');
  if (moneyMatches.length > 0 && !withoutAsking && !hardLimit && !daily && !weekly && !monthly) warnings.push('A money amount was mentioned, but its authority meaning was ambiguous. Set the limits manually.');
  return draft;
}

export const moduleManifest = {
  name: 'authority',
  layer: 'trusted-core',
  milestone: 7,
  status: 'mandates-deterministic-authority-engine',
} as const;
