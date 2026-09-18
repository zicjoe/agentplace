import { useState, useRef, useEffect } from 'react';
import { useAppState, useDispatch, createComparisonJob, uid } from '../state/AppContext';
import type { WorkerStatus, Routine } from '../state/types';

interface LocalMessage {
  id: string;
  role: 'user' | 'manager';
  content: string;
  jobId?: string;
  routinePreview?: Routine;
  isStreaming?: boolean;
}

const STATUS_LABEL: Record<WorkerStatus, string> = {
  working: 'Working',
  monitoring: 'Monitoring',
  standby: 'Standing by',
  'needs-you': 'Needs you',
  paused: 'Paused',
  limited: 'Limited',
  blocked: 'Blocked',
  issue: 'Issue detected',
};

const STATUS_DOT: Record<WorkerStatus, string> = {
  working: 'bg-accent',
  monitoring: 'bg-primary',
  standby: 'bg-text-dim',
  'needs-you': 'bg-warn',
  paused: 'bg-text-dim',
  limited: 'bg-warn',
  blocked: 'bg-danger',
  issue: 'bg-danger',
};

function InlineJobCard({ jobId }: { jobId: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const job = (state.jobs ?? []).find((j) => j.id === jobId);
  if (!job) return null;

  const activeStage = job.stages.find((s) => s.status === 'active');

  return (
    <div className="mt-3 border border-border rounded-lg bg-panel-raised px-4 py-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-text">{job.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'completed' ? 'bg-accent' : 'bg-primary'}`} />
            <span className={`text-xs ${job.status === 'completed' ? 'text-accent' : 'text-primary'}`}>
              {job.status === 'completed' ? 'Research complete' : 'Working'}
            </span>
          </div>
        </div>
      </div>

      <div className="text-xs text-text-muted mb-2">
        <span className="text-text-sub font-medium">{job.leadWorkerName}</span> · Lead
        {job.supportingWorkerNames.length > 0 && (
          <span className="ml-2 text-text-dim">+{job.supportingWorkerNames.length} specialist</span>
        )}
      </div>

      {activeStage && job.status !== 'completed' && (
        <div className="text-xs text-text-muted mb-3">
          Current stage: <span className="text-text-sub">{activeStage.label}</span>
        </div>
      )}

      <button
        onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: jobId })}
        className="text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors"
      >
        Open job
      </button>
    </div>
  );
}

function InlineRoutinePreviewCard({ routine, workerId }: { routine: Routine; workerId: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [activated, setActivated] = useState(false);

  const existingGrant = (state.authorityGrants ?? []).find(
    (g) => g.workerId === workerId && g.status === 'active'
  );

  function activate() {
    const activeRoutine = { ...routine, status: 'active' as const };
    dispatch({ type: 'ADD_ROUTINE', routine: activeRoutine });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'routine',
        title: `Routine activated · ${routine.title}`,
        summary: `${routine.workerName} · ${routine.trigger.humanReadable}`,
        workerId: routine.workerId,
        workerName: routine.workerName,
        routineId: routine.id,
        timestamp: new Date(),
        status: 'complete',
      },
    });
    setActivated(true);
  }

  if (activated) {
    return (
      <div className="mt-3 border border-accent/30 rounded-lg bg-accent-dim/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <p className="text-sm font-medium text-accent">Routine activated</p>
        </div>
        <p className="text-xs text-text-muted mt-1">{routine.title} is now active.</p>
        <button
          onClick={() => {
            dispatch({ type: 'SET_ACTIVE_ROUTINE', id: routine.id });
            dispatch({ type: 'SET_ACTIVE_WORKER', id: null });
          }}
          className="text-xs text-primary hover:underline mt-2 block"
        >
          Open Routine →
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 border border-border rounded-lg bg-panel-raised overflow-hidden">
      <div className="px-4 py-2 border-b border-border-dim bg-panel">
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Routine preview</span>
      </div>
      <div className="px-4 py-3 space-y-2.5 text-xs">
        <div>
          <span className="text-text-dim font-mono uppercase tracking-wider text-[9px]">Title</span>
          <p className="text-text-sub font-medium">{routine.title}</p>
        </div>
        <div>
          <span className="text-text-dim font-mono uppercase tracking-wider text-[9px]">Owner</span>
          <p className="text-text-sub">{routine.workerName}</p>
        </div>
        <div>
          <span className="text-text-dim font-mono uppercase tracking-wider text-[9px]">Instruction</span>
          <p className="text-text-sub">{routine.instruction}</p>
        </div>
        <div>
          <span className="text-text-dim font-mono uppercase tracking-wider text-[9px]">Trigger</span>
          <p className="text-text-sub">{routine.trigger.humanReadable}</p>
        </div>
        <div>
          <span className="text-text-dim font-mono uppercase tracking-wider text-[9px]">Execution behavior</span>
          <p className="text-text-sub">Recommend only</p>
        </div>
        <div>
          <span className="text-text-dim font-mono uppercase tracking-wider text-[9px]">Authority</span>
          <p className="text-text-sub">Routine grants no authority.</p>
          {existingGrant && (
            <p className="text-text-dim mt-0.5">
              {routine.workerName} has an existing financial mandate, but this Routine will not use it unless explicitly configured.
            </p>
          )}
        </div>
        <div>
          <span className="text-text-dim font-mono uppercase tracking-wider text-[9px]">Notifications</span>
          <p className="text-text-sub">{routine.notificationRule}</p>
        </div>
        <div>
          <span className="text-text-dim font-mono uppercase tracking-wider text-[9px]">Service budget</span>
          <p className="text-text-dim">{routine.serviceBudget}</p>
        </div>
      </div>
      <div className="px-4 py-3 border-t border-border-dim flex gap-2">
        <button
          onClick={activate}
          className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded hover:bg-primary-hover transition-colors"
        >
          Activate routine
        </button>
        <button className="px-3 py-1.5 border border-border text-text-muted text-xs rounded hover:text-text transition-colors">
          Edit
        </button>
      </div>
    </div>
  );
}

function WorkerSideRail({ workerId }: { workerId: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const worker = state.workers.find((w) => w.id === workerId);
  if (!worker) return null;

  const activeJob = (state.jobs ?? []).find((j) => j.id === worker.currentJobId);
  const recentOutcomes = (state.outcomes ?? []).filter((o) => o.workerId === workerId).slice(0, 3);

  return (
    <div className="w-72 shrink-0 border-l border-border overflow-y-auto bg-surface">
      <div className="px-5 py-5 space-y-5">
        {/* Worker Brief */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
            Responsible for
          </p>
          <p className="text-xs text-text-sub leading-relaxed">
            {worker.responsibility ?? worker.tagline}
          </p>
        </div>

        {/* Status */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
            Status
          </p>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[worker.status]}`} />
            <span className="text-xs text-text-sub">{STATUS_LABEL[worker.status]}</span>
          </div>
          {worker.currentFocus && (
            <p className="text-xs text-text-muted mt-1">{worker.currentFocus}</p>
          )}
        </div>

        {/* Authority */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
            Authority
          </p>
          {(() => {
            const grant = (state.authorityGrants ?? []).find(
              (g) => g.workerId === worker.id && g.status === 'active'
            );
            const isPaused = state.autonomousExecutionPaused;
            if (grant) {
              return (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-warn' : 'bg-accent'}`} />
                    <span className={`text-xs font-medium ${isPaused ? 'text-warn' : 'text-accent'}`}>
                      {isPaused ? 'Paused' : 'Autonomous within mandate'}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-xs text-text-muted mt-1">
                    <p>{(state.agentAccounts ?? []).find((a) => a.id === grant.agentAccountId)?.name ?? 'Agent Account'}</p>
                    <p>Up to {grant.totalManagedCapital} managed</p>
                    <p>Max {grant.singleActionLimit}/action</p>
                    <p>{grant.networks.join(' · ')}</p>
                    <p>{grant.allowedProtocols.join(' · ')}</p>
                    <p>No borrowing · No leverage</p>
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'SET_VIEW', view: 'security' })}
                    className="text-xs text-primary hover:underline mt-1 block"
                  >
                    Review authority →
                  </button>
                </div>
              );
            }
            return (
              <p className="text-xs text-text-sub">
                {worker.authoritySummary ?? 'Research & recommend only · No wallet authority'}
              </p>
            );
          })()}
        </div>

        {/* Current Job */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
            Current job
          </p>
          {activeJob ? (
            <div className="border border-border rounded bg-panel px-3 py-2.5">
              <p className="text-xs font-medium text-text mb-1">{activeJob.title}</p>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-xs text-primary">
                  {activeJob.currentStage}
                </span>
              </div>
              <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: activeJob.id })}
                className="text-xs text-primary hover:underline"
              >
                Open job →
              </button>
            </div>
          ) : (
            <p className="text-xs text-text-muted">No active job</p>
          )}
        </div>

        {/* Routines */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
            Routines
          </p>
          {(() => {
            const workerRoutines = (state.routines ?? []).filter((r) => r.workerId === workerId && r.status !== 'stopped');
            if (workerRoutines.length === 0) {
              return (
                <div>
                  <p className="text-xs text-text-muted">No recurring work configured yet.</p>
                  <button
                    onClick={() => {
                      const setupHint = "Set up a routine";
                      // Focus the chat input by scrolling into view
                    }}
                    className="text-xs text-primary hover:underline mt-1 block"
                  >
                    Set up a routine →
                  </button>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {workerRoutines.map((routine) => (
                  <div key={routine.id} className="border border-border rounded bg-panel px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text leading-snug">{routine.title}</p>
                        <p className={`text-[10px] font-mono mt-0.5 ${
                          routine.status === 'limited' ? 'text-warn' :
                          routine.status === 'active' ? 'text-accent' :
                          routine.status === 'watching' ? 'text-primary' :
                          'text-text-muted'
                        }`}>
                          {routine.status === 'active' ? 'Active' :
                           routine.status === 'watching' ? 'Watching' :
                           routine.status === 'waiting-for-event' ? 'Waiting for event' :
                           routine.status === 'limited' ? 'Limited' :
                           routine.status === 'paused' ? 'Paused' : routine.status}
                          {' · '}{routine.trigger.humanReadable}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          dispatch({ type: 'SET_ACTIVE_ROUTINE', id: routine.id });
                          dispatch({ type: 'SET_ACTIVE_WORKER', id: null });
                        }}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Recent Outcomes */}
        {recentOutcomes.length > 0 && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
              Recent outcomes
            </p>
            <div className="space-y-2">
              {recentOutcomes.map((o) => (
                <div key={o.id} className="border border-border-dim rounded px-3 py-2">
                  <p className="text-xs font-medium text-text">{o.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{o.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkerWorkspace() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const worker = state.workers.find((w) => w.id === state.activeWorkerId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages.at(-1)?.isStreaming]);

  if (!worker) {
    return (
      <div className="h-full flex items-center justify-center bg-bg text-text-muted text-sm">
        Worker not found
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  function detectRoutineIntent(text: string): boolean {
    return /every\s+(weekday|week|day|morning|evening|hour|monday|daily)|recurring|routine|check\s+every|monitor\s+(daily|weekly|regularly)|set\s+up\s+(a\s+)?routine/i.test(text);
  }

  function buildRoutinePreview(text: string, workerId: string, workerName: string): Routine {
    const now = new Date();
    const isWeekdayMorning = /weekday.*morning|every\s+weekday/i.test(text);
    const threshold = text.match(/(\d+)%/)?.[0];

    return {
      id: uid(),
      title: workerName === 'Stablecoin Manager'
        ? 'Weekday stablecoin opportunity check'
        : workerName === 'Meme Scout'
        ? 'Regular meme monitoring'
        : 'Scheduled monitoring',
      workerId,
      workerName,
      instruction: text.length < 120 ? text : text.slice(0, 120) + '…',
      trigger: {
        type: 'scheduled',
        humanReadable: isWeekdayMorning ? 'Weekdays · Morning' : 'Daily',
      },
      status: 'draft',
      executionBehavior: 'recommend-only',
      notificationRule: threshold
        ? `Only when net improvement >= ${threshold} or Routine needs you`
        : 'Only when threshold is met or Routine needs you',
      serviceBudget: 'Up to 30 monitoring checks per day · Prototype',
      gasBudget: undefined,
      lastRunAt: undefined,
      nextRunAt: new Date(now.getTime() + 14 * 60 * 60 * 1000),
      lastMeaningfulActionAt: undefined,
      recentRunIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  function sendMessage() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');

    const userMsg: LocalMessage = { id: uid(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);

    const isCompareRequest = /compare|bonk.*wif|wif.*bonk|popcat/i.test(text);
    const isRoutineRequest = detectRoutineIntent(text);

    if (isRoutineRequest && worker) {
      const preview = buildRoutinePreview(text, worker.id, worker.name);
      const managerMsgId = uid();
      setMessages((prev) => [...prev, { id: managerMsgId, role: 'manager', content: '', isStreaming: true }]);
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === managerMsgId
              ? {
                  ...m,
                  content: "I understand. Here is what I would set up as a Routine based on your request. Review the details below — you can activate it or ask me to adjust anything.",
                  routinePreview: preview,
                  isStreaming: false,
                }
              : m
          )
        );
      }, 1000);
    } else if (isCompareRequest && !(state.jobs ?? []).some((j) => j.title.includes('Compare BONK'))) {
      const jobId = createComparisonJob(dispatch);
      const managerMsgId = uid();
      setMessages((prev) => [...prev, { id: managerMsgId, role: 'manager', content: '', isStreaming: true }]);
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === managerMsgId
              ? { ...m, content: "Meme Scout is leading the comparison. Smart Money Scout is checking wallet-quality signals across the three assets.", jobId, isStreaming: false }
              : m
          )
        );
      }, 800);
    } else {
      const managerMsgId = uid();
      setMessages((prev) => [...prev, { id: managerMsgId, role: 'manager', content: '', isStreaming: true }]);

      const workerResponses: Record<string, Record<string, string>> = {
        'w-stablecoin': {
          yield: "Yield spreads across Aave, Morpho, and Spark are currently within 0.4% of each other on Base. No material improvement threshold has been crossed.",
          monitor: "I'm already continuously monitoring stablecoin yield. I'll surface material opportunities when they appear.",
          default: "I'm monitoring USDC and DAI yield on supported protocols. Is there a specific rate comparison or threshold you want me to watch?",
        },
        'w-memescout': {
          bonk: "BONK remains my primary active watch. The recent volume spike is worth monitoring — I'll surface it if the smart-money signal strengthens.",
          wif: "WIF has the strongest combined signal right now — momentum and smart-money accumulation. I can add it to my active monitoring.",
          monitor: "I can set up a recurring check on any meme asset you specify. Tell me the token and your preferred cadence.",
          default: "I'm monitoring the Solana meme ecosystem. Is there a specific asset or signal type you want me to focus on?",
        },
        'w-portfolio': {
          treasury: "Treasury Watch is currently at $74,990 across ETH and USDC. No movements above $50,000 in the past 48 hours.",
          monitor: "I'm watching Treasury Watch continuously. I'll flag any movement above your configured threshold.",
          default: "I'm monitoring on-chain holdings and watching for material events. What do you need me to look into?",
        },
      };

      const responses = workerResponses[worker?.id ?? ''] ?? workerResponses['w-memescout'];
      const lc = text.toLowerCase();
      const response = lc.includes('bonk') ? (responses.bonk ?? responses.default) :
        lc.includes('wif') ? (responses.wif ?? responses.default) :
        lc.includes('yield') || lc.includes('rate') ? (responses.yield ?? responses.default) :
        lc.includes('treasury') ? (responses.treasury ?? responses.default) :
        lc.includes('monitor') || lc.includes('watch') ? (responses.monitor ?? responses.default) :
        responses.default;

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => m.id === managerMsgId ? { ...m, content: response, isStreaming: false } : m)
        );
      }, 1100);
    }
  }

  const isStreaming = messages.some((m) => m.isStreaming);

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: null })}
          className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <div className="w-7 h-7 rounded bg-panel-raised border border-border flex items-center justify-center shrink-0">
          <span className="text-[10px] font-mono font-medium text-text-sub">
            {worker.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text">{worker.name}</span>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[worker.status]}`} />
              <span className="text-xs text-text-muted">{STATUS_LABEL[worker.status]}</span>
            </div>
          </div>
          <p className="text-xs text-text-muted truncate">{worker.currentFocus ?? worker.tagline}</p>
        </div>

        {/* Mobile: toggle details */}
        {isMobile && (
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="text-text-muted hover:text-text p-1 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Conversation */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-text-sub mb-1">
                    Talk directly to {worker.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    Ask questions, give instructions, or request a comparison.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 justify-center">
                    {(worker.id === 'w-stablecoin'
                      ? [
                          "Check for better stablecoin opportunities every weekday morning. Don't bother me unless the net improvement is at least 1%.",
                          "What's the current yield spread on Morpho vs Aave?",
                          "Show me recent stablecoin reallocation opportunities.",
                        ]
                      : worker.id === 'w-portfolio'
                      ? [
                          "Monitor Treasury Watch and alert me if anything moves above $50,000.",
                          "What's in the Treasury Watch wallet right now?",
                          "Run a portfolio concentration check.",
                        ]
                      : [
                          'Compare BONK, WIF and POPCAT and tell me which looks strongest.',
                          "What's BONK doing right now?",
                          'Set up monitoring for WIF entry signals.',
                        ]
                    ).map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setInput(prompt);
                        }}
                        className="text-xs text-text-muted border border-border rounded px-3 py-1.5 hover:text-text hover:bg-panel transition-colors text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
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
                    <div className="w-6 h-6 rounded border border-border bg-panel-raised flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-mono font-medium text-text-sub">
                        {worker.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-text-sub">
                      {msg.isStreaming ? (
                        <span className="inline-flex gap-1 items-center h-4">
                          <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" />
                          <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '150ms' }} />
                          <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '300ms' }} />
                        </span>
                      ) : (
                        <>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          {msg.jobId && <InlineJobCard jobId={msg.jobId} />}
                          {msg.routinePreview && (
                            <InlineRoutinePreviewCard
                              routine={msg.routinePreview}
                              workerId={worker.id}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
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
                  placeholder={`Ask ${worker.name}...`}
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

        {/* Side rail — desktop always, mobile on toggle */}
        {(!isMobile || showDetails) && (
          <WorkerSideRail workerId={worker.id} />
        )}
      </div>
    </div>
  );
}
