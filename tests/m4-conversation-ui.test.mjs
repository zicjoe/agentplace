import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (file) => readFileSync(file, 'utf8');

test('research Markdown parses tables, headings, sources, and rejects dangerous links', () => {
  const script = `
    import assert from 'node:assert/strict';
    import { parseMarkdown, safeResearchUrl } from './apps/web/src/platform/markdown.ts';
    const text = '## Comparison\\n\\n| Asset | Exposure |\\n| :--- | ---: |\\n| AAVE | **Lending** |\\n\\n## Sources\\n1. [Docs](https://aave.com)';
    const blocks = parseMarkdown(text);
    assert.equal(blocks[0].type, 'heading');
    assert.deepEqual(blocks[1].headers, ['Asset','Exposure']);
    assert.equal(blocks[1].rows[0][1], '**Lending**');
    assert.deepEqual(blocks[1].align, ['left','right']);
    assert.equal(blocks[3].type, 'list');
    assert.equal(blocks[3].items.length, 1);
    assert.equal(safeResearchUrl('javascript:alert(1)'), null);
    assert.equal(safeResearchUrl('data:text/html,<script>alert(1)</script>'), null);
    assert.equal(safeResearchUrl('https://aave.com'), 'https://aave.com/');
    assert.equal(parseMarkdown('<script>alert(1)</script>')[0].text, '<script>alert(1)</script>');
  `;
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning','--experimental-strip-types', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('Manager renders owner-hydrated real Job reference from persisted message.jobId', () => {
  const card = read('apps/web/src/components/JobReference.tsx');
  const chat = read('apps/web/src/components/ChatView.tsx');
  const worker = read('apps/worker/src/index.ts');
  assert.match(card, /state\.jobs\.find\(\(entry\) => entry\.id === jobId\)/);
  assert.match(card, /SET_ACTIVE_JOB/);
  assert.doesNotMatch(card, /ADD_JOB|createDurableJob/);
  assert.match(chat, /msg\.jobId && msg\.role !== 'user'/);
  assert.match(worker, /addAssistantMessage\(task\.ownerUserId, context\.conversationId,[\s\S]*jobId, `msg_job_created_/);
});

test('document scroll cannot be displaced by conversation autoscroll', () => {
  const css = read('apps/web/src/index.css');
  const shell = read('apps/web/src/components/Shell.tsx');
  const scroll = read('apps/web/src/platform/scroll.ts');
  assert.match(css, /height: 100dvh/);
  assert.match(css, /overflow: hidden/);
  assert.match(shell, /min-h-0 min-w-0 overflow-hidden/);
  assert.match(shell, /MainContent key=\{pathForState\(state\)\}/);
  assert.match(scroll, /panel\.scrollTop = panel\.scrollHeight/);
  for (const file of ['ChatView','JobWorkspace','WorkerWorkspace','WorkflowStudio','AgentBuilder']) {
    assert.doesNotMatch(read(`apps/web/src/components/${file}.tsx`), /scrollIntoView/);
  }
});

test('all displayed research and studio content uses safe React rendering', () => {
  const renderer = read('apps/web/src/components/ResearchMarkdown.tsx');
  assert.match(renderer, /safeResearchUrl/);
  assert.match(renderer, /noopener noreferrer/);
  assert.match(renderer, /overflow-x-auto/);
  for (const file of ['ChatView','JobWorkspace','WorkerWorkspace','WorkflowStudio','AgentBuilder','ResearchMarkdown']) {
    assert.doesNotMatch(read(`apps/web/src/components/${file}.tsx`), /dangerouslySetInnerHTML\s*=/);
  }
  assert.match(read('apps/web/src/components/ActivityView.tsx'), /Research complete/);
  assert.match(read('apps/web/src/components/ActivityView.tsx'), /productionActivity \? event\.summary/);
  const job = read('apps/web/src/components/JobWorkspace.tsx');
  assert.match(job, /if \(productionConversation && !durableConversation\) return;/);
  assert.match(job, /id\.startsWith\('msg_job_result_'\)/);
});
