import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import type {
  AppState,
  NavView,
  Environment,
  Scenario,
  User,
  Conversation,
  ChatMessage,
  Worker,
  Job,
  JobProgressStage,
  Outcome,
  ActivityEvent,
  IdentityCheckpoint,
  WalletResource,
  AgentAccount,
  Mandate,
  AuthorityGrant,
  FinancialAction,
  AttentionItem,
  FinancialSetupReturn,
  ExecutionRecord,
  VerifiedOutcome,
  VerifiedReceipt,
  QuoteInfo,
  Routine,
  RoutineRun,
  Notification,
  NotificationPreferences,
  DiscoverSupplyItem,
  CreatorAsset,
  ActiveCreatorSurface,
  BillingAccount,
  BillingSubscription,
  BillingCostEntry,
  CreatorEarningEntry,
} from '../state/types';
import { clearFixtureState, persistFixtureState, restoreFixtureState } from '../platform/fixtureStore';
import {
  applyRouteSelection,
  isNavigationAction,
  pathForState,
  routeSelectionFromPath,
  type RouteSelection,
} from '../platform/routing';
import { WEB_RUNTIME_SETTINGS } from '../platform/runtime';
import { getAgentPlaceIdentity, getAuthenticatedUser, signOut as signOutAuth } from '../platform/authClient';
import { addDurableMessage, createDurableConversation, fetchConversations, importGuestConversations, patchDurableConversation, updateDurableMessage } from '../platform/conversationApi';
import { clearIdentityResume, readIdentityResume } from '../platform/identityResume';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex Chen',
  email: 'alex@example.com',
  initials: 'AC',
};

export const MOCK_WORKERS: Worker[] = [
  {
    id: 'w-memescout',
    name: 'Meme Scout',
    tagline: 'Monitors meme coin opportunities across Solana and EVM chains',
    status: 'monitoring',
    isOriginal: true,
    responsibility:
      'Meme Scout researches and monitors meme-token opportunities across supported ecosystems and surfaces material changes.',
    authoritySummary: 'Research & recommend only · No wallet authority',
    currentFocus: 'BONK and broader Solana meme opportunities',
  },
  {
    id: 'w-portfolio',
    name: 'Portfolio Guardian',
    tagline: 'Tracks portfolio performance and flags material changes',
    status: 'standby',
    isOriginal: true,
    responsibility:
      'Portfolio Guardian monitors on-chain holdings across networks, tracks meaningful P&L changes, and surfaces material events.',
    authoritySummary: 'Read-only · No wallet authority',
    currentFocus: 'No active monitoring configured',
  },
  {
    id: 'w-stablecoin',
    name: 'Stablecoin Manager',
    tagline: 'Optimises yield on idle stablecoins within your approved rules',
    status: 'monitoring',
    isOriginal: true,
    responsibility:
      'Stablecoin Manager monitors USDC and DAI yield across Aave, Morpho, and Spark, and proposes reallocation when material yield differences emerge.',
    authoritySummary: 'Autonomous within mandate · Main Agent Account · Up to 1,500 USDC · Max 500 USDC/action · Base · Arbitrum · Aave · Morpho · No borrowing · No leverage',
    currentFocus: 'Monitoring yield spread on Morpho vs Aave',
  },
];

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'ch-bonk',
    title: 'BONK Research · Solana',
    manuallyRenamed: true,
    messages: [],
    pinned: true,
    archived: false,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'ch-stable',
    title: 'Stablecoin yield comparison',
    manuallyRenamed: false,
    messages: [],
    pinned: false,
    archived: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'ch-eth',
    title: 'ETH bridging options — Arbitrum to Base',
    manuallyRenamed: false,
    messages: [],
    pinned: false,
    archived: false,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

const MOCK_OUTCOMES: Outcome[] = [
  {
    id: 'out-bonk',
    title: 'BONK research completed',
    summary: 'Meme Scout · Research complete',
    workerId: 'w-memescout',
    workerName: 'Meme Scout',
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    type: 'research',
  },
  {
    id: 'out-stable-realloc',
    title: 'Stablecoin reallocation executed',
    summary: 'Stablecoin Manager · 300 USDC moved to Morpho on Base',
    workerId: 'w-stablecoin',
    workerName: 'Stablecoin Manager',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    type: 'operational',
  },
];

