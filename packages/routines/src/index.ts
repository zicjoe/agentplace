import { randomUUID } from 'node:crypto';
import { addMessage, createConversation } from '@agent-place/context';
import { getDatabasePool, withTransaction } from '@agent-place/db';
import { readDeterministicMarketMetric, type DeterministicMarketMetric } from '@agent-place/intelligence';
import { createJob, enqueueIntelligenceTask, setJobConversation } from '@agent-place/jobs';
import { createNotification } from '@agent-place/notifications';

export type RoutineEnvironment = 'mainnet' | 'testnet';
export type RoutineStatus = 'DRAFT' | 'ACTIVE' | 'WATCHING' | 'WAITING_FOR_EVENT' | 'COOLING_DOWN' | 'PAUSED' | 'LIMITED' | 'NEEDS_USER' | 'EXPIRED' | 'STOPPED';
export type RoutineTriggerType = 'SCHEDULED' | 'CONDITION' | 'EVENT';
export type RoutineExecutionBehavior = 'RECOMMEND_ONLY' | 'ACT_WITHIN_AUTHORITY';
export type RoutineRunStatus = 'QUEUED' | 'EVALUATING' | 'RUNNING' | 'COMPLETED' | 'NO_CHANGE' | 'BLOCKED' | 'NEEDS_USER' | 'FAILED_RETRYABLE' | 'FAILED_FINAL';
export type RoutineRunTriggerSource = 'SCHEDULE' | 'CONDITION' | 'EVENT' | 'MANUAL' | 'RETRY';

export interface ScheduledTriggerConfig {
  kind: 'interval' | 'daily' | 'weekly';
  intervalMinutes?: number;
  localTime?: string;
  weekdays?: Array<'MON'|'TUE'|'WED'|'THU'|'FRI'|'SAT'|'SUN'>;
  timeZone: string;
  humanReadable: string;
}

export interface ConditionTriggerConfig {
  metric: DeterministicMarketMetric;
  query: string;
  network?: string;
  address?: string;
  operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ';
  threshold: number;
  pollEveryMinutes: number;
  cooldownMinutes: number;
  humanReadable: string;
}

export interface EventTriggerConfig {
  eventTypes: string[];
  cooldownMinutes: number;
  humanReadable: string;
  workerId?: string;
}

export type RoutineTriggerConfig = ScheduledTriggerConfig | ConditionTriggerConfig | EventTriggerConfig;

export interface RoutineNotificationPolicy {
  mode: 'always' | 'meaningful' | 'needs-user';
  humanReadable: string;
}

export interface RoutineRevision {
  routineId: string;
  revision: number;
  instruction: string;
  triggerType: RoutineTriggerType;
  triggerConfig: RoutineTriggerConfig;
  executionBehavior: RoutineExecutionBehavior;
  authorityGrantId?: string;
  notificationPolicy: RoutineNotificationPolicy;
  serviceBudgetLimitUsd?: number;
  serviceBudgetPeriodDays: number;
  maxCostPerRunUsd?: number;
  gasBudget: Record<string, unknown>;
  cooldownSeconds: number;
  expiresAt?: string;
  createdBy: 'user' | 'agentplace';
  createdAt: string;
}

export interface DurableRoutine {
  id: string;
  workerId: string;
  workerName: string;
  title: string;
  environment: RoutineEnvironment;
  status: RoutineStatus;
  currentRevision: number;
  instruction: string;
  triggerType: RoutineTriggerType;
  triggerConfig: RoutineTriggerConfig;
  executionBehavior: RoutineExecutionBehavior;
  authorityGrantId?: string;
  notificationPolicy: RoutineNotificationPolicy;
  serviceBudgetLimitUsd?: number;
  serviceBudgetSpentUsd: number;
  serviceBudgetPeriodDays: number;
  maxCostPerRunUsd?: number;
  gasBudget: Record<string, unknown>;
  cooldownSeconds: number;
  expiresAt?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastMeaningfulRunAt?: string;
  consecutiveFailures: number;
  limitedReasonCode?: string;
  limitedReasonSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DurableRoutineRun {
  id: string;
  routineId: string;
  routineRevision: number;
  triggerSource: RoutineRunTriggerSource;
  occurrenceKey: string;
  eventId?: string;
  status: RoutineRunStatus;
  jobId?: string;
  dueAt: string;
  startedAt?: string;
  completedAt?: string;
  meaningful: boolean;
  resultCode?: string;
  summary?: string;
  serviceCostUsd: number;
  gasCostAtomic?: string;
  attemptCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoutineInput {
  title: string;
  workerId: string;
  environment: RoutineEnvironment;
  instruction: string;
  triggerType: RoutineTriggerType;
  triggerConfig: RoutineTriggerConfig;
  executionBehavior?: RoutineExecutionBehavior;
  authorityGrantId?: string;
  notificationPolicy?: RoutineNotificationPolicy;
  serviceBudgetLimitUsd?: number;
  serviceBudgetPeriodDays?: number;
  maxCostPerRunUsd?: number;
  gasBudget?: Record<string, unknown>;
  cooldownSeconds?: number;
  expiresAt?: string;
  createdBy?: 'user' | 'agentplace';
}

type RoutineRow = {
  id:string;worker_id:string;worker_name:string;title:string;environment:RoutineEnvironment;status:RoutineStatus;current_revision:number;
  next_run_at:Date|null;last_run_at:Date|null;last_meaningful_run_at:Date|null;consecutive_failures:number;limited_reason_code:string|null;limited_reason_summary:string|null;
  created_at:Date;updated_at:Date;
  instruction:string;trigger_type:RoutineTriggerType;trigger_config:Record<string,unknown>;execution_behavior:RoutineExecutionBehavior;authority_grant_id:string|null;
  notification_policy:Record<string,unknown>;service_budget_limit_usd:string|null;service_budget_period_days:number;max_cost_per_run_usd:string|null;gas_budget:Record<string,unknown>;cooldown_seconds:number;expires_at:Date|null;
  spent_usd:string;
};

type RoutineRunRow = {
  id:string;routine_id:string;routine_revision:number;trigger_source:RoutineRunTriggerSource;occurrence_key:string;event_id:string|null;status:RoutineRunStatus;job_id:string|null;
  due_at:Date;started_at:Date|null;completed_at:Date|null;meaningful:boolean;result_code:string|null;summary:string|null;service_cost_usd:string;gas_cost_atomic:string|null;attempt_count:number;last_error:string|null;created_at:Date;updated_at:Date;
};

type RevisionRow = {
  routine_id:string;revision:number;instruction:string;trigger_type:RoutineTriggerType;trigger_config:Record<string,unknown>;execution_behavior:RoutineExecutionBehavior;authority_grant_id:string|null;notification_policy:Record<string,unknown>;
  service_budget_limit_usd:string|null;service_budget_period_days:number;max_cost_per_run_usd:string|null;gas_budget:Record<string,unknown>;cooldown_seconds:number;expires_at:Date|null;created_by:'user'|'agentplace';created_at:Date;
};

const DAY_TO_ISO: Record<string, number> = { MON:1,TUE:2,WED:3,THU:4,FRI:5,SAT:6,SUN:7 };
const ROUTINE_EVENT_TYPES = new Set(['job.completed','outcome.verified','action.blocked','worker.added','wallet.connected','wallet.disconnected','authority.expiring']);

function parseNumber(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function assertTimeZone(timeZone: string): void {
  try { new Intl.DateTimeFormat('en-US',{timeZone}).format(new Date()); } catch { throw new Error('INVALID_ROUTINE_TIME_ZONE'); }
}

function assertClock(value: string): void {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('INVALID_ROUTINE_LOCAL_TIME');
}

function triggerTypeOf(config: RoutineTriggerConfig): RoutineTriggerType {
  if ('kind' in config) return 'SCHEDULED';
  if ('metric' in config) return 'CONDITION';
  return 'EVENT';
}

export function validateRoutineTrigger(triggerType: RoutineTriggerType, config: RoutineTriggerConfig): void {
  if (triggerTypeOf(config) !== triggerType) throw new Error('ROUTINE_TRIGGER_MISMATCH');
  if (triggerType === 'SCHEDULED') {
    const scheduled = config as ScheduledTriggerConfig;
    assertTimeZone(scheduled.timeZone);
    if (!scheduled.humanReadable?.trim()) throw new Error('INVALID_ROUTINE_TRIGGER');
    if (scheduled.kind === 'interval') {
      const minutes = scheduled.intervalMinutes ?? 0;
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 43_200) throw new Error('INVALID_ROUTINE_INTERVAL');
    } else {
      assertClock(scheduled.localTime ?? '');
      if (scheduled.kind === 'weekly') {
        if (!scheduled.weekdays?.length || scheduled.weekdays.length > 7 || scheduled.weekdays.some((day)=>!DAY_TO_ISO[day])) throw new Error('INVALID_ROUTINE_WEEKDAYS');
      }
    }
    return;
  }
  if (triggerType === 'CONDITION') {
    const condition = config as ConditionTriggerConfig;
    if (!['priceUsd','liquidityUsd','volume24hUsd','marketCapUsd','fdvUsd'].includes(condition.metric)) throw new Error('INVALID_ROUTINE_CONDITION_METRIC');
    if (!condition.query?.trim() || condition.query.length > 200) throw new Error('INVALID_ROUTINE_CONDITION_SUBJECT');
    if (!['GT','GTE','LT','LTE','EQ'].includes(condition.operator) || !Number.isFinite(condition.threshold)) throw new Error('INVALID_ROUTINE_CONDITION');
    if (!Number.isInteger(condition.pollEveryMinutes) || condition.pollEveryMinutes < 5 || condition.pollEveryMinutes > 1440) throw new Error('INVALID_ROUTINE_CONDITION_POLL');
    if (!Number.isInteger(condition.cooldownMinutes) || condition.cooldownMinutes < 0 || condition.cooldownMinutes > 10080) throw new Error('INVALID_ROUTINE_COOLDOWN');
    return;
  }
  const event = config as EventTriggerConfig;
  if (!event.eventTypes?.length || event.eventTypes.length > 16 || event.eventTypes.some((value)=>!ROUTINE_EVENT_TYPES.has(value))) throw new Error('INVALID_ROUTINE_EVENT_TYPES');
  if (!Number.isInteger(event.cooldownMinutes) || event.cooldownMinutes < 0 || event.cooldownMinutes > 10080) throw new Error('INVALID_ROUTINE_COOLDOWN');
  if (event.workerId !== undefined && (!event.workerId.trim() || event.workerId.length > 128)) throw new Error('INVALID_ROUTINE_EVENT_WORKER');
}

function automaticStatusForTrigger(triggerType: RoutineTriggerType): 'ACTIVE' | 'WATCHING' | 'WAITING_FOR_EVENT' {
  return triggerType === 'CONDITION' ? 'WATCHING' : triggerType === 'EVENT' ? 'WAITING_FOR_EVENT' : 'ACTIVE';
}

function isAutomaticStatus(status: RoutineStatus): boolean {
  return status === 'ACTIVE' || status === 'WATCHING' || status === 'WAITING_FOR_EVENT' || status === 'COOLING_DOWN';
}

function localParts(date: Date, timeZone: string): { year:number;month:number;day:number;hour:number;minute:number;weekday:number } {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short' });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part)=>[part.type,part.value]));
  const weekdayMap:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
  return { year:Number(parts.year),month:Number(parts.month),day:Number(parts.day),hour:Number(parts.hour),minute:Number(parts.minute),weekday:weekdayMap[parts.weekday ?? 'Mon'] ?? 1 };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = localParts(date,timeZone);
  const represented = Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,0,0);
  return represented - date.getTime() + (date.getUTCSeconds()*1000 + date.getUTCMilliseconds());
}

function zonedToUtc(year:number,month:number,day:number,hour:number,minute:number,timeZone:string): Date {
  let guess = new Date(Date.UTC(year,month-1,day,hour,minute,0,0));
  for (let i=0;i<3;i+=1) guess = new Date(Date.UTC(year,month-1,day,hour,minute,0,0) - offsetMs(guess,timeZone));
  return guess;
}

function addCalendarDays(year:number,month:number,day:number,days:number): {year:number;month:number;day:number} {
  const d=new Date(Date.UTC(year,month-1,day+days,12,0,0,0));
  return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};
}

