import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import type { Worker, WorkerDraftData, CreatorAsset, CollaboratorConfig, CreatorTestCase, CreatorTestResult } from '../state/types';

// ── Draft initial state ───────────────────────────────────────────────────────

const EMPTY_DRAFT: WorkerDraftData = {
  name: '',
  jobContract: '',
  responsibilities: [],
  antiJobs: [],
  method: [],
  collaborators: [],
  capabilities: [],
  routineTemplates: [],
  authorityDefault: 'Research & recommend only · No wallet authority',
  serviceBudget: 'Prototype service budget',
  testCases: [],
  testResults: [],
  networks: [],
  pricing: { type: 'free' },
};

const WHALE_MEME_DRAFT: WorkerDraftData = {
  name: 'Whale Meme Operator',
  jobContract: 'Find meme opportunities where credible wallet behaviour supports the thesis.',
  responsibilities: [
    'Identify meme token candidates with unusual smart-money accumulation',
    'Evaluate wallet quality against taught criteria',
    'Combine on-chain evidence with meme-market context',
    'Surface material risks alongside any opportunity',
  ],
  antiJobs: [
    'No autonomous trading by default',
    'Do not promote thin-liquidity tokens solely because of whale activity',
    'Do not treat one-off large wallets as reliable smart money',
  ],
  method: [],
  collaborators: [],
  capabilities: ['Token discovery', 'Liquidity analysis', 'Holder analysis', 'Wallet activity', 'Research'],
  routineTemplates: [],
  authorityDefault: 'Research & recommend only · No wallet authority',
  serviceBudget: 'Prototype service budget',
  testCases: [],
  testResults: [],
  networks: ['Solana', 'Ethereum', 'Base'],
  pricing: { type: 'free' },
};

const TEST_CASES: CreatorTestCase[] = [
  { id: 'tc-1', name: 'High-quality whale accumulation', scenario: 'Multiple repeat-profitable wallets accumulate a mid-cap token with moderate liquidity', expected: 'Surface as candidate with evidence summary' },
  { id: 'tc-2', name: 'Single large wallet, no history', scenario: 'One whale with no profitable exit history buys a token', expected: 'Deprioritise; flag as one-off without track record' },
  { id: 'tc-3', name: 'Deployer-funded wallets', scenario: 'Wallets recently funded by token deployer show accumulation', expected: 'Exclude or flag as suspicious origin' },
  { id: 'tc-4', name: 'Smart money with good liquidity', scenario: 'Cluster of 4 repeat-profitable wallets, strong liquidity, wide distribution', expected: 'High-confidence candidate' },
  { id: 'tc-5', name: 'Thin-liquidity token', scenario: 'Large whale accumulation on token with $80k liquidity, top 3 holders own 62%', expected: 'Reject or strongly downgrade' },
  { id: 'tc-6', name: 'Community velocity without smart money', scenario: 'Strong social velocity but no notable wallet accumulation', expected: 'Present as social signal only, no whale evidence' },
  { id: 'tc-7', name: 'Spreading accumulation', scenario: 'Initial whale buy followed by mid-tier wallet spread over 48h', expected: 'Surface as developing opportunity with context' },
  { id: 'tc-8', name: 'Repeat profitable wallet exits', scenario: 'One of the tracked wallets that previously accumulated is now distributing', expected: 'Flag as negative signal, update opportunity view' },
];

const INITIAL_TEST_RESULTS: CreatorTestResult[] = [
  { caseId: 'tc-1', passed: true, observed: 'Correctly surfaced with evidence', evidence: 'Wallet quality, accumulation timing, liquidity — all within acceptable bounds.' },
  { caseId: 'tc-2', passed: true, observed: 'Correctly deprioritised', evidence: 'No prior profitable exits detected. Flagged as one-off.' },
  { caseId: 'tc-3', passed: true, observed: 'Correctly excluded', evidence: 'Origin wallet identified as deployer-linked.' },
  { caseId: 'tc-4', passed: true, observed: 'High-confidence candidate surfaced', evidence: 'Cluster score high. Liquidity adequate. Holder concentration acceptable.' },
  { caseId: 'tc-5', passed: false, observed: 'Worker surfaced it as a candidate', evidence: 'Liquidity and concentration thresholds were insufficiently strict. Strong wallet signal overrode thin-liquidity risk.' },
  { caseId: 'tc-6', passed: true, observed: 'Social signal only — correctly presented without wallet framing', evidence: 'No qualifying wallets detected.' },
  { caseId: 'tc-7', passed: true, observed: 'Surfaced as developing opportunity', evidence: 'Spread pattern identified within 48h window.' },
  { caseId: 'tc-8', passed: true, observed: 'Negative signal flagged', evidence: 'Exit detected in tracked wallet. Opportunity score revised downward.' },
];

