import { WEB_RUNTIME_SETTINGS } from './runtime';
import type { ChatMessage } from '../state/types';

export type ModelProviderPreference='auto'|'openai'|'gemini';
export interface ModelSelection { provider:ModelProviderPreference; model?:string; }
export interface ModelChoice { provider:'openai'|'gemini'; model:string; label:string; role:'fast'|'balanced'|'reasoning'; }
export interface ModelCatalog { defaultProvider:ModelProviderPreference; autoLabel:'AgentPlace Auto'; providers:Array<{provider:'openai'|'gemini';configured:boolean;models:ModelChoice[]}>; }
export interface IntelligenceTask { id:string; status:'queued'|'running'|'completed'|'failed'; lastError?:string; }

function endpoint(path:string):string { return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`; }
async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(endpoint(path),{...init,credentials:'include',headers:{'content-type':'application/json',accept:'application/json',...(init?.headers??{})}});
  if(!response.ok){const payload=await response.json().catch(()=>null) as {message?:string}|null;throw new Error(payload?.message||`AgentPlace API request failed (${response.status})`);}
  return await response.json() as T;
}

export async function fetchModelOptions(conversationId:string):Promise<{catalog:ModelCatalog;preference:ModelSelection}>{
  return request(`/api/v1/intelligence/models?conversationId=${encodeURIComponent(conversationId)}`);
}

function apiMessage(message:ChatMessage){
  return {id:message.id,role:message.role,content:message.content,createdAt:message.timestamp.toISOString(),updatedAt:message.timestamp.toISOString()};
}

export async function submitIntelligence(conversationId:string,message:ChatMessage,selection:ModelSelection):Promise<IntelligenceTask>{
  const data=await request<{task:IntelligenceTask}>('/api/v1/intelligence/tasks',{method:'POST',body:JSON.stringify({conversationId,message:apiMessage(message),provider:selection.provider,model:selection.model??null})});
  return data.task;
}

export async function fetchIntelligenceTask(taskId:string):Promise<IntelligenceTask>{
  const data=await request<{task:IntelligenceTask}>(`/api/v1/intelligence/tasks/${encodeURIComponent(taskId)}`); return data.task;
}
