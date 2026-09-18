import { useState } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import type { Worker, BillingSubscription } from '../state/types';

function SandboxTryPanel({ itemId, itemName, onClose }: { itemId: string; itemName: string; onClose: () => void }) {
  const [step, setStep] = useState<'prompt' | 'result'>('prompt');

  const examplePrompt = itemId === 'ds-whale-signal'
    ? '"Show me what you would look for in a whale-driven meme opportunity."'
    : itemId === 'ds-prediction-scout'
    ? '"What prediction markets are showing the most movement right now?"'
    : '"Give me a sample analysis."';

  const exampleResult = itemId === 'ds-whale-signal'
    ? `## Whale Signal Analyst · Sandbox result\n\n**Prototype data only**\n\nI look for coordinated wallet clusters — groups of wallets that accumulate within similar time windows, sourced from similar origin wallets, and which have historically correlated with material price moves.\n\nFor a meme opportunity I'd specifically check:\n- Cluster size and wallet quality (prior profitable exit history)\n- Whether accumulation is spreading into mid-tier wallets (not just whales)\n- Time since initial cluster activity (early or late)\n- Liquidity depth relative to cluster exposure\n\nThis is a sandbox illustration. No real analysis was performed.`
    : `## ${itemName} · Sandbox result\n\n**Prototype data only**\n\nThis is an illustrative sandbox response. In production, ${itemName} would perform real research using connected data sources.\n\nNo installation occurred. No wallet authority was granted.`;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-panel border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-dim flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Try · {itemName}</p>
            <p className="text-xs text-text-muted">Sandbox — no installation, no wallet authority</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">
          {step === 'prompt' && (
            <div>
              <p className="text-sm text-text-sub mb-4">Example prompt to try:</p>
              <div className="bg-panel-raised border border-border-dim rounded-lg px-4 py-3 mb-4">
                <p className="text-sm text-text italic">{examplePrompt}</p>
              </div>
              <button
                onClick={() => setStep('result')}
                className="w-full py-2.5 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
              >
                Run sandbox
              </button>
            </div>
          )}
          {step === 'result' && (
            <div>
              <div className="bg-panel-raised border border-border-dim rounded-lg px-4 py-3 mb-4 max-h-60 overflow-y-auto">
                <p className="text-xs text-warn font-mono mb-2">Sandbox / prototype result</p>
                <p className="text-sm text-text-sub whitespace-pre-line leading-relaxed">{exampleResult}</p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 text-sm text-text-sub border border-border rounded hover:bg-panel-raised transition-colors"
              >
                Continue exploring
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiscoverDetail() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [showTry, setShowTry] = useState(false);
  const [addedConfirm, setAddedConfirm] = useState(false);
  const [acquiring, setAcquiring] = useState(false);

  const item = (state.discoverSupply ?? []).find((s) => s.id === state.activeDiscoverItemId);

  function goBack() {
    dispatch({ type: 'SET_ACTIVE_DISCOVER_ITEM', id: null });
  }

  if (!item) return null;

  const installedWorkerId = item.type === 'worker' ? item.id.replace('ds-', 'w-') : null;
  const isAdded = installedWorkerId ? state.workers.some((w) => w.id === installedWorkerId) : false;

  function handleAdd() {
    if (!state.user) {
      dispatch({
        type: 'SET_IDENTITY_CHECKPOINT',
        checkpoint: {
          reason: 'add-worker',
          feature: `add ${item!.name} to your workforce`,
          onComplete: (user) => {
            dispatch({ type: 'SET_USER', user });
            doAdd();
          },
        },
      });
    } else {
      doAdd();
    }
  }

  function doAdd() {
    if (!item) return;
    if (item.pricing.type === 'paid') {
      setAcquiring(true);
      setTimeout(() => {
        setAcquiring(false);
        finalAdd();
      }, 1200);
    } else {
      finalAdd();
    }
  }

  function finalAdd() {
    if (!item || !installedWorkerId) return;
    const w: Worker = {
      id: installedWorkerId,
      name: item.name,
      tagline: item.tagline,
      status: 'standby',
      isOriginal: item.isOriginal,
      responsibility: item.whatItDoes?.join('. '),
      authoritySummary: item.authorityDefault ?? 'Research & recommend only · No wallet authority',
    };
    dispatch({ type: 'ADD_WORKER', worker: w });
    if (item.pricing.type === 'paid') {
      const sub: BillingSubscription = {
        id: `sub-${installedWorkerId}`,
        name: item.name,
        type: 'community-worker',
        providerId: item.id,
        providerName: item.creatorName ?? 'Community',
        priceLabel: item.pricing.label ?? 'Paid',
        priceCentsMonthly: 0,
        cadence: 'monthly',
        status: 'active',
        nextChargeAt: new Date(Date.now() + 30 * 86400000),
        prototype: true,
      };
      dispatch({ type: 'ADD_BILLING_SUBSCRIPTION', subscription: sub });
    }
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'worker-added',
        title: `${item.name} added to your workforce`,
        summary: 'Research & recommend only · No wallet authority',
        workerId: installedWorkerId,
        workerName: item.name,
        timestamp: new Date(),
        status: 'complete',
      },
    });
    setAddedConfirm(true);
  }

  function handleCustomize() {
    dispatch({ type: 'SET_ACTIVE_DISCOVER_ITEM', id: null });
    dispatch({ type: 'SET_ACTIVE_CREATION', id: null });
    dispatch({ type: 'SET_CREATOR_SURFACE', surface: 'agent-builder' });
  }

  const evidenceItems = [
    item.jobsCompleted !== undefined && { label: 'Jobs completed', value: item.jobsCompleted.toLocaleString() },
    item.completionRate !== undefined && { label: 'Completion rate', value: `${item.completionRate}%` },
    item.medianResponse && { label: 'Median response', value: item.medianResponse },
    item.costAccuracy !== undefined && { label: 'Cost estimate accuracy', value: `${item.costAccuracy}%` },
    { label: 'Last updated', value: item.lastUpdated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
    { label: 'Version', value: item.version },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {showTry && (
        <SandboxTryPanel itemId={item.id} itemName={item.name} onClose={() => setShowTry(false)} />
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text mb-4 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" />
          </svg>
          Discover
        </button>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-panel-raised border border-border flex items-center justify-center shrink-0">
            <span className="text-sm font-mono font-semibold text-text-sub">{item.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h1 className="text-xl font-semibold text-text">{item.name}</h1>
              {item.isOriginal && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary border border-primary/30 rounded px-1.5 py-0.5">
                  Original
                </span>
              )}
              {item.type === 'capability' && item.capabilityClassification === 'execution-sensitive' && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-warn border border-warn/30 rounded px-1.5 py-0.5">
                  Execution-sensitive
                </span>
              )}
              {item.sponsored && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border rounded px-1.5 py-0.5">
                  Sponsored
                </span>
              )}
            </div>
            <p className="text-sm text-text-sub">{item.tagline}</p>
            <p className="text-xs text-text-muted mt-0.5">
              {item.isOriginal ? 'AgentPlace Original' : `by ${item.creatorName}`}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 max-w-2xl space-y-6">
          {/* Sponsored disclosure */}
          {item.sponsored && (
            <div className="bg-panel-raised border border-border-dim rounded-lg px-4 py-3">
              <p className="text-xs text-text-muted leading-relaxed">
                <span className="font-medium text-text-sub">Sponsored listing.</span> Sponsored placement affects Discover visibility only. It does not influence AgentPlace execution routing.
              </p>
            </div>
          )}

          {/* Execution-sensitive note */}
          {item.type === 'capability' && item.capabilityClassification === 'execution-sensitive' && (
            <div className="bg-panel-raised border border-warn/20 rounded-lg px-4 py-3">
              <p className="text-xs text-text-sub leading-relaxed">
                Connecting this capability does not grant it wallet authority. Actual execution still passes AgentPlace authority, wallet, risk, and Action Review rules.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-sm text-text-sub leading-relaxed">{item.description}</p>
          </div>

          {/* What it does / doesn't */}
          {item.type === 'worker' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {item.whatItDoes && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">What it does</p>
                  <ul className="space-y-1.5">
                    {item.whatItDoes.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-xs text-text-sub">
                        <span className="text-accent mt-0.5 shrink-0">✓</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.whatItDoesNot && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">What it does NOT do</p>
                  <ul className="space-y-1.5">
                    {item.whatItDoesNot.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-xs text-text-sub">
                        <span className="text-text-dim mt-0.5 shrink-0">—</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Workflow details */}
          {item.type === 'workflow' && (
            <div className="space-y-4">
              {item.workflowPurpose && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Purpose</p>
                  <p className="text-sm text-text-sub">{item.workflowPurpose}</p>
                </div>
              )}
              {item.workflowInputs && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Inputs</p>
                  <ul className="space-y-1">
                    {item.workflowInputs.map((i) => (
                      <li key={i} className="text-xs text-text-sub flex items-center gap-2"><span className="text-text-dim">·</span>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.workflowSteps && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Steps</p>
                  <ol className="space-y-1">
                    {item.workflowSteps.map((s, i) => (
                      <li key={s} className="text-xs text-text-sub flex items-center gap-2">
                        <span className="text-text-dim font-mono">{i + 1}.</span>{s}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {item.workflowOutputs && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Outputs</p>
                  <ul className="space-y-1">
                    {item.workflowOutputs.map((o) => (
                      <li key={o} className="text-xs text-text-sub flex items-center gap-2"><span className="text-text-dim">·</span>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.workflowCompatibleWorkers && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Compatible Workers</p>
                  <div className="flex gap-2 flex-wrap">
                    {item.workflowCompatibleWorkers.map((w) => (
                      <span key={w} className="text-xs text-text-sub border border-border rounded px-2 py-0.5">{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Authority default */}
          {item.authorityDefault && (
            <div className="border border-border-dim rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Authority default</p>
              <p className="text-sm text-text-sub">{item.authorityDefault}</p>
              {item.type === 'worker' && (
                <p className="text-xs text-text-dim mt-1">Financial authority is configured separately in Security & Authority.</p>
              )}
            </div>
          )}

          {/* Networks */}
          {item.networks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Networks</p>
              <div className="flex gap-1.5 flex-wrap">
                {item.networks.map((n) => (
                  <span key={n} className="text-xs font-mono text-text-muted bg-panel-raised border border-border-dim rounded px-2 py-0.5">{n}</span>
                ))}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Pricing</p>
            <p className="text-sm text-text-sub">
              {item.pricing.type === 'free' ? 'Free' : item.pricing.label ?? 'Paid'}
            </p>
          </div>

          {/* Empirical evidence */}
          {evidenceItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Evidence</p>
                <span className="text-[10px] text-text-dim border border-border-dim rounded px-1.5 py-0.5">Prototype data</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {evidenceItems.map(({ label, value }) => (
                  <div key={label} className="bg-panel-raised border border-border-dim rounded-lg px-3 py-2.5">
                    <p className="text-[10px] text-text-dim mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-text">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fork lineage */}
          {item.forkSourceName && (
            <div>
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Lineage</p>
              <p className="text-xs text-text-sub">Based on <span className="text-text">{item.forkSourceName}</span>{item.forkSourceCreator ? ` by ${item.forkSourceCreator}` : ''}</p>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-6 py-4 border-t border-border shrink-0">
        {addedConfirm ? (
          <div className="space-y-2">
            <div className="bg-accent-dim/20 border border-accent/20 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-accent mb-0.5">Worker added</p>
              <p className="text-xs text-text-sub">Authority: Research & recommend only · No permission to move funds.</p>
              <p className="text-xs text-text-dim mt-0.5">Financial authority is configured separately in Security & Authority.</p>
            </div>
            <button onClick={goBack} className="w-full py-2 text-sm text-text-sub border border-border rounded hover:bg-panel-raised transition-colors">
              Back to Discover
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {item.type === 'worker' && (
              <>
                <button
                  onClick={() => setShowTry(true)}
                  className="flex-1 py-2.5 text-sm border border-border rounded-lg text-text-sub hover:bg-panel-raised transition-colors"
                >
                  Try
                </button>
                {isAdded ? (
                  <span className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm text-accent border border-accent/20 rounded-lg bg-accent-dim/10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Added
                  </span>
                ) : (
                  <button
                    onClick={handleAdd}
                    disabled={acquiring}
                    className="flex-1 py-2.5 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-60"
                  >
                    {acquiring ? 'Acquiring…' : item.pricing.type === 'paid' ? 'Subscribe & Add' : 'Add Worker'}
                  </button>
                )}
              </>
            )}
            {item.type === 'workflow' && (
              <>
                <button
                  onClick={() => setShowTry(true)}
                  className="flex-1 py-2.5 text-sm border border-border rounded-lg text-text-sub hover:bg-panel-raised transition-colors"
                >
                  Try
                </button>
                <button className="flex-1 py-2.5 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors">
                  Use / Customize
                </button>
              </>
            )}
            {item.type === 'capability' && (
              <button className="flex-1 py-2.5 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors">
                Connect capability
              </button>
            )}
            {item.allowsCustomization && item.type === 'worker' && (
              <button
                onClick={handleCustomize}
                className="px-4 py-2.5 text-sm border border-border rounded-lg text-text-sub hover:bg-panel-raised transition-colors"
                title="Customize a copy"
              >
                Customize a copy
              </button>
            )}
          </div>
        )}
        {acquiring && (
          <p className="text-xs text-text-dim text-center mt-2">Prototype acquisition — no real charge.</p>
        )}
      </div>
    </div>
  );
}
