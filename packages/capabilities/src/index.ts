import { getDatabasePool } from '@agent-place/db';

export type CapabilityEffect = 'read' | 'write' | 'economic-write';
export type CapabilityLifecycleStatus = 'planned' | 'schema-validated' | 'tested' | 'limited-production' | 'production-observed' | 'agentplace-verified';
export type CapabilityHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown';

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
  supportedNetworks: string[];
  pricing: Record<string, unknown>;
  trustStatus: string;
  healthStatus: CapabilityHealthStatus;
  invocationKind: string;
  knownFailureStates: string[];
  priority: number;
  enabled: boolean;
  environmentEligibility: string[];
}

type CapabilityRow = {
  id:string; name:string; purpose:string; effect:CapabilityEffect; authority_requirement:string; value_at_risk_class:string;
  input_schema:Record<string,unknown>; output_schema:Record<string,unknown>; lifecycle_status:CapabilityLifecycleStatus;
};
type ImplementationRow = {
  id:string; canonical_capability_id:string; provider:string; name:string; version:string; supported_networks:unknown; pricing:Record<string,unknown>;
  trust_status:string; health_status:CapabilityHealthStatus; invocation_kind:string; known_failure_states:unknown; priority:number; enabled:boolean; environment_eligibility:unknown;
};

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

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
    `SELECT id,canonical_capability_id,provider,name,version,supported_networks,pricing,trust_status,health_status,invocation_kind,
            known_failure_states,priority,enabled,environment_eligibility
     FROM capability_implementation ORDER BY canonical_capability_id,priority,provider,id`,
  );
  return result.rows.map((row)=>({
    id:row.id,canonicalCapabilityId:row.canonical_capability_id,provider:row.provider,name:row.name,version:row.version,
    supportedNetworks:strings(row.supported_networks),pricing:row.pricing,trustStatus:row.trust_status,healthStatus:row.health_status,
    invocationKind:row.invocation_kind,knownFailureStates:strings(row.known_failure_states),priority:row.priority,enabled:row.enabled,
    environmentEligibility:strings(row.environment_eligibility),
  }));
}

export function configuredResearchProviders(): Array<'openai'|'gemini'|'anthropic'> {
  const providers:Array<'openai'|'gemini'|'anthropic'>=[];
  if (process.env.OPENAI_API_KEY?.trim()) providers.push('openai');
  if (process.env.GEMINI_API_KEY?.trim()) providers.push('gemini');
  if (process.env.ANTHROPIC_API_KEY?.trim()) providers.push('anthropic');
  return providers;
}

export function configuredIntelligenceProviders(): string[] {
  const providers = new Set<string>(['agentplace','dexscreener','defillama','blockscout']);
  if (process.env.COINGECKO_API_KEY?.trim() || process.env.COINGECKO_DEMO_API_KEY?.trim()) providers.add('coingecko');
  if (process.env.NANSEN_API_KEY?.trim()) providers.add('nansen');
  if (process.env.GOPLUS_ACCESS_TOKEN?.trim() || (process.env.GOPLUS_APP_KEY?.trim() && process.env.GOPLUS_APP_SECRET?.trim())) providers.add('goplus');
  if (process.env.BIRDEYE_API_KEY?.trim()) providers.add('birdeye');
  if (process.env.BUBBLEMAPS_API_KEY?.trim()) providers.add('bubblemaps');
  if (process.env.ETHERSCAN_API_KEY?.trim()) providers.add('etherscan');
  if (process.env.ALCHEMY_API_KEY?.trim()) providers.add('alchemy');
  if (process.env.THEGRAPH_API_KEY?.trim() && process.env.THEGRAPH_UNISWAP_V3_ARBITRUM_SUBGRAPH_ID?.trim()) providers.add('thegraph');
  const telegraphPaymentEnabled = ['1','true','yes','on'].includes(process.env.TELEGRAPH_SERVICE_PAYMENT_ENABLED?.trim().toLowerCase() ?? '');
  const telegraphPaymentKey = process.env.TELEGRAPH_EVM_PRIVATE_KEY?.trim() ?? '';
  if (telegraphPaymentEnabled && /^0x[0-9a-fA-F]{64}$/.test(telegraphPaymentKey)) providers.add('telegraph');
  return [...providers];
}

export const moduleManifest = { name:'capabilities', layer:'controlled-runtime', milestone:'5B.2.3', status:'provider-neutral-intelligence-registry-with-experimental-telegraph-supply' } as const;