export function calculateNextScheduledAt(config: ScheduledTriggerConfig, from = new Date()): Date {
  assertTimeZone(config.timeZone);
  if (config.kind === 'interval') return new Date(from.getTime() + (config.intervalMinutes ?? 5) * 60_000);
  assertClock(config.localTime ?? '');
  const [hour,minute]=(config.localTime ?? '08:00').split(':').map(Number) as [number,number];
  const base=localParts(from,config.timeZone);
  const allowed = config.kind === 'weekly' ? new Set((config.weekdays ?? []).map((d)=>DAY_TO_ISO[d])) : null;
  for(let delta=0;delta<=8;delta+=1){
    const date=addCalendarDays(base.year,base.month,base.day,delta);
    const candidate=zonedToUtc(date.year,date.month,date.day,hour,minute,config.timeZone);
    if(candidate.getTime()<=from.getTime()) continue;
    if(allowed){ const weekday=localParts(candidate,config.timeZone).weekday; if(!allowed.has(weekday)) continue; }
    return candidate;
  }
  throw new Error('ROUTINE_NEXT_RUN_CALCULATION_FAILED');
}

export function evaluateCondition(operator: ConditionTriggerConfig['operator'], observed: number, threshold: number): boolean {
  if (operator === 'GT') return observed > threshold;
  if (operator === 'GTE') return observed >= threshold;
  if (operator === 'LT') return observed < threshold;
  if (operator === 'LTE') return observed <= threshold;
  return Math.abs(observed-threshold) <= Number.EPSILON * Math.max(1,Math.abs(observed),Math.abs(threshold));
}

function mapRevision(row: RevisionRow): RoutineRevision {
  const triggerConfig = row.trigger_config as unknown as RoutineTriggerConfig;
  const notificationPolicy = row.notification_policy as unknown as RoutineNotificationPolicy;
  const out:RoutineRevision={routineId:row.routine_id,revision:row.revision,instruction:row.instruction,triggerType:row.trigger_type,triggerConfig,executionBehavior:row.execution_behavior,notificationPolicy,serviceBudgetPeriodDays:row.service_budget_period_days,gasBudget:row.gas_budget??{},cooldownSeconds:row.cooldown_seconds,createdBy:row.created_by,createdAt:row.created_at.toISOString()};
  if(row.authority_grant_id)out.authorityGrantId=row.authority_grant_id;
  const limit=parseNumber(row.service_budget_limit_usd);if(limit!==undefined)out.serviceBudgetLimitUsd=limit;
  const max=parseNumber(row.max_cost_per_run_usd);if(max!==undefined)out.maxCostPerRunUsd=max;
  if(row.expires_at)out.expiresAt=row.expires_at.toISOString();
  return out;
}

function mapRoutine(row: RoutineRow): DurableRoutine {
  const limit=parseNumber(row.service_budget_limit_usd);const max=parseNumber(row.max_cost_per_run_usd);
  const out:DurableRoutine={id:row.id,workerId:row.worker_id,workerName:row.worker_name,title:row.title,environment:row.environment,status:row.status,currentRevision:row.current_revision,instruction:row.instruction,triggerType:row.trigger_type,triggerConfig:row.trigger_config as unknown as RoutineTriggerConfig,executionBehavior:row.execution_behavior,notificationPolicy:row.notification_policy as unknown as RoutineNotificationPolicy,serviceBudgetSpentUsd:parseNumber(row.spent_usd)??0,serviceBudgetPeriodDays:row.service_budget_period_days,gasBudget:row.gas_budget??{},cooldownSeconds:row.cooldown_seconds,consecutiveFailures:row.consecutive_failures,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()};
  if(row.authority_grant_id)out.authorityGrantId=row.authority_grant_id;if(limit!==undefined)out.serviceBudgetLimitUsd=limit;if(max!==undefined)out.maxCostPerRunUsd=max;
  if(row.expires_at)out.expiresAt=row.expires_at.toISOString();if(row.next_run_at)out.nextRunAt=row.next_run_at.toISOString();if(row.last_run_at)out.lastRunAt=row.last_run_at.toISOString();if(row.last_meaningful_run_at)out.lastMeaningfulRunAt=row.last_meaningful_run_at.toISOString();if(row.limited_reason_code)out.limitedReasonCode=row.limited_reason_code;if(row.limited_reason_summary)out.limitedReasonSummary=row.limited_reason_summary;return out;
}

