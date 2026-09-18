import { useAppState, useDispatch } from '../state/AppContext';
import type { WorkerStatus } from '../state/types';

const STATUS_CONFIG: Record<WorkerStatus, { label: string; color: string; dot: string }> = {
  working: { label: 'Working', color: 'text-accent', dot: 'bg-accent' },
  monitoring: { label: 'Monitoring', color: 'text-primary', dot: 'bg-primary' },
  standby: { label: 'Standing by', color: 'text-text-sub', dot: 'bg-text-muted' },
  'needs-you': { label: 'Needs you', color: 'text-warn', dot: 'bg-warn' },
  paused: { label: 'Paused', color: 'text-text-muted', dot: 'bg-text-dim' },
  limited: { label: 'Limited', color: 'text-warn', dot: 'bg-warn' },
  blocked: { label: 'Blocked', color: 'text-danger', dot: 'bg-danger' },
  issue: { label: 'Issue detected', color: 'text-danger', dot: 'bg-danger' },
};

export function WorkersView() {
  const state = useAppState();
  const dispatch = useDispatch();

  if (!state.user) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-panel-raised border border-border flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="7" r="3" strokeWidth={1.8} />
              <path strokeLinecap="round" strokeWidth={1.8} d="M3 20a6 6 0 0112 0" />
              <path strokeLinecap="round" strokeWidth={1.8} d="M18 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-text mb-2">Your workforce</h2>
          <p className="text-sm text-text-sub leading-relaxed mb-5">
            Workers are persistent specialists. Sign in to install Workers and have them work in the background.
          </p>
          <button
            onClick={() =>
              dispatch({
                type: 'SET_IDENTITY_CHECKPOINT',
                checkpoint: {
                  reason: 'sign-in',
                  feature: 'install Workers and keep them running',
                  onComplete: (user) => dispatch({ type: 'SET_USER', user }),
                },
              })
            }
            className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
          >
            Sign in
          </button>
          <p className="text-xs text-text-muted mt-3">
            Or browse available workers in{' '}
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', view: 'discover' })}
              className="text-primary hover:underline"
            >
              Discover
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (state.workers.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-base font-semibold text-text mb-2">No workers yet</h2>
          <p className="text-sm text-text-sub leading-relaxed mb-5">
            Add specialists from Discover, or describe what you need and AgentPlace will recommend the right workers.
          </p>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'discover' })}
            className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
          >
            Browse Discover
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg overflow-y-auto">
      <div className="px-6 pt-8 pb-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-text tracking-tight">Workers</h1>
            <p className="text-sm text-text-sub mt-0.5">
              {state.workers.length} specialist{state.workers.length !== 1 ? 's' : ''} in your workforce
            </p>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'discover' })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded text-text-sub hover:text-text hover:bg-panel transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
            </svg>
            Add Worker
          </button>
        </div>

        <div className="space-y-2">
          {state.workers.map((worker) => {
            const status = STATUS_CONFIG[worker.status];
            const activeJob = (state.jobs ?? []).find((j) => j.id === worker.currentJobId);
            return (
              <button
                key={worker.id}
                onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: worker.id })}
                className="w-full border border-border rounded-lg bg-panel px-5 py-4 hover:bg-panel-raised hover:border-border transition-colors text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded bg-panel-raised border border-border flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-medium text-text-sub">
                      {worker.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-semibold text-text">{worker.name}</h3>
                      {worker.isOriginal && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-primary border border-primary/30 rounded px-1.5 py-0.5">
                          Original
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        <span className={`text-xs ${status.color}`}>{status.label}</span>
                      </div>
                    </div>
                    <p className="text-xs text-text-sub mt-0.5">
                      {activeJob ? activeJob.title : worker.currentFocus ?? worker.tagline}
                    </p>
                  </div>
                  <svg
                    className="w-4 h-4 text-text-dim group-hover:text-text-muted transition-colors shrink-0 mt-2"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