const MOCK_WALLETS: WalletResource[] = [
  {
    id: 'wlt-main',
    name: 'Main Wallet',
    mode: 'connected',
    address: '0x1a2b...c3d4',
    networks: ['Ethereum', 'Base', 'Arbitrum'],
    balances: [
      { symbol: 'ETH', amount: '0.52', usdValue: '$1,248' },
      { symbol: 'USDC', amount: '800', usdValue: '$800', network: 'Arbitrum' },
      { symbol: 'USDC', amount: '0', usdValue: '$0', network: 'Base' },
    ],
    connectedWorkerIds: ['w-portfolio'],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'wlt-treasury',
    name: 'Treasury Watch',
    mode: 'watch-only',
    address: '0xaabb...ccdd',
    networks: ['Ethereum'],
    balances: [
      { symbol: 'USDC', amount: '45,230', usdValue: '$45,230' },
      { symbol: 'ETH', amount: '12.4', usdValue: '$29,760' },
    ],
    connectedWorkerIds: ['w-portfolio'],
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'wlt-agent',
    name: 'Main Agent Account',
    mode: 'agent-account',
    address: 'AA-0x9f3e...a1b2',
    networks: ['Base', 'Arbitrum'],
    balances: [{ symbol: 'USDC', amount: '2,000', usdValue: '$2,000' }],
    connectedWorkerIds: ['w-stablecoin'],
    agentAccountId: 'aa-main',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

const MOCK_AGENT_ACCOUNTS: AgentAccount[] = [
  {
    id: 'aa-main',
    name: 'Main Agent Account',
    walletId: 'wlt-agent',
    totalBalance: '2,000 USDC',
    availableBalance: '500 USDC',
    deployedBalance: '1,500 USDC',
    networks: ['Base', 'Arbitrum'],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

const MANDATE_EXPIRY = new Date('2026-12-31');
const GRANT_EXPIRY = new Date('2026-12-31');

const MOCK_MANDATES: Mandate[] = [
  {
    id: 'mnd-stable',
    workerId: 'w-stablecoin',
    workerName: 'Stablecoin Manager',
    agentAccountId: 'aa-main',
    goal: 'Keep stablecoins productive while maintaining liquidity',
    managedCapital: 'Up to 1,500 USDC',
    reserveCapital: 'At least 500 USDC liquid at all times',
    preferredProtocols: ['Aave', 'Morpho'],
    riskPosture: 'Conservative',
    restrictions: ['No borrowing', 'No leverage', 'No new protocol integrations without approval'],
    expiry: MANDATE_EXPIRY,
    status: 'active',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

const MOCK_AUTHORITY_GRANTS: AuthorityGrant[] = [
  {
    id: 'grant-stable',
    workerId: 'w-stablecoin',
    workerName: 'Stablecoin Manager',
    agentAccountId: 'aa-main',
    networks: ['Base', 'Arbitrum'],
    allowedActions: ['Supply', 'Withdraw', 'Reallocate stablecoins'],
    allowedProtocols: ['Aave', 'Morpho'],
    singleActionLimit: '500 USDC',
    totalManagedCapital: '1,500 USDC',
    borrowingAllowed: false,
    leverageAllowed: false,
    expiry: GRANT_EXPIRY,
    status: 'active',
    environment: 'mainnet',
    mandateId: 'mnd-stable',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

const MOCK_ACTIVITY: ActivityEvent[] = [
  {
    id: 'act-bonk',
    eventType: 'job',
    title: 'BONK research',
    summary: 'Research complete · Meme Scout',
    workerId: 'w-memescout',
    workerName: 'Meme Scout',
    timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    status: 'complete',
  },
  {
    id: 'act-memescout-added',
    eventType: 'worker-added',
    title: 'Meme Scout added to your workforce',
    summary: 'Operational change',
    workerId: 'w-memescout',
    workerName: 'Meme Scout',
    timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    status: 'operational',
  },
  {
    id: 'act-wallet-connected',
    eventType: 'wallet',
    title: 'Main Wallet connected',
    summary: 'Connected wallet · 0x1a2b...c3d4',
    walletId: 'wlt-main',
    timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    status: 'complete',
  },
  {
    id: 'act-treasury-added',
    eventType: 'wallet',
    title: 'Treasury Watch added',
    summary: 'Watch-only · 0xaabb...ccdd',
    walletId: 'wlt-treasury',
    timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    status: 'complete',
  },
  {
    id: 'act-agent-created',
    eventType: 'wallet',
    title: 'Main Agent Account created',
    summary: 'Agent account · funded 2,000 USDC',
    walletId: 'wlt-agent',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    status: 'complete',
  },
  {
    id: 'act-authority-activated',
    eventType: 'authority',
    title: 'Stablecoin Manager authority activated',
    summary: 'Autonomous within mandate · 1,500 USDC · Base · Arbitrum',
    workerId: 'w-stablecoin',
    workerName: 'Stablecoin Manager',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    status: 'complete',
  },
  {
    id: 'act-stable-realloc',
    eventType: 'financial',
    title: 'Stablecoin reallocation executed',
    summary: '300 USDC → Morpho on Base · Within mandate',
    workerId: 'w-stablecoin',
    workerName: 'Stablecoin Manager',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: 'complete',
  },
];

const MOCK_ROUTINES: Routine[] = [
  {
    id: 'rtn-stable-check',
    title: 'Weekday stablecoin opportunity check',
    workerId: 'w-stablecoin',
    workerName: 'Stablecoin Manager',
    instruction: 'Check for better stablecoin opportunities. Surface only net improvements of at least 1%.',
    trigger: {
      type: 'scheduled',
      humanReadable: 'Weekdays · Morning',
    },
    status: 'active',
    executionBehavior: 'recommend-only',
    notificationRule: 'Only when net improvement >= 1% or Routine needs you',
    serviceBudget: 'Up to 30 monitoring checks per day · Prototype',
    gasBudget: 'Up to 5 USDC/day · Prototype',
    lastRunAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    nextRunAt: new Date(Date.now() + 14 * 60 * 60 * 1000),
    lastMeaningfulActionAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    recentRunIds: ['rrun-1', 'rrun-2'],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'rtn-bonk-watch',
    title: 'BONK smart-money watch',
    workerId: 'w-memescout',
    workerName: 'Meme Scout',
    instruction: 'Watch BONK and surface material changes in smart-money accumulation.',
    trigger: {
      type: 'condition',
      humanReadable: 'When smart-money accumulation changes materially',
      conditionThreshold: 'Material change in smart-money accumulation',
    },
    status: 'watching',
    executionBehavior: 'recommend-only',
    notificationRule: 'When material smart-money accumulation changes',
    serviceBudget: 'Up to 24 monitoring checks per day · Prototype',
    lastRunAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    lastMeaningfulActionAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    recentRunIds: ['rrun-3'],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: 'rtn-treasury-alert',
    title: 'Treasury movement alert',
    workerId: 'w-portfolio',
    workerName: 'Portfolio Guardian',
    instruction: 'Analyse any Treasury Watch movement above $50,000.',
    trigger: {
      type: 'event',
      humanReadable: 'Wallet movement > $50,000',
      eventThreshold: '$50,000',
    },
    status: 'waiting-for-event',
    executionBehavior: 'recommend-only',
    notificationRule: 'When movement > $50,000',
    lastRunAt: undefined,
    lastMeaningfulActionAt: undefined,
    recentRunIds: [],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];

const MOCK_ROUTINE_RUNS: RoutineRun[] = [
  {
    id: 'rrun-1',
    routineId: 'rtn-stable-check',
    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000 + 3 * 60 * 1000),
    resultType: 'no-change',
    summary: 'No net improvement above 1%',
    meaningful: false,
  },
  {
    id: 'rrun-2',
    routineId: 'rtn-stable-check',
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000 + 4 * 60 * 1000),
    resultType: 'threshold-met',
    summary: 'Morpho opportunity identified — +1.3% net yield improvement',
    meaningful: true,
  },
  {
    id: 'rrun-3',
    routineId: 'rtn-bonk-watch',
    startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000 + 2 * 60 * 1000),
    resultType: 'threshold-met',
    summary: 'Material BONK smart-money accumulation detected',
    meaningful: true,
  },
];

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  criticalBypassQuietHours: true,
  lockScreenDetail: 'hide-amounts',
};

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-bonk-change',
    level: 'important',
    title: 'BONK smart-money accumulation changed materially',
    summary: 'Meme Scout · Your Routine threshold was met.',
    why: 'You asked Meme Scout to surface material smart-money changes.',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
    read: false,
    groupKey: 'bonk-smartmoney',
    target: { type: 'routine', id: 'rtn-bonk-watch' },
  },
  {
    id: 'notif-portfolio-monitoring',
    level: 'informational',
    title: 'Portfolio Guardian monitored Treasury Watch today',
    summary: '96 checks · No material change.',
    why: 'Treasury movement alert Routine is watching for movements above $50,000.',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    read: false,
    groupKey: 'treasury-monitoring',
    target: { type: 'routine', id: 'rtn-treasury-alert' },
  },
];

// ── Discover supply fixtures ──────────────────────────────────────────────────

export const MOCK_DISCOVER_SUPPLY: DiscoverSupplyItem[] = [
  {
    id: 'ds-memescout',
    type: 'worker',
    name: 'Meme Scout',
    tagline: 'Monitors meme coin opportunities across Solana and EVM chains',
    description: 'Tracks emerging meme tokens, smart money accumulation, and community velocity. Surfaces high-signal opportunities without chasing noise. Can monitor a watchlist, alert on entry signals, or produce periodic research digests.',
    whatItDoes: ['Monitor meme token watchlists', 'Track smart-money accumulation', 'Surface community velocity signals', 'Produce research digests on request'],
    whatItDoesNot: ['Execute trades autonomously', 'Manage positions', 'Predict prices'],
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Research & Discovery',
    networks: ['Solana', 'Ethereum', 'Base'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Research & recommend only · No wallet authority',
    sponsored: false,
    jobsCompleted: 8420,
    completionRate: 97.2,
    medianResponse: '42 sec',
    costAccuracy: 95,
    lastUpdated: new Date('2026-09-01'),
    version: '2.3.1',
    allowsCustomization: false,
  },
  {
    id: 'ds-portfolio',
    type: 'worker',
    name: 'Portfolio Guardian',
    tagline: 'Monitors portfolio performance and flags material changes',
    description: 'Watches on-chain holdings across networks, tracks P&L, and surfaces meaningful changes — not noise. Works entirely with watch-only access. Alerts before issues compound.',
    whatItDoes: ['Watch on-chain holdings across networks', 'Track P&L changes', 'Alert on material movements', 'Summarise overnight changes'],
    whatItDoesNot: ['Move funds', 'Execute rebalances', 'Access private keys'],
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Portfolio',
    networks: ['Ethereum', 'Arbitrum', 'Base', 'Solana', 'Polygon'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Read-only · No wallet authority',
    sponsored: false,
    jobsCompleted: 12840,
    completionRate: 98.1,
    medianResponse: '28 sec',
    costAccuracy: 97,
    lastUpdated: new Date('2026-09-10'),
    version: '3.1.0',
    allowsCustomization: false,
  },
  {
    id: 'ds-stablecoin',
    type: 'worker',
    name: 'Stablecoin Manager',
    tagline: 'Optimises yield on idle stablecoins within your approved rules',
    description: 'Continuously monitors USDC, USDT, and DAI yield across Aave, Morpho, Compound, and Spark. Proposes reallocation when material yield differences emerge. Requires Agent Account and explicit mandate to execute.',
    whatItDoes: ['Monitor stablecoin yield across protocols', 'Propose reallocation when material improvement exists', 'Execute within mandate limits', 'Report on yield performance'],
    whatItDoesNot: ['Execute without an active mandate', 'Use leverage', 'Borrow funds', 'Use unapproved protocols'],
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Yield & DeFi',
    networks: ['Ethereum', 'Arbitrum', 'Base'],
    pricing: { type: 'paid', label: '$8/month · Prototype price' },
    visibility: 'public',
    authorityDefault: 'Execution requires Agent Account + explicit mandate',
    sponsored: false,
    jobsCompleted: 3210,
    completionRate: 96.8,
    medianResponse: '38 sec',
    costAccuracy: 94,
    lastUpdated: new Date('2026-09-05'),
    version: '1.8.2',
    allowsCustomization: false,
  },
  {
    id: 'ds-smartmoney',
    type: 'worker',
    name: 'Smart Money Tracker',
    tagline: 'Follows on-chain activity of known alpha wallets',
    description: 'Tracks curated smart money wallets and identifies meaningful position changes. Delivers weekly briefings and real-time alerts when notable movement occurs. No execution authority.',
    whatItDoes: ['Track curated smart-money wallets', 'Identify meaningful position changes', 'Deliver weekly briefings and real-time alerts', 'Correlate wallet activity with market context'],
    whatItDoesNot: ['Copy trades', 'Move funds', 'Guarantee signal quality'],
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Research & Discovery',
    networks: ['Ethereum', 'Arbitrum', 'Base', 'Solana'],
    pricing: { type: 'paid', label: '$6/month · Prototype price' },
    visibility: 'public',
    authorityDefault: 'Research & recommend only · No wallet authority',
    sponsored: false,
    jobsCompleted: 5640,
    completionRate: 95.9,
    medianResponse: '51 sec',
    costAccuracy: 93,
    lastUpdated: new Date('2026-09-08'),
    version: '2.0.4',
    allowsCustomization: false,
  },
  {
    id: 'ds-whale-signal',
    type: 'worker',
    name: 'Whale Signal Analyst',
    tagline: 'Identifies wallet clusters and unusual accumulation patterns',
    description: 'Tracks large-wallet clustering, coordinated accumulation, and distribution signals across supported networks. Surfaces patterns that may precede material price movement. Research-only; no execution authority.',
    whatItDoes: ['Identify coordinated wallet clusters', 'Detect unusual accumulation/distribution patterns', 'Cross-reference cluster behaviour across networks', 'Produce evidence-backed pattern summaries'],
    whatItDoesNot: ['Execute trades', 'Guarantee signal accuracy', 'Access connected wallets'],
    creatorId: 'northstar-labs',
    creatorName: 'Northstar Labs',
    isOriginal: false,
    category: 'Research & Discovery',
    networks: ['Ethereum', 'Base', 'Solana'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Research & recommend only · No wallet authority',
    sponsored: false,
    jobsCompleted: 1284,
    completionRate: 94.1,
    medianResponse: '67 sec',
    costAccuracy: 91,
    lastUpdated: new Date('2026-08-28'),
    version: '1.4.0',
    allowsCustomization: true,
  },
  {
    id: 'ds-prediction-scout',
    type: 'worker',
    name: 'Prediction Scout',
    tagline: 'Researches prediction markets and probability changes',
    description: 'Monitors on-chain prediction markets, tracks probability shifts, and surfaces relevant evidence. Useful for governance events, sport outcomes, and macro markets. Research-only.',
    whatItDoes: ['Monitor on-chain prediction markets', 'Track probability shifts', 'Surface supporting and contrary evidence', 'Alert on material probability changes'],
    whatItDoesNot: ['Place bets autonomously', 'Execute financial actions', 'Predict outcomes with certainty'],
    creatorId: 'meridian-labs',
    creatorName: 'Meridian Labs',
    isOriginal: false,
    category: 'Research & Discovery',
    networks: ['Ethereum', 'Polygon'],
    pricing: { type: 'paid', label: '$12/month · Prototype price' },
    visibility: 'public',
    authorityDefault: 'Research & recommend only · No wallet authority',
    sponsored: true,
    jobsCompleted: 892,
    completionRate: 93.6,
    medianResponse: '55 sec',
    costAccuracy: 90,
    lastUpdated: new Date('2026-09-03'),
    version: '1.1.2',
    allowsCustomization: false,
  },
  // Workflows
  {
    id: 'ds-daily-portfolio-brief',
    type: 'workflow',
    name: 'Daily Portfolio Brief',
    tagline: 'Morning summary of overnight portfolio changes',
    description: 'Summarises material overnight changes across your watched holdings. Only escalates items above a configurable materiality threshold. Delivers a concise brief, not a full data dump.',
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Portfolio',
    networks: ['Ethereum', 'Arbitrum', 'Base', 'Solana', 'Polygon'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Read-only by default',
    sponsored: false,
    lastUpdated: new Date('2026-09-01'),
    version: '1.2.0',
    workflowPurpose: 'Summarise material overnight changes',
    workflowInputs: ['Portfolio/watch addresses', 'Prior baseline', 'Relevant market/onchain data'],
    workflowOutputs: ['Concise morning briefing'],
    workflowSteps: ['Read portfolio state', 'Compare against baseline', 'Identify material changes', 'Summarise evidence'],
    workflowCompatibleWorkers: ['Portfolio Guardian'],
  },
  {
    id: 'ds-yield-sweep',
    type: 'workflow',
    name: 'Yield Sweep',
    tagline: 'Evaluates stablecoin yield and proposes reallocation',
    description: 'Evaluates current stablecoin yield across major protocols and proposes reallocation where material improvement exists. Requires Stablecoin Manager and an active mandate to execute.',
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Yield & DeFi',
    networks: ['Ethereum', 'Arbitrum', 'Base'],
    pricing: { type: 'paid', label: 'Requires Stablecoin Manager subscription' },
    visibility: 'public',
    authorityDefault: 'Execution requires mandate',
    sponsored: false,
    lastUpdated: new Date('2026-09-05'),
    version: '1.0.3',
    workflowPurpose: 'Evaluate and propose stablecoin yield reallocation',
    workflowInputs: ['Agent Account balance', 'Current yield rates', 'Mandate limits'],
    workflowOutputs: ['Reallocation proposal or no-action confirmation'],
    workflowSteps: ['Read current positions', 'Fetch yield rates', 'Calculate net improvement', 'Prepare proposal if threshold met'],
    workflowCompatibleWorkers: ['Stablecoin Manager'],
  },
  {
    id: 'ds-smart-money-alert',
    type: 'workflow',
    name: 'Smart Money Alert',
    tagline: 'Notifies when tracked wallets move above your threshold',
    description: 'Watches tracked wallets and delivers real-time alerts when position changes exceed a configurable threshold. Research-only.',
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Research & Discovery',
    networks: ['Ethereum', 'Arbitrum', 'Base', 'Solana'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Read-only',
    sponsored: false,
    lastUpdated: new Date('2026-09-08'),
    version: '1.1.1',
    workflowPurpose: 'Alert when tracked wallets make material moves',
    workflowInputs: ['Wallet watch list', 'Movement threshold'],
    workflowOutputs: ['Alert with evidence summary'],
    workflowSteps: ['Monitor wallet activity', 'Compare to threshold', 'Surface alert when exceeded'],
    workflowCompatibleWorkers: ['Smart Money Tracker', 'Whale Signal Analyst'],
  },
  // Capabilities
  {
    id: 'ds-cap-token-market',
    type: 'capability',
    name: 'Token Market Data',
    tagline: 'Real-time price, volume, and market cap across major sources',
    description: 'Provides normalised token market data from multiple sources. Read-only. Used by research Workers.',
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Market Data',
    networks: ['Ethereum', 'Solana', 'Base', 'Arbitrum'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Read-only',
    sponsored: false,
    lastUpdated: new Date('2026-09-12'),
    version: '3.2.0',
    capabilityClassification: 'read',
    capabilityProvider: 'AgentPlace canonical',
  },
  {
    id: 'ds-cap-wallet-activity',
    type: 'capability',
    name: 'Wallet Activity',
    tagline: 'Normalised on-chain activity for any watched address',
    description: 'Returns normalised transaction history and position snapshots for any address. Read-only. Does not require wallet connection.',
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'Onchain Data',
    networks: ['Ethereum', 'Solana', 'Base', 'Arbitrum', 'Polygon'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Read-only',
    sponsored: false,
    lastUpdated: new Date('2026-09-12'),
    version: '2.1.4',
    capabilityClassification: 'read',
    capabilityProvider: 'AgentPlace canonical',
  },
  {
    id: 'ds-cap-dex-quote',
    type: 'capability',
    name: 'DEX Quote Preparation',
    tagline: 'Prepares structured unsigned swap proposals',
    description: 'Fetches quotes from multiple DEX sources and prepares an unsigned swap proposal. Does not execute. All execution still passes AgentPlace authority, wallet, and Action Review rules.',
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'DeFi',
    networks: ['Ethereum', 'Base', 'Arbitrum'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Prepare only · Execution-sensitive',
    sponsored: false,
    lastUpdated: new Date('2026-09-10'),
    version: '1.4.1',
    capabilityClassification: 'execution-sensitive',
    capabilityProvider: 'AgentPlace canonical',
  },
  {
    id: 'ds-cap-aave',
    type: 'capability',
    name: 'Aave Read + Prepare',
    tagline: 'Reads Aave positions and prepares supply/withdraw actions',
    description: 'Reads current Aave v3 positions across supported networks and can prepare unsigned supply or withdraw transactions. Actual execution requires mandate and Action Review.',
    creatorId: 'agentplace',
    creatorName: 'AgentPlace',
    isOriginal: true,
    category: 'DeFi',
    networks: ['Ethereum', 'Base', 'Arbitrum'],
    pricing: { type: 'free' },
    visibility: 'public',
    authorityDefault: 'Read + Prepare · Execution-sensitive',
    sponsored: false,
    lastUpdated: new Date('2026-09-07'),
    version: '2.0.1',
    capabilityClassification: 'execution-sensitive',
    capabilityProvider: 'AgentPlace canonical',
  },
];

// ── Billing fixtures ──────────────────────────────────────────────────────────

const MOCK_BILLING_ACCOUNT: BillingAccount = {
  planId: 'pro',
  planName: 'AgentPlace Pro',
  serviceBalanceUsd: 34.70,
  variableSpendThisMonthUsd: 12.46,
  billingPeriodStart: new Date('2026-09-01'),
  billingPeriodEnd: new Date('2026-09-30'),
  spendControls: {
    monthlyVariableLimitUsd: 50,
    singleJobThresholdUsd: 2.00,
  },
  paymentMethods: [
    { id: 'pm-card', type: 'card', label: 'Visa •••• 4242', isDefault: true },
  ],
  prototype: true,
};

const MOCK_BILLING_SUBSCRIPTIONS: BillingSubscription[] = [
  {
    id: 'sub-pro-plan',
    name: 'AgentPlace Pro',
    type: 'agentplace-plan',
    providerName: 'AgentPlace',
    priceLabel: 'Prototype plan · pricing not final',
    priceCentsMonthly: 0,
    cadence: 'monthly',
    status: 'active',
    nextChargeAt: new Date('2026-10-01'),
    prototype: true,
  },
  {
    id: 'sub-whale-signal',
    name: 'Whale Signal Analyst',
    type: 'community-worker',
    providerId: 'ds-whale-signal',
    providerName: 'Northstar Labs',
    priceLabel: '$12/month · Prototype price',
    priceCentsMonthly: 1200,
    cadence: 'monthly',
    status: 'active',
    nextChargeAt: new Date('2026-10-01'),
    prototype: true,
  },
];

const MOCK_BILLING_COST_ENTRIES: BillingCostEntry[] = [
  {
    id: 'cost-bridge-service',
    category: 'agentplace-service',
    amountUsd: 0.08,
    description: 'AgentPlace runtime · Bridge 500 USDC to Base',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    jobId: 'job-bridge',
    workerId: 'w-exec-operator',
    paidBy: 'service-balance',
    prototype: true,
  },
  {
    id: 'cost-bridge-fee',
    category: 'bridge-fee',
    amountUsd: 1.00,
    description: 'Bridge/provider fee · Arbitrum to Base · Across',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    jobId: 'job-bridge',
    paidBy: 'user-wallet',
    prototype: true,
  },
  {
    id: 'cost-bridge-gas',
    category: 'onchain-gas',
    amountUsd: 0.08,
    description: 'Arbitrum gas · Bridge tx',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    jobId: 'job-bridge',
    paidBy: 'user-wallet',
    prototype: true,
  },
  {
    id: 'cost-routine-service',
    category: 'agentplace-service',
    amountUsd: 0.04,
    description: 'AgentPlace/data service · Weekday stablecoin opportunity check',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    routineId: 'rtn-stable-check',
    workerId: 'w-stablecoin',
    paidBy: 'service-balance',
    prototype: true,
  },
  {
    id: 'cost-whale-sub',
    category: 'subscription',
    amountUsd: 12.00,
    description: 'Whale Signal Analyst · Monthly subscription',
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    subscriptionId: 'sub-whale-signal',
    paidBy: 'service-balance',
    prototype: true,
  },
];

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: AppState = {
  user: null,
  environment: 'mainnet',
  activeView: 'home',
  activeConversationId: null,
  activeWorkerId: null,
  activeJobId: null,
  activeWalletId: null,
  activeActionId: null,
  activeRoutineId: null,
  conversations: [],
  workers: [],
  jobs: [],
  outcomes: [],
  activityEvents: [],
  wallets: [],
  agentAccounts: [],
  mandates: [],
  authorityGrants: [],
  financialActions: [],
  attentionItems: [],
  routines: [],
  routineRuns: [],
  notifications: [],
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
  notificationInboxOpen: false,
  lastSeenAt: null,
  discoverSupply: MOCK_DISCOVER_SUPPLY,
  creatorAssets: [],
  activeCreatorSurface: null,
  activeCreationId: null,
  activeDiscoverItemId: null,
  billingAccount: null,
  billingSubscriptions: [],
  billingCostEntries: [],
  creatorEarnings: [],
  executionRecords: [],
  verifiedOutcomes: [],
  verifiedReceipts: [],
  activeReceiptId: null,
  autonomousExecutionPaused: false,
  financialSetupReturn: null,
  scenario: 'normal',
  showDemoControls: false,
  mobileDrawerOpen: false,
  showCreateMenu: false,
  showSearch: false,
  identityCheckpoint: null,
  routeNotFound: null,
};

// ── Actions ───────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'SET_USER'; user: User | null }
  | { type: 'SET_CONVERSATIONS'; conversations: Conversation[] }
  | { type: 'SET_VIEW'; view: NavView }
  | { type: 'SET_ENV'; env: Environment }
  | { type: 'SET_ACTIVE_CONV'; id: string | null }
  | { type: 'SET_ACTIVE_WORKER'; id: string | null }
  | { type: 'SET_ACTIVE_JOB'; id: string | null }
  | { type: 'SET_ACTIVE_WALLET'; id: string | null }
  | { type: 'SET_ACTIVE_ACTION'; id: string | null }
  | { type: 'ADD_CONV'; conv: Conversation }
  | { type: 'ADD_MSG'; convId: string; msg: ChatMessage }
  | { type: 'UPDATE_MSG'; convId: string; msgId: string; updates: Partial<ChatMessage> }
  | { type: 'AUTO_TITLE'; convId: string; title: string }
  | { type: 'RENAME_CONV'; convId: string; title: string }
  | { type: 'PIN_CONV'; convId: string; pinned: boolean }
  | { type: 'ARCHIVE_CONV'; convId: string }
  | { type: 'UNARCHIVE_CONV'; convId: string }
  | { type: 'ADD_WORKER'; worker: Worker }
  | { type: 'UPDATE_WORKER'; workerId: string; updates: Partial<Worker> }
  | { type: 'ADD_JOB'; job: Job }
  | { type: 'UPDATE_JOB'; jobId: string; updates: Partial<Job> }
  | { type: 'ADD_OUTCOME'; outcome: Outcome }
  | { type: 'ADD_ACTIVITY_EVENT'; event: ActivityEvent }
  | { type: 'UPDATE_ACTIVITY_EVENT'; eventId: string; updates: Partial<ActivityEvent> }
  | { type: 'ADD_WALLET'; wallet: WalletResource }
  | { type: 'UPDATE_WALLET'; walletId: string; updates: Partial<WalletResource> }
  | { type: 'CREATE_AGENT_ACCOUNT'; account: AgentAccount; wallet: WalletResource }
  | { type: 'UPDATE_AGENT_ACCOUNT'; accountId: string; updates: Partial<AgentAccount> }
  | { type: 'ADD_MANDATE'; mandate: Mandate }
  | { type: 'UPDATE_MANDATE'; mandateId: string; updates: Partial<Mandate> }
  | { type: 'ADD_AUTHORITY_GRANT'; grant: AuthorityGrant }
  | { type: 'UPDATE_AUTHORITY_GRANT'; grantId: string; updates: Partial<AuthorityGrant> }
  | { type: 'REVOKE_AUTHORITY_GRANT'; grantId: string }
  | { type: 'ADD_FINANCIAL_ACTION'; action: FinancialAction }
  | { type: 'UPDATE_FINANCIAL_ACTION'; actionId: string; updates: Partial<FinancialAction> }
  | { type: 'ADD_ATTENTION_ITEM'; item: AttentionItem }
  | { type: 'REMOVE_ATTENTION_ITEM'; itemId: string }
  | { type: 'SET_AUTONOMOUS_EXECUTION_PAUSED'; paused: boolean }
  | { type: 'SET_FINANCIAL_SETUP_RETURN'; context: FinancialSetupReturn | null }
  | { type: 'SET_SCENARIO'; scenario: Scenario }
  | { type: 'TOGGLE_DEMO' }
  | { type: 'SET_MOBILE_DRAWER'; open: boolean }
  | { type: 'SET_SHOW_CREATE'; show: boolean }
  | { type: 'SET_SHOW_SEARCH'; show: boolean }
  | { type: 'SET_IDENTITY_CHECKPOINT'; checkpoint: IdentityCheckpoint | null }
  | { type: 'ADD_EXECUTION_RECORD'; record: ExecutionRecord }
  | { type: 'UPDATE_EXECUTION_RECORD'; recordId: string; updates: Partial<ExecutionRecord> }
  | { type: 'ADD_VERIFIED_OUTCOME'; outcome: VerifiedOutcome }
  | { type: 'ADD_VERIFIED_RECEIPT'; receipt: VerifiedReceipt }
  | { type: 'SET_ACTIVE_RECEIPT'; id: string | null }
  | { type: 'ADD_ROUTINE'; routine: Routine }
  | { type: 'UPDATE_ROUTINE'; routineId: string; updates: Partial<Routine> }
  | { type: 'SET_ACTIVE_ROUTINE'; id: string | null }
  | { type: 'ADD_ROUTINE_RUN'; run: RoutineRun }
  | { type: 'ADD_NOTIFICATION'; notification: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'SET_NOTIFICATION_INBOX_OPEN'; open: boolean }
  | { type: 'UPDATE_NOTIFICATION_PREFERENCES'; updates: Partial<NotificationPreferences> }
  | { type: 'SET_ACTIVE_DISCOVER_ITEM'; id: string | null }
  | { type: 'SET_CREATOR_SURFACE'; surface: ActiveCreatorSurface }
  | { type: 'SET_ACTIVE_CREATION'; id: string | null }
  | { type: 'ADD_CREATOR_ASSET'; asset: CreatorAsset }
  | { type: 'UPDATE_CREATOR_ASSET'; assetId: string; updates: Partial<CreatorAsset> }
  | { type: 'ADD_DISCOVER_SUPPLY_ITEM'; item: DiscoverSupplyItem }
  | { type: 'UPDATE_DISCOVER_SUPPLY_ITEM'; itemId: string; updates: Partial<DiscoverSupplyItem> }
  | { type: 'UPDATE_BILLING_ACCOUNT'; updates: Partial<BillingAccount> }
  | { type: 'ADD_BILLING_SUBSCRIPTION'; subscription: BillingSubscription }
  | { type: 'UPDATE_BILLING_SUBSCRIPTION'; subscriptionId: string; updates: Partial<BillingSubscription> }
  | { type: 'ADD_BILLING_COST_ENTRY'; entry: BillingCostEntry }
  | { type: 'ADD_CREATOR_EARNING'; entry: CreatorEarningEntry }
  | { type: 'REVOKE_ALL_AUTHORITY' }
  | { type: 'HYDRATE_ROUTE'; route: RouteSelection }
  | { type: 'RESET_GUEST' }
  | { type: 'RESET_ACTIVE' };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE_ROUTE':
      return applyRouteSelection(state, action.route);

    case 'SET_USER':
      return { ...state, user: action.user, identityCheckpoint: null };

    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.conversations };

    case 'SET_VIEW':
      return {
        ...state,
        activeView: action.view,
        activeConversationId: null,
        activeWorkerId: null,
        activeJobId: null,
        activeWalletId: null,
        activeRoutineId: null,
        activeActionId: null,
        activeCreatorSurface: null,
        activeDiscoverItemId: null,
        routeNotFound: null,
      };

    case 'SET_ENV':
      return { ...state, environment: action.env };

    case 'SET_ACTIVE_CONV':
      return {
        ...state,
        activeConversationId: action.id,
        activeWorkerId: null,
        activeJobId: null,
        activeWalletId: null,
        activeActionId: null,
        activeDiscoverItemId: null,
        activeCreatorSurface: null,
        routeNotFound: null,
      };

    case 'SET_ACTIVE_WORKER':
      return {
        ...state,
        activeWorkerId: action.id,
        activeJobId: null,
        activeConversationId: null,
        activeWalletId: null,
        activeActionId: null,
        routeNotFound: null,
      };

    case 'SET_ACTIVE_JOB':
      return { ...state, activeJobId: action.id, activeActionId: null, routeNotFound: null };

    case 'SET_ACTIVE_WALLET':
      return { ...state, activeWalletId: action.id, routeNotFound: null };

    case 'SET_ACTIVE_ACTION':
      return { ...state, activeActionId: action.id };

    case 'ADD_CONV':
      return {
        ...state,
        conversations: [action.conv, ...state.conversations],
        activeConversationId: action.conv.id,
        activeWorkerId: null,
        activeJobId: null,
        activeWalletId: null,
        activeActionId: null,
        routeNotFound: null,
      };

    case 'ADD_MSG':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId
            ? { ...c, messages: [...c.messages, action.msg], updatedAt: new Date() }
            : c
        ),
      };

    case 'UPDATE_MSG':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === action.msgId ? { ...m, ...action.updates } : m
                ),
              }
            : c
        ),
      };

    case 'AUTO_TITLE':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId && !c.manuallyRenamed
            ? { ...c, title: action.title }
            : c
        ),
      };

    case 'RENAME_CONV':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId
            ? { ...c, title: action.title, manuallyRenamed: true }
            : c
        ),
      };

    case 'PIN_CONV':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId ? { ...c, pinned: action.pinned } : c
        ),
      };

    case 'ARCHIVE_CONV':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId ? { ...c, archived: true } : c
        ),
        activeConversationId:
          state.activeConversationId === action.convId ? null : state.activeConversationId,
      };

    case 'UNARCHIVE_CONV':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId ? { ...c, archived: false } : c
        ),
      };

    case 'ADD_WORKER':
      return {
        ...state,
        workers: state.workers.some((w) => w.id === action.worker.id)
          ? state.workers
          : [...state.workers, action.worker],
      };

    case 'UPDATE_WORKER':
      return {
        ...state,
        workers: (state.workers ?? []).map((w) =>
          w.id === action.workerId ? { ...w, ...action.updates } : w
        ),
      };

    case 'ADD_JOB':
      return { ...state, jobs: [action.job, ...(state.jobs ?? [])] };

    case 'UPDATE_JOB':
      return {
        ...state,
        jobs: (state.jobs ?? []).map((j) =>
          j.id === action.jobId ? { ...j, ...action.updates, updatedAt: new Date() } : j
        ),
      };

    case 'ADD_OUTCOME':
      return { ...state, outcomes: [action.outcome, ...(state.outcomes ?? [])] };

    case 'ADD_ACTIVITY_EVENT':
      return { ...state, activityEvents: [action.event, ...(state.activityEvents ?? [])] };

    case 'UPDATE_ACTIVITY_EVENT':
      return {
        ...state,
        activityEvents: (state.activityEvents ?? []).map((e) =>
          e.id === action.eventId ? { ...e, ...action.updates } : e
        ),
      };

    case 'ADD_WALLET':
      return { ...state, wallets: [action.wallet, ...(state.wallets ?? [])] };

    case 'UPDATE_WALLET':
      return {
        ...state,
        wallets: (state.wallets ?? []).map((w) =>
          w.id === action.walletId ? { ...w, ...action.updates } : w
        ),
      };

    case 'CREATE_AGENT_ACCOUNT':
      return {
        ...state,
        agentAccounts: [...(state.agentAccounts ?? []), action.account],
        wallets: [...(state.wallets ?? []), action.wallet],
      };

    case 'UPDATE_AGENT_ACCOUNT':
      return {
        ...state,
        agentAccounts: (state.agentAccounts ?? []).map((a) =>
          a.id === action.accountId ? { ...a, ...action.updates } : a
        ),
      };

    case 'ADD_MANDATE':
      return { ...state, mandates: [...(state.mandates ?? []), action.mandate] };

    case 'UPDATE_MANDATE':
      return {
        ...state,
        mandates: (state.mandates ?? []).map((m) =>
          m.id === action.mandateId ? { ...m, ...action.updates } : m
        ),
      };

    case 'ADD_AUTHORITY_GRANT':
      return { ...state, authorityGrants: [...(state.authorityGrants ?? []), action.grant] };

    case 'UPDATE_AUTHORITY_GRANT':
      return {
        ...state,
        authorityGrants: (state.authorityGrants ?? []).map((g) =>
          g.id === action.grantId ? { ...g, ...action.updates } : g
        ),
      };

    case 'REVOKE_AUTHORITY_GRANT':
      return {
        ...state,
        authorityGrants: (state.authorityGrants ?? []).map((g) =>
          g.id === action.grantId ? { ...g, status: 'revoked' } : g
        ),
      };

    case 'ADD_FINANCIAL_ACTION':
      return { ...state, financialActions: [action.action, ...(state.financialActions ?? [])] };

    case 'UPDATE_FINANCIAL_ACTION':
      return {
        ...state,
        financialActions: (state.financialActions ?? []).map((a) =>
          a.id === action.actionId ? { ...a, ...action.updates } : a
        ),
      };

    case 'ADD_ATTENTION_ITEM':
      return { ...state, attentionItems: [action.item, ...(state.attentionItems ?? [])] };

    case 'REMOVE_ATTENTION_ITEM':
      return {
        ...state,
        attentionItems: (state.attentionItems ?? []).filter((i) => i.id !== action.itemId),
      };

    case 'SET_AUTONOMOUS_EXECUTION_PAUSED':
      return { ...state, autonomousExecutionPaused: action.paused };

    case 'SET_FINANCIAL_SETUP_RETURN':
      return { ...state, financialSetupReturn: action.context };

    case 'SET_SCENARIO':
      return { ...state, scenario: action.scenario };

    case 'TOGGLE_DEMO':
      return { ...state, showDemoControls: !state.showDemoControls };

    case 'SET_MOBILE_DRAWER':
      return { ...state, mobileDrawerOpen: action.open };

    case 'SET_SHOW_CREATE':
      return { ...state, showCreateMenu: action.show, routeNotFound: null };

    case 'SET_SHOW_SEARCH':
      return { ...state, showSearch: action.show };

    case 'SET_IDENTITY_CHECKPOINT':
      return { ...state, identityCheckpoint: action.checkpoint };

    case 'SET_ACTIVE_DISCOVER_ITEM':
      return { ...state, activeDiscoverItemId: action.id, routeNotFound: null };

    case 'SET_CREATOR_SURFACE':
      return { ...state, activeCreatorSurface: action.surface, activeConversationId: null, activeWorkerId: null, activeJobId: null, activeRoutineId: null, routeNotFound: null };

    case 'SET_ACTIVE_CREATION':
      return { ...state, activeCreationId: action.id };

    case 'ADD_CREATOR_ASSET':
      return { ...state, creatorAssets: [action.asset, ...(state.creatorAssets ?? [])] };

    case 'UPDATE_CREATOR_ASSET':
      return {
        ...state,
        creatorAssets: (state.creatorAssets ?? []).map((a) =>
          a.id === action.assetId ? { ...a, ...action.updates, updatedAt: new Date() } : a
        ),
      };

    case 'ADD_DISCOVER_SUPPLY_ITEM':
      return { ...state, discoverSupply: [...(state.discoverSupply ?? []), action.item] };

    case 'UPDATE_DISCOVER_SUPPLY_ITEM':
      return {
        ...state,
        discoverSupply: (state.discoverSupply ?? []).map((s) =>
          s.id === action.itemId ? { ...s, ...action.updates } : s
        ),
      };

    case 'UPDATE_BILLING_ACCOUNT':
      return {
        ...state,
        billingAccount: state.billingAccount
          ? { ...state.billingAccount, ...action.updates }
          : ({ ...MOCK_BILLING_ACCOUNT, ...action.updates } as BillingAccount),
      };

    case 'ADD_BILLING_SUBSCRIPTION':
      return {
        ...state,
        billingSubscriptions: [...(state.billingSubscriptions ?? []), action.subscription],
      };

    case 'UPDATE_BILLING_SUBSCRIPTION':
      return {
        ...state,
        billingSubscriptions: (state.billingSubscriptions ?? []).map((s) =>
          s.id === action.subscriptionId ? { ...s, ...action.updates } : s
        ),
      };

    case 'ADD_BILLING_COST_ENTRY':
      return {
        ...state,
        billingCostEntries: [action.entry, ...(state.billingCostEntries ?? [])],
      };

    case 'ADD_CREATOR_EARNING':
      return {
        ...state,
        creatorEarnings: [action.entry, ...(state.creatorEarnings ?? [])],
      };

    case 'REVOKE_ALL_AUTHORITY':
      return {
        ...state,
        authorityGrants: (state.authorityGrants ?? []).map((g) =>
          g.status === 'active' || g.status === 'paused' ? { ...g, status: 'revoked' as const } : g
        ),
        activityEvents: [
          {
            id: uid(),
            eventType: 'security' as const,
            title: 'All AgentPlace authority revoked',
            summary: 'Emergency control · All standing financial authority removed',
            effect: 'New autonomous financial actions stopped. Research and monitoring continue. Wallets, Workers, Routines, and history remain.',
            timestamp: new Date(),
            status: 'complete',
          },
          ...(state.activityEvents ?? []),
        ],
      };

    case 'RESET_GUEST':
      return { ...INITIAL_STATE };

    case 'ADD_EXECUTION_RECORD':
      return { ...state, executionRecords: [...(state.executionRecords ?? []), action.record] };

    case 'UPDATE_EXECUTION_RECORD':
      return {
        ...state,
        executionRecords: (state.executionRecords ?? []).map((r) =>
          r.id === action.recordId ? { ...r, ...action.updates, updatedAt: new Date() } : r
        ),
      };

    case 'ADD_VERIFIED_OUTCOME':
      return { ...state, verifiedOutcomes: [...(state.verifiedOutcomes ?? []), action.outcome] };

    case 'ADD_VERIFIED_RECEIPT':
      return { ...state, verifiedReceipts: [...(state.verifiedReceipts ?? []), action.receipt] };

    case 'SET_ACTIVE_RECEIPT':
      return { ...state, activeReceiptId: action.id };

    case 'ADD_ROUTINE':
      return { ...state, routines: [action.routine, ...(state.routines ?? [])] };

    case 'UPDATE_ROUTINE':
      return {
        ...state,
        routines: (state.routines ?? []).map((r) =>
          r.id === action.routineId ? { ...r, ...action.updates, updatedAt: new Date() } : r
        ),
      };

    case 'SET_ACTIVE_ROUTINE':
      return { ...state, activeRoutineId: action.id, routeNotFound: null };

    case 'ADD_ROUTINE_RUN':
      return { ...state, routineRuns: [action.run, ...(state.routineRuns ?? [])] };

    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.notification, ...(state.notifications ?? [])] };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: (state.notifications ?? []).map((n) =>
          n.id === action.id ? { ...n, read: true } : n
        ),
      };

    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: (state.notifications ?? []).map((n) => ({ ...n, read: true })),
      };

    case 'SET_NOTIFICATION_INBOX_OPEN':
      return { ...state, notificationInboxOpen: action.open };

    case 'UPDATE_NOTIFICATION_PREFERENCES':
      return {
        ...state,
        notificationPreferences: { ...state.notificationPreferences, ...action.updates },
      };

    case 'RESET_ACTIVE':
      return {
        ...INITIAL_STATE,
        user: MOCK_USER,
        workers: MOCK_WORKERS,
        conversations: MOCK_CONVERSATIONS,
        outcomes: MOCK_OUTCOMES,
        activityEvents: [
          ...MOCK_ACTIVITY,
          {
            id: 'act-rtn-stable-activated',
            eventType: 'routine' as const,
            title: 'Weekday stablecoin opportunity check activated',
            summary: 'Routine · Stablecoin Manager',
            workerId: 'w-stablecoin',
            workerName: 'Stablecoin Manager',
            routineId: 'rtn-stable-check',
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 1000),
            status: 'complete',
          },
          {
            id: 'act-rtn-bonk-activated',
            eventType: 'routine' as const,
            title: 'BONK smart-money watch activated',
            summary: 'Routine · Meme Scout',
            workerId: 'w-memescout',
            workerName: 'Meme Scout',
            routineId: 'rtn-bonk-watch',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            status: 'complete',
          },
          {
            id: 'act-bonk-monitoring',
            eventType: 'routine' as const,
            title: 'Meme Scout watched BONK today',
            summary: '24 checks · Material smart-money change detected',
            workerId: 'w-memescout',
            workerName: 'Meme Scout',
            routineId: 'rtn-bonk-watch',
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
            status: 'complete',
          },
          {
            id: 'act-stable-monitoring',
            eventType: 'routine' as const,
            title: 'Stablecoin Manager completed scheduled checks',
            summary: '3 checks · No net improvement above 1% threshold',
            workerId: 'w-stablecoin',
            workerName: 'Stablecoin Manager',
            routineId: 'rtn-stable-check',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
            status: 'complete',
          },
          {
            id: 'act-sec-authority-activated',
            eventType: 'security' as const,
            title: 'Stablecoin Manager authority activated',
            summary: 'Main Agent Account · Mainnet · 1,500 USDC · Base · Arbitrum',
            effect: 'New autonomous financial actions enabled within mandate.',
            workerName: 'Stablecoin Manager',
            workerId: 'w-stablecoin',
            grantId: 'grant-stable',
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            status: 'complete',
          },
          {
            id: 'act-sec-blocked',
            eventType: 'security' as const,
            title: 'Action blocked by rules',
            summary: 'Proposed leverage position · Blocked · No leverage permitted in mandate',
            effect: 'Nothing was submitted. No funds moved.',
            workerName: 'Stablecoin Manager',
            workerId: 'w-stablecoin',
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            status: 'blocked',
          },
        ],
        wallets: MOCK_WALLETS,
        agentAccounts: MOCK_AGENT_ACCOUNTS,
        mandates: MOCK_MANDATES,
        authorityGrants: MOCK_AUTHORITY_GRANTS,
        routineRuns: MOCK_ROUTINE_RUNS,
        notifications: MOCK_NOTIFICATIONS,
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        notificationInboxOpen: false,
        lastSeenAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        discoverSupply: MOCK_DISCOVER_SUPPLY,
        creatorAssets: [],
        activeCreatorSurface: null,
        activeCreationId: null,
        activeDiscoverItemId: null,
        billingAccount: MOCK_BILLING_ACCOUNT,
        billingSubscriptions: MOCK_BILLING_SUBSCRIPTIONS,
        billingCostEntries: MOCK_BILLING_COST_ENTRIES,
        creatorEarnings: [],
        executionRecords: [],
        verifiedOutcomes: [],
        verifiedReceipts: [],
        activeReceiptId: null,
        activeRoutineId: null,
        routines: MOCK_ROUTINES.map((r) =>
          r.id === 'rtn-stable-check'
            ? { ...r, serviceBudgetStructured: { limitUsd: 5, spentUsd: 1.80, periodDays: 30, status: 'ok' as const } }
            : r
        ),
      };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const StateCtx = createContext<AppState | null>(null);
