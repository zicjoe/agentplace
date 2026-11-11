import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveManagerObjects, recoverBlockedWorkerRequest } from '../apps/worker/src/managerObjectContext.ts';
const items=[
 {kind:'worker',id:'w-cr',name:'Crypto Researcher',status:'standby'},
 {kind:'worker',id:'w-ms',name:'Meme Scout',status:'standby'},
 {kind:'job',id:'job_abc',name:'BONK portfolio analysis',status:'COMPLETED'},
 {kind:'job',id:'job_def',name:'PEPE risk review',status:'RUNNING'},
 {kind:'routine',id:'r_1',name:'Morning portfolio scan',status:'ACTIVE'},
 {kind:'workflow',id:'wf_1',name:'Risk triage',status:'private'},
];
test('M14 owner-provided resources are described but not treated as authority',()=>{
 const result=resolveManagerObjects('What can my workers do?',[],items);
 assert.equal(result.kind,'continue');
 assert.match(result.context,/Installed Workers:/);
 assert.match(result.context,/Recent Jobs:/);
 assert.match(result.context,/Routines:/);
 assert.match(result.context,/My Workflows:/);
 assert.match(result.context,/does not imply routing eligibility/);
});
test('M14 explicitly requested installed Workers are pinned in order of mention',()=>{
 const result=resolveManagerObjects('Use Meme Scout and Crypto Researcher for this research',[],items);
 assert.equal(result.kind,'continue');
 assert.deepEqual(result.selectedWorkers,['w-ms','w-cr']);
});
test('M14 ambiguous Worker question and ordinal follow-up remain one request',()=>{
 const first=resolveManagerObjects('Use my worker to research BONK',[],items);
 assert.equal(first.kind,'clarify');
 assert.match(first.message,/Which saved worker did you mean/);
 const second=resolveManagerObjects('The second one',[{role:'user',content:'Use my worker to research BONK'},{role:'manager',content:first.message},{role:'user',content:'The second one'}],items);
 assert.equal(second.kind,'continue');
 assert.deepEqual(second.selectedWorkers,['w-ms']);
 assert.match(second.request,/research BONK/);
});
test('M14 named unknown Worker must not silently substitute',()=>{
 const result=resolveManagerObjects('Use worker named Fake Trader',[],items);
 assert.equal(result.kind,'clarify');
 assert.match(result.message,/won't substitute/);
});
test('M14 paused/blocked Worker must not silently reactivate',()=>{
 const result=resolveManagerObjects('Use Crypto Researcher',[ ],items.map(item=>item.id==='w-cr'?{...item,status:'paused'}:item));
 assert.equal(result.kind,'clarify');
 assert.match(result.message,/not currently ready/);
});
test('M14 ambiguous existing Jobs prompt for selection instead of guessing',()=>{
 const result=resolveManagerObjects('Check my job',[],items);
 assert.equal(result.kind,'clarify');
 assert.match(result.message,/Which saved job/);
});
test('M14 conversational reference resolves prior explicit Worker',()=>{
 const history=[{role:'user',content:'Use Crypto Researcher to research BONK'},{role:'manager',content:'I created a read-only Job.'},{role:'user',content:'Ask that worker to look into PEPE'}];
 const result=resolveManagerObjects('Ask that worker to look into PEPE',history,items);
 assert.equal(result.kind,'continue');
 assert.deepEqual(result.selectedWorkers,['w-cr']);
});

test('M14 recover paused-Worker blocked goal after explicit resume and retry',()=>{
 const original='Use Crypto Researcher and Meme Scout to investigate DOGE; research market context and liquidity. Do not take financial action.';
 const paused=resolveManagerObjects(original,[],items.map(item=>item.id==='w-cr'?{...item,status:'paused'}:item));
 assert.equal(paused.kind,'clarify');
 const history=[{role:'user',content:original},{role:'manager',content:paused.message},{role:'user',content:'I resumed Crypto Researcher. Continue our original investigation.'}];
 const recovered=recoverBlockedWorkerRequest(history.at(-1).content,history);
 assert.match(recovered,/Use Crypto Researcher and Meme Scout/);
 const resumed=resolveManagerObjects(recovered,history,items);
 assert.equal(resumed.kind,'continue');
 assert.deepEqual(resumed.selectedWorkers,['w-cr','w-ms']);
});
test('M14 recover not-installed requested Worker only after explicit retry',()=>{
 const original='Use Crypto Researcher and Meme Scout to investigate PEPE. Do not take financial action.';
 const notice='I found the requested Worker Crypto Researcher in Discover, but it is not installed in your account. I won\'t claim they worked or silently substitute another Worker. Add that Worker first, then retry your request.';
 const history=[{role:'user',content:original},{role:'manager',content:notice},{role:'user',content:'Installed it. Please retry the original research.'}];
 const request=recoverBlockedWorkerRequest(history.at(-1).content,history);
 assert.match(request,/Meme Scout/);
 const resolved=resolveManagerObjects(request,history,items);
 assert.deepEqual(resolved.selectedWorkers,['w-cr','w-ms']);
});
test('M14 never resume a blocked request when the user requests a replacement or it is financial',()=>{
 const notice='Crypto Researcher (worker; paused) is not currently ready for new work. Review its status in My Agents. I won\'t silently replace or reactivate it.';
 const history=[{role:'user',content:'Use Crypto Researcher to research DOGE'},{role:'manager',content:notice},{role:'user',content:'Use Meme Scout instead, continue'}];
 assert.equal(recoverBlockedWorkerRequest(history.at(-1).content,history),undefined);
 const unsafe=[{role:'user',content:'Use Crypto Researcher and Meme Scout to transfer 1 USDC'},{role:'manager',content:notice},{role:'user',content:'Retry'}];
 assert.equal(recoverBlockedWorkerRequest('Retry',unsafe),undefined);
 assert.equal(recoverBlockedWorkerRequest('What is happening?',history),undefined);
});
test('M14 recovered request still fails closed if Worker remains paused',()=>{
 const original='Use Crypto Researcher and Meme Scout to investigate DOGE';
 const pausedItems=items.map(item=>item.id==='w-cr'?{...item,status:'paused'}:item);
 const paused=resolveManagerObjects(original,[],pausedItems);
 const history=[{role:'user',content:original},{role:'manager',content:paused.message},{role:'user',content:'Retry original research'}];
 const recovered=recoverBlockedWorkerRequest('Retry original research',history);
 assert.equal(resolveManagerObjects(recovered,history,pausedItems).kind,'clarify');
});
