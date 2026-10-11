import { randomUUID } from 'node:crypto';
import { getDatabasePool } from '@agent-place/db';

export type WalletMode = 'watch-only' | 'connected' | 'agent-account';
export type WalletNamespace = 'eip155' | 'solana';
export type WalletStatus = 'active' | 'disconnected' | 'setup' | 'removed';
export type WalletConnectionSource = 'watch' | 'browser-eip1193' | 'agent-account';
export type WalletNetworkConnectionState = 'observed' | 'connected' | 'disconnected';

export interface WalletNetworkState {
  networkId: string;
  namespace: WalletNamespace;
  chainReference: string;
  address: string;
  connectionState: WalletNetworkConnectionState;
  nativeBalanceAtomic?: string;
  observationSource: 'user-supplied' | 'browser-provider' | 'agentplace';
  observedAt: string;
}

export interface DurableWallet {
  id: string;
  name: string;
  mode: WalletMode;
  namespace: WalletNamespace;
  address?: string;
  status: WalletStatus;
  connectionSource: WalletConnectionSource;
  networks: WalletNetworkState[];
  agentAccountId?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

export interface DurableAgentAccount {
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

export interface CreateWatchWalletInput {
  id?: string;
  name: string;
  namespace: WalletNamespace;
  address: string;
  networks?: Array<{ networkId: string; chainReference: string }>;
}

export interface ConnectWalletInput {
  id?: string;
  name: string;
  namespace: WalletNamespace;
  address: string;
  network: {
    networkId: string;
    chainReference: string;
    nativeBalanceAtomic?: string;
  };
}

export interface CreateAgentAccountInput {
  id?: string;
  walletId?: string;
  name: string;
  ownerWalletId: string;
  preferredNetworkIds: string[];
}

type WalletRow = {
  id: string;
  name: string;
  mode: WalletMode;
  namespace: WalletNamespace;
  address: string | null;
  status: WalletStatus;
  connection_source: WalletConnectionSource;
  created_at: Date;
  updated_at: Date;
  last_seen_at: Date | null;
  agent_account_id: string | null;
};

type NetworkRow = {
  wallet_id: string;
  network_id: string;
  namespace: WalletNamespace;
  chain_reference: string;
  address: string;
  connection_state: WalletNetworkConnectionState;
  native_balance_atomic: string | null;
  observation_source: 'user-supplied' | 'browser-provider' | 'agentplace';
  observed_at: Date;
};

type AgentAccountRow = {
  id: string;
  wallet_id: string;
  name: string;
  owner_wallet_id: string;
  account_standard: DurableAgentAccount['accountStandard'];
  lifecycle_status: DurableAgentAccount['lifecycleStatus'];
  deployment_status: DurableAgentAccount['deploymentStatus'];
  account_address: string | null;
  preferred_network_ids: unknown;
  created_at: Date;
  updated_at: Date;
};

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const NETWORK_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const CHAIN_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function requireName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 120) throw new Error('INVALID_WALLET_NAME');
  return name;
}

function normalizedAddress(namespace: WalletNamespace, address: string): string {
  const value = address.trim();
  if (namespace === 'eip155') {
    if (!EVM_ADDRESS.test(value)) throw new Error('INVALID_EVM_ADDRESS');
    return value.toLowerCase();
  }
  if (!SOLANA_ADDRESS.test(value)) throw new Error('INVALID_SOLANA_ADDRESS');
  return value;
}

