import { useState } from 'react';
import { useAppState, useDispatch, uid, runStablecoinApproveEachMove, runStablecoinManageWithRules } from '../state/AppContext';
import type { WalletResource, AgentAccount, WalletMode } from '../state/types';

// ── Shared ────────────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<WalletMode, { label: string; badge: string; badgeColor: string; tagline: string }> = {
  'watch-only': {
    label: 'Watch-only',
    badge: 'Read-only',
    badgeColor: 'text-text-muted border-border',
    tagline: 'AgentPlace can see it, but can never move funds.',
  },
  connected: {
    label: 'Connected Wallet',
    badge: 'You sign',
    badgeColor: 'text-primary border-primary/30',
    tagline: 'AgentPlace prepares actions. You approve and sign every one.',
  },
  'agent-account': {
    label: 'Agent Account',
    badge: 'Bounded autonomy',
    badgeColor: 'text-accent border-accent/30',
    tagline: 'Workers can act within rules you explicitly approve.',
  },
};

// ── Add wallet modal ──────────────────────────────────────────────────────────

type AddStep =
  | 'choose'
  | 'watch-address'
  | 'watch-name'
  | 'connect-mock'
  | 'agent-create'
  | 'agent-done';

function AddWalletModal({ onClose, initialStep }: { onClose: () => void; initialStep?: AddStep }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [step, setStep] = useState<AddStep>(initialStep ?? 'choose');
  const [address, setAddress] = useState('');
  const [walletName, setWalletName] = useState('');

  function handleSetupReturn(newWalletId?: string) {
    const ret = state.financialSetupReturn;
    if (!ret) return;
    dispatch({ type: 'SET_FINANCIAL_SETUP_RETURN', context: null });
    // Return to originating conversation
    dispatch({ type: 'SET_ACTIVE_CONV', id: ret.convId });
    // Continue the flow
    if (ret.flow === 'stablecoin-approve-each' && newWalletId) {
      setTimeout(() => {
        runStablecoinApproveEachMove(dispatch, ret.convId, true, newWalletId);
      }, 400);
    } else if (ret.flow === 'stablecoin-manage-rules') {
      setTimeout(() => {
        const agentAccount = state.agentAccounts[0] ?? null;
        const hasActiveAuthority = state.authorityGrants.some(
          (g) => g.workerId === 'w-stablecoin' && g.status === 'active'
        );
        runStablecoinManageWithRules(dispatch, ret.convId, agentAccount, hasActiveAuthority);
      }, 400);
    }
  }

  function handleWatchSubmit() {
    if (!address.trim() || !walletName.trim()) return;
    const walletId = uid();
    const shortAddr = address.length > 10
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;

    dispatch({
      type: 'ADD_WALLET',
      wallet: {
        id: walletId,
        name: walletName.trim(),
        mode: 'watch-only',
        address: shortAddr,
        networks: ['Ethereum', 'Base', 'Arbitrum', 'Polygon'],
        balances: [],
        connectedWorkerIds: [],
        createdAt: new Date(),
      },
    });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'wallet',
        title: `${walletName.trim()} added as watch-only`,
        summary: `Watch-only · ${shortAddr} · EVM networks`,
        walletId,
        timestamp: new Date(),
        status: 'complete',
      },
    });
    dispatch({ type: 'SET_ACTIVE_WALLET', id: walletId });
    onClose();
  }

  function handleConnect() {
    const walletId = uid();
    dispatch({
      type: 'ADD_WALLET',
      wallet: {
        id: walletId,
        name: 'My Wallet',
        mode: 'connected',
        address: '0x7c9a...e3f1',
        networks: ['Ethereum', 'Base'],
        balances: [
          { symbol: 'ETH', amount: '1.2', usdValue: '$2,880' },
          { symbol: 'USDC', amount: '500', usdValue: '$500' },
        ],
        connectedWorkerIds: [],
        createdAt: new Date(),
      },
    });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'wallet',
        title: 'My Wallet connected',
        summary: 'Connected wallet · You approve every action',
        walletId,
        timestamp: new Date(),
        status: 'complete',
      },
    });
    if (state.financialSetupReturn) {
      handleSetupReturn(walletId);
    } else {
      onClose();
    }
  }

  function handleCreateAgentAccount() {
    const walletId = uid();
    const accountId = uid();

    dispatch({
      type: 'CREATE_AGENT_ACCOUNT',
      account: {
        id: accountId,
        name: 'My Agent Account',
        walletId,
        totalBalance: '0 USDC',
        availableBalance: '0 USDC',
        deployedBalance: '0 USDC',
        networks: ['Base', 'Arbitrum'],
        createdAt: new Date(),
      },
      wallet: {
        id: walletId,
        name: 'My Agent Account',
        mode: 'agent-account',
        address: `AA-0x${uid()}`,
        networks: ['Base', 'Arbitrum'],
        balances: [],
        connectedWorkerIds: [],
        agentAccountId: accountId,
        createdAt: new Date(),
      },
    });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'wallet',
        title: 'Agent Account created',
        summary: 'Agent account · Worker authority: None · Balance: 0',
        walletId,
        timestamp: new Date(),
        status: 'complete',
      },
    });
    setStep('agent-done');
  }

  function handleAgentDoneContinue() {
    if (state.financialSetupReturn) {
      handleSetupReturn();
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-panel border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">
            {step === 'choose' && 'How should AgentPlace work with this account?'}
            {step === 'watch-address' && 'Watch an address'}
            {step === 'watch-name' && 'Give it a name'}
            {step === 'connect-mock' && 'Connect existing wallet'}
            {step === 'agent-create' && 'Create Agent Account'}
            {step === 'agent-done' && 'Agent Account created'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5">
          {step === 'choose' && (
            <div className="space-y-3">
              {[
                {
                  key: 'watch',
                  title: 'Watch an address',
                  desc: 'AgentPlace can see it, but can never move funds.',
                  badge: 'Read-only',
                },
                {
                  key: 'connect',
                  title: 'Connect existing wallet',
                  desc: 'AgentPlace prepares actions, but you approve and sign every one.',
                  badge: 'You sign',
                },
                {
                  key: 'agent',
                  title: 'Create Agent Account',
                  desc: 'Workers can act within rules you explicitly approve. You remain the ultimate owner.',
                  badge: 'Bounded autonomy',
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (opt.key === 'watch') setStep('watch-address');
                    if (opt.key === 'connect') setStep('connect-mock');
                    if (opt.key === 'agent') setStep('agent-create');
                  }}
                  className="w-full text-left border border-border rounded-lg px-4 py-3.5 hover:bg-panel-raised hover:border-border transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text">{opt.title}</p>
                      <p className="text-xs text-text-sub mt-0.5 leading-relaxed">{opt.desc}</p>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted border border-border rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                      {opt.badge}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 'watch-address' && (
            <div className="space-y-4">
              <p className="text-xs text-text-sub leading-relaxed">
                An EVM address works across Ethereum, Base, Arbitrum, Polygon, and other supported chains. AgentPlace cannot distinguish which chain an EVM address belongs to — it will check all of them.
              </p>
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Public address</label>
                <input
                  autoFocus
                  placeholder="0x... or ENS name"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-panel-raised border border-border rounded px-3 py-2.5 text-sm text-text font-mono placeholder-text-dim outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('choose')}
                  className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => address.trim() && setStep('watch-name')}
                  disabled={!address.trim()}
                  className={`flex-1 py-2 text-sm rounded font-medium transition-colors ${address.trim() ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-panel text-text-dim cursor-not-allowed border border-border'}`}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'watch-name' && (
            <div className="space-y-4">
              <p className="text-xs text-text-sub leading-relaxed">
                Give it a name that helps you remember what this address represents.
              </p>
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Name</label>
                <input
                  autoFocus
                  placeholder="Main Wallet, Cold Storage, DAO Treasury…"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && walletName.trim() && handleWatchSubmit()}
                  className="w-full bg-panel-raised border border-border rounded px-3 py-2.5 text-sm text-text placeholder-text-dim outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="bg-panel-raised border border-border-dim rounded px-3 py-2.5 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Address</span>
                  <span className="text-text-sub font-mono">{address.slice(0, 8)}…{address.slice(-4)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Mode</span>
                  <span className="text-text-sub">Watch-only · No signing</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Networks</span>
                  <span className="text-text-sub">All EVM</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('watch-address')}
                  className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleWatchSubmit}
                  disabled={!walletName.trim()}
                  className={`flex-1 py-2 text-sm rounded font-medium transition-colors ${walletName.trim() ? 'bg-primary text-white hover:bg-primary-hover' : 'bg-panel text-text-dim cursor-not-allowed border border-border'}`}
                >
                  Watch this address
                </button>
              </div>
            </div>
          )}

          {step === 'connect-mock' && (
            <div className="space-y-4">
              <div className="border border-primary/20 rounded-lg px-4 py-3 bg-primary-dim/10">
                <p className="text-sm font-medium text-text mb-1">You approve every financial action.</p>
                <p className="text-xs text-text-sub leading-relaxed">
                  AgentPlace can prepare actions, but cannot move funds without your wallet approval. Connecting does not create standing authority.
                </p>
              </div>
              <div className="space-y-2">
                {['MetaMask', 'Coinbase Wallet', 'WalletConnect'].map((w) => (
                  <button
                    key={w}
                    onClick={handleConnect}
                    className="w-full text-left border border-border rounded-lg px-4 py-3 hover:bg-panel-raised hover:border-border transition-colors"
                  >
                    <span className="text-sm text-text-sub">{w}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep('choose')}
                className="w-full py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors"
              >
                Back
              </button>
            </div>
          )}

          {step === 'agent-create' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {[
                  { label: 'Owner control', text: 'You remain the ultimate owner. The Agent Account cannot act beyond the rules you explicitly set.' },
                  { label: 'Worker authority', text: 'Starts with none. You grant authority to specific Workers in a separate step after creation.' },
                  { label: 'Recovery', text: 'Your ownership key controls the account. No Worker key can override owner withdrawal.' },
                ].map((item) => (
                  <div key={item.label} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                    <div>
                      <p className="text-xs font-medium text-text">{item.label}</p>
                      <p className="text-xs text-text-sub mt-0.5 leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('choose')}
                  className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateAgentAccount}
                  className="flex-1 py-2 text-sm bg-primary text-white rounded font-medium hover:bg-primary-hover transition-colors"
                >
                  Create Agent Account
                </button>
              </div>
            </div>
          )}

          {step === 'agent-done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium text-text">Agent Account created</span>
              </div>
              <div className="bg-panel-raised border border-border-dim rounded-lg px-4 py-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-text-muted">Worker authority</span><span className="text-text-sub">None</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Balance</span><span className="text-text-sub">0 USDC</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Networks</span><span className="text-text-sub">Base · Arbitrum</span></div>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                No Worker has authority over this account yet. Add funds and configure authority separately.
              </p>
              <button
                onClick={handleAgentDoneContinue}
                className="w-full py-2 text-sm bg-primary text-white rounded font-medium hover:bg-primary-hover transition-colors"
              >
                {state.financialSetupReturn ? 'Continue setup →' : 'Done'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agent Account detail ──────────────────────────────────────────────────────

function AgentAccountDetail({ wallet }: { wallet: WalletResource }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const account = (state.agentAccounts ?? []).find((a) => a.id === wallet.agentAccountId);
  const grant = (state.authorityGrants ?? []).find(
    (g) => g.agentAccountId === wallet.agentAccountId && g.status === 'active'
  );
  const mandate = grant ? (state.mandates ?? []).find((m) => m.id === grant.mandateId) : null;
  const isMandatePaused = state.autonomousExecutionPaused || grant?.status === 'paused';

  function handleAddFunds() {
    if (!account) return;
    const actionId = uid();
    const action = {
      id: actionId,
      title: `Fund ${account.name} with 2,000 USDC`,
      actionType: 'fund' as const,
      economicEffect: '2,000 USDC transferred from Main Wallet to Main Agent Account.',
      rationale: 'Funding the Agent Account to enable Stablecoin Manager mandate.',
      authorityDecision: 'needs-approval' as const,
      authorityReason: 'Owner funding requires your Connected Wallet signature.',
      risks: ['Funded capital becomes available to Workers with active Authority Grants.', 'No Worker has authority yet.'],
      technicalDetails: {
        'From': 'Main Wallet · 0x1a2b...c3d4',
        'To': `${account.name}`,
        'Amount': '2,000 USDC',
        'Network': 'Base',
      },
      agentAccountId: account.id,
      walletId: 'wlt-main',
      environment: state.environment,
      amount: '2,000',
      asset: 'USDC',
      status: 'pending-review' as const,
      createdAt: new Date(),
    };
    dispatch({ type: 'ADD_FINANCIAL_ACTION', action });
    dispatch({ type: 'SET_ACTIVE_ACTION', id: actionId });
  }

  function handleWithdraw() {
    const actionId = uid();
    const action = {
      id: actionId,
      title: 'Withdraw from Main Agent Account',
      actionType: 'withdraw' as const,
      economicEffect: 'Owner withdrawal. You are removing capital from the Agent Account.',
      rationale: 'Owner-initiated withdrawal. No Worker can block this.',
      authorityDecision: 'needs-approval' as const,
      authorityReason: 'Owner withdrawal requires your Connected Wallet signature.',
      risks: [
        'Withdrawing 1,200 USDC would leave less capital than Stablecoin Manager\'s current mandate expects (1,500 USDC managed).',
        'Consider reviewing the mandate before withdrawing if it would conflict with active rules.',
      ],
      technicalDetails: {
        'From': account?.name ?? 'Agent Account',
        'To': 'Main Wallet',
        'Network': 'Base',
      },
      agentAccountId: wallet.agentAccountId,
      walletId: 'wlt-main',
      environment: state.environment,
      status: 'needs-you' as const,
      createdAt: new Date(),
    };
    dispatch({ type: 'ADD_FINANCIAL_ACTION', action });
    dispatch({ type: 'SET_ACTIVE_ACTION', id: actionId });
  }

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_WALLET', id: null })}
          className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-text">{wallet.name}</h1>
            <span className="text-[10px] font-mono text-accent border border-accent/30 rounded px-1.5 py-0.5">Agent Account</span>
          </div>
          <p className="text-xs text-text-muted font-mono">{wallet.address}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-xl space-y-4">
          {/* Balance summary */}
          <div className="border border-border rounded-lg bg-panel px-4 py-4 space-y-2">
            {[
              { label: 'Total account value', value: account?.totalBalance ?? '0 USDC' },
              { label: 'Available capital', value: account?.availableBalance ?? '0 USDC' },
              { label: 'Managed by Workers', value: account?.deployedBalance ?? '0 USDC' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-xs text-text-muted">{row.label}</span>
                <span className="text-sm font-medium text-text">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Authority envelope */}
          {grant && (
            <div className="border border-border rounded-lg bg-panel px-4 py-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">
                Authority envelope
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-1.5 rounded-full ${isMandatePaused ? 'bg-warn' : 'bg-accent'}`} />
                <span className="text-xs text-text-sub">{grant.workerName}</span>
                <span className={`text-xs ml-auto ${isMandatePaused ? 'text-warn' : 'text-accent'}`}>
                  {isMandatePaused ? 'Paused' : 'Active'}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                {[
                  ['Managed capital', grant.totalManagedCapital],
                  ['Per-action limit', grant.singleActionLimit],
                  ['Networks', grant.networks.join(' · ')],
                  ['Protocols', grant.allowedProtocols.join(' · ')],
                  ['Borrowing', grant.borrowingAllowed ? 'Allowed' : 'Not allowed'],
                  ['Leverage', grant.leverageAllowed ? 'Allowed' : 'Not allowed'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-text-muted">{k}</span>
                    <span className="text-text-sub">{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-dim mt-3">
                This envelope does not escrow capital. The account balance of {account?.totalBalance ?? '0 USDC'} is the actual value; the envelope describes Stablecoin Manager's operational boundary.
              </p>
            </div>
          )}

          {/* Networks */}
          <div className="border border-border rounded-lg bg-panel px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Networks</p>
            <div className="flex flex-wrap gap-1.5">
              {wallet.networks.map((n) => (
                <span key={n} className="text-xs text-text-sub border border-border rounded px-2 py-0.5">{n}</span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleAddFunds}
              className="flex-1 py-2 text-xs font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Add funds
            </button>
            <button
              onClick={handleWithdraw}
              className="flex-1 py-2 text-xs font-medium border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
            >
              Withdraw
            </button>
            {grant && (
              <button
                onClick={() => dispatch({ type: 'SET_VIEW', view: 'security' })}
                className="flex-1 py-2 text-xs font-medium border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
              >
                Manage authority
              </button>
            )}
          </div>

          {/* Emergency note */}
          <p className="text-xs text-text-dim">
            You can withdraw capital at any time as the account owner. Workers cannot prevent owner withdrawal.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Connected wallet detail ───────────────────────────────────────────────────

function ConnectedWalletDetail({ wallet }: { wallet: WalletResource }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const isDisconnected = wallet.disconnected;

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_WALLET', id: null })}
          className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-text">{wallet.name}</h1>
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${isDisconnected ? 'text-danger border-danger/30' : 'text-primary border-primary/30'}`}>
              {isDisconnected ? 'Disconnected' : 'Connected'}
            </span>
          </div>
          <p className="text-xs text-text-muted font-mono">{wallet.address}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-xl space-y-4">
          {isDisconnected && (
            <div className="border border-danger/30 rounded-lg bg-danger/5 px-4 py-3">
              <p className="text-sm font-medium text-danger mb-1">Wallet disconnected</p>
              <p className="text-xs text-text-sub">Reconnect to allow AgentPlace to prepare actions for your approval.</p>
              <button
                onClick={() => dispatch({ type: 'UPDATE_WALLET', walletId: wallet.id, updates: { disconnected: false } })}
                className="mt-2 text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors"
              >
                Reconnect wallet
              </button>
            </div>
          )}

          {!isDisconnected && (
            <div className="border border-primary/20 rounded-lg bg-primary-dim/10 px-4 py-3">
              <p className="text-sm font-medium text-text mb-1">You approve every financial action.</p>
              <p className="text-xs text-text-sub">AgentPlace can prepare actions, but cannot move funds without your wallet signature.</p>
            </div>
          )}

          {/* Balances */}
          <div className="border border-border rounded-lg bg-panel px-4 py-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Balances</p>
            {wallet.balances.length > 0 ? (
              <div className="space-y-2">
                {wallet.balances.map((b) => (
                  <div key={b.symbol} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-sub">{b.symbol}</span>
                    <div className="text-right">
                      <p className="text-sm text-text">{b.amount}</p>
                      <p className="text-xs text-text-muted">{b.usdValue}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">Balances will load after connection</p>
            )}
          </div>

          {/* Networks */}
          <div className="border border-border rounded-lg bg-panel px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Networks</p>
            <div className="flex flex-wrap gap-1.5">
              {wallet.networks.map((n) => (
                <span key={n} className="text-xs text-text-sub border border-border rounded px-2 py-0.5">{n}</span>
              ))}
            </div>
          </div>

          {/* Research workers */}
          {wallet.connectedWorkerIds.length > 0 && (
            <div className="border border-border rounded-lg bg-panel px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Used for research</p>
              {wallet.connectedWorkerIds.map((wId) => {
                const w = (state.workers ?? []).find((wr) => wr.id === wId);
                return w ? (
                  <button
                    key={wId}
                    onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: wId })}
                    className="text-xs text-primary hover:underline block"
                  >
                    {w.name} →
                  </button>
                ) : null;
              })}
            </div>
          )}

          <button
            onClick={() => dispatch({ type: 'UPDATE_WALLET', walletId: wallet.id, updates: { disconnected: true } })}
            className="text-xs text-danger border border-danger/20 rounded px-3 py-1.5 hover:bg-danger/10 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Watch-only detail ─────────────────────────────────────────────────────────

function WatchOnlyDetail({ wallet }: { wallet: WalletResource }) {
  const state = useAppState();
  const dispatch = useDispatch();

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_WALLET', id: null })}
          className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-text">{wallet.name}</h1>
            <span className="text-[10px] font-mono text-text-muted border border-border rounded px-1.5 py-0.5">Watch-only</span>
          </div>
          <p className="text-xs text-text-muted font-mono">{wallet.address}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-xl space-y-4">
          <div className="border border-border-dim rounded-lg bg-panel-raised px-4 py-3">
            <p className="text-xs text-text-sub leading-relaxed">
              <span className="font-medium text-text">Watch-only · Read-only · No signing · No financial authority.</span>
              {' '}AgentPlace can observe this address across all supported EVM networks but has no ability to initiate transactions.
            </p>
          </div>

          <div className="border border-border rounded-lg bg-panel px-4 py-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Networks observed</p>
            <div className="flex flex-wrap gap-1.5">
              {wallet.networks.map((n) => (
                <span key={n} className="text-xs text-text-sub border border-border rounded px-2 py-0.5">{n}</span>
              ))}
            </div>
          </div>

          {wallet.balances.length > 0 && (
            <div className="border border-border rounded-lg bg-panel px-4 py-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Holdings</p>
              <div className="space-y-2">
                {wallet.balances.map((b) => (
                  <div key={b.symbol} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-sub">{b.symbol}</span>
                    <div className="text-right">
                      <p className="text-sm text-text">{b.amount}</p>
                      <p className="text-xs text-text-muted">{b.usdValue}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio Guardian prompt */}
          <div className="border border-border rounded-lg bg-panel px-4 py-3">
            <p className="text-xs font-medium text-text mb-1">Have Portfolio Guardian analyse this address</p>
            <p className="text-xs text-text-sub mb-3 leading-relaxed">
              Portfolio Guardian will review holdings, flag material P&L changes, and track meaningful events. Read access only — no wallet authority needed.
            </p>
            <button
              onClick={() => {
                const alreadyExists = (state.workers ?? []).some((w) => w.id === 'w-portfolio');
                if (alreadyExists) {
                  // Associate this wallet and open workspace
                  dispatch({ type: 'UPDATE_WALLET', walletId: wallet.id, updates: { connectedWorkerIds: [...wallet.connectedWorkerIds.filter((id) => id !== 'w-portfolio'), 'w-portfolio'] } });
                  dispatch({ type: 'SET_ACTIVE_WALLET', id: null });
                  dispatch({ type: 'SET_ACTIVE_WORKER', id: 'w-portfolio' });
                } else if (!state.user) {
                  dispatch({
                    type: 'SET_IDENTITY_CHECKPOINT',
                    checkpoint: {
                      reason: 'add-worker',
                      feature: 'add Portfolio Guardian and keep it working for you',
                      onComplete: (user) => {
                        dispatch({ type: 'SET_USER', user });
                        const portfolioWorker = {
                          id: 'w-portfolio',
                          name: 'Portfolio Guardian',
                          tagline: 'Tracks portfolio performance and flags material changes',
                          status: 'monitoring' as const,
                          isOriginal: true,
                          responsibility: 'Portfolio Guardian monitors on-chain holdings across networks, tracks meaningful P&L changes, and surfaces material events.',
                          authoritySummary: 'Read-only · No wallet authority',
                          currentFocus: `Monitoring ${wallet.name}`,
                        };
                        dispatch({ type: 'ADD_WORKER', worker: portfolioWorker });
                        dispatch({ type: 'UPDATE_WALLET', walletId: wallet.id, updates: { connectedWorkerIds: [...wallet.connectedWorkerIds, 'w-portfolio'] } });
                        dispatch({ type: 'ADD_ACTIVITY_EVENT', event: { id: uid(), eventType: 'worker-added', title: 'Portfolio Guardian added to your workforce', summary: 'Read-only monitoring · No wallet authority', workerId: 'w-portfolio', workerName: 'Portfolio Guardian', timestamp: new Date(), status: 'operational' } });
                        dispatch({ type: 'SET_ACTIVE_WALLET', id: null });
                        dispatch({ type: 'SET_ACTIVE_WORKER', id: 'w-portfolio' });
                      },
                    },
                  });
                } else {
                  const portfolioWorker = {
                    id: 'w-portfolio',
                    name: 'Portfolio Guardian',
                    tagline: 'Tracks portfolio performance and flags material changes',
                    status: 'monitoring' as const,
                    isOriginal: true,
                    responsibility: 'Portfolio Guardian monitors on-chain holdings across networks, tracks meaningful P&L changes, and surfaces material events.',
                    authoritySummary: 'Read-only · No wallet authority',
                    currentFocus: `Monitoring ${wallet.name}`,
                  };
                  dispatch({ type: 'ADD_WORKER', worker: portfolioWorker });
                  dispatch({ type: 'UPDATE_WALLET', walletId: wallet.id, updates: { connectedWorkerIds: [...wallet.connectedWorkerIds, 'w-portfolio'] } });
                  dispatch({ type: 'ADD_ACTIVITY_EVENT', event: { id: uid(), eventType: 'worker-added', title: 'Portfolio Guardian added to your workforce', summary: 'Read-only monitoring · No wallet authority', workerId: 'w-portfolio', workerName: 'Portfolio Guardian', timestamp: new Date(), status: 'operational' } });
                  dispatch({ type: 'SET_ACTIVE_WALLET', id: null });
                  dispatch({ type: 'SET_ACTIVE_WORKER', id: 'w-portfolio' });
                }
              }}
              className="text-xs text-primary border border-primary/30 rounded px-3 py-1.5 hover:bg-primary-dim/20 transition-colors"
            >
              {(state.workers ?? []).some((w) => w.id === 'w-portfolio') ? 'Open Portfolio Guardian' : 'Add Portfolio Guardian'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wallet row ────────────────────────────────────────────────────────────────

function WalletRow({ wallet }: { wallet: WalletResource }) {
  const dispatch = useDispatch();
  const cfg = MODE_CONFIG[wallet.mode];
  const isDisconnected = wallet.disconnected;

  const primaryBalance = wallet.balances[0];

  return (
    <button
      onClick={() => dispatch({ type: 'SET_ACTIVE_WALLET', id: wallet.id })}
      className="w-full text-left border border-border rounded-lg bg-panel px-5 py-4 hover:bg-panel-raised hover:border-border transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded bg-panel-raised border border-border flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {wallet.mode === 'watch-only' && (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            )}
            {wallet.mode === 'connected' && (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6z M16 12V7a1 1 0 00-1-1H4" />
            )}
            {wallet.mode === 'agent-account' && (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            )}
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text">{wallet.name}</span>
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${isDisconnected ? 'text-danger border-danger/30' : cfg.badgeColor}`}>
              {isDisconnected ? 'Disconnected' : cfg.badge}
            </span>
          </div>
          <p className="text-xs text-text-muted font-mono mt-0.5">{wallet.address}</p>
          <p className="text-xs text-text-sub mt-1">{cfg.tagline}</p>
          {primaryBalance && (
            <p className="text-xs text-text-muted mt-1">{primaryBalance.amount} {primaryBalance.symbol} · {primaryBalance.usdValue}</p>
          )}
        </div>
        <svg className="w-4 h-4 text-text-dim group-hover:text-text-muted shrink-0 mt-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}

// ── Mode explainer ────────────────────────────────────────────────────────────

function ModeExplainer() {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {(Object.entries(MODE_CONFIG) as [WalletMode, typeof MODE_CONFIG[WalletMode]][]).map(([mode, cfg]) => (
        <div key={mode} className="border border-border-dim rounded-lg bg-panel px-3 py-3">
          <p className="text-xs font-medium text-text mb-1">{cfg.label}</p>
          <p className="text-[10px] text-text-muted leading-relaxed">{cfg.tagline}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main WalletsView ──────────────────────────────────────────────────────────

export function WalletsView() {
  const state = useAppState();
  const dispatch = useDispatch();
  const ret = state.financialSetupReturn;
  const autoStep: AddStep | undefined =
    ret?.requiredMode === 'connected' ? 'connect-mock' :
    ret?.requiredMode === 'agent-account' ? 'agent-create' :
    undefined;
  const [showAdd, setShowAdd] = useState(!!autoStep);

  const activeWallet = state.activeWalletId
    ? (state.wallets ?? []).find((w) => w.id === state.activeWalletId)
    : null;

  // Detail view
  if (activeWallet) {
    if (activeWallet.mode === 'agent-account') return <AgentAccountDetail wallet={activeWallet} />;
    if (activeWallet.mode === 'connected') return <ConnectedWalletDetail wallet={activeWallet} />;
    return <WatchOnlyDetail wallet={activeWallet} />;
  }

  if (!state.user) {
    return (
      <div className="h-full flex items-center justify-center bg-bg px-6">
        <div className="text-center max-w-sm">
          <h2 className="text-base font-semibold text-text mb-2">Wallets & Accounts</h2>
          <p className="text-sm text-text-sub leading-relaxed mb-5">
            Sign in to connect wallets, add watch-only addresses, and create Agent Accounts.
          </p>
          <button
            onClick={() =>
              dispatch({
                type: 'SET_IDENTITY_CHECKPOINT',
                checkpoint: {
                  reason: 'sign-in',
                  feature: 'connect wallets and manage financial resources',
                  onComplete: (user) => dispatch({ type: 'SET_USER', user }),
                },
              })
            }
            className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const wallets = state.wallets ?? [];

  return (
    <>
      <div className="h-full flex flex-col bg-bg overflow-hidden">
        <div className="px-6 pt-8 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-semibold text-text tracking-tight">Wallets & Accounts</h1>
              <p className="text-sm text-text-sub mt-0.5">
                Three ways AgentPlace can work with your financial resources
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded text-text-sub hover:text-text hover:bg-panel transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
              </svg>
              Add wallet or account
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          <div className="max-w-2xl">
            {wallets.length === 0 ? (
              <div className="py-12 text-center">
                <ModeExplainer />
                <button
                  onClick={() => setShowAdd(true)}
                  className="px-4 py-2 bg-primary text-white text-sm rounded font-medium hover:bg-primary-hover transition-colors"
                >
                  Add wallet or account
                </button>
              </div>
            ) : (
              <>
                <ModeExplainer />
                <div className="space-y-2">
                  {wallets.map((w) => (
                    <WalletRow key={w.id} wallet={w} />
                  ))}
                </div>
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-4 w-full border border-dashed border-border rounded-lg py-3 text-sm text-text-muted hover:text-text hover:border-border hover:bg-panel transition-colors"
                >
                  + Add wallet or account
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showAdd && <AddWalletModal onClose={() => setShowAdd(false)} initialStep={autoStep} />}
    </>
  );
}
