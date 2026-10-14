import test from 'node:test'; import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs';
test('M8 remains preparation-only and exact-action approvals are revision bound',()=>{
 const sql=readFileSync('packages/db/migrations/0012_action_preparation_review.sql','utf8');
 assert.match(sql,/UNIQUE\(owner_user_id, action_id, prepared_revision\)/);
 assert.match(sql,/approval_scope text NOT NULL DEFAULT 'EXACT_ACTION'/);
 const src=readFileSync('packages/execution/src/index.ts','utf8');
 assert.match(src,/actionDigest/); assert.match(src,/decision='INVALIDATED'/); assert.doesNotMatch(src,/eth_sendRawTransaction|eth_sendTransaction/);
});
test('M8 uses provider-neutral canonical action capabilities',()=>{const src=readFileSync('packages/execution/src/index.ts','utf8');assert.match(src,/asset\.transfer\.execute/);assert.match(src,/swap\.execute/);assert.match(src,/bridge\.execute/);});

test('M8 serializes every JSONB action-preparation payload explicitly for PostgreSQL',()=>{
 const src=readFileSync('packages/execution/src/index.ts','utf8');
 assert.match(src,/prepared_payload,validation[\s\S]*\$5::jsonb,\$6::jsonb[\s\S]*\$9::jsonb[\s\S]*\$11::jsonb/);
 assert.match(src,/JSON\.stringify\(authority\.reasons\)/);
 assert.match(src,/JSON\.stringify\(risk\.checks\)/);
 assert.match(src,/rawEvidence\?JSON\.stringify\(quoteResult\.quote\.rawEvidence\):null/);
 assert.match(src,/sim\.evidence\?JSON\.stringify\(sim\.evidence\):null/);
});


test('M8 never exposes Approve once when quote/preflight readiness leaves a durable action only PREPARED',()=>{
 const ui=readFileSync('apps/web/src/components/ActionReview.tsx','utf8');
 assert.match(ui,/serverAction\.status === 'APPROVAL_REQUIRED'/);
 assert.match(ui,/Approval is not available yet/);
 const api=readFileSync('apps/api/src/server.ts','utf8');
 assert.match(api,/ACTION_NOT_APPROVABLE/);
 assert.match(api,/not ready for approval/);
});


test('LI.FI quote requests use canonical eip155 chain resolution and the actual source wallet address',()=>{
 const src=readFileSync('packages/execution/src/index.ts','utf8');
 assert.match(src,/family!==['\"]eip155['\"]&&family!==['\"]evm['\"]/);
 assert.match(src,/SELECT address,namespace FROM wallet_resource/);
 assert.match(src,/fromToken,toToken,fromAmount,fromAddress/);
 assert.match(src,/fetchLifiQuote\(base,fromAddress\)/);
});


test('LI.FI quote preparation normalizes missing token-address and atomic-amount inputs instead of returning opaque NOT_AVAILABLE',()=>{
 const src=readFileSync('packages/execution/src/index.ts','utf8');
 assert.match(src,/const fromToken=action\.assetAddress\?\.trim\(\)\|\|action\.asset/);
 assert.match(src,/const toToken=action\.outputAssetAddress\?\.trim\(\)\|\|outputAsset/);
 assert.match(src,/function atomicAmountForQuote/);
 assert.match(src,/ATOMIC_AMOUNT_UNRESOLVED/);
 assert.match(src,/SOURCE_ADDRESS_UNAVAILABLE/);
 assert.match(src,/CHAIN_ID_UNRESOLVED/);
 const ui=readFileSync('apps/web/src/components/ActionReview.tsx','utf8');
 assert.match(ui,/Quote detail/);
 assert.match(ui,/routeSummary/);
});
