import { createHash, randomUUID } from 'node:crypto';
import { getDatabasePool, withTransaction } from '@agent-place/db';
import {
  validateCapabilityImport,
  validateCreatorWorkerDraft,
  validateWorkflowDraft,
  runtimeEligibilityForImportedOperation,
  type CapabilityImportDraft,
  type CreatorWorkerDraft,
  type CreatorWorkflowDraft,
  type CreatorPublicationStatus,
  type CreatorBuilderIntent,
  type CreatorBuilderOperation,
} from '@agent-place/creator-sdk';

export type DiscoverReadiness = 'available' | 'limited' | 'preview' | 'unavailable';
export type DiscoverAssetType = 'worker' | 'workflow' | 'capability';

export interface DiscoverItem {
  id: string;
  type: DiscoverAssetType;
  assetId: string;
  workerDefinitionId?: string;
  name: string;
  tagline: string;
  description: string;
  creatorName: string;
  isOriginal: boolean;
  category: string;
  networks: string[];
  pricing: { type: 'free' | 'paid'; label?: string };
  visibility: 'public' | 'unlisted';
  authorityDefault?: string;
  sponsored: boolean;
  version: string;
  readiness: DiscoverReadiness;
  readinessReason: string;
  requiredCapabilities: string[];
  lastUpdated: string;
  forkSourceId?: string;
  forkSourceName?: string;
  forkSourceCreator?: string;
  allowsCustomization: boolean;
}

export interface CreatorAssetRecord {
  id: string;
  type: DiscoverAssetType;
  visibility: CreatorPublicationStatus;
  name: string;
  version: string;
  versionId?: string;
  versionHistory?: Array<{ versionId: string; version: string; releasedAt: string }>;
  createdAt: string;
  updatedAt: string;
  worker?: CreatorWorkerDraft;
  workflow?: CreatorWorkflowDraft;
  capability?: CapabilityImportDraft;
  lineage?: { sourceType: DiscoverAssetType; sourceId: string; sourceVersionId?: string; sourceName: string; sourceCreator: string };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function id(prefix: string): string { return `${prefix}_${randomUUID()}`; }
function stableJsonValue(value: unknown): unknown {
  if(Array.isArray(value)) return value.map(stableJsonValue);
  if(value&&typeof value==='object'){
    const row=value as Record<string,unknown>;
    return Object.fromEntries(Object.keys(row).sort().map((key)=>[key,stableJsonValue(row[key])]));
  }
  return value;
}
function stableJson(value: unknown): string { return JSON.stringify(stableJsonValue(value)); }

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'worker';
  return `${base}-${randomUUID().slice(0, 8)}`;
}
function nextVersion(current?: string): string {
  if (!current) return '0.1.0';
  const match = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return '0.1.0';
  return `${match[1]}.${Number(match[2]) + 1}.0`;
}

async function workerReadiness(versionId: string, required: string[]): Promise<{readiness: DiscoverReadiness; reason: string}> {
  if (required.length === 0) return { readiness: 'preview', reason: 'No production capability requirements are mapped yet.' };
  const result = await getDatabasePool().query<{id:string; effect:string; lifecycle_status:string; usable:boolean}>(`
    SELECT c.id,c.effect,c.lifecycle_status,
      EXISTS(SELECT 1 FROM capability_implementation i WHERE i.canonical_capability_id=c.id AND i.enabled=true AND i.health_status IN ('healthy','degraded')) AS usable
    FROM canonical_capability c WHERE c.id=ANY($1::text[])`, [required]);
  const byId = new Map(result.rows.map((row) => [row.id, row]));
  const missing = required.filter((capability) => !byId.has(capability));
  if (missing.length > 0) return { readiness: 'preview', reason: `Required capabilities are not production-registered: ${missing.join(', ')}.` };
  const economic = result.rows.some((row) => row.effect === 'economic-write');
  if (economic) return { readiness: 'limited', reason: 'Financial capabilities remain subject to AgentPlace authority and execution-path readiness.' };
  const unavailable = result.rows.filter((row) => row.lifecycle_status === 'planned' || !row.usable);
  if (unavailable.length > 0) return { readiness: 'limited', reason: `Some required capabilities are not fully production-routable: ${unavailable.map((row) => row.id).join(', ')}.` };
  // An explicit route is required for creator workers. AgentPlace Originals can remain visible with capability readiness.
  const routes = await getDatabasePool().query<{count:string}>(`SELECT count(*)::text AS count FROM worker_capability_route WHERE worker_version_id=$1`, [versionId]);
  if (Number(routes.rows[0]?.count ?? 0) === 0) return { readiness: 'preview', reason: 'Capability routes have not been activated for this Worker version.' };
  return { readiness: 'available', reason: 'Required read/research capabilities have usable production routes.' };
}