function validateNetwork(networkId: string, chainReference: string): { networkId: string; chainReference: string } {
  const id = networkId.trim().toLowerCase();
  const reference = chainReference.trim();
  if (!NETWORK_ID.test(id) || !CHAIN_REFERENCE.test(reference)) throw new Error('INVALID_WALLET_NETWORK');
  return { networkId: id, chainReference: reference };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

async function loadNetworks(ownerUserId: string, walletIds: string[]): Promise<Map<string, WalletNetworkState[]>> {
  const grouped = new Map<string, WalletNetworkState[]>();
  if (walletIds.length === 0) return grouped;
  const result = await getDatabasePool().query<NetworkRow>(`SELECT wallet_id,network_id,namespace,chain_reference,address,connection_state,native_balance_atomic,observation_source,observed_at
    FROM wallet_network_state WHERE owner_user_id=$1 AND wallet_id=ANY($2::text[]) ORDER BY observed_at DESC`, [ownerUserId, walletIds]);
  for (const row of result.rows) {
    const item: WalletNetworkState = {
      networkId: row.network_id,
      namespace: row.namespace,
      chainReference: row.chain_reference,
      address: row.address,
      connectionState: row.connection_state,
      observationSource: row.observation_source,
      observedAt: row.observed_at.toISOString(),
    };
    if (row.native_balance_atomic !== null) item.nativeBalanceAtomic = row.native_balance_atomic;
    const list = grouped.get(row.wallet_id) ?? [];
    list.push(item);
    grouped.set(row.wallet_id, list);
  }
  return grouped;
}

function walletFromRow(row: WalletRow, networks: WalletNetworkState[]): DurableWallet {
  const wallet: DurableWallet = {
    id: row.id,
    name: row.name,
    mode: row.mode,
    namespace: row.namespace,
    status: row.status,
    connectionSource: row.connection_source,
    networks,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
  if (row.address) wallet.address = row.address;
  if (row.agent_account_id) wallet.agentAccountId = row.agent_account_id;
  if (row.last_seen_at) wallet.lastSeenAt = row.last_seen_at.toISOString();
  return wallet;
}

function accountFromRow(row: AgentAccountRow): DurableAgentAccount {
  const account: DurableAgentAccount = {
    id: row.id,
    walletId: row.wallet_id,
    name: row.name,
    ownerWalletId: row.owner_wallet_id,
    accountStandard: row.account_standard,
    lifecycleStatus: row.lifecycle_status,
    deploymentStatus: row.deployment_status,
    preferredNetworkIds: stringArray(row.preferred_network_ids),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
  if (row.account_address) account.accountAddress = row.account_address;
  return account;
}

export async function listWallets(ownerUserId: string): Promise<DurableWallet[]> {
  const result = await getDatabasePool().query<WalletRow>(`SELECT w.id,w.name,w.mode,w.namespace,w.address,w.status,w.connection_source,w.created_at,w.updated_at,w.last_seen_at,a.id AS agent_account_id
    FROM wallet_resource w LEFT JOIN agent_account a ON a.wallet_id=w.id AND a.owner_user_id=w.owner_user_id
    WHERE w.owner_user_id=$1 AND w.status <> 'removed' ORDER BY w.created_at DESC`, [ownerUserId]);
  const networks = await loadNetworks(ownerUserId, result.rows.map((row) => row.id));
  return result.rows.map((row) => walletFromRow(row, networks.get(row.id) ?? []));
}

export async function listAgentAccounts(ownerUserId: string): Promise<DurableAgentAccount[]> {
  const result = await getDatabasePool().query<AgentAccountRow>(`SELECT a.id,a.wallet_id,a.name,a.owner_wallet_id,a.account_standard,a.lifecycle_status,a.deployment_status,a.account_address,a.preferred_network_ids,a.created_at,a.updated_at
    FROM agent_account a JOIN wallet_resource w ON w.id=a.wallet_id AND w.owner_user_id=a.owner_user_id
    WHERE a.owner_user_id=$1 AND w.status <> 'removed' ORDER BY a.created_at DESC`, [ownerUserId]);
  return result.rows.map(accountFromRow);
}

export async function getWallet(ownerUserId: string, walletId: string): Promise<DurableWallet | null> {
  const result = await getDatabasePool().query<WalletRow>(`SELECT w.id,w.name,w.mode,w.namespace,w.address,w.status,w.connection_source,w.created_at,w.updated_at,w.last_seen_at,a.id AS agent_account_id
    FROM wallet_resource w LEFT JOIN agent_account a ON a.wallet_id=w.id AND a.owner_user_id=w.owner_user_id
    WHERE w.owner_user_id=$1 AND w.id=$2 AND w.status <> 'removed'`, [ownerUserId, walletId]);
  const row = result.rows[0];
  if (!row) return null;
  const networks = await loadNetworks(ownerUserId, [walletId]);
  return walletFromRow(row, networks.get(walletId) ?? []);
}

export async function createWatchWallet(ownerUserId: string, input: CreateWatchWalletInput): Promise<DurableWallet> {
  const name = requireName(input.name);
  const address = input.address.trim();
  const normalized = normalizedAddress(input.namespace, address);
  const requestedWalletId = input.id?.trim() || `wlt_${randomUUID()}`;
  const networks = (input.networks ?? []).slice(0, 16).map((item) => validateNetwork(item.networkId, item.chainReference));
  const client = await getDatabasePool().connect();
  let walletId = requestedWalletId;
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ id: string }>(`SELECT id FROM wallet_resource WHERE owner_user_id=$1 AND namespace=$2 AND address_normalized=$3 AND mode='watch-only' AND removed_at IS NULL LIMIT 1`, [ownerUserId, input.namespace, normalized]);
    if (existing.rows[0]) {
      walletId = existing.rows[0].id;
      await client.query(`UPDATE wallet_resource SET name=$3,status='active',removed_at=NULL,last_seen_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, walletId, name]);
    } else {
      await client.query(`INSERT INTO wallet_resource(id,owner_user_id,name,mode,namespace,address,address_normalized,status,connection_source,last_seen_at)
        VALUES($1,$2,$3,'watch-only',$4,$5,$6,'active','watch',now())`, [walletId, ownerUserId, name, input.namespace, address, normalized]);
    }
    for (const network of networks) {
      await client.query(`INSERT INTO wallet_network_state(wallet_id,owner_user_id,network_id,namespace,chain_reference,address,connection_state,observation_source)
        VALUES($1,$2,$3,$4,$5,$6,'observed','user-supplied') ON CONFLICT(wallet_id,network_id) DO NOTHING`, [walletId, ownerUserId, network.networkId, input.namespace, network.chainReference, address]);
    }
    await recordWalletEvent(client, ownerUserId, walletId, 'wallet.added', `${name} added as watch-only`, `${input.namespace === 'eip155' ? 'EVM' : 'Solana'} public address · No signing authority`, 'active');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const wallet = await getWallet(ownerUserId, walletId);
  if (!wallet) throw new Error('WALLET_CREATE_FAILED');
  return wallet;
}

export async function connectWallet(ownerUserId: string, input: ConnectWalletInput): Promise<DurableWallet> {
  const name = requireName(input.name);
  const address = input.address.trim();
  const normalized = normalizedAddress(input.namespace, address);
  const network = validateNetwork(input.network.networkId, input.network.chainReference);
  if (input.network.nativeBalanceAtomic !== undefined && !/^[0-9]{1,100}$/.test(input.network.nativeBalanceAtomic)) throw new Error('INVALID_NATIVE_BALANCE');
  const requestedWalletId = input.id?.trim() || `wlt_${randomUUID()}`;
  if (input.namespace !== 'eip155') throw new Error('UNSUPPORTED_CONNECTED_WALLET_NAMESPACE');
  const source: WalletConnectionSource = 'browser-eip1193';
  const client = await getDatabasePool().connect();
  let walletId = requestedWalletId;
  try {
    await client.query('BEGIN');
    const existing = await client.query<{ id: string }>(`SELECT id FROM wallet_resource WHERE owner_user_id=$1 AND namespace=$2 AND address_normalized=$3 AND mode='connected' AND removed_at IS NULL LIMIT 1`, [ownerUserId, input.namespace, normalized]);
    if (existing.rows[0]) {
      walletId = existing.rows[0].id;
      await client.query(`UPDATE wallet_resource SET name=$3,status='active',connection_source=$4,removed_at=NULL,last_seen_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, walletId, name, source]);
    } else {
      await client.query(`INSERT INTO wallet_resource(id,owner_user_id,name,mode,namespace,address,address_normalized,status,connection_source,last_seen_at)
        VALUES($1,$2,$3,'connected',$4,$5,$6,'active',$7,now())`, [walletId, ownerUserId, name, input.namespace, address, normalized, source]);
    }
    await client.query(`INSERT INTO wallet_network_state(wallet_id,owner_user_id,network_id,namespace,chain_reference,address,connection_state,native_balance_atomic,observation_source,observed_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,'connected',$7,'browser-provider',now(),now())
      ON CONFLICT(wallet_id,network_id) DO UPDATE SET chain_reference=EXCLUDED.chain_reference,address=EXCLUDED.address,connection_state='connected',native_balance_atomic=EXCLUDED.native_balance_atomic,observation_source='browser-provider',observed_at=now(),updated_at=now()`, [walletId, ownerUserId, network.networkId, input.namespace, network.chainReference, address, input.network.nativeBalanceAtomic ?? null]);
    await recordWalletEvent(client, ownerUserId, walletId, 'wallet.connected', `${name} connected`, 'Browser-observed connection · User signing remains required for every financial action', 'active');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const wallet = await getWallet(ownerUserId, walletId);
  if (!wallet) throw new Error('WALLET_CONNECT_FAILED');
  return wallet;
}

export async function observeWalletNetwork(ownerUserId: string, walletId: string, input: { networkId: string; chainReference: string; address: string; nativeBalanceAtomic?: string; connected: boolean }): Promise<DurableWallet | null> {
  const wallet = await getWallet(ownerUserId, walletId);
  if (!wallet || wallet.mode !== 'connected') return null;
  const normalizedExisting = wallet.address ? normalizedAddress(wallet.namespace, wallet.address) : '';
  if (normalizedAddress(wallet.namespace, input.address) !== normalizedExisting) throw new Error('WALLET_ADDRESS_MISMATCH');
  const network = validateNetwork(input.networkId, input.chainReference);
  if (input.nativeBalanceAtomic !== undefined && !/^[0-9]{1,100}$/.test(input.nativeBalanceAtomic)) throw new Error('INVALID_NATIVE_BALANCE');
  await getDatabasePool().query(`INSERT INTO wallet_network_state(wallet_id,owner_user_id,network_id,namespace,chain_reference,address,connection_state,native_balance_atomic,observation_source,observed_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'browser-provider',now(),now())
    ON CONFLICT(wallet_id,network_id) DO UPDATE SET chain_reference=EXCLUDED.chain_reference,address=EXCLUDED.address,connection_state=EXCLUDED.connection_state,native_balance_atomic=EXCLUDED.native_balance_atomic,observation_source='browser-provider',observed_at=now(),updated_at=now()`,
  [walletId, ownerUserId, network.networkId, wallet.namespace, network.chainReference, input.address, input.connected ? 'connected' : 'disconnected', input.nativeBalanceAtomic ?? null]);
  await getDatabasePool().query(`UPDATE wallet_resource SET status=$3,last_seen_at=now(),updated_at=now() WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, walletId, input.connected ? 'active' : 'disconnected']);
  return getWallet(ownerUserId, walletId);
}

export async function updateWallet(ownerUserId: string, walletId: string, patch: { name?: string; status?: 'active' | 'disconnected' | 'removed' }): Promise<DurableWallet | null> {
  const existing = await getWallet(ownerUserId, walletId);
  if (!existing) return null;
  const name = patch.name === undefined ? existing.name : requireName(patch.name);
  const status = patch.status ?? existing.status;
  if (status === 'setup') throw new Error('INVALID_WALLET_STATUS');
  await getDatabasePool().query(`UPDATE wallet_resource SET name=$3,status=$4,removed_at=CASE WHEN $4='removed' THEN now() ELSE NULL END,updated_at=now()
    WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, walletId, name, status]);
  if (status === 'disconnected') {
    await getDatabasePool().query(`UPDATE wallet_network_state SET connection_state='disconnected',updated_at=now() WHERE owner_user_id=$1 AND wallet_id=$2 AND connection_state='connected'`, [ownerUserId, walletId]);
  }
  if (patch.status && patch.status !== existing.status) {
    const label = patch.status === 'removed' ? 'removed' : patch.status === 'disconnected' ? 'disconnected' : 'reactivated';
    await recordWalletEvent(getDatabasePool(), ownerUserId, walletId, `wallet.${label}`, `${existing.name} ${label}`, 'Wallet registry state changed. No authority was created.', patch.status);
  }
  return status === 'removed' ? null : getWallet(ownerUserId, walletId);
}

