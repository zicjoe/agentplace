import {
  configuredIntelligenceProviders,
  configuredResearchProviders,
  listCanonicalCapabilities,
  listCapabilityImplementations,
  type CanonicalCapability,
  type CapabilityImplementation,
} from '@agent-place/capabilities';
import { getDatabasePool } from '@agent-place/db';
import { telegraphRouterImplementations } from '@agent-place/telegraph/runtime';
import { listWorkerCatalog, type WorkerCatalogItem } from '@agent-place/workers';

export type DeploymentEnvironment = 'development' | 'testnet' | 'staging-mainnet-readonly' | 'production-mainnet';
export type RouteDecisionStatus = 'routable' | 'partially-routable' | 'blocked';
export type RouteCapabilityStatus = 'routable' | 'unavailable' | 'blocked';
export type RouteProviderPreference = 'auto' | 'openai' | 'gemini' | 'anthropic';

export interface ProposedCapabilityGraphNode {
  id: string;
  capabilityId: string;
  dependsOn: string[];
  purpose: string;
}

export interface RouteProposal {
  intentDomain: string;
  goal: string;
  requestedNetworks: string[];
  leadWorkerId: string;
  supportingWorkerIds: string[];
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  capabilityGraph: ProposedCapabilityGraphNode[];
}

export interface RouteCandidateImplementation {
  implementationId: string;
  provider: string;
  name: string;
  healthStatus: CapabilityImplementation['healthStatus'];
  trustStatus: string;
  priority: number;
  invocationKind: string;
  eligible: boolean;
  selected: boolean;
  fallbackRank?: number;
  reason: string;
}

export interface RouteCapabilityDecision {
  capabilityId: string;
  capabilityName: string;
  required: boolean;
  effect: CanonicalCapability['effect'];
  lifecycleStatus: CanonicalCapability['lifecycleStatus'];
  status: RouteCapabilityStatus;
  reason: string;
  selectedImplementationId?: string;
  selectedProvider?: string;
  candidates: RouteCandidateImplementation[];
  compatibleWorkerIds: string[];
}

export interface CandidateWorkerDecision {
  workerId: string;
  name: string;
  score: number;
  matchedCapabilityIds: string[];
  eligible: boolean;
  reason: string;
}

export interface DurableRouteDecision {
  id: string;
  taskId: string;
  conversationId: string;
  jobId?: string;
  status: RouteDecisionStatus;
  intentDomain: string;
  goal: string;
  deploymentEnvironment: DeploymentEnvironment;
  requestedNetworks: string[];
  leadWorkerId: string;
  leadWorkerName: string;
  supportingWorkerIds: string[];
  supportingWorkerNames: string[];
  candidateWorkers: CandidateWorkerDecision[];
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  capabilityGraph: ProposedCapabilityGraphNode[];
  capabilityRoutes: RouteCapabilityDecision[];
  unavailableCapabilities: string[];
  routingExplanation: string;
  createdAt: string;
  updatedAt: string;
}

type WorkerCompatibilityRow = {
  worker_id: string;
  worker_version_id: string;
  canonical_capability_id: string;
  suitability: 'primary' | 'supporting';
};

type RouteRow = {
  id:string; task_id:string; conversation_id:string; job_id:string|null; status:RouteDecisionStatus; intent_domain:string; goal:string;
  deployment_environment:DeploymentEnvironment; requested_networks:unknown; lead_worker_id:string; supporting_worker_ids:unknown; candidate_workers:unknown;
  required_capabilities:unknown; optional_capabilities:unknown; capability_graph:unknown; capability_routes:unknown; unavailable_capabilities:unknown;
  routing_explanation:string; created_at:Date; updated_at:Date; lead_worker_name:string; supporting_worker_names:unknown;
};

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function objects<T>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter((item): item is T => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function unique(values: readonly string[], max = 32): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, max);
}

