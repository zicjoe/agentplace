export type CreatorAssetType = 'worker' | 'workflow' | 'capability';
export type CreatorPublicationStatus = 'draft' | 'tested' | 'private' | 'unlisted' | 'published' | 'retired';
export type ImportedCapabilityClassification = 'read' | 'prepare' | 'execution-sensitive';

export interface CreatorWorkerDraft {
  name: string;
  tagline: string;
  responsibility: string;
  category: string;
  mission: string;
  responsibilities: string[];
  antiJobs: string[];
  expectedOutputs: string[];
  successConditions: string[];
  method: string[];
  capabilityRequirements: string[];
  networks: string[];
  authorityDefault: string;
  collaborators?: Array<{
    role: string;
    pinnedWorkerId?: string;
    roleBased?: boolean;
    required: boolean;
    whenUsed: string;
    contextShared: string;
    authorityBoundary: string;
  }>;
  lineage?: { sourceType: CreatorAssetType; sourceId: string; sourceVersionId?: string; sourceName: string; sourceCreator: string };
}

export interface CreatorWorkflowDraft {
  name: string;
  purpose: string;
  inputs: string[];
  steps: string[];
  conditions: string[];
  outputs: string[];
  requiredCapabilities: string[];
  safetyBoundaries: string[];
  compatibleWorkers: string[];
}

export interface ImportedOperationDraft {
  original: string;
  canonical?: string;
  classification: ImportedCapabilityClassification;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  sandboxEligible?: boolean;
}

export interface CapabilityImportDraft {
  name: string;
  importType: 'mcp' | 'openapi';
  endpoint?: string;
  provider?: string;
  version?: string;
  operations: ImportedOperationDraft[];
  sourceMetadata?: Record<string, unknown>;
}

function nonEmpty(value: string, field: string, max = 4000): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(`INVALID_${field.toUpperCase()}`);
  return trimmed;
}

function compactStrings(values: string[], limit = 64): string[] {
  if (!Array.isArray(values) || values.length > limit) throw new Error('INVALID_CREATOR_LIST');
  return values.map((value) => nonEmpty(value, 'creator_list', 1000));
}

export function validateCreatorWorkerDraft(input: CreatorWorkerDraft): CreatorWorkerDraft {
  const authority = nonEmpty(input.authorityDefault, 'authority_default', 500);
  if (!/research|recommend|observe|no wallet authority|no financial authority/i.test(authority)) {
    throw new Error('CREATOR_WORKER_FINANCIAL_AUTHORITY_NOT_ALLOWED');
  }
  return {
    ...input,
    name: nonEmpty(input.name, 'worker_name', 120),
    tagline: nonEmpty(input.tagline, 'worker_tagline', 240),
    responsibility: nonEmpty(input.responsibility, 'worker_responsibility', 1000),
    category: nonEmpty(input.category, 'worker_category', 120),
    mission: nonEmpty(input.mission, 'worker_mission', 2000),
    responsibilities: compactStrings(input.responsibilities),
    antiJobs: compactStrings(input.antiJobs),
    expectedOutputs: compactStrings(input.expectedOutputs),
    successConditions: compactStrings(input.successConditions),
    method: compactStrings(input.method),
    capabilityRequirements: compactStrings(input.capabilityRequirements),
    networks: compactStrings(input.networks, 32),
    authorityDefault: authority,
  };
}

export function validateWorkflowDraft(input: CreatorWorkflowDraft): CreatorWorkflowDraft {
  return {
    ...input,
    name: nonEmpty(input.name, 'workflow_name', 120),
    purpose: nonEmpty(input.purpose, 'workflow_purpose', 2000),
    inputs: compactStrings(input.inputs),
    steps: compactStrings(input.steps),
    conditions: compactStrings(input.conditions),
    outputs: compactStrings(input.outputs),
    requiredCapabilities: compactStrings(input.requiredCapabilities),
    safetyBoundaries: compactStrings(input.safetyBoundaries),
    compatibleWorkers: compactStrings(input.compatibleWorkers),
  };
}

