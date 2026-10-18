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

export const moduleManifest = {
  name: 'creator-sdk',
  layer: 'untrusted-boundary',
  milestone: 12,
  status: 'production-creator-contracts',
} as const;

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
        const classification:ImportedCapabilityClassification=method.toLowerCase()==='get'||method.toLowerCase()==='head'?'read':'execution-sensitive';
        operations.push({original:`${method.toUpperCase()} ${pathName}`,classification,description});
      }
    }
  } else {
    // Constrained YAML support: extract operations from the standard `paths:` tree.
    const lines=source.split(/\r?\n/); let inPaths=false; let currentPath=''; let pathIndent=-1;
    for(const raw of lines){const line=raw.replace(/\t/g,'  ');const trimmedLine=line.trim();if(!trimmedLine||trimmedLine.startsWith('#'))continue;const indent=line.length-line.trimStart().length;
      if(trimmedLine==='paths:'){inPaths=true;pathIndent=indent;continue;} if(inPaths&&indent<=pathIndent&&/^[A-Za-z0-9_-]+:/.test(trimmedLine)){break;} if(!inPaths)continue;
      if(/^\/[^:]+:\s*$/.test(trimmedLine)){currentPath=trimmedLine.slice(0,-1);continue;}
      const methodMatch=trimmedLine.match(/^(get|post|put|patch|delete|head|options):\s*$/i); if(methodMatch&&currentPath){const method=methodMatch[1]!.toUpperCase();const classification:ImportedCapabilityClassification=method==='GET'||method==='HEAD'?'read':'execution-sensitive';operations.push({original:`${method} ${currentPath}`,classification,description:`${method} ${currentPath}`});}
    }
  }
  if(operations.length===0) throw new Error('OPENAPI_NO_OPERATIONS');
  return operations.slice(0,128);
}