function mapRun(row: RoutineRunRow): DurableRoutineRun {
  const out:DurableRoutineRun={id:row.id,routineId:row.routine_id,routineRevision:row.routine_revision,triggerSource:row.trigger_source,occurrenceKey:row.occurrence_key,status:row.status,dueAt:row.due_at.toISOString(),meaningful:row.meaningful,serviceCostUsd:parseNumber(row.service_cost_usd)??0,attemptCount:row.attempt_count,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()};
  if(row.event_id)out.eventId=row.event_id;if(row.job_id)out.jobId=row.job_id;if(row.started_at)out.startedAt=row.started_at.toISOString();if(row.completed_at)out.completedAt=row.completed_at.toISOString();if(row.result_code)out.resultCode=row.result_code;if(row.summary)out.summary=row.summary;if(row.gas_cost_atomic)out.gasCostAtomic=row.gas_cost_atomic;if(row.last_error)out.lastError=row.last_error;return out;
}

const routineSelect=`SELECT r.id,r.worker_id,d.name AS worker_name,r.title,r.environment,r.status,r.current_revision,r.next_run_at,r.last_run_at,r.last_meaningful_run_at,r.consecutive_failures,r.limited_reason_code,r.limited_reason_summary,r.created_at,r.updated_at,
  rr.instruction,rr.trigger_type,rr.trigger_config,rr.execution_behavior,rr.authority_grant_id,rr.notification_policy,rr.service_budget_limit_usd,rr.service_budget_period_days,rr.max_cost_per_run_usd,rr.gas_budget,rr.cooldown_seconds,rr.expires_at,
  COALESCE((SELECT sum(run.service_cost_usd) FROM routine_run run WHERE run.routine_id=r.id AND run.created_at >= now() - make_interval(days=>rr.service_budget_period_days)),0)::text AS spent_usd
  FROM routine r JOIN routine_revision rr ON rr.routine_id=r.id AND rr.revision=r.current_revision JOIN worker_definition d ON d.id=r.worker_id`;

export async function listRoutines(ownerUserId:string):Promise<DurableRoutine[]> { const r=await getDatabasePool().query<RoutineRow>(`${routineSelect} WHERE r.owner_user_id=$1 ORDER BY r.updated_at DESC`,[ownerUserId]);return r.rows.map(mapRoutine); }
export async function getRoutine(ownerUserId:string,id:string):Promise<DurableRoutine|null>{const r=await getDatabasePool().query<RoutineRow>(`${routineSelect} WHERE r.owner_user_id=$1 AND r.id=$2`,[ownerUserId,id]);return r.rows[0]?mapRoutine(r.rows[0]):null;}
export async function listRoutineRuns(ownerUserId:string,routineId?:string,limit=100):Promise<DurableRoutineRun[]>{const bounded=Math.min(300,Math.max(1,limit));const r=await getDatabasePool().query<RoutineRunRow>(`SELECT * FROM routine_run WHERE owner_user_id=$1 ${routineId?'AND routine_id=$2':''} ORDER BY created_at DESC LIMIT $${routineId?3:2}`,routineId?[ownerUserId,routineId,bounded]:[ownerUserId,bounded]);return r.rows.map(mapRun);}
export async function listRoutineRevisions(ownerUserId:string,routineId:string):Promise<RoutineRevision[]>{const r=await getDatabasePool().query<RevisionRow>(`SELECT rr.* FROM routine_revision rr JOIN routine r ON r.id=rr.routine_id WHERE r.owner_user_id=$1 AND rr.routine_id=$2 ORDER BY rr.revision DESC`,[ownerUserId,routineId]);return r.rows.map(mapRevision);}

function defaultNotificationPolicy():RoutineNotificationPolicy{return {mode:'needs-user',humanReadable:'Only when the Routine needs you.'};}
function defaultBudget():{limit:number;max:number;days:number}{return {limit:Number.parseFloat(process.env.ROUTINE_DEFAULT_SERVICE_BUDGET_USD??'5')||5,max:Number.parseFloat(process.env.ROUTINE_DEFAULT_MAX_COST_PER_RUN_USD??'1')||1,days:30};}
function scheduledRoutineWorkInstruction(value:string):string{
  const original=value.trim();
  let current=original
    .replace(/^set\s+up\s+a\s+routine\s*[,;:\-]?\s*/i,'')
    .replace(/\b(?:every|each)\s+\d+\s+(?:minutes?|hours?|days?|weeks?)\b/gi,' ')
    .replace(/\b(?:every|each)\s+(?:weekday|weekdays|day|daily|week|weekly|month|monthly)(?:\s+(?:morning|afternoon|evening|night))?\b/gi,' ')
    .replace(/\b(?:and\s+)?(?:only\s+)?(?:tell|notify|alert)\s+me\s+(?:only\s+)?(?:when|if|unless)\b[\s\S]*$/i,'')
    .replace(/\b(?:and\s+)?(?:tell|notify|alert)\s+me\s+only\s+(?:when|if|unless)\b[\s\S]*$/i,'')
    .replace(/\s+([,.;!?])/g,'$1')
    .replace(/\s{2,}/g,' ')
    .replace(/[\s,;:-]+$/g,'')
    .trim();
  if(!current)current=original;
  return current;
}
function validateBudget(limit:number|undefined,max:number|undefined,days:number):void{
  if(limit!==undefined&&(!Number.isFinite(limit)||limit<0||limit>1_000_000))throw new Error('INVALID_ROUTINE_SERVICE_BUDGET');
  if(max!==undefined&&(!Number.isFinite(max)||max<0||max>1_000_000))throw new Error('INVALID_ROUTINE_RUN_BUDGET');
  if(!Number.isInteger(days)||days<1||days>366)throw new Error('INVALID_ROUTINE_BUDGET_PERIOD');
  if(limit!==undefined&&max!==undefined&&max>limit)throw new Error('INVALID_ROUTINE_RUN_BUDGET');
}
function validateExpiry(value:string|undefined):void{if(value===undefined)return;const time=new Date(value).getTime();if(!Number.isFinite(time))throw new Error('INVALID_ROUTINE_EXPIRY');}

