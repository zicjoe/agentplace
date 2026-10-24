import { WEB_RUNTIME_SETTINGS } from './runtime';

export interface SecurityHistoryEntry { id:string;eventType:string;objectType:string;objectId:string;title:string;summary:string;effect?:string;status:string;workerId?:string;jobId?:string;occurredAt:string;metadata:Record<string,unknown>; }
export interface SecurityQuarantine { id:string;targetType:'worker'|'capability';targetId:string;targetName:string;reason:string;status:'active'|'released';createdAt:string;releasedAt?:string; }
export interface SecurityStateSnapshot { history:SecurityHistoryEntry[];quarantines:SecurityQuarantine[]; }
function endpoint(path:string):string{return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`;}
async function request<T>(path:string,init?:RequestInit):Promise<T>{const response=await fetch(endpoint(path),{...init,credentials:'include',headers:{accept:'application/json','content-type':'application/json',...(init?.headers??{})}});const payload=await response.json().catch(()=>null) as ({message?:string}&T)|null;if(!response.ok)throw new Error(payload?.message||`AgentPlace security request failed (${response.status})`);return payload as T;}
export async function fetchSecurityState():Promise<SecurityStateSnapshot>{return request<SecurityStateSnapshot>('/api/v1/security');}
export async function emergencyStopFutureExecution():Promise<{actionsStopped:number;walletPromptsStopped:number;submittedUntouched:number}>{return (await request<{result:{actionsStopped:number;walletPromptsStopped:number;submittedUntouched:number}}>('/api/v1/security/emergency-stop',{method:'POST',body:'{}'})).result;}
export async function quarantineCreatorSupply(targetType:'worker'|'capability',targetId:string,reason:string):Promise<SecurityQuarantine>{return (await request<{quarantine:SecurityQuarantine}>('/api/v1/security/quarantines',{method:'POST',body:JSON.stringify({targetType,targetId,reason})})).quarantine;}
export async function releaseCreatorSupplyQuarantine(id:string):Promise<void>{await request(`/api/v1/security/quarantines/${encodeURIComponent(id)}/release`,{method:'POST',body:'{}'});}
