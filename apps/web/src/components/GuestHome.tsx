import { useState, useRef } from 'react';
import { useAppState, useDispatch, runGenericManagerResponse, uid } from '../state/AppContext';
import type { Conversation, Worker, WorkerStatus } from '../state/types';

const QUICK_ACTIONS = [
  {
    category: 'Find & understand',
    phrase: 'Explore markets, wallets and opportunities.',
    chips: ['Memes', 'Smart Money', 'Research', 'Prediction Markets', 'Airdrops'],
    icon: 'search',
  },
  {
    category: 'Manage',
    phrase: 'Understand and improve what you already own.',
    chips: ['Portfolio', 'Stablecoins', 'DeFi'],
    icon: 'layers',
  },
  {
    category: 'Act',
    phrase: 'Move or deploy capital with AgentPlace guiding the process.',
    chips: ['Send', 'Swap', 'Bridge', 'Perps'],
    icon: 'act',
  },
  {
    category: 'Build',
    phrase: 'Build a specialist around your own process.',
    chips: ['Create a Worker'],
    icon: 'build',
  },
] as const;

const CHIP_DESCRIPTIONS: Record<string, string> = {
  Memes: 'Find meme opportunities worth researching.',
  'Smart Money': 'Follow credible wallet behavior.',
  Research: 'Investigate a token, protocol or thesis.',
  'Prediction Markets': 'Explore market probabilities and evidence.',
  Airdrops: 'Find and track relevant opportunities.',
  Portfolio: 'Understand positions, concentration and risk.',
  Stablecoins: 'Find better ways to put stablecoins to work.',
  DeFi: 'Explore DeFi opportunities for your goals.',
  Send: 'Prepare a crypto transfer.',
  Swap: 'Find and review an eligible swap route.',
  Bridge: 'Move assets across supported networks.',
  Perps: 'Explore a leveraged position with risk context first.',
  'Create a Worker': 'Build a persistent specialist around your own process.',
};

const CHIP_PROMPTS: Record<string, string> = {
  Memes: "What meme coins are worth watching right now? Start with BONK.",
  'Smart Money': "Show me what smart money wallets are doing this week.",
  Research: "I want to research a token or protocol. What do you need from me?",
  'Prediction Markets': "What are the most interesting prediction market opportunities right now?",
  Airdrops: "What upcoming airdrops should I be tracking?",
  Portfolio: "Analyse my portfolio. I can share a watch-only address.",
  Stablecoins: "Help me optimise the yield on my idle stablecoins.",
  DeFi: "What DeFi opportunities are worth exploring for my risk profile?",
  Send: "I want to send crypto to someone. Walk me through it.",
  Swap: "I want to swap tokens. What do you need to find the best route?",
  Bridge: "Bridge 500 USDC from Arbitrum to Base using the best route.",
  Perps: "I want to open a leveraged position. Walk me through the risks first.",
  'Create a Worker': "I want to create a new specialist Worker. Where do I start?",
};

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

const STATUS_COLOR: Record<WorkerStatus, string> = {
  working: 'text-accent',
  monitoring: 'text-primary',
  standby: 'text-text-muted',
  'needs-you': 'text-warn',
  paused: 'text-text-muted',
  limited: 'text-warn',
  blocked: 'text-danger',
  issue: 'text-danger',
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

// ── Intent launcher icons ─────────────────────────────────────────────────────

function GroupIcon({ type }: { type: string }) {
  const cls = 'w-4 h-4 text-text-dim shrink-0';
  if (type === 'search') return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
  if (type === 'layers') return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 2l9 4.5-9 4.5-9-4.5L12 2zM3 12l9 4.5 9-4.5M3 17l9 4.5 9-4.5" />
    </svg>
  );
  if (type === 'act') return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
  if (type === 'build') return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 4v16m8-8H4" />
    </svg>
  );
  return null;
}

// ── Intent chip ───────────────────────────────────────────────────────────────

