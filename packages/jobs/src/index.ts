import { randomUUID } from 'node:crypto';
import { getDatabasePool, withTransaction } from '@agent-place/db';

export const jobStatuses = ['PLANNED','RUNNING','PREPARING','AWAITING_APPROVAL','AUTHORIZED','SUBMITTED','CONFIRMING','SETTLING','VERIFYING','COMPLETED','RECOVERING','PAUSED','BLOCKED','FAILED_RECOVERABLE','FAILED_FINAL','REQUIRES_USER'] as const;
export type JobStatus = (typeof jobStatuses)[number];
export type JobEnvironment = 'mainnet' | 'testnet';
export type JobKind = 'research' | 'operational' | 'financial';
export type JobOriginType = 'user' | 'worker' | 'routine' | 'agentplace';

export interface DurableJobStage { id: string; label: string; status: 'done'|'active'|'pending'; ordinal: number; }
export interface DurableJob {
  id: string; title: string; goal: string; status: JobStatus; environment: JobEnvironment; kind: JobKind; originType: JobOriginType;
  leadWorkerId: string; leadWorkerName: string; supportingWorkerIds: string[]; supportingWorkerNames: string[];
  originWorkerId?: string; originConversationId?: string; jobConversationId?: string; originRoutineId?: string; routineRunId?: string; currentStage: string; stages: DurableJobStage[];
  createdAt: string; updatedAt: string;
}
export interface JobDraft extends Omit<DurableJob,'leadWorkerName'|'supportingWorkerNames'|'createdAt'|'updatedAt'> { createdAt?: string; updatedAt?: string; workerVersionOverrides?: Record<string,string>; }
export interface JobWorkerVersionAssignment { workerId:string; workerVersionId:string; role:'lead'|'supporting'; }
export interface ActivityProjection { id:string; eventType:'job'|'worker-added'|'system'|'authority'|'wallet'|'routine'|'security'|'financial'; title:string; summary:string; effect?:string; workerName?:string; workerId?:string; jobId?:string; actionId?:string; receiptId?:string; routineId?:string; timestamp:string; status:string; }

type JobRow = { id:string; title:string; goal:string; status:JobStatus; environment:JobEnvironment; kind:JobKind; origin_type:JobOriginType; origin_worker_id:string|null; origin_conversation_id:string|null; job_conversation_id:string|null; origin_routine_id:string|null; routine_run_id:string|null; current_stage:string; created_at:Date; updated_at:Date; };
type AssignmentRow = { job_id:string; worker_id:string; role:'lead'|'supporting'; name:string; };
type StageRow = { job_id:string; id:string; label:string; ordinal:number; status:'done'|'active'|'pending'; };

async function hydrate(ownerUserId:string, rows:JobRow[]):Promise<DurableJob[]> {
  if (!rows.length) return [];
  const ids = rows.map(r=>r.id);
  const [assignments, stages] = await Promise.all([
    getDatabasePool().query<AssignmentRow>(`SELECT jw.job_id,jw.worker_id,jw.role,d.name FROM job_worker jw JOIN worker_definition d ON d.id=jw.worker_id WHERE jw.owner_user_id=$1 AND jw.job_id=ANY($2::text[]) ORDER BY jw.added_at`, [ownerUserId,ids]),
    getDatabasePool().query<StageRow>(`SELECT job_id,id,label,ordinal,status FROM job_stage WHERE job_id=ANY($1::text[]) ORDER BY job_id,ordinal`, [ids]),
  ]);
  return rows.map(row=>{
    const team=assignments.rows.filter(a=>a.job_id===row.id); const lead=team.find(a=>a.role==='lead'); const support=team.filter(a=>a.role==='supporting');
    const out:DurableJob={id:row.id,title:row.title,goal:row.goal,status:row.status,environment:row.environment,kind:row.kind,originType:row.origin_type,leadWorkerId:lead?.worker_id ?? '',leadWorkerName:lead?.name ?? 'Unassigned',supportingWorkerIds:support.map(s=>s.worker_id),supportingWorkerNames:support.map(s=>s.name),currentStage:row.current_stage,stages:stages.rows.filter(s=>s.job_id===row.id),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()};
    if(row.origin_worker_id) out.originWorkerId=row.origin_worker_id; if(row.origin_conversation_id) out.originConversationId=row.origin_conversation_id; if(row.job_conversation_id) out.jobConversationId=row.job_conversation_id; if(row.origin_routine_id) out.originRoutineId=row.origin_routine_id; if(row.routine_run_id) out.routineRunId=row.routine_run_id; return out;
  });
}

