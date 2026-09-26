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
  originWorkerId?: string; originConversationId?: string; jobConversationId?: string; currentStage: string; stages: DurableJobStage[];
  createdAt: string; updatedAt: string;
}
export interface JobDraft extends Omit<DurableJob,'leadWorkerName'|'supportingWorkerNames'|'createdAt'|'updatedAt'> { createdAt?: string; updatedAt?: string; }
export interface ActivityProjection { id:string; eventType:'job'|'worker-added'|'system'; title:string; summary:string; effect?:string; workerName?:string; workerId?:string; jobId?:string; timestamp:string; status:string; }

type JobRow = { id:string; title:string; goal:string; status:JobStatus; environment:JobEnvironment; kind:JobKind; origin_type:JobOriginType; origin_worker_id:string|null; origin_conversation_id:string|null; job_conversation_id:string|null; current_stage:string; created_at:Date; updated_at:Date; };
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
    if(row.origin_worker_id) out.originWorkerId=row.origin_worker_id; if(row.origin_conversation_id) out.originConversationId=row.origin_conversation_id; if(row.job_conversation_id) out.jobConversationId=row.job_conversation_id; return out;
  });
}

export async function listJobs(ownerUserId:string):Promise<DurableJob[]> { const r=await getDatabasePool().query<JobRow>(`SELECT id,title,goal,status,environment,kind,origin_type,origin_worker_id,origin_conversation_id,job_conversation_id,current_stage,created_at,updated_at FROM job WHERE owner_user_id=$1 ORDER BY updated_at DESC`,[ownerUserId]); return hydrate(ownerUserId,r.rows); }
export async function getJob(ownerUserId:string,id:string):Promise<DurableJob|null> { const r=await getDatabasePool().query<JobRow>(`SELECT id,title,goal,status,environment,kind,origin_type,origin_worker_id,origin_conversation_id,job_conversation_id,current_stage,created_at,updated_at FROM job WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,id]); const values=await hydrate(ownerUserId,r.rows); return values[0]??null; }

export async function createJob(ownerUserId:string,draft:JobDraft):Promise<DurableJob> {
  if(!draft.leadWorkerId) throw new Error('JOB_LEAD_REQUIRED');
  const team=[draft.leadWorkerId,...draft.supportingWorkerIds];
  const workerCheck=await getDatabasePool().query<{id:string}>(`SELECT id FROM worker_definition WHERE id=ANY($1::text[]) AND publication_status='published' AND trust_status<>'quarantined'`,[team]);
  if(new Set(workerCheck.rows.map(r=>r.id)).size!==new Set(team).size) throw new Error('JOB_WORKER_NOT_AVAILABLE');
  await withTransaction(async db=>{
    await db.query(`INSERT INTO job(id,owner_user_id,title,goal,status,environment,kind,origin_type,origin_worker_id,origin_conversation_id,job_conversation_id,current_stage,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13::timestamptz,now()),COALESCE($14::timestamptz,now()))
      ON CONFLICT(id) DO NOTHING`,[draft.id,ownerUserId,draft.title,draft.goal,draft.status,draft.environment,draft.kind,draft.originType,draft.originWorkerId??null,draft.originConversationId??null,draft.jobConversationId??null,draft.currentStage,draft.createdAt??null,draft.updatedAt??null]);
    const ownership=await db.query<{owner_user_id:string}>(`SELECT owner_user_id FROM job WHERE id=$1`,[draft.id]); if(ownership.rows[0]?.owner_user_id!==ownerUserId) throw new Error('JOB_ID_CONFLICT');
    await db.query(`INSERT INTO job_worker(job_id,owner_user_id,worker_id,role) VALUES($1,$2,$3,'lead') ON CONFLICT(job_id,worker_id) DO UPDATE SET role='lead'`,[draft.id,ownerUserId,draft.leadWorkerId]);
    for(const workerId of draft.supportingWorkerIds.filter(id=>id!==draft.leadWorkerId)) await db.query(`INSERT INTO job_worker(job_id,owner_user_id,worker_id,role) VALUES($1,$2,$3,'supporting') ON CONFLICT(job_id,worker_id) DO NOTHING`,[draft.id,ownerUserId,workerId]);
    for(const stage of draft.stages) await db.query(`INSERT INTO job_stage(id,job_id,label,ordinal,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(job_id,id) DO UPDATE SET label=EXCLUDED.label,ordinal=EXCLUDED.ordinal,status=EXCLUDED.status,updated_at=now()`,[stage.id,draft.id,stage.label,stage.ordinal,stage.status]);
    await db.query(`UPDATE user_worker SET status=CASE WHEN $4 IN ('RUNNING','PREPARING') AND status NOT IN ('paused','blocked','limited','removed') THEN 'working' ELSE status END,current_job_id=$3,updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,draft.leadWorkerId,draft.id,draft.status]);
    await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,worker_id,job_id,origin_type)
      VALUES($1,$2,'job.created','job',$3,$4,$5,$6,$7,$3,$8) ON CONFLICT(id) DO NOTHING`,[`evt-job-created-${draft.id}`,ownerUserId,draft.id,draft.title,`Created · ${draft.currentStage}`,draft.status,draft.leadWorkerId,draft.originType]);
  });
  const result=await getJob(ownerUserId,draft.id); if(!result) throw new Error('JOB_CREATE_FAILED'); return result;
}

export async function setJobConversation(ownerUserId:string,jobId:string,conversationId:string):Promise<DurableJob|null> { await getDatabasePool().query(`UPDATE job SET job_conversation_id=$3,updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,jobId,conversationId]); return getJob(ownerUserId,jobId); }

export async function listActivity(ownerUserId:string):Promise<ActivityProjection[]> {
  const result=await getDatabasePool().query<{id:string;event_type:string;title:string;summary:string;effect:string|null;status:string;worker_id:string|null;job_id:string|null;occurred_at:Date;worker_name:string|null}>(`SELECT e.id,e.event_type,e.title,e.summary,e.effect,e.status,e.worker_id,e.job_id,e.occurred_at,d.name AS worker_name FROM domain_event e LEFT JOIN worker_definition d ON d.id=e.worker_id WHERE e.owner_user_id=$1 ORDER BY e.occurred_at DESC LIMIT 500`,[ownerUserId]);
  return result.rows.map(r=>{ const eventType:ActivityProjection['eventType']=r.event_type.startsWith('job.')?'job':r.event_type==='worker.added'?'worker-added':'system'; const out:ActivityProjection={id:r.id,eventType,title:r.title,summary:r.summary,status:r.status,timestamp:r.occurred_at.toISOString()}; if(r.effect) out.effect=r.effect; if(r.worker_id) out.workerId=r.worker_id; if(r.worker_name) out.workerName=r.worker_name; if(r.job_id) out.jobId=r.job_id; return out; });
}

export const moduleManifest={name:'jobs',layer:'controlled-runtime',milestone:3,status:'production-foundation'} as const;
