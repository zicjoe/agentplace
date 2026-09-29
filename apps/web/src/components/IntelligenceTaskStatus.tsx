import { useEffect, useState } from 'react';
import { fetchLatestIntelligenceTask, type IntelligenceTask } from '../platform/intelligenceApi';

function failureExplanation(error: string | undefined): string {
  const message = (error ?? '').toLowerCase();
  if (/quota|billing|insufficient_quota/.test(message)) return 'The selected AI provider has reached its quota or billing limit. Choose another available model or check its API usage.';
  if (/provider_http_429|rate.limit|too many requests/.test(message)) return 'The selected AI provider is rate limiting requests. Choose another available model or try later.';
  if (/provider_http_50|service.unavailable|high demand|overload/.test(message)) return 'The selected AI provider is temporarily unavailable. Choose another available model or try later.';
  if (/provider_http_401|invalid.api.key|authentication/.test(message)) return 'The AI provider rejected its server-side credential. Check the Worker service configuration.';
  if (/provider_http_404|model.*not found/.test(message)) return 'The requested AI model was not available. Check the configured model ID.';
  if (/provider_timeout|timed out/.test(message)) return 'The AI provider did not respond in time.';
  if (/AI_MAX_CALLS_PER_TASK_REACHED|ai_daily_cost_limit_reached/i.test(error ?? '')) return 'AgentPlace reached a configured AI usage limit.';
  return 'The AI task failed. Check the Worker deployment logs for its task ID.';
}

function ProcessingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-4" aria-hidden="true">
      <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" />
      <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '150ms' }} />
      <span className="w-1 h-1 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

interface IntelligenceTaskStatusProps {
  conversationId: string;
  latestAssistantAt?: Date;
  pendingMessageId?: string;
}

/**
 * Projects real database-backed task state into the conversation stream.
 * The row is truthful operational state, not a fabricated assistant message.
 */
export function IntelligenceTaskStatus({ conversationId, latestAssistantAt, pendingMessageId }: IntelligenceTaskStatusProps) {
  const [task, setTask] = useState<IntelligenceTask | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (running || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      running = true;
      try {
        const next = await fetchLatestIntelligenceTask(conversationId);
        if (!cancelled) {
          setTask(next);
          setUnavailable(false);
        }
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally {
        running = false;
      }
    };

    setTask(null);
    setUnavailable(false);
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [conversationId]);

  if (unavailable) {
    return (
      <div className="flex gap-3" role="status" aria-live="polite">
        <div className="w-6 h-6 rounded bg-primary-dim flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[9px] font-bold text-primary">AP</span>
        </div>
        <p className="text-xs text-amber-300 pt-1">
          AgentPlace cannot check this task right now. Your conversation remains saved.
        </p>
      </div>
    );
  }

  if (pendingMessageId && task?.userMessageId !== pendingMessageId && !unavailable) {
    return (
      <div className="flex gap-3" role="status" aria-live="polite">
        <div className="w-6 h-6 rounded bg-primary-dim flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[9px] font-bold text-primary">AP</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-sub pt-0.5">
          AgentPlace is preparing <ProcessingDots />
        </div>
      </div>
    );
  }

  if (!task) return null;

  const taskCreatedAt = Date.parse(task.createdAt);
  const latestAssistantMs = latestAssistantAt?.getTime() ?? 0;
  const responseAlreadyVisible =
    task.status === 'completed' &&
    Number.isFinite(taskCreatedAt) &&
    latestAssistantMs >= taskCreatedAt;

  if (responseAlreadyVisible) return null;

  const isRetry = task.status === 'queued' && task.attempts > 0;
  const label =
    task.status === 'queued'
      ? isRetry
        ? 'AgentPlace is retrying'
        : 'AgentPlace is preparing'
      : task.status === 'running'
        ? 'AgentPlace is working'
        : task.status === 'completed'
          ? 'Finishing response'
          : 'AgentPlace could not complete this request';

  return (
    <div className="flex gap-3" role="status" aria-live="polite">
      <div className="w-6 h-6 rounded bg-primary-dim flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[9px] font-bold text-primary">AP</span>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 text-sm text-text-sub">
          <span>{label}</span>
          {task.status !== 'failed' && <ProcessingDots />}
        </div>

        {isRetry && (
          <p className="text-[11px] text-text-muted mt-1">
            Retry {task.attempts}/{task.maxAttempts}
          </p>
        )}

        {task.status === 'failed' && (
          <div className="mt-1">
            <p className="text-xs text-text-muted leading-relaxed">
              {failureExplanation(task.lastError)}
            </p>
            <p className="font-mono text-[10px] text-text-dim mt-1 break-all">
              Task {task.id}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