export async function listJobs(ownerUserId:string):Promise<DurableJob[]> { const r=await getDatabasePool().query<JobRow>(`SELECT id,title,goal,status,environment,kind,origin_type,origin_worker_id,origin_conversation_id,job_conversation_id,origin_routine_id,routine_run_id,current_stage,created_at,updated_at FROM job WHERE owner_user_id=$1 ORDER BY updated_at DESC`,[ownerUserId]); return hydrate(ownerUserId,r.rows); }
export async function getJob(ownerUserId:string,id:string):Promise<DurableJob|null> { const r=await getDatabasePool().query<JobRow>(`SELECT id,title,goal,status,environment,kind,origin_type,origin_worker_id,origin_conversation_id,job_conversation_id,origin_routine_id,routine_run_id,current_stage,created_at,updated_at FROM job WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,id]); const values=await hydrate(ownerUserId,r.rows); return values[0]??null; }

export async function getJobWorkerVersionAssignments(ownerUserId:string,jobId:string):Promise<JobWorkerVersionAssignment[]> {
  const result=await getDatabasePool().query<{worker_id:string;worker_version_id:string;role:'lead'|'supporting'}>(`SELECT worker_id,worker_version_id,role FROM job_worker WHERE owner_user_id=$1 AND job_id=$2 ORDER BY role DESC,added_at`,[ownerUserId,jobId]);
  return result.rows.map((row)=>({workerId:row.worker_id,workerVersionId:row.worker_version_id,role:row.role}));
}

export async function createJob(ownerUserId:string,draft:JobDraft):Promise<DurableJob> {
  if(!draft.leadWorkerId) throw new Error('JOB_LEAD_REQUIRED');
  const team=[draft.leadWorkerId,...draft.supportingWorkerIds];
  const workerCheck=await getDatabasePool().query<{id:string;version_id:string}>(`SELECT d.id,COALESCE(uw.worker_version_id,latest.id) AS version_id
    FROM worker_definition d
    JOIN LATERAL (SELECT id FROM worker_version WHERE worker_definition_id=d.id AND retired_at IS NULL ORDER BY released_at DESC,id DESC LIMIT 1) latest ON true
    LEFT JOIN user_worker uw ON uw.owner_user_id=$2 AND uw.worker_definition_id=d.id AND uw.status<>'removed'
    WHERE d.id=ANY($1::text[]) AND d.trust_status<>'quarantined' AND (d.publication_status='published' OR (d.creator_user_id=$2 AND d.publication_status IN ('draft','private','unlisted','published')))`,[team,ownerUserId]);
  if(new Set(workerCheck.rows.map(r=>r.id)).size!==new Set(team).size) throw new Error('JOB_WORKER_NOT_AVAILABLE');
  const versionByWorker=new Map(workerCheck.rows.map((row)=>[row.id,row.version_id]));
  for(const [workerId,versionId] of Object.entries(draft.workerVersionOverrides??{})){
    if(!team.includes(workerId))continue;
    const exact=await getDatabasePool().query<{id:string}>(`SELECT id FROM worker_version WHERE id=$1 AND worker_definition_id=$2 AND retired_at IS NULL`,[versionId,workerId]);
    if(!exact.rows[0])throw new Error('JOB_WORKER_VERSION_NOT_AVAILABLE');
    versionByWorker.set(workerId,versionId);
  }
  await withTransaction(async db=>{
    await db.query(`INSERT INTO job(id,owner_user_id,title,goal,status,environment,kind,origin_type,origin_worker_id,origin_conversation_id,job_conversation_id,origin_routine_id,routine_run_id,current_stage,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15::timestamptz,now()),COALESCE($16::timestamptz,now()))
      ON CONFLICT(id) DO NOTHING`,[draft.id,ownerUserId,draft.title,draft.goal,draft.status,draft.environment,draft.kind,draft.originType,draft.originWorkerId??null,draft.originConversationId??null,draft.jobConversationId??null,draft.originRoutineId??null,draft.routineRunId??null,draft.currentStage,draft.createdAt??null,draft.updatedAt??null]);
    const ownership=await db.query<{owner_user_id:string}>(`SELECT owner_user_id FROM job WHERE id=$1`,[draft.id]); if(ownership.rows[0]?.owner_user_id!==ownerUserId) throw new Error('JOB_ID_CONFLICT');
    await db.query(`INSERT INTO job_worker(job_id,owner_user_id,worker_id,worker_version_id,role) VALUES($1,$2,$3,$4,'lead') ON CONFLICT(job_id,worker_id) DO UPDATE SET role='lead'`,[draft.id,ownerUserId,draft.leadWorkerId,versionByWorker.get(draft.leadWorkerId)!]);
    for(const workerId of draft.supportingWorkerIds.filter(id=>id!==draft.leadWorkerId)) await db.query(`INSERT INTO job_worker(job_id,owner_user_id,worker_id,worker_version_id,role) VALUES($1,$2,$3,$4,'supporting') ON CONFLICT(job_id,worker_id) DO NOTHING`,[draft.id,ownerUserId,workerId,versionByWorker.get(workerId)!]);
    for(const stage of draft.stages) await db.query(`INSERT INTO job_stage(id,job_id,label,ordinal,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(job_id,id) DO UPDATE SET label=EXCLUDED.label,ordinal=EXCLUDED.ordinal,status=EXCLUDED.status,updated_at=now()`,[stage.id,draft.id,stage.label,stage.ordinal,stage.status]);
    await db.query(`UPDATE user_worker SET status=CASE WHEN $4 IN ('RUNNING','PREPARING') AND status NOT IN ('paused','blocked','limited','removed') THEN 'working' ELSE status END,current_job_id=$3,updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,draft.leadWorkerId,draft.id,draft.status]);
    await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,worker_id,job_id,origin_type)
      VALUES($1,$2,'job.created','job',$3,$4,$5,$6,$7,$3,$8) ON CONFLICT(id) DO NOTHING`,[`evt-job-created-${draft.id}`,ownerUserId,draft.id,draft.title,`Created · ${draft.currentStage}`,draft.status,draft.leadWorkerId,draft.originType]);
  });
  const result=await getJob(ownerUserId,draft.id); if(!result) throw new Error('JOB_CREATE_FAILED'); return result;
}

export async function setJobConversation(ownerUserId:string,jobId:string,conversationId:string):Promise<DurableJob|null> { await getDatabasePool().query(`UPDATE job SET job_conversation_id=$3,updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,jobId,conversationId]); return getJob(ownerUserId,jobId); }

