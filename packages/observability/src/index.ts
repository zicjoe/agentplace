import type { RequestId, TraceId } from '@agent-place/shared';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface TraceContext {
  readonly traceId: TraceId;
  readonly requestId?: RequestId;
  readonly jobId?: string;
  readonly actionId?: string;
  readonly routineId?: string;
  readonly taskId?: string;
  readonly capabilityId?: string;
  readonly provider?: string;
}

export interface StructuredLogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly message: string;
  readonly traceId?: TraceId;
  readonly requestId?: RequestId;
  readonly fields?: Readonly<Record<string, unknown>>;
}

const SENSITIVE_KEY = /(authorization|cookie|secret|password|private.?key|seed|mnemonic|signature|raw.?transaction|api.?key|bearer|session.?token|access.?token|refresh.?token)/i;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 2_000) return `${value.slice(0, 2_000)}…`;
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    result[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeValue(item, depth + 1);
  }
  return result;
}

export function sanitizeLogFields(fields: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined {
  return fields ? (sanitizeValue(fields) as Readonly<Record<string, unknown>>) : undefined;
}

export function createStructuredLogRecord(
  input: Omit<StructuredLogRecord, 'timestamp'>,
  now = new Date(),
): StructuredLogRecord {
  const fields = sanitizeLogFields(input.fields);
  return Object.freeze({
    timestamp: now.toISOString(),
    level: input.level,
    service: input.service,
    message: input.message,
    ...(input.traceId ? { traceId: input.traceId } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(fields ? { fields } : {}),
  });
}

export interface ServiceLogger {
  debug(message: string, fields?: Readonly<Record<string, unknown>>, context?: TraceContext): void;
  info(message: string, fields?: Readonly<Record<string, unknown>>, context?: TraceContext): void;
  warn(message: string, fields?: Readonly<Record<string, unknown>>, context?: TraceContext): void;
  error(message: string, fields?: Readonly<Record<string, unknown>>, context?: TraceContext): void;
}

export function createServiceLogger(service: string): ServiceLogger {
  const emit = (level: LogLevel, message: string, fields?: Readonly<Record<string, unknown>>, context?: TraceContext): void => {
    const merged: Record<string, unknown> = {
      ...(context?.jobId ? { jobId: context.jobId } : {}),
      ...(context?.actionId ? { actionId: context.actionId } : {}),
      ...(context?.routineId ? { routineId: context.routineId } : {}),
      ...(context?.taskId ? { taskId: context.taskId } : {}),
      ...(context?.capabilityId ? { capabilityId: context.capabilityId } : {}),
      ...(context?.provider ? { provider: context.provider } : {}),
      ...(fields ?? {}),
    };
    const record = createStructuredLogRecord({
      level,
      service,
      message,
      ...(context?.traceId ? { traceId: context.traceId } : {}),
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      ...(Object.keys(merged).length ? { fields: merged } : {}),
    });
    const line = `${JSON.stringify(record)}\n`;
    if (level === 'error' || level === 'warn') process.stderr.write(line);
    else process.stdout.write(line);
  };
  return {
    debug: (message, fields, context) => emit('debug', message, fields, context),
    info: (message, fields, context) => emit('info', message, fields, context),
    warn: (message, fields, context) => emit('warn', message, fields, context),
    error: (message, fields, context) => emit('error', message, fields, context),
  };
}
