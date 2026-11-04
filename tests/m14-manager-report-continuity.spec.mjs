import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wantsPreviousJobReport,choosePreviousJob,selectPreviousJobReport} from '../apps/worker/src/managerReportContext.ts';

const report=`# BONK analysis\n\n## Major risks\n1. Liquidity concentration is the most significant risk in this review. Multiple pools are thin.\n2. Holder clustering warrants further verification.\n\n## Sources\n- https://example.org/example`; // synthetic fixture, not a real claim
const jobs=[
  {id:'job_bonk',title:'BONK liquidity and holder research',goal:'Analyze BONK liquidity and token-holder risk',status:'COMPLETED',originConversationId:'conv_one',updatedAt:'2026-11-04T08:00:00Z',report},
  {id:'job_pepe',title:'PEPE liquidity and risk',goal:'Analyze PEPE',status:'COMPLETED',originConversationId:'conv_other',updatedAt:'2026-11-04T09:00:00Z',report:'PEPE report'},
];
test('follow-up on biggest risk triggers a saved report lookup, not a user paste request',()=>{
 const question='Now investigate the biggest risk you identified. Focus on why it matters and what evidence supports it.';
 assert.equal(wantsPreviousJobReport(question,true),true);
 const result=selectPreviousJobReport(question,'conv_one',jobs);
 assert.equal(result.kind,'selected');
 assert.equal(result.reference.jobId,'job_bonk');
 assert.match(result.reference.reportContext,/Liquidity concentration is the most significant risk/);
 assert.match(result.reference.reportContext,/historical data only/);
 assert.match(result.reference.reportContext,/Do not invent a risk ranking/);
});
test('the current conversation Job wins over more recent unrelated Jobs',()=>{
 const r=choosePreviousJob('Which was the biggest risk in that report?','conv_one',jobs);
 assert.equal(r.kind,'selected');
 assert.equal(r.job.id,'job_bonk');
});
test('last named report can be retrieved across conversations only by matching owner-scoped inventory',()=>{
 const r=choosePreviousJob('Investigate the last BONK report','new_conversation',jobs);
 assert.equal(r.kind,'selected');
 assert.equal(r.job.id,'job_bonk');
});
test('an explicitly named prior report beats a newer unrelated Job even when both chats have work',()=>{
 const r=choosePreviousJob('Investigate my previous BONK report','conv_pepe',[jobs[0],{...jobs[1],originConversationId:'conv_pepe'}]);
 assert.equal(r.kind,'selected');
 assert.equal(r.job.id,'job_bonk');
});
test('a generic last-report reference can resolve the most recent saved Job',()=>{
 const r=choosePreviousJob('Follow up on my last report','new_conversation',jobs);
 assert.equal(r.kind,'selected');
 assert.equal(r.job.id,'job_pepe');
});
test('an unrelated new conversation cannot access a previous Job without a specific request',()=>{
 const r=choosePreviousJob('What is the biggest risk here?','new_conversation',jobs);
 assert.equal(r.kind,'none');
});
test('a missing report is surfaced truthfully, without inventing earlier findings',()=>{
 const r=selectPreviousJobReport('Dig into the biggest risk','conv_one',[{...jobs[0],status:'RUNNING',report:null}]);
 assert.equal(r.kind,'unavailable');
 assert.match(r.message,/not yet available/);
 assert.doesNotMatch(r.message,/paste/i);
});
test('uncertain historical ranking is not fabricated when report does not rank risks',()=>{
 const r=selectPreviousJobReport('What was the biggest risk?','conv_one',[{...jobs[0],report:'The report lists two risks without assigning a ranking.'}]);
 assert.equal(r.kind,'selected');
 assert.match(r.reference.reportContext,/Do not invent a risk ranking/);
});
test('large reports are bounded and explicitly marked incomplete',()=>{
 const r=selectPreviousJobReport('biggest risk','conv_one',[{...jobs[0],report:'A'.repeat(40_000)}]);
 assert.equal(r.kind,'selected');
 assert.equal(r.reference.truncated,true);
 assert.match(r.reference.reportContext,/report excerpt truncated/);
 assert.ok(r.reference.reportContext.length<26000);
});
test('same-name cross-conversation reports need disambiguation',()=>{
 const r=choosePreviousJob('Review my earlier BONK report','new_conversation',[jobs[0],{...jobs[0],id:'job_bonk_2',originConversationId:'another',updatedAt:'2026-11-04T10:00:00Z'}]);
 assert.equal(r.kind,'ambiguous');
});
test('financial requests do not trigger historical report lookup',()=>{
 assert.equal(wantsPreviousJobReport('Transfer 10 USDC to my connected wallet',true),false);
});
test('trusted worker fetches a report only from a verified user-owned Job and owned conversation',()=>{
 const source=readFileSync(new URL('../apps/worker/src/index.ts',import.meta.url),'utf8');
 assert.match(source,/FROM job\n\s+WHERE owner_user_id=\$1 AND kind='research'/);
 assert.match(source,/JOIN conversation c ON c.id=j.job_conversation_id AND c.owner_user_id=j.owner_user_id/);
 assert.match(source,/WHERE j.id=\$1 AND j.owner_user_id=\$2 AND m.role='specialist'/);
 assert.match(source,/m\.id LIKE 'msg_job_result_%'/);
 assert.match(source,/previousReport\.reportContext/);
 assert.match(source,/previousReport \? \{ previousReport \} : \{\}/);
 const outputSaved=source.indexOf('await addAssistantMessage(task.ownerUserId, jobConversationId, answer');
 const markedComplete=source.indexOf("await updateJobRuntime(task.ownerUserId, jobId, { status: 'COMPLETED'");
 assert.ok(outputSaved>=0 && markedComplete>outputSaved,'saved report must precede completed status');
});
