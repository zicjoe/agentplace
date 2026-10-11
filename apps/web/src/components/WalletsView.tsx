import { useState } from 'react';
import { useAppState, useDispatch, uid, runStablecoinApproveEachMove, runStablecoinManageWithRules } from '../state/AppContext';
import type { WalletResource, WalletMode } from '../state/types';
import { connectDurableEvmWallet, createDurableAgentAccount, createDurableWatchWallet, disconnectDurableWallet, fetchWalletState, refreshDurableEvmWallet, removeDurableWallet, updateDurableWallet } from '../platform/walletApi';

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
    tagline: 'Connection grants no spending authority. Protected actions require explicit approval.',
  },
  'agent-account': {
    label: 'Agent Account',
    badge: 'Setup',
    badgeColor: 'text-accent border-accent/30',
    tagline: 'Durable account setup. Deployment and Worker authority are separate gated steps.',
  },
};

const EVM_AGENT_ACCOUNT_NETWORKS = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'base', label: 'Base' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'bnb', label: 'BNB Chain' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'robinhood', label: 'Robinhood Chain' },
] as const;

const WATCH_EVM_NETWORKS = [
  { id: 'ethereum', label: 'Ethereum', chainReference: '1' },
  { id: 'arbitrum', label: 'Arbitrum', chainReference: '42161' },
  { id: 'base', label: 'Base', chainReference: '8453' },
  { id: 'bnb', label: 'BNB Chain', chainReference: '56' },
  { id: 'polygon', label: 'Polygon', chainReference: '137' },
  { id: 'robinhood', label: 'Robinhood Chain', chainReference: '4663' },
] as const;

// ── Add wallet modal ──────────────────────────────────────────────────────────

type AddStep =
  | 'choose'
  | 'watch-address'
  | 'watch-name'
  | 'connect-wallet'
  | 'agent-create'
  | 'agent-done';