export async function listDiscoverSupply(): Promise<DiscoverItem[]> {
  const workerRows = await getDatabasePool().query<{
    id:string; version_id:string; name:string; tagline:string; responsibility:string; creator_name:string; origin:string; category:string;
    version:string; default_approval_boundary:string; default_capability_requirements:unknown; updated_at:Date;
    source_id:string|null; source_name:string|null; source_creator:string|null;
  }>(`SELECT d.id,v.id AS version_id,d.name,d.tagline,d.responsibility,d.creator_name,d.origin,d.category,v.version,
    c.default_approval_boundary,c.default_capability_requirements,d.updated_at,
    l.source_id,l.source_name,l.source_creator
    FROM worker_definition d
    JOIN LATERAL (SELECT * FROM worker_version wv WHERE wv.worker_definition_id=d.id AND wv.retired_at IS NULL ORDER BY wv.released_at DESC LIMIT 1) v ON true
    JOIN job_contract c ON c.worker_version_id=v.id
    LEFT JOIN creator_lineage l ON l.child_type='worker' AND l.child_id=d.id
    WHERE d.publication_status='published' AND d.trust_status <> 'quarantined'
    ORDER BY (d.origin='agentplace-original') DESC,d.updated_at DESC,d.name`);

  const workers: DiscoverItem[] = [];
  for (const row of workerRows.rows) {
    const required = strings(row.default_capability_requirements);
    const readiness = await workerReadiness(row.version_id, required);
    workers.push({
      id:`discover-worker-${row.id}`,type:'worker',assetId:row.id,workerDefinitionId:row.id,name:row.name,tagline:row.tagline,description:row.responsibility,
      creatorName:row.creator_name,isOriginal:row.origin==='agentplace-original',category:row.category,networks:[],pricing:{type:'free'},visibility:'public',
      authorityDefault:row.default_approval_boundary,sponsored:false,version:row.version,readiness:readiness.readiness,readinessReason:readiness.reason,
      requiredCapabilities:required,lastUpdated:row.updated_at.toISOString(),allowsCustomization:true,
      ...(row.source_id?{forkSourceId:row.source_id}:{ } as object),...(row.source_name?{forkSourceName:row.source_name}:{ } as object),...(row.source_creator?{forkSourceCreator:row.source_creator}:{ } as object),
    });
  }

  const listingRows = await getDatabasePool().query<{
    id:string; asset_type:'workflow'|'capability'; asset_id:string; name:string; tagline:string; description:string; creator_name:string; category:string;
    visibility:'public'|'unlisted'; pricing_type:'free'|'paid'; pricing_label:string|null; sponsored:boolean; version:string; authority_default:string|null;
    networks:unknown; metadata:unknown; updated_at:Date;
  }>(`SELECT id,asset_type,asset_id,name,tagline,description,creator_name,category,visibility,pricing_type,pricing_label,sponsored,version,authority_default,networks,metadata,updated_at
    FROM marketplace_listing WHERE retired_at IS NULL AND visibility='public' AND asset_type IN ('workflow','capability') ORDER BY updated_at DESC`);
  const other = listingRows.rows.map((row):DiscoverItem => {
    const meta = record(row.metadata);
    const status = typeof meta.readiness === 'string' && ['available','limited','preview','unavailable'].includes(meta.readiness) ? meta.readiness as DiscoverReadiness : 'preview';
    return {
      id:row.id,type:row.asset_type,assetId:row.asset_id,name:row.name,tagline:row.tagline,description:row.description,creatorName:row.creator_name,isOriginal:false,
      category:row.category,networks:strings(row.networks),pricing:row.pricing_label?{type:row.pricing_type,label:row.pricing_label}:{type:row.pricing_type},visibility:row.visibility,
      ...(row.authority_default?{authorityDefault:row.authority_default}:{}),sponsored:row.sponsored,version:row.version,readiness:status,
      readinessReason:typeof meta.readinessReason==='string'?meta.readinessReason:'Creator asset is visible but not promoted into trusted AgentPlace routing.',
      requiredCapabilities:strings(meta.requiredCapabilities),lastUpdated:row.updated_at.toISOString(),allowsCustomization:true,
    };
  });
  return [...workers, ...other];
}

export async function createCreatorWorker(ownerUserId: string, creatorName: string, input: CreatorWorkerDraft): Promise<CreatorAssetRecord> {
  const draft = validateCreatorWorkerDraft(input);
  const definitionId = id('cw');
  const versionId = id('cwv');
  await withTransaction(async (client) => {
    await client.query(`INSERT INTO worker_definition(id,slug,origin,creator_user_id,creator_name,name,tagline,responsibility,category,publication_status,trust_status)
      VALUES($1,$2,'custom',$3,$4,$5,$6,$7,$8,'draft','unverified')`, [definitionId,slugify(draft.name),ownerUserId,creatorName,draft.name,draft.tagline,draft.responsibility,draft.category]);
    await client.query(`INSERT INTO worker_version(id,worker_definition_id,version,instructions,default_autonomy,capability_requirements)
      VALUES($1,$2,'0.1.0',$3,'research-recommend',$4::jsonb)`, [versionId,definitionId,JSON.stringify({method:draft.method,collaborators:draft.collaborators??[],networks:draft.networks}),JSON.stringify(draft.capabilityRequirements)]);
    await client.query(`INSERT INTO job_contract(worker_version_id,mission,responsibilities,anti_jobs,expected_outputs,success_conditions,default_approval_boundary,default_capability_requirements)
      VALUES($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8::jsonb)`, [versionId,draft.mission,JSON.stringify(draft.responsibilities),JSON.stringify(draft.antiJobs),JSON.stringify(draft.expectedOutputs),JSON.stringify(draft.successConditions),draft.authorityDefault,JSON.stringify(draft.capabilityRequirements)]);
    for (const capabilityId of draft.capabilityRequirements) {
      await client.query(`INSERT INTO worker_capability_route(worker_version_id,canonical_capability_id,suitability)
        SELECT $1,id,'primary' FROM canonical_capability WHERE id=$2 AND effect='read' ON CONFLICT DO NOTHING`, [versionId,capabilityId]);
    }
    if (draft.lineage) {
      await client.query(`INSERT INTO creator_lineage(child_type,child_id,source_type,source_id,source_version_id,source_name,source_creator)
        VALUES('worker',$1,$2,$3,$4,$5,$6)`, [definitionId,draft.lineage.sourceType,draft.lineage.sourceId,draft.lineage.sourceVersionId??null,draft.lineage.sourceName,draft.lineage.sourceCreator]);
    }
  });
  return {id:definitionId,type:'worker',visibility:'draft',name:draft.name,version:'0.1.0',versionId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),worker:draft,...(draft.lineage?{lineage:draft.lineage}:{})};
}

