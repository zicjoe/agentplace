import { useEffect, useState } from 'react';
import { useAppState } from '../state/AppContext';
import { WEB_RUNTIME_SETTINGS } from '../platform/runtime';
import { decideServiceCostReview, fetchServiceCostReviews, type ServiceCostReviewSnapshot } from '../platform/serviceCostApi';

function usd(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : `$${value}`;
}

export function ServiceCostReviewPanel({ jobId }: { jobId: string }) {
  const state = useAppState();
  const [reviews, setReviews] = useState<ServiceCostReviewSnapshot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    if (WEB_RUNTIME_SETTINGS.dataMode !== 'api' || !state.user) return;
    try {
      setReviews(await fetchServiceCostReviews(jobId));
      setError(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Service Cost Review could not be loaded.');
    }
  }

  useEffect(() => {
    if (WEB_RUNTIME_SETTINGS.dataMode !== 'api' || !state.user) {
      setReviews([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchServiceCostReviews(jobId);
        if (!cancelled) { setReviews(next); setError(null); }
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : 'Service Cost Review could not be loaded.');
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 8_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [jobId, state.user]);

  async function decide(review: ServiceCostReviewSnapshot, decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    setBusy(review.id);
    try {
      const updated = await decideServiceCostReview(review.id, decision);
      setReviews((current) => current.map((item) => item.id === updated.id ? updated : item));
      setError(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Service Cost Review could not be updated.');
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (WEB_RUNTIME_SETTINGS.dataMode !== 'api' || !state.user || (reviews.length === 0 && !error)) return null;
  const pending = reviews.filter((review) => review.status === 'PENDING');
  const historical = reviews.filter((review) => review.status !== 'PENDING').slice(0, 3);

  return (
    <section aria-labelledby={`service-cost-${jobId}`} className="mt-4 rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p id={`service-cost-${jobId}`} className="font-semibold text-text">Service Cost Review</p>
          <p className="text-text-muted mt-1">This approves AgentPlace/external service spend only. It does not approve a crypto transaction, grant wallet authority, or move your capital.</p>
        </div>
        <button onClick={() => void refresh()} className="shrink-0 px-2.5 py-1.5 rounded border border-border text-text-sub hover:text-text">Refresh</button>
      </div>
      {error && <p role="alert" className="mt-3 text-danger">{error}</p>}
      <div className="mt-3 space-y-3">
        {pending.map((review) => (
          <div key={review.id} className="rounded border border-border bg-panel/60 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-text">{review.provider} · {usd(review.amountUsd)}</p>
                <p className="text-text-sub mt-1">{review.serviceDescription}</p>
                {review.thresholdUsd && <p className="text-text-muted mt-1">Your single-Job confirmation threshold is {usd(review.thresholdUsd)}.</p>}
              </div>
              <span className="font-mono text-[10px] uppercase text-warn">Needs you</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy === review.id} onClick={() => void decide(review, 'APPROVED')} className="px-3 py-1.5 rounded bg-primary text-white font-medium disabled:opacity-50">Approve service spend</button>
              <button disabled={busy === review.id} onClick={() => void decide(review, 'REJECTED')} className="px-3 py-1.5 rounded border border-border text-text-sub hover:text-text disabled:opacity-50">Reject</button>
            </div>
            <p className="text-[10px] text-text-dim mt-2">Approval applies to this reviewed service cost for this Job. If the Worker already fell back or paused, retry the request to use the approved provider.</p>
          </div>
        ))}
        {historical.map((review) => (
          <div key={review.id} className="flex flex-wrap justify-between gap-2 border-t border-border/70 pt-2 text-text-muted">
            <span>{review.provider} · {usd(review.amountUsd)} · {review.serviceDescription}</span>
            <span className="font-mono text-[10px] uppercase">{review.status}</span>
          </div>
        ))}
        {pending.length === 0 && historical.length > 0 && <p className="text-text-muted">No service-cost decision is currently waiting for you.</p>}
      </div>
    </section>
  );
}
