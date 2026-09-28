import { createHash } from 'node:crypto';

export type ModelProvider = 'openai' | 'gemini' | 'anthropic';
export type ModelProviderPreference = 'auto' | ModelProvider;
export type ModelRole = 'fast' | 'balanced' | 'reasoning';

export interface ModelChoice {
  provider: ModelProvider;
  model: string;
  label: string;
  role: ModelRole;
}

export interface ModelCatalog {
  defaultProvider: ModelProviderPreference;
  autoLabel: 'AgentPlace Auto';
  providers: Array<{ provider: ModelProvider; configured: boolean; models: ModelChoice[] }>;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number;
}

export interface ModelCallResult<T> {
  provider: ModelProvider;
  model: string;
  value: T;
  usage: ModelUsage;
  latencyMs: number;
  inputHash: string;
}

export interface ResearchSource { url: string; title: string; }
export interface ResearchResult {
  answer: string;
  sources: ResearchSource[];
}

export class ModelGatewayError extends Error {
  constructor(public readonly code:string, message:string) { super(message); this.name='ModelGatewayError'; }
}

function env(name:string, fallback=''):string { return process.env[name]?.trim() || fallback; }
function hasKey(provider:ModelProvider):boolean {
  if(provider==='openai') return !!env('OPENAI_API_KEY');
  if(provider==='gemini') return !!env('GEMINI_API_KEY');
  return !!env('ANTHROPIC_API_KEY');
}

function configuredModels(provider:ModelProvider):ModelChoice[] {
  const values: ModelChoice[] = provider==='openai'
    ? [
        {provider,model:env('OPENAI_MODEL_FAST','gpt-6-luna'),label:'OpenAI · Fast',role:'fast'},
        {provider,model:env('OPENAI_MODEL_BALANCED','gpt-6-sol'),label:'OpenAI · Balanced',role:'balanced'},
        {provider,model:env('OPENAI_MODEL_REASONING','gpt-6-astra'),label:'OpenAI · Reasoning',role:'reasoning'},
      ]
    : provider==='gemini'
      ? [
          {provider,model:env('GEMINI_MODEL_FAST','gemini-3.5-flash-lite'),label:'Gemini · Fast',role:'fast'},
          {provider,model:env('GEMINI_MODEL_BALANCED','gemini-3.8-flash'),label:'Gemini · Balanced',role:'balanced'},
          {provider,model:env('GEMINI_MODEL_REASONING','gemini-3.8-flash'),label:'Gemini · Reasoning',role:'reasoning'},
        ]
      : [
          {provider,model:env('ANTHROPIC_MODEL_FAST','claude-haiku-4-5-20251001'),label:'Claude · Fast',role:'fast'},
          {provider,model:env('ANTHROPIC_MODEL_BALANCED','claude-sonnet-5'),label:'Claude · Balanced',role:'balanced'},
          {provider,model:env('ANTHROPIC_MODEL_REASONING','claude-opus-5'),label:'Claude · Reasoning',role:'reasoning'},
        ];
  return values.filter((item,index,array)=>array.findIndex((candidate)=>candidate.model===item.model)===index);
}

export function getModelCatalog():ModelCatalog {
  const raw=env('AGENTPLACE_DEFAULT_MODEL_PROVIDER','auto');
  const defaultProvider:ModelProviderPreference = raw==='openai'||raw==='gemini'||raw==='anthropic'?raw:'auto';
  return {
    defaultProvider, autoLabel:'AgentPlace Auto',
    providers:(['gemini','openai','anthropic'] as const).map((provider)=>({provider,configured:hasKey(provider),models:configuredModels(provider)})),
  };
}

function chooseProvider(preference:ModelProviderPreference):ModelProvider {
  if (preference!=='auto') {
    if (!hasKey(preference)) throw new ModelGatewayError('provider_not_configured',`${preference} is not configured for AgentPlace.`);
    return preference;
  }
  const preferred=env('AGENTPLACE_DEFAULT_MODEL_PROVIDER','gemini');
  if ((preferred==='gemini'||preferred==='openai'||preferred==='anthropic') && hasKey(preferred)) return preferred;
  if (hasKey('gemini')) return 'gemini';
  if (hasKey('openai')) return 'openai';
  if (hasKey('anthropic')) return 'anthropic';
  throw new ModelGatewayError('no_provider_configured','No AgentPlace model provider is configured.');
}

function selectModel(provider:ModelProvider, requested:string|undefined, role:ModelRole):string {
  if (requested?.trim()) return requested.trim();
  return configuredModels(provider).find((x)=>x.role===role)?.model ?? configuredModels(provider)[0]!.model;
}

function timeoutMs():number { return Math.max(5_000,Number.parseInt(env('AI_MODEL_TIMEOUT_MS','90000'),10)||90_000); }
function maxOutputTokens():number { return Math.max(128,Number.parseInt(env('AI_MAX_OUTPUT_TOKENS','2500'),10)||2500); }