const DispatchCtx = createContext<React.Dispatch<Action> | null>(null);

function initializeState(base: AppState): AppState {
  const restored = restoreFixtureState(base);
  if (typeof window === 'undefined') return restored;
  return applyRouteSelection(restored, routeSelectionFromPath(window.location.pathname));
}

function userFromAuth(user: { id: string; name: string; email: string }): User {
  const name = user.name || user.email.split('@')[0] || 'AgentPlace user';
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AP';
  return { id: user.id, name, email: user.email, initials };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, INITIAL_STATE, initializeState);
  const stateRef = useRef(state);
  const pendingPathRef = useRef<string | null>(null);
  const routeFlushScheduledRef = useRef(false);
  const apiBootstrapRef = useRef(false);
  stateRef.current = state;

  const refreshDurableConversations = useCallback(async () => {
    if (WEB_RUNTIME_SETTINGS.dataMode !== 'api') return;
    const conversations = await fetchConversations();
    rawDispatch({ type: 'SET_CONVERSATIONS', conversations });
  }, []);

  const syncConversationAction = useCallback((action: Action, before: AppState, after: AppState) => {
    if (WEB_RUNTIME_SETTINGS.dataMode !== 'api' || !before.user) return;
    let task: Promise<unknown> | null = null;
    if (action.type === 'ADD_CONV') task = createDurableConversation(action.conv);
    if (action.type === 'ADD_MSG') task = addDurableMessage(action.convId, action.msg);
    if (action.type === 'UPDATE_MSG') {
      const message = after.conversations.find((c) => c.id === action.convId)?.messages.find((m) => m.id === action.msgId);
      if (message) task = updateDurableMessage(action.convId, message);
    }
    if (action.type === 'AUTO_TITLE') task = patchDurableConversation(action.convId, { title: action.title, titleSource: 'auto' });
    if (action.type === 'RENAME_CONV') task = patchDurableConversation(action.convId, { title: action.title, titleSource: 'user' });
    if (action.type === 'PIN_CONV') task = patchDurableConversation(action.convId, { pinned: action.pinned });
    if (action.type === 'ARCHIVE_CONV') task = patchDurableConversation(action.convId, { archived: true });
    if (action.type === 'UNARCHIVE_CONV') task = patchDurableConversation(action.convId, { archived: false });
    if (task) task.catch(() => void refreshDurableConversations());
  }, [refreshDurableConversations]);

  const dispatch = useCallback<React.Dispatch<Action>>((action) => {
    const before = stateRef.current;
    if (action.type === 'SET_USER' && action.user === null && before.user && WEB_RUNTIME_SETTINGS.dataMode === 'api') {
      const guest = { ...INITIAL_STATE, environment: before.environment };
      stateRef.current = guest;
      rawDispatch({ type: 'RESET_GUEST' });
      clearFixtureState();
      void signOutAuth().catch(() => undefined);
      if (typeof window !== 'undefined' && window.location.pathname !== '/') window.history.pushState(null, '', '/');
      return;
    }

    const next = reducer(before, action);
    stateRef.current = next;
    rawDispatch(action);

    if (action.type === 'RESET_GUEST') clearFixtureState();
    syncConversationAction(action, before, next);

    if (typeof window !== 'undefined' && action.type !== 'HYDRATE_ROUTE' && isNavigationAction(action.type)) {
      pendingPathRef.current = pathForState(next);
      if (!routeFlushScheduledRef.current) {
        routeFlushScheduledRef.current = true;
        queueMicrotask(() => {
          routeFlushScheduledRef.current = false;
          const path = pendingPathRef.current;
          pendingPathRef.current = null;
          if (path && window.location.pathname !== path) window.history.pushState(null, '', path);
        });
      }
    }
  }, [syncConversationAction]);

  useEffect(() => {
    persistFixtureState(state);
  }, [state]);

  useEffect(() => {
    if (WEB_RUNTIME_SETTINGS.dataMode !== 'api' || apiBootstrapRef.current) return;
    apiBootstrapRef.current = true;
    void (async () => {
      try {
        const authUser = await getAuthenticatedUser();
        if (!authUser) return;
        const marker = readIdentityResume();
        const guestConversation = marker?.persistOriginatingConversation && marker.conversationId
          ? stateRef.current.conversations.find((c) => c.id === marker.conversationId)
          : undefined;
        if (guestConversation) await importGuestConversations([guestConversation]);
        const [conversations, identity] = await Promise.all([fetchConversations(), getAgentPlaceIdentity()]);
        const user = userFromAuth(identity);
        const nextUser = reducer(stateRef.current, { type: 'SET_USER', user });
        const next = reducer(nextUser, { type: 'SET_CONVERSATIONS', conversations });
        stateRef.current = next;
        rawDispatch({ type: 'SET_USER', user });
        rawDispatch({ type: 'SET_CONVERSATIONS', conversations });
        clearFixtureState();
        clearIdentityResume();
      } catch (error) {
        console.error('AgentPlace identity bootstrap failed', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handlePopState = () => {
      const route = routeSelectionFromPath(window.location.pathname);
      const next = applyRouteSelection(stateRef.current, route);
      stateRef.current = next;
      rawDispatch({ type: 'HYDRATE_ROUTE', route });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!WEB_RUNTIME_SETTINGS.demoControlsEnabled && state.showDemoControls) rawDispatch({ type: 'TOGGLE_DEMO' });
  }, [state.showDemoControls]);

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(StateCtx);
  if (!ctx) throw new Error('useAppState must be inside AppProvider');
  return ctx;
}

export function useDispatch(): React.Dispatch<Action> {
  const ctx = useContext(DispatchCtx);
  if (!ctx) throw new Error('useDispatch must be inside AppProvider');
  return ctx;
}

// ── Worker factory ────────────────────────────────────────────────────────────

export function makeMemeScoutWorker(): Worker {
  return {
    id: 'w-memescout',
    name: 'Meme Scout',
    tagline: 'Monitors meme coin opportunities across Solana and EVM chains',
    status: 'monitoring',
    isOriginal: true,
    responsibility:
      'Meme Scout researches and monitors meme-token opportunities across supported ecosystems and surfaces material changes.',
    authoritySummary: 'Research & recommend only · No wallet authority',
    currentFocus: 'BONK and broader Solana meme opportunities',
  };
}

// ── Mock BONK research flow ───────────────────────────────────────────────────

const BONK_RESEARCH_CONTENT = `## BONK · Solana Meme Token

**Current snapshot** $0.0000235 per token · Market cap $1.24B · Rank #42 on CoinGecko · Solana network

**Price action (7 days)** +12.4% · Volume up 340% over the past 3 days · Outperforming SOL (+4.2%) over the same period

**Smart money signals** Three wallets with >$5M exposure accumulated during the last 72h. Two mid-tier holders slightly reduced their positions. Net smart-money flow is modest accumulation — not a strong conviction signal.

**Community velocity** Twitter/X followers +47k this week. Telegram daily active users up 28%. Sentiment broadly positive, with some debate over Bonk Eco Fund grant allocations.

**Ecosystem context** The Bonk Eco Fund has distributed to 25+ Solana projects. BONK is integrated in gaming, payments, and NFT contexts. Listed on Binance Futures (January 2024) and six tier-1 centralised exchanges.

**Risk signals** High beta to SOL price movements. Sentiment-driven — no protocol fundamentals. Top 10 wallets hold approximately 18% of supply. Historically volatile during broader market corrections.

**Assessment** Among established Solana meme tokens, BONK has more ecosystem integration than most. The current volume spike appears driven by broader Solana momentum rather than a BONK-specific catalyst. Smart money signals are mildly positive.`;

const BONK_MANAGER_SYNTHESIS = `BONK has more ecosystem depth than a typical meme token — the Bonk Eco Fund and exchange coverage give it structural staying power that pure narrative coins lack. That said, the fundamentals remain sentiment-driven and the current volume spike looks tied to broader Solana momentum.

Want me to set up ongoing monitoring through Meme Scout, or is there a specific angle — smart money tracking, entry signals, or ecosystem developments — you would like to dig into?`;

export function runBonkResearchFlow(dispatch: React.Dispatch<Action>, convId: string) {
  const managerMsgId = uid();
  const specialistMsgId = uid();
  const synthMsgId = uid();

  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: managerMsgId, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId: managerMsgId,
      updates: {
        content: "I'll research BONK for you. Let me bring in Meme Scout — our specialist for meme coin analysis across Solana and EVM chains.",
        isStreaming: false,
      },
    });
  }, 900);

  setTimeout(() => {
    dispatch({
      type: 'ADD_MSG',
      convId,
      msg: {
        id: specialistMsgId,
        role: 'specialist',
        specialist: { name: 'Meme Scout', role: 'Meme coin analyst' },
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      },
    });
  }, 1400);

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId: specialistMsgId,
      updates: { content: BONK_RESEARCH_CONTENT, isStreaming: false },
    });
  }, 3200);

  setTimeout(() => {
    dispatch({
      type: 'ADD_MSG',
      convId,
      msg: { id: synthMsgId, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
    });
  }, 3800);

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId: synthMsgId,
      updates: { content: BONK_MANAGER_SYNTHESIS, isStreaming: false },
    });
  }, 5200);

  setTimeout(() => {
    dispatch({ type: 'AUTO_TITLE', convId, title: 'BONK Research · Solana' });
  }, 5500);
}

