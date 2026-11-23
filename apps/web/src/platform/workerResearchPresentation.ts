/**
 * Worker and Manager conversations share one presentation contract for saved
 * research. These helpers interpret persisted runtime message IDs only; they
 * never create a Job or change the saved research/evidence.
 */
export interface WorkerResearchMessage {
  id: string;
  role: 'user' | 'manager';
  jobId?: string;
  content: string;
}

export interface ResearchJobReference {
  id: string;
  // Saved Jobs may omit kind. Only explicit `research` Jobs qualify for
  // condensed research presentation (see workerResearchMessageView).
  kind?: string;
  title: string;
}

export type WorkerResearchMessageView = 'report' | 'completed-start' | 'running-start' | 'ordinary';

export function workerResearchMessageView(
  message: WorkerResearchMessage,
  job: ResearchJobReference | undefined,
  completedReportExists: boolean,
): WorkerResearchMessageView {
  // Never use model-authored message text to decide that research completed.
  // Only trusted persisted message IDs attached to an owner-hydrated research
  // Job qualify for the condensed UI.
  if (message.role === 'user' || !message.jobId || !job || job.kind !== 'research' || job.id !== message.jobId) {
    return 'ordinary';
  }
  if (message.id.startsWith('msg_origin_result_')) return 'report';
  if (message.id.startsWith('msg_job_created_')) {
    return completedReportExists ? 'completed-start' : 'running-start';
  }
  return 'ordinary';
}

/** Remove only the backend's echoed bold Job title, never its report content.
 * The persisted original remains intact in PostgreSQL and the Job workspace. */
export function workerResearchAnswerBody(text: string, title: string): string {
  const match = text.match(/^\s*\*\*([^*\n]+)\*\*\s*\n\s*\n/);
  if (!match || !title.trim()) return text;
  const emitted = match[1]!.trim().replace(/\s+/g, ' ');
  const recorded = title.trim().replace(/\s+/g, ' ');
  // Job titles are persisted with a 200-character cap; the initial Worker
  // answer may contain the complete model-generated title.
  if (emitted !== recorded && !(recorded.length >= 190 && emitted.startsWith(recorded))) return text;
  return text.slice(match[0].length).trimStart();
}
