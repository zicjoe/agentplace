import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const fixture = readFileSync('apps/web/src/fixtures/FixtureAppContext.tsx', 'utf8');
const discover = readFileSync('apps/web/src/components/DiscoverDetail.tsx', 'utf8');
const workspace = readFileSync('apps/web/src/components/WorkerWorkspace.tsx', 'utf8');
const builder = readFileSync('apps/web/src/components/AgentBuilder.tsx', 'utf8');

test('M16 first-task suggestions are relevant, draft-only and read-only', () => {
  const result = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning',
    '--experimental-strip-types',
    '--input-type=module',
    '-e', `import {suggestedWorkerTasks} from './apps/web/src/platform/workerStarterTasks.ts';
      import assert from 'node:assert/strict';
      for(const id of ['w-memescout','w-smartmoney','w-portfolio','w-stablecoin','w-defi','w-perps','w-researcher','w-execution','w-agent-builder','custom-private']){
        const tasks=suggestedWorkerTasks(id);
        assert.equal(tasks.length,2);
        for(const task of tasks){assert.ok(task.length>30);assert.ok(task.length<280);}
      }
      assert.match(suggestedWorkerTasks('w-smartmoney')[0],/smart-money/i);
      assert.match(suggestedWorkerTasks('w-portfolio')[0],/portfolio/i);
      assert.match(suggestedWorkerTasks('w-perps')[0],/Do not place orders/i);
      assert.match(suggestedWorkerTasks('custom-private')[0],/read-only/i);
      assert.notDeepEqual(suggestedWorkerTasks('w-portfolio'),suggestedWorkerTasks('w-memescout'));
    `,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(workspace, /setInput\(prompt\)/);
  assert.doesNotMatch(workspace, /onClick=\{\(\) => \{\s*sendMessage\(prompt\)/);
});

test('M16 installation is a real backend write and cannot be doubled by the state facade', () => {
  assert.match(discover, /await installDurableWorker\(installedWorkerId\)/);
  assert.match(discover, /ADD_WORKER', worker, persisted: true/);
  assert.match(builder, /ADD_WORKER', worker, persisted: true/);
  assert.match(builder, /Give work →/);
  assert.match(builder, /giveCreatedWorkerWork/);
  assert.match(fixture, /action\.type === 'ADD_WORKER' && action\.worker\.isOriginal && !action\.persisted/);
  assert.doesNotMatch(discover, /ADD_AUTHORITY_GRANT|ADD_MANDATE/);
  assert.match(discover, /const installed=await finalAdd\(\)/);
  assert.match(discover, /if\(!installed\)throw new Error/);
});

test('M16 Discover takes user directly from installed Worker to real first-task conversation', () => {
  assert.match(discover, /Give \{item\.name\} work/);
  assert.match(discover, /Give work/);
  assert.match(discover, /openInstalledWorker/);
  assert.match(discover, /UPSERT_PERSISTED_CONVERSATION/);
  assert.match(fixture, /case 'UPSERT_PERSISTED_CONVERSATION'/);
  assert.match(fixture, /activeView: action.id \? 'workers' : state.activeView/);
  assert.match(fixture, /activeDiscoverItemId: null,[\s\S]*activeCreatorSurface: null/);
});

test('M16 production Worker cannot silently enter prototype chat when durable conversation is missing', () => {
  assert.match(workspace, /if \(productionConversation && !durableConversation\) return/);
  assert.match(workspace, /fetchConversations\(\)/);
  assert.match(workspace, /scope === 'worker' && entry\.workerId === installedWorker\.id/);
  assert.match(workspace, /Opening your secure Worker conversation/);
  assert.match(workspace, /Retry/);
  assert.match(workspace, /disabled=\{productionConversation && !durableConversation\}/);
  assert.match(workspace, /disabled=\{!input\.trim\(\) \|\| isStreaming \|\| \(productionConversation && !durableConversation\)\}/);
});

test('M16 does not change authority, execution, scheduler or commercial backend', () => {
  const docs = readFileSync('docs/MILESTONE-16-WORKER-FIRST-TASK.md', 'utf8');
  for(const statement of ['No Mainnet execution', 'No automated first task submission', 'No additional financial authority', 'No new migration', 'Scheduler unchanged']) {
    assert.ok(docs.includes(statement), `Missing safety boundary: ${statement}`);
  }
  for(const file of ['.env.example','config/environments/production-mainnet.env.example']) {
    const env=readFileSync(file,'utf8');
    assert.match(env,/MAINNET_EXECUTION_ENABLED=false/);
    assert.match(env,/MAINNET_AUTONOMY_ENABLED=false/);
  }
});
