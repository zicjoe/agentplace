import type { Conversation, Job, JobStatus, Worker } from '../state/types';

export type WorkerWorkFilter = 'all' | 'working' | 'needs-you' | 'paused';
export type WorkerWorkState = 'working' | 'needs-you' | 'paused' | 'monitoring' | 'standing-by';

const ACTION_REQUIRED_JOBS = new Set<JobStatus>([
  'needs-approval', 'needs-you', 'blocked', 'failed', 'recovering', 'unknown', 'rejected',
]);
const IN_PROGRESS_JOBS = new Set<JobStatus>([
  'planning', 'working', 'executing', 'settling', 'verifying',
]);

function newestFirst(a: Job, b: Job): number {
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

/** A supporting specialist can appear in work history without owning that Job's controls. */
export function jobsForWorker(jobs: readonly Job[], workerId: string): Job[] {
  return jobs.filter((job) =>
    job.originWorkerId === workerId || job.leadWorkerId === workerId || job.supportingWorkerIds.includes(workerId)
  ).sort(newestFirst);
}

/** Matches the installed Worker's real conversation, not an unrelated Manager or Job thread. */
export function workerConversation(conversations: readonly Conversation[], workerId: string): Conversation | undefined {
  return conversations.find((conversation) => conversation.scope === 'worker' && conversation.workerId === workerId);
}

export interface WorkerEverydaySummary {
  worker: Worker;
  status: WorkerWorkState;
  work: Job[];
  recentJob?: Job;
  attentionJob?: Job;
  activeJob?: Job;
  conversation?: Conversation;
  canContinue: boolean;
  needsAction: boolean;
  lastActivityAt?: Date;
}

/** Derive the My Workers display from existing owner-scoped durable state; never invent task progress. */
export function summarizeWorker(worker: Worker, jobs: readonly Job[], conversations: readonly Conversation[]): WorkerEverydaySummary {
  const work = jobsForWorker(jobs, worker.id);
  const conversation = workerConversation(conversations, worker.id);
  // A supporting specialist's Job can be inspected, but is not presented as
  // a user approval owned by that specialist.
  const owned = work.filter((job) => job.originWorkerId === worker.id || job.leadWorkerId === worker.id);
  const attentionJob = owned.find((job) => ACTION_REQUIRED_JOBS.has(job.status));
  const activeJob = owned.find((job) => IN_PROGRESS_JOBS.has(job.status));
  const recentJob = work[0];
  const needsAttention = !!attentionJob || ['needs-you', 'limited', 'blocked', 'issue'].includes(worker.status);
  const status: WorkerWorkState = worker.status === 'paused' ? 'paused'
    : needsAttention ? 'needs-you'
    : activeJob || worker.status === 'working' ? 'working'
    : worker.status === 'monitoring' ? 'monitoring'
    : 'standing-by';
  const lastActivityAt = recentJob && conversation
    ? (recentJob.updatedAt.getTime() >= conversation.updatedAt.getTime() ? recentJob.updatedAt : conversation.updatedAt)
    : recentJob?.updatedAt ?? conversation?.updatedAt;
  return {
    worker, status, work,
    ...(recentJob ? { recentJob } : {}),
    ...(attentionJob ? { attentionJob } : {}),
    ...(activeJob ? { activeJob } : {}),
    ...(conversation ? { conversation } : {}),
    canContinue: !!conversation && conversation.messages.length > 0,
    needsAction: needsAttention,
    ...(lastActivityAt ? { lastActivityAt } : {}),
  };
}

export function matchesWorkerFilter(summary: WorkerEverydaySummary, filter: WorkerWorkFilter): boolean {
  return filter === 'all' || summary.status === filter || (filter === 'needs-you' && summary.needsAction);
}

export function workerSummarySort(a: WorkerEverydaySummary, b: WorkerEverydaySummary): number {
  const order = { 'needs-you': 0, working: 1, monitoring: 2, 'standing-by': 3, paused: 4 };
  if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
  const aTime = a.lastActivityAt?.getTime() ?? 0;
  const bTime = b.lastActivityAt?.getTime() ?? 0;
  return bTime - aTime || a.worker.name.localeCompare(b.worker.name);
}
