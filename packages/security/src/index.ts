import { randomUUID } from 'node:crypto';
import { getDatabasePool, withTransaction } from '@agent-place/db';

export type SecurityTargetType='worker'|'capability';
export interface SecurityHistoryItem {id:string;eventType:string;objectType:string;objectId:string;title:string;summary:string;effect?:string;status:string;workerId?:string;jobId?:string;occurredAt:string;metadata:Record<string,unknown>}
export interface SecurityQuarantine {id:string;targetType:SecurityTargetType;targetId:string;targetName:string;reason:string;status:'active'|'released';createdAt:string;releasedAt?:string}

function id(prefix:string){return `${prefix}_${randomUUID()}`;}
function asRecord(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}

export async function listSecurityHistory(ownerUserId:string,limit=100):Promise<SecurityHistoryItem[]> {
  const result=await getDatabasePool().query<any>(`SELECT id,event_type,object_type,object_id,title,summary,effect,status,worker_id,job_id,occurred_at,metadata FROM domain_event WHERE owner_user_id=$1 AND (event_type LIKE 'security.%' OR event_type LIKE 'authority.%' OR event_type LIKE 'mandate.%' OR event_type LIKE 'execution.%' OR event_type='action.blocked') ORDER BY occurred_at DESC LIMIT $2`,[ownerUserId,Math.max(1,Math.min(300,limit))]);
  return result.rows.map((r:any)=>({id:r.id,eventType:r.event_type,objectType:r.object_type,objectId:r.object_id,title:r.title,summary:r.summary,...(r.effect?{effect:r.effect}:{}),status:r.status,...(r.worker_id?{workerId:r.worker_id}:{}),...(r.job_id?{jobId:r.job_id}:{}),occurredAt:new Date(r.occurred_at).toISOString(),metadata:asRecord(r.metadata)}));
}

export async function emergencyStopFutureExecution(ownerUserId:string):Promise<{actionsStopped:number;walletPromptsStopped:number;submittedUntouched:number}> {
  let result={actionsStopped:0,walletPromptsStopped:0,submittedUntouched:0};
  await withTransaction(async(db)=>{
    const submitted=await db.query<{count:string}>(`SELECT count(*)::text count FROM transaction_attempt WHERE owner_user_id=$1 AND status IN ('SUBMITTED','CONFIRMING','CONFIRMED','UNKNOWN')`,[ownerUserId]);
    const prompted=await db.query<{id:string;action_id:string}>(`UPDATE transaction_attempt SET status='PRE_SUBMISSION_FAILED',observation_error='Stopped by AgentPlace emergency control before a transaction hash was reported.',updated_at=now() WHERE owner_user_id=$1 AND status='WALLET_PROMPTED' RETURNING id,action_id`,[ownerUserId]);
    const actions=await db.query<{id:string}>(`UPDATE financial_action SET status='REJECTED',updated_at=now() WHERE owner_user_id=$1 AND status IN ('DRAFT','PREPARED','APPROVAL_REQUIRED','READY_FOR_EXECUTION') AND NOT EXISTS(SELECT 1 FROM transaction_attempt t WHERE t.owner_user_id=financial_action.owner_user_id AND t.action_id=financial_action.id AND t.status IN ('SUBMITTED','CONFIRMING','CONFIRMED','UNKNOWN')) RETURNING id`,[ownerUserId]);
    if(actions.rows.length>0)await db.query(`UPDATE action_approval SET decision='INVALIDATED',invalidated_at=now() WHERE owner_user_id=$1 AND decision='APPROVED' AND action_id=ANY($2::text[])`,[ownerUserId,actions.rows.map(r=>r.id)]);
    result={actionsStopped:actions.rowCount??0,walletPromptsStopped:prompted.rowCount??0,submittedUntouched:Number(submitted.rows[0]?.count??0)};
    await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,origin_type,metadata) VALUES($1,$2,'security.emergency_stop','security-control','future-execution','Future execution steps stopped',$3,$4,'complete','user',$5::jsonb)`,[id('evt'),ownerUserId,`${result.actionsStopped} unsubmitted action${result.actionsStopped===1?'':'s'} and ${result.walletPromptsStopped} pending wallet prompt${result.walletPromptsStopped===1?'':'s'} stopped.`,`${result.submittedUntouched} submitted/confirming/unknown transaction${result.submittedUntouched===1?' was':'s were'} left untouched because blockchain submissions cannot be reversed.`,JSON.stringify(result)]);
  });
  return result;
}

async function target(ownerUserId:string,type:SecurityTargetType,targetId:string):Promise<{name:string;trust:string}> {
  if(type==='worker'){
    const r=await getDatabasePool().query<any>(`SELECT name,trust_status FROM worker_definition WHERE id=$1 AND creator_user_id=$2`,[targetId,ownerUserId]);const row=r.rows[0];if(!row)throw new Error('SECURITY_TARGET_NOT_OWNED');return {name:row.name,trust:row.trust_status};
  }
  const r=await getDatabasePool().query<any>(`SELECT name,trust_status FROM creator_capability WHERE id=$1 AND creator_user_id=$2`,[targetId,ownerUserId]);const row=r.rows[0];if(!row)throw new Error('SECURITY_TARGET_NOT_OWNED');return {name:row.name,trust:row.trust_status};
}

export async function quarantineCreatorAsset(ownerUserId:string,type:SecurityTargetType,targetId:string,reason:string):Promise<SecurityQuarantine>{
  const cleaned=reason.trim().slice(0,500);if(cleaned.length<3)throw new Error('INVALID_QUARANTINE_REASON');
  const found=await target(ownerUserId,type,targetId);const quarantineId=id('quarantine');
  await withTransaction(async(db)=>{
    if(type==='worker')await db.query(`UPDATE worker_definition SET trust_status='quarantined',updated_at=now() WHERE id=$1 AND creator_user_id=$2`,[targetId,ownerUserId]);
    else await db.query(`UPDATE creator_capability SET trust_status='quarantined',updated_at=now() WHERE id=$1 AND creator_user_id=$2`,[targetId,ownerUserId]);
    await db.query(`UPDATE security_quarantine SET status='released',released_at=now() WHERE owner_user_id=$1 AND target_type=$2 AND target_id=$3 AND status='active'`,[ownerUserId,type,targetId]);
    await db.query(`INSERT INTO security_quarantine(id,owner_user_id,target_type,target_id,reason,previous_trust_status,status) VALUES($1,$2,$3,$4,$5,$6,'active')`,[quarantineId,ownerUserId,type,targetId,cleaned,found.trust]);
    await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,origin_type,metadata) VALUES($1,$2,'security.supply_quarantined',$3,$4,$5,$6,'New acquisition/routing is blocked while historical Jobs and evidence remain intact.','quarantined','user',$7::jsonb)`,[id('evt'),ownerUserId,type,targetId,`${found.name} quarantined`,cleaned,JSON.stringify({targetType:type,targetId})]);
  });
  return {id:quarantineId,targetType:type,targetId,targetName:found.name,reason:cleaned,status:'active',createdAt:new Date().toISOString()};
}

