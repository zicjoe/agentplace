import { useAppState, useDispatch } from '../state/AppContext';
import type { Routine, RoutineStatus } from '../state/types';

function timeAgo(date: Date | undefined): string {
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function timeUntil(date: Date | undefined): string {
  if (!date) return '—';
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'Due now';
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hrs < 1) return 'In <1 hour';
  if (hrs < 24) return `In ${hrs}h`;
  if (days === 1) return 'Tomorrow';
  return `In ${days}d`;
}

const STATUS_LABEL: Record<RoutineStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  watching: 'Watching',
  'waiting-for-event': 'Waiting for event',
  'cooling-down': 'Cooling down',
  paused: 'Paused',
  limited: 'Limited',
  'needs-you': 'Needs you',
  expired: 'Expired',
  stopped: 'Stopped',
};

const STATUS_DOT: Record<RoutineStatus, string> = {
  draft: 'bg-text-dim',
  active: 'bg-accent animate-pulse',
  watching: 'bg-primary animate-pulse',
  'waiting-for-event': 'bg-primary',
  'cooling-down': 'bg-warn',
  paused: 'bg-text-dim',
  limited: 'bg-warn',
  'needs-you': 'bg-warn',
  expired: 'bg-text-dim',
  stopped: 'bg-text-dim',
};

const STATUS_TEXT: Record<RoutineStatus, string> = {
  draft: 'text-text-muted',
  active: 'text-accent',
  watching: 'text-primary',
  'waiting-for-event': 'text-primary',
  'cooling-down': 'text-warn',
  paused: 'text-text-muted',
  limited: 'text-warn',
  'needs-you': 'text-warn',
  expired: 'text-text-muted',
  stopped: 'text-text-muted',
};

function RoutineRow({ routine }: { routine: Routine }) {
  const dispatch = useDispatch();

  return (
    <button
      onClick={() => dispatch({ type: 'SET_ACTIVE_ROUTINE', id: routine.id })}
      className="w-full text-left px-4 py-4 rounded-lg border border-border hover:border-border hover:bg-panel transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[routine.status]}`} />
            <p className="text-sm font-medium text-text truncate">{routine.title}</p>
            {routine.status === 'limited' && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-warn/10 text-warn border border-warn/20 shrink-0">
                Limited
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mb-2">{routine.workerName}</p>
          <div className="flex flex-wrap gap-3 text-[11px] text-text-dim font-mono">
            <span>{routine.trigger.humanReadable}</span>
            <span className="text-text-dim">·</span>
            <span className={STATUS_TEXT[routine.status]}>{STATUS_LABEL[routine.status]}</span>
            <span className="text-text-dim">·</span>
            <span>{routine.executionBehavior === 'recommend-only' ? 'Recommend only' : 'May act within authority'}</span>
          </div>
        </div>
        <div className="shrink-0 text-right space-y-1">
          <p className="text-[10px] font-mono text-text-dim uppercase tracking-wider">Last meaningful</p>
          <p className="text-xs text-text-muted">{timeAgo(routine.lastMeaningfulActionAt)}</p>
          {routine.nextRunAt && (
            <>
              <p className="text-[10px] font-mono text-text-dim uppercase tracking-wider mt-1">Next</p>
              <p className="text-xs text-text-muted">{timeUntil(routine.nextRunAt)}</p>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end">
        <svg className="w-4 h-4 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}

export function RoutinesView() {
  const state = useAppState();
  const dispatch = useDispatch();

  if (!state.user) {
    return (
      <div className="h-full flex items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-base font-semibold text-text mb-2">Routines</h2>
          <p className="text-sm text-text-sub leading-relaxed mb-5">
            Persistent triggers owned by your Workers. Set them up conversationally, manage them here.
          </p>
          <button
            onClick={() =>
              dispatch({
                type: 'SET_IDENTITY_CHECKPOINT',
                checkpoint: {
                  reason: 'sign-in',
                  feature: 'manage Routines',
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

  const routines = state.routines ?? [];
  const active = routines.filter((r) => ['active', 'watching', 'waiting-for-event', 'cooling-down'].includes(r.status));
  const needsAttention = routines.filter((r) => ['limited', 'needs-you'].includes(r.status));
  const inactive = routines.filter((r) => ['paused', 'stopped', 'expired', 'draft'].includes(r.status));

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-6 pt-8 pb-0 shrink-0">
        <h1 className="text-2xl font-semibold text-text tracking-tight mb-1">Routines</h1>
        <p className="text-sm text-text-sub mb-6">Persistent triggers owned by your Workers</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-2xl space-y-6">
          {routines.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-muted mb-2">No Routines configured yet</p>
              <p className="text-xs text-text-dim">
                Open a Worker and tell it what should keep happening.
              </p>
            </div>
          )}

          {needsAttention.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-warn mb-2">
                Needs attention
              </p>
              <div className="space-y-2">
                {needsAttention.map((r) => (
                  <RoutineRow key={r.id} routine={r} />
                ))}
              </div>
            </div>
          )}

          {active.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
                Running
              </p>
              <div className="space-y-2">
                {active.map((r) => (
                  <RoutineRow key={r.id} routine={r} />
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
                Inactive
              </p>
              <div className="space-y-2">
                {inactive.map((r) => (
                  <RoutineRow key={r.id} routine={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
