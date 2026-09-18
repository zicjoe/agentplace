import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import type { DiscoverSupplyItem } from '../state/types';

type Tab = 'for-you' | 'workers' | 'workflows' | 'builders';

type WorkerFilter =
  | 'all'
  | 'memes'
  | 'smart-money'
  | 'stablecoins'
  | 'portfolio'
  | 'defi'
  | 'research'
  | 'prediction';

const WORKER_FILTERS: Array<{ id: WorkerFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'memes', label: 'Memes' },
  { id: 'smart-money', label: 'Smart Money' },
  { id: 'stablecoins', label: 'Stablecoins' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'defi', label: 'DeFi' },
  { id: 'research', label: 'Research' },
  { id: 'prediction', label: 'Prediction Markets' },
];

function workerMatchesFilter(w: DiscoverSupplyItem, f: WorkerFilter): boolean {
  if (f === 'all') return true;
  const cat = w.category.toLowerCase();
  const name = w.name.toLowerCase();
  if (f === 'memes') return cat.includes('meme') || name.includes('meme') || name.includes('whale');
  if (f === 'smart-money') return cat.includes('smart') || name.includes('smart') || name.includes('whale');
  if (f === 'stablecoins') return cat.includes('yield') || cat.includes('stable') || name.includes('stable');
  if (f === 'portfolio') return cat.includes('portfolio');
  if (f === 'defi') return cat.includes('defi') || cat.includes('yield');
  if (f === 'research') return cat.includes('research');
  if (f === 'prediction') return name.includes('prediction');
  return true;
}