export function canonicalizeNetworkId(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return '';

  // Preserve explicit test networks as distinct IDs so mainnet-only intelligence
  // implementations can never be selected for them by accident.
  if (/\barbitrum\b/.test(normalized) && /\bsepolia\b|\btestnet\b/.test(normalized)) return 'arbitrum-sepolia';
  if (/\bbase\b/.test(normalized) && /\bsepolia\b|\btestnet\b/.test(normalized)) return 'base-sepolia';
  if (/\b(?:ethereum|eth)\b/.test(normalized) && /\bsepolia\b|\bholesky\b|\btestnet\b/.test(normalized)) return normalized.includes('holesky') ? 'ethereum-holesky' : 'ethereum-sepolia';
  if (/\b(?:bnb|bsc|binance smart chain)\b/.test(normalized) && /\btestnet\b/.test(normalized)) return 'bnb-testnet';
  if (/\bsolana\b/.test(normalized) && /\bdevnet\b/.test(normalized)) return 'solana-devnet';
  if (/\bsolana\b/.test(normalized) && /\btestnet\b/.test(normalized)) return 'solana-testnet';

  // The Manager may decorate a network with a display name or chain ID, e.g.
  // "Arbitrum One (42161)". Canonical routing must not depend on exact prose.
  if (/\b42161\b/.test(normalized) || /\barbitrum\b/.test(normalized) || normalized === 'arb' || normalized === 'arb one') return 'arbitrum';
  if (/\b8453\b/.test(normalized) || /\bbase\b/.test(normalized)) return 'base';
  if (/\b56\b/.test(normalized) || /\bbnb\b/.test(normalized) || /\bbsc\b/.test(normalized) || /\bbinance smart chain\b/.test(normalized)) return 'bnb';
  if (/\b1\b/.test(normalized) && /\b(?:chain|chain id|mainnet|ethereum|eth)\b/.test(normalized)) return 'ethereum';
  if (/\bethereum\b/.test(normalized) || normalized === 'eth') return 'ethereum';
  if (/\bsolana\b/.test(normalized) || normalized === 'sol') return 'solana';
  return normalized;
}

function isLiveLifecycle(status: CanonicalCapability['lifecycleStatus'], environment: DeploymentEnvironment): boolean {
  if (status === 'limited-production' || status === 'production-observed' || status === 'agentplace-verified') return true;
  if ((environment === 'development' || environment === 'testnet') && status === 'tested') return true;
  return false;
}

function networkEligible(implementation: CapabilityImplementation, requestedNetworks: readonly string[]): boolean {
  if (!implementation.supportedNetworks.length) return true;
  const supported = new Set(implementation.supportedNetworks.map((network) => canonicalizeNetworkId(network)));
  if (!requestedNetworks.length) {
    // A chain-specific implementation must not be selected before the request
    // has a resolved network. Multi-network implementations that cover the
    // five AgentPlace launch networks remain eligible.
    return ['ethereum','base','arbitrum','bnb','solana'].every((network) => supported.has(network));
  }
  return requestedNetworks.some((network) => supported.has(canonicalizeNetworkId(network)));
}

function providerConfigured(provider: string, configuredProviders: ReadonlySet<string>): boolean {
  if (provider === 'agentplace') return true;
  return configuredProviders.has(provider);
}

function implementationTrustEligible(implementation: CapabilityImplementation): boolean {
  const trustStatus = implementation.trustStatus.trim().toLowerCase();
  if (trustStatus === 'experimental') {
    return implementation.provider === 'telegraph' && implementation.invocationKind === 'telegraph-direct-x402';
  }
  return new Set([
    'tested',
    'simulation-verified',
    'provider-verified',
    'limited-production',
    'production-observed',
    'agentplace-verified',
  ]).has(trustStatus);
}

function implementationTrustRank(implementation: CapabilityImplementation): number {
  return implementation.trustStatus.trim().toLowerCase() === 'experimental' ? 10 : 0;
}

