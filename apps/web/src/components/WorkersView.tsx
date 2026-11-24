import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import { matchesWorkerFilter, summarizeWorker, workerSummarySort, type WorkerEverydaySummary, type WorkerWorkFilter, type WorkerWorkState } from '../platform/workerEverydayWork';
import type { Job, Worker } from '../state/types';
import { WorkerLifecycleControls } from './WorkerLifecycleControls';

const STATE_DISPLAY: Record<WorkerWorkState, { label: string; color: string; dot: string }> = {
  working: { label: 'Working', color: 'text-accent', dot: 'bg-accent' },
  monitoring: { label: 'Monitoring', color: 'text-primary', dot: 'bg-primary' },
  'standing-by': { label: 'Standing by', color: 'text-text-sub', dot: 'bg-text-muted' },
  'needs-you': { label: 'Needs you', color: 'text-warn', dot: 'bg-warn' },
  paused: { label: 'Paused', color: 'text-text-muted', dot: 'bg-text-dim' },
};

const FILTERS: Array<{ id: WorkerWorkFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'working', label: 'Working' },
  { id: 'needs-you', label: 'Needs you' },
  { id: 'paused', label: 'Paused' },
];

function lastUpdated(date: Date | undefined): string {
  if (!date || !Number.isFinite(date.getTime())) return 'No activity yet';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function jobStatus(status: Job['status']): string {
  const labels: Partial<Record<Job['status'], string>> = {
    'needs-approval': 'Needs approval', 'needs-you': 'Needs you', completed: 'Completed',
    blocked: 'Blocked', failed: 'Failed', planning: 'Planning', working: 'Working',
    verifying: 'Verifying', recovering: 'Recovering', executing: 'Executing',
    settling: 'Settling', unknown: 'Confirming status', rejected: 'Rejected',
  };
  return labels[status] ?? status;
}

function WorkerTile({ summary, createdByYou }: { summary: WorkerEverydaySummary; createdByYou: boolean }) {
  const dispatch = useDispatch();
  const [showHistory, setShowHistory] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const { worker, status, attentionJob, activeJob, recentJob, canContinue, work } = summary;
  const badge = STATE_DISPLAY[status];
  const priority = attentionJob ?? activeJob ?? recentJob;
  const isPaused = status === 'paused';
  const actionLabel = isPaused ? 'Open Worker' : canContinue ? 'Continue work' : 'Give work';
  const attentionLabel = attentionJob ? `${jobStatus(attentionJob.status)} · ${attentionJob.title}` : undefined;
  const note = attentionLabel ?? (priority ? priority.title : worker.currentFocus ?? worker.tagline);

  function openWorker() {
    dispatch({ type: 'SET_ACTIVE_WORKER', id: worker.id });
  }

  return (
    <article className="border border-border rounded-xl bg-panel overflow-hidden">
      <div className="px-4 sm:px-5 py-4">
        <div className="flex gap-3 min-w-0 items-start">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-panel-raised border border-border">
            <span className="text-xs font-mono font-semibold text-text-sub">{worker.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
              <h2 className="text-sm sm:text-base font-semibold text-text break-words">{worker.name}</h2>
              {createdByYou ? <span className="text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5">Created by you</span>
                : worker.isOriginal ? <span className="text-[10px] text-primary border border-primary/30 rounded px-1.5 py-0.5">AgentPlace Original</span> : null}
              <span className={`inline-flex items-center gap-1.5 text-xs ${badge.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />{badge.label}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">{worker.tagline}</p>
            <p className="text-xs text-text-sub mt-2 break-words line-clamp-2">
              <span className="text-text-muted">{attentionJob ? 'Needs attention:' : activeJob ? 'In progress:' : recentJob ? 'Recent work:' : 'Focus:'}</span>{' '}
              {note}
            </p>
            {priority && <p className="text-[11px] text-text-muted mt-1">{jobStatus(priority.status)} · {lastUpdated(priority.updatedAt)}</p>}
            {summary.needsAction && !attentionJob && status !== 'needs-you' &&
              <p className="text-[11px] text-warn mt-1">Needs attention · review Worker status</p>}
            {worker.updateAvailable && <p className="text-[11px] text-primary mt-1">Worker update available · open Worker to review</p>}
            {!priority && summary.lastActivityAt && <p className="text-[11px] text-text-muted mt-1">Conversation updated {lastUpdated(summary.lastActivityAt)}</p>}
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap items-center">
          <button
            type="button"
            onClick={openWorker}
            className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >{actionLabel} →</button>
          {priority && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: priority.id, tab: 'result' })}
              className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-text-sub hover:text-text hover:bg-panel-raised focus-visible:outline-2 focus-visible:outline-primary"
            >{attentionJob ? 'Review work' : activeJob ? 'View progress' : 'View last Job'}</button>
          )}
          <button type="button" onClick={() => setShowControls((value) => !value)} aria-expanded={showControls}
            aria-controls={`worker-controls-${worker.id}`}
            className="px-2 py-2 text-xs text-text-muted hover:text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded"
          >{showControls ? 'Hide controls' : 'Manage'}</button>
          {work.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((value) => !value)}
              aria-expanded={showHistory}
              className="px-2 py-2 text-xs text-text-muted hover:text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded"
            >{showHistory ? 'Hide work history' : `Work history (${work.length})`}</button>
          )}
        </div>
        {showControls && (
          <div id={`worker-controls-${worker.id}`} className="mt-3 rounded-lg border border-border-dim bg-panel-raised/40 px-3 py-3">
            <p className="text-[11px] font-medium text-text mb-2">Worker controls</p>
            <WorkerLifecycleControls worker={worker} />
            <p className="text-[11px] text-text-muted mt-2">Check Security for independent authority grants and Routines for ongoing schedules.</p>
          </div>
        )}
        {isPaused && <p className="mt-2 text-[11px] text-text-muted">This Worker is paused. Open it to review status and resume if appropriate. Pausing does not reverse submitted transactions.</p>}
      </div>
      {showHistory && work.length > 0 && (
        <div className="border-t border-border-dim px-4 sm:px-5 py-3 bg-panel-raised/30">
          <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-2">Recent Jobs · including supporting contributions</p>
          <div className="space-y-1">
            {work.slice(0, 5).map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: job.id, tab: 'result' })}
                className="w-full flex items-center gap-3 text-left rounded-md px-2 py-2 hover:bg-panel-raised focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className="flex-1 min-w-0 text-xs text-text-sub truncate">{job.title}</span>
                <span className="text-[11px] text-text-muted shrink-0">{jobStatus(job.status)}</span>
                <span className="text-[11px] text-text-dim shrink-0 hidden sm:inline">{lastUpdated(job.updatedAt)}</span>
              </button>
            ))}
          </div>
          {work.length > 5 && <p className="text-[11px] text-text-muted mt-2">Showing five recent Jobs. See Activity for more.</p>}
        </div>
      )}
    </article>
  );
}

export function WorkersView() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [filter, setFilter] = useState<WorkerWorkFilter>('all');

  if (!state.user) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-text mb-2">My Workers</h1>
          <p className="text-sm text-text-sub leading-relaxed mb-5">Sign in to see your Workers, continue conversations, and follow their work.</p>
          <button
            onClick={() => dispatch({ type: 'SET_IDENTITY_CHECKPOINT', checkpoint: { reason: 'sign-in', feature: 'manage your Workers', onComplete: (user) => dispatch({ type: 'SET_USER', user }) } })}
            className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
          >Sign in</button>
          <p className="text-xs text-text-muted mt-3">Or <button onClick={() => dispatch({ type: 'SET_VIEW', view: 'discover' })} className="text-primary hover:underline">browse Discover</button>.</p>
        </div>
      </div>
    );
  }

  const summaries = state.workers.map((worker: Worker) => summarizeWorker(worker, state.jobs, state.conversations)).sort(workerSummarySort);
  const visible = summaries.filter((summary) => matchesWorkerFilter(summary, filter));
  const counts = {
    all: summaries.length,
    working: summaries.filter((summary) => summary.status === 'working').length,
    'needs-you': summaries.filter((summary) => summary.needsAction).length,
    paused: summaries.filter((summary) => summary.status === 'paused').length,
  };

  return (
    <div className="h-full min-h-0 bg-bg overflow-y-auto overscroll-contain">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-7 sm:pt-9 pb-12">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-text tracking-tight">My Workers</h1>
            <p className="text-sm text-text-sub mt-1">Your workforce, ongoing work, and where to pick up.</p>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'discover' })}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-border text-text-sub hover:bg-panel hover:text-text transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-primary"
          >+ Add Worker</button>
        </header>

        {summaries.length === 0 ? (
          <section className="rounded-xl border border-border bg-panel text-center py-12 px-5">
            <h2 className="text-base font-semibold text-text mb-2">Your workforce starts here</h2>
            <p className="text-sm text-text-muted max-w-md mx-auto mb-5">Discover a specialist, add it, and start working together. Installed Workers and their conversations will appear here.</p>
            <button onClick={() => dispatch({ type: 'SET_VIEW', view: 'discover' })} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm rounded-lg">Explore Workers →</button>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6" aria-label="Workforce overview">
              {(['working', 'needs-you', 'paused'] as const).map((status) => (
                <button key={status} type="button" onClick={() => setFilter(filter === status ? 'all' : status)} aria-pressed={filter === status}
                  className={`rounded-xl border px-3 sm:px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${filter === status ? 'bg-primary-dim/20 border-primary/50' : 'bg-panel border-border hover:bg-panel-raised'}`}>
                  <p className="text-xl font-semibold text-text">{counts[status]}</p>
                  <p className={`text-xs mt-0.5 ${STATE_DISPLAY[status].color}`}>{STATE_DISPLAY[status].label}</p>
                </button>
              ))}
            </div>
            <nav className="flex gap-1 sm:gap-2 border-b border-border mb-4 overflow-x-auto" aria-label="Filter your Workers">
              {FILTERS.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id}
                  className={`shrink-0 px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm border-b-2 -mb-px font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${filter === id ? 'text-text border-primary' : 'text-text-muted border-transparent hover:text-text'}`}>
                  {label} <span className="ml-1 text-[11px] opacity-70">{counts[id]}</span>
                </button>
              ))}
            </nav>
            {visible.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visible.map((summary) => (
                  <WorkerTile key={summary.worker.id} summary={summary}
                    createdByYou={state.creatorAssets.some((asset) => asset.type === 'worker' && asset.id === summary.worker.id)} />
                ))}
              </div>
            ) : (
              <div className="border border-border rounded-xl bg-panel p-8 text-center">
                <p className="text-sm text-text-sub">No Workers in this view right now.</p>
                <button className="text-xs text-primary hover:underline mt-3" type="button" onClick={() => setFilter('all')}>Show all Workers</button>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-text-muted">
              <button onClick={() => dispatch({ type: 'SET_VIEW', view: 'activity' })} className="text-primary hover:underline">See all activity →</button>
              <span>Worker controls and financial permissions remain separate. Opening a Worker grants no authority.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
