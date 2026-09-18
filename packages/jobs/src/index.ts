export type TraceId = `trace_${string}`;

export const jobStatuses = [
  "PLANNED",
  "PREPARING",
  "AWAITING_APPROVAL",
  "AUTHORIZED",
  "EXECUTING",
  "SETTLING",
  "VERIFYING",
  "COMPLETED",
  "PAUSED",
  "FAILED_RECOVERABLE",
  "FAILED_FINAL",
  "REQUIRES_USER",
] as const;

export type JobStatus = (typeof jobStatuses)[number];

export interface JobIdentity {
  readonly jobId: string;
  readonly traceId: TraceId;
  readonly status: JobStatus;
}
