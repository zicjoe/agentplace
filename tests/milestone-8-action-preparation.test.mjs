import test from 'node:test'; import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs';
test('M8 remains preparation-only and exact-action approvals are revision bound',()=>{
 const sql=readFileSync('packages/db/migrations/0012_action_preparation_review.sql','utf8');
 assert.match(sql,/UNIQUE\(owner_user_id, action_id, prepared_revision\)/);
 assert.match(sql,/approval_scope text NOT NULL DEFAULT 'EXACT_ACTION'/);
 const src=readFileSync('packages/execution/src/index.ts','utf8');
 assert.match(src,/actionDigest/); assert.match(src,/decision='INVALIDATED'/); assert.doesNotMatch(src,/eth_sendRawTransaction|eth_sendTransaction/);
});
test('M8 uses provider-neutral canonical action capabilities',()=>{const src=readFileSync('packages/execution/src/index.ts','utf8');assert.match(src,/asset\.transfer\.execute/);assert.match(src,/swap\.execute/);assert.match(src,/bridge\.execute/);});
