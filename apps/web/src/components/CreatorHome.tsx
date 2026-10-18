import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import { publishCreatorAsset } from '../platform/creatorApi';
import type { CreatorAsset } from '../state/types';

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
          </div>
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
  const dispatch = useDispatch();
  const publicAssets = assets.filter((asset) => asset.visibility === 'public');
  return (
    <div className="space-y-5">
      <div className="border border-border rounded-lg bg-panel px-5 py-5">
        <p className="text-sm font-semibold text-text">Creator earnings are not enabled yet</p>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">M12 makes creator assets durable and discoverable. Paid acquisition, revenue attribution and payouts arrive with Billing + Security Completion, so AgentPlace will not display fabricated earnings.</p>
      </div>
      {publicAssets.length > 0 ? (
        <div className="border border-border-dim rounded-lg bg-panel px-5 py-4">
          <p className="text-xs text-text-sub">{publicAssets.length} public asset{publicAssets.length === 1 ? '' : 's'} in Discover.</p>
          <p className="text-xs text-text-muted mt-1">Public visibility does not imply monetization or payout eligibility.</p>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-text-muted">No public assets yet.</p>
          <button onClick={() => { dispatch({ type: 'SET_ACTIVE_CREATION', id: null }); dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'agent-builder' }); }} className="mt-3 px-4 py-2 text-xs bg-primary text-white rounded hover:opacity-90 transition-opacity">Create a Worker</button>
        </div>
      )}
    </div>
  );
}

function PublishingTab({ assets }: { assets: CreatorAsset[] }) {
  const dispatch = useDispatch();
  const state = useAppState();
  const [reviewing, setReviewing] = useState<string | null>(null);

  async function handlePublish(asset: CreatorAsset) {
    try{
      await publishCreatorAsset(asset.type,asset.id,'published');
      dispatch({type:'UPDATE_CREATOR_ASSET',assetId:asset.id,updates:{visibility:'public'}});
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
            onClick={() => dispatch({ type: 'SET_CREATOR_SURFACE', surface: null })}
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
