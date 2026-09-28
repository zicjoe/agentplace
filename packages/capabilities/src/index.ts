import { getDatabasePool } from '@agent-place/db';

export type CapabilityEffect = 'read' | 'write' | 'economic-write';
export type CapabilityLifecycleStatus = 'planned' | 'schema-validated' | 'tested' | 'limited-production' | 'production-observed' | 'agentplace-verified';

export interface CanonicalCapability {
  id: string;
  name: string;
  purpose: string;
  effect: CapabilityEffect;
  authorityRequirement: string;
  valueAtRiskClass: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  lifecycleStatus: CapabilityLifecycleStatus;
}

export interface CapabilityImplementation {
  id: string;
  canonicalCapabilityId: string;
  provider: string;
  name: string;
  version: string;
  trustStatus: string;
  healthStatus: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
  invocationKind: string;
}

type CapabilityRow = {
  id:string; name:string; purpose:string; effect:CapabilityEffect; authority_requirement:string; value_at_risk_class:string;
  input_schema:Record<string,unknown>; output_schema:Record<string,unknown>; lifecycle_status:CapabilityLifecycleStatus;
};
type ImplementationRow = {
  id:string; canonical_capability_id:string; provider:string; name:string; version:string; trust_status:string;
  health_status:'healthy'|'degraded'|'unavailable'|'unknown'; invocation_kind:string;
};

export async function listCanonicalCapabilities(): Promise<CanonicalCapability[]> {
  const result = await getDatabasePool().query<CapabilityRow>(
    `SELECT id,name,purpose,effect,authority_requirement,value_at_risk_class,input_schema,output_schema,lifecycle_status
     FROM canonical_capability ORDER BY id`,
  );
  return result.rows.map((row)=>({
    id:row.id,name:row.name,purpose:row.purpose,effect:row.effect,authorityRequirement:row.authority_requirement,
    valueAtRiskClass:row.value_at_risk_class,inputSchema:row.input_schema,outputSchema:row.output_schema,lifecycleStatus:row.lifecycle_status,
  }));
}

export async function listCapabilityImplementations(): Promise<CapabilityImplementation[]> {
  const result = await getDatabasePool().query<ImplementationRow>(
    `SELECT id,canonical_capability_id,provider,name,version,trust_status,health_status,invocation_kind
     FROM capability_implementation ORDER BY canonical_capability_id,provider,id`,
  );
  return result.rows.map((row)=>({
    id:row.id,canonicalCapabilityId:row.canonical_capability_id,provider:row.provider,name:row.name,version:row.version,
    trustStatus:row.trust_status,healthStatus:row.health_status,invocationKind:row.invocation_kind,
  }));
}

export function configuredResearchProviders(): Array<'openai'|'gemini'|'anthropic'> {
  const providers:Array<'openai'|'gemini'|'anthropic'>=[];
  if (process.env.OPENAI_API_KEY?.trim()) providers.push('openai');
  if (process.env.GEMINI_API_KEY?.trim()) providers.push('gemini');
  if (process.env.ANTHROPIC_API_KEY?.trim()) providers.push('anthropic');
  return providers;
}

export const moduleManifest = { name:'capabilities', layer:'controlled-runtime', milestone:4, status:'active' } as const;
