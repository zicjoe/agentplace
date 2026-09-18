import { useState } from 'react';
import { useAppState, useDispatch, uid, triggerBridgeExecution } from '../state/AppContext';

const PERPS_ACTION_ID = '__perps-demo__';

const PERPS_ACTION = {
  id: PERPS_ACTION_ID,
  title: '2× ETH Long — Perpetual',
  actionType: 'perps' as const,
  economicEffect: '500 USDC collateral opens a ~1,000 USD notional ETH position at 2× leverage. P&L amplified in both directions.',
  rationale: 'User-requested leverage position on ETH. No autonomous authority covers perps — this requires your explicit approval.',
  authorityDecision: 'needs-approval' as const,
  authorityReason: 'No Authority Grant covers leveraged derivatives. Connected Wallet approval required for each perps position.',
  risks: [
    'At 2× leverage, a ~50% adverse move against your position triggers liquidation of the collateral.',
    'Perpetual funding rate: currently +0.01%/8h (longs pay shorts). Carrying cost matters for holds longer than days.',
    'Entry slippage estimate: 0.08–0.15% at this size on selected venue.',
    'Liquidation is immediate and irreversible. No recovery after the liquidation price is hit.',
  ],
  technicalDetails: {
    'Collateral': '500 USDC',
    'Leverage': '2×',
    'Notional exposure': '~1,000 USD ETH',
    'Entry estimate': '$1,980 – $2,020 (prototype)',
    'Liquidation estimate': '~$1,010 (−50% from entry)',
    'Funding rate': '+0.01% / 8h',
    'Max slippage': '0.2%',
    'Venue': 'GMX v2 · Arbitrum (prototype)',
    'Execution account': 'Main Wallet',
  },
  workerName: undefined,
  workerId: undefined,
  agentAccountId: undefined,
  walletId: 'wlt-main',
  grantId: undefined,
  mandateId: undefined,
  blockedReason: undefined,
  environment: 'mainnet' as const,
  amount: '500',
  asset: 'USDC',
  protocol: 'GMX v2',
  network: 'Arbitrum',
  status: 'pending-review' as const,
  createdAt: new Date(),
};