// ── Stablecoin research flow ──────────────────────────────────────────────────

const STABLECOIN_YIELD_CONTENT = `## Current USDC Yield — Prototype data

**Aave v3 (Base)** 4.8% APY · Largest TVL · Battle-tested · Instant liquidity

**Morpho (Base)** 6.1% APY · Peer-to-peer matching above Aave · Same withdrawal speed

**Spark (Ethereum)** 5.2% APY · MakerDAO-backed · Ethereum mainnet only · DAI/USDS focus

All figures are 7-day average rates. Actual yields fluctuate with supply/demand. These are illustrative prototype rates — not live data.

**Context** The Morpho/Aave spread on Base has been consistent over 3 weeks. Spark yields reflect the DAI Savings Rate and may move when MakerDAO adjusts policy. No protocol listed has experienced a material security incident in the past 12 months.`;

const STABLECOIN_MODE_INTRO = `Based on those yields, a reallocation from Aave to Morpho on Base could improve returns by approximately 1.3% APY on idle capital.

How do you want to operate?`;

export function runStablecoinResearchFlow(dispatch: React.Dispatch<Action>, convId: string) {
  const intro1Id = uid();
  const specialistId = uid();
  const modeSelectId = uid();

  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: intro1Id, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId: intro1Id,
      updates: {
        content: "I'll pull current USDC yield data across leading protocols. No wallet connection needed for research.",
        isStreaming: false,
      },
    });
  }, 900);

  setTimeout(() => {
    dispatch({
      type: 'ADD_MSG',
      convId,
      msg: {
        id: specialistId,
        role: 'specialist',
        specialist: { name: 'Stablecoin Manager', role: 'Yield analyst' },
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      },
    });
  }, 1400);

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId: specialistId,
      updates: { content: STABLECOIN_YIELD_CONTENT, isStreaming: false },
    });
  }, 3000);

  setTimeout(() => {
    dispatch({
      type: 'ADD_MSG',
      convId,
      msg: {
        id: modeSelectId,
        role: 'manager',
        content: STABLECOIN_MODE_INTRO,
        timestamp: new Date(),
        isStreaming: false,
        uiCard: 'stablecoin-mode-select',
      },
    });
  }, 3600);

  setTimeout(() => {
    dispatch({ type: 'AUTO_TITLE', convId, title: 'Stablecoin yield optimisation' });
  }, 4000);
}

