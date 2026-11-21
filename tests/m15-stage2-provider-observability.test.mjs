import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function runTS(imports, body) {
  const child = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning','--experimental-strip-types',
    '--input-type=module','-e', `${imports}\nimport assert from 'node:assert/strict';\n${body}`], {encoding:'utf8'});
  assert.equal(child.status,0,child.stderr||child.stdout);
}
const ledger=`import {ProviderRequestLedger,withProviderRequestLedger,currentProviderRequestLedger,classifyProviderEndpoint,classifyProviderFailure} from './packages/intelligence/src/providerTelemetry.ts';`;
const dashboard=`import {evidenceRequestMetrics,summarizeJobRequestMetrics} from './apps/web/src/platform/providerRequestSummary.ts';`;

test('M15.2 records exact attempts, shared reads, retry timing and failures without raw URLs',()=>runTS(ledger,`
  const audit=new ProviderRequestLedger(); const mark=audit.checkpoint();
  const secret='Bearer_secret_987';
  audit.recordAttempt('https://solana-mainnet.g.alchemy.com/v2/'+secret,'ok',42,200);
  audit.recordAttempt('https://api.dexscreener.com/token-pairs/v1/solana/walletSecret','http_error',9,429);
  audit.recordRetry('dexscreener',400);
  audit.recordAttempt('https://api.dexscreener.com/token-pairs/v1/solana/walletSecret','ok',20,200);
  audit.recordReuse('dexscreener'); audit.recordReuse('nansen');
  const report=audit.since(mark);
  assert.equal(report.outboundAttempts,3);assert.equal(report.cacheReuses,2);
  assert.equal(report.scheduledRetries,1);assert.equal(report.retryWaitMs,400);
  assert.equal(report.elapsedMs,71);assert.deepEqual(report.requests.map(x=>x.outcome),['ok','http_error','ok']);
  assert.equal(report.requests[0].provider,'alchemy');
  assert.equal(report.requests[0].operation,'solana-rpc');
  assert.equal(report.requests[1].statusCode,429);
  assert.equal(JSON.stringify(report).includes(secret),false);
  assert.equal(JSON.stringify(report).includes('walletSecret'),false);
  assert.equal(JSON.stringify(report).includes('api.dexscreener.com'),false);
`));

test('M15.2 preserves per-invocation deltas across shared requests, avoiding double-counting',()=>runTS(ledger,`
  const audit=new ProviderRequestLedger();
  const first=audit.checkpoint();
  audit.recordAttempt('https://api.nansen.ai/api/v1/tgm/flow-intelligence','ok',80,200);
  assert.equal(audit.since(first).outboundAttempts,1);
  const second=audit.checkpoint();
  audit.recordReuse('nansen');
  const shared=audit.since(second);
  assert.equal(shared.outboundAttempts,0);
  assert.equal(shared.cacheReuses,1);
  assert.equal(shared.scheduledRetries,0);
  assert.equal(audit.since(first).outboundAttempts,1);
`));

test('M15.2 isolates concurrent Job ledgers with asynchronous context',()=>runTS(ledger,`
  const first=new ProviderRequestLedger(),second=new ProviderRequestLedger();
  const sleep=()=>new Promise(r=>setTimeout(r,1));
  await Promise.all([
    withProviderRequestLedger(first,async()=>{await sleep();assert.strictEqual(currentProviderRequestLedger(),first);currentProviderRequestLedger().recordReuse('nansen');}),
    withProviderRequestLedger(second,async()=>{await sleep();assert.strictEqual(currentProviderRequestLedger(),second);currentProviderRequestLedger().recordAttempt('https://api.dexscreener.com/token-pairs/v1/solana/x','ok',3,200);}),
  ]);
  assert.equal(first.since({attempts:0,reuses:0,retries:0}).cacheReuses,1);
  assert.equal(first.since({attempts:0,reuses:0,retries:0}).outboundAttempts,0);
  assert.equal(second.since({attempts:0,reuses:0,retries:0}).outboundAttempts,1);
  assert.equal(currentProviderRequestLedger(),undefined);
`));