function SupplyItemCard({ item }: { item: DiscoverSupplyItem }) {
  const state = useAppState();
  const dispatch = useDispatch();

  function openDetail() {
    dispatch({ type: 'SET_ACTIVE_DISCOVER_ITEM', id: item.id });
  }

  const isAdded = state.workers.some((w) => w.id === item.id.replace('ds-', 'w-'));

  return (
    <button
      onClick={openDetail}
      className="w-full border border-border rounded-lg bg-panel hover:border-border hover:bg-panel-raised transition-colors text-left p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded bg-panel-raised border border-border flex items-center justify-center shrink-0">
            <span className="text-xs font-mono font-medium text-text-sub">
              {item.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-text">{item.name}</span>
              {item.isOriginal && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary border border-primary/30 rounded px-1.5 py-0.5">
                  Original
                </span>
              )}
              {item.sponsored && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border rounded px-1.5 py-0.5">
                  Sponsored
                </span>
              )}
              {item.pricing.type === 'paid' && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border rounded px-1.5 py-0.5">
                  Paid
                </span>
              )}
            </div>
            <p className="text-xs text-text-sub mt-0.5">{item.tagline}</p>
            {!item.isOriginal && (
              <p className="text-[10px] text-text-muted mt-0.5">by {item.creatorName}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {isAdded && item.type === 'worker' && (
            <span className="text-xs text-accent flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Added
            </span>
          )}
          <svg className="w-4 h-4 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
      {item.networks.length > 0 && (
        <div className="mt-3 flex items-center gap-1 flex-wrap">
          {item.networks.map((n) => (
            <span key={n} className="text-[10px] font-mono text-text-muted bg-panel border border-border-dim rounded px-1.5 py-0.5">
              {n}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function ForYouTab() {
  const state = useAppState();
  const dispatch = useDispatch();

  if (!state.user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-10 h-10 rounded-full bg-panel-raised border border-border flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
        </div>
        <p className="text-sm text-text-sub mb-1">Sign in for personalised recommendations</p>
        <p className="text-xs text-text-muted mb-4">Based on your goals, workers, and activity</p>
        <button
          onClick={() =>
            dispatch({
              type: 'SET_IDENTITY_CHECKPOINT',
              checkpoint: {
                reason: 'sign-in',
                feature: 'personalised Discover recommendations',
                onComplete: (user) => dispatch({ type: 'SET_USER', user }),
              },
            })
          }
          className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  const workerNames = state.workers.map((w) => w.name);
  const supply = state.discoverSupply ?? [];

  const recommendations: Array<{ item: DiscoverSupplyItem; reason: string }> = [];

  supply.filter((s) => s.type === 'worker').forEach((item) => {
    if (state.workers.some((w) => w.id === item.id.replace('ds-', 'w-'))) return;
    if (workerNames.includes('Meme Scout') && (item.name === 'Whale Signal Analyst' || item.name === 'Smart Money Tracker')) {
      recommendations.push({ item, reason: 'Useful with your BONK monitoring' });
    } else if (workerNames.includes('Portfolio Guardian') && item.name === 'Stablecoin Manager') {
      recommendations.push({ item, reason: 'Pairs with your Portfolio Guardian setup' });
    } else if (workerNames.includes('Stablecoin Manager') && item.name === 'Whale Signal Analyst') {
      recommendations.push({ item, reason: 'Adds smart-money context to your DeFi monitoring' });
    }
  });

  const usefulWorkflows = supply.filter((s) => s.type === 'workflow').slice(0, 2);

  return (
    <div className="space-y-6">
      {recommendations.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Recommended for you</p>
          <div className="space-y-2">
            {recommendations.map(({ item, reason }) => (
              <div key={item.id} className="relative">
                <SupplyItemCard item={item} />
                <div className="absolute top-3 right-8">
                  <span className="text-[10px] text-text-muted italic">{reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Useful workflows</p>
        <div className="space-y-2">
          {usefulWorkflows.map((item) => (
            <SupplyItemCard key={item.id} item={item} />
          ))}
        </div>
      </div>
      {recommendations.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-text-sub">Explore Workers and Workflows below to build your workforce.</p>
        </div>
      )}
    </div>
  );
}

export function Discover() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>('workers');
  const [workerFilter, setWorkerFilter] = useState<WorkerFilter>('all');

  const supply = state.discoverSupply ?? [];
  const workerItems = supply.filter((s) => s.type === 'worker' && workerMatchesFilter(s, workerFilter));
  const workflowItems = supply.filter((s) => s.type === 'workflow');
  const capabilityItems = supply.filter((s) => s.type === 'capability');

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'for-you', label: 'For You' },
    { id: 'workers', label: 'Workers' },
    { id: 'workflows', label: 'Workflows' },
    { id: 'builders', label: 'For Builders' },
  ];

  return (
    <div className="h-full flex flex-col bg-bg overflow-y-auto">
      <div className="px-6 pt-8 pb-0 max-w-3xl">
        <h1 className="text-2xl font-semibold text-text tracking-tight mb-1">Discover</h1>
        <p className="text-sm text-text-sub">What is possible with AgentPlace?</p>
      </div>

      <div className="px-6 mt-6 border-b border-border">
        <div className="flex gap-0">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-primary text-text'
                  : 'border-transparent text-text-sub hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 pt-6 pb-8 max-w-3xl">
        {tab === 'for-you' && <ForYouTab />}

        {tab === 'workers' && (
          <div>
            <p className="text-xs text-text-muted mb-4">
              Adding a Worker never grants wallet authority. You configure what each Worker can do after adding it.
            </p>
            {/* Filter chips */}
            <div className="flex gap-1.5 flex-wrap mb-5">
              {WORKER_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setWorkerFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    workerFilter === f.id
                      ? 'border-primary/50 bg-primary-dim/20 text-primary'
                      : 'border-border text-text-muted hover:text-text hover:border-border'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {workerItems.map((item) => (
                <SupplyItemCard key={item.id} item={item} />
              ))}
              {workerItems.length === 0 && (
                <p className="text-sm text-text-muted py-8 text-center">No Workers match this filter.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'workflows' && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted mb-4">
              Reusable methods and processes you can attach to Workers.
            </p>
            {workflowItems.map((item) => (
              <SupplyItemCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {tab === 'builders' && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted mb-4">
              Capabilities and integrations for developers building on AgentPlace.
            </p>
            <div className="space-y-2 mb-6">
              {capabilityItems.map((item) => (
                <SupplyItemCard key={item.id} item={item} />
              ))}
            </div>
            <div className="border-t border-border-dim pt-4">
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-3">Connect your own</p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    // opens Capability Studio via Create → Capability (builders shortcut)
                  }}
                  className="w-full flex items-start gap-4 border border-border rounded-lg bg-panel px-5 py-4 hover:bg-panel-raised transition-colors text-left"
                >
                  <div className="text-text-muted mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16M7 4L3 12l4 8M17 4l4 8-4 8" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text mb-0.5">MCP Capabilities</p>
                    <p className="text-xs text-text-sub leading-relaxed">Extend Workers with custom tools via the Model Context Protocol.</p>
                  </div>
                </button>
                <button
                  className="w-full flex items-start gap-4 border border-border rounded-lg bg-panel px-5 py-4 hover:bg-panel-raised transition-colors text-left"
                >
                  <div className="text-text-muted mt-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h8m-8 6h16" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text mb-0.5">OpenAPI Import</p>
                    <p className="text-xs text-text-sub leading-relaxed">Import an OpenAPI spec to give Workers access to any REST API.</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
