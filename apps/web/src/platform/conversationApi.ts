import { WEB_RUNTIME_SETTINGS } from './runtime';
import type { ChatMessage, Conversation } from '../state/types';

interface ApiMessage {
  id: string;
  role: ChatMessage['role'];
  specialist?: ChatMessage['specialist'];
  content: string;
  uiCard?: string;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiConversation {
  id: string;
  scope: 'manager' | 'worker' | 'job';
  workerId?: string;
  jobId?: string;
  title: string;
  titleSource: 'auto' | 'user';
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  messages: ApiMessage[];
}

function endpoint(path: string): string {
  return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || `AgentPlace API request failed (${response.status})`);
  }
  return await response.json() as T;
}

function apiMessage(message: ChatMessage): ApiMessage {
  const out: ApiMessage = {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.timestamp.toISOString(),
    updatedAt: message.timestamp.toISOString(),
  };
  if (message.specialist) out.specialist = message.specialist;
  if (message.uiCard) out.uiCard = message.uiCard;
  if (message.jobId) out.jobId = message.jobId;
  return out;
}

function apiConversation(conversation: Conversation): ApiConversation {
  const scope = conversation.scope ?? (conversation.jobId ? 'job' : conversation.workerId ? 'worker' : 'manager');
  const out: ApiConversation = {
    id: conversation.id,
    scope,
    title: conversation.title,
    titleSource: conversation.manuallyRenamed ? 'user' : 'auto',
    pinned: conversation.pinned,
    archived: conversation.archived,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastActivityAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map(apiMessage),
  };
  if (conversation.workerId) out.workerId = conversation.workerId;
  if (conversation.jobId) out.jobId = conversation.jobId;
  return out;
}

function fromApi(value: ApiConversation): Conversation {
  return {
    id: value.id,
    scope: value.scope,
    workerId: value.workerId,
    jobId: value.jobId,
    title: value.title,
    manuallyRenamed: value.titleSource === 'user',
    pinned: value.pinned,
    archived: value.archived,
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
    messages: value.messages.map((message) => ({
      id: message.id,
      role: message.role,
      specialist: message.specialist,
      content: message.content,
      timestamp: new Date(message.createdAt),
      uiCard: message.uiCard as ChatMessage['uiCard'],
      jobId: message.jobId,
    })),
  };
}

export async function fetchConversations(query?: string): Promise<Conversation[]> {
  const suffix = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const data = await request<{ conversations: ApiConversation[] }>(`/api/v1/conversations${suffix}`);
  return data.conversations.map(fromApi);
}

export async function importGuestConversations(conversations: Conversation[]): Promise<Conversation[]> {
  const data = await request<{ conversations: ApiConversation[] }>('/api/v1/conversations/import', {
    method: 'POST',
    body: JSON.stringify({ conversations: conversations.map(apiConversation) }),
  });
  return data.conversations.map(fromApi);
}

export async function createDurableConversation(conversation: Conversation): Promise<void> {
  await request('/api/v1/conversations', { method: 'POST', body: JSON.stringify({ conversation: apiConversation(conversation) }) });
}

export async function addDurableMessage(conversationId: string, message: ChatMessage): Promise<void> {
  await request(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST', body: JSON.stringify({ message: apiMessage(message) }),
  });
}

export async function updateDurableMessage(conversationId: string, message: ChatMessage): Promise<void> {
  await request(`/api/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(message.id)}`, {
    method: 'PATCH', body: JSON.stringify({ content: message.content, updatedAt: new Date().toISOString() }),
  });
}

export async function patchDurableConversation(
  conversationId: string,
  patch: { title?: string; titleSource?: 'auto' | 'user'; pinned?: boolean; archived?: boolean },
): Promise<void> {
  await request(`/api/v1/conversations/${encodeURIComponent(conversationId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}