export async function createRoutineDraft(ownerUserId:string,input:CreateRoutineInput):Promise<DurableRoutine>{
  validateRoutineTrigger(input.triggerType,input.triggerConfig);
  if(input.executionBehavior==='ACT_WITHIN_AUTHORITY') throw new Error('M11_AUTONOMOUS_EXECUTION_UNAVAILABLE');
  if(!input.title.trim()||input.title.length>200||!input.instruction.trim()||input.instruction.length>4000)throw new Error('INVALID_ROUTINE_INPUT');
  const worker=await getDatabasePool().query<{id:string}>(`SELECT uw.id FROM user_worker uw WHERE uw.owner_user_id=$1 AND uw.id=$2 AND uw.status<>'removed'`,[ownerUserId,input.workerId]);
  if(!worker.rows[0])throw new Error('ROUTINE_WORKER_NOT_INSTALLED');
  const budget=defaultBudget();const id=`rtn_${randomUUID()}`;const limit=input.serviceBudgetLimitUsd??budget.limit;const max=input.maxCostPerRunUsd??budget.max;const days=input.serviceBudgetPeriodDays??budget.days;validateBudget(limit,max,days);validateExpiry(input.expiresAt);
  await withTransaction(async db=>{
    await db.query(`INSERT INTO routine(id,owner_user_id,worker_id,title,environment,status,current_revision) VALUES($1,$2,$3,$4,$5,'DRAFT',1)`,[id,ownerUserId,input.workerId,input.title.trim(),input.environment]);
    await db.query(`INSERT INTO routine_revision(routine_id,revision,instruction,trigger_type,trigger_config,execution_behavior,authority_grant_id,notification_policy,service_budget_limit_usd,service_budget_period_days,max_cost_per_run_usd,gas_budget,cooldown_seconds,expires_at,created_by)
      VALUES($1,1,$2,$3,$4::jsonb,'RECOMMEND_ONLY',$5,$6::jsonb,$7,$8,$9,$10::jsonb,$11,$12,$13)`,[id,input.instruction.trim(),input.triggerType,JSON.stringify(input.triggerConfig),input.authorityGrantId??null,JSON.stringify(input.notificationPolicy??defaultNotificationPolicy()),limit,days,max,JSON.stringify(input.gasBudget??{}),input.cooldownSeconds??0,input.expiresAt??null,input.createdBy??'user']);
    await db.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,worker_id,origin_type) VALUES($1,$2,'routine.draft.created','routine',$3,$4,$5,'DRAFT',$6,'user')`,[`evt_routine_draft_${id}`,ownerUserId,id,input.title.trim(),'Routine draft created. Activation is still required.',input.workerId]);
  });
  const routine=await getRoutine(ownerUserId,id);if(!routine)throw new Error('ROUTINE_CREATE_FAILED');return routine;
}

export async function reviseRoutine(ownerUserId:string,routineId:string,patch:Partial<Omit<CreateRoutineInput,'workerId'|'environment'>>):Promise<DurableRoutine>{
  const current=await getRoutine(ownerUserId,routineId);if(!current)throw new Error('ROUTINE_NOT_FOUND');if(current.status==='STOPPED')throw new Error('ROUTINE_STOPPED');
  const triggerType=patch.triggerType??current.triggerType;const triggerConfig=patch.triggerConfig??current.triggerConfig;validateRoutineTrigger(triggerType,triggerConfig);
  if(patch.executionBehavior==='ACT_WITHIN_AUTHORITY')throw new Error('M11_AUTONOMOUS_EXECUTION_UNAVAILABLE');
  const revision=current.currentRevision+1;const instruction=(patch.instruction??current.instruction).trim();if(!instruction||instruction.length>4000)throw new Error('INVALID_ROUTINE_INPUT');
  const budgetLimit=patch.serviceBudgetLimitUsd??current.serviceBudgetLimitUsd;
  const maxPerRun=patch.maxCostPerRunUsd??current.maxCostPerRunUsd;
  const budgetDays=patch.serviceBudgetPeriodDays??current.serviceBudgetPeriodDays;
  validateBudget(budgetLimit,maxPerRun,budgetDays);validateExpiry(patch.expiresAt??current.expiresAt);
  const title=(patch.title??current.title).trim();if(!title||title.length>200)throw new Error('INVALID_ROUTINE_INPUT');
  let nextStatus=current.status;
  let nextRunAt:Date|null=null;
  if(isAutomaticStatus(current.status)){
    nextStatus=automaticStatusForTrigger(triggerType);
    if(triggerType==='SCHEDULED')nextRunAt=calculateNextScheduledAt(triggerConfig as ScheduledTriggerConfig,new Date());
    if(triggerType==='CONDITION')nextRunAt=conditionNext(triggerConfig as ConditionTriggerConfig,new Date());
  }
  await withTransaction(async db=>{
    await db.query(`INSERT INTO routine_revision(routine_id,revision,instruction,trigger_type,trigger_config,execution_behavior,authority_grant_id,notification_policy,service_budget_limit_usd,service_budget_period_days,max_cost_per_run_usd,gas_budget,cooldown_seconds,expires_at,created_by)
      VALUES($1,$2,$3,$4,$5::jsonb,'RECOMMEND_ONLY',$6,$7::jsonb,$8,$9,$10,$11::jsonb,$12,$13,'user')`,[routineId,revision,instruction,triggerType,JSON.stringify(triggerConfig),patch.authorityGrantId??current.authorityGrantId??null,JSON.stringify(patch.notificationPolicy??current.notificationPolicy),budgetLimit??null,budgetDays,maxPerRun??null,JSON.stringify(patch.gasBudget??current.gasBudget),patch.cooldownSeconds??current.cooldownSeconds,patch.expiresAt??current.expiresAt??null]);
    await db.query(`UPDATE routine SET title=$3,current_revision=$4,status=$5,next_run_at=$6,updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,routineId,title,revision,nextStatus,nextRunAt]);
  });
  const result=await getRoutine(ownerUserId,routineId);if(!result)throw new Error('ROUTINE_NOT_FOUND');return result;
}

function nextInitialRun(routine:DurableRoutine,now=new Date()):Date|null{
  if(routine.triggerType==='SCHEDULED')return calculateNextScheduledAt(routine.triggerConfig as ScheduledTriggerConfig,now);
  if(routine.triggerType==='CONDITION')return new Date(now.getTime()+Math.max(5,(routine.triggerConfig as ConditionTriggerConfig).pollEveryMinutes)*60_000);
  return null;
}

export async function activateRoutine(ownerUserId:string,routineId:string):Promise<DurableRoutine>{
  const routine=await getRoutine(ownerUserId,routineId);if(!routine)throw new Error('ROUTINE_NOT_FOUND');if(routine.status==='STOPPED')throw new Error('ROUTINE_STOPPED');if(routine.executionBehavior!=='RECOMMEND_ONLY')throw new Error('M11_AUTONOMOUS_EXECUTION_UNAVAILABLE');
  if(routine.status!=='DRAFT'){if(isAutomaticStatus(routine.status))return routine;throw new Error('ROUTINE_ALREADY_ACTIVATED');}
  const now=new Date();if(routine.expiresAt&&new Date(routine.expiresAt).getTime()<=now.getTime())throw new Error('ROUTINE_EXPIRED');
  const status:RoutineStatus=automaticStatusForTrigger(routine.triggerType);const next=nextInitialRun(routine,now);
  await getDatabasePool().query(`UPDATE routine SET status=$3,activated_at=COALESCE(activated_at,now()),next_run_at=$4,limited_reason_code=NULL,limited_reason_summary=NULL,updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,routineId,status,next]);
  await getDatabasePool().query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,worker_id,origin_type) VALUES($1,$2,'routine.activated','routine',$3,$4,$5,$6,$7,'user') ON CONFLICT(id) DO NOTHING`,[`evt_routine_activated_${routineId}_${routine.currentRevision}`,ownerUserId,routineId,`Routine activated · ${routine.title}`,(routine.triggerConfig as {humanReadable?:string}).humanReadable??routine.triggerType,status,routine.workerId]);
  const result=await getRoutine(ownerUserId,routineId);if(!result)throw new Error('ROUTINE_NOT_FOUND');return result;
}

export async function pauseRoutine(ownerUserId:string,routineId:string):Promise<DurableRoutine>{return setRoutineStatus(ownerUserId,routineId,'PAUSED','Routine paused. Future automatic runs are stopped.');}
export async function stopRoutine(ownerUserId:string,routineId:string):Promise<DurableRoutine>{const result=await setRoutineStatus(ownerUserId,routineId,'STOPPED','Routine stopped. Historical Jobs and outcomes remain.');await getDatabasePool().query(`UPDATE routine SET stopped_at=COALESCE(stopped_at,now()),next_run_at=NULL WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,routineId]);return (await getRoutine(ownerUserId,routineId))??result;}

async function setRoutineStatus(ownerUserId:string,routineId:string,status:RoutineStatus,summary:string):Promise<DurableRoutine>{const routine=await getRoutine(ownerUserId,routineId);if(!routine)throw new Error('ROUTINE_NOT_FOUND');await getDatabasePool().query(`UPDATE routine SET status=$3,next_run_at=CASE WHEN $3 IN ('PAUSED','STOPPED','EXPIRED','LIMITED','NEEDS_USER') THEN NULL ELSE next_run_at END,updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,routineId,status]);await getDatabasePool().query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,worker_id,origin_type) VALUES($1,$2,$3,'routine',$4,$5,$6,$7,$8,'user')`,[`evt_${randomUUID()}`,ownerUserId,`routine.${status.toLowerCase().replace('_','-')}`,routineId,`${routine.title} · ${status}`,summary,status,routine.workerId]);const result=await getRoutine(ownerUserId,routineId);if(!result)throw new Error('ROUTINE_NOT_FOUND');return result;}

export async function resumeRoutine(ownerUserId:string,routineId:string):Promise<DurableRoutine>{
  const routine=await getRoutine(ownerUserId,routineId);if(!routine)throw new Error('ROUTINE_NOT_FOUND');if(routine.status==='DRAFT')throw new Error('ROUTINE_NOT_ACTIVATED');if(routine.status==='STOPPED'||routine.status==='EXPIRED')throw new Error('ROUTINE_CANNOT_RESUME');
  if(isAutomaticStatus(routine.status))return routine;
  if(routine.status!=='PAUSED'&&routine.status!=='LIMITED'&&routine.status!=='NEEDS_USER')throw new Error('ROUTINE_CANNOT_RESUME');
  const status:RoutineStatus=automaticStatusForTrigger(routine.triggerType);const next=nextInitialRun(routine,new Date());
  await getDatabasePool().query(`UPDATE routine SET status=$3,next_run_at=$4,consecutive_failures=0,limited_reason_code=NULL,limited_reason_summary=NULL,updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,routineId,status,next]);
  const result=await getRoutine(ownerUserId,routineId);if(!result)throw new Error('ROUTINE_NOT_FOUND');return result;
}

