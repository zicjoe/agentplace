import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = 'apps/web/src/';
const read = (name) => readFileSync(`${root}${name}`, 'utf8');
const workerControls = read('components/WorkerLifecycleControls.tsx');
const sidebar = read('components/WorkerWorkspace.tsx');
const hub = read('components/WorkersView.tsx');
const home = read('components/GuestHome.tsx');
const discover = read('components/Discover.tsx');
const detail = read('components/DiscoverDetail.tsx');
const model = read('platform/workerEverydayWork.ts');
const lifecycle = read('platform/workerLifecycle.ts');

function evaluate(script) {
  const result = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--input-type=module', '-e',
    `import assert from 'node:assert/strict';
     import {workerLifecycleDependencies,workerLifecycleConfirmation} from './apps/web/src/platform/workerLifecycle.ts';
     import {summarizeWorker,matchesWorkerFilter} from './apps/web/src/platform/workerEverydayWork.ts';
     const worker=(id,status='standby')=>({id,name:id,tagline:'Read only',status,isOriginal:false});
     const job=(id,status,leadWorkerId,more={})=>({id,title:id,goal:'test',status,leadWorkerId,leadWorkerName:leadWorkerId,
       supportingWorkerIds:[],supportingWorkerNames:[],currentStage:'',stages:[],createdAt:new Date(),updatedAt:new Date(),...more});
     ${script}`,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('M16-2B counts only owned active Jobs, live routines and independent grants before lifecycle changes', () => {
  evaluate(`
    const jobs=[job('owned','working','a'),job('support','working','b',{supportingWorkerIds:['a']}),job('done','completed','a')];
    const routines=[{workerId:'a',status:'active'},{workerId:'a',status:'paused'},{workerId:'b',status:'active'}];
    const grants=[{workerId:'a',status:'active'},{workerId:'a',status:'revoked'},{workerId:'b',status:'active'}];
    const result=workerLifecycleDependencies('a',jobs,routines,grants);
    assert.deepEqual(result,{activeJobs:1,liveRoutines:1,independentGrants:1});
  `);
});

test('M16-2B safety confirmations never promise revocation, cancellation or reversal', () => {
  evaluate(`
    const counts={activeJobs:2,liveRoutines:1,independentGrants:3};
    const remove=workerLifecycleConfirmation(worker('Scout'),'remove',counts);
    const pause=workerLifecycleConfirmation(worker('Scout'),'pause',counts);
    assert.match(remove,/conversation history will be kept|saved Job and conversation history/i);
    for(const msg of [remove,pause]){
      assert.match(msg,/grant/);assert.match(msg,/routine/);assert.match(msg,/submitted transactions/);
      assert.match(msg,/revok/);assert.match(msg,/separat/);
    }
  `);
});

test('M16-2B a paused Worker with an owned approval remains discoverable in both Paused and Needs you', () => {
  evaluate(`
    const jobs=[job('approval','needs-approval','a')];
    const a=summarizeWorker(worker('a','paused'),jobs,[]);
    const b=summarizeWorker(worker('b','paused'),jobs,[]);
    assert.equal(a.status,'paused');assert.equal(a.needsAction,true);
    assert.equal(b.needsAction,false);
    assert.equal(matchesWorkerFilter(a,'needs-you'),true);
    assert.equal(matchesWorkerFilter(a,'paused'),true);
    assert.equal(matchesWorkerFilter(b,'needs-you'),false);
    const supporting=summarizeWorker(worker('c'),[job('approval','needs-approval','a',{supportingWorkerIds:['c']})],[]);
    assert.equal(supporting.needsAction,false);
  `);
});

test('M16-2B reuses a single durable lifecycle control path from My Workers and Worker workspace', () => {
  assert.match(hub, /<WorkerLifecycleControls worker=\{worker\}/);
  assert.match(sidebar, /<WorkerLifecycleControls worker=\{worker\}/);
  assert.match(workerControls, /updateDurableWorkerStatus\(worker\.id, target\)/);
  assert.match(workerControls, /await fetchWorkState\(\)/);
  assert.match(workerControls, /SET_WORKERS/);
  assert.match(workerControls, /SET_JOBS/);
  assert.match(workerControls, /SET_ACTIVITY_EVENTS/);
  assert.match(workerControls, /accountId\.current !== requestedBy/);
  assert.match(workerControls, /window\.confirm/);
  assert.doesNotMatch(sidebar, /async function changeWorkerStatus/);
  assert.doesNotMatch(hub, /updateDurableWorkerStatus|submitIntelligence|ADD_AUTHORITY_GRANT/);
});

test('M16-2B Home, Discover and My Workers use the same installed Worker and Job-derived state', () => {
  assert.match(home,/summarizeWorker\(worker, state\.jobs, state\.conversations\)/);
  assert.match(home,/summary\.needsAction/);
  assert.match(home,/summary\.attentionJob\.id/);
  assert.match(home,/WorkforceRow key=\{summary\.worker\.id\}/);
  assert.match(discover,/summarizeWorker\(installedWorker, state\.jobs, state\.conversations\)/);
  assert.match(discover,/installedSummary\.status/);
  assert.match(detail,/installedWorker\?\.status === 'paused'/);
  assert.match(hub,/summaries\.filter\(\(summary\) => summary\.needsAction\)/);
  assert.match(model,/needsAction: needsAttention/);
});

test('M16-2B retains financial, routine, installation and Scheduler boundaries', () => {
  assert.match(lifecycle,/do not revoke independent permissions/);
  assert.match(workerControls,/routines/);
  assert.doesNotMatch(workerControls, /createDurableJob|createRoutineFromText|setDurableMandateStatus|submitIntelligence|ADD_AUTHORITY_GRANT|executeFinancial/);
  assert.doesNotMatch(hub,/createDurableJob|ADD_AUTHORITY_GRANT/);
});