function implementationEligibility(args: {
  implementation: CapabilityImplementation;
  deploymentEnvironment: DeploymentEnvironment;
  requestedNetworks: readonly string[];
  configuredProviders: ReadonlySet<string>;
}): { eligible: boolean; reason: string } {
  const { implementation } = args;
  if (!implementation.enabled) return { eligible: false, reason: 'Implementation disabled.' };
  if (!implementationTrustEligible(implementation)) {
    return { eligible: false, reason: `Implementation trust state ${implementation.trustStatus || 'unknown'} is not eligible.` };
  }
  if (implementation.healthStatus === 'unavailable') return { eligible: false, reason: 'Provider implementation unavailable.' };
  if (implementation.environmentEligibility.length && !implementation.environmentEligibility.includes(args.deploymentEnvironment)) {
    return { eligible: false, reason: `Not eligible in ${args.deploymentEnvironment}.` };
  }
  if (!networkEligible(implementation, args.requestedNetworks)) return { eligible: false, reason: 'Requested network is not supported.' };
  if (!providerConfigured(implementation.provider, args.configuredProviders)) return { eligible: false, reason: 'Provider is not configured.' };
  return { eligible: true, reason: implementation.healthStatus === 'degraded' ? 'Eligible, but provider health is degraded.' : 'Eligible.' };
}

function healthRank(status: CapabilityImplementation['healthStatus']): number {
  if (status === 'healthy') return 0;
  if (status === 'degraded') return 1;
  if (status === 'unknown') return 2;
  return 3;
}

function sortImplementations(
  candidates: Array<{ implementation: CapabilityImplementation; eligible: boolean; reason: string }>,
  preferredProvider: RouteProviderPreference,
  defaultProvider: RouteProviderPreference,
): Array<{ implementation: CapabilityImplementation; eligible: boolean; reason: string }> {
  const providerPreference = preferredProvider === 'auto' ? defaultProvider : preferredProvider;
  return candidates.sort((left, right) => {
    if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
    const leftProvider = providerPreference !== 'auto' && left.implementation.provider === providerPreference ? 0 : 1;
    const rightProvider = providerPreference !== 'auto' && right.implementation.provider === providerPreference ? 0 : 1;
    if (leftProvider !== rightProvider) return leftProvider - rightProvider;
    const trust = implementationTrustRank(left.implementation) - implementationTrustRank(right.implementation);
    if (trust !== 0) return trust;
    const health = healthRank(left.implementation.healthStatus) - healthRank(right.implementation.healthStatus);
    if (health !== 0) return health;
    const priority = left.implementation.priority - right.implementation.priority;
    if (priority !== 0) return priority;
    return left.implementation.id.localeCompare(right.implementation.id);
  });
}

function normalizeGraph(
  proposed: readonly ProposedCapabilityGraphNode[],
  requiredCapabilities: readonly string[],
  optionalCapabilities: readonly string[],
  knownCapabilities: ReadonlySet<string>,
): ProposedCapabilityGraphNode[] {
  const allowed = new Set([...requiredCapabilities, ...optionalCapabilities]);
  const result: ProposedCapabilityGraphNode[] = [];
  const ids = new Set<string>();
  for (const node of proposed) {
    const id = node.id?.trim();
    const capabilityId = node.capabilityId?.trim();
    if (!id || ids.has(id) || !knownCapabilities.has(capabilityId) || !allowed.has(capabilityId)) continue;
    const dependsOn = unique(node.dependsOn ?? [], 8).filter((dependency) => ids.has(dependency));
    result.push({ id, capabilityId, dependsOn, purpose: node.purpose?.trim().slice(0, 300) || capabilityId });
    ids.add(id);
    if (result.length >= 24) break;
  }
  if (result.length) return result;
  let previous: string | undefined;
  return [...requiredCapabilities, ...optionalCapabilities].map((capabilityId, index) => {
    const id = `cap_${index + 1}`;
    const node = { id, capabilityId, dependsOn: previous ? [previous] : [], purpose: capabilityId };
    previous = id;
    return node;
  });
}