async function serviceBudgetAvailable(ownerUserId:string,routine:DurableRoutine,currentRunId:string):Promise<{ok:boolean;reason?:string}>{
  const periodLimit=routine.serviceBudgetLimitUsd;if(periodLimit===undefined)return {ok:true};
  return withTransaction(async db=>{
    const owned=await db.query<{id:string}>(`SELECT id FROM routine WHERE owner_user_id=$1 AND id=$2 FOR UPDATE`,[ownerUserId,routine.id]);
    if(!owned.rows[0])throw new Error('ROUTINE_NOT_FOUND');
    const usage=await db.query<{spent:string;reserved:string}>(`SELECT
      COALESCE((SELECT sum(rr.service_cost_usd) FROM routine_run rr WHERE rr.routine_id=$1 AND rr.created_at>=now()-make_interval(days=>$2) AND rr.status NOT IN ('QUEUED','EVALUATING','RUNNING')),0)::text AS spent,
      COALESCE((SELECT sum(COALESCE(rev.max_cost_per_run_usd,0)) FROM routine_run rr JOIN routine_revision rev ON rev.routine_id=rr.routine_id AND rev.revision=rr.routine_revision WHERE rr.routine_id=$1 AND rr.id<>$3 AND rr.created_at>=now()-make_interval(days=>$2) AND rr.status IN ('QUEUED','EVALUATING','RUNNING')),0)::text AS reserved`,[routine.id,routine.serviceBudgetPeriodDays,currentRunId]);
    const spent=Number.parseFloat(usage.rows[0]?.spent??'0')||0;
    const reserved=Number.parseFloat(usage.rows[0]?.reserved??'0')||0;
    const reserve=routine.maxCostPerRunUsd??0;
    const remaining=periodLimit-spent-reserved;
    if(remaining<=0)return {ok:false,reason:'Routine service budget is exhausted.'};
    if(reserve>remaining)return {ok:false,reason:'Remaining Routine service budget is below the configured per-run ceiling.'};
    return {ok:true};
  });
}

async function ownerForRoutine(routineId:string):Promise<string>{const r=await getDatabasePool().query<{owner_user_id:string}>(`SELECT owner_user_id::text AS owner_user_id FROM routine WHERE id=$1`,[routineId]);const owner=r.rows[0]?.owner_user_id;if(!owner)throw new Error('ROUTINE_NOT_FOUND');return owner;}

async function markLimited(routine:DurableRoutine,code:string,summary:string):Promise<void>{
  const ownerUserId=await ownerForRoutine(routine.id);
  const changed=await getDatabasePool().query(`UPDATE routine SET status='LIMITED',next_run_at=NULL,limited_reason_code=$3,limited_reason_summary=$4,updated_at=now() WHERE owner_user_id=$1 AND id=$2 AND status NOT IN ('STOPPED','PAUSED','EXPIRED')`,[ownerUserId,routine.id,code,summary]);
  if(!changed.rowCount)return;
  await createNotification({ownerUserId,level:'NEEDS_USER',title:`${routine.title} needs review`,summary,why:'AgentPlace stopped future automatic runs rather than continuing with unreliable or over-budget background work.',target:{type:'routine',id:routine.id},groupKey:`routine:${routine.id}:limited`,dedupeKey:`routine:${routine.id}:limited:${code}`});
  await getDatabasePool().query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,worker_id,origin_type) VALUES($1,$2,'routine.limited','routine',$3,$4,$5,'LIMITED',$6,'agentplace') ON CONFLICT(id) DO NOTHING`,[`evt_routine_limited_${routine.id}_${code}`,ownerUserId,routine.id,`${routine.title} limited`,summary,routine.workerId]);
}

async function createRun(ownerUserId:string,routine:DurableRoutine,source:RoutineRunTriggerSource,occurrenceKey:string,dueAt:Date,eventId?:string):Promise<DurableRoutineRun>{
  const id=`rrun_${randomUUID()}`;
  const result=await getDatabasePool().query<RoutineRunRow>(`INSERT INTO routine_run(id,owner_user_id,routine_id,routine_revision,trigger_source,occurrence_key,event_id,status,due_at,attempt_count)
    VALUES($1,$2,$3,$4,$5,$6,$7,'QUEUED',$8,1) ON CONFLICT DO NOTHING RETURNING *`,[id,ownerUserId,routine.id,routine.currentRevision,source,occurrenceKey,eventId??null,dueAt]);
  if(result.rows[0])return mapRun(result.rows[0]);
  const existing=await getDatabasePool().query<RoutineRunRow>(`SELECT * FROM routine_run WHERE owner_user_id=$1 AND routine_id=$2 AND routine_revision=$3 AND occurrence_key=$4`,[ownerUserId,routine.id,routine.currentRevision,occurrenceKey]);
  const row=existing.rows[0];if(!row)throw new Error('ROUTINE_RUN_CREATE_FAILED');return mapRun(row);
}

async function launchRoutineJob(ownerUserId:string,routine:DurableRoutine,run:DurableRoutineRun):Promise<DurableRoutineRun>{
  const budget=await serviceBudgetAvailable(ownerUserId,routine,run.id);if(!budget.ok){await getDatabasePool().query(`UPDATE routine_run SET status='BLOCKED',result_code='SERVICE_BUDGET',summary=$3,completed_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,run.id,budget.reason]);await markLimited(routine,'SERVICE_BUDGET',budget.reason??'Routine service budget is exhausted.');return (await getRoutineRun(ownerUserId,run.id))!;}
  const jobId=`job_${run.id}`;const conversationId=`jobconv_${run.id}`;
  await createJob(ownerUserId,{id:jobId,title:routine.title,goal:routine.instruction,status:'RUNNING',environment:routine.environment,kind:'research',originType:'routine',leadWorkerId:routine.workerId,supportingWorkerIds:[],originWorkerId:routine.workerId,originRoutineId:routine.id,routineRunId:run.id,currentStage:'Routine started',stages:[{id:'stage_1',label:'Routine trigger accepted',ordinal:0,status:'done'},{id:'stage_2',label:'Gather current evidence',ordinal:1,status:'active'},{id:'stage_3',label:'Synthesize result',ordinal:2,status:'pending'}]});
  await createConversation(ownerUserId,{id:conversationId,scope:'job',jobId,title:routine.title,titleSource:'auto',pinned:false,archived:false,createdAt:new Date().toISOString(),messages:[]});
  await setJobConversation(ownerUserId,jobId,conversationId);
  const now=new Date().toISOString();
  await addMessage(ownerUserId,conversationId,{id:`msg_routine_started_${run.id}`,role:'manager',content:`Routine started this Job. ${routine.title} · ${(routine.triggerConfig as {humanReadable?:string}).humanReadable??routine.triggerType}.`,jobId,createdAt:now,updatedAt:now});
  await enqueueIntelligenceTask({ownerUserId,conversationId,inputSource:'ROUTINE',inputText:routine.instruction,routineRunId:run.id,scope:'job',workerId:routine.workerId,jobId,providerPreference:'auto'});
  await getDatabasePool().query(`UPDATE routine_run SET status='RUNNING',job_id=$3,started_at=COALESCE(started_at,now()),summary='Background Worker Job started.',updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,run.id,jobId]);
  await getDatabasePool().query(`UPDATE routine SET last_run_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,routine.id]);
  return (await getRoutineRun(ownerUserId,run.id))!;
}

export async function getRoutineRun(ownerUserId:string,runId:string):Promise<DurableRoutineRun|null>{const r=await getDatabasePool().query<RoutineRunRow>(`SELECT * FROM routine_run WHERE owner_user_id=$1 AND id=$2`,[ownerUserId,runId]);return r.rows[0]?mapRun(r.rows[0]):null;}

async function hasActiveRun(routineId:string):Promise<boolean>{const r=await getDatabasePool().query<{active:boolean}>(`SELECT EXISTS(SELECT 1 FROM routine_run WHERE routine_id=$1 AND status IN ('QUEUED','EVALUATING','RUNNING')) AS active`,[routineId]);return r.rows[0]?.active===true;}

