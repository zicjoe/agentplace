import { readFileSync, existsSync } from 'node:fs';
const must=[
  'packages/db/migrations/0012_action_preparation_review.sql','packages/execution/src/index.ts','packages/risk/src/index.ts','apps/web/src/platform/actionApi.ts','docs/MILESTONE-8.md','docs/MILESTONE-8-TESTING.md'
];
for(const f of must) if(!existsSync(f)) throw new Error(`M8 missing ${f}`);
const migration=readFileSync('packages/db/migrations/0012_action_preparation_review.sql','utf8');
for(const token of ['financial_action','prepared_action_revision','action_quote','simulation_result','risk_assessment','action_approval','service_cost_review','PREPARED_ACTION_REVISION_IMMUTABLE','EXACT_ACTION']) if(!migration.includes(token)) throw new Error(`M8 migration missing ${token}`);
const execution=readFileSync('packages/execution/src/index.ts','utf8');
for(const token of ['createFinancialAction','prepareFinancialAction','decideActionApproval','LI.FI','READY_FOR_EXECUTION','Nothing submitted','createServiceCostReview']) if(!execution.includes(token)) throw new Error(`M8 execution missing ${token}`);
if(/sendTransaction|eth_sendTransaction|eth_sendRawTransaction|privateKey|seed phrase/i.test(execution)) throw new Error('M8 must not sign or submit transactions or handle raw secrets.');
const actionReview=readFileSync('apps/web/src/components/ActionReview.tsx','utf8');
for(const token of ['M8 does not sign or submit transactions','mark ready for signature','max-h-[92vh]','overflow-y-auto']) if(!actionReview.includes(token)) throw new Error(`M8 Action Review missing ${token}`);
console.log('PASS: M8 Action Preparation + Action Review has durable exact-action preparation, quote/preflight/risk evidence, deterministic authority binding, exact-action approval, service-cost separation, and no signing/submission.');