export type CreatorWorkflowBuilderIntent = 'DISCUSS' | 'MODIFY_DRAFT';

export interface CreatorWorkflowBuilderTurnProposal {
  intent: CreatorWorkflowBuilderIntent;
  reply: string;
  draft: CreatorWorkflowDraft;
}

export interface CreatorWorkflowBuilderAllowedWorker {
  id: string;
  name: string;
}

const REQUIRED_WORKFLOW_SAFETY_BOUNDARIES = [
  'No financial authority is created by a Workflow',
  'Any financial Action still passes risk, authority and approval',
] as const;

export function applyCreatorWorkflowBuilderProposal(args: {
  currentDraft: CreatorWorkflowDraft;
  proposal: CreatorWorkflowBuilderTurnProposal;
  allowedReadCapabilities: string[];
  allowedWorkers: CreatorWorkflowBuilderAllowedWorker[];
}): CreatorWorkflowDraft {
  if (args.proposal.intent === 'DISCUSS') return args.currentDraft;

  const allowedCapabilities = new Set(args.allowedReadCapabilities);
  const allowedWorkers = new Map<string,string>();
  for (const worker of args.allowedWorkers) {
    allowedWorkers.set(worker.id.toLowerCase(), worker.name);
    allowedWorkers.set(worker.name.toLowerCase(), worker.name);
  }

  const proposed = args.proposal.draft;
  const requiredCapabilities = creatorUniqueStrings(proposed.requiredCapabilities ?? [])
    .filter((capability) => allowedCapabilities.has(capability));
  const compatibleWorkers = creatorUniqueStrings(proposed.compatibleWorkers ?? [])
    .flatMap((worker) => {
      const matched = allowedWorkers.get(worker.trim().toLowerCase());
      return matched ? [matched] : [];
    });
  const safetyBoundaries = creatorUniqueStrings([
    ...(proposed.safetyBoundaries ?? []),
    ...REQUIRED_WORKFLOW_SAFETY_BOUNDARIES,
  ]);

  return validateWorkflowDraft({
    ...proposed,
    requiredCapabilities,
    compatibleWorkers,
    safetyBoundaries,
  });
}

export function validateCapabilityImport(input: CapabilityImportDraft): CapabilityImportDraft {
  if (input.importType !== 'mcp' && input.importType !== 'openapi') throw new Error('INVALID_IMPORT_TYPE');
  if (!Array.isArray(input.operations) || input.operations.length > 128) throw new Error('INVALID_IMPORTED_OPERATIONS');
  for (const operation of input.operations) {
    nonEmpty(operation.original, 'operation', 500);
    nonEmpty(operation.description, 'operation_description', 2000);
    if (!['read', 'prepare', 'execution-sensitive'].includes(operation.classification)) throw new Error('INVALID_OPERATION_CLASSIFICATION');
  }
  return { ...input, name: nonEmpty(input.name, 'capability_name', 120) };
}

export function runtimeEligibilityForImportedOperation(classification: ImportedCapabilityClassification, endpoint?: string): 'sandbox-read' | 'metadata-only' | 'blocked' {
  if (classification !== 'read') return 'blocked';
  if (!endpoint) return 'metadata-only';
  return 'sandbox-read';
}

export function assertSafeRemoteHttpsUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('IMPORT_URL_HTTPS_REQUIRED');
  if (url.username || url.password) throw new Error('IMPORT_URL_CREDENTIALS_FORBIDDEN');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local')) throw new Error('IMPORT_URL_PRIVATE_HOST_FORBIDDEN');
  if (/^127\./.test(host) || /^10\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host)) throw new Error('IMPORT_URL_PRIVATE_HOST_FORBIDDEN');
  const m = host.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) throw new Error('IMPORT_URL_PRIVATE_HOST_FORBIDDEN');
  return url;
}