export async function runRoutineNow(ownerUserId:string,routineId:string,source:RoutineRunTriggerSource='MANUAL'):Promise<DurableRoutineRun>{
  const routine=await getRoutine(ownerUserId,routineId);if(!routine)throw new Error('ROUTINE_NOT_FOUND');
  if(routine.status==='DRAFT')throw new Error('ROUTINE_NOT_ACTIVATED');
  if(routine.status==='STOPPED'||routine.status==='EXPIRED'||routine.status==='NEEDS_USER')throw new Error('ROUTINE_CANNOT_RUN');
  if(routine.status==='LIMITED'&&source!=='RETRY')throw new Error('ROUTINE_RETRY_REQUIRED');
  if(source==='RETRY'&&routine.status!=='LIMITED')throw new Error('ROUTINE_RETRY_NOT_AVAILABLE');
  if(routine.executionBehavior!=='RECOMMEND_ONLY')throw new Error('M11_AUTONOMOUS_EXECUTION_UNAVAILABLE');
  if(await hasActiveRun(routine.id))throw new Error('ROUTINE_RUN_IN_PROGRESS');
  const now=new Date();const run=await createRun(ownerUserId,routine,source,`${source.toLowerCase()}:${now.toISOString()}:${randomUUID()}`,now);return launchRoutineJob(ownerUserId,routine,run);
}

function conditionNext(config:ConditionTriggerConfig,now=new Date()):Date{return new Date(now.getTime()+config.pollEveryMinutes*60_000);}

async function evaluateConditionRoutine(ownerUserId:string,routine:DurableRoutine,dueAt:Date):Promise<void>{
  const config=routine.triggerConfig as ConditionTriggerConfig;if(await hasActiveRun(routine.id)){await getDatabasePool().query(`UPDATE routine SET next_run_at=$3,updated_at=now() WHERE owner_user_id=$1 AND id=$2 AND status='WATCHING'`,[ownerUserId,routine.id,conditionNext(config)]);return;}const run=await createRun(ownerUserId,routine,'CONDITION',`condition:${dueAt.toISOString()}`,dueAt);if(run.status!=='QUEUED')return;
  await getDatabasePool().query(`UPDATE routine_run SET status='EVALUATING',started_at=COALESCE(started_at,now()),updated_at=now() WHERE id=$1`,[run.id]);
  try{
    const observation=await readDeterministicMarketMetric({query:config.query,metric:config.metric,...(config.network?{network:config.network}:{}),...(config.address?{address:config.address}:{})});
    const matched=evaluateCondition(config.operator,observation.value,config.threshold);
    if(!matched){
      await getDatabasePool().query(`UPDATE routine_run SET status='NO_CHANGE',meaningful=false,result_code='CONDITION_FALSE',summary=$2,completed_at=now(),service_cost_usd=0,updated_at=now() WHERE id=$1`,[run.id,`${config.metric}=${observation.value} did not satisfy ${config.operator} ${config.threshold}.`]);
      await getDatabasePool().query(`UPDATE routine SET status='WATCHING',last_run_at=now(),next_run_at=$3,consecutive_failures=0,updated_at=now() WHERE owner_user_id=$1 AND id=$2 AND status='WATCHING'`,[ownerUserId,routine.id,conditionNext(config)]);
      return;
    }
    await getDatabasePool().query(`UPDATE routine_run SET summary=$2,updated_at=now() WHERE id=$1`,[run.id,`${config.metric}=${observation.value} satisfied ${config.operator} ${config.threshold}.`]);
    const launched=await launchRoutineJob(ownerUserId,routine,(await getRoutineRun(ownerUserId,run.id))!);
    if(launched.status==='RUNNING'){
      const cooldown=Math.max(0,config.cooldownMinutes)*60_000;await getDatabasePool().query(`UPDATE routine SET status=$3,next_run_at=$4,updated_at=now() WHERE owner_user_id=$1 AND id=$2 AND status='WATCHING'`,[ownerUserId,routine.id,cooldown>0?'COOLING_DOWN':'WATCHING',new Date(Date.now()+(cooldown||config.pollEveryMinutes*60_000))]);
    }
  }catch(error){
    const message=error instanceof Error?error.message:String(error);await getDatabasePool().query(`UPDATE routine_run SET status='FAILED_RETRYABLE',result_code='CONDITION_PROVIDER_ERROR',summary='Condition check could not be completed.',last_error=$2,completed_at=now(),updated_at=now() WHERE id=$1`,[run.id,message.slice(0,1000)]);const failures=routine.consecutiveFailures+1;if(failures>=3)await markLimited(routine,'REPEATED_CONDITION_FAILURES','Repeated provider failures prevented condition checks.');else await getDatabasePool().query(`UPDATE routine SET status='WATCHING',consecutive_failures=$3,next_run_at=$4,updated_at=now() WHERE owner_user_id=$1 AND id=$2 AND status='WATCHING'`,[ownerUserId,routine.id,failures,conditionNext(config)]);
  }
}

async function processScheduledRoutine(ownerUserId:string,routine:DurableRoutine,dueAt:Date):Promise<void>{
  const config=routine.triggerConfig as ScheduledTriggerConfig;if(!await hasActiveRun(routine.id)){const run=await createRun(ownerUserId,routine,'SCHEDULE',`schedule:${dueAt.toISOString()}`,dueAt);if(run.status==='QUEUED')await launchRoutineJob(ownerUserId,routine,run);}
  const next=calculateNextScheduledAt(config,new Date(Math.max(Date.now(),dueAt.getTime()+1000)));await getDatabasePool().query(`UPDATE routine SET status='ACTIVE',next_run_at=$3,updated_at=now() WHERE owner_user_id=$1 AND id=$2 AND status NOT IN ('LIMITED','NEEDS_USER','PAUSED','STOPPED','EXPIRED')`,[ownerUserId,routine.id,next]);
}

async function processEventRoutines(limit:number):Promise<number>{
  const routines=await getDatabasePool().query<{id:string;owner_user_id:string;activated_at:Date;current_revision:number;trigger_config:Record<string,unknown>}>(`SELECT r.id,r.owner_user_id::text AS owner_user_id,r.activated_at,r.current_revision,rr.trigger_config FROM routine r JOIN routine_revision rr ON rr.routine_id=r.id AND rr.revision=r.current_revision WHERE r.status='WAITING_FOR_EVENT' AND rr.trigger_type='EVENT' AND r.activated_at IS NOT NULL ORDER BY r.updated_at ASC LIMIT $1`,[limit]);
  let triggered=0;
  for(const row of routines.rows){
    const config=row.trigger_config as unknown as EventTriggerConfig;const events=await getDatabasePool().query<{id:string;occurred_at:Date}>(`SELECT e.id,e.occurred_at FROM domain_event e WHERE e.owner_user_id=$1 AND e.occurred_at >= $2 AND e.event_type=ANY($3::text[]) AND ($5::text IS NULL OR e.worker_id=$5) AND (e.event_type<>'job.completed' OR NOT EXISTS(SELECT 1 FROM job j WHERE j.id=e.job_id AND j.origin_type='routine')) AND NOT EXISTS(SELECT 1 FROM routine_run rr WHERE rr.routine_id=$4 AND rr.event_id=e.id) ORDER BY e.occurred_at ASC LIMIT 5`,[row.owner_user_id,row.activated_at,config.eventTypes,row.id,config.workerId??null]);
    for(const event of events.rows){const routine=await getRoutine(row.owner_user_id,row.id);if(!routine||routine.status!=='WAITING_FOR_EVENT')break;if(await hasActiveRun(routine.id))break;const run=await createRun(row.owner_user_id,routine,'EVENT',`event:${event.id}`,event.occurred_at,event.id);if(run.status==='QUEUED'){await launchRoutineJob(row.owner_user_id,routine,run);triggered+=1;if(config.cooldownMinutes>0){await getDatabasePool().query(`UPDATE routine SET status='COOLING_DOWN',next_run_at=$3,updated_at=now() WHERE owner_user_id=$1 AND id=$2 AND status='WAITING_FOR_EVENT'`,[row.owner_user_id,row.id,new Date(Date.now()+config.cooldownMinutes*60_000)]);break;}}}
  }
  return triggered;
}

