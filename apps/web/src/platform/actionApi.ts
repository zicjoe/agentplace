import { WEB_RUNTIME_SETTINGS } from './runtime';

export interface ApiPreparedAction {
  revision:number; actionDigest:string; payload:Record<string,unknown>; validation:{ok:boolean;reasons:string[]};
  authorityDecision:{id:string;decision:'ALLOWED'|'APPROVAL_REQUIRED'|'DENIED';reasons:Array<{code:string;message:string}>};
  risk:{status:'PASS'|'WARNING'|'FAILED';checks:Array<{code:string;label:string;status:string;message:string}>};
  quote?:{id:string;provider:string;status:'AVAILABLE'|'NOT_AVAILABLE'|'FAILED';estimatedOutput?:string;minimumOutput?:string;estimatedCost?:string;routeSummary?:string;quotedAt:string;expiresAt?:string};
  simulation:{id:string;status:'PASSED'|'FAILED'|'NOT_AVAILABLE'|'STALE';method:string;summary:string;gasEstimate?:string;createdAt:string};
  expiresAt?:string; createdAt:string;
}
export interface ApiFinancialAction {
  id:string; accountId:string; workerId?:string; jobId?:string; environment:'mainnet'|'testnet'; actionType:'transfer'|'swap'|'bridge'; capabilityId:string;
  title:string; rationale:string; network:{family:string;networkId:string}; destinationNetwork?:{family:string;networkId:string}; asset:string; assetAddress?:string;
  outputAsset?:string; outputAssetAddress?:string; amountDisplay:string; amountAtomic?:string; valueUsd?:string; protocol?:string; destination?:string; slippageBps?:number;
  status:'DRAFT'|'PREPARED'|'APPROVAL_REQUIRED'|'DENIED'|'READY_FOR_EXECUTION'|'REJECTED'|'EXPIRED'; currentRevision:number; createdAt:string; updatedAt:string; prepared?:ApiPreparedAction;
}
function endpoint(path:string){return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`}
async function request<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch(endpoint(path),{...init,credentials:'include',headers:{'content-type':'application/json',accept:'application/json',...(init?.headers??{})}});const p=await r.json().catch(()=>null) as any;if(!r.ok)throw new Error(p?.message||`AgentPlace action request failed (${r.status})`);return p as T;}
export async function createAction(input:Record<string,unknown>):Promise<ApiFinancialAction>{return (await request<{action:ApiFinancialAction}>('/api/v1/actions',{method:'POST',body:JSON.stringify({action:input})})).action}
export async function prepareAction(id:string):Promise<ApiFinancialAction>{return (await request<{action:ApiFinancialAction}>(`/api/v1/actions/${encodeURIComponent(id)}/prepare`,{method:'POST',body:'{}'})).action}
export async function fetchAction(id:string):Promise<ApiFinancialAction>{return (await request<{action:ApiFinancialAction}>(`/api/v1/actions/${encodeURIComponent(id)}`)).action}
export async function decideAction(id:string,decision:'APPROVED'|'REJECTED'):Promise<ApiFinancialAction>{return (await request<{action:ApiFinancialAction}>(`/api/v1/actions/${encodeURIComponent(id)}/approval`,{method:'POST',body:JSON.stringify({decision})})).action}
