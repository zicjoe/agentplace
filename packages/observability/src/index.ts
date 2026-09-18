export type TraceId = `trace_${string}`;
export type RequestId = `req_${string}`;
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface StructuredLogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly message: string;
  readonly traceId: TraceId;
  readonly requestId?: RequestId;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export function createStructuredLogRecord(
  input: Omit<StructuredLogRecord, "timestamp">,
  now = new Date(),
): StructuredLogRecord {
  return Object.freeze({ timestamp: now.toISOString(), ...input });
}