export type CreatorBuilderIntent = 'DISCUSS' | 'MODIFY_DRAFT' | 'TEACH' | 'TEST' | 'SAVE_PRIVATE' | 'PUBLISH' | 'UNDO' | 'USE_EXISTING_EXPERTISE';

export type CreatorBuilderOperationType =
  | 'SET_NAME'
  | 'SET_MISSION'
  | 'SET_RESPONSIBILITIES'
  | 'ADD_RESPONSIBILITY'
  | 'REMOVE_RESPONSIBILITY'
  | 'SET_ANTI_JOBS'
  | 'ADD_ANTI_JOB'
  | 'REMOVE_ANTI_JOB'
  | 'SET_METHOD_RULES'
  | 'ADD_METHOD_RULE'
  | 'REMOVE_METHOD_RULE'
  | 'SET_CAPABILITY_REQUIREMENTS'
  | 'ADD_CAPABILITY_REQUIREMENT'
  | 'REMOVE_CAPABILITY_REQUIREMENT'
  | 'SET_NETWORKS'
  | 'ADD_NETWORK'
  | 'REMOVE_NETWORK'
  | 'ADD_COLLABORATOR'
  | 'REMOVE_COLLABORATOR';

export interface CreatorBuilderOperation {
  type: CreatorBuilderOperationType;
  value: string;
  values: string[];
  target: string;
  workerId: string;
  workerName: string;
  roleBased: boolean;
  required: boolean;
}

export interface CreatorBuilderTurnProposal {
  intent: CreatorBuilderIntent;
  reply: string;
  operations: CreatorBuilderOperation[];
  testScenario: string;
  testExpected: string;
}

export interface CreatorBuilderAllowedWorker {
  id: string;
  name: string;
  tagline: string;
}

export interface CreatorBuilderApplyResult {
  draft: CreatorWorkerDraft;
  appliedOperations: CreatorBuilderOperation[];
  rejectedOperations: Array<{operation: CreatorBuilderOperation; reason: string}>;
}

function creatorUniqueStrings(values: string[], max = 64): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value.slice(0,1000));
    if (out.length >= max) break;
  }
  return out;
}

function removeCreatorString(values: string[], target: string): string[] {
  const normalized = target.trim().toLowerCase();
  if (!normalized) return values;
  const exact = values.findIndex((value) => value.trim().toLowerCase() === normalized);
  if (exact >= 0) return values.filter((_, index) => index !== exact);
  const contained = values.findIndex((value) => value.toLowerCase().includes(normalized) || normalized.includes(value.toLowerCase()));
  return contained >= 0 ? values.filter((_, index) => index !== contained) : values;
}

