import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import type { ActivityEvent } from '../state/types';

type Filter = 'all' | 'working' | 'complete' | 'operational';

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const dispatch = useDispatch();
  const state = useAppState();

  const isJob = event.eventType === 'job';
  const isFinancial = event.eventType === 'financial';
  const isAuthority = event.eventType === 'authority';
  const isWallet = event.eventType === 'wallet';
  const isRoutine = event.eventType === 'routine';

  // For financial jobs, derive live status from the linked Job
  const linkedJob = event.jobId ? (state.jobs ?? []).find((j) => j.id === event.jobId) : null;
  const effectiveStatus = linkedJob ? linkedJob.status as string : event.status;

  const isWorking = ['working', 'executing', 'settling', 'verifying', 'needs-approval'].includes(effectiveStatus);
  const isComplete = effectiveStatus === 'completed' || effectiveStatus === 'complete';
  const isBlocked = effectiveStatus === 'blocked';
  const isIssue = effectiveStatus === 'issue' || effectiveStatus === 'recovering' || effectiveStatus === 'unknown';
  const isOperational = event.eventType === 'worker-added' || event.eventType === 'system' || (isRoutine && !isJob);

  function handleClick() {
    if (isJob && event.jobId) {
      dispatch({ type: 'SET_ACTIVE_JOB', id: event.jobId });
    } else if (isFinancial && event.actionId) {
      dispatch({ type: 'SET_ACTIVE_ACTION', id: event.actionId });
    } else if (isWallet && event.walletId) {
      dispatch({ type: 'SET_VIEW', view: 'wallets' });
      dispatch({ type: 'SET_ACTIVE_WALLET', id: event.walletId });
    } else if (isRoutine && event.routineId) {
      dispatch({ type: 'SET_VIEW', view: 'routines' });
      dispatch({ type: 'SET_ACTIVE_ROUTINE', id: event.routineId });
    } else if (event.workerId) {
      dispatch({ type: 'SET_ACTIVE_WORKER', id: event.workerId });
    }
  }

  const isClickable = !!(isJob && event.jobId) || !!(isFinancial && event.actionId) || !!(isWallet && event.walletId) || !!(isRoutine && event.routineId) || !!event.workerId;

  return (
    <button
      onClick={isClickable ? handleClick : undefined}
      className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-lg border transition-colors text-left ${
        isClickable
          ? 'border-border hover:border-border hover:bg-panel cursor-pointer'
          : 'border-border-dim cursor-default'
      }`}
    >
      {/* Status dot */}
      <div className="mt-1 shrink-0">
        {isWorking && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
        {isComplete && !isBlocked && !isIssue && <div className="w-2 h-2 rounded-full bg-accent" />}
        {isBlocked && <div className="w-2 h-2 rounded-full bg-danger" />}
        {(isIssue && !isBlocked) && <div className="w-2 h-2 rounded-full bg-warn" />}
        {isOperational && !isWorking && !isComplete && !isBlocked && !isIssue && <div className="w-2 h-2 rounded-full bg-text-dim" />}
        {(isFinancial || isAuthority || isWallet) && !isWorking && !isComplete && !isBlocked && !isIssue && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text truncate">{event.title}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {linkedJob?.status === 'completed' && linkedJob.kind === 'financial'
                ? '498.92 USDC received on Base · Completed · AgentPlace Verified'
                : linkedJob?.status === 'settling'
                ? 'Settling · destination settlement in progress'
                : linkedJob?.status === 'verifying'
                ? 'Transaction confirmed · Verifying outcome'
                : linkedJob?.status === 'executing'
                ? 'Executing · Arbitrum → Base'
                : linkedJob?.status === 'recovering'
                ? 'Recovering · 499.34 USDC verified in Agent Account'
                : linkedJob?.status === 'unknown'
                ? 'Confirming transaction status · Do not resubmit'
                : event.summary}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs text-text-dim font-mono">{timeAgo(event.timestamp)}</span>
            {isJob && (
              <div className="mt-0.5">
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isWorking
                      ? 'text-primary bg-primary-dim/20'
                      : isComplete
                      ? 'text-accent bg-accent-dim/20'
                      : 'text-text-muted bg-panel'
                  }`}
                >
                  {effectiveStatus === 'needs-approval' ? 'Needs approval' :
                   effectiveStatus === 'executing' ? 'Executing' :
                   effectiveStatus === 'settling' ? 'Settling' :
                   effectiveStatus === 'verifying' ? 'Verifying' :
                   effectiveStatus === 'recovering' ? 'Recovering' :
                   effectiveStatus === 'unknown' ? 'Unknown' :
                   effectiveStatus === 'completed' ? 'Completed · AgentPlace Verified' :
                   isWorking ? 'Working' :
                   isComplete ? 'Complete' : effectiveStatus}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isClickable && (
        <svg className="w-4 h-4 text-text-dim shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  );
}

export function ActivityView() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [filter, setFilter] = useState<Filter>('all');

  if (!state.user) {
    return (
      <div className="h-full flex items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-base font-semibold text-text mb-2">Activity</h2>
          <p className="text-sm text-text-sub leading-relaxed mb-5">
            Sign in to see your work history — jobs, research, and operational events.
          </p>
          <button
            onClick={() =>
              dispatch({
                type: 'SET_IDENTITY_CHECKPOINT',
                checkpoint: {
                  reason: 'sign-in',
                  feature: 'view your work history',
                  onComplete: (user) => dispatch({ type: 'SET_USER', user }),
                },
              })
            }
            className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'working', label: 'Working' },
    { id: 'complete', label: 'Completed' },
    { id: 'operational', label: 'Changes' },
  ];

  const filtered = (state.activityEvents ?? []).filter((e) => {
    const lj = e.jobId ? (state.jobs ?? []).find((j) => j.id === e.jobId) : null;
    const eff = lj ? (lj.status as string) : e.status;
    if (filter === 'all') return true;
    if (filter === 'working') return ['working', 'needs-approval', 'executing', 'settling', 'verifying', 'recovering', 'needs-you', 'unknown'].includes(eff);
    if (filter === 'complete') return eff === 'complete' || eff === 'completed' || eff === 'blocked';
    if (filter === 'operational') return e.eventType === 'worker-added' || e.eventType === 'system' || e.eventType === 'authority' || e.eventType === 'wallet' || e.eventType === 'routine';
    return true;
  });

  // Sort by timestamp descending
  const sorted = [...filtered].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-8 pb-0 shrink-0">
        <h1 className="text-2xl font-semibold text-text tracking-tight mb-1">Activity</h1>
        <p className="text-sm text-text-sub mb-5">What work happened or is happening</p>

        {/* Filters */}
        <div className="flex gap-0 border-b border-border">
          {filters.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                filter === id
                  ? 'border-primary text-text'
                  : 'border-transparent text-text-sub hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-8">
        <div className="max-w-2xl space-y-2">
          {sorted.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-muted">
                {filter === 'all' ? 'No activity yet' : `No ${filter} items`}
              </p>
            </div>
          )}
          {sorted.map((event) => (
            <ActivityRow key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}
