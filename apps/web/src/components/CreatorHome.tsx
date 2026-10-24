import { useEffect, useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import { fetchDiscoverSupply, publishCreatorAsset } from '../platform/creatorApi';
import type { CreatorAsset } from '../state/types';
import { fetchCreatorRevenue, money, pricingLabel, setCreatorPricing, type CreatorRevenueSnapshot, type PricingModel } from '../platform/billingApi';

type CreatorTab = 'my-creations' | 'performance' | 'earnings' | 'publishing';

function typeLabelForAsset(asset: CreatorAsset): string {
  return asset.type === 'worker' ? 'Worker' : asset.type === 'workflow' ? 'Workflow' : 'Capability';
}

function AssetRow({ asset }: { asset: CreatorAsset }) {
  const dispatch = useDispatch();

  const label = asset.workerDraft?.name ?? asset.workflowDraft?.name ?? asset.capabilityDraft?.name ?? 'Unnamed';
  const typeLabel = asset.type === 'worker' ? 'Worker' : asset.type === 'workflow' ? 'Workflow' : 'Capability';
  const visLabel = asset.visibility === 'private' ? 'Private' : asset.visibility === 'public' ? 'Public' : asset.visibility;
  const version = asset.version ?? '0.1.0';

  function openAsset() {
    dispatch({ type: 'SET_ACTIVE_CREATION', id: asset.id });
    if (asset.type === 'worker') {
      dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'agent-builder' });
    } else if (asset.type === 'workflow') {
      dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'workflow-studio' });
    } else {
      dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'capability-studio' });
    }
  }

  return (
    <button
      onClick={openAsset}
      className="w-full flex items-center justify-between px-4 py-3.5 rounded-lg border border-border bg-panel hover:bg-panel-raised transition-colors text-left"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded bg-panel-raised border border-border flex items-center justify-center shrink-0">
          <span className="text-[10px] font-mono text-text-sub">{label.slice(0, 2).toUpperCase()}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-text">{label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border-dim rounded px-1.5 py-0.5">{typeLabel}</span>
            <span className="text-[10px] font-mono text-text-dim">{visLabel}</span>
            {asset.workerDraft?.testResults && asset.workerDraft.testResults.length > 0 && (
              <span className="text-[10px] font-mono text-accent">Tested</span>
            )}
            <span className="text-[10px] font-mono text-text-dim">v{version}</span>
            {asset.type === 'worker' && asset.versionHistory && asset.versionHistory.length > 1 && (
              <span className="text-[10px] font-mono text-text-dim">{asset.versionHistory.length} immutable versions</span>
            )}
          </div>
          {asset.type === 'worker' && asset.versionHistory && asset.versionHistory.length > 1 && (
            <p className="text-[10px] font-mono text-text-dim mt-1">
              History: {asset.versionHistory.map((item) => `v${item.version}`).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <svg className="w-4 h-4 text-text-dim shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

function PerformanceTab({ assets }: { assets: CreatorAsset[] }) {
  return (
    <div className="space-y-4">
      {assets.map((asset) => {
        const label = asset.workerDraft?.name ?? 'Unnamed';
        const hasRuns = false; // private Worker — no production runs yet
        return (
          <div key={asset.id} className="border border-border rounded-lg bg-panel px-5 py-4">
            <p className="text-sm font-semibold text-text mb-1">{label}</p>
            {hasRuns ? null : (
              <p className="text-xs text-text-muted">No production performance yet.</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Worker runs', value: '—' },
                { label: 'Completion rate', value: '—' },
                { label: 'Median latency', value: '—' },
                { label: 'Last incident', value: '—' },
              ].map(({ label: l, value }) => (
                <div key={l} className="bg-panel-raised border border-border-dim rounded px-3 py-2">
                  <p className="text-[10px] text-text-dim">{l}</p>
                  <p className="text-sm font-medium text-text-muted">{value}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EarningsTab({ assets }: { assets: CreatorAsset[] }) {
  const [revenue,setRevenue]=useState<CreatorRevenueSnapshot|null>(null);const [error,setError]=useState<string|null>(null);
  useEffect(()=>{void fetchCreatorRevenue().then(setRevenue).catch((value)=>setError(value instanceof Error?value.message:'Creator earnings could not be loaded.'));},[]);
  return (
    <div className="space-y-5">
      <div className="border border-border rounded-lg bg-panel px-5 py-5">
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Gross attributable creator revenue</p>
        <p className="text-2xl font-semibold text-text mt-1">{revenue?money(revenue.grossCents):'—'}</p>
        <p className="text-xs text-text-muted mt-2 leading-relaxed">M13 records gross revenue attribution durably. Creator/platform allocation and cash-out are deliberately not enabled until the commercial split and settlement rail are approved.</p>
      </div>
      {error&&<p className="text-xs text-danger">{error}</p>}
      {revenue&&revenue.entries.length>0?<div className="border border-border rounded-lg bg-panel px-4">{revenue.entries.map((entry)=><div key={entry.id} className="py-3 border-b border-border-dim last:border-0 flex justify-between gap-3"><div><p className="text-xs font-medium text-text">{entry.assetName}</p><p className="text-[10px] text-text-dim mt-1">{entry.sourceType} · {entry.allocationStatus==='unallocated'?'Commercial split not allocated':entry.payoutStatus} · {new Date(entry.occurredAt).toLocaleString()}</p></div><span className="text-xs font-mono text-accent">{money(entry.grossCents)}</span></div>)}</div>:<div className="border border-border-dim rounded-lg bg-panel px-5 py-4"><p className="text-xs text-text-muted">No creator revenue has been attributed yet across {assets.length} creator asset{assets.length===1?'':'s'}.</p></div>}
    </div>
  );
}

function PricingEditor({asset,onSaved}:{asset:CreatorAsset;onSaved:(pricing:{type:'free'|'paid';label:string;model:PricingModel;amountCents:number})=>void}){
  const current=asset.workerDraft?.pricing??asset.workflowDraft?.pricing??asset.capabilityDraft?.pricing??{type:'free' as const};
  const allowed:PricingModel[]=asset.type==='worker'?['free','monthly']:asset.type==='workflow'?['free','one-time']:['free','per-invocation'];
  const [model,setModel]=useState<PricingModel>((current.model as PricingModel|undefined)??'free');const [amount,setAmount]=useState(current.amountCents?String(current.amountCents/100):'5');const [busy,setBusy]=useState(false);const [message,setMessage]=useState<string|null>(null);
  async function save(){const amountCents=model==='free'?0:Math.round((Number(amount)||0)*100);setBusy(true);setMessage(null);try{await setCreatorPricing(asset.type,asset.id,model,amountCents);onSaved({type:model==='free'?'free':'paid',label:pricingLabel(model,amountCents),model,amountCents});setMessage('Pricing saved.');}catch(value){setMessage(value instanceof Error?value.message:'Pricing could not be saved.');}finally{setBusy(false);}}
  return <div className="border-t border-border-dim pt-3 mt-3"><p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Commercial pricing</p><div className="flex gap-2 flex-wrap"><select value={model} onChange={(e)=>setModel(e.target.value as PricingModel)} className="bg-panel-raised border border-border rounded px-2 py-1.5 text-xs text-text">{allowed.map((value)=><option key={value} value={value}>{value==='free'?'Free':value==='monthly'?'Monthly subscription':value==='one-time'?'One-time license':'Per invocation'}</option>)}</select>{model!=='free'&&<input value={amount} onChange={(e)=>setAmount(e.target.value)} inputMode="decimal" className="w-28 bg-panel-raised border border-border rounded px-2 py-1.5 text-xs text-text" aria-label="Price in USD"/>}<button disabled={busy} onClick={()=>void save()} className="px-3 py-1.5 text-xs bg-primary text-white rounded disabled:opacity-50">{busy?'Saving…':'Save pricing'}</button></div><p className="text-[10px] text-text-dim mt-2">{model==='free'?'Free access':model==='per-invocation'?`${pricingLabel(model,Math.round((Number(amount)||0)*100))} · commercial metadata now; a charge occurs only on a separately trusted AgentPlace invocation route`:`${pricingLabel(model,Math.round((Number(amount)||0)*100))} · billed from AgentPlace service balance`}. Pricing never grants wallet authority.</p>{message&&<p className={`text-[10px] mt-1 ${message==='Pricing saved.'?'text-accent':'text-danger'}`}>{message}</p>}</div>;
}

function PublishingTab({ assets }: { assets: CreatorAsset[] }) {
  const dispatch = useDispatch();
  const state = useAppState();
  const [reviewing, setReviewing] = useState<string | null>(null);

  async function handlePublish(asset: CreatorAsset) {
    try{
      await publishCreatorAsset(asset.type,asset.id,'published');
      const discoverSupply = await fetchDiscoverSupply();
      dispatch({type:'UPDATE_CREATOR_ASSET',assetId:asset.id,updates:{visibility:'public'}});
      dispatch({type:'SET_DISCOVER_SUPPLY',items:discoverSupply});
      setReviewing(null);
    }catch(error){console.error('Creator publication failed',error);}
  }

  return (
    <div className="space-y-4">
      {assets.map((asset) => {
        const label = asset.workerDraft?.name ?? asset.workflowDraft?.name ?? asset.capabilityDraft?.name ?? 'Unnamed';
        const draft = asset.workerDraft;
        const workflow = asset.workflowDraft;
        const capability = asset.capabilityDraft;
        const isPublic = asset.visibility === 'public';

        return (
          <div key={asset.id} className="border border-border rounded-lg bg-panel px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text">{label}</p>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${isPublic ? 'border-accent/30 text-accent bg-accent-dim/10' : 'border-border text-text-muted'}`}>
                {asset.visibility}
              </span>
            </div>
            <PricingEditor asset={asset} onSaved={(pricing)=>{const updates=asset.type==='worker'?{workerDraft:{...asset.workerDraft!,pricing}}:asset.type==='workflow'?{workflowDraft:{...asset.workflowDraft!,pricing}}:{capabilityDraft:{...asset.capabilityDraft!,pricing}};dispatch({type:'UPDATE_CREATOR_ASSET',assetId:asset.id,updates});}} />
            {!isPublic && reviewing !== asset.id && (
              <button
                onClick={() => setReviewing(asset.id)}
                className="text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors"
              >
                Publish publicly
              </button>
            )}
            {reviewing === asset.id && (draft || workflow || capability) && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-text-sub">Review before publishing:</p>
                {[
                  ['Asset type', typeLabelForAsset(asset)],
                  ['Description', draft?.jobContract ?? workflow?.purpose ?? capability?.operations[0]?.description ?? 'Creator asset'],
                  ['Creator', state.user?.name ?? 'You'],
                  ['Authority posture', draft?.authorityDefault ?? (asset.type === 'capability' ? 'Imported capability · no wallet authority' : 'Workflow does not create authority')],
                  ['Pricing', (draft?.pricing ?? workflow?.pricing ?? capability?.pricing)?.type === 'free' ? 'Free' : (draft?.pricing ?? workflow?.pricing ?? capability?.pricing)?.label ?? 'Paid'],
                  ['Version', asset.version ?? '0.1.0'],
                ].map(([l, v]) => (
                  <div key={l} className="flex gap-3 text-xs">
                    <span className="text-text-dim w-32 shrink-0">{l}</span>
                    <span className="text-text-sub">{v}</span>
                  </div>
                ))}
                <p className="text-xs text-text-dim">Publishing changes visibility only. It does not grant end-user wallet authority or promote imported capabilities into trusted production routing.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handlePublish(asset)}
                    className="px-4 py-2 bg-primary text-white text-xs rounded font-medium hover:bg-primary-hover transition-colors"
                  >
                    Publish
                  </button>
                  <button
                    onClick={() => setReviewing(null)}
                    className="px-4 py-2 border border-border text-text-sub text-xs rounded hover:bg-panel-raised transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {isPublic && (
              <p className="text-xs text-accent">Published — visible in Discover.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CreatorHome() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [tab, setTab] = useState<CreatorTab>('my-creations');

  const assets = state.creatorAssets ?? [];

  const tabs: Array<{ id: CreatorTab; label: string }> = [
    { id: 'my-creations', label: 'My creations' },
    { id: 'performance', label: 'Performance' },
    { id: 'earnings', label: 'Earnings' },
    { id: 'publishing', label: 'Publishing' },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg overflow-hidden">
      <div className="px-6 pt-6 pb-0 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-text">My creations</h1>
            <p className="text-xs text-text-muted mt-0.5">Accessed through + Create · Not primary navigation</p>
          </div>
          <button
            onClick={() => { dispatch({ type: 'SET_ACTIVE_CREATION', id: null }); dispatch({ type: 'SET_CREATOR_SURFACE', surface: null }); }}
            className="text-text-muted hover:text-text p-1 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-0">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === id ? 'border-primary text-text' : 'border-transparent text-text-sub hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-8 max-w-2xl">
        {tab === 'my-creations' && (
          <div className="space-y-2">
            {assets.length === 0 && (
              <p className="text-sm text-text-muted py-8 text-center">No creations yet. Use + Create to build a Worker, Workflow, or Capability.</p>
            )}
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} />
            ))}
          </div>
        )}
        {tab === 'performance' && <PerformanceTab assets={assets} />}
        {tab === 'earnings' && <EarningsTab assets={assets} />}
        {tab === 'publishing' && <PublishingTab assets={assets} />}
      </div>
    </div>
  );
}