function workerCandidates(
  catalog: readonly WorkerCatalogItem[],
  compatibility: readonly WorkerCompatibilityRow[],
  requestedCapabilities: readonly string[],
): CandidateWorkerDecision[] {
  return catalog.map((worker) => {
    const matched = unique(compatibility
      .filter((row) => row.worker_id === worker.id && requestedCapabilities.includes(row.canonical_capability_id))
      .map((row) => row.canonical_capability_id));
    const primary = compatibility.filter((row) => row.worker_id === worker.id && row.suitability === 'primary' && matched.includes(row.canonical_capability_id)).length;
    const eligible = worker.trustStatus !== 'quarantined';
    const score = eligible ? matched.length * 10 + primary * 3 + (worker.id === 'w-researcher' ? 1 : 0) : -1;
    return {
      workerId: worker.id,
      name: worker.name,
      score,
      matchedCapabilityIds: matched,
      eligible,
      reason: eligible ? (matched.length ? `Matches ${matched.length} requested ${matched.length === 1 ? 'capability' : 'capabilities'}.` : 'Published Worker; no direct capability match.') : 'Worker is quarantined.',
    };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function pickTeam(args: {
  catalog: readonly WorkerCatalogItem[];
  candidates: readonly CandidateWorkerDecision[];
  compatibility: readonly WorkerCompatibilityRow[];
  requestedCapabilities: readonly string[];
  proposalLeadWorkerId: string;
  proposalSupportingWorkerIds: readonly string[];
  forcedLeadWorkerId?: string;
  forcedSupportingWorkerIds?: readonly string[];
}): { leadWorkerId: string; supportingWorkerIds: string[] } {
  const catalogIds = new Set(args.catalog.filter((worker) => worker.trustStatus !== 'quarantined').map((worker) => worker.id));
  const candidateById = new Map(args.candidates.map((candidate) => [candidate.workerId, candidate]));
  const forcedLead = args.forcedLeadWorkerId && catalogIds.has(args.forcedLeadWorkerId) ? args.forcedLeadWorkerId : undefined;
  const bestCandidate = args.candidates.find((candidate) => candidate.eligible && candidate.score > 0);
  const proposedCandidate = candidateById.get(args.proposalLeadWorkerId);
  const proposedLead = catalogIds.has(args.proposalLeadWorkerId)
    && !!proposedCandidate
    && proposedCandidate.score > 0
    && (!bestCandidate || proposedCandidate.score >= bestCandidate.score)
    ? args.proposalLeadWorkerId
    : undefined;
  const leadWorkerId = forcedLead ?? proposedLead ?? bestCandidate?.workerId
    ?? (catalogIds.has('w-researcher') ? 'w-researcher' : args.catalog.find((worker) => catalogIds.has(worker.id))?.id ?? '');

  const validSupport = (workerIds: readonly string[]): string[] => unique(workerIds, 4)
    .filter((workerId) => workerId !== leadWorkerId && catalogIds.has(workerId) && (candidateById.get(workerId)?.score ?? -1) > 0)
    .slice(0, 4);

  // Existing Job scope supplies a forced team and must not be silently
  // reassembled during a follow-up. Manager/Worker scope may let the Router
  // add the smallest set of specialists needed to cover proposed capability
  // requirements.
  if (args.forcedSupportingWorkerIds) {
    return { leadWorkerId, supportingWorkerIds: validSupport(args.forcedSupportingWorkerIds) };
  }

  const supportingWorkerIds = validSupport(args.proposalSupportingWorkerIds);
  const covered = new Set(
    args.compatibility
      .filter((row) => row.worker_id === leadWorkerId || supportingWorkerIds.includes(row.worker_id))
      .map((row) => row.canonical_capability_id),
  );
  for (const capabilityId of args.requestedCapabilities) {
    if (covered.has(capabilityId) || supportingWorkerIds.length >= 4) continue;
    const specialist = args.candidates.find((candidate) =>
      candidate.eligible
      && candidate.workerId !== leadWorkerId
      && !supportingWorkerIds.includes(candidate.workerId)
      && candidate.matchedCapabilityIds.includes(capabilityId),
    );
    if (!specialist) continue;
    supportingWorkerIds.push(specialist.workerId);
    for (const row of args.compatibility) {
      if (row.worker_id === specialist.workerId) covered.add(row.canonical_capability_id);
    }
  }
  return { leadWorkerId, supportingWorkerIds };
}

function routeExplanation(args: {
  leadName: string;
  status: RouteDecisionStatus;
  requiredCount: number;
  routableCount: number;
  unavailableCount: number;
  selectedProviders: string[];
}): string {
  const providerText = unique(args.selectedProviders).filter((provider) => provider !== 'agentplace');
  const providerSuffix = providerText.length ? ` Selected provider path: ${providerText.join(', ')}.` : '';
  if (args.status === 'routable') {
    return `${args.leadName} was selected as lead. ${args.routableCount}/${args.requiredCount} required capabilities are routable in the current environment.${providerSuffix}`;
  }
  if (args.status === 'partially-routable') {
    return `${args.leadName} was selected as lead. ${args.routableCount}/${args.requiredCount} required capabilities are routable; ${args.unavailableCount} requested capability${args.unavailableCount === 1 ? ' is' : 'ies are'} unavailable and must be reported as limitations rather than guessed.${providerSuffix}`;
  }
  return `The requested Job cannot be routed safely in the current environment. No financial authority or execution was granted.${providerSuffix}`;
}

async function listWorkerCompatibility(): Promise<WorkerCompatibilityRow[]> {
  const result = await getDatabasePool().query<WorkerCompatibilityRow>(
    `SELECT wv.worker_definition_id AS worker_id,wcr.worker_version_id,wcr.canonical_capability_id,wcr.suitability
     FROM worker_capability_route wcr
     JOIN worker_version wv ON wv.id=wcr.worker_version_id
     WHERE wv.retired_at IS NULL
     ORDER BY wv.worker_definition_id,wcr.canonical_capability_id`,
  );
  return result.rows;
}

export async function planRoute(args: {
  ownerUserId: string;
  taskId: string;
  conversationId: string;
  proposal: RouteProposal;
  deploymentEnvironment: DeploymentEnvironment;
  preferredProvider: RouteProviderPreference;
  defaultProvider?: RouteProviderPreference;
  forcedLeadWorkerId?: string;
  forcedSupportingWorkerIds?: string[];
}): Promise<DurableRouteDecision> {
  const [capabilities, implementations, catalog, compatibility, telegraphImplementations] = await Promise.all([
    listCanonicalCapabilities(),
    listCapabilityImplementations(),
    listWorkerCatalog(),
    listWorkerCompatibility(),
    telegraphRouterImplementations(),
  ]);
  const allImplementations: CapabilityImplementation[] = [...implementations, ...telegraphImplementations];
  const capabilityById = new Map(capabilities.map((capability) => [capability.id, capability]));
  const knownIds = new Set(capabilities.map((capability) => capability.id));
  const researchCore = ['research.web.search', 'research.web.read', 'research.source.extract'].filter((id) => knownIds.has(id));
  const requiredCapabilities = unique([...researchCore, ...args.proposal.requiredCapabilities.filter((id) => knownIds.has(id))], 24);
  const optionalCapabilities = unique(args.proposal.optionalCapabilities.filter((id) => knownIds.has(id) && !requiredCapabilities.includes(id)), 16);
  const requestedCapabilities = [...requiredCapabilities, ...optionalCapabilities];
  const requestedNetworks = unique(args.proposal.requestedNetworks.map(canonicalizeNetworkId), 12);
  const candidateWorkers = workerCandidates(catalog, compatibility, requestedCapabilities);
  const team = pickTeam({
    catalog,
    candidates: candidateWorkers,
    compatibility,
    requestedCapabilities,
    proposalLeadWorkerId: args.proposal.leadWorkerId,
    proposalSupportingWorkerIds: args.proposal.supportingWorkerIds,
    ...(args.forcedLeadWorkerId ? { forcedLeadWorkerId: args.forcedLeadWorkerId } : {}),
    ...(args.forcedSupportingWorkerIds ? { forcedSupportingWorkerIds: args.forcedSupportingWorkerIds } : {}),
  });
  const configuredProviders = new Set<string>([...configuredResearchProviders(), ...configuredIntelligenceProviders()]);
  const providerPreference = args.preferredProvider;
  const defaultProvider = args.defaultProvider ?? 'auto';
  const capabilityRoutes: RouteCapabilityDecision[] = [];

  for (const capabilityId of requestedCapabilities) {
    const capability = capabilityById.get(capabilityId);
    if (!capability) continue;
    const compatibleWorkerIds = unique(compatibility.filter((row) => row.canonical_capability_id === capabilityId).map((row) => row.worker_id));
    const required = requiredCapabilities.includes(capabilityId);
    if (capability.effect !== 'read') {
      capabilityRoutes.push({
        capabilityId, capabilityName: capability.name, required, effect: capability.effect, lifecycleStatus: capability.lifecycleStatus,
        status: 'blocked', reason: 'Router v1 is read-only and cannot grant or route financial write authority.', candidates: [], compatibleWorkerIds,
      });
      continue;
    }
    if (!isLiveLifecycle(capability.lifecycleStatus, args.deploymentEnvironment)) {
      capabilityRoutes.push({
        capabilityId, capabilityName: capability.name, required, effect: capability.effect, lifecycleStatus: capability.lifecycleStatus,
        status: 'unavailable', reason: `Capability lifecycle is ${capability.lifecycleStatus}; it is not live in ${args.deploymentEnvironment}.`, candidates: [], compatibleWorkerIds,
      });
      continue;
    }
    const rawCandidates = allImplementations.filter((implementation) => implementation.canonicalCapabilityId === capabilityId).map((implementation) => {
      const eligibility = implementationEligibility({ implementation, deploymentEnvironment: args.deploymentEnvironment, requestedNetworks, configuredProviders });
      const explicitProviderMismatch = providerPreference !== 'auto'
        && (implementation.provider === 'openai' || implementation.provider === 'gemini' || implementation.provider === 'anthropic')
        && implementation.provider !== providerPreference;
      if (explicitProviderMismatch) return { implementation, eligible: false, reason: `Conversation explicitly selected ${providerPreference}; silent provider switching is disabled.` };
      return { implementation, ...eligibility };
    });
    const ordered = sortImplementations(rawCandidates, providerPreference, defaultProvider);
    const eligible = ordered.filter((candidate) => candidate.eligible);
    const selected = eligible[0]?.implementation;
    const candidates: RouteCandidateImplementation[] = ordered.map((candidate) => {
      const fallbackIndex = eligible.findIndex((item) => item.implementation.id === candidate.implementation.id);
      return {
        implementationId: candidate.implementation.id,
        provider: candidate.implementation.provider,
        name: candidate.implementation.name,
        healthStatus: candidate.implementation.healthStatus,
        trustStatus: candidate.implementation.trustStatus,
        priority: candidate.implementation.priority,
        invocationKind: candidate.implementation.invocationKind,
        eligible: candidate.eligible,
        selected: candidate.implementation.id === selected?.id,
        ...(fallbackIndex > 0 ? { fallbackRank: fallbackIndex } : {}),
        reason: candidate.reason,
      };
    });
    if (!selected) {
      capabilityRoutes.push({
        capabilityId, capabilityName: capability.name, required, effect: capability.effect, lifecycleStatus: capability.lifecycleStatus,
        status: 'unavailable', reason: allImplementations.some((implementation) => implementation.canonicalCapabilityId === capabilityId)
          ? `No implementation is currently eligible. ${candidates.slice(0, 4).map((candidate) => `${candidate.provider}: ${candidate.reason}`).join(' | ')}`
          : 'No implementation is registered for this live capability.',
        candidates, compatibleWorkerIds,
      });
      continue;
    }
    capabilityRoutes.push({
      capabilityId, capabilityName: capability.name, required, effect: capability.effect, lifecycleStatus: capability.lifecycleStatus,
      status: 'routable', reason: 'A live eligible implementation was selected.', selectedImplementationId: selected.id,
      selectedProvider: selected.provider, candidates, compatibleWorkerIds,
    });
  }

  const requiredRoutes = capabilityRoutes.filter((route) => route.required);
  const routableRequired = requiredRoutes.filter((route) => route.status === 'routable');
  const unavailableCapabilities = requiredRoutes.filter((route) => route.status !== 'routable').map((route) => route.capabilityId);
  const hasBlockedWrite = requiredRoutes.some((route) => route.status === 'blocked');
  const researchSearchRoutable = capabilityRoutes.some((route) => route.capabilityId === 'research.web.search' && route.status === 'routable');
  const status: RouteDecisionStatus = hasBlockedWrite || routableRequired.length === 0 || !researchSearchRoutable
    ? 'blocked'
    : unavailableCapabilities.length
      ? 'partially-routable'
      : 'routable';
  const lead = catalog.find((worker) => worker.id === team.leadWorkerId);
  if (!lead) throw new Error('ROUTER_NO_ELIGIBLE_WORKER');
  const supporting = team.supportingWorkerIds.map((workerId) => catalog.find((worker) => worker.id === workerId)).filter((worker): worker is WorkerCatalogItem => !!worker);
  const capabilityGraph = normalizeGraph(args.proposal.capabilityGraph, requiredCapabilities, optionalCapabilities, knownIds);
  const routingExplanation = routeExplanation({
    leadName: lead.name,
    status,
    requiredCount: requiredRoutes.length,
    routableCount: routableRequired.length,
    unavailableCount: unavailableCapabilities.length,
    selectedProviders: capabilityRoutes.map((route) => route.selectedProvider ?? '').filter(Boolean),
  });
  const id = `route_${args.taskId}`;
  await getDatabasePool().query(
    `INSERT INTO route_decision(
      id,owner_user_id,task_id,conversation_id,status,intent_domain,goal,deployment_environment,requested_networks,
      lead_worker_id,supporting_worker_ids,candidate_workers,required_capabilities,optional_capabilities,capability_graph,
      capability_routes,unavailable_capabilities,routing_explanation
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18)
    ON CONFLICT(owner_user_id,task_id) DO UPDATE SET
      status=EXCLUDED.status,intent_domain=EXCLUDED.intent_domain,goal=EXCLUDED.goal,deployment_environment=EXCLUDED.deployment_environment,
      requested_networks=EXCLUDED.requested_networks,lead_worker_id=EXCLUDED.lead_worker_id,supporting_worker_ids=EXCLUDED.supporting_worker_ids,
      candidate_workers=EXCLUDED.candidate_workers,required_capabilities=EXCLUDED.required_capabilities,optional_capabilities=EXCLUDED.optional_capabilities,
      capability_graph=EXCLUDED.capability_graph,capability_routes=EXCLUDED.capability_routes,unavailable_capabilities=EXCLUDED.unavailable_capabilities,
      routing_explanation=EXCLUDED.routing_explanation,updated_at=now()`,
    [
      id,args.ownerUserId,args.taskId,args.conversationId,status,args.proposal.intentDomain.slice(0,120) || 'general',args.proposal.goal.slice(0,4000),
      args.deploymentEnvironment,JSON.stringify(requestedNetworks),lead.id,JSON.stringify(team.supportingWorkerIds),JSON.stringify(candidateWorkers.slice(0,12)),
      JSON.stringify(requiredCapabilities),JSON.stringify(optionalCapabilities),JSON.stringify(capabilityGraph),JSON.stringify(capabilityRoutes),
      JSON.stringify(unavailableCapabilities),routingExplanation,
    ],
  );
  const route = await getRouteDecisionForTask(args.ownerUserId, args.taskId);
  if (!route) throw new Error('ROUTE_DECISION_PERSIST_FAILED');
  return route;
}

export async function attachRouteDecisionToJob(ownerUserId: string, taskId: string, jobId: string): Promise<void> {
  await getDatabasePool().query(
    `UPDATE route_decision SET job_id=$3,updated_at=now() WHERE owner_user_id=$1 AND task_id=$2`,
    [ownerUserId, taskId, jobId],
  );
}

function mapRouteRow(row: RouteRow): DurableRouteDecision {
  const supportingWorkerNames = strings(row.supporting_worker_names);
  return {
    id:row.id,taskId:row.task_id,conversationId:row.conversation_id,...(row.job_id ? { jobId:row.job_id } : {}),status:row.status,
    intentDomain:row.intent_domain,goal:row.goal,deploymentEnvironment:row.deployment_environment,requestedNetworks:strings(row.requested_networks),
    leadWorkerId:row.lead_worker_id,leadWorkerName:row.lead_worker_name,supportingWorkerIds:strings(row.supporting_worker_ids),supportingWorkerNames,
    candidateWorkers:objects<CandidateWorkerDecision>(row.candidate_workers),requiredCapabilities:strings(row.required_capabilities),
    optionalCapabilities:strings(row.optional_capabilities),capabilityGraph:objects<ProposedCapabilityGraphNode>(row.capability_graph),
    capabilityRoutes:objects<RouteCapabilityDecision>(row.capability_routes),unavailableCapabilities:strings(row.unavailable_capabilities),
    routingExplanation:row.routing_explanation,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),
  };
}

const routeSelect = `SELECT r.id,r.task_id,r.conversation_id,r.job_id,r.status,r.intent_domain,r.goal,r.deployment_environment,
  r.requested_networks,r.lead_worker_id,r.supporting_worker_ids,r.candidate_workers,r.required_capabilities,r.optional_capabilities,
  r.capability_graph,r.capability_routes,r.unavailable_capabilities,r.routing_explanation,r.created_at,r.updated_at,
  lead.name AS lead_worker_name,
  COALESCE((SELECT jsonb_agg(d.name ORDER BY support.ordinal) FROM jsonb_array_elements_text(r.supporting_worker_ids) WITH ORDINALITY support(worker_id,ordinal) JOIN worker_definition d ON d.id=support.worker_id),'[]'::jsonb) AS supporting_worker_names
  FROM route_decision r JOIN worker_definition lead ON lead.id=r.lead_worker_id`;

export async function getRouteDecisionForTask(ownerUserId: string, taskId: string): Promise<DurableRouteDecision | null> {
  const result = await getDatabasePool().query<RouteRow>(`${routeSelect} WHERE r.owner_user_id=$1 AND r.task_id=$2`, [ownerUserId, taskId]);
  return result.rows[0] ? mapRouteRow(result.rows[0]) : null;
}

export async function getRouteDecisionForJob(ownerUserId: string, jobId: string): Promise<DurableRouteDecision | null> {
  const result = await getDatabasePool().query<RouteRow>(`${routeSelect} WHERE r.owner_user_id=$1 AND r.job_id=$2 ORDER BY r.updated_at DESC LIMIT 1`, [ownerUserId, jobId]);
  return result.rows[0] ? mapRouteRow(result.rows[0]) : null;
}

export function routedProvidersForCapability(route: DurableRouteDecision, capabilityId: string): RouteCandidateImplementation[] {
  const capability = route.capabilityRoutes.find((item) => item.capabilityId === capabilityId);
  if (!capability) return [];
  return capability.candidates.filter((candidate) => candidate.eligible).sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    return (a.fallbackRank ?? Number.MAX_SAFE_INTEGER) - (b.fallbackRank ?? Number.MAX_SAFE_INTEGER);
  });
}

export const moduleManifest = { name: 'router', layer: 'controlled-runtime', milestone: '5B.2.3', status: 'router-v1-with-experimental-telegraph-fallback' } as const;