// ── Portfolio watch flow ──────────────────────────────────────────────────────

export function runPortfolioWatchFlow(dispatch: React.Dispatch<Action>, convId: string) {
  const msg1Id = uid();
  const msg2Id = uid();

  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: msg1Id, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId: msg1Id,
      updates: {
        content: "I can analyse any public address — no wallet connection needed. I'll watch it across all relevant EVM networks automatically. An EVM address works across Ethereum, Base, Arbitrum, Polygon, and other supported chains.",
        isStreaming: false,
      },
    });
  }, 900);

  setTimeout(() => {
    dispatch({
      type: 'ADD_MSG',
      convId,
      msg: {
        id: msg2Id,
        role: 'manager',
        content: "Share the address below and give it a name — something like Main Wallet, Cold Storage, or DAO Treasury.",
        timestamp: new Date(),
        isStreaming: false,
        uiCard: 'watch-address-form',
      },
    });
  }, 1600);

  setTimeout(() => {
    dispatch({ type: 'AUTO_TITLE', convId, title: 'Portfolio watch setup' });
  }, 2000);
}

// ── Perps flow ────────────────────────────────────────────────────────────────

export function runPerpsFlow(dispatch: React.Dispatch<Action>, convId: string) {
  const msg1Id = uid();
  const msg2Id = uid();

  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: msg1Id, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId: msg1Id,
      updates: {
        content: `Leveraged positions amplify both gains and losses. Before we proceed, the key risks for a 2× ETH long:

**Liquidation** At 2× leverage, a ~45% adverse move triggers liquidation of your collateral. Perps liquidation is instant and irreversible.

**Funding rate** Perpetual contracts pay ongoing funding — longs pay shorts when the market is net long. At elevated rates, carrying cost matters significantly for longer holds.

**Slippage** Large positions on smaller perps venues move the market. Entry and exit prices may differ materially from the estimate.

**Max acceptable loss** You decide this before the position is opened — AgentPlace will not open without an explicit limit from you.

I've prepared an Action Review for a 2× ETH long. Review the parameters before anything is submitted.`,
        isStreaming: false,
      },
    });
  }, 1200);

  setTimeout(() => {
    dispatch({
      type: 'ADD_MSG',
      convId,
      msg: {
        id: msg2Id,
        role: 'manager',
        content: "This is a prototype position for review — nothing will be submitted. The Action Review explains exactly what would happen, what authority covers it, and what could go wrong.",
        timestamp: new Date(),
        isStreaming: false,
        uiCard: 'perps-action-trigger',
      },
    });
  }, 2000);

  setTimeout(() => {
    dispatch({ type: 'AUTO_TITLE', convId, title: 'ETH 2× long — Action Review' });
  }, 2400);
}

// ── Generic manager response ──────────────────────────────────────────────────

export function runGenericManagerResponse(
  dispatch: React.Dispatch<Action>,
  convId: string,
  userMessage: string
) {
  if (/bonk/i.test(userMessage)) {
    runBonkResearchFlow(dispatch, convId);
    return;
  }

  if (/stable|usdc|usdt|dai|yield/i.test(userMessage)) {
    runStablecoinResearchFlow(dispatch, convId);
    return;
  }

  if (/bridge|cross.chain|arbitrum.*base|base.*arbitrum/i.test(userMessage)) {
    runBridgeFlow(dispatch, convId);
    return;
  }

  if (/portfolio|balance|holdings|watch.*address|wallet.*address/i.test(userMessage)) {
    runPortfolioWatchFlow(dispatch, convId);
    return;
  }

  if (/perp|leverag|long|short|2x|3x/i.test(userMessage)) {
    runPerpsFlow(dispatch, convId);
    return;
  }

  const msgId = uid();
  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: msgId, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });

  const isMeme = /meme|doge|pepe|wif|shib|popcat/i.test(userMessage);
  const isBridge = /bridge|transfer|cross.chain/i.test(userMessage);

  let response = '';
  let autoTitle = '';

  if (isMeme) {
    response = "I can research meme tokens for you. Tell me which token you're interested in — or I can ask Meme Scout to surface current opportunities across Solana and EVM chains.";
    autoTitle = 'Meme token research';
  } else if (isBridge || /bridge.*500.*usdc|usdc.*bridge.*arbitrum|arbitrum.*base/i.test(userMessage)) {
    runBridgeFlow(dispatch, convId);
    return;
  } else {
    response = "Understood. I can research, monitor, and help you act across crypto — staying within whatever rules you set. Tell me more about what you want to accomplish and I'll put together the right approach.";
    autoTitle = 'New conversation';
  }

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId,
      updates: { content: response, isStreaming: false },
    });
  }, 1200);

  setTimeout(() => {
    dispatch({ type: 'AUTO_TITLE', convId, title: autoTitle });
  }, 1600);
}

// ── Bridge flow ───────────────────────────────────────────────────────────────

export function runBridgeFlow(dispatch: React.Dispatch<Action>, convId: string) {
  const msg1Id = uid();
  const msg2Id = uid();
  const jobId = uid();
  const actionId = uid();
  const activityEventId = uid();

  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: msg1Id, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId: msg1Id,
      updates: {
        content: "I have everything I need from your request — 500 USDC, Arbitrum to Base, best route.\n\nI can see Main Wallet on Arbitrum with a sufficient USDC balance. I'm preparing a route and quote now.",
        isStreaming: false,
      },
    });
  }, 900);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  const bridgeAction: FinancialAction = {
    id: actionId,
    title: 'Bridge 500 USDC · Arbitrum → Base',
    actionType: 'bridge',
    economicEffect: '500 USDC will leave Main Wallet on Arbitrum. At least 498.50 USDC is expected to arrive in the same wallet on Base.',
    rationale: 'You asked AgentPlace to move 500 USDC from Arbitrum to Base using the best eligible route.',
    authorityDecision: 'needs-approval',
    authorityReason: 'Connected Wallet mode — you approve and sign every financial write.',
    risks: [
      'Quote may expire before signing — refresh is required if it lapses.',
      'Settlement may take longer than estimated under network congestion.',
      'Final amount may vary within the authorized minimum received / cost envelope.',
      'Bridge or provider degradation may require rerouting within the same economic envelope.',
    ],
    technicalDetails: {
      'Source': 'Main Wallet · Arbitrum',
      'Destination': 'Main Wallet · Base',
      'Asset': 'USDC',
      'Amount': '500 USDC',
      'Execution account': 'Main Wallet',
      'Provider': 'Across · prototype route',
      'Environment': 'Mainnet',
    },
    walletId: 'wlt-main',
    environment: 'mainnet',
    amount: '500',
    asset: 'USDC',
    protocol: 'Across',
    network: 'Arbitrum',
    sourceNetwork: 'Arbitrum',
    destinationNetwork: 'Base',
    quote: {
      quotedAt: now,
      expiresAt,
      estimatedReceive: '498.92 USDC',
      minimumReceive: '498.50 USDC',
      estimatedTotalCost: '~1.08 USDC',
      estimatedDuration: '1–3 min',
      routeSummary: 'Arbitrum → Base via Across',
      provider: 'Across · prototype route',
    },
    status: 'pending-review',
    createdAt: now,
  };

  const bridgeJob: Job = {
    id: jobId,
    title: 'Bridge 500 USDC to Base',
    goal: 'Move 500 USDC from Arbitrum to Base using the best eligible route while staying within the approved economic envelope.',
    status: 'needs-approval',
    kind: 'financial',
    leadWorkerId: 'w-exec-operator',
    leadWorkerName: 'Execution Operator',
    supportingWorkerIds: [],
    supportingWorkerNames: [],
    originConversationId: convId,
    actionId,
    currentStage: 'Awaiting approval',
    stages: [],
    createdAt: now,
    updatedAt: now,
  };

  setTimeout(() => {
    dispatch({ type: 'ADD_FINANCIAL_ACTION', action: bridgeAction });
    dispatch({ type: 'ADD_JOB', job: bridgeJob });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: activityEventId,
        eventType: 'job',
        title: 'Bridge 500 USDC to Base',
        summary: 'Needs your approval · Execution Operator',
        workerName: 'Execution Operator',
        workerId: 'w-exec-operator',
        jobId,
        actionId,
        timestamp: new Date(),
        status: 'needs-approval',
      },
    });

    dispatch({
      type: 'ADD_MSG',
      convId,
      msg: {
        id: msg2Id,
        role: 'manager',
        content: "Here is the route and quote. Review it — then open the Action Review to approve.",
        timestamp: new Date(),
        uiCard: 'bridge-quote',
        jobId,
      },
    });
    dispatch({ type: 'AUTO_TITLE', convId, title: 'Bridge 500 USDC · Arbitrum to Base' });
  }, 2200);
}