export async function releaseCreatorAssetQuarantine(ownerUserId:string,quarantineId:string):Promise<void>{
  await withTransaction(async(db)=>{
    const r=await db.query<any>(`SELECT * FROM security_quarantine WHERE id=$1 AND owner_user_id=$2 AND status='active' FOR UPDATE`,[quarantineId,ownerUserId]);const q=r.rows[0];if(!q)throw new Error('SECURITY_QUARANTINE_NOT_FOUND');
    if(q.target_type==='worker')await db.query(`UPDATE worker_definition SET trust_status=$3,updated_at=now() WHERE id=$1 AND creator_user_id=$2`,[q.target_id,ownerUserId,q.previous_trust_status]);
    else await db.query(`UPDATE creator_capability SET trust_status=$3,updated_at=now() WHERE id=$1 AND creator_user_id=$2`,[q.target_id,ownerUserId,q.previous_trust_status]);
    await db.query(`UPDATE security_quarantine SET status='released',released_at=now() WHERE id=$1`,[quarantineId]);
    await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,effect,status,origin_type,metadata) VALUES($1,$2,'security.supply_quarantine_released',$3,$4,'Supply quarantine released','The creator removed the quarantine. Normal eligibility still depends on publication, trust, health and authority rules.','Release does not grant authority or bypass readiness checks.','released','user',$5::jsonb)`,[id('evt'),ownerUserId,q.target_type,q.target_id,JSON.stringify({quarantineId})]);
  });
}

export async function listQuarantines(ownerUserId:string):Promise<SecurityQuarantine[]> {
  const result=await getDatabasePool().query<any>(`SELECT q.*,COALESCE(w.name,c.name,q.target_id) target_name FROM security_quarantine q LEFT JOIN worker_definition w ON q.target_type='worker' AND w.id=q.target_id LEFT JOIN creator_capability c ON q.target_type='capability' AND c.id=q.target_id WHERE q.owner_user_id=$1 ORDER BY q.created_at DESC LIMIT 100`,[ownerUserId]);
  return result.rows.map((q:any)=>({id:q.id,targetType:q.target_type,targetId:q.target_id,targetName:q.target_name,reason:q.reason,status:q.status,createdAt:new Date(q.created_at).toISOString(),...(q.released_at?{releasedAt:new Date(q.released_at).toISOString()}:{})}));
}

export const moduleManifest={name:'security',layer:'trusted-core',milestone:13,status:'production-security-controls'} as const;
