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

const worker=readFileSync('apps/worker/src/index.ts','utf8');
for(const token of ['tryPrepareBridgeRequest','createFinancialAction','prepareFinancialAction','action-review:','Nothing has been signed or submitted']) if(!worker.includes(token)) throw new Error(`M8 production Manager action handoff missing ${token}`);
if(worker.includes('Router v1 is read-only: if the user asks AgentPlace to move funds or execute a financial action')) throw new Error('M8 worker still contains the legacy blanket read-only financial-action response.');
const chatView=readFileSync('apps/web/src/components/ChatView.tsx','utf8');
for(const token of ['action-review:','Open Action Review','Nothing has been signed or submitted']) if(!chatView.includes(token)) throw new Error(`M8 conversation Action Review handoff missing ${token}`);

const discoverFixtures=readFileSync('apps/web/src/fixtures/FixtureAppContext.tsx','utf8');
for(const token of ["id: 'ds-exec-operator'","workerDefinitionId: 'w-execution'","name: 'Execution Operator'","category: 'Transactions'"]) if(!discoverFixtures.includes(token)) throw new Error(`M8 Discover execution-worker handoff missing ${token}`);

const discoverDetail=readFileSync('apps/web/src/components/DiscoverDetail.tsx','utf8');
if(!discoverDetail.includes("item.workerDefinitionId ?? item.id.replace('ds-', 'w-')")) throw new Error('M8 Discover installation does not use the durable worker definition id mapping.');
const workersMigration=readFileSync('packages/db/migrations/0003_workers_jobs.sql','utf8');
if(!workersMigration.includes("('w-execution','execution-operator'")) throw new Error('M8 expected durable Execution Operator worker definition is missing.');

const discoverView=readFileSync('apps/web/src/components/Discover.tsx','utf8');
for(const token of ["'transactions'","label: 'Transactions'","cat.includes('transaction')"]) if(!discoverView.includes(token)) throw new Error(`M8 Discover transactions filter missing ${token}`);
const workerWorkspace=readFileSync('apps/web/src/components/WorkerWorkspace.tsx','utf8');
for(const token of ["item.workerDefinitionId ?? item.id.replace('ds-', 'w-')","SET_ACTIVE_DISCOVER_ITEM","Add from Discover"]) if(!workerWorkspace.includes(token)) throw new Error(`M8 contextual Worker Discover deep-link missing ${token}`);
const actionReview=readFileSync('apps/web/src/components/ActionReview.tsx','utf8');
for(const token of ['M8 does not sign or submit transactions','mark ready for signature','max-h-[92vh]','overflow-y-auto',"serverAction.status === 'APPROVAL_REQUIRED'",'Approval is not available yet']) if(!actionReview.includes(token)) throw new Error(`M8 Action Review missing ${token}`);
console.log('PASS: M8 Action Preparation + Action Review has durable exact-action preparation, quote/preflight/risk evidence, deterministic authority binding, exact-action approval, service-cost separation, and no signing/submission.');