export async function createCreatorWorkflow(ownerUserId:string,input:CreatorWorkflowDraft):Promise<CreatorAssetRecord>{
  const draft=validateWorkflowDraft(input); const definitionId=id('wf'); const versionId=id('wfv');
  await withTransaction(async (client) => {
    await client.query(`INSERT INTO workflow_definition(id,creator_user_id,name,purpose) VALUES($1,$2,$3,$4)`,[definitionId,ownerUserId,draft.name,draft.purpose]);
    await client.query(`INSERT INTO workflow_version(id,workflow_definition_id,version,inputs,steps,conditions,outputs,required_capabilities,safety_boundaries,compatible_workers)
      VALUES($1,$2,'0.1.0',$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb)`,[versionId,definitionId,JSON.stringify(draft.inputs),JSON.stringify(draft.steps),JSON.stringify(draft.conditions),JSON.stringify(draft.outputs),JSON.stringify(draft.requiredCapabilities),JSON.stringify(draft.safetyBoundaries),JSON.stringify(draft.compatibleWorkers)]);
  });
  return {id:definitionId,type:'workflow',visibility:'draft',name:draft.name,version:'0.1.0',versionId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),workflow:draft};
}

export async function createNewWorkflowVersion(ownerUserId:string,definitionId:string,input:CreatorWorkflowDraft):Promise<CreatorAssetRecord>{
  const draft=validateWorkflowDraft(input);
  const current=await getDatabasePool().query<{version:string}>(`SELECT v.version FROM workflow_definition d JOIN LATERAL(SELECT version FROM workflow_version WHERE workflow_definition_id=d.id AND retired_at IS NULL ORDER BY released_at DESC LIMIT 1)v ON true WHERE d.id=$1 AND d.creator_user_id=$2`,[definitionId,ownerUserId]);
  const row=current.rows[0]; if(!row)throw new Error('CREATOR_WORKFLOW_NOT_FOUND');
  const version=nextVersion(row.version); const versionId=id('wfv');
  await withTransaction(async(client)=>{
    await client.query(`INSERT INTO workflow_version(id,workflow_definition_id,version,inputs,steps,conditions,outputs,required_capabilities,safety_boundaries,compatible_workers)
      VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb)`,[versionId,definitionId,version,JSON.stringify(draft.inputs),JSON.stringify(draft.steps),JSON.stringify(draft.conditions),JSON.stringify(draft.outputs),JSON.stringify(draft.requiredCapabilities),JSON.stringify(draft.safetyBoundaries),JSON.stringify(draft.compatibleWorkers)]);
    await client.query(`UPDATE workflow_definition SET name=$3,purpose=$4,publication_status='draft',updated_at=now() WHERE id=$1 AND creator_user_id=$2`,[definitionId,ownerUserId,draft.name,draft.purpose]);
  });
  return {id:definitionId,type:'workflow',visibility:'draft',name:draft.name,version,versionId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),workflow:draft};
}