function DecisionBadge({ decision }: { decision: string }) {
  const config: Record<string, { label: string; bg: string; text: string; icon: 'check' | 'user' | 'block' | 'question' }> = {
    'within-mandate': { label: 'Within your mandate', bg: 'bg-accent-dim/20 border-accent/30', text: 'text-accent', icon: 'check' },
    'needs-approval': { label: 'Needs your approval', bg: 'bg-primary-dim/20 border-primary/30', text: 'text-primary', icon: 'user' },
    'blocked': { label: 'Blocked by your rules', bg: 'bg-danger/10 border-danger/30', text: 'text-danger', icon: 'block' },
    'needs-you': { label: 'Needs your decision', bg: 'bg-warn/10 border-warn/30', text: 'text-warn', icon: 'question' },
  };
  const c = config[decision] ?? config['needs-you'];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border ${c.bg}`}>
      <span className={`text-sm font-semibold ${c.text}`}>{c.label}</span>
    </div>
  );
}

export function ActionReview() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [showTechnical, setShowTechnical] = useState(false);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [showWalletSign, setShowWalletSign] = useState(false);
  const [walletSigned, setWalletSigned] = useState(false);

  const actionId = state.activeActionId;
  const isPerpsDemo = actionId === PERPS_ACTION_ID;

  const action = isPerpsDemo
    ? PERPS_ACTION
    : (state.financialActions ?? []).find((a) => a.id === actionId);

  function handleClose() {
    dispatch({ type: 'SET_ACTIVE_ACTION', id: null });
  }

  function handleApproveOnce() {
    if (!action || isPerpsDemo) {
      setApproved(true);
      return;
    }
    if (action.actionType === 'bridge') {
      setShowWalletSign(true);
      return;
    }
    dispatch({ type: 'UPDATE_FINANCIAL_ACTION', actionId: action.id, updates: { status: 'approved' } });
    if (action.status === 'pending-review') {
      dispatch({
        type: 'ADD_ACTIVITY_EVENT',
        event: {
          id: uid(),
          eventType: 'financial',
          title: action.title,
          summary: 'Approved once · Signed by wallet',
          workerId: action.workerId,
          workerName: action.workerName,
          actionId: action.id,
          timestamp: new Date(),
          status: 'complete',
        },
      });
    }
    // If this is a funding action, update the agent account balance
    if (action.actionType === 'fund' && action.agentAccountId && action.amount) {
      dispatch({
        type: 'UPDATE_AGENT_ACCOUNT',
        accountId: action.agentAccountId,
        updates: {
          totalBalance: `${action.amount} USDC`,
          availableBalance: `${action.amount} USDC`,
          deployedBalance: '0 USDC',
        },
      });
      dispatch({
        type: 'ADD_ACTIVITY_EVENT',
        event: {
          id: uid(),
          eventType: 'wallet',
          title: `Agent Account funded — ${action.amount} USDC`,
          summary: 'No Worker has authority over these funds yet',
          walletId: action.walletId,
          timestamp: new Date(),
          status: 'complete',
        },
      });
    }
    // Remove attention item if any
    const attentionItem = (state.attentionItems ?? []).find((i) => i.actionId === action.id);
    if (attentionItem) dispatch({ type: 'REMOVE_ATTENTION_ITEM', itemId: attentionItem.id });
    setApproved(true);
  }

  function handleReject() {
    if (!action || isPerpsDemo) {
      setRejected(true);
      return;
    }
    dispatch({ type: 'UPDATE_FINANCIAL_ACTION', actionId: action.id, updates: { status: 'rejected' } });
    const attentionItem = (state.attentionItems ?? []).find((i) => i.actionId === action.id);
    if (attentionItem) dispatch({ type: 'REMOVE_ATTENTION_ITEM', itemId: attentionItem.id });
    setRejected(true);
  }

  if (!action) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 backdrop-blur-sm">
        <div className="bg-panel border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-text-muted">Action not found</p>
          <button onClick={handleClose} className="mt-3 text-xs text-primary hover:underline">Close</button>
        </div>
      </div>
    );
  }

  const isBlocked = action.authorityDecision === 'blocked' || action.status === 'blocked';
  const isWithinMandate = action.authorityDecision === 'within-mandate';
  const needsApproval = action.authorityDecision === 'needs-approval';
  const isQuoteExpired = action.actionType === 'bridge' && state.scenario === 'quote-expired' && (action as any).quote && !(action as any).quote.expired;
  const isMaterialChange = !!(action as any).providerChangeNote && !approved && !rejected;
  const isStaleData = (action as any).dataQuality && ((action as any).dataQuality.status === 'stale' || (action as any).dataQuality.status === 'conflicting') && !approved && !rejected;
  const isWalletDisconnected = action.walletId && (state.wallets ?? []).find((w) => w.id === action.walletId)?.disconnected && !approved && !rejected && !isBlocked;
  const isUnsafe = isQuoteExpired || isMaterialChange || isStaleData || isWalletDisconnected;
  const fa = action as import('../state/types').FinancialAction;

  const grant = action.grantId
    ? (state.authorityGrants ?? []).find((g) => g.id === action.grantId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4 py-8">
      <div className="w-full max-w-lg bg-panel border border-border rounded-xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1">Action Review</p>
              <h2 className="text-sm font-semibold text-text">{action.title}</h2>
              <p className="text-xs text-text-muted font-mono mt-0.5">
                {state.environment === 'mainnet' ? 'Mainnet' : 'Testnet'} · {new Date(action.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button onClick={handleClose} className="text-text-muted hover:text-text p-1 rounded transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Post-action states */}
          {approved && (
            <div className="border border-accent/30 rounded-lg bg-accent-dim/10 px-4 py-4 text-center">
              <svg className="w-5 h-5 text-accent mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium text-text mb-1">Approved once.</p>
              <p className="text-xs text-text-sub">This approval applies only to this exact action. No future authority was created.</p>
              <p className="text-xs text-text-muted mt-2">Mock: In production, your wallet would sign the transaction now.</p>
              <button onClick={handleClose} className="mt-3 text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors">
                Return to work
              </button>
            </div>
          )}
          {rejected && (
            <div className="border border-border rounded-lg bg-panel-raised px-4 py-4 text-center">
              <p className="text-sm font-medium text-text mb-1">Rejected.</p>
              <p className="text-xs text-text-sub">Nothing was submitted. No funds moved.</p>
              <button onClick={handleClose} className="mt-3 text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors">
                Return to work
              </button>
            </div>
          )}

          {!approved && !rejected && (
            <>
              {/* 1. What will happen */}
              <section>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">What will happen</p>
                <p className="text-sm text-text leading-relaxed">{action.economicEffect}</p>
              </section>

              {/* 2. Why */}
              <section>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Why</p>
                <p className="text-sm text-text-sub leading-relaxed">{action.rationale}</p>
              </section>

              {/* 3. Is it allowed */}
              <section>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Authority</p>
                <DecisionBadge decision={action.authorityDecision} />
                <p className="text-xs text-text-sub mt-2 leading-relaxed">{action.authorityReason}</p>

                {isBlocked && (
                  <div className="mt-3 border border-danger/30 rounded-lg bg-danger/5 px-4 py-3">
                    <p className="text-sm font-semibold text-danger mb-1">Nothing was submitted. No funds moved.</p>
                    {action.blockedReason && (
                      <p className="text-xs text-text-sub leading-relaxed">{action.blockedReason}</p>
                    )}
                  </div>
                )}

                {isWithinMandate && grant && (
                  <div className="mt-3 border border-border-dim rounded bg-panel-raised px-3 py-2.5 space-y-1 text-xs">
                    {[
                      ['Amount', `${action.amount} ${action.asset}`],
                      ['Per-action limit', grant.singleActionLimit],
                      ['Managed-capital limit', grant.totalManagedCapital],
                      ['Protocol', `${action.protocol ?? '—'} · allowed`],
                      ['Network', `${action.network ?? '—'} · allowed`],
                      ['Borrowing', grant.borrowingAllowed ? 'Allowed' : 'None'],
                      ['Leverage', grant.leverageAllowed ? 'Allowed' : 'None'],
                      ['Decision', 'Authorized by your mandate'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-text-muted">{k}</span>
                        <span className={`text-text-sub ${k === 'Decision' ? 'text-accent font-medium' : ''}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 4. What could go wrong */}
              {action.risks.length > 0 && (
                <section>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">What could go wrong</p>
                  <ul className="space-y-1.5">
                    {action.risks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-text-dim shrink-0 mt-1.5" />
                        <p className="text-xs text-text-sub leading-relaxed">{risk}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 5. Technical details (collapsible) */}
              {Object.keys(action.technicalDetails ?? {}).length > 0 && (
                <section>
                  <button
                    onClick={() => setShowTechnical((v) => !v)}
                    className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-dim hover:text-text-muted transition-colors"
                  >
                    Technical details
                    <svg
                      className={`w-3 h-3 transition-transform ${showTechnical ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showTechnical && (
                    <div className="mt-2 border border-border-dim rounded bg-panel-raised px-3 py-2.5 space-y-1 text-xs font-mono">
                      {Object.entries(action.technicalDetails ?? {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <span className="text-text-muted">{k}</span>
                          <span className="text-text-sub text-right">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* Material provider change notice */}
        {!approved && !rejected && isMaterialChange && (
          <div className="px-5 py-5 space-y-4 border-t border-border shrink-0">
            <div className="border border-warn/40 rounded-lg bg-warn/5 px-4 py-4 space-y-2.5">
              <p className="text-sm font-semibold text-warn">Route changed materially</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <p className="text-text-dim font-mono uppercase tracking-wider text-[10px]">Previous</p>
                  <p className="text-text-muted">Received: {fa.previousQuote?.minimumReceive ?? '498.50 USDC'}</p>
                  <p className="text-text-muted">Cost: {fa.previousQuote?.estimatedTotalCost ?? '~1.08 USDC'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-text-dim font-mono uppercase tracking-wider text-[10px]">Current</p>
                  <p className="text-text">Received: {fa.quote?.minimumReceive ?? '497.60 USDC'}</p>
                  <p className="text-text">Cost: {fa.quote?.estimatedTotalCost ?? '~2.35 USDC'}</p>
                </div>
              </div>
              <p className="text-xs text-text-muted">Terms changed from previous quote. Previous approval is invalidated.</p>
            </div>
            <div className="space-y-1">
              {[
                ['What happened', 'Original provider became unavailable.'],
                ['Affected', 'Fallback route falls outside your approved economic terms.'],
                ['Still safe', 'Nothing has been submitted under the changed route.'],
                ['AgentPlace', 'Holding the Job until you review the new terms.'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 text-xs">
                  <span className="text-text-dim w-28 shrink-0">{k}</span>
                  <span className="text-text-sub">{v}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                dispatch({ type: 'UPDATE_FINANCIAL_ACTION', actionId: action.id, updates: { providerChangeNote: undefined } });
                dispatch({ type: 'SET_SCENARIO', scenario: 'normal' });
              }}
              className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Review updated action
            </button>
            <button onClick={handleClose} className="w-full py-2 text-xs text-text-muted hover:text-text transition-colors">Cancel Job</button>
          </div>
        )}

        {/* Stale / conflicting data notice */}
        {!approved && !rejected && isStaleData && !isMaterialChange && (
          <div className="px-5 py-5 space-y-4 border-t border-border shrink-0">
            <div className="border border-warn/30 rounded-lg bg-warn/5 px-4 py-4">
              <p className="text-sm font-semibold text-warn mb-2">Market data needs refresh</p>
              <div className="space-y-1.5">
                {[
                  ['What happened', fa.dataQuality!.summary],
                  ['Affected', fa.dataQuality!.affectedFields?.join(', ') ?? 'Entry price, Liquidation estimate'],
                  ['Still safe', 'Nothing was submitted. No funds moved.'],
                  ['AgentPlace', 'Waiting for fresh, consistent data.'],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-xs">
                    <span className="text-text-dim w-28 shrink-0">{k}</span>
                    <span className="text-text-sub">{v}</span>
                  </div>
                ))}
              </div>
              {fa.dataQuality?.sources && (
                <div className="mt-2 space-y-0.5">
                  {fa.dataQuality.sources.map((s) => (
                    <p key={s} className="text-[10px] font-mono text-text-dim">{s}</p>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => {
                const refreshedAt = new Date();
                dispatch({
                  type: 'UPDATE_FINANCIAL_ACTION',
                  actionId: action.id,
                  updates: {
                    dataQuality: { status: 'fresh', summary: 'Price data refreshed and sources now agree.', lastUpdatedAt: refreshedAt },
                    technicalDetails: {
                      ...action.technicalDetails,
                      'Entry estimate': '$3,264.50 (refreshed)',
                      'Liquidation estimate': '~$1,632 (−50% from entry)',
                      'Data status': 'Fresh · sources agree',
                    },
                  },
                });
                dispatch({ type: 'SET_SCENARIO', scenario: 'normal' });
              }}
              className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Refresh market data
            </button>
            <button onClick={handleClose} className="w-full py-2 text-xs text-text-muted hover:text-text transition-colors">Cancel</button>
          </div>
        )}

        {/* Wallet disconnected notice */}
        {!approved && !rejected && isWalletDisconnected && !isMaterialChange && !isStaleData && !isQuoteExpired && (
          <div className="px-5 py-5 space-y-4 border-t border-border shrink-0">
            <div className="border border-warn/30 rounded-lg bg-warn/5 px-4 py-4">
              <p className="text-sm font-semibold text-warn mb-2">Main Wallet disconnected</p>
              <div className="space-y-1.5">
                {[
                  ['What happened', 'The signing session ended before this action was signed.'],
                  ['Affected', 'This action cannot proceed until the wallet is reconnected.'],
                  ['Still safe', 'Nothing was submitted. No funds moved.'],
                  ['AgentPlace', 'Holding the prepared action.'],
                  ['You need to', 'Reconnect Main Wallet to continue.'],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-xs">
                    <span className="text-text-dim w-28 shrink-0">{k}</span>
                    <span className="text-text-sub">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                dispatch({ type: 'UPDATE_WALLET', walletId: action.walletId!, updates: { disconnected: false } });
                dispatch({ type: 'SET_SCENARIO', scenario: 'normal' });
              }}
              className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Reconnect Main Wallet
            </button>
            <button onClick={handleClose} className="w-full py-2 text-xs text-text-muted hover:text-text transition-colors">Close</button>
          </div>
        )}

        {/* Quote expired footer */}
        {!approved && !rejected && isQuoteExpired && !isMaterialChange && (
          <div className="px-5 py-5 space-y-4 border-t border-border shrink-0">
            <div className="border border-warn/30 rounded-lg bg-warn/5 px-4 py-4">
              <p className="text-sm font-semibold text-warn mb-1">Quote expired</p>
              <p className="text-xs text-text-sub leading-relaxed">The economic terms of this action are no longer current. A fresh quote will revalidate the route, provider, simulation, authority, and risk before you can approve.</p>
              {fa.quote && (
                <div className="mt-2 space-y-0.5 text-xs text-text-muted font-mono">
                  <p>Previously: {fa.quote?.estimatedReceive} · {fa.quote?.estimatedTotalCost}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                const now = new Date();
                const newExpiry = new Date(now.getTime() + 5 * 60 * 1000);
                dispatch({
                  type: 'UPDATE_FINANCIAL_ACTION',
                  actionId: action.id,
                  updates: {
                    previousQuote: fa.quote,
                    quote: {
                      ...fa.quote!,
                      quotedAt: now,
                      expiresAt: newExpiry,
                      expired: false,
                      estimatedReceive: '498.61 USDC',
                      minimumReceive: '498.40 USDC',
                      estimatedTotalCost: '~1.29 USDC',
                      provider: fa.quote!.provider,
                    },
                  },
                });
                dispatch({ type: 'SET_SCENARIO', scenario: 'normal' });
              }}
              className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Refresh action
            </button>
            <button onClick={handleClose} className="w-full py-2 text-xs text-text-muted hover:text-text transition-colors">
              Cancel
            </button>
          </div>
        )}

        {/* Refreshed terms notice (after quote refresh shows changed terms) */}
        {!approved && !rejected && !isQuoteExpired && fa.previousQuote && !isMaterialChange && (
          <div className="px-5 pb-1">
            <div className="border border-border-dim rounded bg-panel-raised px-3 py-2.5">
              <p className="text-[10px] font-mono text-text-dim mb-1.5">Terms changed after previous quote expired</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                <div>Previous: {fa.previousQuote.estimatedReceive} · {fa.previousQuote.estimatedTotalCost}</div>
                <div>Current: {fa.quote?.estimatedReceive} · {fa.quote?.estimatedTotalCost}</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions footer */}
        {!approved && !rejected && !isUnsafe && (
          <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
            {isBlocked && (
              <>
                <button
                  onClick={() => dispatch({ type: 'SET_VIEW', view: 'security' })}
                  className="w-full py-2.5 text-sm font-medium text-text-sub border border-border rounded hover:bg-panel hover:text-text transition-colors"
                >
                  Review authority
                </button>
                <button onClick={handleClose} className="w-full py-2 text-xs text-text-muted hover:text-text transition-colors">
                  Close
                </button>
              </>
            )}

            {isWithinMandate && !isBlocked && (
              <>
                <p className="text-xs text-text-sub text-center leading-relaxed">
                  Stablecoin Manager is permitted to execute this action under the rules you approved.
                </p>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 text-sm font-medium border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
                >
                  Back to work
                </button>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => { dispatch({ type: 'SET_AUTONOMOUS_EXECUTION_PAUSED', paused: true }); handleClose(); }}
                    className="text-xs text-text-dim hover:text-text-muted transition-colors"
                  >
                    Pause autonomous execution
                  </button>
                  <button
                    onClick={() => { handleClose(); dispatch({ type: 'SET_VIEW', view: 'security' }); }}
                    className="text-xs text-text-dim hover:text-text-muted transition-colors"
                  >
                    Review mandate
                  </button>
                </div>
              </>
            )}

            {needsApproval && !isBlocked && (
              <>
                <button
                  onClick={handleApproveOnce}
                  className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
                >
                  Approve once — continue to wallet
                </button>
                <button
                  onClick={handleReject}
                  className="w-full py-2.5 text-sm font-medium border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
                >
                  Reject
                </button>
                <div className="flex justify-center">
                  <button
                    onClick={() => dispatch({ type: 'SET_VIEW', view: 'security' })}
                    className="text-xs text-text-dim hover:text-text-muted transition-colors"
                  >
                    Review future authority
                  </button>
                </div>
                <p className="text-[10px] text-text-dim text-center">
                  Approving once authorizes only this exact action. No future authority is created.
                </p>
              </>
            )}

            {action.authorityDecision === 'needs-you' && !isBlocked && (
              <>
                <button
                  onClick={handleApproveOnce}
                  className="w-full py-2.5 text-sm font-medium bg-warn text-white rounded hover:bg-warn/90 transition-colors"
                >
                  Proceed with decision
                </button>
                <button
                  onClick={handleReject}
                  className="w-full py-2.5 text-sm font-medium border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
                >
                  Decline
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showWalletSign && !walletSigned && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/90 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-panel border border-border rounded-xl px-5 py-6">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Wallet · Sign transaction</p>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-dim flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">MW</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-text">Main Wallet</p>
                <p className="text-xs text-text-muted">Sign bridge action</p>
              </div>
            </div>
            <div className="border border-border rounded-lg bg-panel-raised px-4 py-3 mb-5">
              <p className="text-xs text-text-muted mb-1">Transaction</p>
              <p className="text-sm font-medium text-text">500 USDC</p>
              <p className="text-xs text-text-sub">Arbitrum → Base</p>
              <p className="text-[10px] font-mono text-text-dim mt-1.5">Mainnet</p>
            </div>
            <p className="text-[10px] text-text-dim mb-4 text-center">Prototype · simulated wallet signing</p>
            <button
              onClick={() => {
                setWalletSigned(true);
                const bridgeJob = (state.jobs ?? []).find((j) => j.actionId === action?.id && j.kind === 'financial');
                if (bridgeJob && action) {
                  const originConvId = bridgeJob.originConversationId ?? '';
                  setTimeout(() => {
                    dispatch({ type: 'SET_ACTIVE_ACTION', id: null });
                    dispatch({ type: 'SET_ACTIVE_JOB', id: bridgeJob.id });
                    triggerBridgeExecution(dispatch, action.id, bridgeJob.id, originConvId, state.scenario);
                  }, 800);
                }
              }}
              className="w-full py-2.5 text-sm font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Sign
            </button>
          </div>
        </div>
      )}

      {showWalletSign && walletSigned && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/90 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-panel border border-border rounded-xl px-5 py-6 text-center">
            <svg className="w-6 h-6 text-accent mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-semibold text-text mb-1">Signed</p>
            <p className="text-xs text-text-sub">Returning to job…</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Exported helper for perps demo ────────────────────────────────────────────

export { PERPS_ACTION_ID };
