import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function evaluate(source) {
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-strip-types', '--input-type=module', '-e', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const read = (path) => readFileSync(path, 'utf8');

test('M17 long-method training respects the full 8,000 character request and database revision bounds', () => {
  const api = read('apps/api/src/server.ts');
  const market = read('packages/marketplace/src/index.ts');
  const migration = read('packages/db/migrations/0026_creator_builder_teaching_message_limit.sql');
  assert.match(api, /rawMessage\.length>8000/);
  assert.match(api, /builder_message_too_long/);
  assert.match(api, /Your draft was not changed/);
  assert.match(market, /sourceMessage\.length>8000/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS creator_builder_turn_source_message_check/);
  assert.match(migration, /CHECK \(char_length\(source_message\) <= 8000\)/);
});

test('M17 proposed mission can be 2,000 characters without violating responsibility contract', () => {
  evaluate(`
    import assert from 'node:assert/strict';
    import {applyCreatorBuilderOperations,validateCreatorWorkerDraft} from './packages/creator-sdk/src/index.ts';
    const original={name:'AEGIS',tagline:'Research risks',responsibility:'Analyze risk',category:'Creator',mission:'Analyze risk',responsibilities:['Collect evidence'],antiJobs:['No trading'],expectedOutputs:['Risk summary'],successConditions:['Trace claims'],method:[],capabilityRequirements:[],networks:[],authorityDefault:'Research & recommend only · No wallet authority'};
    const longMission='Analyze portfolio risks in a read-only way. '.repeat(40);
    assert.ok(longMission.length>1000);
    assert.ok(longMission.length<2000);
    const operation=(type,value)=>({type,value,values:[],target:'',workerId:'',workerName:'',roleBased:false,required:false});
    const result=applyCreatorBuilderOperations({draft:original,operations:[operation('SET_MISSION',longMission),operation('ADD_METHOD_RULE','UNKNOWN data must never be treated as a zero risk score.')],allowedReadCapabilities:[],allowedWorkers:[]});
    assert.equal(result.rejectedOperations.length,0);
    assert.equal(result.draft.mission,longMission.trim());
    assert.equal(result.draft.responsibility,longMission.slice(0,1000));
    assert.equal(result.draft.method[0],'UNKNOWN data must never be treated as a zero risk score.');
    assert.match(result.draft.authorityDefault,/No wallet authority/);
    assert.doesNotThrow(()=>validateCreatorWorkerDraft(result.draft));
  `);
});

test('M17 teach composer exposes visible limits, multiline input and recovery without silently deleting messages', () => {
  const builder = read('apps/web/src/components/AgentBuilder.tsx');
  const creatorApi = read('apps/web/src/platform/creatorApi.ts');
  assert.match(creatorApi, /CREATOR_BUILDER_MESSAGE_LIMIT = 8000/);
  assert.match(creatorApi, /input\.message\.length>CREATOR_BUILDER_MESSAGE_LIMIT/);
  assert.match(builder, /<textarea/);
  assert.match(builder, /input\.length\.toLocaleString\(\)/);
  assert.match(builder, /Your text has not been cut/);
  assert.match(builder, /setFailedBuilderTurn\(\{text,mode\}\)/);
  assert.match(builder, /Retry this \{failedBuilderTurn\.mode/);
  assert.match(builder, /setFailedBuilderTurn\(null\)/);
  assert.match(builder, /builderInputProblem\(input, Boolean\(savedAssetId\), CREATOR_BUILDER_MESSAGE_LIMIT\)/);
});

test('M17 API maps invalid model-proposed edits to clear non-500 errors, without changing draft', () => {
  const api = read('apps/api/src/server.ts');
  assert.match(api, /error:'builder_edit_validation'/);
  assert.match(api, /Builder could not apply this complex edit within its structured draft limits/);
  assert.match(api, /requestId/);
});