const FINAL_TEST_RESULTS: CreatorTestResult[] = INITIAL_TEST_RESULTS.map((r) =>
  r.caseId === 'tc-5' ? { ...r, passed: true, observed: 'Correctly rejected', evidence: 'Liquidity and concentration threshold applied. Wallet signal did not override.' } : r
);

// ── Step-based demo conversation ──────────────────────────────────────────────

type BuilderStep =
  | 'idle'
  | 'initial-response'
  | 'existing-expertise'
  | 'collaborators-added'
  | 'teach-prompt'
  | 'teach-response'
  | 'testing'
  | 'test-results'
  | 'improving'
  | 'improvement-applied'
  | 'retest'
  | 'final-test-results'
  | 'published';

interface BuilderMessage {
  id: string;
  role: 'user' | 'builder';
  content: string;
}

// ── Live Worker Draft Panel ───────────────────────────────────────────────────

function DraftSection({ title, children, collapsible, defaultOpen = true }: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border-dim last:border-0">
      <button
        onClick={() => collapsible && setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-left ${collapsible ? 'hover:bg-panel-raised cursor-pointer' : 'cursor-default'}`}
      >
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">{title}</span>
        {collapsible && (
          <svg className={`w-3 h-3 text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function LiveDraftPanel({ draft, step, testResults }: { draft: WorkerDraftData; step: BuilderStep; testResults: CreatorTestResult[] }) {
  const hasContent = draft.name || draft.jobContract || draft.responsibilities.length > 0;

  if (!hasContent) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-10 h-10 rounded-full bg-panel-raised border border-border flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-xs text-text-dim">Worker Draft appears here</p>
        </div>
      </div>
    );
  }

  const passCount = testResults.filter((r) => r.passed).length;
  const allPassed = passCount === testResults.length && testResults.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border-dim">
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-0.5">Live Worker Draft</p>
        <p className="text-sm font-semibold text-text">{draft.name || 'Untitled Worker'}</p>
      </div>

      <DraftSection title="Job Contract">
        <p className="text-xs text-text-sub leading-relaxed">{draft.jobContract || '—'}</p>
      </DraftSection>

      {draft.responsibilities.length > 0 && (
        <DraftSection title="Responsibilities">
          <ul className="space-y-1">
            {draft.responsibilities.map((r) => (
              <li key={r} className="text-xs text-text-sub flex items-start gap-1.5">
                <span className="text-text-dim mt-0.5 shrink-0">·</span>{r}
              </li>
            ))}
          </ul>
        </DraftSection>
      )}

      {draft.antiJobs.length > 0 && (
        <DraftSection title="Anti-jobs" collapsible defaultOpen={false}>
          <ul className="space-y-1">
            {draft.antiJobs.map((a) => (
              <li key={a} className="text-xs text-text-sub flex items-start gap-1.5">
                <span className="text-danger mt-0.5 shrink-0">—</span>{a}
              </li>
            ))}
          </ul>
        </DraftSection>
      )}

      {draft.method.length > 0 && (
        <DraftSection title="Method / Expertise">
          <ul className="space-y-1">
            {draft.method.map((m) => (
              <li key={m} className="text-xs text-text-sub flex items-start gap-1.5">
                <span className="text-accent mt-0.5 shrink-0">→</span>{m}
              </li>
            ))}
          </ul>
        </DraftSection>
      )}

      {draft.collaborators.length > 0 && (
        <DraftSection title="Collaborators">
          <div className="space-y-2">
            {draft.collaborators.map((c) => (
              <div key={c.id} className="bg-panel-raised border border-border-dim rounded px-3 py-2">
                <p className="text-xs font-medium text-text">{c.pinnedWorkerName ?? c.role}</p>
                <p className="text-[10px] text-text-muted">{c.roleBased ? 'Role-based selection' : 'Pinned'} · {c.whenUsed}</p>
                <p className="text-[10px] text-text-dim mt-0.5">{c.authorityBoundary}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-dim mt-2">Collaborators do not inherit this Worker's wallet authority.</p>
        </DraftSection>
      )}

      {draft.capabilities.length > 0 && (
        <DraftSection title="Capabilities" collapsible defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {draft.capabilities.map((c) => (
              <span key={c} className="text-[10px] font-mono text-text-muted bg-panel border border-border-dim rounded px-2 py-0.5">{c}</span>
            ))}
          </div>
        </DraftSection>
      )}

      <DraftSection title="Routines" collapsible defaultOpen={false}>
        <p className="text-xs text-text-dim">None by default</p>
      </DraftSection>

      <DraftSection title="Authority Default">
        <p className="text-xs text-text-sub">{draft.authorityDefault}</p>
        <p className="text-[10px] text-text-dim mt-1">End-user authority is configured separately and not set by this default.</p>
      </DraftSection>

      <DraftSection title="Budget" collapsible defaultOpen={false}>
        <p className="text-xs text-text-dim">{draft.serviceBudget}</p>
      </DraftSection>

      <DraftSection title="Tests" collapsible defaultOpen={step === 'test-results' || step === 'final-test-results' || step === 'published'}>
        {testResults.length === 0 ? (
          <p className="text-xs text-text-dim">Not run yet</p>
        ) : (
          <div>
            <div className={`text-sm font-semibold mb-2 ${allPassed ? 'text-accent' : 'text-warn'}`}>
              {passCount} / {testResults.length} passed
            </div>
            <div className="space-y-1">
              {testResults.map((r) => (
                <div key={r.caseId} className={`flex items-center gap-2 text-xs ${r.passed ? 'text-text-sub' : 'text-danger'}`}>
                  <span>{r.passed ? '✓' : '✗'}</span>
                  <span>{TEST_CASES.find((c) => c.id === r.caseId)?.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DraftSection>

      <DraftSection title="Networks" collapsible defaultOpen={false}>
        <div className="flex flex-wrap gap-1.5">
          {draft.networks.map((n) => (
            <span key={n} className="text-[10px] font-mono text-text-muted bg-panel border border-border-dim rounded px-2 py-0.5">{n}</span>
          ))}
        </div>
      </DraftSection>

      <DraftSection title="Pricing" collapsible defaultOpen={false}>
        <p className="text-xs text-text-dim">{draft.pricing.type === 'free' ? 'Free' : draft.pricing.label ?? 'Paid'}</p>
      </DraftSection>
    </div>
  );
}

// ── Main AgentBuilder component ────────────────────────────────────────────────

export function AgentBuilder() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [draft, setDraft] = useState<WorkerDraftData>(EMPTY_DRAFT);
  const [step, setStep] = useState<BuilderStep>('idle');
  const [teachMode, setTeachMode] = useState(false);
  const [testResults, setTestResults] = useState<CreatorTestResult[]>([]);
  const [mobileTab, setMobileTab] = useState<'chat' | 'draft'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Pre-fill from fork if there is one — not implemented yet, draft starts empty
  const forkSource = null as null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function addBuilderMessage(content: string) {
    setMessages((prev) => [...prev, { id: uid(), role: 'builder', content }]);
    setIsStreaming(false);
  }

  function streamBuilderMessage(content: string) {
    setIsStreaming(true);
    const id = uid();
    setMessages((prev) => [...prev, { id, role: 'builder', content: '' }]);
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content } : m));
      setIsStreaming(false);
    }, 700);
  }

  function handleSend() {
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: uid(), role: 'user', content: text }]);

    if (step === 'idle') {
      // Initial request — start forming the draft
      setStep('initial-response');
      setDraft(WHALE_MEME_DRAFT);
      setTimeout(() => {
        streamBuilderMessage(
          `Got it. I'm forming **Whale Meme Operator** — a Worker focused on meme opportunities backed by credible on-chain wallet evidence.\n\nBefore I build from scratch, I noticed AgentPlace already has relevant expertise:\n\n**Meme Scout** — meme-token research across Solana and EVM chains\n**Smart Money Tracker** — wallet-quality and accumulation analysis\n\nThese could be collaborators rather than things you rebuild. Would you like to:\n\n• **Use existing expertise** (recommended — faster, and they're already proven)\n• **Teach unique expertise** from scratch`
        );
      }, 400);
    } else if (step === 'teach-prompt') {
      // Creator teaches wallet methodology
      setStep('teach-response');
      setTimeout(() => {
        const updatedMethod = [
          'Prioritise repeat profitable wallet behaviour over one-off position size',
          'Deprioritise wallets that have only made a single large buy',
          'Exclude or degrade wallets recently funded by a token deployer',
        ];
        setDraft((d) => ({ ...d, method: updatedMethod }));
        streamBuilderMessage(
          `Understood. I've updated the Method / Expertise section with your criteria:\n\n→ Prioritise repeat profitable wallet behaviour\n→ Deprioritise one-off size\n→ Exclude/degrade deployer-funded wallets\n\nDoes this look right?`
        );
      }, 500);
    }
  }

  function handleUseExistingExpertise() {
    setStep('collaborators-added');
    const collaborators: CollaboratorConfig[] = [
      {
        id: 'collab-memescout',
        role: 'Meme-token opportunity research',
        pinnedWorkerId: 'w-memescout',
        pinnedWorkerName: 'Meme Scout',
        roleBased: false,
        whenUsed: 'Initial candidate discovery and meme-market context',
        contextShared: 'Token name, timeframe, market context',
        required: true,
        authorityBoundary: 'Research only — no wallet authority',
      },
      {
        id: 'collab-smartmoney',
        role: 'Wallet-quality / whale-flow analysis',
        pinnedWorkerId: undefined,
        pinnedWorkerName: undefined,
        roleBased: true,
        whenUsed: 'Smart-money evidence layer for any candidate',
        contextShared: 'Token addresses, timeframe',
        required: true,
        fallback: 'Skip smart-money layer if unavailable',
        authorityBoundary: 'Research only — no wallet authority',
      },
    ];
    setDraft((d) => ({ ...d, collaborators }));
    setTimeout(() => {
      streamBuilderMessage(
        `Collaborators added to the draft:\n\n**Meme Scout** — pinned, provides meme-token research\n**Smart Money Tracker role** — role-based selection for wallet-quality analysis\n\nCollaborators do not inherit Whale Meme Operator's wallet authority.\n\nWould you like to **teach unique expertise** now — your specific criteria for evaluating whale quality — or go straight to testing?`
      );
    }, 400);
  }

  function handleTeachExpertise() {
    setStep('teach-prompt');
    setTeachMode(true);
    streamBuilderMessage(
      `Teach Mode active. Describe how you evaluate smart-money quality for meme opportunities. For example:\n\n• What wallet behaviour do you prioritise?\n• What signals do you ignore or distrust?\n• Any edge cases the Worker should handle carefully?\n\nI'll interpret your input and update the Method / Expertise section.`
    );
  }

  function handleLooksRight() {
    setStep('testing');
    setTimeout(() => {
      // Identity checkpoint if no user
      if (!state.user) {
        dispatch({
          type: 'SET_IDENTITY_CHECKPOINT',
          checkpoint: {
            reason: 'test-worker',
            feature: 'save your draft and run worker tests',
            onComplete: (user) => {
              dispatch({ type: 'SET_USER', user });
              runTests();
            },
          },
        });
      } else {
        runTests();
      }
    }, 200);
  }

  function runTests() {
    setStep('testing');
    streamBuilderMessage('Running acceptance suite… 8 scenarios.');
    const updatedDraft = { ...draft, testCases: TEST_CASES };
    setDraft(updatedDraft);
    setTimeout(() => {
      setTestResults(INITIAL_TEST_RESULTS);
      setStep('test-results');
      setDraft((d) => ({ ...d, testResults: INITIAL_TEST_RESULTS }));
      streamBuilderMessage(
        `**7 / 8 passed.** One case needs refinement.\n\n✗ **Thin-liquidity meme token** — Worker surfaced it as a candidate.\n\nExpected: Reject or strongly downgrade (thin liquidity, high holder concentration).\nObserved: Strong wallet activity overrode the liquidity and concentration risk.\n\nEvidence: Liquidity and concentration thresholds were insufficiently strict.\n\nDo not show internal reasoning — only structured output.\n\nWould you like to **Improve Worker**?`
      );
    }, 2000);
  }

  function handleImproveWorker() {
    setStep('improving');
    streamBuilderMessage(
      `To fix the failing case, I suggest:\n\n**Add anti-job:**\n"Do not recommend candidates below minimum liquidity threshold regardless of wallet signal strength."\n\n**Add rule:**\n"Strong wallet activity cannot override critical liquidity or holder concentration risk."\n\nApply this improvement?`
    );
  }

  function handleApplyImprovement() {
    setStep('improvement-applied');
    setDraft((d) => ({
      ...d,
      antiJobs: [
        ...d.antiJobs,
        'Do not recommend candidates below minimum liquidity threshold, regardless of wallet signal strength',
      ],
      method: [
        ...d.method,
        'Strong wallet activity cannot override critical liquidity or holder concentration risk',
      ],
    }));
    streamBuilderMessage(
      `Improvement applied. Anti-job and rule added to the draft.\n\nReady to run the acceptance suite again?`
    );
  }

  function handleRetest() {
    setStep('retest');
    streamBuilderMessage('Re-running acceptance suite…');
    setTimeout(() => {
      setTestResults(FINAL_TEST_RESULTS);
      setStep('final-test-results');
      setDraft((d) => ({ ...d, testResults: FINAL_TEST_RESULTS }));
      streamBuilderMessage(
        `**8 / 8 passed.** Prototype acceptance suite passed.\n\nPassing this prototype suite does not grant financial authority or self-certify production safety. These tests confirm the Worker behaves as designed within prototype scenarios.\n\nReady to use this Worker?`
      );
    }, 1800);
  }

  function handleUsePrivately() {
    if (!state.user) {
      dispatch({
        type: 'SET_IDENTITY_CHECKPOINT',
        checkpoint: {
          reason: 'save-worker',
          feature: 'save and use your Worker privately',
          onComplete: (user) => {
            dispatch({ type: 'SET_USER', user });
            finalizePrivate();
          },
        },
      });
    } else {
      finalizePrivate();
    }
  }

  function finalizePrivate() {
    const assetId = uid();
    const workerId = 'w-whale-meme-' + uid().slice(0, 4);
    const finalDraft = { ...draft, testResults };

    const asset: CreatorAsset = {
      id: assetId,
      type: 'worker',
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
      workerDraft: finalDraft,
    };

    const worker: Worker = {
      id: workerId,
      name: 'Whale Meme Operator',
      tagline: 'Finds meme opportunities backed by credible whale wallet behaviour',
      status: 'standby',
      isOriginal: false,
      responsibility: 'Whale Meme Operator researches meme opportunities where credible wallet behaviour supports the thesis.',
      authoritySummary: 'Research & recommend only · No wallet authority',
    };

    dispatch({ type: 'ADD_CREATOR_ASSET', asset });
    dispatch({ type: 'ADD_WORKER', worker });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'worker-added',
        title: 'Whale Meme Operator published privately',
        summary: 'Created by you · Research & recommend only · No wallet authority',
        workerId,
        workerName: 'Whale Meme Operator',
        timestamp: new Date(),
        status: 'complete',
      },
    });

    setStep('published');
    streamBuilderMessage(
      `Whale Meme Operator is now available in your Workers.\n\nAuthority: Research & recommend only · No wallet authority.\n\nFinancial authority can be configured separately when you need it. Your Worker is private — it does not appear in public Discover.`
    );
  }

  function handlePublish() {
    // Publishing updates discover supply
    const existingAsset = (state.creatorAssets ?? []).find((a) => a.workerDraft?.name === 'Whale Meme Operator');
    if (existingAsset) {
      const supplyId = 'ds-whale-meme-' + uid().slice(0, 4);
      dispatch({
        type: 'ADD_DISCOVER_SUPPLY_ITEM',
        item: {
          id: supplyId,
          type: 'worker',
          name: 'Whale Meme Operator',
          tagline: 'Finds meme opportunities backed by credible whale wallet behaviour',
          description: draft.jobContract,
          whatItDoes: draft.responsibilities,
          whatItDoesNot: draft.antiJobs,
          creatorId: state.user?.id ?? 'u1',
          creatorName: state.user?.name ?? 'You',
          isOriginal: false,
          category: 'Research & Discovery',
          networks: draft.networks,
          pricing: draft.pricing,
          visibility: 'public',
          authorityDefault: draft.authorityDefault,
          sponsored: false,
          lastUpdated: new Date(),
          version: '0.1.0',
          creatorAssetId: existingAsset.id,
        },
      });
      dispatch({ type: 'UPDATE_CREATOR_ASSET', assetId: existingAsset.id, updates: { visibility: 'public' } });
    }
    streamBuilderMessage('Whale Meme Operator is now public in Discover. Discover has been updated.');
  }

  function closeSurface() {
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const canSend = input.trim().length > 0 && !isStreaming;

  const ChatPanel = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text">Agent Builder</p>
          <p className="text-xs text-text-muted">
            {teachMode ? 'Teach Mode active' : 'Design your Worker conversationally'}
          </p>
        </div>
        <button onClick={closeSurface} className="text-text-muted hover:text-text p-1 rounded transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-text-sub mb-1">Describe the Worker you want to build.</p>
            <p className="text-xs text-text-muted">Agent Builder will form a Live Draft as you talk.</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-panel-raised border border-border text-text-sub rounded-bl-sm'
            }`}>
              {m.content.split('\n').map((line, i) => {
                const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                return (
                  <p key={i} className={i > 0 ? 'mt-1.5' : ''} dangerouslySetInnerHTML={{ __html: bold }} />
                );
              })}
            </div>
          </div>
        ))}

        {/* Action buttons based on step */}
        {step === 'initial-response' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleUseExistingExpertise}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Use existing expertise
            </button>
            <button
              onClick={handleTeachExpertise}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Teach unique expertise
            </button>
          </div>
        )}

        {step === 'collaborators-added' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleTeachExpertise}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Teach unique expertise
            </button>
            <button
              onClick={handleLooksRight}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Test Worker
            </button>
          </div>
        )}

        {step === 'teach-response' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleLooksRight}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Looks right — Test Worker
            </button>
            <button
              onClick={() => {
                setStep('teach-prompt');
                streamBuilderMessage("What else would you like to teach?");
              }}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Continue teaching
            </button>
          </div>
        )}

        {step === 'test-results' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleImproveWorker}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Improve Worker
            </button>
          </div>
        )}

        {step === 'improving' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleApplyImprovement}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Apply improvement
            </button>
            <button
              onClick={() => {
                setStep('teach-prompt');
                setTeachMode(true);
                streamBuilderMessage("What would you like to change instead?");
              }}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Edit
            </button>
          </div>
        )}

        {step === 'improvement-applied' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleRetest}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Re-run tests
            </button>
          </div>
        )}

        {step === 'final-test-results' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={handleUsePrivately}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Use privately
            </button>
            <button className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors">
              Publishing options
            </button>
          </div>
        )}

        {step === 'published' && !isStreaming && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            <button
              onClick={() => {
                dispatch({ type: 'SET_CREATOR_SURFACE', surface: null });
                dispatch({ type: 'SET_VIEW', view: 'workers' });
              }}
              className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              Open in Workers
            </button>
            <button
              onClick={handlePublish}
              className="px-4 py-2 text-xs font-medium border border-border text-text-sub rounded-lg hover:bg-panel-raised transition-colors"
            >
              Publish publicly
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {step !== 'published' && (
        <div className="px-5 py-4 border-t border-border shrink-0">
          {step === 'idle' && (
            <p className="text-xs text-text-dim mb-2">
              Example: "Build me a whale-driven meme scout."
            </p>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-primary/50"
              placeholder={teachMode ? 'Describe your criteria…' : 'Describe what you want to build…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-40 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const DraftPanelContent = (
    <LiveDraftPanel draft={draft} step={step} testResults={testResults} />
  );

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Mobile tabs */}
      <div className="md:hidden flex border-b border-border shrink-0">
        {(['chat', 'draft'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              mobileTab === t ? 'border-primary text-text' : 'border-transparent text-text-sub'
            }`}
          >
            {t === 'chat' ? 'Chat' : 'Draft'}
          </button>
        ))}
      </div>

      {/* Desktop: side by side; mobile: tabs */}
      <div className="flex-1 overflow-hidden flex">
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col md:w-[55%] border-r border-border`}>
          {ChatPanel}
        </div>
        <div className={`${mobileTab === 'draft' ? 'flex' : 'hidden'} md:flex flex-col md:flex-1 bg-panel`}>
          {DraftPanelContent}
        </div>
      </div>
    </div>
  );
}
