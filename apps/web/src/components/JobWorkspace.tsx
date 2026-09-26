import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import { ExecutionTimeline } from './ExecutionTimeline';
import type { ExecutionStatus } from '../state/types';
import { WEB_RUNTIME_SETTINGS } from '../platform/runtime';

interface JobMessage {
  id: string;
  role: 'user' | 'manager';
  content: string;
  isStreaming?: boolean;
}

function ProgressBar({ stages }: { stages: { id: string; label: string; status: 'done' | 'active' | 'pending' }[] }) {
  return (
    <div className="flex items-center gap-0">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-0 flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  stage.status === 'done'
                    ? 'bg-accent'
                    : stage.status === 'active'
                    ? 'bg-primary'
                    : 'bg-panel-raised border border-border'
                }`}
              >
                {stage.status === 'done' && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {stage.status === 'active' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </div>
              {i < stages.length - 1 && (
                <div
                  className={`h-px flex-1 ${
                    stage.status === 'done' ? 'bg-accent/40' : 'bg-border'
                  }`}
                />
              )}
            </div>
            <span
              className={`text-[10px] text-center leading-tight ${
                stage.status === 'done'
                  ? 'text-accent'
                  : stage.status === 'active'
                  ? 'text-primary'
                  : 'text-text-muted'
              }`}
            >
              {stage.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function getExecutionSteps(executionStatus?: ExecutionStatus): { label: string; status: 'done' | 'active' | 'pending' | 'error' | 'unknown' }[] {
  if (!executionStatus) return [];
  const statuses: ExecutionStatus[] = ['approved', 'submitting', 'submitted', 'confirming', 'settling', 'verifying', 'completed'];
  const idx = statuses.indexOf(executionStatus);
  return [
    { label: 'Authorized', status: idx > 0 ? 'done' : executionStatus === 'approved' ? 'active' : 'pending' },
    { label: 'Submitted', status: idx > 1 ? 'done' : idx === 1 ? 'active' : 'pending' },
    { label: 'Source transaction confirmed', status: idx > 3 ? 'done' : idx >= 2 ? 'active' : 'pending' },
    { label: 'Destination settlement', status: idx > 4 ? 'done' : idx === 4 ? 'active' : 'pending' },
    { label: 'Outcome verification', status: executionStatus === 'completed' ? 'done' : executionStatus === 'verifying' ? 'active' : executionStatus === 'unknown' ? 'unknown' : 'pending' },
  ];
}

function jobStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'needs-approval': 'Needs your approval',
    'executing': 'Executing',
    'settling': 'Settling',
    'verifying': 'Transaction confirmed · Verifying outcome',
    'completed': 'Completed · AgentPlace Verified',
    'recovering': 'Recovering',
    'unknown': 'Confirming transaction status',
    'failed': 'Failed',
    'needs-you': 'Needs you',
    'planning': 'Planning',
    'working': 'Working',
    'blocked': 'Blocked',
  };
  return map[status] ?? status;
}

function FinancialJobWorkspace() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<'conversation' | 'execution' | 'outcome'>('execution');

  const job = (state.jobs ?? []).find((j) => j.id === state.activeJobId);

  if (!job) {
    return (
      <div className="h-full flex items-center justify-center bg-bg text-text-muted text-sm">
        Job not found
      </div>
    );
  }

  const executionRecord = job.executionId
    ? (state.executionRecords ?? []).find((r) => r.id === job.executionId)
    : (state.executionRecords ?? []).find((r) => r.jobId === job.id);

  const verifiedOutcome = job.verifiedOutcomeId
    ? (state.verifiedOutcomes ?? []).find((v) => v.id === job.verifiedOutcomeId)
    : null;

  const receipt = job.receiptId
    ? (state.verifiedReceipts ?? []).find((r) => r.id === job.receiptId)
    : null;

  const originConv = job.originConversationId
    ? (state.conversations ?? []).find((c) => c.id === job.originConversationId)
    : null;

  const isComplete = job.status === 'completed';
  const steps = getExecutionSteps(executionRecord?.status);

  const statusColor =
    job.status === 'completed' ? 'text-accent' :
    job.status === 'recovering' ? 'text-warn' :
    job.status === 'unknown' ? 'text-warn' :
    job.status === 'failed' ? 'text-danger' :
    'text-primary';

  const dotColor =
    job.status === 'completed' ? 'bg-accent' :
    job.status === 'recovering' ? 'bg-warn' :
    job.status === 'unknown' ? 'bg-warn' :
    job.status === 'failed' ? 'bg-danger' :
    'bg-primary';

  const tabs: Array<'conversation' | 'execution' | 'outcome'> = [
    'conversation',
    'execution',
    ...(isComplete ? ['outcome' as const] : []),
  ];

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-start gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: null })}
            className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-base font-semibold text-text">{job.title}</h1>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${job.status !== 'completed' ? 'animate-pulse' : ''}`} />
                <span className={`text-xs ${statusColor}`}>{jobStatusLabel(job.status)}</span>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-0.5">{job.goal}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted flex-wrap">
              <span>Lead: <span className="text-text-sub">{job.leadWorkerName}</span></span>
              {job.routineId && (() => {
                const routine = (state.routines ?? []).find((r) => r.id === job.routineId);
                if (!routine) return null;
                return (
                  <>
                    <span className="text-text-dim">·</span>
                    <span>
                      Origin:{' '}
                      <button
                        onClick={() => {
                          dispatch({ type: 'SET_ACTIVE_JOB', id: null });
                          dispatch({ type: 'SET_ACTIVE_ROUTINE', id: routine.id });
                        }}
                        className="text-primary hover:underline"
                      >
                        {routine.title}
                      </button>
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="flex gap-0 mt-4 border-b border-border -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-text'
                  : 'border-transparent text-text-muted hover:text-text-sub'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {activeTab === 'conversation' && (
          <div className="max-w-2xl mx-auto space-y-4">
            {originConv ? (
              originConv.messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-xl bg-panel-raised border border-border rounded-lg px-4 py-3">
                        <p className="text-sm text-text leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-6 h-6 rounded bg-primary-dim flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-primary">AP</span>
                    </div>
                    <div className="flex-1 min-w-0 text-text-sub">
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-text-muted py-8 text-center">No linked conversation</p>
            )}
          </div>
        )}

        {activeTab === 'execution' && (
          <div className="max-w-xl space-y-5">
            {job.status === 'needs-approval' && (
              <div className="border border-primary/20 rounded-lg px-4 py-4 bg-primary-dim/5">
                <p className="text-sm font-medium text-text mb-1">Awaiting your approval</p>
                <p className="text-xs text-text-sub leading-relaxed mb-4">Review the action details, quote, and risks before approving.</p>
                {job.actionId && (
                  <button
                    onClick={() => dispatch({ type: 'SET_ACTIVE_ACTION', id: job.actionId! })}
                    className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
                  >
                    Review action
                  </button>
                )}
              </div>
            )}

            {job.status === 'unknown' && (
              <div className="border border-warn/30 rounded-lg px-4 py-4 bg-warn/5 space-y-2">
                <p className="text-sm font-semibold text-warn">Confirming transaction status</p>
                <div className="space-y-1.5">
                  {[
                    ['What happened', 'A broadcast was attempted. AgentPlace cannot yet determine whether the original transaction reached the network.'],
                    ['Affected', 'Confirmation and settlement are pending.'],
                    ['Still known', 'The action was signed. A broadcast was attempted.'],
                    ['AgentPlace', 'Checking the original transaction — not resubmitting.'],
                    ['You', 'No action needed yet. Do not resubmit.'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 text-xs">
                      <span className="text-text-dim w-28 shrink-0">{k}</span>
                      <span className="text-text-sub">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-danger font-medium pt-1">DO NOT RESUBMIT — AgentPlace is verifying the original transaction.</p>
              </div>
            )}

            {job.status === 'recovering' && executionRecord?.recovery && (
              <div className="border border-warn/30 rounded-lg px-4 py-4 bg-warn/5 space-y-3">
                <p className="text-sm font-semibold text-warn">Recovering</p>
                <div className="space-y-1.5">
                  {[
                    ['What happened', executionRecord.recovery.completedSteps.join(' Completed. ') + (executionRecord.recovery.incompleteSteps.length > 0 ? ` ${executionRecord.recovery.incompleteSteps[0]} did not complete.` : '')],
                    ['Affected', 'The intended operation is only partially complete.'],
                    ['Verified state', `${executionRecord.recovery.verifiedCurrentAmount} · ${executionRecord.recovery.verifiedCurrentLocation}`],
                    ['AgentPlace', executionRecord.recovery.notes ?? 'Evaluating eligible recovery paths.'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 text-xs">
                      <span className="text-text-dim w-28 shrink-0">{k}</span>
                      <span className={k === 'Verified state' ? 'text-accent font-mono' : 'text-text-sub'}>{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-text-dim">Recovery starts from the verified current state — the completed steps are recorded as they happened.</p>
              </div>
            )}

            {steps.length > 0 && job.status !== 'needs-approval' && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Execution steps</p>
                <ExecutionTimeline steps={steps} />
              </div>
            )}

            {/* Authority expired before execution */}
            {job.status === 'needs-approval' && job.currentStage === 'Authority expired before execution' && (
              <div className="border border-warn/40 rounded-lg px-4 py-4 bg-warn/5 space-y-2.5">
                <p className="text-sm font-semibold text-warn">Authority expired</p>
                <div className="space-y-1.5">
                  {[
                    ['What happened', 'Stablecoin Manager\'s standing authority expired before this financial action was submitted.'],
                    ['Affected', 'This financial action cannot proceed autonomously.'],
                    ['Still works', 'Stablecoin Manager can continue research and recommendations.'],
                    ['Still safe', 'Nothing was submitted under expired authority.'],
                    ['AgentPlace', 'Holding the discovered opportunity.'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 text-xs">
                      <span className="text-text-dim w-28 shrink-0">{k}</span>
                      <span className={k === 'Still works' || k === 'Still safe' ? 'text-accent' : 'text-text-sub'}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => dispatch({ type: 'SET_VIEW', view: 'security' })}
                    className="px-3.5 py-1.5 text-xs font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
                  >
                    Review authority
                  </button>
                  <button className="px-3.5 py-1.5 text-xs text-text-sub border border-border rounded hover:bg-panel hover:text-text transition-colors">
                    Keep recommendation only
                  </button>
                </div>
                <p className="text-[10px] text-text-dim">Mainnet · Authority will not be silently renewed. Worker, Routine, and history are preserved.</p>
              </div>
            )}

            {executionRecord?.routeAdjusted && executionRecord.routeAdjustmentNote && (
              <div className="border border-border-dim rounded-lg px-4 py-3 bg-panel-raised/40">
                <p className="text-xs font-medium text-text-sub mb-1">Route adjusted automatically</p>
                <p className="text-xs text-text-muted leading-relaxed">{executionRecord.routeAdjustmentNote}</p>
                <p className="text-[10px] text-text-dim mt-1">No action needed · All terms remained within your approved envelope.</p>
              </div>
            )}

            {executionRecord?.transactionEvidence && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Source transaction</p>
                <div className="border border-border rounded-lg px-4 py-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Network</span>
                    <span className="text-text-sub">{executionRecord.transactionEvidence.network}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Hash</span>
                    <span className="text-text-sub font-mono truncate max-w-[200px]">{executionRecord.transactionEvidence.txHash.slice(0, 18)}…</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Status</span>
                    <span className={`font-mono ${executionRecord.transactionEvidence.confirmationState === 'confirmed' ? 'text-accent' : executionRecord.transactionEvidence.confirmationState === 'unknown' ? 'text-warn' : 'text-text-sub'}`}>
                      {executionRecord.transactionEvidence.confirmationState}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {executionRecord?.settlementObservations && executionRecord.settlementObservations.length > 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Destination settlement</p>
                {executionRecord.settlementObservations.map((obs, i) => (
                  <div key={i} className="border border-border rounded-lg px-4 py-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Destination</span>
                      <span className="text-text-sub">{obs.expectedDestination}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Minimum expected</span>
                      <span className="text-text-sub font-mono">{obs.minimumExpectedAmount}</span>
                    </div>
                    {obs.observedAmount && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Observed</span>
                        <span className="text-accent font-mono">{obs.observedAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-muted">Status</span>
                      <span className={`font-mono ${obs.status === 'observed' ? 'text-accent' : obs.status === 'failed' ? 'text-danger' : 'text-text-sub'}`}>
                        {obs.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'outcome' && isComplete && (
          <div className="max-w-xl space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-accent">Completed · AgentPlace Verified</span>
            </div>

            {verifiedOutcome && (
              <div className="border border-accent/20 rounded-lg px-4 py-4 bg-accent-dim/5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-accent mb-2">Actual outcome</p>
                <p className="text-sm text-text leading-relaxed">{verifiedOutcome.actualOutcome}</p>
              </div>
            )}

            {executionRecord?.currentVerifiedState && (
              <div className="border border-border rounded-lg px-4 py-3 text-xs">
                <p className="text-text-muted mb-1">Verified state</p>
                <p className="text-text-sub font-mono">{executionRecord.currentVerifiedState}</p>
              </div>
            )}

            {receipt && (
              <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_RECEIPT', id: receipt.id })}
                className="w-full py-2.5 border border-accent/30 rounded text-sm text-accent hover:bg-accent-dim/10 transition-colors"
              >
                View verified receipt
              </button>
            )}

            <p className="text-[10px] text-text-dim text-center">Prototype · illustrative values</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function JobWorkspace() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'conversation' | 'team' | 'result'>('conversation');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const job = (state.jobs ?? []).find((j) => j.id === state.activeJobId);
  const durableConversation = job ? state.conversations.find((c) => c.scope === 'job' && c.jobId === job.id) : undefined;
  const durableMessages: JobMessage[] = durableConversation?.messages.map((m) => ({ id: m.id, role: m.role === 'user' ? 'user' : 'manager', content: m.content })) ?? [];
  const productionConversation = WEB_RUNTIME_SETTINGS.dataMode === 'api' && !!state.user;
  const displayMessages = productionConversation ? durableMessages : messages;

  if (job?.kind === 'financial') {
    return <FinancialJobWorkspace />;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  if (!job) {
    return (
      <div className="h-full flex items-center justify-center bg-bg text-text-muted text-sm">
        Job not found
      </div>
    );
  }

  const isComplete = job.status === 'completed';
  const leadWorker = state.workers.find((w) => w.id === job.leadWorkerId);

  function sendMessage() {
    if (!input.trim()) return;
    if (!job) return;
    const text = input.trim();
    setInput('');

    if (productionConversation && durableConversation) {
      dispatch({ type: 'ADD_MSG', convId: durableConversation.id, msg: { id: uid(), role: 'user', content: text, timestamp: new Date() } });
      dispatch({
        type: 'ADD_MSG',
        convId: durableConversation.id,
        msg: {
          id: uid(),
          role: 'manager',
          content: 'Your message is saved to this durable Job. The real AgentPlace Intelligence and capability runtime arrives in Production Milestone 4, so this Milestone 3 Job will not fabricate research or execution results.',
          timestamp: new Date(),
          jobId: job.id,
        },
      });
      return;
    }

    const userMsg: JobMessage = { id: uid(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    const managerMsgId = uid();
    setMessages((prev) => [...prev, { id: managerMsgId, role: 'manager', content: '', isStreaming: true }]);

    const lc = text.toLowerCase();
    let response = '';

    if (lc.includes('wif') && (lc.includes('strong') || lc.includes('why') || lc.includes('better'))) {
      response =
        "WIF's advantage is in the combination of signals: the Twitter velocity is the highest of the three (+68k followers this week) and the on-chain accumulation is the most deliberate — 5 distinct wallets above $2M bought in the past 7 days. BONK's smart money signal is milder, and POPCAT has the thinnest institutional-wallet evidence. Smart Money Scout found no notable counter-signals that would undermine the WIF read.";
    } else if (lc.includes('smart money') || lc.includes('smart money scout')) {
      response =
        "Smart Money Scout analysed wallet-quality data across the three assets. For WIF: clear accumulation from 5 wallets >$2M. For BONK: 3 wallets >$5M with mild accumulation, 2 mid-tier holders reducing slightly. For POPCAT: no clear smart-money signal — the movement appears retail-driven.";
    } else if (lc.includes('holder') || lc.includes('risk')) {
      response =
        "Holder risk: BONK has the most distributed supply — top 10 wallets hold ~18%. WIF's concentration is moderate. POPCAT has higher concentration relative to its market cap, which amplifies downside risk if larger holders rotate out. For equivalent position sizes, POPCAT carries the most single-event risk.";
    } else {
      response =
        "That's a good question about this comparison. The analysis is based on market data, smart-money signals, and ecosystem depth as of the time of the job. Meme Scout can refresh any element of this analysis — just say which aspect you want to re-examine.";
    }

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === managerMsgId ? { ...m, content: response, isStreaming: false } : m))
      );
    }, 1200);
  }

  const isStreaming = displayMessages.some((m) => m.isStreaming);

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-start gap-3">
          <button
            onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: null })}
            className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-base font-semibold text-text">{job.title}</h1>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-accent' : 'bg-primary'}`}
                />
                <span className={`text-xs ${isComplete ? 'text-accent' : 'text-primary'}`}>
                  {isComplete ? 'Research complete' : job.status === 'planning' ? 'Planning' : 'Working'}
                </span>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-0.5">{job.goal}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted flex-wrap">
              <span>
                Lead: <span className="text-text-sub">{job.leadWorkerName}</span>
              </span>
              {job.supportingWorkerNames.length > 0 && (
                <span>
                  +{job.supportingWorkerNames.length} specialist
                </span>
              )}
              {job.routineId && (() => {
                const routine = (state.routines ?? []).find((r) => r.id === job.routineId);
                if (!routine) return null;
                return (
                  <>
                    <span className="text-text-dim">·</span>
                    <span>
                      Origin:{' '}
                      <button
                        onClick={() => {
                          dispatch({ type: 'SET_ACTIVE_JOB', id: null });
                          dispatch({ type: 'SET_ACTIVE_ROUTINE', id: routine.id });
                        }}
                        className="text-primary hover:underline"
                      >
                        {routine.title}
                      </button>
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <ProgressBar stages={job.stages} />
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-4 border-b border-border -mb-px">
          {(['conversation', 'team', ...(isComplete ? ['result'] : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-text'
                  : 'border-transparent text-text-muted hover:text-text-sub'
              }`}
            >
              {tab === 'result' ? 'Result' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'conversation' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="max-w-2xl mx-auto space-y-4">
                {displayMessages.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-text-sub mb-1">Ask questions about this job</p>
                    <p className="text-xs text-text-muted mb-5">
                      AgentPlace remains the narrator. Specialists contribute their evidence.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        "Why is WIF ranked highest?",
                        "What did Smart Money Scout find?",
                        "Compare holder risk across the three.",
                      ].map((p) => (
                        <button
                          key={p}
                          onClick={() => setInput(p)}
                          className="text-xs text-text-muted border border-border rounded px-3 py-1.5 hover:text-text hover:bg-panel transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {displayMessages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-xl bg-panel-raised border border-border rounded-lg px-4 py-3">
                          <p className="text-sm text-text leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-primary-dim flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] font-bold text-primary">AP</span>
                      </div>
                      <div className="flex-1 min-w-0 text-text-sub">
                        {msg.isStreaming ? (
                          <span className="inline-flex gap-1 items-center h-4">
                            <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" />
                            <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '300ms' }} />
                          </span>
                        ) : (
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className="border-t border-border px-5 py-4 shrink-0">
              <div className="max-w-2xl mx-auto">
                <div className="relative rounded-lg border border-border bg-panel focus-within:border-primary/40 transition-colors">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask about this job..."
                    rows={2}
                    className="w-full bg-transparent resize-none px-4 pt-3 pb-2 text-sm text-text placeholder-text-muted outline-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between px-4 pb-3">
                    <span className="text-xs text-text-dim font-mono">Shift+Enter for new line</span>
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || isStreaming}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                        input.trim() && !isStreaming
                          ? 'bg-primary text-white hover:bg-primary-hover'
                          : 'bg-panel-raised text-text-dim cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="overflow-y-auto h-full px-5 py-5">
            <div className="max-w-xl space-y-3">
              <p className="text-xs text-text-muted mb-4">
                AgentPlace assembled the smallest competent team for this job. Supporting workers are
                not added to your permanent workforce.
              </p>
              <div className="border border-border rounded-lg bg-panel px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-text">{job.leadWorkerName}</span>
                  <span className="text-xs text-primary border border-primary/30 rounded px-1.5 py-0.5">Lead</span>
                </div>
                <p className="text-xs text-text-sub">Meme coin opportunity analysis · Synthesis</p>
                {leadWorker && (
                  <button
                    onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: leadWorker.id })}
                    className="text-xs text-primary hover:underline mt-2 block"
                  >
                    Open {leadWorker.name} workspace →
                  </button>
                )}
              </div>
              {job.supportingWorkerNames.map((name) => (
                <div key={name} className="border border-border rounded-lg bg-panel px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-text">{name}</span>
                    <span className="text-xs text-text-muted border border-border rounded px-1.5 py-0.5">Supporting</span>
                  </div>
                  <p className="text-xs text-text-sub">Wallet-quality analysis · Smart-money signals</p>
                  <p className="text-xs text-text-muted mt-1">Temporary · not in your permanent workforce</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'result' && job.result && (
          <div className="overflow-y-auto h-full px-5 py-5">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-accent">{job.result.label}</span>
              </div>

              <div className="space-y-3 mb-5">
                {job.result.items.map((item) => (
                  <div key={item.label} className="border border-border rounded-lg bg-panel px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <span className="text-sm font-semibold text-text font-mono">{item.label}</span>
                    </div>
                    <p className="text-xs font-medium text-text-sub mb-1.5">{item.headline}</p>
                    <p className="text-xs text-text-muted leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>

              <div className="border border-border-dim rounded-lg bg-panel-raised px-4 py-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Synthesis</p>
                <p className="text-sm text-text-sub leading-relaxed">{job.result.summary}</p>
              </div>

              <div className="mt-4 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
                  <path strokeLinecap="round" strokeWidth={1.8} d="M12 8v4M12 16h.01" />
                </svg>
                <p className="text-xs text-text-dim">
                  Illustrative prototype data. Not financial advice.
                </p>
              </div>

              {!job.routineId && (
                <div className="mt-4 border border-border-dim rounded-lg px-4 py-3">
                  <p className="text-xs text-text-muted mb-2">This type of research could run on a schedule.</p>
                  <button
                    onClick={() => {
                      dispatch({ type: 'SET_ACTIVE_JOB', id: null });
                      dispatch({ type: 'SET_ACTIVE_WORKER', id: job.leadWorkerId });
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Make this recurring →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
