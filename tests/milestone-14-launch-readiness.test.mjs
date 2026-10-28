import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root=readFileSync('package.json','utf8');
const migration=readFileSync('packages/db/migrations/0023_launch_readiness_observability.sql','utf8');
const db=readFileSync('packages/db/src/index.ts','utf8');
const sharedApi=readFileSync('packages/shared/src/api.ts','utf8');
const observability=readFileSync('packages/observability/src/index.ts','utf8');
const api=readFileSync('apps/api/src/server.ts','utf8');
const worker=readFileSync('apps/worker/src/index.ts','utf8');
const scheduler=readFileSync('apps/scheduler/src/index.ts','utf8');
const telegraph=readFileSync('packages/telegraph/src/runtime.ts','utf8');
const serviceCost=readFileSync('apps/web/src/components/ServiceCostReviewPanel.tsx','utf8');
const job=readFileSync('apps/web/src/components/JobWorkspace.tsx','utf8');
const shell=readFileSync('apps/web/src/components/Shell.tsx','utf8');
const css=readFileSync('apps/web/src/index.css','utf8');
const ci=readFileSync('.github/workflows/ci.yml','utf8');
const codeql=readFileSync('.github/workflows/codeql.yml','utf8');
const dependencyReview=readFileSync('.github/workflows/dependency-review.yml','utf8');
const dependabot=readFileSync('.github/dependabot.yml','utf8');
const secretGuard=readFileSync('scripts/security-secrets.mjs','utf8');

function token(source,value){assert.ok(source.includes(value),`missing ${value}`);}

test('M14 release metadata is coherent at v0.17.0 / milestone 14',()=>{
  assert.equal(JSON.parse(root).version,'0.17.0');
  for(const file of ['apps/api/src/index.ts','apps/worker/src/index.ts','apps/scheduler/src/index.ts']){
    const source=readFileSync(file,'utf8');
    token(source,"version: '0.17.0'"); token(source,'milestone: 14');
  }
});

