import { useAppState, useDispatch } from '../state/AppContext';

/** Projects a persisted message.jobId onto the one authoritative Job record.
 * Never creates a Job, invents its status, or grants access without its owner-scoped API hydration. */
export function JobReference({ jobId }: { jobId: string }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const job = state.jobs.find((entry) => entry.id === jobId);
  if (!job) {
    return <div className="mt-3 rounded-lg border border-border-dim bg-panel px-4 py-3 text-xs text-text-muted" role="status">Job reference is syncing. Check Activity if it does not appear.</div>;
  }
  const status = job.status === 'completed' && job.kind === 'research' ? 'Research complete'
    : job.status === 'completed' ? 'Completed'
    : job.status === 'planning' ? 'Planning'
    : job.status === 'needs-you' || job.status === 'needs-approval' ? 'Needs you'
    : job.status === 'failed' ? 'Failed'
    : job.status === 'blocked' ? 'Blocked' : job.status === 'recovering' ? 'Recovering'
    : job.status === 'verifying' ? 'Verifying' : job.status === 'settling' ? 'Settling'
    : job.status === 'unknown' ? 'Confirming' : job.status === 'executing' ? 'Executing' : 'Working';
  return (
    <section className="mt-3 max-w-lg rounded-lg border border-border bg-panel px-4 py-3" aria-label={`Job: ${job.title}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">Job</p>
          <p className="text-sm font-semibold text-text break-words">{job.title}</p>
          <p className="text-xs text-text-sub mt-1 break-words">{job.goal}</p>
        </div>
        <span className={`text-[11px] shrink-0 ${job.status === 'completed' ? 'text-accent' : job.status === 'failed' || job.status === 'blocked' ? 'text-danger' : 'text-primary'}`}>{status}</span>
      </div>
      <p className="text-xs text-text-muted mt-2">Lead: <span className="text-text-sub">{job.leadWorkerName}</span>{job.supportingWorkerNames.length > 0 ? ` · +${job.supportingWorkerNames.length} supporting` : ''}</p>
      {job.stages.length > 0 && <p className="text-xs text-text-muted mt-1">Current stage: {job.currentStage}</p>}
      <button type="button" onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: job.id })}
        className="mt-3 text-xs font-medium text-primary border border-primary/30 rounded px-3 py-2 hover:bg-primary-dim/20 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`Open job workspace for ${job.title}`}>
        Open job →
      </button>
    </section>
  );
}
