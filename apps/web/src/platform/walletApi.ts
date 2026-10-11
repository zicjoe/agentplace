import { WEB_RUNTIME_SETTINGS } from './runtime';
import type { AgentAccount, WalletResource } from '../state/types';

interface ApiWalletNetwork {
  networkId: string;
  namespace: 'eip155' | 'solana';
  chainReference: string;
  address: string;
  connectionState: 'observed' | 'connected' | 'disconnected';
  nativeBalanceAtomic?: string;
  observationSource: 'user-supplied' | 'browser-provider' | 'agentplace';
  observedAt: string;
}

interface ApiWallet {
  id: string;
  name: string;
  mode: 'watch-only' | 'connected' | 'agent-account';
  namespace: 'eip155' | 'solana';
  address?: string;
  status: 'active' | 'disconnected' | 'setup' | 'removed';
  connectionSource: 'watch' | 'browser-eip1193' | 'agent-account';
  networks: ApiWalletNetwork[];
  agentAccountId?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

interface ApiAgentAccount {
  id: string;
  walletId: string;
  name: string;
  ownerWalletId: string;
  accountStandard: 'unassigned' | 'erc-4337' | 'solana-program-account';
  lifecycleStatus: 'setup' | 'ready-for-deployment' | 'deployed' | 'limited' | 'paused' | 'failed';
  deploymentStatus: 'not-deployed' | 'deploying' | 'deployed' | 'failed';
  accountAddress?: string;
  preferredNetworkIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

const CHAIN_NETWORKS: Record<number, { id: string; label: string }> = {
  1: { id: 'ethereum', label: 'Ethereum' },
  56: { id: 'bnb', label: 'BNB Chain' },
  97: { id: 'bnb-testnet', label: 'BNB Testnet' },
  137: { id: 'polygon', label: 'Polygon' },
  8453: { id: 'base', label: 'Base' },
  42161: { id: 'arbitrum', label: 'Arbitrum' },
  4663: { id: 'robinhood', label: 'Robinhood Chain' },
  46630: { id: 'robinhood-testnet', label: 'Robinhood Chain Testnet' },
  84532: { id: 'base-sepolia', label: 'Base Sepolia' },
  421614: { id: 'arbitrum-sepolia', label: 'Arbitrum Sepolia' },
  11155111: { id: 'ethereum-sepolia', label: 'Ethereum Sepolia' },
};

function endpoint(path: string): string {
  return `${WEB_RUNTIME_SETTINGS.apiBaseUrl}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || `AgentPlace API request failed (${response.status})`);
  }
  return await response.json() as T;
}

function networkLabel(network: ApiWalletNetwork): string {
  if (network.namespace === 'solana') {
    if (network.networkId === 'solana-devnet') return 'Solana Devnet';
    if (network.networkId === 'solana-testnet') return 'Solana Testnet';
    return 'Solana';
  }
  const chainId = Number.parseInt(network.chainReference, 10);
  return CHAIN_NETWORKS[chainId]?.label ?? `EVM ${network.chainReference}`;
}

function nativeBalance(networks: ApiWalletNetwork[]): WalletResource['balances'] {
  const connected = networks.find((item) => item.nativeBalanceAtomic && item.namespace === 'eip155');
  if (!connected?.nativeBalanceAtomic) return [];
  try {
    const wei = BigInt(connected.nativeBalanceAtomic);
    const whole = wei / 10n ** 18n;
    const fraction = ((wei % 10n ** 18n) / 10n ** 14n).toString().padStart(4, '0').replace(/0+$/, '');
    const amount = fraction ? `${whole}.${fraction}` : whole.toString();
    return [{ symbol: 'ETH', amount, usdValue: 'Native balance', network: networkLabel(connected) }];
  } catch {
    return [];
  }
}

function fromWallet(value: ApiWallet): WalletResource {
  return {
    id: value.id,
    name: value.name,
    mode: value.mode,
    address: value.address ?? 'Not deployed',
    networks: value.networks.length > 0 ? value.networks.map(networkLabel) : [value.namespace === 'eip155' ? 'EVM address' : 'Solana address'],
    balances: nativeBalance(value.networks),
    connectedWorkerIds: [],
    ...(value.agentAccountId ? { agentAccountId: value.agentAccountId } : {}),
    ...(value.status === 'disconnected' ? { disconnected: true } : {}),
    namespace: value.namespace,
    walletStatus: value.status,
    networkStates: value.networks.map((item) => ({
      networkId: item.networkId,
      chainReference: item.chainReference,
      connectionState: item.connectionState,
      observedAt: new Date(item.observedAt),
      ...(item.nativeBalanceAtomic ? { nativeBalanceAtomic: item.nativeBalanceAtomic } : {}),
    })),
    createdAt: new Date(value.createdAt),
  };
}

function preferredNetworkLabel(id: string): string {
  if (id === 'ethereum') return 'Ethereum';
  if (id === 'arbitrum') return 'Arbitrum';
  if (id === 'base') return 'Base';
  if (id === 'bnb') return 'BNB Chain';
  if (id === 'polygon') return 'Polygon';
  if (id === 'robinhood') return 'Robinhood Chain';
  return id;
}

function fromAgentAccount(value: ApiAgentAccount): AgentAccount {
  return {
    id: value.id,
    name: value.name,
    walletId: value.walletId,
    totalBalance: '0',
    availableBalance: '0',
    deployedBalance: '0',
    networks: value.preferredNetworkIds.map(preferredNetworkLabel),
    ownerWalletId: value.ownerWalletId,
    lifecycleStatus: value.lifecycleStatus,
    deploymentStatus: value.deploymentStatus,
    accountStandard: value.accountStandard,
    ...(value.accountAddress ? { accountAddress: value.accountAddress } : {}),
    createdAt: new Date(value.createdAt),
  };
}

export async function fetchWalletState(): Promise<{ wallets: WalletResource[]; agentAccounts: AgentAccount[] }> {
  const data = await request<{ wallets: ApiWallet[]; agentAccounts: ApiAgentAccount[] }>('/api/v1/wallets');
  return { wallets: data.wallets.map(fromWallet), agentAccounts: data.agentAccounts.map(fromAgentAccount) };
}

export async function createDurableWatchWallet(input: { name: string; address: string; namespace: 'eip155' | 'solana'; networks: Array<{ networkId: string; chainReference: string }> }): Promise<WalletResource> {
  const data = await request<{ wallet: ApiWallet }>('/api/v1/wallets/watch', { method: 'POST', body: JSON.stringify(input) });
  return fromWallet(data.wallet);
}

function ethereumProvider(): Eip1193Provider {
  const provider = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  if (!provider) throw new Error('No EVM browser wallet was detected. Install or enable a wallet such as MetaMask or Coinbase Wallet.');
  return provider;
}

export async function connectDurableEvmWallet(name = 'My Wallet'): Promise<WalletResource> {
  const provider = ethereumProvider();
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('The browser wallet did not provide a valid EVM address.');
  const rawChainId = await provider.request({ method: 'eth_chainId' });
  if (typeof rawChainId !== 'string' || !/^0x[0-9a-fA-F]+$/.test(rawChainId)) throw new Error('The browser wallet returned an invalid chain ID.');
  const chainId = Number.parseInt(rawChainId, 16);
  const network = CHAIN_NETWORKS[chainId] ?? { id: `eip155-${chainId}`, label: `EVM ${chainId}` };
  const rawBalance = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
  const nativeBalanceAtomic = typeof rawBalance === 'string' && /^0x[0-9a-fA-F]+$/.test(rawBalance) ? BigInt(rawBalance).toString() : undefined;
  const data = await request<{ wallet: ApiWallet }>('/api/v1/wallets/connect', {
    method: 'POST',
    body: JSON.stringify({
      name,
      namespace: 'eip155',
      address,
      network: { networkId: network.id, chainReference: String(chainId), ...(nativeBalanceAtomic ? { nativeBalanceAtomic } : {}) },
    }),
  });
  return fromWallet(data.wallet);
}

export async function refreshDurableEvmWallet(wallet: WalletResource): Promise<WalletResource> {
  if (wallet.namespace !== 'eip155' || wallet.mode !== 'connected') throw new Error('Only connected EVM wallets can be refreshed in this milestone.');
  const provider = ethereumProvider();
  const accounts = await provider.request({ method: 'eth_accounts' });
  const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '';
  if (!address || address.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('The currently selected browser wallet account does not match this AgentPlace wallet.');
  const rawChainId = await provider.request({ method: 'eth_chainId' });
  if (typeof rawChainId !== 'string' || !/^0x[0-9a-fA-F]+$/.test(rawChainId)) throw new Error('The browser wallet returned an invalid chain ID.');
  const chainId = Number.parseInt(rawChainId, 16);
  const network = CHAIN_NETWORKS[chainId] ?? { id: `eip155-${chainId}`, label: `EVM ${chainId}` };
  const rawBalance = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
  const nativeBalanceAtomic = typeof rawBalance === 'string' && /^0x[0-9a-fA-F]+$/.test(rawBalance) ? BigInt(rawBalance).toString() : undefined;
  const data = await request<{ wallet: ApiWallet }>(`/api/v1/wallets/${encodeURIComponent(wallet.id)}/network-state`, {
    method: 'POST',
    body: JSON.stringify({ networkId: network.id, chainReference: String(chainId), address, connected: true, ...(nativeBalanceAtomic ? { nativeBalanceAtomic } : {}) }),
  });
  return fromWallet(data.wallet);
}

export async function updateDurableWallet(walletId: string, patch: { name?: string; status?: 'active' | 'disconnected' | 'removed' }): Promise<WalletResource | null> {
  const data = await request<{ wallet: ApiWallet | null }>(`/api/v1/wallets/${encodeURIComponent(walletId)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  return data.wallet ? fromWallet(data.wallet) : null;
}

export async function disconnectDurableWallet(walletId: string): Promise<void> {
  await updateDurableWallet(walletId, { status: 'disconnected' });
}

export async function removeDurableWallet(walletId: string): Promise<void> {
  await updateDurableWallet(walletId, { status: 'removed' });
}

export async function createDurableAgentAccount(input: { name: string; ownerWalletId: string; preferredNetworkIds: string[] }): Promise<{ wallet: WalletResource; account: AgentAccount }> {
  const data = await request<{ wallet: ApiWallet; account: ApiAgentAccount }>('/api/v1/agent-accounts', { method: 'POST', body: JSON.stringify(input) });
  return { wallet: fromWallet(data.wallet), account: fromAgentAccount(data.account) };
}