async function fetchJson(url:string, init:RequestInit):Promise<unknown> {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs());
  try {
    const response=await fetch(url,{...init,signal:controller.signal});
    const text=await response.text();
    if(!response.ok) throw new ModelGatewayError(`provider_http_${response.status}`,text.slice(0,1000)||`Provider returned ${response.status}`);
    return text ? JSON.parse(text) as unknown : {};
  } catch(error) {
    if(error instanceof ModelGatewayError) throw error;
    if(error instanceof Error && error.name==='AbortError') throw new ModelGatewayError('provider_timeout','Model provider request timed out.');
    throw new ModelGatewayError('provider_error',error instanceof Error?error.message:'Unknown model provider error');
  } finally { clearTimeout(timer); }
}

function object(value:unknown):Record<string,unknown> { return value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {}; }
function array(value:unknown):unknown[] { return Array.isArray(value)?value:[]; }
function str(value:unknown):string|undefined { return typeof value==='string'?value:undefined; }
function num(value:unknown):number|undefined { return typeof value==='number'&&Number.isFinite(value)?value:undefined; }

function openAIOutputText(payload:unknown):string {
  const root=object(payload); if(typeof root.output_text==='string') return root.output_text;
  for(const item of array(root.output)) for(const content of array(object(item).content)) {
    const c=object(content); if(c.type==='output_text' && typeof c.text==='string') return c.text;
  }
  return '';
}
function geminiOutputText(payload:unknown):string {
  const root=object(payload); if(typeof root.output_text==='string') return root.output_text;
  for(const step of array(root.steps)) for(const content of array(object(step).content)) {
    const c=object(content); if(typeof c.text==='string') return c.text;
  }
  for(const candidate of array(root.candidates)) {
    const content=object(object(candidate).content); for(const part of array(content.parts)) if(typeof object(part).text==='string') return object(part).text as string;
  }
  return '';
}
function anthropicOutputText(payload:unknown):string {
  const root=object(payload);
  const parts:string[]=[];
  for(const content of array(root.content)) {
    const c=object(content);
    if(c.type==='text' && typeof c.text==='string') parts.push(c.text);
  }
  return parts.join('\n').trim();
}

function collectSources(value:unknown, into:Map<string,string>, depth=0):void {
  if(depth>10 || value===null || value===undefined) return;
  if(Array.isArray(value)){ for(const item of value) collectSources(item,into,depth+1); return; }
  if(typeof value!=='object') return;
  const row=value as Record<string,unknown>;
  const directUrl=str(row.url) ?? str(row.uri);
  if(directUrl && /^https?:\/\//i.test(directUrl)) into.set(directUrl,str(row.title)??str(row.name)??new URL(directUrl).hostname);
  if(row.web && typeof row.web==='object') {
    const web=object(row.web); const url=str(web.uri)??str(web.url); if(url && /^https?:\/\//i.test(url)) into.set(url,str(web.title)??new URL(url).hostname);
  }
  for(const child of Object.values(row)) collectSources(child,into,depth+1);
}

function usageFrom(provider:ModelProvider,payload:unknown):ModelUsage {
  const root=object(payload);
  let input:number|undefined; let output:number|undefined;
  if(provider==='openai') {
    const usage=object(root.usage); input=num(usage.input_tokens); output=num(usage.output_tokens);
  } else if(provider==='gemini') {
    const usage=object(root.usage_metadata ?? root.usageMetadata ?? root.usage);
    input=num(usage.prompt_token_count ?? usage.promptTokenCount ?? usage.input_tokens);
    output=num(usage.candidates_token_count ?? usage.candidatesTokenCount ?? usage.output_tokens);
  } else {
    const usage=object(root.usage);
    input=num(usage.input_tokens);
    output=num(usage.output_tokens);
  }
  const ratePrefix=provider==='openai'?'OPENAI':provider==='gemini'?'GEMINI':'ANTHROPIC';
  const inputRate=Number.parseFloat(env(`${ratePrefix}_INPUT_USD_PER_MILLION`,'0'))||0;
  const outputRate=Number.parseFloat(env(`${ratePrefix}_OUTPUT_USD_PER_MILLION`,'0'))||0;
  const estimatedCostUsd=((input??0)*inputRate+(output??0)*outputRate)/1_000_000;
  return { ...(input === undefined ? {} : { inputTokens: input }), ...(output === undefined ? {} : { outputTokens: output }), estimatedCostUsd };
}

async function callOpenAIStructured(model:string,system:string,user:string,schemaName:string,schema:Record<string,unknown>):Promise<unknown> {
  return fetchJson('https://api.openai.com/v1/responses',{
    method:'POST',headers:{authorization:`Bearer ${env('OPENAI_API_KEY')}`,'content-type':'application/json'},
    body:JSON.stringify({model,input:[{role:'system',content:system},{role:'user',content:user}],max_output_tokens:maxOutputTokens(),text:{format:{type:'json_schema',name:schemaName,strict:true,schema}}}),
  });
}
async function callGeminiStructured(model:string,system:string,user:string,schema:Record<string,unknown>):Promise<unknown> {
  return fetchJson('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'x-goog-api-key':env('GEMINI_API_KEY'),'content-type':'application/json'},
    body:JSON.stringify({model,input:`SYSTEM INSTRUCTIONS:\n${system}\n\nUSER REQUEST:\n${user}`,response_format:{type:'text',mime_type:'application/json',schema}}),
  });
}
async function callAnthropicStructured(model:string,system:string,user:string,schema:Record<string,unknown>):Promise<unknown> {
  return fetchJson('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'x-api-key':env('ANTHROPIC_API_KEY'),'anthropic-version':'2023-06-01','content-type':'application/json'},
    body:JSON.stringify({
      model,
      max_tokens:maxOutputTokens(),
      system,
      messages:[{role:'user',content:user}],
      output_config:{format:{type:'json_schema',schema}},
    }),
  });
}