async function enforceCompletedRunBudget(args:{ownerUserId:string;routineId:string;serviceCost:number;serviceBudgetLimitUsd:string|null;serviceBudgetPeriodDays:number;maxCostPerRunUsd:string|null}):Promise<void>{
  const routine=await getRoutine(args.ownerUserId,args.routineId);if(!routine)return;
  const maxPerRun=parseNumber(args.maxCostPerRunUsd);
  if(maxPerRun!==undefined&&args.serviceCost>maxPerRun+Number.EPSILON){await markLimited(routine,'RUN_COST_EXCEEDED',`The completed run cost $${args.serviceCost.toFixed(4)} exceeded its $${maxPerRun.toFixed(4)} per-run ceiling. Future automatic runs are stopped for review.`);return;}
  const periodLimit=parseNumber(args.serviceBudgetLimitUsd);if(periodLimit===undefined)return;
  const usage=await getDatabasePool().query<{spent:string}>(`SELECT COALESCE(sum(service_cost_usd),0)::text AS spent FROM routine_run WHERE routine_id=$1 AND created_at>=now()-make_interval(days=>$2) AND status NOT IN ('QUEUED','EVALUATING','RUNNING')`,[args.routineId,args.serviceBudgetPeriodDays]);
  const spent=Number.parseFloat(usage.rows[0]?.spent??'0')||0;
  if(spent>periodLimit+Number.EPSILON)await markLimited(routine,'SERVICE_BUDGET_EXCEEDED',`Actual Routine service spend $${spent.toFixed(4)} exceeded the $${periodLimit.toFixed(4)} period limit. Future automatic runs are stopped for review.`);
}

async function reconcileRuns(limit:number):Promise<{completed:number;failed:number;needsUser:number}>{
  const rows=await getDatabasePool().query<{id:string;owner_user_id:string;routine_id:string;job_id:string;job_status:string;notification_policy:Record<string,unknown>;title:string;worker_id:string;consecutive_failures:number;service_budget_limit_usd:string|null;service_budget_period_days:number;max_cost_per_run_usd:string|null}>(`SELECT rr.id,rr.owner_user_id::text AS owner_user_id,rr.routine_id,rr.job_id,j.status AS job_status,rev.notification_policy,rev.service_budget_limit_usd,rev.service_budget_period_days,rev.max_cost_per_run_usd,r.title,r.worker_id,r.consecutive_failures FROM routine_run rr JOIN job j ON j.id=rr.job_id JOIN routine r ON r.id=rr.routine_id JOIN routine_revision rev ON rev.routine_id=r.id AND rev.revision=rr.routine_revision WHERE rr.status='RUNNING' AND rr.job_id IS NOT NULL AND j.status IN ('COMPLETED','FAILED_FINAL','FAILED_RECOVERABLE','BLOCKED','REQUIRES_USER') ORDER BY rr.started_at ASC LIMIT $1`,[limit]);
  let completed=0,failed=0,needsUser=0;
  for(const row of rows.rows){const cost=await getDatabasePool().query<{total:string}>(`SELECT COALESCE(sum(estimated_cost_usd),0)::text AS total FROM model_run WHERE job_id=$1`,[row.job_id]);const serviceCost=Number.parseFloat(cost.rows[0]?.total??'0')||0;
    if(row.job_status==='COMPLETED'){await getDatabasePool().query(`UPDATE routine_run SET status='COMPLETED',meaningful=true,result_code='JOB_COMPLETED',summary='Background Worker Job completed.',service_cost_usd=$2,completed_at=now(),updated_at=now() WHERE id=$1`,[row.id,serviceCost]);await getDatabasePool().query(`UPDATE routine SET last_meaningful_run_at=now(),consecutive_failures=0,updated_at=now() WHERE id=$1`,[row.routine_id]);const policy=row.notification_policy as unknown as RoutineNotificationPolicy;if(policy.mode==='always'||policy.mode==='meaningful')await createNotification({ownerUserId:row.owner_user_id,level:'IMPORTANT',title:`${row.title} completed`,summary:'A background Worker Job completed.',why:policy.humanReadable,target:{type:'job',id:row.job_id},groupKey:`routine:${row.routine_id}:result`,dedupeKey:`routine-run:${row.id}:completed`});await enforceCompletedRunBudget({ownerUserId:row.owner_user_id,routineId:row.routine_id,serviceCost,serviceBudgetLimitUsd:row.service_budget_limit_usd,serviceBudgetPeriodDays:row.service_budget_period_days,maxCostPerRunUsd:row.max_cost_per_run_usd});completed+=1;continue;}
    if(row.job_status==='BLOCKED'||row.job_status==='REQUIRES_USER'){await getDatabasePool().query(`UPDATE routine_run SET status='NEEDS_USER',result_code=$2,summary='Safe continuation requires user attention.',service_cost_usd=$3,completed_at=now(),updated_at=now() WHERE id=$1`,[row.id,row.job_status,serviceCost]);const changed=await getDatabasePool().query(`UPDATE routine SET status='NEEDS_USER',next_run_at=NULL,updated_at=now() WHERE id=$1 AND status NOT IN ('PAUSED','STOPPED','EXPIRED')`,[row.routine_id]);if(changed.rowCount)await createNotification({ownerUserId:row.owner_user_id,level:'NEEDS_USER',title:`${row.title} needs you`,summary:'A background Job cannot safely continue without you.',why:'AgentPlace stopped the Routine rather than widening authority or guessing.',target:{type:'routine',id:row.routine_id},dedupeKey:`routine-run:${row.id}:needs-user`});needsUser+=1;continue;}
    const failures=row.consecutive_failures+1;await getDatabasePool().query(`UPDATE routine_run SET status=$2,result_code=$3,summary='Background Worker Job failed.',service_cost_usd=$4,completed_at=now(),updated_at=now() WHERE id=$1`,[row.id,failures>=3?'FAILED_FINAL':'FAILED_RETRYABLE',row.job_status,serviceCost]);if(failures>=3){const routine=await getRoutine(row.owner_user_id,row.routine_id);if(routine)await markLimited(routine,'REPEATED_JOB_FAILURES','Repeated background Worker failures stopped future automatic runs.');}else await getDatabasePool().query(`UPDATE routine SET consecutive_failures=$2,updated_at=now() WHERE id=$1`,[row.routine_id,failures]);failed+=1;
  }
  return {completed,failed,needsUser};
}

async function expireRoutines():Promise<number>{const result=await getDatabasePool().query(`UPDATE routine r SET status='EXPIRED',next_run_at=NULL,updated_at=now() FROM routine_revision rr WHERE rr.routine_id=r.id AND rr.revision=r.current_revision AND rr.expires_at IS NOT NULL AND rr.expires_at<=now() AND r.status NOT IN ('STOPPED','EXPIRED')`);return result.rowCount??0;}

async function releaseCooldowns():Promise<number>{const result=await getDatabasePool().query(`UPDATE routine r SET status=CASE WHEN rr.trigger_type='CONDITION' THEN 'WATCHING' ELSE 'WAITING_FOR_EVENT' END, next_run_at=CASE WHEN rr.trigger_type='CONDITION' THEN now() ELSE NULL END,updated_at=now() FROM routine_revision rr WHERE rr.routine_id=r.id AND rr.revision=r.current_revision AND r.status='COOLING_DOWN' AND r.next_run_at<=now()`);return result.rowCount??0;}

async function claimDueRoutineIds(limit:number,leaseOwner:string):Promise<Array<{id:string;ownerUserId:string;dueAt:Date}>>{
  return withTransaction(async db=>{const selected=await db.query<{id:string;owner_user_id:string;next_run_at:Date}>(`SELECT id,owner_user_id::text AS owner_user_id,next_run_at FROM routine WHERE status IN ('ACTIVE','WATCHING') AND next_run_at IS NOT NULL AND next_run_at<=now() AND (lease_expires_at IS NULL OR lease_expires_at<now()) ORDER BY next_run_at ASC FOR UPDATE SKIP LOCKED LIMIT $1`,[limit]);for(const row of selected.rows)await db.query(`UPDATE routine SET lease_owner=$2,lease_expires_at=now()+interval '90 seconds' WHERE id=$1`,[row.id,leaseOwner]);return selected.rows.map((row)=>({id:row.id,ownerUserId:row.owner_user_id,dueAt:row.next_run_at}));});
}