export function triggerBridgeExecution(
  dispatch: React.Dispatch<Action>,
  actionId: string,
  jobId: string,
  convId: string,
  scenario: import('../state/types').Scenario
) {
  const executionId = uid();
  const now = new Date();

  const record: ExecutionRecord = {
    id: executionId,
    actionId,
    jobId,
    status: 'approved',
    environment: 'mainnet',
    startedAt: now,
    updatedAt: now,
  };

  dispatch({ type: 'ADD_EXECUTION_RECORD', record });
  dispatch({ type: 'UPDATE_JOB', jobId, updates: { status: 'executing', executionId, currentStage: 'Executing' } });
  dispatch({ type: 'UPDATE_FINANCIAL_ACTION', actionId, updates: { status: 'approved' } });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_EXECUTION_RECORD',
      recordId: executionId,
      updates: {
        status: 'submitted',
        transactionEvidence: {
          network: 'Arbitrum',
          txHash: '0x4a3b2c1d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f',
          submittedAt: new Date(),
          confirmationState: 'pending',
        },
      },
    });
    dispatch({ type: 'UPDATE_JOB', jobId, updates: { status: 'executing', currentStage: 'Submitted' } });
  }, 1200);

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_EXECUTION_RECORD',
      recordId: executionId,
      updates: {
        status: scenario === 'transaction-status-unknown' ? 'unknown' : 'confirming',
        transactionEvidence: {
          network: 'Arbitrum',
          txHash: '0x4a3b2c1d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f',
          submittedAt: new Date(now.getTime() + 1200),
          confirmationState: scenario === 'transaction-status-unknown' ? 'unknown' : 'pending',
        },
        routeAdjusted: scenario === 'provider-degraded',
        routeAdjustmentNote: scenario === 'provider-degraded'
          ? 'Original provider became unavailable. AgentPlace selected another eligible route within your approved minimum receive and maximum cost.'
          : undefined,
      },
    });
    if (scenario === 'transaction-status-unknown') {
      dispatch({ type: 'UPDATE_JOB', jobId, updates: { status: 'unknown', currentStage: 'Confirming transaction status' } });
      return;
    }
    dispatch({ type: 'UPDATE_JOB', jobId, updates: { status: 'executing', currentStage: 'Confirming' } });
  }, 2800);

  if (scenario === 'transaction-status-unknown') return;

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_EXECUTION_RECORD',
      recordId: executionId,
      updates: {
        status: 'settling',
        transactionEvidence: {
          network: 'Arbitrum',
          txHash: '0x4a3b2c1d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f',
          submittedAt: new Date(now.getTime() + 1200),
          confirmationState: 'confirmed',
          confirmedAt: new Date(),
        },
        settlementObservations: [{
          expectedDestination: 'Main Wallet · Base',
          asset: 'USDC',
          minimumExpectedAmount: '498.50 USDC',
          network: 'Base',
          status: 'pending',
        }],
      },
    });
    dispatch({ type: 'UPDATE_JOB', jobId, updates: { status: 'settling', currentStage: 'Settling' } });
  }, 4500);

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_EXECUTION_RECORD',
      recordId: executionId,
      updates: {
        status: 'verifying',
        settlementObservations: [{
          expectedDestination: 'Main Wallet · Base',
          asset: 'USDC',
          minimumExpectedAmount: '498.50 USDC',
          observedAmount: '498.92 USDC',
          network: 'Base',
          status: 'observed',
          observedAt: new Date(),
        }],
      },
    });
    dispatch({ type: 'UPDATE_JOB', jobId, updates: { status: 'verifying', currentStage: 'Verifying outcome' } });

    if (scenario === 'verification-delayed') {
      return;
    }
  }, 6200);

  if (scenario === 'verification-delayed') return;

  setTimeout(() => {
    const verifiedOutcomeId = uid();
    const receiptId = uid();

    const verifiedOutcome: VerifiedOutcome = {
      id: verifiedOutcomeId,
      jobId,
      actionId,
      executionId,
      status: 'verified',
      expectedOutcome: '500 USDC leaves Arbitrum and at least 498.50 USDC arrives on Base.',
      actualOutcome: '498.92 USDC received in Main Wallet on Base.',
      verificationMethod: 'Destination balance/state observation + bridge settlement evidence.',
      evidenceSummary: 'Main Wallet Base USDC balance confirmed at 498.92 USDC. Expected minimum: 498.50 USDC. Observed: 498.92 USDC. Verified.',
      verifiedAt: new Date(),
    };

    const receipt: VerifiedReceipt = {
      id: receiptId,
      jobId,
      actionId,
      executionId,
      verifiedOutcomeId,
      userGoal: 'Bridge 500 USDC from Arbitrum to Base using the best route.',
      workerName: 'Execution Operator',
      authorizedActionSummary: 'From: Main Wallet · Arbitrum | Amount: 500 USDC | To: Main Wallet · Base | Minimum received: 498.50 USDC',
      actualEconomicOutcome: '498.92 USDC received in Main Wallet on Base.',
      costs: [
        { label: 'Bridge/provider cost', amount: '1.00 USDC' },
        { label: 'Source network gas', amount: '0.08 USDC equivalent' },
        { label: 'Total actual execution cost', amount: '1.08 USDC' },
        { label: 'AgentPlace service', amount: 'Prototype · not billed' },
      ],
      transactionReferences: [
        { label: 'Source Arbitrum transaction', hash: '0x4a3b2c1d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f', status: 'confirmed' },
        { label: 'Destination settlement evidence', status: 'observed' },
      ],
      verificationMethod: 'Destination wallet balance/state observation',
      verificationEvidence: 'Expected minimum: 498.50 USDC · Observed: 498.92 USDC · Verified',
      proofAnchorStatus: 'pending',
      proofAnchorNote: 'Arbitrum proof anchor queued. This does not affect the verified outcome.',
      environment: 'mainnet',
      createdAt: new Date(),
    };

    dispatch({ type: 'ADD_VERIFIED_OUTCOME', outcome: verifiedOutcome });
    dispatch({ type: 'ADD_VERIFIED_RECEIPT', receipt });
    dispatch({
      type: 'UPDATE_EXECUTION_RECORD',
      recordId: executionId,
      updates: { status: 'completed', currentVerifiedState: '498.92 USDC in Main Wallet on Base' },
    });
    dispatch({
      type: 'UPDATE_JOB',
      jobId,
      updates: {
        status: 'completed',
        currentStage: 'Completed · AgentPlace Verified',
        verifiedOutcomeId,
        receiptId,
      },
    });

    dispatch({
      type: 'UPDATE_WALLET',
      walletId: 'wlt-main',
      updates: {
        balances: [
          { symbol: 'ETH', amount: '0.52', usdValue: '$1,248' },
          { symbol: 'USDC', amount: '300', usdValue: '$300', network: 'Arbitrum' },
          { symbol: 'USDC', amount: '498.92', usdValue: '$498.92', network: 'Base' },
        ],
      },
    });

    dispatch({
      type: 'ADD_OUTCOME',
      outcome: {
        id: uid(),
        title: 'Bridge completed',
        summary: '498.92 USDC received on Base · Completed · AgentPlace Verified',
        workerId: 'w-exec-operator',
        workerName: 'Execution Operator',
        jobId,
        verifiedOutcomeId,
        receiptId,
        createdAt: new Date(),
        type: 'financial',
      },
    });

    dispatch({
      type: 'ADD_MSG',
      convId,
      msg: {
        id: uid(),
        role: 'manager',
        content: 'Bridge complete.\n\n498.92 USDC was independently verified in Main Wallet on Base.',
        timestamp: new Date(),
        uiCard: 'bridge-completion',
        jobId,
      },
    });
  }, 8000);
}

export function createPartialFailureJob(dispatch: React.Dispatch<Action>): string {
  const jobId = uid();
  const executionId = uid();
  const activityEventId = uid();
  const now = new Date();

  const record: ExecutionRecord = {
    id: executionId,
    actionId: 'partial-fail-action',
    jobId,
    status: 'recovering',
    environment: 'mainnet',
    startedAt: now,
    updatedAt: now,
    recovery: {
      completedSteps: ['Withdraw 500 USDC from Aave'],
      incompleteSteps: ['Supply to Morpho'],
      verifiedCurrentLocation: 'Main Agent Account · Base',
      verifiedCurrentAmount: '499.34 USDC',
      status: 'evaluating',
      notes: 'AgentPlace is evaluating eligible recovery paths within the approved economic envelope.',
    },
  };

  const job: Job = {
    id: jobId,
    title: 'Reallocate 500 USDC from Aave to Morpho',
    goal: 'Reallocate 500 USDC from Aave v3 to Morpho on Base to capture improved yield.',
    status: 'recovering',
    kind: 'financial',
    leadWorkerId: 'w-stablecoin',
    leadWorkerName: 'Stablecoin Manager',
    supportingWorkerIds: [],
    supportingWorkerNames: [],
    executionId,
    currentStage: 'Recovering',
    stages: [],
    createdAt: now,
    updatedAt: now,
  };

  dispatch({ type: 'ADD_EXECUTION_RECORD', record });
  dispatch({ type: 'ADD_JOB', job });
  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: activityEventId,
      eventType: 'job',
      title: 'Reallocate 500 USDC from Aave to Morpho',
      summary: 'Recovering · 499.34 USDC verified in Agent Account',
      workerName: 'Stablecoin Manager',
      workerId: 'w-stablecoin',
      jobId,
      timestamp: now,
      status: 'recovering',
    },
  });
  dispatch({ type: 'SET_ACTIVE_JOB', id: jobId });

  return jobId;
}

// ── Stablecoin mode response flows ────────────────────────────────────────────

export function runStablecoinRecommendationsOnly(dispatch: React.Dispatch<Action>, convId: string) {
  const msgId = uid();
  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: msgId, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });
  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId,
      updates: {
        content: `Research and monitoring — no execution access required.

I'll keep watching yield spreads across Aave, Morpho, and Spark. When a material opportunity appears, I'll surface it here with context, numbers, and a recommendation.

You can ask me to compare rates any time, dig into a specific protocol's risk model, or explore how DAI Savings Rate changes would affect your allocation.

If you want persistent background monitoring, you can add Stablecoin Manager to your workforce — it watches continuously and only flags when yield differences are material. No wallet required for research mode.`,
        isStreaming: false,
      },
    });
  }, 1100);
}

export function runStablecoinApproveEachMove(
  dispatch: React.Dispatch<Action>,
  convId: string,
  hasConnectedWallet: boolean,
  walletId?: string
) {
  const msgId = uid();
  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: msgId, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });

  if (!hasConnectedWallet) {
    setTimeout(() => {
      dispatch({
        type: 'UPDATE_MSG',
        convId,
        msgId,
        updates: {
          content: "To prepare actions for your approval, I need a Connected Wallet. You approve and sign every transaction — AgentPlace cannot move funds without your explicit signature.",
          isStreaming: false,
          uiCard: 'connect-wallet-cta',
        },
      });
    }, 900);
    return;
  }

  // Has connected wallet — prepare an action
  const actionId = uid();
  const action: FinancialAction = {
    id: actionId,
    title: 'Reallocate 400 USDC to Morpho on Base',
    actionType: 'reallocate',
    economicEffect: '400 USDC moved from Aave v3 (Base) to Morpho (Base). Estimated yield improvement: +1.3% APY on this position, +$5.20 per month.',
    rationale: 'Morpho on Base is currently yielding 6.1% vs Aave at 4.8%. The spread has been consistent for 3 weeks.',
    authorityDecision: 'needs-approval',
    authorityReason: 'Connected Wallet mode — you sign every transaction. This action requires your wallet signature to proceed.',
    risks: [
      'Morpho yields can drop if supply increases.',
      'Gas fees on Base are minimal (~$0.02) but non-zero.',
      'Withdrawal from Morpho is instant under normal market conditions.',
    ],
    technicalDetails: {
      'Source protocol': 'Aave v3 · Base',
      'Destination protocol': 'Morpho · Base',
      'Asset': 'USDC',
      'Amount': '400 USDC',
      'Network': 'Base',
      'Account': 'Main Wallet',
    },
    workerName: 'Stablecoin Manager',
    workerId: 'w-stablecoin',
    walletId: walletId ?? 'wlt-main',
    environment: 'mainnet',
    amount: '400',
    asset: 'USDC',
    protocol: 'Morpho',
    network: 'Base',
    status: 'pending-review',
    createdAt: new Date(),
  };

  dispatch({ type: 'ADD_FINANCIAL_ACTION', action });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId,
      updates: {
        content: "Stablecoin Manager has prepared a reallocation. Review it before anything is submitted — your Connected Wallet signature is required to proceed.",
        isStreaming: false,
      },
    });
  }, 900);

  setTimeout(() => {
    dispatch({ type: 'SET_ACTIVE_ACTION', id: actionId });
  }, 1400);
}