test('M14 separates API liveness from readiness',()=>{
  token(api,"url.pathname === '/health'");
  token(api,"url.pathname === '/ready'");
  assert.match(api,/\/health'[\s\S]*status: 'ok'/);
  token(sharedApi,'ApiReadinessResponse');
  token(sharedApi,'workerRuntime'); token(sharedApi,'scheduler');
});

test('M14 runtime heartbeat is additive non-financial operational state',()=>{
  token(migration,'CREATE TABLE IF NOT EXISTS runtime_heartbeat');
  token(migration,"runtime_class text NOT NULL CHECK (runtime_class IN ('api','worker','scheduler'))");
  assert.doesNotMatch(migration,/wallet|authority_grant|billing_ledger|private_key/i);
  token(db,'recordRuntimeHeartbeat'); token(db,'getRuntimeClassReadiness');
});

test('M14 Worker and Scheduler publish independent heartbeats during long work',()=>{
  token(worker,'recordRuntimeHeartbeat'); token(worker,"runtimeClass: 'worker'"); token(worker,'async function heartbeatLoop');
  token(worker,'Promise.all([loop(), heartbeatLoop(), transactionObservationLoop(), settlementVerificationLoop()])');
  token(scheduler,'recordRuntimeHeartbeat'); token(scheduler,"runtimeClass: 'scheduler'"); token(scheduler,'async function heartbeatLoop');
  token(scheduler,'Promise.all([loop(), heartbeatLoop()])');
});

test('M14 clean typecheck builds observability declarations before app consumers',()=>{
  const typecheck=readFileSync('scripts/typecheck.mjs','utf8');
  const build=readFileSync('scripts/build.mjs','utf8');
  assert.match(typecheck,/\["shared", "observability", "db"/);
  assert.match(build,/\["shared", "observability", "db"/);
});

test('M14 structured logs carry correlation and redact secret-bearing fields',()=>{
  token(observability,'createServiceLogger'); token(observability,'sanitizeLogFields');
  assert.match(observability,/authorization\|cookie\|secret\|password\|private\.\?key/);
  token(api,'x-agent-place-request-id'); token(api,'x-agent-place-trace-id');
  token(api,"logger.info('HTTP request completed'");
  token(worker,"logger.info('Intelligence task claimed'");
  token(scheduler,"logger.info('Routine scheduler pass'");
});

test('M14 Service Cost Review is distinct from crypto authority',()=>{
  token(serviceCost,'Service Cost Review');
  assert.match(serviceCost,/does not approve a crypto transaction, grant wallet authority, or move your capital/i);
  token(job,'ServiceCostReviewPanel');
  assert.doesNotMatch(serviceCost,/SET_ACTIVE_ACTION|Authority Grant|MandateEditor/);
});

test('M14 paid Telegraph service spend respects single-Job threshold before authorization',()=>{
  token(telegraph,'single_job_threshold_cents');
  token(telegraph,'TELEGRAPH_SERVICE_COST_REVIEW_REQUIRED');
  token(telegraph,'TELEGRAPH_SERVICE_COST_REVIEW_REJECTED');
  token(migration,'request_fingerprint text');
  assert.match(telegraph,/provider='Telegraph' AND request_fingerprint=\$3/);
  assert.match(telegraph,/if \(amountCents > thresholdCents\)/);
  assert.ok(telegraph.indexOf('single_job_threshold_cents') < telegraph.indexOf('signEip3009Payment({ challenge: selected.challenge'));
});

test('M14 service-cost decisions are durable and queryable by Job',()=>{
  const execution=readFileSync('packages/execution/src/index.ts','utf8');
  token(execution,'listServiceCostReviews');
  token(api,"url.pathname==='/api/v1/service-cost-reviews'&&req.method==='GET'");
  token(api,'decideServiceCostReview');
});

test('M14 browser exposes degraded runtime truth instead of inventing availability',()=>{
  const provider=readFileSync('apps/web/src/platform/RuntimeProvider.tsx','utf8');
  token(provider,'getApiReadiness');
  token(provider,"status: readiness?.status === 'ready' ? 'ready' : 'degraded'");
  token(shell,'AgentPlace is running in a degraded state.');
});

test('M14 accessibility baseline includes skip-link, focus, touch and reduced-motion handling',()=>{
  token(shell,'Skip to main content'); token(shell,'id="agentplace-main"');
  token(css,'.agentplace-skip-link'); token(css,':focus-visible'); token(css,'pointer: coarse'); token(css,'prefers-reduced-motion');
});

test('M14 mobile research evidence remains reachable',()=>{
  assert.match(css,/\.research-markdown table[\s\S]*overflow-x: auto/);
  assert.match(css,/\.research-markdown pre[\s\S]*overflow-x: auto/);
});

test('M14 CI reproduces the full local repository contract',()=>{
  token(ci,'pnpm install --frozen-lockfile'); token(ci,'pnpm check');
  token(root,'verify:milestone-14'); token(root,'security:secrets');
});

test('M14 repository security automation is present',()=>{
  token(codeql,'github/codeql-action/init@v4'); token(codeql,'security-extended');
  token(dependencyReview,'actions/dependency-review-action@v4'); token(dependencyReview,'fail-on-severity: high');
  token(dependabot,'package-ecosystem: npm'); token(dependabot,'package-ecosystem: github-actions');
});

test('M14 secret guard blocks repository secrets without rejecting gitignored local env files',()=>{
  token(secretGuard,"forbiddenNames"); token(secretGuard,'PEM private key'); token(secretGuard,'assigned EVM private key');
  token(secretGuard,'git'); token(secretGuard,'check-ignore'); token(secretGuard,'isGitIgnored(rel)');
  assert.match(root,/security:secrets/);
});

test('M14 launch docs preserve controlled Mainnet posture',()=>{
  for(const file of ['docs/MILESTONE-14.md','docs/MILESTONE-14-TESTING.md','docs/MILESTONE-14-DEPLOYMENT.md','docs/LAUNCH-READINESS.md']) token(readFileSync(file,'utf8'),'Mainnet');
  for(const file of ['.env.example','config/environments/production-mainnet.env.example']){
    const env=readFileSync(file,'utf8'); token(env,'MAINNET_EXECUTION_ENABLED=false'); token(env,'MAINNET_AUTONOMY_ENABLED=false');
  }
});

test('M14 does not enable demo controls by default',()=>{
  const runtime=readFileSync('apps/web/src/platform/runtime.ts','utf8');
  assert.match(runtime,/VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS, false/);
});
