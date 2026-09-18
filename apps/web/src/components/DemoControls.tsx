import { useAppState, useDispatch, createBlockedMandateAction, triggerWalletDisconnected, createPartialFailureJob, triggerRoutineLimited, triggerProviderMaterialChange, triggerAuthorityExpiredDuringWork, triggerStaleConflictingData } from '../state/AppContext';
import type { Scenario } from '../state/types';

const SCENARIOS: Array<{ id: Scenario; label: string; desc: string }> = [
  { id: 'normal', label: 'Normal', desc: 'All systems operating' },
  { id: 'quote-expired', label: 'Quote expired', desc: 'Bridge quote expired before approval' },
  { id: 'provider-degraded', label: 'Provider degraded', desc: 'One provider degraded, harmless fallback' },
  { id: 'partial-failure', label: 'Partial failure', desc: 'Partial reallocation, funds in intermediate' },
  { id: 'blocked-mandate', label: 'Blocked by mandate', desc: 'Action blocked — no funds moved' },
  { id: 'wallet-disconnected', label: 'Wallet disconnected', desc: 'Connected wallet disconnected' },
  { id: 'routine-limited', label: 'Routine limited', desc: 'Routine limited after repeated failure' },
  { id: 'verification-delayed', label: 'Verification delayed', desc: 'Outcome verification in progress' },
  { id: 'proof-anchor-pending', label: 'Proof anchor pending', desc: 'Arbitrum proof pending post-completion' },
  { id: 'transaction-status-unknown', label: 'Transaction status unknown', desc: 'RPC timeout after broadcast — checking whether original transaction reached the network.' },
  { id: 'provider-material-change', label: 'Provider change · review required', desc: 'Fallback terms worsen outside approved envelope — fresh approval needed, nothing submitted.' },
  { id: 'authority-expired-during-work', label: 'Authority expired during work', desc: 'Stablecoin Manager authority expired before execution — job held, nothing submitted.' },
  { id: 'stale-conflicting-data', label: 'Stale / conflicting data', desc: 'Perps price sources disagree — approval unavailable until fresh consistent data confirmed.' },
];

export function DemoControls() {
  const state = useAppState();
  const dispatch = useDispatch();

  function close() {
    dispatch({ type: 'TOGGLE_DEMO' });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-6"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="w-80 bg-panel border border-border rounded-xl shadow-2xl overflow-hidden"
        style={{ pointerEvents: 'all' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border-dim bg-panel-raised flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-warn" />
            <span className="text-xs font-mono font-medium text-text-sub uppercase tracking-wider">
              Demo Controls
            </span>
          </div>
          <button
            onClick={close}
            className="text-text-muted hover:text-text p-1 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* State resets */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
              State
            </p>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  dispatch({ type: 'RESET_GUEST' });
                  close();
                }}
                className="w-full text-left px-3 py-2 rounded bg-panel-raised border border-border text-xs text-text-sub hover:text-text hover:border-border transition-colors"
              >
                Reset to brand-new Guest
              </button>
              <button
                onClick={() => {
                  dispatch({ type: 'RESET_ACTIVE' });
                  close();
                }}
                className="w-full text-left px-3 py-2 rounded bg-panel-raised border border-border text-xs text-text-sub hover:text-text hover:border-border transition-colors"
              >
                Reset to signed-in active user
              </button>
            </div>
          </div>

          {/* Environment */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
              Environment
            </p>
            <div className="flex gap-2">
              {(['mainnet', 'testnet'] as const).map((env) => (
                <button
                  key={env}
                  onClick={() => dispatch({ type: 'SET_ENV', env })}
                  className={`flex-1 px-3 py-2 rounded border text-xs font-medium transition-colors ${
                    state.environment === env
                      ? env === 'mainnet'
                        ? 'border-accent/40 bg-accent-dim/20 text-accent'
                        : 'border-warn/40 bg-warn/10 text-warn'
                      : 'border-border text-text-muted hover:text-text hover:bg-panel-raised'
                  }`}
                >
                  {env === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </button>
              ))}
            </div>
          </div>

          {/* Scenarios */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
              Scenario
            </p>
            <div className="space-y-1">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => {
                    dispatch({ type: 'SET_SCENARIO', scenario: scenario.id });
                    if (scenario.id === 'blocked-mandate') {
                      createBlockedMandateAction(dispatch);
                    } else if (scenario.id === 'wallet-disconnected') {
                      triggerWalletDisconnected(dispatch);
                    } else if (scenario.id === 'partial-failure') {
                      createPartialFailureJob(dispatch);
                    } else if (scenario.id === 'routine-limited') {
                      triggerRoutineLimited(dispatch);
                    } else if (scenario.id === 'provider-material-change') {
                      triggerProviderMaterialChange(dispatch);
                    } else if (scenario.id === 'authority-expired-during-work') {
                      triggerAuthorityExpiredDuringWork(dispatch);
                    } else if (scenario.id === 'stale-conflicting-data') {
                      triggerStaleConflictingData(dispatch);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                    state.scenario === scenario.id
                      ? 'border-primary/40 bg-primary-dim/20 text-primary'
                      : 'border-border text-text-muted hover:text-text hover:bg-panel-raised border-transparent'
                  }`}
                >
                  <div className="text-xs font-medium">{scenario.label}</div>
                  <div className="text-[10px] text-text-dim mt-0.5">{scenario.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Current state summary */}
          <div className="border-t border-border-dim pt-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">
              Current state
            </p>
            <div className="space-y-1 font-mono text-[10px] text-text-muted">
              <div className="flex justify-between">
                <span>User</span>
                <span className="text-text-sub">{state.user ? state.user.name : 'Guest'}</span>
              </div>
              <div className="flex justify-between">
                <span>Environment</span>
                <span className="text-text-sub">{state.environment}</span>
              </div>
              <div className="flex justify-between">
                <span>Conversations</span>
                <span className="text-text-sub">{state.conversations.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Workers</span>
                <span className="text-text-sub">{state.workers.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Wallets</span>
                <span className="text-text-sub">{(state.wallets ?? []).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Agent Accounts</span>
                <span className="text-text-sub">{(state.agentAccounts ?? []).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Grants</span>
                <span className="text-text-sub">{(state.authorityGrants ?? []).filter(g => g.status === 'active').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Actions</span>
                <span className="text-text-sub">{(state.financialActions ?? []).filter(a => a.status === 'pending-review').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Scenario</span>
                <span className="text-text-sub">{state.scenario}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border-dim px-4 py-2.5">
          <p className="text-[10px] text-text-dim text-center">
            Triple-click the AgentPlace logo to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
