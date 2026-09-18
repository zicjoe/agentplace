import type { EnvironmentName } from "./environment.js";
import type { TraceId } from "./tracing.js";

export interface EventEnvelope<TPayload extends Record<string, unknown>> {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly environment: EnvironmentName;
  readonly traceId: TraceId;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: Readonly<TPayload>;
}

export const foundationEventTypes = [
  "job.created",
  "job.completed",
  "job.failed",
  "approval.requested",
  "approval.completed",
  "capability.degraded",
  "routine.triggered",
  "receipt.anchor_queued",
  "receipt.anchored",
] as const;

export type FoundationEventType = (typeof foundationEventTypes)[number];
