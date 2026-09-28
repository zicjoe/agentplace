import { useEffect, useMemo, useState } from 'react';
import { fetchModelOptions, type ModelCatalog, type ModelSelection } from '../platform/intelligenceApi';

export function ModelSelector({conversationId,onChange}:{conversationId:string;onChange:(selection:ModelSelection)=>void}){
  const [catalog,setCatalog]=useState<ModelCatalog|null>(null);
  const [selection,setSelection]=useState<ModelSelection>({provider:'auto'});
  const [error,setError]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    void fetchModelOptions(conversationId).then((value)=>{
      if(cancelled)return; setCatalog(value.catalog); setSelection(value.preference); onChange(value.preference);
    }).catch(()=>{if(!cancelled)setError(true);});
    return()=>{cancelled=true;};
  },[conversationId,onChange]);

  const value=selection.provider==='auto'?'auto':`${selection.provider}:${selection.model??''}`;
  const options=useMemo(()=>catalog?.providers.flatMap((provider)=>provider.configured?provider.models:[])??[],[catalog]);
  if(error) return <span className="text-[10px] text-text-dim">AgentPlace Auto</span>;
  return (
    <label className="flex items-center gap-1.5 text-[10px] text-text-muted">
      <span className="hidden sm:inline">Model</span>
      <select
        aria-label="AI model"
        value={value}
        onChange={(event)=>{
          const raw=event.target.value; const next:ModelSelection=raw==='auto'?{provider:'auto'}:(()=>{const [provider,...rest]=raw.split(':');return {provider:provider as 'openai'|'gemini'|'anthropic',model:rest.join(':')};})();
          setSelection(next); onChange(next);
        }}
        className="max-w-[170px] bg-transparent border border-border rounded px-2 py-1 text-[11px] text-text-sub outline-none hover:border-primary/40 focus:border-primary/50"
      >
        <option value="auto">AgentPlace Auto</option>
        {options.map((item)=><option key={`${item.provider}:${item.model}:${item.role}`} value={`${item.provider}:${item.model}`}>{item.label} · {item.model}</option>)}
      </select>
    </label>
  );
}
