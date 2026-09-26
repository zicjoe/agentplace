import { randomUUID } from 'node:crypto';
import { getDatabasePool } from '@agent-place/db';

export type WorkerOrigin = 'agentplace-original' | 'community' | 'custom';
export type UserWorkerStatus = 'working' | 'monitoring' | 'standby' | 'needs-you' | 'paused' | 'limited' | 'blocked' | 'issue' | 'removed';

export interface WorkerCatalogItem {
  id: string;
  slug: string;
  origin: WorkerOrigin;
  creatorName: string;
  name: string;
  tagline: string;
  responsibility: string;
  category: string;
  versionId: string;
  version: string;
  defaultAutonomy: string;
  jobContract: {
    mission: string;
    responsibilities: string[];
    antiJobs: string[];
    expectedOutputs: string[];
    successConditions: string[];
    defaultApprovalBoundary: string;
    defaultCapabilityRequirements: string[];
  };
}

export interface DurableUserWorker extends WorkerCatalogItem {
  status: UserWorkerStatus;
  currentFocus?: string;
  currentJobId?: string;
  primaryConversationId?: string;
  addedAt: string;
  updatedAt: string;
}

type CatalogRow = {
  id: string; slug: string; origin: WorkerOrigin; creator_name: string; name: string; tagline: string; responsibility: string; category: string;
  version_id: string; version: string; default_autonomy: string; mission: string; responsibilities: unknown; anti_jobs: unknown; expected_outputs: unknown;
  success_conditions: unknown; default_approval_boundary: string; default_capability_requirements: unknown;
};

type UserWorkerRow = CatalogRow & {
  status: UserWorkerStatus; current_focus: string | null; current_job_id: string | null; primary_conversation_id: string | null;
  added_at: Date; updated_at: Date;
};

function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []; }
function catalog(row: CatalogRow): WorkerCatalogItem {
  return {
    id: row.id, slug: row.slug, origin: row.origin, creatorName: row.creator_name, name: row.name, tagline: row.tagline,
    responsibility: row.responsibility, category: row.category, versionId: row.version_id, version: row.version, defaultAutonomy: row.default_autonomy,
    jobContract: {
      mission: row.mission, responsibilities: strings(row.responsibilities), antiJobs: strings(row.anti_jobs), expectedOutputs: strings(row.expected_outputs),
      successConditions: strings(row.success_conditions), defaultApprovalBoundary: row.default_approval_boundary,
      defaultCapabilityRequirements: strings(row.default_capability_requirements),
    },
  };
}
function durable(row: UserWorkerRow): DurableUserWorker {
  const out: DurableUserWorker = { ...catalog(row), status: row.status, addedAt: row.added_at.toISOString(), updatedAt: row.updated_at.toISOString() };
  if (row.current_focus) out.currentFocus = row.current_focus;
  if (row.current_job_id) out.currentJobId = row.current_job_id;
  if (row.primary_conversation_id) out.primaryConversationId = row.primary_conversation_id;
  return out;
}

const catalogSelect = `d.id,d.slug,d.origin,d.creator_name,d.name,d.tagline,d.responsibility,d.category,
  v.id AS version_id,v.version,v.default_autonomy,c.mission,c.responsibilities,c.anti_jobs,c.expected_outputs,c.success_conditions,
  c.default_approval_boundary,c.default_capability_requirements`;
const catalogFrom = `FROM worker_definition d
  JOIN LATERAL (SELECT * FROM worker_version wv WHERE wv.worker_definition_id=d.id AND wv.retired_at IS NULL ORDER BY wv.released_at DESC LIMIT 1) v ON true
  JOIN job_contract c ON c.worker_version_id=v.id`;
const catalogSql = `SELECT ${catalogSelect} ${catalogFrom}`;

export async function listWorkerCatalog(): Promise<WorkerCatalogItem[]> {
  const result = await getDatabasePool().query<CatalogRow>(`${catalogSql} WHERE d.publication_status='published' ORDER BY (d.origin='agentplace-original') DESC,d.name`);
  return result.rows.map(catalog);
}

export async function listUserWorkers(ownerUserId: string, includeRemoved = false): Promise<DurableUserWorker[]> {
  const result = await getDatabasePool().query<UserWorkerRow>(`SELECT ${catalogSelect}, uw.status,uw.current_focus,uw.current_job_id,uw.primary_conversation_id,uw.added_at,uw.updated_at ${catalogFrom}
    JOIN user_worker uw ON uw.worker_definition_id=d.id AND uw.worker_version_id=v.id
    WHERE uw.owner_user_id=$1 AND ($2::boolean OR uw.status <> 'removed')
    ORDER BY uw.added_at DESC`, [ownerUserId, includeRemoved]);
  return result.rows.map((row) => durable({ ...row, status: row.status, current_focus: row.current_focus, current_job_id: row.current_job_id, primary_conversation_id: row.primary_conversation_id, added_at: row.added_at, updated_at: row.updated_at }));
}

