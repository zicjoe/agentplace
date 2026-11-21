import { existsSync, readFileSync } from 'node:fs';
const required=[
  'packages/intelligence/src/providerTelemetry.ts',
  'apps/web/src/platform/providerRequestSummary.ts',
  'tests/m15-stage2-provider-observability.test.mjs',
  'docs/MILESTONE-15-STAGE2.md',
  'docs/MILESTONE-15-STAGE2-TESTING.md',
  'packages/intelligence/src/providerReliability.ts',
  'packages/intelligence/src/flowSignals.ts',
  'packages/intelligence/src/researchGrounding.ts',
  'tests/m15-intelligence-reliability.test.mjs',
  'docs/MILESTONE-15.md',
  'docs/MILESTONE-15-DEPLOYMENT.md',
  'docs/MILESTONE-15-TESTING.md',
];
for(const filename of required)if(!existsSync(filename))throw new Error(`M15 stage 1 missing ${filename}`);
const root=JSON.parse(readFileSync('package.json','utf8'));
if(!root.scripts?.['verify:milestone-15']||!root.scripts?.check?.includes('verify:milestone-15'))throw new Error('M15 verifier must be wired into pnpm check.');
const intel=readFileSync('packages/intelligence/src/index.ts','utf8');
const worker=readFileSync('apps/worker/src/index.ts','utf8');
for(const needle of ['withBoundedProviderRetry(', 'singleFlight(readCache,', "timeframe:'1d'",'snapshotFingerprint','extractNansenSmartMoneyUsdFlow','provider_source_url='])
  if(!intel.includes(needle))throw new Error(`M15 intelligence missing ${needle}`);
for(const needle of ['reconcileResearchRuntimeClaims(coveredAnswer, structuredEvidence)','PERSISTED RUNTIME CAPABILITY RECORDS','structuredIntelligenceEvidence:'])
  if(!worker.includes(needle))throw new Error(`M15 Worker grounding missing ${needle}`);
for(const filename of ['.env.example','config/environments/production-mainnet.env.example']){
  const env=readFileSync(filename,'utf8');
  for(const needle of ['MAINNET_EXECUTION_ENABLED=false','MAINNET_AUTONOMY_ENABLED=false'])if(!env.includes(needle))throw new Error(`M15 ${filename} violates Mainnet safety defaults`);
}
for(const needle of ['requestTelemetry:ledger.since(mark)','withProviderRequestLedger(ledger,async()=>{','recordAttempt(url,outcome','classifyProviderFailure(error)'])
  if(!intel.includes(needle))throw new Error(`M15 Stage 2 evidence accounting missing ${needle}`);
const ui=readFileSync('apps/web/src/components/JobWorkspace.tsx','utf8');
if(!ui.includes('summarizeJobRequestMetrics(intelligenceEvidence)'))throw new Error('M15 Stage 2 missing evidence-inspector request activity');
console.log('PASS: M15 Stage 1 preserved, Stage 2 adds owner-scoped provider-attempt observability, cache and retry counts, provenance and cost caveats without Mainnet safety changes.');
