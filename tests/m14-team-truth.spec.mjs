import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { missingExplicitInstalledWorkers, resolveManagerObjects, shouldExecuteExplicitTeam } from '../apps/worker/src/managerObjectContext.ts';
import { researchStageLabels, collaborationHasGaps, finalResearchStageIds } from '../apps/worker/src/jobProgressTruth.ts';

const read = (path) => readFileSync(path,'utf8');
const catalog=[
  {id:'w-researcher',name:'Crypto Researcher'},
  {id:'w-memescout',name:'Meme Scout'},
];
const installed=catalog.map(item=>({...item,kind:'worker',status:'standby'}));

test('explicit two-Worker request resolves canonical Worker definition IDs, not installation IDs',()=>{
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/SELECT uw\.worker_definition_id AS id,d\.name,uw\.status/);
  const result=resolveManagerObjects('Use my Crypto Researcher and Meme Scout to research BONK',[],installed);
  assert.equal(result.kind,'continue');
  assert.deepEqual(result.selectedWorkers,['w-researcher','w-memescout']);
  assert.equal(shouldExecuteExplicitTeam('Use Crypto Researcher and Meme Scout to investigate BONK',2),true);
  assert.equal(shouldExecuteExplicitTeam('What are Crypto Researcher and Meme Scout?',2),false);
});

test('uninstalled but explicitly requested known Worker cannot silently vanish from the plan',()=>{
  const request='Use my Crypto Researcher and Meme Scout to investigate BONK';
  const missing=missingExplicitInstalledWorkers(request,installed.slice(1),catalog);
  assert.deepEqual(missing,[catalog[0]]);
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/missingExplicitInstalledWorkers\(taskText\(task,context\),installedWorkers,availableCatalog\)/);
  assert.match(worker,/not installed in your account/);
  assert.match(worker,/I won't claim they worked or silently substitute/);
});

test('Worker-scoped chat cannot claim multi-Worker execution',()=>{
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/if\(context\.scope==='worker' && task\.inputSource==='USER_MESSAGE'\)/);
  assert.match(worker,/this is a single-Worker conversation\. Start work from the Manager/);
  assert.match(worker,/I have not launched a one-Worker Job or claimed that the other Worker participated/);
});

test('explicit installed Worker versions are pinned to Router inputs',()=>{
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/SELECT worker_definition_id,worker_version_id FROM user_worker/);
  assert.match(worker,/owner_user_id=\$1 AND worker_definition_id=ANY\(\$2::text\[\]\)/);
  assert.match(worker,/\.\.\.selectedVersions\.map\(\(item\)=>\[item\.worker_definition_id,item\.worker_version_id\]\)/);
  assert.match(worker,/forcedSupportingWorkerIds/);
  assert.match(worker,/objectRequest\.selectedWorkers\.filter\(id=>!routed\.has\(id\)\)/);
  assert.match(worker,/I haven't silently replaced it or started a new Job/);
});

test('Job follow-ups cannot replace immutable persisted Worker assignments with model-proposed team',()=>{
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/existingJob!\.leadWorkerId/);
  assert.match(worker,/existingJob!\.supportingWorkerIds/);
  assert.match(worker,/recorded\.supportingWorkerIds\.some\(id=>!route\.supportingWorkerIds\.includes\(id\)\)/);
  assert.match(worker,/I have not claimed a new team performed research/);
});

test('runtime Job stage labels cannot invent Worker collaboration',()=>{
  assert.deepEqual(researchStageLabels(false),[
    'Plan route','Gather source evidence','Lead Worker research and synthesis','Validate research coverage',
  ]);
  assert.deepEqual(researchStageLabels(true),[
    'Plan route','Gather source evidence','Independent specialist research','Lead synthesis','Validate research coverage',
  ]);
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/const stageLabels = researchStageLabels\(route\.supportingWorkerIds\.length>0\)/);
  assert.doesNotMatch(worker,/UPDATE job_stage SET status='done',updated_at=now\(\) WHERE job_id=\$1/);
});

test('missing, failed and skipped specialists cannot yield a successful specialist progress stage',()=>{
  assert.equal(collaborationHasGaps({expected:1,completed:1,skipped:0,failed:0}),false);
  assert.equal(collaborationHasGaps({expected:2,completed:1,skipped:1,failed:0}),true);
  assert.equal(collaborationHasGaps({expected:2,completed:1,skipped:0,failed:1}),true);
  assert.equal(collaborationHasGaps({expected:2,completed:0,skipped:0,failed:0}),true);
  assert.equal(collaborationHasGaps({expected:0,completed:0,skipped:0,failed:0}),false);
  assert.deepEqual(finalResearchStageIds(true),['stage_4','stage_5']);
  assert.deepEqual(finalResearchStageIds(false),['stage_3','stage_4']);
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/stageStatus:collaborationHasGaps\(/);
  assert.match(worker,/currentStage: 'Research complete · partial Worker participation'/);
});

test('follow-up Jobs use task-scoped checkpoints and cannot replay a previous task specialist report',()=>{
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/id:`\$\{task\.id\}:\$\{step\.id\}`/);
  assert.match(worker,/dependsOn:step\.dependsOn\.map\(dependency=>`\$\{task\.id\}:\$\{dependency\}`\)/);
  assert.match(worker,/step\.id===`\$\{task\.id\}:lead-synthesis`/);
  assert.match(worker,/await createJobOrchestrationPlan\(task\.ownerUserId,jobId,taskSteps\.map/);
});

test('provider evidence is completed only when usable structured provider output exists',()=>{
  const worker=read('apps/worker/src/index.ts');
  assert.match(worker,/usableStructuredEvidenceCount:structuredEvidence\.filter\(item=>item\.status==='verified'\|\|item\.status==='partial'\)\.length/);
  assert.match(worker,/lastErrorCode:'NO_USABLE_STRUCTURED_EVIDENCE'/);
  const workspace=read('apps/web/src/components/JobWorkspace.tsx');
  assert.match(workspace,/No usable structured evidence/);
});

test('historical Jobs no longer show unverified collaboration claims as green completed work',()=>{
  const workspace=read('apps/web/src/components/JobWorkspace.tsx');
  assert.match(workspace,/earlier Job has unverified collaboration claims/i);
  assert.match(workspace,/Proposed collaboration · not verified/);
  assert.match(workspace,/partial team/);
});