export function applyCreatorBuilderOperations(args: {
  draft: CreatorWorkerDraft;
  operations: CreatorBuilderOperation[];
  allowedReadCapabilities: string[];
  allowedWorkers: CreatorBuilderAllowedWorker[];
}): CreatorBuilderApplyResult {
  let draft: CreatorWorkerDraft = validateCreatorWorkerDraft(args.draft);
  const allowedCapabilities = new Set(args.allowedReadCapabilities);
  const allowedWorkers = new Map(args.allowedWorkers.map((worker) => [worker.id, worker]));
  const appliedOperations: CreatorBuilderOperation[] = [];
  const rejectedOperations: Array<{operation: CreatorBuilderOperation; reason: string}> = [];

  const reject = (operation: CreatorBuilderOperation, reason: string) => rejectedOperations.push({operation,reason});
  const apply = (operation: CreatorBuilderOperation) => appliedOperations.push(operation);

  for (const operation of args.operations.slice(0,32)) {
    const value = operation.value.trim();
    const target = operation.target.trim();
    const values = creatorUniqueStrings(operation.values ?? [],64);
    switch (operation.type) {
      case 'SET_NAME': {
        if (!value) { reject(operation,'Worker name cannot be empty.'); break; }
        draft = {...draft,name:value.slice(0,120)}; apply(operation); break;
      }
      case 'SET_MISSION': {
        if (!value) { reject(operation,'Job Contract cannot be empty.'); break; }
        const mission=value.slice(0,2000);
        draft = {...draft,mission,responsibility:mission,tagline:mission.slice(0,240)}; apply(operation); break;
      }
      case 'SET_RESPONSIBILITIES': draft={...draft,responsibilities:creatorUniqueStrings(values)}; apply(operation); break;
      case 'ADD_RESPONSIBILITY': if(value){draft={...draft,responsibilities:creatorUniqueStrings([...draft.responsibilities,value])};apply(operation);}else reject(operation,'Responsibility cannot be empty.'); break;
      case 'REMOVE_RESPONSIBILITY': draft={...draft,responsibilities:removeCreatorString(draft.responsibilities,target||value)}; apply(operation); break;
      case 'SET_ANTI_JOBS': draft={...draft,antiJobs:creatorUniqueStrings(values)}; apply(operation); break;
      case 'ADD_ANTI_JOB': if(value){draft={...draft,antiJobs:creatorUniqueStrings([...draft.antiJobs,value])};apply(operation);}else reject(operation,'Anti-job cannot be empty.'); break;
      case 'REMOVE_ANTI_JOB': draft={...draft,antiJobs:removeCreatorString(draft.antiJobs,target||value)}; apply(operation); break;
      case 'SET_METHOD_RULES': draft={...draft,method:creatorUniqueStrings(values)}; apply(operation); break;
      case 'ADD_METHOD_RULE': if(value){draft={...draft,method:creatorUniqueStrings([...draft.method,value])};apply(operation);}else reject(operation,'Method rule cannot be empty.'); break;
      case 'REMOVE_METHOD_RULE': draft={...draft,method:removeCreatorString(draft.method,target||value)}; apply(operation); break;
      case 'SET_CAPABILITY_REQUIREMENTS': {
        const accepted=values.filter((capability)=>allowedCapabilities.has(capability));
        const rejected=values.filter((capability)=>!allowedCapabilities.has(capability));
        if(rejected.length){reject(operation,`Only registered read capabilities can be added in M12: ${rejected.join(', ')}`);}
        draft={...draft,capabilityRequirements:creatorUniqueStrings(accepted)};
        if(accepted.length||values.length===0)apply(operation);
        break;
      }
      case 'ADD_CAPABILITY_REQUIREMENT': {
        if(!allowedCapabilities.has(value)){reject(operation,'Capability is not a registered read-only AgentPlace capability.');break;}
        draft={...draft,capabilityRequirements:creatorUniqueStrings([...draft.capabilityRequirements,value])}; apply(operation); break;
      }
      case 'REMOVE_CAPABILITY_REQUIREMENT': draft={...draft,capabilityRequirements:removeCreatorString(draft.capabilityRequirements,target||value)}; apply(operation); break;
      case 'SET_NETWORKS': draft={...draft,networks:creatorUniqueStrings(values,32)}; apply(operation); break;
      case 'ADD_NETWORK': if(value){draft={...draft,networks:creatorUniqueStrings([...draft.networks,value],32)};apply(operation);}else reject(operation,'Network cannot be empty.'); break;
      case 'REMOVE_NETWORK': draft={...draft,networks:removeCreatorString(draft.networks,target||value)}; apply(operation); break;
      case 'ADD_COLLABORATOR': {
        const worker=allowedWorkers.get(operation.workerId);
        if(!worker){reject(operation,'Collaborator must resolve to an eligible AgentPlace Worker.');break;}
        const collaborators=[...(draft.collaborators??[])];
        if(!collaborators.some((item)=>item.pinnedWorkerId===worker.id)){
          collaborators.push({
            role:value||worker.tagline||worker.name,
            pinnedWorkerId:worker.id,
            roleBased:Boolean(operation.roleBased),
            required:Boolean(operation.required),
            whenUsed:'When specialist evidence materially improves the Job',
            contextShared:'Only task-relevant context',
            authorityBoundary:'Research only — collaborator authority never propagates',
          });
        }
        draft={...draft,collaborators}; apply(operation); break;
      }
      case 'REMOVE_COLLABORATOR': {
        const key=(operation.workerId||target||value).trim().toLowerCase();
        draft={...draft,collaborators:(draft.collaborators??[]).filter((item)=>{
          const id=(item.pinnedWorkerId??'').toLowerCase();
          const role=item.role.toLowerCase();
          return id!==key && role!==key && !role.includes(key);
        })};
        apply(operation); break;
      }
      default: reject(operation,'Unsupported Builder operation.');
    }
  }

  // The creator conversation can shape responsibility and methodology, but it can never widen authority.
  draft={...draft,authorityDefault:'Research & recommend only · No wallet authority'};
  return {draft:validateCreatorWorkerDraft(draft),appliedOperations,rejectedOperations};
}

