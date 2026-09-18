export type Environment = 'mainnet' | 'testnet';

export type NavView =
  | 'home'
  | 'discover'
  | 'workers'
  | 'routines'
  | 'activity'
  | 'wallets'
  | 'security'
  | 'billing'
  | 'settings';

export type Scenario =
  | 'normal'
  | 'quote-expired'
  | 'provider-degraded'
  | 'partial-failure'
  | 'blocked-mandate'
  | 'wallet-disconnected'
  | 'routine-limited'
  | 'verification-delayed'
  | 'proof-anchor-pending'
  | 'transaction-status-unknown'
  | 'provider-material-change'
  | 'authority-expired-during-work'
  | 'stale-conflicting-data';

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
}

export type MessageRole = 'user' | 'manager' | 'specialist';

export interface SpecialistInfo {
  name: string;
  role: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  specialist?: SpecialistInfo;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  jobId?: string;
  uiCard?: 'stablecoin-mode-select' | 'watch-address-form' | 'perps-action-trigger' | 'mandate-review' | 'connect-wallet-cta' | 'create-agent-account-cta' | 'fund-agent-account-cta' | 'bridge-quote' | 'bridge-completion';
}

export interface Conversation {
  id: string;
  title: string;
  manuallyRenamed: boolean;
  messages: ChatMessage[];
  pinned: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkerStatus =
  | 'working'
  | 'monitoring'
  | 'standby'
  | 'needs-you'
  | 'paused'
  | 'limited'
  | 'blocked'
  | 'issue';

export interface Worker {
  id: string;
  name: string;
  tagline: string;
  status: WorkerStatus;
  isOriginal: boolean;
  responsibility?: string;
  authoritySummary?: string;
  currentFocus?: string;
  currentJobId?: string;
}

// ── Job ───────────────────────────────────────────────────────────────────────

export type JobStatus = 'working' | 'completed' | 'failed' | 'blocked' | 'needs-approval' | 'executing' | 'settling' | 'verifying' | 'recovering' | 'needs-you' | 'rejected' | 'unknown';

// ── Routine ───────────────────────────────────────────────────────────────────

export type RoutineStatus =
  | 'draft'
  | 'active'
  | 'watching'
  | 'waiting-for-event'
  | 'cooling-down'
  | 'paused'
  | 'limited'
  | 'needs-you'
  | 'expired'
  | 'stopped';

export type RoutineTriggerType = 'scheduled' | 'condition' | 'event';

export interface RoutineTrigger {
  type: RoutineTriggerType;
  humanReadable: string;
  conditionThreshold?: string;
  eventThreshold?: string;
}

export interface RoutineRun {
  id: string;
  routineId: string;
  jobId?: string;
  startedAt: Date;
  completedAt?: Date;
  resultType: 'no-change' | 'threshold-met' | 'job-created' | 'blocked' | 'error';
  summary: string;
  meaningful: boolean;
}

export interface RoutineServiceBudget {
  limitUsd: number;
  spentUsd: number;
  periodDays: number;
  status: 'ok' | 'limited' | 'exhausted';
}

export interface Routine {
  id: string;
  title: string;
  workerId: string;
  workerName: string;
  instruction: string;
  trigger: RoutineTrigger;
  status: RoutineStatus;
  executionBehavior: 'recommend-only' | 'act-within-authority';
  authorityGrantId?: string;
  notificationRule: string;
  serviceBudget?: string;
  gasBudget?: string;
  serviceBudgetStructured?: RoutineServiceBudget;
  lastRunAt?: Date;
  nextRunAt?: Date;
  lastMeaningfulActionAt?: Date;
  recentRunIds: string[];
  limitedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Notification ──────────────────────────────────────────────────────────────

export type NotificationLevel = 'informational' | 'important' | 'needs-you' | 'critical';

export interface NotificationTarget {
  type: 'routine' | 'job' | 'action' | 'worker' | 'wallet';
  id: string;
}

export interface Notification {
  id: string;
  level: NotificationLevel;
  title: string;
  summary: string;
  why: string;
  createdAt: Date;
  read: boolean;
  groupKey?: string;
  target?: NotificationTarget;
}

export interface NotificationPreferences {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  criticalBypassQuietHours: boolean;
  lockScreenDetail: 'full' | 'hide-amounts' | 'private';
}

export interface JobProgressStage {
  id: string;
  label: string;
  status: 'done' | 'active' | 'pending';
}

export interface JobResultItem {
  label: string;
  headline: string;
  detail: string;
}

export interface JobResult {
  summary: string;
  items: JobResultItem[];
  label: 'Research complete';
}

export interface Job {
  id: string;
  title: string;
  goal: string;
  status: JobStatus;
  leadWorkerId: string;
  leadWorkerName: string;
  supportingWorkerIds: string[];
  supportingWorkerNames: string[];
  originWorkerId?: string;
  currentStage: string;
  stages: JobProgressStage[];
  result?: JobResult;
  kind?: 'research' | 'financial';
  originConversationId?: string;
  actionId?: string;
  executionId?: string;
  verifiedOutcomeId?: string;
  receiptId?: string;
  routineId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Outcome & Activity ────────────────────────────────────────────────────────

export interface Outcome {
  id: string;
  title: string;
  summary: string;
  workerId: string;
  workerName: string;
  jobId?: string;
  verifiedOutcomeId?: string;
  receiptId?: string;
  createdAt: Date;
  type: 'research' | 'operational' | 'financial';
}

export interface ActivityEvent {
  id: string;
  eventType: 'job' | 'worker-added' | 'system' | 'financial' | 'authority' | 'wallet' | 'routine' | 'security';
  title: string;
  summary: string;
  effect?: string;
  workerName?: string;
  workerId?: string;
  jobId?: string;
  actionId?: string;
  walletId?: string;
  routineId?: string;
  grantId?: string;
  timestamp: Date;
  status: string;
}

// ── Wallets & Financial ───────────────────────────────────────────────────────

export type WalletMode = 'watch-only' | 'connected' | 'agent-account';

export interface WalletBalance {
  symbol: string;
  amount: string;
  usdValue: string;
  network?: string;
}

export interface WalletResource {
  id: string;
  name: string;
  mode: WalletMode;
  address: string;
  networks: string[];
  balances: WalletBalance[];
  connectedWorkerIds: string[];
  agentAccountId?: string;
  disconnected?: boolean;
  createdAt: Date;
}

export interface AgentAccount {
  id: string;
  name: string;
  walletId: string;
  totalBalance: string;
  availableBalance: string;
  deployedBalance: string;
  networks: string[];
  createdAt: Date;
}

export interface Mandate {
  id: string;
  workerId: string;
  workerName: string;
  agentAccountId: string;
  goal: string;
  managedCapital: string;
  reserveCapital: string;
  preferredProtocols: string[];
  riskPosture: string;
  restrictions: string[];
  expiry: Date;
  status: 'draft' | 'active' | 'paused' | 'revoked';
  createdAt: Date;
}

export interface AuthorityGrant {
  id: string;
  workerId: string;
  workerName: string;
  agentAccountId: string;
  networks: string[];
  allowedActions: string[];
  allowedProtocols: string[];
  singleActionLimit: string;
  totalManagedCapital: string;
  borrowingAllowed: boolean;
  leverageAllowed: boolean;
  expiry: Date;
  status: 'draft' | 'active' | 'paused' | 'revoked' | 'expired';
  environment: 'mainnet' | 'testnet';
  mandateId: string;
  createdAt: Date;
}

export interface FinancialSetupReturn {
  convId: string;
  flow: 'stablecoin-approve-each' | 'stablecoin-manage-rules';
  requiredMode: 'connected' | 'agent-account';
}

export type AuthorityDecision = 'within-mandate' | 'needs-approval' | 'blocked' | 'needs-you';
export type FinancialActionType = 'supply' | 'withdraw' | 'reallocate' | 'fund' | 'swap' | 'bridge' | 'perps';
export type FinancialActionStatus =
  | 'pending-review'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'within-mandate'
  | 'needs-you'
  | 'completed';

export interface QuoteInfo {
  quotedAt: Date;
  expiresAt: Date;
  estimatedReceive: string;
  minimumReceive: string;
  estimatedTotalCost: string;
  estimatedDuration: string;
  routeSummary: string;
  provider?: string;
  expired?: boolean;
}

export interface FinancialAction {
  id: string;
  title: string;
  actionType: FinancialActionType;
  economicEffect: string;
  rationale: string;
  authorityDecision: AuthorityDecision;
  authorityReason: string;
  risks: string[];
  technicalDetails: Record<string, string>;
  workerId?: string;
  workerName?: string;
  agentAccountId?: string;
  walletId?: string;
  environment: Environment;
  amount?: string;
  asset?: string;
  protocol?: string;
  network?: string;
  status: FinancialActionStatus;
  blockedReason?: string;
  mandateId?: string;
  grantId?: string;
  quote?: QuoteInfo;
  sourceNetwork?: string;
  destinationNetwork?: string;
  dataQuality?: {
    status: 'fresh' | 'stale' | 'conflicting' | 'unavailable';
    summary: string;
    affectedFields?: string[];
    lastUpdatedAt?: Date;
    sources?: string[];
  };
  previousQuote?: QuoteInfo;
  providerChangeNote?: string;
  createdAt: Date;
}

export type ExecutionStatus =
  | 'approved'
  | 'submitting'
  | 'submitted'
  | 'confirming'
  | 'settling'
  | 'verifying'
  | 'completed'
  | 'recovering'
  | 'unknown'
  | 'failed';

export interface TransactionEvidence {
  network: string;
  txHash: string;
  submittedAt: Date;
  confirmationState: 'pending' | 'confirmed' | 'unknown';
  confirmedAt?: Date;
}

export interface SettlementObservation {
  expectedDestination: string;
  asset: string;
  minimumExpectedAmount: string;
  observedAmount?: string;
  network: string;
  status: 'pending' | 'observed' | 'failed';
  observedAt?: Date;
}

export interface RecoveryInfo {
  completedSteps: string[];
  incompleteSteps: string[];
  verifiedCurrentLocation: string;
  verifiedCurrentAmount: string;
  status: 'evaluating' | 'recovering' | 'needs-user' | 'failed';
  notes?: string;
}

export interface ExecutionRecord {
  id: string;
  actionId: string;
  jobId: string;
  status: ExecutionStatus;
  environment: Environment;
  startedAt: Date;
  updatedAt: Date;
  transactionEvidence?: TransactionEvidence;
  destinationEvidence?: TransactionEvidence;
  settlementObservations?: SettlementObservation[];
  currentVerifiedState?: string;
  recovery?: RecoveryInfo;
  routeAdjusted?: boolean;
  routeAdjustmentNote?: string;
}

export interface VerifiedOutcome {
  id: string;
  jobId: string;
  actionId: string;
  executionId: string;
  status: 'verified' | 'failed' | 'pending';
  expectedOutcome: string;
  actualOutcome: string;
  verificationMethod: string;
  evidenceSummary: string;
  verifiedAt: Date;
}

export interface VerifiedReceipt {
  id: string;
  jobId: string;
  actionId: string;
  executionId: string;
  verifiedOutcomeId: string;
  userGoal: string;
  workerName: string;
  authorizedActionSummary: string;
  actualEconomicOutcome: string;
  costs: { label: string; amount: string }[];
  transactionReferences: { label: string; hash?: string; status: string }[];
  verificationMethod: string;
  verificationEvidence: string;
  proofAnchorStatus: 'pending' | 'anchored' | 'not-applicable';
  proofAnchorNote?: string;
  environment: Environment;
  createdAt: Date;
}

export interface AttentionItem {
  id: string;
  title: string;
  summary: string;
  type: 'action-review' | 'decision' | 'info';
  actionId?: string;
  workerId?: string;
  walletId?: string;
  createdAt: Date;
}

// ── Discover Supply ───────────────────────────────────────────────────────────

export interface DiscoverSupplyItem {
  id: string;
  type: 'worker' | 'workflow' | 'capability';
  name: string;
  tagline: string;
  description: string;
  whatItDoes?: string[];
  whatItDoesNot?: string[];
  creatorId: string;
  creatorName: string;
  isOriginal: boolean;
  category: string;
  networks: string[];
  pricing: { type: 'free' | 'paid'; label?: string };
  visibility: 'public' | 'unlisted';
  authorityDefault?: string;
  sponsored: boolean;
  jobsCompleted?: number;
  completionRate?: number;
  medianResponse?: string;
  costAccuracy?: number;
  lastUpdated: Date;
  version: string;
  forkSourceId?: string;
  forkSourceName?: string;
  forkSourceCreator?: string;
  allowsCustomization?: boolean;
  creatorAssetId?: string;
  workflowPurpose?: string;
  workflowInputs?: string[];
  workflowOutputs?: string[];
  workflowSteps?: string[];
  workflowCompatibleWorkers?: string[];
  capabilityClassification?: 'read' | 'prepare' | 'execution-sensitive';
  capabilityProvider?: string;
}

// ── Creator system ────────────────────────────────────────────────────────────

export type CreatorAssetType = 'worker' | 'workflow' | 'capability';
export type CreatorAssetVisibility = 'draft' | 'tested' | 'private' | 'unlisted' | 'public';
export type ActiveCreatorSurface = 'agent-builder' | 'workflow-studio' | 'capability-studio' | 'creator-home' | null;

export interface CollaboratorConfig {
  id: string;
  role: string;
  pinnedWorkerId?: string;
  pinnedWorkerName?: string;
  roleBased: boolean;
  whenUsed: string;
  contextShared: string;
  required: boolean;
  fallback?: string;
  costLimit?: string;
  authorityBoundary: string;
}

export interface CreatorTestCase {
  id: string;
  name: string;
  scenario: string;
  expected: string;
}

export interface CreatorTestResult {
  caseId: string;
  passed: boolean;
  observed: string;
  evidence: string;
}

export interface WorkerDraftData {
  name: string;
  jobContract: string;
  responsibilities: string[];
  antiJobs: string[];
  method: string[];
  collaborators: CollaboratorConfig[];
  capabilities: string[];
  routineTemplates: string[];
  authorityDefault: string;
  serviceBudget: string;
  testCases: CreatorTestCase[];
  testResults: CreatorTestResult[];
  networks: string[];
  pricing: { type: 'free' | 'paid'; label?: string };
  lineageSourceId?: string;
  lineageSourceName?: string;
  lineageSourceCreator?: string;
}

export interface WorkflowDraftData {
  name: string;
  purpose: string;
  inputs: string[];
  steps: string[];
  conditions: string[];
  outputs: string[];
  requiredCapabilities: string[];
  safetyBoundaries: string[];
  compatibleWorkers: string[];
  pricing: { type: 'free' | 'paid'; label?: string };
}

export interface CapabilityOperation {
  original: string;
  canonical: string;
  classification: 'read' | 'prepare' | 'execution-sensitive';
  description: string;
}

export interface CapabilityDraftData {
  name: string;
  importType: 'mcp' | 'openapi';
  endpoint?: string;
  operations: CapabilityOperation[];
  provider?: string;
  version?: string;
  pricing: { type: 'free' | 'paid'; label?: string };
  networks?: string[];
}

export interface CreatorAsset {
  id: string;
  type: CreatorAssetType;
  visibility: CreatorAssetVisibility;
  createdAt: Date;
  updatedAt: Date;
  workerDraft?: WorkerDraftData;
  workflowDraft?: WorkflowDraftData;
  capabilityDraft?: CapabilityDraftData;
  publishedSupplyItemId?: string;
}

// ── Billing ───────────────────────────────────────────────────────────────────

export type BillingPlanId = 'free' | 'pro' | 'builder';

export interface BillingPaymentMethod {
  id: string;
  type: 'card' | 'usdc';
  label: string;
  isDefault: boolean;
}

export interface BillingSpendControls {
  monthlyVariableLimitUsd: number;
  singleJobThresholdUsd: number;
}

export interface BillingCostEntry {
  id: string;
  category: 'agentplace-service' | 'external-worker' | 'external-capability' | 'external-provider' | 'onchain-gas' | 'bridge-fee' | 'protocol-fee' | 'subscription';
  amountUsd: number;
  description: string;
  timestamp: Date;
  jobId?: string;
  routineId?: string;
  workerId?: string;
  creatorAssetId?: string;
  subscriptionId?: string;
  paidBy: 'service-balance' | 'included-in-plan' | 'user-wallet' | 'agent-account' | 'covered-by-agentplace' | 'external-subscription';
  prototype: true;
}

export interface BillingSubscription {
  id: string;
  name: string;
  type: 'agentplace-plan' | 'community-worker' | 'capability' | 'data-provider';
  providerId?: string;
  providerName: string;
  priceLabel: string;
  priceCentsMonthly: number;
  cadence: 'monthly' | 'annual';
  status: 'active' | 'cancelled' | 'pending-cancel';
  nextChargeAt?: Date;
  cancelledAt?: Date;
  prototype: true;
}

export interface BillingAccount {
  planId: BillingPlanId;
  planName: string;
  serviceBalanceUsd: number;
  variableSpendThisMonthUsd: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  spendControls: BillingSpendControls;
  paymentMethods: BillingPaymentMethod[];
  prototype: true;
}

export interface CreatorEarningEntry {
  id: string;
  creatorAssetId: string;
  assetName: string;
  subscriptionId?: string;
  jobId?: string;
  grossAmountUsd: number;
  platformShareUsd: number;
  creatorAmountUsd: number;
  status: 'pending' | 'paid';
  timestamp: Date;
  prototype: true;
}

// ── Identity checkpoint ───────────────────────────────────────────────────────

export interface IdentityCheckpoint {
  reason: string;
  feature: string;
  onComplete: (user: User) => void;
}

// ── App state ─────────────────────────────────────────────────────────────────

export interface AppState {
  user: User | null;
  environment: Environment;
  activeView: NavView;
  activeConversationId: string | null;
  activeWorkerId: string | null;
  activeJobId: string | null;
  activeWalletId: string | null;
  activeActionId: string | null;
  activeRoutineId: string | null;
  conversations: Conversation[];
  workers: Worker[];
  jobs: Job[];
  outcomes: Outcome[];
  activityEvents: ActivityEvent[];
  wallets: WalletResource[];
  agentAccounts: AgentAccount[];
  mandates: Mandate[];
  authorityGrants: AuthorityGrant[];
  financialActions: FinancialAction[];
  attentionItems: AttentionItem[];
  routines: Routine[];
  routineRuns: RoutineRun[];
  notifications: Notification[];
  notificationPreferences: NotificationPreferences;
  notificationInboxOpen: boolean;
  lastSeenAt: Date | null;
  discoverSupply: DiscoverSupplyItem[];
  creatorAssets: CreatorAsset[];
  activeCreatorSurface: ActiveCreatorSurface;
  activeCreationId: string | null;
  activeDiscoverItemId: string | null;
  autonomousExecutionPaused: boolean;
  billingAccount: BillingAccount | null;
  billingSubscriptions: BillingSubscription[];
  billingCostEntries: BillingCostEntry[];
  creatorEarnings: CreatorEarningEntry[];
  financialSetupReturn: FinancialSetupReturn | null;
  executionRecords: ExecutionRecord[];
  verifiedOutcomes: VerifiedOutcome[];
  verifiedReceipts: VerifiedReceipt[];
  activeReceiptId: string | null;
  scenario: Scenario;
  showDemoControls: boolean;
  mobileDrawerOpen: boolean;
  showCreateMenu: boolean;
  showSearch: boolean;
  identityCheckpoint: IdentityCheckpoint | null;
  routeNotFound: string | null;
}
