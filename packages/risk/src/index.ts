export type RiskCheckStatus = 'PASS' | 'WARNING' | 'FAILED' | 'NOT_AVAILABLE';
export interface RiskCheck { code:string; label:string; status:RiskCheckStatus; message:string }
export interface RiskAssessment { status:'PASS'|'WARNING'|'FAILED'; checks:RiskCheck[] }

export interface ActionRiskInput {
  validationOk:boolean;
  quoteRequired:boolean;
  quoteStatus?:'AVAILABLE'|'NOT_AVAILABLE'|'FAILED';
  quoteExpiresAt?:string;
  simulationStatus:'PASSED'|'FAILED'|'NOT_AVAILABLE'|'STALE';
  slippageBps?:number;
  maxSlippageBps?:number;
  destinationPresent:boolean;
  protocolPresent:boolean;
  now?:Date;
}

export function assessActionRisk(input:ActionRiskInput):RiskAssessment {
  const now=input.now??new Date(); const checks:RiskCheck[]=[];
  checks.push({code:'VALIDATION',label:'Action validation',status:input.validationOk?'PASS':'FAILED',message:input.validationOk?'Structured action is valid.':'Structured action validation failed.'});
  if(input.quoteRequired){
    if(input.quoteStatus==='AVAILABLE'){
      const expired=input.quoteExpiresAt ? new Date(input.quoteExpiresAt).getTime()<=now.getTime() : false;
      checks.push({code:'QUOTE_FRESHNESS',label:'Quote freshness',status:expired?'FAILED':'PASS',message:expired?'Quote has expired.':'Executable quote is current.'});
    } else checks.push({code:'QUOTE_AVAILABILITY',label:'Executable quote',status:'WARNING',message:'No executable provider quote is available; preparation remains non-submittable.'});
  }
  checks.push({code:'SIMULATION',label:'Simulation / preflight',status:input.simulationStatus==='PASSED'?'PASS':input.simulationStatus==='FAILED'?'FAILED':'WARNING',message:input.simulationStatus==='PASSED'?'Preflight passed.':input.simulationStatus==='FAILED'?'Preflight failed.':'Preflight is not available for this prepared action.'});
  if(input.slippageBps!==undefined){ const max=input.maxSlippageBps??100; checks.push({code:'SLIPPAGE',label:'Slippage',status:input.slippageBps<=max?'PASS':'FAILED',message:`Configured slippage is ${input.slippageBps} bps; policy maximum is ${max} bps.`}); }
  checks.push({code:'DESTINATION',label:'Destination',status:input.destinationPresent?'PASS':'WARNING',message:input.destinationPresent?'Destination is explicit.':'No explicit destination is present.'});
  if(input.protocolPresent) checks.push({code:'PROTOCOL',label:'Protocol',status:'PASS',message:'Protocol/provider context is explicit.'});
  const status:RiskAssessment['status']=checks.some(c=>c.status==='FAILED')?'FAILED':checks.some(c=>c.status==='WARNING'||c.status==='NOT_AVAILABLE')?'WARNING':'PASS';
  return {status,checks};
}

export const moduleManifest={name:'risk',layer:'trusted-core',milestone:8,status:'action-preflight-risk'} as const;
