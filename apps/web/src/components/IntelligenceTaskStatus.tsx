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

/** Observes real database-backed task state; never invents an AI response. */
export function IntelligenceTaskStatus({ conversationId }: { conversationId: string }) {
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
        if (!cancelled) { setTask(next); setUnavailable(false); }
      } catch {
        if (!cancelled) setUnavailable(true);
      } finally { running = false; }
    };
    setTask(null);
    setUnavailable(false);
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 3500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [conversationId]);

  if (unavailable) return <div role="status" className="text-xs text-amber-300 mb-2">Cannot check AI task status right now. Your conversation remains saved.</div>;
  if (!task) return null;
  const label = task.status === 'queued'
    ? 'AI task queued'
    : task.status === 'running'
      ? 'AI task working'
      : task.status === 'completed'
        ? 'AI task completed · syncing conversation'
        : 'AI task stopped';
  return (
    <div role="status" aria-live="polite" className="text-xs text-text-muted mb-2">
      <span>{label}</span>
      {task.status === 'queued' && task.attempts > 0 && <span> · retry {task.attempts}/{task.maxAttempts}</span>}
      {task.status === 'failed' && <span> · {failureExplanation(task.lastError)} </span>}
      {(task.status === 'queued' || task.status === 'running' || task.status === 'failed') && <span className="font-mono text-[10px] break-all">· {task.id}</span>}
    </div>
  );
}