function AddWalletModal({ onClose, initialStep }: { onClose: () => void; initialStep?: AddStep }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [step, setStep] = useState<AddStep>(initialStep ?? 'choose');
  const [address, setAddress] = useState('');
  const [walletName, setWalletName] = useState('');
  const [watchNamespace, setWatchNamespace] = useState<'eip155' | 'solana'>('eip155');
  const [watchNetworkId, setWatchNetworkId] = useState('ethereum');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectedOwners = (state.wallets ?? []).filter((wallet) => wallet.mode === 'connected' && !wallet.disconnected && wallet.namespace !== 'solana');
  const [ownerWalletId, setOwnerWalletId] = useState(() => connectedOwners[0]?.id ?? '');
  const [preferredNetworkIds, setPreferredNetworkIds] = useState<string[]>([]);

  async function refreshWalletState() {
    const walletState = await fetchWalletState();
    dispatch({ type: 'SET_WALLETS', wallets: walletState.wallets });
    dispatch({ type: 'SET_AGENT_ACCOUNTS', agentAccounts: walletState.agentAccounts });
  }

  function handleSetupReturn(newWalletId?: string) {
    const ret = state.financialSetupReturn;
    if (!ret) return;
    dispatch({ type: 'SET_FINANCIAL_SETUP_RETURN', context: null });
    dispatch({ type: 'SET_ACTIVE_CONV', id: ret.convId });
    if (ret.flow === 'stablecoin-approve-each' && newWalletId) {
      setTimeout(() => {
        runStablecoinApproveEachMove(dispatch, ret.convId, true, newWalletId);
      }, 400);
    } else if (ret.flow === 'stablecoin-manage-rules') {
      setTimeout(() => {
        const agentAccount = state.agentAccounts[0] ?? null;
        const hasActiveAuthority = state.authorityGrants.some(
          (grant) => grant.workerId === 'w-stablecoin' && grant.status === 'active'
        );
        runStablecoinManageWithRules(dispatch, ret.convId, agentAccount, hasActiveAuthority);
      }, 400);
    }
  }

  async function handleWatchSubmit() {
    if (!address.trim() || !walletName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const networks = watchNamespace === 'solana'
        ? [{ networkId: 'solana', chainReference: 'mainnet-beta' }]
        : WATCH_EVM_NETWORKS.filter((network) => network.id === watchNetworkId).map((network) => ({ networkId: network.id, chainReference: network.chainReference }));
      const wallet = await createDurableWatchWallet({ name: walletName.trim(), address: address.trim(), namespace: watchNamespace, networks });
      await refreshWalletState();
      dispatch({ type: 'SET_ACTIVE_WALLET', id: wallet.id });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add this watch-only address.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConnect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const wallet = await connectDurableEvmWallet('My Wallet');
      await refreshWalletState();
      if (state.financialSetupReturn) handleSetupReturn(wallet.id);
      else onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not connect the browser wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAgentAccount() {
    if (!ownerWalletId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ownerWallet = connectedOwners.find((wallet) => wallet.id === ownerWalletId);
      if (!ownerWallet) throw new Error('Choose an active connected EVM owner wallet.');
      await refreshDurableEvmWallet(ownerWallet);
      await createDurableAgentAccount({ name: 'My Agent Account', ownerWalletId, preferredNetworkIds });
      await refreshWalletState();
      setStep('agent-done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the Agent Account setup.');
    } finally {
      setBusy(false);
    }
  }

  function handleAgentDoneContinue() {
    if (state.financialSetupReturn) handleSetupReturn();
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-panel border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">
            {step === 'choose' && 'How should AgentPlace work with this account?'}
            {step === 'watch-address' && 'Watch an address'}
            {step === 'watch-name' && 'Give it a name'}
            {step === 'connect-wallet' && 'Connect existing wallet'}
            {step === 'agent-create' && 'Create Agent Account setup'}
            {step === 'agent-done' && 'Agent Account setup created'}
          </h2>
          <button onClick={onClose} disabled={busy} className="text-text-muted hover:text-text p-1 rounded transition-colors disabled:opacity-40">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5">
          {step === 'choose' && (
            <div className="space-y-3">
              {[
                { key: 'watch', title: 'Watch an address', desc: 'Save a public EVM or Solana address. AgentPlace can never sign from it.', badge: 'Read-only' },
                { key: 'connect', title: 'Connect existing wallet', desc: 'Read the account and current network from your browser wallet. Connecting grants no spending authority.', badge: 'You sign' },
                { key: 'agent', title: 'Create Agent Account setup', desc: 'Create the durable account record now. Deployment and Worker authority remain separate later milestones.', badge: 'No authority yet' },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    setError(null);
                    if (option.key === 'watch') setStep('watch-address');
                    if (option.key === 'connect') setStep('connect-wallet');
                    if (option.key === 'agent') setStep('agent-create');
                  }}
                  className="w-full text-left border border-border rounded-lg px-4 py-3.5 hover:bg-panel-raised hover:border-border transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-text">{option.title}</p>
                      <p className="text-xs text-text-sub mt-0.5 leading-relaxed">{option.desc}</p>
                    </div>
                    <span className="text-[10px] font-mono text-text-muted border border-border rounded px-1.5 py-0.5 shrink-0 mt-0.5">{option.badge}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 'watch-address' && (
            <div className="space-y-4">
              <p className="text-xs text-text-sub leading-relaxed">
                Watch-only resources store a public address only. They never create signing or transaction authority.
              </p>
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Address type</label>
                <select
                  value={watchNamespace}
                  onChange={(event) => { const value = event.target.value as 'eip155' | 'solana'; setWatchNamespace(value); if (value === 'eip155' && !watchNetworkId) setWatchNetworkId('ethereum'); }}
                  className="w-full bg-panel-raised border border-border rounded px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50"
                >
                  <option value="eip155">EVM address</option>
                  <option value="solana">Solana address</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Public address</label>
                <input
                  autoFocus
                  placeholder={watchNamespace === 'eip155' ? '0x…' : 'Solana public address'}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full bg-panel-raised border border-border rounded px-3 py-2.5 text-sm text-text font-mono placeholder-text-dim outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              {watchNamespace === 'eip155' ? (
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Observe on network</label>
                  <select
                    value={watchNetworkId}
                    onChange={(event) => setWatchNetworkId(event.target.value)}
                    className="w-full bg-panel-raised border border-border rounded px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50"
                  >
                    {WATCH_EVM_NETWORKS.map((network) => <option key={network.id} value={network.id}>{network.label}</option>)}
                  </select>
                  <p className="text-[10px] text-text-dim mt-1.5 leading-relaxed">An EVM address does not reveal which chain you mean, so AgentPlace asks instead of guessing.</p>
                </div>
              ) : (
                <p className="text-[10px] text-text-dim leading-relaxed">Solana watch-only addresses are stored with Solana mainnet context by default. No signing capability is created.</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setStep('choose')} className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors">Back</button>
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
              <p className="text-xs text-text-sub leading-relaxed">Give it a name that helps you remember what this address represents.</p>
              <div>
                <label className="text-xs text-text-muted font-medium block mb-1.5">Name</label>
                <input
                  autoFocus
                  placeholder="Main Wallet, Cold Storage, DAO Treasury…"
                  value={walletName}
                  onChange={(event) => setWalletName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && walletName.trim()) void handleWatchSubmit(); }}
                  className="w-full bg-panel-raised border border-border rounded px-3 py-2.5 text-sm text-text placeholder-text-dim outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="bg-panel-raised border border-border-dim rounded px-3 py-2.5 space-y-1">
                <div className="flex justify-between text-xs"><span className="text-text-muted">Address</span><span className="text-text-sub font-mono">{address.slice(0, 8)}…{address.slice(-4)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-muted">Mode</span><span className="text-text-sub">Watch-only · No signing</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-muted">Namespace</span><span className="text-text-sub">{watchNamespace === 'eip155' ? 'EVM' : 'Solana'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-muted">Network</span><span className="text-text-sub">{watchNamespace === 'solana' ? 'Solana' : WATCH_EVM_NETWORKS.find((network) => network.id === watchNetworkId)?.label ?? 'EVM'}</span></div>
              </div>
              {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('watch-address')} disabled={busy} className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors disabled:opacity-40">Back</button>
                <button onClick={() => void handleWatchSubmit()} disabled={!walletName.trim() || busy} className="flex-1 py-2 text-sm bg-primary text-white rounded font-medium hover:bg-primary-hover transition-colors disabled:opacity-40">
                  {busy ? 'Saving…' : 'Watch this address'}
                </button>
              </div>
            </div>
          )}

          {step === 'connect-wallet' && (
            <div className="space-y-4">
              <div className="border border-primary/20 rounded-lg px-4 py-3 bg-primary-dim/10">
                <p className="text-sm font-medium text-text mb-1">You approve every financial action.</p>
                <p className="text-xs text-text-sub leading-relaxed">
                  AgentPlace reads the selected EVM account, current chain and native balance from the browser provider. Connecting creates no standing authority.
                </p>
              </div>
              <button
                onClick={() => void handleConnect()}
                disabled={busy}
                className="w-full text-left border border-border rounded-lg px-4 py-3 hover:bg-panel-raised hover:border-border transition-colors disabled:opacity-40"
              >
                <span className="text-sm text-text-sub">{busy ? 'Waiting for browser wallet…' : 'Connect browser EVM wallet'}</span>
              </button>
              <p className="text-[11px] text-text-muted leading-relaxed">MetaMask, Coinbase Wallet and other EIP-1193 browser wallets are supported through the wallet provider already installed in your browser. WalletConnect is not claimed in this milestone.</p>
              {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">{error}</p>}
              <button onClick={() => setStep('choose')} disabled={busy} className="w-full py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors disabled:opacity-40">Back</button>
            </div>
          )}

          {step === 'agent-create' && (
            <div className="space-y-4">
              <div className="border border-border rounded-lg bg-panel-raised px-4 py-3">
                <p className="text-xs font-medium text-text">Why use an Agent Account?</p>
                <p className="text-xs text-text-sub mt-1 leading-relaxed">It is the future execution home for Workers that may operate under rules you define. M6 only creates the durable setup: no smart account is fabricated or deployed, and no Worker receives authority.</p>
              </div>
              {connectedOwners.length === 0 ? (
                <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded px-3 py-2">Connect an EVM owner wallet first. AgentPlace will not create an ownerless Agent Account record.</p>
              ) : (
                <div>
                  <label className="text-xs text-text-muted font-medium block mb-1.5">Owner wallet</label>
                  <select value={ownerWalletId} onChange={(event) => setOwnerWalletId(event.target.value)} className="w-full bg-panel-raised border border-border rounded px-3 py-2.5 text-sm text-text outline-none focus:border-primary/50">
                    {connectedOwners.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.address.slice(0, 8)}…{wallet.address.slice(-4)}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-text-muted font-medium block mb-2">Preferred EVM networks</label>
                <div className="flex flex-wrap gap-2">
                  {EVM_AGENT_ACCOUNT_NETWORKS.map((network) => {
                    const selected = preferredNetworkIds.includes(network.id);
                    return (
                      <button
                        key={network.id}
                        type="button"
                        onClick={() => setPreferredNetworkIds((current) => selected ? current.filter((id) => id !== network.id) : [...current, network.id])}
                        className={`text-xs border rounded px-2.5 py-1.5 transition-colors ${selected ? 'text-primary border-primary/40 bg-primary-dim/15' : 'text-text-sub border-border hover:border-border-strong'}`}
                      >
                        {network.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-text-dim mt-2 leading-relaxed">This is setup metadata only. Selecting a network does not deploy an account or grant authority.</p>
              </div>
              <div className="space-y-2 text-xs text-text-sub">
                <p><span className="text-text font-medium">Worker authority:</span> None.</p>
                <p><span className="text-text font-medium">Deployment status:</span> Not deployed.</p>
              </div>
              {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep('choose')} disabled={busy} className="flex-1 py-2 text-sm text-text-muted border border-border rounded hover:bg-panel transition-colors disabled:opacity-40">Back</button>
                <button onClick={() => void handleCreateAgentAccount()} disabled={!ownerWalletId || preferredNetworkIds.length === 0 || busy} className="flex-1 py-2 text-sm bg-primary text-white rounded font-medium hover:bg-primary-hover transition-colors disabled:opacity-40">
                  {busy ? 'Creating…' : 'Create setup'}
                </button>
              </div>
            </div>
          )}

          {step === 'agent-done' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <span className="text-sm font-medium text-text">Agent Account setup created</span>
              </div>
              <div className="bg-panel-raised border border-border-dim rounded-lg px-4 py-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-text-muted">Onchain deployment</span><span className="text-text-sub">Not deployed</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Worker authority</span><span className="text-text-sub">None</span></div>
                <div className="flex justify-between gap-4"><span className="text-text-muted">Preferred networks</span><span className="text-text-sub text-right">{preferredNetworkIds.map((id) => EVM_AGENT_ACCOUNT_NETWORKS.find((item) => item.id === id)?.label ?? id).join(' · ')}</span></div>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">This is a durable account setup, not a deployed signer. AgentPlace will not claim an address or balance until deployment exists.</p>
              <button onClick={handleAgentDoneContinue} className="w-full py-2 text-sm bg-primary text-white rounded font-medium hover:bg-primary-hover transition-colors">
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
  const account = (state.agentAccounts ?? []).find((item) => item.id === wallet.agentAccountId);
  const ownerWallet = account?.ownerWalletId ? (state.wallets ?? []).find((item) => item.id === account.ownerWalletId) : null;

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center gap-3">
        <button onClick={() => dispatch({ type: 'SET_ACTIVE_WALLET', id: null })} className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-text">{wallet.name}</h1>
            <span className="text-[10px] font-mono text-accent border border-accent/30 rounded px-1.5 py-0.5">Agent Account setup</span>
          </div>
          <p className="text-xs text-text-muted">{account?.deploymentStatus === 'deployed' && account.accountAddress ? account.accountAddress : 'No onchain address yet'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-xl space-y-4">
          <div className="border border-primary/20 rounded-lg bg-primary-dim/10 px-4 py-3">
            <p className="text-sm font-medium text-text mb-1">Wallet foundation only</p>
            <p className="text-xs text-text-sub leading-relaxed">This record is durable, but no smart account has been deployed and no Worker has signing authority. AgentPlace will not fabricate an address, balance or execution capability.</p>
          </div>

          <div className="border border-border rounded-lg bg-panel px-4 py-4 space-y-2">
            {[
              ['Lifecycle', account?.lifecycleStatus === 'ready-for-deployment' ? 'Ready for deployment' : account?.lifecycleStatus ?? 'setup'],
              ['Deployment status', account?.deploymentStatus ?? 'not-deployed'],
              ['Account standard', account?.accountStandard === 'unassigned' || !account?.accountStandard ? 'Not selected yet' : account.accountStandard],
              ['Worker authority', 'None'],
              ['Owner wallet', ownerWallet ? `${ownerWallet.name} · ${ownerWallet.address.slice(0, 8)}…${ownerWallet.address.slice(-4)}` : 'Unavailable'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 text-xs">
                <span className="text-text-muted">{label}</span>
                <span className="text-text-sub text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="border border-border rounded-lg bg-panel px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Preferred networks</p>
            <div className="flex flex-wrap gap-1.5">
              {(account?.networks ?? wallet.networks).map((network) => <span key={network} className="text-xs text-text-sub border border-border rounded px-2 py-0.5">{network}</span>)}
            </div>
          </div>

          <div className="border border-border-dim rounded-lg bg-panel-raised px-4 py-3">
            <p className="text-xs font-medium text-text mb-1">What comes next</p>
            <p className="text-xs text-text-sub leading-relaxed">M7 introduces Mandates + the Authority Engine. Smart-account deployment and financial execution remain separately gated so creating this setup cannot move funds by itself.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Connected wallet detail ───────────────────────────────────────────────────

function ConnectedWalletDetail({ wallet }: { wallet: WalletResource }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDisconnected = wallet.disconnected;

  async function reload() {
    const walletState = await fetchWalletState();
    dispatch({ type: 'SET_WALLETS', wallets: walletState.wallets });
    dispatch({ type: 'SET_AGENT_ACCOUNTS', agentAccounts: walletState.agentAccounts });
  }

  async function refreshConnection() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await refreshDurableEvmWallet(wallet);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not refresh this wallet connection.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectDurableWallet(wallet.id);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not disconnect this wallet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center gap-3">
        <button onClick={() => dispatch({ type: 'SET_ACTIVE_WALLET', id: null })} className="text-text-muted hover:text-text p-1 -ml-1 rounded transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-text">{wallet.name}</h1>
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${isDisconnected ? 'text-danger border-danger/30' : 'text-primary border-primary/30'}`}>{isDisconnected ? 'Disconnected' : 'Connected'}</span>
          </div>
          <p className="text-xs text-text-muted font-mono">{wallet.address}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-xl space-y-4">
          <div className={`border rounded-lg px-4 py-3 ${isDisconnected ? 'border-danger/30 bg-danger/5' : 'border-primary/20 bg-primary-dim/10'}`}>
            <p className={`text-sm font-medium mb-1 ${isDisconnected ? 'text-danger' : 'text-text'}`}>{isDisconnected ? 'Wallet disconnected' : 'Connection grants no spending authority.'}</p>
            <p className="text-xs text-text-sub leading-relaxed">This is browser-observed account/network state only. Connection is not a mandate, signer grant or autonomous authority.</p>
          </div>

          <div className="border border-border rounded-lg bg-panel px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Current native balance</p>
              <button onClick={() => void refreshConnection()} disabled={busy} className="text-[11px] text-primary hover:underline disabled:opacity-40">{busy ? 'Refreshing…' : isDisconnected ? 'Reconnect' : 'Refresh'}</button>
            </div>
            {wallet.balances.length > 0 ? wallet.balances.map((balance) => (
              <div key={`${balance.symbol}-${balance.network ?? ''}`} className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-text-sub">{balance.symbol}</p><p className="text-xs text-text-muted">{balance.network}</p></div>
                <p className="text-sm text-text">{balance.amount}</p>
              </div>
            )) : <p className="text-xs text-text-muted">No native balance observation is stored yet.</p>}
          </div>

          <div className="border border-border rounded-lg bg-panel px-4 py-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Observed network state</p>
            <div className="space-y-2">
              {(wallet.networkStates ?? []).map((network) => (
                <div key={network.networkId} className="flex items-center justify-between text-xs">
                  <span className="text-text-sub">{network.networkId}</span>
                  <span className="text-text-muted">chain {network.chainReference} · {network.connectionState}</span>
                </div>
              ))}
              {(wallet.networkStates ?? []).length === 0 && <p className="text-xs text-text-muted">No network observation stored.</p>}
            </div>
          </div>

          {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">{error}</p>}

          <button onClick={() => void disconnect()} disabled={busy || isDisconnected} className="text-xs text-danger border border-danger/20 rounded px-3 py-1.5 hover:bg-danger/10 transition-colors disabled:opacity-40">Disconnect from AgentPlace registry</button>

          {wallet.connectedWorkerIds.length > 0 && (
            <div className="border border-border rounded-lg bg-panel px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Used for research</p>
              {wallet.connectedWorkerIds.map((workerId) => {
                const worker = (state.workers ?? []).find((item) => item.id === workerId);
                return worker ? <button key={workerId} onClick={() => dispatch({ type: 'SET_ACTIVE_WORKER', id: workerId })} className="text-xs text-primary hover:underline block">{worker.name} →</button> : null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Watch-only detail ─────────────────────────────────────────────────────────

function WatchOnlyDetail({ wallet }: { wallet: WalletResource }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(wallet.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const walletState = await fetchWalletState();
    dispatch({ type: 'SET_WALLETS', wallets: walletState.wallets });
    dispatch({ type: 'SET_AGENT_ACCOUNTS', agentAccounts: walletState.agentAccounts });
  }

  async function rename() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateDurableWallet(wallet.id, { name: name.trim() });
      await reload();
      setEditingName(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not rename this watch-only wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !window.confirm(`Remove ${wallet.name} from AgentPlace? This only removes the saved watch-only record and does not affect the onchain address.`)) return;
    setBusy(true);
    setError(null);
    try {
      await removeDurableWallet(wallet.id);
      await reload();
      dispatch({ type: 'SET_ACTIVE_WALLET', id: null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this watch-only wallet.');
    } finally {
      setBusy(false);
    }
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
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input value={name} onChange={(event) => setName(event.target.value)} className="bg-panel-raised border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-primary/50" />
                <button onClick={() => void rename()} disabled={busy || !name.trim()} className="text-[11px] text-primary hover:underline disabled:opacity-40">Save</button>
                <button onClick={() => { setName(wallet.name); setEditingName(false); }} disabled={busy} className="text-[11px] text-text-muted hover:underline disabled:opacity-40">Cancel</button>
              </div>
            ) : (
              <>
                <h1 className="text-sm font-semibold text-text">{wallet.name}</h1>
                <button onClick={() => setEditingName(true)} className="text-[11px] text-text-muted hover:text-text">Rename</button>
              </>
            )}
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
              {' '}AgentPlace stores this public {wallet.namespace === 'solana' ? 'Solana' : 'EVM'} address for research and monitoring contexts only.
            </p>
          </div>

          <div className="border border-border rounded-lg bg-panel px-4 py-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-3">Network context</p>
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

          {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">{error}</p>}
          <button onClick={() => void remove()} disabled={busy} className="text-xs text-danger border border-danger/20 rounded px-3 py-1.5 hover:bg-danger/10 transition-colors disabled:opacity-40">Remove saved watch-only wallet</button>

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
    ret?.requiredMode === 'connected' ? 'connect-wallet' :
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