export async function listActivity(ownerUserId:string):Promise<ActivityProjection[]> {
  const result=await getDatabasePool().query<{id:string;event_type:string;object_type:string;object_id:string;title:string;summary:string;effect:string|null;status:string;worker_id:string|null;job_id:string|null;metadata:Record<string,unknown>;occurred_at:Date;worker_name:string|null}>(`SELECT e.id,e.event_type,e.object_type,e.object_id,e.title,e.summary,e.effect,e.status,e.worker_id,e.job_id,e.metadata,e.occurred_at,d.name AS worker_name FROM domain_event e LEFT JOIN worker_definition d ON d.id=e.worker_id WHERE e.owner_user_id=$1 AND e.event_type NOT IN ('receipt.anchor_queued','routine.draft.created') ORDER BY e.occurred_at DESC LIMIT 500`,[ownerUserId]);
  return result.rows.map(r=>{
    const financialEvent=r.event_type.startsWith('action.')||r.event_type.startsWith('execution.')||r.event_type.startsWith('transaction.')||r.event_type.startsWith('outcome.')||r.event_type.startsWith('receipt.')||r.object_type==='financial-action'||r.object_type==='transaction-attempt'||r.object_type==='verified-outcome'||r.object_type==='verified-receipt';
    const eventType:ActivityProjection['eventType']=r.event_type.startsWith('job.')?'job':financialEvent?'financial':r.event_type==='worker.added'?'worker-added':r.event_type.startsWith('mandate.')||r.event_type.startsWith('authority.')?'authority':r.event_type.startsWith('wallet.')?'wallet':r.event_type.startsWith('routine.')?'routine':r.event_type.startsWith('security.')?'security':'system';
    const out:ActivityProjection={id:r.id,eventType,title:r.title,summary:r.summary,status:r.status,timestamp:r.occurred_at.toISOString()};
    if(r.effect) out.effect=r.effect; if(r.worker_id) out.workerId=r.worker_id; if(r.worker_name) out.workerName=r.worker_name; if(r.job_id) out.jobId=r.job_id;
    const metadata=r.metadata??{};
    const actionId=typeof metadata.actionId==='string'?metadata.actionId:r.object_type==='financial-action'?r.object_id:undefined;
    const receiptId=typeof metadata.receiptId==='string'?metadata.receiptId:r.object_type==='verified-receipt'?r.object_id:undefined;
    if(actionId) out.actionId=actionId; if(receiptId) out.receiptId=receiptId; if(eventType==='routine'&&r.object_type==='routine') out.routineId=r.object_id;
    return out;
  });
}

