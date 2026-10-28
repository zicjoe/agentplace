import { WEB_RUNTIME_SETTINGS } from './runtime';

export interface ServiceCostReviewSnapshot {
  id: string;
  provider: string;
  serviceDescription: string;
  amountUsd: string;
  thresholdUsd?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  expiresAt?: string;
  createdAt: string;
  decidedAt?: string;
  workerId?: string;
  jobId?: string;
}

function endpoint(path: string): string { return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`; }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    credentials: 'include',
    headers: { accept: 'application/json', 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => null) as ({ message?: string } & T) | null;
  if (!response.ok) throw new Error(payload?.message || `AgentPlace service-cost request failed (${response.status})`);
  return payload as T;
}

export async function fetchServiceCostReviews(jobId?: string): Promise<ServiceCostReviewSnapshot[]> {
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  return (await request<{ reviews: ServiceCostReviewSnapshot[] }>(`/api/v1/service-cost-reviews${query}`)).reviews;
}

export async function decideServiceCostReview(id: string, decision: 'APPROVED' | 'REJECTED'): Promise<ServiceCostReviewSnapshot> {
  return (await request<{ review: ServiceCostReviewSnapshot }>(`/api/v1/service-cost-reviews/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })).review;
}
