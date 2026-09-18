import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import type { CreatorAsset } from '../state/types';

type CreatorTab = 'my-creations' | 'performance' | 'earnings' | 'publishing';

function AssetRow({ asset }: { asset: CreatorAsset }) {
  const dispatch = useDispatch();

  const label = asset.workerDraft?.name ?? asset.workflowDraft?.name ?? asset.capabilityDraft?.name ?? 'Unnamed';
  const typeLabel = asset.type === 'worker' ? 'Worker' : asset.type === 'workflow' ? 'Workflow' : 'Capability';
  const visLabel = asset.visibility === 'private' ? 'Private' : asset.visibility === 'public' ? 'Public' : asset.visibility;
  const version = '0.1';

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
  const state = useAppState();
  const dispatch = useDispatch();
  const earnings = state.creatorEarnings ?? [];
  const publicAssets = assets.filter((a) => a.visibility === 'public');
  const totalEarned = earnings.reduce((s, e) => s + e.creatorAmountUsd, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total earned', value: `$${totalEarned.toFixed(2)}` },
          { label: 'Pending payout', value: `$${earnings.filter((e) => e.status === 'pending').reduce((s, e) => s + e.creatorAmountUsd, 0).toFixed(2)}` },
          { label: 'Paid out', value: `$${earnings.filter((e) => e.status === 'paid').reduce((s, e) => s + e.creatorAmountUsd, 0).toFixed(2)}` },
        ].map((item) => (
          <div key={item.label} className="border border-border rounded-lg bg-panel px-4 py-3">
            <p className="text-[10px] font-mono text-text-dim mb-1">{item.label}</p>
            <p className="text-base font-semibold text-text">{item.value}</p>
          </div>
        ))}
      </div>

      {earnings.length > 0 && (
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-text-dim mb-2">Earning ledger</p>
          <div className="border border-border rounded-lg bg-panel divide-y divide-border-dim">
            {earnings.map((e) => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-text">{e.assetName}</p>
                  <p className="text-[10px] text-text-muted">{new Date(e.timestamp).toLocaleDateString()} · {Math.round(e.platformShareUsd / e.grossAmountUsd * 100)}% platform share</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-text">${e.creatorAmountUsd.toFixed(2)}</p>
                  <span className={`text-[10px] ${e.status === 'paid' ? 'text-accent' : 'text-warn'}`}>{e.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {publicAssets.length === 0 && earnings.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-text-muted">No public assets yet. Publish a Worker to start earning.</p>
          <button
            onClick={() => dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'agent-builder' })}
            className="mt-3 px-4 py-2 text-xs bg-primary text-white rounded hover:opacity-90 transition-opacity"
          >
            Create a Worker
          </button>
        </div>
      )}

      {assets.filter((a) => a.visibility !== 'public').map((asset) => {
        const label = asset.workerDraft?.name ?? asset.workflowDraft?.name ?? 'Unnamed';
        return (
          <div key={asset.id} className="border border-border-dim rounded-lg bg-panel px-5 py-4 opacity-60">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-sub">{label}</p>
              <span className="text-xs text-text-dim">Private · $0 earnings</span>
            </div>
            <p className="text-xs text-text-muted mt-1">Publish publicly to enable marketplace earnings.</p>
          </div>
        );
      })}
    </div>
  );
}

function PublishingTab({ assets }: { assets: CreatorAsset[] }) {
  const dispatch = useDispatch();
  const state = useAppState();
  const [reviewing, setReviewing] = useState<string | null>(null);

  function handlePublish(asset: CreatorAsset) {
    if (!asset.workerDraft) return;
    const supplyId = 'ds-whale-meme-pub';
    const existing = (state.discoverSupply ?? []).find((s) => s.id === supplyId);
    if (!existing) {
      dispatch({
        type: 'ADD_DISCOVER_SUPPLY_ITEM',
        item: {
          id: supplyId,
          type: 'worker',
          name: asset.workerDraft.name,
          tagline: 'Finds meme opportunities backed by credible whale wallet behaviour',
          description: asset.workerDraft.jobContract,
          whatItDoes: asset.workerDraft.responsibilities,
          whatItDoesNot: asset.workerDraft.antiJobs,
          creatorId: state.user?.id ?? 'u1',
          creatorName: state.user?.name ?? 'You',
          isOriginal: false,
          category: 'Research & Discovery',
          networks: asset.workerDraft.networks,
          pricing: asset.workerDraft.pricing,
          visibility: 'public',
          authorityDefault: asset.workerDraft.authorityDefault,
          sponsored: false,
          lastUpdated: new Date(),
          version: '0.1.0',
          creatorAssetId: asset.id,
        },
      });
    }
    dispatch({ type: 'UPDATE_CREATOR_ASSET', assetId: asset.id, updates: { visibility: 'public', publishedSupplyItemId: supplyId } });
    setReviewing(null);
  }

  return (
    <div className="space-y-4">
      {assets.map((asset) => {
        const label = asset.workerDraft?.name ?? 'Unnamed';
        const draft = asset.workerDraft;
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
            {reviewing === asset.id && draft && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-text-sub">Review before publishing:</p>
                {[
                  ['Listing description', draft.jobContract],
                  ['Creator', state.user?.name ?? 'You'],
                  ['Networks', draft.networks.join(', ') || '—'],
                  ['Authority default', draft.authorityDefault],
                  ['Pricing', draft.pricing.type === 'free' ? 'Free' : draft.pricing.label ?? 'Paid'],
                  ['Version', '0.1.0'],
                  ['Test status', draft.testResults.filter((r) => r.passed).length + '/' + draft.testResults.length + ' passed'],
                ].map(([l, v]) => (
                  <div key={l} className="flex gap-3 text-xs">
                    <span className="text-text-dim w-32 shrink-0">{l}</span>
                    <span className="text-text-sub">{v}</span>
                  </div>
                ))}
                <p className="text-xs text-text-dim">Publishing does not grant any end-user wallet authority.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePublish(asset)}
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
    <div className="h-full flex flex-col bg-bg overflow-hidden">
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

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8 max-w-2xl">
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