export async function createAgentAccount(ownerUserId: string, input: CreateAgentAccountInput): Promise<{ wallet: DurableWallet; account: DurableAgentAccount }> {
  const name = requireName(input.name);
  const ownerWallet = await getWallet(ownerUserId, input.ownerWalletId);
  if (!ownerWallet || ownerWallet.mode !== 'connected' || ownerWallet.status !== 'active') throw new Error('CONNECTED_OWNER_WALLET_REQUIRED');
  if (ownerWallet.namespace !== 'eip155') throw new Error('AGENT_ACCOUNT_EVM_OWNER_REQUIRED');
  const preferred = [...new Set(input.preferredNetworkIds.map((value) => value.trim().toLowerCase()).filter((value) => NETWORK_ID.test(value)))].slice(0, 16);
  if (preferred.length === 0) throw new Error('AGENT_ACCOUNT_NETWORK_REQUIRED');
  const walletId = input.walletId?.trim() || `wlt_${randomUUID()}`;
  const accountId = input.id?.trim() || `aa_${randomUUID()}`;
  const client = await getDatabasePool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO wallet_resource(id,owner_user_id,name,mode,namespace,status,connection_source,last_seen_at)
      VALUES($1,$2,$3,'agent-account','eip155','setup','agent-account',now())`, [walletId, ownerUserId, name]);
    await client.query(`INSERT INTO agent_account(id,owner_user_id,wallet_id,name,owner_wallet_id,account_standard,lifecycle_status,deployment_status,preferred_network_ids)
      VALUES($1,$2,$3,$4,$5,'unassigned','ready-for-deployment','not-deployed',$6::jsonb)`, [accountId, ownerUserId, walletId, name, ownerWallet.id, JSON.stringify(preferred)]);
    await recordWalletEvent(client, ownerUserId, walletId, 'agent-account.setup-created', `${name} setup created`, 'Ready for deployment metadata only · No smart account deployed · No Worker authority · Owner wallet remains in control', 'setup');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const wallet = await getWallet(ownerUserId, walletId);
  const result = await getDatabasePool().query<AgentAccountRow>(`SELECT id,wallet_id,name,owner_wallet_id,account_standard,lifecycle_status,deployment_status,account_address,preferred_network_ids,created_at,updated_at FROM agent_account WHERE owner_user_id=$1 AND id=$2`, [ownerUserId, accountId]);
  if (!wallet || !result.rows[0]) throw new Error('AGENT_ACCOUNT_CREATE_FAILED');
  return { wallet, account: accountFromRow(result.rows[0]) };
}

async function recordWalletEvent(client: { query: (text: string, params?: unknown[]) => Promise<unknown> }, ownerUserId: string, walletId: string, eventType: string, title: string, summary: string, status: string): Promise<void> {
  await client.query(`INSERT INTO domain_event(id,owner_user_id,event_type,object_type,object_id,title,summary,status,origin_type,occurred_at)
    VALUES($1,$2,$3,'wallet',$4,$5,$6,$7,'user',now()) ON CONFLICT(id) DO NOTHING`, [`evt_${randomUUID()}`, ownerUserId, eventType, walletId, title, summary, status]);
}

export const moduleManifest = {
  name: 'wallets',
  layer: 'trusted-core',
  milestone: 6,
  status: 'wallet-foundation',
} as const;
