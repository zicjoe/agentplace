import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const builder = readFileSync('apps/web/src/components/AgentBuilder.tsx', 'utf8');
const start = readFileSync('apps/web/src/components/WorkerCreateStart.tsx', 'utf8');
const home = readFileSync('apps/web/src/components/GuestHome.tsx', 'utf8');
const workers = readFileSync('apps/web/src/components/WorkersView.tsx', 'utf8');
const menu = readFileSync('apps/web/src/components/CreateMenu.tsx', 'utf8');
const api = readFileSync('apps/web/src/platform/creatorApi.ts', 'utf8');

function evaluate(source) {
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--input-type=module', '-e', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('M17 quick-start templates have varied research briefs and do not imply financial authority', () => {
  evaluate(`import {WORKER_CREATION_STARTERS,workerCreationBrief} from './apps/web/src/platform/workerCreationStart.ts';
    import assert from 'node:assert/strict';
    assert.ok(WORKER_CREATION_STARTERS.length >= 6);
    assert.equal(new Set(WORKER_CREATION_STARTERS.map(item=>item.id)).size,WORKER_CREATION_STARTERS.length);
    for (const item of WORKER_CREATION_STARTERS) {
      assert.ok(item.brief.length > 90);
      assert.match(item.brief,/read-only/i);
      const built=workerCreationBrief({path:'template',goal:item.brief});
      assert.ok(built && built.includes(item.brief));
      assert.match(built,/No wallet signing, trading, financial permissions, automatic task submission or publication/);
    }
    assert.ok(WORKER_CREATION_STARTERS.some(item=>/prediction/i.test(item.name)));
    assert.ok(WORKER_CREATION_STARTERS.some(item=>/general/i.test(item.category)));
    assert.notDeepEqual(WORKER_CREATION_STARTERS[0].brief,WORKER_CREATION_STARTERS[1].brief);
  `);
});

test('M17 describe and expertise start as private proposals with bounded input', () => {
  evaluate(`import {workerCreationBrief} from './apps/web/src/platform/workerCreationStart.ts';
    import assert from 'node:assert/strict';
    const goal='Research governance proposals and provide a concise evidence-based briefing.';
    assert.equal(workerCreationBrief({path:'describe',goal:'   '}),null);
    assert.equal(workerCreationBrief({path:'expertise',goal:'brief'}),null);
    assert.equal(workerCreationBrief({path:'describe',goal:'a'.repeat(3001)}),null);
    assert.equal(workerCreationBrief({path:'expertise',goal,method:'x'.repeat(701)}),null);
    const normal=workerCreationBrief({path:'describe',goal});
    assert.match(normal,/private Worker draft/);
    assert.match(normal,/Job Contract/);
    assert.match(normal,/No wallet signing/);
    const method=workerCreationBrief({path:'expertise',goal,method:'Prioritize primary documents, then cross-check third parties.'});
    assert.match(method,/My initial decision rules or expertise/);
    assert.match(method,/Prioritize primary documents/);
    const teach=workerCreationBrief({path:'expertise',goal});
    assert.match(teach,/Teach Mode/);
  `);
});

test('M17 creator kickoff does not auto-start AI tasks or create fake Worker installations', () => {
  assert.ok(existsSync('apps/web/src/components/WorkerCreateStart.tsx'));
  for (const label of ['Describe a job','Start with a template','Teach my expertise','Build my draft','Private draft first']) {
    assert.ok(start.includes(label), `Missing creation control: ${label}`);
  }
  assert.match(start,/onSubmit=\{\(event(?:: FormEvent<HTMLFormElement>)?\) => \{ event.preventDefault\(\); if \(brief && !disabled\) onStart\(brief\); \}\}/);
  assert.match(start,/WORKER_CREATION_STARTERS\.map/);
  assert.match(start,/aria-pressed=\{path === choice\.id\}/);
  assert.match(start,/onClick=\{\(\) => chooseTemplate\(starter\.id\)\}/);
  assert.doesNotMatch(start, /createCreatorWorker|testCreatorWorker|publishCreatorAsset|installDurableWorker|ADD_MANDATE|ADD_AUTHORITY_GRANT|submitIntelligence/);
  assert.match(start,/do not paste passwords, private keys or API secrets/);
});

test('M17 new Worker brief goes through existing durable Creator validator, not a parallel data store', () => {
  assert.match(builder,/WorkerCreateStart onStart=\{submitBuilderBrief\}/);
  assert.match(builder,/messages\.length === 0 && !savedAssetId/);
  assert.match(builder,/submitBuilderBrief\(input\)/);
  assert.match(builder,/ensureSavedWorker\(baseDraft\)/);
  assert.match(builder,/interpretCreatorBuilderTurn\(assetId/);
  assert.match(builder,/fetchCreatorBuilderSession/);
  assert.match(builder,/saveCreatorBuilderSession/);
  assert.match(builder,/createCreatorWorkerVersion/);
  assert.match(builder,/testCreatorWorker/);
  assert.match(builder,/publishCreatorAsset\('worker', assetId, 'private'\)/);
  assert.match(builder,/installDurableWorker\(assetId\)/);
  assert.match(builder,/initialActionAttempt = mode === 'build'/);
  assert.match(builder,/result.intent === 'PUBLISH'/);
  assert.match(builder,/result.intent === 'SAVE_PRIVATE'/);
  assert.match(builder,/result.intent === 'TEST'/);
  assert.match(builder,/initialActionAttempt \? 'MODIFY_DRAFT' : result.intent/);
  assert.match(builder,/CreatorUserMessage/);
  assert.match(builder,/Show full brief/);
  assert.match(api,/\/api\/v1\/creator\/workers/);
});

test('M17 build entry points avoid a paid manager answer and preserve add-vs-create distinction', () => {
  assert.match(home,/if \(chip === 'Create a Worker'\)/);
  assert.match(home,/SET_ACTIVE_CREATION', id: null/);
  assert.match(home,/SET_CREATOR_SURFACE', surface: 'agent-builder'/);
  assert.match(workers,/\+ Create Worker/);
  assert.match(workers,/\+ Add Worker/);
  assert.match(workers,/Create my Worker/);
  assert.match(menu,/teach your method/);
});

test('M17 safety and existing deployment boundaries remain unchanged', () => {
  const docs=readFileSync('docs/MILESTONE-17-NOCODE-WORKER-STAGE1.md','utf8');
  for(const phrase of ['No automatic financial permission', 'No new migration', 'No Scheduler changes', 'No automatic Worker execution']) assert.ok(docs.includes(phrase));
  for(const filename of ['.env.example','config/environments/production-mainnet.env.example']) {
    const env=readFileSync(filename,'utf8');
    assert.match(env,/MAINNET_EXECUTION_ENABLED=false/);
    assert.match(env,/MAINNET_AUTONOMY_ENABLED=false/);
  }
});
