import { useState } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import type { BillingCostEntry, BillingSubscription } from '../state/types';

function fmt(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function paidByLabel(paidBy: BillingCostEntry['paidBy']): string {
  const map: Record<string, string> = {
    'service-balance': 'Service balance',
    'included-in-plan': 'Included',
    'user-wallet': 'Main Wallet',
    'agent-account': 'Agent Account',
    'covered-by-agentplace': 'Covered by AgentPlace',
    'external-subscription': 'External subscription',
  };
  return map[paidBy] ?? paidBy;
}

function categoryLabel(cat: BillingCostEntry['category']): string {
  const map: Record<string, string> = {
    'agentplace-service': 'AgentPlace runtime',
    'external-worker': 'External Worker',
    'external-capability': 'External capability/data',
    'external-provider': 'External provider',
    'onchain-gas': 'Onchain gas',
    'bridge-fee': 'Bridge fee',
    'protocol-fee': 'Protocol fee',
    'subscription': 'Subscription',
  };
  return map[cat] ?? cat;
}

function TopUpModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('20');
  const [method, setMethod] = useState<'card' | 'usdc'>('card');
  const [done, setDone] = useState(false);
  const dispatch = useDispatch();

  function handleTopUp() {
    const usd = parseFloat(amount) || 0;
    if (usd <= 0) return;
    dispatch({ type: 'UPDATE_BILLING_ACCOUNT', updates: { serviceBalanceUsd: 0 } }); // will be patched below
    // compute new balance
    const state_workaround = usd; // we dispatch an update — actual balance handled by reducer
    dispatch({ type: 'ADD_BILLING_COST_ENTRY', entry: {
      id: uid(),
      category: 'agentplace-service',
      amountUsd: -usd,
      description: `Service balance top-up · ${method === 'card' ? 'Visa •••• 4242' : 'USDC payment'}`,
      timestamp: new Date(),
      paidBy: method === 'usdc' ? 'user-wallet' : 'service-balance',
      prototype: true,
    }});
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-panel border border-border rounded-xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text">Top up service balance</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!done ? (
          <>
            <div className="bg-warn/5 border border-warn/20 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs font-medium text-warn">Prototype payment flow · No real charge</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-text-dim block mb-1.5">Amount (USD)</label>
                <div className="flex gap-2 mb-2">
                  {['10', '20', '50'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className={`flex-1 py-1.5 text-xs rounded border transition-colors ${amount === v ? 'border-primary text-primary bg-primary-dim/10' : 'border-border text-text-sub hover:bg-panel-raised'}`}
                    >
                      ${v}
                    </button>
                  ))}
                </div>
                <input
                  className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary/50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Custom amount"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-text-dim block mb-1.5">Payment method</label>
                <div className="space-y-2">
                  {(['card', 'usdc'] as const).map((m) => (
                    <label key={m} className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" checked={method === m} onChange={() => setMethod(m)} className="mt-0.5" />
                      <span className="text-sm text-text">
                        {m === 'card' ? 'Visa •••• 4242' : 'USDC · explicit payment from wallet'}
                      </span>
                    </label>
                  ))}
                </div>
                {method === 'usdc' && (
                  <p className="text-[10px] text-text-dim mt-2">
                    USDC payment is an explicit user action. AgentPlace will not withdraw from your Agent Account automatically.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2 border border-border text-text-sub text-sm rounded hover:bg-panel transition-colors">Cancel</button>
                <button
                  onClick={handleTopUp}
                  className="flex-1 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
                >
                  Top up ${amount}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-10 h-10 rounded-full bg-accent-dim/20 border border-accent/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-text mb-1">Prototype top-up recorded</p>
            <p className="text-xs text-text-muted mb-4">No real charge · Illustrative only</p>
            <button onClick={onClose} className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionRow({ sub }: { sub: BillingSubscription }) {
  const dispatch = useDispatch();
  const [showCancel, setShowCancel] = useState(false);

  function handleCancel() {
    dispatch({ type: 'UPDATE_BILLING_SUBSCRIPTION', subscriptionId: sub.id, updates: { status: 'pending-cancel', cancelledAt: new Date() } });
    setShowCancel(false);
  }

  return (
    <div className="border border-border rounded-lg bg-panel px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">{sub.name}</p>
          <p className="text-xs text-text-muted mt-0.5">{sub.providerName} · {sub.priceLabel}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${
              sub.status === 'active' ? 'border-accent/30 text-accent' :
              sub.status === 'pending-cancel' ? 'border-warn/30 text-warn' :
              'border-border text-text-muted'
            }`}>
              {sub.status === 'active' ? 'Active' : sub.status === 'pending-cancel' ? 'Cancelling' : 'Cancelled'}
            </span>
            {sub.nextChargeAt && sub.status === 'active' && (
              <span className="text-[10px] text-text-dim">Next: {sub.nextChargeAt.toLocaleDateString()}</span>
            )}
            {sub.status === 'pending-cancel' && sub.cancelledAt && (
              <span className="text-[10px] text-text-dim">Access remains until end of billing period</span>
            )}
          </div>
        </div>
        {sub.status === 'active' && sub.type !== 'agentplace-plan' && (
          <button
            onClick={() => setShowCancel(true)}
            className="text-xs text-text-muted border border-border rounded px-2.5 py-1 hover:text-danger hover:border-danger/30 transition-colors shrink-0"
          >
            Manage
          </button>
        )}
      </div>

      {showCancel && (
        <div className="mt-3 pt-3 border-t border-border-dim space-y-2">
          <p className="text-xs text-text-sub font-medium">Cancel {sub.name}?</p>
          <p className="text-xs text-text-muted">Access remains until the end of the current billing period. Cancelling a subscription does not revoke any wallet authority.</p>
          <div className="flex gap-2">
            <button onClick={handleCancel} className="px-3 py-1.5 text-xs bg-danger text-white rounded hover:opacity-90 transition-opacity">Cancel subscription</button>
            <button onClick={() => setShowCancel(false)} className="px-3 py-1.5 text-xs border border-border text-text-sub rounded hover:bg-panel-raised transition-colors">Keep</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CostEntryRow({ entry }: { entry: BillingCostEntry }) {
  const dispatch = useDispatch();

  function openLinked() {
    if (entry.jobId) dispatch({ type: 'SET_ACTIVE_JOB', id: entry.jobId });
    else if (entry.routineId) dispatch({ type: 'SET_ACTIVE_ROUTINE', id: entry.routineId });
  }

  const isLinked = !!(entry.jobId || entry.routineId);

  return (
    <div className="py-3 border-b border-border-dim last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-text-sub leading-relaxed">{entry.description}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-text-dim">{paidByLabel(entry.paidBy)}</span>
            <span className="text-[10px] text-text-dim">·</span>
            <span className="text-[10px] text-text-dim">{entry.timestamp.toLocaleDateString()}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono text-text">{fmt(entry.amountUsd)}</p>
          {isLinked && (
            <button onClick={openLinked} className="text-[10px] text-primary hover:underline mt-0.5">Open →</button>
          )}
        </div>
      </div>
    </div>
  );
}

type BillingTab = 'overview' | 'usage' | 'subscriptions' | 'controls' | 'history';

export function BillingUsageView() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [tab, setTab] = useState<BillingTab>('overview');
  const [showTopUp, setShowTopUp] = useState(false);

  if (!state.user) {
    return (
      <div className="h-full flex items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-base font-semibold text-text mb-2">Billing & Usage</h2>
          <p className="text-sm text-text-sub leading-relaxed mb-5">Sign in to see your plan, service balance, and usage.</p>
          <button
            onClick={() => dispatch({
              type: 'SET_IDENTITY_CHECKPOINT',
              checkpoint: { reason: 'billing', feature: 'view billing and usage', onComplete: (user) => dispatch({ type: 'SET_USER', user }) },
            })}
            className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const billing = state.billingAccount;
  const subs = state.billingSubscriptions ?? [];
  const entries = state.billingCostEntries ?? [];

  if (!billing) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">No billing data yet. Use Demo controls to load fixtures.</p>
      </div>
    );
  }

  const tabs: Array<{ id: BillingTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'usage', label: 'Usage' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'controls', label: 'Usage controls' },
    { id: 'history', label: 'Recent' },
  ];

  const spentPct = Math.min(100, (billing.variableSpendThisMonthUsd / billing.spendControls.monthlyVariableLimitUsd) * 100);
  const remaining = billing.spendControls.monthlyVariableLimitUsd - billing.variableSpendThisMonthUsd;

  // usage by category breakdown (excluding subscriptions)
  const categorySums: Record<string, number> = {};
  for (const e of entries) {
    if (e.category === 'subscription') continue;
    const label = e.category === 'agentplace-service' ? 'AgentPlace runtime'
      : e.category === 'onchain-gas' || e.category === 'bridge-fee' || e.category === 'protocol-fee' ? 'Onchain costs'
      : e.category === 'external-worker' ? 'External Workers'
      : 'External capabilities/data';
    categorySums[label] = (categorySums[label] ?? 0) + e.amountUsd;
  }
  const categoryRows = Object.entries(categorySums).sort((a, b) => b[1] - a[1]);
  const totalVariableService = categoryRows.reduce((s, [, v]) => s + v, 0);

  const routines = state.routines ?? [];
  const stableRoutine = routines.find((r) => r.id === 'rtn-stable-check');

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-6 pt-8 pb-0 shrink-0 border-b border-border">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-text tracking-tight">Billing & Usage</h1>
            <p className="text-sm text-text-sub mt-0.5">Service costs, spend controls, and subscriptions.</p>
          </div>
          <span className="text-[10px] font-mono text-text-dim border border-border rounded px-2 py-0.5">Prototype · illustrative</span>
        </div>
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px shrink-0 transition-colors ${tab === id ? 'border-primary text-text' : 'border-transparent text-text-sub hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl space-y-6">

          {tab === 'overview' && (
            <>
              {/* Separator note */}
              <div className="border border-border-dim rounded-lg bg-panel-raised px-4 py-3">
                <p className="text-xs text-text-muted leading-relaxed">
                  Your wallet and Agent Account funds are separate from AgentPlace service billing.{' '}
                  <button onClick={() => dispatch({ type: 'SET_VIEW', view: 'wallets' })} className="text-primary hover:underline">View Wallets →</button>
                </p>
              </div>

              {/* Plan */}
              <div className="border border-border rounded-lg bg-panel px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1">Current plan</p>
                    <p className="text-base font-semibold text-text">{billing.planName}</p>
                    <p className="text-xs text-text-muted mt-0.5">Prototype plan · pricing not final · renews {billing.billingPeriodEnd.toLocaleDateString()}</p>
                  </div>
                  <button className="text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors shrink-0">Change plan</button>
                </div>
              </div>

              {/* Service balance */}
              <div className="border border-border rounded-lg bg-panel px-5 py-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1">AgentPlace service balance</p>
                <p className="text-2xl font-semibold text-text mb-1">{fmt(billing.serviceBalanceUsd)}</p>
                <p className="text-xs text-text-muted mb-4">Used for AgentPlace runtime and variable external service costs where applicable. Your wallet and Agent Account crypto are separate.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowTopUp(true)} className="px-4 py-2 bg-primary text-white text-xs rounded font-medium hover:bg-primary-hover transition-colors">Top up</button>
                  <button className="px-4 py-2 border border-border text-text-sub text-xs rounded hover:bg-panel-raised transition-colors">Payment methods</button>
                </div>
              </div>

              {/* Variable spend */}
              <div className="border border-border rounded-lg bg-panel px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-0.5">Variable service spend this month</p>
                    <p className="text-xl font-semibold text-text">{fmt(billing.variableSpendThisMonthUsd)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-text-dim">Limit</p>
                    <p className="text-sm font-medium text-text-sub">{fmt(billing.spendControls.monthlyVariableLimitUsd)}</p>
                  </div>
                </div>
                <div className="h-1.5 bg-panel-raised rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${spentPct}%` }} />
                </div>
                <p className="text-xs text-text-muted">{fmt(remaining)} remaining · {billing.billingPeriodStart.toLocaleDateString()} – {billing.billingPeriodEnd.toLocaleDateString()}</p>
              </div>

              {/* Category breakdown */}
              <div className="border border-border rounded-lg bg-panel px-5 py-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Usage by category this month</p>
                {categoryRows.length === 0 ? (
                  <p className="text-xs text-text-muted">No usage recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {categoryRows.map(([label, amount]) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-text-sub">{label}</span>
                        <span className="text-text font-mono">{fmt(amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs border-t border-border-dim pt-2 mt-1">
                      <span className="text-text font-medium">Total</span>
                      <span className="text-text font-mono font-medium">{fmt(totalVariableService)}</span>
                    </div>
                    <p className="text-[10px] text-text-dim">Onchain costs paid from wallet are attributed for transparency but do not reduce service balance.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'usage' && (
            <>
              <div className="border border-border rounded-lg bg-panel px-5 py-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Usage by category this month</p>
                {categoryRows.length === 0 ? (
                  <p className="text-xs text-text-muted">No usage yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {categoryRows.map(([label, amount]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-text-sub">{label}</span>
                        <span className="text-text font-mono">{fmt(amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm border-t border-border-dim pt-2">
                      <span className="text-text font-semibold">Total variable service</span>
                      <span className="text-text font-mono font-semibold">{fmt(totalVariableService)}</span>
                    </div>
                    <p className="text-[10px] text-text-dim leading-relaxed">Onchain costs may have been paid directly from your wallet and are not deducted from service balance. Labels show which balance paid each cost.</p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg bg-panel px-5 py-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1">Service balance</p>
                <p className="text-xl font-semibold text-text mb-0.5">{fmt(billing.serviceBalanceUsd)}</p>
                <p className="text-xs text-text-muted">Your wallet and Agent Account funds are separate.</p>
              </div>
            </>
          )}

          {tab === 'subscriptions' && (
            <>
              {subs.length === 0 ? (
                <p className="text-sm text-text-muted py-8 text-center">No active subscriptions.</p>
              ) : (
                <div className="space-y-3">
                  {subs.map((sub) => <SubscriptionRow key={sub.id} sub={sub} />)}
                </div>
              )}
              <div className="border border-border-dim rounded-lg bg-panel-raised px-4 py-3">
                <p className="text-xs text-text-muted">
                  Subscriptions are service/marketplace access. They do not grant wallet authority. Mandates and Authority Grants are managed separately in{' '}
                  <button onClick={() => dispatch({ type: 'SET_VIEW', view: 'security' })} className="text-primary hover:underline">Security & Authority</button>.
                </p>
              </div>
            </>
          )}

          {tab === 'controls' && (
            <>
              {/* Monthly limit */}
              <div className="border border-border rounded-lg bg-panel px-5 py-4 space-y-4">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Monthly variable-service limit</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-semibold text-text">{fmt(billing.spendControls.monthlyVariableLimitUsd)}</p>
                      <p className="text-xs text-text-muted mt-0.5">Spent {fmt(billing.variableSpendThisMonthUsd)} · Remaining {fmt(remaining)}</p>
                    </div>
                    <button className="text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors">Edit</button>
                  </div>
                  <p className="text-[10px] text-text-dim mt-2 leading-relaxed">Reaching this limit may reduce available paid capabilities. It does not revoke wallet authority or change Agent Account permissions.</p>
                </div>
              </div>

              {/* Single-job threshold */}
              <div className="border border-border rounded-lg bg-panel px-5 py-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Single-job service cost threshold</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-semibold text-text">{fmt(billing.spendControls.singleJobThresholdUsd)}</p>
                    <p className="text-xs text-text-muted mt-0.5">Ask before a Job incurs more than this in variable service costs</p>
                  </div>
                  <button className="text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors">Edit</button>
                </div>
                <p className="text-[10px] text-text-dim mt-2 leading-relaxed">Applies to AgentPlace runtime, paid Workers, capabilities, and external providers. Does not apply to how much crypto a Worker may move — that is Authority.</p>
              </div>

              {/* Routine budgets */}
              <div className="border border-border rounded-lg bg-panel px-5 py-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Routine service budgets</p>
                {routines.filter((r) => r.serviceBudgetStructured).length === 0 ? (
                  <p className="text-xs text-text-muted">No structured routine budgets configured.</p>
                ) : (
                  <div className="space-y-3">
                    {routines.filter((r) => r.serviceBudgetStructured).map((routine) => {
                      const b = routine.serviceBudgetStructured!;
                      const pct = Math.min(100, (b.spentUsd / b.limitUsd) * 100);
                      return (
                        <div key={routine.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => dispatch({ type: 'SET_ACTIVE_ROUTINE', id: routine.id })}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {routine.title}
                            </button>
                            <span className="text-xs font-mono text-text">${fmt(b.limitUsd)}/month</span>
                          </div>
                          <div className="h-1.5 bg-panel-raised rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-text-muted">
                            <span>Spent {fmt(b.spentUsd)}</span>
                            <span>Remaining {fmt(b.limitUsd - b.spentUsd)}</span>
                          </div>
                          <p className="text-[10px] text-text-dim">Service budget · not capital authority</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-text-dim mt-3 leading-relaxed border-t border-border-dim pt-3">
                  Routine service budgets control AgentPlace/data service spend. They do not limit how much crypto a Routine may instruct a Worker to move — capital limits are set in the Mandate and Authority Grant.
                </p>
              </div>
            </>
          )}

          {tab === 'history' && (
            <>
              {entries.length === 0 ? (
                <p className="text-sm text-text-muted py-8 text-center">No usage recorded yet.</p>
              ) : (
                <div className="border border-border rounded-lg bg-panel px-4">
                  {entries.map((e) => <CostEntryRow key={e.id} entry={e} />)}
                </div>
              )}
              <p className="text-[10px] text-text-dim text-center">Prototype · illustrative values · no real charges</p>
            </>
          )}
        </div>
      </div>

      {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} />}
    </div>
  );
}
