import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=(path)=>readFileSync(path,'utf8');
function evaluate(code){
  const result=spawnSync(process.execPath,['--disable-warning=ExperimentalWarning','--experimental-strip-types','--input-type=module','-e',code],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
}
test('creation modes can change within one Builder session, without creating another draft',()=>{
  evaluate(`import assert from 'node:assert/strict';
    import {builderTurnMode,builderTemplateInstruction,appendBuilderSuggestion,builderInputProblem} from './apps/web/src/platform/builderConversation.ts';
    import {WORKER_CREATION_STARTERS} from './apps/web/src/platform/workerCreationStart.ts';
    assert.equal(builderTurnMode('Create a research worker',false,true),'build');
    assert.equal(builderTurnMode('Teach AEGIS my scoring methodology',true,false),'teach');
    assert.equal(builderTurnMode('When leverage is high, always warn me',true,false),'teach');
    assert.equal(builderTurnMode('Rename AEGIS to Risk Watch',true,true),'edit');
    assert.equal(builderTurnMode('How would you improve the draft?',true,false),'edit');
    const starter=WORKER_CREATION_STARTERS[0];
    const initial=builderTemplateInstruction(starter,false);
    assert.match(initial,/private Worker draft/);
    const later=builderTemplateInstruction(starter,true);
    assert.match(later,/EXISTING Worker draft/);
    assert.match(later,/Preserve my existing mission/);
    assert.match(later,/Do not add unsupported integrations/);
    const joined=appendBuilderSuggestion('My prior instruction',later,8000);
    assert.equal(joined.fits,true); assert.match(joined.text,/My prior instruction/);
    const over=appendBuilderSuggestion('x'.repeat(7995),later,8000);
    assert.equal(over.fits,false); assert.equal(over.text,'x'.repeat(7995));
    assert.equal(builderInputProblem('hello world',false,8000)!==null,true);
    assert.equal(builderInputProblem('x'.repeat(8001),true,8000)!==null,true);
    assert.equal(builderInputProblem('Add portfolio monitoring',true,8000),null);
  `);
});
test('Builder has one default conversation with optional detailed setup, and templates stay available after kickoff',()=>{
  const code=read('apps/web/src/components/AgentBuilder.tsx');
  assert.match(code,/builderTurnMode\(/);
  assert.match(code,/builderTemplateInstruction\(/);
  assert.match(code,/Browse templates/);
  assert.match(code,/Detailed setup \(optional\)/);
  assert.match(code,/onStart=\{submitBuilderBrief\}/);
  assert.match(code,/setInput\(prepared\.text\)/);
  assert.match(code,/Your text has not been cut/);
  assert.match(code,/Saving conversation/);
  assert.match(code,/Could not save conversation/);
});
test('model intent never automatically starts tests, installs, or publishes',()=>{
  const code=read('apps/web/src/components/AgentBuilder.tsx');
  assert.match(code,/explicitActionOnly/);
  assert.match(code,/Review the draft and use the explicit controls/);
  assert.doesNotMatch(code,/if\(intent==='TEST'\)\{\s*await runTests/);
});

test('Undo is not triggered merely because the model inferred it',()=>{
  const code=read('apps/api/src/server.ts');
  assert.match(code,/explicitUndoRequest/);
  assert.match(code,/Undo requires an explicit request/);
  assert.match(code,/if\(!explicitUndoRequest\)/);
});
