/** Job-scoped request accounting, shown only in the expandable evidence inspector. */
interface RequestMetrics {
  outboundAttempts: number;
  cacheReuses: number;
  scheduledRetries: number;
  elapsedMs: number;
  errors: number;
}
function object(value:unknown):Record<string,unknown>{
  return value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
}
function count(value:unknown):number { return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:0; }
export function evidenceRequestMetrics(data:Record<string,unknown>):RequestMetrics|null {
  const telemetry=object(data.requestTelemetry);
  if(telemetry.version!=='m15-stage2-v1') return null;
  const requests=Array.isArray(telemetry.requests)?telemetry.requests:[];
  return {outboundAttempts:count(telemetry.outboundAttempts),cacheReuses:count(telemetry.cacheReuses),
    scheduledRetries:count(telemetry.scheduledRetries),elapsedMs:count(telemetry.elapsedMs),
    errors:requests.filter((value)=>object(value).outcome!=='ok').length};
}
export function summarizeJobRequestMetrics(items:readonly {data:Record<string,unknown>}[]):(RequestMetrics&{instrumentedEvidence:number})|null {
  const total:RequestMetrics&{instrumentedEvidence:number}={outboundAttempts:0,cacheReuses:0,scheduledRetries:0,elapsedMs:0,errors:0,instrumentedEvidence:0};
  for(const item of items){
    const record=evidenceRequestMetrics(item.data);
    if(!record) continue;
    total.instrumentedEvidence++;
    total.outboundAttempts+=record.outboundAttempts;
    total.cacheReuses+=record.cacheReuses;
    total.scheduledRetries+=record.scheduledRetries;
    total.elapsedMs+=record.elapsedMs;
    total.errors+=record.errors;
  }
  return total.instrumentedEvidence?total:null;
}