export async function createCapabilityImport(ownerUserId:string,input:CapabilityImportDraft):Promise<CreatorAssetRecord>{
  const draft=validateCapabilityImport(input); const capabilityId=id('cc'); const versionId=id('ccv');
  const digest=createHash('sha256').update(JSON.stringify(draft)).digest('hex');
  await withTransaction(async(client)=>{
    await client.query(`INSERT INTO creator_capability(id,creator_user_id,name,import_type,endpoint,provider) VALUES($1,$2,$3,$4,$5,$6)`,[capabilityId,ownerUserId,draft.name,draft.importType,draft.endpoint??null,draft.provider??null]);
    await client.query(`INSERT INTO creator_capability_version(id,creator_capability_id,version,source_digest,source_metadata) VALUES($1,$2,$3,$4,$5::jsonb)`,[versionId,capabilityId,draft.version??'0.1.0',digest,JSON.stringify(draft.sourceMetadata??{})]);
    for(const operation of draft.operations){
      await client.query(`INSERT INTO creator_capability_operation(id,creator_capability_version_id,original_operation,canonical_capability_id,classification,description,input_schema,output_schema,runtime_eligibility)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,[id('cco'),versionId,operation.original,operation.canonical??null,operation.classification,operation.description,JSON.stringify(operation.inputSchema??{}),JSON.stringify(operation.outputSchema??{}),runtimeEligibilityForImportedOperation(operation.classification,draft.endpoint)]);
    }
  });
  return {id:capabilityId,type:'capability',visibility:'draft',name:draft.name,version:draft.version??'0.1.0',versionId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),capability:draft};
}

export async function listCreatorAssets(ownerUserId:string):Promise<CreatorAssetRecord[]>{
  const workers=await getDatabasePool().query<any>(`SELECT d.id,d.name,d.tagline,d.responsibility,d.category,d.publication_status,d.created_at,d.updated_at,v.id AS version_id,v.version,v.instructions,v.capability_requirements,c.*,
    l.source_type,l.source_id,l.source_version_id,l.source_name,l.source_creator
    FROM worker_definition d JOIN LATERAL(SELECT * FROM worker_version WHERE worker_definition_id=d.id AND retired_at IS NULL ORDER BY released_at DESC,id DESC LIMIT 1)v ON true
    JOIN job_contract c ON c.worker_version_id=v.id LEFT JOIN creator_lineage l ON l.child_type='worker' AND l.child_id=d.id
    WHERE d.creator_user_id=$1 ORDER BY d.updated_at DESC`,[ownerUserId]);
  const versionRows=await getDatabasePool().query<{worker_definition_id:string;version_id:string;version:string;released_at:Date}>(`SELECT v.worker_definition_id,v.id AS version_id,v.version,v.released_at
    FROM worker_version v JOIN worker_definition d ON d.id=v.worker_definition_id
    WHERE d.creator_user_id=$1 AND v.retired_at IS NULL ORDER BY v.worker_definition_id,v.released_at DESC,v.id DESC`,[ownerUserId]);
  const versionHistoryByWorker=new Map<string,Array<{versionId:string;version:string;releasedAt:string}>>();
  for(const versionRow of versionRows.rows){
    const history=versionHistoryByWorker.get(versionRow.worker_definition_id)??[];
    history.push({versionId:versionRow.version_id,version:versionRow.version,releasedAt:versionRow.released_at.toISOString()});
    versionHistoryByWorker.set(versionRow.worker_definition_id,history);
  }
  const workerAssets=workers.rows.map((row:any):CreatorAssetRecord=>{const instructions=record(row.instructions); const lineage=row.source_id?{sourceType:row.source_type,sourceId:row.source_id,sourceVersionId:row.source_version_id??undefined,sourceName:row.source_name,sourceCreator:row.source_creator}:undefined; return {
    id:row.id,type:'worker',visibility:row.publication_status,name:row.name,version:row.version,versionId:row.version_id,versionHistory:versionHistoryByWorker.get(row.id)??[],createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),
    worker:{name:row.name,tagline:row.tagline,responsibility:row.responsibility,category:row.category,mission:row.mission,responsibilities:strings(row.responsibilities),antiJobs:strings(row.anti_jobs),expectedOutputs:strings(row.expected_outputs),successConditions:strings(row.success_conditions),method:strings(instructions.method),capabilityRequirements:strings(row.capability_requirements),networks:strings(instructions.networks),authorityDefault:row.default_approval_boundary,collaborators:Array.isArray(instructions.collaborators)?instructions.collaborators as NonNullable<CreatorWorkerDraft['collaborators']>:[],...(lineage?{lineage}:{})},...(lineage?{lineage}:{})};});
  const workflows=await getDatabasePool().query<any>(`SELECT d.*,v.id AS version_id,v.version,v.inputs,v.steps,v.conditions,v.outputs,v.required_capabilities,v.safety_boundaries,v.compatible_workers FROM workflow_definition d JOIN LATERAL(SELECT * FROM workflow_version WHERE workflow_definition_id=d.id AND retired_at IS NULL ORDER BY released_at DESC LIMIT 1)v ON true WHERE d.creator_user_id=$1 ORDER BY d.updated_at DESC`,[ownerUserId]);
  const workflowAssets=workflows.rows.map((row:any):CreatorAssetRecord=>({id:row.id,type:'workflow',visibility:row.publication_status,name:row.name,version:row.version,versionId:row.version_id,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),workflow:{name:row.name,purpose:row.purpose,inputs:strings(row.inputs),steps:strings(row.steps),conditions:strings(row.conditions),outputs:strings(row.outputs),requiredCapabilities:strings(row.required_capabilities),safetyBoundaries:strings(row.safety_boundaries),compatibleWorkers:strings(row.compatible_workers)}}));
  const capabilities=await getDatabasePool().query<any>(`SELECT c.*,v.id AS version_id,v.version,v.source_metadata,jsonb_agg(jsonb_build_object('original',o.original_operation,'canonical',o.canonical_capability_id,'classification',o.classification,'description',o.description,'inputSchema',o.input_schema,'outputSchema',o.output_schema) ORDER BY o.original_operation) AS operations FROM creator_capability c JOIN LATERAL(SELECT * FROM creator_capability_version WHERE creator_capability_id=c.id AND retired_at IS NULL ORDER BY released_at DESC LIMIT 1)v ON true LEFT JOIN creator_capability_operation o ON o.creator_capability_version_id=v.id WHERE c.creator_user_id=$1 GROUP BY c.id,v.id,v.version,v.source_metadata ORDER BY c.updated_at DESC`,[ownerUserId]);
  const capabilityAssets=capabilities.rows.map((row:any):CreatorAssetRecord=>({id:row.id,type:'capability',visibility:row.publication_status,name:row.name,version:row.version,versionId:row.version_id,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),capability:{name:row.name,importType:row.import_type,endpoint:row.endpoint??undefined,provider:row.provider??undefined,version:row.version,operations:Array.isArray(row.operations)?row.operations:[],sourceMetadata:record(row.source_metadata)}}));
  return [...workerAssets,...workflowAssets,...capabilityAssets].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}

export async function publishCreatorAsset(ownerUserId:string,creatorName:string,type:DiscoverAssetType,assetId:string,visibility:'private'|'unlisted'|'published'):Promise<void>{
  const table=type==='worker'?'worker_definition':type==='workflow'?'workflow_definition':'creator_capability';
  const status=visibility;
  const ownerColumn=type==='worker'?'creator_user_id':'creator_user_id';
  const updated=await getDatabasePool().query(`UPDATE ${table} SET publication_status=$3,updated_at=now() WHERE id=$1 AND ${ownerColumn}=$2 RETURNING id`,[assetId,ownerUserId,status]);
  if(!updated.rowCount) throw new Error('CREATOR_ASSET_NOT_FOUND');
  if(visibility==='private'){await getDatabasePool().query(`UPDATE marketplace_listing SET retired_at=now(),updated_at=now() WHERE asset_type=$1 AND asset_id=$2`,[type,assetId]);return;}
  if(type==='worker') return; // Worker Discover is projected directly from canonical Worker tables.
  const assets=await listCreatorAssets(ownerUserId); const asset=assets.find((item)=>item.id===assetId&&item.type===type); if(!asset)throw new Error('CREATOR_ASSET_NOT_FOUND');
  const draft=asset.workflow??asset.capability; const description=asset.workflow?.purpose??`Imported ${asset.capability?.importType.toUpperCase()} capability`; const category=type==='workflow'?'Workflows':'For Builders';
  const metadata=type==='workflow'?{readiness:'preview',readinessReason:'Workflow is published; runtime support depends on its required capabilities.',requiredCapabilities:asset.workflow?.requiredCapabilities??[]}:{readiness:'preview',readinessReason:'Creator-imported capabilities are isolated from trusted production routing.',requiredCapabilities:[]};
  await getDatabasePool().query(`INSERT INTO marketplace_listing(id,asset_type,asset_id,creator_user_id,creator_name,name,tagline,description,category,visibility,pricing_type,version,authority_default,metadata)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'free',$11,$12,$13::jsonb)
    ON CONFLICT(asset_type,asset_id) DO UPDATE SET creator_name=EXCLUDED.creator_name,name=EXCLUDED.name,tagline=EXCLUDED.tagline,description=EXCLUDED.description,visibility=EXCLUDED.visibility,version=EXCLUDED.version,metadata=EXCLUDED.metadata,retired_at=NULL,updated_at=now()`,
    [`discover-${type}-${assetId}`,type,assetId,ownerUserId,creatorName,asset.name,type==='workflow'?'Reusable AgentPlace workflow':'Creator-imported capability',description,category,visibility==='published'?'public':'unlisted',asset.version,type==='workflow'?'No authority granted by workflow':'Imported capability grants no authority',JSON.stringify(metadata)]);
  void draft;
}

export async function forkWorker(ownerUserId:string,creatorName:string,sourceDefinitionId:string):Promise<CreatorAssetRecord>{
  const source=await getDatabasePool().query<any>(`SELECT d.*,v.id AS version_id,v.version,v.instructions,v.capability_requirements,c.* FROM worker_definition d JOIN LATERAL(SELECT * FROM worker_version WHERE worker_definition_id=d.id AND retired_at IS NULL ORDER BY released_at DESC LIMIT 1)v ON true JOIN job_contract c ON c.worker_version_id=v.id WHERE d.id=$1 AND d.publication_status IN ('published','unlisted')`,[sourceDefinitionId]);
  const row=source.rows[0]; if(!row)throw new Error('SOURCE_WORKER_NOT_FOUND'); const instructions=record(row.instructions);
  return createCreatorWorker(ownerUserId,creatorName,{name:`${row.name} Copy`,tagline:row.tagline,responsibility:row.responsibility,category:row.category,mission:row.mission,responsibilities:strings(row.responsibilities),antiJobs:strings(row.anti_jobs),expectedOutputs:strings(row.expected_outputs),successConditions:strings(row.success_conditions),method:strings(instructions.method),capabilityRequirements:strings(row.capability_requirements),networks:strings(instructions.networks),authorityDefault:'Research & recommend only · No wallet authority',collaborators:[],lineage:{sourceType:'worker',sourceId:row.id,sourceVersionId:row.version_id,sourceName:row.name,sourceCreator:row.creator_name}});
}

export async function createNewWorkerVersion(ownerUserId:string,definitionId:string,input:CreatorWorkerDraft):Promise<CreatorAssetRecord>{
  const draft=validateCreatorWorkerDraft(input); const current=await getDatabasePool().query<{version:string}>(`SELECT v.version FROM worker_definition d JOIN LATERAL(SELECT version FROM worker_version WHERE worker_definition_id=d.id AND retired_at IS NULL ORDER BY released_at DESC LIMIT 1)v ON true WHERE d.id=$1 AND d.creator_user_id=$2`,[definitionId,ownerUserId]);
  const worker=current.rows[0]; if(!worker)throw new Error('CREATOR_WORKER_NOT_FOUND'); const version=nextVersion(worker.version); const versionId=id('cwv');
  await withTransaction(async(client)=>{
    await client.query(`INSERT INTO worker_version(id,worker_definition_id,version,instructions,default_autonomy,capability_requirements) VALUES($1,$2,$3,$4,'research-recommend',$5::jsonb)`,[versionId,definitionId,version,JSON.stringify({method:draft.method,collaborators:draft.collaborators??[],networks:draft.networks}),JSON.stringify(draft.capabilityRequirements)]);
    await client.query(`INSERT INTO job_contract(worker_version_id,mission,responsibilities,anti_jobs,expected_outputs,success_conditions,default_approval_boundary,default_capability_requirements) VALUES($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8::jsonb)`,[versionId,draft.mission,JSON.stringify(draft.responsibilities),JSON.stringify(draft.antiJobs),JSON.stringify(draft.expectedOutputs),JSON.stringify(draft.successConditions),draft.authorityDefault,JSON.stringify(draft.capabilityRequirements)]);
    for(const capabilityId of draft.capabilityRequirements)await client.query(`INSERT INTO worker_capability_route(worker_version_id,canonical_capability_id,suitability) SELECT $1,id,'primary' FROM canonical_capability WHERE id=$2 AND effect='read' ON CONFLICT DO NOTHING`,[versionId,capabilityId]);
    await client.query(`UPDATE worker_definition SET name=$3,tagline=$4,responsibility=$5,category=$6,publication_status='draft',updated_at=now() WHERE id=$1 AND creator_user_id=$2`,[definitionId,ownerUserId,draft.name,draft.tagline,draft.responsibility,draft.category]);
  });
  const updated=(await listCreatorAssets(ownerUserId)).find((item)=>item.type==='worker'&&item.id===definitionId);
  if(!updated)throw new Error('CREATOR_WORKER_NOT_FOUND_AFTER_VERSION_CREATE');
  return {...updated,visibility:'draft'};
}


export interface CreatorBuilderMessageRecord {
  id: string;
  role: 'user' | 'builder';
  content: string;
}

export interface CreatorBuilderSessionRecord {
  workerId: string;
  step: string;
  teachMode: boolean;
  testJobId?: string;
  draft: CreatorWorkerDraft;
  messages: CreatorBuilderMessageRecord[];
  updatedAt: string;
}

export interface SaveCreatorBuilderSessionInput {
  step: string;
  teachMode: boolean;
  testJobId?: string;
  draft: CreatorWorkerDraft;
  messages: CreatorBuilderMessageRecord[];
}

const CREATOR_BUILDER_STEPS = new Set([
  'idle','initial-response','collaborators-added','teach-prompt','teach-response','testing','runtime-test-launched','editing','private-saved','public-saved'
]);

function validateBuilderStep(value: string): string {
  if (!CREATOR_BUILDER_STEPS.has(value)) throw new Error('INVALID_CREATOR_BUILDER_STEP');
  return value;
}

function validateBuilderMessages(messages: CreatorBuilderMessageRecord[]): CreatorBuilderMessageRecord[] {
  if (!Array.isArray(messages) || messages.length > 500) throw new Error('INVALID_CREATOR_BUILDER_MESSAGES');
  return messages.map((message) => {
    if (!message || (message.role !== 'user' && message.role !== 'builder')) throw new Error('INVALID_CREATOR_BUILDER_MESSAGE_ROLE');
    const content = typeof message.content === 'string' ? message.content.trim() : '';
    if (!content || content.length > 12000) throw new Error('INVALID_CREATOR_BUILDER_MESSAGE_CONTENT');
    const messageId = typeof message.id === 'string' && message.id.length > 0 && message.id.length <= 160 ? message.id : id('cbm');
    return { id: messageId, role: message.role, content };
  });
}

export async function getCreatorBuilderSession(ownerUserId: string, workerId: string): Promise<CreatorBuilderSessionRecord | null> {
  const session = await getDatabasePool().query<{id:string;step:string;teach_mode:boolean;test_job_id:string|null;draft_snapshot:unknown;updated_at:Date}>(`
    SELECT s.id,s.step,s.teach_mode,s.test_job_id,s.draft_snapshot,s.updated_at
    FROM creator_builder_session s
    JOIN worker_definition d ON d.id=s.worker_definition_id
    WHERE s.owner_user_id=$1 AND s.worker_definition_id=$2 AND d.creator_user_id=$1
    LIMIT 1`, [ownerUserId, workerId]);
  const row = session.rows[0];
  if (!row) return null;
  const draft = validateCreatorWorkerDraft(row.draft_snapshot as CreatorWorkerDraft);
  const messages = await getDatabasePool().query<{id:string;role:'user'|'builder';content:string}>(`
    SELECT id,role,content FROM creator_builder_message WHERE session_id=$1 ORDER BY ordinal ASC`, [row.id]);
  return {
    workerId,
    step: validateBuilderStep(row.step),
    teachMode: row.teach_mode,
    ...(row.test_job_id ? { testJobId: row.test_job_id } : {}),
    draft,
    messages: messages.rows,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function saveCreatorBuilderSession(ownerUserId: string, workerId: string, input: SaveCreatorBuilderSessionInput): Promise<CreatorBuilderSessionRecord> {
  const draft = validateCreatorWorkerDraft(input.draft);
  const step = validateBuilderStep(input.step);
  const messages = validateBuilderMessages(input.messages);
  const testJobId = input.testJobId && input.testJobId.length <= 160 ? input.testJobId : null;
  const sessionId = `cbs_${createHash('sha256').update(`${ownerUserId}:${workerId}`).digest('hex').slice(0,32)}`;
  await withTransaction(async (client) => {
    const owner = await client.query(`SELECT id FROM worker_definition WHERE id=$1 AND creator_user_id=$2`, [workerId, ownerUserId]);
    if (!owner.rowCount) throw new Error('CREATOR_WORKER_NOT_FOUND');
    const savedSession = await client.query<{id:string}>(`INSERT INTO creator_builder_session(id,owner_user_id,worker_definition_id,step,teach_mode,test_job_id,draft_snapshot)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
      ON CONFLICT(owner_user_id,worker_definition_id) DO UPDATE SET step=EXCLUDED.step,teach_mode=EXCLUDED.teach_mode,test_job_id=EXCLUDED.test_job_id,draft_snapshot=EXCLUDED.draft_snapshot,updated_at=now()
      RETURNING id`,
      [sessionId, ownerUserId, workerId, step, Boolean(input.teachMode), testJobId, JSON.stringify(draft)]);
    const actualSessionId = savedSession.rows[0]?.id;
    if (!actualSessionId) throw new Error('CREATOR_BUILDER_SESSION_SAVE_FAILED');
    const activeResult=await client.query<{active_revision_no:number|null}>(`SELECT active_revision_no FROM creator_builder_session WHERE id=$1 FOR UPDATE`,[actualSessionId]);
    let activeRevision=activeResult.rows[0]?.active_revision_no??null;
    if(activeRevision===null){
      const maxRevision=await client.query<{max:number|null}>(`SELECT MAX(revision_no)::int AS max FROM creator_builder_revision WHERE session_id=$1`,[actualSessionId]);
      const revisionNo=(maxRevision.rows[0]?.max??-1)+1;
      await client.query(`INSERT INTO creator_builder_revision(id,session_id,revision_no,parent_revision_no,draft_snapshot) VALUES($1,$2,$3,NULL,$4::jsonb)`,[id('cbr'),actualSessionId,revisionNo,JSON.stringify(draft)]);
      activeRevision=revisionNo;
      await client.query(`UPDATE creator_builder_session SET active_revision_no=$2 WHERE id=$1`,[actualSessionId,activeRevision]);
    }else{
      const activeDraft=await client.query<{draft_snapshot:unknown}>(`SELECT draft_snapshot FROM creator_builder_revision WHERE session_id=$1 AND revision_no=$2`,[actualSessionId,activeRevision]);
      const snapshot=activeDraft.rows[0]?.draft_snapshot;
      if(snapshot&&stableJson(snapshot)!==stableJson(draft)){
        const maxRevision=await client.query<{max:number|null}>(`SELECT MAX(revision_no)::int AS max FROM creator_builder_revision WHERE session_id=$1`,[actualSessionId]);
        const revisionNo=(maxRevision.rows[0]?.max??-1)+1;
        await client.query(`INSERT INTO creator_builder_revision(id,session_id,revision_no,parent_revision_no,draft_snapshot) VALUES($1,$2,$3,$4,$5::jsonb)`,[id('cbr'),actualSessionId,revisionNo,activeRevision,JSON.stringify(draft)]);
        activeRevision=revisionNo;
        await client.query(`UPDATE creator_builder_session SET active_revision_no=$2 WHERE id=$1`,[actualSessionId,activeRevision]);
      }
    }
    await client.query(`DELETE FROM creator_builder_message WHERE session_id=$1`, [actualSessionId]);
    for (let ordinal = 0; ordinal < messages.length; ordinal += 1) {
      const message = messages[ordinal]!;
      await client.query(`INSERT INTO creator_builder_message(id,session_id,ordinal,role,content) VALUES($1,$2,$3,$4,$5)`,
        [message.id, actualSessionId, ordinal, message.role, message.content]);
    }
  });
  const saved = await getCreatorBuilderSession(ownerUserId, workerId);
  if (!saved) throw new Error('CREATOR_BUILDER_SESSION_SAVE_FAILED');
  return saved;
}



export interface RecordCreatorBuilderTurnInput {
  sourceMessage: string;
  intent: CreatorBuilderIntent;
  provider?: string;
  model?: string;
  inputHash?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number;
  beforeDraft: CreatorWorkerDraft;
  afterDraft: CreatorWorkerDraft;
  appliedOperations: CreatorBuilderOperation[];
  rejectedOperations: Array<{operation: CreatorBuilderOperation; reason: string}>;
}

export interface CreatorBuilderTurnRecord {
  turnId: string;
  activeRevisionNo?: number;
}

function builderSessionId(ownerUserId: string, workerId: string): string {
  return `cbs_${createHash('sha256').update(`${ownerUserId}:${workerId}`).digest('hex').slice(0,32)}`;
}

export async function recordCreatorBuilderTurn(ownerUserId: string, workerId: string, input: RecordCreatorBuilderTurnInput): Promise<CreatorBuilderTurnRecord> {
  const beforeDraft=validateCreatorWorkerDraft(input.beforeDraft);
  const afterDraft=validateCreatorWorkerDraft(input.afterDraft);
  const sourceMessage=input.sourceMessage.trim();
  if(!sourceMessage||sourceMessage.length>4000)throw new Error('INVALID_CREATOR_BUILDER_SOURCE_MESSAGE');
  const sessionId=builderSessionId(ownerUserId,workerId);
  let result:CreatorBuilderTurnRecord={turnId:''};
  await withTransaction(async(client)=>{
    const owner=await client.query(`SELECT id FROM worker_definition WHERE id=$1 AND creator_user_id=$2`,[workerId,ownerUserId]);
    if(!owner.rowCount)throw new Error('CREATOR_WORKER_NOT_FOUND');
    await client.query(`INSERT INTO creator_builder_session(id,owner_user_id,worker_definition_id,step,teach_mode,draft_snapshot)
      VALUES($1,$2,$3,'editing',false,$4::jsonb) ON CONFLICT(owner_user_id,worker_definition_id) DO NOTHING`,
      [sessionId,ownerUserId,workerId,JSON.stringify(beforeDraft)]);
    const session=await client.query<{id:string;active_revision_no:number|null}>(`SELECT id,active_revision_no FROM creator_builder_session WHERE owner_user_id=$1 AND worker_definition_id=$2 FOR UPDATE`,[ownerUserId,workerId]);
    const row=session.rows[0];
    if(!row)throw new Error('CREATOR_BUILDER_SESSION_NOT_FOUND');
    let activeRevision=row.active_revision_no;
    if(activeRevision===null){
      const maxRevision=await client.query<{max:number|null}>(`SELECT MAX(revision_no)::int AS max FROM creator_builder_revision WHERE session_id=$1`,[row.id]);
      const initialRevision=(maxRevision.rows[0]?.max??-1)+1;
      await client.query(`INSERT INTO creator_builder_revision(id,session_id,revision_no,parent_revision_no,draft_snapshot) VALUES($1,$2,$3,NULL,$4::jsonb)`,
        [id('cbr'),row.id,initialRevision,JSON.stringify(beforeDraft)]);
      activeRevision=initialRevision;
      await client.query(`UPDATE creator_builder_session SET active_revision_no=$2 WHERE id=$1`,[row.id,activeRevision]);
    }else{
      const activeDraft=await client.query<{draft_snapshot:unknown}>(`SELECT draft_snapshot FROM creator_builder_revision WHERE session_id=$1 AND revision_no=$2`,[row.id,activeRevision]);
      if(activeDraft.rows[0]?.draft_snapshot&&stableJson(activeDraft.rows[0].draft_snapshot)!==stableJson(beforeDraft)){
        const maxRevision=await client.query<{max:number|null}>(`SELECT MAX(revision_no)::int AS max FROM creator_builder_revision WHERE session_id=$1`,[row.id]);
        const beforeRevision=(maxRevision.rows[0]?.max??-1)+1;
        await client.query(`INSERT INTO creator_builder_revision(id,session_id,revision_no,parent_revision_no,draft_snapshot) VALUES($1,$2,$3,$4,$5::jsonb)`,
          [id('cbr'),row.id,beforeRevision,activeRevision,JSON.stringify(beforeDraft)]);
        activeRevision=beforeRevision;
        await client.query(`UPDATE creator_builder_session SET active_revision_no=$2 WHERE id=$1`,[row.id,activeRevision]);
      }
    }
    const turnOrdinalResult=await client.query<{next:number}>(`SELECT COALESCE(MAX(ordinal),-1)::int+1 AS next FROM creator_builder_turn WHERE session_id=$1`,[row.id]);
    const turnOrdinal=turnOrdinalResult.rows[0]?.next??0;
    const turnId=id('cbt');
    await client.query(`INSERT INTO creator_builder_turn(id,session_id,ordinal,source_message,intent,provider,model,input_hash,input_tokens,output_tokens,estimated_cost_usd,applied_operations,rejected_operations)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb)`,[
      turnId,row.id,turnOrdinal,sourceMessage,input.intent,input.provider??null,input.model??null,input.inputHash??null,input.inputTokens??null,input.outputTokens??null,input.estimatedCostUsd,JSON.stringify(input.appliedOperations),JSON.stringify(input.rejectedOperations),
    ]);
    const changed=stableJson(beforeDraft)!==stableJson(afterDraft);
    if(changed){
      const maxRevision=await client.query<{max:number|null}>(`SELECT MAX(revision_no)::int AS max FROM creator_builder_revision WHERE session_id=$1`,[row.id]);
      const revisionNo=(maxRevision.rows[0]?.max??-1)+1;
      await client.query(`INSERT INTO creator_builder_revision(id,session_id,revision_no,parent_revision_no,draft_snapshot,source_turn_id) VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
        [id('cbr'),row.id,revisionNo,activeRevision,JSON.stringify(afterDraft),turnId]);
      activeRevision=revisionNo;
    }
    await client.query(`UPDATE creator_builder_session SET draft_snapshot=$2::jsonb,active_revision_no=$3,updated_at=now() WHERE id=$1`,
      [row.id,JSON.stringify(afterDraft),activeRevision]);
    result={turnId,...(activeRevision===null?{}:{activeRevisionNo:activeRevision})};
  });
  return result;
}

