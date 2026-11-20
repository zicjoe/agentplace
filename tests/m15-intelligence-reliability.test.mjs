import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const source = (file) => readFileSync(file, 'utf8');
function runTS(body, imports) {
  const child = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning','--experimental-strip-types','--input-type=module','-e', `import assert from 'node:assert/strict';\n${imports}\n${body}`],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr || child.stdout);
}
const providerImports = `import {ProviderHttpError,retryAfterMilliseconds,singleFlight,withBoundedProviderRetry} from './packages/intelligence/src/providerReliability.ts';`;
const flowImports = `import {extractNansenSmartMoneyUsdFlow} from './packages/intelligence/src/flowSignals.ts';`;
const groundingImports = `import {reconcileResearchRuntimeClaims} from './packages/intelligence/src/researchGrounding.ts';`;

test('M15 DexScreener retries a short 429 only once and uses the retry delay', () => runTS(`(async()=>{
  let attempts = 0;
  const waits = [];
  const value = await withBoundedProviderRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw new ProviderHttpError(429, 750);
    return 'resolved';
  }, {maxAttempts:2,maxWaitMs:1000,sleep:async (ms)=>{waits.push(ms);}});
  assert.equal(value,'resolved');
  assert.equal(attempts,2);
  assert.deepEqual(waits,[750]);
})().catch(error=>{console.error(error); process.exit(1)});`, providerImports));

test('M15 respects long Retry-After, does not retry authentication failures, and caps request attempts', () => runTS(`(async()=>{
  for (const status of [401,403]) {
    let calls=0;
    await assert.rejects(withBoundedProviderRetry(async ()=>{calls+=1; throw new ProviderHttpError(status);},
      {maxAttempts:2,maxWaitMs:1000,sleep:async()=>{}}),{statusCode:status});
    assert.equal(calls,1);
  }
  let calls=0;
  await assert.rejects(withBoundedProviderRetry(async ()=>{calls+=1; throw new ProviderHttpError(429,30_000);},
    {maxAttempts:2,maxWaitMs:1000,sleep:async()=>{throw new Error('should not sleep');}}),{statusCode:429});
  assert.equal(calls,1);
  assert.equal(retryAfterMilliseconds('2'),2000);
  assert.equal(retryAfterMilliseconds(null),undefined);
  assert.equal(retryAfterMilliseconds('not-a-date'),undefined);
})().catch(error=>{console.error(error); process.exit(1)});`, providerImports));

test('M15 single-flight deduplicates both successful and failed reads within a Job', () => runTS(`(async()=>{
  const cache = new Map();
  let requests=0;
  const operation=async()=>{requests+=1;return {amount:7};};
  const [a,b] = await Promise.all([singleFlight(cache,'dex:bonk',operation),singleFlight(cache,'dex:bonk',operation)]);
  assert.strictEqual(a,b);
  assert.equal(requests,1);
  let failed=0;
  for(let i=0;i<2;i++) await assert.rejects(singleFlight(cache,'dex:failed',async()=>{failed++;throw new ProviderHttpError(429);}),{statusCode:429});
  assert.equal(failed,1);
  const anotherJob=new Map();
  await singleFlight(anotherJob,'dex:bonk',operation);
  assert.equal(requests,2);
})().catch(error=>{console.error(error); process.exit(1)});`, providerImports));

test('M15 Nansen normalization uses only explicitly scoped Smart Money USD net flow', () => runTS(`
  assert.deepEqual(extractNansenSmartMoneyUsdFlow({data:{smart_money:{net_flow_usd:-10790},whales:{net_flow_usd:500000}}}),
    {cohort:'smart_money',metric:'net_flow_usd',valueUsd:-10790,path:'data.smart_money.net_flow_usd',direction:'net-outflow'});
  assert.equal(extractNansenSmartMoneyUsdFlow({data:{whales:{net_flow_usd:-10790},exchanges:{net_flow_usd:436905}}}),null);
  assert.equal(extractNansenSmartMoneyUsdFlow({data:{smart_money:{net_flow:21000}}}),null); // unspecified units
  assert.deepEqual(extractNansenSmartMoneyUsdFlow({data:[{segment:'smart money',net_flow_usd:0}]}),
    {cohort:'smart_money',metric:'net_flow_usd',valueUsd:0,path:'data[0].net_flow_usd',direction:'flat'});
  assert.equal(extractNansenSmartMoneyUsdFlow({data:[{cohort:'smart_money',net_flow_usd:100},{cohort:'smart_money',net_flow_usd:-80}]}),null);
`, flowImports));

test('M15 runtime reconciliation corrects known false identity-unavailable statements without inventing observations', () => runTS(`
  const record={id:'iev_verified',capabilityId:'token.identity.resolve',status:'verified',network:'solana',address:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'};
  const answer='Market overview. The token.identity.resolve capability was not live for this run.';
  const corrected=reconcileResearchRuntimeClaims(answer,[record]);
  assert.match(corrected,/persisted Job record confirms/);
  assert.match(corrected,/record \`iev_verified\`/);
  assert.match(corrected,/does not verify market or wallet measurements/);
  assert.equal(reconcileResearchRuntimeClaims('Market overview. Identity checks ran.',[record]),'Market overview. Identity checks ran.');
  assert.equal(reconcileResearchRuntimeClaims(answer,[{...record,status:'error'}]),answer);
`, groundingImports));

test('M15 actual research paths bind retry, shared fetches, flow windows, evidence grounding, and financial safety', () => {
  const intel=source('packages/intelligence/src/index.ts');
  const worker=source('apps/worker/src/index.ts');
  assert.match(intel,/if\(capabilityId==='smartmoney\.accumulation\.detect'\) return 3/);
  assert.match(intel,/withBoundedProviderRetry\(/);
  assert.match(intel,/array\(await dexScreenerJson\(url\)\)/);
  assert.match(intel,/singleFlight\(readCache,`dexscreener:/);
  assert.match(intel,/singleFlight\(readCache,requestKey,read\)/);
  assert.match(intel,/body=\{chain:network,token_address:address,timeframe:'1d'\}/);
  assert.match(intel,/item\.network===base\.network && item\.address\?\.toLowerCase\(\)===base\.address\?\.toLowerCase\(\)/);
  assert.match(intel,/requestParameters:publicParameters,snapshotFingerprint/);
  assert.match(intel,/persisted_evidence_id=/);
  assert.match(worker,/reconcileResearchRuntimeClaims\(coveredAnswer, structuredEvidence\)/);
  assert.match(worker,/MAINNET_AUTONOMY_ENABLED|contextManifest/); // existing safety/trace contract retained
  assert.match(source('.env.example'),/MAINNET_AUTONOMY_ENABLED=false/);
  assert.match(source('.env.example'),/MAINNET_EXECUTION_ENABLED=false/);
});
