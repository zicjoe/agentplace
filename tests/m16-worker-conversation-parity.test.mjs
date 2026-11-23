import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const workspace = readFileSync('apps/web/src/components/WorkerWorkspace.tsx', 'utf8');
const manager = readFileSync('apps/web/src/components/ChatView.tsx', 'utf8');

function runTypescript(script) {
  const result = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--input-type=module', '-e', script,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('Worker research messages are classified by persisted IDs and their owner-hydrated Job, never by model text', () => {
  runTypescript(`
    import assert from 'node:assert/strict';
    import {workerResearchMessageView} from './apps/web/src/platform/workerResearchPresentation.ts';
    const job={id:'job_1',kind:'research',title:'SOL smart-money research'};
    const msg=(id, role='manager', jobId='job_1')=>({id,role,jobId,content:'This looks like research.'});
    assert.equal(workerResearchMessageView(msg('msg_origin_result_123'),job,false),'report');
    assert.equal(workerResearchMessageView(msg('msg_job_created_123'),job,true),'completed-start');
    assert.equal(workerResearchMessageView(msg('msg_job_created_123'),job,false),'running-start');
    assert.equal(workerResearchMessageView(msg('msg_origin_result_123','user'),job,true),'ordinary');
    assert.equal(workerResearchMessageView(msg('msg_origin_result_123','manager','job_2'),job,true),'ordinary');
    assert.equal(workerResearchMessageView(msg('msg_origin_result_123'),undefined,true),'ordinary');
    assert.equal(workerResearchMessageView(msg('msg_origin_result_123'),{...job,kind:'financial'},true),'ordinary');
    assert.equal(workerResearchMessageView(msg('msg_origin_result_123'),{id:'job_1',title:'Legacy Job without kind'},true),'ordinary');
    assert.equal(workerResearchMessageView(msg('msg_some_other_event'),job,true),'ordinary');
  `);
});

test('Worker origin report removes only a matching echoed Job title, preserving the complete answer', () => {
  runTypescript(`
    import assert from 'node:assert/strict';
    import {workerResearchAnswerBody} from './apps/web/src/platform/workerResearchPresentation.ts';
    const title='Analyze recent smart-money activity around SOL';
    const body='### Bottom line\\n\\nSmart money activity remains unverified.\\n\\n### Coverage\\n| R1 | Partial |';
    assert.equal(workerResearchAnswerBody('**'+title+'**\\n\\n'+body,title),body);
    assert.equal(workerResearchAnswerBody('**A different title**\\n\\n'+body,title),'**A different title**\\n\\n'+body);
    assert.equal(workerResearchAnswerBody('**Bottom line**\\n\\n'+body,title),'**Bottom line**\\n\\n'+body);
    const long='L'.repeat(200);
    assert.equal(workerResearchAnswerBody('**'+long+' extra details**\\n\\n'+body,long),body);
    assert.equal(workerResearchAnswerBody(body,title),body);
  `);
});

test('Lengthy single-heading Worker report renders its conclusion first with all findings preserved in the disclosure', () => {
  runTypescript(`
    import assert from 'node:assert/strict';
    import {conversationResearchLayout} from './apps/web/src/platform/conversationResearchLayout.ts';
    const opening='Smart-money accumulation is not established. The available evidence is incomplete.';
    const detail='- **Wallet activity:** An observed cohort is inconclusive. Provider provenance is available.';
    const report='### Bottom line\\n\\n'+opening+'\\n\\n'+Array.from({length:15},()=>detail).join('\\n')+'\\n\\n### Coverage\\n| R1 | Partial |\\n\\n### Sources\\n1. Example — https://example.org';
    const layout=conversationResearchLayout(report);
    assert.match(layout.takeaway,/not established/);
    assert.doesNotMatch(layout.takeaway,/Wallet activity/);
    assert.match(layout.analysis,/Wallet activity/);
    assert.equal((layout.takeaway+layout.analysis).match(/Wallet activity/g)?.length,15);
    assert.match(layout.coverage,/R1/);
    assert.match(layout.sources,/Example/);
  `);
});

test('Worker conversation reuses the accepted Manager answer-first presentation and suppresses duplicate Job cards', () => {
  assert.match(manager, /<ConversationResearchAnswer/);
  assert.match(workspace, /<ConversationResearchAnswer/);
  assert.match(workspace, /workerResearchMessageView\(msg, linkedJob, completedReportExists\)/);
  assert.match(workspace, /workerResearchAnswerBody\(msg\.content, linkedJob\.title\)/);
  assert.match(workspace, /SET_ACTIVE_JOB', id: linkedJob\.id, tab: 'result'/);
  assert.match(workspace, /researchView === 'completed-start'/);
  assert.match(workspace, /Investigation started · View setup details/);
  assert.match(workspace, /researchView === 'running-start'/);
  assert.match(workspace, /<JobReference jobId=\{msg\.jobId\}/);
  assert.match(workspace, /researchView === 'report'/);
  assert.match(workspace, /researchView === 'running-start'[\s\S]*?: \(\s*<>\s*<ResearchMarkdown text=\{msg\.content\} \/>/);
  assert.match(workspace, /<InlineRoutinePreviewCard/);
  assert.doesNotMatch(workspace, /setTimeout\(.*ConversationResearchAnswer/);
});

test('Worker response stays on the original durable conversation, with no extra research request for display', () => {
  assert.match(workspace, /displayMessages = productionConversation \? durableMessages : messages/);
  assert.match(workspace, /if \(productionConversation && !durableConversation\) return/);
  assert.match(workspace, /submitIntelligence\(durableConversation\.id, userMessage, modelSelection\)/);
  assert.match(workspace, /<IntelligenceTaskStatus/);
  const answer = readFileSync('apps/web/src/components/ConversationResearchAnswer.tsx','utf8');
  assert.match(answer, /conversationResearchLayout\(text\)/);
  assert.match(answer, /Read full analysis/);
  assert.match(answer, /Verification coverage/);
  assert.match(answer, /Sources and references/);
});