export async function getUserWorker(ownerUserId: string, workerId: string): Promise<DurableUserWorker | null> {
  const result = await getDatabasePool().query<UserWorkerRow>(`SELECT ${catalogSelect}, uw.status,uw.current_focus,uw.current_job_id,uw.primary_conversation_id,uw.added_at,uw.updated_at ${catalogFrom}
    JOIN user_worker uw ON uw.worker_definition_id=d.id AND uw.worker_version_id=v.id
    WHERE uw.owner_user_id=$1 AND uw.id=$2`, [ownerUserId, workerId]);
  return result.rows[0] ? durable(result.rows[0]) : null;
}

export async function installWorker(ownerUserId: string, definitionId: string): Promise<DurableUserWorker> {
  const before = await getUserWorker(ownerUserId, definitionId);
  const lookup = await getDatabasePool().query<{version_id:string}>(`SELECT v.id AS version_id FROM worker_definition d
    JOIN LATERAL (SELECT id FROM worker_version WHERE worker_definition_id=d.id AND retired_at IS NULL ORDER BY released_at DESC LIMIT 1) v ON true
    WHERE d.id=$1 AND d.publication_status='published'`, [definitionId]);
  const versionId = lookup.rows[0]?.version_id;
  if (!versionId) throw new Error('WORKER_DEFINITION_NOT_FOUND');
  await getDatabasePool().query(`INSERT INTO user_worker(owner_user_id,id,worker_definition_id,worker_version_id,status)
    VALUES($1,$2,$2,$3,'standby')
    ON CONFLICT(owner_user_id,worker_definition_id) DO UPDATE SET status=CASE WHEN user_worker.status='removed' THEN 'standby' ELSE user_worker.status END, removed_at=NULL, updated_at=now()`, [ownerUserId, definitionId, versionId]);
  const worker = await getUserWorker(ownerUserId, definitionId);
  if (!worker) throw new Error('WORKER_INSTALL_FAILED');
  if (!before || before.status === 'removed') {
    await recordWorkerEvent(ownerUserId, `evt_${randomUUID()}`, definitionId, 'worker.added', `${worker.name} added to your workforce`, 'Standing by · No financial authority', 'standby');
  }
  return worker;
}

export async function updateUserWorker(ownerUserId: string, workerId: string, patch: {status?: UserWorkerStatus; currentFocus?: string | null; currentJobId?: string | null; primaryConversationId?: string | null}): Promise<DurableUserWorker | null> {
  const existing = await getUserWorker(ownerUserId, workerId);
  if (!existing) return null;
  const status = patch.status ?? existing.status;
  const removedAt = status === 'removed' ? new Date().toISOString() : null;
  await getDatabasePool().query(`UPDATE user_worker SET status=$3,current_focus=$4,current_job_id=$5,primary_conversation_id=$6,removed_at=$7,updated_at=now()
    WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, workerId, status, patch.currentFocus ?? existing.currentFocus ?? null, patch.currentJobId ?? existing.currentJobId ?? null, patch.primaryConversationId ?? existing.primaryConversationId ?? null, removedAt]);
  if (patch.status && patch.status !== existing.status) {
    const eventType = patch.status === 'paused' ? 'worker.paused' : patch.status === 'removed' ? 'worker.removed' : 'worker.status.changed';
    await recordWorkerEvent(ownerUserId, `evt-${eventType}-${workerId}-${Date.now()}`, workerId, eventType, `${existing.name} ${patch.status === 'paused' ? 'paused' : patch.status === 'removed' ? 'removed from workforce' : 'status changed'}`, `Status: ${patch.status}`, patch.status);
  }
  return getUserWorker(ownerUserId, workerId);
}

async function recordWorkerEvent(ownerUserId: string, id: string, workerId: string, eventType: string, title: string, summary: string, status: string): Promise<void> {
  await getDatabasePool().query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,worker_id,origin_type)
    VALUES($1,$2,$3,'worker',$4,$5,$6,$7,$4,'user') ON CONFLICT(id) DO NOTHING`, [id, ownerUserId, eventType, workerId, title, summary, status]);
}

export const moduleManifest = { name: 'workers', layer: 'controlled-runtime', milestone: 3, status: 'production-foundation' } as const;
