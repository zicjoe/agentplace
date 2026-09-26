import { WEB_RUNTIME_SETTINGS } from './runtime';
import type { ActivityEvent, Job, JobProgressStage, Worker, WorkerStatus } from '../state/types';

interface ApiWorker {
  id: string;
  name: string;
  tagline: string;
  responsibility: string;
  origin: 'agentplace-original' | 'community' | 'custom';
  status: WorkerStatus | 'removed';
  currentFocus?: string;
  currentJobId?: string;
  primaryConversationId?: string;
  version: string;
  jobContract: { defaultApprovalBoundary: string; antiJobs: string[] };
}

interface ApiJobStage { id: string; label: string; status: JobProgressStage['status']; ordinal: number; }
interface ApiJob {
  id: string; title: string; goal: string;
  status: 'PLANNED'|'RUNNING'|'PREPARING'|'AWAITING_APPROVAL'|'AUTHORIZED'|'SUBMITTED'|'CONFIRMING'|'SETTLING'|'VERIFYING'|'COMPLETED'|'RECOVERING'|'PAUSED'|'BLOCKED'|'FAILED_RECOVERABLE'|'FAILED_FINAL'|'REQUIRES_USER';
  environment: 'mainnet'|'testnet'; kind: 'research'|'operational'|'financial'; originType: 'user'|'worker'|'routine'|'agentplace';
  leadWorkerId: string; leadWorkerName: string; supportingWorkerIds: string[]; supportingWorkerNames: string[];
  originWorkerId?: string; originConversationId?: string; jobConversationId?: string; currentStage: string; stages: ApiJobStage[];
  createdAt: string; updatedAt: string;
}
interface ApiActivity { id:string; eventType:ActivityEvent['eventType']; title:string; summary:string; effect?:string; workerName?:string; workerId?:string; jobId?:string; timestamp:string; status:string; }

function endpoint(path: string): string { return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`; }
async function request<T>(path:string, init?:RequestInit):Promise<T> {
  const response=await fetch(endpoint(path),{...init,credentials:'include',headers:{'content-type':'application/json',accept:'application/json',...(init?.headers??{})}});
  if(!response.ok){ const payload=await response.json().catch(()=>null) as {message?:string}|null; throw new Error(payload?.message||`AgentPlace API request failed (${response.status})`); }
  return await response.json() as T;
}

function fromWorker(value:ApiWorker):Worker {
  const out:Worker = {
    id:value.id,name:value.name,tagline:value.tagline,status:value.status==='removed'?'paused':value.status,isOriginal:value.origin==='agentplace-original',
    responsibility:value.responsibility,authoritySummary:value.jobContract.defaultApprovalBoundary || 'No financial authority',
  };
  if (value.currentFocus) out.currentFocus=value.currentFocus;
  if (value.currentJobId) out.currentJobId=value.currentJobId;
  return out;
}
function toApiStatus(status:Job['status']):ApiJob['status'] {
  switch(status){
    case 'completed': return 'COMPLETED'; case 'failed': return 'FAILED_FINAL'; case 'blocked': return 'BLOCKED'; case 'needs-approval': return 'AWAITING_APPROVAL';
    case 'executing': return 'SUBMITTED'; case 'settling': return 'SETTLING'; case 'verifying': return 'VERIFYING'; case 'recovering': return 'RECOVERING';
    case 'needs-you': return 'REQUIRES_USER'; case 'rejected': return 'BLOCKED'; case 'unknown': return 'CONFIRMING'; default: return 'RUNNING';
  }
}
function fromApiStatus(status:ApiJob['status']):Job['status'] {
  switch(status){
    case 'COMPLETED': return 'completed'; case 'FAILED_FINAL': case 'FAILED_RECOVERABLE': return 'failed'; case 'BLOCKED': return 'blocked'; case 'AWAITING_APPROVAL': return 'needs-approval';
    case 'AUTHORIZED': case 'SUBMITTED': return 'executing'; case 'SETTLING': return 'settling'; case 'VERIFYING': return 'verifying'; case 'RECOVERING': return 'recovering';
    case 'REQUIRES_USER': return 'needs-you'; case 'CONFIRMING': return 'unknown'; case 'PLANNED': return 'planning'; default: return 'working';
  }
}
function fromJob(value:ApiJob):Job {
  const out:Job = { id:value.id,title:value.title,goal:value.goal,status:fromApiStatus(value.status),leadWorkerId:value.leadWorkerId,leadWorkerName:value.leadWorkerName,
    supportingWorkerIds:value.supportingWorkerIds,supportingWorkerNames:value.supportingWorkerNames,currentStage:value.currentStage,
    stages:value.stages.map(({id,label,status})=>({id,label,status})),kind:value.kind==='operational'?'research':value.kind,environment:value.environment,
    createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt) };
  if (value.originWorkerId) out.originWorkerId=value.originWorkerId;
  if (value.originConversationId) out.originConversationId=value.originConversationId;
  return out;
}


export async function fetchWorkState():Promise<{workers:Worker[];jobs:Job[];activity:ActivityEvent[]}> {
  const [workers,jobs,activity]=await Promise.all([
    request<{workers:ApiWorker[]}>('/api/v1/workers'), request<{jobs:ApiJob[]}>('/api/v1/jobs'), request<{activity:ApiActivity[]}>('/api/v1/activity'),
  ]);
  return {workers:workers.workers.map(fromWorker),jobs:jobs.jobs.map(fromJob),activity:activity.activity.map(e=>({...e,timestamp:new Date(e.timestamp)}))};
}

export async function installDurableWorker(definitionId:string):Promise<Worker> {
  const data=await request<{worker:ApiWorker}>('/api/v1/workers',{method:'POST',body:JSON.stringify({definitionId})}); return fromWorker(data.worker);
}

export async function createDurableJob(job:Job, environment:'mainnet'|'testnet'):Promise<Job> {
  const data=await request<{job:ApiJob}>('/api/v1/jobs',{method:'POST',body:JSON.stringify({job:{
    id:job.id,title:job.title,goal:job.goal,status:'PLANNED',environment,kind:job.kind??'research',originType:job.originWorkerId?'worker':'user',leadWorkerId:job.leadWorkerId,
    supportingWorkerIds:job.supportingWorkerIds,originWorkerId:job.originWorkerId,originConversationId:job.originConversationId,currentStage:'Planned',
    stages:job.stages.map((stage,index)=>({id:stage.id,label:stage.label,status:'pending',ordinal:index})),createdAt:job.createdAt.toISOString(),updatedAt:job.updatedAt.toISOString(),
  }})}); return fromJob(data.job);
}