export const moduleManifest = {
  name: 'creator-sdk',
  layer: 'untrusted-boundary',
  milestone: 12,
  status: 'production-creator-contracts',
} as const;

export function resolveOpenApiRuntimeEndpoint(source: string, sourceUrl?: string): string | undefined {
  const trimmed=source.trim();
  if(!trimmed) throw new Error('OPENAPI_EMPTY_DOCUMENT');
  let value: unknown;
  try { value=JSON.parse(trimmed) as unknown; } catch { value=undefined; }

  if(value&&typeof value==='object'&&!Array.isArray(value)){
    const root=value as Record<string,unknown>;
    const servers=Array.isArray(root.servers)?root.servers:[];
    for(const server of servers){
      if(!server||typeof server!=='object'||Array.isArray(server))continue;
      const raw=(server as Record<string,unknown>).url;
      if(typeof raw!=='string'||!raw.trim()||raw.includes('{'))continue;
      try {
        const resolved=sourceUrl?new URL(raw,sourceUrl):new URL(raw);
        return assertSafeRemoteHttpsUrl(resolved.toString()).toString().replace(/\/$/,'');
      } catch { /* Try another declared server. */ }
    }

    const host=typeof root.host==='string'?root.host.trim():'';
    if(host){
      const schemes=Array.isArray(root.schemes)?root.schemes.filter((item):item is string=>typeof item==='string'):[];
      const scheme=schemes.map((item)=>item.toLowerCase()).includes('https')?'https':schemes[0]?.toLowerCase();
      if(scheme==='https'){
        const basePath=typeof root.basePath==='string'?root.basePath.trim():'';
        return assertSafeRemoteHttpsUrl(`https://${host}${basePath.startsWith('/')?basePath:basePath?`/${basePath}`:''}`).toString().replace(/\/$/,'');
      }
    }
  }

  if(sourceUrl){
    const source=assertSafeRemoteHttpsUrl(sourceUrl);
    return source.origin;
  }
  return undefined;
}

export function joinOpenApiRuntimeUrl(runtimeEndpoint: string, operationPath: string): URL {
  const base=assertSafeRemoteHttpsUrl(runtimeEndpoint);
  if(!operationPath.startsWith('/')||operationPath.includes('{')) throw new Error('INVALID_IMPORT_OPERATION');
  const basePath=base.pathname==='/'?'':base.pathname.replace(/\/$/,'');
  const target=new URL(base.toString());
  target.pathname=`${basePath}${operationPath}`.replace(/\/{2,}/g,'/');
  target.search='';
  target.hash='';
  if(target.origin!==base.origin) throw new Error('IMPORT_SANDBOX_ORIGIN_MISMATCH');
  return target;
}

