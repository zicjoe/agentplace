const KEY = 'agentplace.m2.identity-resume.v1';

export interface IdentityResumeMarker {
  path: string;
  conversationId: string | null;
  persistOriginatingConversation: boolean;
  createdAt: string;
}

export function rememberIdentityResume(input: Omit<IdentityResumeMarker, 'createdAt'>): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(KEY, JSON.stringify({ ...input, createdAt: new Date().toISOString() }));
}

export function readIdentityResume(): IdentityResumeMarker | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdentityResumeMarker;
    if (!parsed.path || !parsed.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearIdentityResume(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(KEY);
}
