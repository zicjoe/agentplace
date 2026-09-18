import { useState } from 'react';
import { useAppState, useDispatch, uid } from '../state/AppContext';
import type { AuthorityGrant } from '../state/types';

type EnvFilter = 'all' | 'mainnet' | 'testnet';

function RevokeConfirmModal({ grant, onClose }: { grant: AuthorityGrant; onClose: () => void }) {
  const dispatch = useDispatch();

  function confirm() {
    dispatch({ type: 'REVOKE_AUTHORITY_GRANT', grantId: grant.id });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'security',
        title: `${grant.workerName} authority revoked`,
        summary: `Main Agent Account · ${grant.environment === 'mainnet' ? 'Mainnet' : 'Testnet'}`,
        effect: 'New autonomous financial actions stopped. Research and monitoring continue.',
        workerName: grant.workerName,
        workerId: grant.workerId,
        grantId: grant.id,
        timestamp: new Date(),
        status: 'complete',
      },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-panel border border-border rounded-xl p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-text mb-3">Revoke {grant.workerName} authority?</h3>
        <div className="space-y-2 mb-4">
          <div>
            <p className="text-xs font-medium text-text-sub mb-1">This stops:</p>
            <ul className="space-y-0.5">
              {['New autonomous financial actions using this grant', 'Future financial steps requiring this grant'].map((s) => (
                <li key={s} className="text-xs text-danger flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-danger shrink-0" />{s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-text-sub mb-1">This continues:</p>
            <ul className="space-y-0.5">
              {['Worker research and monitoring', 'Recommendations', 'Historical Jobs and receipts'].map((s) => (
                <li key={s} className="text-xs text-accent flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent shrink-0" />{s}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-text-muted">This does not remove {grant.workerName}, delete Routines, or reverse submitted transactions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors">Cancel</button>
          <button onClick={confirm} className="flex-1 py-2 text-sm font-medium bg-danger text-white rounded hover:opacity-90 transition-opacity">Revoke authority</button>
        </div>
      </div>
    </div>
  );
}

function RevokeAllModal({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch();

  function confirm() {
    dispatch({ type: 'REVOKE_ALL_AUTHORITY' });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4 overflow-y-auto py-8">
      <div className="w-full max-w-sm bg-panel border border-danger/40 rounded-xl p-5 shadow-2xl my-auto">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-danger shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-danger">Revoke all AgentPlace authority</h3>
        </div>
        <div className="space-y-3 mb-4">
          <div>
            <p className="text-xs font-medium text-text-sub mb-1">This stops:</p>
            <ul className="space-y-0.5">
              {[
                'All new autonomous financial actions using standing AgentPlace authority',
                'Workers from using existing Authority Grants',
                'Routines from using standing financial authority',
              ].map((s) => (
                <li key={s} className="text-xs text-danger flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-danger shrink-0 mt-1" />{s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-text-sub mb-1">This continues:</p>
            <ul className="space-y-0.5">
              {[
                'Research and monitoring',
                'Recommendations',
                'Connected Wallet actions you explicitly approve',
                'Historical Jobs and receipts',
                'Wallet ownership and withdrawals',
              ].map((s) => (
                <li key={s} className="text-xs text-accent flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent shrink-0 mt-1" />{s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-panel-raised border border-border-dim rounded px-3 py-2">
            <p className="text-xs text-text-muted font-medium mb-1">This does NOT:</p>
            <ul className="space-y-0.5 text-xs text-text-muted">
              {['Disconnect your wallets', 'Remove Workers or Routines', 'Delete history', 'Reverse submitted blockchain transactions'].map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors">Cancel</button>
          <button onClick={confirm} className="flex-1 py-2 text-sm font-semibold bg-danger text-white rounded hover:opacity-90 transition-opacity">Revoke all authority</button>
        </div>
      </div>
    </div>
  );
}

function StopExecutionModal({ onClose }: { onClose: () => void }) {
  const dispatch = useDispatch();

  function confirm() {
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'security',
        title: 'Future execution steps stop requested',
        summary: 'Emergency control · Cancellable future steps stopped where possible',
        effect: 'Already-submitted blockchain transactions cannot be reversed.',
        timestamp: new Date(),
        status: 'complete',
      },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-panel border border-border rounded-xl p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-text mb-3">Stop safely cancellable future execution steps?</h3>
        <div className="space-y-2 mb-4 text-xs text-text-sub leading-relaxed">
          <p>AgentPlace will stop unsubmitted or cancellable future steps in in-progress Jobs where possible.</p>
          <p className="text-text-muted">Already-submitted blockchain transactions cannot be reversed. This does not stop research or monitoring unless you also pause them.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors">Cancel</button>
          <button onClick={confirm} className="flex-1 py-2 text-sm font-medium bg-warn text-white rounded hover:opacity-90 transition-opacity">Stop future steps</button>
        </div>
      </div>
    </div>
  );
}

function GrantCard({ grant, isPausedGlobally }: { grant: AuthorityGrant; isPausedGlobally: boolean }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [showRevoke, setShowRevoke] = useState(false);

  const isRevoked = grant.status === 'revoked';
  const isExpired = grant.status === 'expired';
  const isActive = grant.status === 'active';
  const account = (state.agentAccounts ?? []).find((a) => a.id === grant.agentAccountId);

  const executionPaused = isPausedGlobally && isActive;

  const statusLabel = isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active authority';
  const statusColor = isRevoked ? 'text-danger border-danger/30' : isExpired ? 'text-text-dim border-border' : 'text-accent border-accent/30';

  const daysUntilExpiry = Math.ceil((new Date(grant.expiry).getTime() - Date.now()) / 86400000);
  const expiresSoon = isActive && daysUntilExpiry < 30 && daysUntilExpiry > 0;

  return (
    <>
      <div className={`border rounded-lg bg-panel px-5 py-4 ${isRevoked || isExpired ? 'border-border-dim opacity-60' : expiresSoon ? 'border-warn/30' : 'border-border'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-text">{grant.workerName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-text-muted">{account?.name ?? grant.agentAccountId}</p>
              <span className="text-[10px] font-mono border border-border rounded px-1.5 py-0.5 text-text-dim">{grant.environment === 'mainnet' ? 'Mainnet' : 'Testnet'}</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${statusColor}`}>{statusLabel}</span>
            {executionPaused && (
              <p className="text-[10px] font-mono text-warn mt-0.5">Execution: Paused globally</p>
            )}
          </div>
        </div>

        <div className="space-y-1 text-xs mb-3">
          {[
            ['Managed capital', grant.totalManagedCapital],
            ['Per-action limit', grant.singleActionLimit],
            ['Networks', grant.networks.join(' · ')],
            ['Protocols', grant.allowedProtocols.join(' · ')],
            ['Actions', grant.allowedActions.join(' · ')],
            ['Borrowing', grant.borrowingAllowed ? 'Allowed' : 'Not allowed'],
            ['Leverage', grant.leverageAllowed ? 'Allowed' : 'Not allowed'],
            ['Expires', new Date(grant.expiry).toLocaleDateString()],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-text-muted">{k}</span>
              <span className="text-text-sub">{v}</span>
            </div>
          ))}
        </div>

        {expiresSoon && (
          <div className="bg-warn/5 border border-warn/20 rounded px-3 py-2 mb-3">
            <p className="text-xs text-warn">{grant.workerName} authority expires in {daysUntilExpiry} days.</p>
            <div className="flex gap-2 mt-2">
              <button className="text-xs text-primary border border-primary/30 rounded px-2.5 py-1 hover:bg-primary-dim/20 transition-colors">Review</button>
              <button className="text-xs text-text-sub border border-border rounded px-2.5 py-1 hover:bg-panel-raised transition-colors">Renew authority</button>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-panel-raised border border-border-dim rounded px-3 py-2 mb-3">
            <p className="text-xs text-text-muted">Authority expired. Cannot execute. Worker and Routines remain. History preserved.</p>
            <button className="text-xs text-primary hover:underline mt-1">Review authority</button>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {!isRevoked && !isExpired && (
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: grant.workerId })}
              className="text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors"
            >
              Open {grant.workerName}
            </button>
          )}
          {isActive && (
            <button
              onClick={() => setShowRevoke(true)}
              className="text-xs text-danger border border-danger/20 rounded px-3 py-1.5 hover:bg-danger/10 transition-colors"
            >
              Revoke
            </button>
          )}
        </div>
      </div>

      {showRevoke && <RevokeConfirmModal grant={grant} onClose={() => setShowRevoke(false)} />}
    </>
  );
}



export function SecurityAuthorityView() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showRevokeAll, setShowRevokeAll] = useState(false);
  const [showStopExecution, setShowStopExecution] = useState(false);
  const [envFilter, setEnvFilter] = useState<EnvFilter>('all');

  if (!state.user) {
    return (
      <div className="h-full flex items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-base font-semibold text-text mb-2">Security & Authority</h2>
          <p className="text-sm text-text-sub leading-relaxed mb-5">Sign in to see and manage what power you have given AgentPlace.</p>
          <button
            onClick={() => dispatch({
              type: 'SET_IDENTITY_CHECKPOINT',
              checkpoint: { reason: 'sign-in', feature: 'manage authority and security settings', onComplete: (user) => dispatch({ type: 'SET_USER', user }) },
            })}
            className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const allGrants = state.authorityGrants ?? [];
  const filteredGrants = envFilter === 'all' ? allGrants : allGrants.filter((g) => g.environment === envFilter);
  const activeGrants = filteredGrants.filter((g) => g.status === 'active');
  const revokedOrExpiredGrants = filteredGrants.filter((g) => g.status === 'revoked' || g.status === 'expired');
  const wallets = state.wallets ?? [];
  const isPaused = state.autonomousExecutionPaused;

  const totalManagedCapital = activeGrants.length > 0
    ? activeGrants.map((g) => g.totalManagedCapital).join(' + ')
    : '0 USDC';

  const blockedActions = (state.financialActions ?? [])
    .filter((a) => a.status === 'blocked')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const securityEvents = (state.activityEvents ?? [])
    .filter((e) => e.eventType === 'security' || e.eventType === 'authority')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  function timeAgo(d: Date) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  }

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-6 pt-8 pb-0 shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-text tracking-tight">Security & Authority</h1>
            <p className="text-sm text-text-sub mt-0.5">What power you have given AgentPlace, and how to take it back.</p>
          </div>

          {/* Global pause / resume */}
          {isPaused ? (
            <button
              onClick={() => {
                dispatch({ type: 'SET_AUTONOMOUS_EXECUTION_PAUSED', paused: false });
                dispatch({ type: 'ADD_ACTIVITY_EVENT', event: { id: uid(), eventType: 'security', title: 'Autonomous execution resumed', summary: 'Standing authority active again', effect: 'Still-valid grants are usable. No new grants created.', timestamp: new Date(), status: 'complete' } });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-warn/40 bg-warn/10 text-warn rounded hover:bg-warn/20 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-warn" />
              Execution paused — Resume
            </button>
          ) : (
            <button
              onClick={() => setShowPauseConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 9v6m4-6v6" />
              </svg>
              Pause autonomous execution
            </button>
          )}
        </div>

        {/* Env filter */}
        <div className="flex gap-1 mb-4">
          {(['all', 'mainnet', 'testnet'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setEnvFilter(f)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${envFilter === f ? 'border-primary/40 text-primary bg-primary-dim/10' : 'border-border text-text-sub hover:text-text'}`}
            >
              {f === 'all' ? 'All' : f === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </button>
          ))}
        </div>
      </div>

      {/* Pause confirm modal */}
      {showPauseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-panel border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text mb-3">Pause autonomous execution?</h3>
            <div className="space-y-2 mb-4">
              <div>
                <p className="text-xs font-medium text-text-sub mb-1">This stops:</p>
                <ul className="space-y-0.5">
                  {['New autonomous financial actions'].map((s) => (
                    <li key={s} className="text-xs text-danger flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-danger shrink-0" />{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-text-sub mb-1">This continues:</p>
                <ul className="space-y-0.5">
                  {['Research and monitoring', 'Recommendations', 'User-controlled signed actions'].map((s) => (
                    <li key={s} className="text-xs text-accent flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-accent shrink-0" />{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-xs text-text-muted mb-1">Authority Grants remain — they are not revoked. Pause ≠ Revoke.</p>
            <p className="text-xs text-text-muted mb-4">Transactions already submitted cannot be reversed.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowPauseConfirm(false)} className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors">Cancel</button>
              <button
                onClick={() => {
                  dispatch({ type: 'SET_AUTONOMOUS_EXECUTION_PAUSED', paused: true });
                  dispatch({ type: 'ADD_ACTIVITY_EVENT', event: { id: uid(), eventType: 'security', title: 'Autonomous execution paused', summary: 'Global pause · Standing authority preserved', effect: 'Research and monitoring continue.', timestamp: new Date(), status: 'complete' } });
                  setShowPauseConfirm(false);
                }}
                className="flex-1 py-2 text-sm font-medium bg-warn text-white rounded hover:bg-warn/90 transition-colors"
              >
                Pause
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        <div className="max-w-2xl space-y-6">
          {/* Status summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Autonomous execution', value: isPaused ? 'Paused' : 'Active', color: isPaused ? 'text-warn' : 'text-accent' },
              { label: 'Capital under mandate', value: totalManagedCapital, color: 'text-text' },
              { label: 'Active authority grants', value: String(activeGrants.length), color: 'text-text' },
            ].map((item) => (
              <div key={item.label} className="border border-border rounded-lg bg-panel px-4 py-3">
                <p className="text-[10px] font-mono text-text-dim mb-1">{item.label}</p>
                <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {isPaused && activeGrants.length > 0 && (
            <div className="border border-warn/30 bg-warn/5 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-warn mb-1">Autonomous execution paused globally</p>
              <p className="text-xs text-text-sub">Standing authority still exists. Workers retain their grants. New autonomous financial actions are stopped until you resume.</p>
              <p className="text-xs text-text-muted mt-1">Pause ≠ Revoke. Existing grants are not removed.</p>
            </div>
          )}

          {/* Action power map */}
          {allGrants.filter((g) => g.status === 'active').length > 0 && (
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-3">What kind of power exists</h2>
              <div className="border border-border rounded-lg bg-panel divide-y divide-border-dim">
                {[
                  { action: 'Supply / Withdraw stablecoins', by: 'Stablecoin Manager', detail: 'Up to 500 USDC/action within mandate · Aave · Morpho' },
                  { action: 'Transfer', by: 'Main Wallet', detail: 'Approval required for each action' },
                  { action: 'Swap', by: 'Main Wallet', detail: 'Approval required for each action' },
                  { action: 'Bridge', by: 'Main Wallet', detail: 'Approval required for each action' },
                  { action: 'Borrowing', by: null, detail: 'No standing authority' },
                  { action: 'Leverage / Perps', by: null, detail: 'Approval required' },
                ].map(({ action, by, detail }) => (
                  <div key={action} className="px-4 py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-text">{action}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{detail}</p>
                    </div>
                    {by && <span className="text-[10px] font-mono text-text-sub border border-border rounded px-1.5 py-0.5 shrink-0">{by}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Who can act */}
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-3">Who can act</h2>
            {activeGrants.length === 0 ? (
              <p className="text-sm text-text-muted">No Workers have standing financial authority{envFilter !== 'all' ? ` on ${envFilter}` : ''}.</p>
            ) : (
              <div className="space-y-3">
                {activeGrants.map((g) => <GrantCard key={g.id} grant={g} isPausedGlobally={isPaused} />)}
              </div>
            )}
            {revokedOrExpiredGrants.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Revoked / Expired</p>
                {revokedOrExpiredGrants.map((g) => <GrantCard key={g.id} grant={g} isPausedGlobally={false} />)}
              </div>
            )}
          </div>

          {/* Where can AgentPlace act */}
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-3">Where can AgentPlace act</h2>
            {wallets.length === 0 ? (
              <p className="text-sm text-text-muted">No wallets connected.</p>
            ) : (
              <div className="space-y-2">
                {wallets.map((wallet) => {
                  const walletGrant = allGrants.find((g) => g.agentAccountId === wallet.agentAccountId && g.status === 'active');
                  const modeLabels: Record<string, string> = {
                    'watch-only': 'Watch-only · No execution',
                    connected: 'You sign every action',
                    'agent-account': walletGrant ? `Bounded autonomy · ${walletGrant.totalManagedCapital} managed` : 'Agent account · No active authority',
                  };
                  return (
                    <div key={wallet.id} className="border border-border rounded-lg bg-panel px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-text">{wallet.name}</p>
                        <p className="text-xs text-text-muted">{modeLabels[wallet.mode]}</p>
                      </div>
                      <button
                        onClick={() => { dispatch({ type: 'SET_VIEW', view: 'wallets' }); dispatch({ type: 'SET_ACTIVE_WALLET', id: wallet.id }); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Open →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent blocked actions */}
          {blockedActions.length > 0 && (
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-3">Recent blocked actions</h2>
              <div className="space-y-2">
                {blockedActions.map((action) => (
                  <div key={action.id} className="border border-border rounded-lg bg-panel px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-text">{action.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">{action.blockedReason}</p>
                        <p className="text-[10px] text-text-dim mt-1">Nothing was submitted · No funds moved · No execution fee charged</p>
                      </div>
                      <button onClick={() => dispatch({ type: 'SET_ACTIVE_ACTION', id: action.id })} className="text-xs text-text-muted hover:text-text shrink-0">Review →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiring soon */}
          {activeGrants.some((g) => {
            const days = Math.ceil((new Date(g.expiry).getTime() - Date.now()) / 86400000);
            return days < 30 && days > 0;
          }) && (
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-3">Expiring soon</h2>
              {activeGrants
                .filter((g) => {
                  const days = Math.ceil((new Date(g.expiry).getTime() - Date.now()) / 86400000);
                  return days < 30 && days > 0;
                })
                .map((g) => {
                  const days = Math.ceil((new Date(g.expiry).getTime() - Date.now()) / 86400000);
                  return (
                    <div key={g.id} className="border border-warn/30 rounded-lg bg-warn/5 px-4 py-3">
                      <p className="text-xs text-text-sub">
                        <span className="font-medium">{g.workerName}</span> authority expires in {days} days.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button className="text-xs text-primary border border-primary/30 rounded px-2.5 py-1 hover:bg-primary-dim/20 transition-colors">Review</button>
                        <button className="text-xs text-text-sub border border-border rounded px-2.5 py-1 hover:bg-panel-raised transition-colors">Renew authority</button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Emergency controls */}
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-3">Emergency controls</h2>
            <div className="border border-border rounded-lg bg-panel px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text">Stop safely cancellable future execution steps</p>
                  <p className="text-xs text-text-muted mt-0.5">Stops unsubmitted steps in in-progress Jobs. Cannot reverse submitted transactions.</p>
                </div>
                <button
                  onClick={() => setShowStopExecution(true)}
                  className="text-xs text-warn border border-warn/30 rounded px-3 py-1.5 hover:bg-warn/10 transition-colors shrink-0 ml-3"
                >
                  Stop
                </button>
              </div>
              <div className="border-t border-border-dim pt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text">Revoke all AgentPlace authority</p>
                  <p className="text-xs text-text-muted mt-0.5">Removes all standing financial authority. Pause is temporary — this is permanent until you re-delegate.</p>
                </div>
                <button
                  onClick={() => setShowRevokeAll(true)}
                  className="text-xs text-danger border border-danger/30 rounded px-3 py-1.5 hover:bg-danger/10 transition-colors shrink-0 ml-3"
                >
                  Revoke all
                </button>
              </div>
            </div>
            <p className="text-[10px] text-text-dim mt-2 px-1">After revoking: wallets, Agent Accounts, Workers, Routines, and history are preserved. You can withdraw funds at any time.</p>
          </div>

          {/* Security history */}
          {securityEvents.length > 0 && (
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-text-dim mb-3">Security history</h2>
              <div className="border border-border rounded-lg bg-panel divide-y divide-border-dim">
                {securityEvents.map((e) => (
                  <div key={e.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text">{e.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">{e.summary}</p>
                        {e.effect && <p className="text-[10px] text-text-dim mt-0.5">{e.effect}</p>}
                      </div>
                      <span className="text-[10px] text-text-dim shrink-0">{timeAgo(e.timestamp)}</span>
                    </div>
                    {(e.workerId || e.jobId) && (
                      <div className="flex gap-2 mt-2">
                        {e.workerId && (
                          <button
                            onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: e.workerId! })}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Open Worker →
                          </button>
                        )}
                        {e.jobId && (
                          <button
                            onClick={() => dispatch({ type: 'SET_ACTIVE_JOB', id: e.jobId! })}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Open Job →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showRevokeAll && <RevokeAllModal onClose={() => setShowRevokeAll(false)} />}
      {showStopExecution && <StopExecutionModal onClose={() => setShowStopExecution(false)} />}
    </div>
  );
}