export function runStablecoinManageWithRules(
  dispatch: React.Dispatch<Action>,
  convId: string,
  agentAccount: AgentAccount | null,
  hasActiveAuthority: boolean
) {
  const msgId = uid();
  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: { id: msgId, role: 'manager', content: '', timestamp: new Date(), isStreaming: true },
  });

  if (!agentAccount) {
    // No agent account — show inline CTA
    setTimeout(() => {
      dispatch({
        type: 'UPDATE_MSG',
        convId,
        msgId,
        updates: {
          content: "To manage funds within your rules, Stablecoin Manager needs an Agent Account — a smart account you own where Workers can act only within rules you explicitly approve.\n\nYou remain the ultimate owner. Worker authority starts with none.",
          isStreaming: false,
          uiCard: 'create-agent-account-cta',
        },
      });
    }, 900);
    return;
  }

  const balanceNum = parseFloat(agentAccount.totalBalance.replace(/[^0-9.]/g, ''));
  const hasSufficientFunds = balanceNum >= 100;

  if (!hasSufficientFunds) {
    // Has account but no funds — show fund CTA
    setTimeout(() => {
      dispatch({
        type: 'UPDATE_MSG',
        convId,
        msgId,
        updates: {
          content: `Your Agent Account is ready.\n\n**Worker authority: None**\n**Balance: ${agentAccount.totalBalance}**\n\nTo use the 2,000 USDC strategy we discussed, fund the account first. No Worker has authority over these funds yet.`,
          isStreaming: false,
          uiCard: 'fund-agent-account-cta',
        },
      });
    }, 900);
    return;
  }

  if (hasActiveAuthority) {
    // Already has active authority — just confirm status
    setTimeout(() => {
      dispatch({
        type: 'UPDATE_MSG',
        convId,
        msgId,
        updates: {
          content: "Stablecoin Manager already has active authority on your Agent Account. You can review the current mandate in Security & Authority, or open Stablecoin Manager's workspace.",
          isStreaming: false,
        },
      });
    }, 900);
    return;
  }

  // Has funded account, no active authority — create draft mandate + grant + show review
  const mandateId = uid();
  const grantId = uid();
  const expiry = new Date('2026-12-31');

  const mandate: Mandate = {
    id: mandateId,
    workerId: 'w-stablecoin',
    workerName: 'Stablecoin Manager',
    agentAccountId: agentAccount.id,
    goal: 'Keep stablecoins productive while maintaining liquidity',
    managedCapital: 'Up to 1,500 USDC',
    reserveCapital: 'At least 500 USDC liquid at all times',
    preferredProtocols: ['Aave', 'Morpho'],
    riskPosture: 'Conservative',
    restrictions: ['No borrowing', 'No leverage', 'No new protocol integrations without approval'],
    expiry,
    status: 'draft',
    createdAt: new Date(),
  };

  const grant: AuthorityGrant = {
    id: grantId,
    workerId: 'w-stablecoin',
    workerName: 'Stablecoin Manager',
    agentAccountId: agentAccount.id,
    environment: 'mainnet',
    networks: ['Base', 'Arbitrum'],
    allowedActions: ['Supply', 'Withdraw', 'Reallocate stablecoins'],
    allowedProtocols: ['Aave', 'Morpho'],
    singleActionLimit: '500 USDC',
    totalManagedCapital: '1,500 USDC',
    borrowingAllowed: false,
    leverageAllowed: false,
    expiry,
    status: 'draft',
    mandateId,
    createdAt: new Date(),
  };

  dispatch({ type: 'ADD_MANDATE', mandate });
  dispatch({ type: 'ADD_AUTHORITY_GRANT', grant });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_MSG',
      convId,
      msgId,
      updates: {
        content: "Stablecoin Manager can manage yield autonomously within rules you define. I've prepared a Mandate proposal based on your situation. Review the rules carefully, then activate when ready.\n\nUntil you activate, Stablecoin Manager has no financial authority.",
        isStreaming: false,
        uiCard: 'mandate-review',
      },
    });
  }, 900);
}

// ── Activate draft mandate ────────────────────────────────────────────────────

export function activateStablecoinMandate(
  dispatch: React.Dispatch<Action>,
  mandateId: string,
  grantId: string,
  convId: string
) {
  dispatch({ type: 'UPDATE_MANDATE', mandateId, updates: { status: 'active' } });
  dispatch({ type: 'UPDATE_AUTHORITY_GRANT', grantId, updates: { status: 'active' } });

  // Ensure Stablecoin Manager worker exists
  dispatch({
    type: 'ADD_WORKER',
    worker: {
      id: 'w-stablecoin',
      name: 'Stablecoin Manager',
      tagline: 'Optimises yield on idle stablecoins within your approved rules',
      status: 'monitoring',
      isOriginal: true,
      responsibility: 'Stablecoin Manager monitors USDC and DAI yield across Aave, Morpho, and Spark, and proposes reallocation when material yield differences emerge.',
      authoritySummary: 'Autonomous within mandate · Main Agent Account · Up to 1,500 USDC · Max 500 USDC/action · Base · Arbitrum · Aave · Morpho · No borrowing · No leverage',
      currentFocus: 'Monitoring yield spread on Morpho vs Aave',
    },
  });

  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: uid(),
      eventType: 'authority',
      title: 'Stablecoin Manager authority activated',
      summary: 'Up to 1,500 USDC managed · Max 500 USDC/action · Base + Arbitrum · Aave + Morpho',
      workerId: 'w-stablecoin',
      workerName: 'Stablecoin Manager',
      timestamp: new Date(),
      status: 'complete',
    },
  });

  const confirmMsgId = uid();
  dispatch({
    type: 'ADD_MSG',
    convId,
    msg: {
      id: confirmMsgId,
      role: 'manager',
      content: "Stablecoin Manager is ready.\n\nIt can now manage up to 1,500 USDC under the rules you approved. No funds have been moved — authority is active but no action has executed yet.\n\nYou can pause or revoke this authority at any time in Security & Authority.",
      timestamp: new Date(),
    },
  });
}

// ── Shared: agent account funding action ──────────────────────────────────────

export function createAgentFundingAction(
  dispatch: React.Dispatch<Action>,
  accountId: string,
  accountName: string,
  environment: string
) {
  const actionId = uid();
  const action: FinancialAction = {
    id: actionId,
    title: `Fund ${accountName} with 2,000 USDC`,
    actionType: 'fund',
    economicEffect: '2,000 USDC transferred from Main Wallet to Agent Account.',
    rationale: 'Funding the Agent Account to enable Stablecoin Manager mandate.',
    authorityDecision: 'needs-approval',
    authorityReason: 'Owner funding requires your Connected Wallet signature.',
    risks: [
      'Funded capital becomes available to Workers with active Authority Grants.',
      'No Worker has authority yet — no funds can be moved automatically.',
    ],
    technicalDetails: {
      'From': 'Main Wallet · 0x1a2b...c3d4',
      'To': accountName,
      'Amount': '2,000 USDC',
      'Network': 'Base',
    },
    agentAccountId: accountId,
    walletId: 'wlt-main',
    environment: environment as any,
    amount: '2,000',
    asset: 'USDC',
    status: 'pending-review',
    createdAt: new Date(),
  };
  dispatch({ type: 'ADD_FINANCIAL_ACTION', action });
  dispatch({ type: 'SET_ACTIVE_ACTION', id: actionId });
  return actionId;
}

// ── Blocked mandate demo action ───────────────────────────────────────────────

export function createBlockedMandateAction(dispatch: React.Dispatch<Action>): string {
  const actionId = uid();
  const attentionId = uid();

  const action: FinancialAction = {
    id: actionId,
    title: 'Reallocate 750 USDC to Aave on Arbitrum',
    actionType: 'reallocate',
    economicEffect: '750 USDC moved from Morpho (Base) to Aave v3 (Arbitrum). This exceeds the per-action autonomous limit.',
    rationale: 'Stablecoin Manager identified a 0.9% yield improvement on Arbitrum Aave following a protocol rate update.',
    authorityDecision: 'blocked',
    authorityReason: "Exceeds single-action limit of 500 USDC. Your Authority Grant caps autonomous actions at 500 USDC each.",
    blockedReason: 'Amount (750 USDC) exceeds the approved single-action limit (500 USDC) in your Authority Grant.',
    risks: [
      'No funds were moved.',
      'The action was blocked before submission.',
      'Nothing was submitted to any network.',
    ],
    technicalDetails: {
      'Attempted': '750 USDC reallocation',
      'Rule': 'Max 500 USDC per autonomous action',
      'Source': 'Morpho · Base',
      'Destination': 'Aave v3 · Arbitrum',
      'Authority Grant': 'grant-stable',
    },
    workerName: 'Stablecoin Manager',
    workerId: 'w-stablecoin',
    agentAccountId: 'aa-main',
    environment: 'mainnet',
    amount: '750',
    asset: 'USDC',
    protocol: 'Aave',
    network: 'Arbitrum',
    status: 'blocked',
    mandateId: 'mnd-stable',
    grantId: 'grant-stable',
    createdAt: new Date(),
  };

  const attentionItem: AttentionItem = {
    id: attentionId,
    title: 'Stablecoin Manager action blocked',
    summary: '750 USDC reallocation exceeded autonomous limit — nothing was submitted',
    type: 'action-review',
    actionId,
    workerId: 'w-stablecoin',
    createdAt: new Date(),
  };

  dispatch({ type: 'ADD_FINANCIAL_ACTION', action });
  dispatch({ type: 'ADD_ATTENTION_ITEM', item: attentionItem });
  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: uid(),
      eventType: 'financial',
      title: 'Action blocked — 750 USDC reallocation',
      summary: 'Blocked by mandate · 500 USDC/action limit · Nothing submitted',
      workerId: 'w-stablecoin',
      workerName: 'Stablecoin Manager',
      actionId,
      timestamp: new Date(),
      status: 'blocked',
    },
  });
  dispatch({ type: 'SET_ACTIVE_ACTION', id: actionId });

  return actionId;
}

// ── Wallet disconnected demo ──────────────────────────────────────────────────

export function triggerWalletDisconnected(dispatch: React.Dispatch<Action>) {
  const attentionId = uid();
  dispatch({ type: 'UPDATE_WALLET', walletId: 'wlt-main', updates: { disconnected: true } });
  dispatch({
    type: 'ADD_ATTENTION_ITEM',
    item: {
      id: attentionId,
      title: 'Main Wallet disconnected',
      summary: 'Reconnect to allow action preparation',
      type: 'info',
      walletId: 'wlt-main',
      createdAt: new Date(),
    },
  });
  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: uid(),
      eventType: 'wallet',
      title: 'Main Wallet disconnected',
      summary: 'Session ended · Reconnect to resume',
      walletId: 'wlt-main',
      timestamp: new Date(),
      status: 'issue',
    },
  });
}

// ── Comparison job flow ───────────────────────────────────────────────────────

const INITIAL_STAGES: JobProgressStage[] = [
  { id: 's1', label: 'Candidate context', status: 'done' },
  { id: 's2', label: 'Smart-money analysis', status: 'active' },
  { id: 's3', label: 'Risk comparison', status: 'pending' },
  { id: 's4', label: 'Synthesis', status: 'pending' },
];

export function runComparisonJobFlow(
  dispatch: React.Dispatch<Action>,
  jobId: string,
  activityEventId: string
) {
  setTimeout(() => {
    dispatch({
      type: 'UPDATE_JOB',
      jobId,
      updates: {
        currentStage: 'Risk comparison',
        stages: [
          { id: 's1', label: 'Candidate context', status: 'done' },
          { id: 's2', label: 'Smart-money analysis', status: 'done' },
          { id: 's3', label: 'Risk comparison', status: 'active' },
          { id: 's4', label: 'Synthesis', status: 'pending' },
        ],
      },
    });
  }, 3000);

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_JOB',
      jobId,
      updates: {
        currentStage: 'Synthesis',
        stages: [
          { id: 's1', label: 'Candidate context', status: 'done' },
          { id: 's2', label: 'Smart-money analysis', status: 'done' },
          { id: 's3', label: 'Risk comparison', status: 'done' },
          { id: 's4', label: 'Synthesis', status: 'active' },
        ],
      },
    });
  }, 5500);

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_JOB',
      jobId,
      updates: {
        status: 'completed',
        currentStage: 'Complete',
        stages: [
          { id: 's1', label: 'Candidate context', status: 'done' },
          { id: 's2', label: 'Smart-money analysis', status: 'done' },
          { id: 's3', label: 'Risk comparison', status: 'done' },
          { id: 's4', label: 'Synthesis', status: 'done' },
        ],
        result: {
          summary:
            'WIF shows the strongest combined signal — momentum, smart-money alignment, and manageable supply concentration. BONK offers ecosystem durability but a lower near-term signal. POPCAT carries the most speculative risk of the three.',
          items: [
            {
              label: 'BONK',
              headline: 'Strongest ecosystem depth',
              detail:
                '25+ integrations via the Bonk Eco Fund. Smart money: mild accumulation in the past 72h. Lower momentum than WIF this week. More structural depth than a pure narrative coin.',
            },
            {
              label: 'WIF',
              headline: 'Strongest current momentum + smart-money signal',
              detail:
                'Twitter/X velocity +68k followers this week. 5 wallets >$2M accumulated in the past 7 days — clearest accumulation signal of the three. Positive divergence from SOL beta.',
            },
            {
              label: 'POPCAT',
              headline: 'Highest speculative volatility',
              detail:
                'Thinner ecosystem backing. Sentiment-driven with limited structural depth. Higher risk per equivalent position size relative to BONK and WIF.',
            },
          ],
          label: 'Research complete',
        },
      },
    });

    dispatch({
      type: 'UPDATE_WORKER',
      workerId: 'w-memescout',
      updates: { status: 'monitoring', currentJobId: undefined },
    });

    dispatch({
      type: 'UPDATE_ACTIVITY_EVENT',
      eventId: activityEventId,
      updates: { status: 'complete', summary: 'Comparison complete · 3 assets evaluated' },
    });

    dispatch({
      type: 'ADD_OUTCOME',
      outcome: {
        id: uid(),
        title: 'Meme comparison completed',
        summary: '3 assets evaluated · WIF ranked highest',
        workerId: 'w-memescout',
        workerName: 'Meme Scout',
        jobId,
        createdAt: new Date(),
        type: 'research',
      },
    });
  }, 8500);
}

// ── Routine-limited demo ──────────────────────────────────────────────────────

export function triggerRoutineLimited(dispatch: React.Dispatch<Action>) {
  const notifId = uid();
  const attentionId = uid();

  dispatch({
    type: 'UPDATE_ROUTINE',
    routineId: 'rtn-stable-check',
    updates: {
      status: 'limited',
      limitedReason: 'Repeated provider failures exhausted this Routine\'s retry/service budget.',
    },
  });

  dispatch({
    type: 'ADD_NOTIFICATION',
    notification: {
      id: notifId,
      level: 'needs-you',
      title: 'Weekday stablecoin Routine needs review',
      summary: 'Repeated provider failures exhausted its retry budget.',
      why: 'Scheduled checks cannot continue until the Routine is reviewed.',
      createdAt: new Date(),
      read: false,
      groupKey: 'routine-limited-stable',
      target: { type: 'routine', id: 'rtn-stable-check' },
    },
  });

  dispatch({
    type: 'ADD_ATTENTION_ITEM',
    item: {
      id: attentionId,
      title: 'Weekday stablecoin Routine needs review',
      summary: 'Repeated provider failures exhausted retry budget — scheduled checks paused',
      type: 'info',
      workerId: 'w-stablecoin',
      createdAt: new Date(),
    },
  });

  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: uid(),
      eventType: 'routine',
      title: 'Weekday stablecoin Routine limited',
      summary: 'Retry budget exhausted · Scheduled checks paused',
      workerId: 'w-stablecoin',
      workerName: 'Stablecoin Manager',
      routineId: 'rtn-stable-check',
      timestamp: new Date(),
      status: 'issue',
    },
  });
}