export async function processRoutineSchedulerPass(args:{limit?:number;leaseOwner?:string}={}):Promise<{due:number;scheduled:number;conditions:number;events:number;completed:number;failed:number;needsUser:number;expired:number;cooldownsReleased:number}>{
  const limit=Math.min(100,Math.max(1,args.limit??25));const leaseOwner=args.leaseOwner??`scheduler_${process.pid}`;const expired=await expireRoutines();const cooldownsReleased=await releaseCooldowns();const reconciled=await reconcileRuns(limit);const claimed=await claimDueRoutineIds(limit,leaseOwner);let scheduled=0,conditions=0;
  for(const item of claimed){try{const routine=await getRoutine(item.ownerUserId,item.id);if(!routine)continue;if(routine.triggerType==='SCHEDULED'&&routine.status==='ACTIVE'){await processScheduledRoutine(item.ownerUserId,routine,item.dueAt);scheduled+=1;}else if(routine.triggerType==='CONDITION'&&routine.status==='WATCHING'){await evaluateConditionRoutine(item.ownerUserId,routine,item.dueAt);conditions+=1;}}finally{await getDatabasePool().query(`UPDATE routine SET lease_owner=NULL,lease_expires_at=NULL WHERE id=$1 AND lease_owner=$2`,[item.id,leaseOwner]);}}
  const events=await processEventRoutines(limit);
  return {due:claimed.length,scheduled,conditions,events,completed:reconciled.completed,failed:reconciled.failed,needsUser:reconciled.needsUser,expired,cooldownsReleased};
}

export function draftRoutineFromNaturalLanguage(args:{workerId:string;workerName:string;environment:RoutineEnvironment;instruction:string;timeZone:string}):CreateRoutineInput{
  const text=args.instruction.trim();
  if(!text)throw new Error('INVALID_ROUTINE_INPUT');
  assertTimeZone(args.timeZone);

  const onlyNeedsUser=/only.{0,40}(?:need\s+me|needs\s+you|requires?\s+me)/i.test(text);
  const quietUnlessMeaningful=/only\s+(?:tell|notify)|don'?t\s+(?:tell|notify)|unless\s+(?:something\s+)?(?:material|meaningful)/i.test(text);
  const notificationPolicy:RoutineNotificationPolicy={
    mode:onlyNeedsUser?'needs-user':'meaningful',
    humanReadable:onlyNeedsUser
      ?'Only when the Routine needs you.'
      :quietUnlessMeaningful
        ?'Only when background work produces a meaningful result or needs you.'
        :'Notify when a background Job produces a meaningful result.',
  };
  const title=args.workerName==='Stablecoin Manager'?'Stablecoin opportunity check':args.workerName==='Meme Scout'?'Meme monitoring':`${args.workerName} Routine`;

  const conditionMatch=/\bwhen\s+(.{1,80}?)\s+(price|liquidity|(?:24h\s+)?volume|market\s*cap|fdv)\s+(?:is\s+)?(above|over|greater\s+than|at\s+least|>=|below|under|less\s+than|at\s+most|<=|equals?|=)\s*\$?([0-9]+(?:\.[0-9]+)?)([kmb])?\b/i.exec(text);
  if(conditionMatch){
    const query=conditionMatch[1]!.trim().replace(/^(?:the\s+)?/i,'');
    const metricText=conditionMatch[2]!.toLowerCase().replace(/\s+/g,'');
    const metric:DeterministicMarketMetric=metricText==='price'?'priceUsd':metricText==='liquidity'?'liquidityUsd':metricText.includes('volume')?'volume24hUsd':metricText.includes('marketcap')?'marketCapUsd':'fdvUsd';
    const operatorText=conditionMatch[3]!.toLowerCase();
    const operator:ConditionTriggerConfig['operator']=operatorText==='above'||operatorText==='over'||operatorText==='greater than'?'GT':operatorText==='at least'||operatorText==='>='?'GTE':operatorText==='below'||operatorText==='under'||operatorText==='less than'?'LT':operatorText==='at most'||operatorText==='<='?'LTE':'EQ';
    const suffix=(conditionMatch[5]??'').toLowerCase();
    const multiplier=suffix==='k'?1_000:suffix==='m'?1_000_000:suffix==='b'?1_000_000_000:1;
    const threshold=Number(conditionMatch[4])*multiplier;
    if(!Number.isFinite(threshold))throw new Error('INVALID_ROUTINE_CONDITION');
    const pollMatch=/every\s+(\d+)\s+(minutes?|hours?)/i.exec(text);
    const pollEveryMinutes=pollMatch?Math.max(5,Math.min(1440,Number(pollMatch[1])*(pollMatch[2]!.toLowerCase().startsWith('hour')?60:1))):15;
    const config:ConditionTriggerConfig={metric,query,operator,threshold,pollEveryMinutes,cooldownMinutes:60,humanReadable:`Watch ${query} ${conditionMatch[2]!.toLowerCase()} · trigger ${operator} ${threshold}`};
    return {title,workerId:args.workerId,environment:args.environment,instruction:text,triggerType:'CONDITION',triggerConfig:config,executionBehavior:'RECOMMEND_ONLY',notificationPolicy};
  }

  const eventRules:Array<{pattern:RegExp;eventType:string;label:string}>=[
    {pattern:/\bwhen\s+(?:a|one of .*?)?\s*jobs?\s+(?:is\s+)?completed?\b/i,eventType:'job.completed',label:'When a Job completes'},
    {pattern:/\bwhen\s+(?:an?\s+)?outcome\s+(?:is\s+)?verified\b/i,eventType:'outcome.verified',label:'When an outcome is verified'},
    {pattern:/\bwhen\s+(?:an?\s+)?action\s+(?:is\s+)?blocked\b/i,eventType:'action.blocked',label:'When an action is blocked'},
    {pattern:/\bwhen\s+(?:a|the)?\s*wallet\s+(?:is\s+)?disconnected\b/i,eventType:'wallet.disconnected',label:'When a wallet disconnects'},
    {pattern:/\bwhen\s+(?:an?\s+)?authority\s+(?:is\s+)?expir(?:es|ing|ed)\b/i,eventType:'authority.expiring',label:'When authority is expiring'},
  ];
  const eventRule=eventRules.find((rule)=>rule.pattern.test(text));
  if(eventRule){
    const config:EventTriggerConfig={eventTypes:[eventRule.eventType],cooldownMinutes:0,humanReadable:eventRule.eventType==='job.completed'?`When ${args.workerName} completes a Job`:eventRule.label,...(eventRule.eventType==='job.completed'?{workerId:args.workerId}:{})};
    return {title,workerId:args.workerId,environment:args.environment,instruction:text,triggerType:'EVENT',triggerConfig:config,executionBehavior:'RECOMMEND_ONLY',notificationPolicy};
  }

  const timeMatch=/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text);
  let localTime='08:00';
  if(timeMatch){
    let hour=Number(timeMatch[1]);const minute=Number(timeMatch[2]??'0');const meridiem=(timeMatch[3]??'').toLowerCase();
    if(meridiem==='pm'&&hour<12)hour+=12;if(meridiem==='am'&&hour===12)hour=0;
    localTime=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }
  let config:ScheduledTriggerConfig;
  const everyMinutes=/every\s+(\d+)\s+minutes?/i.exec(text);const everyHours=/every\s+(\d+)\s+hours?/i.exec(text);
  if(everyMinutes||everyHours){
    const minutes=everyMinutes?Number(everyMinutes[1]):Number(everyHours?.[1])*60;
    const safeMinutes=Math.max(5,Math.min(43200,minutes));
    config={kind:'interval',intervalMinutes:safeMinutes,timeZone:args.timeZone,humanReadable:safeMinutes%60===0?`Every ${safeMinutes/60} hour${safeMinutes===60?'':'s'}`:`Every ${safeMinutes} minutes`};
  }else if(/weekday/i.test(text)){
    config={kind:'weekly',localTime,weekdays:['MON','TUE','WED','THU','FRI'],timeZone:args.timeZone,humanReadable:`Weekdays · ${localTime} · ${args.timeZone}`};
  }else{
    config={kind:'daily',localTime,timeZone:args.timeZone,humanReadable:`Daily · ${localTime} · ${args.timeZone}`};
  }
  return {title,workerId:args.workerId,environment:args.environment,instruction:scheduledRoutineWorkInstruction(text),triggerType:'SCHEDULED',triggerConfig:config,executionBehavior:'RECOMMEND_ONLY',notificationPolicy};
}
export const moduleManifest={name:'routines',layer:'controlled-runtime',milestone:11,status:'durable-routines-background-scheduler'} as const;