function IntentChip({ chip, onChip, isBuild }: { chip: string; onChip: (c: string) => void; isBuild?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const desc = CHIP_DESCRIPTIONS[chip];

  if (isBuild) {
    return (
      <div className="relative">
        <button
          onClick={() => onChip(chip)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded border border-border/70 bg-panel-raised text-xs font-medium text-text-sub hover:border-primary/30 hover:text-text hover:bg-panel transition-all"
        >
          <svg className="w-3 h-3 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {chip}
          <svg className="w-3 h-3 text-text-dim shrink-0 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        {hovered && desc && (
          <div className="absolute bottom-full left-0 mb-1.5 z-20 pointer-events-none">
            <div className="px-2.5 py-1.5 bg-panel-raised border border-border rounded text-[11px] text-text-sub whitespace-nowrap shadow-sm">
              {desc}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => onChip(chip)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="px-3 py-1.5 rounded border border-border/60 bg-transparent text-xs text-text-sub hover:border-border hover:text-text hover:bg-panel-raised/50 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      >
        {chip}
      </button>
      {hovered && desc && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 pointer-events-none">
          <div className="px-2.5 py-1.5 bg-panel-raised border border-border rounded text-[11px] text-text-sub whitespace-nowrap shadow-sm">
            {desc}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Intent group card ─────────────────────────────────────────────────────────

function IntentGroup({ group, onChip }: {
  group: { category: string; phrase: string; chips: readonly string[]; icon: string };
  onChip: (c: string) => void;
}) {
  const isBuild = group.category === 'Build';
  return (
    <div className="border border-border/60 rounded-lg bg-panel/60 px-4 py-3.5 hover:border-border transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <GroupIcon type={group.icon} />
        <span className="text-xs font-semibold text-text tracking-tight">{group.category}</span>
      </div>
      <p className="text-[11px] text-text-dim leading-relaxed mb-3">{group.phrase}</p>
      <div className="flex flex-wrap gap-2">
        {group.chips.map((chip) => (
          <IntentChip key={chip} chip={chip} onChip={onChip} isBuild={isBuild} />
        ))}
      </div>
    </div>
  );
}

// ── Composer (shared between both states) ─────────────────────────────────────

function Composer({ compact = false }: { compact?: boolean }) {
  const dispatch = useDispatch();
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  function createAndSend(message: string) {
    if (!message.trim()) return;
    const convId = uid();
    const conv: Conversation = {
      id: convId,
      title: 'New conversation',
      manuallyRenamed: false,
      messages: [{ id: uid(), role: 'user', content: message.trim(), timestamp: new Date() }],
      pinned: false,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dispatch({ type: 'ADD_CONV', conv });
    runGenericManagerResponse(dispatch, convId, message.trim());
    setInput('');
  }

  function handleChip(chip: string) {
    createAndSend(CHIP_PROMPTS[chip] ?? chip);
  }

  return (
    <div className={compact ? '' : ''}>
      <div
        className={`rounded-lg border transition-colors ${
          isFocused ? 'border-primary/50 bg-panel' : 'border-border bg-panel'
        }`}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              createAndSend(input);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={compact
            ? "Ask anything..."
            : "Ask anything — research a token, manage stablecoins, bridge funds, build a worker..."}
          rows={compact ? 2 : 3}
          className="w-full bg-transparent resize-none px-4 pt-4 pb-3 text-sm text-text placeholder-text-muted outline-none leading-relaxed"
        />
        <div className="flex items-center justify-between px-4 pb-3">
          <span className="text-xs text-text-dim font-mono">Shift+Enter for new line</span>
          <button
            onClick={() => createAndSend(input)}
            disabled={!input.trim()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all ${
              input.trim()
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

      {!compact && (
        <div className="mt-6">
          <div className="mb-4">
            <p className="text-sm font-medium text-text">Start with an idea</p>
            <p className="text-xs text-text-dim mt-0.5">Choose a starting point or just tell AgentPlace what you want.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {QUICK_ACTIONS.map((group) => (
              <IntentGroup key={group.category} group={group} onChip={handleChip} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Worker row for Active Workforce ──────────────────────────────────────────

function WorkforceRow({ worker }: { worker: Worker }) {
  const dispatch = useDispatch();
  const job = (useAppState().jobs ?? []).find((j) => j.id === worker.currentJobId);

  return (
    <button
      onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: worker.id })}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-panel transition-colors text-left group"
    >
      <div className="w-7 h-7 rounded bg-panel-raised border border-border flex items-center justify-center shrink-0">
        <span className="text-[10px] font-mono font-medium text-text-sub">
          {worker.name.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">{worker.name}</span>
          <span className={`flex items-center gap-1 text-xs ${STATUS_COLOR[worker.status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[worker.status]}`} />
            {STATUS_LABEL[worker.status]}
          </span>
        </div>
        <p className="text-xs text-text-muted truncate">
          {job
            ? job.title
            : worker.currentFocus ?? worker.tagline}
        </p>
      </div>
      <svg
        className="w-3.5 h-3.5 text-text-dim group-hover:text-text-muted transition-colors shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

// ── Persistent / active-user home ─────────────────────────────────────────────

function PersistentHome() {
  const state = useAppState();
  const dispatch = useDispatch();

  const needsAttention = (state.workers ?? []).filter((w) => w.status === 'needs-you');
  const attentionItems = (state.attentionItems ?? []);
  const recentOutcomes = (state.outcomes ?? []).slice(0, 3);

  // Routine notifications that need attention (project onto home)
  const routineNeedsYouNotifs = (state.notifications ?? []).filter(
    (n) => n.level === 'needs-you' && n.target?.type === 'routine' && !n.read
  );

  // Build factual returning briefing
  const lastSeen = state.lastSeenAt;
  const routines = state.routines ?? [];
  const notifications = state.notifications ?? [];
  const routineRuns = state.routineRuns ?? [];

  function buildReturningBriefing(): string | null {
    if (!lastSeen || routines.length === 0) return null;
    const lines: string[] = [];

    // Stablecoin manager scheduled checks
    const stableRoutine = routines.find((r) => r.id === 'rtn-stable-check');
    const stableRuns = routineRuns.filter((r) => r.routineId === 'rtn-stable-check' && r.startedAt > lastSeen);
    if (stableRoutine && stableRuns.length > 0) {
      const meaningful = stableRuns.filter((r) => r.meaningful);
      if (meaningful.length > 0) {
        lines.push(`Stablecoin Manager completed ${stableRuns.length} scheduled check${stableRuns.length !== 1 ? 's' : ''}; ${meaningful.length} met your 1% threshold.`);
      } else {
        lines.push("Stablecoin Manager completed scheduled checks without finding a net improvement above your 1% threshold.");
      }
    }

    // Meme Scout BONK watch
    const bonkRun = routineRuns.find((r) => r.routineId === 'rtn-bonk-watch' && r.meaningful && r.startedAt > lastSeen);
    if (bonkRun) {
      lines.push("Meme Scout found one material BONK smart-money change.");
    }

    // Needs you
    const needsYouCount = notifications.filter((n) => n.level === 'needs-you' && !n.read && n.createdAt > lastSeen).length;
    if (needsYouCount > 0) {
      lines.push(`${needsYouCount} Routine ${needsYouCount === 1 ? 'needs' : 'need'} you.`);
    }

    return lines.length > 0 ? lines.join(' ') : null;
  }

  const briefingText = buildReturningBriefing();

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-12">
        {/* Returning briefing */}
        {briefingText && (
          <div className="mb-6 px-4 py-3 bg-panel border border-border rounded-lg">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Since you were away
            </p>
            <p className="text-sm text-text-sub leading-relaxed">{briefingText}</p>
          </div>
        )}

        {/* Needs Your Attention — workers + attention items + routine notifications */}
        {(needsAttention.length > 0 || attentionItems.length > 0 || routineNeedsYouNotifs.length > 0) && (
          <div className="mb-6">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
              Needs your attention
            </p>
            {needsAttention.map((w) => (
              <button
                key={w.id}
                onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: w.id })}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-warn/5 border border-warn/20 hover:bg-warn/10 transition-colors text-left mb-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-warn shrink-0" />
                <span className="text-sm text-text">{w.name}</span>
                <span className="text-xs text-warn ml-auto">Needs you</span>
              </button>
            ))}
            {attentionItems.map((item) => {
              const isActionReview = item.type === 'action-review' && !!item.actionId;
              const isWalletInfo = item.type === 'info' && !!item.walletId;
              const isRoutineItem = item.type === 'info' && !!item.workerId && !item.walletId;
              const isClickable = isActionReview || isWalletInfo;
              const isDanger = item.type === 'action-review';
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isActionReview) {
                      dispatch({ type: 'SET_ACTIVE_ACTION', id: item.actionId! });
                    } else if (isWalletInfo) {
                      dispatch({ type: 'SET_VIEW', view: 'wallets' });
                      dispatch({ type: 'SET_ACTIVE_WALLET', id: item.walletId! });
                    } else if (isRoutineItem) {
                      // Find linked routine notification
                      const linked = (state.notifications ?? []).find(
                        (n) => n.target?.type === 'routine' && n.level === 'needs-you'
                      );
                      if (linked?.target) {
                        dispatch({ type: 'SET_VIEW', view: 'routines' });
                        dispatch({ type: 'SET_ACTIVE_ROUTINE', id: linked.target.id });
                      }
                    }
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left mb-2 ${
                    isDanger
                      ? 'bg-danger/5 border-danger/20 hover:bg-danger/10'
                      : 'bg-warn/5 border-warn/20 hover:bg-warn/10'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isDanger ? 'bg-danger' : 'bg-warn'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text">{item.title}</div>
                    {item.summary && <div className="text-xs text-text-sub mt-0.5 leading-relaxed">{item.summary}</div>}
                  </div>
                  {(isClickable || isRoutineItem) && (
                    <svg className="w-3.5 h-3.5 text-text-dim shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </button>
              );
            })}

            {/* Routine needs-you notifications not already covered by attentionItems */}
            {routineNeedsYouNotifs
              .filter((n) => !attentionItems.some((a) => a.workerId && n.target?.id && (state.routines ?? []).find(r => r.id === n.target?.id)?.workerId === a.workerId))
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    dispatch({ type: 'MARK_NOTIFICATION_READ', id: n.id });
                    if (n.target) {
                      dispatch({ type: 'SET_VIEW', view: 'routines' });
                      dispatch({ type: 'SET_ACTIVE_ROUTINE', id: n.target.id });
                    }
                  }}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border border-warn/20 bg-warn/5 hover:bg-warn/10 transition-colors text-left mb-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-warn" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text">{n.title}</div>
                    <div className="text-xs text-text-sub mt-0.5">{n.summary}</div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-text-dim shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
          </div>
        )}

        {/* Composer */}
        <div className="mb-6">
          <Composer compact />
        </div>

        {/* Active Workforce */}
        {state.workers.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Active workforce
              </p>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'workers' })}
                className="text-xs text-text-muted hover:text-primary transition-colors"
              >
                All workers
              </button>
            </div>
            <div className="space-y-0.5">
              {state.workers.map((w) => (
                <WorkforceRow key={w.id} worker={w} />
              ))}
            </div>
          </div>
        )}

        {/* Recent Outcomes */}
        {recentOutcomes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Recent outcomes
              </p>
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'activity' })}
                className="text-xs text-text-muted hover:text-primary transition-colors"
              >
                All activity
              </button>
            </div>
            <div className="space-y-2">
              {recentOutcomes.map((o) => (
                <div
                  key={o.id}
                  onClick={() => {
                    if (o.type === 'financial' && o.receiptId) {
                      dispatch({ type: 'SET_ACTIVE_RECEIPT', id: o.receiptId });
                    } else if (o.jobId) {
                      dispatch({ type: 'SET_ACTIVE_JOB', id: o.jobId });
                    }
                  }}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border border-border-dim bg-panel ${(o.type === 'financial' && o.receiptId) || o.jobId ? 'cursor-pointer hover:border-border' : ''} transition-colors`}
                >
                  <div className="w-5 h-5 rounded bg-accent-dim flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text font-medium">{o.title}</p>
                    <p className="text-xs text-text-muted">{o.summary}</p>
                  </div>
                  {o.type === 'financial' && o.receiptId && (
                    <span className="text-[10px] font-mono text-accent border border-accent/30 rounded px-1.5 py-0.5 shrink-0">Receipt</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Guest home ────────────────────────────────────────────────────────────────

function GuestHomeContent() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-text tracking-tight mb-3">
            What do you want your crypto to do?
          </h1>
          <p className="text-text-sub text-sm leading-relaxed max-w-md mx-auto">
            Tell AgentPlace what you want to accomplish. Your workers can research, monitor
            and execute across crypto while staying within your rules.
          </p>
        </div>
        <Composer />
        <div className="mt-7 flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="text-xs text-text-muted">
            <strong className="text-text-sub font-medium">Start with research.</strong>{' '}
            Connect a wallet only when your goal requires it.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Export: adaptive based on state ──────────────────────────────────────────

export function GuestHome() {
  const state = useAppState();
  const isActive = !!state.user && state.workers.length > 0;
  if (isActive) return <PersistentHome />;
  return <GuestHomeContent />;
}