// ── Run Routine Now ───────────────────────────────────────────────────────────

export function runRoutineNow(dispatch: React.Dispatch<Action>, routineId: string): string {
  const jobId = uid();
  const runId = uid();
  const activityEventId = uid();
  const now = new Date();

  let title = 'Stablecoin opportunity check';
  let goal = 'Check for stablecoin yield opportunities. Surface only net improvements of at least 1%.';
  let leadWorkerId = 'w-stablecoin';
  let leadWorkerName = 'Stablecoin Manager';

  if (routineId === 'rtn-bonk-watch') {
    title = 'BONK smart-money check';
    goal = 'Check for material BONK smart-money accumulation changes.';
    leadWorkerId = 'w-memescout';
    leadWorkerName = 'Meme Scout';
  } else if (routineId === 'rtn-treasury-alert') {
    title = 'Treasury Watch analysis';
    goal = 'Analyse recent Treasury Watch movements above $50,000.';
    leadWorkerId = 'w-portfolio';
    leadWorkerName = 'Portfolio Guardian';
  }

  const job: Job = {
    id: jobId,
    title,
    goal,
    status: 'working',
    leadWorkerId,
    leadWorkerName,
    supportingWorkerIds: [],
    supportingWorkerNames: [],
    currentStage: 'Analysing',
    stages: [
      { id: 's1', label: 'Analysing', status: 'active' },
      { id: 's2', label: 'Synthesis', status: 'pending' },
    ],
    routineId,
    createdAt: now,
    updatedAt: now,
  };

  const run: RoutineRun = {
    id: runId,
    routineId,
    jobId,
    startedAt: now,
    resultType: 'no-change',
    summary: 'No net improvement above 1%',
    meaningful: false,
  };

  dispatch({ type: 'ADD_JOB', job });
  dispatch({ type: 'ADD_ROUTINE_RUN', run });
  dispatch({
    type: 'UPDATE_ROUTINE',
    routineId,
    updates: { lastRunAt: now, recentRunIds: [runId] },
  });
  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: activityEventId,
      eventType: 'job',
      title,
      summary: `Working · ${leadWorkerName} · Via Routine`,
      workerName: leadWorkerName,
      workerId: leadWorkerId,
      jobId,
      routineId,
      timestamp: now,
      status: 'working',
    },
  });
  dispatch({ type: 'SET_ACTIVE_JOB', id: jobId });

  setTimeout(() => {
    dispatch({
      type: 'UPDATE_JOB',
      jobId,
      updates: {
        status: 'completed',
        currentStage: 'Complete',
        stages: [
          { id: 's1', label: 'Analysing', status: 'done' },
          { id: 's2', label: 'Synthesis', status: 'done' },
        ],
        result: {
          summary: 'No net improvement above your 1% threshold. No action proposed.',
          items: [
            {
              label: 'Morpho (Base)',
              headline: '5.2% APY',
              detail: 'Current rate — 0.6% above Aave. Below the 1% threshold.',
            },
            {
              label: 'Aave v3 (Base)',
              headline: '4.6% APY',
              detail: 'Current deployment rate.',
            },
          ],
          label: 'Research complete',
        },
      },
    });
    dispatch({
      type: 'ADD_ROUTINE_RUN',
      run: {
        ...run,
        completedAt: new Date(),
        resultType: 'no-change',
        summary: 'No net improvement above 1%',
        meaningful: false,
      },
    });
  }, 4500);

  return jobId;
}

// ── Provider material change scenario ────────────────────────────────────────

export function triggerProviderMaterialChange(dispatch: React.Dispatch<Action>) {
  const actionId = uid();
  const jobId = uid();
  const now = new Date();

  const action: FinancialAction = {
    id: actionId,
    title: 'Bridge 500 USDC · Arbitrum → Base',
    actionType: 'bridge',
    economicEffect: '500 USDC will leave Main Wallet on Arbitrum. At least 497.60 USDC is expected to arrive on Base — this is below your previously approved minimum.',
    rationale: 'The original route via Across became unavailable. The only current eligible fallback route falls outside the economic envelope you approved.',
    authorityDecision: 'needs-approval',
    authorityReason: 'Connected Wallet mode — you approve and sign every financial write. New approval required: terms changed materially.',
    risks: [
      'The minimum received amount has decreased — 497.60 USDC vs previously approved 498.50 USDC.',
      'Estimated cost has increased — ~2.35 USDC vs previously quoted ~1.08 USDC.',
      'Nothing has been submitted under the changed route.',
    ],
    technicalDetails: {
      'Source': 'Main Wallet · Arbitrum',
      'Destination': 'Main Wallet · Base',
      'Asset': 'USDC',
      'Amount': '500 USDC',
      'Original provider': 'Across · unavailable',
      'Fallback provider': 'Stargate · prototype route',
      'Environment': 'Mainnet',
    },
    walletId: 'wlt-main',
    environment: 'mainnet',
    amount: '500',
    asset: 'USDC',
    protocol: 'Stargate',
    network: 'Arbitrum',
    sourceNetwork: 'Arbitrum',
    destinationNetwork: 'Base',
    quote: {
      quotedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      estimatedReceive: '497.60 USDC',
      minimumReceive: '497.60 USDC',
      estimatedTotalCost: '~2.35 USDC',
      estimatedDuration: '2–5 min',
      routeSummary: 'Arbitrum → Base via Stargate (fallback)',
      provider: 'Stargate · prototype route',
    },
    previousQuote: {
      quotedAt: new Date(now.getTime() - 3 * 60 * 1000),
      expiresAt: new Date(now.getTime() - 1 * 60 * 1000),
      estimatedReceive: '498.92 USDC',
      minimumReceive: '498.50 USDC',
      estimatedTotalCost: '~1.08 USDC',
      estimatedDuration: '1–3 min',
      routeSummary: 'Arbitrum → Base via Across',
      provider: 'Across · prototype route',
    },
    providerChangeNote: 'Route changed materially. The original provider became unavailable. Fallback route falls outside your approved economic terms. Your previous approval is invalidated. Review and re-approve to continue.',
    status: 'pending-review',
    createdAt: now,
  };

  const job: Job = {
    id: jobId,
    title: 'Bridge 500 USDC to Base',
    goal: 'Move 500 USDC from Arbitrum to Base using the best eligible route.',
    status: 'needs-approval',
    kind: 'financial',
    leadWorkerId: 'w-exec-operator',
    leadWorkerName: 'Execution Operator',
    supportingWorkerIds: [],
    supportingWorkerNames: [],
    currentStage: 'Route changed — review required',
    stages: [{ id: 'prepare', label: 'Prepare route', status: 'done' }],
    actionId,
    createdAt: now,
    updatedAt: now,
  };

  const attentionItem: AttentionItem = {
    id: uid(),
    title: 'Bridge route changed — review required',
    summary: 'Fallback route falls outside approved terms · Nothing submitted',
    type: 'action-review',
    actionId,
    workerId: 'w-exec-operator',
    createdAt: now,
  };

  dispatch({ type: 'ADD_FINANCIAL_ACTION', action });
  dispatch({ type: 'ADD_JOB', job });
  dispatch({ type: 'ADD_ATTENTION_ITEM', item: attentionItem });
  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: uid(),
      eventType: 'financial',
      title: 'Bridge route changed materially — needs review',
      summary: 'Original provider unavailable · Fallback terms outside approved envelope · Nothing submitted',
      actionId,
      timestamp: now,
      status: 'needs-you',
    },
  });
  dispatch({
    type: 'ADD_NOTIFICATION',
    notification: {
      id: uid(),
      title: 'Bridge route changed — review required',
      summary: 'Original provider unavailable. Fallback falls outside your approved terms.',
      why: 'The authorized economic envelope cannot be preserved with available fallback routes.',
      level: 'needs-you',
      read: false,
      target: { type: 'action', id: actionId },
      createdAt: now,
    },
  });
  dispatch({ type: 'SET_ACTIVE_ACTION', id: actionId });
}

// ── Authority expired during work scenario ────────────────────────────────────

export function triggerAuthorityExpiredDuringWork(dispatch: React.Dispatch<Action>) {
  const jobId = uid();
  const now = new Date();

  // Expire the stablecoin manager grant
  dispatch({
    type: 'UPDATE_AUTHORITY_GRANT',
    grantId: 'grant-stable',
    updates: { status: 'expired' as const },
  });

  const job: Job = {
    id: jobId,
    title: 'Supply 480 USDC to Morpho · 5.2% APY',
    goal: 'Supply 480 USDC from the Agent Account to Morpho on Base to capture a 5.2% APY opportunity identified by Stablecoin Manager.',
    status: 'needs-approval',
    kind: 'financial',
    leadWorkerId: 'w-stablecoin',
    leadWorkerName: 'Stablecoin Manager',
    currentStage: 'Authority expired before execution',
    stages: [{ id: 'discover', label: 'Opportunity confirmed', status: 'done' }],
    supportingWorkerIds: [],
    supportingWorkerNames: [],
    createdAt: now,
    updatedAt: now,
  };

  const attentionItem: AttentionItem = {
    id: uid(),
    title: 'Stablecoin Manager authority expired before execution',
    summary: 'Nothing was submitted · Review authority to continue',
    type: 'info',
    workerId: 'w-stablecoin',
    createdAt: now,
  };

  dispatch({ type: 'ADD_JOB', job });
  dispatch({ type: 'ADD_ATTENTION_ITEM', item: attentionItem });
  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: uid(),
      eventType: 'security',
      title: 'Stablecoin Manager authority expired',
      summary: 'Mainnet · Job held · Nothing submitted',
      effect: 'Financial execution paused. Research and monitoring continue.',
      workerId: 'w-stablecoin',
      workerName: 'Stablecoin Manager',
      grantId: 'grant-stable',
      timestamp: now,
      status: 'needs-you',
    },
  });
  dispatch({
    type: 'ADD_NOTIFICATION',
    notification: {
      id: uid(),
      title: 'Stablecoin Manager authority expired',
      summary: 'Financial action held. Nothing submitted. Review authority to continue.',
      why: 'Nothing submitted under expired authority. Review authority to continue.',
      level: 'needs-you',
      read: false,
      target: { type: 'job', id: jobId },
      createdAt: now,
    },
  });
  dispatch({ type: 'SET_ACTIVE_JOB', id: jobId });
}

// ── Stale / conflicting data scenario (Perps) ─────────────────────────────────

export function triggerStaleConflictingData(dispatch: React.Dispatch<Action>) {
  const actionId = uid();
  const now = new Date();
  const staleAt = new Date(now.getTime() - 8 * 60 * 1000);

  const action: FinancialAction = {
    id: actionId,
    title: '2× ETH Long · $500 USDC collateral · Hyperliquid',
    actionType: 'perps',
    economicEffect: 'Open a 2× ETH long using 500 USDC collateral. At current stale/conflicting data, entry and liquidation estimates cannot be safely determined.',
    rationale: 'You asked AgentPlace to open a 2× ETH leveraged long with full risk context.',
    authorityDecision: 'needs-approval',
    authorityReason: 'Connected Wallet mode — you approve and sign every financial write.',
    risks: [
      'Mark price data is stale or conflicting — liquidation estimate cannot be calculated safely.',
      'Approving on stale data may result in worse economics than shown.',
      'High-consequence action: do not approve until fresh, consistent data is available.',
    ],
    technicalDetails: {
      'Collateral': '500 USDC',
      'Leverage': '2×',
      'Notional': '~$1,000 USDC',
      'Asset': 'ETH',
      'Exchange': 'Hyperliquid · prototype',
      'Environment': 'Mainnet',
      'Data status': 'Mark price stale · sources disagree',
    },
    walletId: 'wlt-main',
    environment: 'mainnet',
    amount: '500',
    asset: 'USDC',
    protocol: 'Hyperliquid',
    network: 'Arbitrum',
    dataQuality: {
      status: 'conflicting',
      summary: 'Two market data sources disagree by more than 1.2% on the ETH mark price. Liquidation estimate cannot be safely finalized.',
      affectedFields: ['Entry price', 'Liquidation estimate', 'Notional exposure'],
      lastUpdatedAt: staleAt,
      sources: ['Pyth Network: $3,241.80', 'Chainlink: $3,283.10'],
    },
    status: 'pending-review',
    createdAt: now,
  };

  dispatch({ type: 'ADD_FINANCIAL_ACTION', action });
  dispatch({ type: 'SET_ACTIVE_ACTION', id: actionId });
}

export function createComparisonJob(dispatch: React.Dispatch<Action>): string {
  const jobId = uid();
  const activityEventId = uid();

  const job: import('../state/types').Job = {
    id: jobId,
    title: 'Compare BONK, WIF and POPCAT',
    goal: 'Compare the three meme assets using market context, smart-money evidence, risk profile, and ecosystem strength.',
    status: 'working',
    leadWorkerId: 'w-memescout',
    leadWorkerName: 'Meme Scout',
    supportingWorkerIds: ['w-smartmoney'],
    supportingWorkerNames: ['Smart Money Scout'],
    originWorkerId: 'w-memescout',
    currentStage: 'Smart-money analysis',
    stages: INITIAL_STAGES,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  dispatch({ type: 'ADD_JOB', job });
  dispatch({
    type: 'UPDATE_WORKER',
    workerId: 'w-memescout',
    updates: { status: 'working', currentJobId: jobId },
  });
  dispatch({
    type: 'ADD_ACTIVITY_EVENT',
    event: {
      id: activityEventId,
      eventType: 'job',
      title: 'Compare BONK, WIF and POPCAT',
      summary: 'Working · Meme Scout · +1 specialist',
      workerName: 'Meme Scout',
      workerId: 'w-memescout',
      jobId,
      timestamp: new Date(),
      status: 'working',
    },
  });

  runComparisonJobFlow(dispatch, jobId, activityEventId);
  return jobId;
}
