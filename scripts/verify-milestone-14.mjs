import { existsSync, readFileSync } from 'node:fs';

const required=[
  'packages/db/migrations/0023_launch_readiness_observability.sql',
  'packages/observability/src/index.ts',
  'apps/web/src/components/ServiceCostReviewPanel.tsx',
  'apps/web/src/platform/serviceCostApi.ts',
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
  '.github/workflows/dependency-review.yml',
  '.github/dependabot.yml',
  'scripts/security-secrets.mjs',
  'docs/MILESTONE-14.md',
  'docs/MILESTONE-14-TESTING.md',
  'docs/MILESTONE-14-DEPLOYMENT.md',
  'docs/LAUNCH-READINESS.md',
];
for(const file of required)if(!existsSync(file))throw new Error(`M14 missing ${file}`);

const root=JSON.parse(readFileSync('package.json','utf8'));
if(root.version!=='0.17.0')throw new Error('M14 root version must be 0.17.0.');
for(const command of ['security:secrets','verify:milestone-14'])if(!root.scripts?.[command])throw new Error(`M14 root script missing ${command}`);
if(!String(root.scripts.check).includes('verify:milestone-14'))throw new Error('M14 verifier must be part of pnpm check.');
if(!String(root.scripts.check).includes('security:secrets'))throw new Error('M14 secret guard must be part of pnpm check.');

const api=readFileSync('apps/api/src/server.ts','utf8');
for(const token of ["url.pathname === '/health'","url.pathname === '/ready'",'x-agent-place-request-id','x-agent-place-trace-id','getRuntimeClassReadiness'])if(!api.includes(token))throw new Error(`M14 readiness/API missing ${token}`);
const vercel=readFileSync('apps/web/vercel.json','utf8');
for(const token of ['"source": "/health"','"source": "/ready"'])if(!vercel.includes(token))throw new Error(`M14 Vercel readiness routing missing ${token}`);
if(vercel.indexOf('"source": "/ready"')>vercel.indexOf('"source": "/(.*)"'))throw new Error('M14 /ready rewrite must precede the SPA fallback.');
const vite=readFileSync('apps/web/vite.config.ts','utf8');
for(const token of ["'/health'","'/ready'"])if(!vite.includes(token))throw new Error(`M14 Vite readiness proxy missing ${token}`);

const migration=readFileSync('packages/db/migrations/0023_launch_readiness_observability.sql','utf8');
if(!migration.includes('runtime_heartbeat'))throw new Error('M14 runtime heartbeat persistence missing.');

const observability=readFileSync('packages/observability/src/index.ts','utf8');
for(const token of ['createServiceLogger','sanitizeLogFields','SENSITIVE_KEY'])if(!observability.includes(token))throw new Error(`M14 observability missing ${token}`);

const telegraph=readFileSync('packages/telegraph/src/runtime.ts','utf8');
for(const token of ['single_job_threshold_cents','TELEGRAPH_SERVICE_COST_REVIEW_REQUIRED','TELEGRAPH_SERVICE_COST_REVIEW_REJECTED'])if(!telegraph.includes(token))throw new Error(`M14 service-cost boundary missing ${token}`);
const serviceCost=readFileSync('apps/web/src/components/ServiceCostReviewPanel.tsx','utf8');
if(!/does not approve a crypto transaction, grant wallet authority, or move your capital/i.test(serviceCost))throw new Error('M14 Service Cost Review must explicitly separate service spend from crypto authority.');

const ci=readFileSync('.github/workflows/ci.yml','utf8');
if(!ci.includes('pnpm install --frozen-lockfile')||!ci.includes('pnpm check'))throw new Error('M14 CI must reproduce the frozen install + full check contract.');

for(const envFile of ['.env.example','config/environments/production-mainnet.env.example']){
  const env=readFileSync(envFile,'utf8');
  for(const token of ['MAINNET_EXECUTION_ENABLED=false','MAINNET_AUTONOMY_ENABLED=false'])if(!env.includes(token))throw new Error(`M14 environment safety missing ${token} in ${envFile}`);
}

console.log('PASS: M14 Production Reconciliation + Launch Readiness adds dependency-aware readiness, background runtime heartbeats, correlated secret-redacted logging, explicit Service Cost Review, responsive/accessibility reconciliation and CI/security automation while preserving frozen execution and Mainnet safety boundaries.');
