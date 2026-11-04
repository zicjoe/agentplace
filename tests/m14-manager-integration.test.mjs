import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../apps/worker/src/index.ts',import.meta.url),'utf8');
const resolver=readFileSync(new URL('../apps/worker/src/managerObjectContext.ts',import.meta.url),'utf8');
test('M14 Manager resource inventory is owner-scoped at each SQL boundary',()=>{
 assert.match(worker,/FROM user_worker uw JOIN worker_definition d[\s\S]*?uw\.owner_user_id=\$1/);
 assert.match(worker,/FROM job WHERE owner_user_id=\$1/);
 assert.match(worker,/FROM routine WHERE owner_user_id=\$1/);
 assert.match(worker,/FROM workflow_definition WHERE creator_user_id=\$1/);
 assert.match(worker,/\[task\.ownerUserId\]/);
});
test('M14 inventory passes as untrusted context and explicit selected Workers are Router-checked',()=>{
 assert.match(worker,/resolvedObjects\.context/);
 assert.match(worker,/selectedWorkers\.filter\(id=>!availableIds\.has\(id\)\)/);
 assert.match(worker,/I won't silently substitute another Worker/);
 assert.match(worker,/value\.leadWorkerId = selected\[0\]!/);
 assert.match(worker,/return planRoute\(/);
});
test('M14 references do not expand financial authority or secretly activate Routines',()=>{
 assert.doesNotMatch(resolver,/prepareFinancialAction|createFinancialAction|activateRoutine|updateMandate|executeTransaction/);
 assert.match(resolver,/Verify access\/eligibility in the trusted Router/);
});