export async function generateStructured<T>(args:{provider?:ModelProviderPreference;model?:string;role?:ModelRole;system:string;user:string;schemaName:string;schema:Record<string,unknown>}):Promise<ModelCallResult<T>> {
  const provider=chooseProvider(args.provider??'auto'); const model=selectModel(provider,args.model,args.role??'balanced');
  const input=`${args.system}\n${args.user}`; const inputHash=createHash('sha256').update(input).digest('hex'); const started=Date.now();
  const payload=provider==='openai'
    ? await callOpenAIStructured(model,args.system,args.user,args.schemaName,args.schema)
    : provider==='gemini'
      ? await callGeminiStructured(model,args.system,args.user,args.schema)
      : await callAnthropicStructured(model,args.system,args.user,args.schema);
  const text=provider==='openai'?openAIOutputText(payload):provider==='gemini'?geminiOutputText(payload):anthropicOutputText(payload);
  if(!text) throw new ModelGatewayError('empty_model_output','Model returned no structured output.');
  let value:T; try { value=JSON.parse(text) as T; } catch { throw new ModelGatewayError('invalid_structured_output','Model returned invalid JSON.'); }
  return {provider,model,value,usage:usageFrom(provider,payload),latencyMs:Date.now()-started,inputHash};
}

export async function researchWithWeb(args:{provider?:ModelProviderPreference;model?:string;system:string;query:string}):Promise<ModelCallResult<ResearchResult>> {
  const provider=chooseProvider(args.provider??'auto'); const model=selectModel(provider,args.model,'balanced'); const input=`${args.system}\n${args.query}`;
  const inputHash=createHash('sha256').update(input).digest('hex'); const started=Date.now(); let payload:unknown;
  if(provider==='openai') {
    payload=await fetchJson('https://api.openai.com/v1/responses',{
      method:'POST',headers:{authorization:`Bearer ${env('OPENAI_API_KEY')}`,'content-type':'application/json'},
      body:JSON.stringify({model,instructions:args.system,input:args.query,tools:[{type:'web_search'}],tool_choice:'required',max_output_tokens:maxOutputTokens()}),
    });
  } else if(provider==='gemini') {
    payload=await fetchJson('https://generativelanguage.googleapis.com/v1beta/interactions',{
      method:'POST',headers:{'x-goog-api-key':env('GEMINI_API_KEY'),'content-type':'application/json'},
      body:JSON.stringify({model,input:`SYSTEM INSTRUCTIONS:\n${args.system}\n\nRESEARCH REQUEST:\n${args.query}`,tools:[{type:'google_search'}]}),
    });
  } else {
    payload=await fetchJson('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'x-api-key':env('ANTHROPIC_API_KEY'),'anthropic-version':'2023-06-01','content-type':'application/json'},
      body:JSON.stringify({
        model,
        max_tokens:maxOutputTokens(),
        system:args.system,
        messages:[{role:'user',content:args.query}],
        tools:[{type:'web_search_20260318',name:'web_search',max_uses:5}],
      }),
    });
  }
  const answer=(provider==='openai'?openAIOutputText(payload):provider==='gemini'?geminiOutputText(payload):anthropicOutputText(payload)).trim();
  if(!answer) throw new ModelGatewayError('empty_research_output','Research provider returned no answer.');
  const found=new Map<string,string>(); collectSources(payload,found);
  const sources=[...found.entries()].slice(0,24).map(([url,title])=>({url,title}));
  return {provider,model,value:{answer,sources},usage:usageFrom(provider,payload),latencyMs:Date.now()-started,inputHash};
}

export const moduleManifest={name:'models',layer:'controlled-runtime',milestone:4,status:'active'} as const;