export async function undoCreatorBuilderDraft(ownerUserId: string, workerId: string, sourceMessage: string): Promise<{draft: CreatorWorkerDraft; turnId: string; activeRevisionNo: number}> {
  let output:{draft:CreatorWorkerDraft;turnId:string;activeRevisionNo:number}|undefined;
  await withTransaction(async(client)=>{
    const session=await client.query<{id:string;active_revision_no:number|null;draft_snapshot:unknown}>(`SELECT s.id,s.active_revision_no,s.draft_snapshot FROM creator_builder_session s JOIN worker_definition d ON d.id=s.worker_definition_id WHERE s.owner_user_id=$1 AND s.worker_definition_id=$2 AND d.creator_user_id=$1 FOR UPDATE`,[ownerUserId,workerId]);
    const row=session.rows[0];
    if(!row)throw new Error('CREATOR_BUILDER_SESSION_NOT_FOUND');
    if(row.active_revision_no===null)throw new Error('CREATOR_BUILDER_NOTHING_TO_UNDO');
    const current=await client.query<{parent_revision_no:number|null}>(`SELECT parent_revision_no FROM creator_builder_revision WHERE session_id=$1 AND revision_no=$2`,[row.id,row.active_revision_no]);
    const parentRevision=current.rows[0]?.parent_revision_no;
    if(parentRevision===null||parentRevision===undefined)throw new Error('CREATOR_BUILDER_NOTHING_TO_UNDO');
    const parent=await client.query<{draft_snapshot:unknown}>(`SELECT draft_snapshot FROM creator_builder_revision WHERE session_id=$1 AND revision_no=$2`,[row.id,parentRevision]);
    const draft=validateCreatorWorkerDraft(parent.rows[0]?.draft_snapshot as CreatorWorkerDraft);
    const turnOrdinalResult=await client.query<{next:number}>(`SELECT COALESCE(MAX(ordinal),-1)::int+1 AS next FROM creator_builder_turn WHERE session_id=$1`,[row.id]);
    const turnId=id('cbt');
    await client.query(`INSERT INTO creator_builder_turn(id,session_id,ordinal,source_message,intent,estimated_cost_usd,applied_operations,rejected_operations) VALUES($1,$2,$3,$4,'UNDO',0,'[]'::jsonb,'[]'::jsonb)`,
      [turnId,row.id,turnOrdinalResult.rows[0]?.next??0,sourceMessage.trim().slice(0,4000)]);
    await client.query(`UPDATE creator_builder_session SET draft_snapshot=$2::jsonb,active_revision_no=$3,updated_at=now() WHERE id=$1`,[row.id,JSON.stringify(draft),parentRevision]);
    output={draft,turnId,activeRevisionNo:parentRevision};
  });
  if(!output)throw new Error('CREATOR_BUILDER_UNDO_FAILED');
  return output;
}

export const moduleManifest={name:'marketplace',layer:'controlled-runtime',milestone:12,status:'production-discover-creator-supply'} as const;
