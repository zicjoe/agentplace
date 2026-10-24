import { WEB_RUNTIME_SETTINGS } from './runtime';
import type {
  CapabilityDraftData,
  CreatorAsset,
  CreatorAssetVisibility,
  DiscoverSupplyItem,
  WorkflowDraftData,
  WorkerDraftData,
} from '../state/types';

interface ApiDiscoverItem {
  id:string; type:'worker'|'workflow'|'capability'; assetId:string; workerDefinitionId?:string; name:string; tagline:string; description:string;
  creatorName:string; isOriginal:boolean; category:string; networks:string[]; pricing:{type:'free'|'paid';label?:string}; visibility:'public'|'unlisted';
  authorityDefault?:string; sponsored:boolean; version:string; readiness:'available'|'limited'|'preview'|'unavailable'; readinessReason:string;
  requiredCapabilities:string[]; lastUpdated:string; forkSourceId?:string; forkSourceName?:string; forkSourceCreator?:string; allowsCustomization:boolean;
}
interface ApiCreatorAsset {
  id:string; type:'worker'|'workflow'|'capability'; visibility:'draft'|'tested'|'private'|'unlisted'|'published'|'retired'; name:string; version:string;
  versionHistory?:Array<{versionId:string;version:string;releasedAt:string}>;
  createdAt:string; updatedAt:string; worker?:ApiWorkerDraft; workflow?:ApiWorkflowDraft; capability?:ApiCapabilityDraft;
  lineage?:{sourceType:'worker'|'workflow'|'capability';sourceId:string;sourceVersionId?:string;sourceName:string;sourceCreator:string};
}
interface ApiWorkerDraft {
  name:string; tagline:string; responsibility:string; category:string; mission:string; responsibilities:string[]; antiJobs:string[]; expectedOutputs:string[];
  successConditions:string[]; method:string[]; capabilityRequirements:string[]; networks:string[]; authorityDefault:string;
  collaborators?:Array<{role:string;pinnedWorkerId?:string;roleBased?:boolean;required:boolean;whenUsed:string;contextShared:string;authorityBoundary:string}>;
  lineage?:{sourceType:'worker'|'workflow'|'capability';sourceId:string;sourceVersionId?:string;sourceName:string;sourceCreator:string};
}

export interface CreatorBuilderSessionSnapshot {
  workerId:string;
  step:string;
  teachMode:boolean;
  testJobId?:string;
  draft:WorkerDraftData;
  messages:Array<{id:string;role:'user'|'builder';content:string}>;
  updatedAt:Date;
}
interface ApiCreatorBuilderSession {
  workerId:string;
  step:string;
  teachMode:boolean;
  testJobId?:string;
  draft:ApiWorkerDraft;
  messages:Array<{id:string;role:'user'|'builder';content:string}>;
  updatedAt:string;
}
interface ApiWorkflowDraft { name:string;purpose:string;inputs:string[];steps:string[];conditions:string[];outputs:string[];requiredCapabilities:string[];safetyBoundaries:string[];compatibleWorkers:string[]; }
export interface CreatorWorkflowBuilderSessionSnapshot {
  workflowId:string;
  step:string;
  draft:WorkflowDraftData;
  messages:Array<{id:string;role:'user'|'studio';content:string}>;
  updatedAt:Date;
}
interface ApiCreatorWorkflowBuilderSession {
  workflowId:string;
  step:string;
  draft:ApiWorkflowDraft;
  messages:Array<{id:string;role:'user'|'studio';content:string}>;
  updatedAt:string;
}
interface ApiCapabilityDraft { name:string;importType:'mcp'|'openapi';endpoint?:string;provider?:string;version?:string;operations:Array<{original:string;canonical?:string;classification:'read'|'prepare'|'execution-sensitive';description:string;sandboxEligible?:boolean}>; }

