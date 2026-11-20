import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (file) => readFileSync(file, 'utf8');

test('Manager conversation renders the saved research answer directly, without a second-click gate', () => {
  const chat = read('apps/web/src/components/ChatView.tsx');
  const answer = read('apps/web/src/components/ConversationResearchAnswer.tsx');
  assert.match(chat, /msg_origin_result_/);
  assert.match(chat, /<ConversationResearchAnswer/);
  assert.match(answer, /<ResearchMarkdown text=\{text\}/);
  assert.doesNotMatch(answer, /Read inline|Collapse report|useState/);
  assert.match(answer, /View work and evidence/);
  assert.match(chat, /SET_ACTIVE_JOB', id: linkedJob\.id, tab: 'result'/);
  assert.match(chat, /msg_job_created_/);
  assert.match(chat, /<details/);
  assert.match(chat, /Show full request/);
  const job = read('apps/web/src/components/JobWorkspace.tsx');
  assert.match(job, /<ConversationResearchAnswer/);
  assert.match(chat, /<MessageBubble msg=\{msg\}/);
  assert.doesNotMatch(chat, /<ResearchResultCard/);
});

test('Job reference is compact, reports persisted status, and never repeats the complete original goal', () => {
  const ref = read('apps/web/src/components/JobReference.tsx');
  assert.match(ref, /state\.jobs\.find\(\(entry\) => entry\.id === jobId\)/);
  assert.match(ref, /\{status\}/);
  assert.match(ref, /View work/);
  assert.doesNotMatch(ref, /\{job\.goal\}/);
  assert.doesNotMatch(ref, /ADD_JOB|createDurableJob/);
});

test('Composer starts compact, grows with text, and keeps Enter/Shift+Enter semantics', () => {
  const chat = read('apps/web/src/components/ChatView.tsx');
  assert.match(chat, /rows=\{1\}/);
  assert.match(chat, /Math\.min\(textarea\.scrollHeight, 180\)/);
  assert.match(chat, /aria-label="Message AgentPlace"/);
  assert.match(chat, /aria-label="Send message"/);
  assert.match(chat, /e\.key === 'Enter' && !e\.shiftKey/);
  assert.match(chat, /<ModelSelector/);
  assert.match(chat, /showActionReview && actionReviewId/);
  assert.match(chat, /<DurableActionReviewCard/);
});

test('Navigation shortens auto specialist titles and always protects manual renames', () => {
  const script = `
    import assert from 'node:assert/strict';
    import { conversationTitleFromPrompt, conversationHistoryTitle } from './apps/web/src/platform/conversationNavigation.ts';
    const prompt='Use Crypto Researcher and Smart Money Scout to investigate BONK on Solana. Check markets.';
    assert.equal(conversationTitleFromPrompt(prompt), 'BONK · Solana investigation');
    assert.equal(conversationTitleFromPrompt('Research GMX on Arbitrum. Compare.'), 'Research GMX on Arbitrum');
    const old={ title:'Use Crypto Researcher and Smart Money Scout to investigate...', manuallyRenamed:false, messages:[{role:'user',content:prompt}] };
    assert.equal(conversationHistoryTitle(old, []), 'BONK · Solana investigation');
    assert.equal(conversationHistoryTitle({...old,title:'My BONK thesis',manuallyRenamed:true}, []), 'My BONK thesis');
  `;
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
