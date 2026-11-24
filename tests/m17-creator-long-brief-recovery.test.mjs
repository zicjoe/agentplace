import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function evaluate(source) {
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--input-type=module', '-e', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('Long expertise brief no longer creates invalid initial Creator responsibility or mission', () => {
  evaluate(`
    import assert from 'node:assert/strict';
    import {workerCreationBrief,initialWorkerJobContract,WORKER_CREATION_REQUEST_LIMIT} from './apps/web/src/platform/workerCreationStart.ts';
    import {validateCreatorWorkerDraft} from './packages/creator-sdk/src/index.ts';
    const goal='# Create AEGIS — Autonomous Crypto Risk Commander\\n\\n' + 'Analyze portfolio risks across Ethereum, Arbitrum, Solana and BNB Chain. '.repeat(32);
    const input=workerCreationBrief({path:'expertise',goal});
    assert.ok(input);
    assert.ok(input.length > 2000);
    assert.ok(input.length <= WORKER_CREATION_REQUEST_LIMIT);
    const initial=initialWorkerJobContract(input);
    assert.match(initial,/AEGIS/);
    assert.ok(initial.length > 12 && initial.length <= 950);
    assert.ok(input.includes(goal.trim())); // full submitted brief remains available for interpretation
    const makeDraft = (mission,responsibility) => ({name:'Untitled Creator Worker',tagline:'Initial outline',responsibility,category:'Creator',mission,responsibilities:['Investigate evidence'],antiJobs:['Do not execute transactions'],expectedOutputs:['Evidence-backed summary'],successConditions:['Respect limits'],method:[],capabilityRequirements:[],networks:[],authorityDefault:'Research & recommend only · No wallet authority'});
    assert.throws(()=>validateCreatorWorkerDraft(makeDraft(input,input)),/INVALID_WORKER_RESPONSIBILITY/);
    assert.doesNotThrow(()=>validateCreatorWorkerDraft(makeDraft(initial,initial.slice(0,1000))));
  `);
});

test('Creation request limit is explicit and does not silently cut the text', () => {
  evaluate(`
    import assert from 'node:assert/strict';
    import {workerCreationBrief,WORKER_CREATION_GOAL_LIMIT,WORKER_CREATION_METHOD_LIMIT} from './apps/web/src/platform/workerCreationStart.ts';
    assert.equal(workerCreationBrief({path:'expertise',goal:'x'.repeat(WORKER_CREATION_GOAL_LIMIT+1)}),null);
    assert.equal(workerCreationBrief({path:'expertise',goal:'Build an evidence research Worker',method:'x'.repeat(WORKER_CREATION_METHOD_LIMIT+1)}),null);
    assert.equal(workerCreationBrief({path:'expertise',goal:'x'.repeat(3000),method:'z'.repeat(700)}),null); // combined scaffold limit
    assert.ok(workerCreationBrief({path:'expertise',goal:'Research the risks',method:'Favor primary sources'}));
  `);
  const form=readFileSync('apps/web/src/components/WorkerCreateStart.tsx','utf8');
  assert.doesNotMatch(form,/maxLength=\{(?:1800|1200)\}/);
  assert.match(form,/goalTooLong/);
  assert.match(form,/methodTooLong/);
  assert.match(form,/combinedTooLong/);
  assert.match(form,/Your text has not been cut/);
  assert.match(form,/role="alert"/);
});

test('Creator serialization keeps mission while bounding responsibility and permits safe retry without creating another Worker', () => {
  const api=readFileSync('apps/web/src/platform/creatorApi.ts','utf8');
  const builder=readFileSync('apps/web/src/components/AgentBuilder.tsx','utf8');
  assert.match(api,/responsibility:draft\.jobContract\.slice\(0,1000\),category:'Creator',mission:draft\.jobContract/);
  assert.match(api,/payload\?\.requestId/);
  assert.match(builder,/jobContract:initialWorkerJobContract\(text\)/);
  assert.match(builder,/failedInitialBrief/);
  assert.match(builder,/processBuilderTurn\(failedInitialBrief, true\)/);
  assert.match(builder,/Retry interpreting my brief/);
  assert.match(builder,/seedPersisted = true/);
  assert.match(builder,/An \*\*initial private draft outline\*\* was saved/);
  assert.match(builder,/Nothing was tested, published or granted authority/);
  assert.match(builder,/const initialActionAttempt = mode === 'build'/);
});
