import type { AuthorityGrant, Job, Routine, Worker } from '../state/types';

export type WorkerLifecycleAction = 'pause' | 'resume' | 'remove';

/** UI disclosure only: does not claim Worker status updates revoke any separate authority. */
export function workerLifecycleDependencies(workerId: string, jobs: readonly Job[], routines: readonly Routine[], grants: readonly AuthorityGrant[]) {
  const activeJobs = jobs.filter((job) =>
    (job.originWorkerId === workerId || job.leadWorkerId === workerId) &&
    ['planning', 'working', 'executing', 'settling', 'verifying', 'recovering', 'unknown', 'needs-approval'].includes(job.status)
  );
  const liveRoutines = routines.filter((routine) => routine.workerId === workerId &&
    ['active', 'watching', 'waiting-for-event', 'cooling-down', 'limited', 'needs-you'].includes(routine.status));
  const independentGrants = grants.filter((grant) => grant.workerId === workerId && (grant.status === 'active' || grant.status === 'paused'));
  return { activeJobs: activeJobs.length, liveRoutines: liveRoutines.length, independentGrants: independentGrants.length };
}

export function workerLifecycleConfirmation(worker: Pick<Worker, 'name'>, action: WorkerLifecycleAction, dependencies: ReturnType<typeof workerLifecycleDependencies>): string {
  if (action === 'resume') return `Resume ${worker.name}? This restores the installed Worker's eligible status, not a separate wallet permission.`;
  const start = action === 'remove'
    ? `Remove ${worker.name} from My Workers? This removes the installation, not its saved Job and conversation history.`
    : `Pause ${worker.name}? This pauses its installed Worker status, but does not cancel submitted transactions or guarantee that work already in progress stops.`;
  const facts = [
    dependencies.activeJobs ? `${dependencies.activeJobs} associated Job(s) may still require review or be in progress.` : '',
    dependencies.liveRoutines ? `${dependencies.liveRoutines} linked routine(s) have their own lifecycle and must be managed separately.` : '',
    dependencies.independentGrants ? `${dependencies.independentGrants} existing authority grant(s) require separate review or revocation in Security.` : '',
  ].filter(Boolean);
  return [start, ...facts, 'Worker controls do not revoke independent permissions, cancel submitted transactions, reverse on-chain transactions, or cancel separately managed routines.'].join('\n\n');
}