export const moduleManifest={name:'jobs',layer:'controlled-runtime',milestone:4,status:'durable-jobs-and-intelligence-queue'} as const;

export type IntelligenceTaskStatus='queued'|'running'|'completed'|'failed';
export interface IntelligenceTask {
  id:string; ownerUserId:string; conversationId:string; userMessageId?:string; inputSource:'USER_MESSAGE'|'ROUTINE'|'SYSTEM'; inputText?:string; routineRunId?:string; scope:'manager'|'worker'|'job'; workerId?:string; jobId?:string;
  providerPreference:'auto'|'openai'|'gemini'|'anthropic'; modelPreference?:string; status:IntelligenceTaskStatus; attempts:number; maxAttempts:number; lastError?:string;
  createdAt:string; startedAt?:string; completedAt?:string;
}
type IntelligenceTaskRow={id:string;owner_user_id:string;conversation_id:string;user_message_id:string|null;input_source:'USER_MESSAGE'|'ROUTINE'|'SYSTEM';input_text:string|null;routine_run_id:string|null;scope:'manager'|'worker'|'job';worker_id:string|null;job_id:string|null;provider_preference:'auto'|'openai'|'gemini'|'anthropic';model_preference:string|null;status:IntelligenceTaskStatus;attempts:number;max_attempts:number;last_error:string|null;created_at:Date;started_at:Date|null;completed_at:Date|null};
function mapIntelligenceTask(row:IntelligenceTaskRow):IntelligenceTask { const out:IntelligenceTask={id:row.id,ownerUserId:row.owner_user_id,conversationId:row.conversation_id,inputSource:row.input_source,scope:row.scope,providerPreference:row.provider_preference,status:row.status,attempts:row.attempts,maxAttempts:row.max_attempts,createdAt:row.created_at.toISOString()}; if(row.user_message_id)out.userMessageId=row.user_message_id;if(row.input_text)out.inputText=row.input_text;if(row.routine_run_id)out.routineRunId=row.routine_run_id;if(row.worker_id)out.workerId=row.worker_id;if(row.job_id)out.jobId=row.job_id;if(row.model_preference)out.modelPreference=row.model_preference;if(row.last_error)out.lastError=row.last_error;if(row.started_at)out.startedAt=row.started_at.toISOString();if(row.completed_at)out.completedAt=row.completed_at.toISOString();return out; }

