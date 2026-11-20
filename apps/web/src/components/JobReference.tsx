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
    <section className="mt-2 max-w-2xl rounded-lg border border-border-dim bg-panel/50 px-3 py-2.5" aria-label={`Job: ${job.title}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`text-xs font-medium ${job.status === 'completed' ? 'text-accent' : job.status === 'failed' || job.status === 'blocked' ? 'text-danger' : 'text-text-sub'}`}>
          {status}
        </span>
        <span className="text-xs text-text-muted truncate max-w-full" title={job.title}>{job.title}</span>
        <button type="button" onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: job.id })}
          className="text-xs font-medium text-primary hover:text-primary-hover hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary rounded"
          aria-label={`View work and details for ${job.title}`}>
          View work →
        </button>
      </div>
      {(job.status === 'needs-you' || job.status === 'needs-approval' || job.status === 'blocked' || job.status === 'failed') &&
        <p className="text-xs text-text-muted mt-1.5">Open the Job to review the exact decision and available next steps.</p>}
    </section>
  );
}
