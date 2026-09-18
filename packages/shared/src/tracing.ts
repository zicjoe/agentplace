export type TraceId = `trace_${string}`;
export type RequestId = `req_${string}`;

function randomId(prefix: "trace" | "req"): string {
  const id = globalThis.crypto.randomUUID().replaceAll("-", "");
  return `${prefix}_${id}`;
}

export function createTraceId(): TraceId {
  return randomId("trace") as TraceId;
}

export function createRequestId(): RequestId {
  return randomId("req") as RequestId;
}

export function isTraceId(value: string): value is TraceId {
  return /^trace_[a-f0-9]{32}$/.test(value);
}