function endpoint(path:string):string{return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`;}
async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(endpoint(path),{...init,credentials:'include',headers:{accept:'application/json','content-type':'application/json',...(init?.headers??{})}});
  if(!response.ok){const payload=await response.json().catch(()=>null) as {message?:string}|null;throw new Error(payload?.message||`AgentPlace API request failed (${response.status})`);} return await response.json() as T;
}

function fromDiscover(value:ApiDiscoverItem):DiscoverSupplyItem{
  const out:DiscoverSupplyItem={id:value.id,type:value.type,name:value.name,tagline:value.tagline,description:value.description,creatorId:value.isOriginal?'agentplace':'creator',creatorName:value.creatorName,isOriginal:value.isOriginal,category:value.category,networks:value.networks,pricing:value.pricing,visibility:value.visibility,sponsored:value.sponsored,lastUpdated:new Date(value.lastUpdated),version:value.version,allowsCustomization:value.allowsCustomization,readiness:value.readiness,readinessReason:value.readinessReason,requiredCapabilities:value.requiredCapabilities}; if(value.authorityDefault)out.authorityDefault=value.authorityDefault;
  if(value.workerDefinitionId)out.workerDefinitionId=value.workerDefinitionId;if(value.forkSourceId)out.forkSourceId=value.forkSourceId;if(value.forkSourceName)out.forkSourceName=value.forkSourceName;if(value.forkSourceCreator)out.forkSourceCreator=value.forkSourceCreator;return out;
}
function creatorVisibility(value:ApiCreatorAsset['visibility']):CreatorAssetVisibility{return value==='published'?'public':value==='retired'?'private':value;}
function workerDraft(value:ApiWorkerDraft):WorkerDraftData{
  return {name:value.name,jobContract:value.mission,responsibilities:value.responsibilities,antiJobs:value.antiJobs,method:value.method,collaborators:(value.collaborators??[]).map((item,index)=>({id:`collab-${index}`,role:item.role,...(item.pinnedWorkerId?{pinnedWorkerId:item.pinnedWorkerId}:{ }),roleBased:item.roleBased??false,whenUsed:item.whenUsed,contextShared:item.contextShared,required:item.required,authorityBoundary:item.authorityBoundary})),capabilities:value.capabilityRequirements,routineTemplates:[],authorityDefault:value.authorityDefault,serviceBudget:'Creator Worker service budget is configured separately',testCases:[],testResults:[],networks:value.networks,pricing:{type:'free'},...(value.lineage?{lineageSourceId:value.lineage.sourceId,lineageSourceName:value.lineage.sourceName,lineageSourceCreator:value.lineage.sourceCreator}:{})};
}
function fromAsset(value:ApiCreatorAsset):CreatorAsset{
  const out:CreatorAsset={id:value.id,type:value.type,visibility:creatorVisibility(value.visibility),version:value.version,...(value.versionHistory?{versionHistory:value.versionHistory.map((item)=>({versionId:item.versionId,version:item.version,releasedAt:new Date(item.releasedAt)}))}:{}),createdAt:new Date(value.createdAt),updatedAt:new Date(value.updatedAt)};
  if(value.worker)out.workerDraft=workerDraft(value.worker);
  if(value.workflow)out.workflowDraft={...value.workflow,pricing:{type:'free'}} as WorkflowDraftData;
  if(value.capability)out.capabilityDraft={name:value.capability.name,importType:value.capability.importType,...(value.capability.endpoint?{endpoint:value.capability.endpoint}:{}),operations:value.capability.operations.map((op)=>({original:op.original,canonical:op.canonical??'',classification:op.classification,description:op.description,...(op.sandboxEligible===undefined?{}:{sandboxEligible:op.sandboxEligible})})),...(value.capability.provider?{provider:value.capability.provider}:{}),...(value.capability.version?{version:value.capability.version}:{}),pricing:{type:'free'}} as CapabilityDraftData;
  return out;
}

export async function fetchDiscoverSupply():Promise<DiscoverSupplyItem[]>{const data=await request<{supply:ApiDiscoverItem[]}>('/api/v1/discover');return data.supply.map(fromDiscover);}
export async function fetchCreatorAssets():Promise<CreatorAsset[]>{const data=await request<{assets:ApiCreatorAsset[]}>('/api/v1/creator/assets');return data.assets.map(fromAsset);}

function toWorkerDraft(draft:WorkerDraftData){return {name:draft.name,tagline:draft.jobContract.slice(0,180)||draft.name,responsibility:draft.jobContract,category:'Creator',mission:draft.jobContract,responsibilities:draft.responsibilities,antiJobs:draft.antiJobs,expectedOutputs:['Evidence-backed result'],successConditions:['Output is grounded in available evidence and respects the Job Contract'],method:draft.method,capabilityRequirements:draft.capabilities,networks:draft.networks,authorityDefault:draft.authorityDefault,collaborators:draft.collaborators.map((item)=>({role:item.role,...(item.pinnedWorkerId?{pinnedWorkerId:item.pinnedWorkerId}:{}),roleBased:item.roleBased,required:item.required,whenUsed:item.whenUsed,contextShared:item.contextShared,authorityBoundary:item.authorityBoundary})),...(draft.lineageSourceId?{lineage:{sourceType:'worker' as const,sourceId:draft.lineageSourceId,sourceName:draft.lineageSourceName??'Source Worker',sourceCreator:draft.lineageSourceCreator??'Unknown'}}:{})};}
export async function createCreatorWorker(draft:WorkerDraftData):Promise<CreatorAsset>{const data=await request<{asset:ApiCreatorAsset}>('/api/v1/creator/workers',{method:'POST',body:JSON.stringify({draft:toWorkerDraft(draft)})});return fromAsset(data.asset);}
export async function createCreatorWorkflow(draft:WorkflowDraftData):Promise<CreatorAsset>{const data=await request<{asset:ApiCreatorAsset}>('/api/v1/creator/workflows',{method:'POST',body:JSON.stringify({draft:{name:draft.name,purpose:draft.purpose,inputs:draft.inputs,steps:draft.steps,conditions:draft.conditions,outputs:draft.outputs,requiredCapabilities:draft.requiredCapabilities,safetyBoundaries:draft.safetyBoundaries,compatibleWorkers:draft.compatibleWorkers}})});return fromAsset(data.asset);}

export async function createCreatorWorkflowVersion(workflowId:string,draft:WorkflowDraftData):Promise<CreatorAsset>{const data=await request<{asset:ApiCreatorAsset}>(`/api/v1/creator/workflows/${encodeURIComponent(workflowId)}/versions`,{method:'POST',body:JSON.stringify({draft:{name:draft.name,purpose:draft.purpose,inputs:draft.inputs,steps:draft.steps,conditions:draft.conditions,outputs:draft.outputs,requiredCapabilities:draft.requiredCapabilities,safetyBoundaries:draft.safetyBoundaries,compatibleWorkers:draft.compatibleWorkers}})});return fromAsset(data.asset);}

export async function interpretCreatorWorkflowTurn(input:{message:string;draft:WorkflowDraftData}):Promise<{intent:'DISCUSS'|'MODIFY_DRAFT';reply:string;draft:WorkflowDraftData;model:{label:string;provider:string;model:string}}>{
  const data=await request<{intent:'DISCUSS'|'MODIFY_DRAFT';reply:string;draft:Omit<WorkflowDraftData,'pricing'>;model:{label:string;provider:string;model:string}}>('/api/v1/creator/workflows/builder-turn',{method:'POST',body:JSON.stringify({message:input.message,draft:{name:input.draft.name,purpose:input.draft.purpose,inputs:input.draft.inputs,steps:input.draft.steps,conditions:input.draft.conditions,outputs:input.draft.outputs,requiredCapabilities:input.draft.requiredCapabilities,safetyBoundaries:input.draft.safetyBoundaries,compatibleWorkers:input.draft.compatibleWorkers}})});
  return {...data,draft:{...data.draft,pricing:{type:'free'}}};
}

export async function fetchCreatorWorkflowBuilderSession(workflowId:string):Promise<CreatorWorkflowBuilderSessionSnapshot|null>{
  const data=await request<{session:ApiCreatorWorkflowBuilderSession|null}>(`/api/v1/creator/workflows/${encodeURIComponent(workflowId)}/builder-session`);
  if(!data.session)return null;
  return {workflowId:data.session.workflowId,step:data.session.step,draft:{...data.session.draft,pricing:{type:'free'}},messages:data.session.messages,updatedAt:new Date(data.session.updatedAt)};
}

export async function saveCreatorWorkflowBuilderSession(workflowId:string,snapshot:{step:string;draft:WorkflowDraftData;messages:Array<{id:string;role:'user'|'studio';content:string}>}):Promise<CreatorWorkflowBuilderSessionSnapshot>{
  const data=await request<{session:ApiCreatorWorkflowBuilderSession}>(`/api/v1/creator/workflows/${encodeURIComponent(workflowId)}/builder-session`,{method:'PUT',body:JSON.stringify({step:snapshot.step,draft:{name:snapshot.draft.name,purpose:snapshot.draft.purpose,inputs:snapshot.draft.inputs,steps:snapshot.draft.steps,conditions:snapshot.draft.conditions,outputs:snapshot.draft.outputs,requiredCapabilities:snapshot.draft.requiredCapabilities,safetyBoundaries:snapshot.draft.safetyBoundaries,compatibleWorkers:snapshot.draft.compatibleWorkers},messages:snapshot.messages})});
  return {workflowId:data.session.workflowId,step:data.session.step,draft:{...data.session.draft,pricing:{type:'free'}},messages:data.session.messages,updatedAt:new Date(data.session.updatedAt)};
}
export async function createCreatorCapability(draft:CapabilityDraftData):Promise<CreatorAsset>{const data=await request<{asset:ApiCreatorAsset}>('/api/v1/creator/capabilities',{method:'POST',body:JSON.stringify({draft:{name:draft.name,importType:draft.importType,endpoint:draft.endpoint,provider:draft.provider,version:draft.version,operations:draft.operations}})});return fromAsset(data.asset);}
export async function forkCreatorWorker(sourceDefinitionId:string):Promise<CreatorAsset>{const data=await request<{asset:ApiCreatorAsset}>(`/api/v1/creator/workers/${encodeURIComponent(sourceDefinitionId)}/fork`,{method:'POST'});return fromAsset(data.asset);}
export async function publishCreatorAsset(type:'worker'|'workflow'|'capability',id:string,visibility:'private'|'unlisted'|'published'):Promise<void>{await request(`/api/v1/creator/${type}s/${encodeURIComponent(id)}/publish`,{method:'POST',body:JSON.stringify({visibility})});}

export async function tryDiscoverWorker(workerDefinitionId:string,prompt:string):Promise<{jobId:string;conversationId?:string}>{
  const data=await request<{job:{id:string;jobConversationId?:string}}>(`/api/v1/discover/workers/${encodeURIComponent(workerDefinitionId)}/try`,{method:'POST',body:JSON.stringify({prompt})});
  return {jobId:data.job.id,...(data.job.jobConversationId?{conversationId:data.job.jobConversationId}:{})};
}

export async function testCreatorWorker(workerId:string,scenario:string,expected:string):Promise<{jobId:string;conversationId?:string}>{
  const data=await request<{job:{id:string;jobConversationId?:string}}>(`/api/v1/creator/workers/${encodeURIComponent(workerId)}/test`,{method:'POST',body:JSON.stringify({scenario,expected})});
  return {jobId:data.job.id,...(data.job.jobConversationId?{conversationId:data.job.jobConversationId}:{})};
}

export async function createCreatorWorkerVersion(workerId:string,draft:WorkerDraftData):Promise<CreatorAsset>{
  const data=await request<{asset:ApiCreatorAsset}>(`/api/v1/creator/workers/${encodeURIComponent(workerId)}/versions`,{method:'POST',body:JSON.stringify({draft:toWorkerDraft(draft)})});
  return fromAsset(data.asset);
}

export async function inspectCreatorCapability(input:{importType:'mcp'|'openapi';endpoint?:string;sourceText?:string}):Promise<{operations:CapabilityDraftData['operations'];endpoint?:string;notice:string}>{
  const data=await request<{operations:Array<{original:string;classification:'read'|'prepare'|'execution-sensitive';description:string;canonical?:string;sandboxEligible?:boolean}>;endpoint:string|null;notice:string}>('/api/v1/creator/capabilities/inspect',{method:'POST',body:JSON.stringify(input)});
  return {operations:data.operations.map((operation)=>({original:operation.original,canonical:operation.canonical??'',classification:operation.classification,description:operation.description,...(operation.sandboxEligible===undefined?{}:{sandboxEligible:operation.sandboxEligible})})),...(data.endpoint?{endpoint:data.endpoint}:{}),notice:data.notice};
}

export async function testCreatorCapabilityRead(input:{importType:'openapi';endpoint:string;operation:string}):Promise<{status:number;url:string;preview:string;notice:string}>{return request('/api/v1/creator/capabilities/sandbox-test',{method:'POST',body:JSON.stringify(input)});}



export type CreatorBuilderIntent = 'DISCUSS'|'MODIFY_DRAFT'|'TEACH'|'TEST'|'SAVE_PRIVATE'|'PUBLISH'|'UNDO'|'USE_EXISTING_EXPERTISE';
export interface CreatorBuilderTurnResult {
  intent:CreatorBuilderIntent;
  reply:string;
  draft:WorkerDraftData;
  appliedOperations:Array<{type:string}>;
  rejectedOperations:Array<{type:string;reason:string}>;
  testScenario:string;
  testExpected:string;
  model:{label:string;provider:string;model:string};
}

export async function interpretCreatorBuilderTurn(workerId:string,input:{message:string;mode:'build'|'edit'|'teach';draft:WorkerDraftData;messages:Array<{role:'user'|'builder';content:string}>}):Promise<CreatorBuilderTurnResult>{
  const data=await request<{intent:CreatorBuilderIntent;reply:string;draft:ApiWorkerDraft;appliedOperations:Array<{type:string}>;rejectedOperations:Array<{type:string;reason:string}>;testScenario:string;testExpected:string;model:{label:string;provider:string;model:string}}>(`/api/v1/creator/workers/${encodeURIComponent(workerId)}/builder-turn`,{method:'POST',body:JSON.stringify({message:input.message,mode:input.mode,draft:toWorkerDraft(input.draft),messages:input.messages.slice(-12)})});
  return {intent:data.intent,reply:data.reply,draft:workerDraft(data.draft),appliedOperations:data.appliedOperations,rejectedOperations:data.rejectedOperations,testScenario:data.testScenario,testExpected:data.testExpected,model:data.model};
}

export async function fetchCreatorBuilderSession(workerId:string):Promise<CreatorBuilderSessionSnapshot|null>{
  const data=await request<{session:ApiCreatorBuilderSession|null}>(`/api/v1/creator/workers/${encodeURIComponent(workerId)}/builder-session`);
  if(!data.session)return null;
  return {workerId:data.session.workerId,step:data.session.step,teachMode:data.session.teachMode,...(data.session.testJobId?{testJobId:data.session.testJobId}:{}),draft:workerDraft(data.session.draft),messages:data.session.messages,updatedAt:new Date(data.session.updatedAt)};
}

export async function saveCreatorBuilderSession(workerId:string,snapshot:{step:string;teachMode:boolean;testJobId?:string;draft:WorkerDraftData;messages:Array<{id:string;role:'user'|'builder';content:string}>}):Promise<CreatorBuilderSessionSnapshot>{
  const data=await request<{session:ApiCreatorBuilderSession}>(`/api/v1/creator/workers/${encodeURIComponent(workerId)}/builder-session`,{method:'PUT',body:JSON.stringify({step:snapshot.step,teachMode:snapshot.teachMode,...(snapshot.testJobId?{testJobId:snapshot.testJobId}:{}),draft:toWorkerDraft(snapshot.draft),messages:snapshot.messages})});
  return {workerId:data.session.workerId,step:data.session.step,teachMode:data.session.teachMode,...(data.session.testJobId?{testJobId:data.session.testJobId}:{}),draft:workerDraft(data.session.draft),messages:data.session.messages,updatedAt:new Date(data.session.updatedAt)};
}
