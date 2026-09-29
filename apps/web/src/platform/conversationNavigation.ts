import type { Conversation, Job } from '../state/types';

// Job conversations remain durable and searchable, but they belong to their Job
// Workspace. They must not look like a second, independent Manager conversation.
export function isJobConversation(conversation: Conversation): boolean {
  return conversation.scope === 'job' || (!conversation.scope && !!conversation.jobId);
}

export function primaryConversationHistory(conversations: readonly Conversation[]): Conversation[] {
  return conversations.filter((conversation) => !isJobConversation(conversation));
}

export function conversationTitleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (!clean) return 'New conversation';
  const firstSentence = (clean.split(/(?<=[.!?])\s+/)[0] ?? clean).replace(/[.!?]+$/, '').trim();
  const title = firstSentence || clean;
  return title.length > 72 ? `${title.slice(0, 69).trimEnd()}…` : title;
}

// Older Manager conversations were persisted with the generic title. Resolve a
// display title from the authoritative Job link (or original user request)
// without rewriting historical messages or overriding user-assigned titles.
export function conversationHistoryTitle(
  conversation: Conversation,
  jobs: readonly Pick<Job, 'id' | 'title' | 'originConversationId'>[],
): string {
  if (conversation.manuallyRenamed || conversation.title.trim().toLowerCase() !== 'new conversation') {
    return conversation.title;
  }
  const originalRequest = conversation.messages.find((message) => message.role === 'user')?.content;
  if (originalRequest?.trim()) return conversationTitleFromPrompt(originalRequest);
  const linked = jobs.find((job) => job.originConversationId === conversation.id)
    ?? jobs.find((job) => conversation.messages.some((message) => message.jobId === job.id));
  return linked?.title || 'New conversation';
}