export async function enqueueIntelligenceTask(args:{ownerUserId:string;conversationId:string;userMessageId?:string;inputSource?:'USER_MESSAGE'|'ROUTINE'|'SYSTEM';inputText?:string;routineRunId?:string;scope:'manager'|'worker'|'job';workerId?:string;jobId?:string;providerPreference?:'auto'|'openai'|'gemini'|'anthropic';modelPreference?:string}):Promise<IntelligenceTask> {
  const inputSource=args.inputSource??'USER_MESSAGE';
  if(inputSource==='USER_MESSAGE'&&!args.userMessageId) throw new Error('INTELLIGENCE_USER_MESSAGE_REQUIRED');
  if(inputSource!=='USER_MESSAGE'&&!args.inputText?.trim()) throw new Error('INTELLIGENCE_INPUT_TEXT_REQUIRED');
  const id=`aitask_${randomUUID()}`;
  const result=await getDatabasePool().query<IntelligenceTaskRow>(
    `INSERT INTO intelligence_task(id,owner_user_id,conversation_id,user_message_id,input_source,input_text,routine_run_id,scope,worker_id,job_id,provider_preference,model_preference)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT DO NOTHING
     RETURNING *`,[id,args.ownerUserId,args.conversationId,args.userMessageId??null,inputSource,args.inputText??null,args.routineRunId??null,args.scope,args.workerId??null,args.jobId??null,args.providerPreference??'auto',args.modelPreference??null]);
  let row=result.rows[0];
  if(!row&&args.routineRunId){
    const existing=await getDatabasePool().query<IntelligenceTaskRow>(`SELECT * FROM intelligence_task WHERE routine_run_id=$1 LIMIT 1`,[args.routineRunId]);
    row=existing.rows[0];
  } else if(!row&&args.userMessageId) {
    const existing=await getDatabasePool().query<IntelligenceTaskRow>(`SELECT * FROM intelligence_task WHERE owner_user_id=$1 AND conversation_id=$2 AND user_message_id=$3 LIMIT 1`,[args.ownerUserId,args.conversationId,args.userMessageId]);
    row=existing.rows[0];
  }
  if(!row) throw new Error('INTELLIGENCE_TASK_ENQUEUE_FAILED'); return mapIntelligenceTask(row);
}

export async function getIntelligenceTask(ownerUserId:string,id:string):Promise<IntelligenceTask|null>{ const r=await getDatabasePool().query<IntelligenceTaskRow>(`SELECT * FROM intelligence_task WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,id]);return r.rows[0]?mapIntelligenceTask(r.rows[0]):null; }

export async function getLatestIntelligenceTask(ownerUserId:string,conversationId:string):Promise<IntelligenceTask|null>{ const r=await getDatabasePool().query<IntelligenceTaskRow>(`SELECT * FROM intelligence_task WHERE owner_user_id=$1 AND conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1`,[ownerUserId,conversationId]);return r.rows[0]?mapIntelligenceTask(r.rows[0]):null; }

export async function claimNextIntelligenceTask():Promise<IntelligenceTask|null>{
  return withTransaction(async db=>{
    const result=await db.query<IntelligenceTaskRow>(
      `SELECT * FROM intelligence_task
       WHERE (status='queued' OR (status='running' AND lease_until < now())) AND attempts < max_attempts
       ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`);
    const row=result.rows[0]; if(!row) return null;
    const updated=await db.query<IntelligenceTaskRow>(
      `UPDATE intelligence_task SET status='running',attempts=attempts+1,started_at=COALESCE(started_at,now()),lease_until=now()+interval '3 minutes',updated_at=now(),last_error=NULL WHERE id=$1 RETURNING *`,[row.id]);
    return updated.rows[0]?mapIntelligenceTask(updated.rows[0]):null;
  });
}

export async function completeIntelligenceTask(id:string):Promise<void>{ await getDatabasePool().query(`UPDATE intelligence_task SET status='completed',completed_at=now(),lease_until=NULL,updated_at=now() WHERE id=$1`,[id]); }
export async function failIntelligenceTask(id:string,error:string):Promise<void>{
  await getDatabasePool().query(`UPDATE intelligence_task SET status=CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,last_error=$2,lease_until=NULL,completed_at=CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END,updated_at=now() WHERE id=$1`,[id,error.slice(0,2000)]);
}

export async function updateJobRuntime(ownerUserId:string,jobId:string,args:{status?:JobStatus;currentStage?:string;stageId?:string;stageStatus?:'done'|'active'|'pending'}):Promise<void>{
  await withTransaction(async db=>{
    if(args.status||args.currentStage) await db.query(`UPDATE job SET status=COALESCE($3,status),current_stage=COALESCE($4,current_stage),updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,jobId,args.status??null,args.currentStage??null]);
    if(args.stageId&&args.stageStatus) await db.query(`UPDATE job_stage SET status=$4,updated_at=now() WHERE job_id=$2 AND id=$3 AND EXISTS(SELECT 1 FROM job WHERE id=$2 AND owner_user_id=$1)`,[ownerUserId,jobId,args.stageId,args.stageStatus]);
  });
}