test('M15.2 failure classification is structured and redacts errors',()=>runTS(ledger,`
  assert.deepEqual(classifyProviderFailure({statusCode:429,message:'password'}),{category:'rate_limited',httpStatus:429});
  assert.deepEqual(classifyProviderFailure({statusCode:403,message:'secret key'}),{category:'access_denied',httpStatus:403});
  assert.deepEqual(classifyProviderFailure({statusCode:503}),{category:'upstream_failure',httpStatus:503});
  assert.deepEqual(classifyProviderFailure({name:'AbortError',message:'https://secret'}),{category:'timeout'});
  assert.deepEqual(classifyProviderFailure({name:'SyntaxError'}),{category:'invalid_json'});
  assert.deepEqual(classifyProviderEndpoint('garbage'),{provider:'other',operation:'external-request'});
`));

test('M15.2 Job workspace displays correct aggregate and preserves older records',()=>runTS(dashboard,`
  const newRecord={data:{requestTelemetry:{version:'m15-stage2-v1',outboundAttempts:2,cacheReuses:0,scheduledRetries:1,elapsedMs:200,requests:[{outcome:'http_error'},{outcome:'ok'}]}}};
  const shared={data:{requestTelemetry:{version:'m15-stage2-v1',outboundAttempts:0,cacheReuses:1,scheduledRetries:0,elapsedMs:0,requests:[]}}};
  assert.deepEqual(summarizeJobRequestMetrics([newRecord,shared]),{outboundAttempts:2,cacheReuses:1,scheduledRetries:1,elapsedMs:200,errors:1,instrumentedEvidence:2});
  assert.equal(evidenceRequestMetrics({}),null);
  assert.equal(summarizeJobRequestMetrics([{data:{}}]),null);
  assert.equal(evidenceRequestMetrics({requestTelemetry:{version:'evil',outboundAttempts:99}}),null);
`));

test('M15.2 retry hook records actual scheduled delay, not a fictional provider call',()=>runTS(ledger+`
  import {ProviderHttpError,withBoundedProviderRetry} from './packages/intelligence/src/providerReliability.ts';`, `
  const audit=new ProviderRequestLedger();let tries=0;
  const waits=[];
  const result=await withProviderRequestLedger(audit,()=>withBoundedProviderRetry(async()=>{
    tries++;
    audit.recordAttempt('https://api.dexscreener.com/token-pairs/v1/solana/x',tries===1?'http_error':'ok',10,tries===1?429:200);
    if(tries===1)throw new ProviderHttpError(429,500);
    return 'ok';
  },{maxAttempts:2,maxWaitMs:1000,sleep:async(ms)=>{waits.push(ms)},onRetry:ms=>currentProviderRequestLedger()?.recordRetry('dexscreener',ms)}));
  assert.equal(result,'ok');assert.equal(tries,2);assert.deepEqual(waits,[500]);
  const resultStats=audit.since({attempts:0,reuses:0,retries:0});
  assert.equal(resultStats.outboundAttempts,2);assert.equal(resultStats.scheduledRetries,1);assert.equal(resultStats.retryWaitMs,500);
`));

test('M15.2 instruments actual fetches and records telemetry on owner-scoped Job evidence',()=>{
  const src=readFileSync('packages/intelligence/src/index.ts','utf8');
  const ui=readFileSync('apps/web/src/components/JobWorkspace.tsx','utf8');
  assert.match(src,/withProviderRequestLedger\(ledger,async\(\)=>\{/);
  assert.match(src,/ledger\?\.recordAttempt\(url,outcome,Date\.now\(\)-started,statusCode\)/);
  assert.match(src,/recordReuse\('dexscreener'\)/);
  assert.match(src,/recordReuse\('nansen'\)/);
  assert.match(src,/evidence=\{\.\.\.evidence,data:\{\.\.\.evidence\.data,requestTelemetry:ledger\.since\(mark\)\}\}/);
  assert.match(src,/if\(invocation\.provider!=='telegraph'\)/);
  assert.match(src,/await persistIntelligenceEvidence\(args\.ownerUserId,evidence\)/);
  assert.match(ui,/summarizeJobRequestMetrics\(intelligenceEvidence\)/);
  assert.match(ui,/Attempts are not billed API calls/);
  assert.match(src,/requestParameters:\{provider:'alchemy',method:'getTokenHoldersAtSlot'/);
  assert.match(src,/data:\{failure:classifyProviderFailure\(error\)\}/);
  assert.match(readFileSync('.env.example','utf8'),/MAINNET_AUTONOMY_ENABLED=false/);
});
