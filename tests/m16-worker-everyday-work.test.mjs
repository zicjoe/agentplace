import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const view = readFileSync('apps/web/src/components/WorkersView.tsx', 'utf8');
const work = readFileSync('apps/web/src/components/WorkerWorkspace.tsx', 'utf8');
const route = readFileSync('apps/web/src/platform/routing.ts', 'utf8');
const model = readFileSync('apps/web/src/platform/workerEverydayWork.ts', 'utf8');

function assertModel(script) {
  const result = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import {summarizeWorker,jobsForWorker,matchesWorkerFilter,workerSummarySort} from './apps/web/src/platform/workerEverydayWork.ts';
      const worker=(id,status='standby')=>({id,name:id,tagline:'Read-only specialist',status,isOriginal:false});
      const job=(id,status,leadWorkerId,updatedAt,extra={})=>({id,title:'Job '+id,goal:'Test',status,leadWorkerId,leadWorkerName:leadWorkerId,
        supportingWorkerIds:[],supportingWorkerNames:[],currentStage:'',stages:[],createdAt:new Date(updatedAt),updatedAt:new Date(updatedAt),...extra});
      const conv=(id,workerId,messages)=>({id,scope:'worker',workerId,jobId:undefined,title:id,manuallyRenamed:false,
        messages,pinned:false,archived:false,createdAt:new Date('2026-11-23T10:00:00Z'),updatedAt:new Date('2026-11-23T11:00:00Z')});
      ${script}
    `], { encoding:'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('M16-2A derives honest Worker statuses from owner-scoped durable Jobs and Worker controls', () => {
  assertModel(`
    const jobs=[job('done','completed','a','2026-11-23T12:00:00Z'),job('approval','needs-approval','a','2026-11-22T12:00:00Z'),
      job('run','working','b','2026-11-24T12:00:00Z')];
    const a=summarizeWorker(worker('a'),jobs,[]);
    assert.equal(a.status,'needs-you'); assert.equal(a.attentionJob.id,'approval'); assert.equal(a.recentJob.id,'done');
    assert.equal(summarizeWorker(worker('b'),jobs,[]).status,'working');
    assert.equal(summarizeWorker(worker('c','paused'),jobs,[]).status,'paused');
    assert.equal(summarizeWorker(worker('c','monitoring'),jobs,[]).status,'monitoring');
    assert.equal(summarizeWorker(worker('c','limited'),jobs,[]).status,'needs-you');
    assert.equal(summarizeWorker(worker('c','standby'),jobs,[]).status,'standing-by');
    assert.equal(summarizeWorker(worker('a','paused'),jobs,[]).status,'paused');
    assert.ok(matchesWorkerFilter(a,'needs-you'));assert.ok(!matchesWorkerFilter(a,'working'));
    assert.ok(matchesWorkerFilter(a,'all'));
  `);
});

test('M16-2A continues only the matching Worker conversation, never unrelated Manager or Job scope', () => {
  assertModel(`
    const conversations=[conv('manager','a',[{id:'m'}]),conv('job','a',[{id:'j'}]),conv('for-b','b',[{id:'b'}]),conv('for-a','a',[])];
    conversations[0].scope='manager';conversations[1].scope='job';
    assert.equal(summarizeWorker(worker('a'),[],conversations).conversation.id,'for-a');
    assert.equal(summarizeWorker(worker('a'),[],conversations).canContinue,false);
    conversations[3].messages=[{id:'msg1'}];
    assert.equal(summarizeWorker(worker('a'),[],conversations).canContinue,true);
    assert.equal(summarizeWorker(worker('x'),[],conversations).canContinue,false);
  `);
});

test('M16-2A separates supporting contributions from Worker-owned approval requirements', () => {
  assertModel(`
    const jobs=[job('shared','needs-approval','a','2026-11-24T12:00:00Z',{supportingWorkerIds:['b']}),
      job('old','completed','b','2026-11-22T12:00:00Z')];
    assert.deepEqual(jobsForWorker(jobs,'b').map(j=>j.id),['shared','old']);
    const b=summarizeWorker(worker('b'),jobs,[]);
    assert.equal(b.status,'standing-by');
    assert.equal(b.attentionJob,undefined);
    assert.equal(b.recentJob.id,'shared');
  `);
});

test('M16-2A maintains independent filters, stable ordering and no invented activity', () => {
  assertModel(`
    const a=summarizeWorker(worker('A','standby'),[],[]);
    const b=summarizeWorker(worker('B','paused'),[],[]);
    const c=summarizeWorker(worker('C','working'),[],[]);
    const sorted=[a,b,c].sort(workerSummarySort);
    assert.deepEqual(sorted.map(x=>x.worker.id),['C','A','B']);
    assert.equal(a.recentJob,undefined);assert.equal(a.lastActivityAt,undefined);
  `);
});

test('M16-2A uses existing Worker/Job routes, not new conversations or financial permissions', () => {
  assert.match(view,/My Workers/);
  assert.match(view,/Continue work/);
  assert.match(view,/Give work/);
  assert.match(view,/SET_ACTIVE_WORKER/);
  assert.match(view,/SET_ACTIVE_JOB/);
  assert.match(view,/View progress/);
  assert.match(view,/aria-pressed=\{filter === id\}/);
  assert.match(view,/Work history/);
  assert.match(view,/Created by you/);
  assert.match(view,/state\.creatorAssets\.some/);
  assert.match(view,/Worker update available/);
  assert.match(view,/No Workers in this view/);
  assert.match(work,/const durableConversation = installedWorker \? state\.conversations\.find\(\(c\) => c\.scope === 'worker' && c\.workerId === installedWorker\.id\)/);
  assert.match(route,/if \(state\.activeWorkerId\) return `\/workers\/\$\{encoded\(state\.activeWorkerId\)\}`/);
  assert.doesNotMatch(view,/ADD_AUTHORITY_GRANT|ADD_MANDATE|createDurableJob|submitIntelligence|UPDATE_WORKER/);
  assert.doesNotMatch(model,/fetch\(|Date\.now\(/);
});
