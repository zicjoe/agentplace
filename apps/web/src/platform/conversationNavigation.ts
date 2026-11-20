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
  // A request to assemble specialist Workers should have a topic-first title.
  // This is a display/navigation convenience, not a change to the stored request.
  if (/^use\s+/i.test(clean)) {
    const investigated = clean.match(/\b(?:investigate|research|analy[sz]e)\s+(?:the\s+)?(?:token\s+)?(\$?[A-Z][A-Z0-9]{1,9})\b/);
    if (investigated) {
      const asset = investigated[1]!.replace(/^\$/, '');
      const chain = clean.match(/\bon\s+(Solana|Arbitrum|Base|Ethereum|BNB Chain)\b/i)?.[1];
      return chain ? `${asset} · ${chain} investigation` : `${asset} investigation`;
    }
  }
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
  if (conversation.manuallyRenamed) return conversation.title;
  const originalRequest = conversation.messages.find((message) => message.role === 'user')?.content;
  // Older auto-titled specialist requests were saved as a truncated copy of
  // their long prompt. Show the shorter topic-first title without mutating
  // the database or overriding a manually chosen title.
  if (/^use\s+/i.test(conversation.title) && originalRequest?.trim()) {
    const suggested = conversationTitleFromPrompt(originalRequest);
    if (/ investigation$/.test(suggested)) return suggested;
  }
  if (conversation.title.trim().toLowerCase() !== 'new conversation') return conversation.title;
  if (originalRequest?.trim()) return conversationTitleFromPrompt(originalRequest);
  const linked = jobs.find((job) => job.originConversationId === conversation.id)
    ?? jobs.find((job) => conversation.messages.some((message) => message.jobId === job.id));
  return linked?.title || 'New conversation';
}