export function parseOpenApiOperations(source: string): ImportedOperationDraft[] {
  const trimmed=source.trim();
  if(!trimmed) throw new Error('OPENAPI_EMPTY_DOCUMENT');
  let value: unknown;
  try { value=JSON.parse(trimmed) as unknown; } catch { value=undefined; }
  const operations:ImportedOperationDraft[]=[];
  const methods=new Set(['get','post','put','patch','delete','head','options']);
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    const root=value as Record<string,unknown>; const paths=root.paths;
    if(!paths||typeof paths!=='object'||Array.isArray(paths)) throw new Error('OPENAPI_PATHS_REQUIRED');
    for(const [pathName,pathValue] of Object.entries(paths as Record<string,unknown>)){
      if(!pathValue||typeof pathValue!=='object'||Array.isArray(pathValue))continue;
      for(const [method,opValue] of Object.entries(pathValue as Record<string,unknown>)){
        if(!methods.has(method.toLowerCase()))continue;
        const op=opValue&&typeof opValue==='object'&&!Array.isArray(opValue)?opValue as Record<string,unknown>:{};
        const description=typeof op.summary==='string'?op.summary:typeof op.description==='string'?op.description:`${method.toUpperCase()} ${pathName}`;
        const lowerMethod=method.toLowerCase();
        const classification:ImportedCapabilityClassification=lowerMethod==='get'||lowerMethod==='head'?'read':'execution-sensitive';
        const pathParameters=Array.isArray((pathValue as Record<string,unknown>).parameters)?(pathValue as Record<string,unknown>).parameters as unknown[]:[];
        const operationParameters=Array.isArray(op.parameters)?op.parameters as unknown[]:[];
        const requiredParameters=[...pathParameters,...operationParameters].flatMap((parameter)=>{
          if(!parameter||typeof parameter!=='object'||Array.isArray(parameter))return[];
          const row=parameter as Record<string,unknown>;
          const required=row.required===true||row.in==='path';
          if(!required)return[];
          const name=typeof row.name==='string'?row.name:'required parameter';
          return [name];
        });
        const requestBodyRequired=Boolean(op.requestBody&&typeof op.requestBody==='object'&&!Array.isArray(op.requestBody)&&(op.requestBody as Record<string,unknown>).required===true);
        const sandboxEligible=lowerMethod==='get'&&!pathName.includes('{')&&requiredParameters.length===0&&!requestBodyRequired;
        operations.push({original:`${method.toUpperCase()} ${pathName}`,classification,description,sandboxEligible,...(requiredParameters.length?{inputSchema:{requiredParameters}}:{})});
      }
    }
  } else {
    // Constrained YAML support: extract operations from the standard `paths:` tree.
    const lines=source.split(/\r?\n/); let inPaths=false; let currentPath=''; let pathIndent=-1;
    for(const raw of lines){const line=raw.replace(/\t/g,'  ');const trimmedLine=line.trim();if(!trimmedLine||trimmedLine.startsWith('#'))continue;const indent=line.length-line.trimStart().length;
      if(trimmedLine==='paths:'){inPaths=true;pathIndent=indent;continue;} if(inPaths&&indent<=pathIndent&&/^[A-Za-z0-9_-]+:/.test(trimmedLine)){break;} if(!inPaths)continue;
      if(/^\/[^:]+:\s*$/.test(trimmedLine)){currentPath=trimmedLine.slice(0,-1);continue;}
      const methodMatch=trimmedLine.match(/^(get|post|put|patch|delete|head|options):\s*$/i); if(methodMatch&&currentPath){const method=methodMatch[1]!.toUpperCase();const classification:ImportedCapabilityClassification=method==='GET'||method==='HEAD'?'read':'execution-sensitive';operations.push({original:`${method} ${currentPath}`,classification,description:`${method} ${currentPath}`,sandboxEligible:false});}
    }
  }
  if(operations.length===0) throw new Error('OPENAPI_NO_OPERATIONS');
  return operations.slice(0,128);
}