export async function recordModelRun(args:{id:string;taskId:string;ownerUserId:string;jobId?:string;workerId?:string;provider:string;model:string;taskKind:string;contextManifest:Record<string,unknown>;inputHash:string;outputSchema?:string;inputTokens?:number;outputTokens?:number;estimatedCostUsd:number;latencyMs:number;status:'completed'|'failed';errorCode?:string}):Promise<void>{
  await getDatabasePool().query(`INSERT INTO model_run(id,task_id,owner_user_id,job_id,worker_id,provider,model,task_kind,context_manifest,input_hash,output_schema,input_tokens,output_tokens,estimated_cost_usd,latency_ms,status,error_code)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,[args.id,args.taskId,args.ownerUserId,args.jobId??null,args.workerId??null,args.provider,args.model,args.taskKind,args.contextManifest,args.inputHash,args.outputSchema??null,args.inputTokens??null,args.outputTokens??null,args.estimatedCostUsd,args.latencyMs,args.status,args.errorCode??null]);
}

export async function getDailyModelCostUsd(ownerUserId:string):Promise<number>{ const r=await getDatabasePool().query<{total:string}>(`SELECT COALESCE(sum(estimated_cost_usd),0)::text AS total FROM model_run WHERE owner_user_id=$1 AND created_at>=date_trunc('day',now())`,[ownerUserId]);return Number.parseFloat(r.rows[0]?.total??'0')||0; }

export async function addJobEvidence(ownerUserId:string,jobId:string,sources:readonly {url:string;title:string;provider:string}[]):Promise<void>{
  for(const source of sources) await getDatabasePool().query(`INSERT INTO job_evidence_source(id,job_id,owner_user_id,url,title,provider) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(job_id,url) DO UPDATE SET title=EXCLUDED.title,provider=EXCLUDED.provider,retrieved_at=now()`,[`src_${randomUUID()}`,jobId,ownerUserId,source.url,source.title,source.provider]);
}

export async function appendJobEvent(args:{ownerUserId:string;jobId:string;workerId?:string;eventType:string;title:string;summary:string;status:string;effect?:string;eventId?:string}):Promise<void>{
  await getDatabasePool().query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,worker_id,job_id,origin_type) VALUES($1,$2,$3,'job',$4,$5,$6,$7,$8,$9,$4,'agentplace') ON CONFLICT(id) DO NOTHING`,[args.eventId??`evt_${randomUUID()}`,args.ownerUserId,args.eventType,args.jobId,args.title,args.summary,args.effect??null,args.status,args.workerId??null]);
}

export async function getJobEvidence(ownerUserId:string,jobId:string):Promise<Array<{id:string;url:string;title:string;provider:string;retrievedAt:string}>>{
  const r=await getDatabasePool().query<{id:string;url:string;title:string;provider:string;retrieved_at:Date}>(`SELECT id,url,title,provider,retrieved_at FROM job_evidence_source WHERE owner_user_id=$1 AND job_id=$2 ORDER BY retrieved_at,id`,[ownerUserId,jobId]);
  return r.rows.map((row)=>({id:row.id,url:row.url,title:row.title,provider:row.provider,retrievedAt:row.retrieved_at.toISOString()}));
}
